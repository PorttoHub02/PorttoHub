/**
 * Cloudflare Pages Function: /api/github-versao
 * Consulta o GitHub e retorna o commit mais recente e a versão calculada no Horário de Brasília (America/Sao_Paulo)
 * Executado diretamente na Borda Global da Cloudflare com latência de milissegundos
 */

export async function onRequestGet(context: any) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const headers: Record<string, string> = {
      'User-Agent': 'PorttoHub-Cloudflare-Edge',
      'Accept': 'application/vnd.github.v3+json'
    };

    const token = env?.GITHUB_TOKEN;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const ghRes = await fetch('https://api.github.com/repos/PorttoHub02/PorttoHub/commits/main', {
      headers,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!ghRes.ok) {
      throw new Error(`GitHub API HTTP ${ghRes.status}`);
    }

    const commit: any = await ghRes.json();
    const rawDate = commit.commit.committer.date;
    const dataObj = new Date(rawDate);

    const formatador = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const partes = formatador.formatToParts(dataObj);
    const mapa: Record<string, string> = {};
    for (const p of partes) {
      mapa[p.type] = p.value;
    }

    const dia = (mapa.day || '01').padStart(2, '0');
    const mes = (mapa.month || '01').padStart(2, '0');
    const ano = (mapa.year || '26').slice(-2);
    const hora = mapa.hour === '24' ? '00' : (mapa.hour || '00').padStart(2, '0');
    const minuto = (mapa.minute || '00').padStart(2, '0');
    const versaoCalculada = `${dia}${mes}${ano}${hora}${minuto}`;

    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(dataObj);

    const payload = {
      sucesso: true,
      repositorio: 'PorttoHub02/PorttoHub',
      branch: 'main',
      sha: commit.sha.slice(0, 7),
      mensagem: commit.commit.message,
      autor: commit.commit.author?.name || 'PorttoHub Dev',
      dataIso: rawDate,
      dataBrasilia: `${dataBrasilia} (Horário de Brasília - BRT)`,
      versaoCalculada,
      origem: 'cloudflare-pages-edge',
      horarioConsulta: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: err.message || 'Falha ao consultar GitHub',
      origem: 'cloudflare-pages-edge-fallback'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
