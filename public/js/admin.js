const configGrid = document.getElementById('configGrid');
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
const categoryGrid = document.getElementById('categoryGrid');
const categoryPrevPageBtn = document.getElementById('categoryPrevPage');
const categoryNextPageBtn = document.getElementById('categoryNextPage');
const categoryCurrentPageSpan = document.getElementById('categoryCurrentPage');
const categoryTotalPagesSpan = document.getElementById('categoryTotalPages');
const refreshCategoriesBtn = document.getElementById('refreshCategories');

function showMessage(text, type = 'info') {
  if (!messageDiv) return;
  messageDiv.innerText = text;
  messageDiv.style.display = 'block';
  
  if (type === 'success') {
    messageDiv.style.backgroundColor = '#d4edda';
    messageDiv.style.color = '#155724';
    messageDiv.style.border = '1px solid #c3e6cb';
  } else if (type === 'error') {
    messageDiv.style.backgroundColor = '#f8d7da';
    messageDiv.style.color = '#721c24';
    messageDiv.style.border = '1px solid #f5c6cb';
  } else {
    messageDiv.style.backgroundColor = '#d1ecf1';
    messageDiv.style.color = '#0c5460';
    messageDiv.style.border = '1px solid #bee5eb';
  }

  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}

function showModalMessage(modalId, text, type = 'info') {
  const messageBoxId = modalId.replace('Modal', 'Message');
  const messageBox = document.getElementById(messageBoxId);
  
  if (!messageBox) {
      console.warn('Message box not found for modal:', modalId);
      showMessage(text, type); // Fallback
      return;
  }

  messageBox.innerText = text;
  messageBox.style.visibility = 'visible';
  messageBox.style.display = 'block';
  messageBox.style.padding = '10px';
  messageBox.style.marginBottom = '15px';
  messageBox.style.borderRadius = '4px';
  messageBox.style.fontSize = '14px';

  if (type === 'success') {
    messageBox.style.backgroundColor = '#d4edda';
    messageBox.style.color = '#155724';
    messageBox.style.border = '1px solid #c3e6cb';
  } else if (type === 'error') {
    messageBox.style.backgroundColor = '#f8d7da';
    messageBox.style.color = '#721c24';
    messageBox.style.border = '1px solid #f5c6cb';
  } else {
    messageBox.style.backgroundColor = '#d1ecf1';
    messageBox.style.color = '#0c5460';
    messageBox.style.border = '1px solid #bee5eb';
  }

  setTimeout(() => {
    messageBox.style.visibility = 'hidden';
    messageBox.style.display = 'none';
  }, 3000);
}

function updatePaginationButtons() {
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= Math.ceil(totalItems / pageSize);
}

function updateCategoryPaginationButtons() {
  if (categoryPrevPageBtn) categoryPrevPageBtn.disabled = categoryCurrentPage <= 1;
  if (categoryNextPageBtn) categoryNextPageBtn.disabled = categoryCurrentPage >= Math.ceil(categoryTotalItems / categoryPageSize);
}

function updatePendingPaginationButtons() {
  if (pendingPrevPageBtn) pendingPrevPageBtn.disabled = pendingCurrentPage <= 1;
  if (pendingNextPageBtn) pendingNextPageBtn.disabled = pendingCurrentPage >= Math.ceil(pendingTotalItems / pendingPageSize);
}

var escapeHTML = function (value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '\'');
};

var normalizeUrl = function (value) {
  var trimmed = String(value || '').trim();
  var normalized = '';
  if (/^https?:\/\//i.test(trimmed)) {
    normalized = trimmed;
  } else if (/^[\w.-]+\.[\w.-]+/.test(trimmed)) {
    normalized = 'https://' + trimmed;
  }
  return normalized;
};


const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');

// 导入按钮点击事件
if (importBtn) {
  importBtn.addEventListener('click', () => {
    if (importFile) importFile.click();
  });
}

// 文件选择事件
if (importFile) {
  importFile.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      // Chrome 书签 HTML 格式导入
      reader.onload = function (event) {
        try {
          const htmlContent = event.target.result;
          const result = parseChromeBookmarks(htmlContent);

          if (result.sites.length === 0) {
            showMessage('未在文件中找到有效书签', 'error');
            return;
          }

          // 显示预览并确认导入
          showImportPreview(result);
        } catch (error) {
          console.error(error);
          showMessage('书签解析失败: ' + error.message, 'error');
        }
      };
      reader.readAsText(file, 'UTF-8');
    } else if (fileName.endsWith('.json')) {
      // 系统导出的 JSON 格式导入
      reader.onload = function (event) {
        try {
          const data = JSON.parse(event.target.result);

          // 简单确认后直接导入
          if (confirm('确定要导入这个 JSON 文件中的书签吗？')) {
            performImport(data);
          }
        } catch (error) {
          showMessage('JSON 文件解析失败: ' + error.message, 'error');
        }
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      showMessage('不支持的文件格式。请选择 .html 或 .json 文件。', 'error');
    }

    // Reset file input to allow re-selecting the same file
    e.target.value = '';
  });
}

// 导出按钮事件
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    fetch('/api/config/export')
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'config.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }).catch(err => {
        showMessage('网络错误', 'error');
      });
  });
}

// 解析 Chrome 书签 HTML - 支持多级分类
function parseChromeBookmarks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  let categories = [];
  // Map unique path -> category object to reuse categories within the import file
  let pathMap = new Map();
  let sites = [];
  let tempIdCounter = 1;

  // Helper to create or get category
  function getOrCreateCategory(name, parentTempId) {
    // Generate a key based on parentId + name to distinguish 'Dev > Tools' from 'Work > Tools'
    const key = `${parentTempId || 0}-${name}`;
    
    if (pathMap.has(key)) {
        return pathMap.get(key).id;
    }

    const newId = tempIdCounter++;
    const cat = {
        id: newId,
        catelog: name,
        parent_id: parentTempId || 0, // 0 for root
        sort_order: 9999
    };
    categories.push(cat);
    pathMap.set(key, cat);
    return newId;
  }

  function traverse(node, parentId) {
    // parentId is the temp ID of the folder we are currently processing. 0 for root.
    
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        
        // Typical structure: <DT><H3>Folder</H3><DL>...</DL></DT>
        // Or <DT><A>Link</A></DT>
        if (child.tagName === 'DT') {
            const h3 = child.querySelector(':scope > h3'); // Direct child check safer
            const a = child.querySelector(':scope > a');
            const dl = child.querySelector(':scope > dl');

            if (h3) {
                const folderName = h3.textContent.trim();
                let currentFolderId = parentId;

                // Handle Root Folders - Map them to 0 (Root) or create categories?
                // If parentId is 0, these are top-level.
                // "书签栏" often contains the actual bookmark tree.
                if (parentId === 0 && ['书签栏', 'Bookmarks Bar', '收藏夹', '其他书签', 'Other Bookmarks'].includes(folderName)) {
                     // Treat as root, don't create category, items inside go to root (or parentId 0)
                     currentFolderId = 0;
                } else {
                     currentFolderId = getOrCreateCategory(folderName, parentId);
                }
                
                // If DL is inside DT
                if (dl) {
                    traverse(dl, currentFolderId);
                } else {
                    // Sometimes DL is a sibling of DT?
                    // But in that case, the loop over `node` (the parent DL) will hit it next.
                    // But we need to know it belongs to *this* H3.
                    // Standard Netscape bookmarks: <DT><H3>...</H3><DL>...</DL> is inside DT?
                    // Let's check next sibling if dl is missing?
                    // Actually, DOMParser might handle valid HTML.
                    // If the format is <DT><H3>...</H3></DT><DL>...</DL> (sibling),
                    // then `dl` won't be found here.
                    // We'll handle DL in the main loop if it's a sibling.
                }
            } else if (a) {
                const url = a.getAttribute('href');
                if (url) {
                    sites.push({
                        name: a.textContent.trim() || '未命名',
                        url: url,
                        logo: a.getAttribute('icon') || '',
                        desc: '',
                        catelog_id: parentId,
                        sort_order: 9999
                    });
                }
            }
        } else if (child.tagName === 'DL') {
            // Found a DL list. If it's a sibling of a DT, we need to know which folder it belongs to.
            // But traverse() is called with `parentId`.
            // In a flat list of DTs and DLs, a DL usually follows a DT.
            // But tracking "current folder" in a loop is tricky if structure varies.
            // Assumption: The recursive `traverse(dl, currentFolderId)` above handles nested DLs.
            // If we find a DL here, it might be a sibling DL.
            // In many exports, <DT><H3>F</H3><DL>...</DL></DT> is the norm.
            // If we encounter a stray DL, we process it with current context (parentId).
            traverse(child, parentId);
        }
    }
  }

  // Start with body
  // Some exports have <DL> at root.
  const rootDl = doc.querySelector('dl');
  if (rootDl) {
      traverse(rootDl, 0);
  } else {
      traverse(doc.body, 0);
  }

  return { category: categories, sites: sites };
}

// 显示导入预览
function showImportPreview(result) {
  const previewModal = document.createElement('div');
  previewModal.className = 'modal';
  previewModal.style.display = 'block';

  // Build tree for preview
  const catMap = new Map();
  result.category.forEach(c => catMap.set(c.id, { ...c, count: 0, children: [] }));
  
  // Count sites per category
  result.sites.forEach(s => {
      if (s.catelog_id === 0) {
           // Root items
      } else if (catMap.has(s.catelog_id)) {
          catMap.get(s.catelog_id).count++;
      }
  });

  // Build hierarchy text
  let html = '';
  function buildPreviewHtml(parentId, depth) {
      let items = '';
      const prefix = '&nbsp;&nbsp;'.repeat(depth * 2) + (depth > 0 ? '└─ ' : '');
      
      // Find children
      const children = result.category.filter(c => c.parent_id === parentId);
      children.forEach(c => {
          const stats = catMap.get(c.id);
          items += `<li>${prefix}${escapeHTML(c.catelog)} <span class="text-gray-500 text-xs">(${stats.count} 书签)</span></li>`;
          items += buildPreviewHtml(c.id, depth + 1);
      });
      return items;
  }
  
  const treeHtml = buildPreviewHtml(0, 0);
  const rootCount = result.sites.filter(s => s.catelog_id === 0).length;
  const rootHtml = rootCount > 0 ? `<li>(根目录) <span class="text-gray-500 text-xs">(${rootCount} 书签)</span></li>` : '';

  previewModal.innerHTML = `
    <div class="modal-content">
      <span class="modal-close" id="closePreviewModal">×</span>
      <h2>导入预览</h2>
      <div style="margin: 20px 0;">
        <p><strong>总共发现 ${result.sites.length} 个书签，${result.category.length} 个分类</strong></p>
        <div style="margin: 10px 0; padding: 10px; border: 1px solid #eee; max-height: 300px; overflow-y: auto; background: #f9f9f9;">
           <ul class="text-sm">
             ${rootHtml}
             ${treeHtml}
           </ul>
        </div>
        <p style="margin-top: 15px; color: #6c757d; font-size: 0.9rem;">
          注意: 将按照层级结构导入。若分类已存在（名称和父级匹配），将合并。
        </p>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
        <button id="cancelImport" class="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">取消</button>
        <button id="confirmImport" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">确认导入</button>
      </div>
    </div>
  `;

  document.body.appendChild(previewModal);

  document.getElementById('closePreviewModal').addEventListener('click', () => {
    document.body.removeChild(previewModal);
  });

  document.getElementById('cancelImport').addEventListener('click', () => {
    document.body.removeChild(previewModal);
  });

  document.getElementById('confirmImport').addEventListener('click', () => {
    document.body.removeChild(previewModal);
    performImport(result);
  });
  
   previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      document.body.removeChild(previewModal);
    }
  });
}

// 执行导入
function performImport(dataToImport) {
  showMessage('正在导入,请稍候...', 'info');

  fetch('/api/config/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataToImport)
  }).then(res => res.json())
    .then(data => {
      if (data.code === 201 || data.code === 200) {
        showMessage(data.message, 'success');
        fetchConfigs();
        fetchCategories(); // Refresh categories
      } else {
        showMessage(data.message || '导入失败', 'error');
      }
    }).catch(err => {
      showMessage('网络错误: ' + err.message, 'error');
    });
}

const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === tab) {
        content.classList.add('active');
      }
    })
    if (tab === 'categories') {
      fetchCategories();
    } else if (tab === 'pending') {
      fetchPendingConfigs();
    }
  });
});

if (refreshCategoriesBtn) {
  refreshCategoriesBtn.addEventListener('click', () => {
    fetchCategories();
  });
}

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const categoryPageSizeSelect = document.getElementById('categoryPageSizeSelect');

let currentPage = 1;
let pageSize = 50; // Default to 50
let totalItems = 0;
let allConfigs = [];
let currentSearchKeyword = '';
let currentCategoryFilter = '';

// Initialize Search
if (searchInput) {
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchKeyword = e.target.value.trim();
      currentPage = 1;
      fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
    }, 300);
  });
}

// Initialize Page Size
if (pageSizeSelect) {
  pageSizeSelect.value = pageSize; // Set default in UI
  pageSizeSelect.addEventListener('change', () => {
    pageSize = parseInt(pageSizeSelect.value);
    currentPage = 1;
    fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
  });
}

// Initialize Category Filter
if (categoryFilter) {
  fetch('/api/categories?pageSize=10000')
    .then(res => res.json())
    .then(data => {
      if (data.code === 200 && data.data) {
        categoriesData = data.data;
        categoriesTree = buildCategoryTree(categoriesData);
        createCascadingDropdown('categoryFilterWrapper', 'categoryFilter', categoriesTree);
      }
    });

  categoryFilter.addEventListener('change', () => {
    currentCategoryFilter = categoryFilter.value;
    currentPage = 1;
    fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
  });
}

let pendingCurrentPage = 1;
let pendingPageSize = 10;
let pendingTotalItems = 0;
let allPendingConfigs = [];

let categoryCurrentPage = 1;
let categoryPageSize = 10000;
let categoryTotalItems = 0;
let categoriesData = [];

// Initialize Category Page Size
if (categoryPageSizeSelect) {
  categoryPageSizeSelect.value = categoryPageSize;
  categoryPageSizeSelect.addEventListener('change', () => {
    categoryPageSize = parseInt(categoryPageSizeSelect.value);
    categoryCurrentPage = 1;
    fetchCategories(categoryCurrentPage);
  });
}

// Pagination Event Listeners
if (prevPageBtn) {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < Math.ceil(totalItems / pageSize)) {
      currentPage++;
      fetchConfigs(currentPage, currentSearchKeyword, currentCategoryFilter);
    }
  });
}

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

if (pendingPrevPageBtn) {
  pendingPrevPageBtn.addEventListener('click', () => {
    if (pendingCurrentPage > 1) {
      pendingCurrentPage--;
      fetchPendingConfigs(pendingCurrentPage);
    }
  });
}

if (pendingNextPageBtn) {
  pendingNextPageBtn.addEventListener('click', () => {
    if (pendingCurrentPage < Math.ceil(pendingTotalItems / pendingPageSize)) {
      pendingCurrentPage++;
      fetchPendingConfigs(pendingCurrentPage);
    }
  });
}


// ========== 编辑书签功能 ==========
const editBookmarkModal = document.getElementById('editBookmarkModal');
const closeEditBookmarkModal = document.getElementById('closeEditBookmarkModal');
const editBookmarkForm = document.getElementById('editBookmarkForm');
const getLogo = document.getElementById('getLogo');

if (closeEditBookmarkModal) {
  closeEditBookmarkModal.addEventListener('click', () => {
    editBookmarkModal.style.display = 'none';
  });
}


if (editBookmarkForm) {
  editBookmarkForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // 显式处理复选框
    data.is_private = document.getElementById('editBookmarkIsPrivate').checked;

    fetch(`/api/config/${data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(res => res.json())
      .then(data => {
        if (data.code === 200) {
          showModalMessage('editBookmarkModal', '修改成功', 'success');
          setTimeout(() => {
            fetchConfigs();
            editBookmarkModal.style.display = 'none';
          }, 1000);
        } else {
          showModalMessage('editBookmarkModal', data.message, 'error');
        }
      }).catch(err => {
        console.error('网络错误:', err);
        showModalMessage('editBookmarkModal', '网络错误', 'error');
      })
  });
}




// Helper: Build Category Tree
function buildCategoryTree(categories) {
    const map = new Map();
    const roots = [];
    
    // Initialize map
    categories.forEach(cat => {
        map.set(cat.id, { ...cat, children: [] });
    });
    
    // Build tree
    categories.forEach(cat => {
        if (cat.parent_id && map.has(cat.parent_id)) {
            map.get(cat.parent_id).children.push(map.get(cat.id));
        } else {
            roots.push(map.get(cat.id));
        }
    });
    
    // Sort
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
}

// Helper: Create Cascading Dropdown (Flat with Indentation)
function createCascadingDropdown(containerId, inputId, categoriesTree, initialValue = null, excludeId = null) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;
    
    // Determine context (Filter vs Parent Selection)
    const isFilter = inputId === 'categoryFilter';

    // Find initial label
    let initialLabel = '请选择分类';
    const findLabel = (nodes, id) => {
        for (const node of nodes) {
            if (String(node.id) === String(id)) return node.catelog;
            if (node.children) {
                const found = findLabel(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };
    
    if (initialValue && initialValue != '0') {
        // If isFilter, initialValue is likely a name, not ID.
        if (isFilter) {
             initialLabel = initialValue;
             input.value = initialValue;
        } else {
            const label = findLabel(categoriesTree, initialValue);
            if (label) initialLabel = label;
            input.value = initialValue;
        }
    } else if (initialValue == '0' && !isFilter) {
        initialLabel = '无 (顶级分类)';
        input.value = '0';
    } else if (isFilter && !initialValue) {
        initialLabel = '所有分类';
        input.value = '';
    } else {
        input.value = '';
    }

    container.innerHTML = '';
    
    // Render Trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-dropdown-trigger';
    trigger.textContent = initialLabel;
    container.appendChild(trigger);
    
    // Render Menu
    const menu = document.createElement('div');
    menu.className = 'custom-dropdown-menu';
    
    // Optional "None" option for parent selection
    if (inputId.toLowerCase().includes('parent')) {
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
    
    // "All Categories" for Filter
    if (isFilter) {
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

    // Flatten logic
    const renderItems = (nodes, depth = 0) => {
        nodes.forEach(node => {
            if (excludeId && node.id == excludeId) return; 
            
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            
            // Indentation using padding/margin or invisible chars
            // Using padding-left based on depth
            item.style.paddingLeft = `${15 + depth * 20}px`;
            
            let prefix = '';
            if (depth > 0) {
                prefix = '└─ ';
            }

            const textSpan = document.createElement('span');
            textSpan.textContent = prefix + node.catelog;
            item.appendChild(textSpan);
            
            // Click Event (Select)
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isFilter) {
                    input.value = node.catelog; // Filter uses Name
                } else {
                    input.value = node.id; // Others use ID
                }
                trigger.textContent = node.catelog;
                menu.classList.remove('show');
                input.dispatchEvent(new Event('change'));
            });
            
            menu.appendChild(item);
            
            if (node.children && node.children.length > 0) {
                renderItems(node.children, depth + 1);
            }
        });
    };
    
    renderItems(categoriesTree);
    container.appendChild(menu);
    
    // Toggle Menu
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close others
        document.querySelectorAll('.custom-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
    });
    
    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            menu.classList.remove('show');
        }
    });
}

function fetchConfigs(page = currentPage, keyword = currentSearchKeyword, catalog = currentCategoryFilter) {
  let url = `/api/config?page=${page}&pageSize=${pageSize}`;
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('pageSize', pageSize);

  if (keyword) {
    params.append('keyword', keyword);
  }

  if (catalog) {
    params.append('catalog', catalog);
  }

  url = `/api/config?${params.toString()}`;

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
    }).catch(err => {
      showMessage('网络错误', 'error');
    })
}

function fetchPendingConfigs(page = pendingCurrentPage) {
  if (!pendingTableBody) return;
  pendingTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-10">加载中...</td></tr>';
  fetch(`/api/pending?page=${page}&pageSize=${pendingPageSize}`)
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        pendingTotalItems = data.total;
        pendingCurrentPage = data.page;
        pendingTotalPagesSpan.innerText = Math.ceil(pendingTotalItems / pendingPageSize);
        pendingCurrentPageSpan.innerText = pendingCurrentPage;
        allPendingConfigs = data.data;
        renderPendingConfigs(allPendingConfigs);
        updatePendingPaginationButtons();
      } else {
        showMessage(data.message, 'error');
      }
    }).catch(err => {
      showMessage('网络错误', 'error');
    });
}

function renderPendingConfigs(configs) {
  if (!pendingTableBody) return;
  pendingTableBody.innerHTML = '';
  if (configs.length === 0) {
    pendingTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-10">暂无待审核数据</td></tr>';
    return;
  }
  configs.forEach(config => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-3 border-b">${config.id}</td>
      <td class="p-3 border-b">${escapeHTML(config.name)}</td>
      <td class="p-3 border-b truncate max-w-[200px]" title="${config.url}">${escapeHTML(config.url)}</td>
      <td class="p-3 border-b">${config.logo ? `<img src="${escapeHTML(normalizeUrl(config.logo))}" class="w-8 h-8 rounded">` : '无'}</td>
      <td class="p-3 border-b max-w-[200px] truncate" title="${config.desc}">${escapeHTML(config.desc)}</td>
      <td class="p-3 border-b">${escapeHTML(config.catelog)}</td>
      <td class="p-3 border-b">
        <div class="flex gap-2">
          <button class="approve-btn bg-green-100 text-green-600 hover:bg-green-200 px-2 py-1 rounded text-xs" data-id="${config.id}">通过</button>
          <button class="reject-btn bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded text-xs" data-id="${config.id}">拒绝</button>
        </div>
      </td>
    `;
    pendingTableBody.appendChild(tr);
  });
  bindPendingActionEvents();
}

function bindPendingActionEvents() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      handlePendingAction(this.dataset.id, 'approve');
    });
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      handlePendingAction(this.dataset.id, 'reject');
    });
  });
}

function handlePendingAction(id, action) {
  const method = action === 'approve' ? 'POST' : 'DELETE';
  const url = `/api/pending/${id}`;
  
  fetch(url, { method: method })
    .then(res => res.json())
    .then(data => {
      if (data.code === 200 || data.code === 201) {
        showMessage(action === 'approve' ? '审批通过' : '已拒绝', 'success');
        fetchPendingConfigs();
        if (action === 'approve') fetchConfigs();
      } else {
        showMessage(data.message, 'error');
      }
    }).catch(() => showMessage('操作失败', 'error'));
}

function renderConfig(configs) {
  if (!configGrid) return;
  configGrid.innerHTML = '';
  if (configs.length === 0) {
    configGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">没有配置数据</div>';
    return
  }
  configs.forEach(config => {
    const card = document.createElement('div');
    const safeName = escapeHTML(config.name || '');
    const normalizedUrl = normalizeUrl(config.url);
    const displayUrl = config.url ? escapeHTML(config.url) : '未提供';
    const normalizedLogo = normalizeUrl(config.logo);
    const descCell = config.desc ? escapeHTML(config.desc) : '暂无描述';
    const safeCatalog = escapeHTML(config.catelog || '未分类');
    const cardInitial = (safeName.charAt(0) || '站').toUpperCase();

    // Added cursor-pointer
    card.className = 'site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-hidden relative cursor-pointer';
    card.draggable = true;
    card.dataset.id = config.id;
    
    // Add click event listener to open URL
    card.addEventListener('click', (e) => {
        // Prevent if clicking on buttons or dragging (though buttons have stopPropagation)
        // Also check if user is selecting text (optional but good UX)
        if (normalizedUrl) {
            window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
        }
    });

    // Logo render logic
    let logoHtml = '';
    if (normalizedLogo) {
      logoHtml = `<img src="${escapeHTML(normalizedLogo)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100">`;
    } else {
      logoHtml = `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`;
    }

    card.innerHTML = `
      <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
         <button class="edit-btn p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors" title="编辑" data-id="${config.id}">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
             </svg>
         </button>
         <button class="del-btn p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors" title="删除" data-id="${config.id}">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
             </svg>
         </button>
      </div>

      <div class="p-5 cursor-move">
        <div class="block">
            <div class="flex items-start">
               <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300 group-hover:scale-105">
                  ${logoHtml}
               </div>
               <div class="flex-1 min-w-0">
                  <h3 class="site-title text-base font-medium text-gray-900 truncate" title="${safeName}">${safeName}</h3>
                  <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700">
                    ${safeCatalog}
                  </span>
               </div>
            </div>
            <p class="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2 h-10" title="${descCell}">${descCell}</p>
        </div>
        
        <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
             <span class="truncate max-w-[150px]" title="${displayUrl}">${displayUrl}</span>
             <span class="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">ID: ${config.id}</span>
        </div>
      </div>
    `;
    configGrid.appendChild(card);
  });
  bindActionEvents();
  setupDragAndDrop();
}

function bindActionEvents() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); // Prevent drag start when clicking buttons
      handleEdit(this.dataset.id);
    })
  });

  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const id = this.dataset.id;
      handleDelete(id)
    })
  })
}

function handleEdit(id) {
  const config = allConfigs.find(c => c.id == id);
  if (!config) {
    showMessage('找不到书签数据', 'error');
    return;
  }
  
  document.getElementById('editBookmarkId').value = config.id;
  document.getElementById('editBookmarkName').value = config.name;
  document.getElementById('editBookmarkUrl').value = config.url;
  document.getElementById('editBookmarkLogo').value = config.logo;
  document.getElementById('editBookmarkDesc').value = config.desc;
  document.getElementById('editBookmarkSortOrder').value = config.sort_order;
  document.getElementById('editBookmarkIsPrivate').checked = !!config.is_private;
  
  // Ensure we have categories tree for the dropdown
  if (categoriesTree.length === 0) {
      // If tree is empty (e.g. direct load), try to build it from available data or fetch
      // But fetchConfigs usually runs first.
      // Fallback: fetch again if needed, but for now assuming data exists or handle gracefully
  }
  
  createCascadingDropdown('editBookmarkCatelogWrapper', 'editBookmarkCatelog', categoriesTree, config.catelog_id);
  
  const editModal = document.getElementById('editBookmarkModal');
  if (editModal) editModal.style.display = 'block';
}

function handleDelete(id) {
  if (!confirm('确定删除该书签吗？')) return;
  
  fetch(`/api/config/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  }).then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        showMessage('删除成功', 'success');
        fetchConfigs();
      } else {
        showMessage(data.message || '删除失败', 'error');
      }
    }).catch(err => {
      showMessage('网络错误', 'error');
    });
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll('#configGrid .site-card');
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
      document.querySelectorAll('.site-card').forEach(c => c.classList.remove('border-2', 'border-accent-500'));
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
        // Swap or Insert Logic
        // Here we use "insert before" or "insert after" depending on position
        // For simplicity in a grid, swapping index in DOM is easiest to visualize

        const allCards = Array.from(configGrid.children);
        const draggedIdx = allCards.indexOf(draggedItem);
        const droppedIdx = allCards.indexOf(this);

        if (draggedIdx < droppedIdx) {
          this.after(draggedItem);
        } else {
          this.before(draggedItem);
        }

        // Save new order
        saveSortOrder();
      }
    });
  });
}

function saveSortOrder() {
  const cards = document.querySelectorAll('#configGrid .site-card');
  const updates = [];

  // Calculate global start index
  const startIndex = (currentPage - 1) * pageSize;

  cards.forEach((card, index) => {
    const id = card.dataset.id;
    // Set new sort order relative to the page + index
    // Note: This relies on simple integer sorting.
    const newSortOrder = startIndex + index;

    // Optimistic UI: We assume it works.
    // Ideally we only update if changed, but for simplicity we update the list.
    // To avoid flood, we can check if it's already correct in `allConfigs` but `allConfigs` is not updated yet.

    updates.push(fetch(`/api/config/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // We need other fields? api/config/[id] PUT requires name, url etc.
        // The API implementation requires name, url, etc.
        // I need to fetch the existing data or change the API to allow partial updates.
        // Since I have `allConfigs` in memory, I can use that!
        ...allConfigs.find(c => c.id == id),
        sort_order: newSortOrder
      })
    }));
  });

  if (updates.length > 0) {
    showMessage('正在保存排序...', 'info');
    Promise.all(updates)
      .then(() => showMessage('排序已保存', 'success'))
      .catch(err => showMessage('保存排序失败: ' + err.message, 'error'));
  }
}

let categoriesTree = [];
let currentViewParentId = null;

function fetchCategories(page = categoryCurrentPage) {
  if (!categoryGrid) {
    return;
  }
  categoryGrid.innerHTML = '<div class="col-span-full text-center py-10">加载中...</div>';
  fetch(`/api/categories?page=${page}&pageSize=${categoryPageSize}`)
    .then(res => res.json())
    .then(data => {
      if (data.code === 200) {
        categoryTotalItems = data.total;
        categoryCurrentPage = data.page;
        categoryTotalPagesSpan.innerText = Math.ceil(categoryTotalItems / categoryPageSize);
        categoryCurrentPageSpan.innerText = categoryCurrentPage;
        categoriesData = data.data || [];
        
        // Build Tree
        categoriesTree = buildCategoryTree(categoriesData);
        
        renderCategoryView(currentViewParentId);
        updateCategoryPaginationButtons();
      } else {
        showMessage(data.message || '加载分类失败', 'error');
        categoryGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">加载失败</div>';
      }
    }).catch((err) => {
      console.error('Fetch Categories Error:', err);
      showMessage('网络错误: ' + err.message, 'error');
      categoryGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">加载失败</div>';
    });
}

function renderCategoryView(parentId) {
    currentViewParentId = parentId;
    updateCategoryBreadcrumb(parentId);
    
    let nodesToRender = [];
    if (!parentId || parentId == '0') {
        nodesToRender = categoriesTree;
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
        const parentNode = findNode(categoriesTree, parentId);
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
        const cat = categoriesData.find(c => c.id == parentId);
        if(breadcrumb) breadcrumb.textContent = cat ? cat.catelog : '未知分类';
        
        if (backBtn) {
            // Unbind old events by replacing the element or just re-assigning onclick
            backBtn.onclick = () => {
                 const currentCat = categoriesData.find(c => c.id == parentId);
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
    const safeName = escapeHTML(item.catelog);
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
      const category = categoriesData.find(c => c.id == categoryId);
      if (category) {
        document.getElementById('editCategoryId').value = category.id;
        document.getElementById('editCategoryName').value = category.catelog;
        const sortOrder = category.sort_order;
        document.getElementById('editCategorySortOrder').value = (sortOrder === null || sortOrder === 9999) ? '' : sortOrder;
        document.getElementById('editCategoryIsPrivate').checked = !!category.is_private;
        
        createCascadingDropdown('editCategoryParentWrapper', 'editCategoryParent', categoriesTree, category.parent_id || '0', category.id);

        document.getElementById('editCategoryModal').style.display = 'block';
      } else {
        showMessage('找不到分类数据', 'error');
      }
    });
  });

  document.querySelectorAll('.category-del-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Remove disabled check since we removed the attribute
      const category_id = this.getAttribute('data-category-id');
      const siteCount = parseInt(this.getAttribute('data-site-count') || '0');
      const subCount = parseInt(this.getAttribute('data-sub-count') || '0');
      
      if (siteCount > 0) {
          showMessage(`无法删除：该分类包含 ${siteCount} 个书签`, 'error');
          return;
      }
      if (subCount > 0) {
          showMessage(`无法删除：该分类包含 ${subCount} 个子分类`, 'error');
          return;
      }
      
      if (!category_id) return;
      if (!confirm('确定删除该分类吗？')) return;
      
      deleteCategory(category_id);
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

function deleteCategory(id, isSub = false) {
    fetch('/api/categories/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true })
    }).then(res => res.json()).then(data => {
        if (data.code === 200) {
            showMessage('删除成功', 'success');
            // Refresh
            fetchCategories();
        } else {
            showMessage(data.message || '删除失败', 'error');
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
    const category = categoriesData.find(c => c.id == id);
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
    showMessage('正在保存分类排序...', 'info');
    Promise.all(updates)
      .then(() => {
          showMessage('分类排序已保存', 'success');
          // Update local state
          cards.forEach((card, index) => {
              const id = card.dataset.id;
              const cat = categoriesData.find(c => c.id == id);
              if(cat) cat.sort_order = index + 1;
          });
      })
      .catch(err => showMessage('保存排序失败: ' + err.message, 'error'));
  }
}

// Close Sub Modal
const subCategoryModal = document.getElementById('subCategoryModal');
const closeSubCategoryModal = document.getElementById('closeSubCategoryModal');
if (closeSubCategoryModal && subCategoryModal) {
    closeSubCategoryModal.addEventListener('click', () => subCategoryModal.style.display = 'none');
    subCategoryModal.addEventListener('click', (e) => {
        if (e.target === subCategoryModal) subCategoryModal.style.display = 'none';
    });
}

// Replace populateParentCategorySelect with createCascadingDropdown calls
// We remove the old function and update call sites.

if (addCategoryBtn) {
  addCategoryBtn.addEventListener('click', () => {
    // Populate dropdown
    createCascadingDropdown('newCategoryParentWrapper', 'newCategoryParent', categoriesTree, '0');
    addCategoryModal.style.display = 'block';
  });
}

// ... existing code ...


if (closeCategoryModal) {
  closeCategoryModal.addEventListener('click', () => {
    addCategoryModal.style.display = 'none';
    addCategoryForm.reset();
  });
}

// 点击模态框外部关闭
if (addCategoryModal) {
  addCategoryModal.addEventListener('click', (e) => {
    if (e.target === addCategoryModal) {
      addCategoryModal.style.display = 'none';
      addCategoryForm.reset();
    }
  });
}

// ========== 编辑分类功能 ==========
const editCategoryModal = document.getElementById('editCategoryModal');
const closeEditCategoryModal = document.getElementById('closeEditCategoryModal');
const editCategoryForm = document.getElementById('editCategoryForm');

if (closeEditCategoryModal) {
  closeEditCategoryModal.addEventListener('click', () => {
    editCategoryModal.style.display = 'none';
  });
}

if (editCategoryModal) {
  editCategoryModal.addEventListener('click', (e) => {
    if (e.target === editCategoryModal) {
      editCategoryModal.style.display = 'none';
    }
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
      showMessage('分类名称不能为空', 'error');
      return;
    }

    // Check duplicate name (excluding self)
    const isDuplicate = categoriesData.some(category => category.catelog.toLowerCase() === categoryName.toLowerCase() && category.id != id);
    if (isDuplicate) {
      showMessage('该分类名称已存在', 'error');
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
          showMessage('分类更新成功', 'success');
          editCategoryModal.style.display = 'none';
          fetchCategories(categoryCurrentPage);
        } else {
          showMessage(data.message || '分类更新失败', 'error');
        }
      }).catch(err => {
        showMessage('网络错误: ' + err.message, 'error');
      });
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
      showMessage('分类名称不能为空', 'error');
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
          showMessage('分类创建成功', 'success');
          addCategoryModal.style.display = 'none';
          addCategoryForm.reset();

          // 如果当前在分类排序标签页,刷新数据
          const categoriesTab = document.getElementById('categories');
          if (categoriesTab && categoriesTab.classList.contains('active')) {
            fetchCategories();
          }
        } else {
          showMessage(data.message || '分类创建失败', 'error');
        }
      }).catch(err => {
        showMessage('网络错误: ' + err.message, 'error');
      });
  });
}

// ========== 新增书签功能 ==========
const addBookmarkBtn = document.getElementById('addBookmarkBtn');
const addBookmarkModal = document.getElementById('addBookmarkModal');
const closeBookmarkModal = document.getElementById('closeBookmarkModal');
const addBookmarkForm = document.getElementById('addBookmarkForm');
const addBookmarkCatelogSelect = document.getElementById('addBookmarkCatelog');

if (addBookmarkBtn) {
  addBookmarkBtn.addEventListener('click', () => {
    if (categoriesTree.length === 0) {
        // Fallback fetch if empty
        fetch('/api/categories?pageSize=999').then(res => res.json()).then(data => {
            if(data.code === 200) {
                categoriesData = data.data || [];
                categoriesTree = buildCategoryTree(categoriesData);
                createCascadingDropdown('addBookmarkCatelogWrapper', 'addBookmarkCatelog', categoriesTree);
                addBookmarkModal.style.display = 'block';
            } else {
                showMessage('无法加载分类数据', 'error');
            }
        });
    } else {
        createCascadingDropdown('addBookmarkCatelogWrapper', 'addBookmarkCatelog', categoriesTree);
        addBookmarkModal.style.display = 'block';
    }
  });
}

if (closeBookmarkModal) {
  closeBookmarkModal.addEventListener('click', () => {
    addBookmarkModal.style.display = 'none';
    if (addBookmarkForm) {
      addBookmarkForm.reset();
    }
  });
}

if (addBookmarkModal) {
  addBookmarkModal.addEventListener('click', (e) => {
    if (e.target === addBookmarkModal) {
      addBookmarkModal.style.display = 'none';
      if (addBookmarkForm) {
        addBookmarkForm.reset();
      }
    }
  });
}

if (addBookmarkForm) {
  addBookmarkForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('addBookmarkName').value;
    const url = document.getElementById('addBookmarkUrl').value;
    const logo = document.getElementById('addBookmarkLogo').value;
    const desc = document.getElementById('addBookmarkDesc').value;
    const catelogId = addBookmarkCatelogSelect.value;
    const sortOrder = document.getElementById('addBookmarkSortOrder').value;
    const isPrivate = document.getElementById('addBookmarkIsPrivate').checked;

    if (!name || !url || !catelogId) {
      showModalMessage('addBookmarkModal', '名称, URL 和分类为必填项', 'error');
      return;
    }

    const payload = {
      name: name.trim(),
      url: url.trim(),
      logo: logo.trim(),
      desc: desc.trim(),
      catelogId: catelogId,
      is_private: isPrivate
    };

    if (sortOrder !== '') {
      payload.sort_order = Number(sortOrder);
    }

    fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(res => res.json())
      .then(data => {
        if (data.code === 201) {
          showModalMessage('addBookmarkModal', '添加成功', 'success');
          setTimeout(() => {
            addBookmarkModal.style.display = 'none';
            addBookmarkForm.reset();
            fetchConfigs();
          }, 1000);
        } else {
          showModalMessage('addBookmarkModal', data.message, 'error');
        }
      }).catch(err => {
        showModalMessage('addBookmarkModal', '网络错误', 'error');
      });
  });
}

// ===================================
// 新版 设置模态框逻辑 (Settings Modal)
// ===================================
const initSettings = () => {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  if (!settingsBtn || !settingsModal) return;

  // Modal Elements
  const closeBtn = document.getElementById('closeSettingsModal');
  const cancelBtn = document.getElementById('cancelSettingsBtn');
  const saveBtn = document.getElementById('saveSettingsBtn');

  // Tabs Elements
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  const settingsTabContents = document.querySelectorAll('.settings-tab-content');

  // Layout Inputs
  const hideDescSwitch = document.getElementById('hideDescSwitch');
  const hideLinksSwitch = document.getElementById('hideLinksSwitch');
  const hideCategorySwitch = document.getElementById('hideCategorySwitch');
  const hideGithubSwitch = document.getElementById('hideGithubSwitch');
  const hideAdminSwitch = document.getElementById('hideAdminSwitch');
  const frostedGlassSwitch = document.getElementById('frostedGlassSwitch');
  const frostedGlassIntensityRange = document.getElementById('frostedGlassIntensity');
  const frostedGlassIntensityValue = document.getElementById('frostedGlassIntensityValue');
  const gridColsRadios = document.getElementsByName('gridCols');
  const menuLayoutRadios = document.getElementsByName('menuLayout');
  const customWallpaperInput = document.getElementById('customWallpaperInput');
  const randomWallpaperSwitch = document.getElementById('randomWallpaperSwitch');
  const bgBlurSwitch = document.getElementById('bgBlurSwitch');
  const bgBlurIntensityRange = document.getElementById('bgBlurIntensity');
  const bgBlurIntensityValue = document.getElementById('bgBlurIntensityValue');
  const bingCountrySelect = document.getElementById('bingCountry');
  const onlineWallpapersDiv = document.getElementById('onlineWallpapers');
  const wpSourceBingBtn = document.getElementById('wpSourceBing');
  const wpSource360Btn = document.getElementById('wpSource360');
  const category360Select = document.getElementById('category360');

  // Card Style Elements
  const cardStyle1Container = document.getElementById('cardStyle1Container');
  const cardStyle2Container = document.getElementById('cardStyle2Container');
  const cardStyle1Check = document.getElementById('cardStyle1Check');
  const cardStyle2Check = document.getElementById('cardStyle2Check');
  const cardStyle1Preview = document.getElementById('cardStyle1Preview');
  const cardStyle2Preview = document.getElementById('cardStyle2Preview');
  const cardStyle1PreviewContainer = document.getElementById('cardStyle1PreviewContainer');
  const cardStyle2PreviewContainer = document.getElementById('cardStyle2PreviewContainer');
  
  const cardRadiusInput = document.getElementById('cardRadius');
  const cardRadiusValue = document.getElementById('cardRadiusValue');

  // Home Settings Inputs
  const hideTitleSwitch = document.getElementById('hideTitleSwitch');
  const homeTitleSizeInput = document.getElementById('homeTitleSize');
  const homeTitleColorInput = document.getElementById('homeTitleColor');
  const homeTitleColorPicker = document.getElementById('homeTitleColorPicker');

  const hideSubtitleSwitch = document.getElementById('hideSubtitleSwitch');
  const homeSubtitleSizeInput = document.getElementById('homeSubtitleSize');
  const homeSubtitleColorInput = document.getElementById('homeSubtitleColor');
  const homeSubtitleColorPicker = document.getElementById('homeSubtitleColorPicker');

  const hideStatsSwitch = document.getElementById('hideStatsSwitch');
  const homeStatsSizeInput = document.getElementById('homeStatsSize');
  const homeStatsColorInput = document.getElementById('homeStatsColor');
  const homeStatsColorPicker = document.getElementById('homeStatsColorPicker');

  const hideHitokotoSwitch = document.getElementById('hideHitokotoSwitch');
  const homeHitokotoSizeInput = document.getElementById('homeHitokotoSize');
  const homeHitokotoColorInput = document.getElementById('homeHitokotoColor');
  const homeHitokotoColorPicker = document.getElementById('homeHitokotoColorPicker');

  // New Card Font Elements
  const cardTitleFontInput = document.getElementById('cardTitleFont');
  const cardTitleSizeInput = document.getElementById('cardTitleSize');
  const cardTitleColorInput = document.getElementById('cardTitleColor');
  const cardTitleColorPicker = document.getElementById('cardTitleColorPicker');
  const cardDescFontInput = document.getElementById('cardDescFont');
  const cardDescSizeInput = document.getElementById('cardDescSize');
  const cardDescColorInput = document.getElementById('cardDescColor');
  const cardDescColorPicker = document.getElementById('cardDescColorPicker');

  const homeTitleFontInput = document.getElementById('homeTitleFont');
  const homeSubtitleFontInput = document.getElementById('homeSubtitleFont');
  const homeStatsFontInput = document.getElementById('homeStatsFont');
  const homeHitokotoFontInput = document.getElementById('homeHitokotoFont');

  const homeSiteNameInput = document.getElementById('homeSiteName');
  const homeSiteDescriptionInput = document.getElementById('homeSiteDescription');

  const searchEngineSwitch = document.getElementById('searchEngineSwitch');

  // Font Options
  const FONT_OPTIONS = [
      { value: "", label: "默认字体" },
      { value: "sans-serif", label: "Sans Serif (通用无衬线)" },
      { value: "serif", label: "Serif (通用衬线)" },
      { value: "monospace", label: "Monospace (通用等宽)" },
      { value: "'Microsoft YaHei', sans-serif", label: "微软雅黑 (Windows)" },
      { value: "'SimSun', serif", label: "宋体 (Windows)" },
      { value: "'PingFang SC', sans-serif", label: "苹方 (Mac)" },
      { value: "'Segoe UI', sans-serif", label: "Segoe UI (Windows)" },
      { value: "'Noto Sans SC', sans-serif", label: "Noto Sans SC (Web)" },
      { value: "'Noto Serif SC', serif", label: "Noto Serif SC (Web)" },
      { value: "'Ma Shan Zheng', cursive", label: "马善政毛笔 (Web)" },
      { value: "'ZCOOL KuaiLe', cursive", label: "站酷快乐体 (Web)" },
      { value: "'Long Cang', cursive", label: "龙苍草书 (Web)" },
      { value: "'Roboto', sans-serif", label: "Roboto (Web)" },
      { value: "'Open Sans', sans-serif", label: "Open Sans (Web)" },
      { value: "'Lato', sans-serif", label: "Lato (Web)" },
      { value: "'Montserrat', sans-serif", label: "Montserrat (Web)" }
  ];

  const FONT_URL_MAP = {
      "'Noto Sans SC', sans-serif": "https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
      "'Noto Serif SC', serif": "https://fonts.loli.net/css2?family=Noto+Serif+SC:wght@400;700&display=swap",
      "'Ma Shan Zheng', cursive": "https://fonts.loli.net/css2?family=Ma+Shan+Zheng&display=swap",
      "'ZCOOL KuaiLe', cursive": "https://fonts.loli.net/css2?family=ZCOOL+KuaiLe&display=swap",
      "'Long Cang', cursive": "https://fonts.loli.net/css2?family=Long+Cang&display=swap",
      "'Roboto', sans-serif": "https://fonts.loli.net/css2?family=Roboto:wght@300;400;500;700&display=swap",
      "'Open Sans', sans-serif": "https://fonts.loli.net/css2?family=Open+Sans:wght@400;600;700&display=swap",
      "'Lato', sans-serif": "https://fonts.loli.net/css2?family=Lato:wght@400;700&display=swap",
      "'Montserrat', sans-serif": "https://fonts.loli.net/css2?family=Montserrat:wght@400;700&display=swap"
  };

  const loadedFonts = new Set();
  function loadFont(fontFamily) {
      if (!fontFamily || loadedFonts.has(fontFamily)) return;
      const url = FONT_URL_MAP[fontFamily];
      if (url) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          document.head.appendChild(link);
          loadedFonts.add(fontFamily);
      }
  }

  function populateFontSelects() {
      const selects = [homeTitleFontInput, homeSubtitleFontInput, homeStatsFontInput, homeHitokotoFontInput, cardTitleFontInput, cardDescFontInput];
      selects.forEach(select => {
          if (!select) return;
          select.innerHTML = '';
          FONT_OPTIONS.forEach(opt => {
              const option = document.createElement('option');
              option.value = opt.value;
              option.textContent = opt.label;
              select.appendChild(option);
          });
      });
  }
  populateFontSelects();

  // Preview Logic
  function updatePreviewCards() {
      const hideDesc = hideDescSwitch.checked;
      const hideLinks = hideLinksSwitch.checked;
      const hideCategory = hideCategorySwitch.checked;
      const enableFrosted = frostedGlassSwitch.checked;
      const frostedIntensity = frostedGlassIntensityRange.value;
      const radius = document.getElementById('cardRadius').value;
      
      const titleFont = cardTitleFontInput.value;
      const titleSize = cardTitleSizeInput.value;
      const titleColor = cardTitleColorInput.value;
      
      const descFont = cardDescFontInput.value;
      const descSize = cardDescSizeInput.value;
      const descColor = cardDescColorInput.value;
      
      // Load fonts for preview
      if (titleFont) loadFont(titleFont);
      if (descFont) loadFont(descFont);

      [cardStyle1Preview, cardStyle2Preview].forEach(card => {
          if (!card) return;
          
          // Apply dynamic styles
          card.style.setProperty('--card-radius', radius + 'px');
          
          const desc = card.querySelector('.preview-desc');
          const links = card.querySelector('.preview-links');
          const category = card.querySelector('.preview-category');
          const title = card.querySelector('.site-title');

          if (title) {
              if (titleFont) title.style.fontFamily = titleFont; else title.style.removeProperty('font-family');
              if (titleSize) title.style.fontSize = titleSize + 'px'; else title.style.removeProperty('font-size');
              if (titleColor) title.style.color = titleColor; else title.style.removeProperty('color');
          }

          if (desc) {
              if (hideDesc) {
                  desc.style.setProperty('display', 'none', 'important');
              } else {
                  desc.style.removeProperty('display');
              }
              
              if (descFont) desc.style.fontFamily = descFont; else desc.style.removeProperty('font-family');
              if (descSize) desc.style.fontSize = descSize + 'px'; else desc.style.removeProperty('font-size');
              if (descColor) desc.style.color = descColor; else desc.style.removeProperty('color');
          }
          if (links) links.style.display = hideLinks ? 'none' : 'flex'; 
          if (category) category.style.display = hideCategory ? 'none' : 'inline-flex';
          
          if (enableFrosted) {
              card.classList.add('frosted-glass-effect');
              card.style.setProperty('--frosted-glass-blur', frostedIntensity + 'px');
              card.classList.remove('bg-white'); 
          } else {
              card.classList.remove('frosted-glass-effect');
              card.style.removeProperty('--frosted-glass-blur');
              card.classList.add('bg-white');
          }
      });
  }

  function updatePreviewWidth() {
      let cols = '4';
      if (gridColsRadios) {
          for (const radio of gridColsRadios) {
              if (radio.checked) {
                  cols = radio.value;
                  break;
              }
          }
      }
      
      const widthMap = {
          '4': '280px',
          '5': '230px',
          '6': '190px',
          '7': '160px'
      };
      const width = widthMap[cols] || '280px';
      
      if (cardStyle1PreviewContainer) cardStyle1PreviewContainer.style.maxWidth = width;
      if (cardStyle2PreviewContainer) cardStyle2PreviewContainer.style.maxWidth = width;
  }

  if (gridColsRadios) {
      for (const radio of gridColsRadios) {
          radio.addEventListener('change', updatePreviewWidth);
      }
  }

  // Card Style Selection Logic
  function selectCardStyle(style) {
      currentSettings.layout_card_style = style;
      
      const btn1 = document.getElementById('btnStyle1');
      const btn2 = document.getElementById('btnStyle2');
      const preview1 = document.getElementById('cardStyle1PreviewContainer');
      const preview2 = document.getElementById('cardStyle2PreviewContainer');

      if (!btn1 || !btn2 || !preview1 || !preview2) return;

      // Reset
      btn1.className = 'card-style-btn px-4 py-1 text-sm rounded transition-all';
      btn2.className = 'card-style-btn px-4 py-1 text-sm rounded transition-all';
      
      if (style === 'style2') {
          btn2.classList.add('bg-white', 'shadow-sm', 'text-gray-800', 'font-medium');
          btn1.classList.add('text-gray-600', 'hover:text-gray-900');
          preview1.classList.add('hidden');
          preview2.classList.remove('hidden');
      } else {
          btn1.classList.add('bg-white', 'shadow-sm', 'text-gray-800', 'font-medium');
          btn2.classList.add('text-gray-600', 'hover:text-gray-900');
          preview1.classList.remove('hidden');
          preview2.classList.add('hidden');
      }
  }

  const btnStyle1 = document.getElementById('btnStyle1');
  const btnStyle2 = document.getElementById('btnStyle2');
  if (btnStyle1) btnStyle1.addEventListener('click', () => selectCardStyle('style1'));
  if (btnStyle2) btnStyle2.addEventListener('click', () => selectCardStyle('style2'));

  // Switch Listeners for Preview
  if (hideDescSwitch) hideDescSwitch.addEventListener('change', updatePreviewCards);
  if (hideLinksSwitch) hideLinksSwitch.addEventListener('change', updatePreviewCards);
  if (hideCategorySwitch) hideCategorySwitch.addEventListener('change', updatePreviewCards);
  if (frostedGlassSwitch) frostedGlassSwitch.addEventListener('change', updatePreviewCards);
  if (frostedGlassIntensityRange) frostedGlassIntensityRange.addEventListener('input', updatePreviewCards);
  
  if (cardRadiusInput) {
      cardRadiusInput.addEventListener('input', () => {
          if (cardRadiusValue) cardRadiusValue.textContent = cardRadiusInput.value;
          updatePreviewCards();
      });
  }
  
  // Real-time Card Font Preview Listeners
  [cardTitleFontInput, cardTitleSizeInput, cardTitleColorInput, cardDescFontInput, cardDescSizeInput, cardDescColorInput].forEach(input => {
      if (input) {
          input.addEventListener('input', updatePreviewCards);
          input.addEventListener('change', updatePreviewCards);
      }
  });

  // AI Provider Elements
  const providerSelector = document.getElementById('providerSelector');
  const baseUrlGroup = document.getElementById('baseUrlGroup');

  // AI Form Inputs
  const apiKeyInput = document.getElementById('apiKey');
  const baseUrlInput = document.getElementById('baseUrl');
  const modelNameInput = document.getElementById('modelName');

  // Bulk Generation Elements
  const bulkIdleView = document.getElementById('bulkGenerateIdle');
  const bulkProgressView = document.getElementById('bulkGenerateProgress');
  const batchCompleteBtn = document.getElementById('batchCompleteDescBtn');
  const stopBulkBtn = document.getElementById('stopBulkGenerateBtn');
  const progressBar = document.getElementById('progressBar');
  const progressCounter = document.getElementById('progressCounter');

  let currentSettings = {
    // AI Defaults
    provider: 'workers-ai',
    apiKey: '',
    baseUrl: '',
    model: '@cf/meta/llama-3-8b-instruct',
    // Layout Defaults
    layout_hide_desc: false,
    layout_hide_links: false,
    layout_hide_category: false,
    layout_hide_title: false,
    home_title_size: '',
    home_title_color: '',
    layout_hide_subtitle: false,
    home_subtitle_size: '',
    home_subtitle_color: '',
    home_hide_stats: false,
    home_stats_size: '',
    home_stats_color: '',
    home_hide_hitokoto: false,
    home_hitokoto_size: '',
    home_hitokoto_color: '',
    home_search_engine_enabled: false,
    home_title_font: '',
    home_subtitle_font: '',
    home_stats_font: '',
    home_hitokoto_font: '',
    home_site_name: '',
    home_site_description: '',
    layout_enable_frosted_glass: false,
    layout_frosted_glass_intensity: '15',
    layout_grid_cols: '4',
    layout_custom_wallpaper: '',
    layout_menu_layout: 'horizontal',
    layout_random_wallpaper: false,
    layout_enable_bg_blur: false,
    layout_bg_blur_intensity: '0',
    bing_country: '',
    wallpaper_source: 'bing',
    wallpaper_cid_360: '36',
    layout_card_style: 'style1',
    layout_card_border_radius: '12'
  };

  let shouldStopBulkGeneration = false;
  let aiRequestDelay = 1500; 

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
  fetchPublicConfig();

  // Color Picker Sync Helper
  function setupColorPicker(textInput, pickerInput) {
    if (!textInput || !pickerInput) return;
    
    // Init picker from text if valid hex
    if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
        pickerInput.value = textInput.value;
    }

    pickerInput.addEventListener('input', () => {
        textInput.value = pickerInput.value;
    });

    textInput.addEventListener('input', () => {
        const val = textInput.value;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            pickerInput.value = val;
        }
    });
  }

  setupColorPicker(homeTitleColorInput, homeTitleColorPicker);
  setupColorPicker(homeSubtitleColorInput, homeSubtitleColorPicker);
  setupColorPicker(homeStatsColorInput, homeStatsColorPicker);
  setupColorPicker(homeHitokotoColorInput, homeHitokotoColorPicker);
  setupColorPicker(cardTitleColorInput, cardTitleColorPicker);
  setupColorPicker(cardDescColorInput, cardDescColorPicker);


  // --- Online Wallpaper Logic ---

  // Inject Custom CSS for Wallpaper Interactions to guarantee stability
  const wpStyleId = 'wallpaper-custom-styles';
  if (!document.getElementById(wpStyleId)) {
      const style = document.createElement('style');
      style.id = wpStyleId;
      style.textContent = `
          /* Wallpaper Cards Styles */
          .wp-card-wrapper {
              position: relative;
              overflow: hidden;
              border-radius: 0.5rem;
              cursor: pointer;
              background-color: #f3f4f6;
              border: 1px solid #e5e7eb;
              transition: border-color 0.3s;
          }
          .wp-card-wrapper:hover {
              border-color: #6366f1;
          }
          .wp-card-image-container {
              width: 100%;
              height: 100%;
              overflow: hidden;
          }
          .wp-card-image {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              transition: transform 0.5s ease;
              transform: scale(1) translateZ(0);
              will-change: transform;
          }
          .wp-card-wrapper:hover .wp-card-image {
              transform: scale(1.15) translateZ(0) !important;
          }
          .wp-card-overlay {
              position: absolute;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: rgba(0, 0, 0, 0);
              transition: background-color 0.3s;
              pointer-events: none;
          }
          .wp-card-wrapper:hover .wp-card-overlay {
              background-color: rgba(0, 0, 0, 0.1);
          }
          .wp-card-btn {
              opacity: 0;
              transition: opacity 0.3s;
              background-color: rgba(0, 0, 0, 0.5);
              color: white;
              font-size: 0.75rem;
              padding: 0.25rem 0.5rem;
              border-radius: 0.25rem;
          }
          .wp-card-wrapper:hover .wp-card-btn {
              opacity: 1;
          }

          /* Fix: Ensure Site Card Hover Animation works after dynamic rendering */
          .site-card:hover {
              transform: scale(1.15) translateY(-10px) !important;
              box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15) !important;
              z-index: 10 !important;
              border: 2px solid #416d9d !important;
          }
      `;
      document.head.appendChild(style);
  }

  // Helper to render card
  function renderWallpaperCard(thumb, full, title) {
    if (!onlineWallpapersDiv) return;
    const div = document.createElement('div');
    
    // Use custom classes + standard Tailwind aspect ratio
    div.className = 'wp-card-wrapper aspect-video';
    div.title = title;

    div.innerHTML = `
      <div class="wp-card-image-container">
        <img src="${thumb}" class="wp-card-image" alt="${title}">
      </div>
      <div class="wp-card-overlay">
        <span class="wp-card-btn">应用</span>
      </div>`;
    
    div.addEventListener('click', () => {
        if (customWallpaperInput) {
            customWallpaperInput.value = full;
            customWallpaperInput.classList.add('bg-green-50');
            setTimeout(() => customWallpaperInput.classList.remove('bg-green-50'), 300);
        }
    });
    onlineWallpapersDiv.appendChild(div);
  }

  // Fetch Bing Wallpapers
  async function fetchBingWallpapers(country = '') {
      if (!onlineWallpapersDiv) return;
      onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';
      
      try {
          let url = '';
          if (country === 'spotlight') {
              url = 'https://peapix.com/spotlight/feed?n=8';
          } else {
              url = `https://peapix.com/bing/feed?n=8&country=${country}`;
          }
          
          const res = await fetch(url);
          if (!res.ok) throw new Error('API Request Failed');
          const data = await res.json();
          
          onlineWallpapersDiv.innerHTML = '';
          
          if (!Array.isArray(data) || data.length === 0) {
              onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">未获取到壁纸</div>';
              return;
          }
          
          data.forEach(item => {
              const thumb = item.thumbUrl || item.url;
              const full = item.fullUrl || item.url;
              const title = item.title || 'Bing Wallpaper';
              renderWallpaperCard(thumb, full, title);
          });
          
      } catch (err) {
          console.error('Bing Wallpaper Fetch Error:', err);
          onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-red-400 py-8 text-sm">加载失败，请检查网络或稍后重试</div>';
      }
  }

  // Fetch 360 Categories
  async function fetch360Categories() {
      if (!category360Select || category360Select.options.length > 1) return; // Already loaded or missing
      
      try {
          const res = await fetch('/api/wallpaper?source=360&action=categories');
          if (!res.ok) throw new Error('Failed to fetch categories');
          const result = await res.json();
          
          // Proxy wraps response in { code: 200, data: { errno: "0", data: [...] } }
          const apiData = result.data;

          if (result.code === 200 && apiData && apiData.data && Array.isArray(apiData.data)) {
              category360Select.innerHTML = '';
              apiData.data.forEach(cat => {
                  const option = document.createElement('option');
                  option.value = cat.id;
                  option.textContent = cat.name;
                  if (cat.id == '36') option.selected = true; // Default to 4K
                  category360Select.appendChild(option);
              });
          }
      } catch (e) {
          console.error('360 Categories Error', e);
      }
  }

  // Fetch 360 Wallpapers
  async function fetch360Wallpapers(cid = '36') {
      if (!onlineWallpapersDiv) return;
      onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';
      
      try {
          const res = await fetch(`/api/wallpaper?source=360&action=list&cid=${cid}&start=0&count=8`);
          if (!res.ok) throw new Error('API Request Failed');
          const result = await res.json();
          
          // Proxy wraps response in { code: 200, data: { errno: "0", data: [...] } }
          const apiData = result.data;
          
          if (result.code !== 200 || !apiData || !apiData.data || apiData.data.length === 0) {
               onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">未获取到壁纸</div>';
               return;
          }
          
          onlineWallpapersDiv.innerHTML = '';
          apiData.data.forEach(item => {
              // Prefer img_1024_768 for thumbnail to speed up loading, fallback to others
              let thumb = item.img_1024_768 || item.url_thumb || item.url;
              let full = item.url;
              
              // Ensure HTTPS
              if (thumb && thumb.startsWith('http:')) thumb = thumb.replace('http:', 'https:');
              if (full && full.startsWith('http:')) full = full.replace('http:', 'https:');

              const title = item.tag || '360 Wallpaper';
              renderWallpaperCard(thumb, full, title);
          });
          
      } catch (err) {
          console.error('360 Wallpaper Error:', err);
          onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-red-400 py-8 text-sm">加载失败</div>';
      }
  }

  function switchWallpaperSource(source) {
      currentSettings.wallpaper_source = source;
      
      // Toggle Buttons Style
      if (source === 'bing') {
          if(wpSourceBingBtn) {
            wpSourceBingBtn.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
            wpSourceBingBtn.classList.remove('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
          }
          if(wpSource360Btn) {
            wpSource360Btn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            wpSource360Btn.classList.add('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
          }
          
          if(bingCountrySelect) bingCountrySelect.classList.remove('hidden');
          if(category360Select) category360Select.classList.add('hidden');
          
          fetchBingWallpapers(currentSettings.bing_country);
      } else {
          if(wpSource360Btn) {
            wpSource360Btn.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
            wpSource360Btn.classList.remove('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
          }
          if(wpSourceBingBtn) {
            wpSourceBingBtn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
            wpSourceBingBtn.classList.add('text-gray-600', 'hover:text-gray-800', 'hover:bg-white/50');
          }
          
          if(bingCountrySelect) bingCountrySelect.classList.add('hidden');
          if(category360Select) category360Select.classList.remove('hidden');
          
          if (onlineWallpapersDiv) {
              onlineWallpapersDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8 text-sm">加载中...</div>';
          }
          
          fetch360Categories().then(() => {
              if (category360Select && currentSettings.wallpaper_cid_360) {
                  category360Select.value = currentSettings.wallpaper_cid_360;
              }
              fetch360Wallpapers(currentSettings.wallpaper_cid_360 || '36');
          });
      }
  }

  // --- Event Listeners ---

  settingsBtn.addEventListener('click', () => {
    loadSettings();
    settingsModal.style.display = 'block';
  });

  const closeModal = () => {
    if (bulkProgressView.style.display !== 'none') {
      if (!confirm('批量生成正在进行中，确定要关闭吗？')) {
        return;
      }
      shouldStopBulkGeneration = true;
    }
    settingsModal.style.display = 'none';
  };
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeModal();
    }
  });

  // Tab Switching
  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        
        settingsTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        settingsTabContents.forEach(c => {
            c.classList.remove('active');
            if (c.id === tabId) {
                c.classList.add('active');
            }
        });
        
        // Auto fetch wallpapers if tab is active and empty
        if (tabId === 'wallpaper-settings' && onlineWallpapersDiv && (!onlineWallpapersDiv.children.length || onlineWallpapersDiv.innerText.includes('加载中'))) {
            switchWallpaperSource(currentSettings.wallpaper_source || 'bing');
        }
    });
  });
  
  // Wallpaper Source Switching
  if (wpSourceBingBtn) {
      wpSourceBingBtn.addEventListener('click', () => switchWallpaperSource('bing'));
  }
  if (wpSource360Btn) {
      wpSource360Btn.addEventListener('click', () => switchWallpaperSource('360'));
  }

  // Filters
  if (bingCountrySelect) {
      bingCountrySelect.addEventListener('change', () => {
          currentSettings.bing_country = bingCountrySelect.value;
          fetchBingWallpapers(currentSettings.bing_country);
      });
  }
  
  if (category360Select) {
      category360Select.addEventListener('change', () => {
          currentSettings.wallpaper_cid_360 = category360Select.value;
          fetch360Wallpapers(category360Select.value);
      });
  }

  if (providerSelector) {
    providerSelector.addEventListener('change', () => {
      currentSettings.provider = providerSelector.value;
      updateUIFromSettings();
    });
  }

  saveBtn.addEventListener('click', () => {
    // Update state from inputs
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey) {
        currentSettings.apiKey = newApiKey;
    } else if (currentSettings.has_api_key) {
        // User didn't type anything but we have a key, so don't send anything (undefined)
        // allowing backend to keep existing value if we filter it, 
        // OR we just don't update the property in currentSettings if it was undefined.
        // But loadSettings sets currentSettings.apiKey = undefined.
        // So just delete it to be safe, ensuring it's not sent as ""
        delete currentSettings.apiKey;
    } else {
        // No key previously, and input is empty -> clear it
        currentSettings.apiKey = '';
    }

    currentSettings.baseUrl = baseUrlInput.value.trim();
    currentSettings.model = modelNameInput.value.trim();
    currentSettings.layout_hide_desc = hideDescSwitch.checked;
    currentSettings.layout_hide_links = hideLinksSwitch.checked;
    currentSettings.layout_hide_category = hideCategorySwitch.checked;
    currentSettings.home_hide_github = hideGithubSwitch.checked;
    currentSettings.home_hide_admin = hideAdminSwitch.checked;
    
    currentSettings.layout_hide_title = hideTitleSwitch.checked;
    currentSettings.home_title_size = homeTitleSizeInput.value.trim();
    currentSettings.home_title_color = homeTitleColorInput.value.trim();

    currentSettings.layout_hide_subtitle = hideSubtitleSwitch.checked;
    currentSettings.home_subtitle_size = homeSubtitleSizeInput.value.trim();
    currentSettings.home_subtitle_color = homeSubtitleColorInput.value.trim();

    currentSettings.home_hide_stats = hideStatsSwitch.checked;
    currentSettings.home_stats_size = homeStatsSizeInput.value.trim();
    currentSettings.home_stats_color = homeStatsColorInput.value.trim();

    currentSettings.home_hide_hitokoto = hideHitokotoSwitch.checked;
    currentSettings.home_hitokoto_size = homeHitokotoSizeInput.value.trim();
    currentSettings.home_hitokoto_color = homeHitokotoColorInput.value.trim();

    currentSettings.home_title_font = homeTitleFontInput.value.trim();
    currentSettings.home_subtitle_font = homeSubtitleFontInput.value.trim();
    currentSettings.home_stats_font = homeStatsFontInput.value.trim();
    currentSettings.home_hitokoto_font = homeHitokotoFontInput.value.trim();

    currentSettings.home_site_name = homeSiteNameInput.value.trim();
    currentSettings.home_site_description = homeSiteDescriptionInput.value.trim();
    
    if (homeDefaultCategorySelect) {
        currentSettings.home_default_category = homeDefaultCategorySelect.value;
    }

    currentSettings.home_search_engine_enabled = searchEngineSwitch.checked;

    currentSettings.layout_custom_wallpaper = customWallpaperInput.value.trim();
    currentSettings.layout_random_wallpaper = randomWallpaperSwitch.checked;
    currentSettings.layout_enable_bg_blur = bgBlurSwitch.checked;
    currentSettings.layout_bg_blur_intensity = bgBlurIntensityRange.value;
    currentSettings.bing_country = bingCountrySelect.value;
    currentSettings.wallpaper_cid_360 = category360Select.value;
    
    // Get Grid Cols
    for (const radio of gridColsRadios) {
        if (radio.checked) {
            currentSettings.layout_grid_cols = radio.value;
            break;
        }
    }
    
    // Get Menu Layout
    for (const radio of menuLayoutRadios) {
        if (radio.checked) {
            currentSettings.layout_menu_layout = radio.value;
            break;
        }
    }
    
    currentSettings.layout_enable_frosted_glass = frostedGlassSwitch.checked;
    currentSettings.layout_frosted_glass_intensity = frostedGlassIntensityRange.value;
    
    currentSettings.layout_card_border_radius = cardRadiusInput.value;
    
    // layout_card_style is already updated by click listeners
    
    currentSettings.card_title_font = cardTitleFontInput.value.trim();
    currentSettings.card_title_size = cardTitleSizeInput.value.trim();
    currentSettings.card_title_color = cardTitleColorInput.value.trim();
    currentSettings.card_desc_font = cardDescFontInput.value.trim();
    currentSettings.card_desc_size = cardDescSizeInput.value.trim();
    currentSettings.card_desc_color = cardDescColorInput.value.trim();

    saveSettings();
  });

  if (frostedGlassSwitch) {
      frostedGlassSwitch.addEventListener('change', () => {
          const intensityContainer = document.getElementById('frostedGlassIntensityContainer');
          if (frostedGlassSwitch.checked) {
              intensityContainer.classList.remove('opacity-50', 'pointer-events-none');
          } else {
              intensityContainer.classList.add('opacity-50', 'pointer-events-none');
          }
      });
  }

  if (frostedGlassIntensityRange) {
      frostedGlassIntensityRange.addEventListener('input', () => {
          if (frostedGlassIntensityValue) {
              frostedGlassIntensityValue.textContent = frostedGlassIntensityRange.value;
          }
      });
  }

  if (bgBlurSwitch) {
      bgBlurSwitch.addEventListener('change', () => {
          const container = document.getElementById('bgBlurIntensityContainer');
          if (bgBlurSwitch.checked) {
              container.classList.remove('opacity-50', 'pointer-events-none');
          } else {
              container.classList.add('opacity-50', 'pointer-events-none');
          }
      });
  }

  if (bgBlurIntensityRange) {
      bgBlurIntensityRange.addEventListener('input', () => {
          if (bgBlurIntensityValue) {
              bgBlurIntensityValue.textContent = bgBlurIntensityRange.value;
          }
      });
  }

  batchCompleteBtn.addEventListener('click', handleBulkGenerate);
  stopBulkBtn.addEventListener('click', () => {
    shouldStopBulkGeneration = true;
    showMessage('正在停止...', 'info');
  });

  // --- Helper Functions ---

  const homeDefaultCategorySelect = document.getElementById('homeDefaultCategory');

  async function loadSettings() {
    // Ensure categories are loaded for the dropdown
    if (categoriesTree.length === 0) {
        try {
            const res = await fetch('/api/categories?pageSize=9999');
            const data = await res.json();
            if (data.code === 200) {
                categoriesData = data.data || [];
                categoriesTree = buildCategoryTree(categoriesData);
            }
        } catch (e) { console.error('Failed to load categories for settings', e); }
    }

    if (homeDefaultCategorySelect) {
        homeDefaultCategorySelect.innerHTML = '<option value="">默认 (全部)</option>';
        
        // Helper to flatten tree for simple select
        const addOptions = (nodes, prefix = '') => {
            nodes.forEach(node => {
                const option = document.createElement('option');
                option.value = node.catelog; // Store Name as value, because config uses name
                option.textContent = prefix + node.catelog;
                homeDefaultCategorySelect.appendChild(option);
                if (node.children && node.children.length > 0) {
                    addOptions(node.children, prefix + '-- ');
                }
            });
        };
        addOptions(categoriesTree);
    }

    try {
        // 1. Try to fetch from server (new source of truth)
        const res = await fetch('/api/settings');
        const data = await res.json();
        
        if (data.code === 200 && data.data) {
            const serverSettings = data.data;
            
            // Map known keys
            if (serverSettings.provider) currentSettings.provider = serverSettings.provider;
            
            // Handle API Key securely
            currentSettings.has_api_key = !!serverSettings.has_api_key;
            
            if (serverSettings.apiKey) currentSettings.apiKey = serverSettings.apiKey; // Should be undefined now
            
            if (serverSettings.baseUrl) currentSettings.baseUrl = serverSettings.baseUrl;
            if (serverSettings.model) currentSettings.model = serverSettings.model;
            
            if (serverSettings.layout_hide_desc !== undefined) currentSettings.layout_hide_desc = serverSettings.layout_hide_desc === 'true';
            if (serverSettings.layout_hide_links !== undefined) currentSettings.layout_hide_links = serverSettings.layout_hide_links === 'true';
            if (serverSettings.layout_hide_category !== undefined) currentSettings.layout_hide_category = serverSettings.layout_hide_category === 'true';
            if (serverSettings.layout_hide_title !== undefined) currentSettings.layout_hide_title = serverSettings.layout_hide_title === 'true';
            if (serverSettings.home_title_size) currentSettings.home_title_size = serverSettings.home_title_size;
            if (serverSettings.home_title_color) currentSettings.home_title_color = serverSettings.home_title_color;

            if (serverSettings.layout_hide_subtitle !== undefined) currentSettings.layout_hide_subtitle = serverSettings.layout_hide_subtitle === 'true';
            if (serverSettings.home_subtitle_size) currentSettings.home_subtitle_size = serverSettings.home_subtitle_size;
            if (serverSettings.home_subtitle_color) currentSettings.home_subtitle_color = serverSettings.home_subtitle_color;

            if (serverSettings.home_hide_stats !== undefined) currentSettings.home_hide_stats = serverSettings.home_hide_stats === 'true';
            if (serverSettings.home_stats_size) currentSettings.home_stats_size = serverSettings.home_stats_size;
            if (serverSettings.home_stats_color) currentSettings.home_stats_color = serverSettings.home_stats_color;

            if (serverSettings.home_hide_hitokoto !== undefined) currentSettings.home_hide_hitokoto = serverSettings.home_hide_hitokoto === 'true';
            if (serverSettings.home_hitokoto_size) currentSettings.home_hitokoto_size = serverSettings.home_hitokoto_size;
            if (serverSettings.home_hitokoto_color) currentSettings.home_hitokoto_color = serverSettings.home_hitokoto_color;
            
            if (serverSettings.home_hide_github !== undefined) currentSettings.home_hide_github = serverSettings.home_hide_github === 'true';
            if (serverSettings.home_hide_admin !== undefined) currentSettings.home_hide_admin = serverSettings.home_hide_admin === 'true';

            if (serverSettings.home_title_font) currentSettings.home_title_font = serverSettings.home_title_font;
            if (serverSettings.home_subtitle_font) currentSettings.home_subtitle_font = serverSettings.home_subtitle_font;
            if (serverSettings.home_stats_font) currentSettings.home_stats_font = serverSettings.home_stats_font;
            if (serverSettings.home_hitokoto_font) currentSettings.home_hitokoto_font = serverSettings.home_hitokoto_font;

            if (serverSettings.home_site_name) currentSettings.home_site_name = serverSettings.home_site_name;
            if (serverSettings.home_site_description) currentSettings.home_site_description = serverSettings.home_site_description;

            if (serverSettings.home_search_engine_enabled !== undefined) currentSettings.home_search_engine_enabled = serverSettings.home_search_engine_enabled === 'true';
            
            if (serverSettings.home_default_category) currentSettings.home_default_category = serverSettings.home_default_category;

            if (serverSettings.layout_enable_frosted_glass !== undefined) currentSettings.layout_enable_frosted_glass = serverSettings.layout_enable_frosted_glass === 'true';
            if (serverSettings.layout_frosted_glass_intensity) currentSettings.layout_frosted_glass_intensity = serverSettings.layout_frosted_glass_intensity;
            if (serverSettings.layout_grid_cols) currentSettings.layout_grid_cols = serverSettings.layout_grid_cols;
            if (serverSettings.layout_custom_wallpaper) currentSettings.layout_custom_wallpaper = serverSettings.layout_custom_wallpaper;
            if (serverSettings.layout_menu_layout) currentSettings.layout_menu_layout = serverSettings.layout_menu_layout;
            if (serverSettings.layout_random_wallpaper !== undefined) currentSettings.layout_random_wallpaper = serverSettings.layout_random_wallpaper === 'true';
            if (serverSettings.layout_enable_bg_blur !== undefined) currentSettings.layout_enable_bg_blur = serverSettings.layout_enable_bg_blur === 'true';
            if (serverSettings.layout_bg_blur_intensity) currentSettings.layout_bg_blur_intensity = serverSettings.layout_bg_blur_intensity;
            if (serverSettings.bing_country !== undefined) currentSettings.bing_country = serverSettings.bing_country;
            if (serverSettings.wallpaper_source) currentSettings.wallpaper_source = serverSettings.wallpaper_source;
            if (serverSettings.wallpaper_cid_360) currentSettings.wallpaper_cid_360 = serverSettings.wallpaper_cid_360;
            if (serverSettings.layout_card_style) currentSettings.layout_card_style = serverSettings.layout_card_style;
            if (serverSettings.layout_card_border_radius) currentSettings.layout_card_border_radius = serverSettings.layout_card_border_radius;

            if (serverSettings.card_title_font) currentSettings.card_title_font = serverSettings.card_title_font;
            if (serverSettings.card_title_size) currentSettings.card_title_size = serverSettings.card_title_size;
            if (serverSettings.card_title_color) currentSettings.card_title_color = serverSettings.card_title_color;
            if (serverSettings.card_desc_font) currentSettings.card_desc_font = serverSettings.card_desc_font;
            if (serverSettings.card_desc_size) currentSettings.card_desc_size = serverSettings.card_desc_size;
            if (serverSettings.card_desc_color) currentSettings.card_desc_color = serverSettings.card_desc_color;

        }
    } catch (e) {
        console.error('Failed to load settings', e);
        // Fallback removed: Server is the single source of truth.
    }

    updateUIFromSettings();
  }

  async function saveSettings() {
    // Save to localStorage (backup/legacy)
    localStorage.setItem('ai_settings', JSON.stringify({
        provider: currentSettings.provider,
        apiKey: currentSettings.apiKey,
        baseUrl: currentSettings.baseUrl,
        model: currentSettings.model
    }));

    // Save to Server
    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>⏳</span> 保存中...';
        
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSettings)
        });
        const data = await res.json();
        
        if (data.code === 200) {
            showMessage('设置已保存', 'success');
            closeModal();
        } else {
            showMessage('保存失败: ' + data.message, 'error');
        }
    } catch (e) {
        showMessage('保存失败 (网络错误)', 'error');
        console.error(e);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾</span> 保存设置';
    }
  }

  function updateUIFromSettings() {
    // AI UI
    if (providerSelector) {
      providerSelector.value = currentSettings.provider || 'workers-ai';
    }
    const provider = currentSettings.provider || 'workers-ai';
    
    // API Key UI Logic
    apiKeyInput.value = currentSettings.apiKey || '';
    if (currentSettings.has_api_key && !apiKeyInput.value) {
        apiKeyInput.placeholder = '已配置 (如需修改请直接输入)';
    } else {
        apiKeyInput.placeholder = '请输入 API Key';
    }

    baseUrlInput.value = currentSettings.baseUrl || '';
    
    // Legacy fix
    if (!['gemini', 'openai', 'workers-ai'].includes(provider)) {
        currentSettings.provider = 'workers-ai';
        providerSelector.value = 'workers-ai';
    }

    if (provider === 'workers-ai') {
      apiKeyInput.parentElement.style.display = 'none';
      baseUrlGroup.style.display = 'none';
      modelNameInput.parentElement.style.display = 'none'; 
    } else {
      apiKeyInput.parentElement.style.display = 'block';
      modelNameInput.parentElement.style.display = 'block';

      if (provider === 'gemini') {
        modelNameInput.value = currentSettings.model || 'gemini-1.5-flash';
        modelNameInput.placeholder = 'gemini-1.5-flash';
        baseUrlGroup.style.display = 'none';
      } else if (provider === 'openai') {
        modelNameInput.value = currentSettings.model || 'gpt-3.5-turbo';
        modelNameInput.placeholder = 'gpt-3.5-turbo';
        baseUrlGroup.style.display = 'block';
      }
    }

    // Layout UI
    if (hideDescSwitch) hideDescSwitch.checked = !!currentSettings.layout_hide_desc;
    if (hideLinksSwitch) hideLinksSwitch.checked = !!currentSettings.layout_hide_links;
    if (hideCategorySwitch) hideCategorySwitch.checked = !!currentSettings.layout_hide_category;
    if (hideGithubSwitch) hideGithubSwitch.checked = !!currentSettings.home_hide_github;
    if (hideAdminSwitch) hideAdminSwitch.checked = !!currentSettings.home_hide_admin;
    
    if (hideTitleSwitch) hideTitleSwitch.checked = !!currentSettings.layout_hide_title;
    if (homeTitleSizeInput) homeTitleSizeInput.value = currentSettings.home_title_size || '36';
    if (homeTitleColorInput) {
        const val = currentSettings.home_title_color || '#ffffff';
        homeTitleColorInput.value = val;
        if (homeTitleColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
            homeTitleColorPicker.value = val;
        }
    }

    if (hideSubtitleSwitch) hideSubtitleSwitch.checked = !!currentSettings.layout_hide_subtitle;
    if (homeSubtitleSizeInput) homeSubtitleSizeInput.value = currentSettings.home_subtitle_size || '16';
    if (homeSubtitleColorInput) {
        const val = currentSettings.home_subtitle_color || '#e1e7f1';
        homeSubtitleColorInput.value = val;
         if (homeSubtitleColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
            homeSubtitleColorPicker.value = val;
        }
    }

    if (hideStatsSwitch) hideStatsSwitch.checked = !!currentSettings.home_hide_stats;
    if (homeStatsSizeInput) homeStatsSizeInput.value = currentSettings.home_stats_size || '20';
    if (homeStatsColorInput) {
        const val = currentSettings.home_stats_color || '#1f2937';
        homeStatsColorInput.value = val;
        if (homeStatsColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
            homeStatsColorPicker.value = val;
        }
    }

    if (hideHitokotoSwitch) hideHitokotoSwitch.checked = !!currentSettings.home_hide_hitokoto;
    if (homeHitokotoSizeInput) homeHitokotoSizeInput.value = currentSettings.home_hitokoto_size || '14';
    if (homeHitokotoColorInput) {
        const val = currentSettings.home_hitokoto_color || '#6b7280';
        homeHitokotoColorInput.value = val;
        if (homeHitokotoColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
            homeHitokotoColorPicker.value = val;
        }
    }

    if (homeTitleFontInput) homeTitleFontInput.value = currentSettings.home_title_font || '';
    if (homeSubtitleFontInput) homeSubtitleFontInput.value = currentSettings.home_subtitle_font || '';
    if (homeStatsFontInput) homeStatsFontInput.value = currentSettings.home_stats_font || '';
    if (homeHitokotoFontInput) homeHitokotoFontInput.value = currentSettings.home_hitokoto_font || '';

    if (homeSiteNameInput) homeSiteNameInput.value = currentSettings.home_site_name || '';
    if (homeSiteDescriptionInput) homeSiteDescriptionInput.value = currentSettings.home_site_description || '';
    
    if (homeDefaultCategorySelect) homeDefaultCategorySelect.value = currentSettings.home_default_category || '';

    if (searchEngineSwitch) searchEngineSwitch.checked = !!currentSettings.home_search_engine_enabled;

    if (frostedGlassSwitch) frostedGlassSwitch.checked = !!currentSettings.layout_enable_frosted_glass;
    if (frostedGlassIntensityRange) frostedGlassIntensityRange.value = currentSettings.layout_frosted_glass_intensity || '15';
    if (frostedGlassIntensityValue) frostedGlassIntensityValue.textContent = currentSettings.layout_frosted_glass_intensity || '15';
    
    // Toggle Intensity Container visibility
    const intensityContainer = document.getElementById('frostedGlassIntensityContainer');
    if (intensityContainer) {
        if (currentSettings.layout_enable_frosted_glass) {
            intensityContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            intensityContainer.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    if (customWallpaperInput) customWallpaperInput.value = currentSettings.layout_custom_wallpaper || '';
    if (randomWallpaperSwitch) randomWallpaperSwitch.checked = !!currentSettings.layout_random_wallpaper;
    if (bgBlurSwitch) bgBlurSwitch.checked = !!currentSettings.layout_enable_bg_blur;
    if (bgBlurIntensityRange) bgBlurIntensityRange.value = currentSettings.layout_bg_blur_intensity || '0';
    if (bgBlurIntensityValue) bgBlurIntensityValue.textContent = currentSettings.layout_bg_blur_intensity || '0';
    
    const bgBlurContainer = document.getElementById('bgBlurIntensityContainer');
    if (bgBlurContainer) {
        if (currentSettings.layout_enable_bg_blur) {
            bgBlurContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            bgBlurContainer.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    if (bingCountrySelect) bingCountrySelect.value = currentSettings.bing_country || '';
    
    // Grid Cols
    if (gridColsRadios) {
        for (const radio of gridColsRadios) {
            if (radio.value === String(currentSettings.layout_grid_cols)) {
                radio.checked = true;
            }
        }
    }
    
    // Menu Layout
    if (menuLayoutRadios) {
        for (const radio of menuLayoutRadios) {
            if (radio.value === String(currentSettings.layout_menu_layout)) {
                radio.checked = true;
            }
        }
    }
    
    if (cardRadiusInput) {
        cardRadiusInput.value = currentSettings.layout_card_border_radius || '12';
        if (cardRadiusValue) cardRadiusValue.textContent = currentSettings.layout_card_border_radius || '12';
    }

    if (cardTitleFontInput) cardTitleFontInput.value = currentSettings.card_title_font || '';
    if (cardTitleSizeInput) cardTitleSizeInput.value = currentSettings.card_title_size || '16';
    if (cardTitleColorInput) {
        const val = currentSettings.card_title_color || '#111827';
        cardTitleColorInput.value = val;
        if (cardTitleColorPicker && /^#[0-9A-F]{6}$/i.test(val)) {
            cardTitleColorPicker.value = val;
        }
    }

    if (cardDescFontInput) cardDescFontInput.value = currentSettings.card_desc_font || '';
    if (cardDescSizeInput) cardDescSizeInput.value = currentSettings.card_desc_size || '14';
    if (cardDescColorInput) {
        cardDescColorInput.value = currentSettings.card_desc_color || '';
        if (cardDescColorPicker && /^#[0-9A-F]{6}$/i.test(currentSettings.card_desc_color)) {
            cardDescColorPicker.value = currentSettings.card_desc_color;
        }
    }
    
    // Load Fonts
    if (currentSettings.home_title_font) loadFont(currentSettings.home_title_font);
    if (currentSettings.home_subtitle_font) loadFont(currentSettings.home_subtitle_font);
    if (currentSettings.home_stats_font) loadFont(currentSettings.home_stats_font);
    if (currentSettings.home_hitokoto_font) loadFont(currentSettings.home_hitokoto_font);
    if (currentSettings.card_title_font) loadFont(currentSettings.card_title_font);
    if (currentSettings.card_desc_font) loadFont(currentSettings.card_desc_font);

    // Update Card Style UI
    selectCardStyle(currentSettings.layout_card_style || 'style1');
    updatePreviewCards();
    updatePreviewWidth();
  }

  // --- AI Call Logic (Frontend) ---
  // Note: Pass currentSettings instead of trying to read from localStorage inside
  async function getAIDescription(aiConfig, bookmark, generateName = false) {
    const { name, url } = bookmark;

    let systemPrompt, userPrompt;
    if (generateName) {
      systemPrompt = "You are a helpful assistant. You must response with valid JSON.";
      userPrompt = `分析链接：'${url}'。请生成一个简短的网站名称（name，不超过10字）和中文简介（description，不超过30字）。请严格只返回 JSON 格式，例如：{"name": "名称", "description": "简介"}。`;
    } else {
      systemPrompt = "You are a helpful assistant that generates concise and accurate descriptions for bookmarks.";
      userPrompt = `为以下书签生成一个简洁的中文描述（不超过30字）。请直接返回描述内容，不要包含"书签名称"、"描述"等前缀，也不要使用"标题: 描述"的格式。书签名称：'${name}'，链接：'${url}'`;
    }

    try {
      // 始终通过后端 API 进行请求，后端会处理不同的 provider (Workers AI, Gemini, OpenAI)
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

      if (generateName) {
        try {
          const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(jsonStr);
        } catch (e) {
          console.warn('JSON 解析失败，将原始文本作为描述返回', e);
          return { description: responseText, name: '' };
        }
      } else {
        return { description: responseText, name: '' };
      }

    } catch (error) {
      console.error('AI 描述生成失败:', error);
      throw error;
    }
  }

  // --- Bulk Generation Logic (Refactored) ---
  async function handleBulkGenerate() {
    currentSettings.apiKey = apiKeyInput.value.trim();
    currentSettings.baseUrl = baseUrlInput.value.trim();
    currentSettings.model = modelNameInput.value.trim();

    // Validation - Backend will validate API Key
    if (currentSettings.provider !== 'workers-ai') {
      if (currentSettings.provider === 'openai' && !currentSettings.baseUrl) {
        showMessage('使用 OpenAI 兼容模式时，Base URL 是必填项', 'error');
        return;
      }
    }

    showMessage('正在扫描所有书签，请稍候...', 'info');
    let linksToUpdate = [];
    try {
      const response = await fetch('/api/get-empty-desc-sites');
      const result = await response.json();

      if (!response.ok || result.code !== 200) {
        showMessage(result.message || '获取待处理列表失败', 'error');
        return;
      }
      linksToUpdate = result.data;
    } catch (error) {
      showMessage('扫描书签时发生网络错误', 'error');
      return;
    }

    if (linksToUpdate.length === 0) {
      showMessage('太棒了！所有书签都已有描述。', 'success');
      return;
    }

    if (!confirm(`发现 ${linksToUpdate.length} 个链接缺少描述，确定要使用 AI 自动生成吗？`)) {
      return;
    }

    shouldStopBulkGeneration = false;
    bulkIdleView.style.display = 'none';
    bulkProgressView.style.display = 'block';

    let completedCount = 0;
    const total = linksToUpdate.length;
    progressCounter.textContent = `0 / ${total}`;
    progressBar.style.width = '0%';

    for (let i = 0; i < total; i++) {
      if (shouldStopBulkGeneration) {
        break;
      }

      const link = linksToUpdate[i];

      try {
        const { description } = await getAIDescription(currentSettings, link);
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

      progressCounter.textContent = `${i + 1} / ${total}`;
      progressBar.style.width = `${((i + 1) / total) * 100}%`;

      if (i < total - 1) {
        console.log('Waiting for next request...:', aiRequestDelay);
        await new Promise(resolve => setTimeout(resolve, aiRequestDelay));
      }
    }

    bulkIdleView.style.display = 'block';
    bulkProgressView.style.display = 'none';

    // 如果是手动停止，等待2秒以确保数据库写入最终一致性
    if (shouldStopBulkGeneration) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 如果有任何书签被更新（或操作被停止），则刷新列表
    if (completedCount > 0 || shouldStopBulkGeneration) {
      fetchConfigs(currentPage);
    }

    // 根据结果显示最终消息
    let message = '';
    let messageType = 'success';
    if (shouldStopBulkGeneration) {
      message = `操作已停止。成功更新 ${completedCount} 个书签。列表已刷新。`;
    } else {
      if (completedCount === total && total > 0) {
        message = `批量生成完成！成功更新了全部 ${total} 个书签。`;
      } else if (completedCount > 0) {
        message = `批量生成完成。成功更新 ${completedCount} / ${total} 个书签。`;
        messageType = 'info';
      } else if (total > 0) {
        message = '批量生成完成，但未能成功更新任何书签。请检查控制台日志。';
        messageType = 'error';
      }
    }
    if (message) {
      showMessage(message, messageType);
    }

    shouldStopBulkGeneration = false;
  }

  // --- Individual AI Generation (Add/Edit) ---
  const addBookmarkAiBtn = document.getElementById('addBookmarkAiBtn');
  const editBookmarkAiBtn = document.getElementById('editBookmarkAiBtn');

  async function handleSingleGenerate(nameInputId, urlInputId, descInputId, btnId, modalId) {
    const name = document.getElementById(nameInputId).value.trim();
    const url = document.getElementById(urlInputId).value.trim();
    const descInput = document.getElementById(descInputId);
    const btn = document.getElementById(btnId);

    if (!url) {
      showModalMessage(modalId, '请先填写 URL', 'error');
      return;
    }

    // Loading State
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<div class="ai-spinner"></div>';
    btn.disabled = true;

    showModalMessage(modalId, '正在生成描述...', 'info');
    try {
      // Create a temporary object to match the expected structure
      const generateName = !name;
      const bookmark = { name: name || '未命名', url: url };
      const result = await getAIDescription(currentSettings, bookmark, generateName);

      descInput.value = result.description;
      if (generateName && result.name) {
        document.getElementById(nameInputId).value = result.name;
      }
      showModalMessage(modalId, '生成成功', 'success');
    } catch (error) {
      console.error(error);
      showModalMessage(modalId, '生成失败: ' + error.message, 'error');
    } finally {
      // Restore State
      btn.innerHTML = originalContent;
      btn.disabled = false;
    }
  }

  if (addBookmarkAiBtn) {
    addBookmarkAiBtn.addEventListener('click', () => {
      handleSingleGenerate('addBookmarkName', 'addBookmarkUrl', 'addBookmarkDesc', 'addBookmarkAiBtn', 'addBookmarkModal');
    });
  }

  if (editBookmarkAiBtn) {
    editBookmarkAiBtn.addEventListener('click', () => {
      handleSingleGenerate('editBookmarkName', 'editBookmarkUrl', 'editBookmarkDesc', 'editBookmarkAiBtn', 'editBookmarkModal');
    });
  }
};
initSettings();

// Init Data
fetchConfigs();

// ==========================================
// 私密分类与书签联动逻辑
// ==========================================

function setupBookmarkPrivacyLinkage(selectId, checkboxId) {
    const select = document.getElementById(selectId);
    const checkbox = document.getElementById(checkboxId);
    
    if (!select || !checkbox) return;
    
    const updatePrivacy = () => {
        const catId = select.value;
        const category = categoriesData.find(c => c.id == catId);
        
        // Find existing hint or create
        const container = checkbox.closest('.form-group');
        let hint = container.querySelector('.privacy-hint');
        
        if (category && category.is_private) {
            checkbox.checked = true;
            checkbox.disabled = true;
            
            if (!hint) {
                hint = document.createElement('span');
                hint.className = 'privacy-hint text-xs text-amber-600 ml-2 font-normal';
                hint.innerText = '(所属分类私密，强制开启)';
                const label = container.querySelector('label:first-child');
                if (label) label.appendChild(hint);
            }
        } else {
            checkbox.disabled = false;
            if (hint) hint.remove();
        }
    };
    
    select.addEventListener('change', updatePrivacy);
    
    // Attach to element for external call
    select.updatePrivacyState = updatePrivacy;
}

// 初始化监听器
document.addEventListener('DOMContentLoaded', () => {
   setupBookmarkPrivacyLinkage('addBookmarkCatelog', 'addBookmarkIsPrivate');
   setupBookmarkPrivacyLinkage('editBookmarkCatelog', 'editBookmarkIsPrivate');
});

// 劫持 handleEdit 以触发检查
const originalHandleEditFn = window.handleEdit;
window.handleEdit = function(id) {
    if (originalHandleEditFn) originalHandleEditFn(id);
    setTimeout(() => {
        const select = document.getElementById('editBookmarkCatelog');
        if (select && select.updatePrivacyState) select.updatePrivacyState();
    }, 100);
};

// 监听新增按钮点击
const addBookmarkBtnRef = document.getElementById('addBookmarkBtn');
if (addBookmarkBtnRef) {
    addBookmarkBtnRef.addEventListener('click', () => {
        setTimeout(() => {
             const select = document.getElementById('addBookmarkCatelog');
             if (select && select.updatePrivacyState) select.updatePrivacyState();
        }, 100);
    });
}
