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

function getUrlAuthority(parsed) {
    const auth = (parsed.username || parsed.password)
        ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
        : '';
    return `${parsed.protocol}//${auth}${parsed.host}`;
}

/**
 * 书签 URL 存储规范化：保留路径语义，仅将根路径 URL 规范为不带结尾斜杠
 */
export function normalizeUrlForStorage(url) {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return '';

    try {
        const parsed = new URL(safeUrl);
        if (parsed.pathname === '/') {
            return `${getUrlAuthority(parsed)}${parsed.search}${parsed.hash}`;
        }
        return parsed.href;
    } catch {
        return '';
    }
}

/**
 * 生成 URL 查重候选，兼容根路径历史数据中带/不带结尾斜杠的两种形式
 */
export function getUrlMatchCandidates(url) {
    const rawUrl = String(url ?? '').trim();
    const normalizedUrl = normalizeUrlForStorage(rawUrl);
    if (!normalizedUrl) return [];

    const candidates = new Set([normalizedUrl]);
    const safeUrl = sanitizeUrl(rawUrl);
    if (safeUrl) candidates.add(safeUrl);
    if (rawUrl) candidates.add(rawUrl);

    try {
        const parsed = new URL(safeUrl || normalizedUrl);
        if (parsed.pathname === '/') {
            const authority = getUrlAuthority(parsed);
            candidates.add(`${authority}${parsed.search}${parsed.hash}`);
            candidates.add(`${authority}/${parsed.search}${parsed.hash}`);
        }
    } catch {
        // normalizedUrl 已经过 sanitizeUrl 校验，这里仅做防御
    }

    return [...candidates].filter(Boolean);
}

/**
 * 安全化字体大小：仅允许有限范围内的 px 数值
 */
export function sanitizeStyleSize(size, options = {}) {
    if (size === null || size === undefined || size === '') return '';
    const min = options.min ?? 8;
    const max = options.max ?? 96;
    const value = Number(String(size).trim());
    if (!Number.isFinite(value) || value < min || value > max) return '';
    return String(Math.round(value * 100) / 100);
}

/**
 * 安全化颜色值：允许 hex / rgb() / rgba()，拒绝包含 CSS 注入风险的表达式
 */
export function sanitizeStyleColor(color) {
    if (!color) return '';
    const value = String(color).trim();
    if (!value) return '';
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'undefined' || lowerValue === 'null') return '';

    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
        return value;
    }

    // CSS named colors and global keywords are identifier-only, so they cannot
    // break out of the declaration the way semicolons/functions can.
    if (/^[a-z][a-z0-9-]{0,31}$/i.test(value)) {
        return value;
    }

    const rgbMatch = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
    if (!rgbMatch) return '';

    const channels = rgbMatch.slice(1, 4).map(Number);
    if (channels.some(channel => channel < 0 || channel > 255)) return '';
    if (value.toLowerCase().startsWith('rgba') && rgbMatch[4] === undefined) return '';

    return value;
}

/**
 * 解析分页参数，防止 NaN/负数传入 LIMIT/OFFSET
 */
export function parsePagination(searchParams, options = {}) {
    const defaultPage = options.defaultPage ?? 1;
    const defaultPageSize = options.defaultPageSize ?? 10;
    const maxPageSize = options.maxPageSize ?? 200;

    const requestedPage = parseInt(searchParams.get('page') || String(defaultPage), 10);
    const requestedPageSize = parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10);

    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : defaultPage;
    const rawPageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? requestedPageSize
        : defaultPageSize;
    const pageSize = Math.min(rawPageSize, maxPageSize);

    return {
        page,
        pageSize,
        offset: (page - 1) * pageSize,
    };
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
    try {
        const domain = new URL(siteUrl).host;
        return `${iconAPI}${domain}`;
    } catch {
        return currentLogo || null;
    }
}

/**
 * 构建 style 属性字符串（字体名通过 FONT_MAP 白名单校验）
 * @returns {string} 如 'style="font-size: 16px; color: red;"' 或空字符串
 */
export function getStyleStr(size, color, font) {
    let s = '';
    const safeSize = sanitizeStyleSize(size);
    const safeColor = sanitizeStyleColor(color);
    if (safeSize) s += `font-size: ${safeSize}px;`;
    if (safeColor) s += `color: ${safeColor} !important;`;
    if (font && font in FONT_MAP) s += `font-family: ${font} !important;`;
    return s ? `style="${s}"` : '';
}
