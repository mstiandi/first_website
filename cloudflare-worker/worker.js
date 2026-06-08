// Cloudflare Worker — 反向代理到 Vercel API
// 解决 *.vercel.app 在国内被墙的问题

var TARGET = 'https://vercel-api-nu-two.vercel.app';

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    var targetUrl = TARGET + url.pathname + url.search;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // 代理所有 /api/* 请求
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    // 构建转发请求
    var headers = new Headers(request.headers);
    var body = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      body = await request.text();
    }

    var upstream = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': headers.get('Content-Type') || 'application/json'
      },
      body: body
    });

    // 构建响应头
    var respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    if (upstream.headers.get('Content-Type')?.includes('text/event-stream')) {
      respHeaders.set('Cache-Control', 'no-cache');
      respHeaders.set('Connection', 'keep-alive');
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  }
};
