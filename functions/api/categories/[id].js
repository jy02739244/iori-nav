// functions/api/categories/[id].js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder, markHomeCacheDirty } from '../../_middleware';
import { normalizeCategoryName } from '../../lib/validators';
import { buildPrivateDescendantStatements } from '../../lib/privacy-guard';
import { CATEGORY_CYCLE_GUARD_ERROR } from '../../lib/schema-migration';

// 新的父节点如果本身就是自己的后代，挂上去就会成环。
//
// 一条递归 CTE 走完整条祖先链：起点是拟用的 parentId，问它的祖先里有没有自己。
// 不再用「最多向上查 N 层」的预算式检测——预算耗尽既不能证明无环，也不该当作
// 无环放行（旧实现正是这样让第 21 层以外的环漏过去的）。
// UNION（不是 UNION ALL）保证即使库里已有环数据，这条判定自身也能终止。
// 单父节点链若既没有根也没有断开的引用，说明父分类本身已在环中。
const ANCESTOR_HIT_SQL = `
  WITH RECURSIVE ancestors(id) AS (
    SELECT id FROM category WHERE id = ?
    UNION
    SELECT c.parent_id FROM category c
    INNER JOIN ancestors a ON c.id = a.id
    WHERE c.parent_id IS NOT NULL AND c.parent_id != 0
  )
  SELECT 1 AS hit FROM ancestors
  WHERE id = ?
    OR NOT EXISTS (
      SELECT 1 FROM ancestors a
      LEFT JOIN category c ON c.id = a.id
      WHERE c.id IS NULL OR c.parent_id IS NULL OR c.parent_id = 0
    )
  LIMIT 1
`;

async function wouldCreateCycle(db, categoryId, parentId) {
  const targetId = Number.isFinite(Number(categoryId)) ? Number(categoryId) : categoryId;
  const hit = await db.prepare(ANCESTOR_HIT_SQL).bind(parentId, targetId).first();
  return Boolean(hit);
}

// D1 把触发器 RAISE(ABORT, 'category_cycle_guard') 的消息包装成
// `D1_ERROR: category_cycle_guard: SQLITE_CONSTRAINT`（批量执行时前面还可能带语句/偏移前缀）。
// 这里只认这个形状：标识符左侧是消息开头或 `: ` 边界，右侧紧跟 `:` / 空白 / 结束。
// 用裸 includes 的话，任何恰好出现该字面量、但实际是别的原因的错误（迁移 SQL 文本、
// 其它约束消息）都会被降级成 400，把真正的 500 级故障藏起来。
const CYCLE_GUARD_ERROR_PATTERN = new RegExp(
  `(?:^|:\\s*)${CATEGORY_CYCLE_GUARD_ERROR}(?=:|\\s|$)`
);

function isCycleGuardError(error) {
  return CYCLE_GUARD_ERROR_PATTERN.test(String(error?.message || '').trim());
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const categoryId = decodeURIComponent(params.id);
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    
    if (!categoryId) {
      return errorResponse('Category id is required', 400);
    }

    if (body && body.reset) {
      // 1. Check for sub-categories
      const hasChildren = await env.NAV_DB.prepare('SELECT id FROM category WHERE parent_id = ? LIMIT 1')
        .bind(categoryId)
        .first();
        
      if (hasChildren) {
        return errorResponse('无法删除：该分类包含子分类，请先删除或移动子分类', 400);
      }

      // 2. Check for associated sites (bookmarks)
      const hasSites = await env.NAV_DB.prepare('SELECT id FROM sites WHERE catelog_id = ? LIMIT 1')
        .bind(categoryId)
        .first();
        
      if (hasSites) {
        return errorResponse('无法删除：该分类包含书签，请先删除或移动书签', 400);
      }

      await env.NAV_DB.prepare('DELETE FROM category WHERE id = ?')
        .bind(categoryId)
        .run();

      await markHomeCacheDirty(env, 'all');
      
      return jsonResponse({
        code: 200,
        message: 'Category deleted successfully'
      });
    }

    const categoryNameResult = normalizeCategoryName(body.catelog);
    let { sort_order } = body;

    if (!categoryNameResult.ok) {
      return errorResponse(categoryNameResult.message, 400);
    }
    const catelog = categoryNameResult.value;

    const parentId = body.parent_id !== undefined ? parseInt(body.parent_id, 10) : 0;

    // 检查 parent_id 不能指向自身
    if (parentId !== 0 && String(parentId) === String(categoryId)) {
      return errorResponse('分类不能设为自身的子分类', 400);
    }

    // 检查 parent_id 存在性及循环引用
    let parentCategory = null;
    if (parentId !== 0) {
      parentCategory = await env.NAV_DB.prepare('SELECT id, is_private FROM category WHERE id = ?').bind(parentId).first();
      if (!parentCategory) {
        return errorResponse('父分类不存在', 400);
      }
      // 检查新的父节点是否在自己的子树里（是则成环）
      if (await wouldCreateCycle(env.NAV_DB, categoryId, parentId)) {
        return errorResponse('不允许创建循环引用的分类层级', 400);
      }
    }

    // 检查在同一个父分类下，分类名称是否已存在（排除自身）
    const existingCategory = await env.NAV_DB.prepare('SELECT id FROM category WHERE catelog = ? AND parent_id = ? AND id != ?')
      .bind(catelog, parentId, categoryId)
      .first();

    if (existingCategory) {
      return errorResponse('该分类名称在当前父分类下已存在', 409);
    }

    sort_order = normalizeSortOrder(sort_order);
    const isPrivate = parentCategory?.is_private === 1 ? 1 : (body.is_private ? 1 : 0);

    const batchStmts = [
      env.NAV_DB.prepare('UPDATE category SET catelog = ?, sort_order = ?, parent_id = ?, is_private = ? WHERE id = ?')
        .bind(catelog, sort_order, parentId, isPrivate, categoryId),
      env.NAV_DB.prepare('UPDATE sites SET catelog_name = ? WHERE catelog_id = ?')
        .bind(catelog, categoryId),
    ];

    // A private category makes the whole subtree private so public navigation cannot expose descendants.
    if (isPrivate === 1) {
      batchStmts.push(...buildPrivateDescendantStatements(env.NAV_DB, categoryId));
    }

    await env.NAV_DB.batch(batchStmts);

    await markHomeCacheDirty(env, 'all');

    return jsonResponse({
      code: 200,
      message: 'Category updated successfully'
    });
   
  } catch (e) {
    // 上面的 CTE 已先拦一次；能走到这里说明并发窗口里被数据库触发器兜住了。
    // 触发器只会抛 'category_cycle_guard'，转成用户能看懂的 400，而不是 500。
    if (isCycleGuardError(e)) {
      return errorResponse('不允许创建循环引用的分类层级', 400);
    }
    // 非环守卫错误保留原始信息：既回给调用方，也留一条服务端日志。
    console.error('Failed to process category request:', e);
    return errorResponse(`Failed to process category request: ${e.message}`, 500);
  }
}
