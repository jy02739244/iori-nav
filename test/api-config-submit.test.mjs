import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/config/submit.js';
import { INPUT_LIMITS } from '../functions/lib/validators.js';

function createKv(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

test('public submit does not expose duplicate site URL existence', async () => {
  const runCalls = [];
  const firstSqlCalls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              firstSqlCalls.push(sql);
              if (sql.includes('SELECT catelog, is_private FROM category')) {
                return { catelog: 'Public', is_private: 0 };
              }
              throw new Error(`Unexpected first() SQL: ${sql} ${JSON.stringify(params)}`);
            },
            async run() {
              runCalls.push({ sql, params });
              return { success: true };
            },
          };
        },
      };
    },
  };

  const request = new Request('https://example.com/api/config/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://example.com',
      'CF-Connecting-IP': '203.0.113.1',
    },
    body: JSON.stringify({
      name: 'Submitted',
      url: 'https://private.example.com',
      catelog_id: 1,
    }),
  });

  const env = {
    ENABLE_PUBLIC_SUBMISSION: 'true',
    NAV_AUTH: createKv(),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /waiting for admin approve/);
  assert.equal(firstSqlCalls.some(sql => sql.includes('FROM sites')), false);
  assert.equal(firstSqlCalls.some(sql => sql.includes('FROM pending_sites')), false);
  const insertCall = runCalls.find(call => call.sql.includes('INSERT INTO pending_sites'));
  assert.ok(insertCall);
  assert.equal(insertCall.params[1], 'https://private.example.com');
});

test('public submit rejects overlong bookmark text before writing pending site', async () => {
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              throw new Error(`Unexpected first() SQL: ${sql} ${JSON.stringify(params)}`);
            },
            async run() {
              throw new Error(`Unexpected run() SQL: ${sql} ${JSON.stringify(params)}`);
            },
          };
        },
      };
    },
  };

  const request = new Request('https://example.com/api/config/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://example.com',
      'CF-Connecting-IP': '203.0.113.1',
    },
    body: JSON.stringify({
      name: 'x'.repeat(INPUT_LIMITS.bookmarkName + 1),
      url: 'https://submitted.example.com',
      catelog_id: 1,
    }),
  });

  const response = await onRequestPost({
    request,
    env: {
      ENABLE_PUBLIC_SUBMISSION: 'true',
      NAV_AUTH: createKv(),
      NAV_DB: db,
    },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /书签名称不能超过/);
});

test('public submit requires Turnstile token when configured', async () => {
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              throw new Error(`Unexpected first() SQL: ${sql} ${JSON.stringify(params)}`);
            },
            async run() {
              throw new Error(`Unexpected run() SQL: ${sql} ${JSON.stringify(params)}`);
            },
          };
        },
      };
    },
  };
  const request = new Request('https://example.com/api/config/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://example.com',
      'CF-Connecting-IP': '203.0.113.1',
    },
    body: JSON.stringify({
      name: 'Submitted',
      url: 'https://submitted.example.com',
      catelog_id: 1,
    }),
  });

  const response = await onRequestPost({
    request,
    env: {
      ENABLE_PUBLIC_SUBMISSION: 'true',
      TURNSTILE_SITE_KEY: 'site-key',
      TURNSTILE_SECRET_KEY: 'secret-key',
      NAV_AUTH: createKv(),
      NAV_DB: db,
    },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.match(body.message, /请先完成人机验证/);
});

test('public submit verifies Turnstile token before inserting pending site', async () => {
  const originalFetch = globalThis.fetch;
  const runCalls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('SELECT catelog, is_private FROM category')) {
                return { catelog: 'Public', is_private: 0 };
              }
              throw new Error(`Unexpected first() SQL: ${sql} ${JSON.stringify(params)}`);
            },
            async run() {
              runCalls.push({ sql, params });
              return { success: true };
            },
          };
        },
      };
    },
  };

  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(init.method, 'POST');
    assert.equal(init.body.get('secret'), 'secret-key');
    assert.equal(init.body.get('response'), 'turnstile-token');
    assert.equal(init.body.get('remoteip'), '203.0.113.1');
    return Response.json({ success: true });
  };

  try {
    const request = new Request('https://example.com/api/config/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://example.com',
        'CF-Connecting-IP': '203.0.113.1',
      },
      body: JSON.stringify({
        name: 'Submitted',
        url: 'https://submitted.example.com',
        catelog_id: 1,
        turnstileToken: 'turnstile-token',
      }),
    });

    const response = await onRequestPost({
      request,
      env: {
        ENABLE_PUBLIC_SUBMISSION: 'true',
        TURNSTILE_SITE_KEY: 'site-key',
        TURNSTILE_SECRET_KEY: 'secret-key',
        NAV_AUTH: createKv(),
        NAV_DB: db,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201, body.message);
    assert.equal(runCalls.some(call => call.sql.includes('INSERT INTO pending_sites')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
