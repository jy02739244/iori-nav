(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initCategoryNavigation = function () {
    const navContainer = document.getElementById('horizontalCategoryNav');
    const moreWrapper = document.getElementById('horizontalMoreWrapper');
    const moreBtn = document.getElementById('horizontalMoreBtn');
    const dropdown = document.getElementById('horizontalMoreDropdown');
    const cardController = Home.cardController;
    let checkOverflow = () => { };
    let resetNav = () => { };

    // moreWrapper 仅在设置「分类展示=单行」时由 SSR 输出；多行模式无此节点，不进入折叠逻辑
    if (navContainer && moreWrapper && moreBtn && dropdown) {
      resetNav = () => {
        const dropdownItems = Array.from(dropdown.children);
        dropdownItems.forEach(item => {
          if (item.dataset.originalClass) item.className = item.dataset.originalClass;
          const link = item.querySelector('a');
          if (link && link.dataset.originalClass) link.className = link.dataset.originalClass;
          navContainer.insertBefore(item, moreWrapper);
        });
        moreWrapper.classList.add('hidden');
        moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
        moreBtn.classList.add('inactive');
      };

      const getCategories = () => Array.from(navContainer.children).filter(el => el !== moreWrapper);

      const getVisibleItems = () => Array.from(navContainer.children).filter((el) => {
        if (el === moreWrapper) return !moreWrapper.classList.contains('hidden');
        return true;
      });

      // 单行统一为最多 8 个按钮：根分类（含「全部」）+ 「更多」
      // 有「更多」时根分类最多 7 个；顶部/搜索框上/下位置数量一致
      const MAX_VISIBLE_BUTTONS = 8;
      const MAX_VISIBLE_ROOT_WITH_MORE = MAX_VISIBLE_BUTTONS - 1; // 7

      // 与后台预览 collapseOverflowCategories 一致：按可用宽度折叠
      const measureItemsWidth = () => {
        const styles = window.getComputedStyle(navContainer);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        return getVisibleItems().reduce((total, item, index) => (
          total + item.offsetWidth + (index > 0 ? gap : 0)
        ), 0);
      };

      const needsCollapse = (availableWidth) => {
        const count = getCategories().length;
        // 超过 7 个根分类，或宽度放不下（名称很长/窄屏）
        if (count > MAX_VISIBLE_ROOT_WITH_MORE) return true;
        void navContainer.offsetWidth;
        return measureItemsWidth() > availableWidth;
      };

      const moveCategoryToDropdown = (lastCategory) => {
        if (!lastCategory.dataset.originalClass) {
          lastCategory.dataset.originalClass = lastCategory.className;
        }

        lastCategory.className = 'menu-item-wrapper block w-full relative';

        const link = lastCategory.querySelector('a');
        if (link) {
          link.dataset.originalClass = link.className;
          const isActive = link.classList.contains('active');
          link.className = 'dropdown-item w-full text-left px-4 py-2 text-sm';
          if (isActive) link.classList.add('active');
        }

        dropdown.insertBefore(lastCategory, dropdown.firstChild);
      };

      const restoreCategoryFromDropdown = () => {
        const item = dropdown.firstElementChild;
        if (!item) return null;
        if (item.dataset.originalClass) item.className = item.dataset.originalClass;
        const link = item.querySelector('a');
        if (link && link.dataset.originalClass) link.className = link.dataset.originalClass;
        navContainer.insertBefore(item, moreWrapper);
        return item;
      };

      checkOverflow = () => {
        // 「更多」打开时不要 reset，否则会拆掉弹出层并关菜单
        if (!dropdown.classList.contains('hidden')) return;

        resetNav();
        // 必须 visible，否则多级 hover 下拉与 #horizontalMoreDropdown 会被裁切
        navContainer.style.overflow = 'visible';
        if (navContainer.parentElement) {
          navContainer.parentElement.style.overflow = 'visible';
        }

        const navChildren = getCategories();
        if (navChildren.length === 0) return;

        const availableWidth = navContainer.clientWidth || navContainer.parentElement?.clientWidth || 0;
        // 布局未完成时跳过，后续 ResizeObserver / fonts 会再算
        if (availableWidth < 48) return;

        // 1) 根分类 >7 → 先收到 7 个，保证各位置统一为 7+更多=8
        // 2) 宽度仍不够（≤7 但名称很长/窄屏）→ 继续按宽度收，至少保留 1 个
        void navContainer.offsetWidth;
        if (!needsCollapse(availableWidth)) return;

        moreWrapper.classList.remove('hidden');

        while (getCategories().length > MAX_VISIBLE_ROOT_WITH_MORE) {
          const cats = getCategories();
          moveCategoryToDropdown(cats[cats.length - 1]);
        }

        while (getCategories().length > 1 && measureItemsWidth() > availableWidth) {
          const cats = getCategories();
          moveCategoryToDropdown(cats[cats.length - 1]);
        }

        // 禁止只剩「···」
        if (getCategories().length === 0) {
          restoreCategoryFromDropdown();
        }

        const activeInDropdown = dropdown.querySelector('.active');
        if (activeInDropdown) {
          moreBtn.classList.add('active');
          moreBtn.classList.remove('inactive');
          moreBtn.classList.add('text-primary-600', 'bg-secondary-100');
        } else {
          moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
          moreBtn.classList.add('inactive');
        }
      };

      const scheduleOverflowCheck = () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(checkOverflow, 50);
      };

      // 首屏多次测量：覆盖字体加载与异步布局
      requestAnimationFrame(() => {
        requestAnimationFrame(checkOverflow);
      });
      setTimeout(checkOverflow, 100);
      setTimeout(checkOverflow, 400);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleOverflowCheck).catch(() => {});
      }

      window.addEventListener('resize', scheduleOverflowCheck);
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(scheduleOverflowCheck);
        ro.observe(navContainer);
        if (navContainer.parentElement) ro.observe(navContainer.parentElement);
      }

      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
          dropdown.classList.remove('hidden');
          dropdown.classList.add('show');
          document.body.classList.add('menu-open');
        } else {
          dropdown.classList.add('hidden');
          dropdown.classList.remove('show');
          document.body.classList.remove('menu-open');
        }
      });

      dropdown.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
          dropdown.classList.add('hidden');
          dropdown.classList.remove('show');
          document.body.classList.remove('menu-open');
        }
      });

      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !moreBtn.contains(e.target)) {
          dropdown.classList.add('hidden');
          dropdown.classList.remove('show');
          document.body.classList.remove('menu-open');
        }
      });
    }

    document.addEventListener('click', async (e) => {
      const link = e.target.closest('a[href^="?catalog="]');
      if (!link) return;

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      const href = link.getAttribute('href');
      const catalogId = link.getAttribute('data-id');
      const catalogName = link.textContent.trim();

      Home.closeSidebarMenu?.();

      const sitesGrid = document.getElementById('sitesGrid');
      if (!sitesGrid) return;

      sitesGrid.style.transition = 'opacity 0.15s ease-out';
      sitesGrid.style.opacity = '0';

      try {
        if (!window.IORI_SITES || !cardController) {
          window.location.href = href;
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        sitesGrid.style.transition = 'none';
        sitesGrid.style.opacity = '1';

        const filteredSites = cardController.getSitesForCatalog(catalogId);
        cardController.setActiveCatalogId(catalogId);
        cardController.renderSites(filteredSites);
        Home.updateHeading?.(null, catalogId ? catalogName : null, filteredSites.length);
        updateNavigationState(catalogId);

        const config = window.IORI_LAYOUT_CONFIG || {};
        if (config.rememberLastCategory) {
          if (catalogId) {
            localStorage.setItem('iori_last_category', catalogId);
            setCookie('iori_last_category', catalogId, 365);
          } else {
            localStorage.setItem('iori_last_category', 'all');
            setCookie('iori_last_category', 'all', 365);
          }
        }
      } catch (err) {
        console.error('Client-side navigation failed:', err);
      }
    });

    function setCookie(name, value, days) {
      let expires = "";
      if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    }

    function updateNavigationState(catalogId) {
      const allLinks = document.querySelectorAll('a.nav-btn, a.dropdown-item');
      allLinks.forEach(link => {
        const linkId = link.getAttribute('data-id');
        const isActive = (!catalogId && !linkId) || (String(linkId) === String(catalogId));

        if (isActive) {
          link.classList.remove('inactive');
          link.classList.add('active', 'nav-item-active');
        } else {
          link.classList.remove('active', 'nav-item-active');
          link.classList.add('inactive');
        }
        link.dataset.originalClass = link.className;
      });

      if (navContainer) {
        const topWrappers = Array.from(navContainer.children);
        topWrappers.forEach(wrapper => {
          const topLink = wrapper.querySelector(':scope > a.nav-btn');
          if (!topLink) return;

          const topLinkId = topLink.getAttribute('data-id');
          if (String(topLinkId) !== String(catalogId)) {
            const subLink = wrapper.querySelector(`a[data-id="${catalogId}"]`);
            if (subLink) {
              topLink.classList.remove('inactive');
              topLink.classList.add('active', 'nav-item-active');
              topLink.dataset.originalClass = topLink.className;
            }
          }
        });
      }

      if (dropdown && moreBtn) {
        const activeInDropdown = dropdown.querySelector('.active');
        if (activeInDropdown) {
          moreBtn.classList.add('active', 'text-primary-600', 'bg-secondary-100');
          moreBtn.classList.remove('inactive');
        } else {
          moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
          moreBtn.classList.add('inactive');
        }
      }

      if (!catalogId) {
        const allBtn = document.querySelector('a[href="?catalog=all"]');
        if (allBtn) {
          allBtn.classList.remove('inactive');
          allBtn.classList.add('active', 'nav-item-active');
        }
      }

      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const links = sidebar.querySelectorAll('a[data-id], a[href="?catalog=all"]');
        links.forEach(link => {
          const svg = link.querySelector('svg');
          const linkId = link.getAttribute('data-id');
          const isActive = (!catalogId && !linkId) || (String(linkId) === String(catalogId));

          if (isActive) {
            link.classList.remove('hover:bg-gray-100', 'text-gray-700', 'dark:hover:bg-gray-800', 'dark:text-gray-300');
            link.classList.add('bg-secondary-100', 'text-primary-700', 'dark:bg-gray-800', 'dark:text-primary-400');

            if (svg) {
              svg.classList.remove('text-gray-400', 'dark:text-gray-500');
              svg.classList.add('text-primary-600', 'dark:text-primary-400');
            }
          } else {
            link.classList.remove('bg-secondary-100', 'text-primary-700', 'dark:bg-gray-800', 'dark:text-primary-400');
            link.classList.add('hover:bg-gray-100', 'text-gray-700', 'dark:text-gray-300', 'dark:hover:bg-gray-800');

            if (svg) {
              svg.classList.remove('text-primary-600', 'dark:text-primary-400');
              svg.classList.add('text-gray-400', 'dark:text-gray-500');
            }
          }
        });
      }
    }

    function restoreLastCategory() {
      const config = window.IORI_LAYOUT_CONFIG || {};
      const urlParams = new URLSearchParams(window.location.search);
      const hasCatalogParam = urlParams.has('catalog');

      if (!config.rememberLastCategory || hasCatalogParam || !cardController) return;

      let lastId = localStorage.getItem('iori_last_category');

      if (!lastId) {
        const match = document.cookie.match(/iori_last_category=(all|\d+)/);
        if (match) {
          lastId = match[1];
        }
      }

      if (!lastId) return;

      if (String(lastId) === String(config.ssrCatalogId)) {
        return;
      }

      if (lastId === 'all') {
        const allSites = window.IORI_SITES || [];
        cardController.setActiveCatalogId(null);
        cardController.renderSites(allSites);
        Home.updateHeading?.(null, null, allSites.length);
        updateNavigationState(null);
        return;
      }

      const link = document.querySelector(`a[data-id="${lastId}"]`);

      if (link) {
        const catalogName = link.innerText.trim();
        const filteredSites = cardController.getSitesForCatalog(lastId);

        cardController.setActiveCatalogId(lastId);
        cardController.renderSites(filteredSites);
        Home.updateHeading?.(null, catalogName, filteredSites.length);
        updateNavigationState(lastId);
      } else {
        localStorage.removeItem('iori_last_category');
      }
    }

    Home.updateNavigationState = updateNavigationState;
    restoreLastCategory();
  };
})();
