// 登录页交互；存储不可用时仍允许正常提交表单。
(() => {
  const form = document.querySelector('form');
  const durationSelect = document.getElementById('duration');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!form || !durationSelect || !passwordInput || !passwordToggle || !submitButton) return;

  try {
    const savedDuration = localStorage.getItem('login_duration');
    if ([...durationSelect.options].some(option => option.value === savedDuration)) {
      durationSelect.value = savedDuration;
    }
  } catch {
    // 隐私模式下 localStorage 可能被禁用。
  }

  passwordToggle.hidden = false;
  passwordToggle.addEventListener('click', () => {
    const isVisible = passwordInput.type === 'password';
    passwordInput.type = isVisible ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(isVisible));
    passwordToggle.setAttribute('aria-label', isVisible ? '隐藏密码' : '显示密码');
  });

  const resetSubmitButton = () => {
    submitButton.disabled = false;
    submitButton.classList.remove('is-loading');
    submitButton.removeAttribute('aria-busy');
    submitButton.querySelector('.button-label').textContent = '登 录';
  };

  form.addEventListener('submit', () => {
    try {
      localStorage.setItem('login_duration', durationSelect.value);
    } catch {
      // 保存偏好失败不应阻止登录。
    }
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.querySelector('.button-label').textContent = '正在登录';
  });

  // 浏览器后退可能恢复禁用的按钮，需要重新允许提交。
  window.addEventListener('pageshow', resetSubmitButton);
})();
