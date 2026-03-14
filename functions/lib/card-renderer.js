// functions/lib/card-renderer.js
// 渲染站点卡片网格 HTML

import { escapeHTML, sanitizeUrl } from './utils';

/**
 * 渲染站点卡片网格 HTML
 * @param {Array} sites - 站点数据数组
 * @param {object} settings - 解析后的设置对象
 * @returns {string} 站点卡片 HTML 字符串
 */
export function renderSiteCards(sites, settings) {
  const {
    layout_hide_desc: hideDesc,
    layout_hide_links: hideLinks,
    layout_hide_category: hideCategory,
    layout_enable_frosted_glass: enableFrostedGlass,
    layout_card_style: cardStyle,
    layout_grid_cols: gridCols,
  } = settings;

  const frostedClass = enableFrostedGlass ? 'frosted-glass-effect' : '';
  const cardStyleClass = cardStyle === 'style2' ? 'style-2' : '';
  const baseCardClass = enableFrostedGlass
    ? 'site-card group h-full flex flex-col overflow-hidden transition-all'
    : 'site-card group h-full flex flex-col bg-white border border-primary-100/60 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700';
  const numericGridCols = Number(gridCols) || 4;
  const hideCopyText = numericGridCols >= 5;

  // 批量预处理站点数据，减少循环内重复调用
  const processed = sites.map(site => {
    const rawName = site.name || '未命名';
    const normalizedUrl = sanitizeUrl(site.url);
    return {
      site,
      safeName: escapeHTML(rawName),
      safeCatalog: escapeHTML(site.catelog_name || '未分类'),
      safeDesc: escapeHTML(site.desc || '暂无描述'),
      normalizedUrl,
      safeDisplayUrl: normalizedUrl || '未提供链接',
      logoUrl: sanitizeUrl(site.logo),
      cardInitial: escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase()),
      hasValidUrl: Boolean(normalizedUrl),
    };
  });

  return processed.map(({ site, safeName, safeCatalog, safeDesc, normalizedUrl, safeDisplayUrl, logoUrl, cardInitial, hasValidUrl }) => {

    const descHtml = hideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;

    const linksHtml = hideLinks ? '' : `
      <div class="mt-3 flex items-center justify-between">
        <span class="text-xs text-primary-600 dark:text-primary-400 truncate flex-1 min-w-0 mr-2" title="${safeDisplayUrl}">${escapeHTML(safeDisplayUrl)}</span>
        <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50' : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'} rounded-full text-xs font-medium transition-colors" data-url="${escapeHTML(normalizedUrl)}" ${hasValidUrl ? '' : 'disabled'}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ${hideCopyText ? '' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          ${hideCopyText ? '' : '<span class="copy-text">复制</span>'}
          <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
        </button>
      </div>`;

    const categoryHtml = hideCategory ? '' : `
      <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700 dark:bg-secondary-800 dark:text-primary-300">
        ${safeCatalog}
      </span>`;

    return `
      <div class="${baseCardClass} ${frostedClass} ${cardStyleClass} card-anim-enter" data-id="${site.id}" data-name="${escapeHTML(site.name)}" data-url="${escapeHTML(normalizedUrl)}" data-catalog="${escapeHTML(site.catelog_name || site.catelog || '未分类')}" data-desc="${safeDesc}">
        <div class="site-card-content">
          <a href="${escapeHTML(normalizedUrl || '#')}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-start">
              <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">
                ${logoUrl
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
      </div>`;
  }).join('');
}

/**
 * 渲染空状态 HTML
 * @param {number} categoryCount - 分类总数
 * @param {boolean} hideAdmin - 是否隐藏管理入口
 * @returns {string}
 */
export function renderEmptyState(categoryCount, hideAdmin) {
  const emptyStateText = categoryCount === 0 ? '欢迎使用 iori-nav' : '暂无书签';
  const emptyStateSub = categoryCount === 0
    ? '项目初始化完成，请前往后台添加分类和书签。'
    : '该分类下还没有添加任何书签。';

  return `
    <div class="col-span-full flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div class="w-32 h-32 mb-6 text-gray-200 dark:text-gray-700/50">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
        </div>
        <h3 class="text-xl font-medium text-gray-600 dark:text-gray-300 mb-2">${emptyStateText}</h3>
        <p class="text-gray-400 dark:text-gray-500 max-w-md mx-auto mb-8">${emptyStateSub}</p>
        ${!hideAdmin ? `<a href="/admin" target="_blank" class="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 hover:-translate-y-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            前往管理后台
        </a>` : ''}
    </div>`;
}
