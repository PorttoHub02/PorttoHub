/**
 * Serviço de Versionamento e Sincronização em Tempo Real (GitHub + Cloudflare Pages + PWA)
 * Padrão solicitado: DDMMAAHHMM (ex: 0311261338)
 * Fuso Horário Obrigatório: Horário Oficial do Brasil (Brasília / America/Sao_Paulo - UTC-3)
 */

export const NOME_APLICACAO = 'PorttoHub';
export const FUSO_HORARIO_OFICIAL_BRASIL = 'America/Sao_Paulo';

// Versão de build gerada automaticamente no build (Horário de Brasília)
export const VERSAO_BUILD_ATUAL = '0411262211';
export const COMMIT_HASH_ATUAL = 'aef9eaa';

export interface ResultadoVerificacaoVersao {
  temNovaVersao: boolean;
  versaoLocal: string;
  versaoRemota: string;
  versaoCloudflare: string;
  shaLocal: string;
  shaRemoto: string;
  mensagemCommit: string;
  autorCommit: string;
  dataIso: string;
  dataBrasilia: string;
  origem: 'github-api' | 'github-raw' | 'cloudflare-edge' | 'local';
  cloudflareSincronizado: boolean;
  statusTexto: string;
}

export function gerarVersaoHorarioBrasil(data: Date = new Date()): string {
  try {
    const formatador = new Intl.DateTimeFormat('pt-BR', {
      timeZone: FUSO_HORARIO_OFICIAL_BRASIL,
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const partes = formatador.formatToParts(data);
    const mapa: Record<string, string> = {};
    for (const p of partes) {
      mapa[p.type] = p.value;
    }

    const dia = (mapa.day || '01').padStart(2, '0');
    const mes = (mapa.month || '01').padStart(2, '0');
    const ano = (mapa.year || '26').slice(-2);
    const hora = mapa.hour === '24' ? '00' : (mapa.hour || '00').padStart(2, '0');
    const minuto = (mapa.minute || '00').padStart(2, '0');

    return `${dia}${mes}${ano}${hora}${minuto}`;
  } catch (e) {
    return VERSAO_BUILD_ATUAL;
  }
}

export function obterVersaoApp(): string {
  return VERSAO_BUILD_ATUAL;
}

export function formatarVersaoParaExibicao(versao: string = VERSAO_BUILD_ATUAL): string {
  if (!versao || versao.length < 10) return versao || VERSAO_BUILD_ATUAL;
  const dia = versao.slice(0, 2);
  const mes = versao.slice(2, 4);
  const ano = versao.slice(4, 6);
  const hora = versao.slice(6, 8);
  const min = versao.slice(8, 10);
  return `${dia}/${mes}/${ano} ${hora}:${min} (BRT)`;
}

/**
 * Consulta em tempo real o GitHub e a Borda Cloudflare para identificar novas versões publicadas,
 * contornando qualquer cache intermediário ou de service worker.
 */
export async function buscarVersaoMaisRecenteGitHubECloudflare(): Promise<ResultadoVerificacaoVersao> {
  const agoraTimestamp = Date.now();
  let versaoRemotaGitHub = '';
  let shaGitHub = '';
  let mensagemGitHub = '';
  let autorGitHub = '';
  let dataIsoGitHub = '';
  let dataBrasiliaGitHub = '';
  let origemDetectada: ResultadoVerificacaoVersao['origem'] = 'local';

  let versaoCloudflareEdge = '';

  // 1. Consulta Borda Cloudflare /version.json com no-store rigoroso
  try {
    const resCf = await fetch(`/version.json?_t=${agoraTimestamp}&nocache=1&cf_purge=1`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      }
    });
    if (resCf.ok) {
      const dataCf = await resCf.json();
      if (dataCf.versao) {
        versaoCloudflareEdge = dataCf.versao;
      }
    }
  } catch (e) {
    console.warn('[VersaoService] Aviso ao consultar Cloudflare /version.json:', e);
  }

  // 2. Consulta Endpoint de Borda Cloudflare Worker / API /api/github-versao
  try {
    const resApi = await fetch(`/api/github-versao?_t=${agoraTimestamp}&nocache=1&cf_purge=1`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      }
    });
    if (resApi.ok) {
      const dataApi = await resApi.json();
      if (dataApi.sucesso && dataApi.versaoCalculada) {
        versaoRemotaGitHub = dataApi.versaoCalculada;
        shaGitHub = dataApi.sha || '';
        mensagemGitHub = dataApi.mensagem || '';
        autorGitHub = dataApi.autor || '';
        dataIsoGitHub = dataApi.dataIso || '';
        dataBrasiliaGitHub = dataApi.dataBrasilia || '';
        origemDetectada = 'cloudflare-edge';
      }
    }
  } catch (e) {
    console.warn('[VersaoService] Aviso ao consultar /api/github-versao:', e);
  }

  // 3. Consulta direta ao GitHub Raw version.json (fonte da verdade direta do repositório)
  try {
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/PorttoHub02/PorttoHub/main/public/version.json?_t=${agoraTimestamp}`,
      { cache: 'no-store' }
    );
    if (rawRes.ok) {
      const rawData = await rawRes.json();
      if (rawData.versao && (!versaoRemotaGitHub || rawData.versao > versaoRemotaGitHub)) {
        versaoRemotaGitHub = rawData.versao;
        shaGitHub = rawData.commit || shaGitHub;
        mensagemGitHub = rawData.mensagem || mensagemGitHub;
        dataIsoGitHub = rawData.dataIso || dataIsoGitHub;
        origemDetectada = 'github-raw';
      }
    }
  } catch (e) {
    console.warn('[VersaoService] Aviso ao consultar raw GitHub version.json:', e);
  }

  // 4. Consulta direta à API pública de commits do GitHub
  if (!versaoRemotaGitHub || shaGitHub === COMMIT_HASH_ATUAL) {
    try {
      const commitRes = await fetch(
        `https://api.github.com/repos/PorttoHub02/PorttoHub/commits/main?_t=${agoraTimestamp}`,
        {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-store'
        }
      );
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        const rawDate = commitData.commit?.committer?.date || commitData.commit?.author?.date;
        if (rawDate) {
          const calc = gerarVersaoHorarioBrasil(new Date(rawDate));
          if (!versaoRemotaGitHub || calc >= versaoRemotaGitHub) {
            versaoRemotaGitHub = calc;
            shaGitHub = (commitData.sha || '').slice(0, 7);
            mensagemGitHub = (commitData.commit?.message || '').split('\n')[0];
            autorGitHub = commitData.commit?.author?.name || 'PorttoHub Dev';
            dataIsoGitHub = rawDate;
            origemDetectada = 'github-api';
          }
        }
      }
    } catch (e) {
      console.warn('[VersaoService] Aviso ao consultar GitHub Commits API:', e);
    }
  }

  // Fallbacks seguros se nada respondeu
  if (!versaoRemotaGitHub) {
    versaoRemotaGitHub = versaoCloudflareEdge || VERSAO_BUILD_ATUAL;
  }
  if (!shaGitHub) {
    shaGitHub = COMMIT_HASH_ATUAL;
  }

  // Formatação de data no Horário de Brasília
  if (!dataBrasiliaGitHub && dataIsoGitHub) {
    try {
      dataBrasiliaGitHub = new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO_HORARIO_OFICIAL_BRASIL,
        dateStyle: 'short',
        timeStyle: 'medium'
      }).format(new Date(dataIsoGitHub)) + ' (Horário de Brasília - BRT)';
    } catch {
      dataBrasiliaGitHub = formatarVersaoParaExibicao(versaoRemotaGitHub);
    }
  } else if (!dataBrasiliaGitHub) {
    dataBrasiliaGitHub = formatarVersaoParaExibicao(versaoRemotaGitHub);
  }

  // Análise de status
  const temNovaVersao = (
    versaoRemotaGitHub !== VERSAO_BUILD_ATUAL && versaoRemotaGitHub > VERSAO_BUILD_ATUAL
  ) || (
    shaGitHub !== COMMIT_HASH_ATUAL && shaGitHub.length >= 7 && COMMIT_HASH_ATUAL.length >= 7
  );

  const cloudflareSincronizado = Boolean(
    !versaoCloudflareEdge || 
    versaoCloudflareEdge === versaoRemotaGitHub ||
    versaoCloudflareEdge >= versaoRemotaGitHub
  );

  let statusTexto = 'Aplicativo sincronizado e atualizado!';
  if (temNovaVersao) {
    if (!cloudflareSincronizado) {
      statusTexto = `Nova versão no GitHub (v${versaoRemotaGitHub})! Forçando atualização no Cloudflare...`;
    } else {
      statusTexto = `Nova versão disponível (v${versaoRemotaGitHub})! Atualizando...`;
    }
  }

  return {
    temNovaVersao,
    versaoLocal: VERSAO_BUILD_ATUAL,
    versaoRemota: versaoRemotaGitHub,
    versaoCloudflare: versaoCloudflareEdge || versaoRemotaGitHub,
    shaLocal: COMMIT_HASH_ATUAL,
    shaRemoto: shaGitHub,
    mensagemCommit: mensagemGitHub || 'Atualização recente no repositório PorttoHub',
    autorCommit: autorGitHub || 'PorttoHub Dev',
    dataIso: dataIsoGitHub,
    dataBrasilia: dataBrasiliaGitHub,
    origem: origemDetectada,
    cloudflareSincronizado,
    statusTexto
  };
}

/**
 * Força a purga total de cache na Borda Cloudflare, no Service Worker e no navegador,
 * recarregando o aplicativo instantaneamente com a versão mais recente.
 */
export async function forcarAtualizacaoTotalCloudflareEApp(versaoAlvo?: string): Promise<void> {
  const versaoFinal = versaoAlvo || Date.now().toString();

  // 1. Dispara requisição de purga assíncrona para a Borda Cloudflare (Worker)
  try {
    fetch(`/api/purge-cloudflare?_t=${Date.now()}&v=${versaoFinal}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    }).catch(() => {});
  } catch {}

  // 2. Notifica todos os Service Workers para expurgar seus caches locais
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.active) {
          reg.active.postMessage({ type: 'FORCE_PURGE_ALL_CACHES' });
        }
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'FORCE_PURGE_ALL_CACHES' });
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        // Desregistra para garantir que o novo sw.js seja baixado limpo
        try {
          await reg.unregister();
        } catch {}
      }
    } catch (e) {
      console.warn('[VersaoService] Aviso ao desregistrar SWs:', e);
    }
  }

  // 3. Esvazia todos os caches armazenados no CacheStorage do navegador
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const nomes = await caches.keys();
      await Promise.all(nomes.map(n => caches.delete(n)));
      console.log('[VersaoService] Caches locais do CacheStorage purgados:', nomes);
    } catch (e) {
      console.warn('[VersaoService] Aviso ao limpar CacheStorage:', e);
    }
  }

  // 4. Limpa sessionStorage sem deslogar (mantém autenticação no localStorage)
  try {
    sessionStorage.clear();
  } catch {}

  // 5. Monta URL com parâmetros agressivos de bypass de cache da CDN Cloudflare
  const urlAtual = new URL(window.location.href);
  urlAtual.searchParams.set('cf_purge', Date.now().toString());
  urlAtual.searchParams.set('v', versaoFinal);
  urlAtual.searchParams.set('force_refresh', '1');

  // 6. Recarrega a página forçando bypass de cache
  setTimeout(() => {
    window.location.replace(urlAtual.toString());
  }, 250);
}
