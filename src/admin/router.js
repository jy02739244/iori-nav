import { validateAdminSession, destroyAdminSession, createAdminSession, buildSessionCookie } from './auth.js';
import { renderAdminPage, renderLoginPage, handleStatic } from './pages.js';

export async function handleAdminRequest(request, env, ctx) {
  const url = new URL(request.url);

  // Logout - Bug #26 fix: ensure cookie is cleared with Path=/ and Max-Age=0
  if (url.pathname === '/admin/logout') {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const { token } = await validateAdminSession(request, env);
    if (token) await destroyAdminSession(env, token);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/admin',
        'Set-Cookie': buildSessionCookie('', { maxAge: 0 }),
      },
    });
  }

  if (url.pathname === '/admin') {
    if (request.method === 'POST') {
      const formData = await request.formData();
      const name = (formData.get('name') || '').trim();
      const password = (formData.get('password') || '').trim();

      const storedUsername = await env.NAV_AUTH.get('admin_username');
      const storedPassword = await env.NAV_AUTH.get('admin_password');

      const isValid = storedUsername && storedPassword && name === storedUsername && password === storedPassword;

      if (isValid) {
        const token = await createAdminSession(env);
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin', 'Set-Cookie': buildSessionCookie(token) },
        });
      }
      return renderLoginPage('账号或密码错误，请重试。');
    }

    const session = await validateAdminSession(request, env);
    if (session.authenticated) {
      const response = renderAdminPage();
      if (session.cookie) response.headers.set('Set-Cookie', session.cookie);
      return response;
    }
    return renderLoginPage();
  }

  if (url.pathname.startsWith('/static')) {
    return handleStatic(request);
  }

  return new Response('页面不存在', { status: 404 });
}
