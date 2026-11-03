import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost as categoryReorder } from '../functions/api/categories/reorder.js';
import { onRequestPost as siteBatch } from '../functions/api/config/batch.js';
import { getHomeDirtyKey } from '../functions/_middleware.js';

// reorder 把语句按 100 条一块提交，属于多事务写入：中途失败时数据库已部分变更。
// 首页脏标记若只在成功路径打，KV 缓存会滞留到 HOME_CACHE_TTL 耗尽。
// 同时 KV 对同一个 key 限制每秒一次写入，所以每个请求只能打一次标记。
function createEnv({ failBatchAfter = null } = {}) {
  const events = [];
  const store = new Map([['session_token', '1']]);
  let batchCount = 0;

  return {
    events,
    env: {
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
          const statement = (params = []) => ({
            sql,
            params,
            async first() {
              return { catelog: 'Default', is_private: 0 };
            },
          });
          return {
            bind: (...params) => statement(params),
            first: statement().first,
          };
        },
        async batch(statements) {
          batchCount++;
          if (failBatchAfter !== null && batchCount > failBatchAfter) {
            throw new Error('D1 batch failed');
          }
          events.push(`db:batch(${statements.length})`);
          return statements.map(() => ({ success: true }));
        },
      },
    },
  };
}

function buildRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildItems(count) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, sort_order: i }));
}

test('category reorder marks the home cache dirty after writing, exactly once per key', async () => {
  const { env, events } = createEnv();
  const request = buildRequest('https://example.com/api/categories/reorder', { items: buildItems(3) });

  const response = await categoryReorder({ request, env });
  assert.equal(response.status, 200, (await response.json()).message);

  assert.equal(
    events.filter(event => event === `dirty:${getHomeDirtyKey('public')}`).length,
    1,
    '同一个 dirty key 每个请求只能写一次'
  );

  const lastDirtyIndex = events.map(event => event.startsWith('dirty:')).lastIndexOf(true);
  const lastDbIndex = events.map(event => event.startsWith('db:')).lastIndexOf(true);
  assert.ok(lastDbIndex >= 0, 'reorder 应写库');
  assert.ok(lastDirtyIndex > lastDbIndex, '打标应在最后一次数据库写入之后');
});

test('category reorder marks the home cache dirty when a chunk fails midway', async () => {
  const { env, events } = createEnv({ failBatchAfter: 1 });
  const request = buildRequest('https://example.com/api/categories/reorder', { items: buildItems(150) });

  const response = await categoryReorder({ request, env });
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

test('site reorder marks the home cache dirty after writing, exactly once per key', async () => {
  const { env, events } = createEnv();
  const request = buildRequest('https://example.com/api/config/batch', {
    action: 'reorder',
    payload: { items: buildItems(3) },
  });

  const response = await siteBatch({ request, env });
  assert.equal(response.status, 200, (await response.json()).message);

  assert.equal(
    events.filter(event => event === `dirty:${getHomeDirtyKey('public')}`).length,
    1,
    '同一个 dirty key 每个请求只能写一次'
  );

  const lastDirtyIndex = events.map(event => event.startsWith('dirty:')).lastIndexOf(true);
  const lastDbIndex = events.map(event => event.startsWith('db:')).lastIndexOf(true);
  assert.ok(lastDirtyIndex > lastDbIndex, '打标应在最后一次数据库写入之后');
});

test('site reorder marks the home cache dirty when a chunk fails midway', async () => {
  const { env, events } = createEnv({ failBatchAfter: 1 });
  const request = buildRequest('https://example.com/api/config/batch', {
    action: 'reorder',
    payload: { items: buildItems(150) },
  });

  const response = await siteBatch({ request, env });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(body.message, /D1 batch failed/);
  assert.equal(env.NAV_AUTH.store.has(getHomeDirtyKey('public')), true);
  assert.equal(
    events.filter(event => event === `dirty:${getHomeDirtyKey('public')}`).length,
    1,
    '失败路径同样只应打一次标记'
  );
});

test('reorder skips marking the home cache dirty on validation failure', async () => {
  // 校验失败时没写过库，不该让访客白等一次重新渲染
  const { env, events } = createEnv();
  const request = buildRequest('https://example.com/api/categories/reorder', {
    items: [{ id: 'not-a-number', sort_order: 0 }],
  });

  const response = await categoryReorder({ request, env });

  assert.equal(response.status, 400);
  assert.equal(events.some(event => event.startsWith('dirty:')), false, '没写库就不该打标');
});

test('single-transaction batch actions still mark the home cache dirty on success', async () => {
  // delete / update_category / update_privacy 是一次 batch()（D1 隐式单事务），
  // 失败即全无变更，因此不需要写前打标，但成功路径必须打标。
  for (const payloadCase of [
    { action: 'delete', ids: [1, 2] },
    { action: 'update_category', ids: [1, 2], payload: { categoryId: 5 } },
    { action: 'update_privacy', ids: [1, 2], payload: { isPrivate: true } },
  ]) {
    const { env, events } = createEnv();
    const request = buildRequest('https://example.com/api/config/batch', payloadCase);

    const response = await siteBatch({ request, env });
    assert.equal(response.status, 200, `${payloadCase.action} 应成功`);
    assert.equal(
      events.filter(event => event.startsWith('dirty:')).length,
      2,
      `${payloadCase.action} 只应打一次脏标记（public + private 两个 key）`
    );
    assert.equal(env.NAV_AUTH.store.has(getHomeDirtyKey('public')), true);
  }
});
