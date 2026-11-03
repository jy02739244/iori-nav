// functions/api/[[path]].js
import { errorResponse } from '../_middleware';

// Pages Functions 没有为 HEAD 自动复用 onRequestGet；未匹配到方法时，
// Pages 会回退到 index.html，导致 HEAD /api/* 返回 200 HTML。
// 这个兜底路由把所有未被具体 API 路由匹配的请求拦下来：
//   - HEAD 返回 405（明确不支持，避免被误判为健康）
//   - 其他方法返回 JSON 404，避免未知 API 路径回退到首页
//
// 405 必须带 Allow（RFC 9110 §15.5.6 要求），这里声明的是本站 API 支持的方法
// 全集；具体路径真正支持哪些方法由各自的 onRequestX 决定，兜底路由无法预知。

export async function onRequest(context) {
  const { request } = context;
  const method = request.method.toUpperCase();

  if (method === 'HEAD') {
    return new Response(null, {
      status: 405,
      headers: {
        Allow: 'GET, POST, PUT, PATCH, DELETE',
        'Cache-Control': 'no-store',
      },
    });
  }

  return errorResponse('Not Found', 404);
}
