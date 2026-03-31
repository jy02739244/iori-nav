import { isAdminAuthenticated, errorResponse, jsonResponse, clearHomeCache, clearHomeCacheDirty } from '../../_middleware';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    await clearHomeCache(env, 'all');
    await clearHomeCacheDirty(env, 'all');
    const response = jsonResponse({
      code: 200,
      message: '首页缓存已清除'
    });
    // Clear stale cookie to prevent auto-refresh loop if any
    response.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0; SameSite=Lax');
    response.headers.append('Set-Cookie', 'iori_cache_public_stale=; Path=/; Max-Age=0; SameSite=Lax');
    response.headers.append('Set-Cookie', 'iori_cache_private_stale=; Path=/; Max-Age=0; SameSite=Lax');
    return response;
  } catch (e) {
    return errorResponse(`Failed to clear cache: ${e.message}`, 500);
  }
}
