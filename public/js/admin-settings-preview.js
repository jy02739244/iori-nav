(function () {
  const ns = window.AdminSettings = window.AdminSettings || {};
  let initialized = false;

  function fallbackShouldHideCopyTextForPreview(device, gridCols) {
    return device === 'mobile'
      ? Number(gridCols) >= 3
      : (Number(gridCols) || 4) >= 5;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ns.previewShared?.populateFontSelects?.();
    ns.previewControls?.bindPreviewEvents?.();
    ns.previewAnimation?.syncAnimationOptions?.();
    ns.previewRender?.renderFullPreview?.();
  }

  ns.preview = {
    init,
    loadFont: (...args) => ns.previewShared?.loadFont?.(...args),
    updatePreviewCards: (...args) => ns.previewControls?.updatePreviewCards?.(...args),
    updatePreviewWidth: (...args) => ns.previewControls?.updatePreviewWidth?.(...args),
    selectCardStyle: (...args) => ns.previewControls?.selectCardStyle?.(...args),
    selectMobileCardStyle: (...args) => ns.previewControls?.selectMobileCardStyle?.(...args),
    triggerPreviewAnimation: (...args) => ns.previewAnimation?.triggerPreviewAnimation?.(...args),
    syncAnimationOptions: (...args) => ns.previewAnimation?.syncAnimationOptions?.(...args),
    invalidatePreviewCards: (...args) => ns.previewData?.invalidatePreviewCards?.(...args),
    renderFullPreview: (...args) => ns.previewRender?.renderFullPreview?.(...args),
    scheduleFullPreviewRender: (...args) => ns.previewRender?.scheduleFullPreviewRender?.(...args),
    shouldHideCopyTextForPreview: (...args) => (
      ns.previewShared?.shouldHideCopyTextForPreview?.(...args) ?? fallbackShouldHideCopyTextForPreview(...args)
    ),
  };
})();
