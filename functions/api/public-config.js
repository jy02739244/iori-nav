// functions/api/public-config.js
import { jsonResponse } from '../_middleware';
import { getSettingsKeys, parseSettings } from '../lib/settings-parser';
import { getTurnstileConfig } from '../lib/turnstile';

/**
 * @summary Get public configuration settings
 * @route GET /api/public-config
 * @returns {Response} JSON response with public settings
 */
export async function onRequestGet({ env }) {
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';
  const turnstileConfig = getTurnstileConfig(env);

  const aiRequestDelay = parseInt(env.AI_REQUEST_DELAY, 10);
  const validAiRequestDelay = !isNaN(aiRequestDelay) && aiRequestDelay > 0 ? aiRequestDelay : 1500;

  // 复用 settings-parser 模块获取布局设置
  let layoutSettings = {};
  try {
    const keys = getSettingsKeys();
    const placeholders = keys.map(() => '?').join(',');
    const { results } = await env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).bind(...keys).all();
    layoutSettings = parseSettings(results);
  } catch (e) {
    // 表不存在时使用默认值
    layoutSettings = parseSettings([]);
  }

  return jsonResponse({
    submissionEnabled,
    turnstileSiteKey: turnstileConfig.siteKey,
    aiRequestDelay: validAiRequestDelay,
    ...layoutSettings
  });
}
