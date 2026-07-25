// functions/api/config/export.js
import { isAdminAuthenticated, errorResponse } from '../../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const includePrivate = url.searchParams.get('include_private') === 'true';

  try {
    let categoryQuery = 'SELECT id, catelog, sort_order, parent_id, is_private FROM category';
    let sitesQuery = 'SELECT id, name, url, logo, desc, catelog_id, sort_order, is_private FROM sites';

    if (!includePrivate) {
        categoryQuery += ' WHERE is_private = 0';
        // Site is private if itself is private OR its category is private.
        // Since we are doing a simple export, let's just filter by sites.is_private = 0.
        // Because previous logic ensures site.is_private = 1 if category is private.
        sitesQuery += ' WHERE is_private = 0';
    }

    categoryQuery += ' ORDER BY sort_order ASC';
    sitesQuery += ' ORDER BY sort_order ASC, create_time DESC';

    // Fetch categories
    const categoriesPromise = env.NAV_DB.prepare(categoryQuery).all();
    
    // Fetch sites
    const sitesPromise = env.NAV_DB.prepare(sitesQuery).all();

    const [{ results: categories }, { results: sites }] = await Promise.all([categoriesPromise, sitesPromise]);

    const exportData = {
      category: categories,
      sites: sites
    };
    
    const jsonData = JSON.stringify(exportData, null, 2);

    return new Response(jsonData, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="config.json"'
      }
    });
  } catch (e) {
    return errorResponse(`Failed to export config: ${e.message}`, 500);
  }
}