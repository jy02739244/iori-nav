/**
 * admin-categories.js
 * 分类管理功能：列表展示、增删改查、排序
 */

// DOM Elements
const categoryGrid = document.getElementById('categoryGrid');
const categoryPrevPageBtn = document.getElementById('categoryPrevPage');
const categoryNextPageBtn = document.getElementById('categoryNextPage');
const categoryCurrentPageSpan = document.getElementById('categoryCurrentPage');
const categoryTotalPagesSpan = document.getElementById('categoryTotalPages');
const categoryPageSizeSelect = document.getElementById('categoryPageSizeSelect');
const addCategoryBtn = document.getElementById('addCategoryBtn');

// State
let categoryCurrentPage = 1;
let categoryPageSize = 10000; // Default show all for tree view structure
let categoryTotalItems = 0;
let currentViewParentId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCategoryEvents();
    // 初始加载由 tab 切换或 admin.js 触发
});

function initCategoryEvents() {
    // Page Size
    if (categoryPageSizeSelect) {
        categoryPageSizeSelect.value = categoryPageSize;
        categoryPageSizeSelect.addEventListener('change', () => {
            categoryPageSize = parseInt(categoryPageSizeSelect.value);
            categoryCurrentPage = 1;
            fetchCategories(categoryCurrentPage);
        });
    }

    // Pagination
    if (categoryPrevPageBtn) {
        categoryPrevPageBtn.addEventListener('click', () => {
            if (categoryCurrentPage > 1) {
                categoryCurrentPage--;
                fetchCategories(categoryCurrentPage);
            }
        });
    }

    if (categoryNextPageBtn) {
        categoryNextPageBtn.addEventListener('click', () => {
            if (categoryCurrentPage < Math.ceil(categoryTotalItems / categoryPageSize)) {
                categoryCurrentPage++;
                fetchCategories(categoryCurrentPage);
            }
        });
    }

    // Add Category Button
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            // Populate dropdown with current tree
            // Ensure createCascadingDropdown is available (from admin.js)
            if (typeof window.createCascadingDropdown === 'function') {
                window.createCascadingDropdown('newCategoryParentWrapper', 'newCategoryParent', window.categoriesTree, '0');
            }
            const modal = document.getElementById('addCategoryModal');
            if (modal) {
                modal.style.display = 'block';
                document.body.classList.add('modal-open');
            }
        });
    }
}

// Global function to be called by Tab switching in admin.js
window.fetchCategories = function(page = categoryCurrentPage) {
    if (!categoryGrid) return;
    
    categoryGrid.innerHTML = '<div class="col-span-full text-center py-10">加载中...</div>';
    
    fetch(`/api/categories?page=${page}&pageSize=${categoryPageSize}`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                categoryTotalItems = data.total;
                categoryCurrentPage = data.page;
                
                if (categoryTotalPagesSpan) categoryTotalPagesSpan.innerText = Math.ceil(categoryTotalItems / categoryPageSize);
                if (categoryCurrentPageSpan) categoryCurrentPageSpan.innerText = categoryCurrentPage;
                
                // Update global data (defined in admin.js)
                window.categoriesData = data.data || [];
                
                // Rebuild Tree
                if (typeof window.buildCategoryTree === 'function') {
                    window.categoriesTree = window.buildCategoryTree(window.categoriesData);
                }
                
                renderCategoryView(currentViewParentId);
                updateCategoryPaginationButtons();
                
                // Also refresh dropdowns if they exist in other tabs (optional but good consistency)
                // We might need a global event or callback for this.
            } else {
                window.showMessage(data.message || '加载分类失败', 'error');
                categoryGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">加载失败</div>';
            }
        }).catch((err) => {
            console.error('Fetch Categories Error:', err);
            window.showMessage('网络错误: ' + err.message, 'error');
            categoryGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">加载失败</div>';
        });
};

function updateCategoryPaginationButtons() {
    if (categoryPrevPageBtn) categoryPrevPageBtn.disabled = categoryCurrentPage <= 1;
    if (categoryNextPageBtn) categoryNextPageBtn.disabled = categoryCurrentPage >= Math.ceil(categoryTotalItems / categoryPageSize);
}

function renderCategoryView(parentId) {
    currentViewParentId = parentId;
    updateCategoryBreadcrumb(parentId);
    
    let nodesToRender = [];
    if (!parentId || parentId == '0') {
        nodesToRender = window.categoriesTree || [];
    } else {
        // Find the node in the tree
        const findNode = (nodes, id) => {
            for(const node of nodes) {
                if(node.id == id) return node;
                if(node.children) {
                    const found = findNode(node.children, id);
                    if(found) return found;
                }
            }
            return null;
        };
        const parentNode = findNode(window.categoriesTree, parentId);
        if(parentNode && parentNode.children) {
            nodesToRender = parentNode.children;
        } else {
            nodesToRender = [];
        }
    }
    renderCategoryCards(nodesToRender);
}

function updateCategoryBreadcrumb(parentId) {
    const backBtn = document.getElementById('categoryBackBtn');
    const breadcrumb = document.getElementById('categoryBreadcrumb');
    
    if(!parentId || parentId == '0') {
        if(backBtn) backBtn.classList.add('hidden');
        if(breadcrumb) breadcrumb.textContent = '顶级分类';
    } else {
        if(backBtn) backBtn.classList.remove('hidden');
        const cat = window.categoriesData.find(c => c.id == parentId);
        if(breadcrumb) breadcrumb.textContent = cat ? cat.catelog : '未知分类';
        
        if (backBtn) {
            backBtn.onclick = () => {
                 const currentCat = window.categoriesData.find(c => c.id == parentId);
                 if(currentCat && currentCat.parent_id && currentCat.parent_id != '0') {
                     renderCategoryView(currentCat.parent_id);
                 } else {
                     renderCategoryView(null);
                 }
            };
        }
    }
}

function renderCategoryCards(categories) {
    if (!categoryGrid) return;
    categoryGrid.innerHTML = '';
    if (!categories || categories.length === 0) {
        categoryGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">没有子分类数据</div>';
        return;
    }

    categories.forEach(item => {
        const card = document.createElement('div');
        const safeName = window.escapeHTML(item.catelog);
        const siteCount = item.site_count || 0;
        const sortValue = item.sort_order === null || item.sort_order === 9999 ? '默认' : item.sort_order;
        const subCount = item.children ? item.children.length : 0;

        // Private Icon
        const privateIcon = item.is_private ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="私密分类"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>` : '';

        card.className = 'site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-hidden relative cursor-move';
        card.draggable = true;
        card.dataset.id = item.id;
        card.dataset.sort = item.sort_order;

        card.innerHTML = `
            <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button class="category-edit-btn p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors" title="编辑" data-category-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button class="category-del-btn p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-full transition-colors" title="删除" data-category-id="${item.id}" data-site-count="${siteCount}" data-sub-count="${subCount}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="p-5">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center min-w-0">
                        <h3 class="text-lg font-medium text-gray-900 truncate" title="${safeName}">${safeName}</h3>
                        ${privateIcon}
                    </div>
                    <span class="bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-full border border-primary-100 flex-shrink-0 ml-2">ID: ${item.id}</span>
                </div>
                
                <div class="flex items-center text-sm text-gray-500 mt-4 space-x-4">
                    <div class="flex items-center" title="直接包含的书签数">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <span>${siteCount}</span>
                    </div>
                    <div class="flex items-center" title="子分类数量">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span>${subCount} 子分类</span>
                    </div>
                    <div class="flex items-center">
                        <span>排序: ${sortValue}</span>
                    </div>
                </div>
                
                <div class="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <button class="category-subs-btn text-xs flex items-center px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors" data-category-id="${item.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        管理子分类
                    </button>
                </div>
            </div>
        `;
        categoryGrid.appendChild(card);
    });

    bindCategoryEvents();
    setupCategoryDragAndDrop();
}

function bindCategoryEvents() {
    document.querySelectorAll('.category-edit-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const categoryId = this.getAttribute('data-category-id');
            const category = window.categoriesData.find(c => c.id == categoryId);
            if (category) {
                document.getElementById('editCategoryId').value = category.id;
                document.getElementById('editCategoryName').value = category.catelog;
                const sortOrder = category.sort_order;
                document.getElementById('editCategorySortOrder').value = (sortOrder === null || sortOrder === 9999) ? '' : sortOrder;
                document.getElementById('editCategoryIsPrivate').checked = !!category.is_private;
                
                if (typeof window.createCascadingDropdown === 'function') {
                    window.createCascadingDropdown('editCategoryParentWrapper', 'editCategoryParent', window.categoriesTree, category.parent_id || '0', category.id);
                }

                document.getElementById('editCategoryModal').style.display = 'block';
                document.body.classList.add('modal-open');
            } else {
                window.showMessage('找不到分类数据', 'error');
            }
        });
    });

    document.querySelectorAll('.category-del-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const category_id = this.getAttribute('data-category-id');
            const siteCount = parseInt(this.getAttribute('data-site-count') || '0');
            const subCount = parseInt(this.getAttribute('data-sub-count') || '0');
            
            if (siteCount > 0) {
                window.showMessage(`无法删除：该分类包含 ${siteCount} 个书签`, 'error');
                return;
            }
            if (subCount > 0) {
                window.showMessage(`无法删除：该分类包含 ${subCount} 个子分类`, 'error');
                return;
            }
            
            if (!category_id) return;
            
            // 使用自定义模态框而不是原生 confirm
            const deleteModal = document.getElementById('deleteCategoryConfirmModal');
            if (deleteModal) {
                // 解绑旧事件（如果有）
                const confirmBtn = document.getElementById('confirmDeleteCategoryBtn');
                const cancelBtn = document.getElementById('cancelDeleteCategoryBtn');
                const closeBtn = document.getElementById('closeDeleteCategoryConfirmModal');
                
                // 使用 cloneNode 快速清除所有 event listeners
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                
                newConfirmBtn.addEventListener('click', () => {
                     deleteCategory(category_id);
                     deleteModal.style.display = 'none';
                });
                
                const closeModal = () => {
                     deleteModal.style.display = 'none';
                     document.body.classList.remove('modal-open');
                }
                cancelBtn.onclick = closeModal;
                closeBtn.onclick = closeModal;
                
                deleteModal.style.display = 'block';
                document.body.classList.add('modal-open');
            } else if (confirm('确定删除该分类吗？')) {
                deleteCategory(category_id);
            }
        });
    });
  
    document.querySelectorAll('.category-subs-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const categoryId = this.getAttribute('data-category-id');
            renderCategoryView(categoryId);
        });
    });
}

function deleteCategory(id) {
    fetch('/api/categories/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }) // Logical delete or reset
    }).then(res => res.json()).then(data => {
        if (data.code === 200) {
            window.showMessage('删除成功', 'success');
            // Refresh categories and also bookmarks configs because dropdowns/counts might change
            fetchCategories();
            if (typeof fetchConfigs === 'function') fetchConfigs();
            if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
        } else {
            window.showMessage(data.message || '删除失败', 'error');
        }
    });
}

function setupCategoryDragAndDrop() {
    const cards = document.querySelectorAll('#categoryGrid .site-card');
    let draggedItem = null;

    cards.forEach(card => {
        card.addEventListener('dragstart', function (e) {
            draggedItem = this;
            this.classList.add('opacity-50', 'scale-95');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });

        card.addEventListener('dragend', function () {
            this.classList.remove('opacity-50', 'scale-95');
            draggedItem = null;
            document.querySelectorAll('#categoryGrid .site-card').forEach(c => c.classList.remove('border-2', 'border-accent-500'));
        });

        card.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('border-2', 'border-accent-500');
        });

        card.addEventListener('dragleave', function () {
            this.classList.remove('border-2', 'border-accent-500');
        });

        card.addEventListener('drop', function (e) {
            e.preventDefault();
            this.classList.remove('border-2', 'border-accent-500');

            if (draggedItem !== this) {
                const allCards = Array.from(categoryGrid.children);
                const draggedIdx = allCards.indexOf(draggedItem);
                const droppedIdx = allCards.indexOf(this);

                if (draggedIdx < droppedIdx) {
                    this.after(draggedItem);
                } else {
                    this.before(draggedItem);
                }

                saveCategorySortOrder();
            }
        });
    });
}

function saveCategorySortOrder() {
    const cards = document.querySelectorAll('#categoryGrid .site-card');
    const updates = [];

    cards.forEach((card, index) => {
        const id = card.dataset.id;
        const newSortOrder = index + 1;
        const category = window.categoriesData.find(c => c.id == id);
        if (!category) return;

        updates.push(fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...category,
                sort_order: newSortOrder
            })
        }));
    });

    if (updates.length > 0) {
        window.showMessage('正在保存分类排序...', 'info');
        Promise.all(updates)
            .then(() => {
                window.showMessage('分类排序已保存', 'success');
                // Refresh to sync state
                fetchCategories();
                // Also refresh main config as order might affect things? Probably not but safe.
                if (typeof fetchConfigs === 'function') fetchConfigs();
            })
            .catch(err => window.showMessage('保存排序失败: ' + err.message, 'error'));
    }
}


// ========== 编辑分类功能 ==========
const editCategoryModal = document.getElementById('editCategoryModal');
const closeEditCategoryModal = document.getElementById('closeEditCategoryModal');
const editCategoryForm = document.getElementById('editCategoryForm');

const cancelEditCategoryBtn = document.getElementById('cancelEditCategoryBtn');
if (cancelEditCategoryBtn) {
  cancelEditCategoryBtn.addEventListener('click', () => {
    editCategoryModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  });
}

if (closeEditCategoryModal) {
    closeEditCategoryModal.addEventListener('click', () => {
        editCategoryModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });
}

if (editCategoryForm) {
    editCategoryForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const id = document.getElementById('editCategoryId').value;
        const categoryName = document.getElementById('editCategoryName').value.trim();
        const sortOrder = document.getElementById('editCategorySortOrder').value.trim();
        const parentId = document.getElementById('editCategoryParent').value;
        const isPrivate = document.getElementById('editCategoryIsPrivate').checked;

        if (!categoryName) {
            window.showMessage('分类名称不能为空', 'error');
            return;
        }

        // Check duplicate name (excluding self)
        const isDuplicate = window.categoriesData.some(category => category.catelog === categoryName && category.id != id);
        if (isDuplicate) {
            window.showMessage('该分类名称已存在', 'error');
            return;
        }

        const payload = {
            catelog: categoryName,
            parent_id: parentId,
            is_private: isPrivate
        };

        if (sortOrder !== '') {
            payload.sort_order = Number(sortOrder);
        }

        fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(res => res.json())
            .then(data => {
                if (data.code === 200) {
                    window.showMessage('分类更新成功', 'success');
                    editCategoryModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    fetchCategories(categoryCurrentPage);
                    // 刷新主界面数据（因为分类名可能变了）
                    if (typeof fetchConfigs === 'function') fetchConfigs();
                    if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
                } else {
                    window.showMessage(data.message || '分类更新失败', 'error');
                }
            }).catch(err => {
                window.showMessage('网络错误: ' + err.message, 'error');
            });
    });
}

// ========== 新增分类功能 ==========
const addCategoryModal = document.getElementById('addCategoryModal');
const closeCategoryModal = document.getElementById('closeCategoryModal');
const addCategoryForm = document.getElementById('addCategoryForm');

const cancelAddCategoryBtn = document.getElementById('cancelAddCategoryBtn');
if (cancelAddCategoryBtn) {
  cancelAddCategoryBtn.addEventListener('click', () => {
    addCategoryModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (addCategoryForm) addCategoryForm.reset();
  });
}

if (closeCategoryModal) {
    closeCategoryModal.addEventListener('click', () => {
        addCategoryModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        addCategoryForm.reset();
    });
}

// 提交新增分类表单
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const categoryName = document.getElementById('newCategoryName').value.trim();
        const sortOrder = document.getElementById('newCategorySortOrder').value.trim();
        const parentId = document.getElementById('newCategoryParent').value;
        const isPrivate = document.getElementById('newCategoryIsPrivate').checked;

        if (!categoryName) {
            window.showMessage('分类名称不能为空', 'error');
            return;
        }

        const payload = {
            catelog: categoryName,
            parent_id: parentId,
            is_private: isPrivate
        };

        if (sortOrder !== '') {
            payload.sort_order = Number(sortOrder);
        }

        fetch('/api/categories/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(res => res.json())
            .then(data => {
                if (data.code === 201 || data.code === 200) {
                    window.showMessage('分类创建成功', 'success');
                    addCategoryModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    addCategoryForm.reset();

                    fetchCategories();
                    // 刷新主界面数据（因为主界面数据也变了，比如下拉框需要更新）
                    if (typeof fetchConfigs === 'function') fetchConfigs();
                    if (typeof window.loadGlobalCategories === 'function') window.loadGlobalCategories();
                } else {
                    window.showMessage(data.message || '分类创建失败', 'error');
                }
            }).catch(err => {
                window.showMessage('网络错误: ' + err.message, 'error');
            });
    });
}

