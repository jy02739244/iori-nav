const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function getTurnstileConfig(env = {}) {
  const siteKey = String(env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = String(env.TURNSTILE_SECRET_KEY || '').trim();
  return {
    siteKey,
    secretKey,
    isConfigured: Boolean(siteKey || secretKey),
    isComplete: Boolean(siteKey && secretKey),
  };
}

export async function verifyTurnstileToken(token, env, ip) {
  const { secretKey, isConfigured, isComplete } = getTurnstileConfig(env);

  if (!isConfigured) {
    return { ok: true };
  }

  if (!isComplete) {
    return { ok: false, message: 'Turnstile 配置不完整，请检查环境变量' };
  }

  if (!token) {
    return { ok: false, message: '请先完成人机验证' };
  }

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip && ip !== 'unknown') {
    formData.append('remoteip', ip);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      return { ok: false, message: '人机验证失败，请重试' };
    }

    return { ok: true };
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return { ok: false, message: '人机验证服务暂时不可用，请稍后重试' };
  }
}
