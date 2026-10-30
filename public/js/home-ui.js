(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const closeSidebar = document.getElementById('closeSidebar');

    function openSidebar() {
      sidebar?.classList.add('open');
      mobileOverlay?.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebarMenu() {
      sidebar?.classList.remove('open');
      mobileOverlay?.classList.remove('open');
      document.body.style.overflow = '';
    }

    sidebarToggle?.addEventListener('click', openSidebar);
    closeSidebar?.addEventListener('click', closeSidebarMenu);
    mobileOverlay?.addEventListener('click', closeSidebarMenu);

    return { closeSidebarMenu };
  }

  function showCopySuccess(btn) {
    const successMsg = btn.querySelector('.copy-success');
    if (!successMsg) return;
    successMsg.classList.remove('hidden');
    successMsg.classList.add('copy-success-animation');
    setTimeout(() => {
      successMsg.classList.add('hidden');
      successMsg.classList.remove('copy-success-animation');
    }, 2000);
  }

  function initCopyButtons() {
    const sitesGrid = document.getElementById('sitesGrid');

    sitesGrid?.addEventListener('click', function (e) {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      const url = btn.getAttribute('data-url');
      if (!url) return;

      navigator.clipboard.writeText(url).then(() => {
        showCopySuccess(btn);
      }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showCopySuccess(btn);
        } catch (err) {
          alert('复制失败,请手动复制');
        }
        document.body.removeChild(textarea);
      });
    });
  }

  function initBackToTop() {
    const backToTop = document.getElementById('backToTop');
    const appScroll = document.getElementById('app-scroll');

    let scrollTicking = false;
    const onScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        const top = appScroll ? appScroll.scrollTop : window.pageYOffset;
        if (top > 300) {
          backToTop?.classList.remove('opacity-0', 'invisible');
        } else {
          backToTop?.classList.add('opacity-0', 'invisible');
        }
        scrollTicking = false;
      });
    };

    if (appScroll) {
      appScroll.addEventListener('scroll', onScroll);
    } else {
      window.addEventListener('scroll', onScroll);
    }

    backToTop?.addEventListener('click', function () {
      if (appScroll) {
        appScroll.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-accent-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function initHitokoto() {
    const hitokotoContainer = document.querySelector('#hitokoto')?.parentElement;
    if (!hitokotoContainer || hitokotoContainer.classList.contains('hidden')) return;

    // 一言只是装饰内容，请求失败时直接隐藏，不打断页面
    const hideHitokoto = () => {
      hitokotoContainer.classList.add('hidden');
      // 统计标题也被隐藏时整行已无内容，一并隐藏避免留下 my-8 的空白
      const heading = hitokotoContainer.parentElement?.querySelector('[data-role="list-heading"]');
      if (heading?.classList.contains('hidden')) {
        hitokotoContainer.closest('.home-stats-row')?.classList.add('hidden');
      }
    };

    fetch('https://v1.hitokoto.cn', { signal: AbortSignal.timeout(3000) })
      .then(res => {
        if (!res.ok) throw new Error(`Hitokoto request failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const hitokoto = document.getElementById('hitokoto_text');
        if (!hitokoto || !data?.hitokoto) {
          hideHitokoto();
          return;
        }
        hitokoto.href = data.uuid ? `https://hitokoto.cn/?uuid=${encodeURIComponent(data.uuid)}` : 'https://hitokoto.cn/';
        hitokoto.innerText = data.hitokoto;
      })
      .catch(hideHitokoto);
  }

  function initThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (!themeToggleBtn) return;

    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      const nextState = isDark ? 'light' : 'dark';

      const updateTheme = () => {
        if (nextState === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', nextState);
      };

      if (!document.startViewTransition) {
        updateTheme();
        return;
      }

      document.documentElement.classList.add('theme-animating');

      const transition = document.startViewTransition(() => {
        updateTheme();
      });

      transition.finished.finally(() => {
        document.documentElement.classList.remove('theme-animating');
      });
    });
  }

  Home.initCommonUi = function () {
    const sidebarController = initSidebar();
    Home.closeSidebarMenu = sidebarController.closeSidebarMenu;
    Home.showToast = showToast;

    initCopyButtons();
    initBackToTop();
    initHitokoto();
    initThemeToggle();
  };
})();
