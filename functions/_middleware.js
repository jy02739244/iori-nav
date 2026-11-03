// functions/_middleware.js

import { ensureSchemaReady } from './lib/schema-migration';
import { HOME_CACHE_VERSION, HOME_CACHE_TTL } from './constants';

export const GRAPH_CACHE_GENERATION_KEY = 'graph_cache_generation';

// X-Frame-Options 用 SAMEORIGIN 而不是 DENY：站点偶尔会被自己的页面嵌入
//（例如把首页当仪表盘挂在同域 iframe 里），DENY 会直接白屏。第三方站点仍然
// 无法嵌入，点击劫持防护不受影响。
// CSP 只声明 frame-ancestors：其它指令一旦出现就会连带限制内联脚本/样式，
// 而本站大量依赖内联 script 与 style，必须保持不设默认策略。
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
// 不启用 includeSubDomains：自定义域下面可能存在未启用 HTTPS 的子域，
// 由本站单独声明 HSTS 更安全。
const HSTS_HEADER = 'max-age=31536000';

/**
 * 给 Pages Functions 响应补上安全头。
 * _headers 只作用于静态资源，首页、后台和 /api/* 必须在这里处理。
 */
function withSecurityHeaders(response, requestUrl) {
  const isHttps = new URL(requestUrl).protocol === 'https:';

  // 下游（主要是 _headers 打理的静态资源）已经把该有的头都下发了就直接返回原响应。
  // 静态资源是主要流量，没必要为几个已经存在的头再重包一次 Response。
  const alreadyComplete = Object.keys(SECURITY_HEADERS)
    .every(name => response.headers.has(name))
    && (!isHttps || response.headers.has('Strict-Transport-Security'));

  if (alreadyComplete) return response;

  const secured = new Response(response.body, response);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    // 静态资源可能已经由 _headers 下发同名头，避免重复拼接。
    if (!secured.headers.has(name)) {
      secured.headers.set(name, value);
    }
  }

  // 已经显式声明 HSTS 的响应保持原样，不覆盖上游的选择。
  if (isHttps && !secured.headers.has('Strict-Transport-Security')) {
    secured.headers.set('Strict-Transport-Security', HSTS_HEADER);
  }

  return secured;
}

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
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function getHomeCacheKey(scope, generation = null) {
  const key = `home_html_${scope}_${HOME_CACHE_VERSION}`;
  // 不带 generation 的键只用于清理旧缓存；新首页使用 D1 版本隔离并发回填。
  return generation === null ? key : `${key}_${generation}`;
}

export function getHomeDirtyKey(scope) {
  return `home_dirty_${scope}_${HOME_CACHE_VERSION}`;
}

export async function getHomeCacheDirtyValue(env, scope) {
  try {
    return await env.NAV_AUTH.get(getHomeDirtyKey(scope));
  } catch (e) {
    console.error('Failed to read home cache dirty value:', e);
    // 读不到 dirty 状态时不能当作“干净缓存”，否则可能直接返回旧 HTML。
    throw e;
  }
}

export async function clearHomeCache(env, scope = 'all') {
  try {
    const keys = [];
    const generation = env.NAV_DB ? await getGraphCacheGeneration(env) : null;
    if (env.NAV_DB && generation === null) {
      // 读不到版本就无法确定实际使用的 HTML 键，不能只删旧键后报告成功。
      throw new Error('Failed to read cache generation');
    }

    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeCacheKey('public'));
      if (generation !== null) keys.push(getHomeCacheKey('public', generation));
    }

    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeCacheKey('private'));
      if (generation !== null) keys.push(getHomeCacheKey('private', generation));
    }

    await Promise.all(keys.map(key => env.NAV_AUTH.delete(key)));
  } catch (e) {
    console.error('Failed to clear home cache:', e);
    throw e;
  }
}

// 普通数据写入保留 best-effort 行为，失败后仍可用 KV dirty 标记兜底；
// 强制清缓存传 throwOnError，确保接口不会把版本轮换失败报告为成功。
export async function clearGraphCache(env, { throwOnError = false } = {}) {
  const generation = crypto.randomUUID();

  // KV 对同一个 key 有每秒一次写入限制。generation 元数据放在 D1，避免
  // 多个后台写请求同时失效图谱缓存时，固定 KV key 的写入被限流丢弃。
  if (env?.NAV_DB && typeof env.NAV_DB.prepare === 'function') {
    try {
      await env.NAV_DB
        .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .bind(GRAPH_CACHE_GENERATION_KEY, generation)
        .run();
    } catch (e) {
      console.warn('Failed to clear graph cache:', e);
      if (throwOnError) throw e;
    }
    // 生产环境存在 D1 时，写入失败不能回退到 KV：否则仍可能读到旧 generation。
    return;
  }

  // 仅兼容没有 D1 绑定的测试/旧运行环境。
  if (!env?.NAV_AUTH || typeof env.NAV_AUTH.put !== 'function') return;
  try {
    await env.NAV_AUTH.put(GRAPH_CACHE_GENERATION_KEY, generation);
  } catch (e) {
    console.warn('Failed to clear graph cache:', e);
    if (throwOnError) throw e;
  }
}

export async function getGraphCacheGeneration(env) {
  if (env?.NAV_DB && typeof env.NAV_DB.prepare === 'function') {
    try {
      const result = await env.NAV_DB
        .prepare('SELECT value FROM settings WHERE key = ?')
        .bind(GRAPH_CACHE_GENERATION_KEY)
        .first();
      return result?.value || '0';
    } catch (e) {
      console.warn('Failed to read graph cache generation:', e);
      // D1 可用但 generation 读取失败时跳过缓存，不能回退到旧 KV 指针。
      return null;
    }
  }

  if (!env?.NAV_AUTH || typeof env.NAV_AUTH.get !== 'function') return null;
  try {
    return (await env.NAV_AUTH.get(GRAPH_CACHE_GENERATION_KEY)) || '0';
  } catch (e) {
    console.warn('Failed to read graph cache generation:', e);
    return null;
  }
}

export async function markHomeCacheDirty(env, scope = 'all') {
  // 首页与图谱共用 D1 generation；先轮换版本，使旧渲染只能回填到旧版本的键。
  // KV dirty 标记仍用于设置缓存传播期间的重渲染，以及版本写入失败时的兜底。
  await clearGraphCache(env);

  try {
    const keys = [];
    const dirtyValue = crypto.randomUUID();

    if (scope === 'all' || scope === 'public') {
      keys.push(getHomeDirtyKey('public'));
    }

    if (scope === 'all' || scope === 'private') {
      keys.push(getHomeDirtyKey('private'));
    }

    await Promise.all(
      keys.map(key => env.NAV_AUTH.put(key, dirtyValue, { expirationTtl: HOME_CACHE_TTL }))
    );
  } catch (e) {
    console.error('Failed to mark home cache dirty:', e);

    // dirty 标记写不进去时，直接删 HTML 缓存兜底，避免继续返回旧页面。
    try {
      await clearHomeCache(env, scope);
    } catch (cacheError) {
      console.error('Failed to clear home cache as fallback:', cacheError);
    }
  }
}

function getHomeDirtyKeys(scope) {
  const keys = [];

  if (scope === 'all' || scope === 'public') {
    keys.push(getHomeDirtyKey('public'));
  }

  if (scope === 'all' || scope === 'private') {
    keys.push(getHomeDirtyKey('private'));
  }

  return keys;
}

async function deleteHomeDirtyKeys(env, keys, shouldDelete) {
  try {
    await Promise.all(keys.map(async (key) => {
      if (await shouldDelete(key)) {
        await env.NAV_AUTH.delete(key);
      }
    }));
  } catch (e) {
    console.error('Failed to clear home cache dirty flag:', e);
  }
}

/**
 * 无条件清除首页 dirty 标记。
 * 仅用于管理端强制刷新（缓存清理接口）；渲染回填不要用这个，见下。
 */
export async function clearHomeCacheDirty(env, scope = 'all') {
  await deleteHomeDirtyKeys(env, getHomeDirtyKeys(scope), async () => true);
}

/**
 * 条件清除：只有标记仍等于渲染开始时读到的值才删除。
 * 渲染期间若有新写入更新了标记，这里保留它，避免旧请求误删新的脏状态。
 * @param {string|null} expectedValue - 渲染开始时读到的 dirty 值（无标记时为 null）
 */
export async function clearHomeCacheDirtyIfValue(env, scope, expectedValue) {
  await deleteHomeDirtyKeys(env, getHomeDirtyKeys(scope), async (key) => {
    const latestValue = await env.NAV_AUTH.get(key);
    return latestValue === expectedValue;
  });
}

/**
 * 按渲染前读取的 D1 generation 回填，不依赖 KV 写后立即读回占位 token。
 * 版本变更时跳过无用的写入；即使变更发生在检查之后，旧 HTML 也只写到旧版本的键，
 * 下次请求按新版本读取，因此不会覆盖新页面。初始版本 '0' 同样可以直接回填。
 * @param {string|null} expectedGeneration - 读取失败为 null，此时跳过缓存
 * @returns {Promise<boolean>} 是否真的写入了 HTML
 */
export async function writeHomeCacheIfUnchanged(env, scope, html, expectedGeneration) {
  if (expectedGeneration === null || expectedGeneration === undefined || !env.NAV_DB) return false;

  const latestGeneration = await getGraphCacheGeneration(env);
  if (latestGeneration !== expectedGeneration) return false;

  await env.NAV_AUTH.put(getHomeCacheKey(scope, expectedGeneration), html, { expirationTtl: HOME_CACHE_TTL });
  return true;
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

// 恒定时间比较只用于密码 / token 等短字符串。登录密码来自未认证表单，
// 先限长再编码，避免超长输入迫使 Worker 同时分配 encode 结果、等长 dummy
// 和比较缓冲区，把恒定时间比较变成内存放大点。
// 导出给登录流程做配置校验：KV 里的凭据超过这个长度会永远比对失败。
export const MAX_TIMING_SAFE_INPUT_LENGTH = 4096;

/**
 * 恒定时间字符串比较，防止时序攻击
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length > MAX_TIMING_SAFE_INPUT_LENGTH || b.length > MAX_TIMING_SAFE_INPUT_LENGTH) {
    return false;
  }
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
 */
export async function validateCsrfToken(request, env) {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return { valid: false };

  const storedToken = await env.NAV_AUTH.get(`csrf_${sessionToken}`);
  if (!storedToken) return { valid: false };

  const headerToken = request.headers.get('X-CSRF-Token');
  if (!headerToken) return { valid: false };

  return { valid: timingSafeEqual(headerToken, storedToken) };
}

/**
 * 判断给定来源是否与请求 URL 同源（协议 + host 都相同）
 */
function isSameOrigin(value, url) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === url.protocol && parsed.host === url.host;
  } catch {
    return false;
  }
}

/**
 * 校验请求来源（Origin / Referer）
 * 用于公开提交接口等不依赖 session CSRF token 的场景
 */
export function validateOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin) return isSameOrigin(origin, url);

  const referer = request.headers.get('Referer');
  if (referer) return isSameOrigin(referer, url);

  return false;
}

// 导出中间件(可选,用于添加全局逻辑)
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const respond = (response) => withSecurityHeaders(response, request.url);

  try {
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
          return respond(errorResponse('Forbidden: invalid origin', 403));
        }
      } else {
        // 管理 API：使用 CSRF token 校验
        const { valid } = await validateCsrfToken(request, env);
        if (!valid) {
          return respond(errorResponse('Forbidden: invalid CSRF token', 403));
        }
      }
    }

    return respond(await context.next());
  } catch (e) {
    // 中间件自身或下游抛错时，运行时生成的 500 不会经过 withSecurityHeaders。
    // 统一兜底：错误响应同样带安全头，/api/* 返回 JSON，页面返回最小纯文本。
    // 纯文本 500 会把原始错误页和堆栈挡在门外，因此补一个 errorId：同一条日志里带
    // 同一个 id，用户报错时可以直接对上 Workers 日志。
    const errorId = crypto.randomUUID();
    console.error(`Unhandled middleware error [${errorId}]:`, e);
    if (url.pathname.startsWith('/api/')) {
      const response = respond(errorResponse('Internal Server Error', 500));
      response.headers.set('X-Error-Id', errorId);
      return response;
    }
    return respond(new Response('Internal Server Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Error-Id': errorId,
      },
    }));
  }
}
