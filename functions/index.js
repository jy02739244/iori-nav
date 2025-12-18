// functions/index.js
import { isAdminAuthenticated } from './_middleware';

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

let indexesChecked = false;

export async function onRequest(context) {
  const { request, env } = context;
  
  if (!indexesChecked) {
    try {
      await env.NAV_DB.batch([
        env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)"),
        env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)")
      ]);
      
      try {
          await env.NAV_DB.prepare("SELECT is_private FROM sites LIMIT 1").first();
      } catch (e) {
          await env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN is_private INTEGER DEFAULT 0").run();
      }

      indexesChecked = true;
    } catch (e) {
      console.error('Failed to ensure indexes or columns:', e);
    }
  }

  const isAuthenticated = await isAdminAuthenticated(request, env);
  const includePrivate = isAuthenticated ? 1 : 0;

  // 1. 获取所有分类
  let categories = [];
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM category ORDER BY sort_order ASC, id ASC').all();
    categories = results || [];
  } catch (e) {
    console.error('Failed to fetch categories:', e);
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

  // 2. 确定目标分类
  const url = new URL(request.url);
  let requestedCatalogName = (url.searchParams.get('catalog') || '').trim();
  const explicitAll = requestedCatalogName.toLowerCase() === 'all';
  
  if (!requestedCatalogName && !explicitAll && env.DISPLAY_CATEGORY) {
      const defaultCat = env.DISPLAY_CATEGORY.trim();
      if (categoryIdMap.has(defaultCat)) {
          requestedCatalogName = defaultCat;
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

  // 3. 查询站点
  let sites = [];
  try {
      let query = `SELECT s.*, c.catelog FROM sites s 
                   LEFT JOIN category c ON s.catelog_id = c.id 
                   WHERE (s.is_private = 0 OR ? = 1)`;
      const params = [includePrivate];

      if (targetCategoryIds.length > 0) {
          const markers = targetCategoryIds.map(() => '?').join(',');
          query += ` AND s.catelog_id IN (${markers})`;
          params.push(...targetCategoryIds);
      }

      query += ` ORDER BY s.sort_order ASC, s.create_time DESC`;
      
      const { results } = await env.NAV_DB.prepare(query).bind(...params).all();
      sites = results || [];
  } catch (e) {
      return new Response(`Failed to fetch sites: ${e.message}`, { status: 500 });
  }

  // Settings & Wallpaper
  let layoutHideDesc = false;
  let layoutHideLinks = false;
  let layoutHideCategory = false;
  let layoutHideTitle = false;
  let layoutHideSubtitle = false;
  let layoutGridCols = '4';
  let layoutCustomWallpaper = '';
  let layoutMenuLayout = 'horizontal';
  let layoutRandomWallpaper = false;
  let bingCountry = '';
  let layoutEnableFrostedGlass = false;
  let layoutFrostedGlassIntensity = '15';
  let layoutEnableBgBlur = false;
  let layoutBgBlurIntensity = '0';

  try {
    const { results } = await env.NAV_DB.prepare("SELECT key, value FROM settings WHERE key IN ('layout_hide_desc', 'layout_hide_links', 'layout_hide_category', 'layout_hide_title', 'layout_hide_subtitle', 'layout_grid_cols', 'layout_custom_wallpaper', 'layout_menu_layout', 'layout_random_wallpaper', 'bing_country', 'layout_enable_frosted_glass', 'layout_frosted_glass_intensity', 'layout_enable_bg_blur', 'layout_bg_blur_intensity')").all();
    if (results) {
      results.forEach(row => {
        if (row.key === 'layout_hide_desc') layoutHideDesc = row.value === 'true';
        if (row.key === 'layout_hide_links') layoutHideLinks = row.value === 'true';
        if (row.key === 'layout_hide_category') layoutHideCategory = row.value === 'true';
        if (row.key === 'layout_hide_title') layoutHideTitle = row.value === 'true';
        if (row.key === 'layout_hide_subtitle') layoutHideSubtitle = row.value === 'true';
        if (row.key === 'layout_grid_cols') layoutGridCols = row.value;
        if (row.key === 'layout_custom_wallpaper') layoutCustomWallpaper = row.value;
        if (row.key === 'layout_menu_layout') layoutMenuLayout = row.value;
        if (row.key === 'layout_random_wallpaper') layoutRandomWallpaper = row.value === 'true';
        if (row.key === 'bing_country') bingCountry = row.value;
        if (row.key === 'layout_enable_frosted_glass') layoutEnableFrostedGlass = row.value === 'true';
        if (row.key === 'layout_frosted_glass_intensity') layoutFrostedGlassIntensity = row.value;
        if (row.key === 'layout_enable_bg_blur') layoutEnableBgBlur = row.value === 'true';
        if (row.key === 'layout_bg_blur_intensity') layoutBgBlurIntensity = row.value;
      });
    }
  } catch (e) {}

  let nextWallpaperIndex = 0;
  if (layoutRandomWallpaper) {
      try {
          const cookies = request.headers.get('Cookie') || '';
          const match = cookies.match(/wallpaper_index=(\d+)/);
          const currentWallpaperIndex = match ? parseInt(match[1]) : -1;

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
      } catch (e) {}
  }

  const isCustomWallpaper = Boolean(layoutCustomWallpaper);
  const themeClass = isCustomWallpaper ? 'custom-wallpaper' : '';
  
  // Header Base Classes
  let headerClass = isCustomWallpaper 
      ? 'bg-transparent border-none shadow-none transition-colors duration-300' 
      : 'bg-primary-700 text-white border-b border-primary-600 shadow-sm';

  let containerClass = isCustomWallpaper
      ? 'rounded-2xl'
      : 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm';

  const titleColorClass = isCustomWallpaper ? 'text-gray-900' : 'text-white';
  const subTextColorClass = isCustomWallpaper ? 'text-gray-600' : 'text-primary-100/90';
  
  const searchInputClass = isCustomWallpaper
      ? 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white'
      : 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none';
  const searchIconClass = isCustomWallpaper ? 'text-gray-400' : 'text-primary-200';

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
          const activeClass = isActive ? "bg-secondary-100 text-primary-700" : "hover:bg-gray-100 text-gray-700";
          // Use darker icon color for custom wallpaper mode to ensure visibility
          const defaultIconColor = isCustomWallpaper ? "text-gray-600" : "text-gray-400";
          const iconClass = isActive ? "text-primary-600" : defaultIconColor;
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
  const sitesGridMarkup = sites.map((site) => {
    const rawName = site.name || '未命名';
    const rawCatalog = site.catelog || '未分类';
    const rawDesc = site.desc || '暂无描述';
    const normalizedUrl = sanitizeUrl(site.url);
    const safeDisplayUrl = normalizedUrl || '未提供链接';
    const logoUrl = sanitizeUrl(site.logo);
    const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());
    const safeName = escapeHTML(rawName);
    const safeCatalog = escapeHTML(rawCatalog);
    const safeDesc = escapeHTML(rawDesc);
    const hasValidUrl = Boolean(normalizedUrl);

    const descHtml = layoutHideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;
    const linksHtml = layoutHideLinks ? '' : `
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-primary-600 truncate max-w-[140px]" title="${safeDisplayUrl}">${escapeHTML(safeDisplayUrl)}</span>
            <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} rounded-full text-xs font-medium transition-colors" data-url="${escapeHTML(normalizedUrl)}" ${hasValidUrl ? '' : 'disabled'}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ${layoutGridCols === '5' ? '' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              ${layoutGridCols === '5' ? '' : '<span class="copy-text">复制</span>'}
              <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
            </button>
          </div>`;
    const categoryHtml = layoutHideCategory ? '' : `
                <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700">
                  ${safeCatalog}
                </span>`;
    
    const frostedClass = layoutEnableFrostedGlass ? 'frosted-glass-effect' : '';
    const baseCardClass = layoutEnableFrostedGlass 
        ? 'site-card group rounded-xl overflow-hidden transition-all' 
        : 'site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-hidden';

    return `
      <div class="${baseCardClass} ${frostedClass}" data-id="${site.id}" data-name="${escapeHTML(site.name)}" data-url="${escapeHTML(normalizedUrl)}" data-catalog="${escapeHTML(site.catelog)}">
        <div class="p-5">
          <a href="${escapeHTML(normalizedUrl || '#')}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-start">
              <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">
                ${
                  logoUrl
                    ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100">`
                    : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`
                }
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="site-title text-base font-medium text-gray-900 truncate transition-all duration-300 origin-left" title="${safeName}">${safeName}</h3>
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

  let gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6';
  if (layoutGridCols === '5') {
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6';
  }

  const datalistOptions = categories.map((cat) => `<option value="${escapeHTML(cat.catelog)}">`).join('');
  
  const headingPlainText = currentCatalogName
    ? `${currentCatalogName} · ${sites.length} 个网站`
    : `全部收藏 · ${sites.length} 个网站`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalogName) : '';
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
  const submissionClass = submissionEnabled ? '' : 'hidden';

  const siteName = env.SITE_NAME || '灰色轨迹';
  const siteDescription = env.SITE_DESCRIPTION || '一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建';
  const footerText = env.FOOTER_TEXT || '曾梦想仗剑走天涯';
  
  const mainTitleHtml = layoutHideTitle ? '' : `<h1 class="mt-4 text-3xl md:text-4xl font-semibold tracking-tight ${titleColorClass}">{{SITE_NAME}}</h1>`;
  const subtitleHtml = layoutHideSubtitle ? '' : `<p class="mt-3 text-sm md:text-base ${subTextColorClass} leading-relaxed">{{SITE_DESCRIPTION}}</p>`;
  
  const horizontalTitleHtml = layoutHideTitle ? '' : `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${titleColorClass}">{{SITE_NAME}}</h1>`;
  const horizontalSubtitleHtml = layoutHideSubtitle ? '' : `<p class="${subTextColorClass} opacity-90 text-sm md:text-base">{{SITE_DESCRIPTION}}</p>`;

  const verticalHeaderContent = `
      <div class="max-w-4xl mx-auto text-center relative z-10 ${themeClass} py-8">
        <div class="mb-8">
            ${horizontalTitleHtml}
            ${horizontalSubtitleHtml}
        </div>

        <div class="relative max-w-xl mx-auto">
            <input type="text" name="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
      </div>`;
      
  const horizontalHeaderContent = `
      <div class="max-w-4xl mx-auto text-center relative z-10 ${themeClass}">
        <div class="mb-8">
            ${horizontalTitleHtml}
            ${horizontalSubtitleHtml}
        </div>

        <div class="relative max-w-xl mx-auto mb-8">
            <input id="headerSearchInput" type="text" name="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
        
        <div class="relative max-w-5xl mx-auto">
            <div id="horizontalCategoryNav" class="flex flex-wrap justify-center gap-3 overflow-visible transition-all duration-300" style="min-height: 48px;">
                ${horizontalCatalogMarkup}
            </div>
            
            <div id="horizontalMoreBtnContainer" class="hidden absolute right-0 top-0 h-full flex items-center justify-center pl-2 ${isCustomWallpaper ? '' : 'bg-gradient-to-l from-secondary-50 via-secondary-50 to-transparent'} z-20" style="padding-left: 2rem;">
                 <button id="horizontalMoreBtn" class="nav-btn inactive" style="padding: 0 0.75rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                 </button>
            </div>
            <div id="horizontalMoreDropdown" class="dropdown-menu hidden absolute mt-2 w-auto !left-auto !right-0 !transform-none origin-top-right z-50">
                <!-- Dropdown items will be moved here by JS -->
            </div>
        </div>
      </div>
  `;

  let sidebarClass = '';
  let mainClass = 'lg:ml-64';
  let sidebarToggleClass = '';
  let mobileToggleVisibilityClass = 'lg:hidden';
  let githubIconHtml = '';
  let headerContent = verticalHeaderContent;

  if (layoutMenuLayout === 'horizontal') {
      sidebarClass = 'min-[550px]:hidden';
      mainClass = '';
      sidebarToggleClass = '!hidden';
      mobileToggleVisibilityClass = 'min-[550px]:hidden';
      
      githubIconHtml = `
      <a href="https://slink.661388.xyz/iori-nav" target="_blank" class="fixed top-4 left-4 z-50 hidden min-[550px]:flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-black transition-all" title="GitHub">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
      </a>
      `;
      
      const adminIconHtml = `
      <a href="/admin" target="_blank" class="fixed top-4 right-4 z-50 hidden min-[550px]:flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-primary-600 transition-all" title="后台管理">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M7 18a5 5 0 0 1 10 0"/></path></svg>
      </a>
      `;

      headerContent = `
        <div class="min-[550px]:hidden">
            ${verticalHeaderContent}
        </div>
        <div class="hidden min-[550px]:block">
            ${adminIconHtml}
            ${horizontalHeaderContent}
        </div>
      `;
  }
  
  const leftTopActionHtml = `
  <div class="fixed top-4 left-4 z-50 ${mobileToggleVisibilityClass}">
    <button id="sidebarToggle" class="p-2 rounded-lg bg-white shadow-md hover:bg-gray-100">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  </div>
  ${githubIconHtml}
  `;

  const footerClass = isCustomWallpaper
      ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none text-black'
      : 'bg-white py-8 px-6 mt-12 border-t border-primary-100';
      
  const hitokotoClass = isCustomWallpaper ? 'text-black' : 'text-gray-500';

  const templateResponse = await env.ASSETS.fetch(new URL('/index.html', request.url));
  let html = await templateResponse.text();
  
  const safeWallpaperUrl = sanitizeUrl(layoutCustomWallpaper);
  if (safeWallpaperUrl) {
      const blurStyle = layoutEnableBgBlur ? `filter: blur(${layoutBgBlurIntensity}px);` : '';
      const bgLayerHtml = `<div style="position: fixed; inset: 0; z-index: -10; background-image: url('${safeWallpaperUrl}'); background-size: cover; background-attachment: fixed; background-position: center; ${blurStyle}"></div>`;
      
      html = html.replace('<body class="bg-secondary-50 font-sans text-gray-800">', `<body class="bg-secondary-50 font-sans text-gray-800 relative ${isCustomWallpaper ? 'custom-wallpaper' : ''}">${bgLayerHtml}`);
  } else {
      // 即使没有壁纸，也可能需要 class 来标记默认状态，这里主要给 body 加 custom-wallpaper 类以便 CSS 选择器生效
      // 但上面逻辑只有 safeWallpaperUrl 存在才加。
      // 实际上 CSS body.custom-wallpaper 选择器依赖此。
  }
  
  if (layoutEnableFrostedGlass) {
      const cssVarInjection = `<style>:root { --frosted-glass-blur: ${layoutFrostedGlassIntensity}px; }</style>`;
      html = html.replace('</head>', `${cssVarInjection}</head>`);
  }

  // Inject Layout Config for Client-side JS
  const layoutConfigScript = `
    <script>
      window.IORI_LAYOUT_CONFIG = {
        hideDesc: ${layoutHideDesc},
        hideLinks: ${layoutHideLinks},
        hideCategory: ${layoutHideCategory},
        gridCols: "${layoutGridCols}"
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
    .replace('{{SITES_GRID}}', sitesGridMarkup)
    .replace('{{CURRENT_YEAR}}', new Date().getFullYear())
    .replace('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6', gridClass)
    .replace('{{SIDEBAR_CLASS}}', sidebarClass)
    .replace('{{MAIN_CLASS}}', mainClass)
    .replace('{{SIDEBAR_TOGGLE_CLASS}}', sidebarToggleClass);

  // 关键：在 Custom Wallpaper 模式下，为 Sidebar 添加毛玻璃效果
  if (isCustomWallpaper) {
      html = html.replace('bg-white shadow-md border-r border-primary-100/60', 'bg-white/40 backdrop-blur-[10px] shadow-lg border-r border-white/10');
  }

  const response = new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });

  if (layoutRandomWallpaper) {
      response.headers.append('Set-Cookie', `wallpaper_index=${nextWallpaperIndex}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }

  return response;
}