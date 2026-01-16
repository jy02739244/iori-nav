// functions/api/config/index.js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder } from '../../_middleware';

let indexesChecked = false;

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // 自动确保索引存在（每个 Worker 实例只执行一次）
  if (!indexesChecked) {
    try {
      await env.NAV_DB.batch([
        env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)"),
        env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)")
      ]);
      
      // 检查并添加 is_private 字段
      try {
          await env.NAV_DB.prepare("SELECT is_private FROM sites LIMIT 1").first();
      } catch (e) {
          await env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN is_private INTEGER DEFAULT 0").run();
      }

      // 检查并添加 catelog_name 字段 (防止直接访问后台时报错)
      try {
          await env.NAV_DB.prepare("SELECT catelog_name FROM sites LIMIT 1").first();
      } catch (e) {
          await env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN catelog_name TEXT").run();
          // 仅在首次添加字段时补全数据
          await env.NAV_DB.prepare(`
            UPDATE sites 
            SET catelog_name = (SELECT catelog FROM category WHERE category.id = sites.catelog_id) 
            WHERE catelog_name IS NULL
          `).run();
      }

      indexesChecked = true;
    } catch (e) {
      console.error('Failed to ensure indexes or columns:', e);
      // 继续执行，不要因为索引创建失败而阻塞主逻辑
    }
  }

  const url = new URL(request.url);
  const catalog = url.searchParams.get('catalog');
  const catalogId = url.searchParams.get('catalogId');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const keyword = url.searchParams.get('keyword');
  const offset = (page - 1) * pageSize;

  const isAuthenticated = await isAdminAuthenticated(request, env);
  const includePrivate = isAuthenticated ? 1 : 0;

  try {
    // 基础查询：不再关联 category，直接查 sites 表，提高性能
    // 注意：始终筛选 (is_private = 0 OR includePrivate = 1)
    let queryBase = `FROM sites s WHERE (s.is_private = 0 OR ? = 1)`;
    let queryBindParams = [includePrivate];

    if (catalogId) {
      queryBase += ` AND s.catelog_id = ?`;
      queryBindParams.push(catalogId);
    } else if (catalog) {
      queryBase += ` AND s.catelog_name = ?`;
      queryBindParams.push(catalog);
    }

    if (keyword) {
      queryBase += ` AND (name LIKE ? OR url LIKE ? OR catelog_name LIKE ? OR s.desc LIKE ?)`;
      queryBindParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const query = `SELECT * ${queryBase} ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?`;
    const countQuery = `SELECT COUNT(*) as total ${queryBase}`;
    
    // 添加分页参数
    const fullBindParams = [...queryBindParams, pageSize, offset];
    const { results } = await env.NAV_DB.prepare(query).bind(...fullBindParams).all();
    
    // 优化：如果 pageSize 很大（通常是“获取全部”场景），则跳过 COUNT 查询
    let total = 0;
    if (pageSize >= 1000) {
        total = results.length + offset; 
    } else {
        const countResult = await env.NAV_DB.prepare(countQuery).bind(...queryBindParams).first();
        total = countResult ? countResult.total : 0;
    }

    return jsonResponse({
      code: 200,
      data: results,
      total,
      page,
      pageSize
    });
  } catch (e) {
    return errorResponse(`Failed to fetch config data: ${e.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const config = await request.json();
    const { name, url, logo, desc, catelogId, sort_order, is_private } = config;
    const iconAPI=env.ICON_API ||'https://faviconsnap.com/api/favicon?url=';
    
    const sanitizedName = (name || '').trim();
    const sanitizedUrl = (url || '').trim();
    let sanitizedLogo = (logo || '').trim() || null;
    const sanitizedDesc = (desc || '').trim() || null;
    const sortOrderValue = normalizeSortOrder(sort_order);
    const isPrivateValue = is_private ? 1 : 0;

    if (!sanitizedName || !sanitizedUrl || !catelogId) {
      return errorResponse('Name, URL and Catelog are required', 400);
    }

    // Check if URL already exists
    const existingSite = await env.NAV_DB.prepare('SELECT id FROM sites WHERE url = ?').bind(sanitizedUrl).first();
    if (existingSite) {
        return errorResponse('该 URL 已存在，请勿重复添加', 409);
    }

    if(!logo && url){
      if(url.startsWith('https://') || url.startsWith('http://')){
        const domain = url.replace(/^https?:\/\//, '').split('/')[0];
        sanitizedLogo = iconAPI+domain;
    }
      
    }
    // Find the category ID from the category name
    const categoryResult = await env.NAV_DB.prepare('SELECT catelog, is_private FROM category WHERE id = ?').bind(catelogId).first();

    if (!categoryResult) {
      return errorResponse(`Category not found.`, 400);
    }
    
    // If category is private, force site to be private
    let finalIsPrivate = isPrivateValue;
    if (categoryResult.is_private === 1) {
        finalIsPrivate = 1;
    }

    const insert = await env.NAV_DB.prepare(`
      INSERT INTO sites (name, url, logo, desc, catelog_id, catelog_name, sort_order, is_private)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, catelogId, categoryResult.catelog, sortOrderValue, finalIsPrivate).run();

    return jsonResponse({
      code: 201,
      message: 'Config created successfully',
      insert
    }, 201);
  } catch (e) {
    return errorResponse(`Failed to create config: ${e.message}`, 500);
  }
}
