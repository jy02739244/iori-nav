# AGENTS.md - AI 编码助手指南

本文档为 AI 编码助手（如 Cursor、Copilot、OpenCode 等）提供项目规范和开发指南。

## 项目概述

**iori-nav（灰色轨迹）** 是一个基于 Cloudflare 全家桶构建的书签导航站点。

- **语言**: JavaScript（ES6+，无 TypeScript）
- **平台**: Cloudflare Pages + Workers + D1 + KV
- **前端**: HTML + TailwindCSS + 原生 JavaScript

## 目录结构

```
iori-nav/
├── functions/              # Cloudflare Pages Functions（后端）
│   ├── _middleware.js      # 全局中间件（认证、CSRF、限流、缓存失效）
│   ├── index.js            # 首页 SSR 渲染
│   ├── constants.js        # SCHEMA_VERSION / HOME_CACHE_VERSION / DB_SCHEMA 等核心常量
│   ├── admin/              # 管理后台（login.js, logout.js, index.js）
│   ├── api/                # REST API（categories/, config/, pending/, cache/, settings.js, wallpaper.js 等）
│   └── lib/                # 共用工具（card-renderer, menu-renderer, schema-migration, settings-parser, utils, wallpaper-fetcher）
├── public/                 # 静态资源（构建输出目录）
│   ├── index.html          # 首页 SSR 模板
│   ├── _headers            # Cloudflare Pages 响应头（静态资源长缓存配置）
│   ├── admin/index.html    # 后台管理页面
│   ├── css/                # 样式文件
│   └── js/                 # 前端脚本
├── scripts/                # 构建辅助脚本（update-versions, update-changelog）
├── schema.sql              # D1 初始建表 SQL（runtime 会通过 ensureSchemaReady 自动追加后续迁移）
└── wrangler.toml           # 本地开发配置（已 gitignore）
```

## 开发命令

```bash
# 安装依赖
npm install

# 构建 CSS（Tailwind）
npm run build:css

# 启动本地开发服务器
npm run dev

# 本地执行 SQL
npx wrangler d1 execute book --local --file=schema.sql

# 远程执行 SQL
npx wrangler d1 execute book --remote --file=schema.sql
```

**注意**: 本项目使用少量 npm 开发依赖（如 TailwindCSS、Husky），无测试框架、无 lint 工具。

**版本号自动化**: pre-commit hook 会根据 CSS/JS 文件内容自动更新 HTML 中的 `?v=` 哈希（见 `scripts/update-versions.js`），无需手动维护。

## 代码风格规范

### 命名规范

- **文件**: 小写 + 连字符（`ai-chat.js`），动态路由用方括号（`[id].js`）
- **函数**: camelCase（`isAdminAuthenticated`）
- **常量**: UPPER_SNAKE_CASE（`DB_SCHEMA`）
- **布尔变量**: is/has 前缀（`isValid`、`hasChildren`）

### 导入规范

```javascript
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';
```

### API 端点模式

```javascript
export async function onRequestGet(context) {
  const { request, env, params } = context;
  // ...
}

export async function onRequestPost(context) {
  const { request, env } = context;
  // ...
}
```

### 响应格式

```javascript
// 成功
return jsonResponse({ code: 200, data: results });

// 错误
return errorResponse('Unauthorized', 401);
return errorResponse(`Failed: ${e.message}`, 500);
```

### 认证检查

```javascript
if (!(await isAdminAuthenticated(request, env))) {
  return errorResponse('Unauthorized', 401);
}
```

### 安全规范

```javascript
// HTML 转义 - 防止 XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// URL 清理 - 只允许 http/https
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
  } catch { return ''; }
}
```

## 数据库操作

```javascript
// 使用参数绑定（防 SQL 注入）
const { results } = await env.NAV_DB
  .prepare('SELECT * FROM sites WHERE catelog_id = ?')
  .bind(categoryId).all();

// 查询单条
const site = await env.NAV_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();

// 执行更新
await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();

// 批量执行
await env.NAV_DB.batch([
  env.NAV_DB.prepare('CREATE INDEX IF NOT EXISTS idx_sites_catelog_id ON sites(catelog_id)')
]);
```

## 前端规范

```javascript
// 使用可选链避免空引用
sidebar?.classList.add('open');

// Toast 提示
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-accent-500 text-white px-4 py-2 rounded shadow-lg z-50';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NAV_DB` | D1 数据库绑定 | 必需 |
| `NAV_AUTH` | KV 存储绑定 | 必需 |
| `ENABLE_PUBLIC_SUBMISSION` | 允许访客提交 | `false` |
| `SITE_NAME` | 网站名称 | `灰色轨迹` |
| `SITE_DESCRIPTION` | 首页副标题 | `一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建` |
| `FOOTER_TEXT` | 首页页脚 | `曾梦想仗剑走天涯` |
| `ICON_API` | 图标 API | `https://faviconsnap.com/api/favicon?url=` |
| `AI_REQUEST_DELAY` | AI 描述补全调用间隔（毫秒） | `1500` |

> `DISPLAY_CATEGORY` 已废弃，当前代码不会读取该变量。

## 注意事项

1. **静态资源目录**: 主要编辑 `public/` 下的文件
2. **CSS 需构建**: 修改 `public/css/tailwind.css` 后执行 `npm run build:css`
3. **SSR 渲染**: 首页通过 `functions/index.js` 服务端渲染，使用 `{{PLACEHOLDER}}` 模板替换
4. **中文支持**: 注释和用户消息可使用中文

## 数据库 Schema 迁移

项目使用运行时 Schema 迁移，通过 KV 缓存迁移状态避免重复执行。

### 迁移机制

位置:

- 迁移逻辑: `functions/lib/schema-migration.js` 中的 `ensureSchemaReady()` 函数
- 版本号常量: `functions/constants.js` 中的 `SCHEMA_VERSION`

```javascript
// Schema 迁移版本号 - 修改此值会触发重新迁移
const SCHEMA_VERSION = 'v4';
```

- 迁移成功后在 KV 中标记 `schema_migrated_{版本号}`（长期缓存，直到版本号变更）
- 冷启动时只需 1 次 KV 读取即可跳过迁移

### 添加新字段流程

1. 在 `ensureSchemaReady()` 函数中添加新的 ALTER 语句
2. **将 `SCHEMA_VERSION` 改为新版本号**（如 `v4` → `v5`）
3. 部署代码后，首次请求会自动执行迁移

### 示例

```javascript
// 1. 修改版本号
const SCHEMA_VERSION = 'v5';

// 2. 在 ensureSchemaReady() 中添加新字段检查
if (!sitesCols.has('new_column')) {
  alterStatements.push(env.NAV_DB.prepare("ALTER TABLE sites ADD COLUMN new_column TEXT"));
}
```
