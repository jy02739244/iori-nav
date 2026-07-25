import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from '../functions/api/config/index.js';

test('GET /api/config rejects overlong search keywords before querying database', async () => {
  const request = new Request(`https://example.com/api/config?keyword=${'a'.repeat(101)}`);
  const env = {
    NAV_AUTH: {
      async get() {
        throw new Error('KV should not be queried for invalid keywords');
      },
    },
    NAV_DB: {
      prepare() {
        throw new Error('DB should not be queried for invalid keywords');
      },
    },
  };

  const response = await onRequestGet({ request, env });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, 400);
  assert.match(body.message, /搜索关键词不能超过 100 个字符/);
});
