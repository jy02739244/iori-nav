import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from '../functions/api/config/export.js';

function createEnv() {
  return {
    NAV_AUTH: {
      async get(key) {
        return key === 'session_token' ? '1' : null;
      },
    },
    NAV_DB: {
      prepare() {
        return {
          async all() {
            return { results: [] };
          },
        };
      },
    },
  };
}

test('GET /api/config/export disables caching for public and private exports', async () => {
  for (const query of ['', '?include_private=true']) {
    const request = new Request(`https://example.com/api/config/export${query}`, {
      headers: { Cookie: 'admin_session=token' },
    });

    const response = await onRequestGet({ request, env: createEnv() });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Cache-Control') || '', /\bno-store\b/);
  }
});
