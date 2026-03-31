// functions/api/categories/[id].js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder, markHomeCacheDirty } from '../../_middleware';

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

    const { catelog } = body;
    let { sort_order } = body;

    if (!catelog) {
      return errorResponse('Category name is required', 400);
    }

    const parentId = body.parent_id !== undefined ? parseInt(body.parent_id, 10) : 0;

    // 检查 parent_id 不能指向自身
    if (parentId !== 0 && String(parentId) === String(categoryId)) {
      return errorResponse('分类不能设为自身的子分类', 400);
    }

    // 检查 parent_id 存在性及循环引用
    if (parentId !== 0) {
      const parentExists = await env.NAV_DB.prepare('SELECT id FROM category WHERE id = ?').bind(parentId).first();
      if (!parentExists) {
        return errorResponse('父分类不存在', 400);
      }
      // 沿 parent 链向上查找，检测循环（限制最大深度防止异常数据）
      let currentParent = parentId;
      const visited = new Set([parseInt(categoryId, 10)]);
      let depth = 0;
      while (currentParent !== 0 && depth++ < 20) {
        if (visited.has(currentParent)) {
          return errorResponse('不允许创建循环引用的分类层级', 400);
        }
        visited.add(currentParent);
        const row = await env.NAV_DB.prepare('SELECT parent_id FROM category WHERE id = ?').bind(currentParent).first();
        if (!row) break;
        currentParent = row.parent_id || 0;
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
    const isPrivate = body.is_private ? 1 : 0;

    const batchStmts = [
      env.NAV_DB.prepare('UPDATE category SET catelog = ?, sort_order = ?, parent_id = ?, is_private = ? WHERE id = ?')
        .bind(catelog, sort_order, parentId, isPrivate, categoryId),
      env.NAV_DB.prepare('UPDATE sites SET catelog_name = ? WHERE catelog_id = ?')
        .bind(catelog, categoryId),
    ];

    // If category is set to private, force all sites in this category to be private
    if (isPrivate === 1) {
      batchStmts.push(
        env.NAV_DB.prepare('UPDATE sites SET is_private = 1 WHERE catelog_id = ?')
          .bind(categoryId)
      );
    }

    await env.NAV_DB.batch(batchStmts);

    await markHomeCacheDirty(env, 'all');

    return jsonResponse({
      code: 200,
      message: 'Category updated successfully'
    });
   
  } catch (e) {
    return errorResponse(`Failed to process category request: ${e.message}`, 500);
  }
}
