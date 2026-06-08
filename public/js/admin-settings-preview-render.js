(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const shared = ns.previewShared;
  const data = ns.previewData;
  const nav = ns.previewNav;

 let livePreviewFrame = null;

 let livePreviewSelectedCategory = null;

 let livePreviewPendingCardAnimation = false;

 function readPreviewSettings() {
    const refs = shared.getRefs();
    const current = shared.getCurrentSettings();
    const isMobilePreview = document.getElementById('homeLivePreview')?.dataset.device === 'mobile';
    const cardSettings = isMobilePreview ? {
      gridCols: shared.getRadioValue(refs.mobileGridColsRadios, current.mobile_layout_grid_cols || '3'),
      cardStyle: current.mobile_layout_card_style || 'style2',
      hideCardDesc: !!refs.mobileHideDescSwitch?.checked,
      hideCardLinks: !!refs.mobileHideLinksSwitch?.checked,
      hideCardCategory: !!refs.mobileHideCategorySwitch?.checked,
      frosted: !!refs.mobileFrostedGlassSwitch?.checked,
      frostedIntensity: shared.getPreviewInputValueOrDefault(refs.mobileFrostedGlassIntensityRange, current.mobile_layout_frosted_glass_intensity, '15'),
      cardRadius: shared.getPreviewInputValueOrDefault(refs.mobileCardRadiusInput, current.mobile_layout_card_border_radius, '12'),
      cardTitleFont: shared.getPreviewInputValue(refs.mobileCardTitleFontInput, current.mobile_card_title_font || ''),
      cardTitleSize: shared.getPreviewInputValue(refs.mobileCardTitleSizeInput, current.mobile_card_title_size || ''),
      cardTitleColor: shared.getPreviewInputValue(refs.mobileCardTitleColorInput, current.mobile_card_title_color || ''),
      cardDescFont: shared.getPreviewInputValue(refs.mobileCardDescFontInput, current.mobile_card_desc_font || ''),
      cardDescSize: shared.getPreviewInputValue(refs.mobileCardDescSizeInput, current.mobile_card_desc_size || ''),
      cardDescColor: shared.getPreviewInputValue(refs.mobileCardDescColorInput, current.mobile_card_desc_color || ''),
    } : {
      gridCols: shared.getRadioValue(refs.gridColsRadios, current.layout_grid_cols || '4'),
      cardStyle: current.layout_card_style || 'style1',
      hideCardDesc: !!refs.hideDescSwitch?.checked,
      hideCardLinks: !!refs.hideLinksSwitch?.checked,
      hideCardCategory: !!refs.hideCategorySwitch?.checked,
      frosted: !!refs.frostedGlassSwitch?.checked,
      frostedIntensity: shared.getPreviewInputValueOrDefault(refs.frostedGlassIntensityRange, current.layout_frosted_glass_intensity, '15'),
      cardRadius: shared.getPreviewInputValueOrDefault(refs.cardRadiusInput, current.layout_card_border_radius, '12'),
      cardTitleFont: shared.getPreviewInputValue(refs.cardTitleFontInput, current.card_title_font || ''),
      cardTitleSize: shared.getPreviewInputValue(refs.cardTitleSizeInput, current.card_title_size || ''),
      cardTitleColor: shared.getPreviewInputValue(refs.cardTitleColorInput, current.card_title_color || ''),
      cardDescFont: shared.getPreviewInputValue(refs.cardDescFontInput, current.card_desc_font || ''),
      cardDescSize: shared.getPreviewInputValue(refs.cardDescSizeInput, current.card_desc_size || ''),
      cardDescColor: shared.getPreviewInputValue(refs.cardDescColorInput, current.card_desc_color || ''),
    };
    return {
      previewDevice: isMobilePreview ? 'mobile' : 'desktop',
      siteName: shared.getPreviewInputValueOrDefault(refs.homeSiteNameInput, current.home_site_name, '灰色轨迹'),
      siteDescription: shared.getPreviewInputValueOrDefault(refs.homeSiteDescriptionInput, current.home_site_description, '一个优雅、快速、易于部署的书签收藏与分享平台'),
      footerText: shared.getPreviewInputValueOrDefault(refs.homeFooterTextInput, current.home_footer_text, '曾梦想仗剑走天涯'),
      hideTitle: !!refs.hideTitleSwitch?.checked,
      hideSubtitle: !!refs.hideSubtitleSwitch?.checked,
      hideStats: !!refs.hideStatsSwitch?.checked,
      hideHitokoto: !!refs.hideHitokotoSwitch?.checked,
      hideAdmin: !!refs.hideAdminSwitch?.checked,
      searchEngines: !!refs.searchEngineSwitch?.checked,
      categoryPosition: shared.normalizeCategoryPosition(
        shared.getRadioValue(refs.categoryPositionRadios, current.home_category_position || 'below_search'),
        current.layout_menu_layout
      ),
      categoryFlow: shared.getRadioValue(refs.categoryFlowRadios, current.home_category_flow || 'single_line'),
      defaultCategory: shared.getPreviewInputValue(refs.homeDefaultCategorySelect, current.home_default_category || ''),
      ...cardSettings,
      wallpaper: shared.normalizePreviewUrl(shared.getPreviewInputValue(refs.customWallpaperInput, current.layout_custom_wallpaper || '')),
      bgBlur: !!refs.bgBlurSwitch?.checked,
      bgBlurIntensity: shared.getPreviewInputValueOrDefault(refs.bgBlurIntensityRange, current.layout_bg_blur_intensity, '0'),
      titleFont: shared.getPreviewInputValue(refs.homeTitleFontInput, current.home_title_font || ''),
      titleSize: shared.getPreviewInputValue(refs.homeTitleSizeInput, current.home_title_size || ''),
      titleColor: shared.getPreviewInputValue(refs.homeTitleColorInput, current.home_title_color || ''),
      subtitleFont: shared.getPreviewInputValue(refs.homeSubtitleFontInput, current.home_subtitle_font || ''),
      subtitleSize: shared.getPreviewInputValue(refs.homeSubtitleSizeInput, current.home_subtitle_size || ''),
      subtitleColor: shared.getPreviewInputValue(refs.homeSubtitleColorInput, current.home_subtitle_color || ''),
      statsFont: shared.getPreviewInputValue(refs.homeStatsFontInput, current.home_stats_font || ''),
      statsSize: shared.getPreviewInputValue(refs.homeStatsSizeInput, current.home_stats_size || ''),
      statsColor: shared.getPreviewInputValue(refs.homeStatsColorInput, current.home_stats_color || ''),
      hitokotoFont: shared.getPreviewInputValue(refs.homeHitokotoFontInput, current.home_hitokoto_font || ''),
      hitokotoSize: shared.getPreviewInputValue(refs.homeHitokotoSizeInput, current.home_hitokoto_size || ''),
      hitokotoColor: shared.getPreviewInputValue(refs.homeHitokotoColorInput, current.home_hitokoto_color || ''),
    };
  }

 function selectLivePreviewCategory(root, categoryName) {
    livePreviewSelectedCategory = String(categoryName || '').trim();
    livePreviewPendingCardAnimation = true;
    nav.closePreviewCategoryMoreMenus(root);
    if (root?.dataset.device === 'mobile') {
      root.classList.remove('mobile-menu-open');
      root.querySelector('[data-preview-role="mobileMenuToggle"]')?.setAttribute('aria-expanded', 'false');
    }
    scheduleFullPreviewRender();
  }

 function resetLivePreviewCategory() {
    livePreviewSelectedCategory = null;
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
      grid.innerHTML = `<div class="live-preview-state is-error">${shared.escapeHTML(previewState.error)}</div>`;
      return;
    }

    if (cards.length === 0) {
      grid.innerHTML = '<div class="live-preview-state">当前分类暂无书签</div>';
      return;
    }

    const hideCopyText = shared.shouldHideCopyTextForPreview(settings.previewDevice, settings.gridCols);

    grid.innerHTML = cards.map(card => {
      const initial = shared.escapeHTML(card.name.slice(0, 1).toUpperCase() || '站');
      const nameHtml = shared.escapeHTML(card.name);
      const urlHtml = shared.escapeHTML(card.url);
      const displayUrlHtml = shared.escapeHTML(card.displayUrl);
      const logoHtml = card.logo
        ? `<img src="${shared.escapeHTML(card.logo)}" alt="${nameHtml}" width="40" height="40" class="w-10 h-10 rounded-lg object-cover bg-gray-100" loading="lazy" decoding="async">`
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
                <span class="preview-category site-category inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700">
                  ${shared.escapeHTML(card.category)}
                </span>`;
      const descHtml = settings.hideCardDesc ? '' : `<p class="preview-desc mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2" title="${shared.escapeHTML(card.desc)}">${shared.escapeHTML(card.desc)}</p>`;
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
        <article class="${cardClass}" data-id="${shared.escapeHTML(card.id)}">
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
      shared.applyTextStyle(title, settings.cardTitleFont, settings.cardTitleSize, settings.cardTitleColor);
    });
    grid.querySelectorAll('.preview-desc').forEach(desc => {
      shared.applyTextStyle(desc, settings.cardDescFont, settings.cardDescSize, settings.cardDescColor);
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
    if (!data.isPreviewModalVisible()) return;

    const settings = readPreviewSettings();
    const categoryTree = data.getPreviewCategoryTree();
    const categoryNames = data.flattenCategoryNames(categoryTree);
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

    const previewState = data.getPreviewCardsState(activeCategory);
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
    const fallbackGridCols = isMobilePreview ? 3 : 4;
    const maxGridCols = isMobilePreview ? 3 : 7;
    const previewGridCols = Math.min(Math.max(Number(settings.gridCols) || fallbackGridCols, 1), maxGridCols);
    root.style.setProperty('--preview-grid-cols', String(previewGridCols));
    const cardRadius = shared.getPreviewNumberOrDefault(settings.cardRadius, 12);
    const frostedBlur = shared.getPreviewNumberOrDefault(settings.frostedIntensity, 15);
    root.style.setProperty('--preview-card-radius', `${cardRadius}px`);
    root.style.setProperty('--card-radius', `${cardRadius}px`);
    root.style.setProperty('--card-padding', '1rem');
    root.style.setProperty('--frosted-glass-blur', `${frostedBlur}px`);
    root.style.setProperty('--preview-frosted-blur', `${frostedBlur}px`);
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
      shared.applyTextStyle(title, settings.titleFont, settings.titleSize, settings.titleColor);
    }
    if (description) {
      description.textContent = settings.siteDescription;
      description.style.display = settings.hideSubtitle ? 'none' : '';
      shared.applyTextStyle(description, settings.subtitleFont, settings.subtitleSize, settings.subtitleColor);
    }

    if (searchEngines) searchEngines.style.display = settings.searchEngines ? 'flex' : 'none';
    if (adminIcon) adminIcon.style.display = settings.hideAdmin ? 'none' : '';
    if (sidebar) sidebar.style.display = (isHorizontal && !isMobilePreview) ? 'none' : '';

    if (categoryNav) {
      categoryNav.style.display = (isHorizontal && !isMobilePreview) ? 'flex' : 'none';
      categoryNav.classList.toggle('single-line', settings.categoryFlow === 'single_line');
      categoryNav.classList.toggle('multi-line', settings.categoryFlow === 'multi_line');
      nav.renderCategoryNav(categoryNav, categoryTree, activeCategory, true, { flow: settings.categoryFlow });
    }
    nav.renderCategoryNav(sidebarCategories, categoryTree, activeCategory, true, { variant: 'sidebar' });
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
      shared.applyTextStyle(statsText, settings.statsFont, settings.statsSize, settings.statsColor);
    }
    if (hitokotoText) {
      hitokotoText.style.display = settings.hideHitokoto ? 'none' : '';
      shared.applyTextStyle(hitokotoText, settings.hitokotoFont, settings.hitokotoSize, settings.hitokotoColor);
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
      requestAnimationFrame(() => ns.previewAnimation?.triggerPreviewAnimation?.());
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

 function isPreviewDevice(device) {
    return document.getElementById('homeLivePreview')?.dataset.device === device;
  }

 function schedulePreviewRenderForDevice(device) {
    if (isPreviewDevice(device)) scheduleFullPreviewRender();
  }

 function triggerPreviewAnimationForDevice(device) {
    if (isPreviewDevice(device)) requestAnimationFrame(() => ns.previewAnimation?.triggerPreviewAnimation?.());
  }

  ns.previewRender = {
    renderFullPreview,
    scheduleFullPreviewRender,
    schedulePreviewRenderForDevice,
    triggerPreviewAnimationForDevice,
    selectLivePreviewCategory,
    resetLivePreviewCategory,
  };
})();
