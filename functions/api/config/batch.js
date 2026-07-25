import { isAdminAuthenticated, errorResponse, jsonResponse, markHomeCacheDirty } from '../../_middleware';

export async function onRequestPost(context) {
  const { request, env } = context;
  const REORDER_CHUNK_SIZE = 100;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { action, ids, payload } = await request.json();

    const requiresIds = action !== 'reorder';

    if (requiresIds && (!ids || !Array.isArray(ids) || ids.length === 0)) {
      return errorResponse('未提供 ID', 400);
    }

    // Cloudflare D1 限制单条语句变量数为 100。
    // 在更新操作中，除了 ID 列表（Chunk），还有 SET 部分的参数（如 catelog_id, catelog_name）。
    // 将分块大小设为 50 以确保变量总数绝对不会超过 100。
    const CHUNK_SIZE = 50;
    const chunks = [];
    if (requiresIds) {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + CHUNK_SIZE));
      }
    }

    const statements = [];

    if (action === 'delete') {
      chunks.forEach(chunk => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`DELETE FROM sites WHERE id IN (${placeholders})`).bind(...chunk)
        );
      });

      await env.NAV_DB.batch(statements);
      await markHomeCacheDirty(env, 'all');
      
      return jsonResponse({
        code: 200,
        message: `成功删除 ${ids.length} 条项目`
      });

    } else if (action === 'update_category') {
      const { categoryId } = payload;
      if (!categoryId) {
        return errorResponse('分类 ID 是必填项', 400);
      }

      const category = await env.NAV_DB.prepare('SELECT catelog, is_private FROM category WHERE id = ?').bind(categoryId).first();
      if (!category) {
        return errorResponse('找不到分类', 404);
      }

      let baseSql = `UPDATE sites SET catelog_id = ?, catelog_name = ?`;
      const baseParams = [categoryId, category.catelog];

      if (category.is_private === 1) {
          baseSql += `, is_private = 1`;
      }

      chunks.forEach(chunk => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`${baseSql} WHERE id IN (${placeholders})`).bind(...baseParams, ...chunk)
        );
      });

      await env.NAV_DB.batch(statements);
      await markHomeCacheDirty(env, 'all');

      return jsonResponse({
        code: 200,
        message: `成功更新 ${ids.length} 条项目的分类`
      });

    } else if (action === 'update_privacy') {
      const { isPrivate } = payload;
      if (isPrivate === undefined) {
        return errorResponse('隐私状态是必填项', 400);
      }
      
      const isPrivateValue = isPrivate ? 1 : 0;
      
      chunks.forEach(chunk => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`UPDATE sites SET is_private = ? WHERE id IN (${placeholders})`).bind(isPrivateValue, ...chunk)
        );
      });

      await env.NAV_DB.batch(statements);
      await markHomeCacheDirty(env, 'all');

      return jsonResponse({
        code: 200,
        message: `成功更新 ${ids.length} 条项目的隐私属性`
      });
    } else if (action === 'reorder') {
      const items = payload?.items;

      if (!Array.isArray(items) || items.length === 0) {
        return errorResponse('排序数据不能为空', 400);
      }

      const reorderStatements = [];

      for (const item of items) {
        const id = Number(item.id);
        const sortOrder = Number(item.sort_order);

        if (!Number.isFinite(id) || !Number.isFinite(sortOrder)) {
          return errorResponse('排序数据格式无效', 400);
        }

        reorderStatements.push(
          env.NAV_DB.prepare('UPDATE sites SET sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(sortOrder, id)
        );
      }

      for (let i = 0; i < reorderStatements.length; i += REORDER_CHUNK_SIZE) {
        await env.NAV_DB.batch(reorderStatements.slice(i, i + REORDER_CHUNK_SIZE));
      }

      await markHomeCacheDirty(env, 'all');

      return jsonResponse({
        code: 200,
        message: `成功更新 ${items.length} 条项目的排序`
      });
    } else {
      return errorResponse('无效的操作', 400);
    }

  } catch (e) {
    return errorResponse(`批量操作失败: ${e.message}`, 500);
  }
}
