(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};

  let shouldStopBulkGeneration = false;
  let aiRequestDelay = 1500;
  let initialized = false;

  function getCurrentSettings() {
    return ns.core?.getCurrentSettings?.() || ns.currentSettings || {};
  }

  function getRefs() {
    return {
      providerSelector: document.getElementById('providerSelector'),
      apiKeyInput: document.getElementById('apiKey'),
      clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
      baseUrlInput: document.getElementById('baseUrl'),
      modelNameInput: document.getElementById('modelName'),
      bulkIdleView: document.getElementById('bulkGenerateIdle'),
      bulkProgressView: document.getElementById('bulkGenerateProgress'),
      batchCompleteBtn: document.getElementById('batchCompleteDescBtn'),
      stopBulkBtn: document.getElementById('stopBulkGenerateBtn'),
      progressBar: document.getElementById('progressBar'),
      progressCounter: document.getElementById('progressCounter'),
      addBookmarkAiBtn: document.getElementById('addBookmarkAiBtn'),
      editBookmarkAiBtn: document.getElementById('editBookmarkAiBtn'),
      reviewPendingAiBtn: document.getElementById('reviewPendingAiBtn'),
    };
  }

  async function fetchPublicConfig() {
    try {
      const response = await fetch('/api/public-config');
      if (!response.ok) {
        console.error('Failed to fetch public config.');
        return;
      }
      const config = await response.json();
      if (config && typeof config.aiRequestDelay === 'number') {
        aiRequestDelay = config.aiRequestDelay;
      }
    } catch (error) {
      console.error('Error fetching public config:', error);
    }
  }

  async function getAIDescription(bookmark, generateName = false) {
    const { name, url } = bookmark;

    let systemPrompt;
    let userPrompt;
    if (generateName) {
      systemPrompt = "You are a helpful assistant. You must respond with valid JSON only. Do not include reasoning, analysis, markdown, or extra text.";
      userPrompt = `分析链接：'${url}'。请生成一个简短的网站名称（name，不超过10字）和中文简介（description，不超过30字）。请严格只返回 JSON 格式，例如：{"name": "名称", "description": "简介"}。不要输出思考过程或解释。`;
    } else {
      systemPrompt = "You generate one concise bookmark description only. Do not include reasoning, analysis, markdown, labels, or extra text.";
      userPrompt = `为以下书签生成一个简洁的中文描述（不超过30字）。只返回最终描述本身，不要输出思考过程、分析、解释，不要包含"书签名称"、"描述"等前缀，也不要使用"标题: 描述"的格式。书签名称：'${name}'，链接：'${url}'`;
    }

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseFormat: generateName ? 'bookmark-json' : 'bookmark-description',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `AI 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.data;

      if (!generateName) {
        return { description: responseText, name: '' };
      }

      try {
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
      } catch (e) {
        console.warn('JSON 解析失败，将原始文本作为描述返回', e);
        return { description: responseText, name: '' };
      }
    } catch (error) {
      console.error('AI 描述生成失败:', error);
      throw error;
    }
  }

  async function handleBulkGenerate() {
    const refs = getRefs();
    const currentSettings = getCurrentSettings();
    currentSettings.apiKey = refs.apiKeyInput?.value.trim() || '';
    currentSettings.baseUrl = refs.baseUrlInput?.value.trim() || '';
    currentSettings.model = refs.modelNameInput?.value.trim() || '';

    if (currentSettings.provider === 'openai' && !currentSettings.baseUrl) {
      window.showMessage('使用 OpenAI 兼容模式时，Base URL 是必填项', 'error');
      return;
    }

    window.showMessage('正在扫描所有书签，请稍候...', 'info');
    let linksToUpdate = [];
    try {
      const response = await fetch('/api/get-empty-desc-sites');
      const result = await response.json();

      if (!response.ok || result.code !== 200) {
        window.showMessage(result.message || '获取待处理列表失败', 'error');
        return;
      }
      linksToUpdate = result.data;
    } catch (error) {
      window.showMessage('扫描书签时发生网络错误', 'error');
      return;
    }

    if (linksToUpdate.length === 0) {
      window.showMessage('太棒了！所有书签都已有描述。', 'success');
      return;
    }

    if (!confirm(`发现 ${linksToUpdate.length} 个链接缺少描述，确定要使用 AI 自动生成吗？`)) {
      return;
    }

    shouldStopBulkGeneration = false;
    if (refs.bulkIdleView) refs.bulkIdleView.style.display = 'none';
    if (refs.bulkProgressView) refs.bulkProgressView.style.display = 'block';

    let completedCount = 0;
    const total = linksToUpdate.length;
    if (refs.progressCounter) refs.progressCounter.textContent = `0 / ${total}`;
    if (refs.progressBar) refs.progressBar.style.width = '0%';

    for (let i = 0; i < total; i++) {
      if (shouldStopBulkGeneration) break;

      const link = linksToUpdate[i];

      try {
        const { description } = await getAIDescription(link);
        const updateResponse = await fetch('/api/update-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: link.id, url: link.url, logo: link.logo, description: description })
        });

        const result = await updateResponse.json();
        if (result.code === 200) {
          completedCount++;
        } else {
          console.error(`Failed to update description for ${link.name}:`, result.message);
        }
      } catch (error) {
        console.error(`Error processing ${link.name}:`, error);
      }

      if (refs.progressCounter) refs.progressCounter.textContent = `${i + 1} / ${total}`;
      if (refs.progressBar) refs.progressBar.style.width = `${((i + 1) / total) * 100}%`;

      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, aiRequestDelay));
      }
    }

    if (refs.bulkIdleView) refs.bulkIdleView.style.display = 'block';
    if (refs.bulkProgressView) refs.bulkProgressView.style.display = 'none';

    if (shouldStopBulkGeneration) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if ((completedCount > 0 || shouldStopBulkGeneration) && typeof window.fetchConfigs === 'function') {
      window.fetchConfigs();
    }

    let message = '';
    let messageType = 'success';
    if (shouldStopBulkGeneration) {
      message = `操作已停止。成功更新 ${completedCount} 个书签。列表已刷新。`;
    } else if (completedCount === total && total > 0) {
      message = `批量生成完成！成功更新了全部 ${total} 个书签。`;
    } else if (completedCount > 0) {
      message = `批量生成完成。成功更新 ${completedCount} / ${total} 个书签。`;
      messageType = 'info';
    } else if (total > 0) {
      message = '批量生成完成，但未能成功更新任何书签。请检查控制台日志。';
      messageType = 'error';
    }

    if (message) window.showMessage(message, messageType);
    shouldStopBulkGeneration = false;
  }

  async function handleSingleGenerate(nameInputId, urlInputId, descInputId, btnId) {
    const name = document.getElementById(nameInputId)?.value.trim() || '';
    const url = document.getElementById(urlInputId)?.value.trim() || '';
    const descInput = document.getElementById(descInputId);
    const btn = document.getElementById(btnId);

    if (!url) {
      window.showMessage('请先填写 URL', 'error');
      return;
    }
    if (!descInput || !btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = '<div class="ai-spinner"></div>';
    btn.disabled = true;

    window.showMessage('正在生成描述...', 'info');
    try {
      const generateName = !name;
      const bookmark = { name: name || '未命名', url: url };
      const result = await getAIDescription(bookmark, generateName);

      descInput.value = result.description;
      if (generateName && result.name) {
        const nameInput = document.getElementById(nameInputId);
        if (nameInput) nameInput.value = result.name;
      }
      window.showMessage('生成成功', 'success');
    } catch (error) {
      console.error(error);
      window.showMessage('生成失败: ' + error.message, 'error');
    } finally {
      btn.innerHTML = originalContent;
      btn.disabled = false;
    }
  }

  function isBulkRunning() {
    const refs = getRefs();
    return refs.bulkProgressView?.style.display === 'block';
  }

  function requestStop() {
    shouldStopBulkGeneration = true;
  }

  // 后端密钥字段是三态：null = 清除、'' = 保留。输入框留空后保存只是「不修改」，
  // 所以删除已存密钥需要一个显式动作，否则界面上根本没有清除路径。
  function syncApiKeyField() {
    const btn = document.getElementById('clearApiKeyBtn');
    if (!btn) return;
    btn.style.display = getCurrentSettings().has_api_key ? 'inline-block' : 'none';
  }

  async function clearApiKey() {
    const btn = document.getElementById('clearApiKeyBtn');
    if (!btn || btn.disabled) return;

    const input = document.getElementById('apiKey');
    // 输入框里有还没保存的新密钥时，要明确说它也会一起丢；
    // 否则用户会以为这个按钮只删已存的那个。
    const confirmText = (input?.value.trim() || '') !== ''
      ? '确认清除 API Key？输入框里还没保存的密钥也会被丢弃。'
      : '确认清除已保存的 API Key？清除后 AI 功能将不可用。';
    if (!window.confirm(confirmText)) return;

    btn.disabled = true;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.code !== 200) {
        throw new Error(data.message || '清除 API Key 失败');
      }

      const currentSettings = getCurrentSettings();
      currentSettings.has_api_key = false;
      delete currentSettings.apiKey;
      if (input) {
        input.value = '';
        // 占位文案与 updateProviderUI 里的规则保持一致：
        // 已经清空却仍写着「已配置」会让人以为没删掉。
        input.placeholder = '请输入 API Key';
      }
      syncApiKeyField();
      window.showMessage('API Key 已清除', 'success');
    } catch (error) {
      window.showMessage(error.message || '清除 API Key 失败', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function bindEvents() {
    const refs = getRefs();

    refs.batchCompleteBtn?.addEventListener('click', handleBulkGenerate);
    refs.stopBulkBtn?.addEventListener('click', () => {
      shouldStopBulkGeneration = true;
      window.showMessage('正在停止...', 'info');
    });

    refs.addBookmarkAiBtn?.addEventListener('click', () => {
      handleSingleGenerate('addBookmarkName', 'addBookmarkUrl', 'addBookmarkDesc', 'addBookmarkAiBtn');
    });

    refs.editBookmarkAiBtn?.addEventListener('click', () => {
      handleSingleGenerate('editBookmarkName', 'editBookmarkUrl', 'editBookmarkDesc', 'editBookmarkAiBtn');
    });

    refs.reviewPendingAiBtn?.addEventListener('click', () => {
      handleSingleGenerate('reviewPendingName', 'reviewPendingUrl', 'reviewPendingDesc', 'reviewPendingAiBtn');
    });

    refs.clearApiKeyBtn?.addEventListener('click', clearApiKey);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    fetchPublicConfig();
    bindEvents();
    syncApiKeyField();
  }

  ns.ai = {
    init,
    isBulkRunning,
    requestStop,
    getAIDescription,
    handleBulkGenerate,
    clearApiKey,
    syncApiKeyField,
  };
})();
