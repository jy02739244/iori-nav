(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initSubmission = function () {
    const addSiteModal = document.getElementById('addSiteModal');
    const addSiteBtnSidebar = document.getElementById('addSiteBtnSidebar');
    const addSiteBtnFloating = document.getElementById('addSiteBtnFloating');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelAddSite = document.getElementById('cancelAddSite');
    const addSiteForm = document.getElementById('addSiteForm');
    const addSiteTurnstile = document.getElementById('addSiteTurnstile');
    let addSiteMessage = document.getElementById('addSiteMessage');
    let publicConfigPromise = null;
    let turnstileScriptPromise = null;
    let submissionTurnstileSiteKey = '';
    let submissionTurnstileWidgetId = null;
    let renderedSubmissionTurnstileSiteKey = '';
    let cachedCategories = null;

    function openModal() {
      addSiteModal?.classList.remove('opacity-0', 'invisible');
      addSiteModal?.querySelector('.max-w-md')?.classList.remove('translate-y-8');
      document.body.style.overflow = 'hidden';
      hideAddSiteMessage();
    }

    function closeModal() {
      addSiteModal?.classList.add('opacity-0', 'invisible');
      addSiteModal?.querySelector('.max-w-md')?.classList.add('translate-y-8');
      document.body.style.overflow = '';
      resetSubmissionTurnstile();
    }

    function ensureAddSiteMessage() {
      if (addSiteMessage) return addSiteMessage;
      if (!addSiteForm) return null;

      addSiteMessage = document.createElement('div');
      addSiteMessage.id = 'addSiteMessage';
      addSiteMessage.className = 'hidden rounded-lg border px-3 py-2 text-sm leading-relaxed';

      const actionRow = addSiteForm.querySelector('.flex.justify-end');
      if (actionRow) {
        addSiteForm.insertBefore(addSiteMessage, actionRow);
      } else {
        addSiteForm.appendChild(addSiteMessage);
      }

      return addSiteMessage;
    }

    function hideAddSiteMessage() {
      const messageEl = ensureAddSiteMessage();
      if (!messageEl) return;
      messageEl.className = 'hidden rounded-lg border px-3 py-2 text-sm leading-relaxed';
      messageEl.textContent = '';
    }

    function showAddSiteMessage(message, type = 'error') {
      const messageEl = ensureAddSiteMessage();
      if (!messageEl) return;

      const styleMap = {
        error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
        warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
        info: 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-200',
      };

      messageEl.className = `rounded-lg border px-3 py-2 text-sm leading-relaxed ${styleMap[type] || styleMap.error}`;
      messageEl.textContent = message;
    }

    function getPublicConfig() {
      if (!publicConfigPromise) {
        publicConfigPromise = fetch('/api/public-config')
          .then(response => response.json())
          .catch(error => {
            console.error('Failed to fetch public config:', error);
            return {};
          });
      }
      return publicConfigPromise;
    }

    function loadTurnstileScript() {
      if (window.turnstile) return Promise.resolve(window.turnstile);
      if (turnstileScriptPromise) return turnstileScriptPromise;

      turnstileScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.turnstile);
        script.onerror = () => reject(new Error('Turnstile script failed to load'));
        document.head.appendChild(script);
      });

      return turnstileScriptPromise;
    }

    async function ensureSubmissionTurnstile() {
      if (!addSiteTurnstile) return;

      const config = await getPublicConfig();
      const siteKey = String(config.turnstileSiteKey || '').trim();
      submissionTurnstileSiteKey = siteKey;

      if (!siteKey) {
        addSiteTurnstile.classList.add('hidden');
        addSiteTurnstile.classList.remove('flex');
        return;
      }

      addSiteTurnstile.classList.remove('hidden');
      addSiteTurnstile.classList.add('flex');

      try {
        const turnstile = await loadTurnstileScript();
        if (!turnstile) throw new Error('Turnstile is unavailable');

        if (submissionTurnstileWidgetId === null) {
          addSiteTurnstile.textContent = '';
          submissionTurnstileWidgetId = turnstile.render(addSiteTurnstile, {
            sitekey: siteKey,
            theme: 'auto',
          });
          renderedSubmissionTurnstileSiteKey = siteKey;
        } else if (renderedSubmissionTurnstileSiteKey !== siteKey) {
          turnstile.reset(submissionTurnstileWidgetId);
          renderedSubmissionTurnstileSiteKey = siteKey;
        }
      } catch (error) {
        console.error('Failed to load Turnstile:', error);
        addSiteTurnstile.textContent = '人机验证加载失败，请刷新后重试';
        addSiteTurnstile.classList.add('text-sm', 'text-red-500', 'items-center');
      }
    }

    function getSubmissionTurnstileToken() {
      if (!submissionTurnstileSiteKey) return '';
      if (!window.turnstile || submissionTurnstileWidgetId === null) return '';
      return window.turnstile.getResponse(submissionTurnstileWidgetId) || '';
    }

    function resetSubmissionTurnstile() {
      if (window.turnstile && submissionTurnstileWidgetId !== null) {
        window.turnstile.reset(submissionTurnstileWidgetId);
      }
    }

    function buildCategoryTree(categories) {
      const map = new Map();
      const roots = [];

      categories.forEach(category => {
        map.set(category.id, { ...category, children: [] });
      });

      categories.forEach(category => {
        const node = map.get(category.id);
        if (category.parent_id && map.has(category.parent_id)) {
          map.get(category.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      const sortNodes = (nodes) => {
        nodes.sort((a, b) => {
          const orderA = Number(a.sort_order);
          const orderB = Number(b.sort_order);
          const safeOrderA = Number.isFinite(orderA) ? orderA : 9999;
          const safeOrderB = Number.isFinite(orderB) ? orderB : 9999;
          return safeOrderA - safeOrderB || a.id - b.id;
        });
        nodes.forEach(node => sortNodes(node.children));
      };
      sortNodes(roots);

      return roots;
    }

    function flattenCategoryOptions(nodes, depth = 0, options = []) {
      nodes.forEach(node => {
        const prefix = depth > 0 ? `${'　'.repeat(depth)}└─ ` : '';
        options.push({ id: node.id, label: `${prefix}${node.catelog}` });
        if (node.children?.length) flattenCategoryOptions(node.children, depth + 1, options);
      });
      return options;
    }

    function renderCategoryOptions(selectElement, categoryOptions) {
      selectElement.innerHTML = '<option value="" disabled selected>请选择一个分类</option>';
      if (categoryOptions.length === 0) {
        selectElement.innerHTML = '<option value="" disabled>暂无可投稿分类</option>';
        return;
      }

      categoryOptions.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.label;
        selectElement.appendChild(option);
      });
    }

    async function fetchCategoriesForSelect() {
      const selectElement = document.getElementById('addSiteCatelog');
      if (!selectElement) return;

      if (cachedCategories) {
        renderCategoryOptions(selectElement, cachedCategories);
        return;
      }

      try {
        const response = await fetch('/api/categories?scope=public&pageSize=1000');
        const data = await response.json();
        if (data.code === 200 && data.data) {
          cachedCategories = flattenCategoryOptions(buildCategoryTree(data.data));
          renderCategoryOptions(selectElement, cachedCategories);
        } else {
          selectElement.innerHTML = '<option value="" disabled>无法加载分类</option>';
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        selectElement.innerHTML = '<option value="" disabled>加载分类失败</option>';
      }
    }

    [addSiteBtnSidebar, addSiteBtnFloating].forEach(btn => btn?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
      fetchCategoriesForSelect();
      ensureSubmissionTurnstile();
    }));

    closeModalBtn?.addEventListener('click', closeModal);
    cancelAddSite?.addEventListener('click', closeModal);
    addSiteModal?.addEventListener('click', (e) => {
      if (e.target === addSiteModal) closeModal();
    });

    addSiteForm?.addEventListener('submit', async function (e) {
      e.preventDefault();

      await ensureSubmissionTurnstile();

      if (submissionTurnstileSiteKey && !getSubmissionTurnstileToken()) {
        showAddSiteMessage('请先完成人机验证，再提交书签。', 'warning');
        return;
      }

      hideAddSiteMessage();

      const data = {
        name: document.getElementById('addSiteName').value,
        url: document.getElementById('addSiteUrl').value,
        logo: document.getElementById('addSiteLogo').value,
        desc: document.getElementById('addSiteDesc').value,
        catelog_id: document.getElementById('addSiteCatelog').value,
        turnstileToken: getSubmissionTurnstileToken()
      };

      try {
        const res = await fetch('/api/config/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.code === 201) {
          Home.showToast?.('提交成功,等待管理员审核');
          closeModal();
          addSiteForm.reset();
        } else {
          showAddSiteMessage(result.message || '提交失败，请稍后重试。', 'error');
          resetSubmissionTurnstile();
        }
      } catch (err) {
        console.error('网络错误:', err);
        showAddSiteMessage('网络错误，请稍后重试。', 'error');
        resetSubmissionTurnstile();
      }
    });
  };
})();
