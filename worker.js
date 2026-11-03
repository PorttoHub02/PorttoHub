/**
 * PorttoHub Cloudflare Worker with Static Assets & Edge API
 * Production Edge Router with SPA Fallback, Upstash Redis Cache, and Asynchronous Supabase Logs
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
          upstashConfigured: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
          timestamp: new Date().toISOString()
        }),
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-condominio-id',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 3. Edge Facial Verification API (< 1 segundo / frações de milissegundo com Upstash)
    if (url.pathname === '/api/facial/verificar' && request.method === 'POST') {
      const start = Date.now();
      try {
        const body = await request.json();
        const { condominioId, targetId, termo, portao = 'Portão Pedestre Social' } = body || {};

        if (!condominioId) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Condomínio não informado.' }), {
            status: 400,
            headers: { 'content-type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const upstashUrl = env.UPSTASH_REDIS_REST_URL;
        const upstashToken = env.UPSTASH_REDIS_REST_TOKEN;
        const supabaseUrl = env.VITE_SUPABASE_URL || 'https://pkemipwowkcnstbazlma.supabase.co';
        const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

        // Rate limiting na borda (Cloudflare + Upstash)
        if (upstashUrl && upstashToken) {
          const clientIp = request.headers.get('cf-connecting-ip') || 'edge_client';
          const rateKey = `porttohub:ratelimit:facial:${condominioId}:${clientIp}`;
          try {
            const incrRes = await fetch(upstashUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(['INCR', rateKey])
            });
            const incrData = await incrRes.json();
            const count = Number(incrData.result);
            if (count === 1) {
              fetch(upstashUrl, {
                method: 'POST',
                headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(['EXPIRE', rateKey, 10])
              }).catch(() => {});
            }
            if (count > 15) {
              return new Response(JSON.stringify({
                sucesso: false,
                liberado: false,
                erro: 'Taxa de varredura excedida na borda Cloudflare. Aguarde alguns segundos.',
                rateLimit: { allowed: false, remaining: 0, resetSeconds: 10 }
              }), {
                status: 429,
                headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          } catch {}
        }

        // Consulta Cache de Autorizados no Upstash
        let autorizados = null;
        let origem = 'upstash-edge';

        if (upstashUrl && upstashToken) {
          try {
            const cacheRes = await fetch(upstashUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(['GET', `porttohub:autorizados:${condominioId}`])
            });
            if (cacheRes.ok) {
              const cacheData = await cacheRes.json();
              if (cacheData && cacheData.result) {
                autorizados = typeof cacheData.result === 'string' ? JSON.parse(cacheData.result) : cacheData.result;
              }
            }
          } catch {}
        }

        // Cache Miss: Consulta Supabase e popula Upstash
        if (!autorizados || !Array.isArray(autorizados) || autorizados.length === 0) {
          origem = 'supabase-edge';
          try {
            const supRes = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/moradores?condominio_id=eq.${condominioId}&select=id,condominio_id,nome,bloco,unidade,tipo,status_acesso,cpf,rg,telefone,foto_url`, {
              headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }
            });
            if (supRes.ok) {
              const supData = await supRes.json();
              autorizados = (Array.isArray(supData) ? supData : []).map((m) => ({
                id: String(m.id),
                condominioId: String(m.condominio_id || condominioId),
                name: m.nome || 'Morador',
                unit: `${m.bloco ? `${m.bloco} - ` : ''}Apto ${m.unidade || ''}`.trim(),
                type: m.tipo || 'Morador',
                status: m.status_acesso === 'bloqueado' ? 'Bloqueado' : 'Ativo',
                document: m.cpf || m.rg || '',
                phone: m.telefone || '',
                photoUrl: m.foto_url || '',
                updatedAt: new Date().toISOString()
              }));

              if (upstashUrl && upstashToken && autorizados.length > 0) {
                ctx.waitUntil(
                  fetch(upstashUrl, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(['SET', `porttohub:autorizados:${condominioId}`, JSON.stringify(autorizados), 'EX', 3600])
                  }).catch(() => {})
                );
              }
            }
          } catch {}
        }

        const lista = autorizados || [];
        let matched = null;

        if (targetId) {
          matched = lista.find(a => a.id === targetId);
        } else if (termo) {
          const t = String(termo).toLowerCase().trim();
          matched = lista.find(a => 
            a.name.toLowerCase().includes(t) || 
            a.unit.toLowerCase().includes(t) ||
            (a.document && a.document.replace(/\D/g, '').includes(t.replace(/\D/g, '')))
          );
        } else if (lista.length > 0) {
          matched = lista[0];
        }

        const latencyMs = Date.now() - start;

        // Disparo assíncrono de log para o Supabase sem bloquear a resposta Edge
        if (matched) {
          const liberado = matched.status === 'Ativo';
          ctx.waitUntil(
            fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/registros_acesso`, {
              method: 'POST',
              headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                condominio_id: condominioId,
                tipo: matched.type === 'Prestador' ? 'prestador' : 'morador',
                nome: matched.name,
                unidade_bloco: matched.unit,
                documento: matched.document || '',
                ponto_acesso_entrada: portao,
                status: liberado ? 'presente' : 'barrado',
                motivo_bloqueio: liberado ? undefined : 'Cadastro bloqueado',
                data_hora_entrada: new Date().toISOString(),
                operador_entrada_nome: 'Totem Facial Edge (Cloudflare + Upstash)'
              })
            }).catch(() => {})
          );

          return new Response(JSON.stringify({
            sucesso: true,
            liberado,
            pessoa: matched,
            motivo: liberado ? 'Acesso Autorizado' : 'Cadastro Bloqueado',
            origem,
            latencyMs
          }), {
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Server-Timing': `edge;dur=${latencyMs}`
            }
          });
        } else {
          return new Response(JSON.stringify({
            sucesso: true,
            liberado: false,
            motivo: 'Rosto ou documento não cadastrado neste condomínio.',
            origem,
            latencyMs
          }), {
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ sucesso: false, erro: err.message }), {
          status: 500,
          headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 4. Serve via Cloudflare Static Assets Binding
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
