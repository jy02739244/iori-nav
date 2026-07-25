(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const shared = ns.previewShared;

 const FALLBACK_CATEGORIES = ['工具', '搜索', '设计', '开发', '阅读', '影音'];

 const PREVIEW_CARD_PAGE_SIZE = 200;

 const ALL_PREVIEW_CARDS_KEY = '__all__';

 const previewCardCache = new Map();

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
    const url = shared.normalizePreviewUrl(item?.url);
    const fallbackName = shared.getHostnameLabel(url) || '未命名书签';
    const name = String(item?.name || fallbackName).trim();
    const category = String(item?.catelog_name || item?.catelog || getPreviewCategoryById(item?.catelog_id) || '未分类').trim();

    return {
      id: item?.id ?? '',
      name,
      url,
      displayUrl: url || '未提供链接',
      logo: shared.normalizePreviewAssetUrl(item?.logo),
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
        ns.previewRender?.scheduleFullPreviewRender?.();
      });

    return state;
  }

 function getPreviewCardsState(categoryName = '') {
    return previewCardCache.get(getPreviewCardKey(categoryName)) || fetchPreviewCards(categoryName);
  }

 function invalidatePreviewCards() {
    previewCardCache.clear();
    ns.previewRender?.scheduleFullPreviewRender?.();
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

  ns.previewData = {
    fetchPreviewCards,
    getPreviewCardsState,
    invalidatePreviewCards,
    isPreviewModalVisible,
    getPreviewCategoryTree,
    getPreviewCategoryFilterNames,
    flattenCategoryNames,
    categoryHasActiveDescendant,
  };
})();
