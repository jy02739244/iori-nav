import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/cache/clear.js';
import { getHomeCacheKey, getHomeDirtyKey } from '../functions/_middleware.js';

function createEnv(order, {
  failHtmlDelete = false,
  failGenerationRead = false,
  failGenerationWrite = false,
  failSettingsDelete = false,
} = {}) {
  const store = new Map([
    ['session_token', '1'],
    ['settings_cache', '[cached]'],
    ...['public', 'private'].flatMap(scope => [
      [getHomeCacheKey(scope, 'generation-1'), 'cached HTML'],
      [getHomeDirtyKey(scope), 'dirty'],
    ]),
  ]);
  const kv = {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async delete(key) {
      // HTML 删除模拟慢操作，dirty 删除立即完成；并行时 dirty 会先落地。
      const delay = key.startsWith('home_html_') ? 10 : 0;
      await new Promise(resolve => setTimeout(resolve, delay));
      if (failHtmlDelete && key.startsWith('home_html_')) {
        throw new Error('KV delete failed');
      }
      if (failSettingsDelete && key === 'settings_cache') {
        throw new Error('Settings cache delete failed');
      }
      order.push(key);
      store.delete(key);
    },
  };

  const db = {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              if (failGenerationRead) throw new Error('D1 generation read failed');
              return { value: 'generation-1' };
            },
            async run() {
              if (failGenerationWrite) throw new Error('D1 generation write failed');
              order.push('graph-generation');
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
  };

  return { NAV_AUTH: kv, NAV_DB: db };
}

test('POST /api/cache/clear deletes HTML cache before dirty markers', async () => {
  const order = [];
  const response = await onRequestPost({
    request: new Request('https://example.com/api/cache/clear', {
      method: 'POST',
      headers: { Cookie: 'admin_session=token' },
    }),
    env: createEnv(order),
  });

  assert.equal(response.status, 200);

  const htmlKeys = [getHomeCacheKey('public'), getHomeCacheKey('private')];
  const dirtyKeys = [getHomeDirtyKey('public'), getHomeDirtyKey('private')];
  const lastHtmlIndex = Math.max(...htmlKeys.map(key => order.indexOf(key)));
  const firstDirtyIndex = Math.min(...dirtyKeys.map(key => order.indexOf(key)));

  assert.ok(lastHtmlIndex >= 0, 'HTML cache should be deleted');
  assert.ok(firstDirtyIndex >= 0, 'dirty markers should be deleted');
  assert.ok(
    lastHtmlIndex < firstDirtyIndex,
    `HTML cache must be deleted before dirty markers, got: ${order.join(', ')}`
  );
  for (const scope of ['public', 'private']) {
    assert.ok(order.includes(getHomeCacheKey(scope, 'generation-1')), '当前版本 HTML 也要删除');
  }
  assert.ok(order.indexOf('settings_cache') < order.indexOf('graph-generation'), '先删设置缓存，再发布新版本');
  assert.ok(order.indexOf('graph-generation') < firstDirtyIndex, '版本轮换成功后才能清 dirty');
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

for (const [name, failure] of [
  ['D1 generation read', { failGenerationRead: true }],
  ['D1 generation rotation', { failGenerationWrite: true }],
  ['settings cache deletion', { failSettingsDelete: true }],
]) {
  test(`POST /api/cache/clear returns 500 and preserves dirty markers when ${name} fails`, async () => {
    const order = [];
    const env = createEnv(order, failure);
    const response = await withoutCacheLogs(() => onRequestPost({
      request: new Request('https://example.com/api/cache/clear', {
        method: 'POST',
        headers: { Cookie: 'admin_session=token' },
      }),
      env,
    }));

    assert.equal(response.status, 500);
    assert.match((await response.json()).message, /Failed to clear cache/);
    for (const scope of ['public', 'private']) {
      assert.equal(env.NAV_AUTH.store.get(getHomeDirtyKey(scope)), 'dirty');
    }
    assert.equal(order.some(key => key.startsWith('home_dirty_')), false);
    if (failure.failGenerationRead) {
      assert.equal(order.length, 0, '读版本失败时应在删除任何 KV 条目前退出');
      assert.equal(env.NAV_AUTH.store.has(getHomeCacheKey('public', 'generation-1')), true);
    }
  });
}

test('POST /api/cache/clear also drops the cached settings', async () => {
  const order = [];
  const response = await onRequestPost({
    request: new Request('https://example.com/api/cache/clear', {
      method: 'POST',
      headers: { Cookie: 'admin_session=token' },
    }),
    env: createEnv(order),
  });

  assert.equal(response.status, 200);
  // 只清 HTML 的话，下一次渲染仍会用旧设置拼出「新的旧页面」
  assert.ok(order.includes('settings_cache'), `settings_cache should be deleted, got: ${order.join(', ')}`);
  assert.match((await response.json()).message, /设置/);
});

test('POST /api/cache/clear returns 500 and keeps dirty markers when HTML deletion fails', async () => {
  const order = [];
  const originalError = console.error;
  console.error = () => {};

  try {
    const response = await onRequestPost({
      request: new Request('https://example.com/api/cache/clear', {
        method: 'POST',
        headers: { Cookie: 'admin_session=token' },
      }),
      env: createEnv(order, { failHtmlDelete: true }),
    });

    assert.equal(response.status, 500);
    assert.match((await response.json()).message, /Failed to clear cache/);
    assert.equal(order.some(key => key.startsWith('home_dirty_')), false);
  } finally {
    console.error = originalError;
  }
});
