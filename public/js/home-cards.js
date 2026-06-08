(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.createCardController = function () {
    const initialCards = document.querySelectorAll('.site-card.card-anim-enter');
    const sitesGrid = document.getElementById('sitesGrid');
    const defaultCardConfig = {
      hideDesc: false,
      hideLinks: false,
      hideCategory: false,
      hideCopyText: false,
      enableFrostedGlass: false,
      cardStyle: 'style1',
      cardAnimation: 'radial',
      gridCols: '4',
      aboveFoldImageCount: 8,
      baseCardClass: 'site-card group h-full flex flex-col bg-white border border-primary-100/60 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700',
      frostedClass: '',
      cardStyleClass: '',
      titleClass: 'site-title text-base font-medium text-gray-900 dark:text-gray-100 truncate transition-all duration-300 origin-left',
      descClass: 'mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2',
      categoryClass: 'site-category inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700 dark:bg-secondary-800 dark:text-primary-300',
      linkRowClass: 'mt-3 flex items-center justify-between',
      urlTextClass: 'text-xs text-primary-600 dark:text-primary-400 truncate flex-1 min-w-0 mr-2',
      copyButtonBaseClass: 'copy-btn relative flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors',
      copyButtonEnabledClass: 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50',
      copyButtonDisabledClass: 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500',
      logoClass: 'w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700',
      siteIconClass: 'site-icon flex-shrink-0 mr-4 transition-all duration-300',
    };
    const cardConfigSets = window.IORI_CARD_CONFIGS || {
      desktop: window.IORI_CARD_CONFIG || defaultCardConfig,
      mobile: window.IORI_CARD_CONFIG || defaultCardConfig,
    };
    const cardAnimationTypes = ['slideUp', 'radial', 'fadeIn', 'slideLeft', 'slideRight', 'convergeIn', 'flipIn'];
    const cardAnimationClasses = cardAnimationTypes.map(type => `card-anim-${type}`);
    const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const mobileCardQuery = window.matchMedia?.('(max-width: 767px)');
    let activeCardDevice = '';
    let cardConfig = getActiveCardConfig();
    let activeRenderedCatalogId = window.IORI_LAYOUT_CONFIG?.ssrCatalogId && window.IORI_LAYOUT_CONFIG.ssrCatalogId !== 'all'
      ? String(window.IORI_LAYOUT_CONFIG.ssrCatalogId)
      : null;

    function getCardDevice() {
      return mobileCardQuery?.matches ? 'mobile' : 'desktop';
    }

    function getActiveCardConfig() {
      const device = getCardDevice();
      activeCardDevice = device;
      return cardConfigSets[device] || cardConfigSets.desktop || window.IORI_CARD_CONFIG || defaultCardConfig;
    }

    function getSitesForCatalog(catalogId) {
      const allSites = window.IORI_SITES || [];
      if (!catalogId) return allSites;
      return allSites.filter(site => String(site.catelog_id) === String(catalogId));
    }

    function applyCardGridColumns() {
      if (!sitesGrid || getCardDevice() !== 'mobile') return;
      const cols = String(cardConfig.gridCols || '2');
      const mobileGridClass = cols === '1' ? 'grid-cols-1' : (cols === '3' ? 'grid-cols-3' : 'grid-cols-2');
      const mobileCardStyleClass = cardConfig.cardStyle === 'style1' ? 'mobile-card-style1' : 'mobile-card-style2';
      sitesGrid.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3');
      sitesGrid.classList.remove('mobile-card-style1', 'mobile-card-style2');
      sitesGrid.classList.add(mobileGridClass);
      sitesGrid.classList.add(mobileCardStyleClass);
    }

    function syncCardConfigForViewport(options = {}) {
      const device = getCardDevice();
      const nextConfig = cardConfigSets[device] || cardConfigSets.desktop || defaultCardConfig;
      if (!options.force && device === activeCardDevice && nextConfig === cardConfig) return;

      activeCardDevice = device;
      cardConfig = nextConfig;
      applyCardGridColumns();
      renderSites(getSitesForCatalog(activeRenderedCatalogId));
      Home.reapplyLocalSearchFilter?.();
    }

    function prefersReducedCardMotion() {
      return reducedMotionQuery?.matches === true;
    }

    function resolveCardAnimationName() {
      const configured = cardConfig.cardAnimation || window.IORI_LAYOUT_CONFIG?.cardAnimation || 'radial';
      if (configured === 'random') {
        return cardAnimationTypes[Math.floor(Math.random() * cardAnimationTypes.length)];
      }
      return cardAnimationTypes.includes(configured) ? configured : 'radial';
    }

    function getAnimationColumnCount() {
      const templateColumns = sitesGrid ? window.getComputedStyle(sitesGrid).gridTemplateColumns : '';
      if (templateColumns && templateColumns !== 'none') {
        const renderedCols = templateColumns.trim().split(/\s+/).filter(Boolean).length;
        if (renderedCols > 0) return renderedCols;
      }

      const configuredCols = String(cardConfig.gridCols || window.IORI_LAYOUT_CONFIG?.gridCols || (getCardDevice() === 'mobile' ? '2' : '4'));
      const width = window.innerWidth;
      if (width < 768) {
        const mobileCols = Number(configuredCols);
        return Number.isFinite(mobileCols) && mobileCols > 0 ? mobileCols : 2;
      }
      if (width < 1024) return 3;

      if (getCardDevice() === 'mobile') {
        const mobileCols = Number(configuredCols);
        return Number.isFinite(mobileCols) && mobileCols > 0 ? mobileCols : 2;
      }
      if (configuredCols === '6') return width >= 1200 ? 6 : 5;
      if (configuredCols === '7') return width >= 1280 ? 7 : 5;

      const cols = Number(configuredCols);
      return Number.isFinite(cols) && cols > 0 ? cols : 4;
    }

    function getCardAnimationDelay(index, animationType) {
      const cols = getAnimationColumnCount();
      const row = Math.floor(index / cols);
      const col = index % cols;
      const centerCol = (cols - 1) / 2;
      let delay = 0;

      if (animationType === 'radial') {
        delay = (Math.abs(col - centerCol) + row) * 80;
      } else if (animationType === 'fadeIn') {
        delay = Math.random() * 500;
      } else if (animationType === 'slideLeft') {
        delay = row * 100;
      } else if (animationType === 'slideRight') {
        delay = (row + (cols - col - 1) * 0.02) * 80;
      } else if (animationType === 'convergeIn') {
        const maxDistance = Math.max(centerCol, cols - centerCol - 1);
        delay = (maxDistance - Math.abs(col - centerCol)) * 80;
      } else if (animationType === 'flipIn') {
        delay = (row + col) * 60;
      } else {
        delay = index * 50;
      }

      return Math.min(delay, 1000);
    }

    function prepareCardAnimation(card, index, animationType) {
      const cols = getAnimationColumnCount();
      const col = index % cols;
      const centerCol = (cols - 1) / 2;

      cardAnimationClasses.forEach(className => card.classList.remove(className));
      card.classList.remove('card-anim-flip-settle', 'card-anim-flip-settle-fade');
      card.style.removeProperty('--card-anim-x');
      card.style.removeProperty('--card-anim-y');

      if (animationType === 'convergeIn') {
        const offset = col - centerCol;
        const distance = Math.abs(offset);
        const isCenter = distance <= 0.5;
        const x = isCenter ? 0 : Math.sign(offset) * Math.min(80, 28 + distance * 22);
        const y = isCenter ? -30 : 0;
        card.style.setProperty('--card-anim-x', `${x}px`);
        card.style.setProperty('--card-anim-y', `${y}px`);
      }

      card.classList.add(`card-anim-${animationType}`);

      const delay = getCardAnimationDelay(index, animationType);
      if (delay > 0) {
        card.style.animationDelay = `${delay}ms`;
      } else {
        card.style.removeProperty('animation-delay');
      }
    }

    function cleanupCardAnimation(card) {
      const wasFlipIn = card.classList.contains('card-anim-flipIn');
      card.classList.add('card-anim-cleanup');
      if (wasFlipIn) {
        card.classList.add('card-anim-flip-settle');
      }
      card.classList.remove('card-anim-enter');
      cardAnimationClasses.forEach(className => card.classList.remove(className));
      card.style.removeProperty('--card-anim-x');
      card.style.removeProperty('--card-anim-y');
      card.style.removeProperty('animation-delay');
      window.requestAnimationFrame(() => {
        card.classList.remove('card-anim-cleanup');
        if (!wasFlipIn) return;
        card.classList.add('card-anim-flip-settle-fade');
        window.setTimeout(() => {
          card.classList.remove('card-anim-flip-settle', 'card-anim-flip-settle-fade');
        }, 160);
      });
    }

    function bindCardAnimationCleanup(card) {
      if (prefersReducedCardMotion()) {
        cleanupCardAnimation(card);
        return;
      }

      let isCleaned = false;
      let fallbackTimer = null;

      const cleanup = () => {
        if (isCleaned) return;
        isCleaned = true;
        cleanupCardAnimation(card);
        card.removeEventListener('animationend', handleAnimationEnd);
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
      };

      const handleAnimationEnd = (event) => {
        if (event.target !== card) return;
        cleanup();
      };

      const delayMs = Number.parseFloat(card.style.animationDelay) || 0;
      fallbackTimer = window.setTimeout(cleanup, delayMs + 900);
      card.addEventListener('animationend', handleAnimationEnd);
    }

    function animateCardBatch(cards) {
      const animationType = resolveCardAnimationName();
      cards.forEach((card, index) => prepareCardAnimation(card, index, animationType));
    }

    function renderSites(sites) {
      if (!sitesGrid) return;

      applyCardGridColumns();
      Home.clearSearchCardCache?.();

      sitesGrid.innerHTML = '';

      if (sites.length === 0) {
        sitesGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">本分类下暂无书签</div>';
        return;
      }

      const animationType = resolveCardAnimationName();

      sites.forEach((site, index) => {
        const isAboveFold = index < (cardConfig.aboveFoldImageCount || 8);
        const imgLoadingAttrs = isAboveFold ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
        const logoHtml = site.logoUrlHtml
          ? `<img src="${site.logoUrlHtml}" alt="${site.nameHtml}" width="40" height="40" class="${cardConfig.logoClass}" ${imgLoadingAttrs}>`
          : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${site.cardInitialHtml}</div>`;

        const descHtml = cardConfig.hideDesc ? '' : `<p class="${cardConfig.descClass}" title="${site.descHtml}">${site.descHtml}</p>`;

        const linksHtml = cardConfig.hideLinks ? '' : `
          <div class="${cardConfig.linkRowClass}">
            <span class="${cardConfig.urlTextClass}" title="${site.displayUrlHtml}">${site.displayUrlHtml}</span>
            <button class="${cardConfig.copyButtonBaseClass} ${site.hasValidUrl ? cardConfig.copyButtonEnabledClass : cardConfig.copyButtonDisabledClass}" data-url="${site.urlHtml}" ${site.hasValidUrl ? '' : 'disabled'}>
              <svg class="h-3 w-3 ${cardConfig.hideCopyText ? '' : 'mr-1'}"><use href="#icon-copy"/></svg>
              ${cardConfig.hideCopyText ? '' : '<span class="copy-text">复制</span>'}
              <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
            </button>
          </div>`;

        const categoryHtml = cardConfig.hideCategory ? '' : `
                <span class="${cardConfig.categoryClass}">
                  ${site.catalogHtml}
                </span>`;

        const card = document.createElement('div');
        card.className = `${cardConfig.baseCardClass} ${cardConfig.frostedClass} ${cardConfig.cardStyleClass} card-anim-enter`;
        prepareCardAnimation(card, index, animationType);
        bindCardAnimationCleanup(card);

        card.setAttribute('data-id', site.id);

        card.innerHTML = `
        <div class="site-card-content">
          <a href="${site.urlHtml || '#'}" ${site.hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-start">
              <div class="${cardConfig.siteIconClass}">
                ${logoHtml}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="${cardConfig.titleClass}" title="${site.nameHtml}">${site.nameHtml}</h3>
                ${categoryHtml}
              </div>
            </div>
            ${descHtml}
          </a>
          ${linksHtml}
        </div>
        `;

        sitesGrid.appendChild(card);
      });
    }

    function init() {
      animateCardBatch(initialCards);
      initialCards.forEach((card) => {
        bindCardAnimationCleanup(card);
      });

      mobileCardQuery?.addEventListener('change', () => {
        syncCardConfigForViewport();
      });

      if (getCardDevice() === 'mobile') {
        syncCardConfigForViewport({ force: true });
      }
    }

    return {
      init,
      renderSites,
      getSitesForCatalog,
      setActiveCatalogId(catalogId) {
        activeRenderedCatalogId = catalogId ? String(catalogId) : null;
      },
    };
  };
})();
