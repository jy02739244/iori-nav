import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from '../functions/api/settings.js';

let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  // Older Node.js versions do not expose node:sqlite.
}

const skipReason = DatabaseSync ? false : 'node:sqlite 不可用';

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

/**
 * 用真实 SQLite 充当 D1：handler 发什么 SQL 就执行什么，不模拟查询语义。
 * 这样 json_each 白名单、主键索引这些只有真库才能验证的东西才真的被跑到。
 */
function createRealDb() {
  const db = new DatabaseSync(':memory:');
  const calls = [];

  db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)');

  return {
    db,
    calls,
    prepare(sql) {
      const statement = {
        params: [],
        bind(...params) {
          statement.params = params;
          return statement;
        },
        async all() {
          calls.push({ sql, params: statement.params });
          return { results: db.prepare(sql).all(...statement.params) };
        },
        async first() {
          calls.push({ sql, params: statement.params });
          return db.prepare(sql).get(...statement.params) ?? null;
        },
        async run() {
          db.prepare(sql).run(...statement.params);
          return { success: true };
        },
      };
      return statement;
    },
  };
}

function createAdminRequest() {
  return new Request('https://example.com/api/settings', {
    headers: { Cookie: 'admin_session=token' },
  });
}

test('GET /api/settings reads allowlisted keys from a real SQLite database', { skip: skipReason }, async () => {
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: createRealDb(),
  };

  const insert = env.NAV_DB.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of [
    ['home_title_size', '36'],
    ['apiKey', 'secret-key'],
    ['webdav_password', ''],
    // 内部键与脏数据都不该出现在响应里
    ['graph_cache_generation', 'internal-uuid'],
    ['not_a_real_setting', 'junk'],
    // 计算字段以数据库里的真实值为准，不能被脏数据覆盖
    ['has_webdav_password', 'true'],
  ]) {
    insert.run(key, value);
  }

  const response = await onRequestGet({ request: createAdminRequest(), env });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.home_title_size, '36');
  assert.equal(body.data.has_api_key, true);
  // webdav_password 为空 → 计算出来的 has_webdav_password 必须是 false，
  // 不能被数据库里那行 'true' 覆盖
  assert.equal(body.data.has_webdav_password, false);
  assert.equal('graph_cache_generation' in body.data, false);
  assert.equal('not_a_real_setting' in body.data, false);
  assert.equal('apiKey' in body.data, false);
  assert.equal('webdav_password' in body.data, false);

  assert.equal(env.NAV_DB.calls.length, 1, 'GET 应只查询一次 settings');
  assert.match(env.NAV_DB.calls[0].sql, /json_each/);
  assert.equal(env.NAV_DB.calls[0].params.length, 1, '白名单应作为单个 JSON 参数绑定');
  assert.ok(Array.isArray(JSON.parse(env.NAV_DB.calls[0].params[0])));
});

test('GET /api/settings whitelist query still uses the settings primary key index', { skip: skipReason }, async () => {
  const env = {
    NAV_AUTH: createKv({ session_token: '1' }),
    NAV_DB: createRealDb(),
  };

  await onRequestGet({ request: createAdminRequest(), env });

  const { sql, params } = env.NAV_DB.calls[0];
  const plan = env.NAV_DB.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
  const detail = plan.map(row => row.detail).join('\n');

  // 白名单下推的意义之一就是不退化成全表扫描；这一条守住注释里的性能前提
  assert.match(detail, /SEARCH settings USING (?:COVERING )?INDEX/);
});
