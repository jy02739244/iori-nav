// functions/index.js
import { isAdminAuthenticated, getHomeCacheKey, isHomeCacheDirty, clearHomeCacheDirty, markHomeCacheDirty, getHomeCacheDirtyValue } from './_middleware';
import { FONT_MAP, HOME_CACHE_TTL } from './constants';
import { escapeHTML, sanitizeUrl, normalizeSortOrder, getStyleStr } from './lib/utils';
import { getSettingsKeys, parseSettings } from './lib/settings-parser';
import { renderHorizontalMenu, renderVerticalMenu } from './lib/menu-renderer';
import { renderSiteCards, renderEmptyState } from './lib/card-renderer';

function getThemeClasses(isCustomWallpaper) {
  return isCustomWallpaper ? {
    headerClass: 'bg-transparent border-none shadow-none transition-colors duration-300',
    containerClass: 'rounded-2xl',
    titleColorClass: 'text-gray-900 dark:text-gray-100',
    subTextColorClass: 'text-gray-600 dark:text-gray-300',
    searchInputClass: 'bg-white/90 backdrop-blur border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-primary-200 focus:border-primary-400 focus:bg-white dark:bg-gray-800/90 dark:border-gray-600 dark:text-gray-200 dark:focus:bg-gray-800',
    searchIconClass: 'text-gray-400 dark:text-gray-500',
  } : {
    headerClass: 'bg-primary-700 text-white border-b border-primary-600 shadow-sm dark:bg-gray-900 dark:border-gray-800',
    containerClass: 'rounded-2xl border border-primary-100/60 bg-white/80 backdrop-blur-sm shadow-sm dark:bg-gray-800/80 dark:border-gray-700',
    titleColorClass: 'text-white',
    subTextColorClass: 'text-primary-100/90 dark:text-gray-400',
    searchInputClass: 'bg-white/15 text-white placeholder-primary-200 focus:ring-white/30 focus:bg-white/20 border-none dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder-gray-500',
    searchIconClass: 'text-primary-200 dark:text-gray-500',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const isAuthenticated = await isAdminAuthenticated(request, env);
  const includePrivate = isAuthenticated ? 1 : 0;

  // === 1. 缓存检查 ===
  const url = new URL(request.url);
  const isHomePage = url.pathname === '/' && !url.search;
  const cacheScope = isAuthenticated ? 'private' : 'public';
  const homeCacheKey = getHomeCacheKey(cacheScope);
  const cookies = request.headers.get('Cookie') || '';
  const hasLegacyStaleCookie = cookies.includes('iori_cache_stale=1');
  const hasPublicStaleCookie = hasLegacyStaleCookie || cookies.includes('iori_cache_public_stale=1');
  const hasPrivateStaleCookie = hasLegacyStaleCookie || cookies.includes('iori_cache_private_stale=1');
  let shouldClearCookie = false;
  let cacheDirty = false;
  let cacheDirtyValue = null;

  if (isHomePage) {
    if (isAuthenticated && (hasPublicStaleCookie || hasPrivateStaleCookie)) {
      if (hasPublicStaleCookie && hasPrivateStaleCookie) {
        await markHomeCacheDirty(env, 'all');
      } else if (hasPublicStaleCookie) {
        await markHomeCacheDirty(env, 'public');
      } else {
        await markHomeCacheDirty(env, 'private');
      }
      shouldClearCookie = true;
    }

    cacheDirtyValue = await getHomeCacheDirtyValue(env, cacheScope);
    cacheDirty = !!cacheDirtyValue;

    if (!cacheDirty) {
      try {
        const cachedHtml = await env.NAV_AUTH.get(homeCacheKey);
        if (cachedHtml) {
          const response = new Response(cachedHtml, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Cache': 'HIT' }
          });

          if (shouldClearCookie) {
            response.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0; SameSite=Lax');
            response.headers.append('Set-Cookie', 'iori_cache_public_stale=; Path=/; Max-Age=0; SameSite=Lax');
            response.headers.append('Set-Cookie', 'iori_cache_private_stale=; Path=/; Max-Age=0; SameSite=Lax');
          }

          return response;
        }
      } catch (e) {
        console.warn('Failed to read home cache:', e);
      }
    }
  }

  // === 2. 并行执行数据库查询 + 模板获取 ===
  const categoryQuery = isAuthenticated
    ? 'SELECT * FROM category ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM category WHERE is_private = 0 ORDER BY sort_order ASC, id ASC';

  const settingsKeys = getSettingsKeys();
  const settingsPlaceholders = settingsKeys.map(() => '?').join(',');
  const sitesQuery = `SELECT id, name, url, logo, desc, catelog_id, catelog_name, sort_order, is_private, create_time, update_time
                      FROM sites WHERE (is_private = 0 OR ? = 1) ORDER BY sort_order ASC, create_time DESC`;

  // Settings 缓存：优先从 KV 读取，减少数据库查询
  const settingsCacheKey = 'settings_cache';
  const fetchSettings = async () => {
    try {
      const cached = await env.NAV_AUTH.get(settingsCacheKey, { type: 'json' });
      if (cached) return { results: cached, fromCache: true };
    } catch (e) {
      console.warn('Settings cache read failed:', e);
    }
    const result = await env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${settingsPlaceholders})`).bind(...settingsKeys).all();
    // 异步写入缓存，1h TTL
    if (result.results && env.NAV_AUTH) {
      context.waitUntil(env.NAV_AUTH.put(settingsCacheKey, JSON.stringify(result.results), { expirationTtl: 3600 }));
    }
    return result;
  };

  const [categoriesResult, settingsResult, sitesResult, templateResponse] = await Promise.all([
    env.NAV_DB.prepare(categoryQuery).all().catch(e => ({ results: [], error: e })),
    fetchSettings().catch(e => ({ results: [], error: e })),
    env.NAV_DB.prepare(sitesQuery).bind(includePrivate).all().catch(e => ({ results: [], error: e })),
    env.ASSETS.fetch(new URL('/index.html', request.url))
  ]);

  // === 3. 处理分类结果 — 构建分类树 ===
  let categories = categoriesResult.results || [];
  if (categoriesResult.error) console.error('Failed to fetch categories:', categoriesResult.error);

  const categoryMap = new Map();
  const categoryIdMap = new Map();
  const rootCategories = [];

  categories.forEach(cat => {
    cat.children = [];
    cat.sort_order = normalizeSortOrder(cat.sort_order);
    categoryMap.set(cat.id, cat);
    if (cat.catelog) categoryIdMap.set(cat.catelog, cat.id);
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

  // === 4. 解析设置 ===
  const S = parseSettings(settingsResult.results || settingsResult);

  // === 5. 处理站点结果 ===
  let allSites = sitesResult.results || [];
  if (sitesResult.error) return new Response(`Failed to fetch sites: ${sitesResult.error.message}`, { status: 500 });

  // === 6. 确定目标分类 ===
  let requestedCatalogName = (url.searchParams.get('catalog') || '').trim();

  // 共享首页缓存仅基于稳定的默认分类渲染，避免用户的 iori_last_category
  // 影响公共 KV HTML。记住上次分类的恢复逻辑仅在前端执行。
  if (!requestedCatalogName) {
    const defaultCat = (S.home_default_category || '').trim();
    if (defaultCat && categoryIdMap.has(defaultCat)) requestedCatalogName = defaultCat;
  }

  let targetCategoryIds = [];
  let currentCatalogName = '';
  const catalogExists = requestedCatalogName && categoryIdMap.has(requestedCatalogName);

  if (catalogExists) {
    const rootId = categoryIdMap.get(requestedCatalogName);
    currentCatalogName = requestedCatalogName;
    targetCategoryIds.push(rootId);
  }

  const sites = targetCategoryIds.length > 0
    ? allSites.filter(site => targetCategoryIds.includes(site.catelog_id))
    : allSites;

  // === 7. 壁纸处理 ===
  // 壁纸 URL 直接使用设置中的 layout_custom_wallpaper，可被 KV 正常缓存
  const isCustomWallpaper = Boolean(S.layout_custom_wallpaper);
  const themeClass = isCustomWallpaper ? 'custom-wallpaper' : '';

  // === 8. 计算主题样式 ===
  const themeClasses = getThemeClasses(isCustomWallpaper);
  const { headerClass, containerClass, titleColorClass, subTextColorClass, searchInputClass, searchIconClass } = themeClasses;

  // === 9. 生成菜单 HTML ===
  const allLinkActive = !catalogExists;
  const allLinkClass = allLinkActive ? 'active' : 'inactive';
  const allLinkActiveMarker = allLinkActive ? 'nav-item-active' : '';
  const horizontalAllLink = `
    <div class="menu-item-wrapper relative inline-block text-left">
      <a href="?catalog=all" class="nav-btn ${allLinkClass} ${allLinkActiveMarker}">全部</a>
    </div>`;
  const horizontalCatalogMarkup = horizontalAllLink + renderHorizontalMenu(rootCategories, currentCatalogName);
  const catalogLinkMarkup = renderVerticalMenu(rootCategories, currentCatalogName, isCustomWallpaper);

  // === 10. 生成站点卡片 HTML ===
  let sitesGridMarkup = sites.length > 0
    ? renderSiteCards(sites, S)
    : renderEmptyState(categories.length, S.home_hide_admin);

  // === 11. 计算 Grid 列数 ===
  let gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 justify-items-center';
  if (S.layout_grid_cols === '5') {
    gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 justify-items-center';
  } else if (S.layout_grid_cols === '6') {
    gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-[1200px]:grid-cols-6 gap-3 sm:gap-6 justify-items-center';
  } else if (S.layout_grid_cols === '7') {
    gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 sm:gap-6 justify-items-center';
  }

  // === 12. 计算文本和统计信息 ===
  const datalistOptions = categories.map(cat => `<option value="${escapeHTML(cat.catelog)}">`).join('');
  const headingPlainText = currentCatalogName ? `${currentCatalogName} · ${sites.length} 个书签` : `全部收藏 · ${sites.length} 个书签`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalogName) : '';
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
  const submissionClass = submissionEnabled ? '' : 'hidden';
  const siteName = S.home_site_name || env.SITE_NAME || '灰色轨迹';
  const siteDescription = S.home_site_description || env.SITE_DESCRIPTION || '一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建';
  const footerText = env.FOOTER_TEXT || '曾梦想仗剑走天涯';
  const titleStyle = getStyleStr(S.home_title_size, S.home_title_color, S.home_title_font);
  const subtitleStyle = getStyleStr(S.home_subtitle_size, S.home_subtitle_color, S.home_subtitle_font);
  const statsStyle = getStyleStr(S.home_stats_size, S.home_stats_color, S.home_stats_font);
  const hitokotoStyle = getStyleStr(S.home_hitokoto_size, S.home_hitokoto_color, S.home_hitokoto_font);
  const hitokotoContent = S.home_hide_hitokoto ? '' : '疏影横斜水清浅,暗香浮动月黄昏。';
  const shouldRenderStatsRow = !S.home_hide_stats || !S.home_hide_hitokoto;
  const statsRowPyClass = shouldRenderStatsRow ? 'my-8' : 'hidden';
  const statsRowHiddenClass = shouldRenderStatsRow ? '' : 'hidden';

  // === 13. 搜索引擎选项 ===
  const searchEngineOptions = S.home_search_engine_enabled ? `
    <div class="flex justify-center items-center gap-3 mb-4 text-sm select-none search-engine-wrapper">
        <label class="search-engine-option active" data-engine="local"><span>站内</span></label>
        <label class="search-engine-option" data-engine="google"><span>Google</span></label>
        <label class="search-engine-option" data-engine="baidu"><span>Baidu</span></label>
        <label class="search-engine-option" data-engine="github"><span>GitHub</span></label>
    </div>` : '';

  // === 14. Header HTML ===
  const safeSiteName = escapeHTML(siteName);
  const safeSiteDesc = escapeHTML(siteDescription);
  const horizontalTitleHtml = S.layout_hide_title ? '' : `<h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-3 ${titleColorClass}" ${titleStyle}>${safeSiteName}</h1>`;
  const horizontalSubtitleHtml = S.layout_hide_subtitle ? '' : `<p class="${subTextColorClass} opacity-90 text-sm md:text-base" ${subtitleStyle}>${safeSiteDesc}</p>`;

  const verticalHeaderContent = `
    <div class="max-w-4xl mx-auto text-center relative z-10 ${themeClass} py-8">
      <div class="mb-8">${horizontalTitleHtml}${horizontalSubtitleHtml}</div>
      <div class="relative max-w-xl mx-auto">
        ${searchEngineOptions}
        <div class="relative">
          <input type="text" name="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
    </div>`;

  const horizontalHeaderContent = `
    <div class="max-w-5xl mx-auto text-center relative z-10 ${themeClass}">
      <div class="max-w-4xl mx-auto mb-8">${horizontalTitleHtml}${horizontalSubtitleHtml}</div>
      <div class="relative max-w-xl mx-auto mb-8">
        ${searchEngineOptions}
        <div class="relative">
          <input id="headerSearchInput" type="text" name="search" placeholder="搜索书签..." class="search-input-target w-full pl-12 pr-4 py-3.5 rounded-2xl transition-all shadow-lg outline-none focus:outline-none focus:ring-2 ${searchInputClass}" autocomplete="off">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 absolute left-4 top-3.5 ${searchIconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
      <div class="relative max-w-5xl mx-auto">
        <div id="horizontalCategoryNav" class="flex flex-wrap justify-center items-center gap-3 overflow-hidden transition-all duration-300" style="max-height: 60px;">
          ${horizontalCatalogMarkup}
          <div id="horizontalMoreWrapper" class="relative hidden">
            <button id="horizontalMoreBtn" class="nav-btn inactive">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
            </button>
            <div id="horizontalMoreDropdown" class="dropdown-menu hidden absolute mt-2 w-auto z-50"></div>
          </div>
        </div>
      </div>
    </div>`;

  // === 15. 布局控制 ===
  let sidebarClass = '';
  let mainClass = 'lg:ml-64';
  let sidebarToggleClass = '';
  let mobileToggleVisibilityClass = 'lg:hidden';
  let githubIconHtml = '';
  let adminIconHtml = '';
  const themeIconHtml = `
    <button id="themeToggleBtn" class="flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-amber-500 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-yellow-300 transition-all cursor-pointer" title="切换主题">
      <svg id="themeIconSun" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block dark:hidden"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
      <svg id="themeIconMoon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </button>`;

  let headerContent = verticalHeaderContent;

  if (S.layout_menu_layout === 'horizontal') {
    sidebarClass = 'min-[550px]:hidden';
    mainClass = '';
    sidebarToggleClass = '!hidden';
    mobileToggleVisibilityClass = 'min-[550px]:hidden';

    if (!S.home_hide_github) {
      githubIconHtml = `
        <a href="https://slink.661388.xyz/iori-nav" target="_blank" class="fixed top-4 left-4 z-50 hidden min-[550px]:flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-black dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-white transition-all" title="GitHub">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
        </a>`;
    }
    if (!S.home_hide_admin) {
      adminIconHtml = `
        <a href="/admin" target="_blank" class="flex items-center justify-center p-2 rounded-lg bg-white/80 backdrop-blur shadow-md hover:bg-white text-gray-700 hover:text-primary-600 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:text-primary-400 transition-all" title="后台管理">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M7 18a5 5 0 0 1 10 0"/></path></svg>
        </a>`;
    }

    headerContent = `
      <div class="min-[550px]:hidden">${verticalHeaderContent}</div>
      <div class="hidden min-[550px]:block">${horizontalHeaderContent}</div>`;
  }

  const topRightActionsHtml = `<div class="fixed top-4 right-4 z-50 flex items-center gap-3">${themeIconHtml}${adminIconHtml}</div>`;
  const leftTopActionHtml = `
    <div class="fixed top-4 left-4 z-50 ${mobileToggleVisibilityClass}">
      <button id="sidebarToggle" class="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    </div>
    ${githubIconHtml}`;

  const footerClass = isCustomWallpaper
    ? 'bg-transparent py-8 px-6 mt-12 border-none shadow-none text-black dark:text-gray-200'
    : 'bg-white py-8 px-6 mt-12 border-t border-primary-100 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400';
  const hitokotoClass = (isCustomWallpaper ? 'text-black dark:text-gray-200' : 'text-gray-500 dark:text-gray-400') + ' ml-auto';

  // === 16. 模板注入 ===
  let html = await templateResponse.text();

  // --- 收集所有 </head> 注入内容（合并为一次替换） ---
  let headInjections = '';

  // 注入隐藏图标的 CSS
  if (S.home_hide_github || S.home_hide_admin) {
    let hideIconsCss = '<style>';
    if (S.home_hide_github) hideIconsCss += 'a[title="GitHub"] { display: none !important; }';
    if (S.home_hide_admin) hideIconsCss += 'a[href^="/admin"] { display: none !important; }';
    hideIconsCss += '</style>';
    headInjections += hideIconsCss;
  }

  // 背景层 HTML
  const safeWallpaperUrl = sanitizeUrl(S.layout_custom_wallpaper);
  const defaultBgColor = '#fdf8f3';
  let bgLayerHtml = '';
  if (safeWallpaperUrl) {
    const blurStyle = S.layout_enable_bg_blur ? `filter: blur(${S.layout_bg_blur_intensity}px); transform: scale(1.02);` : '';
    bgLayerHtml = `<div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; overflow: hidden;"><img src="${safeWallpaperUrl}" alt="" fetchpriority="high" style="width: 100%; height: 100%; object-fit: cover; ${blurStyle}" /></div>`;
  } else {
    bgLayerHtml = `<div id="fixed-background" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -9999; pointer-events: none; background-color: ${defaultBgColor};"></div>`;
  }

  // 壁纸预加载
  if (safeWallpaperUrl) {
    headInjections += `<link rel="preload" as="image" href="${safeWallpaperUrl}">\n`;
  }

  // 全局滚动样式
  headInjections += `<style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    #app-scroll { width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
    body { background-color: transparent !important; }
    #fixed-background { transition: background-color 0.3s ease, filter 0.3s ease; }
    @supports (-webkit-touch-callout: none) { #fixed-background { height: -webkit-fill-available; } }
  </style>`;

  // CSS 变量
  const cardRadius = parseInt(S.layout_card_border_radius) || 12;
  const frostedBlur = String(S.layout_frosted_glass_intensity || '15').replace(/[^0-9]/g, '') || '15';
  headInjections += `<style>:root { --card-padding: 1.25rem; --card-radius: ${cardRadius}px; --frosted-glass-blur: ${frostedBlur}px; }</style>`;

  // 自定义字体
  const usedFonts = new Set();
  if (!S.layout_hide_title && S.home_title_font) usedFonts.add(S.home_title_font);
  if (!S.layout_hide_subtitle && S.home_subtitle_font) usedFonts.add(S.home_subtitle_font);
  if (!S.home_hide_stats && S.home_stats_font) usedFonts.add(S.home_stats_font);
  if (!S.home_hide_hitokoto && S.home_hitokoto_font) usedFonts.add(S.home_hitokoto_font);
  if (S.card_title_font) usedFonts.add(S.card_title_font);
  if (S.card_desc_font) usedFonts.add(S.card_desc_font);

  let fontLinksHtml = '';
  let needsFontPreconnect = false;
  usedFonts.forEach(font => {
    if (font && FONT_MAP[font]) {
      fontLinksHtml += `<link rel="stylesheet" href="${FONT_MAP[font]}">`;
      needsFontPreconnect = true;
    }
  });
  const safeCustomFontUrl = sanitizeUrl(S.home_custom_font_url);
  if (safeCustomFontUrl) fontLinksHtml += `<link rel="stylesheet" href="${safeCustomFontUrl}">`;
  // 字体域名预连接（减少 DNS + TLS 延迟）
  if (needsFontPreconnect) headInjections += `<link rel="preconnect" href="https://fonts.loli.net" crossorigin>`;
  if (fontLinksHtml) headInjections += fontLinksHtml;

  // 卡片自定义字体 CSS
  let customCardCss = '';
  if (S.card_title_font || S.card_title_size || S.card_title_color) {
    const s = getStyleStr(S.card_title_size, S.card_title_color, S.card_title_font).replace('style="', '').replace('"', '');
    if (s) customCardCss += `.site-title { ${s} }`;
  }
  if (S.card_desc_font || S.card_desc_size || S.card_desc_color) {
    const s = getStyleStr(S.card_desc_size, S.card_desc_color, S.card_desc_font).replace('style="', '').replace('"', '');
    if (s) customCardCss += `.site-card p { ${s} }`;
  }
  if (customCardCss) headInjections += `<style>${customCardCss}</style>`;

  // 全局站点数据（精简字段，减小 HTML 体积）
  const searchData = allSites.map(s => ({ id: s.id, name: s.name, url: s.url, logo: s.logo, desc: s.desc, catelog_id: s.catelog_id, catelog_name: s.catelog_name }));
  const safeJson = JSON.stringify(searchData).replace(/</g, '\\u003c');
  headInjections += `<script>window.IORI_SITES = ${safeJson};</script>`;

  // 布局配置
  headInjections += `<script>
    window.IORI_LAYOUT_CONFIG = {
      hideDesc: ${S.layout_hide_desc}, hideLinks: ${S.layout_hide_links}, hideCategory: ${S.layout_hide_category},
      gridCols: "${S.layout_grid_cols}", cardStyle: "${S.layout_card_style}",
      enableFrostedGlass: ${S.layout_enable_frosted_glass}, rememberLastCategory: ${S.home_remember_last_category}
    };
  </script>`;

  // --- 一次性替换 </head> ---
  html = html.replace('</head>', headInjections + '</head>');

  // 替换 body 标签 + 滚动容器
  html = html.replace(
    '<body class="bg-secondary-50 font-sans text-gray-800">',
    `<body class="bg-secondary-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 relative ${isCustomWallpaper ? 'custom-wallpaper' : ''}">${bgLayerHtml}<div id="app-scroll">`
  );
  html = html.replace('</body>', '</div></body>');

  // 替换所有模板占位符（单次正则匹配 + 映射表）
  const replacements = {
    'HEADER_CONTENT': headerContent,
    'HEADER_CLASS': headerClass,
    'CONTAINER_CLASS': containerClass,
    'FOOTER_CLASS': footerClass,
    'HITOKOTO_CLASS': hitokotoClass,
    'LEFT_TOP_ACTION': leftTopActionHtml,
    'RIGHT_TOP_ACTION': topRightActionsHtml,
    'SITE_NAME': escapeHTML(siteName),
    'SITE_DESCRIPTION': escapeHTML(siteDescription),
    'FOOTER_TEXT': escapeHTML(footerText),
    'CATALOG_EXISTS': catalogExists ? 'true' : 'false',
    'CATALOG_LINKS': catalogLinkMarkup,
    'SUBMISSION_CLASS': submissionClass,
    'DATALIST_OPTIONS': datalistOptions,
    'TOTAL_SITES': String(sites.length),
    'CATALOG_COUNT': String(categories.length),
    'HEADING_TEXT': headingText,
    'HEADING_DEFAULT': headingDefaultAttr,
    'HEADING_ACTIVE': headingActiveAttr,
    'STATS_VISIBLE': S.home_hide_stats ? 'hidden' : '',
    'STATS_STYLE': statsStyle,
    'HITOKOTO_VISIBLE': S.home_hide_hitokoto ? 'hidden' : '',
    'STATS_ROW_PY_CLASS': statsRowPyClass,
    'STATS_ROW_MB_CLASS': '',
    'STATS_ROW_HIDDEN': statsRowHiddenClass,
    'HITOKOTO_CONTENT': hitokotoContent,
    'HITOKOTO_STYLE': hitokotoStyle,
    'SITES_GRID': sitesGridMarkup,
    'CURRENT_YEAR': String(new Date().getFullYear()),
    'SIDEBAR_CLASS': sidebarClass,
    'MAIN_CLASS': mainClass,
    'SIDEBAR_TOGGLE_CLASS': sidebarToggleClass,
  };
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key] ?? '');
  html = html.replace('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6', gridClass);

  // === 17. 返回响应 ===
  const response = new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });

  if (shouldClearCookie) {
    response.headers.append('Set-Cookie', 'iori_cache_stale=; Path=/; Max-Age=0; SameSite=Lax');
    response.headers.append('Set-Cookie', 'iori_cache_public_stale=; Path=/; Max-Age=0; SameSite=Lax');
    response.headers.append('Set-Cookie', 'iori_cache_private_stale=; Path=/; Max-Age=0; SameSite=Lax');
  }

  if (isHomePage) {
    context.waitUntil((async () => {
      try {
        await env.NAV_AUTH.put(homeCacheKey, html, { expirationTtl: HOME_CACHE_TTL });
        if (cacheDirty) {
          await clearHomeCacheDirty(env, cacheScope, cacheDirtyValue);
        }
      } catch (e) {
        console.warn('Failed to update home cache:', e);
      }
    })());
  }

  return response;
}
