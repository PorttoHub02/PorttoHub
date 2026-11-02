/**
 * PorttoHub Cloudflare Worker with Static Assets
 * Production Edge Router with SPA Fallback, Immutable Caching, and Security Headers
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Edge Healthcheck & Diagnostics (0ms overhead)
    if (url.pathname === '/api/health' || url.pathname === '/api/ping') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'PorttoHub Cloudflare Edge',
          region: request.cf?.colo || 'edge',
          timestamp: new Date().toISOString()
        }),
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // 2. Handle CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 3. Serve via Cloudflare Static Assets Binding
    if (env.ASSETS) {
      try {
        let response = await env.ASSETS.fetch(request);

        // SPA Navigation Fallback: If asset not found and request expects HTML, serve /index.html
        if (
          response.status === 404 &&
          request.method === 'GET' &&
          !url.pathname.includes('.')
        ) {
          const indexRequest = new Request(new URL('/index.html', request.url), request);
          response = await env.ASSETS.fetch(indexRequest);
        }

        // Clone headers to inject performance & security headers
        const headers = new Headers(response.headers);

        // Cache optimization policies
        if (url.pathname.startsWith('/assets/')) {
          // Hashed JS/CSS chunks -> cache forever
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (
          url.pathname === '/version.json' ||
          url.pathname === '/sw.js'
        ) {
          // Critical OTA update files -> revalidate immediately
          headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
          headers.set('Access-Control-Allow-Origin', '*');
        } else if (url.pathname === '/' || url.pathname.endsWith('.html')) {
          // App shell HTML -> 0 max-age, must-revalidate
          headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
        }

        // Global Security Headers
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('X-Frame-Options', 'SAMEORIGIN');
        headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        headers.set('Permissions-Policy', 'camera=(self), microphone=(self)');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (err) {
        return new Response(`Edge Asset Error: ${err.message}`, {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
      }
    }

    return new Response('PorttoHub Edge Runtime', {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
