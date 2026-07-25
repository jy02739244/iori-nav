// functions/api/get-empty-desc-sites.js
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;

  // 1. 身份验证
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // 2. 查询数据库中描述为空或NULL的记录
    const { results } = await env.NAV_DB.prepare(
      "SELECT id, name, url , logo FROM sites WHERE desc IS NULL OR desc = ''"
    ).all();

    // 3. 返回结果
    return jsonResponse({
      code: 200,
      data: results,
    });

  } catch (e) {
    console.error('Error fetching sites with empty description:', e);
    return errorResponse(`Failed to fetch sites: ${e.message}`, 500);
  }
}