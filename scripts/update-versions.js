/**
 * 自动更新 CSS/JS 文件的版本号
 * 
 * 工作原理：
 * 1. 计算每个 CSS/JS 文件的内容 MD5 哈希
 * 2. 取哈希的前 8 位作为版本号
 * 3. 更新 HTML 文件中对应的 ?v=xxx 参数
 * 
 * 使用方式：
 * - 自动：通过 Git pre-commit hook 触发
 * - 手动：node scripts/update-versions.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 项目根目录
const ROOT_DIR = path.resolve(__dirname, '..');

// 需要处理的 HTML 文件及其资源映射
const HTML_FILES = {
  'public/index.html': [
    { file: 'public/css/style.css', pattern: /\/css\/style\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/tailwind.min.css', pattern: /\/css\/tailwind\.min\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/home-ui.js', pattern: /\/js\/home-ui\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/home-cards.js', pattern: /\/js\/home-cards\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/home-submit.js', pattern: /\/js\/home-submit\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/home-search.js', pattern: /\/js\/home-search\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/home-category-nav.js', pattern: /\/js\/home-category-nav\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/main.js', pattern: /\/js\/main\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/favicon.svg', pattern: /\/favicon\.svg\?v=[a-zA-Z0-9]+/ },
  ],
  'public/admin/index.html': [
    { file: 'public/css/admin-layout.css', pattern: /\/css\/admin-layout\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-forms.css', pattern: /\/css\/admin-forms\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-card-options.css', pattern: /\/css\/admin-card-options\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-preview-shell.css', pattern: /\/css\/admin-preview-shell\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-preview-controls.css', pattern: /\/css\/admin-preview-controls\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-preview-cards.css', pattern: /\/css\/admin-preview-cards\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-settings-modal.css', pattern: /\/css\/admin-settings-modal\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-card-preview.css', pattern: /\/css\/admin-card-preview\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-feedback.css', pattern: /\/css\/admin-feedback\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/admin-dropdown.css', pattern: /\/css\/admin-dropdown\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/css/tailwind.min.css', pattern: /\/css\/tailwind\.min\.css\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-shared.js', pattern: /\/js\/admin-shared\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-cache.js', pattern: /\/js\/admin-cache\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-bookmark-list.js', pattern: /\/js\/admin-bookmark-list\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-pending.js', pattern: /\/js\/admin-pending\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-tabs.js', pattern: /\/js\/admin-tabs\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-bookmark-privacy.js', pattern: /\/js\/admin-bookmark-privacy\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin.js', pattern: /\/js\/admin\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-categories.js', pattern: /\/js\/admin-categories\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-bookmarks.js', pattern: /\/js\/admin-bookmarks\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-batch.js', pattern: /\/js\/admin-batch\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-defaults.js', pattern: /\/js\/admin-settings-defaults\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/wallpaper-defaults.js', pattern: /\/js\/wallpaper-defaults\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-form.js', pattern: /\/js\/admin-settings-form\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-core.js', pattern: /\/js\/admin-settings-core\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview-shared.js', pattern: /\/js\/admin-settings-preview-shared\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview-data.js', pattern: /\/js\/admin-settings-preview-data\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview-nav.js', pattern: /\/js\/admin-settings-preview-nav\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview-animation.js', pattern: /\/js\/admin-settings-preview-animation\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview-render.js', pattern: /\/js\/admin-settings-preview-render\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview-controls.js', pattern: /\/js\/admin-settings-preview-controls\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-preview.js', pattern: /\/js\/admin-settings-preview\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-wallpaper.js', pattern: /\/js\/admin-settings-wallpaper\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings-ai.js', pattern: /\/js\/admin-settings-ai\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-settings.js', pattern: /\/js\/admin-settings\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/js/admin-import-export.js', pattern: /\/js\/admin-import-export\.js\?v=[a-zA-Z0-9]+/ },
    { file: 'public/favicon.svg', pattern: /\/favicon\.svg\?v=[a-zA-Z0-9]+/ },
  ]
};

/**
 * 计算文件内容的 MD5 哈希（取前 8 位）
 */
function getFileHash(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️  文件不存在: ${filePath}`);
    return null;
  }
  
  const content = fs.readFileSync(fullPath);
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * 从文件路径生成替换字符串
 * 例如: public/css/style.css -> /css/style.css?v=abc12345
 */
function buildReplacement(filePath, hash) {
  // 移除 public/ 前缀
  const urlPath = filePath.replace(/^public/, '');
  return `${urlPath}?v=${hash}`;
}


/**
 * 将 functions/lib/wallpaper-defaults.js 同步为前台 public/js/wallpaper-defaults.js
 * 保证默认壁纸 URL 只有一处手改源。
 */
function syncWallpaperDefaults() {
  const srcPath = path.join(ROOT_DIR, 'functions/lib/wallpaper-defaults.js');
  const outPath = path.join(ROOT_DIR, 'public/js/wallpaper-defaults.js');
  if (!fs.existsSync(srcPath)) {
    console.warn('  ⚠️  缺少 functions/lib/wallpaper-defaults.js，跳过壁纸默认值同步');
    return;
  }

  const src = fs.readFileSync(srcPath, 'utf8');
  const match = src.match(/export const STYLE_DEFAULT_WALLPAPERS = \{[\s\S]*?\n\};/);
  if (!match) {
    throw new Error('无法从 functions/lib/wallpaper-defaults.js 解析 STYLE_DEFAULT_WALLPAPERS');
  }

  const objectLiteral = match[0].replace('export const STYLE_DEFAULT_WALLPAPERS', 'const STYLE_DEFAULT_WALLPAPERS');
  const out = `/**
 * 自动生成，请勿手改。
 * 源文件: functions/lib/wallpaper-defaults.js
 * 由 scripts/update-versions.js 同步生成
 */
(function (global) {
  ${objectLiteral}

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
`;

  const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  if (prev !== out) {
    fs.writeFileSync(outPath, out, 'utf8');
    console.log('  ✅ 已同步 public/js/wallpaper-defaults.js');
  } else {
    console.log('  ⏭️  public/js/wallpaper-defaults.js 已是最新');
  }
}

/**
 * 主函数
 */
function main() {
  console.log('📦 开始更新静态资源版本号...\n');
  syncWallpaperDefaults();
  console.log('');
  
  let totalUpdated = 0;
  let htmlFilesModified = [];
  
  for (const [htmlFile, assets] of Object.entries(HTML_FILES)) {
    const htmlPath = path.join(ROOT_DIR, htmlFile);
    
    if (!fs.existsSync(htmlPath)) {
      console.warn(`⚠️  HTML 文件不存在: ${htmlFile}`);
      continue;
    }
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    let modified = false;
    
    console.log(`📄 处理 ${htmlFile}:`);
    
    for (const asset of assets) {
      const hash = getFileHash(asset.file);
      
      if (!hash) continue;
      
      const replacement = buildReplacement(asset.file, hash);
      const oldMatch = html.match(asset.pattern);
      
      if (oldMatch) {
        const oldValue = oldMatch[0];
        
        if (oldValue !== replacement) {
          html = html.replace(asset.pattern, replacement);
          console.log(`   ✅ ${asset.file.replace('public/', '')} -> ?v=${hash}`);
          modified = true;
          totalUpdated++;
        } else {
          console.log(`   ⏭️  ${asset.file.replace('public/', '')} (未变化)`);
        }
      } else {
        console.log(`   ⚠️  未找到匹配: ${asset.pattern}`);
      }
    }
    
    if (modified) {
      fs.writeFileSync(htmlPath, html, 'utf8');
      htmlFilesModified.push(htmlFile);
    }
    
    console.log('');
  }
  
  // 输出汇总
  if (totalUpdated > 0) {
    console.log(`✨ 完成! 更新了 ${totalUpdated} 个资源版本号`);
    console.log(`📝 修改的文件: ${htmlFilesModified.join(', ')}`);
    return { updated: true, files: htmlFilesModified };
  } else {
    console.log('✨ 完成! 所有资源版本号均为最新，无需更新');
    return { updated: false, files: [] };
  }
}

// 执行
const result = main();

// 如果有更新，返回非零退出码以便 Git hook 知道需要重新暂存文件
// 但我们不返回错误码，而是让 hook 脚本处理
process.exit(0);
