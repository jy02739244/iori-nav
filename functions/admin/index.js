// functions/admin/index.js

import { isAdminAuthenticated, getSessionToken } from '../_middleware';

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
        return new Response(html, { headers });
      }
      return response;
    } else {
      console.error('Failed to load admin HTML:', response.status);
      return new Response('管理页面加载失败', { status: 500 });
    }
  } catch (e) {
    console.error('Error loading admin page:', e);
    return new Response('管理页面加载失败: ' + e.message, { status: 500 });
  }
}
