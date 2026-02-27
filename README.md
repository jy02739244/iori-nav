# 灰色轨迹 - 精品网址导航站

<p align="center">
  一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建。
</p>

<p align="center">
  <a href="https://github.com/jy02739244/iori-nav/stargazers"><img src="https://img.shields.io/github/stars/jy02739244/iori-nav?style=flat-square&logo=github&color=yellow" alt="Stars"></a>
  <a href="https://github.com/jy02739244/iori-nav/network/members"><img src="https://img.shields.io/github/forks/jy02739244/iori-nav?style=flat-square&logo=github&color=blue" alt="Forks"></a>
  <a href="https://github.com/jy02739244/iori-nav/blob/main/LICENSE"><img src="https://img.shields.io/github/license/jy02739244/iori-nav?style=flat-square&color=green" alt="License"></a>
  <a href="https://github.com/jy02739244/iori-nav/issues"><img src="https://img.shields.io/github/issues/jy02739244/iori-nav?style=flat-square&color=orange" alt="Issues"></a>
</p>

<p align="center">
  <a href="#-核心特性">特性</a> •
  <a href="#-版本亮点">版本亮点</a> •
  <a href="#-快速部署">快速部署</a> •
  <a href="#-本地开发">本地开发</a> •
  <a href="#-环境变量说明">变量说明</a> •
  <a href="#-常见部署问题">常见问题</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#-更新日志">更新日志</a>
</p>

<p align="center">
  <strong>🌐 在线体验:</strong> <a href="https://iori.hidns.vip/">https://iori.hidns.vip</a>
</p>

---

## 🖼️ 效果预览

| 首页 | 后台管理 |
| :---: | :---: |
| ![首页预览](https://github.com/user-attachments/assets/b106be25-5be4-4ae6-98aa-e1fae38b5a3d) | ![后台预览](https://github.com/user-attachments/assets/49461d13-e48b-400d-b15c-3fa2d1a0460e) |
| ![首页预览](https://github.com/user-attachments/assets/4cb39e41-a7a5-46c7-876c-62021fa5611e) | ![后台预览](https://github.com/user-attachments/assets/4d3bb3f4-da65-400a-a41d-eeaecedb7197) |

| 大卡片 | 小卡片 |
| :---: | :---: |
| ![大卡片预览](https://github.com/user-attachments/assets/e77d1c10-aba4-4755-8a62-416fe3a8239e) | ![小卡片预览](https://github.com/user-attachments/assets/b2508b55-bbf6-4998-a111-a7b75eb8686b) |

| 简洁风格 | 夜间模式 |
| :---: | :---: |
| ![简洁风格预览](https://github.com/user-attachments/assets/3a70b18a-5301-4218-a75f-869fbbdaa7a4) | ![夜间模式预览](https://github.com/user-attachments/assets/9e51cf5c-4064-4b8d-ad2c-e0ca9e006834) |

> 💡 卡片的毛玻璃效果和程度可以在后台设置里自定义。后台设置页面为 URL 后加 `/admin`

---

## ✨ 核心特性

| 特性 | 说明 |
| :--- | :--- |
| 📱 **响应式设计** | 完美适配桌面、平板和手机等各种设备 |
| 🎨 **主题美观** | 界面简洁优雅，支持自定义主色调与夜间模式 |
| 🔍 **快速搜索** | 内置站内模糊搜索，迅速定位所需网站 |
| 📂 **分类清晰** | 通过多级分类组织书签，浏览直观高效 |
| 🔒 **安全后台** | 基于 KV 的管理员认证，提供完整的书签增删改查后台 |
| 📝 **用户提交** | 支持访客提交书签，经管理员审核后显示（可通过环境变量关闭） |
| ⚡ **性能卓越** | 利用 Cloudflare 边缘缓存，秒级加载，节省 D1 数据库读取成本 |
| 📤 **数据管理** | 支持书签数据的导入与导出，兼容 Chrome 导出的 HTML 格式 |

---

## 🔄 版本亮点

- 🛡️ **后台会话安全升级**：登录 `/admin` 后将颁发 HttpOnly 会话 Cookie（默认 1 天，可选 1/7/30/60/90 天），凭据不再暴露在 URL 中，并新增一键退出登录。
- 🧹 **输入与展示双重校验**：新增 URL 规范化、HTML 转义与排序值归一化逻辑，前后台同时防止脏数据和潜在 XSS。
- 🔐 **访客投稿可控**：通过 `ENABLE_PUBLIC_SUBMISSION` 环境变量即可关闭前台投稿入口，相关接口自动返回 403。
- 🤖 **AI 一键自动生成描述**：提供 Workers AI、Google Gemini 和 OpenAI 接口。
- 🖼️ **Logo 自动生成**：默认使用 [faviconsnap.com](https://faviconsnap.com) 接口，可在环境变量中自定义。
- 📦 **导入导出数据**：提供书签数据的导入与导出，支持 Chrome 导出的 HTML 格式一键导入。

---

## 🚀 快速部署

> **准备工作**：你需要一个 [Cloudflare](https://dash.cloudflare.com/) 账号。

### 步骤 1：Fork 本仓库

[![Fork on GitHub](https://img.shields.io/badge/Fork-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/jy02739244/iori-nav/fork)

点击上方 **"Fork on GitHub"** 按钮，并点上 ⭐ Star！

### 步骤 2：部署到 Cloudflare Pages

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github)

点击上方按钮跳转到 Cloudflare，然后选择连接到 GitHub，授权后选择刚才 Fork 的项目。

<img width="2252" height="1380" alt="选择项目" src="https://github.com/user-attachments/assets/0588e0d0-befb-4962-b422-922a8c895674" />

点击 **开始设置** 后，需要填写构建输出目录为 `public`，其他保持默认即可。

<img width="2112" height="1404" alt="构建设置" src="https://github.com/user-attachments/assets/654a23af-d75f-477d-848e-fea8a41740dc" />

### 步骤 3：创建 D1 数据库

1. 在 Cloudflare 控制台，进入 `存储和数据库` → `D1 SQL 数据库`。
2. 点击 `创建数据库`，数据库名称输入 `book`，然后创建。

<img width="2836" height="1298" alt="创建D1数据库" src="https://github.com/user-attachments/assets/644032c6-304c-46cc-b039-9eafbc6f7a6b" />

### 步骤 4：创建 KV 存储

1. 在 Cloudflare 控制台，进入 `存储和数据库` → `Worker KV`。
2. 点击 `创建命名空间`，名称输入 `NAV_AUTH`。

    <img width="2744" height="974" alt="创建KV命名空间" src="https://github.com/user-attachments/assets/11d08862-7887-4883-97ce-390780e7fccd" />

3. 创建后，为此 KV 添加两个条目，用于设置后台登录的 **用户名** 和 **密码**：
    - `admin_username`：你的管理员用户名（例如 `admin`）
    - `admin_password`：你的管理员密码

    <img width="2810" height="1188" alt="设置KV条目" src="https://github.com/user-attachments/assets/2114e42b-03d2-400f-a8f8-54dc156a7922" />

### 步骤 5：绑定服务

1. 进入你刚刚创建的 Pages 项目的 `设置` → `绑定`。
2. 点击 `添加绑定`，选择 `D1 数据库`：
    - 变量名称：`NAV_DB`
    - D1 数据库：选择你创建的 `book`
3. 点击 `添加绑定`，选择 `KV 命名空间`：
    - 变量名称：`NAV_AUTH`
    - KV 命名空间：选择你创建的 `NAV_AUTH`

<img width="2152" height="1236" alt="绑定服务" src="https://github.com/user-attachments/assets/9dd15cd0-8173-4dec-af87-d8ef0bdeaa38" />

### 步骤 6：重新部署

点击项目的 **部署** 选项，在最后一次的部署后边选择 **重新部署**，等待部署完成，绑定自定义域名即可开始使用。

<img width="2482" height="1374" alt="重新部署" src="https://github.com/user-attachments/assets/d2f12af3-9aba-458e-9d16-00f7468c22e9" />

---

## 🧪 本地开发

> 本地开发依赖 `wrangler.toml`（该文件已 `.gitignore`），请先填入你自己的 D1/KV 资源 ID。

```bash
# 安装依赖（TailwindCSS / Husky）
npm install

# 构建 CSS（首次或修改 tailwind.css 后执行）
npm run build:css

# 启动本地开发服务器
npm run dev

# 本地执行数据库 schema（可选）
npx wrangler d1 execute book --local --file=schema.sql
```

---

## 🔑 环境变量说明

### 1) 必需绑定（Pages 项目设置 -> 绑定）

| 绑定名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `NAV_DB` | D1 | 主数据库绑定（必需） |
| `NAV_AUTH` | KV | 会话、限流、缓存标记存储（必需） |

### 2) 可选变量（Pages 项目设置 -> 变量和机密）

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `ENABLE_PUBLIC_SUBMISSION` | `false` | 是否允许访客投稿 |
| `SITE_NAME` | `灰色轨迹` | 首页站点名称（环境变量兜底） |
| `SITE_DESCRIPTION` | `一个优雅、快速、易于部署的书签（网址）收藏与分享平台，完全基于 Cloudflare 全家桶构建` | 首页副标题（环境变量兜底） |
| `FOOTER_TEXT` | `曾梦想仗剑走天涯` | 首页页脚文案 |
| `ICON_API` | `https://faviconsnap.com/api/favicon?url=` | 自动补全 logo 的接口前缀 |
| `AI_REQUEST_DELAY` | `1500` | AI 一键补全描述调用间隔（毫秒） |

> `DISPLAY_CATEGORY` 已废弃，当前版本不会读取该变量。

### 3) 配置优先级说明

- 首页名称/副标题等支持后台设置项的字段，优先读取数据库 `settings`，环境变量作为兜底。
- `AI_REQUEST_DELAY` 在代码中的默认兜底为 `1500`；本地 `wrangler.toml` 示例值为 `500`，可按 API 限频自行调整。

> **💡 提示**：如使用免费的 Gemini API Key（模型 `gemini-2.5-flash-lite`），频率限制为 15 次/分钟，请根据实际情况调整 `AI_REQUEST_DELAY`。

### 🔐 管理后台

> 后台管理页面地址为：`https://你的域名/admin`

后台登录凭据存放在 `NAV_AUTH` KV 中的 `admin_username` 与 `admin_password` 两个键内。登录 `/admin` 时需要在页面表单中输入账号与密码，系统会返回一个 **HttpOnly 会话 Cookie（默认 1 天，可选 1/7/30/60/90 天）**，无需也不再支持在 URL 查询参数中传递凭据。点击后台右上角的 **"退出登录"** 按钮即可立即销毁会话。

---

## ❗ 常见部署问题

- `/admin` 无法登录或反复跳回登录页：确认已绑定 `NAV_AUTH`，并在该 KV 中创建 `admin_username`、`admin_password`。
- 首页 500 或数据为空：确认 `NAV_DB` 已正确绑定到 `book` 数据库，且已执行过 `schema.sql`。
- 前台看不到投稿入口：确认 `ENABLE_PUBLIC_SUBMISSION=true`（字符串或布尔都可，代码会统一转换）。
- 修改了 `public/css/tailwind.css` 但样式未生效：先执行 `npm run build:css` 再重新部署。

---

## 🔧 技术栈

| 类别 | 技术 |
| :--- | :--- |
| **计算** | [Cloudflare Workers](https://workers.cloudflare.com/) |
| **数据库** | [Cloudflare D1](https://developers.cloudflare.com/d1/) |
| **存储** | [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) |
| **前端框架** | [TailwindCSS](https://tailwindcss.com/) |

---

## 📋 更新日志

<!-- changelog:start -->
- ⚡ **2026-02-24**：优化缓存策略并提升加载性能
- 🖼️ **2026-02-23**：优化壁纸功能与加载体验，并补充文档说明
- 🐞 **2026-01-24**：修复若干问题并提升稳定性，并加强登录安全
- ⚡ **2026-01-20**：优化缓存策略并提升加载性能
- ⚡ **2026-01-19**：优化缓存策略并提升加载性能
- 🔧 **2026-01-16**：美化后台管理界面，隐藏待审核列表
- 🎨 **2026-01-15**：优化卡片样式与后台界面体验
- ⚡ **2026-01-10**：优化缓存策略并提升加载性能
- 🧰 **2025-12-30**：更新文档与部署使用说明
- 🐞 **2025-12-29**：修复若干问题并提升稳定性
- 📦 **2025-12-27**：增强导入导出与批量管理能力
- 📂 **2025-12-25**：增强分类结构与私密数据支持
- 🖼️ **2025-12-24**：优化壁纸功能与加载体验
- 📦 **2025-12-23**：增强导入导出与批量管理能力，并增强分类能力
- 🐞 **2025-12-22**：修复若干问题并提升稳定性
- 🎨 **2025-12-20**：优化卡片样式与后台界面体验，并修复多项问题
- 📂 **2025-12-19**：增强分类结构与私密数据支持，并修复多项问题
- 🎨 **2025-12-18**：优化卡片样式与后台界面体验，并增强分类能力
- 🧰 **2025-12-14**：更新文档与部署使用说明
<!-- changelog:end -->

---

## 🌟 贡献

欢迎通过 Issue 或 Pull Request 为本项目贡献代码、提出问题或建议！

1. Fork 本仓库
2. 创建你的功能分支：`git checkout -b feature/amazing-feature`
3. 提交你的更改：`git commit -m 'Add some amazing feature'`
4. 推送到你的分支：`git push origin feature/amazing-feature`
5. 创建一个 Pull Request

---

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

---

## 📞 联系方式

- **项目作者**：[@灰色轨迹](https://github.com/jy02739244)
- **项目链接**：[https://github.com/jy02739244/iori-nav](https://github.com/jy02739244/iori-nav)

<p align="center">如果你喜欢这个项目，请给它一个 ⭐️！</p>

## ⭐ Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=jy02739244/iori-nav&type=date&legend=top-left)](https://www.star-history.com/#jy02739244/iori-nav&type=date&legend=top-left)
