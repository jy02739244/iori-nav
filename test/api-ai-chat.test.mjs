import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost, runWithTimeout } from '../functions/api/ai-chat.js';
import { DEFAULT_WORKERS_AI_MODEL } from '../functions/lib/workers-ai-models.js';

function createKv(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
  };
}

function createDb(initialSettings = {}) {
  const store = new Map(Object.entries(initialSettings));
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              if (sql.includes('SELECT key, value FROM settings WHERE key IN')) {
                return {
                  results: params
                    .filter(key => store.has(key))
                    .map(key => ({ key, value: store.get(key) })),
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function createRequest(body) {
  return new Request('https://example.com/api/ai-chat', {
    method: 'POST',
    headers: {
      Cookie: 'admin_session=token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('POST /api/ai-chat uses the saved Workers AI model first', async () => {
  const savedModel = '@cf/meta/llama-3.1-8b-instruct';
  const runCalls = [];
  const response = await onRequestPost({
    request: createRequest({
      messages: [{ role: 'user', content: '生成描述' }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({
        provider: 'workers-ai',
        model: savedModel,
      }),
      WORKERS_AI_MODEL: '@cf/meta/llama-3-8b-instruct',
      AI: {
        async run(model, payload) {
          runCalls.push({ model, payload });
          return { response: '测试描述' };
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(body.data, '测试描述');
  assert.equal(runCalls[0].model, savedModel);
});

test('POST /api/ai-chat falls back to the default Workers AI model', async () => {
  const runCalls = [];
  const response = await onRequestPost({
    request: createRequest({
      messages: [{ role: 'user', content: '生成描述' }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({ provider: 'workers-ai' }),
      AI: {
        async run(model, payload) {
          runCalls.push({ model, payload });
          return { response: '默认描述' };
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(body.data, '默认描述');
  assert.equal(runCalls[0].model, DEFAULT_WORKERS_AI_MODEL);
});

test('POST /api/ai-chat extracts content from Workers AI chat completion responses', async () => {
  const savedModel = '@cf/google/gemma-4-26b-a4b-it';
  const response = await onRequestPost({
    request: createRequest({
      messages: [{ role: 'user', content: '生成描述' }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({
        provider: 'workers-ai',
        model: savedModel,
      }),
      AI: {
        async run() {
          return {
            choices: [{
              message: {
                content: '提供多种在线实用工具、开发助手及格式转换功能的综合平台。',
                reasoning: '这里是模型思考内容，不应返回给前端。',
              },
            }],
            model: savedModel,
            object: 'chat.completion',
          };
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(body.data, '提供多种在线实用工具、开发助手及格式转换功能的综合平台。');
});

test('POST /api/ai-chat extracts a short bookmark description from verbose reasoning output', async () => {
  const response = await onRequestPost({
    request: createRequest({
      responseFormat: 'bookmark-description',
      messages: [{ role: 'user', content: '生成描述' }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({
        provider: 'workers-ai',
        model: '@cf/qwen/qwq-32b',
      }),
      AI: {
        async run() {
          return {
            response: [
              '好的，我需要为书签“mac毒”生成一个简洁的中文描述，不超过30字。',
              '',
              '首先，分析名称中的“mac”明确是针对苹果Mac用户的。而“毒”可能有双关含义。',
              '',
              '然后，要确保描述简洁，不超过30字。可能的组合：“Mac软件下载与资源分享平台”。',
              '',
              '再检查字数，“Mac软件资源下载平台"',
            ].join('\n'),
          };
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.equal(body.data, 'Mac软件资源下载平台');
});

test('POST /api/ai-chat does not return verbose reasoning when no description can be extracted', async () => {
  const response = await onRequestPost({
    request: createRequest({
      responseFormat: 'bookmark-description',
      messages: [{ role: 'user', content: '生成描述' }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({
        provider: 'workers-ai',
        model: '@cf/qwen/qwq-32b',
      }),
      AI: {
        async run() {
          return {
            response: '好的，我需要分析这个书签。首先看名称，然后看链接，因此可能需要生成一个描述。',
          };
        },
      },
    },
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.code, 500);
  assert.match(body.message, /did not include generated content/);
});

test('POST /api/ai-chat extracts bookmark JSON from verbose model output', async () => {
  const response = await onRequestPost({
    request: createRequest({
      responseFormat: 'bookmark-json',
      messages: [{ role: 'user', content: '生成名称和描述' }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({
        provider: 'workers-ai',
        model: '@cf/qwen/qwq-32b',
      }),
      AI: {
        async run() {
          return {
            response: [
              '我先分析这个链接，然后给出最终 JSON。',
              '{"name":"1024tools","description":"在线实用工具与开发助手平台"}',
            ].join('\n'),
          };
        },
      },
    },
  });
  const body = await response.json();
  const parsed = JSON.parse(body.data);

  assert.equal(response.status, 200, body.message);
  assert.equal(body.code, 200);
  assert.deepEqual(parsed, {
    name: '1024tools',
    description: '在线实用工具与开发助手平台',
  });
});

test('POST /api/ai-chat rejects too many messages before calling the provider', async () => {
  const response = await onRequestPost({
    request: createRequest({
      messages: Array.from({ length: 51 }, () => ({ role: 'user', content: 'x' })),
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({ provider: 'workers-ai' }),
    },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.message, /cannot exceed 50 entries/);
});

test('POST /api/ai-chat rejects oversized message content', async () => {
  const response = await onRequestPost({
    request: createRequest({
      messages: [{ role: 'user', content: 'x'.repeat(100001) }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({ provider: 'workers-ai' }),
    },
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.match(body.message, /cannot exceed 100000 characters/);
});

test('POST /api/ai-chat counts non-text parts toward the size limit', async () => {
  const response = await onRequestPost({
    request: createRequest({
      messages: [{
        role: 'user',
        content: [{
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${'x'.repeat(100000)}` },
        }],
      }],
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({ provider: 'workers-ai' }),
    },
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.match(body.message, /cannot exceed 100000 characters/);
});

test('POST /api/ai-chat rejects oversized bodies before parsing them', async () => {
  // 单条超长消息在解析后才能被字符数统计挡住；这条用例走 Content-Length 预检，
  // 保证超大 body 不会先被 JSON.parse 吃进内存。
  const bigBody = JSON.stringify({
    messages: [{ role: 'user', content: 'x'.repeat(300 * 1024) }],
  });

  const response = await onRequestPost({
    request: new Request('https://example.com/api/ai-chat', {
      method: 'POST',
      headers: {
        Cookie: 'admin_session=token',
        'Content-Type': 'application/json',
      },
      body: bigBody,
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({ provider: 'workers-ai' }),
    },
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.match(body.message, /body too large/i);
});

test('POST /api/ai-chat rejects oversized chunked bodies without Content-Length', async () => {
  // 分块上传不带 Content-Length，只能边读边计数；流足够大时必须在读完整 body
  // 之前就被打断并返回 413，而不是等解析完再靠字符数校验兜底。
  const encoder = new TextEncoder();
  const chunkA = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(150 * 1024) }] });
  const chunkB = 'y'.repeat(150 * 1024);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(chunkA));
      controller.enqueue(encoder.encode(chunkB));
      controller.close();
    },
  });

  const response = await onRequestPost({
    request: new Request('https://example.com/api/ai-chat', {
      method: 'POST',
      headers: {
        Cookie: 'admin_session=token',
        'Content-Type': 'application/json',
      },
      body,
      duplex: 'half',
    }),
    env: {
      NAV_AUTH: createKv({ session_token: '1' }),
      NAV_DB: createDb({ provider: 'workers-ai' }),
    },
  });
  const result = await response.json();

  assert.equal(response.status, 413);
  assert.match(result.message, /body too large/i);
});

test('POST /api/ai-chat turns a broken request body into 400 instead of 500', async () => {
  // 客户端中途断开 / 连接被重置：这属于调用方的问题，不能变成 500，
  // 也不该把底层错误文本（Server Error: ...）回给调用方。
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('{"messages":['));
      controller.error(new Error('connection reset by peer'));
    },
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const response = await onRequestPost({
      request: new Request('https://example.com/api/ai-chat', {
        method: 'POST',
        headers: {
          Cookie: 'admin_session=token',
          'Content-Type': 'application/json',
        },
        body,
        duplex: 'half',
      }),
      env: {
        NAV_AUTH: createKv({ session_token: '1' }),
        NAV_DB: createDb({ provider: 'workers-ai' }),
      },
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.message, /Failed to read request body/);
  } finally {
    console.warn = originalWarn;
  }
});

test('runWithTimeout rejects stalled AI calls with TimeoutError', async () => {
  assert.equal(await runWithTimeout(Promise.resolve('ok'), 50), 'ok');

  await assert.rejects(
    runWithTimeout(new Promise(() => {}), 10),
    (error) => {
      assert.equal(error.name, 'TimeoutError');
      return true;
    }
  );
});
