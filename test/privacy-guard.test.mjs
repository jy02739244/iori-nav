import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildPrivateDescendantStatements } from '../functions/lib/privacy-guard.js';

let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  // 与其它真实 SQLite 用例一致，旧 Node 版本跳过。
}
const options = { skip: DatabaseSync ? false : 'node:sqlite 不可用' };

/**
 * 用真实 SQLite 执行递归 CTE。
 *
 * 其它分类用例（api-categories-id.test.mjs）用的是按 SQL 文本分派的假数据库，
 * 改成 UNION / 改错连接条件都不会失败；这里必须真跑，才能验证子树传播与环终止。
 */
function createDb(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

  const executed = [];
  const db = {
    prepare(sql) {
      const build = (params = []) => ({
        sql,
        bind: (...values) => build(values),
        async run() {
          executed.push(sql);
          const result = sqlite.prepare(sql).run(...params);
          return { success: true, meta: { changes: Number(result.changes) } };
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
    // 模拟 D1 的 batch：整批语句在同一个事务里顺序执行，任一条失败则全部回滚。
    // 导入路径（api/config/import.js）正是靠这个边界把多个分类的语句攒成一批。
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) {
          await statement.run();
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return statements.map(() => ({ success: true }));
    },
  };

  return { sqlite, db, executed };
}

function seed(sqlite, categories, sites) {
  const insertCategory = sqlite.prepare('INSERT INTO category (id, catelog, parent_id, is_private) VALUES (?, ?, ?, ?)');
  for (const category of categories) {
    insertCategory.run(category.id, category.catelog, category.parent_id, category.is_private ?? 0);
  }

  const insertSite = sqlite.prepare('INSERT INTO sites (name, url, catelog_id, is_private) VALUES (?, ?, ?, ?)');
  for (const site of sites) {
    insertSite.run(site.name, site.url, site.catelog_id, site.is_private ?? 0);
  }
}

async function applyPrivateSubtree(db, categoryId) {
  for (const statement of buildPrivateDescendantStatements(db, categoryId)) {
    await statement.run();
  }
}

function readFlags(sqlite) {
  const categories = sqlite.prepare('SELECT id, is_private FROM category ORDER BY id').all();
  const sites = sqlite.prepare('SELECT id, is_private FROM sites ORDER BY id').all();
  return {
    categories: categories.map(row => [row.id, row.is_private]),
    sites: sites.map(row => [row.id, row.is_private]),
  };
}

test('递归 CTE 使用 UNION 而不是 UNION ALL', options, t => {
  // 回归守卫：UNION ALL 遇到 parent_id 环会无限展开，直到撞上 D1 执行限制。
  const { db } = createDb(t);
  const statements = buildPrivateDescendantStatements(db, 1);
  assert.equal(statements.length, 2);
  for (const statement of statements) {
    // 用正则在关键字层面判断：SQL 里 UNION 与小写/换行都有可能出现，
    // 大小写敏感的 includes 会把 `union all` 漏过去，回归照样变绿。
    assert.doesNotMatch(statement.sql, /\bUNION\s+ALL\b/i);
    assert.match(statement.sql, /\bUNION\b/i);
  }
});

test('多层子树连同其书签一起置为私密，兄弟分支不受影响', options, async t => {
  const { sqlite, db } = createDb(t);
  seed(sqlite,
    [
      { id: 1, catelog: '根', parent_id: 0 },
      { id: 2, catelog: '子', parent_id: 1 },
      { id: 3, catelog: '孙', parent_id: 2 },
      { id: 4, catelog: '曾孙', parent_id: 3 },
      { id: 5, catelog: '兄弟', parent_id: 0 },
      { id: 6, catelog: '兄弟的子', parent_id: 5 },
    ],
    [
      { name: '根站', url: 'https://a.example', catelog_id: 1 },
      { name: '子站', url: 'https://b.example', catelog_id: 2 },
      { name: '孙站', url: 'https://c.example', catelog_id: 3 },
      { name: '曾孙站', url: 'https://d.example', catelog_id: 4 },
      { name: '兄弟站', url: 'https://e.example', catelog_id: 5 },
      { name: '兄弟子站', url: 'https://f.example', catelog_id: 6 },
    ]);

  await applyPrivateSubtree(db, 1);

  assert.deepEqual(readFlags(sqlite), {
    categories: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 0], [6, 0]],
    sites: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 0], [6, 0]],
  });
});

test('从中间层触发时只覆盖该层以下', options, async t => {
  const { sqlite, db } = createDb(t);
  seed(sqlite,
    [
      { id: 1, catelog: '根', parent_id: 0 },
      { id: 2, catelog: '子', parent_id: 1 },
      { id: 3, catelog: '孙', parent_id: 2 },
    ],
    [
      { name: '根站', url: 'https://a.example', catelog_id: 1 },
      { name: '子站', url: 'https://b.example', catelog_id: 2 },
      { name: '孙站', url: 'https://c.example', catelog_id: 3 },
    ]);

  await applyPrivateSubtree(db, 2);

  assert.deepEqual(readFlags(sqlite), {
    categories: [[1, 0], [2, 1], [3, 1]],
    sites: [[1, 0], [2, 1], [3, 1]],
  });
});

test('parent_id 成环时递归终止，不会无限展开', options, async t => {
  const { sqlite, db } = createDb(t);
  // 直接写库构造一个环，模拟绕过 API 里 20 层上限检测的历史脏数据。
  seed(sqlite,
    [
      { id: 1, catelog: '环 A', parent_id: 2 },
      { id: 2, catelog: '环 B', parent_id: 1 },
      { id: 3, catelog: '正常分类', parent_id: 0 },
    ],
    [
      { name: 'A 站', url: 'https://a.example', catelog_id: 1 },
      { name: 'B 站', url: 'https://b.example', catelog_id: 2 },
      { name: '正常站', url: 'https://c.example', catelog_id: 3 },
    ]);

  await applyPrivateSubtree(db, 1);

  assert.deepEqual(readFlags(sqlite), {
    // 环上两个节点各被访问一次后去重终止；环外的分类不受牵连。
    categories: [[1, 1], [2, 1], [3, 0]],
    sites: [[1, 1], [2, 1], [3, 0]],
  });
});

test('导入路径：多个分类的语句与其它导入语句攒进同一个 batch 后一次生效', options, async t => {
  // api/config/import.js 跨多个分类攒批：两个分类的 2 条语句会和其它导入语句
  // 混在同一批里提交。这里验证混合批次的执行结果，防止批处理边界回归悄悄漏掉
  // 某个分类的子树或书签。
  const { sqlite, db } = createDb(t);
  seed(sqlite,
    [
      { id: 1, catelog: '导入根', parent_id: 0 },
      { id: 2, catelog: '导入子', parent_id: 1 },
      { id: 3, catelog: '导入孙', parent_id: 2 },
      { id: 5, catelog: '另一个根', parent_id: 0 },
      { id: 6, catelog: '另一个子', parent_id: 5 },
      { id: 7, catelog: '另一个孙', parent_id: 6 },
      { id: 8, catelog: '无关分类', parent_id: 0 },
    ],
    [
      { name: '导入根站', url: 'https://a.example', catelog_id: 1 },
      { name: '导入子站', url: 'https://b.example', catelog_id: 2 },
      { name: '导入孙站', url: 'https://c.example', catelog_id: 3 },
      { name: '另一个根站', url: 'https://d.example', catelog_id: 5 },
      { name: '另一个子站', url: 'https://e.example', catelog_id: 6 },
      { name: '另一个孙站', url: 'https://f.example', catelog_id: 7 },
      { name: '无关站', url: 'https://g.example', catelog_id: 8 },
    ]);

  const statements = [
    ...buildPrivateDescendantStatements(db, 1),
    // 与导入时的普通语句混排（例如预存在分类改名），验证插入位置不影响结果
    db.prepare('UPDATE category SET catelog = ? WHERE id = ?').bind('改名后的根', 5),
    ...buildPrivateDescendantStatements(db, 5),
  ];
  await db.batch(statements);

  assert.deepEqual(readFlags(sqlite), {
    categories: [[1, 1], [2, 1], [3, 1], [5, 1], [6, 1], [7, 1], [8, 0]],
    sites: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 0]],
  });
  // 同一批里的其它语句照常生效
  assert.equal(sqlite.prepare('SELECT catelog FROM category WHERE id = 5').get().catelog, '改名后的根');
});

test('batch 中任一条语句失败时整批回滚，不留下半私密状态', options, async t => {
  const { sqlite, db } = createDb(t);
  seed(sqlite,
    [
      { id: 1, catelog: '根', parent_id: 0 },
      { id: 2, catelog: '子', parent_id: 1 },
    ],
    [
      { name: '根站', url: 'https://a.example', catelog_id: 1 },
      { name: '子站', url: 'https://b.example', catelog_id: 2 },
    ]);

  const failing = db.prepare('INSERT INTO category (id, catelog, parent_id) VALUES (?, ?, ?)').bind(1, '重复 id', 0);
  await assert.rejects(() => db.batch([...buildPrivateDescendantStatements(db, 1), failing]));

  assert.deepEqual(readFlags(sqlite), {
    categories: [[1, 0], [2, 0]],
    sites: [[1, 0], [2, 0]],
  });
});
