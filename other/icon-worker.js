export default {
  async fetch(request) {
    const url = new URL(request.url);
    let targetDomain = url.searchParams.get("url");

    if (!targetDomain) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    // === 核心修改：智能提取纯域名 ===
    try {
      // 1. 如果用户输入没有带 http:// 或 https://，我们手动补上 http:// 
      //    这样 new URL() 才能正常工作，否则会报错
      if (!targetDomain.match(/^https?:\/\//)) {
        targetDomain = 'http://' + targetDomain;
      }
      
      // 2. 使用 URL 对象解析，提取 hostname (会自动去掉 /a/b 以及 ?query=...)
      //    例如: http://www.google.com/a/b -> www.google.com
      targetDomain = new URL(targetDomain).hostname;
      
    } catch (e) {
      // 如果传入的字符串实在太离谱导致解析失败，返回 400
      return new Response("Invalid domain format", { status: 400 });
    }

    // 定义 API 列表
    const endpoints = [
      `https://www.google.com/s2/favicons?domain=${targetDomain}&sz=64`,
      `https://www.faviconextractor.com/favicon/${targetDomain}?larger=true`,
      `https://faviconsnap.com/api/favicon?url=${targetDomain}`,
      `https://favicon.im/${targetDomain}?larger=true`
    ];
    const MIN_IMAGE_SIZE = 100;
    for (const targetUrl of endpoints) {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; MyNavigator/1.0)"
          }
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("image")) {
            const contentLength = response.headers.get("content-length");
            if (contentLength && parseInt(contentLength) < MIN_IMAGE_SIZE) {
              console.warn(`Image too small from ${targetUrl}: ${contentLength} bytes`);
              continue;
            }

            return createCorsResponse(response);
          }else{
            console.log(`Failed to response image from ${targetUrl}:`,contentType)
          }
        }else{
          console.log(`Failed to response ok from ${targetUrl}:`)
        }
      } catch (e) {
        console.warn(`Failed to fetch from ${targetUrl}:`, e);
      }
    }

    return new Response("Error fetching image from all sources", { status: 502 });
  }
};

function createCorsResponse(originalResponse) {
  const newResponse = new Response(originalResponse.body, originalResponse);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.delete("Cross-Origin-Resource-Policy");
  newResponse.headers.delete("Cross-Origin-Embedder-Policy");
  return newResponse;
}
