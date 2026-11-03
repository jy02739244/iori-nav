// functions/admin/index.js

import { buildSessionCookie, isAdminAuthenticated, getSessionToken } from '../_middleware';

// GET: 显示管理页面或重定向到登录
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin/login',
      },
    });
  }

  const sessionToken = getSessionToken(request);

  // 尝试从静态资源读取 HTML 文件
  try {
    const url = new URL(request.url);
    url.pathname = '/admin/index.html';

    const response = await env.ASSETS.fetch(url);

    if (response.ok) {
      // 从 KV 读取 CSRF token 并注入到 HTML
      const csrfToken = await env.NAV_AUTH.get(`csrf_${sessionToken}`);
      if (csrfToken) {
        let html = await response.text();
        html = html.replace('</head>', `<meta name="csrf-token" content="${csrfToken}">\n</head>`);
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-store');
        // 注入 meta 后 body 长度与内容都变了：原响应带来的 Content-Length 会截断页面，
        // ETag 也不再对应当前内容。两者都删掉，交给运行时重新计算。
        headers.delete('Content-Length');
        headers.delete('ETag');
        // response.text() 已经按 Content-Encoding 解压过 body，这里必须把头一并删掉，
        // 否则浏览器会拿明文再解一次压。当前内部 fetch 不带 Accept-Encoding 所以
        // ASSETS 不会压缩，删掉是为了不再依赖这个隐含前提。
        headers.delete('Content-Encoding');
        // ASSETS 响应会带上静态资源的 CORS 头，后台页面是同源加载，不需要这些
        headers.delete('Access-Control-Allow-Origin');
        return new Response(html, { headers });
      }

      return new Response(null, {
        status: 302,
        headers: {
          'Location': `/admin/login?error=${encodeURIComponent('登录状态已过期，请重新登录')}`,
          'Set-Cookie': buildSessionCookie('', { maxAge: 0 }),
          'Cache-Control': 'no-store',
        },
      });
    } else {
      console.error('Failed to load admin HTML:', response.status);
      return new Response('管理页面加载失败', { status: 500 });
    }
  } catch (e) {
    console.error('Error loading admin page:', e);
    return new Response('管理页面加载失败: ' + e.message, { status: 500 });
  }
}
