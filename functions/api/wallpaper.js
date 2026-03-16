// functions/api/wallpaper.js

import { jsonResponse, errorResponse } from '../_middleware';

const API_360_BASE = 'http://cdn.apc.360.cn/index.php';
const FETCH_TIMEOUT_MS = 8000;

function fetchWithTimeout(url) {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const source = url.searchParams.get('source') || 'bing';
  const action = url.searchParams.get('action') || '';
  const cid = url.searchParams.get('cid') || '36';
  const country = url.searchParams.get('country') || '';
  const indexStr = url.searchParams.get('index') || '-1';
  let currentIndex = parseInt(indexStr);
  if (isNaN(currentIndex)) currentIndex = -1;

  try {
    // 360 壁纸：分类列表
    if (source === '360' && action === 'categories') {
      const apiUrl = `${API_360_BASE}?c=WallPaper&a=getAllCategoriesV2&from=360chrome`;
      const res = await fetchWithTimeout(apiUrl);
      if (!res.ok) return errorResponse('Failed to fetch 360 categories', 502);
      const json = await res.json();
      return jsonResponse({ code: 200, data: json });
    }

    // 360 壁纸：壁纸列表
    if (source === '360' && action === 'list') {
      const start = url.searchParams.get('start') || '0';
      const count = url.searchParams.get('count') || '8';
      const apiUrl = `${API_360_BASE}?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${cid}&start=${start}&count=${count}`;
      const res = await fetchWithTimeout(apiUrl);
      if (!res.ok) return errorResponse('Failed to fetch 360 wallpapers', 502);
      const json = await res.json();
      return jsonResponse({ code: 200, data: json });
    }

    // 默认行为：获取单张壁纸（首页 SSR 和客户端随机壁纸使用）
    let targetUrl = '';
    let nextIndex = 0;

    if (source === '360') {
      const apiUrl = `${API_360_BASE}?c=WallPaper&a=getAppsByCategory&from=360chrome&cid=${cid}&start=0&count=8`;
      const res = await fetchWithTimeout(apiUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.errno === "0" && json.data && json.data.length > 0) {
          nextIndex = (currentIndex + 1) % json.data.length;
          const targetItem = json.data[nextIndex];
          if (targetItem.url) {
            targetUrl = targetItem.url.replace('http://', 'https://');
          }
        }
      }
    } else {
      // Bing 壁纸
      let bingUrl = '';
      if (country === 'spotlight') {
        bingUrl = 'https://peapix.com/spotlight/feed?n=7';
      } else {
        bingUrl = `https://peapix.com/bing/feed?n=7&country=${country}`;
      }
      const res = await fetchWithTimeout(bingUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          nextIndex = (currentIndex + 1) % data.length;
          const targetItem = data[nextIndex];
          targetUrl = targetItem.fullUrl || targetItem.url;
        }
      }
    }

    if (targetUrl) {
      return jsonResponse({ code: 200, data: { url: targetUrl, index: nextIndex } });
    } else {
      return errorResponse('Failed to fetch wallpaper', 500);
    }
  } catch (e) {
    return errorResponse(`Error: ${e.message}`, 500);
  }
}
