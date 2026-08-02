// functions/admin/login.js

import { timingSafeEqual, checkLoginRateLimit, recordLoginFailure, clearLoginFailures, buildSessionCookie } from '../_middleware';
import { getTurnstileConfig, verifyTurnstileToken } from '../lib/turnstile';

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function createAdminSession(env, ttl = 86400) {
  const token = crypto.randomUUID();
  await env.NAV_AUTH.put(`session_${token}`, Date.now().toString(), { expirationTtl: ttl });
  return token;
}

// 暴力破解防护配置
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 600; // 10 分钟
const ALLOWED_LOGIN_DURATIONS = new Set([1, 7, 30, 60, 90]);

function renderLoginPage(message = '', env = {}) {
  const hasError = Boolean(message);
  const safeMessage = hasError ? escapeHTML(message) : '';
  const { siteKey, isConfigured, isComplete } = getTurnstileConfig(env);
  const shouldRenderTurnstile = isConfigured && siteKey;
  const turnstileScript = shouldRenderTurnstile
    ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'
    : '';
  const turnstileWidget = shouldRenderTurnstile
    ? `<div class="form-group turnstile-group"><div class="cf-turnstile" data-sitekey="${escapeHTML(siteKey)}" data-theme="auto"></div></div>`
    : '';
  const configWarning = isConfigured && !isComplete
    ? '<div class="error-message">Turnstile 配置不完整，请同时设置 Site Key 和 Secret Key</div>'
    : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理员登录</title>
  <script>
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --apple-font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
        "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC",
        system-ui, sans-serif;
      --apple-ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
      --apple-ease-material: cubic-bezier(0.16, 1, 0.3, 1);
      --apple-accent: #2563eb;
      --apple-accent-hover: #1d4ed8;
    }
    html, body { height: 100%; margin: 0; padding: 0; font-family: var(--apple-font-ui); }
    body {
      display: flex; justify-content: center; align-items: center; padding: 1rem;
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      background: linear-gradient(180deg, #f5f7fa 0%, #eef1f5 45%, #e7ebf1 100%);
      background-attachment: fixed;
      position: relative;
      overflow: hidden;
    }
    /* 微妙网格纹理（Apple 风格的背景层次） */
    body::before {
      content: '';
      position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background-image: radial-gradient(circle, rgba(15, 23, 42, 0.04) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    /* 环境光：两层柔和光晕缓慢呼吸 */
    body::after {
      content: '';
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      will-change: transform, opacity;
      width: 50rem; height: 50rem; left: -12rem; top: -16rem;
      background: radial-gradient(circle at 30% 30%, rgba(37, 99, 235, 0.2), rgba(37, 99, 235, 0) 65%);
      animation: ambientFloat 22s ease-in-out infinite;
    }
    /* 第二层光晕用另一个伪元素替代 — 改用额外 div */
    .ambient-orb {
      position: fixed; pointer-events: none; z-index: 0;
      border-radius: 50%; will-change: transform, opacity;
      width: 44rem; height: 44rem; right: -10rem; bottom: -14rem;
      background: radial-gradient(circle at 60% 60%, rgba(124, 58, 237, 0.16), rgba(124, 58, 237, 0) 63%);
      animation: ambientFloatB 26s ease-in-out infinite;
    }
    @keyframes ambientFloat {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
      50% { transform: translate3d(2.5rem, 1.8rem, 0) scale(1.08); opacity: 0.78; }
    }
    @keyframes ambientFloatB {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
      50% { transform: translate3d(-2rem, -1.5rem, 0) scale(1.06); opacity: 0.75; }
    }
    .login-container, .back-link { position: relative; z-index: 1; }
    .login-container {
      background: rgba(255, 255, 255, 0.82);
      padding: 2.25rem 2rem;
      border-radius: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.7);
      box-shadow:
        0 0 0 1px rgba(15, 23, 42, 0.06),
        0 24px 60px -24px rgba(15, 23, 42, 0.28);
      width: 100%; max-width: 400px;
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      animation: materialize 0.5s var(--apple-ease-material);
      transition: transform 0.3s var(--apple-ease-spring),
        box-shadow 0.3s var(--apple-ease-spring);
    }
    .login-container:hover {
      box-shadow:
        0 0 0 1px rgba(15, 23, 42, 0.07),
        0 32px 72px -28px rgba(15, 23, 42, 0.32);
    }
    @keyframes materialize {
      from { opacity: 0; transform: translateY(18px) scale(0.97); filter: blur(4px); }
      to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
    }
    .login-title {
      font-size: 1.75rem; font-weight: 700; text-align: center;
      letter-spacing: -0.025em; line-height: 1.15; margin: 0 0 0.25rem 0; color: #111827;
    }
    .login-subtitle {
      font-size: 0.875rem; text-align: center; color: #6b7280;
      margin: 0 0 1.75rem 0; line-height: 1.5; letter-spacing: 0.005em;
    }
    .form-group { margin-bottom: 1.35rem; }
    .turnstile-group { display: flex; justify-content: center; min-height: 65px; margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #374151; letter-spacing: 0.005em; }
    input[type="text"], input[type="password"], select {
      width: 100%; padding: 0.8rem 1rem; font-size: 1rem; color: #111827;
      background-color: rgba(255, 255, 255, 0.9);
      border: 1px solid #d6dbe2; border-radius: 0.8rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    input::placeholder { color: #9ca3af; }
    input:focus, select:focus {
      border-color: rgba(37, 99, 235, 0.55);
      background-color: #fff;
      outline: none;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }

    /* ---- 登录有效期：自定义下拉 (Apple 风格) ---- */
    .duration-wrap { position: relative; }
    .duration-select {
      appearance: none; -webkit-appearance: none; -moz-appearance: none;
      width: 100%; padding: 0.8rem 2.75rem 0.8rem 1rem; font-size: 1rem;
      color: #111827; background-color: rgba(255, 255, 255, 0.9);
      border: 1px solid #d6dbe2; border-radius: 0.8rem; cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .duration-select:hover { border-color: #c2c9d2; }
    .duration-select:focus {
      border-color: rgba(37, 99, 235, 0.55); background-color: #fff; outline: none;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }
    .duration-chevron {
      position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
      width: 1rem; height: 1rem; color: #6b7280; pointer-events: none;
      transition: transform 0.28s var(--apple-ease-spring), color 0.2s ease;
    }
    .duration-select:focus ~ .duration-chevron { color: #2563eb; }
    .duration-wrap.open .duration-chevron { transform: translateY(-50%) rotate(180deg); }
    .duration-menu {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30;
      background: rgba(255, 255, 255, 0.98);
      border-radius: 0.9rem; padding: 0.35rem;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06),
        0 24px 48px -16px rgba(15, 23, 42, 0.28);
      backdrop-filter: blur(16px) saturate(160%);
      -webkit-backdrop-filter: blur(16px) saturate(160%);
      opacity: 0; visibility: hidden; transform: translateY(-6px) scale(0.97);
      transform-origin: top center;
      transition: opacity 0.22s var(--apple-ease-material),
        transform 0.28s var(--apple-ease-spring), visibility 0.22s;
    }
    .duration-wrap.open .duration-menu {
      opacity: 1; visibility: visible; transform: translateY(0) scale(1);
    }
    .duration-option {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.65rem 0.9rem; border-radius: 0.55rem; cursor: pointer;
      font-size: 0.925rem; color: #374151;
      transition: background-color 0.15s ease, color 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .duration-option:hover { background-color: #f0f3f8; color: #111827; }
    .duration-option.selected { color: var(--apple-accent); font-weight: 600; }
    .duration-option .check {
      width: 1rem; height: 1rem; color: var(--apple-accent); opacity: 0;
      transform: scale(0.5); transition: opacity 0.2s ease, transform 0.28s var(--apple-ease-spring);
    }
    .duration-option.selected .check { opacity: 1; transform: scale(1); }

    button {
      width: 100%; padding: 0.92rem 1rem; font-size: 1rem; font-weight: 600;
      letter-spacing: 0.02em; line-height: 1.2;
      color: white; cursor: pointer;
      border: none; border-radius: 0.9rem; position: relative;
      background:
        linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.35),
        inset 0 0 0 1px rgba(255, 255, 255, 0.06),
        0 1px 2px rgba(29, 78, 216, 0.35),
        0 4px 12px -4px rgba(37, 99, 235, 0.4);
      transition: transform 0.22s var(--apple-ease-spring),
        box-shadow 0.25s ease, background 0.25s ease, filter 0.2s ease;
      -webkit-tap-highlight-color: transparent;
      overflow: hidden;
    }
    /* 顶部高光反光条（光打在按钮材质上） */
    button::before {
      content: '';
      position: absolute; left: 0; right: 0; top: 0; height: 45%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0));
      pointer-events: none;
    }
    button:hover {
      background: linear-gradient(180deg, #4287f8 0%, #2563eb 100%);
      transform: translateY(-1px);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.35),
        inset 0 0 0 1px rgba(255, 255, 255, 0.06),
        0 6px 20px -6px rgba(37, 99, 235, 0.55);
    }
    button:active {
      transform: translateY(0) scale(0.975);
      filter: brightness(0.96);
      box-shadow:
        inset 0 2px 6px rgba(37, 99, 235, 0.45),
        inset 0 0 0 1px rgba(255, 255, 255, 0.06),
        0 1px 2px rgba(29, 78, 216, 0.2);
    }
    button:focus-visible { outline: 2px solid rgba(37, 99, 235, 0.6); outline-offset: 3px; }
    .error-message {
      color: #dc2626; font-size: 0.875rem; margin: 0 0 1rem 0; text-align: center;
      background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.18);
      border-radius: 0.6rem; padding: 0.6rem 0.75rem; line-height: 1.4;
    }
    .back-link {
      display: inline-flex; align-items: center; justify-content: center;
      width: 100%; margin-top: 1.5rem; color: var(--apple-accent);
      text-decoration: none; font-size: 0.875rem; font-weight: 500;
      padding: 0.4rem; border-radius: 0.5rem;
      transition: background-color 0.2s ease, color 0.2s ease, transform 0.16s var(--apple-ease-spring);
      -webkit-tap-highlight-color: transparent;
    }
    .back-link:hover { background-color: rgba(37, 99, 235, 0.08); }
    .back-link:active { transform: scale(0.97); }

    /* ---- 暗色模式 ---- */
    html.dark body {
      background: linear-gradient(180deg, #1c1c1e 0%, #161618 40%, #121214 100%);
    }
    html.dark body::before {
      background-image: radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
    }
    html.dark .ambient-orb {
      background: radial-gradient(circle at 60% 60%, rgba(124, 58, 237, 0.18), rgba(124, 58, 237, 0) 63%);
    }
    html.dark body::after {
      background: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.22), rgba(59, 130, 246, 0) 65%);
    }
    html.dark .login-container {
      background: rgba(28, 28, 30, 0.82);
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04),
        0 24px 60px -24px rgba(0, 0, 0, 0.5);
    }
    html.dark .login-title { color: #f3f4f6; }
    html.dark .login-subtitle { color: #9ca3af; }
    html.dark label { color: #d1d5db; }
    html.dark input[type="text"],
    html.dark input[type="password"],
    html.dark .duration-select {
      background-color: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.1);
      color: #e5e7eb;
    }
    html.dark input::placeholder { color: #6b7280; }
    html.dark input:focus,
    html.dark .duration-select:focus {
      border-color: rgba(96, 165, 250, 0.5);
      background-color: rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
    }
    html.dark .duration-chevron { color: #9ca3af; }
    html.dark .duration-menu {
      background: rgba(44, 44, 46, 0.98);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06),
        0 24px 48px -16px rgba(0, 0, 0, 0.5);
    }
    html.dark .duration-option { color: #d1d5db; }
    html.dark .duration-option:hover { background-color: rgba(255, 255, 255, 0.08); color: #fff; }
    html.dark .duration-option.selected { color: #60a5fa; }
    html.dark .duration-option .check { color: #60a5fa; }
    html.dark .error-message {
      background: rgba(220, 38, 38, 0.12);
      border-color: rgba(220, 38, 38, 0.2);
    }
    html.dark .back-link { color: #60a5fa; }
    html.dark .back-link:hover { background-color: rgba(59, 130, 246, 0.12); }

    /* ---- 减少透明度 ---- */
    @media (prefers-reduced-transparency: reduce) {
      html:not(.dark) .login-container {
        background: #ffffff;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      html.dark .login-container {
        background: #1c1c1e;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      body::before, body::after, .ambient-orb { animation: none !important; transform: none !important; }
      .login-container { transform: none !important; filter: none !important; }
      button { transform: none !important; }
    }
  </style>
  ${turnstileScript}
</head>
<body>
  <div class="ambient-orb" aria-hidden="true"></div>
  <div class="login-container">
    <h1 class="login-title">管理员登录</h1>
    <p class="login-subtitle">请输入管理员账号以访问管理后台</p>
    <form method="post" action="/admin/login" novalidate>
      <div class="form-group">
        <label for="username">用户名</label>
        <input type="text" id="username" name="username" required autocomplete="username" autofocus>
      </div>
      <div class="form-group">
        <label for="password">密码</label>
        <input type="password" id="password" name="password" required autocomplete="current-password">
      </div>
      <div class="form-group">
        <label for="duration">登录有效期</label>
        <div class="duration-wrap" id="durationWrap">
          <select id="duration" name="duration" class="duration-select" aria-label="登录有效期">
            <option value="1">1 天</option>
            <option value="7">7 天</option>
            <option value="30" selected>30 天</option>
            <option value="60">60 天</option>
            <option value="90">90 天</option>
          </select>
          <svg class="duration-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"></path>
          </svg>
          <div class="duration-menu" role="listbox" aria-label="登录有效期选项" id="durationMenu">
            <div class="duration-option" data-value="1" role="option">1 天<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span></div>
            <div class="duration-option" data-value="7" role="option">7 天<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span></div>
            <div class="duration-option" data-value="30" role="option">30 天<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span></div>
            <div class="duration-option" data-value="60" role="option">60 天<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span></div>
            <div class="duration-option" data-value="90" role="option">90 天<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></span></div>
          </div>
        </div>
      </div>
      ${turnstileWidget}
      ${configWarning}
      ${hasError ? `<div class="error-message">${safeMessage}</div>` : ''}
      <button type="submit">登 录</button>
    </form>
    <a href="/" class="back-link">返回首页</a>
  </div>
  <script>
    const durationSelect = document.getElementById('duration');
    const durationWrap = document.getElementById('durationWrap');
    const durationMenu = document.getElementById('durationMenu');

    // 同步显示层与原生 select（保存的偏好）
    const savedDuration = localStorage.getItem('login_duration');
    if (savedDuration && [...durationSelect.options].some(o => o.value === savedDuration)) {
      durationSelect.value = savedDuration;
    }
    function syncOptions() {
      document.querySelectorAll('.duration-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === durationSelect.value);
      });
    }
    syncOptions();

    // 拦截 select 的指针按下：阻止系统弹出原生下拉，改为切换自定义菜单
    // 键盘用户仍可 Tab 聚焦后用方向键选择（select 本身保留）
    durationSelect.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      durationWrap.classList.toggle('open');
    });

    // 点击触发器空白/chevron 区域：也切换菜单
    durationWrap.addEventListener('click', (e) => {
      if (e.target.closest('.duration-menu')) return;
      if (e.target === durationSelect) return; // pointerdown 已处理
      durationWrap.classList.toggle('open');
      durationSelect.focus({ preventScroll: true });
    });

    // 选项选择：更新原生 select + 关闭
    durationMenu.addEventListener('click', (e) => {
      const opt = e.target.closest('.duration-option');
      if (!opt) return;
      durationSelect.value = opt.dataset.value;
      syncOptions();
      durationWrap.classList.remove('open');
    });

    // 键盘操作原生 select（方向键/回车）后同步选中态
    durationSelect.addEventListener('change', syncOptions);

    // 外部点击关闭
    document.addEventListener('click', (e) => {
      if (!durationWrap.contains(e.target)) durationWrap.classList.remove('open');
    });

    // Escape 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') durationWrap.classList.remove('open');
    });

    document.querySelector('form').addEventListener('submit', function() {
      localStorage.setItem('login_duration', durationSelect.value);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    }
  });
}

// GET: 显示登录页面
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const error = url.searchParams.get('error');

  return renderLoginPage(error || '', env);
}

// POST: 处理登录提交
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 获取客户端 IP
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    // 暴力破解防护：检查 IP 是否被锁定
    const { locked } = await checkLoginRateLimit(env, ip, MAX_LOGIN_ATTEMPTS, LOCKOUT_SECONDS);
    if (locked) {
      return renderLoginPage('登录尝试过于频繁，请 10 分钟后再试', env);
    }

    const formData = await request.formData();
    const name = (formData.get('username') || '').trim();
    const password = (formData.get('password') || '').trim();
    const durationDays = Number(formData.get('duration') || '1');
    if (!ALLOWED_LOGIN_DURATIONS.has(durationDays)) {
      return renderLoginPage('登录有效期无效', env);
    }
    const ttl = durationDays * 86400;
    const turnstileToken = String(formData.get('cf-turnstile-response') || '').trim();

    if (!name || !password) {
      return renderLoginPage('请输入用户名和密码', env);
    }

    const turnstileResult = await verifyTurnstileToken(turnstileToken, env, ip);
    if (!turnstileResult.ok) {
      return renderLoginPage(turnstileResult.message, env);
    }

    const storedUsername = await env.NAV_AUTH.get('admin_username');
    const storedPassword = await env.NAV_AUTH.get('admin_password');

    if (!storedUsername || !storedPassword) {
      console.error('Admin credentials not found in KV');
      return renderLoginPage('系统配置错误，请联系管理员', env);
    }

    // 使用恒定时间比较，防止时序攻击
    const isValid = timingSafeEqual(name, storedUsername) && timingSafeEqual(password, storedPassword);

    if (isValid) {
      // 登录成功：清除失败计数
      await clearLoginFailures(env, ip);
      const token = await createAdminSession(env, ttl);

      // 生成 CSRF token 并存入 KV，与 session 使用相同 TTL
      const csrfToken = crypto.randomUUID();
      await env.NAV_AUTH.put(`csrf_${token}`, csrfToken, { expirationTtl: ttl });

      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/admin',
          'Set-Cookie': buildSessionCookie(token, { maxAge: ttl }),
        },
      });
    }

    // 登录失败：记录失败次数
    await recordLoginFailure(env, ip, MAX_LOGIN_ATTEMPTS, LOCKOUT_SECONDS);
    return renderLoginPage('账号或密码错误，请重试', env);
  } catch (e) {
    console.error('Login error:', e);
    return renderLoginPage('登录处理出错，请稍后重试', env);
  }
}
