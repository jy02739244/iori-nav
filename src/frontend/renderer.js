import { escapeHTML, sanitizeUrl } from '../utils/html.js';
import { normalizeSortOrder } from '../utils/sort.js';
import { isSubmissionEnabled } from '../admin/auth.js';
import frontendTemplate from '../templates/frontend.html';

export async function handleFrontendRequest(request, env, ctx) {
  const url = new URL(request.url);
  const catalog = url.searchParams.get('catalog');

  let sites = [];
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC').all();
    sites = results;
  } catch (e) {
    return new Response(`Failed to fetch data: ${e.message}`, { status: 500 });
  }

  if (!sites || sites.length === 0) {
    return new Response('No site configuration found.', { status: 404 });
  }

  const totalSites = sites.length;

  // Build category data
  const categoryMinSort = new Map();
  const categorySet = new Set();
  sites.forEach((site) => {
    const name = (site.catelog || '').trim() || '未分类';
    categorySet.add(name);
    const raw = Number(site.sort_order);
    const normalized = Number.isFinite(raw) ? raw : 9999;
    if (!categoryMinSort.has(name) || normalized < categoryMinSort.get(name)) {
      categoryMinSort.set(name, normalized);
    }
  });

  const categoryOrderMap = new Map();
  try {
    const { results: orderRows } = await env.NAV_DB.prepare('SELECT catelog, sort_order FROM category_orders').all();
    orderRows.forEach(row => categoryOrderMap.set(row.catelog, normalizeSortOrder(row.sort_order)));
  } catch (error) {
    if (!/no such table/i.test(error.message || '')) {
      return new Response(`Failed to fetch category orders: ${error.message}`, { status: 500 });
    }
  }

  const catalogsWithMeta = Array.from(categorySet).map((name) => {
    const fallbackSort = categoryMinSort.has(name) ? normalizeSortOrder(categoryMinSort.get(name)) : 9999;
    const order = categoryOrderMap.has(name) ? categoryOrderMap.get(name) : fallbackSort;
    return { name, order, fallback: fallbackSort };
  });

  catalogsWithMeta.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.fallback !== b.fallback) return a.fallback - b.fallback;
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base' });
  });

  const catalogs = catalogsWithMeta.map(item => item.name);

  const requestedCatalog = (catalog || '').trim();
  const catalogExists = Boolean(requestedCatalog && catalogs.includes(requestedCatalog));
  const currentCatalog = catalogExists ? requestedCatalog : catalogs[0];
  const currentSites = catalogExists
    ? sites.filter(s => ((s.catelog || '').trim() || '未分类') === currentCatalog)
    : sites;

  const catalogLinkMarkup = catalogs.map((cat) => {
    const safeCat = escapeHTML(cat);
    const encodedCat = encodeURIComponent(cat);
    const isActive = catalogExists && cat === currentCatalog;
    const linkClass = isActive ? 'bg-secondary-100 text-primary-700' : 'hover:bg-gray-100';
    const iconClass = isActive ? 'text-primary-600' : 'text-gray-400';
    return `<a href="?catalog=${encodedCat}" class="flex items-center px-3 py-2 rounded-lg ${linkClass} w-full">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>${safeCat}</a>`;
  }).join('');

  const datalistOptions = catalogs.map(cat => `<option value="${escapeHTML(cat)}">`).join('');
  const headingPlainText = catalogExists
    ? `${currentCatalog} · ${currentSites.length} 个网站`
    : `全部收藏 · ${sites.length} 个网站`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalog) : '';
  const submissionEnabled = isSubmissionEnabled(env);

  // Render site cards
  const siteCardsHtml = currentSites.map((site) => {
    const rawName = site.name || '未命名';
    const rawDesc = site.desc || '暂无描述';
    const normalizedUrl = sanitizeUrl(site.url);
    const hrefValue = escapeHTML(normalizedUrl || '#');
    const displayUrlText = normalizedUrl || site.url || '';
    const safeDisplayUrl = displayUrlText ? escapeHTML(displayUrlText) : '未提供链接';
    const dataUrlAttr = escapeHTML(normalizedUrl || '');
    const logoUrl = sanitizeUrl(site.logo);
    const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());
    const safeName = escapeHTML(rawName);
    const safeCatalog = escapeHTML(site.catelog || '未分类');
    const safeDesc = escapeHTML(rawDesc);
    const safeDataName = escapeHTML(site.name || '');
    const safeDataCatalog = escapeHTML(site.catelog || '');
    const hasValidUrl = Boolean(normalizedUrl);
    return `<div class="site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 overflow-hidden" data-id="${site.id}" data-name="${safeDataName}" data-url="${dataUrlAttr}" data-catalog="${safeDataCatalog}">
  <div class="p-4 sm:p-5">
    <a href="${hrefValue}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
      <div class="flex items-start">
        <div class="flex-shrink-0 mr-3 sm:mr-4">
          ${logoUrl
            ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover bg-gray-100">`
            : `<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-base sm:text-lg shadow-inner">${cardInitial}</div>`
          }
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm sm:text-base font-medium text-gray-900 truncate" title="${safeName}">${safeName}</h3>
          <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700">${safeCatalog}</span>
        </div>
      </div>
      <p class="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>
    </a>
    <div class="mt-2 sm:mt-3 flex items-center justify-between">
      <span class="text-xs text-primary-600 truncate max-w-[140px]" title="${safeDisplayUrl}">${safeDisplayUrl}</span>
      <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} rounded-full text-xs font-medium transition-colors" data-url="${dataUrlAttr}" ${hasValidUrl ? '' : 'disabled'}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>复制
        <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
      </button>
    </div>
  </div>
</div>`;
  }).join('');

  const html = buildPageHtml({
    totalSites, catalogs, catalogExists, catalogLinkMarkup,
    datalistOptions, headingText, headingDefaultAttr, headingActiveAttr,
    submissionEnabled, siteCardsHtml
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function buildPageHtml({ totalSites, catalogs, catalogExists, catalogLinkMarkup, datalistOptions, headingText, headingDefaultAttr, headingActiveAttr, submissionEnabled, siteCardsHtml }) {
  return renderTemplate(frontendTemplate, {
    ALL_LINK_CLASS: catalogExists ? 'hover:bg-gray-100' : 'bg-secondary-100 text-primary-700',
    ALL_ICON_CLASS: catalogExists ? 'text-gray-400' : 'text-primary-600',
    CATALOG_LINKS: catalogLinkMarkup,
    SUBMISSION_ACTION: buildSubmissionActionHtml(submissionEnabled),
    TOTAL_SITES: String(totalSites),
    CATALOG_COUNT: String(catalogs.length),
    HEADING_DEFAULT_ATTR: headingDefaultAttr,
    HEADING_ACTIVE_ATTR: headingActiveAttr,
    HEADING_TEXT: headingText,
    SITE_CARDS: siteCardsHtml,
    CURRENT_YEAR: String(new Date().getFullYear()),
    ADD_SITE_MODAL: buildAddSiteModalHtml(submissionEnabled, datalistOptions),
  });
}

function buildSubmissionActionHtml(submissionEnabled) {
  return submissionEnabled ? `<button id="addSiteBtnSidebar" class="w-full flex items-center justify-center px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>添加新书签
        </button>` : `<div class="w-full px-4 py-3 text-xs text-primary-600 bg-white border border-secondary-100 rounded-lg">访客书签提交功能已关闭</div>`;
}

function buildAddSiteModalHtml(submissionEnabled, datalistOptions) {
  if (!submissionEnabled) return '';
  return `<div id="addSiteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 opacity-0 invisible transition-all duration-300">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform translate-y-8 transition-all duration-300">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-gray-900">添加新书签</h2>
          <button id="closeModal" class="text-gray-400 hover:text-gray-500"><svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <form id="addSiteForm" class="space-y-4">
          <div><label for="addSiteName" class="block text-sm font-medium text-gray-700">名称</label><input type="text" id="addSiteName" required class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"></div>
          <div><label for="addSiteUrl" class="block text-sm font-medium text-gray-700">网址</label><input type="text" id="addSiteUrl" required class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"></div>
          <div><label for="addSiteLogo" class="block text-sm font-medium text-gray-700">Logo (可选)</label><input type="text" id="addSiteLogo" class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"></div>
          <div><label for="addSiteDesc" class="block text-sm font-medium text-gray-700">描述 (可选)</label><textarea id="addSiteDesc" rows="2" class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"></textarea></div>
          <div><label for="addSiteCatelog" class="block text-sm font-medium text-gray-700">分类</label><input type="text" id="addSiteCatelog" required class="mt-1 block w-full px-3 py-2 border border-primary-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400" list="catalogList"><datalist id="catalogList">${datalistOptions}</datalist></div>
          <div class="flex justify-end pt-4">
            <button type="button" id="cancelAddSite" class="bg-white py-2 px-4 border border-primary-100 rounded-md shadow-sm text-sm font-medium text-primary-600 hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-200 mr-3">取消</button>
            <button type="submit" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-accent-500 hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-400">提交</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function renderTemplate(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}
