(function () {
  function bindTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        tabButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');

        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === tab) {
            content.classList.add('active');
          }
        });

        if (tab === 'categories') {
          window.fetchCategories?.();
        } else if (tab === 'pending') {
          window.fetchPendingConfigs?.();
        }
      });
    });
  }

  function syncPendingTabVisibility() {
    fetch('/api/public-config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.submissionEnabled) {
          const pendingTabBtn = document.querySelector('.tab-button[data-tab="pending"]');
          if (pendingTabBtn) {
            pendingTabBtn.style.display = 'none';
          }
        }
      })
      .catch(err => console.error('Failed to fetch public config:', err));
  }

  function init() {
    bindTabSwitching();
    syncPendingTabVisibility();
  }

  window.AdminTabs = {
    init,
  };
})();
