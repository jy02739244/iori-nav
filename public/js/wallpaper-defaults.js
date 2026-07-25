/**
 * 自动生成，请勿手改。
 * 源文件: functions/lib/wallpaper-defaults.js
 * 由 scripts/update-versions.js 同步生成
 */
(function (global) {
  const STYLE_DEFAULT_WALLPAPERS = {
  style1: 'https://img.peapix.com/dc6e559cacb14f9c83b46d5a7f189bab_1920.jpg',
  style2: 'https://img.peapix.com/1f4688b7a0d64bda9c508f9498b04f49_1920.jpg',
  style3: 'https://main.ssss.nyc.mn/background.webp',
};

  function getStyleDefaultWallpaper(cardStyle) {
    return STYLE_DEFAULT_WALLPAPERS[cardStyle] || STYLE_DEFAULT_WALLPAPERS.style1;
  }

  function resolveWallpaperUrl(customWallpaper, cardStyle) {
    const custom = String(customWallpaper || '').trim();
    return custom || getStyleDefaultWallpaper(cardStyle || 'style1');
  }

  global.IoriWallpaperDefaults = {
    STYLE_DEFAULT_WALLPAPERS: STYLE_DEFAULT_WALLPAPERS,
    getStyleDefaultWallpaper: getStyleDefaultWallpaper,
    resolveWallpaperUrl: resolveWallpaperUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
