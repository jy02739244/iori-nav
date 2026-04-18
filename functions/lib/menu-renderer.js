// functions/lib/menu-renderer.js
// 渲染分类菜单 HTML（水平 + 垂直）

import { escapeHTML } from './utils';

/**
 * 渲染水平导航菜单
 * @param {Array} cats - 分类树
 * @param {string} currentCatalogName - 当前选中的分类名
 * @returns {string} HTML 字符串
 */
export function renderHorizontalMenu(cats, currentCatalogName) {
    if (!cats || cats.length === 0) return '';
    return _renderHorizontalItems(cats, currentCatalogName, 0);
}

function _renderHorizontalItems(cats, currentCatalogName, level) {
    return cats.map(cat => {
        const isActive = currentCatalogName === cat.catelog;
        const hasChildren = cat.children && cat.children.length > 0;
        const safeName = escapeHTML(cat.catelog);
        const encodedName = encodeURIComponent(cat.catelog);
        const linkUrl = `?catalog=${encodedName}`;

        const isRoot = level === 0;
        const activeClass = isActive ? 'active' : (isRoot ? 'inactive' : '');
        const navItemActiveClass = isActive ? 'nav-item-active' : '';
        const wrapperClass = isRoot ? 'menu-item-wrapper relative inline-block text-left' : 'menu-item-wrapper relative block w-full';
        const linkClass = isRoot ? `nav-btn ${activeClass} ${navItemActiveClass}` : `dropdown-item ${activeClass} ${navItemActiveClass}`;
        const arrowSvg = hasChildren
            ? (isRoot
                ? '<svg class="w-3 h-3 ml-1 opacity-70"><use href="#icon-chevron-down"/></svg>'
                : '<svg class="dropdown-arrow-icon"><use href="#icon-chevron-right"/></svg>')
            : '';
        const childrenHtml = hasChildren ? `<div class="dropdown-menu">${_renderHorizontalItems(cat.children, currentCatalogName, level + 1)}</div>` : '';

        return `<div class="${wrapperClass}"><a href="${linkUrl}" class="${linkClass}" data-id="${cat.id}">${safeName}${arrowSvg}</a>${childrenHtml}</div>`;
    }).join('');
}

/**
 * 渲染垂直侧边栏菜单
 * @param {Array} cats - 分类树
 * @param {string} currentCatalogName - 当前选中的分类名
 * @param {boolean} isCustomWallpaper - 是否使用自定义壁纸
 * @returns {string} HTML 字符串
 */
export function renderVerticalMenu(cats, currentCatalogName, isCustomWallpaper) {
    return _renderVerticalItems(cats, currentCatalogName, isCustomWallpaper, 0);
}

function _renderVerticalItems(cats, currentCatalogName, isCustomWallpaper, level) {
    return cats.map(cat => {
        const safeName = escapeHTML(cat.catelog);
        const encodedName = encodeURIComponent(cat.catelog);
        const isActive = currentCatalogName === cat.catelog;

        const baseClass = "flex items-center px-3 py-2 rounded-lg w-full transition-colors duration-200";
        const activeClass = isActive
            ? "bg-secondary-100 text-primary-700 dark:bg-gray-800 dark:text-primary-400"
            : "hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
        const defaultIconColor = isCustomWallpaper ? "text-gray-600" : "text-gray-400 dark:text-gray-500";
        const iconClass = isActive ? "text-primary-600 dark:text-primary-400" : defaultIconColor;
        const indent = level * 12;

        let html = `
      <a href="?catalog=${encodedName}" data-id="${cat.id}" class="${baseClass} ${activeClass}" style="padding-left: ${12 + indent}px">
          <svg class="h-5 w-5 mr-2 ${iconClass}"><use href="#icon-folder"/></svg>
          ${safeName}
      </a>`;

        if (cat.children && cat.children.length > 0) {
            html += _renderVerticalItems(cat.children, currentCatalogName, isCustomWallpaper, level + 1);
        }
        return html;
    }).join('');
}
