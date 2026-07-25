import { isSubmissionEnabled } from '../admin/auth.js';

function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export async function getPendingConfig(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const offset = (page - 1) * pageSize;
  try {
    const { results } = await env.NAV_DB.prepare(
      'SELECT * FROM pending_sites ORDER BY create_time DESC LIMIT ? OFFSET ?'
    ).bind(pageSize, offset).all();
    const countResult = await env.NAV_DB.prepare('SELECT COUNT(*) as total FROM pending_sites').first();
    const total = countResult ? countResult.total : 0;
    return jsonResponse({ code: 200, data: results, total, page, pageSize });
  } catch (e) {
    return errorResponse(`Failed to fetch pending config data: ${e.message}`, 500);
  }
}

export async function approvePendingConfig(env, id) {
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).all();
    if (results.length === 0) return errorResponse('Pending config not found', 404);
    const config = results[0];
    await env.NAV_DB.prepare(
      'INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, 9999)'
    ).bind(config.name, config.url, config.logo, config.desc, config.catelog).run();
    await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
    return jsonResponse({ code: 200, message: 'Pending config approved successfully' });
  } catch (e) {
    return errorResponse(`Failed to approve pending config: ${e.message}`, 500);
  }
}

export async function rejectPendingConfig(env, id) {
  try {
    const del = await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
    if (!del.meta.changes) return errorResponse('Pending config not found', 404);
    return jsonResponse({ code: 200, message: 'Pending config rejected successfully' });
  } catch (e) {
    return errorResponse(`Failed to reject pending config: ${e.message}`, 500);
  }
}

export async function submitConfig(request, env) {
  try {
    if (!isSubmissionEnabled(env)) return errorResponse('Public submission disabled', 403);
    const config = await request.json();
    const { name, url, logo, desc, catelog } = config;
    const sName = (name || '').trim();
    const sUrl = (url || '').trim();
    const sCatelog = (catelog || '').trim();
    const sLogo = (logo || '').trim() || null;
    const sDesc = (desc || '').trim() || null;

    if (!sName || !sUrl || !sCatelog) return errorResponse('Name, URL and Catelog are required', 400);

    await env.NAV_DB.prepare(
      'INSERT INTO pending_sites (name, url, logo, desc, catelog) VALUES (?, ?, ?, ?, ?)'
    ).bind(sName, sUrl, sLogo, sDesc, sCatelog).run();

    return jsonResponse({ code: 201, message: 'Config submitted successfully, waiting for admin approve' }, 201);
  } catch (e) {
    return errorResponse(`Failed to submit config: ${e.message}`, 500);
  }
}
