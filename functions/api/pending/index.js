// functions/api/pending/index.js
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';
import { parsePagination } from '../../lib/utils';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(url.searchParams, { maxPageSize: 200 });

  try {
    // 列表与总数互不依赖，并行执行省一次 D1 往返
    const [{ results }, countResult] = await Promise.all([
      env.NAV_DB.prepare(`
        SELECT p.*, c.catelog
        FROM pending_sites p
        LEFT JOIN category c ON p.catelog_id = c.id
        ORDER BY p.create_time DESC
        LIMIT ? OFFSET ?
      `).bind(pageSize, offset).all(),
      env.NAV_DB.prepare(`
        SELECT COUNT(*) as total FROM pending_sites
      `).first(),
    ]);

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
