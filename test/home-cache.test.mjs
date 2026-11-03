import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { onRequest } from '../functions/index.js';
import { onRequestPost as clearCache } from '../functions/api/cache/clear.js';
import {
  clearGraphCache,
  clearHomeCache,
  getGraphCacheGeneration,
  getHomeCacheKey,
  getHomeDirtyKey,
  markHomeCacheDirty,
  writeHomeCacheIfUnchanged,
} from '../functions/_middleware.js';
import { HOME_CACHE_TTL } from '../functions/constants.js';

let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  // 与其它真实 SQLite 用例一致，旧 Node 版本跳过。
}
const options = { skip: DatabaseSync ? false : 'node:sqlite 不可用' };
const template = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

function createEnv(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  sqlite.exec("INSERT INTO category (id, catelog) VALUES (1, '测试分类')");
  sqlite.exec("INSERT INTO sites (name, url, catelog_id) VALUES ('旧书签', 'https://old.example', 1)");

  const reads = [];
  const store = new Map();
  const putCalls = [];
  const getCalls = [];
  const env = {
    NAV_DB: {
      sqlite,
      reads,
      prepare(sql) {
        const statement = (params = []) => ({
          bind: (...values) => statement(values),
          async first() {
            reads.push(sql);
            return sqlite.prepare(sql).get(...params) ?? null;
          },
          async all() {
            reads.push(sql);
            return { results: sqlite.prepare(sql).all(...params) };
          },
          async run() {
            const result = sqlite.prepare(sql).run(...params);
            return { success: true, meta: { changes: Number(result.changes) } };
          },
        });
        return statement();
      },
    },
    NAV_AUTH: {
      store,
      putCalls,
      getCalls,
      async get(key, options) {
        getCalls.push(key);
        if (key.startsWith('schema_migrated_')) return 'true';
        // 模拟 KV 缓存了「不存在」：即使 put 成功，dirty 读取仍然返回 null。
        if (key.startsWith('home_dirty_')) return null;
        const value = store.get(key) ?? null;
        return value !== null && options?.type === 'json' ? JSON.parse(value) : value;
      },
      async put(key, value, options) {
        putCalls.push({ key, value, options });
        store.set(key, value);
      },
      async delete(key) {
        store.delete(key);
      },
    },
    ASSETS: { async fetch() { return new Response(template); } },
  };
  return env;
}

async function requestHome(env) {
  const pendingWrites = [];
  const response = await onRequest({
    env,
    request: new Request('https://example.com/'),
    waitUntil: promise => pendingWrites.push(promise),
  });
  await Promise.all(pendingWrites);
  return response;
}

test('cold home cache backfills and hits while KV keeps returning a negative dirty lookup', options, async t => {
  const env = createEnv(t);
  const first = await requestHome(env);
  assert.equal(first.status, 200);
  assert.match(await first.text(), /旧书签/);
  assert.ok(env.NAV_AUTH.store.has(getHomeCacheKey('public', '0')));
  assert.equal(env.NAV_AUTH.putCalls.some(call => call.key.startsWith('home_dirty_')), false);

  const second = await requestHome(env);
  assert.equal(second.headers.get('X-Cache'), 'HIT');
  assert.match(await second.text(), /旧书签/);
  assert.equal(env.NAV_DB.reads.filter(sql => sql.includes('FROM sites WHERE')).length, 1);
  assert.equal(env.NAV_AUTH.getCalls.includes('graph_cache_generation'), false, '版本必须从 D1 读取');
});

test('D1 generation invalidates home HTML even when the new KV dirty marker is invisible', options, async t => {
  const env = createEnv(t);
  await requestHome(env);
  env.NAV_DB.sqlite.exec("UPDATE sites SET name = '新书签'");
  await markHomeCacheDirty(env, 'public');

  const response = await requestHome(env);
  const html = await response.text();
  assert.notEqual(response.headers.get('X-Cache'), 'HIT');
  assert.match(html, /新书签/);
  assert.doesNotMatch(html, /旧书签/);
  assert.equal((await requestHome(env)).headers.get('X-Cache'), 'HIT');
});

test('a late old render cannot overwrite the new generation after passing its version check', options, async t => {
  const env = createEnv(t);
  const oldGeneration = await getGraphCacheGeneration(env);
  const oldKey = getHomeCacheKey('public', oldGeneration);
  const originalPut = env.NAV_AUTH.put;
  let releaseOldWrite;
  let notifyOldWrite;
  const blocked = new Promise(resolve => { releaseOldWrite = resolve; });
  const started = new Promise(resolve => { notifyOldWrite = resolve; });
  env.NAV_AUTH.put = async (key, value, options) => {
    if (key === oldKey) {
      notifyOldWrite();
      await blocked;
    }
    await originalPut(key, value, options);
  };

  const lateWrite = writeHomeCacheIfUnchanged(env, 'public', '旧 HTML', oldGeneration);
  await started;
  try {
    await clearGraphCache(env);
    const generation = await getGraphCacheGeneration(env);
    assert.equal(await writeHomeCacheIfUnchanged(env, 'public', '新 HTML', generation), true);
    releaseOldWrite();
    assert.equal(await lateWrite, true, '旧请求允许写旧版本，但不能覆盖新版本');
    assert.equal(env.NAV_AUTH.store.get(getHomeCacheKey('public', generation)), '新 HTML');
    assert.equal(await (await requestHome(env)).text(), '新 HTML');
  } finally {
    releaseOldWrite();
    await lateWrite;
  }
});

test('backfill skips a generation changed during rendering and keeps the home TTL', options, async t => {
  const env = createEnv(t);
  const oldGeneration = await getGraphCacheGeneration(env);
  await clearGraphCache(env);
  assert.equal(await writeHomeCacheIfUnchanged(env, 'public', '旧 HTML', oldGeneration), false);
  const generation = await getGraphCacheGeneration(env);
  assert.equal(await writeHomeCacheIfUnchanged(env, 'public', '新 HTML', generation), true);
  assert.equal(env.NAV_AUTH.putCalls.at(-1).options.expirationTtl, HOME_CACHE_TTL);
  assert.notEqual(getHomeCacheKey('public', generation), getHomeCacheKey('private', generation));
});

test('home rendering bypasses cache when D1 cannot read the generation', options, async t => {
  const env = createEnv(t);
  await requestHome(env);
  env.NAV_DB.sqlite.exec("UPDATE sites SET name = '新书签'");
  const originalPrepare = env.NAV_DB.prepare;
  env.NAV_DB.prepare = sql => {
    if (sql.includes('SELECT value FROM settings WHERE key = ?')) {
      return { bind() { return this; }, async first() { throw new Error('D1 unavailable'); } };
    }
    return originalPrepare(sql);
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const response = await requestHome(env);
    assert.notEqual(response.headers.get('X-Cache'), 'HIT');
    assert.match(await response.text(), /新书签/);
    assert.equal(await writeHomeCacheIfUnchanged(env, 'public', '不应回填', '0'), false);
    assert.equal(await writeHomeCacheIfUnchanged(env, 'public', '不应回填', null), false);
    assert.equal(env.NAV_AUTH.store.get(getHomeCacheKey('public', '0')).includes('旧书签'), true);
  } finally {
    console.warn = originalWarn;
  }
});

test('clearHomeCache deletes the current generation HTML as well as legacy keys', options, async t => {
  const env = createEnv(t);
  await requestHome(env);
  const generation = await getGraphCacheGeneration(env);
  env.NAV_AUTH.store.set(getHomeCacheKey('public'), '旧缓存键');
  await clearHomeCache(env, 'public');
  assert.equal(env.NAV_AUTH.store.has(getHomeCacheKey('public', generation)), false);
  assert.equal(env.NAV_AUTH.store.has(getHomeCacheKey('public')), false);
});

async function withoutCacheLogs(fn) {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
}

for (const failure of ['read', 'rotation']) {
  test(`failed cache generation ${failure} preserves re-rendering after D1 recovery`, options, async t => {
    const env = createEnv(t);
    // 这个用例验证 dirty 的恢复作用，使用可见的标记，而非前面用例的负缓存。
    const originalGet = env.NAV_AUTH.get;
    env.NAV_AUTH.get = async (key, options) => key.startsWith('home_dirty_')
      ? env.NAV_AUTH.store.get(key) ?? null
      : originalGet(key, options);
    await requestHome(env);
    const generation = await getGraphCacheGeneration(env);
    const key = getHomeCacheKey('public', generation);
    const oldHtml = env.NAV_AUTH.store.get(key);
    env.NAV_AUTH.store.set('session_token', '1');
    for (const scope of ['public', 'private']) {
      env.NAV_AUTH.store.set(getHomeDirtyKey(scope), 'dirty');
    }
    env.NAV_DB.sqlite.exec("UPDATE sites SET name = '恢复后的新书签'");

    const originalPrepare = env.NAV_DB.prepare;
    env.NAV_DB.prepare = sql => {
      if (failure === 'read' && sql.includes('SELECT value FROM settings WHERE key = ?')) {
        return { bind() { return this; }, async first() { throw new Error('D1 read unavailable'); } };
      }
      if (failure === 'rotation' && sql.includes('INSERT OR REPLACE INTO settings')) {
        return { bind() { return this; }, async run() { throw new Error('D1 write unavailable'); } };
      }
      return originalPrepare(sql);
    };
    let response;
    try {
      response = await withoutCacheLogs(() => clearCache({
        env,
        request: new Request('https://example.com/api/cache/clear', {
          method: 'POST', headers: { Cookie: 'admin_session=token' },
        }),
      }));
    } finally {
      env.NAV_DB.prepare = originalPrepare;
    }
    assert.equal(response.status, 500);
    for (const scope of ['public', 'private']) {
      assert.equal(env.NAV_AUTH.store.get(getHomeDirtyKey(scope)), 'dirty');
    }
    if (failure === 'read') {
      assert.equal(env.NAV_AUTH.store.get(key), oldHtml, '读取失败不能误认为 HTML 已删除');
    } else {
      // 版本轮换失败时，之前已开始的渲染仍可晚到并回填同一版本；dirty 必须能挡住它。
      assert.equal(await writeHomeCacheIfUnchanged(env, 'public', oldHtml, generation), true);
    }
    const recovered = await requestHome(env);
    assert.notEqual(recovered.headers.get('X-Cache'), 'HIT');
    const html = await recovered.text();
    assert.match(html, /恢复后的新书签/);
    assert.doesNotMatch(html, /旧书签/);
    assert.equal((await requestHome(env)).headers.get('X-Cache'), 'HIT');

    assert.equal((await clearCache({
      env,
      request: new Request('https://example.com/api/cache/clear', {
        method: 'POST', headers: { Cookie: 'admin_session=token' },
      }),
    })).status, 200, 'D1 恢复后允许重试清缓存');
  });
}

test('ordinary data invalidation still writes dirty markers when D1 rotation fails', options, async t => {
  const env = createEnv(t);
  const originalPrepare = env.NAV_DB.prepare;
  env.NAV_DB.prepare = sql => sql.includes('INSERT OR REPLACE INTO settings')
    ? { bind() { return this; }, async run() { throw new Error('D1 write unavailable'); } }
    : originalPrepare(sql);
  await withoutCacheLogs(() => markHomeCacheDirty(env, 'all'));
  assert.ok(env.NAV_AUTH.store.get(getHomeDirtyKey('public')));
  assert.ok(env.NAV_AUTH.store.get(getHomeDirtyKey('private')));
});
