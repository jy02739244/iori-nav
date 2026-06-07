// functions/lib/settings-parser.js
// 从 DB 查询结果解析设置值为结构化对象

import { FONT_MAP } from '../constants';
import { sanitizeStyleColor, sanitizeStyleSize, sanitizeUrl } from './utils';

// 设置字段定义：{ key: { default, type } }
// type: 'bool' | 'string' | 'boolOrOne'（支持 'true' 和 '1' 两种写法）
export const SETTINGS_SCHEMA = {
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
    home_hide_admin: { default: false, type: 'boolOrOne' },
    home_custom_font_url: { default: '', type: 'string' },
    home_title_font: { default: '', type: 'string' },
    home_subtitle_font: { default: '', type: 'string' },
    home_stats_font: { default: '', type: 'string' },
    home_hitokoto_font: { default: '', type: 'string' },
    home_site_name: { default: '', type: 'string' },
    home_site_description: { default: '', type: 'string' },
    home_footer_text: { default: '', type: 'string' },
    home_search_engine_enabled: { default: false, type: 'bool' },
    home_default_category: { default: '', type: 'string' },
    home_remember_last_category: { default: false, type: 'bool' },
    home_category_position: { default: 'below_search', type: 'string' },
    home_category_flow: { default: 'single_line', type: 'string' },
    layout_grid_cols: { default: '4', type: 'string' },
    layout_custom_wallpaper: { default: '', type: 'string' },
    layout_menu_layout: { default: 'horizontal', type: 'string' },
    bing_country: { default: '', type: 'string' },
    layout_enable_frosted_glass: { default: false, type: 'bool' },
    layout_frosted_glass_intensity: { default: '15', type: 'string' },
    layout_enable_bg_blur: { default: false, type: 'bool' },
    layout_bg_blur_intensity: { default: '0', type: 'string' },
    layout_card_style: { default: 'style1', type: 'string' },
    layout_card_animation: { default: 'radial', type: 'string' },
    layout_card_border_radius: { default: '12', type: 'string' },
    mobile_layout_hide_desc: { default: true, type: 'bool' },
    mobile_layout_hide_links: { default: true, type: 'bool' },
    mobile_layout_hide_category: { default: false, type: 'bool' },
    mobile_layout_enable_frosted_glass: { default: false, type: 'bool' },
    mobile_layout_frosted_glass_intensity: { default: '15', type: 'string' },
    mobile_layout_grid_cols: { default: '3', type: 'string' },
    mobile_layout_card_style: { default: 'style2', type: 'string' },
    mobile_layout_card_animation: { default: 'radial', type: 'string' },
    mobile_layout_card_border_radius: { default: '12', type: 'string' },
    mobile_card_title_font: { default: '', type: 'string' },
    mobile_card_title_size: { default: '13', type: 'string' },
    mobile_card_title_color: { default: '', type: 'string' },
    mobile_card_desc_font: { default: '', type: 'string' },
    mobile_card_desc_size: { default: '11', type: 'string' },
    mobile_card_desc_color: { default: '', type: 'string' },
    wallpaper_source: { default: 'bing', type: 'string' },
    wallpaper_cid_360: { default: '36', type: 'string' },
    card_title_font: { default: '', type: 'string' },
    card_title_size: { default: '16', type: 'string' },
    card_title_color: { default: '', type: 'string' },
    card_desc_font: { default: '', type: 'string' },
    card_desc_size: { default: '14', type: 'string' },
    card_desc_color: { default: '', type: 'string' },
};

const STYLE_SIZE_KEYS = new Set([
    'home_title_size',
    'home_subtitle_size',
    'home_stats_size',
    'home_hitokoto_size',
    'card_title_size',
    'card_desc_size',
    'mobile_card_title_size',
    'mobile_card_desc_size',
]);

const STYLE_COLOR_KEYS = new Set([
    'home_title_color',
    'home_subtitle_color',
    'home_stats_color',
    'home_hitokoto_color',
    'card_title_color',
    'card_desc_color',
    'mobile_card_title_color',
    'mobile_card_desc_color',
]);

const FONT_KEYS = new Set([
    'home_title_font',
    'home_subtitle_font',
    'home_stats_font',
    'home_hitokoto_font',
    'card_title_font',
    'card_desc_font',
    'mobile_card_title_font',
    'mobile_card_desc_font',
]);

const URL_KEYS = new Set([
    'home_custom_font_url',
    'layout_custom_wallpaper',
]);

function normalizeParsedCategoryPosition(position, menuLayout) {
    if (position === 'above_description') return 'top';
    if (['below_search', 'above_search', 'left', 'top'].includes(position)) return position;
    return menuLayout === 'vertical' ? 'left' : 'below_search';
}

function normalizeBoolean(value) {
    if (value === true || value === false) return String(value);
    const text = String(value ?? '').trim().toLowerCase();
    if (text === 'true' || text === '1') return 'true';
    if (text === 'false' || text === '0' || text === '') return 'false';
    return null;
}

function normalizeIntegerRange(value, min, max, fallback = '') {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    const num = Number(text);
    if (!Number.isInteger(num) || num < min || num > max) return null;
    return String(num);
}

function isEmptyOptionalValue(text) {
    const normalized = String(text ?? '').trim().toLowerCase();
    return normalized === '' || normalized === 'undefined' || normalized === 'null';
}

/**
 * 校验并归一化可写入 settings 表的公开设置值
 * @returns {{ok: true, value: string} | {ok: false, message: string}}
 */
export function normalizeSettingValueForStorage(key, value) {
    const schema = SETTINGS_SCHEMA[key];
    if (!schema) {
        return { ok: false, message: `Unknown setting key: ${key}` };
    }

    if (schema.type === 'bool' || schema.type === 'boolOrOne') {
        const normalized = normalizeBoolean(value);
        if (normalized === null) {
            return { ok: false, message: `Invalid boolean value for ${key}` };
        }
        return { ok: true, value: normalized };
    }

    const text = String(value ?? '').trim();

    if (STYLE_SIZE_KEYS.has(key)) {
        if (isEmptyOptionalValue(text)) return { ok: true, value: '' };
        const safeSize = sanitizeStyleSize(text);
        if (!safeSize) {
            return { ok: false, message: `Invalid font size for ${key}` };
        }
        return { ok: true, value: safeSize };
    }

    if (STYLE_COLOR_KEYS.has(key)) {
        if (isEmptyOptionalValue(text)) return { ok: true, value: '' };
        const safeColor = sanitizeStyleColor(text);
        if (!safeColor) {
            return { ok: false, message: `Invalid color value for ${key}` };
        }
        return { ok: true, value: safeColor };
    }

    if (FONT_KEYS.has(key)) {
        if (isEmptyOptionalValue(text)) return { ok: true, value: '' };
        if (!(text in FONT_MAP)) {
            return { ok: false, message: `Invalid font for ${key}` };
        }
        return { ok: true, value: text };
    }

    if (URL_KEYS.has(key)) {
        if (isEmptyOptionalValue(text)) return { ok: true, value: '' };
        const safeUrl = sanitizeUrl(text);
        if (!safeUrl) {
            return { ok: false, message: `Invalid URL for ${key}` };
        }
        return { ok: true, value: safeUrl };
    }

    if (key === 'layout_grid_cols' && !['4', '5', '6', '7'].includes(text)) {
        return { ok: false, message: 'Invalid layout_grid_cols' };
    }

    if (key === 'mobile_layout_grid_cols' && !['1', '2', '3'].includes(text)) {
        return { ok: false, message: 'Invalid mobile_layout_grid_cols' };
    }

    if (key === 'layout_menu_layout' && !['horizontal', 'vertical'].includes(text)) {
        return { ok: false, message: 'Invalid layout_menu_layout' };
    }

    if (key === 'home_category_position' && text === 'above_description') {
        return { ok: true, value: 'top' };
    }

    if (key === 'home_category_position' && !['below_search', 'above_search', 'left', 'top'].includes(text)) {
        return { ok: false, message: 'Invalid home_category_position' };
    }

    if (key === 'home_category_flow' && !['single_line', 'multi_line'].includes(text)) {
        return { ok: false, message: 'Invalid home_category_flow' };
    }

    if (key === 'layout_card_style' && !['style1', 'style2'].includes(text)) {
        return { ok: false, message: 'Invalid layout_card_style' };
    }

    if (key === 'mobile_layout_card_style' && !['style1', 'style2'].includes(text)) {
        return { ok: false, message: 'Invalid mobile_layout_card_style' };
    }

    if (key === 'layout_card_animation' && !['radial', 'slideUp', 'fadeIn', 'slideLeft', 'slideRight', 'convergeIn', 'flipIn', 'random'].includes(text)) {
        return { ok: false, message: 'Invalid layout_card_animation' };
    }

    if (key === 'mobile_layout_card_animation' && !['radial', 'slideUp', 'fadeIn', 'slideLeft', 'slideRight', 'convergeIn', 'flipIn', 'random'].includes(text)) {
        return { ok: false, message: 'Invalid mobile_layout_card_animation' };
    }

    if (key === 'wallpaper_source' && !['bing', '360'].includes(text)) {
        return { ok: false, message: 'Invalid wallpaper_source' };
    }

    if (key === 'bing_country' && !['', 'spotlight'].includes(text)) {
        return { ok: false, message: 'Invalid bing_country' };
    }

    if (key === 'layout_frosted_glass_intensity') {
        const normalized = normalizeIntegerRange(text, 0, 50, '15');
        return normalized === null ? { ok: false, message: `Invalid ${key}` } : { ok: true, value: normalized };
    }

    if (key === 'mobile_layout_frosted_glass_intensity') {
        const normalized = normalizeIntegerRange(text, 0, 50, '15');
        return normalized === null ? { ok: false, message: `Invalid ${key}` } : { ok: true, value: normalized };
    }

    if (key === 'layout_bg_blur_intensity') {
        const normalized = normalizeIntegerRange(text, 0, 50, '0');
        return normalized === null ? { ok: false, message: `Invalid ${key}` } : { ok: true, value: normalized };
    }

    if (key === 'layout_card_border_radius') {
        const normalized = normalizeIntegerRange(text, 0, 30, '12');
        return normalized === null ? { ok: false, message: `Invalid ${key}` } : { ok: true, value: normalized };
    }

    if (key === 'mobile_layout_card_border_radius') {
        const normalized = normalizeIntegerRange(text, 0, 30, '12');
        return normalized === null ? { ok: false, message: `Invalid ${key}` } : { ok: true, value: normalized };
    }

    if (key === 'wallpaper_cid_360' && text && !/^\d{1,8}$/.test(text)) {
        return { ok: false, message: 'Invalid wallpaper_cid_360' };
    }

    if (text.length > 2000) {
        return { ok: false, message: `Setting value too long for ${key}` };
    }

    return { ok: true, value: text };
}

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

    if (!dbMap.has('home_category_position') && settings.layout_menu_layout === 'vertical') {
        settings.home_category_position = 'left';
    } else {
        settings.home_category_position = normalizeParsedCategoryPosition(
            settings.home_category_position,
            settings.layout_menu_layout
        );
    }
    settings.layout_menu_layout = settings.home_category_position === 'left' ? 'vertical' : 'horizontal';

    const mobileFallbackKeys = [
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
    for (const [mobileKey, desktopKey] of mobileFallbackKeys) {
        if (!dbMap.has(mobileKey)) {
            settings[mobileKey] = settings[desktopKey];
        }
    }

    settings.card_title_size = settings.card_title_size || SETTINGS_SCHEMA.card_title_size.default;
    settings.card_desc_size = settings.card_desc_size || SETTINGS_SCHEMA.card_desc_size.default;
    settings.mobile_card_title_size = settings.mobile_card_title_size || SETTINGS_SCHEMA.mobile_card_title_size.default;
    settings.mobile_card_desc_size = settings.mobile_card_desc_size || SETTINGS_SCHEMA.mobile_card_desc_size.default;

    return settings;
}
