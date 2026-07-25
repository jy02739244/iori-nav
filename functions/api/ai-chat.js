import { isAdminAuthenticated, errorResponse, jsonResponse } from '../_middleware';
import { resolveWorkersAiModel } from '../lib/workers-ai-models';

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
        const { messages, responseFormat } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return errorResponse('Messages array is required', 400);
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
            const response = await env.AI.run(workerModel, { messages });
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
        return errorResponse(`Server Error: ${e.message}`, 500);
    }
}
