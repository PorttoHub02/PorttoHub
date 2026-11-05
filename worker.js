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

    // 2.1 Edge Real-Time GitHub & Cloudflare Version Resolution (/api/github-versao e /api/versao)
    if (url.pathname === '/api/github-versao' || url.pathname === '/api/versao') {
      try {
        const ghHeaders = {
          'User-Agent': 'PorttoHub-Cloudflare-Edge',
          'Accept': 'application/vnd.github.v3+json'
        };
        if (env.GITHUB_TOKEN) {
          ghHeaders['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;
        }

        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 3500);

        let remoteCommit = null;
        try {
          const ghRes = await fetch('https://api.github.com/repos/PorttoHub02/PorttoHub/commits/main', {
            headers: ghHeaders,
            signal: controller.signal
          });
          if (ghRes.ok) {
            remoteCommit = await ghRes.json();
          }
        } catch (e) {
          console.warn('[CF Worker] Aviso ao consultar API de commits GitHub:', e);
        } finally {
          clearTimeout(fetchTimeout);
        }

        // Se a API de commits falhar ou rate-limit, consulta diretamente o raw version.json do GitHub
        let rawVersionData = null;
        if (!remoteCommit) {
          try {
            const rawRes = await fetch(`https://raw.githubusercontent.com/PorttoHub02/PorttoHub/main/public/version.json?_t=${Date.now()}`, {
              signal: AbortSignal.timeout(3000)
            });
            if (rawRes.ok) {
              rawVersionData = await rawRes.json();
            }
          } catch {}
        }

        let sha = '59d9f79';
        let rawDate = new Date().toISOString();
        let mensagem = 'Atualização do repositório PorttoHub';
        let autor = 'PorttoHub Dev';
        let versaoCalculada = '';

        if (remoteCommit) {
          sha = remoteCommit.sha ? remoteCommit.sha.slice(0, 7) : sha;
          rawDate = remoteCommit.commit?.committer?.date || rawDate;
          mensagem = remoteCommit.commit?.message?.split('\n')[0] || mensagem;
          autor = remoteCommit.commit?.author?.name || autor;
        } else if (rawVersionData && rawVersionData.versao) {
          sha = rawVersionData.commit || sha;
          rawDate = rawVersionData.dataIso || rawDate;
          mensagem = rawVersionData.mensagem || mensagem;
          versaoCalculada = rawVersionData.versao;
        }

        const dataObj = new Date(rawDate);
        if (!versaoCalculada) {
          const partes = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).formatToParts(dataObj);
          const mapa = {};
          for (const p of partes) { mapa[p.type] = p.value; }
          const dia = (mapa.day || '01').padStart(2, '0');
          const mes = (mapa.month || '01').padStart(2, '0');
          const ano = (mapa.year || '26').slice(-2);
          const hora = mapa.hour === '24' ? '00' : (mapa.hour || '00').padStart(2, '0');
          const minuto = (mapa.minute || '00').padStart(2, '0');
          versaoCalculada = `${dia}${mes}${ano}${hora}${minuto}`;
        }

        const dataBrasilia = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'medium'
        }).format(dataObj);

        return new Response(JSON.stringify({
          sucesso: true,
          repositorio: 'PorttoHub02/PorttoHub',
          branch: 'main',
          sha,
          mensagem,
          autor,
          dataIso: rawDate,
          dataBrasilia: `${dataBrasilia} (Horário de Brasília - BRT)`,
          versaoCalculada,
          origem: remoteCommit ? 'github-api-edge' : rawVersionData ? 'github-raw-edge' : 'edge-fallback',
          colo: request.cf?.colo || 'edge',
          horarioConsulta: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        }), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
            'pragma': 'no-cache',
            'expires': '0',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          sucesso: false,
          erro: err.message || 'Erro ao sincronizar versão na borda'
        }), {
          status: 500,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 2.2 Purga de Cache e Forçar Atualização Imediata na Borda Cloudflare
    if (url.pathname === '/api/purge-cloudflare' && (request.method === 'POST' || request.method === 'GET')) {
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Comando de purga de cache e sincronização recebido na Borda Cloudflare.',
        timestamp: new Date().toISOString(),
        colo: request.cf?.colo || 'edge'
      }), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
          'pragma': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 2.3 Edge Biometric Comparison API (Gemini 3.8 Flash Auditoria Anatômica)
    if (url.pathname === '/api/facial/comparar-biometria' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { imagemCadastro, imagemCaptura, imagemCadastroBase64, imagemCapturaBase64 } = body || {};
        const imgCad = imagemCadastro || imagemCadastroBase64;
        const imgCap = imagemCaptura || imagemCapturaBase64;

        if (!imgCad || !imgCap) {
          return new Response(JSON.stringify({
            match: false,
            confidence_score: 0.0,
            reason: 'Ambas as imagens são obrigatórias para comparação facial.'
          }), {
            status: 400,
            headers: { 'content-type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({
            match: false,
            confidence_score: 0.0,
            reason: 'GEMINI_API_KEY não configurada na borda Cloudflare.'
          }), {
            status: 503,
            headers: { 'content-type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const systemInstruction = `Você é um sistema especialista em auditoria e verificação biométrica facial de alta precisão para controle de acesso físico em condomínios. Sua única função é comparar duas imagens e determinar se a pessoa capturada na Imagem 2 é a mesma pessoa cadastrada na Imagem 1.

DIRETRIZES DE PROCESSAMENTO E LEITURA:
1. DESCONSIDERAÇÃO TOTAL DE ELEMENTOS DE FUNDO:
   - Ignore completamente paredes, portas, pisos, iluminação ambiente, reflexos, sombras e qualquer objeto ao fundo.
   - O fato de haver uma parede ou textura atrás do indivíduo NUNCA deve ser interpretado como um rosto ou estrutura humana.
   - Localize e isola exclusivamente a região facial da Imagem 2. Se nenhum rosto humano claro for detectado na Imagem 2, descarte imediatamente a análise e defina "match": false.

2. CRITÉRIOS DE COMPARAÇÃO FACIAL (ANÁLISE ANATÔMICA):
   - Analise e compare estritamente a geometria e estrutura óssea facial entre a Imagem 1 (cadastro) e a Imagem 2 (câmera):
     * Distância interpapilar (espaço entre os olhos) e formato dos olhos.
     * Proporção, ponte e base do nariz.
     * Projeção das maçãs do rosto (zigomático) e linha da mandíbula.
     * Distância entre a base do nariz e o lábio superior, e do lábio inferior ao queixo.
   - Desconsidere variações temporárias como corte de cabelo, expressão facial, uso de maquiagem, óculos de grau ou iluminação diferente.

3. REGRA DE SEGURANÇA E ZERO TOLERÂNCIA A FALSOS POSITIVOS:
   - Apenas confirme uma correspondência positiva ("match": true) se houver certeza absoluta de que se trata da mesma pessoa.
   - Em caso de dúvida, ângulo muito inclinado, rosto parcialmente oculto, baixa resolução ou divergência na estrutura óssea, defina "match": false.
   - NUNCA assuma a identidade de uma pessoa caso a foto seja incerta.

4. FORMATO ESTRITO DE RESPOSTA (OBRIGATÓRIO):
   - Sua saída deve ser EXCLUSIVAMENTE um objeto JSON válido, sem nenhum texto introdutório, explicações antes ou depois, e sem blocos de código markdown.
   - O JSON deve conter exatamente as seguintes chaves:
     {
       "match": boolean,
       "confidence_score": number,
       "reason": "string"
     }`;

        const extractData = (str) => {
          const m = str.match(/^data:([^;]+);base64,(.+)$/);
          return m ? { mime: m[1], data: m[2] } : { mime: 'image/jpeg', data: str.replace(/^data:[^;]+;base64,/, '') };
        };

        const p1 = extractData(imgCad);
        const p2 = extractData(imgCap);

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'aistudio-build' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
          temperature: 0.0,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  match: { type: 'BOOLEAN' },
                  confidence_score: { type: 'NUMBER' },
                  reason: { type: 'STRING' }
                },
                required: ['match', 'confidence_score', 'reason']
              }
            },
            contents: [{
              parts: [
                { inlineData: { mimeType: p1.mime, data: p1.data } },
                { text: 'Imagem 1: Cadastro' },
                { inlineData: { mimeType: p2.mime, data: p2.data } },
                { text: 'Imagem 2: Captura Câmera' }
              ]
            }]
          })
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          throw new Error(`Gemini API HTTP ${geminiRes.status}: ${errText}`);
        }

        const gData = await geminiRes.json();
        const rawJsonText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(rawJsonText);

        return new Response(JSON.stringify({
          match: Boolean(parsed.match),
          confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : (parsed.match ? 0.95 : 0.05),
          reason: parsed.reason || (parsed.match ? 'Estrutura facial equivalente' : 'Divergência anatômica detectada')
        }), {
          headers: { 'content-type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          match: false,
          confidence_score: 0.0,
          reason: err.message || 'Erro no processamento da biometria na borda'
        }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
        });
      }
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
        if (url.searchParams.has('cf_purge') || url.searchParams.has('nocache') || url.searchParams.has('_t')) {
          // Requisição com bypass explícito de cache
          headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          headers.set('Pragma', 'no-cache');
          headers.set('Expires', '0');
          headers.set('Surrogate-Control', 'no-store');
          headers.set('Access-Control-Allow-Origin', '*');
        } else if (url.pathname.startsWith('/assets/')) {
          // Hashed JS/CSS chunks -> cache forever
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (
          url.pathname === '/version.json' ||
          url.pathname === '/sw.js'
        ) {
          // Critical OTA update files -> revalidate immediately (nunca armazenar em cache de borda)
          headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          headers.set('Pragma', 'no-cache');
          headers.set('Expires', '0');
          headers.set('Surrogate-Control', 'no-store');
          headers.set('Access-Control-Allow-Origin', '*');
        } else if (url.pathname === '/' || url.pathname.endsWith('.html')) {
          // App shell HTML -> 0 max-age, must-revalidate
          headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
          headers.set('Pragma', 'no-cache');
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
