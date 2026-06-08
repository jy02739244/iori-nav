import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet, onRequestPost } from '../functions/admin/login.js';

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
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function createLoginRequest(body) {
  return new Request('https://example.com/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'CF-Connecting-IP': '203.0.113.10',
    },
    body: new URLSearchParams(body),
  });
}

test('GET /admin/login renders Turnstile widget when site key is configured', async () => {
  const response = await onRequestGet({
    request: new Request('https://example.com/admin/login'),
    env: {
      TURNSTILE_SITE_KEY: 'site-key',
      TURNSTILE_SECRET_KEY: 'secret-key',
    },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(html, /class="cf-turnstile"/);
  assert.match(html, /data-sitekey="site-key"/);
});

test('POST /admin/login keeps working when Turnstile is not configured', async () => {
  const kv = createKv({
    admin_username: 'admin',
    admin_password: 'password',
  });
  const response = await onRequestPost({
    request: createLoginRequest({
      username: 'admin',
      password: 'password',
      duration: '1',
    }),
    env: { NAV_AUTH: kv },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/admin');
  assert.match(response.headers.get('Set-Cookie'), /admin_session=/);
});

test('POST /admin/login requires Turnstile token when configured', async () => {
  const kv = createKv({
    admin_username: 'admin',
    admin_password: 'password',
  });
  const response = await onRequestPost({
    request: createLoginRequest({
      username: 'admin',
      password: 'password',
      duration: '1',
    }),
    env: {
      NAV_AUTH: kv,
      TURNSTILE_SITE_KEY: 'site-key',
      TURNSTILE_SECRET_KEY: 'secret-key',
    },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /请先完成人机验证/);
  assert.equal([...kv.store.keys()].some(key => key.startsWith('session_')), false);
});

test('POST /admin/login verifies Turnstile token before creating session', async () => {
  const originalFetch = globalThis.fetch;
  const kv = createKv({
    admin_username: 'admin',
    admin_password: 'password',
  });

  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(init.method, 'POST');
    assert.equal(init.body.get('secret'), 'secret-key');
    assert.equal(init.body.get('response'), 'turnstile-token');
    assert.equal(init.body.get('remoteip'), '203.0.113.10');
    return Response.json({ success: true });
  };

  try {
    const response = await onRequestPost({
      request: createLoginRequest({
        username: 'admin',
        password: 'password',
        duration: '1',
        'cf-turnstile-response': 'turnstile-token',
      }),
      env: {
        NAV_AUTH: kv,
        TURNSTILE_SITE_KEY: 'site-key',
        TURNSTILE_SECRET_KEY: 'secret-key',
      },
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/admin');
    assert.equal([...kv.store.keys()].some(key => key.startsWith('session_')), true);
    assert.equal([...kv.store.keys()].some(key => key.startsWith('csrf_')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
