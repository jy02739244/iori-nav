import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CATEGORY_CYCLE_GUARD_ERROR,
  CATEGORY_CYCLE_GUARD_TRIGGER_STATEMENTS,
} from '../functions/lib/schema-migration.js';
import { onRequestPut } from '../functions/api/categories/[id].js';
import { onRequestPost as onRequestReorder } from '../functions/api/categories/reorder.js';

let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  // 与其它真实 SQLite 用例一致，旧 Node 版本跳过。
}
const options = { skip: DatabaseSync ? false : 'node:sqlite 不可用' };

const LEGACY_BASE_SCHEMA = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

/**
 * 真实 SQLite + D1 形状的适配器。
 * 单测都必须真跑 SQL：分类相关的另一个用例（api-categories-id.test.mjs）用的是
 * 按 SQL 文本分派的假库，既测不出递归 CTE 的终止性，也测不出触发器。
 */
function createDatabase(t, { withTrigger = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(LEGACY_BASE_SCHEMA);
  // markHomeCacheDirty 会写 settings 表里的 generation 键
  sqlite.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  // 只有需要构造「历史脏数据」的用例才先不装触发器
  if (withTrigger) {
    for (const sql of CATEGORY_CYCLE_GUARD_TRIGGER_STATEMENTS) sqlite.exec(sql);
  }

  const db = {
    prepare(sql) {
      const build = (params = []) => ({
        sql,
        bind: (...values) => build(values),
        async run() {
          const result = sqlite.prepare(sql).run(...params);
          return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...params) };
        },
        async first() {
          return sqlite.prepare(sql).get(...params) ?? null;
        },
      });
      return build();
    },
    // D1 的 batch 是单个事务：任一条失败整批回滚。适配器必须复现这个语义，
    // 否则某个语句中途失败时，测试会看到「前几条已生效」的假状态。
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return { sqlite, db };
}

function applyTriggers(sqlite) {
  for (const sql of CATEGORY_CYCLE_GUARD_TRIGGER_STATEMENTS) sqlite.exec(sql);
}

function seedChain(sqlite, depth) {
  const insert = sqlite.prepare('INSERT INTO category (catelog, parent_id, sort_order) VALUES (?, ?, ?)');
  const ids = [];
  let parentId = 0;
  for (let i = 1; i <= depth; i++) {
    const result = insert.run(`层级-${i}`, parentId, i);
    parentId = Number(result.lastInsertRowid);
    ids.push(parentId);
  }
  return ids;
}

function createKv() {
  const store = new Map([['session_token', '1']]);
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

function buildPutRequest(categoryId, body) {
  return new Request(`https://example.com/api/categories/${categoryId}`, {
    method: 'PUT',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('触发器拒绝把分类挂到自己的后代下', options, t => {
  const { sqlite } = createDatabase(t);
  const [first, , , , fifth, , , , , , , , , , , , , , , , deepest] = seedChain(sqlite, 21);

  assert.throws(
    () => sqlite.prepare('UPDATE category SET parent_id = ? WHERE id = ?').run(deepest, first),
    error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
  );

  // 拒绝后数据未被改动
  const row = sqlite.prepare('SELECT parent_id FROM category WHERE id = ?').get(first);
  assert.equal(row.parent_id, 0);

  // 合法的下移仍然允许
  sqlite.prepare('UPDATE category SET parent_id = ? WHERE id = ?').run(fifth, deepest);
  assert.equal(sqlite.prepare('SELECT parent_id FROM category WHERE id = ?').get(deepest).parent_id, fifth);
});

test('触发器拒绝自指', options, t => {
  const { sqlite } = createDatabase(t);
  const [first] = seedChain(sqlite, 3);

  assert.throws(
    () => sqlite.prepare('UPDATE category SET parent_id = ? WHERE id = ?').run(first, first),
    error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
  );
});

test('已存在的环仍可通过移回根节点修复', options, t => {
  // 先不装触发器构造历史脏数据，再补上触发器——模拟「旧数据有问题、新守卫已上线」的状态
  const { sqlite } = createDatabase(t, { withTrigger: false });

  sqlite.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').run(1, 'A', 2);
  sqlite.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').run(2, 'B', 1);
  applyTriggers(sqlite);

  // 环上任何「改 parent_id 但仍在环内」的写入都会被拒
  assert.throws(
    () => sqlite.prepare('UPDATE category SET parent_id = ? WHERE id = ?').run(2, 1),
    error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
  );

  // 修复动作是把节点拎回根：NEW.parent_id = 0 不触发守卫
  sqlite.prepare('UPDATE category SET parent_id = 0 WHERE id = ?').run(1);
  assert.equal(sqlite.prepare('SELECT parent_id FROM category WHERE id = ?').get(1).parent_id, 0);
});

test('API 拒绝将正常子树挂到已有环及其下游分类', options, async t => {
  // 不装触发器，确保 API 自身拦截，而不是依赖数据库报错。
  const { sqlite, db } = createDatabase(t, { withTrigger: false });
  sqlite.exec(`INSERT INTO category (id, catelog, parent_id) VALUES
    (1, '环 A', 2), (2, '环 B', 1), (3, '环的下游', 1),
    (4, '正常根', 0), (5, '正常子', 4)`);
  const before = sqlite.prepare('SELECT * FROM category ORDER BY id').all();

  for (const parentId of [1, 3]) {
    const response = await onRequestPut({
      request: buildPutRequest(4, { catelog: '正常根', parent_id: parentId, sort_order: 1, is_private: true }),
      env: { NAV_DB: db, NAV_AUTH: createKv() },
      params: { id: '4' },
    });

    assert.equal(response.status, 400, JSON.stringify(await response.json()));
    assert.deepEqual(sqlite.prepare('SELECT * FROM category ORDER BY id').all(), before);
  }
});

test('触发器拒绝向已有环及其下游移动或显式插入分类', options, t => {
  const { sqlite } = createDatabase(t, { withTrigger: false });
  sqlite.exec(`INSERT INTO category (id, catelog, parent_id) VALUES
    (1, '环 A', 2), (2, '环 B', 1), (3, '环的下游', 1), (4, '正常根', 0)`);
  applyTriggers(sqlite);

  for (const parentId of [1, 3]) {
    assert.throws(
      () => sqlite.prepare('UPDATE category SET parent_id = ? WHERE id = 4').run(parentId),
      error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
    );
    assert.throws(
      () => sqlite.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (5, ?, ?)').run('新分类', parentId),
      error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
    );
  }
  assert.equal(sqlite.prepare('SELECT parent_id FROM category WHERE id = 4').get().parent_id, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM category').get().n, 4);
});

test('断开的祖先引用不会被误判为环', options, async t => {
  const { sqlite, db } = createDatabase(t);
  sqlite.exec(`INSERT INTO category (id, catelog, parent_id) VALUES
    (1, '断开引用的父分类', 99), (2, '正常根', 0)`);

  const response = await onRequestPut({
    request: buildPutRequest(2, { catelog: '正常根', parent_id: 1, sort_order: 1, is_private: false }),
    env: { NAV_DB: db, NAV_AUTH: createKv() },
    params: { id: '2' },
  });

  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(sqlite.prepare('SELECT parent_id FROM category WHERE id = 2').get().parent_id, 1);
});

test('历史环分类的普通排序仍返回 200，且不改变父子关系', options, async t => {
  const { sqlite, db } = createDatabase(t, { withTrigger: false });
  const ids = seedChain(sqlite, 21);
  const root = ids[0];
  const deepest = ids[ids.length - 1];
  sqlite.prepare('UPDATE category SET parent_id = ? WHERE id = ?').run(deepest, root);
  const beforeParents = sqlite.prepare('SELECT id, parent_id FROM category ORDER BY id').all();
  applyTriggers(sqlite);

  const request = new Request('https://example.com/api/categories/reorder', {
    method: 'POST',
    headers: { Cookie: 'admin_session=token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: root, sort_order: 42 }, { id: deepest, sort_order: 24 }] }),
  });
  const response = await onRequestReorder({ request, env: { NAV_DB: db, NAV_AUTH: createKv() } });

  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(sqlite.prepare('SELECT sort_order FROM category WHERE id = ?').get(root).sort_order, 42);
  assert.equal(sqlite.prepare('SELECT sort_order FROM category WHERE id = ?').get(deepest).sort_order, 24);
  assert.deepEqual(sqlite.prepare('SELECT id, parent_id FROM category ORDER BY id').all(), beforeParents);
});

test('显式 id 的 INSERT 也写不出自环', options, t => {
  const { sqlite } = createDatabase(t);
  const insert = sqlite.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (?, ?, ?)');

  assert.throws(
    () => insert.run(7, '自环', 7),
    error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
  );

  // 自动分配 id 的正常插入不受影响（BEFORE INSERT 里 NEW.id 是哨兵值 -1，被 WHEN 排除）
  insert.run(8, '正常根', 0);
  insert.run(9, '正常子', 8);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM category').get().n, 2);
});

test('INSERT OR REPLACE 重排父子关系同样造不出环', options, t => {
  const { sqlite } = createDatabase(t);
  sqlite.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').run(1, 'A', 0);
  sqlite.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').run(2, 'B', 1);

  // REPLACE 会先删后插，等价于把 A 挂到自己的子节点 B 下面
  assert.throws(
    () => sqlite.prepare('INSERT OR REPLACE INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').run(1, 'A2', 2),
    error => String(error.message).includes(CATEGORY_CYCLE_GUARD_ERROR),
  );

  // 合法的 REPLACE（改回根）仍然允许
  sqlite.prepare('INSERT OR REPLACE INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').run(1, 'A3', 0);
  assert.equal(sqlite.prepare('SELECT parent_id FROM category WHERE id = 1').get().parent_id, 0);
});

test('21 层链上成环的 PUT 返回 400 而不是挂死或 500', options, async t => {
  const { sqlite, db } = createDatabase(t);
  const ids = seedChain(sqlite, 21);
  const root = ids[0];
  const deepest = ids[ids.length - 1];

  const started = Date.now();
  const response = await onRequestPut({
    request: buildPutRequest(root, {
      catelog: '层级-1',
      sort_order: 1,
      parent_id: deepest,
      is_private: true,
    }),
    env: { NAV_DB: db, NAV_AUTH: createKv() },
    params: { id: String(root) },
  });
  const body = await response.json();

  assert.equal(response.status, 400, JSON.stringify(body));
  assert.match(body.message, /循环引用/);
  assert.ok(Date.now() - started < 5000, '应当立即拒绝，不应依赖任何遍历预算');

  // 被拒之后什么都没写：parent_id 与 is_private 都保持原样
  const row = sqlite.prepare('SELECT parent_id, is_private FROM category WHERE id = ?').get(root);
  assert.deepEqual({ ...row }, { parent_id: 0, is_private: 0 });
});

test('合法移动与未变的 parent_id 都能保存成功', options, async t => {
  const { sqlite, db } = createDatabase(t);
  const ids = seedChain(sqlite, 4);
  const [, second, , fourth] = ids;

  // 把自己挂到父节点下：新 parent 不是自己的后代，属于合法操作
  const move = await onRequestPut({
    request: buildPutRequest(fourth, { catelog: '层级-4', sort_order: 4, parent_id: second, is_private: false }),
    env: { NAV_DB: db, NAV_AUTH: createKv() },
    params: { id: String(fourth) },
  });
  assert.equal(move.status, 200, JSON.stringify(await move.json()));

  // 同值重放（PUT 带上没有变化的 parent_id）不应被守卫误伤
  const same = await onRequestPut({
    request: buildPutRequest(fourth, { catelog: '层级-4', sort_order: 5, parent_id: second, is_private: false }),
    env: { NAV_DB: db, NAV_AUTH: createKv() },
    params: { id: String(fourth) },
  });
  assert.equal(same.status, 200, JSON.stringify(await same.json()));

  const row = sqlite.prepare('SELECT parent_id, sort_order FROM category WHERE id = ?').get(fourth);
  assert.deepEqual({ ...row }, { parent_id: second, sort_order: 5 });
});

test('带着后代子树的分类移到合法父节点下仍然允许', options, async t => {
  const { sqlite, db } = createDatabase(t);
  const [root, second, third] = seedChain(sqlite, 3);

  // 另建一个独立根作为合法的新父节点
  const otherRoot = Number(
    sqlite.prepare('INSERT INTO category (catelog, parent_id, sort_order) VALUES (?, 0, ?)').run('另一个根', 1).lastInsertRowid,
  );

  // second 下面还挂着 third：移动的是一整棵子树，触发器必须判成无环，不能误伤正常操作
  const move = await onRequestPut({
    request: buildPutRequest(second, { catelog: '层级-2', sort_order: 2, parent_id: otherRoot, is_private: false }),
    env: { NAV_DB: db, NAV_AUTH: createKv() },
    params: { id: String(second) },
  });
  assert.equal(move.status, 200, JSON.stringify(await move.json()));

  const parentOf = id => sqlite.prepare('SELECT parent_id FROM category WHERE id = ?').get(id).parent_id;
  assert.equal(parentOf(second), otherRoot);
  // 子树关系没有被拆散：孙节点仍挂在被移动的节点下面，原来的父节点也不再是它的父节点
  assert.equal(parentOf(third), second);
  assert.equal(parentOf(root), 0);
});
