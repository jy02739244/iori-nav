(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};

  const FONT_OPTIONS = [
    { value: "", label: "默认字体" },
    { value: "sans-serif", label: "Sans Serif (通用无衬线)" },
    { value: "serif", label: "Serif (通用衬线)" },
    { value: "monospace", label: "Monospace (通用等宽)" },
    { value: "'Microsoft YaHei', sans-serif", label: "微软雅黑 (Windows)" },
    { value: "'SimSun', serif", label: "宋体 (Windows)" },
    { value: "'PingFang SC', sans-serif", label: "苹方 (Mac)" },
    { value: "'Segoe UI', sans-serif", label: "Segoe UI (Windows)" },
    { value: "'Noto Sans SC', sans-serif", label: "Noto Sans SC (Web)" },
    { value: "'Noto Serif SC', serif", label: "Noto Serif SC (Web)" },
    { value: "'Ma Shan Zheng', cursive", label: "马善政毛笔 (Web)" },
    { value: "'ZCOOL KuaiLe', cursive", label: "站酷快乐体 (Web)" },
    { value: "'Long Cang', cursive", label: "龙苍草书 (Web)" },
    { value: "'Roboto', sans-serif", label: "Roboto (Web)" },
    { value: "'Open Sans', sans-serif", label: "Open Sans (Web)" },
    { value: "'Lato', sans-serif", label: "Lato (Web)" },
    { value: "'Montserrat', sans-serif", label: "Montserrat (Web)" }
  ];

  const FONT_URL_MAP = {
    "'Noto Sans SC', sans-serif": "https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
    "'Noto Serif SC', serif": "https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;700&display=swap",
    "'Ma Shan Zheng', cursive": "https://fonts.loli.net/css2?family=Ma+Shan+Zheng&display=swap",
    "'ZCOOL KuaiLe', cursive": "https://fonts.loli.net/css2?family=ZCOOL+KuaiLe&display=swap",
    "'Long Cang', cursive": "https://fonts.loli.net/css2?family=Long+Cang&display=swap",
    "'Roboto', sans-serif": "https://fonts.loli.net/css2?family=Roboto:wght@300;400;500;700&display=swap",
    "'Open Sans', sans-serif": "https://fonts.loli.net/css2?family=Open+Sans:wght@400;600;700&display=swap",
    "'Lato', sans-serif": "https://fonts.loli.net/css2?family=Lato:wght@400;700&display=swap",
    "'Montserrat', sans-serif": "https://fonts.loli.net/css2?family=Montserrat:wght@400;700&display=swap"
  };

  const loadedFonts = new Set();
  let initialized = false;
  const CARD_ANIMATION_TYPES = ['slideUp', 'radial', 'fadeIn', 'slideLeft', 'slideRight', 'convergeIn', 'flipIn'];
  const CARD_ANIMATION_CLASSES = CARD_ANIMATION_TYPES.map(type => `preview-card-anim-${type}`);
  const REDUCED_MOTION_QUERY = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const FALLBACK_CATEGORIES = ['工具', '搜索', '设计', '开发', '阅读', '影音'];
  const PREVIEW_CARD_PAGE_SIZE = 200;
  const ALL_PREVIEW_CARDS_KEY = '__all__';
  const previewCardCache = new Map();
  let livePreviewFrame = null;
  let livePreviewSelectedCategory = null;
  let livePreviewPendingCardAnimation = false;

  function prefersReducedMotion() {
    return REDUCED_MOTION_QUERY?.matches === true;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getRadioValue(radios, fallback) {
    for (const radio of radios || []) {
      if (radio.checked) return radio.value;
    }
    return fallback;
  }

  function normalizeCategoryPosition(position, menuLayout) {
    if (position === 'above_description') return 'top';
    if (['below_search', 'above_search', 'left', 'top'].includes(position)) return position;
    return menuLayout === 'vertical' ? 'left' : 'below_search';
  }

  function getPreviewInputValue(input, fallback = '') {
    return input ? input.value.trim() : fallback;
  }

  function getPreviewInputValueOrDefault(input, fallback, defaultValue) {
    const value = getPreviewInputValue(input, fallback);
    return value || defaultValue;
  }

  function normalizePreviewUrl(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    try {
      const parsed = new URL(text);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function normalizePreviewAssetUrl(value) {
    if (typeof window.normalizeUrl === 'function') {
      return window.normalizeUrl(value);
    }

    const text = String(value ?? '').trim();
    if (!text) return '';
    if (/^data:image\/[\w+.-]+;base64,/.test(text) || text.startsWith('/')) return text;
    try {
      const parsed = new URL(text);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch {
      return /^[\w.-]+\.[\w.-]+/.test(text) ? `https://${text}` : '';
    }
  }

  function getHostnameLabel(url) {
    const normalizedUrl = normalizePreviewAssetUrl(url);
    if (!normalizedUrl) return '';
    try {
      return new URL(normalizedUrl, window.location.origin).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function getPreviewCategoryById(id) {
    const category = Array.isArray(window.categoriesData)
      ? window.categoriesData.find(item => String(item.id) === String(id))
      : null;
    return category?.catelog || '';
  }

  function getPreviewCardKey(categoryName) {
    const name = String(categoryName || '').trim();
    return name || ALL_PREVIEW_CARDS_KEY;
  }

  function normalizePreviewCard(item) {
    const url = normalizePreviewUrl(item?.url);
    const fallbackName = getHostnameLabel(url) || '未命名书签';
    const name = String(item?.name || fallbackName).trim();
    const category = String(item?.catelog_name || item?.catelog || getPreviewCategoryById(item?.catelog_id) || '未分类').trim();

    return {
      id: item?.id ?? '',
      name,
      url,
      displayUrl: url || '未提供链接',
      logo: normalizePreviewAssetUrl(item?.logo),
      desc: String(item?.desc || '暂无描述').trim(),
      category,
      hasValidUrl: Boolean(url),
      sortOrder: Number(item?.sort_order ?? 9999),
      createdAt: Date.parse(item?.create_time || '') || 0,
    };
  }

  function fetchPreviewCards(categoryName = '') {
    const key = getPreviewCardKey(categoryName);
    const existing = previewCardCache.get(key);
    if (existing?.isLoading || existing?.isLoaded) return existing;

    const state = {
      cards: [],
      total: 0,
      isLoading: true,
      isLoaded: false,
      error: '',
    };
    previewCardCache.set(key, state);

    const categoryFilters = getPreviewCategoryFilterNames(categoryName);
    const fetchCategoryPage = (name = '') => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: String(PREVIEW_CARD_PAGE_SIZE),
      });
      if (name) params.set('catalog', name);

      return fetch(`/api/config?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (data.code !== 200) {
            throw new Error(data.message || '加载书签失败');
          }
          return {
            items: Array.isArray(data.data) ? data.data : [],
            total: Number(data.total) || 0,
          };
        });
    };

    Promise.all((categoryFilters.length > 0 ? categoryFilters : ['']).map(fetchCategoryPage))
      .then(results => {
        const cards = results.flatMap(result => result.items).map(normalizePreviewCard);
        state.cards = cards
          .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt)
          .slice(0, PREVIEW_CARD_PAGE_SIZE);
        state.total = results.reduce((sum, result) => sum + result.total, 0) || state.cards.length;
        state.error = '';
      })
      .catch(err => {
        state.cards = [];
        state.total = 0;
        state.error = err?.message || '加载书签失败';
      })
      .finally(() => {
        state.isLoading = false;
        state.isLoaded = true;
        scheduleFullPreviewRender();
      });

    return state;
  }

  function getPreviewCardsState(categoryName = '') {
    return previewCardCache.get(getPreviewCardKey(categoryName)) || fetchPreviewCards(categoryName);
  }

  function invalidatePreviewCards() {
    previewCardCache.clear();
    scheduleFullPreviewRender();
  }

  function isPreviewModalVisible() {
    const modal = document.getElementById('settingsModal');
    return !modal || modal.style.display !== 'none';
  }

  function createFallbackCategoryTree() {
    return FALLBACK_CATEGORIES.map((name, index) => ({
      id: `fallback-${index}`,
      catelog: name,
      children: [],
    }));
  }

  function getPreviewCategoryTree() {
    if (Array.isArray(window.categoriesTree) && window.categoriesTree.length > 0) {
      return window.categoriesTree;
    }

    if (
      Array.isArray(window.categoriesData)
      && window.categoriesData.length > 0
      && typeof window.buildCategoryTree === 'function'
    ) {
      return window.buildCategoryTree(window.categoriesData);
    }

    return createFallbackCategoryTree();
  }

  function findCategoryNodeByName(nodes = [], categoryName = '') {
    for (const node of nodes) {
      if (node?.catelog === categoryName) return node;
      if (Array.isArray(node?.children) && node.children.length > 0) {
        const found = findCategoryNodeByName(node.children, categoryName);
        if (found) return found;
      }
    }
    return null;
  }

  function collectCategoryNames(node, names = []) {
    if (!node?.catelog) return names;
    names.push(String(node.catelog));
    if (Array.isArray(node.children) && node.children.length > 0) {
      node.children.forEach(child => collectCategoryNames(child, names));
    }
    return names;
  }

  function getPreviewCategoryFilterNames(categoryName) {
    const name = String(categoryName || '').trim();
    if (!name) return [];

    const node = findCategoryNodeByName(getPreviewCategoryTree(), name);
    return node ? collectCategoryNames(node) : [name];
  }

  function flattenCategoryNames(nodes = [], names = []) {
    for (const node of nodes) {
      if (node?.catelog) names.push(String(node.catelog));
      if (Array.isArray(node?.children) && node.children.length > 0) {
        flattenCategoryNames(node.children, names);
      }
    }
    return names;
  }

  function categoryHasActiveDescendant(node, activeName) {
    const children = Array.isArray(node?.children) ? node.children : [];
    return children.some(child => child?.catelog === activeName || categoryHasActiveDescendant(child, activeName));
  }

  function readPreviewSettings() {
    const refs = getRefs();
    const current = getCurrentSettings();
    return {
      siteName: getPreviewInputValueOrDefault(refs.homeSiteNameInput, current.home_site_name, '灰色轨迹'),
      siteDescription: getPreviewInputValueOrDefault(refs.homeSiteDescriptionInput, current.home_site_description, '一个优雅、快速、易于部署的书签收藏与分享平台'),
      footerText: getPreviewInputValueOrDefault(refs.homeFooterTextInput, current.home_footer_text, '曾梦想仗剑走天涯'),
      hideTitle: !!refs.hideTitleSwitch?.checked,
      hideSubtitle: !!refs.hideSubtitleSwitch?.checked,
      hideStats: !!refs.hideStatsSwitch?.checked,
      hideHitokoto: !!refs.hideHitokotoSwitch?.checked,
      hideAdmin: !!refs.hideAdminSwitch?.checked,
      searchEngines: !!refs.searchEngineSwitch?.checked,
      categoryPosition: normalizeCategoryPosition(
        getRadioValue(refs.categoryPositionRadios, current.home_category_position || 'below_search'),
        current.layout_menu_layout
      ),
      categoryFlow: getRadioValue(refs.categoryFlowRadios, current.home_category_flow || 'single_line'),
      defaultCategory: getPreviewInputValue(refs.homeDefaultCategorySelect, current.home_default_category || ''),
      gridCols: getRadioValue(refs.gridColsRadios, current.layout_grid_cols || '4'),
      cardStyle: current.layout_card_style || 'style1',
      hideCardDesc: !!refs.hideDescSwitch?.checked,
      hideCardLinks: !!refs.hideLinksSwitch?.checked,
      hideCardCategory: !!refs.hideCategorySwitch?.checked,
      frosted: !!refs.frostedGlassSwitch?.checked,
      frostedIntensity: getPreviewInputValueOrDefault(refs.frostedGlassIntensityRange, current.layout_frosted_glass_intensity, '15'),
      cardRadius: getPreviewInputValueOrDefault(refs.cardRadiusInput, current.layout_card_border_radius, '12'),
      wallpaper: normalizePreviewUrl(getPreviewInputValue(refs.customWallpaperInput, current.layout_custom_wallpaper || '')),
      bgBlur: !!refs.bgBlurSwitch?.checked,
      bgBlurIntensity: getPreviewInputValueOrDefault(refs.bgBlurIntensityRange, current.layout_bg_blur_intensity, '0'),
      titleFont: getPreviewInputValue(refs.homeTitleFontInput, current.home_title_font || ''),
      titleSize: getPreviewInputValue(refs.homeTitleSizeInput, current.home_title_size || ''),
      titleColor: getPreviewInputValue(refs.homeTitleColorInput, current.home_title_color || ''),
      subtitleFont: getPreviewInputValue(refs.homeSubtitleFontInput, current.home_subtitle_font || ''),
      subtitleSize: getPreviewInputValue(refs.homeSubtitleSizeInput, current.home_subtitle_size || ''),
      subtitleColor: getPreviewInputValue(refs.homeSubtitleColorInput, current.home_subtitle_color || ''),
      statsFont: getPreviewInputValue(refs.homeStatsFontInput, current.home_stats_font || ''),
      statsSize: getPreviewInputValue(refs.homeStatsSizeInput, current.home_stats_size || ''),
      statsColor: getPreviewInputValue(refs.homeStatsColorInput, current.home_stats_color || ''),
      hitokotoFont: getPreviewInputValue(refs.homeHitokotoFontInput, current.home_hitokoto_font || ''),
      hitokotoSize: getPreviewInputValue(refs.homeHitokotoSizeInput, current.home_hitokoto_size || ''),
      hitokotoColor: getPreviewInputValue(refs.homeHitokotoColorInput, current.home_hitokoto_color || ''),
      cardTitleFont: getPreviewInputValue(refs.cardTitleFontInput, current.card_title_font || ''),
      cardTitleSize: getPreviewInputValue(refs.cardTitleSizeInput, current.card_title_size || ''),
      cardTitleColor: getPreviewInputValue(refs.cardTitleColorInput, current.card_title_color || ''),
      cardDescFont: getPreviewInputValue(refs.cardDescFontInput, current.card_desc_font || ''),
      cardDescSize: getPreviewInputValue(refs.cardDescSizeInput, current.card_desc_size || ''),
      cardDescColor: getPreviewInputValue(refs.cardDescColorInput, current.card_desc_color || ''),
    };
  }

  function applyTextStyle(element, font, size, color) {
    if (!element) return;
    if (font) {
      element.style.fontFamily = font;
      loadFont(font);
    } else {
      element.style.removeProperty('font-family');
    }

    const numericSize = Number(size);
    if (Number.isFinite(numericSize) && numericSize > 0) {
      element.style.fontSize = `${numericSize}px`;
    } else {
      element.style.removeProperty('font-size');
    }

    if (color) {
      element.style.color = color;
    } else {
      element.style.removeProperty('color');
    }
  }

  function getRefs() {
    return ns.core?.getRefs?.() || {};
  }

  function getCurrentSettings() {
    return ns.core?.getCurrentSettings?.() || ns.currentSettings || {};
  }

  function loadFont(fontFamily) {
    if (!fontFamily || loadedFonts.has(fontFamily)) return;
    const url = FONT_URL_MAP[fontFamily];
    if (!url) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    loadedFonts.add(fontFamily);
  }

  function populateFontSelects() {
    const refs = getRefs();
    const selects = [
      refs.homeTitleFontInput,
      refs.homeSubtitleFontInput,
      refs.homeStatsFontInput,
      refs.homeHitokotoFontInput,
      refs.cardTitleFontInput,
      refs.cardDescFontInput,
    ];

    selects.forEach(select => {
      if (!select) return;
      select.innerHTML = '';
      FONT_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });
    });
  }

  function getMoreCategoryHtml(isActive) {
    return `
      <div class="live-category-item live-category-more-wrapper">
        <span class="live-category-more ${isActive ? 'active' : ''}" aria-label="更多分类" role="button" tabindex="0" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </span>
        <div class="live-category-dropdown live-category-more-dropdown"></div>
      </div>`;
  }

  function getSidebarCategoryIcon(name) {
    if (name === '全部') {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" class="live-sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>`;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" class="live-sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>`;
  }

  function getCategoryArrowHtml(direction = 'down') {
    const path = direction === 'right' ? 'M9 5l7 7-7 7' : 'M19 9l-7 7-7-7';
    return `
      <svg xmlns="http://www.w3.org/2000/svg" class="live-category-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="${path}" />
      </svg>`;
  }

  function renderHorizontalCategoryItem(node, activeName, level = 0) {
    if (!node?.catelog) return '';
    const name = String(node.catelog);
    const children = Array.isArray(node.children) ? node.children.filter(child => child?.catelog) : [];
    const hasChildren = children.length > 0;
    const isRoot = level === 0;
    const isActive = name === activeName || (isRoot && categoryHasActiveDescendant(node, activeName));
    const arrowHtml = hasChildren ? getCategoryArrowHtml(isRoot ? 'down' : 'right') : '';
    const childHtml = hasChildren
      ? `<div class="live-category-dropdown">${children.map(child => renderHorizontalCategoryItem(child, activeName, level + 1)).join('')}</div>`
      : '';

    return `
      <div class="live-category-item ${isRoot ? 'is-root' : 'is-child'}">
        <span class="live-category-button ${isActive ? 'active' : ''}" data-preview-category="${escapeHTML(name)}" role="button" tabindex="0">${escapeHTML(name)}${arrowHtml}</span>
        ${childHtml}
      </div>`;
  }

  function renderSidebarCategoryItem(node, activeName, level = 0) {
    if (!node?.catelog) return '';
    const name = String(node.catelog);
    const children = Array.isArray(node.children) ? node.children : [];
    const isActive = name === activeName;
    const childHtml = children.map(child => renderSidebarCategoryItem(child, activeName, level + 1)).join('');

    return `
      <span class="live-sidebar-item ${isActive ? 'active' : ''}" data-preview-category="${escapeHTML(name)}" role="button" tabindex="0" style="--live-sidebar-indent: ${level * 0.75}rem">
        ${getSidebarCategoryIcon(name)}
        <span class="live-sidebar-label">${escapeHTML(name)}</span>
      </span>
      ${childHtml}`;
  }

  function collapseOverflowCategories(container) {
    const availableWidth = container?.clientWidth || container?.parentElement?.clientWidth || 0;
    const measureItemsWidth = () => {
      const styles = window.getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return Array.from(container.children).reduce((total, item, index) => (
        total + item.offsetWidth + (index > 0 ? gap : 0)
      ), 0);
    };

    if (!availableWidth || measureItemsWidth() <= availableWidth) return;

    container.insertAdjacentHTML('beforeend', getMoreCategoryHtml(false));
    const moreWrapper = container.querySelector('.live-category-more-wrapper');
    const moreButton = container.querySelector('.live-category-more');
    const moreDropdown = container.querySelector('.live-category-more-dropdown');
    const visibleItems = Array.from(container.children).filter(item => item !== moreWrapper);
    let hiddenHasActive = false;

    while (visibleItems.length > 0 && measureItemsWidth() > availableWidth) {
      const hiddenItem = visibleItems.pop();
      hiddenHasActive = hiddenHasActive
        || hiddenItem.classList.contains('active')
        || Boolean(hiddenItem.querySelector?.('.active'));
      moreDropdown?.insertBefore(hiddenItem, moreDropdown.firstChild);
    }

    if (moreButton) {
      moreButton.classList.toggle('active', hiddenHasActive);
    }
  }

  function renderCategoryNav(container, categoryTree, activeName, includeAll = true, options = {}) {
    if (!container) return;
    const active = activeName || '全部';
    const nodes = Array.isArray(categoryTree) ? categoryTree : [];

    if (options.variant === 'sidebar') {
      const allHtml = includeAll
        ? `
          <span class="live-sidebar-item ${active === '全部' ? 'active' : ''}" data-preview-category="" role="button" tabindex="0" style="--live-sidebar-indent: 0rem">
            ${getSidebarCategoryIcon('全部')}
            <span class="live-sidebar-label">全部</span>
          </span>`
        : '';
      container.innerHTML = `${allHtml}${nodes.map(node => renderSidebarCategoryItem(node, activeName, 0)).join('')}`;
    } else {
      const allHtml = includeAll
        ? `
          <div class="live-category-item is-root">
            <span class="live-category-button ${active === '全部' ? 'active' : ''}" data-preview-category="" role="button" tabindex="0">全部</span>
          </div>`
        : '';
      container.innerHTML = `${allHtml}${nodes.map(node => renderHorizontalCategoryItem(node, activeName, 0)).join('')}`;
    }

    if (options.flow === 'single_line') {
      collapseOverflowCategories(container);
    }
  }

  function closePreviewCategoryMoreMenus(root, exceptWrapper = null) {
    root?.querySelectorAll('.live-category-more-wrapper.is-open').forEach(wrapper => {
      if (wrapper === exceptWrapper) return;
      wrapper.classList.remove('is-open');
      wrapper.querySelector('.live-category-more')?.setAttribute('aria-expanded', 'false');
    });
  }

  function selectLivePreviewCategory(root, categoryName) {
    livePreviewSelectedCategory = String(categoryName || '').trim();
    livePreviewPendingCardAnimation = true;
    closePreviewCategoryMoreMenus(root);
    if (root?.dataset.device === 'mobile') {
      root.classList.remove('mobile-menu-open');
      root.querySelector('[data-preview-role="mobileMenuToggle"]')?.setAttribute('aria-expanded', 'false');
    }
    scheduleFullPreviewRender();
  }

  function renderPreviewCards(grid, settings, previewState) {
    if (!grid) return;
    const cards = previewState?.cards || [];

    if (previewState?.isLoading && cards.length === 0) {
      grid.innerHTML = '<div class="live-preview-state">正在加载真实书签...</div>';
      return;
    }

    if (previewState?.error) {
      grid.innerHTML = `<div class="live-preview-state is-error">${escapeHTML(previewState.error)}</div>`;
      return;
    }

    if (cards.length === 0) {
      grid.innerHTML = '<div class="live-preview-state">当前分类暂无书签</div>';
      return;
    }

    const hideCopyText = (Number(settings.gridCols) || 4) >= 5;

    grid.innerHTML = cards.map(card => {
      const initial = escapeHTML(card.name.slice(0, 1).toUpperCase() || '站');
      const nameHtml = escapeHTML(card.name);
      const urlHtml = escapeHTML(card.url);
      const displayUrlHtml = escapeHTML(card.displayUrl);
      const logoHtml = card.logo
        ? `<img src="${escapeHTML(card.logo)}" alt="${nameHtml}" width="40" height="40" class="w-10 h-10 rounded-lg object-cover bg-gray-100" loading="lazy" decoding="async">`
        : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${initial}</div>`;
      const cardClass = [
        'site-card',
        'live-card',
        'group',
        'h-full',
        'flex',
        'flex-col',
        'overflow-hidden',
        'transition-all',
        settings.frosted ? '' : 'bg-white border border-primary-100/60 shadow-sm',
        settings.cardStyle === 'style2' ? 'style-2' : '',
        settings.frosted ? 'frosted frosted-glass-effect' : '',
        settings.hideCardDesc ? 'is-desc-hidden' : '',
        settings.hideCardLinks ? 'is-links-hidden' : '',
      ].filter(Boolean).join(' ');
      const copyButtonClass = card.hasValidUrl
        ? 'bg-accent-100 text-accent-700 hover:bg-accent-200'
        : 'bg-gray-200 text-gray-400 cursor-not-allowed';
      const categoryHtml = settings.hideCardCategory ? '' : `
                <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700">
                  ${escapeHTML(card.category)}
                </span>`;
      const descHtml = settings.hideCardDesc ? '' : `<p class="preview-desc mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2" title="${escapeHTML(card.desc)}">${escapeHTML(card.desc)}</p>`;
      const linkHtml = settings.hideCardLinks ? '' : `
          <div class="preview-links mt-3 flex items-center justify-between">
            <span class="text-xs text-primary-600 truncate flex-1 min-w-0 mr-2" title="${displayUrlHtml}">${displayUrlHtml}</span>
            <button type="button" class="copy-btn relative flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${copyButtonClass}" data-url="${urlHtml}" ${card.hasValidUrl ? '' : 'disabled'}>
              <svg class="h-3 w-3 ${hideCopyText ? '' : 'mr-1'}"><use href="#icon-copy"/></svg>
              ${hideCopyText ? '' : '<span class="copy-text">复制</span>'}
              <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
            </button>
          </div>`;

      return `
        <article class="${cardClass}" data-id="${escapeHTML(card.id)}">
          <div class="site-card-content">
            <a href="${urlHtml || '#'}" ${card.hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
              <div class="flex items-start">
                <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">
                  ${logoHtml}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="site-title text-base font-medium text-gray-900 truncate transition-all duration-300 origin-left" title="${nameHtml}">${nameHtml}</h3>
                ${categoryHtml}
                </div>
              </div>
              ${descHtml}
            </a>
            ${linkHtml}
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.site-title').forEach(title => {
      applyTextStyle(title, settings.cardTitleFont, settings.cardTitleSize, settings.cardTitleColor);
    });
    grid.querySelectorAll('.preview-desc').forEach(desc => {
      applyTextStyle(desc, settings.cardDescFont, settings.cardDescSize, settings.cardDescColor);
    });
  }

  function updateHeroOrder(root, settings) {
    const titleBlock = root.querySelector('.live-preview-title-block');
    const searchEngines = root.querySelector('[data-preview-role="searchEngines"]');
    const searchBox = root.querySelector('.live-search-box');
    const categoryNav = root.querySelector('[data-preview-role="categoryNav"]');

    const orderMap = {
      top: { category: 1, title: 2, engines: 3, search: 4 },
      above_search: { title: 1, category: 2, engines: 3, search: 4 },
      below_search: { title: 1, engines: 2, search: 3, category: 4 },
    };
    const order = orderMap[settings.categoryPosition] || orderMap.below_search;

    if (titleBlock) titleBlock.style.order = order.title;
    if (searchEngines) searchEngines.style.order = order.engines;
    if (searchBox) searchBox.style.order = order.search;
    if (categoryNav) categoryNav.style.order = order.category;
  }

  function renderFullPreview() {
    const root = document.getElementById('homeLivePreview');
    if (!root) return;
    if (!isPreviewModalVisible()) return;

    const settings = readPreviewSettings();
    const categoryTree = getPreviewCategoryTree();
    const categoryNames = flattenCategoryNames(categoryTree);
    const defaultCategory = settings.defaultCategory && categoryNames.includes(settings.defaultCategory)
      ? settings.defaultCategory
      : '';
    let activeCategory = defaultCategory;

    if (livePreviewSelectedCategory !== null) {
      if (!livePreviewSelectedCategory || categoryNames.includes(livePreviewSelectedCategory)) {
        activeCategory = livePreviewSelectedCategory;
      } else {
        livePreviewSelectedCategory = null;
      }
    }

    const previewState = getPreviewCardsState(activeCategory);
    const isHorizontal = settings.categoryPosition !== 'left';
    const isMobilePreview = root.dataset.device === 'mobile';
    const wallpaper = root.querySelector('[data-preview-role="wallpaper"]');
    const sidebar = root.querySelector('[data-preview-role="sidebar"]');
    const panelTitle = document.getElementById('livePreviewPanelTitle');
    const title = root.querySelector('[data-preview-role="siteTitle"]');
    const description = root.querySelector('[data-preview-role="siteDescription"]');
    const searchEngines = root.querySelector('[data-preview-role="searchEngines"]');
    const categoryNav = root.querySelector('[data-preview-role="categoryNav"]');
    const sidebarCategories = root.querySelector('[data-preview-role="sidebarCategories"]');
    const sidebarTitle = root.querySelector('[data-preview-role="sidebarTitle"]');
    const adminIcon = root.querySelector('[data-preview-role="adminIcon"]');
    const metaRow = root.querySelector('[data-preview-role="metaRow"]');
    const statsText = root.querySelector('[data-preview-role="statsText"]');
    const hitokotoText = root.querySelector('[data-preview-role="hitokotoText"]');
    const cardGrid = root.querySelector('[data-preview-role="cardGrid"]');
    const footerYear = root.querySelector('[data-preview-role="footerYear"]');
    const footerText = root.querySelector('[data-preview-role="footerText"]');

    root.classList.toggle('is-horizontal', isHorizontal);
    root.classList.toggle('has-wallpaper', !!settings.wallpaper);
    root.classList.toggle('category-top', settings.categoryPosition === 'top');
    root.classList.toggle('category-above-search', settings.categoryPosition === 'above_search');
    root.classList.toggle('category-below-search', settings.categoryPosition === 'below_search');
    root.classList.toggle('is-mobile-preview', isMobilePreview);
    if (!isMobilePreview) root.classList.remove('mobile-menu-open');
    root.style.setProperty('--preview-grid-cols', String(Math.min(Number(settings.gridCols) || 4, 7)));
    root.style.setProperty('--preview-card-radius', `${Number(settings.cardRadius) || 12}px`);
    root.style.setProperty('--card-radius', `${Number(settings.cardRadius) || 12}px`);
    root.style.setProperty('--card-padding', '1rem');
    root.style.setProperty('--frosted-glass-blur', `${Number(settings.frostedIntensity) || 15}px`);
    root.style.setProperty('--preview-frosted-blur', `${Number(settings.frostedIntensity) || 15}px`);
    root.style.setProperty('--preview-bg-blur', settings.bgBlur ? `${Number(settings.bgBlurIntensity) || 0}px` : '0px');
    root.style.setProperty('--preview-bg-scale', settings.bgBlur ? '1.04' : '1');

    if (wallpaper) {
      wallpaper.style.backgroundImage = settings.wallpaper ? `url("${settings.wallpaper.replace(/"/g, '%22')}")` : '';
    }

    if (panelTitle) panelTitle.textContent = settings.siteName;
    if (sidebarTitle) sidebarTitle.textContent = '分类导航';
    if (title) {
      title.textContent = settings.siteName;
      title.style.display = settings.hideTitle ? 'none' : '';
      applyTextStyle(title, settings.titleFont, settings.titleSize, settings.titleColor);
    }
    if (description) {
      description.textContent = settings.siteDescription;
      description.style.display = settings.hideSubtitle ? 'none' : '';
      applyTextStyle(description, settings.subtitleFont, settings.subtitleSize, settings.subtitleColor);
    }

    if (searchEngines) searchEngines.style.display = settings.searchEngines ? 'flex' : 'none';
    if (adminIcon) adminIcon.style.display = settings.hideAdmin ? 'none' : '';
    if (sidebar) sidebar.style.display = (isHorizontal && !isMobilePreview) ? 'none' : '';

    if (categoryNav) {
      categoryNav.style.display = (isHorizontal && !isMobilePreview) ? 'flex' : 'none';
      categoryNav.classList.toggle('single-line', settings.categoryFlow === 'single_line');
      categoryNav.classList.toggle('multi-line', settings.categoryFlow === 'multi_line');
      renderCategoryNav(categoryNav, categoryTree, activeCategory, true, { flow: settings.categoryFlow });
    }
    renderCategoryNav(sidebarCategories, categoryTree, activeCategory, true, { variant: 'sidebar' });
    updateHeroOrder(root, settings);

    if (metaRow) {
      metaRow.style.display = (settings.hideStats && settings.hideHitokoto) ? 'none' : 'flex';
    }
    if (statsText) {
      const countText = previewState?.isLoaded
        ? `${previewState.total} 个书签`
        : '正在加载书签';
      statsText.textContent = activeCategory ? `${activeCategory} · ${countText}` : `全部收藏 · ${countText}`;
      statsText.style.display = settings.hideStats ? 'none' : '';
      applyTextStyle(statsText, settings.statsFont, settings.statsSize, settings.statsColor);
    }
    if (hitokotoText) {
      hitokotoText.style.display = settings.hideHitokoto ? 'none' : '';
      applyTextStyle(hitokotoText, settings.hitokotoFont, settings.hitokotoSize, settings.hitokotoColor);
    }
    if (footerYear) footerYear.textContent = String(new Date().getFullYear());
    if (footerText) footerText.textContent = settings.footerText;

    renderPreviewCards(cardGrid, settings, previewState);
    if (
      livePreviewPendingCardAnimation
      && previewState?.isLoaded
      && !previewState?.error
      && (previewState.cards || []).length > 0
    ) {
      livePreviewPendingCardAnimation = false;
      requestAnimationFrame(triggerPreviewAnimation);
    } else if (
      livePreviewPendingCardAnimation
      && previewState?.isLoaded
      && (previewState?.error || (previewState.cards || []).length === 0)
    ) {
      livePreviewPendingCardAnimation = false;
    }
  }

  function scheduleFullPreviewRender() {
    if (livePreviewFrame) return;
    livePreviewFrame = window.requestAnimationFrame(() => {
      livePreviewFrame = null;
      renderFullPreview();
    });
  }

  function setupColorPicker(textInput, pickerInput) {
    if (!textInput || !pickerInput) return;

    if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
      pickerInput.value = textInput.value;
    }

    pickerInput.addEventListener('input', () => {
      textInput.value = pickerInput.value;
      scheduleFullPreviewRender();
    });

    textInput.addEventListener('input', () => {
      const val = textInput.value;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        pickerInput.value = val;
      }
      scheduleFullPreviewRender();
    });
  }

  function updatePreviewCards() {
    const refs = getRefs();
    const hideDesc = !!refs.hideDescSwitch?.checked;
    const hideLinks = !!refs.hideLinksSwitch?.checked;
    const hideCategory = !!refs.hideCategorySwitch?.checked;
    const enableFrosted = !!refs.frostedGlassSwitch?.checked;
    const frostedIntensity = refs.frostedGlassIntensityRange?.value || '15';
    const radius = refs.cardRadiusInput?.value || '12';

    const titleFont = refs.cardTitleFontInput?.value || '';
    const titleSize = refs.cardTitleSizeInput?.value || '';
    const titleColor = refs.cardTitleColorInput?.value || '';
    const descFont = refs.cardDescFontInput?.value || '';
    const descSize = refs.cardDescSizeInput?.value || '';
    const descColor = refs.cardDescColorInput?.value || '';

    if (titleFont) loadFont(titleFont);
    if (descFont) loadFont(descFont);

    [document.getElementById('cardStyle1Preview'), document.getElementById('cardStyle2Preview')].forEach(card => {
      if (!card) return;
      card.style.setProperty('--card-radius', radius + 'px');

      const desc = card.querySelector('.preview-desc');
      const links = card.querySelector('.preview-links');
      const category = card.querySelector('.preview-category');
      const title = card.querySelector('.site-title');

      if (title) {
        if (titleFont) title.style.fontFamily = titleFont; else title.style.removeProperty('font-family');
        if (titleSize) title.style.fontSize = titleSize + 'px'; else title.style.removeProperty('font-size');
        if (titleColor) title.style.color = titleColor; else title.style.removeProperty('color');
      }

      if (desc) {
        if (hideDesc) {
          desc.style.setProperty('display', 'none', 'important');
        } else {
          desc.style.removeProperty('display');
        }
        if (descFont) desc.style.fontFamily = descFont; else desc.style.removeProperty('font-family');
        if (descSize) desc.style.fontSize = descSize + 'px'; else desc.style.removeProperty('font-size');
        if (descColor) desc.style.color = descColor; else desc.style.removeProperty('color');
      }

      if (links) links.style.display = hideLinks ? 'none' : 'flex';
      if (category) category.style.display = hideCategory ? 'none' : 'inline-flex';

      if (enableFrosted) {
        card.classList.add('frosted-glass-effect');
        card.style.setProperty('--frosted-glass-blur', frostedIntensity + 'px');
        card.classList.remove('bg-white');
      } else {
        card.classList.remove('frosted-glass-effect');
        card.style.removeProperty('--frosted-glass-blur');
        card.classList.add('bg-white');
      }
    });

    scheduleFullPreviewRender();
  }

  function updatePreviewWidth() {
    const refs = getRefs();
    let cols = '4';

    for (const radio of refs.gridColsRadios || []) {
      if (radio.checked) {
        cols = radio.value;
        break;
      }
    }

    const widthMap = {
      '4': '280px',
      '5': '230px',
      '6': '190px',
      '7': '160px'
    };
    const width = widthMap[cols] || '280px';

    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');
    if (preview1) preview1.style.maxWidth = width;
    if (preview2) preview2.style.maxWidth = width;
    scheduleFullPreviewRender();
  }

  function getLegacyPreviewCard() {
    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');
    const container = preview2 && !preview2.classList.contains('hidden') ? preview2 : preview1;
    return container?.querySelector('.site-card') || null;
  }

  function getVisiblePreviewCards() {
    const liveCards = Array.from(document.querySelectorAll('#homeLivePreview .live-card'));
    if (liveCards.length > 0) return liveCards;

    const legacyCard = getLegacyPreviewCard();
    return legacyCard ? [legacyCard] : [];
  }

  function resolvePreviewAnimation() {
    const refs = getRefs();
    const selected = refs.cardAnimationSelect?.value || getCurrentSettings().layout_card_animation || 'radial';
    if (selected === 'random') {
      return CARD_ANIMATION_TYPES[Math.floor(Math.random() * CARD_ANIMATION_TYPES.length)];
    }
    return CARD_ANIMATION_TYPES.includes(selected) ? selected : 'radial';
  }

  function triggerPreviewAnimation() {
    const cards = getVisiblePreviewCards();
    if (cards.length === 0) return;

    const animation = resolvePreviewAnimation();
    const midpoint = (cards.length - 1) / 2;

    cards.forEach((card, index) => {
      cleanupPreviewAnimation(card);

      if (animation === 'convergeIn') {
        const fromLeft = index <= midpoint;
        card.style.setProperty('--preview-card-anim-x', fromLeft ? '-80px' : '80px');
        card.style.setProperty('--preview-card-anim-y', '0');
      }

      void card.offsetWidth;
      card.style.animationDelay = `${Math.min(index * 0.045, 0.18)}s`;
      card.classList.add('preview-card-anim-enter', `preview-card-anim-${animation}`);

      if (prefersReducedMotion()) {
        cleanupPreviewAnimation(card);
        return;
      }

      let isCleaned = false;
      let isCleanupScheduled = false;
      let fallbackTimer = null;

      const cleanup = () => {
        if (isCleaned) return;
        isCleaned = true;
        cleanupPreviewAnimation(card);
        card.removeEventListener('animationend', handleAnimationEnd);
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
      };

      const finish = () => {
        if (isCleaned || isCleanupScheduled) return;
        isCleanupScheduled = true;
        const cleanupDelay = card.classList.contains('preview-card-anim-flipIn') ? 140 : 0;
        if (cleanupDelay > 0) {
          window.setTimeout(cleanup, cleanupDelay);
        } else {
          cleanup();
        }
      };

      const handleAnimationEnd = (event) => {
        if (event.target !== card) return;
        finish();
      };

      fallbackTimer = window.setTimeout(cleanup, 1100);
      card.addEventListener('animationend', handleAnimationEnd);
    });
  }

  function cleanupPreviewAnimation(card) {
    card.classList.add('preview-card-anim-cleanup');
    CARD_ANIMATION_CLASSES.forEach(className => card.classList.remove(className));
    card.classList.remove('preview-card-anim-enter');
    card.style.removeProperty('--preview-card-anim-x');
    card.style.removeProperty('--preview-card-anim-y');
    card.style.removeProperty('animation-delay');
    window.requestAnimationFrame(() => {
      card.classList.remove('preview-card-anim-cleanup');
    });
  }

  function syncAnimationOptions() {
    const refs = getRefs();
    const selected = refs.cardAnimationSelect?.value || 'radial';
    document.querySelectorAll('.card-animation-option').forEach(option => {
      const isActive = option.dataset.animation === selected;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function selectCardStyle(style) {
    const currentSettings = getCurrentSettings();
    currentSettings.layout_card_style = style;

    const btn1 = document.getElementById('btnStyle1');
    const btn2 = document.getElementById('btnStyle2');
    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');

    if (!btn1 || !btn2 || !preview1 || !preview2) return;

    btn1.className = 'card-style-btn card-segment-option';
    btn2.className = 'card-style-btn card-segment-option';

    if (style === 'style2') {
      btn2.classList.add('active');
      preview1.classList.add('hidden');
      preview2.classList.remove('hidden');
    } else {
      btn1.classList.add('active');
      preview1.classList.remove('hidden');
      preview2.classList.add('hidden');
    }

    scheduleFullPreviewRender();
    requestAnimationFrame(triggerPreviewAnimation);
  }

  function bindLivePreviewEvents() {
    const refs = getRefs();
    const liveInputs = [
      refs.homeSiteNameInput,
      refs.homeSiteDescriptionInput,
      refs.homeFooterTextInput,
      refs.hideAdminSwitch,
      refs.searchEngineSwitch,
      refs.hideTitleSwitch,
      refs.homeTitleFontInput,
      refs.homeTitleSizeInput,
      refs.homeTitleColorInput,
      refs.hideSubtitleSwitch,
      refs.homeSubtitleFontInput,
      refs.homeSubtitleSizeInput,
      refs.homeSubtitleColorInput,
      refs.hideStatsSwitch,
      refs.homeStatsFontInput,
      refs.homeStatsSizeInput,
      refs.homeStatsColorInput,
      refs.hideHitokotoSwitch,
      refs.homeHitokotoFontInput,
      refs.homeHitokotoSizeInput,
      refs.homeHitokotoColorInput,
      refs.homeDefaultCategorySelect,
      refs.hideDescSwitch,
      refs.hideLinksSwitch,
      refs.hideCategorySwitch,
      refs.frostedGlassSwitch,
      refs.frostedGlassIntensityRange,
      refs.cardRadiusInput,
      refs.cardTitleFontInput,
      refs.cardTitleSizeInput,
      refs.cardTitleColorInput,
      refs.cardDescFontInput,
      refs.cardDescSizeInput,
      refs.cardDescColorInput,
      refs.customWallpaperInput,
      refs.bgBlurSwitch,
      refs.bgBlurIntensityRange,
    ];

    liveInputs.forEach(input => {
      input?.addEventListener('input', scheduleFullPreviewRender);
      input?.addEventListener('change', scheduleFullPreviewRender);
    });

    refs.homeDefaultCategorySelect?.addEventListener('change', () => {
      livePreviewSelectedCategory = null;
      scheduleFullPreviewRender();
    });

    [
      refs.categoryPositionRadios,
      refs.categoryFlowRadios,
      refs.gridColsRadios,
    ].forEach(radios => {
      for (const radio of radios || []) {
        radio.addEventListener('change', scheduleFullPreviewRender);
      }
    });

    document.querySelectorAll('.preview-device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preview-device-btn').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        const root = document.getElementById('homeLivePreview');
        if (root) {
          root.dataset.device = btn.dataset.previewDevice || 'desktop';
          if (root.dataset.device !== 'mobile') root.classList.remove('mobile-menu-open');
        }
        scheduleFullPreviewRender();
      });
    });

    const root = document.getElementById('homeLivePreview');
    const menuToggle = root?.querySelector('[data-preview-role="mobileMenuToggle"]');
    const mobileOverlay = root?.querySelector('[data-preview-role="mobileOverlay"]');
    menuToggle?.addEventListener('click', () => {
      if (!root || root.dataset.device !== 'mobile') return;
      root.classList.toggle('mobile-menu-open');
      menuToggle.setAttribute('aria-expanded', root.classList.contains('mobile-menu-open') ? 'true' : 'false');
    });
    mobileOverlay?.addEventListener('click', () => {
      if (!root) return;
      root.classList.remove('mobile-menu-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });

    root?.addEventListener('click', (event) => {
      const target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      const moreButton = target?.closest('.live-category-more');
      if (moreButton && root.contains(moreButton)) {
        event.stopPropagation();
        const wrapper = moreButton.closest('.live-category-more-wrapper');
        const willOpen = !wrapper?.classList.contains('is-open');
        closePreviewCategoryMoreMenus(root, wrapper);
        wrapper?.classList.toggle('is-open', willOpen);
        moreButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }

      const categoryControl = target?.closest('[data-preview-category]');
      if (categoryControl && root.contains(categoryControl)) {
        event.stopPropagation();
        selectLivePreviewCategory(root, categoryControl.dataset.previewCategory || '');
        return;
      }

      if (!target?.closest('.live-category-dropdown')) {
        closePreviewCategoryMoreMenus(root);
      }
    });

    root?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      const moreButton = target?.closest('.live-category-more');
      const categoryControl = target?.closest('[data-preview-category]');
      if (moreButton && root.contains(moreButton)) {
        event.preventDefault();
        moreButton.click();
      } else if (categoryControl && root.contains(categoryControl)) {
        event.preventDefault();
        categoryControl.click();
      }
    });

    document.addEventListener('click', (event) => {
      if (!root || root.contains(event.target)) return;
      closePreviewCategoryMoreMenus(root);
    });
  }

  function bindPreviewEvents() {
    const refs = getRefs();

    for (const radio of refs.gridColsRadios || []) {
      radio.addEventListener('change', updatePreviewWidth);
    }

    document.getElementById('btnStyle1')?.addEventListener('click', () => selectCardStyle('style1'));
    document.getElementById('btnStyle2')?.addEventListener('click', () => selectCardStyle('style2'));
    document.querySelectorAll('.card-animation-option').forEach(option => {
      option.addEventListener('click', () => {
        if (!refs.cardAnimationSelect) return;
        refs.cardAnimationSelect.value = option.dataset.animation || 'radial';
        getCurrentSettings().layout_card_animation = refs.cardAnimationSelect.value;
        syncAnimationOptions();
        triggerPreviewAnimation();
      });
    });

    refs.cardAnimationSelect?.addEventListener('change', () => {
      getCurrentSettings().layout_card_animation = refs.cardAnimationSelect.value || 'radial';
      syncAnimationOptions();
      triggerPreviewAnimation();
    });

    refs.hideDescSwitch?.addEventListener('change', updatePreviewCards);
    refs.hideLinksSwitch?.addEventListener('change', updatePreviewCards);
    refs.hideCategorySwitch?.addEventListener('change', updatePreviewCards);
    refs.frostedGlassSwitch?.addEventListener('change', updatePreviewCards);
    refs.frostedGlassIntensityRange?.addEventListener('input', updatePreviewCards);

    refs.cardRadiusInput?.addEventListener('input', () => {
      if (refs.cardRadiusValue) refs.cardRadiusValue.textContent = refs.cardRadiusInput.value;
      updatePreviewCards();
    });

    [
      refs.cardTitleFontInput,
      refs.cardTitleSizeInput,
      refs.cardTitleColorInput,
      refs.cardDescFontInput,
      refs.cardDescSizeInput,
      refs.cardDescColorInput,
    ].forEach(input => {
      input?.addEventListener('input', updatePreviewCards);
      input?.addEventListener('change', updatePreviewCards);
    });

    setupColorPicker(refs.homeTitleColorInput, refs.homeTitleColorPicker);
    setupColorPicker(refs.homeSubtitleColorInput, refs.homeSubtitleColorPicker);
    setupColorPicker(refs.homeStatsColorInput, refs.homeStatsColorPicker);
    setupColorPicker(refs.homeHitokotoColorInput, refs.homeHitokotoColorPicker);
    setupColorPicker(refs.cardTitleColorInput, refs.cardTitleColorPicker);
    setupColorPicker(refs.cardDescColorInput, refs.cardDescColorPicker);
    bindLivePreviewEvents();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    populateFontSelects();
    bindPreviewEvents();
    syncAnimationOptions();
    renderFullPreview();
  }

  ns.preview = {
    init,
    loadFont,
    updatePreviewCards,
    updatePreviewWidth,
    selectCardStyle,
    triggerPreviewAnimation,
    syncAnimationOptions,
    invalidatePreviewCards,
    renderFullPreview,
    scheduleFullPreviewRender,
  };
})();
