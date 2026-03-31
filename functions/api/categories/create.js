// functions/api/categories/create.js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder, markHomeCacheDirty } from '../../_middleware';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const categoryName = (body.catelog || '').trim();
    
    if (!categoryName) {
      return errorResponse('分类名称不能为空', 400);
    }

    const parentId = body.parent_id ? parseInt(body.parent_id, 10) : 0;

    // 检查父分类存在性
    if (parentId !== 0) {
      const parentExists = await env.NAV_DB.prepare('SELECT id FROM category WHERE id = ?').bind(parentId).first();
      if (!parentExists) {
        return errorResponse('父分类不存在', 400);
      }
    }

    // 检查在同一个父分类下，分类名称是否已存在
    const existing = await env.NAV_DB.prepare(
      'SELECT catelog FROM category WHERE catelog = ? AND parent_id = ?'
    ).bind(categoryName, parentId).first();

    if (existing) {
      return errorResponse('该分类名称在当前父分类下已存在', 400);
    }

    // 获取排序值,如果未提供则使用 9999
    const sortOrderValue = normalizeSortOrder(body.sort_order);
    const isPrivate = body.is_private ? 1 : 0;

    // 插入新分类
    await env.NAV_DB.prepare(`
      INSERT INTO category (catelog, sort_order, parent_id, is_private)
      VALUES (?, ?, ?, ?)
    `).bind(categoryName, sortOrderValue, parentId, isPrivate).run();

    await markHomeCacheDirty(env, isPrivate ? 'private' : 'all');

    return jsonResponse({
      code: 201,
      message: '分类创建成功',
      data: {
        catelog: categoryName,
        sort_order: sortOrderValue,
        parent_id: parentId,
        is_private: isPrivate
      }
    }, 201);
  } catch (e) {
    return errorResponse(`创建分类失败: ${e.message}`, 500);
  }
}
