(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};

  const BOOLEAN_FIELDS = [
    'layout_hide_desc',
    'layout_hide_links',
    'layout_hide_category',
    'layout_hide_title',
    'layout_hide_subtitle',
    'home_hide_stats',
    'home_hide_hitokoto',
    'home_hide_admin',
    'home_search_engine_enabled',
    'home_remember_last_category',
    'layout_enable_frosted_glass',
    'layout_enable_bg_blur',
    'mobile_layout_hide_desc',
    'mobile_layout_hide_links',
    'mobile_layout_hide_category',
    'mobile_layout_enable_frosted_glass',
  ];

  const TRUTHY_STRING_FIELDS = [
    'provider',
    'baseUrl',
    'model',
    'home_title_size',
    'home_title_color',
    'home_subtitle_size',
    'home_subtitle_color',
    'home_stats_size',
    'home_stats_color',
    'home_hitokoto_size',
    'home_hitokoto_color',
    'home_title_font',
    'home_subtitle_font',
    'home_stats_font',
    'home_hitokoto_font',
    'home_site_name',
    'home_site_description',
    'home_footer_text',
    'home_default_category',
    'home_category_position',
    'home_category_flow',
    'layout_frosted_glass_intensity',
    'layout_grid_cols',
    'layout_custom_wallpaper',
    'layout_menu_layout',
    'layout_bg_blur_intensity',
    'wallpaper_source',
    'wallpaper_cid_360',
    'layout_card_style',
    'layout_card_animation',
    'layout_card_border_radius',
    'card_title_font',
    'card_title_size',
    'card_title_color',
    'card_desc_font',
    'card_desc_size',
    'card_desc_color',
    'mobile_layout_frosted_glass_intensity',
    'mobile_layout_grid_cols',
    'mobile_layout_card_style',
    'mobile_layout_card_animation',
    'mobile_layout_card_border_radius',
    'mobile_card_title_font',
    'mobile_card_title_size',
    'mobile_card_title_color',
    'mobile_card_desc_font',
    'mobile_card_desc_size',
    'mobile_card_desc_color',
  ];

  const MOBILE_FALLBACK_FIELDS = [
    ['mobile_layout_hide_category', 'layout_hide_category'],
    ['mobile_layout_enable_frosted_glass', 'layout_enable_frosted_glass'],
    ['mobile_layout_frosted_glass_intensity', 'layout_frosted_glass_intensity'],
    ['mobile_layout_card_animation', 'layout_card_animation'],
    ['mobile_layout_card_border_radius', 'layout_card_border_radius'],
    ['mobile_card_title_font', 'card_title_font'],
    ['mobile_card_title_color', 'card_title_color'],
    ['mobile_card_desc_font', 'card_desc_font'],
    ['mobile_card_desc_color', 'card_desc_color'],
  ];

  function createDefaultSettings() {
    return {
      provider: 'workers-ai',
      apiKey: '',
      baseUrl: '',
      model: '@cf/meta/llama-3-8b-instruct',
      has_api_key: false,
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
      home_hide_admin: false,
      home_search_engine_enabled: false,
      home_default_category: '',
      home_remember_last_category: false,
      home_title_font: '',
      home_subtitle_font: '',
      home_stats_font: '',
      home_hitokoto_font: '',
      home_site_name: '',
      home_site_description: '',
      home_footer_text: '',
      home_category_position: 'below_search',
      home_category_flow: 'single_line',
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
      layout_card_animation: 'radial',
      layout_card_border_radius: '12',
      card_title_font: '',
      card_title_size: '16',
      card_title_color: '',
      card_desc_font: '',
      card_desc_size: '14',
      card_desc_color: '',
      mobile_layout_hide_desc: true,
      mobile_layout_hide_links: true,
      mobile_layout_hide_category: false,
      mobile_layout_enable_frosted_glass: false,
      mobile_layout_frosted_glass_intensity: '15',
      mobile_layout_grid_cols: '3',
      mobile_layout_card_style: 'style2',
      mobile_layout_card_animation: 'radial',
      mobile_layout_card_border_radius: '12',
      mobile_card_title_font: '',
      mobile_card_title_size: '13',
      mobile_card_title_color: '',
      mobile_card_desc_font: '',
      mobile_card_desc_size: '11',
      mobile_card_desc_color: '',
    };
  }

  const currentSettings = ns.currentSettings || createDefaultSettings();
  ns.currentSettings = currentSettings;

  function parseBool(value) {
    return value === true || value === 'true' || value === '1';
  }

  function normalizeCategoryPosition(position, menuLayout) {
    if (position === 'above_description') return 'top';
    if (['below_search', 'above_search', 'left', 'top'].includes(position)) return position;
    return menuLayout === 'vertical' ? 'left' : 'below_search';
  }

  function applyServerSettings(serverSettings, targetSettings = currentSettings) {
    if (!serverSettings) return targetSettings;

    if (serverSettings.provider) targetSettings.provider = serverSettings.provider;
    targetSettings.has_api_key = !!serverSettings.has_api_key;
    if (serverSettings.apiKey) targetSettings.apiKey = serverSettings.apiKey;

    BOOLEAN_FIELDS.forEach(field => {
      if (serverSettings[field] !== undefined) {
        targetSettings[field] = parseBool(serverSettings[field]);
      }
    });

    TRUTHY_STRING_FIELDS.forEach(field => {
      if (serverSettings[field]) {
        targetSettings[field] = serverSettings[field];
      }
    });

    if (serverSettings.bing_country !== undefined) {
      targetSettings.bing_country = serverSettings.bing_country;
    }

    if (serverSettings.home_category_position === undefined && serverSettings.layout_menu_layout === 'vertical') {
      targetSettings.home_category_position = 'left';
      targetSettings.layout_menu_layout = 'vertical';
    } else {
      const categoryPosition = normalizeCategoryPosition(
        targetSettings.home_category_position,
        targetSettings.layout_menu_layout
      );
      targetSettings.home_category_position = categoryPosition;
      targetSettings.layout_menu_layout = categoryPosition === 'left' ? 'vertical' : 'horizontal';
    }

    MOBILE_FALLBACK_FIELDS.forEach(([mobileKey, desktopKey]) => {
      if (serverSettings[mobileKey] === undefined) {
        targetSettings[mobileKey] = targetSettings[desktopKey];
      }
    });

    if (serverSettings.mobile_layout_grid_cols === undefined) {
      targetSettings.mobile_layout_grid_cols = '3';
    }

    return targetSettings;
  }

  ns.defaults = {
    createDefaultSettings,
    parseBool,
    normalizeCategoryPosition,
    applyServerSettings,
  };
})();
