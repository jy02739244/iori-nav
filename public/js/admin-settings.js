(function () {
  const initSettings = () => {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    if (!settingsBtn || !settingsModal) return;

    window.AdminSettings = window.AdminSettings || {};
    window.AdminSettings.preview?.init?.();
    window.AdminSettings.wallpaper?.init?.();
    window.AdminSettings.ai?.init?.();
    window.AdminSettings.core?.init?.();
  };

  initSettings();
})();
