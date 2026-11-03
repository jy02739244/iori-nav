// functions/admin/login.js

import { timingSafeEqual, checkLoginRateLimit, recordLoginFailure, clearLoginFailures, buildSessionCookie, MAX_TIMING_SAFE_INPUT_LENGTH } from '../_middleware';
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
  const siteName = escapeHTML(env.SITE_NAME || '灰色轨迹');
  const { siteKey, isConfigured, isComplete } = getTurnstileConfig(env);
  const shouldRenderTurnstile = isConfigured && siteKey;
  const turnstileScript = shouldRenderTurnstile
    ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'
    : '';
  const turnstileWidget = shouldRenderTurnstile
    ? `<div class="form-group turnstile-group"><div class="cf-turnstile" data-sitekey="${escapeHTML(siteKey)}" data-theme="light" data-size="flexible"></div></div>`
    : '';
  const configWarning = isConfigured && !isComplete
    ? '<div class="error-message" role="alert">Turnstile 配置不完整，请同时设置 Site Key 和 Secret Key</div>'
    : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理员登录 · ${siteName}</title>
  <meta name="theme-color" content="#f6f4fb">
  <link rel="icon" href="/favicon.svg?v=148aafdf" type="image/svg+xml">
  <link rel="stylesheet" href="/css/login.css?v=5a8cff09">
  <script src="/js/login.js?v=72d49e8f" defer></script>
  ${turnstileScript}
</head>
<body>
  <svg class="icon-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <symbol id="icon-bookmark" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4Z"/></symbol>
    <symbol id="icon-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></symbol>
    <symbol id="icon-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></symbol>
    <symbol id="icon-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></symbol>
    <symbol id="icon-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="icon-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="icon-chevron" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></symbol>
    <symbol id="icon-spark" viewBox="0 0 24 24"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></symbol>
  </svg>
  <div class="page-shell">
    <header class="page-header">
      <a href="/" class="brand" aria-label="${siteName}首页">
        <span class="brand-mark"><svg class="icon"><use href="#icon-bookmark"/></svg></span>
        <span>${siteName}<small>IORI NAV</small></span>
      </a>
      <a href="/" class="back-link"><span aria-hidden="true">←</span> 返回首页</a>
    </header>
    <main class="login-layout">
      <section class="intro" aria-labelledby="intro-title">
        <p class="eyebrow"><span></span> 你的世界，井然有序</p>
        <h2 id="intro-title">收藏每一份灵感，<br><span>留下自己的轨迹。</span></h2>
        <p class="intro-description">让散落的好网站有处可归。<br>从这里，继续整理你喜欢的世界。</p>
        <div class="bookmark-scene" aria-hidden="true">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <span class="scene-dot dot-one"></span><span class="scene-dot dot-two"></span>
          <div class="collection-window">
            <div class="window-bar"><span class="window-dots"><i></i><i></i><i></i></span><span>我的收藏夹</span><svg class="icon"><use href="#icon-bookmark"/></svg></div>
            <div class="window-content">
              <p class="collection-label">为热爱，留一个位置</p>
              <div class="collection-row"><span class="tile-icon tile-purple"><svg class="icon"><use href="#icon-spark"/></svg></span><span><b>灵感与创意</b><small>让好想法随时发生</small></span><span class="row-arrow">↗</span></div>
              <div class="collection-row"><span class="tile-icon tile-blue"><svg class="icon"><use href="#icon-bookmark"/></svg></span><span><b>阅读与探索</b><small>总有新的世界值得发现</small></span><span class="row-arrow">↗</span></div>
              <div class="collection-row"><span class="tile-icon tile-peach"><svg class="icon"><use href="#icon-clock"/></svg></span><span><b>日常与效率</b><small>把时间留给重要的事</small></span><span class="row-arrow">↗</span></div>
            </div>
          </div>
          <div class="floating-bookmark"><svg class="icon"><use href="#icon-bookmark"/></svg></div>
          <div class="saved-note"><span>✓</span> 美好，已收藏</div>
          <svg class="scene-spark icon"><use href="#icon-spark"/></svg>
        </div>
        <p class="intro-footnote"><span></span> 一个属于你的互联网角落</p>
      </section>
      <section class="login-container" aria-labelledby="login-title">
        <div class="form-heading">
          <span class="welcome-label">WELCOME BACK</span>
          <h1 class="login-title" id="login-title">管理员登录</h1>
          <p>欢迎回来，继续打理你的书签收藏。</p>
        </div>
        <form method="post" action="/admin/login" novalidate>
          <div class="form-group">
            <label for="username">用户名</label>
            <div class="input-wrap">
              <svg class="icon input-icon" aria-hidden="true"><use href="#icon-user"/></svg>
              <input type="text" id="username" name="username" required autocomplete="username" placeholder="请输入用户名" autofocus>
            </div>
          </div>
          <div class="form-group">
            <label for="password">密码</label>
            <div class="input-wrap">
              <svg class="icon input-icon" aria-hidden="true"><use href="#icon-lock"/></svg>
              <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="请输入密码">
              <button type="button" class="password-toggle" id="passwordToggle" aria-label="显示密码" aria-pressed="false" aria-controls="password" hidden>
                <svg class="icon" aria-hidden="true"><use href="#icon-eye"/><path class="eye-slash" d="m3 3 18 18"/></svg>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="duration" class="duration-label">登录有效期 <span>按你的使用习惯选择</span></label>
            <div class="input-wrap">
              <svg class="icon input-icon" aria-hidden="true"><use href="#icon-clock"/></svg>
              <select id="duration" name="duration" aria-describedby="duration-hint">
                <option value="1">1 天</option>
                <option value="7">7 天</option>
                <option value="30">30 天</option>
                <option value="60">60 天</option>
                <option value="90">90 天</option>
              </select>
              <svg class="icon select-chevron" aria-hidden="true"><use href="#icon-chevron"/></svg>
            </div>
            <p id="duration-hint" class="field-hint">公共设备建议选择 1 天，并在使用后退出。</p>
          </div>
          ${turnstileWidget}
          ${configWarning}
          ${hasError ? `<div class="error-message" role="alert">${safeMessage}</div>` : ''}
          <button type="submit" class="login-button"><span class="button-label">登 录</span><svg class="icon" aria-hidden="true"><use href="#icon-arrow"/></svg></button>
        </form>
        <div class="form-footer"><svg class="icon" aria-hidden="true"><use href="#icon-lock"/></svg><span>仅限管理员访问 · 妥善保管你的账号</span></div>
      </section>
    </main>
    <footer class="page-footer"><span>${siteName}</span><span>把喜欢的世界，留在这里。</span></footer>
  </div>
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
    // 密码首尾空格可能属于密码本身，不能 trim；用户名仍按习惯去掉首尾空白
    const rawPassword = formData.get('password');
    const password = typeof rawPassword === 'string' ? rawPassword : '';
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

    // timingSafeEqual 对超过上限的输入直接返回 false（防止内存放大）。KV 里的凭据
    // 没有写入侧校验，这里显式报配置错误，避免表现为「密码明明对却永远登不上」。
    if (storedUsername.length > MAX_TIMING_SAFE_INPUT_LENGTH || storedPassword.length > MAX_TIMING_SAFE_INPUT_LENGTH) {
      console.error(`Admin credentials exceed the supported length (${MAX_TIMING_SAFE_INPUT_LENGTH} characters)`);
      return renderLoginPage('系统配置错误，请联系管理员', env);
    }

    // 使用恒定时间比较，防止时序攻击
    // 两个字段都做恒定时间比较，避免用户名错误时短路泄露判断结果
    const usernameValid = timingSafeEqual(name, storedUsername);
    const passwordValid = timingSafeEqual(password, storedPassword);
    const isValid = usernameValid && passwordValid;

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
