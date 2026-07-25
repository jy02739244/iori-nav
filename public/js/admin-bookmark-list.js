(function () {
  const configGrid = document.getElementById('configGrid');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const currentPageSpan = document.getElementById('currentPage');
  const totalPagesSpan = document.getElementById('totalPages');
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const SEARCH_DEBOUNCE_MS = 300;

  let currentPage = 1;
  let pageSize = 50;
  let totalItems = 0;
  let allConfigs = [];
  let currentSearchKeyword = '';
  let currentCategoryFilter = '';

  function getSearchValue() {
    if (!searchInput) return;
    if (searchInput.isContentEditable) {
      return (searchInput.textContent || '').replace(/\u00a0/g, ' ');
    }
    return searchInput.value || '';
  }

  function updateSearchPlaceholder() {
    if (!searchInput?.isContentEditable) return;
    searchInput.dataset.empty = getSearchValue().trim() ? 'false' : 'true';
  }

  function initSearchBox() {
    if (!searchInput) return;

    if (!searchInput.isContentEditable) return;

    searchInput.textContent = '';
    searchInput.setAttribute('inputmode', 'search');
    searchInput.setAttribute('enterkeyhint', 'search');
    searchInput.setAttribute('spellcheck', 'false');
    updateSearchPlaceholder();

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    searchInput.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
      document.execCommand('insertText', false, text.replace(/[\r\n]+/g, ' '));
      updateSearchPlaceholder();
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    searchInput.addEventListener('input', updateSearchPlaceholder);
    searchInput.addEventListener('blur', updateSearchPlaceholder);
  }

  function updatePaginationButtons() {
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= Math.ceil(totalItems / pageSize);
  }

  function renderLoadingState() {
    if (!configGrid) return;
    configGrid.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-20">
        <div class="w-10 h-10 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <p class="text-gray-500 text-sm">正在加载书签数据...</p>
      </div>
    `;
  }

  function getConfigParams(page, keyword, catalogId) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('pageSize', pageSize);

    if (keyword) params.append('keyword', keyword);
    if (catalogId) params.append('catalogId', catalogId);

    return params;
  }

  function fetchConfigs(page = currentPage, keyword = currentSearchKeyword, catalogId = currentCategoryFilter) {
    renderLoadingState();

    const params = getConfigParams(page, keyword, catalogId);
    fetch(`/api/config?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.code === 200) {
          totalItems = data.total;
          currentPage = data.page;
          if (totalPagesSpan) totalPagesSpan.innerText = Math.ceil(totalItems / pageSize);
          if (currentPageSpan) currentPageSpan.innerText = currentPage;
          allConfigs = data.data;
          window.AdminSettings?.preview?.invalidatePreviewCards?.();
          renderConfig(allConfigs);
          updatePaginationButtons();
          return;
        }

        window.showMessage(data.message, 'error');
        if (configGrid) {
          configGrid.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">${window.escapeHTML(data.message)}</div>`;
        }
      })
      .catch(err => {
        window.showMessage('网络错误', 'error');
        if (configGrid) {
          configGrid.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">网络错误: ${window.escapeHTML(err.message)}</div>`;
        }
      });
  }

  function getPrivateIcon(config) {
    if (!config.is_private) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 ml-1 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="私密书签"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>`;
  }

  function getLogoHtml(config, safeName, cardInitial) {
    const normalizedLogo = window.normalizeUrl(config.logo);
    if (normalizedLogo) {
      return `<img src="${window.escapeHTML(normalizedLogo)}" alt="${safeName}" class="w-full h-full rounded-lg object-cover bg-gray-50">`;
    }
    return `<div class="w-full h-full rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-lg">${cardInitial}</div>`;
  }

  function renderConfigCard(config) {
    const card = document.createElement('div');
    const safeName = window.escapeHTML(config.name || '');
    const normalizedUrl = window.normalizeUrl(config.url);
    const displayUrl = config.url ? window.escapeHTML(config.url) : '未提供';
    const descCell = config.desc ? window.escapeHTML(config.desc) : '暂无描述';
    const safeCatalog = window.escapeHTML(config.catelog_name || '未分类');
    const cardInitial = (safeName.charAt(0) || '站').toUpperCase();
    const privateIcon = getPrivateIcon(config);
    const logoHtml = getLogoHtml(config, safeName, cardInitial);

    card.className = 'site-card group cursor-pointer';
    card.draggable = true;
    card.dataset.id = config.id;
    card.addEventListener('click', () => {
      if (normalizedUrl) {
        window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
      }
    });

    card.innerHTML = `
      <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button class="edit-btn p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors shadow-sm" title="编辑" data-id="${config.id}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="del-btn p-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors shadow-sm" title="删除" data-id="${config.id}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-5">
        <div class="block">
          <div class="flex items-start">
            <div class="site-icon flex-shrink-0 mr-4">
              ${logoHtml}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1">
                <h3 class="site-title truncate" title="${safeName}">${safeName}</h3>
                ${privateIcon}
              </div>
              <span class="inline-flex items-center px-2 py-0.5 mt-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                ${safeCatalog}
              </span>
            </div>
          </div>
          <p class="mt-3 text-sm text-gray-500 leading-relaxed line-clamp-2 h-10" title="${descCell}">${descCell}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span class="truncate max-w-[150px] font-mono" title="${displayUrl}">${displayUrl}</span>
          <span class="bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100">ID: ${config.id}</span>
        </div>
      </div>
    `;

    return card;
  }

  function renderConfig(configs) {
    if (!configGrid) return;
    configGrid.innerHTML = '';

    if (configs.length === 0) {
      configGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">没有配置数据</div>';
      return;
    }

    configs.forEach(config => {
      configGrid.appendChild(renderConfigCard(config));
    });

    bindActionEvents();
    setupDragAndDrop();
  }

  function bindActionEvents() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.handleEdit(this.dataset.id);
      });
    });

    document.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.handleDelete(this.dataset.id);
      });
    });
  }

  window.handleEdit = function (id) {
    const config = allConfigs.find(c => c.id == id);
    if (!config) {
      window.showMessage('找不到书签数据', 'error');
      return;
    }

    document.getElementById('editBookmarkId').value = config.id;
    document.getElementById('editBookmarkName').value = config.name;
    document.getElementById('editBookmarkUrl').value = config.url;
    document.getElementById('editBookmarkLogo').value = config.logo;
    document.getElementById('editBookmarkDesc').value = config.desc;
    document.getElementById('editBookmarkSortOrder').value = config.sort_order;
    document.getElementById('editBookmarkIsPrivate').checked = !!config.is_private;
    window.createCascadingDropdown('editBookmarkCatelogWrapper', 'editBookmarkCatelog', window.categoriesTree, config.catelog_id);

    const editModal = document.getElementById('editBookmarkModal');
    if (editModal) {
      editModal.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  };

  window.deleteTargetId = null;

  window.handleDelete = function (id) {
    window.deleteTargetId = id;
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    if (deleteConfirmModal) {
      deleteConfirmModal.style.display = 'block';
      document.body.classList.add('modal-open');
    } else if (confirm('确定删除该书签吗？')) {
      window.performDelete(id);
    }
  };

  window.performDelete = function (id) {
    fetch(`/api/config/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.code === 200) {
          window.showMessage('删除成功', 'success', data.cacheCleared);
          fetchConfigs();
          return;
        }
        window.showMessage(data.message || '删除失败', 'error');
      })
      .catch(() => {
        window.showMessage('网络错误', 'error');
      });
  };

  function setupDragAndDrop() {
    const cards = document.querySelectorAll('#configGrid .site-card');
    let draggedItem = null;

    cards.forEach(card => {
      card.addEventListener('dragstart', function (e) {
        draggedItem = this;
        this.classList.add('opacity-50', 'scale-95');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
      });

      card.addEventListener('dragend', function () {
        this.classList.remove('opacity-50', 'scale-95');
        draggedItem = null;
        document.querySelectorAll('.site-card').forEach(c => c.classList.remove('border-2', 'border-accent-500'));
      });

      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('border-2', 'border-accent-500');
      });

      card.addEventListener('dragleave', function () {
        this.classList.remove('border-2', 'border-accent-500');
      });

      card.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('border-2', 'border-accent-500');

        if (draggedItem !== this) {
          const allCards = Array.from(configGrid.children);
          const draggedIdx = allCards.indexOf(draggedItem);
          const droppedIdx = allCards.indexOf(this);

          if (draggedIdx < droppedIdx) {
            this.after(draggedItem);
          } else {
            this.before(draggedItem);
          }

          saveSortOrder();
        }
      });
    });
  }

  function saveSortOrder() {
    const cards = document.querySelectorAll('#configGrid .site-card');
    const startIndex = (currentPage - 1) * pageSize;
    const items = [];

    cards.forEach((card, index) => {
      items.push({
        id: Number(card.dataset.id),
        sort_order: startIndex + index,
      });
    });

    if (items.length === 0) return;

    window.showMessage('正在保存排序...', 'info');
    fetch('/api/config/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder',
        payload: { items }
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.code !== 200) {
          window.showMessage(data.message || '保存排序失败', 'error');
          return;
        }

        window.showMessage('排序已保存', 'success');
        cards.forEach((card, index) => {
          const config = allConfigs.find(c => c.id == card.dataset.id);
          if (config) {
            config.sort_order = startIndex + index;
          }
        });
      })
      .catch(err => window.showMessage('保存排序失败: ' + err.message, 'error'));
  }

  function bindSearchAndPagination() {
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          currentSearchKeyword = getSearchValue().trim();
          currentPage = 1;
          fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
        }, SEARCH_DEBOUNCE_MS);
      });
    }

    if (pageSizeSelect) {
      pageSizeSelect.value = pageSize;
      pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        currentCategoryFilter = categoryFilter.value;
        currentPage = 1;
        fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
      });
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        if (currentPage < Math.ceil(totalItems / pageSize)) {
          currentPage++;
          fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
        }
      });
    }
  }

  function bindDeleteConfirmModal() {
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const closeDeleteConfirmModal = document.getElementById('closeDeleteConfirmModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    const closeDeleteModal = () => {
      deleteConfirmModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    };

    if (!deleteConfirmModal) return;
    if (closeDeleteConfirmModal) closeDeleteConfirmModal.onclick = closeDeleteModal;
    if (cancelDeleteBtn) cancelDeleteBtn.onclick = closeDeleteModal;
    if (confirmDeleteBtn) {
      confirmDeleteBtn.onclick = () => {
        if (window.deleteTargetId) {
          window.performDelete(window.deleteTargetId);
          closeDeleteModal();
        }
      };
    }
    deleteConfirmModal.onclick = (e) => {
      if (e.target === deleteConfirmModal) closeDeleteModal();
    };
  }

  function init() {
    initSearchBox();
    bindSearchAndPagination();
    bindDeleteConfirmModal();
    fetchConfigs();
  }

  window.fetchConfigs = fetchConfigs;
  window.AdminBookmarkList = {
    init,
    fetchConfigs,
  };
})();
