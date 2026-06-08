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

 function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

 function getRadioValue(radios, fallback) {
    for (const radio of radios || []) {
      if (radio.checked) return radio.value;
    }
    return fallback;
  }

 function normalizeCategoryPosition(position, menuLayout) {
    if (position === 'above_description') return 'top';
    if (['below_search', 'above_search', 'left', 'top'].includes(position)) return position;
    return menuLayout === 'vertical' ? 'left' : 'below_search';
  }

 function getPreviewInputValue(input, fallback = '') {
    return input ? input.value.trim() : fallback;
  }

 function getPreviewInputValueOrDefault(input, fallback, defaultValue) {
    const value = getPreviewInputValue(input, fallback);
    return value || defaultValue;
  }

 function getPreviewNumberOrDefault(value, defaultValue) {
    const text = String(value ?? '').trim();
    if (text === '') return defaultValue;
    const number = Number(text);
    return Number.isFinite(number) ? number : defaultValue;
  }

 function shouldHideCopyTextForPreview(device, gridCols) {
    return device === 'mobile'
      ? Number(gridCols) >= 3
      : (Number(gridCols) || 4) >= 5;
  }

 function normalizePreviewUrl(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    try {
      const parsed = new URL(text);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch {
      return '';
    }
  }

 function normalizePreviewAssetUrl(value) {
    if (typeof window.normalizeUrl === 'function') {
      return window.normalizeUrl(value);
    }

    const text = String(value ?? '').trim();
    if (!text) return '';
    if (/^data:image\/[\w+.-]+;base64,/.test(text) || text.startsWith('/')) return text;
    try {
      const parsed = new URL(text);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch {
      return /^[\w.-]+\.[\w.-]+/.test(text) ? `https://${text}` : '';
    }
  }

 function getHostnameLabel(url) {
    const normalizedUrl = normalizePreviewAssetUrl(url);
    if (!normalizedUrl) return '';
    try {
      return new URL(normalizedUrl, window.location.origin).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

 function applyTextStyle(element, font, size, color) {
    if (!element) return;
    if (font) {
      element.style.fontFamily = font;
      loadFont(font);
    } else {
      element.style.removeProperty('font-family');
    }

    const numericSize = Number(size);
    if (Number.isFinite(numericSize) && numericSize > 0) {
      element.style.fontSize = `${numericSize}px`;
    } else {
      element.style.removeProperty('font-size');
    }

    if (color) {
      element.style.color = color;
    } else {
      element.style.removeProperty('color');
    }
  }

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
      refs.mobileCardTitleFontInput,
      refs.mobileCardDescFontInput,
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

  ns.previewShared = {
    FONT_OPTIONS,
    FONT_URL_MAP,
    escapeHTML,
    getRadioValue,
    normalizeCategoryPosition,
    getPreviewInputValue,
    getPreviewInputValueOrDefault,
    getPreviewNumberOrDefault,
    shouldHideCopyTextForPreview,
    normalizePreviewUrl,
    normalizePreviewAssetUrl,
    getHostnameLabel,
    applyTextStyle,
    getRefs,
    getCurrentSettings,
    loadFont,
    populateFontSelects,
  };
})();
