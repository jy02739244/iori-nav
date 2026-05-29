import { escapeHTML, sanitizeUrl } from './utils';

function buildSearchText(site, normalizedUrl) {
  return [
    site?.name,
    site?.url,
    normalizedUrl || '',
    site?.catelog_name || site?.catelog || '未分类',
    site?.desc,
  ]
    .map(value => String(value ?? '').toLowerCase())
    .join('\u0000');
}

export function buildCardTemplateConfig(settings = {}) {
  const hideDesc = settings.layout_hide_desc === true;
  const hideLinks = settings.layout_hide_links === true;
  const hideCategory = settings.layout_hide_category === true;
  const enableFrostedGlass = settings.layout_enable_frosted_glass === true;
  const cardStyle = settings.layout_card_style || 'style1';
  const gridCols = settings.layout_grid_cols || '4';
  const hideCopyText = (Number(gridCols) || 4) >= 5;

  return {
    hideDesc,
    hideLinks,
    hideCategory,
    enableFrostedGlass,
    cardStyle,
    gridCols,
    hideCopyText,
    aboveFoldImageCount: 8,
    baseCardClass: enableFrostedGlass
      ? 'site-card group h-full flex flex-col overflow-hidden transition-all'
      : 'site-card group h-full flex flex-col bg-white border border-primary-100/60 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700',
    frostedClass: enableFrostedGlass ? 'frosted-glass-effect' : '',
    cardStyleClass: cardStyle === 'style2' ? 'style-2' : '',
    titleClass: 'site-title text-base font-medium text-gray-900 dark:text-gray-100 truncate transition-all duration-300 origin-left',
    descClass: 'mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2',
    categoryClass: 'inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700 dark:bg-secondary-800 dark:text-primary-300',
    linkRowClass: 'mt-3 flex items-center justify-between',
    urlTextClass: 'text-xs text-primary-600 dark:text-primary-400 truncate flex-1 min-w-0 mr-2',
    copyButtonBaseClass: 'copy-btn relative flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors',
    copyButtonEnabledClass: 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50',
    copyButtonDisabledClass: 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500',
    logoClass: 'w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700',
    siteIconClass: 'site-icon flex-shrink-0 mr-4 transition-all duration-300',
  };
}

export function buildCardViewModel(site) {
  const rawName = site?.name || '未命名';
  const normalizedUrl = sanitizeUrl(site?.url);
  const normalizedLogo = sanitizeUrl(site?.logo);
  const rawCatalog = site?.catelog_name || site?.catelog || '未分类';
  const rawDesc = site?.desc || '暂无描述';

  return {
    id: site?.id,
    catelog_id: site?.catelog_id,
    nameHtml: escapeHTML(rawName),
    catalogHtml: escapeHTML(rawCatalog),
    descHtml: escapeHTML(rawDesc),
    urlHtml: escapeHTML(normalizedUrl),
    displayUrlHtml: escapeHTML(normalizedUrl || '未提供链接'),
    logoUrlHtml: escapeHTML(normalizedLogo),
    cardInitialHtml: escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase()),
    hasValidUrl: Boolean(normalizedUrl),
    searchText: buildSearchText(site, normalizedUrl),
  };
}

export function buildCardHydrationState(sites, settings = {}) {
  return {
    config: buildCardTemplateConfig(settings),
    cards: (sites || []).map(site => buildCardViewModel(site)),
  };
}
