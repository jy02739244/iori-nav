import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { getHomeDirtyKey } from '../functions/_middleware.js';
import { onRequestGet, onRequestPost } from '../functions/api/settings.js';

function createKv(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  const deleteCalls = [];
  return {
    store,
    deleteCalls,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      deleteCalls.push(key);
      store.delete(key);
    },
  };
}

function createDb(initialSettings = {}) {
  const store = new Map(Object.entries(initialSettings));
  const runCalls = [];
  const readCalls = [];

  return {
    store,
    runCalls,
    readCalls,
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
          readCalls.push({ sql, params });

          if (sql.includes('json_each')) {
            const allowedKeys = JSON.parse(params[0]);
            return {
              results: allowedKeys
                .filter(key => store.has(key))
                .map(key => ({ key, value: store.get(key) })),
            };
          }

          if (sql.includes('SELECT key, value FROM settings WHERE key IN')) {
            return {
              results: params
                .filter(key => store.has(key))
                .map(key => ({ key, value: store.get(key) })),
            };
          }

          if (sql.includes('SELECT key, value FROM settings')) {
            return {
              results: [...store.entries()].map(([key, value]) => ({ key, value })),
            };
          }

          return { results: [] };
        },
        async first() {
          if (sql.includes('SELECT value FROM settings WHERE key = ?')) {
            return store.has(params[0]) ? { value: store.get(params[0]) } : null;
          }
          return null;
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

function loadAdminSettingsModule() {
  const source = readFileSync(resolve('public/js/admin-settings-defaults.js'), 'utf8');
  const context = { window: {} };

  vm.runInNewContext(source, context, { filename: 'public/js/admin-settings-defaults.js' });

  return context.window.AdminSettings.defaults;
}

function loadAdminSettingsDefaults() {
  return loadAdminSettingsModule().createDefaultSettings();
}

test('applyServerSettings lets a cleared WebDAV value overwrite a stale in-memory one', async () => {
  // webdav_dir 留空的语义是「备份放根目录」，是有效值而不是「回退默认」。
  // 放进 TRUTHY_STRING_FIELDS 会让服务端的空值被内存旧值顶掉：界面显示旧目录，
  // 而服务端读 DB 里的空值把备份写到根目录——界面与实际行为不符。
  const defaults = loadAdminSettingsModule();

  const stale = defaults.createDefaultSettings();
  stale.webdav_url = 'https://dav.example.com/';
  stale.webdav_username = 'user';
  stale.webdav_dir = 'iori-nav';

  defaults.applyServerSettings(
    { webdav_url: '', webdav_username: '', webdav_dir: '' },
    stale
  );

  assert.equal(stale.webdav_dir, '', '服务端清空后内存不应保留旧目录');
  assert.equal(stale.webdav_url, '');
  assert.equal(stale.webdav_username, '');

  // 非空值仍然正常覆盖
  const updated = defaults.createDefaultSettings();
  updated.webdav_dir = 'old';
  defaults.applyServerSettings({ webdav_dir: 'new' }, updated);
  assert.equal(updated.webdav_dir, 'new');

  // 字段缺席时不动内存值（服务端没返回该 key ≠ 清空）
  const absent = defaults.createDefaultSettings();
  absent.webdav_dir = 'keep';
  defaults.applyServerSettings({}, absent);
  assert.equal(absent.webdav_dir, 'keep');
});

test('applyServerSettings keeps empty strings falling back to defaults for styling fields', async () => {
  // 对照组：颜色/字号的空串语义仍是「回退默认」，不能被这次改动带走
  const defaults = loadAdminSettingsModule();
  const settings = defaults.createDefaultSettings();
  settings.home_title_color = '#ffffff';

  defaults.applyServerSettings({ home_title_color: '' }, settings);

  assert.equal(settings.home_title_color, '#ffffff');
});

test('resolveWebdavPasswordForPayload keeps password semantics in one place', () => {
  const defaults = loadAdminSettingsModule();

  assert.equal(defaults.resolveWebdavPasswordForPayload('new-pass', false), 'new-pass');
  assert.equal(defaults.resolveWebdavPasswordForPayload('new-pass', true), 'new-pass');
  assert.equal(defaults.resolveWebdavPasswordForPayload('', true), undefined, '有已存密码且留空 → 不修改，不发送');
  assert.equal(defaults.resolveWebdavPasswordForPayload('', false), '', '无已存密码且留空 → 空密码');
});

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
  const settingWrites = db.runCalls.filter(call => (
    call.sql.includes('INSERT OR REPLACE INTO settings')
    && call.params[0] !== 'graph_cache_generation'
  ));
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
  const settingWrites = db.runCalls.filter(call => (
    call.sql.includes('INSERT OR REPLACE INTO settings')
    && call.params[0] !== 'graph_cache_generation'
  ));

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(settingWrites.length, 0);
  assert.equal(kv.store.has('settings_cache'), false);
  assert.equal(kv.store.has(getHomeDirtyKey('public')), true);
  assert.equal(kv.store.has(getHomeDirtyKey('private')), true);
});

test('GET /api/settings never returns the WebDAV password', async () => {
  const db = createDb({
    webdav_url: 'https://dav.example.com/',
    webdav_username: 'user',
    webdav_password: 'secret',
  });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestGet({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();
  const raw = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(raw.includes('secret'), false, '响应中不得出现 WebDAV 密码');
  assert.equal(body.data.webdav_password, undefined);
  assert.equal(body.data.has_webdav_password, true);
  assert.equal(body.data.webdav_username, 'user');
});

test('GET /api/settings reads only allowlisted keys with one JSON binding', async () => {
  const db = createDb({
    home_title_size: '36',
    graph_cache_generation: 'internal-uuid',
    apiKey: 'secret-key',
    webdav_password: 'secret-password',
  });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestGet({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.home_title_size, '36');
  assert.equal(body.data.has_api_key, true);
  assert.equal(body.data.has_webdav_password, true);
  assert.equal('graph_cache_generation' in body.data, false);

  assert.equal(db.readCalls.length, 1, 'GET 应只查询一次 settings');
  assert.equal(db.readCalls[0].params.length, 1, '白名单应作为单个 JSON 参数绑定');
  const readKeys = JSON.parse(db.readCalls[0].params[0]);
  assert.ok(readKeys.includes('home_title_size'));
  assert.ok(readKeys.includes('apiKey'));
  assert.ok(readKeys.includes('webdav_password'));
  assert.equal(readKeys.includes('graph_cache_generation'), false);
});

test('POST /api/settings keeps the stored WebDAV password when field is empty', async () => {
  const db = createDb({ webdav_password: 'secret' });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webdav_url: 'https://dav.example.com/',
      webdav_username: 'user',
      webdav_password: '',
    }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(db.store.get('webdav_password'), 'secret', '空密码不应清空已存密码');
  assert.equal(db.store.get('webdav_username'), 'user');
});

test('POST /api/settings preserves leading and trailing spaces in the WebDAV password', async () => {
  const db = createDb();
  const kv = createKv({ session_token: '1' });
  const password = ' secret with spaces ';
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_password: password }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(db.store.get('webdav_password'), password);
});

test('POST /api/settings leaves the home cache alone when only WebDAV keys are saved', async () => {
  // WebDAV 配置不进 SETTINGS_SCHEMA，首页 SSR 的 settings 查询按 getSettingsKeys()
  // 过滤，所以改它们既不影响 settings_cache 也不影响首页 HTML —— 刷缓存只会让
  // 访客白等一次重新渲染。点「立即备份」触发的落库走的就是这条路径。
  const db = createDb();
  const kv = createKv({ session_token: '1', settings_cache: '[cached]' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webdav_url: 'https://dav.example.com/',
      webdav_username: 'user',
      webdav_dir: 'iori-nav',
    }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(db.store.get('webdav_url'), 'https://dav.example.com/');
  assert.equal(kv.store.get('settings_cache'), '[cached]', 'WebDAV 配置不在 settings_cache 内');
  assert.equal(kv.store.has(getHomeDirtyKey('public')), false);
  assert.equal(kv.store.has(getHomeDirtyKey('private')), false);
});

test('POST /api/settings still invalidates caches when WebDAV keys ride along with rendered ones', async () => {
  const db = createDb();
  const kv = createKv({ session_token: '1', settings_cache: '[cached]' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webdav_url: 'https://dav.example.com/',
      layout_hide_desc: true,
    }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(kv.store.has('settings_cache'), false);
  assert.equal(kv.store.has(getHomeDirtyKey('public')), true);
  assert.equal(kv.store.has(getHomeDirtyKey('private')), true);
});

test('POST /api/settings rejects a non-http WebDAV URL', async () => {
  const db = createDb();
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_url: 'javascript:alert(1)' }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(db.store.has('webdav_url'), false);
  assert.match(body.message, /webdav_url/);
});

test('POST /api/settings rejects an HTTP WebDAV URL to protect credentials', async () => {
  const db = createDb();
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_url: 'http://dav.example.com/root' }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(db.store.has('webdav_url'), false);
  assert.match(body.message, /HTTPS/);
});

test('POST /api/settings rejects credentials embedded in the WebDAV URL', async () => {
  const db = createDb();
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_url: 'https://user:secret@dav.example.com/root' }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(db.store.has('webdav_url'), false);
  assert.match(body.message, /credentials/);
  assert.equal(JSON.stringify(body).includes('secret'), false, '响应不得回显 URL 中的密码');
});

test('POST /api/settings rejects webdav_dir path traversal via both separators', async () => {
  // 反斜杠曾能绕过只 split('/') 的检查，以 %5C 原样送到 Windows 系服务端
  // %2f 二次解码后变 /，也能绕过 split('/') 检查
  const traversals = ['ok/../../etc', 'ok\\..\\..\\etc', '..\\..\\x', 'a\\b', '../..', '..%2f..%2fetc', '..%5c..%5cetc'];

  for (const dir of traversals) {
    const db = createDb();
    const kv = createKv({ session_token: '1' });
    const request = new Request('https://example.com/api/settings', {
      method: 'POST',
      headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ webdav_dir: dir }),
    });

    const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
    assert.equal(response.status, 400, `应拒绝 webdav_dir: ${JSON.stringify(dir)}`);
    assert.equal(db.store.has('webdav_dir'), false);
  }
});

test('POST /api/settings still accepts ordinary webdav_dir values', async () => {
  const db = createDb();
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_dir: 'iori-nav/backup' }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(db.store.get('webdav_dir'), 'iori-nav/backup');
});

test('POST /api/settings clears the WebDAV password when explicitly sent null', async () => {
  const db = createDb({ webdav_password: 'secret' });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_password: null }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  // 留空是「不修改」，所以解除配置需要一个显式出口；用 null 而不是带内哨兵字符串
  assert.equal(response.status, 200, body.message);
  assert.equal(db.store.get('webdav_password'), '', 'null 应清空已存密码');
});

test('POST /api/settings can store a password that looks like a clear sentinel', async () => {
  // 曾用 '__CLEAR__' 字符串做清除哨兵，会把这个合法密码静默吞成空值，
  // 之后备份一直报「WebDAV 未配置」而接口返回 200，排查方向完全被带偏
  const db = createDb({ webdav_password: 'secret' });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ webdav_password: '__CLEAR__' }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(db.store.get('webdav_password'), '__CLEAR__', '任何字符串都应能作为真实密码存储');
});

test('POST /api/settings keeps the stored password when the field is absent or empty', async () => {
  // 前端每次加载都会清空密码框，空值必须是「不修改」而不是「清除」
  for (const payload of [{ webdav_username: 'user' }, { webdav_password: '', webdav_username: 'user' }]) {
    const db = createDb({ webdav_password: 'secret' });
    const kv = createKv({ session_token: '1' });
    const request = new Request('https://example.com/api/settings', {
      method: 'POST',
      headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
    assert.equal(response.status, 200);
    assert.equal(
      db.store.get('webdav_password'),
      'secret',
      `空密码不应覆盖已存值: ${JSON.stringify(payload)}`
    );
  }
});

test('GET /api/settings reports no password after it is cleared', async () => {
  const db = createDb({ webdav_password: '' });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestGet({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.has_webdav_password, false, '清空后前端应显示未配置');
});

test('POST /api/settings treats an empty API key as "keep the stored one"', async () => {
  // 与 webdav_password 共用同一套三态语义：空值 = 不修改
  for (const payload of [{ provider: 'openai' }, { apiKey: '', provider: 'openai' }]) {
    const db = createDb({ apiKey: 'stored-key', provider: 'openai' });
    const kv = createKv({ session_token: '1' });
    const request = new Request('https://example.com/api/settings', {
      method: 'POST',
      headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });
    assert.equal(response.status, 200);
    assert.equal(
      db.store.get('apiKey'),
      'stored-key',
      `空 API key 不应覆盖已存值: ${JSON.stringify(payload)}`
    );
  }
});

test('POST /api/settings clears the API key when it is sent as null', async () => {
  const db = createDb({ apiKey: 'stored-key' });
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: null }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });

  assert.equal(response.status, 200);
  assert.equal(db.store.get('apiKey'), '', 'null 应清空已存 API key');
});

test('POST /api/settings does not refresh the home cache for AI-only changes', async () => {
  // AI 配置不进 SETTINGS_SCHEMA，既不影响 settings_cache 也不影响 SSR 输出
  const db = createDb({});
  const kv = createKv({ session_token: '1', settings_cache: '[]' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.example.com', model: 'gpt-4o-mini' }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });

  assert.equal(response.status, 200);
  assert.equal(kv.deleteCalls.includes('settings_cache'), false, 'AI 配置不该丢掉设置缓存');
  assert.equal(kv.store.has('settings_cache'), true, 'AI 配置不该丢掉设置缓存');
  assert.equal(kv.store.has(getHomeDirtyKey('public')), false, 'AI 配置不该标记首页 dirty');
  assert.equal(kv.store.has(getHomeDirtyKey('private')), false, 'AI 配置不该标记首页 dirty');
});

test('POST /api/settings still refreshes caches when layout settings change', async () => {
  const db = createDb({});
  const kv = createKv({ session_token: '1', settings_cache: '[]' });
  const request = new Request('https://example.com/api/settings', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout_hide_desc: true }),
  });

  const response = await onRequestPost({ request, env: { NAV_AUTH: kv, NAV_DB: db } });

  assert.equal(response.status, 200);
  assert.equal(kv.deleteCalls.includes('settings_cache'), true, '布局设置应清掉设置缓存');
  assert.equal(kv.store.has('settings_cache'), false, '布局设置应清掉设置缓存');
  assert.equal(kv.store.has(getHomeDirtyKey('public')), true, '布局设置应标记首页 dirty');
});

function createFailingDb(errorMessage) {
  return {
    prepare() {
      const statement = {
        bind() {
          return statement;
        },
        async all() {
          throw new Error(errorMessage);
        },
      };
      return statement;
    },
  };
}

test('GET /api/settings returns empty settings when the table is missing', async () => {
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestGet({
    request,
    env: { NAV_AUTH: kv, NAV_DB: createFailingDb('D1_ERROR: no such table: settings') },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, {}, '首次部署时应回退到空设置');
});

test('GET /api/settings surfaces real DB failures instead of faking empty settings', async () => {
  // 判断条件一旦放宽到 'settings'，D1 回显 SQL 语句的错误消息就会误命中，
  // 超时之类的真实故障会被讲成「还没有配置」，前端静默套用默认值。
  const kv = createKv({ session_token: '1' });
  const request = new Request('https://example.com/api/settings', {
    headers: { Cookie: 'admin_session=token' },
  });

  const response = await onRequestGet({
    request,
    env: {
      NAV_AUTH: kv,
      NAV_DB: createFailingDb('D1_ERROR: timed out running SELECT key, value FROM settings'),
    },
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.code, 500);
  assert.match(body.message, /timed out/);
});
