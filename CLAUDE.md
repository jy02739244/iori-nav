# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

**iori-nav（灰色轨迹）** 是一个完全跑在 Cloudflare 上的书签导航站。

- **运行平台**：Cloudflare Pages + Pages Functions（Workers）+ D1（SQLite）+ KV
- **语言**：纯 JavaScript（ES Modules，**无 TypeScript**）
- **前端**：原生 HTML/JS + TailwindCSS（**SSR 模板替换**，不是 SPA）
- **测试 / lint**：项目**没有**配置测试框架或 lint 工具，唯一的 dev 依赖是 TailwindCSS 与 Husky

`AGENTS.md` 是给 AI 助手阅读的详细规范，请在动手前一并参考。

## 常用命令

```bash
npm install                # 安装依赖（Tailwind / Husky）
npm run build:css          # 构建 tailwind.min.css（修改 tailwind.css 后必跑）
npm run dev:css            # Tailwind watch 模式
npm run dev                # 启动 wrangler pages dev（predev 会先跑 update-versions.js）
npm run version            # 手动重新计算静态资源 ?v= 哈希
npm run changelog          # 根据 git log 自动更新 README 更新日志区块

# D1 数据库（本地 / 远程）
npx wrangler d1 execute book --local  --file=schema.sql
npx wrangler d1 execute book --remote --file=schema.sql
```

> 本地开发依赖 `wrangler.toml`（在 `.gitignore` 中），首次需自行填入 D1 / KV 资源 ID。

## 架构要点（必须理解的大局）

### 1. 三套并存的"版本机制"——不要混用

详见 `functions/constants.js` 顶部注释。

| 名称 | 作用 | 何时改 |
| :--- | :--- | :--- |
| `SCHEMA_VERSION` | 触发 D1 schema 迁移 | 改表 / 字段 / 索引时手动 +1 |
| `HOME_CACHE_VERSION` | 首页 HTML KV 缓存键 | 想强制刷新已缓存首页时 |
| 静态资源 `?v=hash` | 浏览器侧 CSS/JS 缓存 | **不要手动改**，pre-commit hook 通过 `scripts/update-versions.js` 自动写回 HTML |

### 2. 运行时 Schema 迁移

- 入口：`functions/lib/schema-migration.js` 的 `ensureSchemaReady()`
- 通过 `_middleware.js` 在所有非"首页 GET"路径上 `await` 触发；首页 GET 路径把它和 KV 读并行掉，避免命中 HIT 时多一次串行
- 迁移成功后在 KV 中写 `schema_migrated_{SCHEMA_VERSION}` 长期标记；冷启动只需 1 次 KV 读判断即可短路
- **新增字段流程**：在 `runIncrementalMigrations()` 内追加 `ALTER`，并把 `SCHEMA_VERSION`（含 `PREVIOUS_SCHEMA_VERSION`）一起 +1

### 3. 首页是 SSR + KV HTML 缓存（不是静态 HTML）

`functions/index.js` 才是首页 handler。`public/index.html` 只是模板，里面散落着 `{{PLACEHOLDER}}`，由 `index.js` 用数据库内容、settings、菜单 / 卡片渲染器（`functions/lib/{card,menu}-renderer.js`）填充。

- 公私两份缓存：`home_html_public_v8` / `home_html_private_v8`（key 由 `getHomeCacheKey(scope)` 生成）
- 写操作（增删改 site / category / settings）必须调用 `markHomeCacheDirty(env, scope)` 标记 dirty，下一次 GET 才会重渲染并回填缓存
- 写完不要主动 delete 缓存——下一次 GET 会替换；dirty 标记在新 HTML 写回时再 `clearHomeCacheDirty(..., expectedValue)` 做条件清除（防止竞态）
- `cachedTemplateHtml` 在 Worker 实例内缓存，避免每次 MISS 重复 `ASSETS.fetch('/index.html')`
- 标签间空白会被 `>\s+<` → `><` 压缩，所以模板里**不要塞 `<pre>` / `<textarea>`**

### 4. 认证 / CSRF / 防爆破（全在 `_middleware.js`）

- 登录走 form POST，成功后写 `admin_session=<uuid>; HttpOnly; Secure; SameSite=Lax`，对应 KV `session_${token}`；TTL 用户可选 1/7/30/60/90 天
- CSRF：登录同时生成 `csrf_${token}` 写 KV，`functions/admin/index.js` 把它注入到 admin HTML `<meta name="csrf-token">`
- 中间件对 `/api/*` 的 `POST/PUT/DELETE/PATCH` 强制校验 `X-CSRF-Token` 头（**`/api/config/submit` 例外**：用 Origin/Referer 同源校验，因为它是匿名公开提交接口）
- 登录失败计数 `login_fail_${ip}`：5 次/10 分钟锁定
- 字符串比较使用 `timingSafeEqual()` 防时序攻击

### 5. Settings 双层缓存

`functions/api/settings.js` 写设置 → 同时清除 KV `settings_cache` + 标记 home cache dirty；`functions/index.js` 读取时优先查 `settings_cache`（24h TTL），未命中再查 D1 并异步回填。

### 6. 私密书签 / 分类（`is_private`）

- 未认证查询统一带 `WHERE (is_private = 0 OR ? = 1)`，绑定 `includePrivate = isAuthenticated ? 1 : 0`
- 分类 `is_private = 1` 时，`api/config/index.js` 会强制把站点也置为私密
- 公私两条缓存路径互不污染（参见 `cacheScope` 与 `Set-Cookie iori_cache_*_stale`）

### 7. CSP / 输入清洗

- HTML 输出统一过 `lib/utils.js` 的 `escapeHTML`
- 所有用户提供的 URL 必须过 `sanitizeUrl`（仅放行 http / https）
- 字体 `font-family` 必须命中 `FONT_MAP` 白名单（`getStyleStr` 内部强校验）
- D1 一律使用参数绑定（`prepare(...).bind(...)`），SQL `LIKE` 通配符通过 `escapeLikePattern` 转义

## 目录速查

```
functions/
├── _middleware.js        # 全局中间件 + 工具函数（认证 / CSRF / 限流 / 缓存 dirty 标记）
├── constants.js          # SCHEMA_VERSION / HOME_CACHE_VERSION / DB_SCHEMA / FONT_MAP
├── index.js              # 首页 SSR 入口
├── admin/                # /admin、/admin/login、/admin/logout
├── api/                  # REST API（categories/, config/, pending/, cache/, settings.js, ai-chat.js, wallpaper.js …）
└── lib/                  # 共用：card-renderer, menu-renderer, schema-migration, settings-parser, utils, wallpaper-fetcher

public/                   # Pages 静态资源（构建输出目录）
├── index.html            # 首页 SSR 模板（含 {{PLACEHOLDER}}）
├── admin/index.html      # 后台 SPA-ish 页面
├── _headers              # CSS/JS/favicon 长缓存策略
├── css/                  # tailwind.css 是源；tailwind.min.css 是构建产物
└── js/                   # main.js（前端） + admin-*.js（后台分模块）

scripts/
├── update-versions.js    # pre-commit 自动跑：MD5 → 写 ?v=xxx
└── update-changelog.js   # 根据 git log 重生成 README 的 changelog 区块
schema.sql                # D1 初始建表（运行时 ensureSchemaReady 会再补 ALTER）
wrangler.toml             # 已 gitignore，本地需自填 D1/KV id
```

## 写代码的几条硬性约束

- **修改 `public/css/tailwind.css` 必须 `npm run build:css`** 否则上线无样式
- **任何写 D1 的接口都要 `markHomeCacheDirty(env, scope)`**，否则首页 KV 缓存会一直返回旧 HTML
- **新加 setting 字段：在 `lib/settings-parser.js` 的 `SETTINGS_SCHEMA` 里先注册**，否则 SSR 读不到
- **不要在 commit 时手动改 HTML 里的 `?v=` 参数**，pre-commit hook 会改回去
- API 文件命名：动态路由用方括号（`api/config/[id].js`、`api/categories/[id].js`）
- 状态变更接口请求体走 JSON，并附带 `X-CSRF-Token: <meta>` 头（admin HTML 已注入）

## 部署绑定（Cloudflare Pages → 设置 → 绑定）

| 绑定名 | 类型 | 必需 |
| :--- | :--- | :--- |
| `NAV_DB` | D1 数据库（默认名 `book`） | ✅ |
| `NAV_AUTH` | KV（同时存 session / CSRF / 限流计数器 / settings 缓存 / home HTML 缓存） | ✅ |

可选环境变量：`ENABLE_PUBLIC_SUBMISSION`、`SITE_NAME`、`SITE_DESCRIPTION`、`FOOTER_TEXT`、`ICON_API`、`AI_REQUEST_DELAY`。
后台凭据通过 KV 条目 `admin_username` / `admin_password` 配置。

## 中文支持

注释、用户面文案、commit message 均可使用中文，与现有风格保持一致。
