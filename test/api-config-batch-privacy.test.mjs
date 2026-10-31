import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/config/batch.js';
import { getHomeDirtyKey } from '../functions/_middleware.js';

function createEnv({ categories, sites, batchError = null }) {
  const store = new Map([['session_token', '1']]);
  const calls = {
    batchCount: 0,
    batchSqls: [],
    privacyChecks: 0,
    parentChecks: 0,
    categoryUpdates: 0,
    categoryUpdateIds: [],
  };

  const env = {
    NAV_AUTH: {
      async get(key) {
        return store.get(key) ?? null;
      },
      async put(key, value) {
        store.set(key, value);
      },
      async delete(key) {
        store.delete(key);
      },
    },
    NAV_DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              sql,
              params,
              async all() {
                if (sql.includes('INNER JOIN category c')) {
                  calls.privacyChecks++;
                  const categoryIds = new Set(
                    params
                      .map(id => sites.find(site => site.id === Number(id))?.catelog_id)
                      .filter(Boolean)
                  );
                  return {
                    results: categories.filter(category => categoryIds.has(category.id) && category.is_private === 1),
                  };
                }
                if (sql.includes('SELECT id, catelog') && sql.includes('AND is_private = 1')) {
                  calls.parentChecks++;
                  const parentIds = new Set(params.map(Number));
                  return {
                    results: categories.filter(category => parentIds.has(category.id) && category.is_private === 1),
                  };
                }
                throw new Error(`Unexpected all() SQL: ${sql}`);
              },
              async run() {
                if (sql.includes('INSERT OR REPLACE INTO settings')) {
                  return { success: true, meta: {} };
                }
                if (sql.includes('UPDATE category SET is_private = 0')) {
                  calls.categoryUpdates++;
                  calls.categoryUpdateIds.push(params.map(Number));
                  const idSet = new Set(params.map(Number));
                  categories.forEach(category => {
                    if (idSet.has(category.id)) category.is_private = 0;
                  });
                  return { success: true, meta: {} };
                }
                if (sql.includes('UPDATE sites SET is_private = ?')) {
                  const [isPrivate, ...ids] = params;
                  const idSet = new Set(ids.map(Number));
                  sites.forEach(site => {
                    if (!idSet.has(site.id)) return;
                    const category = categories.find(item => item.id === site.catelog_id);
                    if (isPrivate === 0 && category?.is_private === 1) return;
                    site.is_private = isPrivate;
                  });
                  return { success: true, meta: {} };
                }
                throw new Error(`Unexpected run() SQL: ${sql}`);
              },
            };
          },
        };
      },
      async batch(statements) {
        calls.batchCount++;
        calls.batchSqls.push(...statements.map(statement => statement.sql));
        if (batchError) throw new Error(batchError);
        for (const statement of statements) {
          await statement.run();
        }
        return statements.map(() => ({ success: true }));
      },
    },
  };

  return { env, store, calls };
}

function buildRequest(body) {
  return new Request('https://example.com/api/config/batch', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('batch making bookmarks public rejects private-category bookmarks without explicit opt-in', async () => {
  const categories = [
    { id: 10, catelog: '私人资料', parent_id: 0, is_private: 1 },
    { id: 20, catelog: '公开分类', parent_id: 0, is_private: 0 },
  ];
  const sites = [
    { id: 1, catelog_id: 10, is_private: 1 },
    { id: 2, catelog_id: 20, is_private: 1 },
  ];
  const { env, store, calls } = createEnv({ categories, sites });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1, 2],
      payload: { isPrivate: false },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.message, /私人资料/);
  assert.match(body.message, /请确认同时公开这些分类/);
  assert.equal(calls.privacyChecks, 1);
  assert.equal(calls.batchCount, 0);
  assert.deepEqual(categories.map(category => category.is_private), [1, 0]);
  assert.deepEqual(sites.map(site => site.is_private), [1, 1]);
  assert.equal(store.has(getHomeDirtyKey('public')), false);
  assert.equal(store.has(getHomeDirtyKey('private')), false);
});

test('batch making bookmarks public succeeds when every category is public', async () => {
  const categories = [
    { id: 10, catelog: '分类 A', parent_id: 0, is_private: 0 },
    { id: 20, catelog: '分类 B', parent_id: 0, is_private: 0 },
  ];
  const sites = [
    { id: 1, catelog_id: 10, is_private: 1 },
    { id: 2, catelog_id: 20, is_private: 1 },
  ];
  const { env, store, calls } = createEnv({ categories, sites });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1, 2],
      payload: { isPrivate: false },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(calls.batchCount, 1);
  assert.equal(calls.categoryUpdates, 0);
  assert.deepEqual(sites.map(site => site.is_private), [0, 0]);
  assert.equal(store.has(getHomeDirtyKey('public')), true);
  assert.equal(store.has(getHomeDirtyKey('private')), true);
});

test('explicit opt-in publicizes private categories and bookmarks in the same batch', async () => {
  const categories = [
    { id: 10, catelog: '私人资料', parent_id: 0, is_private: 1 },
  ];
  const sites = [{ id: 1, catelog_id: 10, is_private: 1 }];
  const { env, calls } = createEnv({ categories, sites });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1],
      payload: { isPrivate: false, publicizePrivateCategories: true },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(calls.batchCount, 1);
  assert.equal(calls.categoryUpdates, 1);
  assert.deepEqual(calls.categoryUpdateIds, [[10]]);
  assert.equal(calls.batchSqls[0].includes('UPDATE category SET is_private = 0'), true);
  assert.equal(calls.batchSqls[1].includes('UPDATE sites SET is_private = ?'), true);
  assert.deepEqual(categories.map(category => category.is_private), [0]);
  assert.deepEqual(sites.map(site => site.is_private), [0]);
});

test('explicit opt-in still rejects a private category whose private parent is not selected', async () => {
  const categories = [
    { id: 1, catelog: '私人根分类', parent_id: 0, is_private: 1 },
    { id: 10, catelog: '私人子分类', parent_id: 1, is_private: 1 },
  ];
  const sites = [{ id: 1, catelog_id: 10, is_private: 1 }];
  const { env, store, calls } = createEnv({ categories, sites });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1],
      payload: { isPrivate: false, publicizePrivateCategories: true },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.message, /私人根分类/);
  assert.match(body.message, /请先公开其上级分类/);
  assert.equal(calls.parentChecks, 1);
  assert.equal(calls.batchCount, 0);
  assert.deepEqual(categories.map(category => category.is_private), [1, 1]);
  assert.deepEqual(sites.map(site => site.is_private), [1]);
  assert.equal(store.has(getHomeDirtyKey('public')), false);
});

test('explicit opt-in can publicize selected parent and child categories together', async () => {
  const categories = [
    { id: 1, catelog: '公开根分类', parent_id: 0, is_private: 0 },
    { id: 10, catelog: '私人父分类', parent_id: 1, is_private: 1 },
    { id: 20, catelog: '私人子分类', parent_id: 10, is_private: 1 },
  ];
  const sites = [
    { id: 1, catelog_id: 10, is_private: 1 },
    { id: 2, catelog_id: 20, is_private: 1 },
  ];
  const { env, calls } = createEnv({ categories, sites });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1, 2],
      payload: { isPrivate: false, publicizePrivateCategories: true },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(calls.batchCount, 1);
  assert.equal(calls.categoryUpdates, 2);
  assert.deepEqual(calls.categoryUpdateIds, [[10], [20]]);
  assert.deepEqual(categories.map(category => category.is_private), [0, 0, 0]);
  assert.deepEqual(sites.map(site => site.is_private), [0, 0]);
});

test('batch returns 409 when the database privacy trigger detects a concurrent change', async () => {
  const categories = [
    { id: 10, catelog: '私人资料', parent_id: 0, is_private: 1 },
  ];
  const sites = [{ id: 1, catelog_id: 10, is_private: 1 }];
  const { env, calls } = createEnv({
    categories,
    sites,
    batchError: 'D1_ERROR: privacy_guard_private_parent: SQLITE_CONSTRAINT',
  });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1],
      payload: { isPrivate: false, publicizePrivateCategories: true },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.message, /隐私状态已发生变化/);
  assert.equal(calls.batchCount, 1);
  assert.deepEqual(categories.map(category => category.is_private), [1]);
  assert.deepEqual(sites.map(site => site.is_private), [1]);
});

test('batch making bookmarks private does not require public categories', async () => {
  const categories = [{ id: 10, catelog: '私人资料', parent_id: 0, is_private: 1 }];
  const sites = [{ id: 1, catelog_id: 10, is_private: 0 }];
  const { env, calls } = createEnv({ categories, sites });

  const response = await onRequestPost({
    env,
    request: buildRequest({
      action: 'update_privacy',
      ids: [1],
      payload: { isPrivate: true },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(calls.privacyChecks, 0);
  assert.equal(calls.parentChecks, 0);
  assert.equal(calls.categoryUpdates, 0);
  assert.equal(calls.batchCount, 1);
  assert.deepEqual(sites.map(site => site.is_private), [1]);
});
