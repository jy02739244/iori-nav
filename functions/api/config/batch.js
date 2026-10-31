import { isAdminAuthenticated, errorResponse, jsonResponse, markHomeCacheDirty } from '../../_middleware';

async function findPrivateCategoriesForSites(env, idChunks) {
  const privateCategories = new Map();

  for (const chunk of idChunks) {
    const placeholders = chunk.map(() => '?').join(',');
    const { results = [] } = await env.NAV_DB.prepare(`
      SELECT DISTINCT c.id, c.catelog, c.parent_id
      FROM sites s
      INNER JOIN category c ON c.id = s.catelog_id
      WHERE s.id IN (${placeholders}) AND c.is_private = 1
    `).bind(...chunk).all();

    results.forEach(category => {
      privateCategories.set(category.id, {
        name: category.catelog,
        parentId: Number(category.parent_id || 0),
      });
    });
  }

  return privateCategories;
}

async function findBlockingPrivateParents(env, privateCategories) {
  const parentIds = [...new Set(
    [...privateCategories.values()]
      .map(category => category.parentId)
      .filter(parentId => parentId && !privateCategories.has(parentId))
  )];
  const blockingParents = new Map();

  for (let i = 0; i < parentIds.length; i += 50) {
    const chunk = parentIds.slice(i, i + 50);
    const placeholders = chunk.map(() => '?').join(',');
    const { results = [] } = await env.NAV_DB.prepare(`
      SELECT id, catelog
      FROM category
      WHERE id IN (${placeholders}) AND is_private = 1
    `).bind(...chunk).all();

    results.forEach(category => {
      blockingParents.set(category.id, category.catelog);
    });
  }

  return blockingParents;
}

function groupPrivateCategoriesByDepth(privateCategories) {
  const depthCache = new Map();

  const getDepth = (id, visiting = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id);
    if (visiting.has(id)) return 0;

    const category = privateCategories.get(id);
    if (!category?.parentId || !privateCategories.has(category.parentId)) {
      depthCache.set(id, 0);
      return 0;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);
    const depth = getDepth(category.parentId, nextVisiting) + 1;
    depthCache.set(id, depth);
    return depth;
  };

  const groups = new Map();
  for (const id of privateCategories.keys()) {
    const depth = getDepth(id);
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth).push(id);
  }

  return [...groups.entries()]
    .sort(([depthA], [depthB]) => depthA - depthB)
    .map(([, ids]) => ids);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const REORDER_CHUNK_SIZE = 100;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  // reorder 之外的操作都是单次 env.NAV_DB.batch()（D1 隐式单事务），失败即全无变更，
  // 成功后就地打一次脏标记即可。reorder 分块提交属于多事务写入，改用 finally 打标：
  // KV 对同一个 key 限制每秒一次写入，同一请求内写两次可能被静默丢弃，
  // 而 finally 一次就能覆盖成功与抛错两种出口。
  let dbMayHaveChanged = false;

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
      const { isPrivate, publicizePrivateCategories } = payload;
      if (isPrivate === undefined) {
        return errorResponse('隐私状态是必填项', 400);
      }
      
      const isPrivateValue = isPrivate ? 1 : 0;

      if (isPrivateValue === 0) {
        const privateCategories = await findPrivateCategoriesForSites(env, chunks);
        if (privateCategories.size > 0) {
          if (publicizePrivateCategories !== true) {
            const names = [...privateCategories.entries()]
              .map(([id, category]) => category.name || `分类 #${id}`);
            const shownNames = names.slice(0, 5).join('、');
            const suffix = names.length > 5 ? ` 等 ${names.length} 个分类` : '';
            return errorResponse(
              `以下私密分类中的书签不能直接设为公开：${shownNames}${suffix}。请确认同时公开这些分类。`,
              409
            );
          }

          const blockingParents = await findBlockingPrivateParents(env, privateCategories);
          if (blockingParents.size > 0) {
            const names = [...blockingParents.entries()]
              .map(([id, name]) => name || `分类 #${id}`);
            const shownNames = names.slice(0, 5).join('、');
            const suffix = names.length > 5 ? ` 等 ${names.length} 个分类` : '';
            return errorResponse(
              `以下私密上级分类未被选中，无法在本次操作中公开：${shownNames}${suffix}。请先公开其上级分类。`,
              409
            );
          }

          const categoryGroups = groupPrivateCategoriesByDepth(privateCategories);
          for (const group of categoryGroups) {
            for (let i = 0; i < group.length; i += 50) {
              const chunk = group.slice(i, i + 50);
              const placeholders = chunk.map(() => '?').join(',');
              statements.push(
                env.NAV_DB.prepare(`UPDATE category SET is_private = 0 WHERE id IN (${placeholders})`)
                  .bind(...chunk)
              );
            }
          }
        }
      }
      
      chunks.forEach(chunk => {
        const placeholders = chunk.map(() => '?').join(',');
        statements.push(
          env.NAV_DB.prepare(`UPDATE sites SET is_private = ? WHERE id IN (${placeholders})`)
            .bind(isPrivateValue, ...chunk)
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

      dbMayHaveChanged = true;
      for (let i = 0; i < reorderStatements.length; i += REORDER_CHUNK_SIZE) {
        await env.NAV_DB.batch(reorderStatements.slice(i, i + REORDER_CHUNK_SIZE));
      }

      return jsonResponse({
        code: 200,
        message: `成功更新 ${items.length} 条项目的排序`
      });
    } else {
      return errorResponse('无效的操作', 400);
    }

  } catch (e) {
    if (String(e?.message || '').includes('privacy_guard_')) {
      return errorResponse('分类或书签的隐私状态已发生变化，请刷新后重试。', 409);
    }
    return errorResponse(`批量操作失败: ${e.message}`, 500);
  } finally {
    if (dbMayHaveChanged) {
      await markHomeCacheDirty(env, 'all');
    }
  }
}
