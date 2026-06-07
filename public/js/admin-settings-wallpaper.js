(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  let initialized = false;

  function getCurrentSettings() {
    return ns.core?.getCurrentSettings?.() || ns.currentSettings || {};
  }

  function getRefs() {
    return {
      customWallpaperInput: document.getElementById('customWallpaperInput'),
      bingCountrySelect: document.getElementById('bingCountry'),
      onlineWallpapersDiv: document.getElementById('onlineWallpapers'),
      wpSourceBingBtn: document.getElementById('wpSourceBing'),
      wpSource360Btn: document.getElementById('wpSource360'),
      category360Select: document.getElementById('category360'),
    };
  }

  function ensureWallpaperStyles() {
    const wpStyleId = 'wallpaper-custom-styles';
    if (document.getElementById(wpStyleId)) return;

    const style = document.createElement('style');
    style.id = wpStyleId;
    style.textContent = `
          /* Wallpaper Cards Styles */
          .wp-card-wrapper {
              position: relative;
              overflow: hidden;
              border-radius: 0.5rem;
              cursor: pointer;
              background-color: #f3f4f6;
              border: 1px solid #e5e7eb;
              transition: border-color 0.3s;
          }
          .wp-card-wrapper:hover {
              border-color: #6366f1;
          }
          .wp-card-image-container {
              width: 100%;
              height: 100%;
              overflow: hidden;
          }
          .wp-card-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              transition: transform 0.5s ease;
              transform: scale(1) translateZ(0);
              will-change: transform;
          }
          .wp-card-wrapper:hover .wp-card-image {
              transform: scale(1.15) translateZ(0) !important;
          }
          .wp-card-overlay {
              position: absolute;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: rgba(0, 0, 0, 0);
              transition: background-color 0.3s;
              pointer-events: none;
          }
          .wp-card-wrapper:hover .wp-card-overlay {
              background-color: rgba(0, 0, 0, 0.1);
          }
          .wp-card-btn {
              opacity: 0;
              transition: opacity 0.3s;
              background-color: rgba(0, 0, 0, 0.5);
              color: white;
              font-size: 0.75rem;
              padding: 0.25rem 0.5rem;
              border-radius: 0.25rem;
          }
          .wp-card-wrapper:hover .wp-card-btn {
              opacity: 1;
          }

          /* Fix: Ensure Site Card Hover Animation works after dynamic rendering */
          .site-card:hover {
              transform: scale(1.15) translateY(-10px) !important;
              box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15) !important;
              z-index: 10 !important;
              border: 2px solid #416d9d !important;
          }
      `;
    document.head.appendChild(style);
  }

  function renderWallpaperCard(thumb, full, title) {
    const refs = getRefs();
    if (!refs.onlineWallpapersDiv) return;

    const div = document.createElement('div');
    const safeThumb = window.escapeHTML(window.normalizeUrl(thumb));
    const safeTitle = window.escapeHTML(title);

    div.className = 'wp-card-wrapper aspect-video';
    div.title = title;
    div.innerHTML = `
      <div class="wp-card-image-container">
        <img src="${safeThumb}" class="wp-card-image" alt="${safeTitle}">
      </div>
      <div class="wp-card-overlay">
        <span class="wp-card-btn">应用</span>
      </div>`;

    div.addEventListener('click', () => {
      if (refs.customWallpaperInput) {
        refs.customWallpaperInput.value = full;
        refs.customWallpaperInput.dispatchEvent(new Event('input', { bubbles: true }));
        refs.customWallpaperInput.dispatchEvent(new Event('change', { bubbles: true }));
        refs.customWallpaperInput.classList.add('bg-green-50');
        setTimeout(() => refs.customWallpaperInput.classList.remove('bg-green-50'), 300);
      }
    });
    refs.onlineWallpapersDiv.appendChild(div);
  }

  async function fetchBingWallpapers(country = '') {
    const refs = getRefs();
    if (!refs.onlineWallpapersDiv) return;
    refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';

    try {
      const url = country === 'spotlight'
        ? 'https://peapix.com/spotlight/feed?n=8'
        : `https://peapix.com/bing/feed?n=8&country=${country}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();

      refs.onlineWallpapersDiv.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">未获取到壁纸</div>';
        return;
      }

      data.forEach(item => {
        const thumb = item.thumbUrl || item.url;
        const full = item.fullUrl || item.url;
        const title = item.title || 'Bing Wallpaper';
        renderWallpaperCard(thumb, full, title);
      });
    } catch (err) {
      console.error('Bing Wallpaper Fetch Error:', err);
      refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-red-400 py-8 text-sm">加载失败，请检查网络或稍后重试</div>';
    }
  }

  async function fetch360Categories() {
    const refs = getRefs();
    if (!refs.category360Select || refs.category360Select.options.length > 1) return;

    try {
      const res = await fetch('/api/wallpaper?source=360&action=categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const result = await res.json();
      const apiData = result.data;

      if (result.code === 200 && apiData && apiData.data && Array.isArray(apiData.data)) {
        refs.category360Select.innerHTML = '';
        apiData.data.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          if (cat.id == '36') option.selected = true;
          refs.category360Select.appendChild(option);
        });
      }
    } catch (e) {
      console.error('360 Categories Error', e);
    }
  }

  async function fetch360Wallpapers(cid = '36') {
    const refs = getRefs();
    if (!refs.onlineWallpapersDiv) return;
    refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';

    try {
      const res = await fetch(`/api/wallpaper?source=360&action=list&cid=${cid}&start=0&count=8`);
      if (!res.ok) throw new Error('API Request Failed');
      const result = await res.json();
      const apiData = result.data;

      if (result.code !== 200 || !apiData || !apiData.data || apiData.data.length === 0) {
        refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">未获取到壁纸</div>';
        return;
      }

      refs.onlineWallpapersDiv.innerHTML = '';
      apiData.data.forEach(item => {
        let thumb = item.img_1024_768 || item.url_thumb || item.url;
        let full = item.url;

        if (thumb && thumb.startsWith('http:')) thumb = thumb.replace('http:', 'https:');
        if (full && full.startsWith('http:')) full = full.replace('http:', 'https:');

        const title = item.tag || '360 Wallpaper';
        renderWallpaperCard(thumb, full, title);
      });
    } catch (err) {
      console.error('360 Wallpaper Error:', err);
      refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-red-400 py-8 text-sm">加载失败</div>';
    }
  }

  function setSourceButtonState(source, refs) {
    if (source === 'bing') {
      refs.wpSourceBingBtn?.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
      refs.wpSourceBingBtn?.classList.remove('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      refs.wpSource360Btn?.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
      refs.wpSource360Btn?.classList.add('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      refs.bingCountrySelect?.classList.remove('hidden');
      refs.category360Select?.classList.add('hidden');
    } else {
      refs.wpSource360Btn?.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
      refs.wpSource360Btn?.classList.remove('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      refs.wpSourceBingBtn?.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
      refs.wpSourceBingBtn?.classList.add('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      refs.bingCountrySelect?.classList.add('hidden');
      refs.category360Select?.classList.remove('hidden');
    }
  }

  function switchWallpaperSource(source) {
    const refs = getRefs();
    const currentSettings = getCurrentSettings();
    currentSettings.wallpaper_source = source;
    setSourceButtonState(source, refs);

    if (source === 'bing') {
      fetchBingWallpapers(currentSettings.bing_country);
      return;
    }

    if (refs.onlineWallpapersDiv) {
      refs.onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';
    }

    fetch360Categories().then(() => {
      if (refs.category360Select && currentSettings.wallpaper_cid_360) {
        refs.category360Select.value = currentSettings.wallpaper_cid_360;
      }
      fetch360Wallpapers(currentSettings.wallpaper_cid_360 || '36');
    });
  }

  function bindEvents() {
    const refs = getRefs();
    const currentSettings = getCurrentSettings();

    refs.wpSourceBingBtn?.addEventListener('click', () => switchWallpaperSource('bing'));
    refs.wpSource360Btn?.addEventListener('click', () => switchWallpaperSource('360'));

    refs.bingCountrySelect?.addEventListener('change', () => {
      currentSettings.bing_country = refs.bingCountrySelect.value;
      fetchBingWallpapers(currentSettings.bing_country);
    });

    refs.category360Select?.addEventListener('change', () => {
      currentSettings.wallpaper_cid_360 = refs.category360Select.value;
      fetch360Wallpapers(refs.category360Select.value);
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureWallpaperStyles();
    bindEvents();
  }

  ns.wallpaper = {
    init,
    switchWallpaperSource,
    fetchBingWallpapers,
    fetch360Wallpapers,
  };
})();
