// functions/lib/card-renderer.js
// 渲染站点卡片网格 HTML

import { buildCardTemplateConfig, buildCardViewModel } from './card-model';

/**
 * 渲染站点卡片网格 HTML
 * @param {Array} sites - 站点数据数组
 * @param {object} settings - 解析后的设置对象
 * @returns {string} 站点卡片 HTML 字符串
 */
export function renderSiteCards(sites, settings) {
  const config = buildCardTemplateConfig(settings);
  const processed = sites.map(site => buildCardViewModel(site));

  return processed.map((card, index) => {
    const isAboveFold = index < config.aboveFoldImageCount;
    const imgLoadingAttrs = isAboveFold ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';

    const descHtml = config.hideDesc ? '' : `<p class="${config.descClass}" title="${card.descHtml}">${card.descHtml}</p>`;

    const linksHtml = config.hideLinks ? '' : `
      <div class="${config.linkRowClass}">
        <span class="${config.urlTextClass}" title="${card.displayUrlHtml}">${card.displayUrlHtml}</span>
        <button class="${config.copyButtonBaseClass} ${card.hasValidUrl ? config.copyButtonEnabledClass : config.copyButtonDisabledClass}" data-url="${card.urlHtml}" ${card.hasValidUrl ? '' : 'disabled'}>
          <svg class="h-3 w-3 ${config.hideCopyText ? '' : 'mr-1'}"><use href="#icon-copy"/></svg>
          ${config.hideCopyText ? '' : '<span class="copy-text">复制</span>'}
          <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
        </button>
      </div>`;

    const categoryHtml = config.hideCategory ? '' : `
      <span class="${config.categoryClass}">
        ${card.catalogHtml}
      </span>`;

    return `
      <div class="${config.baseCardClass} ${config.frostedClass} ${config.cardStyleClass} card-anim-enter" data-id="${card.id}">
        <div class="site-card-content">
          <a href="${card.urlHtml || '#'}" ${card.hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-start">
              <div class="${config.siteIconClass}">
                ${card.logoUrlHtml
        ? `<img src="${card.logoUrlHtml}" alt="${card.nameHtml}" width="40" height="40" class="${config.logoClass}" ${imgLoadingAttrs}>`
        : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${card.cardInitialHtml}</div>`
      }
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="${config.titleClass}" title="${card.nameHtml}">${card.nameHtml}</h3>
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
