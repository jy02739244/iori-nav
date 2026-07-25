import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPut } from '../functions/api/config/[id].js';

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
  };
}

function createDb({ category }) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('SELECT id, is_private FROM sites')) {
                return { id: 1, is_private: 0 };
              }
              if (sql.includes('SELECT id FROM sites WHERE url IN')) {
                return null;
              }
              if (sql.includes('SELECT catelog, is_private FROM category')) {
                return category;
              }
              throw new Error(`Unexpected first() SQL: ${sql}`);
            },
            async run() {
              throw new Error(`Unexpected run() SQL: ${sql} ${JSON.stringify(params)}`);
            },
          };
        },
      };
    },
  };
}

test('PUT /api/config/:id rejects updates to a missing category', async () => {
  const request = new Request('https://example.com/api/config/1', {
    method: 'PUT',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Example',
      url: 'https://example.com',
      catelog_id: 999,
      is_private: false,
    }),
  });
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: createDb({ category: null }),
  };

  const response = await onRequestPut({ request, env, params: { id: '1' } });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, 400);
  assert.match(body.message, /Category not found/);
});

test('PUT /api/config/:id rejects unsafe bookmark URLs before updating', async () => {
  const request = new Request('https://example.com/api/config/1', {
    method: 'PUT',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Example',
      url: 'javascript:alert(1)',
      catelog_id: 1,
      is_private: false,
    }),
  });
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: createDb({ category: { catelog: 'Default', is_private: 0 } }),
  };

  const response = await onRequestPut({ request, env, params: { id: '1' } });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, 400);
  assert.match(body.message, /valid http or https URL/);
});
