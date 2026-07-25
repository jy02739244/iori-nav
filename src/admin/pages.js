import { escapeHTML } from '../utils/html.js';
import adminHtml from '../templates/admin.html';
import adminCss from '../templates/admin.css';
import adminJsText from '../templates/admin.js.txt';
import loginHtml from '../templates/login.html';

export function renderAdminPage() {
  return new Response(adminHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export function renderLoginPage(message = '') {
  if (!message) {
    return new Response(loginHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  // Inject error message into the login page
  const safeMessage = escapeHTML(message);
  const html = loginHtml.replace(
    '<div class="error-message">用户名或密码错误</div>',
    `<div class="error-message" style="display:block;">${safeMessage}</div>`
  );
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export function handleStatic(request) {
  const url = new URL(request.url);
  const filePath = url.pathname.replace('/static/', '');

  const files = {
    'admin.html': { content: adminHtml, type: 'text/html; charset=utf-8' },
    'admin.css': { content: adminCss, type: 'text/css; charset=utf-8' },
    'admin.js': { content: adminJsText, type: 'application/javascript; charset=utf-8' },
  };

  const file = files[filePath];
  if (!file) return new Response('Not Found', { status: 404 });
  return new Response(file.content, { headers: { 'Content-Type': file.type } });
}
