export default {
  async fetch(request, env) {
    return new Response('PorttoHub Edge Runtime', {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
