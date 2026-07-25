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

export async function getConfig(env, url) {
  const catalog = url.searchParams.get('catalog');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const keyword = url.searchParams.get('keyword');
  const offset = (page - 1) * pageSize;

  try {
    let query = 'SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
    let countQuery = 'SELECT COUNT(*) as total FROM sites';
    let queryBindParams = [pageSize, offset];
    let countQueryParams = [];

    if (catalog) {
      query = 'SELECT * FROM sites WHERE catelog = ? ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM sites WHERE catelog = ?';
      queryBindParams = [catalog, pageSize, offset];
      countQueryParams = [catalog];
    }

    if (keyword) {
      const like = `%${keyword}%`;
      if (catalog) {
        query = 'SELECT * FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?) ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
        countQuery = 'SELECT COUNT(*) as total FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?)';
        queryBindParams = [catalog, like, like, like, pageSize, offset];
        countQueryParams = [catalog, like, like, like];
      } else {
        query = 'SELECT * FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ? ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
        countQuery = 'SELECT COUNT(*) as total FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ?';
        queryBindParams = [like, like, like, pageSize, offset];
        countQueryParams = [like, like, like];
      }
    }

    const { results } = await env.NAV_DB.prepare(query).bind(...queryBindParams).all();
    const countResult = await env.NAV_DB.prepare(countQuery).bind(...countQueryParams).first();
    const total = countResult ? countResult.total : 0;

    return jsonResponse({ code: 200, data: results, total, page, pageSize });
  } catch (e) {
    return errorResponse(`Failed to fetch config data: ${e.message}`, 500);
  }
}

export async function getConfigById(env, id) {
  try {
    const result = await env.NAV_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
    if (!result) return errorResponse('Config not found', 404);
    return jsonResponse({ code: 200, data: result });
  } catch (e) {
    return errorResponse(`Failed to fetch config: ${e.message}`, 500);
  }
}

export async function createConfig(request, env) {
  try {
    const config = await request.json();
    const { name, url, logo, desc, catelog, sort_order } = config;
    const sName = (name || '').trim();
    const sUrl = (url || '').trim();
    const sCatelog = (catelog || '').trim();
    const sLogo = (logo || '').trim() || null;
    const sDesc = (desc || '').trim() || null;
    const sortVal = normalizeSortOrder(sort_order);

    if (!sName || !sUrl || !sCatelog) return errorResponse('Name, URL and Catelog are required', 400);

    const insert = await env.NAV_DB.prepare(
      'INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(sName, sUrl, sLogo, sDesc, sCatelog, sortVal).run();

    return jsonResponse({ code: 201, message: 'Config created successfully', insert }, 201);
  } catch (e) {
    return errorResponse(`Failed to create config: ${e.message}`, 500);
  }
}

export async function updateConfig(request, env, id) {
  try {
    const config = await request.json();
    const { name, url, logo, desc, catelog, sort_order } = config;
    const sName = (name || '').trim();
    const sUrl = (url || '').trim();
    const sCatelog = (catelog || '').trim();
    const sLogo = (logo || '').trim() || null;
    const sDesc = (desc || '').trim() || null;
    const sortVal = normalizeSortOrder(sort_order);

    if (!sName || !sUrl || !sCatelog) return errorResponse('Name, URL and Catelog are required', 400);

    const update = await env.NAV_DB.prepare(
      'UPDATE sites SET name = ?, url = ?, logo = ?, desc = ?, catelog = ?, sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(sName, sUrl, sLogo, sDesc, sCatelog, sortVal, id).run();

    if (!update.meta.changes) return errorResponse('Config not found', 404);
    return jsonResponse({ code: 200, message: 'Config updated successfully' });
  } catch (e) {
    return errorResponse(`Failed to update config: ${e.message}`, 500);
  }
}

export async function deleteConfig(env, id) {
  try {
    const del = await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    if (!del.meta.changes) return errorResponse('Config not found', 404);
    return jsonResponse({ code: 200, message: 'Config deleted successfully' });
  } catch (e) {
    return errorResponse(`Failed to delete config: ${e.message}`, 500);
  }
}

export async function importConfig(request, env) {
  try {
    const jsonData = await request.json();
    let sitesToImport = [];

    if (Array.isArray(jsonData)) {
      sitesToImport = jsonData;
    } else if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.data)) {
      sitesToImport = jsonData.data;
    } else {
      return errorResponse('Invalid JSON data. Must be an array of site configurations, or an object with a "data" key containing the array.', 400);
    }

    if (sitesToImport.length === 0) {
      return jsonResponse({ code: 200, message: 'Import successful, but no data was found in the file.' });
    }

    const stmts = sitesToImport.map(item => {
      const sName = (item.name || '').trim() || null;
      const sUrl = (item.url || '').trim() || null;
      const sLogo = (item.logo || '').trim() || null;
      const sDesc = (item.desc || '').trim() || null;
      const sCatelog = (item.catelog || '').trim() || null;
      const sortVal = normalizeSortOrder(item.sort_order);
      return env.NAV_DB.prepare(
        'INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(sName, sUrl, sLogo, sDesc, sCatelog, sortVal);
    });

    await env.NAV_DB.batch(stmts);
    return jsonResponse({ code: 201, message: `Config imported successfully. ${sitesToImport.length} items added.` }, 201);
  } catch (e) {
    return errorResponse(`Failed to import config: ${e.message}`, 500);
  }
}

export async function exportConfig(env) {
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC').all();
    return new Response(JSON.stringify(results, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="config.json"',
      },
    });
  } catch (e) {
    return errorResponse(`Failed to export config: ${e.message}`, 500);
  }
}
