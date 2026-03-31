const initSettings = () => {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  if (!settingsBtn || !settingsModal) return;

  // Modal Elements
  const closeBtn = document.getElementById('closeSettingsModal');
  const cancelBtn = document.getElementById('cancelSettingsBtn');
  const saveBtn = document.getElementById('saveSettingsBtn');

  // Tabs Elements
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  const settingsTabContents = document.querySelectorAll('.settings-tab-content');

  // Layout Inputs
  const hideDescSwitch = document.getElementById('hideDescSwitch');
  const hideLinksSwitch = document.getElementById('hideLinksSwitch');
  const hideCategorySwitch = document.getElementById('hideCategorySwitch');
  const hideGithubSwitch = document.getElementById('hideGithubSwitch');
  const hideAdminSwitch = document.getElementById('hideAdminSwitch');
  const frostedGlassSwitch = document.getElementById('frostedGlassSwitch');
  const frostedGlassIntensityRange = document.getElementById('frostedGlassIntensity');
  const frostedGlassIntensityValue = document.getElementById('frostedGlassIntensityValue');
  const gridColsRadios = document.getElementsByName('gridCols');
  const menuLayoutRadios = document.getElementsByName('menuLayout');
  const customWallpaperInput = document.getElementById('customWallpaperInput');

  const bgBlurSwitch = document.getElementById('bgBlurSwitch');
  const bgBlurIntensityRange = document.getElementById('bgBlurIntensity');
  const bgBlurIntensityValue = document.getElementById('bgBlurIntensityValue');
  const bingCountrySelect = document.getElementById('bingCountry');
  const onlineWallpapersDiv = document.getElementById('onlineWallpapers');
  const wpSourceBingBtn = document.getElementById('wpSourceBing');
  const wpSource360Btn = document.getElementById('wpSource360');
  const category360Select = document.getElementById('category360');

  // Card Style Elements
  const cardStyle1Container = document.getElementById('cardStyle1Container');
  const cardStyle2Container = document.getElementById('cardStyle2Container');
  const cardStyle1Check = document.getElementById('cardStyle1Check');
  const cardStyle2Check = document.getElementById('cardStyle2Check');
  const cardStyle1Preview = document.getElementById('cardStyle1Preview');
  const cardStyle2Preview = document.getElementById('cardStyle2Preview');
  const cardStyle1PreviewContainer = document.getElementById('cardStyle1PreviewContainer');
  const cardStyle2PreviewContainer = document.getElementById('cardStyle2PreviewContainer');

  const cardRadiusInput = document.getElementById('cardRadius');
  const cardRadiusValue = document.getElementById('cardRadiusValue');

  // Home Settings Inputs
  const hideTitleSwitch = document.getElementById('hideTitleSwitch');
  const homeTitleSizeInput = document.getElementById('homeTitleSize');
  const homeTitleColorInput = document.getElementById('homeTitleColor');
  const homeTitleColorPicker = document.getElementById('homeTitleColorPicker');

  const hideSubtitleSwitch = document.getElementById('hideSubtitleSwitch');
  const homeSubtitleSizeInput = document.getElementById('homeSubtitleSize');
  const homeSubtitleColorInput = document.getElementById('homeSubtitleColor');
  const homeSubtitleColorPicker = document.getElementById('homeSubtitleColorPicker');

  const hideStatsSwitch = document.getElementById('hideStatsSwitch');
  const homeStatsSizeInput = document.getElementById('homeStatsSize');
  const homeStatsColorInput = document.getElementById('homeStatsColor');
  const homeStatsColorPicker = document.getElementById('homeStatsColorPicker');

  const hideHitokotoSwitch = document.getElementById('hideHitokotoSwitch');
  const homeHitokotoSizeInput = document.getElementById('homeHitokotoSize');
  const homeHitokotoColorInput = document.getElementById('homeHitokotoColor');
  const homeHitokotoColorPicker = document.getElementById('homeHitokotoColorPicker');

  // New Card Font Elements
  const cardTitleFontInput = document.getElementById('cardTitleFont');
  const cardTitleSizeInput = document.getElementById('cardTitleSize');
  const cardTitleColorInput = document.getElementById('cardTitleColor');
  const cardTitleColorPicker = document.getElementById('cardTitleColorPicker');
  const cardDescFontInput = document.getElementById('cardDescFont');
  const cardDescSizeInput = document.getElementById('cardDescSize');
  const cardDescColorInput = document.getElementById('cardDescColor');
  const cardDescColorPicker = document.getElementById('cardDescColorPicker');

  const homeTitleFontInput = document.getElementById('homeTitleFont');
  const homeSubtitleFontInput = document.getElementById('homeSubtitleFont');
  const homeStatsFontInput = document.getElementById('homeStatsFont');
  const homeHitokotoFontInput = document.getElementById('homeHitokotoFont');

  const homeSiteNameInput = document.getElementById('homeSiteName');
  const homeSiteDescriptionInput = document.getElementById('homeSiteDescription');

  const searchEngineSwitch = document.getElementById('searchEngineSwitch');

  // Font Options
  const FONT_OPTIONS = [
    { value: "", label: "默认字体" },
    { value: "sans-serif", label: "Sans Serif (通用无衬线)" },
    { value: "serif", label: "Serif (通用衬线)" },
    { value: "monospace", label: "Monospace (通用等宽)" },
    { value: "'Microsoft YaHei', sans-serif", label: "微软雅黑 (Windows)" },
    { value: "'SimSun', serif", label: "宋体 (Windows)" },
    { value: "'PingFang SC', sans-serif", label: "苹方 (Mac)" },
    { value: "'Segoe UI', sans-serif", label: "Segoe UI (Windows)" },
    { value: "'Noto Sans SC', sans-serif", label: "Noto Sans SC (Web)" },
    { value: "'Noto Serif SC', serif", label: "Noto Serif SC (Web)" },
    { value: "'Ma Shan Zheng', cursive", label: "马善政毛笔 (Web)" },
    { value: "'ZCOOL KuaiLe', cursive", label: "站酷快乐体 (Web)" },
    { value: "'Long Cang', cursive", label: "龙苍草书 (Web)" },
    { value: "'Roboto', sans-serif", label: "Roboto (Web)" },
    { value: "'Open Sans', sans-serif", label: "Open Sans (Web)" },
    { value: "'Lato', sans-serif", label: "Lato (Web)" },
    { value: "'Montserrat', sans-serif", label: "Montserrat (Web)" }
  ];

  const FONT_URL_MAP = {
    "'Noto Sans SC', sans-serif": "https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
    "'Noto Serif SC', serif": "https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;700&display=swap",
    "'Ma Shan Zheng', cursive": "https://fonts.loli.net/css2?family=Ma+Shan+Zheng&display=swap",
    "'ZCOOL KuaiLe', cursive": "https://fonts.loli.net/css2?family=ZCOOL+KuaiLe&display=swap",
    "'Long Cang', cursive": "https://fonts.loli.net/css2?family=Long+Cang&display=swap",
    "'Roboto', sans-serif": "https://fonts.loli.net/css2?family=Roboto:wght@300;400;500;700&display=swap",
    "'Open Sans', sans-serif": "https://fonts.loli.net/css2?family=Open+Sans:wght@400;600;700&display=swap",
    "'Lato', sans-serif": "https://fonts.loli.net/css2?family=Lato:wght@400;700&display=swap",
    "'Montserrat', sans-serif": "https://fonts.loli.net/css2?family=Montserrat:wght@400;700&display=swap"
  };

  const loadedFonts = new Set();
  function loadFont(fontFamily) {
    if (!fontFamily || loadedFonts.has(fontFamily)) return;
    const url = FONT_URL_MAP[fontFamily];
    if (url) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
      loadedFonts.add(fontFamily);
    }
  }

  function populateFontSelects() {
    const selects = [homeTitleFontInput, homeSubtitleFontInput, homeStatsFontInput, homeHitokotoFontInput, cardTitleFontInput, cardDescFontInput];
    selects.forEach(select => {
      if (!select) return;
      select.innerHTML = '';
      FONT_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });
    });
  }
  populateFontSelects();

  // Preview Logic
  function updatePreviewCards() {
    const hideDesc = hideDescSwitch.checked;
    const hideLinks = hideLinksSwitch.checked;
    const hideCategory = hideCategorySwitch.checked;
    const enableFrosted = frostedGlassSwitch.checked;
    const frostedIntensity = frostedGlassIntensityRange.value;
    const radius = document.getElementById('cardRadius').value;

    const titleFont = cardTitleFontInput.value;
    const titleSize = cardTitleSizeInput.value;
    const titleColor = cardTitleColorInput.value;

    const descFont = cardDescFontInput.value;
    const descSize = cardDescSizeInput.value;
    const descColor = cardDescColorInput.value;

    // Load fonts for preview
    if (titleFont) loadFont(titleFont);
    if (descFont) loadFont(descFont);

    [cardStyle1Preview, cardStyle2Preview].forEach(card => {
      if (!card) return;

      // Apply dynamic styles
      card.style.setProperty('--card-radius', radius + 'px');

      const desc = card.querySelector('.preview-desc');
      const links = card.querySelector('.preview-links');
      const category = card.querySelector('.preview-category');
      const title = card.querySelector('.site-title');

      if (title) {
        if (titleFont) title.style.fontFamily = titleFont; else title.style.removeProperty('font-family');
        if (titleSize) title.style.fontSize = titleSize + 'px'; else title.style.removeProperty('font-size');
        if (titleColor) title.style.color = titleColor; else title.style.removeProperty('color');
      }

      if (desc) {
        if (hideDesc) {
          desc.style.setProperty('display', 'none', 'important');
        } else {
          desc.style.removeProperty('display');
        }

        if (descFont) desc.style.fontFamily = descFont; else desc.style.removeProperty('font-family');
        if (descSize) desc.style.fontSize = descSize + 'px'; else desc.style.removeProperty('font-size');
        if (descColor) desc.style.color = descColor; else desc.style.removeProperty('color');
      }
      if (links) links.style.display = hideLinks ? 'none' : 'flex';
      if (category) category.style.display = hideCategory ? 'none' : 'inline-flex';

      if (enableFrosted) {
        card.classList.add('frosted-glass-effect');
        card.style.setProperty('--frosted-glass-blur', frostedIntensity + 'px');
        card.classList.remove('bg-white');
      } else {
        card.classList.remove('frosted-glass-effect');
        card.style.removeProperty('--frosted-glass-blur');
        card.classList.add('bg-white');
      }
    });
  }

  function updatePreviewWidth() {
    let cols = '4';
    if (gridColsRadios) {
      for (const radio of gridColsRadios) {
        if (radio.checked) {
          cols = radio.value;
          break;
        }
      }
    }

    const widthMap = {
      '4': '280px',
      '5': '230px',
      '6': '190px',
      '7': '160px'
    };
    const width = widthMap[cols] || '280px';

    if (cardStyle1PreviewContainer) cardStyle1PreviewContainer.style.maxWidth = width;
    if (cardStyle2PreviewContainer) cardStyle2PreviewContainer.style.maxWidth = width;
  }

  if (gridColsRadios) {
    for (const radio of gridColsRadios) {
      radio.addEventListener('change', updatePreviewWidth);
    }
  }

  // Card Style Selection Logic
  function selectCardStyle(style) {
    currentSettings.layout_card_style = style;

    const btn1 = document.getElementById('btnStyle1');
    const btn2 = document.getElementById('btnStyle2');
    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');

    if (!btn1 || !btn2 || !preview1 || !preview2) return;

    // Reset
    btn1.className = 'card-style-btn px-4 py-1 text-sm rounded transition-all';
    btn2.className = 'card-style-btn px-4 py-1 text-sm rounded transition-all';

    if (style === 'style2') {
      btn2.classList.add('bg-white', 'shadow-sm', 'text-gray-800', 'font-medium');
      btn1.classList.add('text-gray-600', 'hover:text-gray-900');
      preview1.classList.add('hidden');
      preview2.classList.remove('hidden');
    } else {
      btn1.classList.add('bg-white', 'shadow-sm', 'text-gray-800', 'font-medium');
      btn2.classList.add('text-gray-600', 'hover:text-gray-900');
      preview1.classList.remove('hidden');
      preview2.classList.add('hidden');
    }
  }

  const btnStyle1 = document.getElementById('btnStyle1');
  const btnStyle2 = document.getElementById('btnStyle2');
  if (btnStyle1) btnStyle1.addEventListener('click', () => selectCardStyle('style1'));
  if (btnStyle2) btnStyle2.addEventListener('click', () => selectCardStyle('style2'));

  // Switch Listeners for Preview
  if (hideDescSwitch) hideDescSwitch.addEventListener('change', updatePreviewCards);
  if (hideLinksSwitch) hideLinksSwitch.addEventListener('change', updatePreviewCards);
  if (hideCategorySwitch) hideCategorySwitch.addEventListener('change', updatePreviewCards);
  if (frostedGlassSwitch) frostedGlassSwitch.addEventListener('change', updatePreviewCards);
  if (frostedGlassIntensityRange) frostedGlassIntensityRange.addEventListener('input', updatePreviewCards);

  if (cardRadiusInput) {
    cardRadiusInput.addEventListener('input', () => {
      if (cardRadiusValue) cardRadiusValue.textContent = cardRadiusInput.value;
      updatePreviewCards();
    });
  }

  // Real-time Card Font Preview Listeners
  [cardTitleFontInput, cardTitleSizeInput, cardTitleColorInput, cardDescFontInput, cardDescSizeInput, cardDescColorInput].forEach(input => {
    if (input) {
      input.addEventListener('input', updatePreviewCards);
      input.addEventListener('change', updatePreviewCards);
    }
  });

  // AI Provider Elements
  const providerSelector = document.getElementById('providerSelector');
  const baseUrlGroup = document.getElementById('baseUrlGroup');

  // AI Form Inputs
  const apiKeyInput = document.getElementById('apiKey');
  const baseUrlInput = document.getElementById('baseUrl');
  const modelNameInput = document.getElementById('modelName');

  // Bulk Generation Elements
  const bulkIdleView = document.getElementById('bulkGenerateIdle');
  const bulkProgressView = document.getElementById('bulkGenerateProgress');
  const batchCompleteBtn = document.getElementById('batchCompleteDescBtn');
  const stopBulkBtn = document.getElementById('stopBulkGenerateBtn');
  const progressBar = document.getElementById('progressBar');
  const progressCounter = document.getElementById('progressCounter');

  let currentSettings = {
    // AI Defaults
    provider: 'workers-ai',
    apiKey: '',
    baseUrl: '',
    model: '@cf/meta/llama-3-8b-instruct',
    // Layout Defaults
    layout_hide_desc: false,
    layout_hide_links: false,
    layout_hide_category: false,
    layout_hide_title: false,
    home_title_size: '',
    home_title_color: '',
    layout_hide_subtitle: false,
    home_subtitle_size: '',
    home_subtitle_color: '',
    home_hide_stats: false,
    home_stats_size: '',
    home_stats_color: '',
    home_hide_hitokoto: false,
    home_hitokoto_size: '',
    home_hitokoto_color: '',
    home_search_engine_enabled: false,
    home_default_category: '',
    home_remember_last_category: false,
    layout_enable_frosted_glass: false,
    layout_frosted_glass_intensity: '15',
    layout_grid_cols: '4',
    layout_custom_wallpaper: '',
    layout_menu_layout: 'horizontal',

    layout_enable_bg_blur: false,
    layout_bg_blur_intensity: '0',
    bing_country: '',
    wallpaper_source: 'bing',
    wallpaper_cid_360: '36',
    layout_card_style: 'style1',
    layout_card_border_radius: '12'
  };

  let shouldStopBulkGeneration = false;
  let aiRequestDelay = 1500;

  async function fetchPublicConfig() {
    try {
      const response = await fetch('/api/public-config');
      if (!response.ok) {
        console.error('Failed to fetch public config.');
        return;
      }
      const config = await response.json();
      if (config && typeof config.aiRequestDelay === 'number') {
        aiRequestDelay = config.aiRequestDelay;
      }
    } catch (error) {
      console.error('Error fetching public config:', error);
    }
  }
  fetchPublicConfig();

  // Color Picker Sync Helper
  function setupColorPicker(textInput, pickerInput) {
    if (!textInput || !pickerInput) return;

    // Init picker from text if valid hex
    if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
      pickerInput.value = textInput.value;
    }

    pickerInput.addEventListener('input', () => {
      textInput.value = pickerInput.value;
    });

    textInput.addEventListener('input', () => {
      const val = textInput.value;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        pickerInput.value = val;
      }
    });
  }

  setupColorPicker(homeTitleColorInput, homeTitleColorPicker);
  setupColorPicker(homeSubtitleColorInput, homeSubtitleColorPicker);
  setupColorPicker(homeStatsColorInput, homeStatsColorPicker);
  setupColorPicker(homeHitokotoColorInput, homeHitokotoColorPicker);
  setupColorPicker(cardTitleColorInput, cardTitleColorPicker);
  setupColorPicker(cardDescColorInput, cardDescColorPicker);


  // --- Online Wallpaper Logic ---

  // Inject Custom CSS for Wallpaper Interactions to guarantee stability
  const wpStyleId = 'wallpaper-custom-styles';
  if (!document.getElementById(wpStyleId)) {
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

  // Helper to render card
  function renderWallpaperCard(thumb, full, title) {
    if (!onlineWallpapersDiv) return;
    const div = document.createElement('div');

    // Use custom classes + standard Tailwind aspect ratio
    div.className = 'wp-card-wrapper aspect-video';
    div.title = title;

    div.innerHTML = `
      <div class="wp-card-image-container">
        <img src="${thumb}" class="wp-card-image" alt="${title}">
      </div>
      <div class="wp-card-overlay">
        <span class="wp-card-btn">应用</span>
      </div>`;

    div.addEventListener('click', () => {
      if (customWallpaperInput) {
        customWallpaperInput.value = full;
        customWallpaperInput.classList.add('bg-green-50');
        setTimeout(() => customWallpaperInput.classList.remove('bg-green-50'), 300);
      }
    });
    onlineWallpapersDiv.appendChild(div);
  }

  // Fetch Bing Wallpapers
  async function fetchBingWallpapers(country = '') {
    if (!onlineWallpapersDiv) return;
    onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';

    try {
      let url = '';
      if (country === 'spotlight') {
        url = 'https://peapix.com/spotlight/feed?n=8';
      } else {
        url = `https://peapix.com/bing/feed?n=8&country=${country}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();

      onlineWallpapersDiv.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">未获取到壁纸</div>';
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
      onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-red-400 py-8 text-sm">加载失败，请检查网络或稍后重试</div>';
    }
  }

  // Fetch 360 Categories
  async function fetch360Categories() {
    if (!category360Select || category360Select.options.length > 1) return; // Already loaded or missing

    try {
      const res = await fetch('/api/wallpaper?source=360&action=categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const result = await res.json();

      // Proxy wraps response in { code: 200, data: { errno: "0", data: [...] } }
      const apiData = result.data;

      if (result.code === 200 && apiData && apiData.data && Array.isArray(apiData.data)) {
        category360Select.innerHTML = '';
        apiData.data.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          if (cat.id == '36') option.selected = true; // Default to 4K
          category360Select.appendChild(option);
        });
      }
    } catch (e) {
      console.error('360 Categories Error', e);
    }
  }

  // Fetch 360 Wallpapers
  async function fetch360Wallpapers(cid = '36') {
    if (!onlineWallpapersDiv) return;
    onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';

    try {
      const res = await fetch(`/api/wallpaper?source=360&action=list&cid=${cid}&start=0&count=8`);
      if (!res.ok) throw new Error('API Request Failed');
      const result = await res.json();

      // Proxy wraps response in { code: 200, data: { errno: "0", data: [...] } }
      const apiData = result.data;

      if (result.code !== 200 || !apiData || !apiData.data || apiData.data.length === 0) {
        onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">未获取到壁纸</div>';
        return;
      }

      onlineWallpapersDiv.innerHTML = '';
      apiData.data.forEach(item => {
        // Prefer img_1024_768 for thumbnail to speed up loading, fallback to others
        let thumb = item.img_1024_768 || item.url_thumb || item.url;
        let full = item.url;

        // Ensure HTTPS
        if (thumb && thumb.startsWith('http:')) thumb = thumb.replace('http:', 'https:');
        if (full && full.startsWith('http:')) full = full.replace('http:', 'https:');

        const title = item.tag || '360 Wallpaper';
        renderWallpaperCard(thumb, full, title);
      });

    } catch (err) {
      console.error('360 Wallpaper Error:', err);
      onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-red-400 py-8 text-sm">加载失败</div>';
    }
  }

  function switchWallpaperSource(source) {
    currentSettings.wallpaper_source = source;

    // Toggle Buttons Style
    if (source === 'bing') {
      if (wpSourceBingBtn) {
        wpSourceBingBtn.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
        wpSourceBingBtn.classList.remove('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      }
      if (wpSource360Btn) {
        wpSource360Btn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
        wpSource360Btn.classList.add('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      }

      if (bingCountrySelect) bingCountrySelect.classList.remove('hidden');
      if (category360Select) category360Select.classList.add('hidden');

      fetchBingWallpapers(currentSettings.bing_country);
    } else {
      if (wpSource360Btn) {
        wpSource360Btn.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
        wpSource360Btn.classList.remove('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      }
      if (wpSourceBingBtn) {
        wpSourceBingBtn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
        wpSourceBingBtn.classList.add('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
      }

      if (bingCountrySelect) bingCountrySelect.classList.add('hidden');
      if (category360Select) category360Select.classList.remove('hidden');

      if (onlineWallpapersDiv) {
        onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';
      }

      fetch360Categories().then(() => {
        if (category360Select && currentSettings.wallpaper_cid_360) {
          category360Select.value = currentSettings.wallpaper_cid_360;
        }
        fetch360Wallpapers(currentSettings.wallpaper_cid_360 || '36');
      });
    }
  }

  // --- Event Listeners ---

  settingsBtn.addEventListener('click', () => {
    loadSettings();
    settingsModal.style.display = 'block';
    document.body.classList.add('modal-open');
  });

  const closeModal = () => {
    if (bulkProgressView.style.display !== 'none') {
      if (!confirm('批量生成正在进行中，确定要关闭吗？')) {
        return;
      }
      shouldStopBulkGeneration = true;
    }
    settingsModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  };
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeModal();
    }
  });

  // Tab Switching
  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      settingsTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      settingsTabContents.forEach(c => {
        c.classList.remove('active');
        if (c.id === tabId) {
          c.classList.add('active');
        }
      });

      // Auto fetch wallpapers if tab is active and empty
      if (tabId === 'wallpaper-settings' && onlineWallpapersDiv && (!onlineWallpapersDiv.children.length || onlineWallpapersDiv.innerText.includes('加载中'))) {
        switchWallpaperSource(currentSettings.wallpaper_source || 'bing');
      }
    });
  });

  // Wallpaper Source Switching
  if (wpSourceBingBtn) {
    wpSourceBingBtn.addEventListener('click', () => switchWallpaperSource('bing'));
  }
  if (wpSource360Btn) {
    wpSource360Btn.addEventListener('click', () => switchWallpaperSource('360'));
  }

  // Filters
  if (bingCountrySelect) {
    bingCountrySelect.addEventListener('change', () => {
      currentSettings.bing_country = bingCountrySelect.value;
      fetchBingWallpapers(currentSettings.bing_country);
    });
  }

  if (category360Select) {
    category360Select.addEventListener('change', () => {
      currentSettings.wallpaper_cid_360 = category360Select.value;
      fetch360Wallpapers(category360Select.value);
    });
  }

  if (providerSelector) {
    providerSelector.addEventListener('change', () => {
      currentSettings.provider = providerSelector.value;
      updateUIFromSettings();
    });
  }

  saveBtn.addEventListener('click', () => {
    // Update state from inputs
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey) {
      currentSettings.apiKey = newApiKey;
    } else if (currentSettings.has_api_key) {
      // User didn't type anything but we have a key, so don't send anything (undefined)
      // allowing backend to keep existing value if we filter it, 
      // OR we just don't update the property in currentSettings if it was undefined.
      // But loadSettings sets currentSettings.apiKey = undefined.
      // So just delete it to be safe, ensuring it's not sent as ""
      delete currentSettings.apiKey;
    } else {
      // No key previously, and input is empty -> clear it
      currentSettings.apiKey = '';
    }

    currentSettings.baseUrl = baseUrlInput.value.trim();
    currentSettings.model = modelNameInput.value.trim();
    currentSettings.layout_hide_desc = hideDescSwitch.checked;
    currentSettings.layout_hide_links = hideLinksSwitch.checked;
    currentSettings.layout_hide_category = hideCategorySwitch.checked;
    currentSettings.home_hide_github = hideGithubSwitch.checked;
    currentSettings.home_hide_admin = hideAdminSwitch.checked;

    currentSettings.layout_hide_title = hideTitleSwitch.checked;
    currentSettings.home_title_size = homeTitleSizeInput.value.trim();
    currentSettings.home_title_color = homeTitleColorInput.value.trim();

    currentSettings.layout_hide_subtitle = hideSubtitleSwitch.checked;
    currentSettings.home_subtitle_size = homeSubtitleSizeInput.value.trim();
    currentSettings.home_subtitle_color = homeSubtitleColorInput.value.trim();

    currentSettings.home_hide_stats = hideStatsSwitch.checked;
    currentSettings.home_stats_size = homeStatsSizeInput.value.trim();
    currentSettings.home_stats_color = homeStatsColorInput.value.trim();

    currentSettings.home_hide_hitokoto = hideHitokotoSwitch.checked;
    currentSettings.home_hitokoto_size = homeHitokotoSizeInput.value.trim();
    currentSettings.home_hitokoto_color = homeHitokotoColorInput.value.trim();

    currentSettings.home_title_font = homeTitleFontInput.value.trim();
    currentSettings.home_subtitle_font = homeSubtitleFontInput.value.trim();
    currentSettings.home_stats_font = homeStatsFontInput.value.trim();
    currentSettings.home_hitokoto_font = homeHitokotoFontInput.value.trim();

    currentSettings.home_site_name = homeSiteNameInput.value.trim();
    currentSettings.home_site_description = homeSiteDescriptionInput.value.trim();

    if (homeDefaultCategorySelect) {
      currentSettings.home_default_category = homeDefaultCategorySelect.value;
    }

    if (homeRememberLastCategorySwitch) {
      currentSettings.home_remember_last_category = homeRememberLastCategorySwitch.checked;
    }

    currentSettings.home_search_engine_enabled = searchEngineSwitch.checked;

    currentSettings.layout_custom_wallpaper = customWallpaperInput.value.trim();

    currentSettings.layout_enable_bg_blur = bgBlurSwitch.checked;
    currentSettings.layout_bg_blur_intensity = bgBlurIntensityRange.value;
    currentSettings.bing_country = bingCountrySelect.value;
    currentSettings.wallpaper_cid_360 = category360Select.value;

    // Get Grid Cols
    for (const radio of gridColsRadios) {
      if (radio.checked) {
        currentSettings.layout_grid_cols = radio.value;
        break;
      }
    }

    // Menu Layout
    for (const radio of menuLayoutRadios) {
      if (radio.checked) {
        currentSettings.layout_menu_layout = radio.value;
        break;
      }
    }

    currentSettings.layout_enable_frosted_glass = frostedGlassSwitch.checked;
    currentSettings.layout_frosted_glass_intensity = frostedGlassIntensityRange.value;

    currentSettings.layout_card_border_radius = cardRadiusInput.value;

    // layout_card_style is already updated by click listeners

    currentSettings.card_title_font = cardTitleFontInput.value.trim();
    currentSettings.card_title_size = cardTitleSizeInput.value.trim();
    currentSettings.card_title_color = cardTitleColorInput.value.trim();
    currentSettings.card_desc_font = cardDescFontInput.value.trim();
    currentSettings.card_desc_size = cardDescSizeInput.value.trim();
    currentSettings.card_desc_color = cardDescColorInput.value.trim();

    saveSettings();
  });

  if (frostedGlassSwitch) {
    frostedGlassSwitch.addEventListener('change', () => {
      const intensityContainer = document.getElementById('frostedGlassIntensityContainer');
      if (frostedGlassSwitch.checked) {
        intensityContainer.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        intensityContainer.classList.add('opacity-50', 'pointer-events-none');
      }
    });
  }

  if (frostedGlassIntensityRange) {
    frostedGlassIntensityRange.addEventListener('input', () => {
      if (frostedGlassIntensityValue) {
        frostedGlassIntensityValue.textContent = frostedGlassIntensityRange.value;
      }
    });
  }

  if (bgBlurSwitch) {
    bgBlurSwitch.addEventListener('change', () => {
      const container = document.getElementById('bgBlurIntensityContainer');
      if (bgBlurSwitch.checked) {
        container.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        container.classList.add('opacity-50', 'pointer-events-none');
      }
    });
  }

  if (bgBlurIntensityRange) {
    bgBlurIntensityRange.addEventListener('input', () => {
      if (bgBlurIntensityValue) {
        bgBlurIntensityValue.textContent = bgBlurIntensityRange.value;
      }
    });
  }

  batchCompleteBtn.addEventListener('click', handleBulkGenerate);
  stopBulkBtn.addEventListener('click', () => {
    shouldStopBulkGeneration = true;
    showMessage('正在停止...', 'info');
  });

  // --- Helper Functions ---

  const homeDefaultCategorySelect = document.getElementById('homeDefaultCategory');
  const homeRememberLastCategorySwitch = document.getElementById('homeRememberLastCategorySwitch');

  async function loadSettings() {
    // Ensure categories are loaded for the dropdown
    if (categoriesTree.length === 0) {
      try {
        const res = await fetch('/api/categories?pageSize=9999');
        const data = await res.json();
        if (data.code === 200) {
          categoriesData = data.data || [];
          categoriesTree = buildCategoryTree(categoriesData);
        }
      } catch (e) { console.error('Failed to load categories for settings', e); }
    }

    if (homeDefaultCategorySelect) {
      homeDefaultCategorySelect.innerHTML = '<option value="">默认 (全部)</option>';

      // Helper to flatten tree for simple select
      const addOptions = (nodes, prefix = '') => {
        nodes.forEach(node => {
          const option = document.createElement('option');
          option.value = node.catelog; // Store Name as value, because config uses name
          option.textContent = prefix + node.catelog;
          homeDefaultCategorySelect.appendChild(option);
          if (node.children && node.children.length > 0) {
            addOptions(node.children, prefix + '-- ');
          }
        });
      };
      addOptions(categoriesTree);
    }

    try {
      // 1. Try to fetch from server (new source of truth)
      const res = await fetch('/api/settings');
      const data = await res.json();

      if (data.code === 200 && data.data) {
        const serverSettings = data.data;

        // Map known keys
        if (serverSettings.provider) currentSettings.provider = serverSettings.provider;

        // Handle API Key securely
        currentSettings.has_api_key = !!serverSettings.has_api_key;

        if (serverSettings.apiKey) currentSettings.apiKey = serverSettings.apiKey; // Should be undefined now

        if (serverSettings.baseUrl) currentSettings.baseUrl = serverSettings.baseUrl;
        if (serverSettings.model) currentSettings.model = serverSettings.model;

        if (serverSettings.layout_hide_desc !== undefined) currentSettings.layout_hide_desc = serverSettings.layout_hide_desc === 'true';
        if (serverSettings.layout_hide_links !== undefined) currentSettings.layout_hide_links = serverSettings.layout_hide_links === 'true';
        if (serverSettings.layout_hide_category !== undefined) currentSettings.layout_hide_category = serverSettings.layout_hide_category === 'true';
        if (serverSettings.layout_hide_title !== undefined) currentSettings.layout_hide_title = serverSettings.layout_hide_title === 'true';
        if (serverSettings.home_title_size) currentSettings.home_title_size = serverSettings.home_title_size;
        if (serverSettings.home_title_color) currentSettings.home_title_color = serverSettings.home_title_color;

        if (serverSettings.layout_hide_subtitle !== undefined) currentSettings.layout_hide_subtitle = serverSettings.layout_hide_subtitle === 'true';
        if (serverSettings.home_subtitle_size) currentSettings.home_subtitle_size = serverSettings.home_subtitle_size;
        if (serverSettings.home_subtitle_color) currentSettings.home_subtitle_color = serverSettings.home_subtitle_color;

        if (serverSettings.home_hide_stats !== undefined) currentSettings.home_hide_stats = serverSettings.home_hide_stats === 'true';
        if (serverSettings.home_stats_size) currentSettings.home_stats_size = serverSettings.home_stats_size;
        if (serverSettings.home_stats_color) currentSettings.home_stats_color = serverSettings.home_stats_color;

        if (serverSettings.home_hide_hitokoto !== undefined) currentSettings.home_hide_hitokoto = serverSettings.home_hide_hitokoto === 'true';
        if (serverSettings.home_hitokoto_size) currentSettings.home_hitokoto_size = serverSettings.home_hitokoto_size;
        if (serverSettings.home_hitokoto_color) currentSettings.home_hitokoto_color = serverSettings.home_hitokoto_color;

        if (serverSettings.home_hide_github !== undefined) currentSettings.home_hide_github = serverSettings.home_hide_github === 'true';
        if (serverSettings.home_hide_admin !== undefined) currentSettings.home_hide_admin = serverSettings.home_hide_admin === 'true';

        if (serverSettings.home_title_font) currentSettings.home_title_font = serverSettings.home_title_font;
        if (serverSettings.home_subtitle_font) currentSettings.home_subtitle_font = serverSettings.home_subtitle_font;
        if (serverSettings.home_stats_font) currentSettings.home_stats_font = serverSettings.home_stats_font;
        if (serverSettings.home_hitokoto_font) currentSettings.home_hitokoto_font = serverSettings.home_hitokoto_font;

        if (serverSettings.home_site_name) currentSettings.home_site_name = serverSettings.home_site_name;
        if (serverSettings.home_site_description) currentSettings.home_site_description = serverSettings.home_site_description;

        if (serverSettings.home_search_engine_enabled !== undefined) currentSettings.home_search_engine_enabled = serverSettings.home_search_engine_enabled === 'true';

        if (serverSettings.home_default_category) currentSettings.home_default_category = serverSettings.home_default_category;
        if (serverSettings.home_remember_last_category !== undefined) currentSettings.home_remember_last_category = serverSettings.home_remember_last_category === 'true';

        if (serverSettings.layout_enable_frosted_glass !== undefined) currentSettings.layout_enable_frosted_glass = serverSettings.layout_enable_frosted_glass === 'true';
        if (serverSettings.layout_frosted_glass_intensity) currentSettings.layout_frosted_glass_intensity = serverSettings.layout_frosted_glass_intensity;
        if (serverSettings.layout_grid_cols) currentSettings.layout_grid_cols = serverSettings.layout_grid_cols;
        if (serverSettings.layout_custom_wallpaper) currentSettings.layout_custom_wallpaper = serverSettings.layout_custom_wallpaper;
        if (serverSettings.layout_menu_layout) currentSettings.layout_menu_layout = serverSettings.layout_menu_layout;
        if (serverSettings.layout_random_wallpaper !== undefined) currentSettings.layout_random_wallpaper = serverSettings.layout_random_wallpaper === 'true';
        if (serverSettings.layout_enable_bg_blur !== undefined) currentSettings.layout_enable_bg_blur = serverSettings.layout_enable_bg_blur === 'true';
        if (serverSettings.layout_bg_blur_intensity) currentSettings.layout_bg_blur_intensity = serverSettings.layout_bg_blur_intensity;
        if (serverSettings.bing_country !== undefined) currentSettings.bing_country = serverSettings.bing_country;
        if (serverSettings.wallpaper_source) currentSettings.wallpaper_source = serverSettings.wallpaper_source;
        if (serverSettings.wallpaper_cid_360) currentSettings.wallpaper_cid_360 = serverSettings.wallpaper_cid_360;
        if (serverSettings.layout_card_style) currentSettings.layout_card_style = serverSettings.layout_card_style;
        if (serverSettings.layout_card_border_radius) currentSettings.layout_card_border_radius = serverSettings.layout_card_border_radius;

        if (serverSettings.card_title_font) currentSettings.card_title_font = serverSettings.card_title_font;
        if (serverSettings.card_title_size) currentSettings.card_title_size = serverSettings.card_title_size;
        if (serverSettings.card_title_color) currentSettings.card_title_color = serverSettings.card_title_color;
        if (serverSettings.card_desc_font) currentSettings.card_desc_font = serverSettings.card_desc_font;
        if (serverSettings.card_desc_size) currentSettings.card_desc_size = serverSettings.card_desc_size;
        if (serverSettings.card_desc_color) currentSettings.card_desc_color = serverSettings.card_desc_color;

      }
    } catch (e) {
      console.error('Failed to load settings', e);
      // Fallback removed: Server is the single source of truth.
    }

    updateUIFromSettings();
  }

  async function saveSettings() {
    // Save to localStorage (backup/legacy)
    localStorage.setItem('ai_settings', JSON.stringify({
      provider: currentSettings.provider,
      apiKey: currentSettings.apiKey,
      baseUrl: currentSettings.baseUrl,
      model: currentSettings.model
    }));

    // Save to Server
    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>⏳</span> 保存中...';

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings)
      });
      const data = await res.json();

      if (data.code === 200) {
        showMessage('设置已保存', 'success');
        closeModal();
      } else {
        showMessage('保存失败: ' + data.message, 'error');
      }
    } catch (e) {
      showMessage('保存失败 (网络错误)', 'error');
      console.error(e);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾</span> 保存设置';
    }
  }

  function updateUIFromSettings() {
    // AI UI
    if (providerSelector) {
      providerSelector.value = currentSettings.provider || 'workers-ai';
    }
    const provider = currentSettings.provider || 'workers-ai';

    // API Key UI Logic
    apiKeyInput.value = currentSettings.apiKey || '';
    if (currentSettings.has_api_key && !apiKeyInput.value) {
      apiKeyInput.placeholder = '已配置 (如需修改请直接输入)';
    } else {
      apiKeyInput.placeholder = '请输入 API Key';
    }

    baseUrlInput.value = currentSettings.baseUrl || '';

    // Legacy fix
    if (!['gemini', 'openai', 'workers-ai'].includes(provider)) {
      currentSettings.provider = 'workers-ai';
      providerSelector.value = 'workers-ai';
    }

    if (provider === 'workers-ai') {
      apiKeyInput.parentElement.style.display = 'none';
      baseUrlGroup.style.display = 'none';
      modelNameInput.parentElement.style.display = 'none';
    } else {
      apiKeyInput.parentElement.style.display = 'block';
      modelNameInput.parentElement.style.display = 'block';

      if (provider === 'gemini') {
        modelNameInput.value = currentSettings.model || 'gemini-1.5-flash';
        modelNameInput.placeholder = 'gemini-1.5-flash';
        baseUrlGroup.style.display = 'none';
      } else if (provider === 'openai') {
        modelNameInput.value = currentSettings.model || 'gpt-3.5-turbo';
        modelNameInput.placeholder = 'gpt-3.5-turbo';
        baseUrlGroup.style.display = 'block';
      }
    }

    // Layout UI
    if (hideDescSwitch) hideDescSwitch.checked = !!currentSettings.layout_hide_desc;
    if (hideLinksSwitch) hideLinksSwitch.checked = !!currentSettings.layout_hide_links;
    if (hideCategorySwitch) hideCategorySwitch.checked = !!currentSettings.layout_hide_category;
    if (hideGithubSwitch) hideGithubSwitch.checked = !!currentSettings.home_hide_github;
    if (hideAdminSwitch) hideAdminSwitch.checked = !!currentSettings.home_hide_admin;

    if (hideTitleSwitch) hideTitleSwitch.checked = !!currentSettings.layout_hide_title;
    if (homeTitleSizeInput) homeTitleSizeInput.value = currentSettings.home_title_size || '36';
    if (homeTitleColorInput) {
      const val = currentSettings.home_title_color || '#ffffff';
      homeTitleColorInput.value = val;
      if (homeTitleColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
        homeTitleColorPicker.value = val;
      }
    }

    if (hideSubtitleSwitch) hideSubtitleSwitch.checked = !!currentSettings.layout_hide_subtitle;
    if (homeSubtitleSizeInput) homeSubtitleSizeInput.value = currentSettings.home_subtitle_size || '16';
    if (homeSubtitleColorInput) {
      const val = currentSettings.home_subtitle_color || '#e1e7f1';
      homeSubtitleColorInput.value = val;
      if (homeSubtitleColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
        homeSubtitleColorPicker.value = val;
      }
    }

    if (hideStatsSwitch) hideStatsSwitch.checked = !!currentSettings.home_hide_stats;
    if (homeStatsSizeInput) homeStatsSizeInput.value = currentSettings.home_stats_size || '20';
    if (homeStatsColorInput) {
      const val = currentSettings.home_stats_color || '#1f2937';
      homeStatsColorInput.value = val;
      if (homeStatsColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
        homeStatsColorPicker.value = val;
      }
    }

    if (hideHitokotoSwitch) hideHitokotoSwitch.checked = !!currentSettings.home_hide_hitokoto;
    if (homeHitokotoSizeInput) homeHitokotoSizeInput.value = currentSettings.home_hitokoto_size || '14';
    if (homeHitokotoColorInput) {
      const val = currentSettings.home_hitokoto_color || '#6b7280';
      homeHitokotoColorInput.value = val;
      if (homeHitokotoColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
        homeHitokotoColorPicker.value = val;
      }
    }

    if (homeTitleFontInput) homeTitleFontInput.value = currentSettings.home_title_font || '';
    if (homeSubtitleFontInput) homeSubtitleFontInput.value = currentSettings.home_subtitle_font || '';
    if (homeStatsFontInput) homeStatsFontInput.value = currentSettings.home_stats_font || '';
    if (homeHitokotoFontInput) homeHitokotoFontInput.value = currentSettings.home_hitokoto_font || '';

    if (homeSiteNameInput) homeSiteNameInput.value = currentSettings.home_site_name || '';
    if (homeSiteDescriptionInput) homeSiteDescriptionInput.value = currentSettings.home_site_description || '';

    if (homeDefaultCategorySelect) homeDefaultCategorySelect.value = currentSettings.home_default_category || '';
    if (homeRememberLastCategorySwitch) homeRememberLastCategorySwitch.checked = !!currentSettings.home_remember_last_category;

    if (searchEngineSwitch) searchEngineSwitch.checked = !!currentSettings.home_search_engine_enabled;

    if (frostedGlassSwitch) frostedGlassSwitch.checked = !!currentSettings.layout_enable_frosted_glass;
    if (frostedGlassIntensityRange) frostedGlassIntensityRange.value = currentSettings.layout_frosted_glass_intensity || '15';
    if (frostedGlassIntensityValue) frostedGlassIntensityValue.textContent = currentSettings.layout_frosted_glass_intensity || '15';

    // Toggle Intensity Container visibility
    const intensityContainer = document.getElementById('frostedGlassIntensityContainer');
    if (intensityContainer) {
      if (currentSettings.layout_enable_frosted_glass) {
        intensityContainer.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        intensityContainer.classList.add('opacity-50', 'pointer-events-none');
      }
    }

    if (customWallpaperInput) customWallpaperInput.value = currentSettings.layout_custom_wallpaper || '';

    if (bgBlurSwitch) bgBlurSwitch.checked = !!currentSettings.layout_enable_bg_blur;
    if (bgBlurIntensityRange) bgBlurIntensityRange.value = currentSettings.layout_bg_blur_intensity || '0';
    if (bgBlurIntensityValue) bgBlurIntensityValue.textContent = currentSettings.layout_bg_blur_intensity || '0';

    const bgBlurContainer = document.getElementById('bgBlurIntensityContainer');
    if (bgBlurContainer) {
      if (currentSettings.layout_enable_bg_blur) {
        bgBlurContainer.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        bgBlurContainer.classList.add('opacity-50', 'pointer-events-none');
      }
    }

    if (bingCountrySelect) bingCountrySelect.value = currentSettings.bing_country || '';

    // Grid Cols
    if (gridColsRadios) {
      for (const radio of gridColsRadios) {
        if (radio.value === String(currentSettings.layout_grid_cols)) {
          radio.checked = true;
        }
      }
    }

    // Menu Layout
    if (menuLayoutRadios) {
      for (const radio of menuLayoutRadios) {
        if (radio.value === String(currentSettings.layout_menu_layout)) {
          radio.checked = true;
        }
      }
    }

    if (cardRadiusInput) {
      cardRadiusInput.value = currentSettings.layout_card_border_radius || '12';
      if (cardRadiusValue) cardRadiusValue.textContent = currentSettings.layout_card_border_radius || '12';
    }

    if (cardTitleFontInput) cardTitleFontInput.value = currentSettings.card_title_font || '';
    if (cardTitleSizeInput) cardTitleSizeInput.value = currentSettings.card_title_size || '16';
    if (cardTitleColorInput) {
      const val = currentSettings.card_title_color || '#111827';
      cardTitleColorInput.value = val;
      if (cardTitleColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
        cardTitleColorPicker.value = val;
      }
    }

    if (cardDescFontInput) cardDescFontInput.value = currentSettings.card_desc_font || '';
    if (cardDescSizeInput) cardDescSizeInput.value = currentSettings.card_desc_size || '14';
    if (cardDescColorInput) {
      cardDescColorInput.value = currentSettings.card_desc_color || '';
      if (cardDescColorPicker && /^#[0-9A-F]{6}$/i.test(currentSettings.card_desc_color)) {
        cardDescColorPicker.value = currentSettings.card_desc_color;
      }
    }

    // Load Fonts
    if (currentSettings.home_title_font) loadFont(currentSettings.home_title_font);
    if (currentSettings.home_subtitle_font) loadFont(currentSettings.home_subtitle_font);
    if (currentSettings.home_stats_font) loadFont(currentSettings.home_stats_font);
    if (currentSettings.home_hitokoto_font) loadFont(currentSettings.home_hitokoto_font);
    if (currentSettings.card_title_font) loadFont(currentSettings.card_title_font);
    if (currentSettings.card_desc_font) loadFont(currentSettings.card_desc_font);

    // Update Card Style UI
    selectCardStyle(currentSettings.layout_card_style || 'style1');
    updatePreviewCards();
    updatePreviewWidth();
  }

  // --- AI Call Logic (Frontend) ---
  // Note: Pass currentSettings instead of trying to read from localStorage inside
  async function getAIDescription(aiConfig, bookmark, generateName = false) {
    const { name, url } = bookmark;

    let systemPrompt, userPrompt;
    if (generateName) {
      systemPrompt = "You are a helpful assistant. You must response with valid JSON.";
      userPrompt = `分析链接：'${url}'。请生成一个简短的网站名称（name，不超过10字）和中文简介（description，不超过30字）。请严格只返回 JSON 格式，例如：{"name": "名称", "description": "简介"}。`;
    } else {
      systemPrompt = "You are a helpful assistant that generates concise and accurate descriptions for bookmarks.";
      userPrompt = `为以下书签生成一个简洁的中文描述（不超过30字）。请直接返回描述内容，不要包含"书签名称"、"描述"等前缀，也不要使用"标题: 描述"的格式。书签名称：'${name}'，链接：'${url}'`;
    }

    try {
      // 始终通过后端 API 进行请求，后端会处理不同的 provider (Workers AI, Gemini, OpenAI)
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `AI 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.data;

      if (generateName) {
        try {
          const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(jsonStr);
        } catch (e) {
          console.warn('JSON 解析失败，将原始文本作为描述返回', e);
          return { description: responseText, name: '' };
        }
      } else {
        return { description: responseText, name: '' };
      }

    } catch (error) {
      console.error('AI 描述生成失败:', error);
      throw error;
    }
  }

  // --- Bulk Generation Logic (Refactored) ---
  async function handleBulkGenerate() {
    currentSettings.apiKey = apiKeyInput.value.trim();
    currentSettings.baseUrl = baseUrlInput.value.trim();
    currentSettings.model = modelNameInput.value.trim();

    // Validation - Backend will validate API Key
    if (currentSettings.provider !== 'workers-ai') {
      if (currentSettings.provider === 'openai' && !currentSettings.baseUrl) {
        showMessage('使用 OpenAI 兼容模式时，Base URL 是必填项', 'error');
        return;
      }
    }

    showMessage('正在扫描所有书签，请稍候...', 'info');
    let linksToUpdate = [];
    try {
      const response = await fetch('/api/get-empty-desc-sites');
      const result = await response.json();

      if (!response.ok || result.code !== 200) {
        showMessage(result.message || '获取待处理列表失败', 'error');
        return;
      }
      linksToUpdate = result.data;
    } catch (error) {
      showMessage('扫描书签时发生网络错误', 'error');
      return;
    }

    if (linksToUpdate.length === 0) {
      showMessage('太棒了！所有书签都已有描述。', 'success');
      return;
    }

    if (!confirm(`发现 ${linksToUpdate.length} 个链接缺少描述，确定要使用 AI 自动生成吗？`)) {
      return;
    }

    shouldStopBulkGeneration = false;
    bulkIdleView.style.display = 'none';
    bulkProgressView.style.display = 'block';

    let completedCount = 0;
    const total = linksToUpdate.length;
    progressCounter.textContent = `0 / ${total}`;
    progressBar.style.width = '0%';

    for (let i = 0; i < total; i++) {
      if (shouldStopBulkGeneration) {
        break;
      }

      const link = linksToUpdate[i];

      try {
        const { description } = await getAIDescription(currentSettings, link);
        const updateResponse = await fetch('/api/update-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: link.id, url: link.url, logo: link.logo, description: description })
        });

        const result = await updateResponse.json();
        if (result.code === 200) {
          completedCount++;
        } else {
          console.error(`Failed to update description for ${link.name}:`, result.message);
        }
      } catch (error) {
        console.error(`Error processing ${link.name}:`, error);
      }

      progressCounter.textContent = `${i + 1} / ${total}`;
      progressBar.style.width = `${((i + 1) / total) * 100}%`;

      if (i < total - 1) {
        console.log('Waiting for next request...:', aiRequestDelay);
        await new Promise(resolve => setTimeout(resolve, aiRequestDelay));
      }
    }

    bulkIdleView.style.display = 'block';
    bulkProgressView.style.display = 'none';

    // 如果是手动停止，等待2秒以确保数据库写入最终一致性
    if (shouldStopBulkGeneration) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 如果有任何书签被更新（或操作被停止），则刷新列表
    if (completedCount > 0 || shouldStopBulkGeneration) {
      fetchConfigs(currentPage);
    }

    // 根据结果显示最终消息
    let message = '';
    let messageType = 'success';
    if (shouldStopBulkGeneration) {
      message = `操作已停止。成功更新 ${completedCount} 个书签。列表已刷新。`;
    } else {
      if (completedCount === total && total > 0) {
        message = `批量生成完成！成功更新了全部 ${total} 个书签。`;
      } else if (completedCount > 0) {
        message = `批量生成完成。成功更新 ${completedCount} / ${total} 个书签。`;
        messageType = 'info';
      } else if (total > 0) {
        message = '批量生成完成，但未能成功更新任何书签。请检查控制台日志。';
        messageType = 'error';
      }
    }
    if (message) {
      showMessage(message, messageType);
    }

    shouldStopBulkGeneration = false;
  }

  // --- Individual AI Generation (Add/Edit) ---
  const addBookmarkAiBtn = document.getElementById('addBookmarkAiBtn');
  const editBookmarkAiBtn = document.getElementById('editBookmarkAiBtn');

  async function handleSingleGenerate(nameInputId, urlInputId, descInputId, btnId, modalId) {
    const name = document.getElementById(nameInputId).value.trim();
    const url = document.getElementById(urlInputId).value.trim();
    const descInput = document.getElementById(descInputId);
    const btn = document.getElementById(btnId);

    if (!url) {
      showMessage('请先填写 URL', 'error');
      return;
    }

    // Loading State
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<div class="ai-spinner"></div>';
    btn.disabled = true;

    showMessage('正在生成描述...', 'info');
    try {
      // Create a temporary object to match the expected structure
      const generateName = !name;
      const bookmark = { name: name || '未命名', url: url };
      const result = await getAIDescription(currentSettings, bookmark, generateName);

      descInput.value = result.description;
      if (generateName && result.name) {
        document.getElementById(nameInputId).value = result.name;
      }
      showMessage('生成成功', 'success');
    } catch (error) {
      console.error(error);
      showMessage('生成失败: ' + error.message, 'error');
    } finally {
      // Restore State
      btn.innerHTML = originalContent;
      btn.disabled = false;
    }
  }

  if (addBookmarkAiBtn) {
    addBookmarkAiBtn.addEventListener('click', () => {
      handleSingleGenerate('addBookmarkName', 'addBookmarkUrl', 'addBookmarkDesc', 'addBookmarkAiBtn', 'addBookmarkModal');
    });
  }

  if (editBookmarkAiBtn) {
    editBookmarkAiBtn.addEventListener('click', () => {
      handleSingleGenerate('editBookmarkName', 'editBookmarkUrl', 'editBookmarkDesc', 'editBookmarkAiBtn', 'editBookmarkModal');
    });
  }
};
initSettings();
