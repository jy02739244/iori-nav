// functions/api/update-description.js
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../_middleware';

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. 身份验证
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { id, description, url, logo } = await request.json();

    // 2. 输入验证
    if (!id || typeof description !== 'string') {
      return errorResponse('Bookmark ID and description are required', 400);
    }
    const iconAPI=env.ICON_API ||'https://faviconsnap.com/api/favicon?url=';
    let sanitizedLogo = (logo || '').trim() || null;
    if(!logo && url){
      if(url.startsWith('https://') || url.startsWith('http://')){
        const domain = url.replace(/^https?:\/\//, '').split('/')[0];
        sanitizedLogo = iconAPI+domain;
      }
      
    }
    console.log('Sanitized Logo URL:', sanitizedLogo);

    // 3. 更新数据库
    const result = await env.NAV_DB.prepare(
      'UPDATE sites SET desc = ?, logo = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(description, sanitizedLogo, id).run();

    if (result.changes === 0) {
        return errorResponse('Bookmark not found or no changes made', 404);
    }

    // 4. 返回成功响应
    return jsonResponse({
      code: 200,
      message: 'Description updated successfully',
    });

  } catch (e) {
    console.error('Error updating description:', e);
    return errorResponse(`Failed to update description: ${e.message}`, 500);
  }
}