// public/js/admin-batch.js

// ===================================
// 批量管理功能 (Batch Management)
// ===================================

const batchBtn = document.getElementById('batchBtn');
const batchModal = document.getElementById('batchModal');
const closeBatchModal = document.getElementById('closeBatchModal');

// 批量状态
let batchCurrentPage = 1;
let batchPageSize = 50;
let batchTotalItems = 0;
let batchData = [];
let batchSelectedIds = new Set();
let batchCurrentFilter = '';

// 批量元素
const batchTableBody = document.getElementById('batchTableBody');
const batchSelectAll = document.getElementById('batchSelectAll');
const batchSelectedCount = document.getElementById('batchSelectedCount');
const batchCategoryFilter = document.getElementById('batchCategoryFilter');

// 批量操作按钮
const batchDeleteBtn = document.getElementById('batchDeleteBtn');
const batchChangeCategoryBtn = document.getElementById('batchChangeCategoryBtn');
const batchChangePrivacyBtn = document.getElementById('batchChangePrivacyBtn');

// 分页元素
const batchPrevPage = document.getElementById('batchPrevPage');
const batchNextPage = document.getElementById('batchNextPage');
const batchCurrentPageNum = document.getElementById('batchCurrentPageNum');
const batchTotalPagesNum = document.getElementById('batchTotalPagesNum');
const batchPageSizeSelect = document.getElementById('batchPageSize');

// 批量删除模态框元素
const batchDeleteConfirmModal = document.getElementById('batchDeleteConfirmModal');
const closeBatchDeleteConfirmModal = document.getElementById('closeBatchDeleteConfirmModal');
const cancelBatchDeleteBtn = document.getElementById('cancelBatchDeleteBtn');
const confirmBatchDeleteBtn = document.getElementById('confirmBatchDeleteBtn');
const batchDeleteConfirmText = document.getElementById('batchDeleteConfirmText');

// 初始化入口
if (batchBtn) {
  batchBtn.addEventListener('click', () => {
    // 初始化分类过滤器 (确保树已构建)
    // categoriesTree 和 categoriesData 来自 admin.js 的全局变量
    if (typeof window.categoriesTree !== 'undefined' && window.categoriesTree.length === 0) {
        fetch('/api/categories?pageSize=9999').then(res => res.json()).then(data => {
            if(data.code === 200) {
                // 更新全局变量
                if(typeof window.categoriesData !== 'undefined') window.categoriesData = data.data;
                // buildCategoryTree 需要在 admin.js 中定义为全局
                if(typeof window.buildCategoryTree === 'function') {
                    window.categoriesTree = window.buildCategoryTree(window.categoriesData);
                    if (typeof window.createCascadingDropdown === 'function') {
                        window.createCascadingDropdown('batchCategoryFilterWrapper', 'batchCategoryFilter', window.categoriesTree, null, null);
                    }
                    openBatchModal();
                }
            } else {
                if (typeof window.showMessage === 'function') window.showMessage('加载分类失败', 'error');
            }
        });
    } else if (typeof window.createCascadingDropdown === 'function') {
        window.createCascadingDropdown('batchCategoryFilterWrapper', 'batchCategoryFilter', window.categoriesTree, null, null);
        openBatchModal();
    }
  });
}

function openBatchModal() {
    if (!batchModal) return;
    document.body.classList.add('modal-open'); // 禁用背景滚动
    batchModal.style.display = 'flex';
    batchModal.style.alignItems = 'center';
    batchModal.style.justifyContent = 'center';
    batchCurrentPage = 1;
    batchSelectedIds.clear();
    updateBatchUI();
    fetchBatchData();
}

if (closeBatchModal) {
    closeBatchModal.addEventListener('click', () => {
        batchModal.style.display = 'none';
        document.body.classList.remove('modal-open'); // 恢复背景滚动
    });
}

if (batchModal) {
    batchModal.addEventListener('click', (e) => {
        if (e.target === batchModal) {
            batchModal.style.display = 'none';
            document.body.classList.remove('modal-open'); // 恢复背景滚动
        }
    });
}

// 分页事件
if (batchPrevPage) {
    batchPrevPage.addEventListener('click', () => {
        if (batchCurrentPage > 1) {
            batchCurrentPage--;
            fetchBatchData();
        }
    });
}

if (batchNextPage) {
    batchNextPage.addEventListener('click', () => {
        if (batchCurrentPage < Math.ceil(batchTotalItems / batchPageSize)) {
            batchCurrentPage++;
            fetchBatchData();
        }
    });
}

if (batchPageSizeSelect) {
    batchPageSizeSelect.addEventListener('change', () => {
        batchPageSize = parseInt(batchPageSizeSelect.value);
        batchCurrentPage = 1;
        fetchBatchData();
    });
}

// 过滤器事件
if (batchCategoryFilter) {
    batchCategoryFilter.addEventListener('change', () => {
        batchCurrentFilter = batchCategoryFilter.value; // Name or empty
        batchCurrentPage = 1;
        batchSelectedIds.clear(); // 过滤改变时清空选择，避免误操作
        updateBatchUI();
        fetchBatchData();
    });
}

// 全选事件
if (batchSelectAll) {
    batchSelectAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const checkboxes = document.querySelectorAll('.batch-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            const id = parseInt(cb.dataset.id);
            if (checked) {
                batchSelectedIds.add(id);
            } else {
                batchSelectedIds.delete(id);
            }
        });
        updateBatchUI();
    });
}

// 加载数据
function fetchBatchData() {
    if (!batchTableBody) return;
    batchTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">加载中...</td></tr>';
    
    // 复用 API: /api/config
    let url = `/api/config?page=${batchCurrentPage}&pageSize=${batchPageSize}`;
    
    // 如果有分类过滤
    if (batchCurrentFilter) {
        // 使用 catalogId 而不是 catalog，确保精确匹配，且 batchCurrentFilter 存的是 ID
        url += `&catalogId=${encodeURIComponent(batchCurrentFilter)}`;
    }

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                batchData = data.data;
                batchTotalItems = data.total;
                renderBatchTable(batchData);
                
                batchCurrentPage = data.page; // Use server returned page
                batchCurrentPageNum.innerText = batchCurrentPage;
                batchTotalPagesNum.innerText = Math.ceil(batchTotalItems / batchPageSize) || 1;
                
                batchPrevPage.disabled = batchCurrentPage <= 1;
                batchNextPage.disabled = batchCurrentPage >= Math.ceil(batchTotalItems / batchPageSize);
            } else {
                batchTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">${data.message}</td></tr>`;
            }
        }).catch(err => {
            batchTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">网络错误</td></tr>';
        });
}

function renderBatchTable(data) {
    if (!batchTableBody) return;
    batchTableBody.innerHTML = '';
    if (data.length === 0) {
        batchTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">没有数据</td></tr>';
        return;
    }

    // 检查是否所有当前页数据都被选中，以更新全选框状态
    let allSelected = true;

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 border-b';
        const isChecked = batchSelectedIds.has(item.id);
        if (!isChecked) allSelected = false;

        const logoHtml = item.logo ? `<img src="${window.escapeHTML(window.normalizeUrl(item.logo))}" class="w-6 h-6 rounded object-cover">` : '<span class="w-6 h-6 bg-gray-200 rounded block"></span>';
        
        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" class="batch-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
            </td>
            <td class="p-3 text-gray-500">${item.id}</td>
            <td class="p-3">${logoHtml}</td>
            <td class="p-3">
                <div class="font-medium text-gray-900 truncate max-w-[200px]" title="${window.escapeHTML(item.name)}">${window.escapeHTML(item.name)}</div>
                <div class="text-xs text-gray-400 truncate max-w-[200px]">${window.escapeHTML(item.url)}</div>
            </td>
            <td class="p-3 text-gray-600">${window.escapeHTML(item.catelog_name || '未分类')}</td>
            <td class="p-3 text-center">
                ${item.is_private ? '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">私密</span>' : '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">公开</span>'}
            </td>
        `;
        batchTableBody.appendChild(tr);
    });

    batchSelectAll.checked = data.length > 0 && allSelected;

    // 绑定行内 Checkbox 事件
    document.querySelectorAll('.batch-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) {
                batchSelectedIds.add(id);
            } else {
                batchSelectedIds.delete(id);
            }
            // 检查全选状态
            const allCheckboxes = document.querySelectorAll('.batch-checkbox');
            const allChecked = Array.from(allCheckboxes).every(c => c.checked);
            batchSelectAll.checked = allChecked;
            
            updateBatchUI();
        });
    });
}

function updateBatchUI() {
    const count = batchSelectedIds.size;
    batchSelectedCount.innerText = count;
    
    const disabled = count === 0;
    batchDeleteBtn.disabled = disabled;
    batchChangeCategoryBtn.disabled = disabled;
    batchChangePrivacyBtn.disabled = disabled;
    
    if (disabled) {
        batchDeleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        batchChangeCategoryBtn.classList.add('opacity-50', 'cursor-not-allowed');
        batchChangePrivacyBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        batchDeleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        batchChangeCategoryBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        batchChangePrivacyBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// 批量删除按钮点击
if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', () => {
        const count = batchSelectedIds.size;
        if (count === 0) return;
        
        // 更新提示文本
        if (batchDeleteConfirmText) {
            batchDeleteConfirmText.textContent = `确定要删除选中的 ${count} 条书签吗？`;
        }
        
        // 显示模态框
        if (batchDeleteConfirmModal) {
            batchDeleteConfirmModal.style.display = 'block';
        }
    });
}

// 绑定删除确认模态框关闭/取消事件
if (closeBatchDeleteConfirmModal) closeBatchDeleteConfirmModal.onclick = () => batchDeleteConfirmModal.style.display = 'none';
if (cancelBatchDeleteBtn) cancelBatchDeleteBtn.onclick = () => batchDeleteConfirmModal.style.display = 'none';
if (batchDeleteConfirmModal) {
    batchDeleteConfirmModal.onclick = (e) => {
        if (e.target === batchDeleteConfirmModal) batchDeleteConfirmModal.style.display = 'none';
    };
}

// 绑定确认删除事件
if (confirmBatchDeleteBtn) {
    confirmBatchDeleteBtn.onclick = () => {
        performBatchAction('delete', { });
        batchDeleteConfirmModal.style.display = 'none';
    };
}

// 批量更改分类
const batchCategoryModal = document.getElementById('batchCategoryModal');
const closeBatchCategoryModal = document.getElementById('closeBatchCategoryModal');
const cancelBatchCategoryBtn = document.getElementById('cancelBatchCategoryBtn');
const confirmBatchCategoryBtn = document.getElementById('confirmBatchCategoryBtn');
const batchTargetCategoryInput = document.getElementById('batchTargetCategory');

if (batchChangeCategoryBtn) {
    batchChangeCategoryBtn.addEventListener('click', () => {
        if (batchSelectedIds.size === 0) return;
        if (typeof window.createCascadingDropdown === 'function') {
            window.createCascadingDropdown('batchTargetCategoryWrapper', 'batchTargetCategory', window.categoriesTree);
        }
        batchCategoryModal.style.display = 'block';
    });
}

if (closeBatchCategoryModal) closeBatchCategoryModal.onclick = () => batchCategoryModal.style.display = 'none';
if (cancelBatchCategoryBtn) cancelBatchCategoryBtn.onclick = () => batchCategoryModal.style.display = 'none';

if (confirmBatchCategoryBtn) {
    confirmBatchCategoryBtn.addEventListener('click', () => {
        const targetId = batchTargetCategoryInput.value;
        if (!targetId || targetId === '0') {
            alert('请选择一个有效的分类'); 
            return;
        }
        
        performBatchAction('update_category', { categoryId: targetId });
        batchCategoryModal.style.display = 'none';
    });
}

// 批量更改隐私
const batchPrivacyModal = document.getElementById('batchPrivacyModal');
const closeBatchPrivacyModal = document.getElementById('closeBatchPrivacyModal');
const cancelBatchPrivacyBtn = document.getElementById('cancelBatchPrivacyBtn');
const confirmBatchPrivacyBtn = document.getElementById('confirmBatchPrivacyBtn');

if (batchChangePrivacyBtn) {
    batchChangePrivacyBtn.addEventListener('click', () => {
        if (batchSelectedIds.size === 0) return;
        batchPrivacyModal.style.display = 'block';
    });
}

if (closeBatchPrivacyModal) closeBatchPrivacyModal.onclick = () => batchPrivacyModal.style.display = 'none';
if (cancelBatchPrivacyBtn) cancelBatchPrivacyBtn.onclick = () => batchPrivacyModal.style.display = 'none';

if (confirmBatchPrivacyBtn) {
    confirmBatchPrivacyBtn.addEventListener('click', async () => {
        const privacyVal = document.querySelector('input[name="batchPrivacyOption"]:checked').value;
        const isPrivate = privacyVal === '1';
        
        // 自动更新关联的分类为公开
        if (!isPrivate) {
            // 找出所有选中的 Item，然后收集涉及的私密分类ID
            const categoriesToUpdate = new Set();
            batchSelectedIds.forEach(id => {
                const item = batchData.find(d => d.id == id); // 注意：batchData 仅含当前页数据
                // 如果是全选跨页操作，这里可能有问题，因为 batchData 只有当前页。
                // 但目前的 UI 实现仅支持当前页操作 (checkboxes 都是根据 batchData 渲染的)
                if (item && item.catelog_id) {
                    const cat = window.categoriesData.find(c => c.id == item.catelog_id);
                    if (cat && cat.is_private) {
                        categoriesToUpdate.add(item.catelog_id);
                    }
                }
            });
            
            if (categoriesToUpdate.size > 0) {
                 window.showMessage(`正在自动公开 ${categoriesToUpdate.size} 个私密分类...`, 'info');
                 // 并发更新分类
                 const updates = Array.from(categoriesToUpdate).map(catId => {
                     const cat = window.categoriesData.find(c => c.id == catId);
                     return fetch(`/api/categories/${catId}`, {
                         method: 'PUT',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ ...cat, is_private: false })
                     });
                 });
                 
                  try {
                      await Promise.all(updates);
                      // 刷新分类数据
                      if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
                  } catch (e) {
                     window.showMessage('自动公开分类失败', 'error');
                     return;
                 }
            }
        }
        
        performBatchAction('update_privacy', { isPrivate: isPrivate });
        batchPrivacyModal.style.display = 'none';
    });
}

// 执行批量请求
function performBatchAction(action, payload) {
    const ids = Array.from(batchSelectedIds);
    window.showMessage('正在处理...', 'info');
    
    fetch('/api/config/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: action,
            ids: ids,
            payload: payload
        })
    }).then(res => res.json())
      .then(data => {
          if (data.code === 200) {
              window.showMessage(data.message, 'success');
              // 刷新表格
              fetchBatchData();
              // 刷新主界面数据（因为主界面数据也变了）
              if (typeof window.fetchConfigs === 'function') window.fetchConfigs();
              // 如果更改了隐私，分类状态也可能变了，刷新分类
              if (typeof window.fetchCategories === 'function') window.fetchCategories();
              
              // 清空选择
              batchSelectedIds.clear();
              updateBatchUI();
          } else {
              window.showMessage(data.message || '操作失败', 'error');
          }
      }).catch(err => {
          window.showMessage('网络错误: ' + err.message, 'error');
      });
}
