import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPut } from '../functions/api/categories/[id].js';

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

function getDescendantIds(categories, rootId) {
  const ids = new Set([Number(rootId)]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const category of categories) {
      if (!ids.has(category.id) && ids.has(Number(category.parent_id || 0))) {
        ids.add(category.id);
        changed = true;
      }
    }
  }

  return ids;
}

function createDb({ categories, sites }) {
  const calls = [];

  const runStatement = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes('UPDATE category SET catelog = ?')) {
      const [catelog, sortOrder, parentId, isPrivate, id] = params;
      const category = categories.find(item => item.id === Number(id));
      category.catelog = catelog;
      category.sort_order = sortOrder;
      category.parent_id = Number(parentId);
      category.is_private = isPrivate;
      return { success: true };
    }

    if (sql.includes('UPDATE sites SET catelog_name = ?')) {
      const [catelogName, categoryId] = params;
      sites
        .filter(site => site.catelog_id === Number(categoryId))
        .forEach(site => {
          site.catelog_name = catelogName;
        });
      return { success: true };
    }

    if (sql.includes('WITH RECURSIVE descendants') && sql.includes('UPDATE category')) {
      const descendantIds = getDescendantIds(categories, params[0]);
      categories
        .filter(category => descendantIds.has(category.id))
        .forEach(category => {
          category.is_private = 1;
        });
      return { success: true };
    }

    if (sql.includes('WITH RECURSIVE descendants') && sql.includes('UPDATE sites')) {
      const descendantIds = getDescendantIds(categories, params[0]);
      sites
        .filter(site => descendantIds.has(site.catelog_id))
        .forEach(site => {
          site.is_private = 1;
        });
      return { success: true };
    }

    throw new Error(`Unexpected run() SQL: ${sql}`);
  };

  return {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('SELECT id, is_private FROM category WHERE id = ?')) {
                return categories.find(category => category.id === Number(params[0])) ?? null;
              }

              if (sql.includes('SELECT id FROM category WHERE catelog = ? AND parent_id = ? AND id != ?')) {
                const [catelog, parentId, id] = params;
                return categories.find(category => (
                  category.catelog === catelog
                  && Number(category.parent_id || 0) === Number(parentId)
                  && category.id !== Number(id)
                )) ?? null;
              }

              throw new Error(`Unexpected first() SQL: ${sql}`);
            },
            async run() {
              return runStatement(sql, params);
            },
          };
        },
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };
}

test('PUT /api/categories/:id marks private descendants and their sites private', async () => {
  const categories = [
    { id: 1, catelog: 'Root', parent_id: 0, is_private: 0, sort_order: 1 },
    { id: 2, catelog: 'Child', parent_id: 1, is_private: 0, sort_order: 2 },
    { id: 3, catelog: 'Grandchild', parent_id: 2, is_private: 0, sort_order: 3 },
    { id: 4, catelog: 'Other', parent_id: 0, is_private: 0, sort_order: 4 },
  ];
  const sites = [
    { id: 1, catelog_id: 1, catelog_name: 'Root', is_private: 0 },
    { id: 2, catelog_id: 2, catelog_name: 'Child', is_private: 0 },
    { id: 3, catelog_id: 3, catelog_name: 'Grandchild', is_private: 0 },
    { id: 4, catelog_id: 4, catelog_name: 'Other', is_private: 0 },
  ];
  const db = createDb({ categories, sites });
  const request = new Request('https://example.com/api/categories/1', {
    method: 'PUT',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      catelog: 'Private Root',
      sort_order: 10,
      parent_id: 0,
      is_private: true,
    }),
  });

  const response = await onRequestPut({
    request,
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: db,
    },
    params: { id: '1' },
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.deepEqual(categories.map(category => category.is_private), [1, 1, 1, 0]);
  assert.deepEqual(sites.map(site => site.is_private), [1, 1, 1, 0]);
  assert.equal(sites[0].catelog_name, 'Private Root');
  assert.equal(db.calls.some(call => call.sql.includes('WITH RECURSIVE descendants') && call.sql.includes('UPDATE category')), true);
  assert.equal(db.calls.some(call => call.sql.includes('WITH RECURSIVE descendants') && call.sql.includes('UPDATE sites')), true);
});
