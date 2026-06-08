// functions/api/pending/[id].js
import { isAdminAuthenticated, errorResponse, jsonResponse, markHomeCacheDirty, normalizeSortOrder } from '../../_middleware';
import { buildFaviconUrl, getUrlMatchCandidates, normalizeUrlForStorage } from '../../lib/utils';
import { normalizeBookmarkDesc, normalizeBookmarkLogo, normalizeBookmarkName, normalizeBookmarkUrl } from '../../lib/validators';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).all();
    
    if (results.length === 0) {
      return errorResponse('Pending config not found', 404);
    }

    const config = results[0];
    let updateData = {};
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      try {
        updateData = await request.json();
      } catch {
        updateData = {};
      }
    }
    if (!updateData || typeof updateData !== 'object' || Array.isArray(updateData)) {
      updateData = {};
    }

    const hasField = (field) => Object.prototype.hasOwnProperty.call(updateData, field);
    const getField = (field, fallback) => hasField(field) ? updateData[field] : fallback;
    const catelogId = hasField('catelog_id')
      ? updateData.catelog_id
      : getField('catelogId', config.catelog_id);

    const nameResult = normalizeBookmarkName(getField('name', config.name));
    if (!nameResult.ok) return errorResponse(nameResult.message, 400);

    const urlResult = normalizeBookmarkUrl(getField('url', config.url));
    if (!urlResult.ok) return errorResponse(urlResult.message, 400);

    const logoResult = normalizeBookmarkLogo(getField('logo', config.logo), { nullIfEmpty: true });
    if (!logoResult.ok) return errorResponse(logoResult.message, 400);

    const descResult = normalizeBookmarkDesc(getField('desc', config.desc), { nullIfEmpty: true });
    if (!descResult.ok) return errorResponse(descResult.message, 400);

    const sanitizedName = nameResult.value;
    const rawUrl = urlResult.value;
    const sanitizedUrl = normalizeUrlForStorage(rawUrl);
    let sanitizedLogo = logoResult.value;
    const sanitizedDesc = descResult.value;
    const sortOrderValue = hasField('sort_order') ? normalizeSortOrder(updateData.sort_order) : 9999;
    const isPrivateValue = getField('is_private', false) ? 1 : 0;

    if (!catelogId) {
      return errorResponse('Catelog is required', 400);
    }
    if (!sanitizedUrl) {
      return errorResponse('URL must be a valid http or https URL', 400);
    }

    const urlCandidates = getUrlMatchCandidates(rawUrl);
    const placeholders = urlCandidates.map(() => '?').join(',');
    const duplicate = await env.NAV_DB.prepare(`SELECT id FROM sites WHERE url IN (${placeholders})`)
      .bind(...urlCandidates)
      .first();
    if (duplicate) {
      return errorResponse('该 URL 已存在，请勿重复添加', 409);
    }

    const iconAPI = env.ICON_API || 'https://faviconsnap.com/api/favicon?url=';
    sanitizedLogo = buildFaviconUrl(sanitizedUrl, sanitizedLogo, iconAPI);
    const category = await env.NAV_DB.prepare('SELECT catelog, is_private FROM category WHERE id = ?').bind(catelogId).first();
    if (!category) {
      return errorResponse('Category not found.', 400);
    }
    const finalIsPrivate = category.is_private === 1 ? 1 : isPrivateValue;

    await env.NAV_DB.prepare(`
      INSERT INTO sites (name, url, logo, desc, catelog_id, catelog_name, sort_order, is_private)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, catelogId, category.catelog, sortOrderValue, finalIsPrivate).run();
    
    await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();

    await markHomeCacheDirty(env, finalIsPrivate ? 'private' : 'all');

    return jsonResponse({
      code: 200,
      message: 'Pending config approved successfully'
    });
  } catch (e) {
    console.error('Error approving pending config:', e);
    return errorResponse(`Failed to approve pending config: ${e.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const id = params.id;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
    
    return jsonResponse({
      code: 200,
      message: 'Pending config rejected successfully',
    });
  } catch (e) {
    return errorResponse(`Failed to reject pending config: ${e.message}`, 500);
  }
}
