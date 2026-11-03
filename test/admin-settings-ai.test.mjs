import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadAiModule({ apiKeyValue = '', hasApiKey = true, confirmResult = true } = {}) {
  const elements = {
    apiKey: { value: apiKeyValue, placeholder: hasApiKey ? '已配置 (如需修改请直接输入)' : '请输入 API Key' },
    clearApiKeyBtn: { disabled: false, style: {} },
  };
  const confirmTexts = [];
  const fetchCalls = [];
  const messages = [];

  const sandbox = {
    document: {
      getElementById: id => elements[id] ?? null,
    },
    fetch: async (url, init) => {
      fetchCalls.push({ url, ...init });
      return { ok: true, json: async () => ({ code: 200 }) };
    },
    window: {
      confirm: text => {
        confirmTexts.push(text);
        return confirmResult;
      },
      showMessage: (message, type) => messages.push({ message, type }),
      AdminSettings: { currentSettings: { has_api_key: hasApiKey } },
    },
  };

  const source = readFileSync(resolve('public/js/admin-settings-ai.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'public/js/admin-settings-ai.js' });

  return { ai: sandbox.window.AdminSettings.ai, elements, confirmTexts, fetchCalls, messages };
}

test('清除 API Key 后输入框与占位文案一起复位', async () => {
  const { ai, elements, confirmTexts, fetchCalls, messages } = loadAiModule({ apiKeyValue: 'sk-typed' });

  await ai.clearApiKey();

  assert.deepEqual(JSON.parse(fetchCalls[0].body), { apiKey: null }, '应发送 null 表示显式清除');
  assert.equal(elements.apiKey.value, '');
  assert.equal(
    elements.apiKey.placeholder,
    '请输入 API Key',
    '占位文案必须跟着清空，否则界面仍显示「已配置」'
  );
  assert.equal(elements.clearApiKeyBtn.style.display, 'none', '清除后按钮应隐藏');
  assert.ok(confirmTexts[0].includes('没保存'), '输入框里有未保存的密钥时要提示它也会被丢弃');
  assert.equal(messages.at(-1).type, 'success');
});

test('没有待保存的输入时，确认文案只提已保存的密钥', async () => {
  const { ai, confirmTexts } = loadAiModule({ apiKeyValue: '   ' });

  await ai.clearApiKey();

  assert.equal(confirmTexts.length, 1);
  assert.equal(confirmTexts[0].includes('没保存'), false);
});

test('取消确认时既不请求接口也不改状态', async () => {
  const { ai, elements, fetchCalls, confirmTexts } = loadAiModule({
    apiKeyValue: 'sk-typed',
    confirmResult: false,
  });

  await ai.clearApiKey();

  assert.equal(confirmTexts.length, 1);
  assert.equal(fetchCalls.length, 0, '取消后不应发出清空请求');
  assert.equal(elements.apiKey.value, 'sk-typed', '取消后应保留输入框内容');
  assert.equal(elements.clearApiKeyBtn.style.display, undefined, '按钮状态不应被改动');
});
