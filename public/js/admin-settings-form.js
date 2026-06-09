(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const currentSettings = ns.currentSettings || ns.defaults?.createDefaultSettings?.() || {};
  ns.currentSettings = currentSettings;

  function getRefs() {
    return {
      settingsBtn: document.getElementById('settingsBtn'),
      settingsModal: document.getElementById('settingsModal'),
      closeBtn: document.getElementById('closeSettingsModal'),
      cancelBtn: document.getElementById('cancelSettingsBtn'),
      saveBtn: document.getElementById('saveSettingsBtn'),
      settingsTabBtns: document.querySelectorAll('.settings-tab-btn'),
      settingsTabContents: document.querySelectorAll('.settings-tab-content'),
      providerSelector: document.getElementById('providerSelector'),
      baseUrlGroup: document.getElementById('baseUrlGroup'),
      apiKeyInput: document.getElementById('apiKey'),
      baseUrlInput: document.getElementById('baseUrl'),
      modelNameInput: document.getElementById('modelName'),
      hideDescSwitch: document.getElementById('hideDescSwitch'),
      hideLinksSwitch: document.getElementById('hideLinksSwitch'),
      hideCategorySwitch: document.getElementById('hideCategorySwitch'),
      hideAdminSwitch: document.getElementById('hideAdminSwitch'),
      frostedGlassSwitch: document.getElementById('frostedGlassSwitch'),
      frostedGlassIntensityRange: document.getElementById('frostedGlassIntensity'),
      frostedGlassIntensityValue: document.getElementById('frostedGlassIntensityValue'),
      gridColsRadios: document.getElementsByName('gridCols'),
      categoryPositionRadios: document.getElementsByName('categoryPosition'),
      categoryFlowRadios: document.getElementsByName('categoryFlow'),
      customWallpaperInput: document.getElementById('customWallpaperInput'),
      bgBlurSwitch: document.getElementById('bgBlurSwitch'),
      bgBlurIntensityRange: document.getElementById('bgBlurIntensity'),
      bgBlurIntensityValue: document.getElementById('bgBlurIntensityValue'),
      bingCountrySelect: document.getElementById('bingCountry'),
      onlineWallpapersDiv: document.getElementById('onlineWallpapers'),
      category360Select: document.getElementById('category360'),
      hideTitleSwitch: document.getElementById('hideTitleSwitch'),
      homeTitleSizeInput: document.getElementById('homeTitleSize'),
      homeTitleColorInput: document.getElementById('homeTitleColor'),
      homeTitleColorPicker: document.getElementById('homeTitleColorPicker'),
      hideSubtitleSwitch: document.getElementById('hideSubtitleSwitch'),
      homeSubtitleSizeInput: document.getElementById('homeSubtitleSize'),
      homeSubtitleColorInput: document.getElementById('homeSubtitleColor'),
      homeSubtitleColorPicker: document.getElementById('homeSubtitleColorPicker'),
      hideStatsSwitch: document.getElementById('hideStatsSwitch'),
      homeStatsSizeInput: document.getElementById('homeStatsSize'),
      homeStatsColorInput: document.getElementById('homeStatsColor'),
      homeStatsColorPicker: document.getElementById('homeStatsColorPicker'),
      hideHitokotoSwitch: document.getElementById('hideHitokotoSwitch'),
      homeHitokotoSizeInput: document.getElementById('homeHitokotoSize'),
      homeHitokotoColorInput: document.getElementById('homeHitokotoColor'),
      homeHitokotoColorPicker: document.getElementById('homeHitokotoColorPicker'),
      homeTitleFontInput: document.getElementById('homeTitleFont'),
      homeSubtitleFontInput: document.getElementById('homeSubtitleFont'),
      homeStatsFontInput: document.getElementById('homeStatsFont'),
      homeHitokotoFontInput: document.getElementById('homeHitokotoFont'),
      homeSiteNameInput: document.getElementById('homeSiteName'),
      homeSiteDescriptionInput: document.getElementById('homeSiteDescription'),
      homeFooterTextInput: document.getElementById('homeFooterText'),
      homeDefaultCategorySelect: document.getElementById('homeDefaultCategory'),
      homeRememberLastCategorySwitch: document.getElementById('homeRememberLastCategorySwitch'),
      searchEngineSwitch: document.getElementById('searchEngineSwitch'),
      cardRadiusInput: document.getElementById('cardRadius'),
      cardRadiusValue: document.getElementById('cardRadiusValue'),
      cardTitleFontInput: document.getElementById('cardTitleFont'),
      cardTitleSizeInput: document.getElementById('cardTitleSize'),
      cardTitleColorInput: document.getElementById('cardTitleColor'),
      cardTitleColorPicker: document.getElementById('cardTitleColorPicker'),
      cardAnimationSelect: document.getElementById('cardAnimationSelect'),
      cardDescFontInput: document.getElementById('cardDescFont'),
      cardDescSizeInput: document.getElementById('cardDescSize'),
      cardDescColorInput: document.getElementById('cardDescColor'),
      cardDescColorPicker: document.getElementById('cardDescColorPicker'),
      mobileHideDescSwitch: document.getElementById('mobileHideDescSwitch'),
      mobileHideLinksSwitch: document.getElementById('mobileHideLinksSwitch'),
      mobileHideCategorySwitch: document.getElementById('mobileHideCategorySwitch'),
      mobileFrostedGlassSwitch: document.getElementById('mobileFrostedGlassSwitch'),
      mobileFrostedGlassIntensityRange: document.getElementById('mobileFrostedGlassIntensity'),
      mobileFrostedGlassIntensityValue: document.getElementById('mobileFrostedGlassIntensityValue'),
      mobileGridColsRadios: document.getElementsByName('mobileGridCols'),
      mobileCardAnimationSelect: document.getElementById('mobileCardAnimationSelect'),
      mobileCardRadiusInput: document.getElementById('mobileCardRadius'),
      mobileCardRadiusValue: document.getElementById('mobileCardRadiusValue'),
      mobileCardTitleFontInput: document.getElementById('mobileCardTitleFont'),
      mobileCardTitleSizeInput: document.getElementById('mobileCardTitleSize'),
      mobileCardTitleColorInput: document.getElementById('mobileCardTitleColor'),
      mobileCardTitleColorPicker: document.getElementById('mobileCardTitleColorPicker'),
      mobileCardDescFontInput: document.getElementById('mobileCardDescFont'),
      mobileCardDescSizeInput: document.getElementById('mobileCardDescSize'),
      mobileCardDescColorInput: document.getElementById('mobileCardDescColor'),
      mobileCardDescColorPicker: document.getElementById('mobileCardDescColorPicker'),
      bulkProgressView: document.getElementById('bulkGenerateProgress'),
    };
  }

  function normalizeCategoryPosition(position, menuLayout) {
    return ns.defaults?.normalizeCategoryPosition?.(position, menuLayout)
      || (menuLayout === 'vertical' ? 'left' : 'below_search');
  }

  function setChecked(element, value) {
    if (element) element.checked = !!value;
  }

  function setValue(element, value) {
    if (element) element.value = value ?? '';
  }

  function setColorInputs(textInput, pickerInput, value) {
    if (!textInput) return;
    textInput.value = value;
    if (pickerInput && /^#[0-9A-F]{6}$/i.test(value)) {
      pickerInput.value = value;
    }
  }

  function setRangeValue(rangeInput, valueLabel, value) {
    if (rangeInput) rangeInput.value = value;
    if (valueLabel) valueLabel.textContent = value;
  }

  function setRadioValue(radios, value) {
    if (!radios) return;
    for (const radio of radios) {
      if (radio.value === String(value)) {
        radio.checked = true;
      }
    }
  }

  function updateToggleContainer(switchElement, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !switchElement) return;
    if (switchElement.checked) {
      container.classList.remove('opacity-50', 'pointer-events-none');
    } else {
      container.classList.add('opacity-50', 'pointer-events-none');
    }
  }

  async function loadCategoryOptions(selectElement) {
    if (!selectElement) return;

    if (!window.categoriesTree || window.categoriesTree.length === 0) {
      try {
        const res = await fetch('/api/categories?pageSize=9999');
        const data = await res.json();
        if (data.code === 200) {
          window.categoriesData = data.data || [];
          if (typeof window.buildCategoryTree === 'function') {
            window.categoriesTree = window.buildCategoryTree(window.categoriesData);
          }
        }
      } catch (e) {
        console.error('Failed to load categories for settings', e);
      }
    }

    selectElement.innerHTML = '<option value="">默认 (全部)</option>';
    const addOptions = (nodes, prefix = '') => {
      nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node.catelog;
        option.textContent = prefix + node.catelog;
        selectElement.appendChild(option);
        if (node.children && node.children.length > 0) {
          addOptions(node.children, prefix + '-- ');
        }
      });
    };
    addOptions(window.categoriesTree || []);
  }

  function collectSettingsFromInputs() {
    const refs = getRefs();

    const newApiKey = refs.apiKeyInput?.value.trim() || '';
    if (newApiKey) {
      currentSettings.apiKey = newApiKey;
    } else if (currentSettings.has_api_key) {
      delete currentSettings.apiKey;
    } else {
      currentSettings.apiKey = '';
    }

    currentSettings.baseUrl = refs.baseUrlInput?.value.trim() || '';
    currentSettings.model = refs.modelNameInput?.value.trim() || '';
    currentSettings.layout_hide_desc = !!refs.hideDescSwitch?.checked;
    currentSettings.layout_hide_links = !!refs.hideLinksSwitch?.checked;
    currentSettings.layout_hide_category = !!refs.hideCategorySwitch?.checked;
    currentSettings.home_hide_admin = !!refs.hideAdminSwitch?.checked;
    currentSettings.layout_hide_title = !!refs.hideTitleSwitch?.checked;
    currentSettings.home_title_size = refs.homeTitleSizeInput?.value.trim() || '';
    currentSettings.home_title_color = refs.homeTitleColorInput?.value.trim() || '';
    currentSettings.layout_hide_subtitle = !!refs.hideSubtitleSwitch?.checked;
    currentSettings.home_subtitle_size = refs.homeSubtitleSizeInput?.value.trim() || '';
    currentSettings.home_subtitle_color = refs.homeSubtitleColorInput?.value.trim() || '';
    currentSettings.home_hide_stats = !!refs.hideStatsSwitch?.checked;
    currentSettings.home_stats_size = refs.homeStatsSizeInput?.value.trim() || '';
    currentSettings.home_stats_color = refs.homeStatsColorInput?.value.trim() || '';
    currentSettings.home_hide_hitokoto = !!refs.hideHitokotoSwitch?.checked;
    currentSettings.home_hitokoto_size = refs.homeHitokotoSizeInput?.value.trim() || '';
    currentSettings.home_hitokoto_color = refs.homeHitokotoColorInput?.value.trim() || '';
    currentSettings.home_title_font = refs.homeTitleFontInput?.value.trim() || '';
    currentSettings.home_subtitle_font = refs.homeSubtitleFontInput?.value.trim() || '';
    currentSettings.home_stats_font = refs.homeStatsFontInput?.value.trim() || '';
    currentSettings.home_hitokoto_font = refs.homeHitokotoFontInput?.value.trim() || '';
    currentSettings.home_site_name = refs.homeSiteNameInput?.value.trim() || '';
    currentSettings.home_site_description = refs.homeSiteDescriptionInput?.value.trim() || '';
    currentSettings.home_footer_text = refs.homeFooterTextInput?.value.trim() || '';
    currentSettings.home_default_category = refs.homeDefaultCategorySelect?.value || '';
    currentSettings.home_remember_last_category = !!refs.homeRememberLastCategorySwitch?.checked;
    currentSettings.home_search_engine_enabled = !!refs.searchEngineSwitch?.checked;
    currentSettings.layout_custom_wallpaper = refs.customWallpaperInput?.value.trim() || '';
    currentSettings.layout_enable_bg_blur = !!refs.bgBlurSwitch?.checked;
    currentSettings.layout_bg_blur_intensity = refs.bgBlurIntensityRange?.value || '0';
    currentSettings.bing_country = refs.bingCountrySelect?.value || '';
    currentSettings.wallpaper_cid_360 = refs.category360Select?.value || '36';

    for (const radio of refs.gridColsRadios || []) {
      if (radio.checked) {
        currentSettings.layout_grid_cols = radio.value;
        break;
      }
    }

    let categoryPosition = normalizeCategoryPosition(
      currentSettings.home_category_position,
      currentSettings.layout_menu_layout
    );
    for (const radio of refs.categoryPositionRadios || []) {
      if (radio.checked) {
        categoryPosition = radio.value;
        break;
      }
    }
    currentSettings.home_category_position = categoryPosition;
    currentSettings.layout_menu_layout = categoryPosition === 'left' ? 'vertical' : 'horizontal';

    for (const radio of refs.categoryFlowRadios || []) {
      if (radio.checked) {
        currentSettings.home_category_flow = radio.value;
        break;
      }
    }

    currentSettings.layout_enable_frosted_glass = !!refs.frostedGlassSwitch?.checked;
    currentSettings.layout_frosted_glass_intensity = refs.frostedGlassIntensityRange?.value || '15';
    currentSettings.layout_card_style = document.getElementById('btnStyle2')?.classList.contains('active') ? 'style2' : 'style1';
    currentSettings.layout_card_animation = refs.cardAnimationSelect?.value || 'radial';
    currentSettings.layout_card_border_radius = refs.cardRadiusInput?.value || '12';
    currentSettings.card_title_font = refs.cardTitleFontInput?.value.trim() || '';
    currentSettings.card_title_size = refs.cardTitleSizeInput?.value.trim() || '';
    currentSettings.card_title_color = refs.cardTitleColorInput?.value.trim() || '';
    currentSettings.card_desc_font = refs.cardDescFontInput?.value.trim() || '';
    currentSettings.card_desc_size = refs.cardDescSizeInput?.value.trim() || '';
    currentSettings.card_desc_color = refs.cardDescColorInput?.value.trim() || '';

    currentSettings.mobile_layout_hide_desc = !!refs.mobileHideDescSwitch?.checked;
    currentSettings.mobile_layout_hide_links = !!refs.mobileHideLinksSwitch?.checked;
    currentSettings.mobile_layout_hide_category = !!refs.mobileHideCategorySwitch?.checked;
    currentSettings.mobile_layout_enable_frosted_glass = !!refs.mobileFrostedGlassSwitch?.checked;
    currentSettings.mobile_layout_frosted_glass_intensity = refs.mobileFrostedGlassIntensityRange?.value || '15';
    for (const radio of refs.mobileGridColsRadios || []) {
      if (radio.checked) {
        currentSettings.mobile_layout_grid_cols = radio.value;
        break;
      }
    }
    currentSettings.mobile_layout_card_style = document.getElementById('mobileBtnStyle2')?.classList.contains('active') ? 'style2' : 'style1';
    currentSettings.mobile_layout_card_animation = refs.mobileCardAnimationSelect?.value || 'radial';
    currentSettings.mobile_layout_card_border_radius = refs.mobileCardRadiusInput?.value || '12';
    currentSettings.mobile_card_title_font = refs.mobileCardTitleFontInput?.value.trim() || '';
    currentSettings.mobile_card_title_size = refs.mobileCardTitleSizeInput?.value.trim() || '';
    currentSettings.mobile_card_title_color = refs.mobileCardTitleColorInput?.value.trim() || '';
    currentSettings.mobile_card_desc_font = refs.mobileCardDescFontInput?.value.trim() || '';
    currentSettings.mobile_card_desc_size = refs.mobileCardDescSizeInput?.value.trim() || '';
    currentSettings.mobile_card_desc_color = refs.mobileCardDescColorInput?.value.trim() || '';

    return currentSettings;
  }

  function updateProviderUI(refs) {
    if (!refs.providerSelector) return;
    refs.providerSelector.value = currentSettings.provider || 'workers-ai';
    let provider = currentSettings.provider || 'workers-ai';

    if (!['gemini', 'openai', 'workers-ai'].includes(provider)) {
      provider = 'workers-ai';
      currentSettings.provider = provider;
      refs.providerSelector.value = provider;
    }

    if (refs.apiKeyInput) {
      refs.apiKeyInput.value = currentSettings.apiKey || '';
      refs.apiKeyInput.placeholder = currentSettings.has_api_key && !refs.apiKeyInput.value
        ? '已配置 (如需修改请直接输入)'
        : '请输入 API Key';
    }
    setValue(refs.baseUrlInput, currentSettings.baseUrl || '');

    if (provider === 'workers-ai') {
      if (refs.apiKeyInput?.parentElement) refs.apiKeyInput.parentElement.style.display = 'none';
      if (refs.baseUrlGroup) refs.baseUrlGroup.style.display = 'none';
      if (refs.modelNameInput?.parentElement) refs.modelNameInput.parentElement.style.display = 'none';
      return;
    }

    if (refs.apiKeyInput?.parentElement) refs.apiKeyInput.parentElement.style.display = 'block';
    if (refs.modelNameInput?.parentElement) refs.modelNameInput.parentElement.style.display = 'block';

    if (provider === 'gemini') {
      setValue(refs.modelNameInput, currentSettings.model || 'gemini-1.5-flash');
      if (refs.modelNameInput) refs.modelNameInput.placeholder = 'gemini-1.5-flash';
      if (refs.baseUrlGroup) refs.baseUrlGroup.style.display = 'none';
    } else if (provider === 'openai') {
      setValue(refs.modelNameInput, currentSettings.model || 'gpt-3.5-turbo');
      if (refs.modelNameInput) refs.modelNameInput.placeholder = 'gpt-3.5-turbo';
      if (refs.baseUrlGroup) refs.baseUrlGroup.style.display = 'block';
    }
  }

  function updateUIFromSettings() {
    const refs = getRefs();

    updateProviderUI(refs);

    setChecked(refs.hideDescSwitch, currentSettings.layout_hide_desc);
    setChecked(refs.hideLinksSwitch, currentSettings.layout_hide_links);
    setChecked(refs.hideCategorySwitch, currentSettings.layout_hide_category);
    setChecked(refs.hideAdminSwitch, currentSettings.home_hide_admin);
    setChecked(refs.hideTitleSwitch, currentSettings.layout_hide_title);
    setValue(refs.homeTitleSizeInput, currentSettings.home_title_size || '36');
    setColorInputs(refs.homeTitleColorInput, refs.homeTitleColorPicker, currentSettings.home_title_color || '#ffffff');
    setChecked(refs.hideSubtitleSwitch, currentSettings.layout_hide_subtitle);
    setValue(refs.homeSubtitleSizeInput, currentSettings.home_subtitle_size || '16');
    setColorInputs(refs.homeSubtitleColorInput, refs.homeSubtitleColorPicker, currentSettings.home_subtitle_color || '#e1e7f1');
    setChecked(refs.hideStatsSwitch, currentSettings.home_hide_stats);
    setValue(refs.homeStatsSizeInput, currentSettings.home_stats_size || '20');
    setColorInputs(refs.homeStatsColorInput, refs.homeStatsColorPicker, currentSettings.home_stats_color || '#1f2937');
    setChecked(refs.hideHitokotoSwitch, currentSettings.home_hide_hitokoto);
    setValue(refs.homeHitokotoSizeInput, currentSettings.home_hitokoto_size || '14');
    setColorInputs(refs.homeHitokotoColorInput, refs.homeHitokotoColorPicker, currentSettings.home_hitokoto_color || '#6b7280');
    setValue(refs.homeTitleFontInput, currentSettings.home_title_font || '');
    setValue(refs.homeSubtitleFontInput, currentSettings.home_subtitle_font || '');
    setValue(refs.homeStatsFontInput, currentSettings.home_stats_font || '');
    setValue(refs.homeHitokotoFontInput, currentSettings.home_hitokoto_font || '');
    setValue(refs.homeSiteNameInput, currentSettings.home_site_name || '');
    setValue(refs.homeSiteDescriptionInput, currentSettings.home_site_description || '');
    setValue(refs.homeFooterTextInput, currentSettings.home_footer_text || '');
    setValue(refs.homeDefaultCategorySelect, currentSettings.home_default_category || '');
    setChecked(refs.homeRememberLastCategorySwitch, currentSettings.home_remember_last_category);
    setChecked(refs.searchEngineSwitch, currentSettings.home_search_engine_enabled);
    setChecked(refs.frostedGlassSwitch, currentSettings.layout_enable_frosted_glass);
    setRangeValue(refs.frostedGlassIntensityRange, refs.frostedGlassIntensityValue, currentSettings.layout_frosted_glass_intensity || '15');
    updateToggleContainer(refs.frostedGlassSwitch, 'frostedGlassIntensityContainer');
    setValue(refs.customWallpaperInput, currentSettings.layout_custom_wallpaper || '');
    setChecked(refs.bgBlurSwitch, currentSettings.layout_enable_bg_blur);
    setRangeValue(refs.bgBlurIntensityRange, refs.bgBlurIntensityValue, currentSettings.layout_bg_blur_intensity || '0');
    updateToggleContainer(refs.bgBlurSwitch, 'bgBlurIntensityContainer');
    setValue(refs.bingCountrySelect, currentSettings.bing_country || '');
    setRadioValue(refs.gridColsRadios, currentSettings.layout_grid_cols);
    const categoryPosition = normalizeCategoryPosition(
      currentSettings.home_category_position,
      currentSettings.layout_menu_layout
    );
    currentSettings.home_category_position = categoryPosition;
    currentSettings.layout_menu_layout = categoryPosition === 'left' ? 'vertical' : 'horizontal';
    setRadioValue(refs.categoryPositionRadios, categoryPosition);
    setRadioValue(refs.categoryFlowRadios, currentSettings.home_category_flow || 'single_line');
    setValue(refs.cardAnimationSelect, currentSettings.layout_card_animation || 'radial');
    ns.preview?.syncAnimationOptions?.();
    setRangeValue(refs.cardRadiusInput, refs.cardRadiusValue, currentSettings.layout_card_border_radius || '12');
    setValue(refs.cardTitleFontInput, currentSettings.card_title_font || '');
    setValue(refs.cardTitleSizeInput, currentSettings.card_title_size || '16');
    setColorInputs(refs.cardTitleColorInput, refs.cardTitleColorPicker, currentSettings.card_title_color || '#111827');
    setValue(refs.cardDescFontInput, currentSettings.card_desc_font || '');
    setValue(refs.cardDescSizeInput, currentSettings.card_desc_size || '14');
    setColorInputs(refs.cardDescColorInput, refs.cardDescColorPicker, currentSettings.card_desc_color || '');
    setChecked(refs.mobileHideDescSwitch, currentSettings.mobile_layout_hide_desc);
    setChecked(refs.mobileHideLinksSwitch, currentSettings.mobile_layout_hide_links);
    setChecked(refs.mobileHideCategorySwitch, currentSettings.mobile_layout_hide_category);
    setChecked(refs.mobileFrostedGlassSwitch, currentSettings.mobile_layout_enable_frosted_glass);
    setRangeValue(refs.mobileFrostedGlassIntensityRange, refs.mobileFrostedGlassIntensityValue, currentSettings.mobile_layout_frosted_glass_intensity || '15');
    updateToggleContainer(refs.mobileFrostedGlassSwitch, 'mobileFrostedGlassIntensityContainer');
    setRadioValue(refs.mobileGridColsRadios, currentSettings.mobile_layout_grid_cols || '3');
    setValue(refs.mobileCardAnimationSelect, currentSettings.mobile_layout_card_animation || 'radial');
    setRangeValue(refs.mobileCardRadiusInput, refs.mobileCardRadiusValue, currentSettings.mobile_layout_card_border_radius || '12');
    setValue(refs.mobileCardTitleFontInput, currentSettings.mobile_card_title_font || '');
    setValue(refs.mobileCardTitleSizeInput, currentSettings.mobile_card_title_size || '13');
    setColorInputs(refs.mobileCardTitleColorInput, refs.mobileCardTitleColorPicker, currentSettings.mobile_card_title_color || '#111827');
    setValue(refs.mobileCardDescFontInput, currentSettings.mobile_card_desc_font || '');
    setValue(refs.mobileCardDescSizeInput, currentSettings.mobile_card_desc_size || '11');
    setColorInputs(refs.mobileCardDescColorInput, refs.mobileCardDescColorPicker, currentSettings.mobile_card_desc_color || '');

    [
      currentSettings.home_title_font,
      currentSettings.home_subtitle_font,
      currentSettings.home_stats_font,
      currentSettings.home_hitokoto_font,
      currentSettings.card_title_font,
      currentSettings.card_desc_font,
      currentSettings.mobile_card_title_font,
      currentSettings.mobile_card_desc_font,
    ].forEach(font => ns.preview?.loadFont?.(font));

    ns.preview?.selectCardStyle?.(currentSettings.layout_card_style || 'style1');
    ns.preview?.selectMobileCardStyle?.(currentSettings.mobile_layout_card_style || 'style2');
    ns.preview?.updatePreviewCards?.();
    ns.preview?.updatePreviewWidth?.();
  }

  ns.form = {
    getRefs,
    loadCategoryOptions,
    collectSettingsFromInputs,
    updateProviderUI,
    updateUIFromSettings,
    updateToggleContainer,
  };
})();
