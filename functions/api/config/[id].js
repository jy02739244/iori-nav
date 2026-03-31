// functions/api/config/[id].js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder, markHomeCacheDirty } from '../../_middleware';
import { buildFaviconUrl } from '../../lib/utils';


export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = params.id;
  const { results } = await env.NAV_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).all();
  if (results.length === 0) {
    return errorResponse('config not found', 404);
  }
  const config = results[0];
  
  // 私密站点需要认证才能访问
  if (config.is_private && !(await isAdminAuthenticated(request, env))) {
    return errorResponse('config not found', 404);
  }
  
  return jsonResponse({
    code: 200,
    data: config
  });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }
  
  try {
    const existing = await env.NAV_DB.prepare('SELECT id, is_private FROM sites WHERE id = ?').bind(id).first();
    if (!existing) {
      return errorResponse('config not found', 404);
    }

    const config = await request.json();
    const { name, url, logo, desc, catelog_id, sort_order, is_private } = config;

    const sanitizedName = (name || '').trim();
    const sanitizedUrl = (url || '').trim();
    let sanitizedLogo = (logo || '').trim() || null;
    const sanitizedDesc = (desc || '').trim() || null;
    const sortOrderValue = normalizeSortOrder(sort_order);
    const isPrivateValue = is_private ? 1 : 0;

    if (!sanitizedName || !sanitizedUrl || !catelog_id) {
      return errorResponse('Name, URL and Catelog are required', 400);
    }
    const iconAPI = env.ICON_API || 'https://faviconsnap.com/api/favicon?url=';
    sanitizedLogo = buildFaviconUrl(sanitizedUrl, sanitizedLogo, iconAPI);

    // Fetch category name
    const categoryResult = await env.NAV_DB.prepare('SELECT catelog, is_private FROM category WHERE id = ?').bind(catelog_id).first();
    const catelogName = categoryResult ? categoryResult.catelog : 'Unknown';

    // If category is private, force site to be private
    let finalIsPrivate = isPrivateValue;
    if (categoryResult && categoryResult.is_private === 1) {
        finalIsPrivate = 1;
    }

    const update = await env.NAV_DB.prepare(`
      UPDATE sites
      SET name = ?, url = ?, logo = ?, desc = ?, catelog_id = ?, catelog_name = ?, sort_order = ?, is_private = ?, update_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, catelog_id, catelogName, sortOrderValue, finalIsPrivate, id).run();

    const dirtyScope = (existing.is_private === 1 && finalIsPrivate === 1) ? 'private' : 'all';
    await markHomeCacheDirty(env, dirtyScope);

    return jsonResponse({
      code: 200,
      message: 'Config updated successfully',
      update
    });
  } catch (e) {
    return errorResponse(`Failed to update config: ${e.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const existing = await env.NAV_DB.prepare('SELECT id, is_private FROM sites WHERE id = ?').bind(id).first();
    if (!existing) {
      return errorResponse('config not found', 404);
    }

    const del = await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();

    await markHomeCacheDirty(env, existing.is_private ? 'private' : 'all');

    return jsonResponse({
      code: 200,
      message: 'Config deleted successfully',
      del
    });
  } catch (e) {
    return errorResponse(`Failed to delete config: ${e.message}`, 500);
  }
}
