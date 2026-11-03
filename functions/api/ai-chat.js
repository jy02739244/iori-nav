import { isAdminAuthenticated, errorResponse, jsonResponse } from '../_middleware';
import { resolveWorkersAiModel } from '../lib/workers-ai-models';

// 超时必须明显小于平台侧的请求上限，否则平台会先返回它自己的错误页，
// 我们写的 504「AI 请求超时」永远不会被用户看到。25 秒留出安全余量。
const AI_REQUEST_TIMEOUT_MS = 25000;
const AI_MAX_MESSAGES = 50;

// 体积相关的失败一律返回 413（Content Too Large），结构问题（条数、类型）才返回 400，
// 避免同一个「太大了」在两种状态下表现不一致。
//
// 两层上限各管一件事，量纲不同，不要互相换算：
//   1. AI_MAX_BODY_BYTES —— 传输层硬上限，只做 DoS 盾牌，按原始 UTF-8 字节算；
//   2. AI_MAX_TOTAL_CHARS —— 业务上限，按 messages 序列化后的字符数（UTF-16 码元）算，
//      覆盖 image_url / base64 等非文本 part。
// 因此「字符数不超标」并不保证「body 不超标」：中文等 BMP 字符在 UTF-8 里占 3 字节，
// 10 万字符的中文消息序列化后约 300 KB，会先撞上 256 KB 的 body 上限；带大量缩进
// 空白的 JSON 同理。两条路径都返回 413，客户端按「太大了」统一处理即可。
const AI_MAX_TOTAL_CHARS = 100000;
const AI_MAX_BODY_BYTES = 256 * 1024;

/**
 * 给不返回 AbortSignal 的 AI 调用加超时保护。
 * 超时后底层调用可能仍会继续，但至少请求会及时返回 504。
 */
export function runWithTimeout(promise, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
    let timer;

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error('AI request timed out');
            error.name = 'TimeoutError';
            reject(error);
        }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * 带字节上限地读取请求体。
 * 分块上传没有 Content-Length，不能等整个 body 读完再判断：这里边读边计数，
 * 超限立即取消流并返回，避免超大上传被完整读进内存。
 * @returns {Promise<{text?: string, tooLarge?: boolean, failed?: boolean}>}
 */
async function readBodyWithLimit(request, maxBytes) {
    if (!request.body) return { text: '' };

    const reader = request.body.getReader();
    const chunks = [];
    let total = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            total += value.byteLength;
            if (total > maxBytes) {
                // 主动取消，不再把剩余内容拉进内存；取消失败不影响 413 结果
                await reader.cancel().catch(() => {});
                return { tooLarge: true };
            }
            chunks.push(value);
        }
    } catch (e) {
        // 客户端中断、连接被重置都走这里。这不是服务端故障，也不该让底层错误文本
        // 顺着 500 响应回到调用方，所以单独标成 failed 交给上层转 400。
        await reader.cancel().catch(() => {});
        console.warn('Failed to read AI request body:', e);
        return { failed: true };
    }

    if (chunks.length === 0) return { text: '' };

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return { text: new TextDecoder().decode(merged) };
}

function getMessageContentText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    return content
        .map(part => {
            if (typeof part === 'string') return part;
            if (typeof part?.text === 'string') return part.text;
            return '';
        })
        .join('');
}

function extractWorkersAiText(response) {
    if (typeof response === 'string') return response;
    if (!response || typeof response !== 'object') return '';

    if (typeof response.response === 'string') {
        return response.response;
    }

    const choiceContent = response.choices?.[0]?.message?.content;
    const choiceText = getMessageContentText(choiceContent);
    if (choiceText) return choiceText;

    if (typeof response.result?.response === 'string') {
        return response.result.response;
    }

    return '';
}

function stripMarkdownFence(text) {
    return String(text || '')
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim();
}

function stripEnclosingQuotes(text) {
    return String(text || '')
        .trim()
        .replace(/^[\s"'“”‘’`]+/, '')
        .replace(/[\s"'“”‘’`]+$/, '')
        .trim();
}

function sanitizeDescriptionCandidate(candidate) {
    return stripEnclosingQuotes(candidate)
        .replace(/^(?:[-*•]|\d+[.)、])\s*/, '')
        .replace(/^(?:最终(?:答案|描述|结果)|答案|描述|简介|Selected description)\s*[:：]\s*/i, '')
        .trim();
}

function isLikelyDescription(candidate) {
    const text = sanitizeDescriptionCandidate(candidate);
    if (!text || text.length < 4 || text.length > 80) return false;
    if (/https?:\/\//i.test(text)) return false;
    if (!/[\u4e00-\u9fffA-Za-z]/.test(text)) return false;
    if (/(我需要|首先|然后|接下来|因此|可能|假设|分析|检查字数|用户|书签名称|链接是|不超过|生成|例如|或者|考虑到|所以)/.test(text)) {
        return false;
    }
    return true;
}

function parseJsonDescription(text) {
    try {
        const parsed = JSON.parse(stripMarkdownFence(text));
        if (typeof parsed?.description === 'string') {
            return sanitizeDescriptionCandidate(parsed.description);
        }
    } catch {
        // Not JSON; continue with text extraction.
    }
    return '';
}

function normalizeBookmarkJson(parsed) {
    if (!parsed || typeof parsed !== 'object' || typeof parsed.description !== 'string') {
        return '';
    }

    const name = stripEnclosingQuotes(parsed.name || '');
    const description = sanitizeDescriptionCandidate(parsed.description);
    if (!description) return '';

    return JSON.stringify({
        name: name.slice(0, 20),
        description,
    });
}

function extractBookmarkJson(text) {
    const content = stripMarkdownFence(text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    try {
        const normalized = normalizeBookmarkJson(JSON.parse(content));
        if (normalized) return normalized;
    } catch {
        // Not a standalone JSON object; try to find one in the response text.
    }

    const matches = content.match(/\{[\s\S]*?\}/g) || [];
    for (let i = matches.length - 1; i >= 0; i--) {
        try {
            const normalized = normalizeBookmarkJson(JSON.parse(matches[i]));
            if (normalized) return normalized;
        } catch {
            // Keep scanning earlier JSON-looking fragments.
        }
    }

    return '';
}

function extractLabeledDescription(text) {
    const pattern = /(?:最终(?:答案|描述|结果)|答案|描述|简介|Selected description)\s*[:：]\s*([^\n]+)/gi;
    let match;
    let candidate = '';

    while ((match = pattern.exec(text)) !== null) {
        candidate = match[1];
    }

    candidate = sanitizeDescriptionCandidate(candidate);
    return isLikelyDescription(candidate) ? candidate : '';
}

function extractQuotedDescription(text) {
    const pattern = /["“‘]([^"”’\n]{4,80})["”’]?/g;
    let match;
    let candidate = '';

    while ((match = pattern.exec(text)) !== null) {
        const value = sanitizeDescriptionCandidate(match[1]);
        if (isLikelyDescription(value)) {
            candidate = value;
        }
    }

    return candidate;
}

function extractLineDescription(text) {
    const lines = text
        .split(/\r?\n/)
        .map(line => sanitizeDescriptionCandidate(line))
        .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
        if (isLikelyDescription(lines[i])) return lines[i];
    }

    return '';
}

function extractBookmarkDescription(text) {
    const content = stripMarkdownFence(text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const wholeContent = sanitizeDescriptionCandidate(content);

    return parseJsonDescription(content)
        || extractLabeledDescription(content)
        || extractQuotedDescription(content)
        || extractLineDescription(content)
        || (isLikelyDescription(wholeContent) ? wholeContent : '');
}

function formatAiContent(content, responseFormat) {
    if (responseFormat === 'bookmark-description') {
        return extractBookmarkDescription(content);
    }
    if (responseFormat === 'bookmark-json') {
        return extractBookmarkJson(content);
    }
    return content;
}

export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. 权限检查：必须是登录管理员
    if (!(await isAdminAuthenticated(request, env))) {
        return errorResponse('Unauthorized', 401);
    }

    try {
        // 解析前先按声明长度挡一层（正常请求都带 Content-Length）。
        const declaredBytes = Number(request.headers.get('Content-Length'));
        if (Number.isFinite(declaredBytes) && declaredBytes > AI_MAX_BODY_BYTES) {
            return errorResponse('Request body too large', 413);
        }

        // 分块上传拿不到 Content-Length：边读边计数，超限立即中断并返回 413，
        // 不让超大 body 被完整读进内存后再被 JSON.parse + stringify 放大。
        const bodyResult = await readBodyWithLimit(request, AI_MAX_BODY_BYTES);
        if (bodyResult.tooLarge) {
            return errorResponse('Request body too large', 413);
        }
        if (bodyResult.failed) {
            return errorResponse('Failed to read request body', 400);
        }

        let payload;
        try {
            payload = JSON.parse(bodyResult.text);
        } catch {
            return errorResponse('Invalid JSON body', 400);
        }

        // 顶层不是对象时（null / 数组 / 标量）按空对象处理，交给下面的校验报错
        const { messages, responseFormat } = payload && typeof payload === 'object' ? payload : {};

        if (!messages || !Array.isArray(messages)) {
            return errorResponse('Messages array is required', 400);
        }

        if (messages.length > AI_MAX_MESSAGES) {
            return errorResponse(`Messages cannot exceed ${AI_MAX_MESSAGES} entries`, 400);
        }

        // 按序列化体积统计，覆盖 image_url / base64 等非文本 part，
        // 避免只统计 text 字段时被图片内容绕过上限。与传输层上限一致用 413，
        // 客户端只要记住「太大了就收 413」即可。
        const totalChars = JSON.stringify(messages).length;
        if (totalChars > AI_MAX_TOTAL_CHARS) {
            return errorResponse(`Messages cannot exceed ${AI_MAX_TOTAL_CHARS} characters`, 413);
        }

        // 2. 从数据库读取 AI 设置
        const keys = ['provider', 'apiKey', 'baseUrl', 'model'];
        const { results } = await env.NAV_DB.prepare(
            `SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`
        ).bind(...keys).all();

        const settings = {};
        if (results) {
            results.forEach(row => {
                settings[row.key] = row.value;
            });
        }

        const provider = settings.provider || 'workers-ai';
        const apiKey = settings.apiKey;
        const baseUrl = settings.baseUrl;
        const model = settings.model;

        // 3. 根据不同的服务商处理请求
        if (provider === 'workers-ai') {
            if (!env.AI) {
                return errorResponse('Workers AI binding (env.AI) not found', 500);
            }
            // Workers AI 优先使用后台保存的模型，环境变量作为部署级兜底。
            const workerModel = resolveWorkersAiModel(model, env.WORKERS_AI_MODEL);
            const response = await runWithTimeout(env.AI.run(workerModel, { messages }));
            const content = formatAiContent(extractWorkersAiText(response), responseFormat);
            if (!content) {
                return errorResponse('Workers AI response did not include generated content', 500);
            }
            return jsonResponse({
                code: 200,
                data: content
            });

        } else if (provider === 'openai') {
            if (!apiKey) return errorResponse('OpenAI API Key 未在设置中配置', 500);
            if (!baseUrl) return errorResponse('OpenAI Base URL 未在设置中配置', 500);

            const openaiUrl = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
            const aiResponse = await fetch(openaiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                body: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: 0.7
                })
            });

            if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                return errorResponse(`OpenAI API Error: ${errText}`, 500);
            }

            const data = await aiResponse.json();
            const content = formatAiContent(data.choices?.[0]?.message?.content || '', responseFormat);
            return jsonResponse({
                code: 200,
                data: content
            });

        } else if (provider === 'gemini') {
            if (!apiKey) return errorResponse('Gemini API Key 未在设置中配置', 500);

            const geminiModel = model || 'gemini-1.5-flash';
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

            // 将 OpenAI 格式的 messages 转换为 Gemini 格式
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }));

            const systemMsg = messages.find(m => m.role === 'system');

            const payload = {
                contents: contents,
                generationConfig: { temperature: 0.7 }
            };

            if (systemMsg) {
                payload.systemInstruction = { parts: [{ text: systemMsg.content }] };
            }

            const aiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
                body: JSON.stringify(payload)
            });

            if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                return errorResponse(`Gemini API Error: ${errText}`, 500);
            }

            const data = await aiResponse.json();
            const content = formatAiContent(data.candidates?.[0]?.content?.parts?.[0]?.text || '', responseFormat);

            return jsonResponse({
                code: 200,
                data: content
            });

        } else {
            return errorResponse(`Unsupported provider: ${provider}`, 400);
        }

    } catch (e) {
        console.error('AI Chat API error:', e);
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
            return errorResponse('AI 请求超时，请稍后重试', 504);
        }
        return errorResponse(`Server Error: ${e.message}`, 500);
    }
}
