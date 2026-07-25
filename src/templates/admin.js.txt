const configTableBody = document.getElementById('configTableBody');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');

const pendingTableBody = document.getElementById('pendingTableBody');
const pendingPrevPageBtn = document.getElementById('pendingPrevPage');
const pendingNextPageBtn = document.getElementById('pendingNextPage');
const pendingCurrentPageSpan = document.getElementById('pendingCurrentPage');
const pendingTotalPagesSpan = document.getElementById('pendingTotalPages');

const messageDiv = document.getElementById('message');
const categoryTableBody = document.getElementById('categoryTableBody');
const refreshCategoriesBtn = document.getElementById('refreshCategories');

var escapeHTML = function(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

var normalizeUrl = function(value) {
  var trimmed = String(value || '').trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[\w.-]+/.test(trimmed)) return 'https://' + trimmed;
  return '';
};

const addBtn = document.getElementById('addBtn');
const addName = document.getElementById('addName');
const addUrl = document.getElementById('addUrl');
const addLogo = document.getElementById('addLogo');
const addDesc = document.getElementById('addDesc');
const addCatelog = document.getElementById('addCatelog');
const addSortOrder = document.getElementById('addSortOrder');

const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === tab) content.classList.add('active');
    });
    if (tab === 'categories') fetchCategories();
  });
});

if (refreshCategoriesBtn) {
  refreshCategoriesBtn.addEventListener('click', () => fetchCategories());
}

// 添加搜索框
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = '搜索书签(名称，URL，分类)';
searchInput.id = 'searchInput';
searchInput.style.marginBottom = '10px';
document.querySelector('.add-new').parentNode.insertBefore(searchInput, document.querySelector('.add-new'));

let currentPage = 1;
let pageSize = 10;
let totalItems = 0;
let allConfigs = [];
let currentSearchKeyword = '';

let pendingCurrentPage = 1;
let pendingPageSize = 10;
let pendingTotalItems = 0;
let allPendingConfigs = [];
let categoriesData = [];

// 创建编辑模态框
const editModal = document.createElement('div');
editModal.className = 'modal';
editModal.style.display = 'none';
editModal.innerHTML = `
  <div class="modal-content">
    <span class="modal-close">&times;</span>
    <h2>编辑站点</h2>
    <form id="editForm">
      <input type="hidden" id="editId">
      <label for="editName">名称:</label>
      <input type="text" id="editName" required><br>
      <label for="editUrl">URL:</label>
      <input type="text" id="editUrl" required><br>
      <label for="editLogo">Logo(可选):</label>
      <input type="text" id="editLogo"><br>
      <label for="editDesc">描述(可选):</label>
      <input type="text" id="editDesc"><br>
      <label for="editCatelog">分类:</label>
      <input type="text" id="editCatelog" required><br>
      <label for="editSortOrder">排序:</label>
      <input type="number" id="editSortOrder"><br>
      <button type="submit">保存</button>
    </form>
  </div>
`;
document.body.appendChild(editModal);

const modalClose = editModal.querySelector('.modal-close');
modalClose.addEventListener('click', () => { editModal.style.display = 'none'; });

document.getElementById('editUrl').addEventListener('blur', function() {
  const url = this.value.trim();
  const logoInput = document.getElementById('editLogo');
  if (url && !logoInput.value) fetchFavicon(url, logoInput);
});

const editForm = document.getElementById('editForm');
editForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const payload = {
    name: document.getElementById('editName').value.trim(),
    url: document.getElementById('editUrl').value.trim(),
    logo: document.getElementById('editLogo').value.trim(),
    desc: document.getElementById('editDesc').value.trim(),
    catelog: document.getElementById('editCatelog').value.trim()
  };
  const sort_order = document.getElementById('editSortOrder').value;
  if (sort_order !== '') payload.sort_order = Number(sort_order);

  fetch(`/api/config/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        showMessage('修改成功', 'success');
        fetchConfigs();
        editModal.style.display = 'none';
      } else {
        showMessage(data.message, 'error');
      }
    }).catch(() => showMessage('网络错误', 'error'));
});

function fetchConfigs(page = currentPage, keyword = currentSearchKeyword) {
  let url = `/api/config?page=${page}&pageSize=${pageSize}`;
  if (keyword) url += `&keyword=${keyword}`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        totalItems = data.total;
        currentPage = data.page;
        totalPagesSpan.innerText = Math.ceil(totalItems / pageSize);
        currentPageSpan.innerText = currentPage;
        allConfigs = data.data;
        renderConfig(allConfigs);
        updatePaginationButtons();
      } else {
        showMessage(data.message, 'error');
      }
    }).catch(() => showMessage('网络错误', 'error'));
}

function renderConfig(configs) {
  configTableBody.innerHTML = '';
  if (configs.length === 0) {
    configTableBody.innerHTML = '<tr><td colspan="8">没有配置数据</td></tr>';
    return;
  }

  // Optimization 2: group by category
  const grouped = new Map();
  configs.forEach(config => {
    const cat = config.catelog || '未分类';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(config);
  });

  grouped.forEach((items, cat) => {
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<td colspan="8" style="background:#e9ecef;font-weight:600;color:#343a40;">📂 ${escapeHTML(cat)} (${items.length})</td>`;
    configTableBody.appendChild(headerRow);

    items.forEach(config => {
      const row = document.createElement('tr');
      const safeName = escapeHTML(config.name || '');
      const normalizedUrl = normalizeUrl(config.url);
      const displayUrl = config.url ? escapeHTML(config.url) : '未提供';
      const urlCell = normalizedUrl
        ? `<a href="${escapeHTML(normalizedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(normalizedUrl)}</a>`
        : displayUrl;
      const normalizedLogo = normalizeUrl(config.logo);
      const logoCell = normalizedLogo
        ? `<img src="${escapeHTML(normalizedLogo)}" alt="${safeName}" style="width:30px;" />`
        : 'N/A';
      const descCell = config.desc ? escapeHTML(config.desc) : 'N/A';
      const catelogCell = escapeHTML(config.catelog || '');
      const sortValue = config.sort_order === 9999 || config.sort_order === null || config.sort_order === undefined
        ? '默认' : escapeHTML(config.sort_order);
      row.innerHTML = `
        <td>${config.id}</td>
        <td>${safeName}</td>
        <td>${urlCell}</td>
        <td>${logoCell}</td>
        <td>${descCell}</td>
        <td>${catelogCell}</td>
        <td>${sortValue}</td>
        <td class="actions">
          <button class="edit-btn" data-id="${config.id}">编辑</button>
          <button class="del-btn" data-id="${config.id}">删除</button>
        </td>
      `;
      configTableBody.appendChild(row);
    });
  });
  bindActionEvents();
}

function bindActionEvents() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() { handleEdit(this.dataset.id); });
  });
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', function() { handleDelete(this.dataset.id); });
  });
}

function fetchCategories() {
  if (!categoryTableBody) return;
  categoryTableBody.innerHTML = '<tr><td colspan="4">加载中...</td></tr>';
  fetch('/api/categories')
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        categoriesData = data.data || [];
        renderCategories(categoriesData);
      } else {
        showMessage(data.message || '加载分类失败', 'error');
        categoryTableBody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
      }
    }).catch(() => {
      showMessage('网络错误', 'error');
      categoryTableBody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
    });
}

function renderCategories(categories) {
  if (!categoryTableBody) return;
  categoryTableBody.innerHTML = '';
  if (!categories || categories.length === 0) {
    categoryTableBody.innerHTML = '<tr><td colspan="4">暂无分类数据</td></tr>';
    return;
  }

  categories.forEach(item => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = item.catelog;
    row.appendChild(nameCell);

    const countCell = document.createElement('td');
    countCell.textContent = item.site_count;
    row.appendChild(countCell);

    const sortCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'category-sort-input';
    if (item.explicit) { input.value = item.sort_order; }
    else { input.placeholder = item.sort_order; }
    input.setAttribute('data-category', item.catelog);
    sortCell.appendChild(input);

    const hint = document.createElement('small');
    hint.textContent = '当前默认值：' + item.sort_order;
    hint.style.display = 'block';
    hint.style.marginTop = '4px';
    hint.style.fontSize = '0.75rem';
    hint.style.color = '#6c757d';
    sortCell.appendChild(hint);
    row.appendChild(sortCell);

    const actionCell = document.createElement('td');
    actionCell.className = 'category-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'category-save-btn';
    saveBtn.textContent = '保存';
    saveBtn.setAttribute('data-category', item.catelog);
    actionCell.appendChild(saveBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'category-reset-btn';
    resetBtn.textContent = '重置';
    resetBtn.setAttribute('data-category', item.catelog);
    if (!item.explicit) resetBtn.disabled = true;
    actionCell.appendChild(resetBtn);

    row.appendChild(actionCell);
    categoryTableBody.appendChild(row);
  });

  bindCategoryEvents();
}

function bindCategoryEvents() {
  if (!categoryTableBody) return;
  categoryTableBody.querySelectorAll('.category-save-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      const input = this.closest('tr').querySelector('.category-sort-input');
      if (!category || !input) return;
      const rawValue = input.value.trim();
      if (rawValue === '') { showMessage('请输入排序值，或使用"重置"恢复默认。', 'error'); return; }
      const sortValue = Number(rawValue);
      if (!Number.isFinite(sortValue)) { showMessage('排序值必须为数字', 'error'); return; }
      fetch('/api/categories/' + encodeURIComponent(category), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: sortValue })
      }).then(res => res.json())
        .then(data => {
          if (data.code === 200) { showMessage('分类排序已更新', 'success'); fetchCategories(); }
          else { showMessage(data.message || '更新失败', 'error'); }
        }).catch(() => showMessage('网络错误', 'error'));
    });
  });

  categoryTableBody.querySelectorAll('.category-reset-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      const category = this.getAttribute('data-category');
      if (!category) return;
      if (!confirm('确定恢复该分类的默认排序吗？')) return;
      fetch('/api/categories/' + encodeURIComponent(category), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true })
      }).then(res => res.json())
        .then(data => {
          if (data.code === 200) { showMessage('已重置分类排序', 'success'); fetchCategories(); }
          else { showMessage(data.message || '重置失败', 'error'); }
        }).catch(() => showMessage('网络错误', 'error'));
    });
  });
}

// Optimization 1: use single query endpoint for edit
function handleEdit(id) {
  fetch(`/api/config/${id}`)
    .then(res => res.json())
    .then(data => {
      if (data.code !== 200 || !data.data) {
        showMessage('找不到要编辑的数据', 'error');
        return;
      }
      const configToEdit = data.data;
      document.getElementById('editId').value = configToEdit.id;
      document.getElementById('editName').value = configToEdit.name;
      document.getElementById('editUrl').value = configToEdit.url;
      document.getElementById('editLogo').value = configToEdit.logo || '';
      document.getElementById('editDesc').value = configToEdit.desc || '';
      document.getElementById('editCatelog').value = configToEdit.catelog;
      document.getElementById('editSortOrder').value = configToEdit.sort_order === 9999 ? '' : configToEdit.sort_order;
      editModal.style.display = 'block';
    }).catch(() => showMessage('网络错误', 'error'));
}

function handleDelete(id) {
  if (!confirm('确认删除？')) return;
  fetch(`/api/config/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) { showMessage('删除成功', 'success'); fetchConfigs(); }
      else { showMessage(data.message, 'error'); }
    }).catch(() => showMessage('网络错误', 'error'));
}

function showMessage(message, type) {
  messageDiv.innerText = message;
  messageDiv.className = type;
  messageDiv.style.display = 'block';
  setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
}

function updatePaginationButtons() {
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= Math.ceil(totalItems / pageSize);
}

prevPageBtn.addEventListener('click', () => { if (currentPage > 1) fetchConfigs(currentPage - 1); });
nextPageBtn.addEventListener('click', () => { if (currentPage < Math.ceil(totalItems / pageSize)) fetchConfigs(currentPage + 1); });

// 自动获取 favicon
async function fetchFavicon(url, targetInput) {
  try {
    const response = await fetch(`/api/favicon?url=${encodeURIComponent(url)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.favicon) {
        (targetInput || addLogo).value = data.favicon;
      }
    }
  } catch (error) {
    console.error('获取 favicon 失败:', error);
  }
}

// URL 输入框失焦时自动获取 favicon
addUrl.addEventListener('blur', () => {
  const url = addUrl.value.trim();
  if (url && !addLogo.value) {
    fetchFavicon(url);
  }
});

addBtn.addEventListener('click', () => {
  const name = addName.value;
  const url = addUrl.value;
  const logo = addLogo.value;
  const desc = addDesc.value;
  const catelog = addCatelog.value;
  const sort_order = addSortOrder.value;
  if (!name || !url || !catelog) { showMessage('名称,URL,分类 必填', 'error'); return; }
  const payload = { name: name.trim(), url: url.trim(), logo: logo.trim(), desc: desc.trim(), catelog: catelog.trim() };
  if (sort_order !== '') payload.sort_order = Number(sort_order);
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => res.json())
    .then(data => {
      if (data.code === 201) {
        showMessage('添加成功', 'success');
        addName.value = ''; addUrl.value = ''; addLogo.value = '';
        addDesc.value = ''; addCatelog.value = ''; addSortOrder.value = '';
        fetchConfigs();
      } else { showMessage(data.message, 'error'); }
    }).catch(() => showMessage('网络错误', 'error'));
});

importBtn.addEventListener('click', () => { importFile.click(); });
importFile.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const jsonData = JSON.parse(event.target.result);
      fetch('/api/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData)
      }).then(res => res.json())
        .then(data => {
          if (data.code === 201) { showMessage('导入成功', 'success'); fetchConfigs(); }
          else { showMessage(data.message, 'error'); }
        }).catch(() => showMessage('网络错误', 'error'));
    } catch (error) { showMessage('JSON格式不正确', 'error'); }
  };
  reader.readAsText(file);
});

exportBtn.addEventListener('click', () => {
  fetch('/api/config/export')
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'config.json';
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    }).catch(() => showMessage('网络错误', 'error'));
});

// 搜索功能
searchInput.addEventListener('input', () => {
  currentSearchKeyword = searchInput.value.trim();
  currentPage = 1;
  fetchConfigs(currentPage, currentSearchKeyword);
});

function fetchPendingConfigs(page = pendingCurrentPage) {
  fetch(`/api/pending?page=${page}&pageSize=${pendingPageSize}`)
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        pendingTotalItems = data.total;
        pendingCurrentPage = data.page;
        pendingTotalPagesSpan.innerText = Math.ceil(pendingTotalItems / pendingPageSize);
        pendingCurrentPageSpan.innerText = pendingCurrentPage;
        allPendingConfigs = data.data;
        renderPendingConfig(allPendingConfigs);
        updatePendingPaginationButtons();
      } else { showMessage(data.message, 'error'); }
    }).catch(() => showMessage('网络错误', 'error'));
}

function renderPendingConfig(configs) {
  pendingTableBody.innerHTML = '';
  if (configs.length === 0) {
    pendingTableBody.innerHTML = '<tr><td colspan="7">没有待审核数据</td></tr>';
    return;
  }
  configs.forEach(config => {
    const row = document.createElement('tr');
    const safeName = escapeHTML(config.name || '');
    const normalizedUrl = normalizeUrl(config.url);
    const urlCell = normalizedUrl
      ? `<a href="${escapeHTML(normalizedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(normalizedUrl)}</a>`
      : (config.url ? escapeHTML(config.url) : '未提供');
    const normalizedLogo = normalizeUrl(config.logo);
    const logoCell = normalizedLogo
      ? `<img src="${escapeHTML(normalizedLogo)}" alt="${safeName}" style="width:30px;" />`
      : 'N/A';
    const descCell = config.desc ? escapeHTML(config.desc) : 'N/A';
    const catelogCell = escapeHTML(config.catelog || '');
    row.innerHTML = `
      <td>${config.id}</td>
      <td>${safeName}</td>
      <td>${urlCell}</td>
      <td>${logoCell}</td>
      <td>${descCell}</td>
      <td>${catelogCell}</td>
      <td class="actions">
        <button class="approve-btn" data-id="${config.id}">批准</button>
        <button class="reject-btn" data-id="${config.id}">拒绝</button>
      </td>
    `;
    pendingTableBody.appendChild(row);
  });
  bindPendingActionEvents();
}

function bindPendingActionEvents() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', function() { handleApprove(this.dataset.id); });
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', function() { handleReject(this.dataset.id); });
  });
}

function handleApprove(id) {
  if (!confirm('确定批准吗？')) return;
  fetch(`/api/pending/${id}`, { method: 'PUT' })
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) { showMessage('批准成功', 'success'); fetchPendingConfigs(); fetchConfigs(); }
      else { showMessage(data.message, 'error'); }
    }).catch(() => showMessage('网络错误', 'error'));
}

function handleReject(id) {
  if (!confirm('确定拒绝吗？')) return;
  fetch(`/api/pending/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) { showMessage('拒绝成功', 'success'); fetchPendingConfigs(); }
      else { showMessage(data.message, 'error'); }
    }).catch(() => showMessage('网络错误', 'error'));
}

function updatePendingPaginationButtons() {
  pendingPrevPageBtn.disabled = pendingCurrentPage === 1;
  pendingNextPageBtn.disabled = pendingCurrentPage >= Math.ceil(pendingTotalItems / pendingPageSize);
}

pendingPrevPageBtn.addEventListener('click', () => { if (pendingCurrentPage > 1) fetchPendingConfigs(pendingCurrentPage - 1); });
pendingNextPageBtn.addEventListener('click', () => { if (pendingCurrentPage < Math.ceil(pendingTotalItems / pendingPageSize)) fetchPendingConfigs(pendingCurrentPage + 1); });

fetchConfigs();
fetchPendingConfigs();
if (categoryTableBody) fetchCategories();
