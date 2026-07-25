// functions/lib/wallpaper-defaults.js
// 各卡片风格的默认壁纸（唯一数据源）
// 前台 public/js/wallpaper-defaults.js 由 scripts/update-versions.js 从此文件同步生成，请勿手改前台副本。

export const STYLE_DEFAULT_WALLPAPERS = {
  style1: 'https://img.peapix.com/dc6e559cacb14f9c83b46d5a7f189bab_1920.jpg',
  style2: 'https://img.peapix.com/1f4688b7a0d64bda9c508f9498b04f49_1920.jpg',
  style3: 'https://main.ssss.nyc.mn/background.webp',
};

/**
 * 获取卡片风格对应的默认壁纸 URL
 * @param {string} cardStyle
 * @returns {string}
 */
export function getStyleDefaultWallpaper(cardStyle = 'style1') {
  return STYLE_DEFAULT_WALLPAPERS[cardStyle] || STYLE_DEFAULT_WALLPAPERS.style1;
}

/**
 * 解析最终壁纸 URL：自定义优先，否则使用风格默认壁纸
 * @param {string} customWallpaper
 * @param {string} cardStyle
 * @returns {string}
 */
export function resolveWallpaperUrl(customWallpaper = '', cardStyle = 'style1') {
  const custom = String(customWallpaper || '').trim();
  return custom || getStyleDefaultWallpaper(cardStyle);
}
