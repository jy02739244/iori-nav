
import { isAdminAuthenticated, errorResponse, jsonResponse } from '../_middleware';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // Try to get all settings
    const { results } = await env.NAV_DB.prepare('SELECT key, value FROM settings').all();

    const settings = {};
    if (results) {
      results.forEach(row => {
        // 忽略后端计算字段或调试字段，防止数据库脏数据覆盖
        if (row.key === 'has_api_key' || row.key === 'debug_api_key_info') {
          return;
        }

        // 敏感字段不返回给前端
        if (row.key === 'apiKey') {
          if (row.value && row.value.length > 0) {
            settings['has_api_key'] = true;
          } else {
            settings['has_api_key'] = false;
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
    // If table doesn't exist, return empty settings or try to create it?
    // For GET, just returning empty is fine if it doesn't exist, but we might want to initialize it.
    if (e.message && (e.message.includes('no such table') || e.message.includes('settings'))) {
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

    if (!settings || typeof settings !== 'object') {
      return errorResponse('Invalid settings data', 400);
    }

    // Ensure table exists
    try {
      await env.NAV_DB.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `).run();
    } catch (e) {
      console.error('Failed to ensure settings table:', e);
      // Continue, maybe it exists or error will happen on upsert
    }

    const stmt = env.NAV_DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    const batch = [];
    for (const [key, value] of Object.entries(settings)) {
      // 不要保存临时字段
      if (key === 'has_api_key' || key === 'debug_api_key_info') continue;

      batch.push(stmt.bind(key, String(value)));
    }

    if (batch.length > 0) {
      await env.NAV_DB.batch(batch);
    }

    // 清除 settings 缓存和页面缓存，使新设置立即生效
    try {
      await Promise.all([
        env.NAV_AUTH.delete('settings_cache'),
        env.NAV_AUTH.delete('home_html_private'),
        env.NAV_AUTH.delete('home_html_public'),
      ]);
    } catch (e) {
      console.warn('Failed to clear caches:', e);
    }

    return jsonResponse({
      code: 200,
      message: 'Settings saved'
    });
  } catch (e) {
    return errorResponse(`Failed to save settings: ${e.message}`, 500);
  }
}
