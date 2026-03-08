// functions/api/categories/index.js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder } from '../../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;

  // Note: This API is currently protected. If it is needed for public "Add Site", it should be public or have a public variant.
  // Assuming Admin usage for now.
  if (!(await isAdminAuthenticated(request, env))) {
    // Check if it's a request from the "Add Site" modal (visitor).
    // If we want to allow visitors to see categories, we should remove this check or make it conditional.
    // For now, I will keep it as is, but if the user wants public submission to work, this might need change.
    // But the task is about "Multi-level Menu", which is SSR.
    return errorResponse('Unauthorized', 401);
  }
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const offset = (page - 1) * pageSize;

  try {
    const { results } = await env.NAV_DB.prepare(`
        SELECT c.id, c.catelog, c.sort_order, c.parent_id, c.is_private, COUNT(s.id) AS site_count
        FROM category c
        LEFT JOIN sites s ON c.id = s.catelog_id
        GROUP BY c.id, c.catelog, c.sort_order, c.parent_id
        ORDER BY c.sort_order ASC, c.create_time DESC
        LIMIT ? OFFSET ?
      `).bind(pageSize, offset).all();
    const countResult = await env.NAV_DB.prepare(`
      SELECT COUNT(*) as total FROM category
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
    return errorResponse(`Failed to fetch categories: ${e.message}`, 500);
  }
}
