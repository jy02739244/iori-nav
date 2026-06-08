(function () {
  function setupBookmarkPrivacyLinkage(selectId, checkboxId) {
    const select = document.getElementById(selectId);
    const checkbox = document.getElementById(checkboxId);

    if (!select || !checkbox) return;

    const updatePrivacy = () => {
      const catId = select.value;
      const category = window.categoriesData.find(c => c.id == catId);
      const container = checkbox.closest('.form-group');
      let hint = container.querySelector('.privacy-hint');

      if (category && category.is_private) {
        if (!checkbox.hasAttribute('data-user-touched')) {
          checkbox.checked = true;
        }
        checkbox.disabled = false;

        if (!hint) {
          hint = document.createElement('span');
          hint.className = 'privacy-hint text-xs text-amber-600 ml-2 font-normal';
          const label = container.querySelector('label:first-child');
          if (label) label.appendChild(hint);
        }

        hint.innerText = checkbox.checked
          ? '(建议: 所属分类为私密)'
          : '(注意: 保存后所属分类也将变为公开)';
      } else {
        checkbox.disabled = false;
        if (hint) hint.remove();
      }
    };

    select.addEventListener('change', updatePrivacy);
    checkbox.addEventListener('change', () => {
      checkbox.setAttribute('data-user-touched', 'true');
      updatePrivacy();
    });
    select.updatePrivacyState = updatePrivacy;
  }

  function bindAddBookmarkPrivacyReset() {
    const addBookmarkBtn = document.getElementById('addBookmarkBtn');
    if (!addBookmarkBtn) return;

    addBookmarkBtn.addEventListener('click', () => {
      document.body.classList.add('modal-open');
    });

    addBookmarkBtn.addEventListener('click', () => {
      setTimeout(() => {
        const select = document.getElementById('addBookmarkCatelog');
        const checkbox = document.getElementById('addBookmarkIsPrivate');
        if (checkbox) checkbox.removeAttribute('data-user-touched');
        if (select && select.updatePrivacyState) select.updatePrivacyState();
      }, 100);
    });
  }

  function init() {
    setupBookmarkPrivacyLinkage('addBookmarkCatelog', 'addBookmarkIsPrivate');
    setupBookmarkPrivacyLinkage('editBookmarkCatelog', 'editBookmarkIsPrivate');
    setupBookmarkPrivacyLinkage('reviewPendingCatelog', 'reviewPendingIsPrivate');
    bindAddBookmarkPrivacyReset();
  }

  window.AdminBookmarkPrivacy = {
    init,
    setupBookmarkPrivacyLinkage,
  };
})();
