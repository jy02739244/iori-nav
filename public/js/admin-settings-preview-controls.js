(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const shared = ns.previewShared;
  const render = ns.previewRender;
  const nav = ns.previewNav;
  const animation = ns.previewAnimation;

 function setupColorPicker(textInput, pickerInput, scheduleRender = render.scheduleFullPreviewRender) {
    if (!textInput || !pickerInput) return;

    if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
      pickerInput.value = textInput.value;
    }

    pickerInput.addEventListener('input', () => {
      textInput.value = pickerInput.value;
      scheduleRender();
    });

    textInput.addEventListener('input', () => {
      const val = textInput.value;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        pickerInput.value = val;
      }
      scheduleRender();
    });
  }

 function updatePreviewCards() {
    const refs = shared.getRefs();
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

    if (titleFont) shared.loadFont(titleFont);
    if (descFont) shared.loadFont(descFont);

    [
      document.getElementById('cardStyle1Preview'),
      document.getElementById('cardStyle2Preview'),
      document.getElementById('cardStyle3Preview'),
    ].forEach(card => {
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

    render.schedulePreviewRenderForDevice('desktop');
  }

 function updatePreviewWidth() {
    const refs = shared.getRefs();
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
    const preview3 = document.getElementById('cardStyle3PreviewContainer');
    if (preview1) preview1.style.maxWidth = width;
    if (preview2) preview2.style.maxWidth = width;
    if (preview3) preview3.style.maxWidth = width;
    render.schedulePreviewRenderForDevice('desktop');
  }


 function syncCardContentHideOptions(device, style) {
    const isStyle3 = style === 'style3';
    if (device === 'mobile') {
      document.getElementById('mobileStyle3FixedHideHint')?.classList.toggle('hidden', !isStyle3);
      [
        'mobileHideCategoryOption',
        'mobileHideDescOption',
        'mobileHideLinksOption',
        'mobileCardDescStylePanel',
      ].forEach((id) => {
        document.getElementById(id)?.classList.toggle('hidden', isStyle3);
      });
      return;
    }

    document.getElementById('desktopStyle3FixedHideHint')?.classList.toggle('hidden', !isStyle3);
    [
      'hideCategoryOption',
      'hideDescOption',
      'hideLinksOption',
      'desktopCardDescStylePanel',
    ].forEach((id) => {
      document.getElementById(id)?.classList.toggle('hidden', isStyle3);
    });
  }

 function selectCardStyle(style) {
    const currentSettings = shared.getCurrentSettings();
    currentSettings.layout_card_style = style;

    const btn1 = document.getElementById('btnStyle1');
    const btn2 = document.getElementById('btnStyle2');
    const btn3 = document.getElementById('btnStyle3');
    const preview1 = document.getElementById('cardStyle1PreviewContainer');
    const preview2 = document.getElementById('cardStyle2PreviewContainer');
    const preview3 = document.getElementById('cardStyle3PreviewContainer');

    if (!btn1 || !btn2 || !btn3 || !preview1 || !preview2 || !preview3) return;

    [btn1, btn2, btn3].forEach(btn => {
      btn.className = 'card-style-btn card-segment-option';
    });
    [preview1, preview2, preview3].forEach(preview => preview.classList.add('hidden'));

    if (style === 'style2') {
      btn2.classList.add('active');
      preview2.classList.remove('hidden');
    } else if (style === 'style3') {
      btn3.classList.add('active');
      preview3.classList.remove('hidden');
    } else {
      btn1.classList.add('active');
      preview1.classList.remove('hidden');
    }

    syncCardContentHideOptions('desktop', style);
    const wallpaperInput = document.getElementById('customWallpaperInput');
    if (wallpaperInput && !wallpaperInput.value.trim()) {
      wallpaperInput.placeholder = ns.wallpaper?.getStyleDefaultWallpaper?.(style) || wallpaperInput.placeholder;
    }
    render.schedulePreviewRenderForDevice('desktop');
    render.triggerPreviewAnimationForDevice('desktop');
  }

 function selectMobileCardStyle(style) {
    const currentSettings = shared.getCurrentSettings();
    currentSettings.mobile_layout_card_style = style;

    const btn1 = document.getElementById('mobileBtnStyle1');
    const btn2 = document.getElementById('mobileBtnStyle2');
    const btn3 = document.getElementById('mobileBtnStyle3');
    if (!btn1 || !btn2 || !btn3) return;

    [btn1, btn2, btn3].forEach(btn => {
      btn.className = 'card-style-btn card-segment-option';
    });

    if (style === 'style2') {
      btn2.classList.add('active');
    } else if (style === 'style3') {
      btn3.classList.add('active');
    } else {
      btn1.classList.add('active');
    }

    syncCardContentHideOptions('mobile', style);
    render.schedulePreviewRenderForDevice('mobile');
    render.triggerPreviewAnimationForDevice('mobile');
  }

 function bindLivePreviewEvents() {
    const refs = shared.getRefs();
    const liveInputs = [
      refs.homeSiteNameInput,
      refs.homeSiteDescriptionInput,
      refs.homeFooterTextInput,
      refs.hideAdminSwitch,
      refs.searchEngineSwitch,
      refs.hideTitleSwitch,
      refs.homeTitleFontInput,
      refs.homeTitleSizeInput,
      refs.homeTitleColorInput,
      refs.hideSubtitleSwitch,
      refs.homeSubtitleFontInput,
      refs.homeSubtitleSizeInput,
      refs.homeSubtitleColorInput,
      refs.hideStatsSwitch,
      refs.homeStatsFontInput,
      refs.homeStatsSizeInput,
      refs.homeStatsColorInput,
      refs.hideHitokotoSwitch,
      refs.homeHitokotoFontInput,
      refs.homeHitokotoSizeInput,
      refs.homeHitokotoColorInput,
      refs.homeDefaultCategorySelect,
      refs.customWallpaperInput,
      refs.bgBlurSwitch,
      refs.bgBlurIntensityRange,
    ];
    const desktopCardInputs = [
      refs.hideDescSwitch,
      refs.hideLinksSwitch,
      refs.hideCategorySwitch,
      refs.frostedGlassSwitch,
      refs.frostedGlassIntensityRange,
      refs.cardRadiusInput,
      refs.cardTitleFontInput,
      refs.cardTitleSizeInput,
      refs.cardTitleColorInput,
      refs.cardDescFontInput,
      refs.cardDescSizeInput,
      refs.cardDescColorInput,
    ];
    const mobileCardInputs = [
      refs.mobileHideDescSwitch,
      refs.mobileHideLinksSwitch,
      refs.mobileHideCategorySwitch,
      refs.mobileFrostedGlassSwitch,
      refs.mobileFrostedGlassIntensityRange,
      refs.mobileCardAnimationSelect,
      refs.mobileCardRadiusInput,
      refs.mobileCardTitleFontInput,
      refs.mobileCardTitleSizeInput,
      refs.mobileCardTitleColorInput,
      refs.mobileCardDescFontInput,
      refs.mobileCardDescSizeInput,
      refs.mobileCardDescColorInput,
    ];

    liveInputs.forEach(input => {
      input?.addEventListener('input', render.scheduleFullPreviewRender);
      input?.addEventListener('change', render.scheduleFullPreviewRender);
    });
    desktopCardInputs.forEach(input => {
      input?.addEventListener('input', () => render.schedulePreviewRenderForDevice('desktop'));
      input?.addEventListener('change', () => render.schedulePreviewRenderForDevice('desktop'));
    });
    mobileCardInputs.forEach(input => {
      input?.addEventListener('input', () => render.schedulePreviewRenderForDevice('mobile'));
      input?.addEventListener('change', () => render.schedulePreviewRenderForDevice('mobile'));
    });

    refs.homeDefaultCategorySelect?.addEventListener('change', () => {
      render.resetLivePreviewCategory();
    });

    [
      refs.categoryPositionRadios,
      refs.categoryFlowRadios,
    ].forEach(radios => {
      for (const radio of radios || []) {
        radio.addEventListener('change', render.scheduleFullPreviewRender);
      }
    });
    for (const radio of refs.gridColsRadios || []) {
      radio.addEventListener('change', () => render.schedulePreviewRenderForDevice('desktop'));
    }
    for (const radio of refs.mobileGridColsRadios || []) {
      radio.addEventListener('change', () => render.schedulePreviewRenderForDevice('mobile'));
    }

    document.querySelectorAll('.preview-device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preview-device-btn').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        const root = document.getElementById('homeLivePreview');
        if (root) {
          root.dataset.device = btn.dataset.previewDevice || 'desktop';
          if (root.dataset.device !== 'mobile') root.classList.remove('mobile-menu-open');
        }
        render.scheduleFullPreviewRender();
      });
    });

    const root = document.getElementById('homeLivePreview');
    const menuToggle = root?.querySelector('[data-preview-role="mobileMenuToggle"]');
    const mobileOverlay = root?.querySelector('[data-preview-role="mobileOverlay"]');
    menuToggle?.addEventListener('click', () => {
      if (!root || root.dataset.device !== 'mobile') return;
      root.classList.toggle('mobile-menu-open');
      menuToggle.setAttribute('aria-expanded', root.classList.contains('mobile-menu-open') ? 'true' : 'false');
    });
    mobileOverlay?.addEventListener('click', () => {
      if (!root) return;
      root.classList.remove('mobile-menu-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });

    root?.addEventListener('click', (event) => {
      const target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      const moreButton = target?.closest('.live-category-more');
      if (moreButton && root.contains(moreButton)) {
        event.stopPropagation();
        const wrapper = moreButton.closest('.live-category-more-wrapper');
        const willOpen = !wrapper?.classList.contains('is-open');
        nav.closePreviewCategoryMoreMenus(root, wrapper);
        wrapper?.classList.toggle('is-open', willOpen);
        moreButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }

      const categoryControl = target?.closest('[data-preview-category]');
      if (categoryControl && root.contains(categoryControl)) {
        event.stopPropagation();
        render.selectLivePreviewCategory(root, categoryControl.dataset.previewCategory || '');
        return;
      }

      if (!target?.closest('.live-category-dropdown')) {
        nav.closePreviewCategoryMoreMenus(root);
      }
    });

    root?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      const moreButton = target?.closest('.live-category-more');
      const categoryControl = target?.closest('[data-preview-category]');
      if (moreButton && root.contains(moreButton)) {
        event.preventDefault();
        moreButton.click();
      } else if (categoryControl && root.contains(categoryControl)) {
        event.preventDefault();
        categoryControl.click();
      }
    });

    document.addEventListener('click', (event) => {
      if (!root || root.contains(event.target)) return;
      nav.closePreviewCategoryMoreMenus(root);
    });
  }

 function bindPreviewEvents() {
    const refs = shared.getRefs();

    for (const radio of refs.gridColsRadios || []) {
      radio.addEventListener('change', updatePreviewWidth);
    }
    document.getElementById('btnStyle1')?.addEventListener('click', () => selectCardStyle('style1'));
    document.getElementById('btnStyle2')?.addEventListener('click', () => selectCardStyle('style2'));
    document.getElementById('btnStyle3')?.addEventListener('click', () => selectCardStyle('style3'));
    document.getElementById('mobileBtnStyle1')?.addEventListener('click', () => selectMobileCardStyle('style1'));
    document.getElementById('mobileBtnStyle2')?.addEventListener('click', () => selectMobileCardStyle('style2'));
    document.getElementById('mobileBtnStyle3')?.addEventListener('click', () => selectMobileCardStyle('style3'));
    document.querySelectorAll('.card-animation-option[data-animation-device="desktop"]').forEach(option => {
      option.addEventListener('click', () => {
        if (!refs.cardAnimationSelect) return;
        refs.cardAnimationSelect.value = option.dataset.animation || 'radial';
        shared.getCurrentSettings().layout_card_animation = refs.cardAnimationSelect.value;
        animation.syncAnimationOptions('desktop');
        render.triggerPreviewAnimationForDevice('desktop');
      });
    });
    document.querySelectorAll('.card-animation-option[data-animation-device="mobile"]').forEach(option => {
      option.addEventListener('click', () => {
        if (!refs.mobileCardAnimationSelect) return;
        refs.mobileCardAnimationSelect.value = option.dataset.animation || 'radial';
        shared.getCurrentSettings().mobile_layout_card_animation = refs.mobileCardAnimationSelect.value;
        animation.syncAnimationOptions('mobile');
        render.triggerPreviewAnimationForDevice('mobile');
      });
    });

    refs.cardAnimationSelect?.addEventListener('change', () => {
      shared.getCurrentSettings().layout_card_animation = refs.cardAnimationSelect.value || 'radial';
      animation.syncAnimationOptions('desktop');
      render.triggerPreviewAnimationForDevice('desktop');
    });
    refs.mobileCardAnimationSelect?.addEventListener('change', () => {
      shared.getCurrentSettings().mobile_layout_card_animation = refs.mobileCardAnimationSelect.value || 'radial';
      animation.syncAnimationOptions('mobile');
      render.triggerPreviewAnimationForDevice('mobile');
    });

    refs.hideDescSwitch?.addEventListener('change', updatePreviewCards);
    refs.hideLinksSwitch?.addEventListener('change', updatePreviewCards);
    refs.hideCategorySwitch?.addEventListener('change', updatePreviewCards);
    refs.frostedGlassSwitch?.addEventListener('change', updatePreviewCards);
    refs.frostedGlassIntensityRange?.addEventListener('input', updatePreviewCards);

    refs.cardRadiusInput?.addEventListener('input', () => {
      if (refs.cardRadiusValue) refs.cardRadiusValue.textContent = refs.cardRadiusInput.value;
      updatePreviewCards();
    });
    refs.mobileCardRadiusInput?.addEventListener('input', () => {
      if (refs.mobileCardRadiusValue) refs.mobileCardRadiusValue.textContent = refs.mobileCardRadiusInput.value;
      render.schedulePreviewRenderForDevice('mobile');
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

    [
      refs.mobileCardTitleFontInput,
      refs.mobileCardTitleSizeInput,
      refs.mobileCardTitleColorInput,
      refs.mobileCardDescFontInput,
      refs.mobileCardDescSizeInput,
      refs.mobileCardDescColorInput,
    ].forEach(input => {
      input?.addEventListener('input', () => render.schedulePreviewRenderForDevice('mobile'));
      input?.addEventListener('change', () => render.schedulePreviewRenderForDevice('mobile'));
    });

    setupColorPicker(refs.homeTitleColorInput, refs.homeTitleColorPicker);
    setupColorPicker(refs.homeSubtitleColorInput, refs.homeSubtitleColorPicker);
    setupColorPicker(refs.homeStatsColorInput, refs.homeStatsColorPicker);
    setupColorPicker(refs.homeHitokotoColorInput, refs.homeHitokotoColorPicker);
    setupColorPicker(refs.cardTitleColorInput, refs.cardTitleColorPicker, () => render.schedulePreviewRenderForDevice('desktop'));
    setupColorPicker(refs.cardDescColorInput, refs.cardDescColorPicker, () => render.schedulePreviewRenderForDevice('desktop'));
    setupColorPicker(refs.mobileCardTitleColorInput, refs.mobileCardTitleColorPicker, () => render.schedulePreviewRenderForDevice('mobile'));
    setupColorPicker(refs.mobileCardDescColorInput, refs.mobileCardDescColorPicker, () => render.schedulePreviewRenderForDevice('mobile'));
    bindLivePreviewEvents();
  }

  ns.previewControls = {
    bindPreviewEvents,
    updatePreviewCards,
    updatePreviewWidth,
    selectCardStyle,
    selectMobileCardStyle,
  };
})();
