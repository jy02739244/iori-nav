(function () {
  function initThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    const updateIcon = () => {
      const isDark = document.documentElement.classList.contains('dark');
      btn.title = isDark ? '切换亮色模式' : '切换暗色模式';
    };

    updateIcon();

    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateIcon();
    });
  }

  function initAdminPage() {
    initThemeToggle();
    window.AdminBookmarkList?.init?.();
    window.AdminPending?.init?.();
    window.AdminTabs?.init?.();
    window.AdminBookmarkPrivacy?.init?.();

    window.loadGlobalCategories?.()
      ?.catch?.(err => console.error('Failed to load categories:', err));
  }

  initAdminPage();
})();
