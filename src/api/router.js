import { isAdminAuthenticated, isSubmissionEnabled } from '../admin/auth.js';
import { getConfig, getConfigById, createConfig, updateConfig, deleteConfig, importConfig, exportConfig } from './sites.js';
import { getPendingConfig, approvePendingConfig, rejectPendingConfig, submitConfig } from './pending.js';
import { getCategories, updateCategoryOrder } from './categories.js';

function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

async function getFavicon(url) {
  if (!url) return errorResponse('url parameter is required', 400);
  try {
    const target = new URL(url).hostname;
    const faviconUrl = `https://api.iowen.cn/favicon/${target}`;
    const resp = await fetch(faviconUrl, { method: 'HEAD' });
    if (resp.ok) {
      return Response.json({ code: 200, favicon: faviconUrl });
    }
  } catch (_) {}
  return Response.json({ code: 200, favicon: '' });
}

export async function handleApiRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const method = request.method;
  const id = url.pathname.split('/').pop();

  try {
    if (path === '/favicon' && method === 'GET') {
      return await getFavicon(url.searchParams.get('url'));
    }

    if (path === '/config') {
      switch (method) {
        case 'GET': return await getConfig(env, url);
        case 'POST':
          if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
          return await createConfig(request, env);
        default: return errorResponse('Method Not Allowed', 405);
      }
    }

    if (path === '/config/submit' && method === 'POST') {
      if (!isSubmissionEnabled(env)) return errorResponse('Public submission disabled', 403);
      return await submitConfig(request, env);
    }

    if (path === '/config/import' && method === 'POST') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
      return await importConfig(request, env);
    }

    if (path === '/config/export' && method === 'GET') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
      return await exportConfig(env);
    }

    if (path === '/categories' && method === 'GET') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
      return await getCategories(env);
    }

    if (path.startsWith('/categories/')) {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
      const categoryName = decodeURIComponent(path.replace('/categories/', ''));
      if (method === 'PUT') return await updateCategoryOrder(request, env, categoryName);
      return errorResponse('Method Not Allowed', 405);
    }

    if (path === `/config/${id}` && /^\d+$/.test(id)) {
      switch (method) {
        case 'GET': return await getConfigById(env, id);
        case 'PUT':
          if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
          return await updateConfig(request, env, id);
        case 'DELETE':
          if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
          return await deleteConfig(env, id);
        default: return errorResponse('Method Not Allowed', 405);
      }
    }

    if (path === '/pending' && method === 'GET') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
      return await getPendingConfig(env, url);
    }

    if (path.startsWith('/pending/') && /^\d+$/.test(id)) {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('Unauthorized', 401);
      switch (method) {
        case 'PUT': return await approvePendingConfig(env, id);
        case 'DELETE': return await rejectPendingConfig(env, id);
        default: return errorResponse('Method Not Allowed', 405);
      }
    }

    return errorResponse('Not Found', 404);
  } catch (error) {
    return errorResponse(`Internal Server Error: ${error.message}`, 500);
  }
}
