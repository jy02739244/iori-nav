(function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initSearch = function () {
    const sitesGrid = document.getElementById('sitesGrid');
    const searchInputs = document.querySelectorAll('.search-input-target');
    const engineOptions = document.querySelectorAll('.search-engine-option');
    let searchCardCache = null;
    let searchDebounceTimer = null;
    let currentSearchEngine = 'local';

    function clearSearchCardCache() {
      searchCardCache = null;
    }

    // 预缓存卡片搜索数据：从 IORI_SITES 按 data-id 查表，避免把数据再塞进 card 的 data-* 属性
    function getSearchCardCache() {
      if (searchCardCache) return searchCardCache;
      const cards = sitesGrid?.querySelectorAll('.site-card');
      if (!cards) return [];
      const sitesById = new Map();
      (window.IORI_SITES || []).forEach(s => sitesById.set(String(s.id), s));
      searchCardCache = Array.from(cards).map(card => {
        const id = card.getAttribute('data-id');
        const s = sitesById.get(String(id)) || {};
        const text = (s.searchText || [s.nameHtml, s.urlHtml, s.catalogHtml, s.descHtml]
          .map(v => String(v || '').toLowerCase()).join('\0'));
        return { el: card, text };
      });
      return searchCardCache;
    }

    function getCurrentLocalSearchKeyword() {
      if (currentSearchEngine !== 'local') return '';
      for (const input of searchInputs) {
        const keyword = input.value.trim();
        if (keyword) return keyword;
      }
      return '';
    }

    function applyLocalSearchFilter(keyword) {
      const normalizedKeyword = String(keyword || '').toLowerCase().trim();
      const cached = getSearchCardCache();

      cached.forEach(({ el, text }) => {
        if (normalizedKeyword === '' || text.includes(normalizedKeyword)) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      });

      updateHeading(normalizedKeyword);
    }

    function reapplyLocalSearchFilter() {
      applyLocalSearchFilter(getCurrentLocalSearchKeyword());
    }

    function updateSearchEngineUI(engine) {
      engineOptions.forEach(opt => {
        if (opt.dataset.engine === engine) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });

      let placeholder = '搜索书签...';
      switch (engine) {
        case 'google': placeholder = 'Google 搜索...'; break;
        case 'baidu': placeholder = '百度搜索...'; break;
        case 'github': placeholder = 'Github 搜索...'; break;
      }

      searchInputs.forEach(input => {
        input.placeholder = placeholder;
        if (engine === 'local' && input.value.trim()) {
          input.dispatchEvent(new Event('input'));
        }
      });
    }

    function updateHeading(keyword, activeCatalog, count) {
      const heading = document.querySelector('[data-role="list-heading"]');
      if (!heading) return;

      const visibleCount = (count !== undefined) ? count : (sitesGrid?.querySelectorAll('.site-card:not(.hidden)').length || 0);
      const isMobile = window.innerWidth < 440;

      if (activeCatalog !== undefined) {
        if (activeCatalog) {
          heading.dataset.active = activeCatalog;
        } else {
          delete heading.dataset.active;
        }
      }

      if (keyword) {
        heading.textContent = isMobile ? `${visibleCount} 个书签` : `搜索结果 · ${visibleCount} 个书签`;
      } else {
        const currentActive = heading.dataset.active;
        if (isMobile) {
          heading.textContent = `${visibleCount} 个书签`;
        } else if (currentActive) {
          heading.textContent = `${currentActive} · ${visibleCount} 个书签`;
        } else {
          heading.textContent = `全部收藏 · ${visibleCount} 个书签`;
        }
      }
    }

    Home.clearSearchCardCache = clearSearchCardCache;
    Home.reapplyLocalSearchFilter = reapplyLocalSearchFilter;
    Home.updateHeading = updateHeading;

    if (engineOptions.length > 0) {
      currentSearchEngine = localStorage.getItem('search_engine') || 'local';
      if (currentSearchEngine === 'bing') {
        currentSearchEngine = 'github';
        localStorage.setItem('search_engine', currentSearchEngine);
      }
      updateSearchEngineUI(currentSearchEngine);
    } else {
      localStorage.removeItem('search_engine');
    }

    engineOptions.forEach(option => {
      option.addEventListener('click', () => {
        currentSearchEngine = option.dataset.engine;
        localStorage.setItem('search_engine', currentSearchEngine);
        updateSearchEngineUI(currentSearchEngine);

        searchInputs.forEach(input => input.focus());
      });
    });

    searchInputs.forEach(input => {
      input.addEventListener('input', function () {
        if (currentSearchEngine !== 'local') return;

        const value = this.value;
        searchInputs.forEach(otherInput => {
          if (otherInput !== this) otherInput.value = value;
        });

        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          applyLocalSearchFilter(value);
        }, 200);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && currentSearchEngine !== 'local') {
          e.preventDefault();
          const query = this.value.trim();
          if (query) {
            let url = '';
            switch (currentSearchEngine) {
              case 'google': url = `https://www.google.com/search?q=${encodeURIComponent(query)}`; break;
              case 'baidu': url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`; break;
              case 'github': url = `https://github.com/search?q=${encodeURIComponent(query)}`; break;
            }
            if (url) window.open(url, '_blank');
          }
        }
      });
    });

    updateHeading();
  };
})();
