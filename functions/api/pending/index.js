// functions/api/pending/index.js
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '10', 10), 200);
  const offset = (page - 1) * pageSize;

  try {
    const { results } = await env.NAV_DB.prepare(`
      SELECT p.*, c.catelog
      FROM pending_sites p
      LEFT JOIN category c ON p.catelog_id = c.id
      ORDER BY p.create_time DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();
    
    const countResult = await env.NAV_DB.prepare(`
      SELECT COUNT(*) as total FROM pending_sites
    `).first();
    
    const total = countResult ? countResult.total : 0;

    return jsonResponse({
      code: 200,
      data: results,
      total,
      page,
      pageSize
    });
  } catch (e) {
    return errorResponse(`Failed to fetch pending config data: ${e.message}`, 500);
  }
}
