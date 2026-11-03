import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from '../functions/admin/index.js';

const TEMPLATE_HTML = '<html><head><title>admin</title></head><body>admin</body></html>';

function createEnv(assetHeaders = {}, csrfToken = 'csrf-value') {
  return {
    NAV_AUTH: {
      async get(key) {
        if (key === 'session_abc') return '1';
        if (key === 'csrf_abc') return csrfToken;
        return null;
      },
      async put() {},
      async delete() {},
    },
    ASSETS: {
      async fetch() {
        return new Response(TEMPLATE_HTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...assetHeaders,
          },
        });
      },
    },
  };
}

function createRequest() {
  return new Request('https://example.com/admin', {
    headers: { Cookie: 'admin_session=abc' },
  });
}

test('admin page drops ASSETS headers that no longer describe the injected body', async () => {
  // 注入 csrf meta 后 body 与模板不同：Content-Length 会截断页面，ETag 与实际内容
  // 不对应；response.text() 已按 Content-Encoding 解压过，头不能继续留着。
  const env = createEnv({
    'Content-Length': '9999',
    'ETag': '"template-etag"',
    'Content-Encoding': 'gzip',
    'Access-Control-Allow-Origin': '*',
    'X-Other-Asset-Header': 'keep-me',
  });

  const response = await onRequestGet({ request: createRequest(), env });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  // 与 body 无关的头要保留，不能顺手整片清空
  assert.equal(response.headers.get('x-other-asset-header'), 'keep-me');
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(body, /<meta name="csrf-token" content="csrf-value">/);
  assert.equal(body.match(/name="csrf-token"/g).length, 1, 'csrf meta 不应重复注入');
  assert.ok(body.endsWith('</html>'), 'body 不能被截断');
});

test('admin page keeps the injected meta inside head', async () => {
  const env = createEnv();
  const response = await onRequestGet({ request: createRequest(), env });
  const body = await response.text();

  const headEnd = body.indexOf('</head>');
  const metaIndex = body.indexOf('<meta name="csrf-token"');
  assert.ok(metaIndex > -1, 'csrf meta 必须被注入');
  assert.ok(metaIndex < headEnd, 'csrf meta 必须位于 </head> 之前');
});

test('admin page clears the cookie and redirects when the csrf token is gone', async () => {
  // 会话还在、但 KV 里的 csrf token 已失效（例如服务端清理过）：
  // 必须回登录页并清 cookie，否则用户会停在后台、所有写操作静默 403。
  const env = createEnv({}, null);
  const response = await onRequestGet({ request: createRequest(), env });

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /^\/admin\/login\?error=/);
  assert.match(response.headers.get('set-cookie'), /^admin_session=; Max-Age=0/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
