export default {
  async fetch(request, env) {
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('PorttoHub Edge Runtime', {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
