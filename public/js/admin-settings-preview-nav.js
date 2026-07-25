(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const shared = ns.previewShared;
  const data = ns.previewData;

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
    const isActive = name === activeName || (isRoot && data.categoryHasActiveDescendant(node, activeName));
    const arrowHtml = hasChildren ? getCategoryArrowHtml(isRoot ? 'down' : 'right') : '';
    const childHtml = hasChildren
      ? `<div class="live-category-dropdown">${children.map(child => renderHorizontalCategoryItem(child, activeName, level + 1)).join('')}</div>`
      : '';

    return `
      <div class="live-category-item ${isRoot ? 'is-root' : 'is-child'}">
        <span class="live-category-button ${isActive ? 'active' : ''}" data-preview-category="${shared.escapeHTML(name)}" role="button" tabindex="0">${shared.escapeHTML(name)}${arrowHtml}</span>
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
      <span class="live-sidebar-item ${isActive ? 'active' : ''}" data-preview-category="${shared.escapeHTML(name)}" role="button" tabindex="0" style="--live-sidebar-indent: ${level * 0.75}rem">
        ${getSidebarCategoryIcon(name)}
        <span class="live-sidebar-label">${shared.escapeHTML(name)}</span>
      </span>
      ${childHtml}`;
  }

 function collapseOverflowCategories(container) {
    // 与首页一致：单行最多 8 个按钮 = 根分类（含「全部」）+ 「更多」
    // 有「更多」时根分类最多 7 个；顶部/搜索框上/下位置数量一致
    const MAX_VISIBLE_BUTTONS = 8;
    const MAX_VISIBLE_ROOT_WITH_MORE = MAX_VISIBLE_BUTTONS - 1; // 7
    const availableWidth = container?.clientWidth || container?.parentElement?.clientWidth || 0;
    const getVisibleRootItems = () => Array.from(container.children).filter(
      item => !item.classList.contains('live-category-more-wrapper')
    );
    const measureItemsWidth = () => {
      const styles = window.getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return Array.from(container.children).reduce((total, item, index) => (
        total + item.offsetWidth + (index > 0 ? gap : 0)
      ), 0);
    };

    if (!availableWidth) return;
    const rootCount = getVisibleRootItems().length;
    // 优先按数量统一：>7 才折叠，保证各位置都是 7+更多=8（窄屏再按宽度收）
    if (rootCount <= MAX_VISIBLE_ROOT_WITH_MORE && measureItemsWidth() <= availableWidth) return;

    container.insertAdjacentHTML('beforeend', getMoreCategoryHtml(false));
    const moreWrapper = container.querySelector('.live-category-more-wrapper');
    const moreButton = container.querySelector('.live-category-more');
    const moreDropdown = container.querySelector('.live-category-more-dropdown');
    const visibleItems = Array.from(container.children).filter(item => item !== moreWrapper);
    let hiddenHasActive = false;

    while (visibleItems.length > MAX_VISIBLE_ROOT_WITH_MORE) {
      const hiddenItem = visibleItems.pop();
      if (!hiddenItem) break;
      hiddenHasActive = hiddenHasActive
        || hiddenItem.classList.contains('active')
        || Boolean(hiddenItem.querySelector?.('.active'));
      moreDropdown?.insertBefore(hiddenItem, moreDropdown.firstChild);
    }

    while (visibleItems.length > 1 && measureItemsWidth() > availableWidth) {
      const hiddenItem = visibleItems.pop();
      if (!hiddenItem) break;
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

  ns.previewNav = {
    renderCategoryNav,
    closePreviewCategoryMoreMenus,
  };
})();
