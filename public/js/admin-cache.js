// CSRF token auto-attach: monkey-patch fetch for POST/PUT/DELETE/PATCH
(function() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (!meta) return;
    const csrfToken = meta.getAttribute('content');
    if (!csrfToken) return;

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        init = init || {};
        const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            if (init.headers instanceof Headers) {
                if (!init.headers.has('X-CSRF-Token')) {
                    init.headers.set('X-CSRF-Token', csrfToken);
                }
            } else {
                init.headers = init.headers || {};
                if (!init.headers['X-CSRF-Token']) {
                    init.headers['X-CSRF-Token'] = csrfToken;
                }
            }
        }
        return originalFetch.call(this, input, init);
    };
})();

// Cache Management Logic
// Separated from admin.js

window.markCacheStale = function() {
    // Set cookie to indicate stale cache (valid for 1 year)
    // The backend will detect this cookie, clear KV cache, and then clear the cookie
    document.cookie = "iori_cache_stale=1; path=/; max-age=31536000; SameSite=Lax";
}

window.resetCacheStale = function() {
    // No-op: Cookie is cleared by backend response
}

document.addEventListener('DOMContentLoaded', () => {
    // Refresh Cache Button Logic
    const refreshCacheBtn = document.getElementById('refreshCacheBtn');
    const refreshCacheModal = document.getElementById('refreshCacheModal');
    const closeRefreshCacheModal = document.getElementById('closeRefreshCacheModal');
    const cancelRefreshCacheBtn = document.getElementById('cancelRefreshCacheBtn');
    const confirmRefreshCacheBtn = document.getElementById('confirmRefreshCacheBtn');

    if (refreshCacheBtn && refreshCacheModal) {
        // Open Modal
        refreshCacheBtn.addEventListener('click', () => {
            refreshCacheModal.style.display = 'block';
            document.body.classList.add('modal-open');
        });

        // Close Modal Helper
        const closeRefreshModal = () => {
            refreshCacheModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        };

        // Close Events
        if (closeRefreshCacheModal) closeRefreshCacheModal.onclick = closeRefreshModal;
        if (cancelRefreshCacheBtn) cancelRefreshCacheBtn.onclick = closeRefreshModal;
        refreshCacheModal.onclick = (e) => {
            if (e.target === refreshCacheModal) closeRefreshModal();
        };

        // Confirm Action
        if (confirmRefreshCacheBtn) {
            confirmRefreshCacheBtn.onclick = () => {
                confirmRefreshCacheBtn.disabled = true;
                const originalText = confirmRefreshCacheBtn.innerHTML;
                confirmRefreshCacheBtn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white inline mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 刷新中...';
                
                fetch('/api/cache/clear', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.code === 200) {
                            window.showMessage('缓存刷新成功', 'success');
                            window.resetCacheStale(); // Explicitly call reset
                            closeRefreshModal();
                        } else {
                            window.showMessage('缓存刷新失败: ' + data.message, 'error');
                        }
                    })
                    .catch(err => {
                        window.showMessage('网络错误', 'error');
                    })
                    .finally(() => {
                        confirmRefreshCacheBtn.disabled = false;
                        confirmRefreshCacheBtn.innerHTML = originalText;
                    });
            };
        }
    }
});
