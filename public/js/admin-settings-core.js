(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  const currentSettings = ns.currentSettings || ns.defaults?.createDefaultSettings?.() || {};
  ns.currentSettings = currentSettings;

  function getRefs() {
    return ns.form?.getRefs?.() || {};
  }

  async function loadSettings() {
    const refs = getRefs();
    await ns.form?.loadCategoryOptions?.(refs.homeDefaultCategorySelect);

    try {
      const res = await fetch('/api/settings');
      const data = await res.json();

      if (data.code === 200 && data.data) {
        ns.defaults?.applyServerSettings?.(data.data, currentSettings);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }

    updateUIFromSettings();
  }

  function collectSettingsFromInputs() {
    return ns.form?.collectSettingsFromInputs?.();
  }

  async function saveSettings() {
    const refs = getRefs();
    if (!refs.saveBtn) return;

    try {
      refs.saveBtn.disabled = true;
      refs.saveBtn.innerHTML = '<span>⏳</span> 保存中...';

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings),
      });
      const data = await res.json();

      if (data.code === 200) {
        window.showMessage('设置已保存', 'success');
        closeModal();
      } else {
        window.showMessage('保存失败: ' + data.message, 'error');
      }
    } catch (e) {
      window.showMessage('保存失败 (网络错误)', 'error');
      console.error(e);
    } finally {
      refs.saveBtn.disabled = false;
      refs.saveBtn.innerHTML = '<span>💾</span> 保存设置';
    }
  }

  function updateUIFromSettings() {
    return ns.form?.updateUIFromSettings?.();
  }

  function closeModal() {
    const refs = getRefs();
    if (ns.ai?.isBulkRunning?.()) {
      if (!confirm('批量生成正在进行中，确定要关闭吗？')) {
        return;
      }
      ns.ai.requestStop();
    }
    if (refs.settingsModal) refs.settingsModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  function initModalEvents(refs) {
    refs.settingsBtn.addEventListener('click', () => {
      loadSettings();
      refs.settingsModal.style.display = 'block';
      document.body.classList.add('modal-open');
      ns.preview?.scheduleFullPreviewRender?.();
    });

    refs.closeBtn?.addEventListener('click', closeModal);
    refs.cancelBtn?.addEventListener('click', closeModal);
    refs.settingsModal?.addEventListener('click', (e) => {
      if (e.target === refs.settingsModal) closeModal();
    });
  }

  function initTabEvents(refs) {
    refs.settingsTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');

        refs.settingsTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        refs.settingsTabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === tabId) content.classList.add('active');
        });
        ns.preview?.scheduleFullPreviewRender?.();

        const shouldLoadWallpaper = tabId === 'wallpaper-settings'
          && refs.onlineWallpapersDiv
          && (!refs.onlineWallpapersDiv.children.length || refs.onlineWallpapersDiv.innerText.includes('加载中'));
        if (shouldLoadWallpaper) {
          ns.wallpaper?.switchWallpaperSource?.(currentSettings.wallpaper_source || 'bing');
        }
      });
    });
  }

  function initCardDeviceTabs() {
    const buttons = document.querySelectorAll('[data-card-device-tab]');
    const panels = document.querySelectorAll('[data-card-device-panel]');
    if (!buttons.length || !panels.length) return;

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const target = button.dataset.cardDeviceTab || 'desktop';

        buttons.forEach(item => {
          const isActive = item === button;
          item.classList.toggle('active', isActive);
          item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(panel => {
          panel.classList.toggle('hidden', panel.dataset.cardDevicePanel !== target);
        });

        const previewRoot = document.getElementById('homeLivePreview');
        if (previewRoot) {
          previewRoot.dataset.device = target === 'mobile' ? 'mobile' : 'desktop';
          if (previewRoot.dataset.device !== 'mobile') previewRoot.classList.remove('mobile-menu-open');
        }
        document.querySelectorAll('.preview-device-btn').forEach(deviceBtn => {
          const isActive = deviceBtn.dataset.previewDevice === (target === 'mobile' ? 'mobile' : 'desktop');
          deviceBtn.classList.toggle('active', isActive);
        });

        ns.preview?.scheduleFullPreviewRender?.();
      });
    });
  }

  function initFormEvents(refs) {
    refs.providerSelector?.addEventListener('change', () => {
      currentSettings.provider = refs.providerSelector.value;
      updateUIFromSettings();
    });

    refs.saveBtn?.addEventListener('click', () => {
      collectSettingsFromInputs();
      saveSettings();
    });

    refs.frostedGlassSwitch?.addEventListener('change', () => {
      ns.form?.updateToggleContainer?.(refs.frostedGlassSwitch, 'frostedGlassIntensityContainer');
    });

    refs.frostedGlassIntensityRange?.addEventListener('input', () => {
      if (refs.frostedGlassIntensityValue) {
        refs.frostedGlassIntensityValue.textContent = refs.frostedGlassIntensityRange.value;
      }
    });

    refs.bgBlurSwitch?.addEventListener('change', () => {
      ns.form?.updateToggleContainer?.(refs.bgBlurSwitch, 'bgBlurIntensityContainer');
    });

    refs.bgBlurIntensityRange?.addEventListener('input', () => {
      if (refs.bgBlurIntensityValue) {
        refs.bgBlurIntensityValue.textContent = refs.bgBlurIntensityRange.value;
      }
    });

    refs.mobileFrostedGlassSwitch?.addEventListener('change', () => {
      ns.form?.updateToggleContainer?.(refs.mobileFrostedGlassSwitch, 'mobileFrostedGlassIntensityContainer');
    });

    refs.mobileFrostedGlassIntensityRange?.addEventListener('input', () => {
      if (refs.mobileFrostedGlassIntensityValue) {
        refs.mobileFrostedGlassIntensityValue.textContent = refs.mobileFrostedGlassIntensityRange.value;
      }
    });
  }

  function init() {
    const refs = getRefs();
    if (!refs.settingsBtn || !refs.settingsModal) return false;
    initModalEvents(refs);
    initTabEvents(refs);
    initCardDeviceTabs();
    initFormEvents(refs);
    return true;
  }

  ns.core = {
    init,
    getRefs,
    getCurrentSettings: () => currentSettings,
    collectSettingsFromInputs,
    loadSettings,
    saveSettings,
    updateUIFromSettings,
    closeModal,
  };
})();
