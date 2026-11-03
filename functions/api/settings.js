
import { isAdminAuthenticated, errorResponse, jsonResponse, markHomeCacheDirty } from '../_middleware';
import { getSettingsKeys, normalizeSettingValueForStorage } from '../lib/settings-parser';
import { sanitizeUrl } from '../lib/utils';
import { validateOpaqueText } from '../lib/validators';

const LAYOUT_SETTING_KEYS = new Set(getSettingsKeys());
const AI_SETTING_KEYS = new Set(['provider', 'apiKey', 'baseUrl', 'model']);
// WebDAV 配置刻意不进 SETTINGS_SCHEMA：那份 schema 会被公开接口 /api/public-config 整体吐出去
const WEBDAV_SETTING_KEYS = new Set(['webdav_url', 'webdav_username', 'webdav_password', 'webdav_dir']);
const IGNORED_SETTING_KEYS = new Set(['has_api_key', 'debug_api_key_info', 'has_webdav_password']);
const ALLOWED_PROVIDERS = new Set(['workers-ai', 'gemini', 'openai']);

// 读取白名单是静态的：提前序列化一次，避免每次 GET 都重建数组并重新 stringify。
// 用单个 JSON 参数展开 IN 列表，既能绕开 D1 单查询 100 个绑定参数的上限，
// 也仍然命中 settings.key 主键索引。
const SETTINGS_READ_KEYS_JSON = JSON.stringify([
  ...LAYOUT_SETTING_KEYS,
  ...AI_SETTING_KEYS,
  ...WEBDAV_SETTING_KEYS,
]);

function normalizeWebdavSettingValue(key, value) {
  // 密码属于不透明凭据，首尾空格可能是密码本身的一部分，不能做 trim。
  const rawText = String(value ?? '');
  const text = key === 'webdav_password' ? rawText : rawText.trim();

  if (key === 'webdav_url') {
    if (!text) return { ok: true, value: '' };
    const safeUrl = sanitizeUrl(text);
    if (!safeUrl) return { ok: false, message: 'Invalid webdav_url' };

    const parsed = new URL(safeUrl);
    // WebDAV 请求会携带 Basic 凭据，备份内容还可能包含私密书签，禁止明文传输。
    if (parsed.protocol !== 'https:') {
      return { ok: false, message: 'webdav_url must use HTTPS' };
    }
    // Fetch 标准禁止请求 URL userinfo；账号密码必须使用独立字段保存，
    // 同时避免异常信息回显 URL 时泄露内嵌凭据。
    if (parsed.username || parsed.password) {
      return { ok: false, message: 'webdav_url must not contain credentials' };
    }

    return { ok: true, value: safeUrl };
  }

  if (key === 'webdav_dir') {
    if (!validateOpaqueText(text, 200).ok) {
      return { ok: false, message: 'Invalid webdav_dir' };
    }
    // 反斜杠不是 WebDAV 路径分隔符，但 Windows 系服务端可能据此解析目录，
    // 一律拒绝，避免 ..\..\x 绕过下面的路径穿越检查
    if (text.includes('\\')) {
      return { ok: false, message: 'Invalid webdav_dir' };
    }
    // 编码后的分隔符：部分服务端可能二次解码 %2f 为 /，%5c 为 \，
    // 结合 .. 段可绕过上面的 split('/') 检查
    if (/%(?:2f|5c)/i.test(text)) {
      return { ok: false, message: 'Invalid webdav_dir' };
    }
    // 拒绝路径穿越，避免写到备份目录以外的位置
    if (text.split('/').some(segment => segment.trim() === '..')) {
      return { ok: false, message: 'Invalid webdav_dir' };
    }
    return { ok: true, value: text };
  }

  if (key === 'webdav_username') {
    if (!validateOpaqueText(text, 256).ok) {
      return { ok: false, message: 'Invalid webdav_username' };
    }
    return { ok: true, value: text };
  }

  if (key === 'webdav_password') {
    // 首尾空格可能是密码本身的一部分，不能做 trim；
    // validateOpaqueText 内部统一处理 String(value ?? '')，这里用它已经算好的 rawText
    const normalized = validateOpaqueText(rawText, 512);
    if (!normalized.ok) {
      return { ok: false, message: 'Invalid webdav_password' };
    }
    return { ok: true, value: normalized.value };
  }

  return { ok: false, message: `Unknown setting key: ${key}` };
}

function normalizeAiSettingValue(key, value) {
  const text = String(value ?? '').trim();

  if (key === 'provider') {
    return ALLOWED_PROVIDERS.has(text)
      ? { ok: true, value: text }
      : { ok: false, message: 'Invalid provider' };
  }

  if (key === 'baseUrl') {
    if (!text) return { ok: true, value: '' };
    const safeUrl = sanitizeUrl(text);
    return safeUrl
      ? { ok: true, value: safeUrl.replace(/\/+$/, '') }
      : { ok: false, message: 'Invalid baseUrl' };
  }

  if (key === 'model') {
    if (!validateOpaqueText(text, 200).ok) {
      return { ok: false, message: 'Invalid model' };
    }
    return { ok: true, value: text };
  }

  if (key === 'apiKey') {
    if (!validateOpaqueText(text, 4096).ok) {
      return { ok: false, message: 'Invalid apiKey' };
    }
    return { ok: true, value: text };
  }

  return { ok: false, message: `Unknown setting key: ${key}` };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // 只读取接口会返回的设置项，避免把 graph_cache_generation 等内部键带进来。
    // 白名单在模块加载时已序列化，这里只做一次 bind。
    const { results } = await env.NAV_DB
      .prepare('SELECT key, value FROM settings WHERE key IN (SELECT value FROM json_each(?))')
      .bind(SETTINGS_READ_KEYS_JSON)
      .all();

    const settings = {};
    if (results) {
      results.forEach(row => {
        // 双重校验：SQL 已按白名单过滤过一遍，这里再挡一次数据库脏数据，
        // 同时排除 has_api_key 这类由后端计算、不应直接下发的字段。
        if (!LAYOUT_SETTING_KEYS.has(row.key) && !AI_SETTING_KEYS.has(row.key) && !WEBDAV_SETTING_KEYS.has(row.key)) {
          return;
        }

        // 敏感字段不返回给前端
        if (row.key === 'apiKey' || row.key === 'webdav_password') {
          if (row.value && row.value.length > 0) {
            settings[row.key === 'apiKey' ? 'has_api_key' : 'has_webdav_password'] = true;
          } else {
            settings[row.key === 'apiKey' ? 'has_api_key' : 'has_webdav_password'] = false;
          }
        } else {
          settings[row.key] = row.value;
        }
      });
    }


    return jsonResponse({
      code: 200,
      data: settings
    });
  } catch (e) {
    // 表还没建出来（首次部署 / 迁移未完成）时返回空设置，让后台显示默认值而不是报错。
    // 这里只认 'no such table'：判断条件放宽到 'settings' 会被 SQL 语句自身的字样命中，
    // 把超时、绑定错误之类的真实故障也伪装成「还没有配置」，故障就此静默。
    if (e.message && e.message.includes('no such table')) {
      return jsonResponse({
        code: 200,
        data: {} // No settings yet
      });
    }
    return errorResponse(`Failed to fetch settings: ${e.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const settings = body; // Expecting object { key: value, key2: value2 }

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return errorResponse('Invalid settings data', 400);
    }

    const normalizedEntries = [];
    for (const [key, value] of Object.entries(settings)) {
      // 不要保存临时字段
      if (IGNORED_SETTING_KEYS.has(key)) continue;

      // 秘密字段统一三态语义，靠请求形状区分，不用带内哨兵值：
      //   null   → 显式清除
      //   ''     → 不修改（前端每次加载都会清空密码 / key 输入框，不能让它覆盖已存密钥）
      //   其他   → 写入新值
      // 两个字段必须共用同一套规则：否则同一个接口里「清空 AI key」和「保留 WebDAV 密码」
      // 会是相反的约定，直接调 API 的场景很容易把 key 洗掉。
      // 用 '__CLEAR__' 之类的字符串做哨兵会吞掉恰好等于该值的合法密钥，
      // 且前后端各写一份字面量时改一边就会把清除动作变成「把密钥设成哨兵值」。
      if (key === 'apiKey' || key === 'webdav_password') {
        if (value === null) {
          normalizedEntries.push([key, '']);
          continue;
        }
        if (String(value ?? '') === '') {
          continue;
        }
      }

      let normalized;
      if (LAYOUT_SETTING_KEYS.has(key)) {
        normalized = normalizeSettingValueForStorage(key, value);
      } else if (AI_SETTING_KEYS.has(key)) {
        normalized = normalizeAiSettingValue(key, value);
      } else if (WEBDAV_SETTING_KEYS.has(key)) {
        normalized = normalizeWebdavSettingValue(key, value);
      } else {
        return errorResponse(`Invalid setting key: ${key}`, 400);
      }

      if (!normalized.ok) {
        return errorResponse(normalized.message, 400);
      }

      normalizedEntries.push([key, normalized.value]);
    }

    let changedEntries = normalizedEntries;
    if (normalizedEntries.length > 0) {
      const keys = normalizedEntries.map(([key]) => key);
      const placeholders = keys.map(() => '?').join(',');
      const { results = [] } = await env.NAV_DB
        .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
        .bind(...keys)
        .all();
      const existingSettings = new Map(results.map(row => [row.key, row.value]));

      changedEntries = normalizedEntries.filter(([key, value]) => existingSettings.get(key) !== value);
    }

    if (changedEntries.length > 0) {
      const stmt = env.NAV_DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      await env.NAV_DB.batch(changedEntries.map(([key, value]) => stmt.bind(key, value)));
    }

    // 保存成功后刷新设置缓存和首页缓存，避免旧缓存状态阻止设置生效。
    // 这里刻意看提交的 key 而不是 changedEntries：值没变也刷，是为了兜住
    // 「DB 与缓存不一致导致用户怎么改都不生效」的情况。
    // 但 WebDAV 与 AI 配置都不进 SETTINGS_SCHEMA，index.js 的首页查询按
    // getSettingsKeys() 过滤，所以这些 key 既不在 settings_cache 里也不影响 SSR
    // 输出 —— 只改它们时刷缓存纯属浪费，会让访客侧白等一次重新渲染。
    const touchesRenderedSettings = normalizedEntries.some(
      ([key]) => !WEBDAV_SETTING_KEYS.has(key) && !AI_SETTING_KEYS.has(key)
    );

    if (touchesRenderedSettings) {
      try {
        await Promise.all([
          env.NAV_AUTH.delete('settings_cache'),
          markHomeCacheDirty(env, 'all'),
        ]);
      } catch (e) {
        console.warn('Failed to clear caches:', e);
      }
    }

    return jsonResponse({
      code: 200,
      message: 'Settings saved'
    });
  } catch (e) {
    return errorResponse(`Failed to save settings: ${e.message}`, 500);
  }
}
