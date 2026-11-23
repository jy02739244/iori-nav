// functions/lib/privacy-guard.js
// 把某个分类的整棵子树（含自身）标记为私密：分类与其下书签同步置位。
// 分类改私密（api/categories/[id].js）与导入（api/config/import.js）共用这一份构造逻辑。

// 递归 CTE 用 UNION（去重）而不是 UNION ALL：正常数据下两者结果完全相同，
// 但 category.parent_id 没有任何约束保证无环。一旦数据里真的出现环，
// UNION ALL 会沿着环无限展开，直到查询撞上 D1 的执行限制并报错；
// UNION 先去重，环上节点只会被访问一次并正常终止。
// 同一份 CTE 在 schema-migration 的修复语句里也是 UNION，这里保持一致。
const buildDescendantsCte = () => `
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM category WHERE id = ?
      UNION
      SELECT c.id FROM category c
      INNER JOIN descendants d ON c.parent_id = d.id
    )
  `;

/**
 * 构造「把 categoryId 及其所有后代分类置为私密」的两条 D1 语句。
 *
 * 只负责构造语句，不负责 batch：两个调用点的批处理边界不同——
 * categories/[id] 把它和分类更新放在同一批，import 则跨多个分类攒批后一次提交。
 * 把 batch 也抽进来会改掉事务边界。
 *
 * @param {D1Database} db
 * @param {number|string} categoryId
 * @returns {D1PreparedStatement[]}
 */
export function buildPrivateDescendantStatements(db, categoryId) {
  const descendantsCte = buildDescendantsCte();

  return [
    db.prepare(`
      ${descendantsCte}
      UPDATE category
      SET is_private = 1
      WHERE id IN (SELECT id FROM descendants)
    `).bind(categoryId),
    db.prepare(`
      ${descendantsCte}
      UPDATE sites
      SET is_private = 1
      WHERE catelog_id IN (SELECT id FROM descendants)
    `).bind(categoryId),
  ];
}