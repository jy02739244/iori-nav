document.addEventListener('DOMContentLoaded', function() {
  // ========== 侧边栏控制 ==========
  const sidebar = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobileOverlay');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const closeSidebar = document.getElementById('closeSidebar');
  
  function openSidebar() {
    sidebar?.classList.add('open');
    mobileOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  function closeSidebarMenu() {
    sidebar?.classList.remove('open');
    mobileOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  sidebarToggle?.addEventListener('click', openSidebar);
  closeSidebar?.addEventListener('click', closeSidebarMenu);
  mobileOverlay?.addEventListener('click', closeSidebarMenu);
  
  // ========== 复制链接功能 ==========
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const url = this.getAttribute('data-url');
      if (!url) return;
      
      navigator.clipboard.writeText(url).then(() => {
        showCopySuccess(this);
      }).catch(() => {
        // 备用方法
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showCopySuccess(this);
        } catch (e) {
          alert('复制失败,请手动复制');
        }
        document.body.removeChild(textarea);
      });
    });
  });
  
  function showCopySuccess(btn) {
    const successMsg = btn.querySelector('.copy-success');
    successMsg.classList.remove('hidden');
    successMsg.classList.add('copy-success-animation');
    setTimeout(() => {
      successMsg.classList.add('hidden');
      successMsg.classList.remove('copy-success-animation');
    }, 2000);
  }
  
  // ========== 返回顶部 ==========
  const backToTop = document.getElementById('backToTop');
  
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTop?.classList.remove('opacity-0', 'invisible');
    } else {
      backToTop?.classList.add('opacity-0', 'invisible');
    }
  });
  
  backToTop?.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  // ========== 模态框控制 ==========
  const addSiteModal = document.getElementById('addSiteModal');
  const addSiteBtnSidebar = document.getElementById('addSiteBtnSidebar');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelAddSite = document.getElementById('cancelAddSite');
  const addSiteForm = document.getElementById('addSiteForm');
  
  function openModal() {
    addSiteModal?.classList.remove('opacity-0', 'invisible');
    addSiteModal?.querySelector('.max-w-md')?.classList.remove('translate-y-8');
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    addSiteModal?.classList.add('opacity-0', 'invisible');
    addSiteModal?.querySelector('.max-w-md')?.classList.add('translate-y-8');
    document.body.style.overflow = '';
  }
  
  async function fetchCategoriesForSelect() {
    const selectElement = document.getElementById('addSiteCatelog');
    if (!selectElement) return;

    try {
      const response = await fetch('/api/categories?pageSize=999');
      const data = await response.json();
      if (data.code === 200 && data.data) {
        selectElement.innerHTML = '<option value="" disabled selected>请选择一个分类</option>';
        data.data.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.catelog;
          selectElement.appendChild(option);
        });
      } else {
        selectElement.innerHTML = '<option value="" disabled>无法加载分类</option>';
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      selectElement.innerHTML = '<option value="" disabled>加载分类失败</option>';
    }
  }

  addSiteBtnSidebar?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
    fetchCategoriesForSelect();
  });
  
  closeModalBtn?.addEventListener('click', closeModal);
  cancelAddSite?.addEventListener('click', closeModal);
  addSiteModal?.addEventListener('click', (e) => {
    if (e.target === addSiteModal) closeModal();
  });
  
  // ========== 表单提交 ==========
  addSiteForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const data = {
      name: document.getElementById('addSiteName').value,
      url: document.getElementById('addSiteUrl').value,
      logo: document.getElementById('addSiteLogo').value,
      desc: document.getElementById('addSiteDesc').value,
      catelog_id: document.getElementById('addSiteCatelog').value
    };
    
    fetch('/api/config/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
      if (data.code === 201) {
        showToast('提交成功,等待管理员审核');
        closeModal();
        addSiteForm.reset();
      } else {
        alert(data.message || '提交失败');
      }
    })
    .catch(err => {
      console.error('网络错误:', err);
      alert('网络错误,请稍后重试');
    });
  });
  
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-accent-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
  
  // ========== 搜索功能 ==========
  const searchInputs = document.querySelectorAll('.search-input-target');
  const sitesGrid = document.getElementById('sitesGrid');
  
  searchInputs.forEach(input => {
    input.addEventListener('input', function() {
        const keyword = this.value.toLowerCase().trim();
        // Sync other inputs
        searchInputs.forEach(otherInput => {
            if (otherInput !== this) {
                otherInput.value = this.value;
            }
        });

        const cards = sitesGrid?.querySelectorAll('.site-card');
        
        cards?.forEach(card => {
        const name = (card.dataset.name || '').toLowerCase();
        const url = (card.dataset.url || '').toLowerCase();
        const catalog = (card.dataset.catalog || '').toLowerCase();
        
        if (name.includes(keyword) || url.includes(keyword) || catalog.includes(keyword)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
        });
        
        updateHeading(keyword);
    });
  });
  
  function updateHeading(keyword) {
    const heading = document.querySelector('[data-role="list-heading"]');
    if (!heading) return;
    
    const visibleCount = sitesGrid?.querySelectorAll('.site-card:not(.hidden)').length || 0;
    const defaultText = heading.dataset.default || '';
    const activeText = heading.dataset.active || '';
    
    if (keyword) {
      heading.textContent = `搜索结果 · ${visibleCount} 个网站`;
    } else if (activeText) {
      heading.textContent = `${activeText} · ${visibleCount} 个网站`;
    } else {
      heading.textContent = defaultText;
    }
  }
  
  // ========== 一言 API ==========
  fetch('https://v1.hitokoto.cn')
    .then(res => res.json())
    .then(data => {
      const hitokoto = document.getElementById('hitokoto_text');
      if (hitokoto) {
        hitokoto.href = `https://hitokoto.cn/?uuid=${data.uuid}`;
        hitokoto.innerText = data.hitokoto;
      }
    })
    .catch(console.error);

  // ========== Horizontal Menu Overflow Logic ==========
  const navContainer = document.getElementById('horizontalCategoryNav');
  const moreBtnContainer = document.getElementById('horizontalMoreBtnContainer');
  const moreBtn = document.getElementById('horizontalMoreBtn');
  const dropdown = document.getElementById('horizontalMoreDropdown');
  
  let checkOverflow = () => {};

  if (navContainer && moreBtnContainer && dropdown) {
    // Move all items back to nav function
    const resetNav = () => {
        const dropdownItems = Array.from(dropdown.children);
        dropdownItems.forEach(item => {
            item.classList.remove('block', 'w-full', 'text-left', 'px-4', 'py-2', 'hover:bg-gray-100', 'text-gray-700', 'font-bold', 'text-primary-600', 'bg-gray-50', 'bg-primary-600', 'text-white');
            item.classList.add('inline-flex', 'items-center', 'px-4', 'py-2', 'rounded-full', 'text-sm', 'transition-all', 'duration-200', 'whitespace-nowrap');
            
            // Restore original class
            if (item.dataset.originalClass) {
                item.className = item.dataset.originalClass;
            }
            navContainer.appendChild(item);
        });
        moreBtnContainer.classList.add('hidden');
        dropdown.classList.add('hidden');
    };

    checkOverflow = () => {
        resetNav();
        
        const navChildren = Array.from(navContainer.children);
        if (navChildren.length === 0) return;
        
        const firstTop = navChildren[0].offsetTop;
        
        // Pass 1: Check for any physical wrapping
        let firstWrappedIndex = -1;
        for (let i = 0; i < navChildren.length; i++) {
            if (navChildren[i].offsetTop > firstTop) {
                firstWrappedIndex = i;
                break;
            }
        }
        
        if (firstWrappedIndex === -1) {
            // No wrapping detected, everything fits on one line.
            moreBtnContainer.classList.add('hidden');
            dropdown.classList.add('hidden');
            return; 
        }
        
        // Overflow detected: Show button and move items
        moreBtnContainer.classList.remove('hidden');
        
        const navWidth = navContainer.clientWidth;
        const buttonWidth = 60; // Reserved space for button
        const limitRight = navWidth - buttonWidth;
        
        const itemsToMove = [];
        
        for (let i = 0; i < navChildren.length; i++) {
            const item = navChildren[i];
            const itemRight = item.offsetLeft + item.offsetWidth;
            
            // Move item if:
            // 1. It is already wrapped (i >= firstWrappedIndex)
            // 2. OR it overlaps with the "More" button area (itemRight > limitRight)
            if (i >= firstWrappedIndex || itemRight > limitRight) {
                itemsToMove.push(item);
            }
        }

        // Move wrapped items to dropdown
        itemsToMove.forEach(item => {
            // Save original class
            if (!item.dataset.originalClass) {
                item.dataset.originalClass = item.className;
            }
            
            // Check active state
            const isActive = item.classList.contains('font-semibold');
            
            // Apply dropdown styling
            item.classList.remove('inline-flex', 'items-center', 'rounded-full', 'whitespace-nowrap');
            
            if (isActive) {
                item.classList.add('block', 'w-full', 'text-left', 'px-4', 'py-2', 'text-sm', 'rounded-md', 'font-bold', 'bg-primary-600', 'text-white');
                item.classList.remove('text-gray-700', 'hover:bg-gray-50');
            } else {
                item.classList.add('block', 'w-full', 'text-left', 'px-4', 'py-2', 'text-sm', 'hover:bg-gray-50', 'rounded-md', 'text-gray-700');
                item.classList.remove('font-bold', 'bg-primary-600', 'text-white');
            }
            
            dropdown.appendChild(item);
        });
    };

    // Initial check
    setTimeout(checkOverflow, 100);
    window.addEventListener('resize', () => {
        checkOverflow();
    });

    // Toggle Dropdown
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // Close on click inside dropdown
    dropdown.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
            dropdown.classList.add('hidden');
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !moreBtn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
  }

  // ========== AJAX Navigation ==========
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href^="?catalog="]');
    if (!link) return;
    
    // Allow new tab clicks
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    const href = link.getAttribute('href');
    const catalogId = link.getAttribute('data-id');
    const catalogName = link.textContent.trim();
    
    // 如果在移动端，点击后关闭侧边栏
    if (typeof closeSidebarMenu === 'function') {
        closeSidebarMenu();
    }
    
    // 视觉反馈
    const sitesGrid = document.getElementById('sitesGrid');
    if (!sitesGrid) return;

    // 渐隐动画
    sitesGrid.style.transition = 'opacity 0.15s ease-out';
    sitesGrid.style.opacity = '0';

    try {
        // 构造 API URL
        let apiUrl = '/api/config?pageSize=10000';
        if (catalogId) {
            apiUrl += `&catalogId=${catalogId}`;
        }
        
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('网络请求失败');
        const data = await res.json();
        
        if (data.code !== 200) throw new Error(data.message || 'API 错误');
        
        // 等待渐隐动画完成
        await new Promise(resolve => setTimeout(resolve, 150));

        // 重置网格透明度（卡片会通过动画逐个进入）
        sitesGrid.style.transition = 'none';
        sitesGrid.style.opacity = '1';

        // 渲染站点
        renderSites(data.data);

        // 更新标题
        updateHeading(null, catalogId ? catalogName : null, data.data.length);

        // 更新导航激活状态
        updateNavigationState(href);

    } catch (err) {
        console.error('导航跳转失败:', err);
        window.location.href = href;
    }
  });

  function renderSites(sites) {
      const sitesGrid = document.getElementById('sitesGrid');
      if (!sitesGrid) return;
      
      // 从当前 DOM 中检测布局设置
      const isFrosted = document.body.innerHTML.includes('frosted-glass-effect'); 
      const previousContent = sitesGrid.innerHTML;
      const hadFrosted = previousContent.includes('frosted-glass-effect');
      
      // 检测网格列数
      const isFiveCols = sitesGrid.className.includes('xl:grid-cols-5');
      
      // 检测隐藏元素设置（通过启发式方法检测）
      const firstCard = sitesGrid.querySelector('.site-card');
      const hideDesc = firstCard && !firstCard.querySelector('p.line-clamp-2');
      const hideLinks = firstCard && !firstCard.querySelector('.copy-btn');
      const hideCategory = firstCard && !firstCard.querySelector('.bg-secondary-100');
      
      sitesGrid.innerHTML = '';
      
      if (sites.length === 0) {
          sitesGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">本分类下暂无书签</div>';
          return;
      }

      sites.forEach((site, index) => {
        // 安全处理属性值
        const safeName = escapeHTML(site.name || '未命名');
        const safeUrl = normalizeUrl(site.url);
        const safeDesc = escapeHTML(site.desc || '暂无描述');
        const safeCatalog = escapeHTML(site.catelog || '未分类');
        const cardInitial = (safeName.charAt(0) || '站').toUpperCase();
        
        // Logo 处理
        let logoHtml = '';
        if (site.logo) {
             logoHtml = `<img src="${escapeHTML(site.logo)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100">`;
        } else {
             logoHtml = `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`;
        }
        
        // 条件渲染部分
        const descHtml = hideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;
        
        const hasValidUrl = !!safeUrl;
        const linksHtml = hideLinks ? '' : `
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-primary-600 truncate max-w-[140px]" title="${safeUrl}">${safeUrl || '未提供链接'}</span>
            <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} rounded-full text-xs font-medium transition-colors" data-url="${safeUrl}" ${hasValidUrl ? '' : 'disabled'}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ${isFiveCols ? '' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              ${isFiveCols ? '' : '<span class="copy-text">复制</span>'}
              <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
            </button>
          </div>`;
          
        const categoryHtml = hideCategory ? '' : `
                <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700">
                  ${safeCatalog}
                </span>`;
        
        // 样式类处理
        const frostedClass = hadFrosted ? 'frosted-glass-effect' : '';
        const baseCardClass = hadFrosted
            ? 'site-card group rounded-xl overflow-hidden transition-all' 
            : 'site-card group bg-white border border-primary-100/60 rounded-xl shadow-sm overflow-hidden';
        
        const card = document.createElement('div');
        card.className = `${baseCardClass} ${frostedClass} card-anim-enter`;
        // 设置交错动画延迟，最多处理前 20 个项目以避免等待过长
        const delay = Math.min(index, 20) * 30; 
        card.style.animationDelay = `${delay}ms`;
        
        card.setAttribute('data-name', safeName);
        card.setAttribute('data-url', safeUrl);
        card.setAttribute('data-catalog', safeCatalog);
        
        card.innerHTML = `
        <div class="p-5">
          <a href="${safeUrl}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-start">
              <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">
                ${logoHtml}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="site-title text-base font-medium text-gray-900 truncate transition-all duration-300 origin-left" title="${safeName}">${safeName}</h3>
                ${categoryHtml}
              </div>
            </div>
            ${descHtml}
          </a>
          ${linksHtml}
        </div>
        `;
        
        sitesGrid.appendChild(card);
        
        // 重新绑定复制按钮事件
        const copyBtn = card.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const url = this.getAttribute('data-url');
                if (!url) return;
                
                navigator.clipboard.writeText(url).then(() => {
                    showCopySuccess(this);
                }).catch(() => {
                    // 备用复制方案
                    const textarea = document.createElement('textarea');
                    textarea.value = url;
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try { document.execCommand('copy'); showCopySuccess(this); } catch (e) {}
                    document.body.removeChild(textarea);
                });
            });
        }
      });
  }
  
  function updateNavigationState(href) {
        // 更新横向菜单
        const currentNav = document.getElementById('horizontalCategoryNav');
        const dropdown = document.getElementById('horizontalMoreDropdown');
        
        if (currentNav) {
            const allLinks = [
                ...Array.from(currentNav.querySelectorAll('a')),
                ...(dropdown ? Array.from(dropdown.querySelectorAll('a')) : [])
            ];
            
            const getHref = (el) => el.getAttribute('href');
            let oldActive = null;
            let newActive = null;

            // 查找旧的和新的激活项
            allLinks.forEach(link => {
                if (getHref(link) === href) {
                    newActive = link;
                } else if (link.classList.contains('font-semibold') && (link.classList.contains('bg-primary-600') || link.classList.contains('text-primary-700'))) {
                    // 基于类名识别当前激活的项目
                    oldActive = link;
                }
            });

            if (newActive && oldActive && newActive !== oldActive) {
                // 确保 originalClass 已设置
                if (!oldActive.dataset.originalClass) oldActive.dataset.originalClass = oldActive.className;
                if (!newActive.dataset.originalClass) newActive.dataset.originalClass = newActive.className;

                // 交换存储在 originalClass 中的“菜单栏状态”类名
                const activeStateClass = oldActive.dataset.originalClass;
                const inactiveStateClass = newActive.dataset.originalClass;

                oldActive.dataset.originalClass = inactiveStateClass;
                newActive.dataset.originalClass = activeStateClass;
                
                // 立即应用类名，以便视觉状态更新，且 checkOverflow 能获取到正确的宽度和样式
                oldActive.className = inactiveStateClass;
                newActive.className = activeStateClass;
            }
            
             // 重新检查溢出情况，以重新分配项目并根据新的激活状态应用下拉菜单/菜单栏样式
             if (typeof checkOverflow === 'function') checkOverflow();
        }
        
        // 更新侧边栏
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const links = sidebar.querySelectorAll('a[href^="?catalog="]');
            links.forEach(link => {
                 if (link.getAttribute('href') === href) {
                     link.className = 'flex items-center px-3 py-2 rounded-lg bg-secondary-100 text-primary-700 w-full';
                     const svg = link.querySelector('svg');
                     if(svg) svg.className = 'h-5 w-5 mr-2 text-primary-600';
                 } else {
                     link.className = 'flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 w-full';
                     const svg = link.querySelector('svg');
                     if(svg) svg.className = 'h-5 w-5 mr-2 text-gray-400';
                 }
            });
        }
  }

  // 辅助函数
  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  
  function normalizeUrl(url) {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return 'https://' + url;
  }
});
