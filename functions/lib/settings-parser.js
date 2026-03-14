// functions/lib/settings-parser.js
// 从 DB 查询结果解析设置值为结构化对象

// 设置字段定义：{ key: { default, type } }
// type: 'bool' | 'string' | 'boolOrOne'（支持 'true' 和 '1' 两种写法）
const SETTINGS_SCHEMA = {
    layout_hide_desc: { default: false, type: 'bool' },
    layout_hide_links: { default: false, type: 'bool' },
    layout_hide_category: { default: false, type: 'bool' },
    layout_hide_title: { default: false, type: 'bool' },
    home_title_size: { default: '', type: 'string' },
    home_title_color: { default: '', type: 'string' },
    layout_hide_subtitle: { default: false, type: 'bool' },
    home_subtitle_size: { default: '', type: 'string' },
    home_subtitle_color: { default: '', type: 'string' },
    home_hide_stats: { default: false, type: 'bool' },
    home_stats_size: { default: '', type: 'string' },
    home_stats_color: { default: '', type: 'string' },
    home_hide_hitokoto: { default: false, type: 'bool' },
    home_hitokoto_size: { default: '', type: 'string' },
    home_hitokoto_color: { default: '', type: 'string' },
    home_hide_github: { default: false, type: 'boolOrOne' },
    home_hide_admin: { default: false, type: 'boolOrOne' },
    home_custom_font_url: { default: '', type: 'string' },
    home_title_font: { default: '', type: 'string' },
    home_subtitle_font: { default: '', type: 'string' },
    home_stats_font: { default: '', type: 'string' },
    home_hitokoto_font: { default: '', type: 'string' },
    home_site_name: { default: '', type: 'string' },
    home_site_description: { default: '', type: 'string' },
    home_search_engine_enabled: { default: false, type: 'bool' },
    home_default_category: { default: '', type: 'string' },
    home_remember_last_category: { default: false, type: 'bool' },
    layout_grid_cols: { default: '4', type: 'string' },
    layout_custom_wallpaper: { default: '', type: 'string' },
    layout_menu_layout: { default: 'horizontal', type: 'string' },
    bing_country: { default: '', type: 'string' },
    layout_enable_frosted_glass: { default: false, type: 'bool' },
    layout_frosted_glass_intensity: { default: '15', type: 'string' },
    layout_enable_bg_blur: { default: false, type: 'bool' },
    layout_bg_blur_intensity: { default: '0', type: 'string' },
    layout_card_style: { default: 'style1', type: 'string' },
    layout_card_border_radius: { default: '12', type: 'string' },
    wallpaper_source: { default: 'bing', type: 'string' },
    wallpaper_cid_360: { default: '36', type: 'string' },
    card_title_font: { default: '', type: 'string' },
    card_title_size: { default: '', type: 'string' },
    card_title_color: { default: '', type: 'string' },
    card_desc_font: { default: '', type: 'string' },
    card_desc_size: { default: '', type: 'string' },
    card_desc_color: { default: '', type: 'string' },
};

/**
 * 返回所有设置的 key 列表（用于 SQL 查询）
 */
export function getSettingsKeys() {
    return Object.keys(SETTINGS_SCHEMA);
}

// 类型转换映射
const TYPE_CONVERTERS = {
    bool: v => v === 'true',
    boolOrOne: v => v === 'true' || v === '1',
    string: v => v,
};

/**
 * 将 DB 查询结果解析为结构化设置对象
 * @param {Array} dbResults - 数据库查询结果 [{ key, value }, ...]
 * @returns {object} 键值对对象，布尔值已转换
 */
export function parseSettings(dbResults) {
    // 将 DB 结果构建为 Map 以便 O(1) 查找
    const dbMap = new Map();
    if (dbResults && Array.isArray(dbResults)) {
        for (const row of dbResults) {
            dbMap.set(row.key, row.value);
        }
    }

    const settings = {};
    for (const [key, schema] of Object.entries(SETTINGS_SCHEMA)) {
        const dbValue = dbMap.get(key);
        if (dbValue !== undefined) {
            settings[key] = TYPE_CONVERTERS[schema.type](dbValue);
        } else {
            settings[key] = schema.default;
        }
    }

    return settings;
}
