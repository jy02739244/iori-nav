import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/config/import.js';
import { INPUT_LIMITS } from '../functions/lib/validators.js';

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

test('import override updates the database URL form that actually exists', async () => {
  const runCalls = [];
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [{ url: 'https://example.com' }] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      override: true,
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [{
        name: 'Updated',
        url: 'https://example.com',
        catelog_id: 1,
        sort_order: 1,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const updateCall = runCalls.find(call => call.sql.includes('UPDATE sites SET'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /更新 1 个/);
  assert.ok(updateCall);
  assert.equal(updateCall.params.at(-1), 'https://example.com');
});

test('import forces public children and sites private under a private parent category', async () => {
  const runCalls = [];
  let nextCategoryId = 10;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [
        { id: 1, catelog: '私人资料', parent_id: 0, is_private: 1 },
        { id: 2, catelog: '账号面板', parent_id: 1, is_private: 0 },
      ],
      sites: [{
        name: '内部面板',
        url: 'https://internal.example',
        catelog_id: 2,
        is_private: 0,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const categoryInsertCalls = runCalls.filter(call => call.sql.includes('INSERT INTO category'));
  const siteInsertCall = runCalls.find(call => call.sql.includes('INSERT INTO sites'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /新增 1 个/);
  assert.equal(categoryInsertCalls.length, 2);
  assert.deepEqual(categoryInsertCalls[0].params, ['私人资料', 9999, 0, 1]);
  assert.deepEqual(categoryInsertCalls[1].params, ['账号面板', 9999, 10, 1]);
  assert.ok(siteInsertCall);
  assert.equal(siteInsertCall.params[5], '账号面板');
  assert.equal(siteInsertCall.params[7], 1);
});

test('import maps Chrome root bookmarks into a root category', async () => {
  const runCalls = [];
  let nextCategoryId = 30;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [],
      sites: [{
        name: 'Root Link',
        url: 'https://root.example',
        catelog_id: 0,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();
  const categoryInsertCall = runCalls.find(call => call.sql.includes('INSERT INTO category'));
  const siteInsertCall = runCalls.find(call => call.sql.includes('INSERT INTO sites'));

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /新增 1 个/);
  assert.ok(categoryInsertCall);
  assert.deepEqual(categoryInsertCall.params, ['默认', 9999, 0, 0]);
  assert.ok(siteInsertCall);
  assert.equal(siteInsertCall.params[4], 30);
  assert.equal(siteInsertCall.params[5], '默认');
});

test('import skips overlong bookmark rows instead of writing them', async () => {
  const runCalls = [];
  let nextCategoryId = 20;
  const db = {
    prepare(sql) {
      const createStatement = (params = []) => ({
        async all() {
          if (sql.includes('SELECT id, catelog, parent_id, is_private FROM category')) {
            return { results: [] };
          }
          if (sql.includes('SELECT url FROM sites WHERE url IN')) {
            return { results: [] };
          }
          throw new Error(`Unexpected all() SQL: ${sql} ${JSON.stringify(params)}`);
        },
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT INTO category')) {
            return { success: true, meta: { last_row_id: nextCategoryId++ } };
          }
          return { success: true, meta: {} };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        all: createStatement().all,
        run: createStatement().run,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };

  const request = new Request('https://example.com/api/config/import', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: [{ id: 1, catelog: 'Default', parent_id: 0, is_private: 0 }],
      sites: [{
        name: 'Too long',
        url: 'https://toolong.example',
        desc: 'x'.repeat(INPUT_LIMITS.bookmarkDesc + 1),
        catelog_id: 1,
      }],
    }),
  });

  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: db,
  };

  const response = await onRequestPost({ request, env });
  const body = await response.json();

  assert.equal(response.status, 201, body.message);
  assert.match(body.message, /跳过 1 个/);
  assert.equal(runCalls.some(call => call.sql.includes('INSERT INTO category')), true);
  assert.equal(runCalls.some(call => call.sql.includes('INSERT INTO sites')), false);
});
