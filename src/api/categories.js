import { normalizeSortOrder } from '../utils/sort.js';

function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export async function getCategories(env) {
  try {
    const categoryOrderMap = new Map();
    try {
      const { results: orderRows } = await env.NAV_DB.prepare('SELECT catelog, sort_order FROM category_orders').all();
      orderRows.forEach(row => categoryOrderMap.set(row.catelog, normalizeSortOrder(row.sort_order)));
    } catch (error) {
      if (!/no such table/i.test(error.message || '')) throw error;
    }

    const { results } = await env.NAV_DB.prepare(
      'SELECT catelog, COUNT(*) AS site_count, MIN(sort_order) AS min_site_sort FROM sites GROUP BY catelog'
    ).all();

    const data = results.map(row => ({
      catelog: row.catelog,
      site_count: row.site_count,
      sort_order: categoryOrderMap.has(row.catelog) ? categoryOrderMap.get(row.catelog) : normalizeSortOrder(row.min_site_sort),
      explicit: categoryOrderMap.has(row.catelog),
      min_site_sort: row.min_site_sort === null ? 9999 : normalizeSortOrder(row.min_site_sort),
    }));

    data.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      if (a.min_site_sort !== b.min_site_sort) return a.min_site_sort - b.min_site_sort;
      return a.catelog.localeCompare(b.catelog, 'zh-Hans-CN', { sensitivity: 'base' });
    });

    return jsonResponse({ code: 200, data });
  } catch (e) {
    return errorResponse(`Failed to fetch categories: ${e.message}`, 500);
  }
}

export async function updateCategoryOrder(request, env, categoryName) {
  try {
    if (!categoryName) return errorResponse('Category name is required', 400);
    const normalized = categoryName.trim();
    if (!normalized) return errorResponse('Category name is required', 400);

    const body = await request.json();

    if (body && body.reset) {
      await env.NAV_DB.prepare('DELETE FROM category_orders WHERE catelog = ?').bind(normalized).run();
      return jsonResponse({ code: 200, message: 'Category order reset successfully' });
    }

    const sortVal = normalizeSortOrder(body ? body.sort_order : undefined);
    await env.NAV_DB.prepare(
      'INSERT INTO category_orders (catelog, sort_order) VALUES (?, ?) ON CONFLICT(catelog) DO UPDATE SET sort_order = excluded.sort_order'
    ).bind(normalized, sortVal).run();

    return jsonResponse({ code: 200, message: 'Category order updated successfully' });
  } catch (e) {
    return errorResponse(`Failed to update category order: ${e.message}`, 500);
  }
}
