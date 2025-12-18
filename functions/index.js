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
  
  // 自动确保索引存在（每个 Worker 实例只执行一次）
  if (!indexesChecked) {
    try {
      await env.NAV_DB.batch([
        env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)"),
        env.NAV_DB.prepare("CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)")
      ]);
      indexesChecked = true;
    } catch (e) {
      console.error('Failed to ensure indexes:', e);
    }
  }

  const url = new URL(request.url);
  const catalog = url.searchParams.get('catalog');

  // 1. 从数据库获取站点数据
  let sites = [];
  try {
    const { results } = await env.NAV_DB.prepare(
      `SELECT s.*,c.catelog FROM sites s
                 INNER JOIN category c ON s.catelog_id = c.id
                 ORDER BY s.sort_order ASC, s.create_time DESC `
    ).all();
    sites = results;
  } catch (e) {
    return new Response(`Failed to fetch data: ${e.message}`, { status: 500 });
  }

  // 2. 处理分类逻辑
  const totalSites = sites.length;
  const categoryMinSort = new Map();
  const categorySet = new Set();
  const categoryIdMap = new Map();

  sites.forEach((site) => {
    const categoryName = (site.catelog || '').trim() || '未分类';
    categorySet.add(categoryName);
    
    // Capture ID
    if (site.catelog_id && !categoryIdMap.has(categoryName)) {
        categoryIdMap.set(categoryName, site.catelog_id);
    }

    const rawSort = Number(site.sort_order);
    const normalized = Number.isFinite(rawSort) ? rawSort : 9999;
    if (!categoryMinSort.has(categoryName) || normalized < categoryMinSort.get(categoryName)) {
      categoryMinSort.set(categoryName, normalized);
    }
  });

  const categoryOrderMap = new Map();
  try {
    const { results: orderRows } = await env.NAV_DB.prepare(
      'SELECT catelog, sort_order FROM category'
    ).all();
    orderRows.forEach(row => {
      categoryOrderMap.set(row.catelog, normalizeSortOrder(row.sort_order));
    });
  } catch (error) {
    if (!/no such table/i.test(error.message || '')) {
      return new Response(`Failed to fetch category orders: ${error.message}`, { status: 500 });
    }
  }

  const catalogsWithMeta = Array.from(categorySet).map((name) => {
    const fallbackSort = categoryMinSort.has(name) ? normalizeSortOrder(categoryMinSort.get(name)) : 9999;
    const order = categoryOrderMap.has(name) ? categoryOrderMap.get(name) : fallbackSort;
    return { name, order, fallback: fallbackSort, id: categoryIdMap.get(name) };
  });

  catalogsWithMeta.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.fallback !== b.fallback) return a.fallback - b.fallback;
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base' });
  });

  const catalogs = catalogsWithMeta.map(item => item.name); // Keep for legacy usage

  // 3. 筛选当前分类的站点
  let requestedCatalog = (catalog || '').trim();
  
  // Handle explicit request for "all" sites
  const explicitAll = requestedCatalog.toLowerCase() === 'all';
  if (explicitAll) {
      requestedCatalog = '';
  }

  // If no specific catalog is requested AND not explicitly asking for 'all', try to use the default category from environment variables
  if (!requestedCatalog && !explicitAll && env.DISPLAY_CATEGORY) {
    const defaultCat = env.DISPLAY_CATEGORY.trim();
    if (catalogs.includes(defaultCat)) {
      requestedCatalog = defaultCat;
    }
  }

  const catalogExists = Boolean(requestedCatalog && catalogs.includes(requestedCatalog));
  const currentCatalog = catalogExists ? requestedCatalog : catalogs[0];
  const currentSites = catalogExists
    ? sites.filter((s) => {
        const catValue = (s.catelog || '').trim() || '未分类';
        return catValue === currentCatalog;
      })
    : sites;

  // Fetch Layout Settings
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
  } catch (e) {
    // Ignore error, use defaults
  }

  // Handle Sequential/Polling Wallpaper
  let nextWallpaperIndex = 0;
  if (layoutRandomWallpaper) {
      try {
          // Parse Cookie for current index
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
                  // Calculate next index
                  nextWallpaperIndex = (currentWallpaperIndex + 1) % data.length;
                  
                  const targetItem = data[nextWallpaperIndex];
                  const targetUrl = targetItem.fullUrl || targetItem.url;
                  
                  if (targetUrl) {
                      layoutCustomWallpaper = targetUrl;
                  }
              }
          }
      } catch (e) {
          // Ignore fetch error, fallback to default or stored custom wallpaper
      }
  }

  // Define Styles based on Theme (Default vs Wallpaper)
  const isCustomWallpaper = Boolean(layoutCustomWallpaper);
  
  // Header Base Classes
  let headerClass = isCustomWallpaper 
      ? 'bg-white/80 backdrop-blur-sm border-b border-primary-100/60 shadow-sm transition-colors duration-300' 
      : 'bg-primary-700 text-white border-b border-primary-600 shadow-sm';
      
  if (isCustomWallpaper && layoutMenuLayout === 'horizontal') {
      headerClass = 'bg-transparent border-none shadow-none';
  }

  // Container Classes
  let containerClass = isCustomWallpaper
      ? 'rounded-2xl'
      : 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm';

  // Text Colors
  const titleColorClass = isCustomWallpaper ? 'text-gray-900' : 'text-white';
  const subTextColorClass = isCustomWallpaper ? 'text-gray-600' : 'text-primary-100/90';
  
  // Horizontal Search Input Styles
  const searchInputClass = isCustomWallpaper
      ? 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white'
      : 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none';
  const searchIconClass = isCustomWallpaper ? 'text-gray-400' : 'text-primary-200';

  // Horizontal Menu Link Styles
  const hLinkActive = isCustomWallpaper 
      ? 'bg-primary-600 text-white shadow-sm font-semibold' 
      : 'bg-white text-primary-700 shadow-sm font-semibold';
  const hLinkInactive = isCustomWallpaper
      ? 'bg-white/60 text-gray-700 hover:bg-white hover:text-primary-600 backdrop-blur-sm'
      : 'bg-primary-600/40 text-white hover:bg-primary-600/60 backdrop-blur-sm';

  // 4. 生成动态内容
  // Vertical Menu Links (Sidebar)
  const catalogLinkMarkup = catalogsWithMeta.map((catObj) => {
    const cat = catObj.name;
    const catId = catObj.id || '';
    const safeCat = escapeHTML(cat);
    const encodedCat = encodeURIComponent(cat);
    const isActive = catalogExists && cat === currentCatalog;
    const linkClass = isActive ? 'bg-secondary-100 text-primary-700' : 'hover:bg-gray-100';
    const iconClass = isActive ? 'text-primary-600' : 'text-gray-400';
    return `
      <a href="?catalog=${encodedCat}" data-id="${catId}" class="flex items-center px-3 py-2 rounded-lg ${linkClass} w-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        ${safeCat}
      </a>
    `;
  }).join('');
  
  // Horizontal Menu Links (Top)
  const horizontalCatalogMarkup = catalogsWithMeta.map((catObj) => {
    const cat = catObj.name;
    const catId = catObj.id || '';
    const safeCat = escapeHTML(cat);
    const encodedCat = encodeURIComponent(cat);
    const isActive = catalogExists && cat === currentCatalog;
    const linkClass = isActive ? hLinkActive : hLinkInactive;
    
    return `
      <a href="?catalog=${encodedCat}" data-id="${catId}" class="menu-item inline-flex items-center px-4 py-2 rounded-full text-sm transition-all duration-200 whitespace-nowrap ${linkClass}">
        ${safeCat}
      </a>
    `;
  }).join('');
  
  // Add "All" link to horizontal menu
  const allLinkActive = !catalogExists;
  const allLinkClass = allLinkActive ? hLinkActive : hLinkInactive;
  const horizontalAllLink = `
      <a href="?catalog=all" class="menu-item inline-flex items-center px-4 py-2 rounded-full text-sm transition-all duration-200 whitespace-nowrap ${allLinkClass}">
        全部
      </a>
  `;

  const sitesGridMarkup = currentSites.map((site) => {
    const rawName = site.name || '未命名';
    const rawCatalog = site.catelog || '未分类';
    const rawDesc = site.desc || '暂无描述';
    const normalizedUrl = sanitizeUrl(site.url);
    const hrefValue = escapeHTML(normalizedUrl || '#');
    const displayUrlText = normalizedUrl || site.url || '';
    const safeDisplayUrl = displayUrlText ? escapeHTML(displayUrlText) : '未提供链接';
    const dataUrlAttr = escapeHTML(normalizedUrl || '');
    const logoUrl = sanitizeUrl(site.logo);
    const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());
    const safeName = escapeHTML(rawName);
    const safeCatalog = escapeHTML(rawCatalog);
    const safeDesc = escapeHTML(rawDesc);
    const safeDataName = escapeHTML(site.name || '');
    const safeDataCatalog = escapeHTML(site.catelog || '');
    const hasValidUrl = Boolean(normalizedUrl);

    // Conditional HTML parts
    const descHtml = layoutHideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;
    const linksHtml = layoutHideLinks ? '' : `
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-primary-600 truncate max-w-[140px]" title="${safeDisplayUrl}">${safeDisplayUrl}</span>
            <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} rounded-full text-xs font-medium transition-colors" data-url="${dataUrlAttr}" ${hasValidUrl ? '' : 'disabled'}>
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
      <div class="${baseCardClass} ${frostedClass}" data-id="${site.id}" data-name="${safeDataName}" data-url="${dataUrlAttr}" data-catalog="${safeDataCatalog}">
        <div class="p-5">
          <a href="${hrefValue}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
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

  // 生成动态网格类名 (移动端默认 2 列，gap-3)
  let gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6';
  if (layoutGridCols === '5') {
      gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6';
  }

  const datalistOptions = catalogs.map((cat) => `<option value="${escapeHTML(cat)}">`).join('');
  const headingPlainText = catalogExists
    ? `${currentCatalog} · ${currentSites.length} 个网站`
    : `全部收藏 · ${sites.length} 个网站`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalog) : '';
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
  const submissionClass = submissionEnabled ? '' : 'hidden';

  const siteName = env.SITE_NAME || '灰色轨迹';
  const siteDescription = env.SITE_DESCRIPTION || '一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建';
  const footerText = env.FOOTER_TEXT || '曾梦想仗剑走天涯';
  
  // Conditional Title/Subtitle HTML
  const mainTitleHtml = layoutHideTitle ? '' : `<h1 class="mt-4 text-3xl md:text-4xl font-semibold tracking-tight ${titleColorClass}">{{SITE_NAME}}</h1>`;
  const subtitleHtml = layoutHideSubtitle ? '' : `<p class="mt-3 text-sm md:text-base ${subTextColorClass} leading-relaxed">{{SITE_DESCRIPTION}}</p>`;
  
  const horizontalTitleHtml = layoutHideTitle ? '' : `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${titleColorClass}">{{SITE_NAME}}</h1>`;
  const horizontalSubtitleHtml = layoutHideSubtitle ? '' : `<p class="${subTextColorClass} opacity-90 text-sm md:text-base">{{SITE_DESCRIPTION}}</p>`;

  // Define Header Contents
  const verticalHeaderContent = `
      <div class="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div class="flex-1 text-center md:text-left">
          <span class="inline-flex items-center gap-2 rounded-full bg-primary-600/70 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-secondary-200/80">
            精选 · 真实 · 有温度
          </span>
          ${mainTitleHtml}
          ${subtitleHtml}
        </div>
        <div class="w-full md:w-auto flex justify-center md:justify-end">
          <div class="rounded-2xl bg-white/10 backdrop-blur-md px-6 py-5 shadow-lg border border-white/10 text-left md:text-right">
            <p class="text-xs uppercase tracking-[0.28em] text-secondary-100/70">Current Overview</p>
            <span class="mt-3 text-2xl font-semibold ${isCustomWallpaper ? 'text-gray-800' : 'text-white'}">{{TOTAL_SITES}}</span>
            <span class="text-sm text-secondary-100/85">条书签 ·<span class="mt-3 text-2xl font-semibold ${isCustomWallpaper ? 'text-gray-800' : 'text-white'}"> {{CATALOG_COUNT}}</span> 个分类</span>
            <p class="mt-2 text-xs text-secondary-100/60">每日人工维护,确保链接状态可用、内容可靠。</p>
          </div>
        </div>
      </div>`;
      
  const horizontalHeaderContent = `
      <div class="max-w-4xl mx-auto text-center relative z-10">
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
            <div id="horizontalCategoryNav" class="flex flex-wrap justify-center gap-3 overflow-hidden" style="max-height: 48px;">
                ${horizontalAllLink}
                ${horizontalCatalogMarkup}
            </div>
            <div id="horizontalMoreBtnContainer" class="hidden absolute right-0 top-0 h-full flex items-center justify-center pl-2">
                 <button id="horizontalMoreBtn" class="p-2 rounded-full shadow-sm transition-colors ${hLinkInactive}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                 </button>
            </div>
            <!-- Dropdown Menu -->
            <div id="horizontalMoreDropdown" class="hidden absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 grid gap-1">
                <!-- Dropdown items will be moved here by JS -->
            </div>
        </div>
      </div>
  `;

  // Determine Layout Classes
  let sidebarClass = '';
  let mainClass = 'lg:ml-64';
  let sidebarToggleClass = '';
  let mobileToggleVisibilityClass = 'lg:hidden';
  let githubIconHtml = '';
  let headerContent = verticalHeaderContent;

  if (layoutMenuLayout === 'horizontal') {
      sidebarClass = 'min-[550px]:hidden'; // Visible on mobile, hidden on 550px+
      mainClass = ''; // Full width
      sidebarToggleClass = '!hidden'; // Toggle hidden on 550px+
      mobileToggleVisibilityClass = 'min-[550px]:hidden';
      
      // GitHub Icon for Desktop (Horizontal Layout)
      githubIconHtml = `
      <a href="https://slink.661388.xyz/iori-nav" target="_blank" class="fixed top-4 left-4 z-50 hidden min-[550px]:flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-black transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
      </a>
      `;

      headerContent = `
        <div class="min-[550px]:hidden">
            ${verticalHeaderContent}
        </div>
        <div class="hidden min-[550px]:block relative">
            ${horizontalHeaderContent}
        </div>
      `;
  }
  
  // Construct Left Top Action HTML
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

  // Footer & Hitokoto Styles
  const footerClass = isCustomWallpaper
      ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none text-black'
      : 'bg-white py-8 px-6 mt-12 border-t border-primary-100';
      
  const hitokotoClass = isCustomWallpaper ? 'text-black' : 'text-gray-500';

  // 5. 读取 HTML 模板并替换占位符
  const templateResponse = await env.ASSETS.fetch(new URL('/index.html', request.url));
  let html = await templateResponse.text();
  
  // 自定义壁纸逻辑
  const safeWallpaperUrl = sanitizeUrl(layoutCustomWallpaper);
  if (safeWallpaperUrl) {
      const blurStyle = layoutEnableBgBlur ? `filter: blur(${layoutBgBlurIntensity}px);` : '';
      // 使用单独的 div 作为背景层，以便在不影响内容的情况下应用虚化滤镜
      const bgLayerHtml = `<div style="position: fixed; inset: 0; z-index: -10; background-image: url('${safeWallpaperUrl}'); background-size: cover; background-attachment: fixed; background-position: center; ${blurStyle}"></div>`;
      
      html = html.replace('<body class="bg-secondary-50 font-sans text-gray-800">', `<body class="bg-secondary-50 font-sans text-gray-800 relative">${bgLayerHtml}`);
  }
  
  // 注入毛玻璃效果的 CSS 变量
  if (layoutEnableFrostedGlass) {
      const cssVarInjection = `<style>:root { --frosted-glass-blur: ${layoutFrostedGlassIntensity}px; }</style>`;
      html = html.replace('</head>', `${cssVarInjection}</head>`);
  }

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
    .replace('{{TOTAL_SITES}}', totalSites)
    .replace('{{CATALOG_COUNT}}', catalogs.length)
    .replace('{{HEADING_TEXT}}', headingText)
    .replace('{{HEADING_DEFAULT}}', headingDefaultAttr)
    .replace('{{HEADING_ACTIVE}}', headingActiveAttr)
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