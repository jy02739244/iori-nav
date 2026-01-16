// functions/index.js
import { isAdminAuthenticated } from './_middleware';

// 字体映射表 (System Fonts + Google Fonts Mirror)
const FONT_MAP = {
  // System Fonts (无需引入)
  'sans-serif': null,
  'serif': null,
  'monospace': null,
  "'Microsoft YaHei', sans-serif": null,
  "'SimSun', serif": null,
  "'PingFang SC', sans-serif": null,
  "'Segoe UI', sans-serif": null,
  
  // Web Fonts (fonts.loli.net)
  "'Noto Sans SC', sans-serif": "https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
  "'Noto Serif SC', serif": "https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;700&display=swap",
  "'Ma Shan Zheng', cursive": "https://fonts.loli.net/css2?family=Ma+Shan+Zheng&display=swap", // 书法
  "'ZCOOL KuaiLe', cursive": "https://fonts.loli.net/css2?family=ZCOOL+KuaiLe&display=swap", // 快乐体
  "'Long Cang', cursive": "https://fonts.loli.net/css2?family=Long+Cang&display=swap", // 草书
  "'Roboto', sans-serif": "https://fonts.loli.net/css2?family=Roboto:wght@300;400;500;700&display=swap",
  "'Open Sans', sans-serif": "https://fonts.loli.net/css2?family=Open+Sans:wght@400;600;700&display=swap",
  "'Lato', sans-serif": "https://fonts.loli.net/css2?family=Lato:wght@400;700&display=swap",
  "'Montserrat', sans-serif": "https://fonts.loli.net/css2?family=Montserrat:wght@400;700&display=swap"
};

// 辅助函数
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }
}

function normalizeSortOrder(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 9999;
}

// Schema 迁移版本号 - 修改此值会触发重新迁移
const SCHEMA_VERSION = 'v2';

// 内存缓存：热状态下跳过 KV 读取，只有冷启动时才查 KV
let schemaMigrated = false;

async function ensureSchema(env) {
  // 热状态直接返回，不读 KV
  if (schemaMigrated) return;

  // 冷启动时检查 KV 中是否已完成迁移
  const migrated = await env.NAV_AUTH.get(`schema_migrated_${SCHEMA_VERSION}`);
  if (migrated) {
    schemaMigrated = true;  // 更新内存缓存
    return;
  }

  try {
    // 批量执行所有索引创建（减少数据库往返）
    await env.NAV_DB.batch([
      env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)"),
      env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)")
    ]);

    // 检查并添加缺失的列（使用 PRAGMA 更高效）
    const sitesColumns = await env.NAV_DB.prepare("PRAGMA table_info(sites)").all();
    const sitesCols = new Set(sitesColumns.results.map(c => c.name));
    
    const categoryColumns = await env.NAV_DB.prepare("PRAGMA table_info(category)").all();
    const categoryCols = new Set(categoryColumns.results.map(c => c.name));
    
    const pendingColumns = await env.NAV_DB.prepare("PRAGMA table_info(pending_sites)").all();
    const pendingCols = new Set(pendingColumns.results.map(c => c.name));

    const alterStatements = [];
    
    if (!sitesCols.has('is_private')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN is_private INTEGER DEFAULT 0"));
    }
    if (!sitesCols.has('catelog_name')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN catelog_name TEXT"));
    }
    if (!pendingCols.has('catelog_name')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE pending_sites ADD COLUMN catelog_name TEXT"));
    }
    if (!categoryCols.has('is_private')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE category ADD COLUMN is_private INTEGER DEFAULT 0"));
    }
    if (!categoryCols.has('parent_id')) {
      alterStatements.push(env.NAV_DB.prepare("ALTER TABLE category ADD COLUMN parent_id INTEGER DEFAULT 0"));
    }

    if (alterStatements.length > 0) {
      // SQLite 不支持批量 ALTER，需要逐个执行
      for (const stmt of alterStatements) {
        try { await stmt.run(); } catch (e) { console.log('Column may already exist:', e.message); }
      }
      
      // 同步 catelog_name 数据（仅在添加字段后执行一次）
      if (!sitesCols.has('catelog_name')) {
        await env.NAV_DB.prepare(`
          UPDATE sites 
          SET catelog_name = (SELECT catelog FROM category WHERE category.id = sites.catelog_id) 
          WHERE catelog_name IS NULL
        `).run();
      }
    }

    // 标记迁移完成（缓存 30 天）
    await env.NAV_AUTH.put(`schema_migrated_${SCHEMA_VERSION}`, 'true', { expirationTtl: 2592000 });
    schemaMigrated = true;  // 更新内存缓存
    console.log('Schema migration completed');
  } catch (e) {
    console.error('Schema migration failed:', e);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  
  // 使用 KV 缓存 Schema 迁移状态，避免每次冷启动都检查
  await ensureSchema(env);

  const isAuthenticated = await isAdminAuthenticated(request, env);
  const includePrivate = isAuthenticated ? 1 : 0;

  // 并行执行数据库查询（分类、设置、站点）
  const categoryQuery = isAuthenticated 
    ? 'SELECT * FROM category ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM category WHERE is_private = 0 ORDER BY sort_order ASC, id ASC';
  
  const settingsKeys = [
    'layout_hide_desc', 'layout_hide_links', 'layout_hide_category',
    'layout_hide_title', 'home_title_size', 'home_title_color',
    'layout_hide_subtitle', 'home_subtitle_size', 'home_subtitle_color',
    'home_hide_stats', 'home_stats_size', 'home_stats_color',
    'home_hide_hitokoto', 'home_hitokoto_size', 'home_hitokoto_color',
    'home_hide_github', 'home_hide_admin',
    'home_custom_font_url', 'home_title_font', 'home_subtitle_font', 'home_stats_font', 'home_hitokoto_font',
    'home_site_name', 'home_site_description',
    'home_search_engine_enabled', 'home_default_category', 'home_remember_last_category',
    'layout_grid_cols', 'layout_custom_wallpaper', 'layout_menu_layout',
    'layout_random_wallpaper', 'bing_country',
    'layout_enable_frosted_glass', 'layout_frosted_glass_intensity',
    'layout_enable_bg_blur', 'layout_bg_blur_intensity', 'layout_card_style',
    'layout_card_border_radius',
    'wallpaper_source', 'wallpaper_cid_360',
    'card_title_font', 'card_title_size', 'card_title_color',
    'card_desc_font', 'card_desc_size', 'card_desc_color'
  ];
  const settingsPlaceholders = settingsKeys.map(() => '?').join(',');

  const sitesQuery = `SELECT id, name, url, logo, desc, catelog_id, catelog_name, sort_order, is_private, create_time, update_time 
                      FROM sites WHERE (is_private = 0 OR ? = 1) 
                      ORDER BY sort_order ASC, create_time DESC`;

  // 并行执行所有查询
  const [categoriesResult, settingsResult, sitesResult] = await Promise.all([
    env.NAV_DB.prepare(categoryQuery).all().catch(e => ({ results: [], error: e })),
    env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${settingsPlaceholders})`).bind(...settingsKeys).all().catch(e => ({ results: [], error: e })),
    env.NAV_DB.prepare(sitesQuery).bind(includePrivate).all().catch(e => ({ results: [], error: e }))
  ]);

  // 处理分类结果
  let categories = categoriesResult.results || [];
  if (categoriesResult.error) {
    console.error('Failed to fetch categories:', categoriesResult.error);
  }

  const categoryMap = new Map();
  const categoryIdMap = new Map(); 
  const rootCategories = [];

  categories.forEach(cat => {
    cat.children = [];
    cat.sort_order = normalizeSortOrder(cat.sort_order);
    categoryMap.set(cat.id, cat);
    if (cat.catelog) {
        categoryIdMap.set(cat.catelog, cat.id);
    }
  });

  categories.forEach(cat => {
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id).children.push(cat);
    } else {
      rootCategories.push(cat);
    }
  });

  const sortCats = (cats) => {
    cats.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    cats.forEach(c => sortCats(c.children));
  };
  sortCats(rootCategories);

  // 处理设置结果
  let layoutHideDesc = false;
  let layoutHideLinks = false;
  let layoutHideCategory = false;
  let layoutHideTitle = false;
  let homeTitleSize = '';
  let homeTitleColor = '';
  let layoutHideSubtitle = false;
  let homeSubtitleSize = '';
  let homeSubtitleColor = '';
  let homeHideStats = false;
  let homeStatsSize = '';
  let homeStatsColor = '';
  let homeHideHitokoto = false;
  let homeHitokotoSize = '';
  let homeHitokotoColor = '';
  let homeHideGithub = false;
  let homeHideAdmin = false;
  let homeCustomFontUrl = '';
  let homeTitleFont = '';
  let homeSubtitleFont = '';
  let homeStatsFont = '';
  let homeHitokotoFont = '';
  let homeSiteName = '';
  let homeSiteDescription = '';
  let homeSearchEngineEnabled = false;
  let homeDefaultCategory = '';
  let homeRememberLastCategory = false;
  let layoutGridCols = '4';
  let layoutCustomWallpaper = '';
  let layoutMenuLayout = 'horizontal';
  let layoutRandomWallpaper = false;
  let bingCountry = '';
  let layoutEnableFrostedGlass = false;
  let layoutFrostedGlassIntensity = '15';
  let layoutEnableBgBlur = false;
  let layoutBgBlurIntensity = '0';
  let layoutCardStyle = 'style1';
  let layoutCardBorderRadius = '12';
  let wallpaperSource = 'bing';
  let wallpaperCid360 = '36';
  
  let cardTitleFont = '';
  let cardTitleSize = '';
  let cardTitleColor = '';
  let cardDescFont = '';
  let cardDescSize = '';
  let cardDescColor = '';

  if (settingsResult.results) {
    settingsResult.results.forEach(row => {
      if (row.key === 'layout_hide_desc') layoutHideDesc = row.value === 'true';
      if (row.key === 'layout_hide_links') layoutHideLinks = row.value === 'true';
      if (row.key === 'layout_hide_category') layoutHideCategory = row.value === 'true';
      
      if (row.key === 'layout_hide_title') layoutHideTitle = row.value === 'true';
      if (row.key === 'home_title_size') homeTitleSize = row.value;
      if (row.key === 'home_title_color') homeTitleColor = row.value;

      if (row.key === 'layout_hide_subtitle') layoutHideSubtitle = row.value === 'true';
      if (row.key === 'home_subtitle_size') homeSubtitleSize = row.value;
      if (row.key === 'home_subtitle_color') homeSubtitleColor = row.value;

      if (row.key === 'home_hide_stats') homeHideStats = row.value === 'true';
      if (row.key === 'home_stats_size') homeStatsSize = row.value;
      if (row.key === 'home_stats_color') homeStatsColor = row.value;

      if (row.key === 'home_hide_hitokoto') homeHideHitokoto = row.value === 'true';
      if (row.key === 'home_hitokoto_size') homeHitokotoSize = row.value;
      if (row.key === 'home_hitokoto_color') homeHitokotoColor = row.value;
      
      if (row.key === 'home_hide_github') homeHideGithub = (row.value === 'true' || row.value === '1');
      if (row.key === 'home_hide_admin') homeHideAdmin = (row.value === 'true' || row.value === '1');

      if (row.key === 'home_custom_font_url') homeCustomFontUrl = row.value;
      if (row.key === 'home_title_font') homeTitleFont = row.value;
      if (row.key === 'home_subtitle_font') homeSubtitleFont = row.value;
      if (row.key === 'home_stats_font') homeStatsFont = row.value;
      if (row.key === 'home_hitokoto_font') homeHitokotoFont = row.value;

      if (row.key === 'home_site_name') homeSiteName = row.value;
      if (row.key === 'home_site_description') homeSiteDescription = row.value;

      if (row.key === 'home_search_engine_enabled') homeSearchEngineEnabled = row.value === 'true';
      if (row.key === 'home_default_category') homeDefaultCategory = row.value;
      if (row.key === 'home_remember_last_category') homeRememberLastCategory = row.value === 'true';

      if (row.key === 'layout_grid_cols') layoutGridCols = row.value;
      if (row.key === 'layout_custom_wallpaper') layoutCustomWallpaper = row.value;
      if (row.key === 'layout_menu_layout') layoutMenuLayout = row.value;
      if (row.key === 'layout_random_wallpaper') layoutRandomWallpaper = row.value === 'true';
      if (row.key === 'bing_country') bingCountry = row.value;
      if (row.key === 'layout_enable_frosted_glass') layoutEnableFrostedGlass = row.value === 'true';
      if (row.key === 'layout_frosted_glass_intensity') layoutFrostedGlassIntensity = row.value;
      if (row.key === 'layout_enable_bg_blur') layoutEnableBgBlur = row.value === 'true';
      if (row.key === 'layout_bg_blur_intensity') layoutBgBlurIntensity = row.value;
      if (row.key === 'layout_card_style') layoutCardStyle = row.value;
      if (row.key === 'layout_card_border_radius') layoutCardBorderRadius = row.value;
      if (row.key === 'wallpaper_source') wallpaperSource = row.value;
      if (row.key === 'wallpaper_cid_360') wallpaperCid360 = row.value;
      
      if (row.key === 'card_title_font') cardTitleFont = row.value;
      if (row.key === 'card_title_size') cardTitleSize = row.value;
      if (row.key === 'card_title_color') cardTitleColor = row.value;
      if (row.key === 'card_desc_font') cardDescFont = row.value;
      if (row.key === 'card_desc_size') cardDescSize = row.value;
      if (row.key === 'card_desc_color') cardDescColor = row.value;
    });
  }

  // 处理站点结果
  let allSites = sitesResult.results || [];
  if (sitesResult.error) {
    return new Response(`Failed to fetch sites: ${sitesResult.error.message}`, { status: 500 });
  }

  // 确定目标分类
  const url = new URL(request.url);
  let requestedCatalogName = (url.searchParams.get('catalog') || '').trim();
  const explicitAll = requestedCatalogName.toLowerCase() === 'all';
  
  if (!requestedCatalogName && !explicitAll) {
      // 优先级：Cookie (如果开启记忆) > 数据库默认设置
      let cookieCatId = null;
      if (homeRememberLastCategory) {
          const cookies = request.headers.get('Cookie') || '';
          const match = cookies.match(/iori_last_category=(\d+)/);
          if (match) {
              cookieCatId = parseInt(match[1]);
          }
      }

      if (cookieCatId && categoryMap.has(cookieCatId)) {
          // 通过 ID 反查 Name (因为后续逻辑基于 Name)
          requestedCatalogName = categoryMap.get(cookieCatId).catelog;
      } else {
          // Fallback to Default Category
          const defaultCat = (homeDefaultCategory || '').trim();
          if (defaultCat && categoryIdMap.has(defaultCat)) {
              requestedCatalogName = defaultCat;
          }
      }
  }

  let targetCategoryIds = [];
  let currentCatalogName = '';
  const catalogExists = requestedCatalogName && categoryIdMap.has(requestedCatalogName);
  
  if (catalogExists) {
      const rootId = categoryIdMap.get(requestedCatalogName);
      currentCatalogName = requestedCatalogName;
      
      // 用户要求：仅显示当前分类的数据，不包含子分类
      targetCategoryIds.push(rootId);
  }

  // 根据分类过滤站点
  let sites = [];
  if (targetCategoryIds.length > 0) {
    sites = allSites.filter(site => targetCategoryIds.includes(site.catelog_id));
  } else {
    sites = allSites;
  }

  // 随机壁纸轮询
  let nextWallpaperIndex = 0;
  if (layoutRandomWallpaper) {
    try {
      const cookies = request.headers.get('Cookie') || '';
      const match = cookies.match(/wallpaper_index=(\d+)/);
      const currentWallpaperIndex = match ? parseInt(match[1]) : -1;

      if (wallpaperSource === '360') {
        const cid = wallpaperCid360 || '36';
        const apiUrl = `http://cdn.apc.360.cn/index.php?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${cid}&start=0&count=8`;
        const res = await fetch(apiUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.errno === "0" && json.data && json.data.length > 0) {
            nextWallpaperIndex = (currentWallpaperIndex + 1) % json.data.length;
            const targetItem = json.data[nextWallpaperIndex];
            let targetUrl = targetItem.url;
            if (targetUrl) {
              targetUrl = targetUrl.replace('http://', 'https://');
              layoutCustomWallpaper = targetUrl;
            }
          }
        }
      } else {
        // Default to Bing
        let bingUrl = '';
        if (bingCountry === 'spotlight') {
          bingUrl = 'https://peapix.com/spotlight/feed?n=7';
        } else {
          bingUrl = `https://peapix.com/bing/feed?n=7&country=${bingCountry}`;
        }
        const res = await fetch(bingUrl);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            nextWallpaperIndex = (currentWallpaperIndex + 1) % data.length;
            const targetItem = data[nextWallpaperIndex];
            const targetUrl = targetItem.fullUrl || targetItem.url;
            if (targetUrl) {
              layoutCustomWallpaper = targetUrl;
            }
          }
        }
      }
    } catch (e) {
      console.error('Random Wallpaper Error:', e);
    }
  }

    const isCustomWallpaper = Boolean(layoutCustomWallpaper);

    const themeClass = isCustomWallpaper ? 'custom-wallpaper' : '';

    

        // Header Base Classes

    

    

    

        let headerClass = isCustomWallpaper 

    

            ? 'bg-transparent border-none shadow-none transition-colors duration-300' 

    

            : 'bg-primary-700 text-white border-b border-primary-600 shadow-sm dark:bg-gray-900 dark:border-gray-800';

    

      

    

        let containerClass = isCustomWallpaper

    

            ? 'rounded-2xl'

    

            : 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm dark:bg-gray-800/80 dark:border-gray-700';

    

      

    

        const titleColorClass = isCustomWallpaper ? 'text-gray-900 dark:text-gray-100' : 'text-white';

    

        const subTextColorClass = isCustomWallpaper ? 'text-gray-600 dark:text-gray-300' : 'text-primary-100/90 dark:text-gray-400';

    

        

    

        const searchInputClass = isCustomWallpaper

    

            ? 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white dark:bg-gray-800/90 dark:border-gray-600 dark:text-gray-200 dark:focus:bg-gray-800'

    

            : 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder-gray-500';

    

        const searchIconClass = isCustomWallpaper ? 'text-gray-400 dark:text-gray-500' : 'text-primary-200 dark:text-gray-500';

  

    // 4. 生成动态菜单

    const renderHorizontalMenu = (cats, level = 0) => {

        if (!cats || cats.length === 0) return '';

        

        return cats.map(cat => {

            const isActive = (currentCatalogName === cat.catelog);

            const hasChildren = cat.children && cat.children.length > 0;

            const safeName = escapeHTML(cat.catelog);

            const encodedName = encodeURIComponent(cat.catelog);

            const linkUrl = `?catalog=${encodedName}`;

            

            let html = '';

            if (level === 0) {

                const activeClass = isActive ? 'active' : 'inactive';

                const navItemActiveClass = isActive ? 'nav-item-active' : '';

                

                html += `<div class="menu-item-wrapper relative inline-block text-left">`;

                html += `<a href="${linkUrl}" class="nav-btn ${activeClass} ${navItemActiveClass}" data-id="${cat.id}">

                            ${safeName}

                            ${hasChildren ? '<svg class="w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>' : ''}

                         </a>`;

                if (hasChildren) {

                    html += `<div class="dropdown-menu">`;

                    html += renderHorizontalMenu(cat.children, level + 1);

                    html += `</div>`;

                }

                html += `</div>`;

            } else {

                const activeClass = isActive ? 'active' : '';

                const navItemActiveClass = isActive ? 'nav-item-active' : '';

                

                html += `<div class="menu-item-wrapper relative block w-full">`;

                html += `<a href="${linkUrl}" class="dropdown-item ${activeClass} ${navItemActiveClass}" data-id="${cat.id}">

                            ${safeName}

                            ${hasChildren ? '<svg class="dropdown-arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>' : ''}

                         </a>`;

                if (hasChildren) {

                    html += `<div class="dropdown-menu">`;

                    html += renderHorizontalMenu(cat.children, level + 1);

                    html += `</div>`;

                }

                html += `</div>`;

            }

            return html;

        }).join('');

    };

  

    const allLinkActive = !catalogExists;

    const allLinkClass = allLinkActive ? 'active' : 'inactive';

    const allLinkActiveMarker = allLinkActive ? 'nav-item-active' : '';

    

    const horizontalAllLink = `

        <div class="menu-item-wrapper relative inline-block text-left">

          <a href="?catalog=all" class="nav-btn ${allLinkClass} ${allLinkActiveMarker}">

              全部

          </a>

        </div>

    `;

    

    const horizontalCatalogMarkup = horizontalAllLink + renderHorizontalMenu(rootCategories);

  

    // Vertical Menu (Sidebar)

    const renderVerticalMenu = (cats, level = 0) => {

        return cats.map(cat => {

            const safeName = escapeHTML(cat.catelog);

            const encodedName = encodeURIComponent(cat.catelog);

            const isActive = currentCatalogName === cat.catelog;

            

                        const baseClass = "flex items-center px-3 py-2 rounded-lg w-full transition-colors duration-200";

            

                        const activeClass = isActive ? "bg-secondary-100 text-primary-700 dark:bg-gray-800 dark:text-primary-400" : "hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";

            

                        // Use darker icon color for custom wallpaper mode to ensure visibility

            

                        const defaultIconColor = isCustomWallpaper ? "text-gray-600" : "text-gray-400 dark:text-gray-500";

            

                        const iconClass = isActive ? "text-primary-600 dark:text-primary-400" : defaultIconColor;

            const indent = level * 12; 

            

            let html = `

              <a href="?catalog=${encodedName}" data-id="${cat.id}" class="${baseClass} ${activeClass}" style="padding-left: ${12 + indent}px">

                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />

                  </svg>

                  ${safeName}

              </a>

            `;

            if (cat.children && cat.children.length > 0) {

                html += renderVerticalMenu(cat.children, level + 1);

            }

            return html;

        }).join('');

    };

    

    const catalogLinkMarkup = renderVerticalMenu(rootCategories);

  

    // Sites Grid

        const sitesGridMarkup = sites.map((site, index) => {

                      const rawName = site.name || '未命名';

                  const rawCatalog = site.catelog_name || '未分类';

      const rawDesc = site.desc || '暂无描述';

      const normalizedUrl = sanitizeUrl(site.url);

      const safeDisplayUrl = normalizedUrl || '未提供链接';

      const logoUrl = sanitizeUrl(site.logo);

      const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());

      const safeName = escapeHTML(rawName);

      const safeCatalog = escapeHTML(rawCatalog);

      const safeDesc = escapeHTML(rawDesc);

      const hasValidUrl = Boolean(normalizedUrl);

  

                                    const descHtml = layoutHideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;

  

                          

  

                                                                        const linksHtml = layoutHideLinks ? '' : `

  

                          

  

                                                      <div class="mt-3 flex items-center justify-between">

  

                          

  

                                                        <span class="text-xs text-primary-600 dark:text-primary-400 truncate flex-1 min-w-0 mr-2" title="${safeDisplayUrl}">${escapeHTML(safeDisplayUrl)}</span>

  

                          

  

                                                        <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50' : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'} rounded-full text-xs font-medium transition-colors" data-url="${escapeHTML(normalizedUrl)}" ${hasValidUrl ? '' : 'disabled'}>

  

                          

  

                                    

  

                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ${layoutGridCols >= '5' ? '' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">

  

                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />

  

                      </svg>

  

                      ${layoutGridCols >= '5' ? '' : '<span class="copy-text">复制</span>'}

  

                      <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>

  

                    </button>

  

                  </div>`;

  

            const categoryHtml = layoutHideCategory ? '' : `

  

                        <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700 dark:bg-secondary-800 dark:text-primary-300">

  

                          ${safeCatalog}

  

                        </span>`;

  

            

  

            const frostedClass = layoutEnableFrostedGlass ? 'frosted-glass-effect' : '';

  

            const cardStyleClass = layoutCardStyle === 'style2' ? 'style-2' : '';

  

                              const baseCardClass = layoutEnableFrostedGlass 

  

                    

  

                                        ? 'site-card group h-full flex flex-col overflow-hidden transition-all' 

  

                    

  

                                        : 'site-card group h-full flex flex-col bg-white border border-primary-100/60 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700';

  

                    

  

                              

  

                              // Calculate delay for server-side rendering animation

  

                              // Note: 'sites' is an array, we need the index. map callback provides (site, index).

  

                              // But the current map usage is sites.map((site) => ...), we need to add index argument.

  

                              // Wait, I need to check the full map function signature in the old_string context or just update it.

  

                              // The surrounding code shows `const sitesGridMarkup = sites.map((site) => {`.

  

                              // I will update the map arguments.

  

                  

  

                              const delay = Math.min(index, 20) * 30;

  

                              const animStyle = delay > 0 ? `style="animation-delay: ${delay}ms"` : '';

  

                    

  

                              return `

  

                    

  

                                <div class="${baseCardClass} ${frostedClass} ${cardStyleClass} card-anim-enter" ${animStyle} data-id="${site.id}" data-name="${escapeHTML(site.name)}" data-url="${escapeHTML(normalizedUrl)}" data-catalog="${escapeHTML(site.catelog_name || site.catelog || '未分类')}" data-desc="${safeDesc}">

  

                <div class="site-card-content">

  

                  <a href="${escapeHTML(normalizedUrl || '#')}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">

  

                    <div class="flex items-start">

  

                      <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">

  

                                                ${

  

                                                  logoUrl

  

                                                    ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700" decoding="async" loading="lazy">`

  

                                                    : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`

  

                        

  

                        }

  

                      </div>

  

                      <div class="flex-1 min-w-0">

  

                        <h3 class="site-title text-base font-medium text-gray-900 dark:text-gray-100 truncate transition-all duration-300 origin-left" title="${safeName}">${safeName}</h3>

  

                        ${categoryHtml}

  

                      </div>

  

                    </div>

  

                    ${descHtml}

  

                  </a>

  

                  ${linksHtml}

  

                </div>

  

              </div>

  

            `;

    }).join('');

  let gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 justify-items-center';
  if (layoutGridCols === '5') {
      // 1024px+ 显示 5 列
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 justify-items-center';
  } else if (layoutGridCols === '6') {
      // 1024px+ 显示 5 列, 1280px+ 显示 6 列 (优化：1200px 左右也可尝试 6 列，但考虑到侧边栏，保险起见 1280px 切 6 列，但 1024px 切 5 列已经比原来 4 列好了)
      // 用户反馈 1200px 只有 4 列太少，现在 1200px 会是 5 列。
      // 也可以加入 min-[1200px]:grid-cols-6
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-[1200px]:grid-cols-6 gap-3 sm:gap-6 justify-items-center';
  } else if (layoutGridCols === '7') {
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 sm:gap-6 justify-items-center';
  }

  const datalistOptions = categories.map((cat) => `<option value="${escapeHTML(cat.catelog)}">`).join('');
  
  const headingPlainText = currentCatalogName
    ? `${currentCatalogName} · ${sites.length} 个书签`
    : `全部收藏 · ${sites.length} 个书签`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalogName) : '';
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
  const submissionClass = submissionEnabled ? '' : 'hidden';

  const siteName = homeSiteName || env.SITE_NAME || '灰色轨迹';
  const siteDescription = homeSiteDescription || env.SITE_DESCRIPTION || '一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建';
  const footerText = env.FOOTER_TEXT || '曾梦想仗剑走天涯';

  // Build Style Strings
  const getStyleStr = (size, color, font) => {
    let s = '';
    if (size) s += `font-size: ${size}px;`;
    if (color) s += `color: ${color} !important;`;
    if (font) s += `font-family: ${font} !important;`;
    return s ? `style="${s}"` : '';
  };
  
  const titleStyle = getStyleStr(homeTitleSize, homeTitleColor, homeTitleFont);
  const subtitleStyle = getStyleStr(homeSubtitleSize, homeSubtitleColor, homeSubtitleFont);
  const statsStyle = getStyleStr(homeStatsSize, homeStatsColor, homeStatsFont);
  const hitokotoStyle = getStyleStr(homeHitokotoSize, homeHitokotoColor, homeHitokotoFont);
  const hitokotoContent = homeHideHitokoto ? '' : '疏影横斜水清浅,暗香浮动月黄昏。';

  // Determine if the stats row should be rendered with padding/margin
  const shouldRenderStatsRow = !homeHideStats || !homeHideHitokoto;
  const statsRowPyClass = shouldRenderStatsRow ? 'my-8' : 'hidden';
  const statsRowMbClass = '';
  const statsRowHiddenClass = shouldRenderStatsRow ? '' : 'hidden';

  const horizontalTitleHtml = layoutHideTitle ? '' : `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${titleColorClass}" ${titleStyle}>{{SITE_NAME}}</h1>`;
  const horizontalSubtitleHtml = layoutHideSubtitle ? '' : `<p class="${subTextColorClass} opacity-90 text-sm md:text-base" ${subtitleStyle}>{{SITE_DESCRIPTION}}</p>`;

  // 搜索引擎选项 HTML
  const searchEngineOptions = homeSearchEngineEnabled ? `
    <div class="flex justify-center items-center gap-3 mb-4 text-sm select-none search-engine-wrapper">
        <label class="search-engine-option active" data-engine="local">
            <span>站内</span>
        </label>
        <label class="search-engine-option" data-engine="google">
            <span>Google</span>
        </label>
        <label class="search-engine-option" data-engine="baidu">
            <span>Baidu</span>
        </label>
        <label class="search-engine-option" data-engine="bing">
            <span>Bing</span>
        </label>
    </div>
    <script>
    (function(){
      try {
        var saved = localStorage.getItem('search_engine');
        if(saved && saved !== 'local'){
          var wrappers = document.querySelectorAll('.search-engine-wrapper');
          wrappers.forEach(function(w){
             var opts = w.querySelectorAll('.search-engine-option');
             opts.forEach(function(opt){
               if(opt.dataset.engine === saved) opt.classList.add('active');
               else opt.classList.remove('active');
             });
          });
          var inputs = document.querySelectorAll('.search-input-target');
          var ph = '搜索书签...';
          if(saved === 'google') ph = 'Google 搜索...';
          if(saved === 'baidu') ph = '百度搜索...';
          if(saved === 'bing') ph = 'Bing 搜索...';
          inputs.forEach(function(i){ i.placeholder = ph; });
        }
      } catch(e){}
    })();
    </script>
  ` : '';

  const verticalHeaderContent = `
      <div class="max-w-4xl mx-auto text-center relative z-10 ${themeClass} py-8">
        <div class="mb-8">
            ${horizontalTitleHtml}
            ${horizontalSubtitleHtml}
        </div>

        <div class="relative max-w-xl mx-auto">
            ${searchEngineOptions}
            <div class="relative">
                <input type="text" name="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>
      </div>`;
      
  const horizontalHeaderContent = `
      <div class="max-w-5xl mx-auto text-center relative z-10 ${themeClass}">
        <div class="max-w-4xl mx-auto mb-8">
            ${horizontalTitleHtml}
            ${horizontalSubtitleHtml}
        </div>

        <div class="relative max-w-xl mx-auto mb-8">
            ${searchEngineOptions}
            <div class="relative">
                <input id="headerSearchInput" type="text" name="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>
        
        <div class="relative max-w-5xl mx-auto">
            <div id="horizontalCategoryNav" class="flex flex-wrap justify-center items-center gap-3 overflow-hidden transition-all duration-300" style="max-height: 60px;">
                ${horizontalCatalogMarkup}
                <div id="horizontalMoreWrapper" class="relative hidden">
                    <button id="horizontalMoreBtn" class="nav-btn inactive">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                    </button>
                    <div id="horizontalMoreDropdown" class="dropdown-menu hidden absolute mt-2 w-auto z-50">
                        <!-- Dropdown items will be moved here by JS -->
                    </div>
                </div>
            </div>
        </div>
      </div>
  `;

  let sidebarClass = '';
  let mainClass = 'lg:ml-64';
  let sidebarToggleClass = '';
  let mobileToggleVisibilityClass = 'lg:hidden';
  let githubIconHtml = '';
  let adminIconHtml = '';
  let themeIconHtml = `
    <button id="themeToggleBtn" class="flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-amber-500 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-yellow-300 transition-all cursor-pointer" title="切换主题">
      <!-- Sun Icon (Light Mode) -->
      <svg id="themeIconSun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block dark:hidden"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
      <!-- Moon Icon (Dark Mode) -->
      <svg id="themeIconMoon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>
  `;
  
  let headerContent = verticalHeaderContent;

  if (layoutMenuLayout === 'horizontal') {
      sidebarClass = 'min-[550px]:hidden';
      mainClass = '';
      sidebarToggleClass = '!hidden';
      mobileToggleVisibilityClass = 'min-[550px]:hidden';
      
      if (!homeHideGithub) {
          githubIconHtml = `
          <a href="https://slink.661388.xyz/iori-nav" target="_blank" class="fixed top-4 left-4 z-50 hidden min-[550px]:flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-black dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-white transition-all" title="GitHub">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
          </a>
          `;
      }
      
      if (!homeHideAdmin) {
          adminIconHtml = `
          <a href="/admin" target="_blank" class="flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-primary-600 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-primary-400 transition-all" title="后台管理">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M7 18a5 5 0 0 1 10 0"/></path></svg>
          </a>
          `;
      }

      headerContent = `
        <div class="min-[550px]:hidden">
            ${verticalHeaderContent}
        </div>
        <div class="hidden min-[550px]:block">
            ${horizontalHeaderContent}
        </div>
      `;
  }
  
  // Combine for Top Right
  const topRightActionsHtml = `
    <div class="fixed top-4 right-4 z-50 flex items-center gap-3">
        ${themeIconHtml}
        ${adminIconHtml}
    </div>
  `;
  
  // Also handle Sidebar GitHub/Admin icons visibility in Vertical Mode
  // If we are in vertical mode, `githubIconHtml` is empty.
  // The sidebar content is in `public/index.html`.
  // We need to inject a class or hide them via replacement.
  
  // To keep it simple and safe:
  // I will add a new replacement for `{{SIDEBAR_GITHUB_CLASS}}` and `{{SIDEBAR_ADMIN_CLASS}}` in `public/index.html`?
  // But I haven't modified `public/index.html` to include those placeholders.
  // So I have to use string replacement on known HTML structure.
  
  // Replace sidebar GitHub link:
  // <a href="https://slink.661388.xyz/iori-nav" ... title="GitHub">
  // If homeHideGithub is true, replace with empty string or hidden class.
  
  const sidebarGithubLinkPattern = /<a href="https:\/\/slink\.661388\.xyz\/iori-nav"[^>]*title="GitHub">[\s\S]*?<\/a>/;
  const sidebarAdminLinkPattern = /<a href="\/admin"[^>]*>[\s\S]*?后台管理[\s\S]*?<\/a>/;
  
  // I'll do this replacement after fetching the template.
  
  const leftTopActionHtml = `
  <div class="fixed top-4 left-4 z-50 ${mobileToggleVisibilityClass}">
    <button id="sidebarToggle" class="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  </div>
  ${githubIconHtml}
  `;

  const footerClass = isCustomWallpaper
      ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none text-black dark:text-gray-200'
      : 'bg-white py-8 px-6 mt-12 border-t border-primary-100 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400';
      
  const hitokotoClass = (isCustomWallpaper ? 'text-black dark:text-gray-200' : 'text-gray-500 dark:text-gray-400') + ' ml-auto';

  const templateResponse = await env.ASSETS.fetch(new URL('/index.html', request.url));
  let html = await templateResponse.text();
  
  // Inject CSS to hide icons if requested (More robust than regex replacement)
  let hideIconsCss = '<style>';
  if (homeHideGithub) {
      hideIconsCss += 'a[title="GitHub"] { display: none !important; }';
  }
  if (homeHideAdmin) {
      hideIconsCss += 'a[href^="/admin"] { display: none !important; }';
  }
  hideIconsCss += '</style>';
  
  if (hideIconsCss !== '<style></style>') {
      html = html.replace('</head>', hideIconsCss + '</head>');
  }
  
  const safeWallpaperUrl = sanitizeUrl(layoutCustomWallpaper);
  const defaultBgColor = '#fdf8f3';
  
  // 统一构建背景层逻辑 - 采用 img 标签方案以解决移动端缩放问题
  let bgLayerHtml = '';
  
  if (safeWallpaperUrl) {
      const blurStyle = layoutEnableBgBlur ? `filter: blur(${layoutBgBlurIntensity}px); transform: scale(1.02);` : '';
      // transform: scale(1.02) 是为了防止模糊后边缘出现白边
      
      bgLayerHtml = `
        <div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; overflow: hidden;">
          <img src="${safeWallpaperUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; ${blurStyle}" />
        </div>
      `;
  } else {
      bgLayerHtml = `
        <div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; background-color: ${defaultBgColor};"></div>
      `;
  }
  
  // 注入全局样式
  const globalScrollCss = `
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden; /* 关键：禁止 body 滚动，交由内部容器接管 */
      }
      #app-scroll {
        width: 100%;
        height: 100%;
        overflow-y: auto; /* 允许纵向滚动 */
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch; /* iOS 原生惯性滚动 */
      }
      body {
        background-color: transparent !important;
      }
      #fixed-background {
        /* 仅对必要的属性进行平滑过渡 */
        transition: background-color 0.3s ease, filter 0.3s ease;
      }
      /* 修复 iOS 上 100vh 问题 (针对背景层) */
      @supports (-webkit-touch-callout: none) {
        #fixed-background {
          height: -webkit-fill-available;
        }
      }
    </style>
  `;

  html = html.replace('</head>', `${globalScrollCss}</head>`);
  
  // 替换 body 标签结构，增加 #app-scroll 滚动容器
  html = html.replace('<body class="bg-secondary-50 font-sans text-gray-800">', `<body class="bg-secondary-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 relative ${isCustomWallpaper ? 'custom-wallpaper' : ''}">${bgLayerHtml}<div id="app-scroll">`);
  
  // 闭合滚动容器
  html = html.replace('</body>', '</div></body>');
  
  // Inject Card CSS Variables
  const cardRadius = parseInt(layoutCardBorderRadius) || 12;
  const frostedBlurRaw = String(layoutFrostedGlassIntensity || '15').replace(/[^0-9]/g, '');
  const frostedBlur = frostedBlurRaw || '15';
  
  const cardCssVars = `<style>:root { --card-padding: 1.25rem; --card-radius: ${cardRadius}px; --frosted-glass-blur: ${frostedBlur}px; }</style>`;
  html = html.replace('</head>', `${cardCssVars}</head>`);

  // 自动注入字体资源
  // ... (existing code omitted for brevity but I should match context)
  const usedFonts = new Set();
  
  // 只有在元素显示时才添加对应的字体
  if (!layoutHideTitle && homeTitleFont) usedFonts.add(homeTitleFont);
  if (!layoutHideSubtitle && homeSubtitleFont) usedFonts.add(homeSubtitleFont);
  if (!homeHideStats && homeStatsFont) usedFonts.add(homeStatsFont);
  if (!homeHideHitokoto && homeHitokotoFont) usedFonts.add(homeHitokotoFont);
  
  // 卡片字体始终添加，因为它们是卡片的基本元素
  if (cardTitleFont) usedFonts.add(cardTitleFont);
  if (cardDescFont) usedFonts.add(cardDescFont);
  
  let fontLinksHtml = '';
  
  usedFonts.forEach(font => {
      if (font && FONT_MAP[font]) {
          fontLinksHtml += `<link rel="stylesheet" href="${FONT_MAP[font]}">`;
      }
  });
  
  // 兼容旧版自定义 URL
  const safeCustomFontUrl = sanitizeUrl(homeCustomFontUrl);
  if (safeCustomFontUrl) {
      fontLinksHtml += `<link rel="stylesheet" href="${safeCustomFontUrl}">`;
  }

  if (fontLinksHtml) {
      html = html.replace('</head>', `${fontLinksHtml}</head>`);
  }
  
  // Inject Custom Card Fonts CSS
  let customCardCss = '<style>';
  if (cardTitleFont || cardTitleSize || cardTitleColor) {
      const s = getStyleStr(cardTitleSize, cardTitleColor, cardTitleFont).replace('style="', '').replace('"', '');
      if (s) customCardCss += `.site-title { ${s} }`;
  }
  if (cardDescFont || cardDescSize || cardDescColor) {
      const s = getStyleStr(cardDescSize, cardDescColor, cardDescFont).replace('style="', '').replace('"', '');
      if (s) customCardCss += `.site-card p { ${s} }`;
  }
  customCardCss += '</style>';
  
  if (customCardCss !== '<style></style>') {
      html = html.replace('</head>', `${customCardCss}</head>`);
  }

  // Inject Global Data for Client-side JS
  const safeJson = JSON.stringify(allSites).replace(/</g, '\\u003c');
  const globalDataScript = `
    <script>
      window.IORI_SITES = ${safeJson};
    </script>
  `;
  html = html.replace('</head>', `${globalDataScript}</head>`);

  // Inject Layout Config for Client-side JS
  const layoutConfigScript = `
    <script>
      window.IORI_LAYOUT_CONFIG = {
        hideDesc: ${layoutHideDesc},
        hideLinks: ${layoutHideLinks},
        hideCategory: ${layoutHideCategory},
        gridCols: "${layoutGridCols}",
        cardStyle: "${layoutCardStyle}",
        enableFrostedGlass: ${layoutEnableFrostedGlass},
        rememberLastCategory: ${homeRememberLastCategory}
      };
    </script>
  `;
  html = html.replace('</head>', `${layoutConfigScript}</head>`);

  html = html
    .replace('{{HEADER_CONTENT}}', headerContent)
    .replace('{{HEADER_CLASS}}', headerClass)
    .replace('{{CONTAINER_CLASS}}', containerClass)
    .replace('{{FOOTER_CLASS}}', footerClass)
    .replace('{{HITOKOTO_CLASS}}', hitokotoClass)
    .replace('{{LEFT_TOP_ACTION}}', leftTopActionHtml)
    .replace('{{RIGHT_TOP_ACTION}}', topRightActionsHtml)
    .replace(/{{SITE_NAME}}/g, escapeHTML(siteName))
    .replace(/{{SITE_DESCRIPTION}}/g, escapeHTML(siteDescription))
    .replace('{{FOOTER_TEXT}}', escapeHTML(footerText))
    .replace('{{CATALOG_EXISTS}}', catalogExists ? 'true' : 'false')
    .replace('{{CATALOG_LINKS}}', catalogLinkMarkup)
    .replace('{{SUBMISSION_CLASS}}', submissionClass)
    .replace('{{DATALIST_OPTIONS}}', datalistOptions)
    .replace('{{TOTAL_SITES}}', sites.length)
    .replace('{{CATALOG_COUNT}}', categories.length)
    .replace('{{HEADING_TEXT}}', headingText)
    .replace('{{HEADING_DEFAULT}}', headingDefaultAttr)
    .replace('{{HEADING_ACTIVE}}', headingActiveAttr)
    .replace('{{STATS_VISIBLE}}', homeHideStats ? 'hidden' : '')
    .replace('{{STATS_STYLE}}', statsStyle)
    .replace('{{HITOKOTO_VISIBLE}}', homeHideHitokoto ? 'hidden' : '')
    .replace('{{STATS_ROW_PY_CLASS}}', statsRowPyClass)
    .replace('{{STATS_ROW_MB_CLASS}}', statsRowMbClass)
    .replace('{{STATS_ROW_HIDDEN}}', statsRowHiddenClass)
    .replace('{{HITOKOTO_CONTENT}}', hitokotoContent)
    .replace(/{{HITOKOTO_STYLE}}/g, hitokotoStyle)
    .replace('{{SITES_GRID}}', sitesGridMarkup)
    .replace('{{CURRENT_YEAR}}', new Date().getFullYear())
    .replace('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6', gridClass)
    .replace('{{SIDEBAR_CLASS}}', sidebarClass)
    .replace('{{MAIN_CLASS}}', mainClass)
    .replace('{{SIDEBAR_TOGGLE_CLASS}}', sidebarToggleClass);

  const response = new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });

  if (layoutRandomWallpaper) {
    response.headers.append('Set-Cookie', `wallpaper_index=${nextWallpaperIndex}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }

  return response;
}