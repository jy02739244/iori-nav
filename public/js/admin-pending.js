(function () {
  const pendingTableBody = document.getElementById('pendingTableBody');
  const pendingPrevPageBtn = document.getElementById('pendingPrevPage');
  const pendingNextPageBtn = document.getElementById('pendingNextPage');
  const pendingCurrentPageSpan = document.getElementById('pendingCurrentPage');
  const pendingTotalPagesSpan = document.getElementById('pendingTotalPages');

  let pendingCurrentPage = 1;
  let pendingPageSize = 10;
  let pendingTotalItems = 0;
  let allPendingConfigs = [];

  function updatePendingPaginationButtons() {
    if (pendingPrevPageBtn) pendingPrevPageBtn.disabled = pendingCurrentPage <= 1;
    if (pendingNextPageBtn) pendingNextPageBtn.disabled = pendingCurrentPage >= Math.ceil(pendingTotalItems / pendingPageSize);
  }

  function fetchPendingConfigs(page = pendingCurrentPage) {
    if (!pendingTableBody) return;
    pendingTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-10">加载中...</td></tr>';

    fetch(`/api/pending?page=${page}&pageSize=${pendingPageSize}`)
      .then(res => res.json())
      .then(data => {
        if (data.code === 200) {
          pendingTotalItems = data.total;
          pendingCurrentPage = data.page;
          if (pendingTotalPagesSpan) pendingTotalPagesSpan.innerText = Math.ceil(pendingTotalItems / pendingPageSize);
          if (pendingCurrentPageSpan) pendingCurrentPageSpan.innerText = pendingCurrentPage;
          allPendingConfigs = data.data;
          renderPendingConfigs(allPendingConfigs);
          updatePendingPaginationButtons();
          return;
        }

        window.showMessage(data.message, 'error');
      })
      .catch(() => {
        window.showMessage('网络错误', 'error');
      });
  }

  function renderPendingConfigs(configs) {
    if (!pendingTableBody) return;
    pendingTableBody.innerHTML = '';

    if (configs.length === 0) {
      pendingTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-10">暂无待审核数据</td></tr>';
      return;
    }

    configs.forEach(config => {
      const tr = document.createElement('tr');
      const safeUrl = window.escapeHTML(config.url);
      const safeDesc = window.escapeHTML(config.desc);
      const safeCatalog = window.escapeHTML(config.catelog || config.catelog_name || '未分类');
      tr.innerHTML = `
        <td class="p-3 border-b">${config.id}</td>
        <td class="p-3 border-b">${window.escapeHTML(config.name)}</td>
        <td class="p-3 border-b truncate max-w-[200px]" title="${safeUrl}">${safeUrl}</td>
        <td class="p-3 border-b">${config.logo ? `<img src="${window.escapeHTML(window.normalizeUrl(config.logo))}" class="w-8 h-8 rounded">` : '无'}</td>
        <td class="p-3 border-b max-w-[200px] truncate" title="${safeDesc}">${safeDesc}</td>
        <td class="p-3 border-b">${safeCatalog}</td>
        <td class="p-3 border-b">
          <div class="flex gap-2">
            <button class="review-pending-btn bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded text-xs" data-id="${config.id}">审核</button>
            <button class="reject-btn bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded text-xs" data-id="${config.id}">拒绝</button>
          </div>
        </td>
      `;
      pendingTableBody.appendChild(tr);
    });

    bindPendingActionEvents();
  }

  function bindPendingActionEvents() {
    document.querySelectorAll('.review-pending-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        openPendingReviewModal(this.dataset.id);
      });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        handlePendingAction(this.dataset.id, 'reject');
      });
    });
  }

  function handlePendingAction(id, action) {
    const method = action === 'approve' ? 'PUT' : 'DELETE';
    const url = `/api/pending/${id}`;

    fetch(url, { method })
      .then(res => res.json())
      .then(data => {
        if (data.code === 200 || data.code === 201) {
          window.showMessage(action === 'approve' ? '审核通过' : '已拒绝', 'success');
          fetchPendingConfigs();
          if (action === 'approve') window.fetchConfigs?.();
          return;
        }

        window.showMessage(data.message, 'error');
      })
      .catch(() => window.showMessage('操作失败', 'error'));
  }

  function ensureCategoriesReady() {
    if (Array.isArray(window.categoriesData) && window.categoriesData.length > 0) {
      return Promise.resolve();
    }

    if (typeof window.loadGlobalCategories === 'function') {
      return window.loadGlobalCategories();
    }

    return Promise.resolve();
  }

  async function openPendingReviewModal(id) {
    const config = allPendingConfigs.find(item => String(item.id) === String(id));
    if (!config) {
      window.showMessage('找不到待审核书签', 'error');
      return;
    }

    try {
      await ensureCategoriesReady();
    } catch (err) {
      window.showMessage('分类加载失败，请稍后重试', 'error');
      return;
    }

    const modal = document.getElementById('reviewPendingModal');
    if (!modal) return;

    document.getElementById('reviewPendingId').value = config.id;
    document.getElementById('reviewPendingName').value = config.name || '';
    document.getElementById('reviewPendingUrl').value = config.url || '';
    document.getElementById('reviewPendingLogo').value = config.logo || '';
    document.getElementById('reviewPendingDesc').value = config.desc || '';
    document.getElementById('reviewPendingSortOrder').value = '';

    const category = window.categoriesData.find(item => String(item.id) === String(config.catelog_id));
    const privateCheckbox = document.getElementById('reviewPendingIsPrivate');
    if (privateCheckbox) {
      privateCheckbox.checked = !!(category && category.is_private);
      privateCheckbox.removeAttribute('data-user-touched');
    }

    window.createCascadingDropdown('reviewPendingCatelogWrapper', 'reviewPendingCatelog', window.categoriesTree, config.catelog_id);
    const categoryInput = document.getElementById('reviewPendingCatelog');
    if (categoryInput && typeof categoryInput.updatePrivacyState === 'function') {
      categoryInput.updatePrivacyState();
    }

    modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }

  function closePendingReviewModal() {
    const modal = document.getElementById('reviewPendingModal');
    const form = document.getElementById('reviewPendingForm');
    const dropdown = document.getElementById('reviewPendingCatelogWrapper');

    if (modal) modal.style.display = 'none';
    if (form) form.reset();
    if (dropdown) dropdown.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  async function handlePendingReviewSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const id = document.getElementById('reviewPendingId').value;
    const name = document.getElementById('reviewPendingName').value.trim();
    const url = document.getElementById('reviewPendingUrl').value.trim();
    const logo = document.getElementById('reviewPendingLogo').value.trim();
    const desc = document.getElementById('reviewPendingDesc').value.trim();
    const catelogId = document.getElementById('reviewPendingCatelog').value;
    const sortOrder = document.getElementById('reviewPendingSortOrder').value;
    const isPrivate = document.getElementById('reviewPendingIsPrivate').checked;

    if (!id || !name || !url || !catelogId) {
      window.showMessage('名称, URL 和分类为必填项', 'error');
      return;
    }

    const payload = { name, url, logo, desc, catelog_id: catelogId, is_private: isPrivate };
    if (sortOrder !== '') payload.sort_order = Number(sortOrder);

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '处理中...';
    }

    try {
      const res = await fetch(`/api/pending/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.code === 200 || data.code === 201) {
        window.showMessage('审核通过', 'success');
        closePendingReviewModal();
        fetchPendingConfigs();
        window.fetchConfigs?.();
        window.fetchCategories?.();
      } else {
        window.showMessage(data.message || '审核失败', 'error');
      }
    } catch (err) {
      window.showMessage('审核失败', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  function bindPagination() {
    if (pendingPrevPageBtn) {
      pendingPrevPageBtn.addEventListener('click', () => {
        if (pendingCurrentPage > 1) {
          pendingCurrentPage--;
          fetchPendingConfigs(pendingCurrentPage);
        }
      });
    }

    if (pendingNextPageBtn) {
      pendingNextPageBtn.addEventListener('click', () => {
        if (pendingCurrentPage < Math.ceil(pendingTotalItems / pendingPageSize)) {
          pendingCurrentPage++;
          fetchPendingConfigs(pendingCurrentPage);
        }
      });
    }
  }

  function bindReviewModal() {
    const reviewPendingModal = document.getElementById('reviewPendingModal');
    const closeReviewPendingModal = document.getElementById('closeReviewPendingModal');
    const cancelReviewPendingBtn = document.getElementById('cancelReviewPendingBtn');
    const reviewPendingForm = document.getElementById('reviewPendingForm');

    if (closeReviewPendingModal) closeReviewPendingModal.onclick = closePendingReviewModal;
    if (cancelReviewPendingBtn) cancelReviewPendingBtn.onclick = closePendingReviewModal;
    if (reviewPendingForm) reviewPendingForm.addEventListener('submit', handlePendingReviewSubmit);
    if (reviewPendingModal) {
      reviewPendingModal.onclick = (e) => {
        if (e.target === reviewPendingModal) closePendingReviewModal();
      };
    }
  }

  function init() {
    bindPagination();
    bindReviewModal();
  }

  window.fetchPendingConfigs = fetchPendingConfigs;
  window.AdminPending = {
    init,
    fetchPendingConfigs,
  };
})();
