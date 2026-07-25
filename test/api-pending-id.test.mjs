import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPut } from '../functions/api/pending/[id].js';

function createKv(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
  };
}

test('PUT /api/pending/:id matches legacy root URL forms before approval', async () => {
  let duplicateParams = null;
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              if (sql.includes('SELECT * FROM pending_sites')) {
                return {
                  results: [{
                    id: 1,
                    name: 'Example',
                    url: 'https://example.com/',
                    logo: '',
                    desc: '',
                    catelog_id: 1,
                  }],
                };
              }
              throw new Error(`Unexpected all() SQL: ${sql}`);
            },
            async first() {
              if (sql.includes('SELECT id FROM sites WHERE url IN')) {
                duplicateParams = params;
                return params.includes('https://example.com') && params.includes('https://example.com/')
                  ? { id: 99 }
                  : null;
              }
              throw new Error(`Unexpected first() SQL: ${sql}`);
            },
            async run() {
              throw new Error(`Unexpected run() SQL: ${sql}`);
            },
          };
        },
      };
    },
  };
  const request = new Request('https://example.com/api/pending/1', {
    method: 'PUT',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
  });
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPut({ request, env, params: { id: '1' } });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 409);
  assert.deepEqual(duplicateParams, ['https://example.com', 'https://example.com/']);
});
