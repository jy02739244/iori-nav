import { isAdminAuthenticated, errorResponse, jsonResponse, clearHomeCache, clearHomeCacheDirty, clearGraphCache } from '../../_middleware';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // 必须先删 HTML 缓存，再删 dirty 标记；反过来的话，并发首页请求会
    // 看到「无 dirty + 旧 HTML」并返回一次过期页面。
    await clearHomeCache(env, 'all');
    // 设置同样有 24h 的 KV 缓存（settings_cache）：只清 HTML 的话，下一次渲染会
    // 拿旧设置重新拼出一份「看起来是新的」旧页面，强制刷新就名不副实。
    await env.NAV_AUTH.delete('settings_cache');
    // 首页与图谱共用版本。先清设置缓存，再发布新版本，避免新版本首页回填旧设置。
    await clearGraphCache(env, { throwOnError: true });
    // 版本读取、HTML/设置删除或版本轮换失败时，都保留 dirty 标记供恢复后重渲染。
    await clearHomeCacheDirty(env, 'all');
    const response = jsonResponse({
      code: 200,
      message: '首页与设置缓存已清除'
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
