// functions/lib/utils.js
// 共用工具函数

import { FONT_MAP } from '../constants';

/**
 * HTML 特殊字符转义
 */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ESCAPE_MAP[c]);
}

/**
 * URL 安全化：严格白名单，仅允许 http/https 协议
 */
export function sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) return '';
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.href;
    } catch {
        return '';
    }
}

/**
 * 排序值归一化
 */
export function normalizeSortOrder(val) {
    const num = Number(val);
    return Number.isFinite(num) ? num : 9999;
}

/**
 * 转义 SQL LIKE 通配符
 */
export function escapeLikePattern(str) {
    return String(str).replace(/[%_\\]/g, c => '\\' + c);
}

/**
 * 为给定 URL 生成 favicon 图标地址
 * @param {string} siteUrl - 站点 URL
 * @param {string} currentLogo - 现有 logo（非空则直接返回）
 * @param {string} iconAPI - favicon API 前缀
 * @returns {string|null}
 */
export function buildFaviconUrl(siteUrl, currentLogo, iconAPI) {
    if (currentLogo && !currentLogo.startsWith('data:image')) return currentLogo;
    if (!siteUrl || !(siteUrl.startsWith('https://') || siteUrl.startsWith('http://'))) return currentLogo || null;
    const domain = siteUrl.replace(/^https?:\/\//, '').split('/')[0];
    return `${iconAPI}${domain}`;
}

/**
 * 构建 style 属性字符串（字体名通过 FONT_MAP 白名单校验）
 * @returns {string} 如 'style="font-size: 16px; color: red;"' 或空字符串
 */
export function getStyleStr(size, color, font) {
    let s = '';
    if (size) s += `font-size: ${size}px;`;
    if (color) s += `color: ${color} !important;`;
    if (font && font in FONT_MAP) s += `font-family: ${font} !important;`;
    return s ? `style="${s}"` : '';
}
