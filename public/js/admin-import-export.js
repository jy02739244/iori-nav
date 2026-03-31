// public/js/admin-import-export.js

// ===================================
// 导入导出功能 (Import & Export)
// ===================================

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
          let previewData = { category: [], sites: [] };

          if (Array.isArray(data)) {
              // Old format: Array of sites
              previewData.sites = data;
              const catMap = new Map();
              let tempId = 10000;
              data.forEach(site => {
                  const catName = (site.catelog || '默认分类').trim();
                  if (!catMap.has(catName)) {
                      catMap.set(catName, {
                          id: tempId++,
                          catelog: catName,
                          parent_id: 0,
                          sort_order: 9999
                      });
                  }
              });
              previewData.category = Array.from(catMap.values());
              previewData.sites = data.map(site => {
                  const catName = (site.catelog || '默认分类').trim();
                  return { ...site, catelog_id: catMap.get(catName).id };
              });
          } else if (data.category && data.sites) {
              previewData = data;
              previewData.category = previewData.category.map(c => ({
                  ...c,
                  id: Number(c.id),
                  parent_id: c.parent_id ? Number(c.parent_id) : 0
              }));
              previewData.sites = previewData.sites.map(s => ({
                  ...s,
                  catelog_id: Number(s.catelog_id)
              }));
          }
          showImportPreview(previewData);
        } catch (error) {
          console.error(error);
          showMessage('JSON 文件解析失败: ' + error.message, 'error');
        }
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      showMessage('不支持的文件格式。请选择 .html 或 .json 文件。', 'error');
    }
    e.target.value = '';
  });
}

// 导出选项模态框逻辑
const exportModal = document.getElementById('exportModal');
const closeExportModal = document.getElementById('closeExportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const confirmExportBtn = document.getElementById('confirmExportBtn');
const exportIncludePrivate = document.getElementById('exportIncludePrivate');

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (exportIncludePrivate) exportIncludePrivate.checked = false;
    if (exportModal) exportModal.style.display = 'block';
  });
}

if (closeExportModal) closeExportModal.onclick = () => exportModal.style.display = 'none';
if (cancelExportBtn) cancelExportBtn.onclick = () => exportModal.style.display = 'none';
if (exportModal) {
    exportModal.onclick = (e) => {
        if (e.target === exportModal) exportModal.style.display = 'none';
    };
}

if (confirmExportBtn) {
  confirmExportBtn.addEventListener('click', () => {
    const includePrivate = exportIncludePrivate ? exportIncludePrivate.checked : false;
    const url = `/api/config/export?include_private=${includePrivate}`;
    showMessage('正在生成导出文件...', 'info');
    fetch(url)
      .then(res => {
          if (!res.ok) throw new Error('Export failed');
          return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'config.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showMessage('导出成功', 'success');
        exportModal.style.display = 'none';
      }).catch(err => {
        showMessage('导出失败: ' + err.message, 'error');
        exportModal.style.display = 'none';
      });
  });
}

// 解析 Chrome 书签 HTML
function parseChromeBookmarks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let categories = [];
  let pathMap = new Map();
  let sites = [];
  let tempIdCounter = 1;

  function getOrCreateCategory(name, parentTempId) {
    const key = `${parentTempId || 0}-${name}`;
    if (pathMap.has(key)) return pathMap.get(key).id;
    const newId = tempIdCounter++;
    const cat = { id: newId, catelog: name, parent_id: parentTempId || 0, sort_order: 9999 };
    categories.push(cat);
    pathMap.set(key, cat);
    return newId;
  }

  function traverse(node, parentId) {
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.tagName === 'DT') {
            const h3 = child.querySelector(':scope > h3');
            const a = child.querySelector(':scope > a');
            const dl = child.querySelector(':scope > dl');
            if (h3) {
                const folderName = h3.textContent.trim();
                let currentFolderId = parentId;
                if (parentId === 0 && ['书签栏', 'Bookmarks Bar', '收藏夹', '其他书签', 'Other Bookmarks'].includes(folderName)) {
                     currentFolderId = 0;
                } else {
                     currentFolderId = getOrCreateCategory(folderName, parentId);
                }
                if (dl) traverse(dl, currentFolderId);
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
            traverse(child, parentId);
        }
    }
  }

  const rootDl = doc.querySelector('dl');
  if (rootDl) traverse(rootDl, 0); else traverse(doc.body, 0);
  return { category: categories, sites: sites };
}

// 显示导入预览
function showImportPreview(result) {
  document.body.classList.add('modal-open'); // 禁用背景滚动
  const previewModal = document.createElement('div');
  previewModal.className = 'modal';
  previewModal.style.display = 'block';
  const catMap = new Map();
  result.category.forEach(c => catMap.set(c.id, { ...c, count: 0, children: [] }));
  result.sites.forEach(s => {
      if (s.catelog_id !== 0 && catMap.has(s.catelog_id)) catMap.get(s.catelog_id).count++;
  });

  function buildPreviewHtml(parentId, depth) {
      let items = '';
      const prefix = '&nbsp;&nbsp;'.repeat(depth * 2) + (depth > 0 ? '└─ ' : '');
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
             ${rootHtml}${treeHtml}
           </ul>
        </div>
        <p style="margin-top: 15px; color: #6c757d; font-size: 0.9rem;">注意: 将按照层级结构导入。若分类已存在，将合并。</p>
        <div style="margin-top: 15px; display: flex; align-items: center; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">
            <label for="importOverride" style="font-size: 0.9rem; color: #333; cursor: pointer; font-weight: 500;">覆盖已存在书签 (根据 URL 判断)</label>
            <label class="switch"><input type="checkbox" id="importOverride"><span class="slider round"></span></label>
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
        <button id="cancelImport" class="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">取消</button>
        <button id="confirmImport" class="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">确认导入</button>
      </div>
    </div>
  `;

  document.body.appendChild(previewModal);
  
  const closePreview = () => {
      document.body.removeChild(previewModal);
      document.body.classList.remove('modal-open'); // 恢复背景滚动
  };

  document.getElementById('closePreviewModal').onclick = closePreview;
  document.getElementById('cancelImport').onclick = closePreview;
  document.getElementById('confirmImport').onclick = () => {
    const override = document.getElementById('importOverride').checked;
    closePreview();
    performImport(result, override);
  };
  previewModal.onclick = (e) => { 
      if (e.target === previewModal) closePreview(); 
  };
}

// 执行导入
function performImport(dataToImport, override = false) {
  showMessage('正在导入,请稍候...', 'info');
  fetch('/api/config/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...dataToImport, override: override })
  }).then(res => res.json())
    .then(data => {
      if (data.code === 201 || data.code === 200) {
        showMessage(data.message, 'success');
        if (typeof fetchConfigs === 'function') fetchConfigs();
        if (typeof fetchCategories === 'function') fetchCategories();
      } else {
        showMessage(data.message || '导入失败', 'error');
      }
    }).catch(err => {
      showMessage('网络错误: ' + err.message, 'error');
    });
}
