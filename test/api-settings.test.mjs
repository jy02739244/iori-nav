import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { onRequestPost } from '../functions/api/settings.js';

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

function createDb(initialSettings = {}) {
  const store = new Map(Object.entries(initialSettings));
  const runCalls = [];

  return {
    store,
    runCalls,
    prepare(sql) {
      const createStatement = (params = []) => ({
        sql,
        params,
        async run() {
          runCalls.push({ sql, params });
          if (sql.includes('INSERT OR REPLACE INTO settings')) {
            store.set(params[0], params[1]);
          }
          return { success: true };
        },
        async all() {
          if (sql.includes('SELECT key, value FROM settings WHERE key IN')) {
            return {
              results: params
                .filter(key => store.has(key))
                .map(key => ({ key, value: store.get(key) })),
            };
          }

          return { results: [] };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        run: createStatement().run,
        all: createStatement().all,
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
    },
  };
}

function loadAdminSettingsDefaults() {
  const source = readFileSync(resolve('public/js/admin-settings-core.js'), 'utf8');
  const context = { window: {} };

  vm.runInNewContext(source, context, { filename: 'public/js/admin-settings-core.js' });

  return context.window.AdminSettings.core.getCurrentSettings();
}

test('POST /api/settings accepts the admin settings payload', async () => {
  const defaults = loadAdminSettingsDefaults();
  const db = createDb();
  const kv = createKv({
    session_token: '1',
    settings_cache: '[cached]',
  });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(defaults),
  });

  const response = await onRequestPost({
    request,
    env: {
      NAV_AUTH: kv,
      NAV_DB: db,
    },
  });
  const body = await response.json();
  const settingWrites = db.runCalls.filter(call => call.sql.includes('INSERT OR REPLACE INTO settings'));
  const savedKeys = settingWrites.map(call => call.params[0]);

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.ok(savedKeys.includes('layout_hide_desc'));
  assert.ok(savedKeys.includes('provider'));
  assert.equal(savedKeys.includes('has_api_key'), false);
  assert.equal(savedKeys.includes('layout_random_wallpaper'), false);
  assert.ok(savedKeys.includes('home_category_flow'));
  assert.equal(settingWrites.find(call => call.params[0] === 'layout_hide_desc').params[1], 'false');
  assert.equal(settingWrites.find(call => call.params[0] === 'home_category_flow').params[1], 'single_line');
  assert.equal(settingWrites.find(call => call.params[0] === 'provider').params[1], 'workers-ai');
  assert.equal(kv.store.has('settings_cache'), false);
});

test('POST /api/settings accepts category flow setting directly', async () => {
  const db = createDb();
  const kv = createKv({
    session_token: '1',
    settings_cache: '[cached]',
  });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      home_category_flow: 'multi_line',
    }),
  });

  const response = await onRequestPost({
    request,
    env: {
      NAV_AUTH: kv,
      NAV_DB: db,
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(db.store.get('home_category_flow'), 'multi_line');
});

test('POST /api/settings skips unchanged writes but still invalidates caches', async () => {
  const db = createDb({
    provider: 'workers-ai',
    layout_hide_desc: 'false',
  });
  const kv = createKv({
    session_token: '1',
    settings_cache: '[cached]',
  });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'workers-ai',
      layout_hide_desc: false,
    }),
  });

  const response = await onRequestPost({
    request,
    env: {
      NAV_AUTH: kv,
      NAV_DB: db,
    },
  });
  const body = await response.json();
  const settingWrites = db.runCalls.filter(call => call.sql.includes('INSERT OR REPLACE INTO settings'));

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(settingWrites.length, 0);
  assert.equal(kv.store.has('settings_cache'), false);
  assert.equal(kv.store.has('home_dirty_public_v11'), true);
  assert.equal(kv.store.has('home_dirty_private_v11'), true);
});
