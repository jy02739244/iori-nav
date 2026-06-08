(function () {
  const messageDiv = document.getElementById('message');

  window.categoriesData = window.categoriesData || [];
  window.categoriesTree = window.categoriesTree || [];

  function applyMessageStyle(element, type) {
    if (type === 'success') {
      element.style.backgroundColor = '#d4edda';
      element.style.color = '#155724';
      element.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
      element.style.backgroundColor = '#f8d7da';
      element.style.color = '#721c24';
      element.style.border = '1px solid #f5c6cb';
    } else {
      element.style.backgroundColor = '#d1ecf1';
      element.style.color = '#0c5460';
      element.style.border = '1px solid #bee5eb';
    }
  }

  window.showMessage = function (text, type = 'info') {
    if (!messageDiv) return;
    messageDiv.innerText = text;
    messageDiv.style.display = 'block';
    applyMessageStyle(messageDiv, type);

    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  };

  window.showModalMessage = function (modalId, text, type = 'info') {
    const messageBoxId = modalId.replace('Modal', 'Message');
    const messageBox = document.getElementById(messageBoxId);

    if (!messageBox) {
      console.warn('Message box not found for modal:', modalId);
      window.showMessage(text, type);
      return;
    }

    messageBox.innerText = text;
    messageBox.style.visibility = 'visible';
    messageBox.style.display = 'block';
    messageBox.style.padding = '10px';
    messageBox.style.marginBottom = '15px';
    messageBox.style.borderRadius = '4px';
    messageBox.style.fontSize = '14px';
    applyMessageStyle(messageBox, type);

    setTimeout(() => {
      messageBox.style.visibility = 'hidden';
      messageBox.style.display = 'none';
    }, 3000);
  };

  const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  window.escapeHTML = function (value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
  };

  window.normalizeUrl = function (value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    if (/^data:image\/[\w+.-]+;base64,/.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('/')) {
      return trimmed;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (/^[\w.-]+\.[\w.-]+/.test(trimmed)) {
      return 'https://' + trimmed;
    }

    return '';
  };

  window.buildCategoryTree = function (categories) {
    const map = new Map();
    const roots = [];

    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    categories.forEach(cat => {
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id).children.push(map.get(cat.id));
      } else {
        roots.push(map.get(cat.id));
      }
    });

    const sortFn = (a, b) => {
      const orderA = a.sort_order ?? 9999;
      const orderB = b.sort_order ?? 9999;
      return orderA - orderB || a.id - b.id;
    };

    const sortRecursive = (nodes) => {
      nodes.sort(sortFn);
      nodes.forEach(node => {
        if (node.children.length > 0) sortRecursive(node.children);
      });
    };

    sortRecursive(roots);
    return roots;
  };

  function findCategoryLabel(nodes, id) {
    for (const node of nodes) {
      if (String(node.id) === String(id)) return node.catelog;
      if (node.children) {
        const found = findCategoryLabel(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function getInitialDropdownLabel(input, categoriesTree, initialValue, isFilter) {
    if (initialValue && initialValue != '0') {
      if (isFilter) {
        input.value = initialValue;
        return initialValue;
      }

      const label = findCategoryLabel(categoriesTree, initialValue);
      input.value = initialValue;
      return label || '请选择分类';
    }

    if (initialValue == '0' && !isFilter) {
      input.value = '0';
      return '无 (顶级分类)';
    }

    if (isFilter && !initialValue) {
      input.value = '';
      return '所有分类';
    }

    input.value = '';
    return '请选择分类';
  }

  function appendRootCategoryItem(menu, input, trigger) {
    const rootItem = document.createElement('div');
    rootItem.className = 'custom-dropdown-item';
    rootItem.innerHTML = '<span class="font-medium text-gray-900">无 (顶级分类)</span>';
    rootItem.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '0';
      trigger.textContent = '无 (顶级分类)';
      menu.classList.remove('show');
    });
    menu.appendChild(rootItem);
  }

  function appendFilterAllItem(menu, input, trigger) {
    const rootItem = document.createElement('div');
    rootItem.className = 'custom-dropdown-item';
    rootItem.innerHTML = '<span class="font-medium text-gray-900">所有分类</span>';
    rootItem.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      trigger.textContent = '所有分类';
      menu.classList.remove('show');
      input.dispatchEvent(new Event('change'));
    });
    menu.appendChild(rootItem);
  }

  function appendCategoryItems(menu, input, trigger, nodes, excludeId, isFilter, depth = 0) {
    nodes.forEach(node => {
      if (excludeId && node.id == excludeId) return;

      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.style.paddingLeft = `${15 + depth * 20}px`;

      const textSpan = document.createElement('span');
      textSpan.textContent = `${depth > 0 ? '└─ ' : ''}${node.catelog}`;
      item.appendChild(textSpan);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = node.id;
        trigger.textContent = node.catelog;
        menu.classList.remove('show');
        input.dispatchEvent(new Event('change'));
      });

      menu.appendChild(item);

      if (node.children && node.children.length > 0) {
        appendCategoryItems(menu, input, trigger, node.children, excludeId, isFilter, depth + 1);
      }
    });
  }

  window.createCascadingDropdown = function (containerId, inputId, categoriesTree, initialValue = null, excludeId = null) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;

    const isFilter = inputId === 'categoryFilter' || inputId === 'batchCategoryFilter';
    const initialLabel = getInitialDropdownLabel(input, categoriesTree, initialValue, isFilter);

    container.innerHTML = '';

    const trigger = document.createElement('div');
    trigger.className = 'custom-dropdown-trigger';
    trigger.textContent = initialLabel;
    container.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'custom-dropdown-menu';

    if (inputId.toLowerCase().includes('parent')) {
      appendRootCategoryItem(menu, input, trigger);
    }

    if (isFilter) {
      appendFilterAllItem(menu, input, trigger);
    }

    appendCategoryItems(menu, input, trigger, categoriesTree, excludeId, isFilter);
    container.appendChild(menu);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-dropdown-menu.show').forEach(m => {
        if (m !== menu) m.classList.remove('show');
      });
      menu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        menu.classList.remove('show');
      }
    });
  };

  window.loadGlobalCategories = function () {
    return fetch('/api/categories?pageSize=10000')
      .then(res => res.json())
      .then(data => {
        if (data.code === 200 && data.data) {
          window.categoriesData = data.data;
          window.categoriesTree = window.buildCategoryTree(window.categoriesData);

          if (document.getElementById('categoryFilter')) {
            window.createCascadingDropdown('categoryFilterWrapper', 'categoryFilter', window.categoriesTree);
          }
        }
        return data;
      });
  };
})();
