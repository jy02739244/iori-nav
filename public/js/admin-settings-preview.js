(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};

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
  let initialized = false;

  function getRefs() {
    return ns.core?.getRefs?.() || {};
  }

  function getCurrentSettings() {
    return ns.core?.getCurrentSettings?.() || ns.currentSettings || {};
  }

  function loadFont(fontFamily) {
    if (!fontFamily || loadedFonts.has(fontFamily)) return;
    const url = FONT_URL_MAP[fontFamily];
    if (!url) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    loadedFonts.add(fontFamily);
  }

  function populateFontSelects() {
    const refs = getRefs();
    const selects = [
      refs.homeTitleFontInput,
      refs.homeSubtitleFontInput,
      refs.homeStatsFontInput,
      refs.homeHitokotoFontInput,
      refs.cardTitleFontInput,
      refs.cardDescFontInput,
    ];

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

  function setupColorPicker(textInput, pickerInput) {
    if (!textInput || !pickerInput) return;

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

  function updatePreviewCards() {
    const refs = getRefs();
    const hideDesc = !!refs.hideDescSwitch?.checked;
    const hideLinks = !!refs.hideLinksSwitch?.checked;
    const hideCategory = !!refs.hideCategorySwitch?.checked;
    const enableFrosted = !!refs.frostedGlassSwitch?.checked;
    const frostedIntensity = refs.frostedGlassIntensityRange?.value || '15';
    const radius = refs.cardRadiusInput?.value || '12';

    const titleFont = refs.cardTitleFontInput?.value || '';
    const titleSize = refs.cardTitleSizeInput?.value || '';
    const titleColor = refs.cardTitleColorInput?.value || '';
    const descFont = refs.cardDescFontInput?.value || '';
    const descSize = refs.cardDescSizeInput?.value || '';
    const descColor = refs.cardDescColorInput?.value || '';

    if (titleFont) loadFont(titleFont);
    if (descFont) loadFont(descFont);

    [document.getElementById('cardStyle1Preview'), document.getElementById('cardStyle2Preview')].forEach(card => {
      if (!card) return;
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
    const refs = getRefs();
    let cols = '4';

    for (const radio of refs.gridColsRadios || []) {
      if (radio.checked) {
        cols = radio.value;
        break;
      }
    }

    const widthMap = {
      '4': '280px',
      '5': '230px',
      '6': '190px',
      '7': '160px'
    };
    const width = widthMap[cols] || '280px';

    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');
    if (preview1) preview1.style.maxWidth = width;
    if (preview2) preview2.style.maxWidth = width;
  }

  function selectCardStyle(style) {
    const currentSettings = getCurrentSettings();
    currentSettings.layout_card_style = style;

    const btn1 = document.getElementById('btnStyle1');
    const btn2 = document.getElementById('btnStyle2');
    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');

    if (!btn1 || !btn2 || !preview1 || !preview2) return;

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

  function bindPreviewEvents() {
    const refs = getRefs();

    for (const radio of refs.gridColsRadios || []) {
      radio.addEventListener('change', updatePreviewWidth);
    }

    document.getElementById('btnStyle1')?.addEventListener('click', () => selectCardStyle('style1'));
    document.getElementById('btnStyle2')?.addEventListener('click', () => selectCardStyle('style2'));

    refs.hideDescSwitch?.addEventListener('change', updatePreviewCards);
    refs.hideLinksSwitch?.addEventListener('change', updatePreviewCards);
    refs.hideCategorySwitch?.addEventListener('change', updatePreviewCards);
    refs.frostedGlassSwitch?.addEventListener('change', updatePreviewCards);
    refs.frostedGlassIntensityRange?.addEventListener('input', updatePreviewCards);

    refs.cardRadiusInput?.addEventListener('input', () => {
      if (refs.cardRadiusValue) refs.cardRadiusValue.textContent = refs.cardRadiusInput.value;
      updatePreviewCards();
    });

    [
      refs.cardTitleFontInput,
      refs.cardTitleSizeInput,
      refs.cardTitleColorInput,
      refs.cardDescFontInput,
      refs.cardDescSizeInput,
      refs.cardDescColorInput,
    ].forEach(input => {
      input?.addEventListener('input', updatePreviewCards);
      input?.addEventListener('change', updatePreviewCards);
    });

    setupColorPicker(refs.homeTitleColorInput, refs.homeTitleColorPicker);
    setupColorPicker(refs.homeSubtitleColorInput, refs.homeSubtitleColorPicker);
    setupColorPicker(refs.homeStatsColorInput, refs.homeStatsColorPicker);
    setupColorPicker(refs.homeHitokotoColorInput, refs.homeHitokotoColorPicker);
    setupColorPicker(refs.cardTitleColorInput, refs.cardTitleColorPicker);
    setupColorPicker(refs.cardDescColorInput, refs.cardDescColorPicker);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    populateFontSelects();
    bindPreviewEvents();
  }

  ns.preview = {
    init,
    loadFont,
    updatePreviewCards,
    updatePreviewWidth,
    selectCardStyle,
  };
})();
