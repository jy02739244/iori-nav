// functions/lib/wallpaper-fetcher.js
// 从外部 API 获取随机壁纸 URL

const FETCH_TIMEOUT_MS = 8000;

function fetchWithTimeout(url) {
    return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

/**
 * 获取随机壁纸 URL
 * @param {object} options
 * @param {string} options.wallpaperSource - 壁纸来源: 'bing' | '360'
 * @param {string} options.wallpaperCid360 - 360 壁纸分类 ID
 * @param {string} options.bingCountry - Bing 壁纸国家/spotlight
 * @param {number} options.currentWallpaperIndex - 当前壁纸索引（从 cookie）
 * @returns {Promise<{url: string, nextIndex: number} | null>}
 */
export async function fetchRandomWallpaper({ wallpaperSource, wallpaperCid360, bingCountry, currentWallpaperIndex }) {
    try {
        if (wallpaperSource === '360') {
            return await fetch360Wallpaper(wallpaperCid360 || '36', currentWallpaperIndex);
        } else {
            return await fetchBingWallpaper(bingCountry, currentWallpaperIndex);
        }
    } catch (e) {
        console.error('Random Wallpaper Error:', e);
        return null;
    }
}

async function fetch360Wallpaper(cid, currentIndex) {
    const apiUrl = `http://cdn.apc.360.cn/index.php?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${cid}&start=0&count=8`;
    const res = await fetchWithTimeout(apiUrl);
    if (!res.ok) return null;

    const json = await res.json();
    if (json.errno !== "0" || !json.data || json.data.length === 0) return null;

    const nextIndex = (currentIndex + 1) % json.data.length;
    const targetUrl = json.data[nextIndex].url;
    if (!targetUrl) return null;

    return {
        url: targetUrl.replace('http://', 'https://'),
        nextIndex
    };
}

async function fetchBingWallpaper(bingCountry, currentIndex) {
    const bingUrl = bingCountry === 'spotlight'
        ? 'https://peapix.com/spotlight/feed?n=7'
        : `https://peapix.com/bing/feed?n=7&country=${encodeURIComponent(bingCountry)}`;

    const res = await fetchWithTimeout(bingUrl);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const nextIndex = (currentIndex + 1) % data.length;
    const targetUrl = data[nextIndex].fullUrl || data[nextIndex].url;
    if (!targetUrl) return null;

    return { url: targetUrl, nextIndex };
}
