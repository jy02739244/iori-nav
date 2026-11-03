import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionCookie,
  checkRateLimit,
  clearHomeCache,
  clearHomeCacheDirty,
  clearHomeCacheDirtyIfValue,
  getHomeCacheDirtyValue,
  getHomeDirtyKey,
  getSessionToken,
  isAdminAuthenticated,
  markHomeCacheDirty,
  onRequest,
  timingSafeEqual,
  validateCsrfToken,
  validateOrigin,
} from '../functions/_middleware.js';
import { HOME_CACHE_VERSION, HOME_CACHE_TTL } from '../functions/constants.js';

if (!globalThis.crypto.subtle.timingSafeEqual) {
  globalThis.crypto.subtle.timingSafeEqual = (left, right) => {
    if (left.byteLength !== right.byteLength) return false;
    let diff = 0;
    for (let i = 0; i < left.byteLength; i += 1) {
      diff |= left[i] ^ right[i];
    }
    return diff === 0;
  };
}

function createKv(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  const deleteCalls = [];
  const putCalls = [];
  return {
    store,
    deleteCalls,
    putCalls,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value, options) {
      putCalls.push({ key, value, options });
      store.set(key, value);
    },
    async delete(key) {
      deleteCalls.push(key);
      store.delete(key);
    },
  };
}

async function withoutConsoleError(fn) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = originalError;
  }
}

test('session cookie helpers create and read admin_session cookies', () => {
  const cookie = buildSessionCookie('abc', { maxAge: 60 });
  const request = new Request('https://example.com/admin', {
    headers: { Cookie: 'foo=bar; admin_session=abc; theme=dark' },
  });

  assert.match(cookie, /admin_session=abc/);
  assert.match(cookie, /Max-Age=60/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(getSessionToken(request), 'abc');
});

test('isAdminAuthenticated checks the session token in KV', async () => {
  const env = { NAV_AUTH: createKv({ session_token: '1' }) };
  const okRequest = new Request('https://example.com/admin', {
    headers: { Cookie: 'admin_session=token' },
  });
  const badRequest = new Request('https://example.com/admin', {
    headers: { Cookie: 'admin_session=missing' },
  });

  assert.equal(await isAdminAuthenticated(okRequest, env), true);
  assert.equal(await isAdminAuthenticated(badRequest, env), false);
});

test('validateCsrfToken requires matching X-CSRF-Token when stored token exists', async () => {
  const env = { NAV_AUTH: createKv({ csrf_session: 'csrf-value' }) };
  const validRequest = new Request('https://example.com/api/config', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=session',
      'X-CSRF-Token': 'csrf-value',
    },
  });
  const invalidRequest = new Request('https://example.com/api/config', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=session',
      'X-CSRF-Token': 'wrong-value',
    },
  });

  assert.deepEqual(await validateCsrfToken(validRequest, env), { valid: true });
  assert.deepEqual(await validateCsrfToken(invalidRequest, env), { valid: false });
});

test('validateCsrfToken rejects sessions without a stored CSRF token', async () => {
  const env = { NAV_AUTH: createKv({ session_session: '1' }) };
  const request = new Request('https://example.com/api/config', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=session',
      'X-CSRF-Token': 'csrf-value',
    },
  });

  assert.deepEqual(await validateCsrfToken(request, env), { valid: false });
});

test('validateOrigin only accepts same-host Origin or Referer headers', () => {
  assert.equal(validateOrigin(new Request('https://example.com/api/config/submit', {
    headers: { Origin: 'https://example.com' },
  })), true);
  assert.equal(validateOrigin(new Request('https://example.com/api/config/submit', {
    headers: { Referer: 'https://example.com/path' },
  })), true);
  assert.equal(validateOrigin(new Request('https://example.com/api/config/submit', {
    headers: { Origin: 'https://evil.example' },
  })), false);
  // host 相同但协议不同也必须拒绝，避免 http 页面通过 https 站点的同源校验
  assert.equal(validateOrigin(new Request('https://example.com/api/config/submit', {
    headers: { Origin: 'http://example.com' },
  })), false);
  assert.equal(validateOrigin(new Request('https://example.com/api/config/submit', {
    headers: { Referer: 'http://example.com/path' },
  })), false);
  assert.equal(validateOrigin(new Request('https://example.com/api/config/submit')), false);
});

test('checkRateLimit increments counts and blocks after the limit', async () => {
  const env = { NAV_AUTH: createKv() };

  assert.deepEqual(await checkRateLimit(env, 'rate_key', 2, 60), { allowed: true, remaining: 1 });
  assert.deepEqual(await checkRateLimit(env, 'rate_key', 2, 60), { allowed: true, remaining: 0 });
  assert.deepEqual(await checkRateLimit(env, 'rate_key', 2, 60), { allowed: false, remaining: 0 });
});

test('clearHomeCache deletes only versioned home cache keys', async () => {
  const kv = createKv({
    home_html_public: 'legacy-public',
    home_html_private: 'legacy-private',
    [`home_html_public_${HOME_CACHE_VERSION}`]: 'public',
    [`home_html_private_${HOME_CACHE_VERSION}`]: 'private',
  });
  const env = { NAV_AUTH: kv };

  await clearHomeCache(env, 'all');

  assert.deepEqual(kv.deleteCalls.sort(), [
    `home_html_private_${HOME_CACHE_VERSION}`,
    `home_html_public_${HOME_CACHE_VERSION}`,
  ]);
  assert.equal(kv.store.get('home_html_public'), 'legacy-public');
  assert.equal(kv.store.get('home_html_private'), 'legacy-private');
});

test('clearHomeCache rethrows KV deletion failures', async () => {
  const env = {
    NAV_AUTH: {
      async delete() {
        throw new Error('KV delete failed');
      },
    },
  };

  await withoutConsoleError(async () => {
    await assert.rejects(() => clearHomeCache(env, 'all'), /KV delete failed/);
  });
});

test('getHomeCacheDirtyValue rethrows KV read failures', async () => {
  const env = {
    NAV_AUTH: {
      async get() {
        throw new Error('KV read failed');
      },
    },
  };

  await withoutConsoleError(async () => {
    await assert.rejects(() => getHomeCacheDirtyValue(env, 'public'), /KV read failed/);
  });
});

test('clearHomeCacheDirty without expected value removes markers unconditionally', async () => {
  const key = getHomeDirtyKey('public');
  const kv = createKv({ [key]: 'dirty' });

  await clearHomeCacheDirty({ NAV_AUTH: kv }, 'public');

  assert.equal(kv.store.get(key), undefined);
});

test('clearHomeCacheDirtyIfValue preserves a dirty marker created during rendering', async () => {
  const key = getHomeDirtyKey('public');
  const kv = createKv({ [key]: 'new-dirty' });

  // 渲染开始时没有 dirty 标记，渲染期间新写入设置了标记；旧请求不能删除它。
  await clearHomeCacheDirtyIfValue({ NAV_AUTH: kv }, 'public', null);
  assert.equal(kv.store.get(key), 'new-dirty');

  // expectedValue 匹配时才删除。
  await clearHomeCacheDirtyIfValue({ NAV_AUTH: kv }, 'public', 'new-dirty');
  assert.equal(kv.store.get(key), undefined);
});

test('clearHomeCacheDirtyIfValue keeps a marker that was rotated to another value', async () => {
  const key = getHomeDirtyKey('public');
  const kv = createKv({ [key]: 'second-write' });

  await clearHomeCacheDirtyIfValue({ NAV_AUTH: kv }, 'public', 'first-write');

  assert.equal(kv.store.get(key), 'second-write');
});

test('markHomeCacheDirty falls back to clearing HTML when dirty write fails', async () => {
  const deleteCalls = [];
  const env = {
    NAV_AUTH: {
      async put() {
        throw new Error('KV put failed');
      },
      async delete(key) {
        deleteCalls.push(key);
      },
    },
  };

  await withoutConsoleError(() => markHomeCacheDirty(env, 'all'));

  assert.deepEqual(deleteCalls.sort(), [
    `home_html_private_${HOME_CACHE_VERSION}`,
    `home_html_public_${HOME_CACHE_VERSION}`,
  ]);
});

test('home cache TTL stays short enough to bound the stale window', () => {
  // 回归保护：HTML 缓存曾设成 30 天。一旦 dirty 标记写入失败、兜底删除又被
  // 并发中的旧渲染覆盖，旧页面就会停留很久，因此把上限钉在 6 小时。
  assert.ok(HOME_CACHE_TTL > 0, 'TTL 必须为正数');
  assert.ok(
    HOME_CACHE_TTL <= 6 * 60 * 60,
    `HOME_CACHE_TTL 不应超过 6 小时，当前为 ${HOME_CACHE_TTL} 秒`
  );
});

test('markHomeCacheDirty uses the same TTL as the HTML cache', async () => {
  // 不变式：dirty 标记不能比 HTML 缓存活得短，否则会出现「旧 HTML 还在、
  // dirty 已过期」的脏读窗口。
  const puts = [];
  const env = {
    NAV_AUTH: {
      async put(key, value, options) {
        puts.push({ key, options });
      },
    },
  };

  await markHomeCacheDirty(env, 'all');

  const ttlPuts = puts.filter(entry => entry.options?.expirationTtl !== undefined);
  assert.equal(ttlPuts.length, 2, 'public / private 两份 dirty 标记都该写入');
  for (const entry of ttlPuts) {
    assert.equal(entry.options.expirationTtl, HOME_CACHE_TTL);
  }
});

test('onRequest adds security headers to Pages Functions responses', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/'),
    env: {},
    next: async () => new Response('<h1>ok</h1>', {
      headers: { 'Content-Type': 'text/html' },
    }),
  });

  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  // 只允许同源 frame-ancestors，且不得带入 default-src 等会限制内联脚本的指令
  assert.equal(response.headers.get('Content-Security-Policy'), "frame-ancestors 'self'");
  assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
});

test('onRequest returns downstream responses untouched when every header is already set', async () => {
  const inner = new Response('ok', {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000',
    },
  });

  const response = await onRequest({
    request: new Request('https://example.com/js/home-cards.js'),
    env: {},
    next: async () => inner,
  });

  // 必须是同一个对象：重包会把 body 变成未知长度的流，丢掉 Content-Length
  assert.equal(response, inner);
});

test('onRequest keeps downstream security headers instead of overwriting them', async () => {
  // 静态资源由 _headers 下发同名头，Functions 响应也可能自带；重包时不能
  // 把同名头改写成 middleware 的默认值，否则会悄悄改掉上游的显式选择。
  const response = await onRequest({
    request: new Request('https://example.com/'),
    env: {},
    next: async () => new Response('ok', {
      headers: { 'X-Frame-Options': 'DENY' },
    }),
  });

  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  // 缺省的其余头仍要补齐
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

test('onRequest keeps Set-Cookie and location when securing redirects', async () => {
  const response = await onRequest({
    request: new Request('https://example.com/admin/login'),
    env: {},
    next: async () => new Response(null, {
      status: 302,
      headers: {
        Location: '/admin',
        'Set-Cookie': 'admin_session=abc; Path=/; HttpOnly',
      },
    }),
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/admin');
  assert.match(response.headers.get('Set-Cookie'), /admin_session=abc/);
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
});

test('onRequest preserves multiple Set-Cookie headers', async () => {
  // 首页清 stale cookie 时会同时下发 3 个 Set-Cookie（index.js），后台清缓存
  // 也一样。重包 Response 时若把多个 Set-Cookie 合并成一个，浏览器只会认第一个，
  // 缓存清除就会静默失效——这条用例守住这个边界。
  const response = await onRequest({
    request: new Request('https://example.com/'),
    env: {},
    next: async () => {
      const inner = new Response('ok');
      inner.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0');
      inner.headers.append('Set-Cookie', 'iori_cache_public_stale=; Path=/; Max-Age=0');
      inner.headers.append('Set-Cookie', 'iori_cache_private_stale=; Path=/; Max-Age=0');
      return inner;
    },
  });

  assert.deepEqual(response.headers.getSetCookie(), [
    'iori_cache_stale=; Path=/; Max-Age=0',
    'iori_cache_public_stale=; Path=/; Max-Age=0',
    'iori_cache_private_stale=; Path=/; Max-Age=0',
  ]);
});

test('onRequest does not send HSTS over HTTP', async () => {
  const response = await onRequest({
    request: new Request('http://localhost/'),
    env: {},
    next: async () => new Response('ok'),
  });

  assert.equal(response.headers.get('Strict-Transport-Security'), null);
});

test('onRequest secures CSRF rejection responses', async () => {
  let nextCalled = false;
  const response = await onRequest({
    request: new Request('https://example.com/api/settings', { method: 'POST' }),
    env: {},
    next: async () => {
      nextCalled = true;
      return new Response('should not run');
    },
  });

  assert.equal(response.status, 403);
  assert.equal(nextCalled, false);
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('timingSafeEqual bounds input length before allocating comparisons', () => {
  const overLimit = 'a'.repeat(4097);
  assert.equal(timingSafeEqual(overLimit, overLimit), false);
  assert.equal(timingSafeEqual('a'.repeat(4096), 'a'.repeat(4096)), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
});

test('onRequest secures downstream failures with headers and JSON for APIs', async () => {
  const apiResponse = await withoutConsoleError(() => onRequest({
    request: new Request('https://example.com/api/settings'),
    env: {},
    next: async () => {
      throw new Error('boom');
    },
  }));

  assert.equal(apiResponse.status, 500);
  assert.equal(apiResponse.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(apiResponse.headers.get('X-Content-Type-Options'), 'nosniff');
  // 纯文本 500 挡掉了运行时错误页，靠 errorId 把用户报错和 Workers 日志对上
  assert.match(apiResponse.headers.get('X-Error-Id'), /^[0-9a-f-]{36}$/);
  assert.deepEqual(await apiResponse.json(), { code: 500, message: 'Internal Server Error' });

  const pageResponse = await withoutConsoleError(() => onRequest({
    request: new Request('https://example.com/'),
    env: {},
    next: async () => {
      throw new Error('boom');
    },
  }));

  assert.equal(pageResponse.status, 500);
  assert.equal(pageResponse.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.match(pageResponse.headers.get('X-Error-Id'), /^[0-9a-f-]{36}$/);
  assert.equal(pageResponse.headers.get('X-Frame-Options'), 'SAMEORIGIN');
});
