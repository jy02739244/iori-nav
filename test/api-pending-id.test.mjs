import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestDelete, onRequestPut } from '../functions/api/pending/[id].js';
import { getHomeDirtyKey } from '../functions/_middleware.js';

function createKv(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

test('PUT /api/pending/:id matches legacy root URL forms before approval', async () => {
  let duplicateParams = null;
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              if (sql.includes('SELECT * FROM pending_sites')) {
                return {
                  results: [{
                    id: 1,
                    name: 'Example',
                    url: 'https://example.com/',
                    logo: '',
                    desc: '',
                    catelog_id: 1,
                  }],
                };
              }
              throw new Error(`Unexpected all() SQL: ${sql}`);
            },
            async first() {
              if (sql.includes('SELECT id FROM sites WHERE url IN')) {
                duplicateParams = params;
                return params.includes('https://example.com') && params.includes('https://example.com/')
                  ? { id: 99 }
                  : null;
              }
              throw new Error(`Unexpected first() SQL: ${sql}`);
            },
            async run() {
              throw new Error(`Unexpected run() SQL: ${sql}`);
            },
          };
        },
      };
    },
  };
  const request = new Request('https://example.com/api/pending/1', {
    method: 'PUT',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
  });
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPut({ request, env, params: { id: '1' } });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 409);
  assert.deepEqual(duplicateParams, ['https://example.com', 'https://example.com/']);
});

// 批准 = 写入 sites + 移出待审队列。两条语句必须同批提交：
// 拆成两次 run() 时 DELETE 失败会让书签已入库、条目却永久卡在待审队列。
function createApprovalDb({ failBatch = false } = {}) {
  const calls = [];

  const db = {
    prepare(sql) {
      const statement = (params = []) => ({
        sql,
        params,
        async all() {
          if (sql.includes('SELECT * FROM pending_sites')) {
            return {
              results: [{
                id: 1,
                name: 'Example',
                url: 'https://example.com/page',
                logo: '',
                desc: '',
                catelog_id: 1,
              }],
            };
          }
          throw new Error(`Unexpected all() SQL: ${sql}`);
        },
        async first() {
          if (sql.includes('SELECT id FROM sites WHERE url IN')) return null;
          if (sql.includes('SELECT catelog, is_private FROM category')) {
            return { catelog: 'Default', is_private: 0 };
          }
          throw new Error(`Unexpected first() SQL: ${sql}`);
        },
        async run() {
          // markHomeCacheDirty also advances the graph cache generation in D1;
          // that bookkeeping write is not part of the approval transaction.
          if (sql.includes('INSERT OR REPLACE INTO settings')) return { success: true, meta: {} };
          calls.push({ kind: 'run', sql });
          return { success: true, meta: {} };
        },
      });

      return {
        bind: (...params) => statement(params),
        all: statement().all,
        first: statement().first,
        run: statement().run,
      };
    },
    async batch(statements) {
      calls.push({ kind: 'batch', sqls: statements.map(statement => statement.sql) });
      if (failBatch) throw new Error('D1 batch failed');
      return statements.map(() => ({ success: true }));
    },
  };

  return { db, calls };
}

function buildApprovalRequest() {
  return new Request('https://example.com/api/pending/1', {
    method: 'PUT',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
  });
}

test('PUT /api/pending/:id approves the insert and dequeue in a single batch', async () => {
  const { db, calls } = createApprovalDb();
  const env = { NAV_AUTH: createKv({ session_token: '1' }), NAV_DB: db };

  const response = await onRequestPut({ request: buildApprovalRequest(), env, params: { id: '1' } });
  assert.equal(response.status, 200, (await response.json()).message);

  assert.equal(calls.some(call => call.kind === 'run'), false, '写入不应走独立的 run()');
  const batches = calls.filter(call => call.kind === 'batch');
  assert.equal(batches.length, 1, 'INSERT 与 DELETE 应在同一个 batch 中');
  assert.equal(batches[0].sqls.length, 2);
  assert.match(batches[0].sqls[0], /INSERT INTO sites/);
  assert.match(batches[0].sqls[1], /DELETE FROM pending_sites/);
  assert.equal(env.NAV_AUTH.store.has(getHomeDirtyKey('public')), true, '批准成功应打脏标记');
});

test('PUT /api/pending/:id leaves no partial write when the batch fails', async () => {
  // batch 原子回滚，因此失败时既没有新书签也没有丢失待审记录，无需补打脏标记
  const { db, calls } = createApprovalDb({ failBatch: true });
  const env = { NAV_AUTH: createKv({ session_token: '1' }), NAV_DB: db };

  const response = await onRequestPut({ request: buildApprovalRequest(), env, params: { id: '1' } });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(body.message, /D1 batch failed/);
  assert.equal(calls.filter(call => call.kind === 'batch').length, 1);
  assert.equal(env.NAV_AUTH.store.has(getHomeDirtyKey('public')), false, '全部回滚时不该打脏标记');
});

test('DELETE /api/pending/:id returns 404 in one statement when the row does not exist', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ sql, params });
          return {
            async run() {
              return { success: true, meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  const request = new Request('https://example.com/api/pending/99', {
    method: 'DELETE',
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestDelete({
    request,
    env: { NAV_AUTH: createKv({ session_token: '1' }), NAV_DB: db },
    params: { id: '99' },
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.code, 404);
  assert.equal(calls.length, 1, '应只执行一条 DELETE');
  assert.match(calls[0].sql, /^DELETE FROM pending_sites/);
  assert.deepEqual(calls[0].params, ['99']);
});

test('DELETE /api/pending/:id deletes an existing row in one statement', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ sql, params });
          return {
            async run() {
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  const request = new Request('https://example.com/api/pending/7', {
    method: 'DELETE',
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestDelete({
    request,
    env: { NAV_AUTH: createKv({ session_token: '1' }), NAV_DB: db },
    params: { id: '7' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.code, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['7']);
});

test('DELETE /api/pending/:id treats a missing meta block as success', async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              // 某些驱动/包装层不返回 meta；此时不能把真实成功的删除误判为 404
              return { success: true };
            },
          };
        },
      };
    },
  };
  const request = new Request('https://example.com/api/pending/7', {
    method: 'DELETE',
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestDelete({
    request,
    env: { NAV_AUTH: createKv({ session_token: '1' }), NAV_DB: db },
    params: { id: '7' },
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).code, 200);
});
