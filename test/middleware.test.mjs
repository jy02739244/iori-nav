import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionCookie,
  checkRateLimit,
  clearHomeCache,
  getSessionToken,
  isAdminAuthenticated,
  validateCsrfToken,
  validateOrigin,
} from '../functions/_middleware.js';
import { HOME_CACHE_VERSION } from '../functions/constants.js';

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
  return {
    store,
    deleteCalls,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      deleteCalls.push(key);
      store.delete(key);
    },
  };
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
