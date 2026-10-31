// functions/api/config/export.js
import { isAdminAuthenticated, errorResponse } from '../../_middleware';
import { fetchBookmarkExport } from '../../lib/bookmark-export';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const includePrivate = url.searchParams.get('include_private') === 'true';

  try {
    const exportData = await fetchBookmarkExport(env, { includePrivate });

    const jsonData = JSON.stringify(exportData, null, 2);

    return new Response(jsonData, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="config.json"',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (e) {
    return errorResponse(`Failed to export config: ${e.message}`, 500);
  }
}
