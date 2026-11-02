export default {
  async fetch(request, env) {
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) {
        return response;
      }
      // Fallback to index.html for SPA client-side routes
      const url = new URL(request.url);
      return env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
    }
    return new Response('PorttoHub Worker Active', { status: 200 });
  }
};
