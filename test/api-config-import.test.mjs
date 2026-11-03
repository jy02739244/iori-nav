import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/config/import.js';
import { getHomeDirtyKey } from '../functions/_middleware.js';
import { INPUT_LIMITS, IMPORT_BODY_MAX_BYTES, IMPORT_BODY_MAX_MB } from '../functions/lib/validators.js';

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

test('import rejects bodies over the declared byte limit', async () => {
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: {},
  };
  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
      'Content-Length': String(IMPORT_BODY_MAX_BYTES + 1),
    },
    body: JSON.stringify({ category: [], sites: [] }),
  });

  const response = await onRequestPost({ request, env });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.match(body.message, new RegExp(`${IMPORT_BODY_MAX_MB}MB`));
});

test('a full-count export stays within the import byte limit at realistic field sizes', async () => {
  // 10MB 这个数字的依据：跑满计数上限、字段取实测量级时仍要留有余量。
  // 实测约 300 字节/条（80 条 23KB），这里按更宽的字段从严估算。
  const category = Array.from({ length: INPUT_LIMITS.importCategories }, (_, i) => ({
    id: i + 1,
    catelog: `分类名称示例 ${i + 1}`,
    sort_order: i,
    parent_id: 0,
    is_private: 0,
  }));
  const sites = Array.from({ length: INPUT_LIMITS.importSites }, (_, i) => ({
    id: i + 1,
    name: `书签名称示例 ${i + 1}`,
    url: `https://example.com/some/path/segment/${i + 1}`,
    logo: `https://faviconsnap.com/api/favicon?url=https://example.com/${i + 1}`,
    desc: '这是一段中等长度的书签描述文本，用于估算真实备份体积。',
    catelog_id: (i % INPUT_LIMITS.importCategories) + 1,
    sort_order: i,
    is_private: 0,
  }));

  // 备份写的是 JSON.stringify(data, null, 2)，恢复时 POST 的是无缩进版本
  const backupBytes = Buffer.byteLength(JSON.stringify({ category, sites }, null, 2), 'utf8');
  const restoreBytes = Buffer.byteLength(JSON.stringify({ category, sites, override: true }), 'utf8');

  assert.ok(
    restoreBytes < backupBytes,
    '恢复载荷无缩进，必然小于带缩进的备份文件，因此备份侧不需要额外留余量'
  );
  assert.ok(
    backupBytes < IMPORT_BODY_MAX_BYTES,
    `跑满计数上限的备份应在体积上限内，实际 ${(backupBytes / 1024 / 1024).toFixed(1)}MB`
  );
});

test('import restores categories when a backup contains no bookmarks', async () => {
  const runCalls = [];
  const db = {
    prepare(sql) {
      const statement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql}`);
        },
        async run() {
          runCalls.push({ sql, params });
          return { success: true, meta: { last_row_id: 10 } };
        },
      });
      return {
        bind(...params) {
          return statement(params);
        },
        all: statement().all,
        run: statement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) await statement.run();
    },
  };
  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: [{ id: 1, catelog: '空分类', parent_id: 0, is_private: 0 }],
      sites: [],
    }),
  });

  const response = await onRequestPost({
    request,
    env: { NAV_AUTH: createKv({ session_token: '1' }), NAV_DB: db },
  });
  const body = await response.json();

  assert.equal(response.status, 201, body.message);
  const insert = runCalls.find(call => call.sql.includes('INSERT INTO category'));
  assert.ok(insert, '分类不应因书签数量为零而被忽略');
  assert.equal(insert.params[0], '空分类');
});

test('import override updates the database URL form that actually exists', async () => {
  const runCalls = [];
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [{ url: 'https://example.com' }] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      override: true,
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [{
        name: 'Updated',
        url: 'https://example.com',
        catelog_id: 1,
        sort_order: 1,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const updateCall = runCalls.find(call => call.sql.includes('UPDATE sites SET'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /更新 1 个/);
  assert.ok(updateCall);
  assert.equal(updateCall.params.at(-1), 'https://example.com');
});

test('import override without sort_order keeps the existing sort order', async () => {
  const runCalls = [];
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [{ url: 'https://example.com' }] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      override: true,
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [{
        name: 'Updated',
        url: 'https://example.com',
        catelog_id: 1,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const updateCall = runCalls.find(call => call.sql.includes('UPDATE sites SET'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /更新 1 个/);
  assert.ok(updateCall);
  assert.match(updateCall.sql, /sort_order=COALESCE\(\?, sort_order\)/);
  assert.equal(updateCall.params[5], null);
});

test('import forces public children and sites private under a private parent category', async () => {
  const runCalls = [];
  let nextCategoryId = 10;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [
        { id: 1, catelog: '私人资料', parent_id: 0, is_private: 1 },
        { id: 2, catelog: '账号面板', parent_id: 1, is_private: 0 },
      ],
      sites: [{
        name: '内部面板',
        url: 'https://internal.example',
        catelog_id: 2,
        is_private: 0,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const categoryInsertCalls = runCalls.filter(call => call.sql.includes('INSERT INTO category'));
  const siteInsertCall = runCalls.find(call => call.sql.includes('INSERT INTO sites'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /新增 1 个/);
  assert.equal(categoryInsertCalls.length, 2);
  assert.deepEqual(categoryInsertCalls[0].params, ['私人资料', 9999, 0, 1]);
  assert.deepEqual(categoryInsertCalls[1].params, ['账号面板', 9999, 10, 1]);
  assert.ok(siteInsertCall);
  assert.equal(siteInsertCall.params[5], '账号面板');
  assert.equal(siteInsertCall.params[7], 1);
});

test('import maps Chrome root bookmarks into a root category', async () => {
  const runCalls = [];
  let nextCategoryId = 30;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [],
      sites: [{
        name: 'Root Link',
        url: 'https://root.example',
        catelog_id: 0,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const categoryInsertCall = runCalls.find(call => call.sql.includes('INSERT INTO category'));
  const siteInsertCall = runCalls.find(call => call.sql.includes('INSERT INTO sites'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /新增 1 个/);
  assert.ok(categoryInsertCall);
  assert.deepEqual(categoryInsertCall.params, ['默认', 9999, 0, 0]);
  assert.ok(siteInsertCall);
  assert.equal(siteInsertCall.params[4], 30);
  assert.equal(siteInsertCall.params[5], '默认');
});

test('import skips overlong bookmark rows instead of writing them', async () => {
  const runCalls = [];
  let nextCategoryId = 20;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [{
        name: 'Too long',
        url: 'https://toolong.example',
        desc: 'x'.repeat(INPUT_LIMITS.bookmarkDesc + 1),
        catelog_id: 1,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /跳过 1 个/);
  assert.equal(runCalls.some(call => call.sql.includes('INSERT INTO category')), true);
  assert.equal(runCalls.some(call => call.sql.includes('INSERT INTO sites')), false);
});

test('import deduplicates the same URL with and without trailing slash', async () => {
  const runCalls = [];
  let nextCategoryId = 40;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [
        {
          name: 'Example',
          url: 'https://example.com',
          catelog_id: 1,
        },
        {
          name: 'Example Slash',
          url: 'https://example.com/',
          catelog_id: 1,
        },
      ],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const siteInsertCalls = runCalls.filter(call => call.sql.includes('INSERT INTO sites'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /新增 1 个/);
  assert.match(body.message, /跳过 1 个/);
  assert.equal(siteInsertCalls.length, 1);
  assert.equal(siteInsertCalls[0].params[1], 'https://example.com');
});

test('import deduplicates non-root URLs with and without trailing slash', async () => {
  const runCalls = [];
  let nextCategoryId = 50;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [
        {
          name: 'Dig Tool Slash',
          url: 'https://toolbox.googleapps.com/apps/dig/',
          catelog_id: 1,
        },
        {
          name: 'Dig Tool',
          url: 'https://toolbox.googleapps.com/apps/dig',
          catelog_id: 1,
        },
      ],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const siteInsertCalls = runCalls.filter(call => call.sql.includes('INSERT INTO sites'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /新增 1 个/);
  assert.match(body.message, /跳过 1 个/);
  assert.equal(siteInsertCalls.length, 1);
  assert.equal(siteInsertCalls[0].params[1], 'https://toolbox.googleapps.com/apps/dig/');
});

// 导入是多次 batch()/run() 的多事务写入，中途失败会留下部分变更。
// 若首页脏标记只在成功路径打，KV 缓存会滞留到 HOME_CACHE_TTL 耗尽。
// 同时 KV 对同一个 key 限制每秒一次写入，所以每个请求只能打一次标记。
function createDirtyTrackingEnv({ failSiteBatchAfter = Infinity } = {}) {
  const events = [];
  const store = new Map([['session_token', '1']]);
  let nextCategoryId = 70;
  let siteBatchCount = 0;

  const env = {
    NAV_AUTH: {
      store,
      async get(key) {
        return store.get(key) ?? null;
      },
      async put(key, value) {
        store.set(key, value);
        if (key.startsWith('home_dirty_')) events.push(`dirty:${key}`);
      },
      async delete(key) {
        store.delete(key);
      },
    },
    NAV_DB: {
      prepare(sql) {
        const createStatement = (params = []) => ({
          sql,
          async all() {
            if (sql.includes('FROM category')) return { results: [] };
            if (sql.includes('SELECT url FROM sites WHERE url IN')) return { results: [] };
            throw new Error(`Unexpected all() SQL: ${sql}`);
          },
          async run() {
            events.push(`db:${sql.trim().slice(0, 24)}`);
            if (sql.includes('INSERT INTO category')) {
              return { success: true, meta: { last_row_id: nextCategoryId++ } };
            }
            return { success: true, meta: {} };
          },
        });
        return {
          bind(...params) {
            return createStatement(params);
          },
          all: createStatement().all,
          run: createStatement().run,
        };
      },
      async batch(statements) {
        // 只对书签批次计数：导入过程中还有分类 INSERT、私有属性传播等其他 batch。
        // 匹配语句开头而不是子串，否则私有传播里的
        // 「WITH RECURSIVE ... UPDATE sites SET is_private = 1」会被误判成书签批次。
        const isSiteBatch = statements.some(statement => (
          /^(INSERT INTO sites|UPDATE sites SET name=)/.test(statement.sql.trim())
        ));

        if (isSiteBatch) {
          siteBatchCount++;
          if (siteBatchCount > failSiteBatchAfter) {
            throw new Error('D1 batch failed');
          }
        }

        for (const statement of statements) await statement.run();
      },
    },
  };

  return { env, events };
}

function buildImportRequest(siteCount) {
  return new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: Array.from({ length: siteCount }, (_, i) => ({
        name: `Site ${i + 1}`,
        url: `https://example.com/site-${i + 1}`,
        catelog_id: 1,
      })),
    }),
  });
}

test('import marks the home cache dirty after writing, exactly once per key', async () => {
  const { env, events } = createDirtyTrackingEnv();

  const response = await onRequestPost({ request: buildImportRequest(2), env });
  assert.equal(response.status, 201, (await response.json()).message);

  // KV 同一 key 每秒只允许一次写入，重复打标的第二笔可能被静默丢弃
  assert.equal(
    events.filter(event => event === `dirty:${getHomeDirtyKey('public')}`).length,
    1,
    '同一个 dirty key 每个请求只能写一次'
  );

  // 打标必须晚于最后一次写库，否则写入期间的首页渲染会缓存中间态并 CAS 清掉标记
  const lastDbIndex = events.map(event => event.startsWith('db:')).lastIndexOf(true);
  const lastDirtyIndex = events.map(event => event.startsWith('dirty:')).lastIndexOf(true);
  assert.ok(lastDbIndex >= 0, '导入应写库');
  assert.ok(lastDirtyIndex > lastDbIndex, '打标应在最后一次数据库写入之后');
});

test('import marks the home cache dirty when a site batch fails midway', async () => {
  // 第 1 批成功、第 2 批抛错：数据库已部分变更，脏标记必须留下
  const { env, events } = createDirtyTrackingEnv({ failSiteBatchAfter: 1 });

  const response = await onRequestPost({ request: buildImportRequest(60), env });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(body.message, /D1 batch failed/);
  assert.equal(env.NAV_AUTH.store.has(getHomeDirtyKey('public')), true);
  assert.equal(env.NAV_AUTH.store.has(getHomeDirtyKey('private')), true);
  assert.equal(
    events.filter(event => event === `dirty:${getHomeDirtyKey('public')}`).length,
    1,
    '失败路径同样只应打一次标记'
  );
});

test('import skips marking the home cache dirty when nothing was written', async () => {
  // 全部书签都是重复项、又不覆盖时不会写库，此时打标只会让访客白等一次重新渲染
  const { env, events } = createDirtyTrackingEnv();
  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: [], sites: [{ name: 'No category', url: 'https://example.com' }] }),
  });

  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 201, (await response.json()).message);

  assert.equal(events.some(event => event.startsWith('db:')), false, '不应写库');
  assert.equal(events.some(event => event.startsWith('dirty:')), false, '没写库就不该打标');
});
