// functions/_middleware.js

import { ensureSchemaReady } from './lib/schema-migration';
import { HOME_CACHE_VERSION, HOME_CACHE_TTL } from './constants';

export function normalizeSortOrder(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 9999;
}

export function isSubmissionEnabled(env) {
  // Convert to string to handle both boolean `true` from toml and string 'true' from secrets
  return String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
}

export async function isAdminAuthenticated(request, env) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;

  const match = cookie.match(/admin_session=([^;]+)/);
  if (!match) return false;

  const token = match[1];
  const session = await env.NAV_AUTH.get(`session_${token}`);

  return Boolean(session);
}

export function errorResponse(message, status) {
  return new Response(JSON.stringify({ code: status, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getHomeCacheKey(scope) {
  return `home_html_${scope}_${HOME_CACHE_VERSION}`;
}

export function getHomeDirtyKey(scope) {
  return `home_dirty_${scope}_${HOME_CACHE_VERSION}`;
}

export async function getHomeCacheDirtyValue(env, scope) {
  try {
    return await env.NAV_AUTH.get(getHomeDirtyKey(scope));
  } catch (e) {
    console.error('Failed to read home cache dirty value:', e);
    return null;
  }
}

export async function clearHomeCache(env, scope = 'all') {
  try {
    const keys = [];

    // TODO(2026-04-27): 旧版裸 key 'home_html_public' / 'home_html_private'
    // 自 aa166bd (2026-03-27) 起已不再写入，30 天 TTL 于 2026-04-26 自然过期。
    // 届时可删除下方两处裸 key，仅保留 getHomeCacheKey() 版本化 key。
    if (scope === 'all' || scope === 'public') {
      keys.push('home_html_public', getHomeCacheKey('public'));
    }

    if (scope === 'all' || scope === 'private') {
      keys.push('home_html_private', getHomeCacheKey('private'));
    }

    await Promise.all(keys.map(key => env.NAV_AUTH.delete(key)));
  } catch (e) {
    console.error('Failed to clear home cache:', e);
  }
}

export async function markHomeCacheDirty(env, scope = 'all') {
  try {
    const keys = [];
    const dirtyValue = crypto.randomUUID();

    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeDirtyKey('public'));
    }

    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeDirtyKey('private'));
    }

    for (const key of keys) {
      await env.NAV_AUTH.put(key, dirtyValue, { expirationTtl: HOME_CACHE_TTL });
    }
  } catch (e) {
    console.error('Failed to mark home cache dirty:', e);
  }
}

export async function clearHomeCacheDirty(env, scope = 'all', expectedValue = null) {
  try {
    const keys = [];

    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeDirtyKey('public'));
    }

    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeDirtyKey('private'));
    }

    await Promise.all(keys.map(async (key) => {
      if (expectedValue === null) {
        await env.NAV_AUTH.delete(key);
        return;
      }

      const latestValue = await env.NAV_AUTH.get(key);
      if (latestValue === expectedValue) {
        await env.NAV_AUTH.delete(key);
      }
    }));
  } catch (e) {
    console.error('Failed to clear home cache dirty flag:', e);
  }
}

export async function isHomeCacheDirty(env, scope) {
  try {
    const value = await getHomeCacheDirtyValue(env, scope);
    return !!value;
  } catch (e) {
    console.error('Failed to check home cache dirty flag:', e);
    return false;
  }
}

/**
 * 构建 session cookie 字符串
 * @param {string} token - session token
 * @param {object} options - { maxAge: number }
 */
export function buildSessionCookie(token, options = {}) {
  const maxAge = options.maxAge !== undefined ? options.maxAge : 86400;
  return `admin_session=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * 从请求 Cookie 中提取 session token
 * @returns {string|null}
 */
export function getSessionToken(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 恒定时间字符串比较，防止时序攻击
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    // 长度不同时仍需做一次完整比较以保持恒定时间
    const dummy = new Uint8Array(bufA.byteLength);
    crypto.subtle.timingSafeEqual(bufA, dummy);
    return false;
  }
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

/**
 * 通用 IP 速率限制（基于 KV 计数器 + TTL 自动过期）
 * @param {object} env - Cloudflare env（需要 NAV_AUTH KV 绑定）
 * @param {string} key - 速率限制键名（通常含 IP）
 * @param {number} maxRequests - 窗口期内最大请求数
 * @param {number} windowSeconds - 窗口期（秒）
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
export async function checkRateLimit(env, key, maxRequests, windowSeconds) {
  try {
    const current = await env.NAV_AUTH.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    await env.NAV_AUTH.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: maxRequests - count - 1 };
  } catch (e) {
    console.error('Rate limit check failed:', e);
    // 速率限制检查失败时不阻塞正常请求
    return { allowed: true, remaining: maxRequests };
  }
}

/**
 * 登录暴力破解防护（基于 IP 的失败计数器）
 * @param {object} env - Cloudflare env
 * @param {string} ip - 客户端 IP
 * @param {number} maxAttempts - 最大允许失败次数
 * @param {number} lockoutSeconds - 锁定时间（秒）
 * @returns {Promise<{locked: boolean, attemptsLeft: number}>}
 */
export async function checkLoginRateLimit(env, ip, maxAttempts, lockoutSeconds) {
  const key = `login_fail_${ip}`;
  try {
    const current = await env.NAV_AUTH.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= maxAttempts) {
      return { locked: true, attemptsLeft: 0 };
    }
    return { locked: false, attemptsLeft: maxAttempts - count };
  } catch (e) {
    console.error('Login rate limit check failed:', e);
    return { locked: false, attemptsLeft: maxAttempts };
  }
}

/**
 * 记录一次登录失败
 */
export async function recordLoginFailure(env, ip, maxAttempts, lockoutSeconds) {
  const key = `login_fail_${ip}`;
  try {
    const current = await env.NAV_AUTH.get(key);
    const count = current ? parseInt(current, 10) : 0;
    await env.NAV_AUTH.put(key, String(count + 1), { expirationTtl: lockoutSeconds });
  } catch (e) {
    console.error('Record login failure failed:', e);
  }
}

/**
 * 清除登录失败计数（登录成功时调用）
 */
export async function clearLoginFailures(env, ip) {
  const key = `login_fail_${ip}`;
  try {
    await env.NAV_AUTH.delete(key);
  } catch (e) {
    // 忽略清除失败
  }
}

/**
 * 校验 CSRF token（Synchronizer Token Pattern）
 * 旧 session（KV 中无 csrf_ 记录）自动放行，保持向后兼容
 */
export async function validateCsrfToken(request, env) {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return { valid: false };

  const storedToken = await env.NAV_AUTH.get(`csrf_${sessionToken}`);
  // 旧 session 兼容：KV 无记录则放行
  if (!storedToken) return { valid: true };

  const headerToken = request.headers.get('X-CSRF-Token');
  if (!headerToken) return { valid: false };

  return { valid: timingSafeEqual(headerToken, storedToken) };
}

/**
 * 校验请求来源（Origin / Referer）
 * 用于公开提交接口等不依赖 session CSRF token 的场景
 */
export function validateOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      return new URL(origin).host === url.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).host === url.host;
    } catch {
      return false;
    }
  }
  return false;
}

// 导出中间件(可选,用于添加全局逻辑)
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // Schema 迁移：首页 GET 留给 index.js 里与 KV/DB 读并行执行，避免在 HIT 路径上多一次串行 KV；
  // 其余路径（所有写操作、管理 API、admin 页面等）保留串行 await 以保证 DDL 就绪。
  if (env.NAV_DB) {
    const isHomePageGet = method === 'GET' && url.pathname === '/' && !url.search;
    if (!isHomePageGet) {
      await ensureSchemaReady(env);
    }
  }

  // CSRF 校验：仅对状态变更方法 + /api/* 路径生效
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/config/submit') {
      // 公开提交接口：使用 Origin 校验
      if (!validateOrigin(request)) {
        return errorResponse('Forbidden: invalid origin', 403);
      }
    } else {
      // 管理 API：使用 CSRF token 校验
      const { valid } = await validateCsrfToken(request, env);
      if (!valid) {
        return errorResponse('Forbidden: invalid CSRF token', 403);
      }
    }
  }

  return context.next();
}
