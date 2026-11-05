/**
 * Módulo de Controle de Acesso Facial - PorttoHub
 * Motor de Auditoria e Verificação Biométrica Facial 1:1 de Alta Precisão (Nível Militar)
 * O celular/totem atua como leitor e o app valida contra o banco de dados (Supabase + Gemini)
 */

import { supabase } from './supabase';

export interface ResultadoBiometriaFacial {
  match: boolean;
  confidence_score: number;
  reason: string;
}

export interface RequisicaoBiometriaFacial {
  imagemCadastro: string; // Imagem 1 (Foto oficial no banco de dados)
  imagemCaptura: string;  // Imagem 2 (Captura em tempo real da câmera)
}

/**
 * Envia duas imagens para o endpoint seguro de auditoria biométrica
 */
export async function compararBiometriaFacial(
  requisicao: RequisicaoBiometriaFacial
): Promise<ResultadoBiometriaFacial> {
  try {
    const res = await fetch('/api/facial/comparar-biometria', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imagemCadastro: requisicao.imagemCadastro,
        imagemCaptura: requisicao.imagemCaptura
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.erro || errData.reason || `Falha na verificação biométrica (HTTP ${res.status})`);
    }

    const data = await res.json();
    return {
      match: Boolean(data.match),
      confidence_score: Number(data.confidence_score || 0),
      reason: String(data.reason || 'Análise biométrica concluída')
    };
  } catch (err: any) {
    console.warn('[BiometriaService] Aviso na comparação facial:', err.message);
    return {
      match: false,
      confidence_score: 0.0,
      reason: err.message || 'Falha de comunicação com o motor de biometria facial'
    };
  }
}

/**
 * Inicializa a câmera do celular/totem no elemento de vídeo com fallback resiliente multi-nível
 */
export async function iniciarLeitorFacial(
  videoElementId: string,
  facingMode: 'user' | 'environment' = 'user'
): Promise<boolean> {
  try {
    const video = (document.getElementById(videoElementId) || document.querySelector(`video[id="${videoElementId}"]`) || document.querySelector('video')) as HTMLVideoElement | null;
    if (!video) {
      console.warn(`[LeitorFacial] Elemento de vídeo #${videoElementId} não encontrado.`);
      return false;
    }

    // Para qualquer stream anterior
    if (video.srcObject && video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[LeitorFacial] Dispositivo não suporta getUserMedia');
      return false;
    }

    let stream: MediaStream | null = null;

    // Nível 1: Resolução ideal e modo frontal/traseiro
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch {
      // Nível 2: Apenas facingMode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false
        });
      } catch {
        // Nível 3: Qualquer câmera do dispositivo
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e3) {
          console.error('[LeitorFacial] Todas as tentativas de câmera falharam:', e3);
          return false;
        }
      }
    }

    if (!stream) return false;

    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;

    try {
      await video.play();
    } catch (playErr: any) {
      if (playErr?.name !== 'AbortError') {
        console.warn('[LeitorFacial] Aviso no video.play():', playErr);
      }
    }
    return true;
  } catch (error) {
    console.error('[LeitorFacial] Erro ao acessar a câmera do dispositivo:', error);
    return false;
  }
}

/**
 * Converte URL ou Blob em Base64 de forma resiliente (suporta URLs remotas com fallback para o servidor)
 */
export async function baixarImagemComoBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) {
    return url.split(',')[1] || url;
  }

  // Tenta baixar no navegador; se CORS impedir, retorna a própria URL para o backend processar diretamente
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1] || res);
        };
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // CORS ou erro de rede do browser - o backend baixa diretamente sem CORS
  }

  return url;
}

/**
 * Busca morador oficial no Supabase por CPF, Matrícula ou ID
 */
export async function buscarFotoOficialMorador(
  userIdOrCpf: string,
  condominioId?: string
): Promise<{ morador: any; fotoBase64: string }> {
  const termoLimpo = userIdOrCpf.replace(/\D/g, '');

  let query = supabase
    .from('moradores')
    .select('id, condominio_id, nome, bloco, unidade, tipo, status_acesso, cpf, rg, foto_url');

  if (condominioId) {
    query = query.eq('condominio_id', condominioId);
  }

  // Tenta buscar por CPF exato ou formatado
  let morador: any = null;
  if (termoLimpo.length >= 3) {
    const { data: resCpf } = await query.or(`cpf.eq.${userIdOrCpf},cpf.ilike.%${termoLimpo}%`);
    if (resCpf && resCpf.length > 0) {
      morador = resCpf[0];
    }
  }

  // Se não encontrou por CPF, busca por ID ou Nome
  if (!morador) {
    const { data: resId } = await supabase
      .from('moradores')
      .select('id, condominio_id, nome, bloco, unidade, tipo, status_acesso, cpf, rg, foto_url')
      .eq('id', userIdOrCpf)
      .maybeSingle();

    if (resId) {
      morador = resId;
    } else {
      const { data: resNome } = await supabase
        .from('moradores')
        .select('id, condominio_id, nome, bloco, unidade, tipo, status_acesso, cpf, rg, foto_url')
        .ilike('nome', `%${userIdOrCpf}%`)
        .limit(1);
      if (resNome && resNome.length > 0) morador = resNome[0];
    }
  }

  if (!morador || !morador.foto_url) {
    throw new Error(`Morador "${userIdOrCpf}" não encontrado ou sem foto oficial cadastrada no banco de dados.`);
  }

  const fotoBase64 = await baixarImagemComoBase64(morador.foto_url);
  return { morador, fotoBase64 };
}

/**
 * Aciona abertura de portão físico (integração ESP32 / Relé via Hardware webhook)
 */
export function acionarAberturaDePortaoFisico(tipo: 'pedestrian' | 'vehicle' = 'pedestrian'): void {
  try {
    const event = new CustomEvent('porttohub:abrir-portao', { detail: { tipo } });
    window.dispatchEvent(event);
  } catch (err) {
    console.warn('[PortaoFisico] Erro ao disparar evento de abertura:', err);
  }
}

/**
 * Registra log de auditoria no Supabase
 */
export async function registrarLogAuditoria(
  cpfOuIdentificador: string,
  autorizado: boolean,
  motivo: string,
  condominioId?: string
): Promise<void> {
  try {
    // 1. Tabela acessos_logs
    await supabase.from('acessos_logs').insert([
      {
        cpf: cpfOuIdentificador,
        autorizado,
        motivo,
        condominio_id: condominioId,
        timestamp: new Date().toISOString()
      }
    ]);
  } catch {
    // 2. Fallback tabela historico_absoluto se acessos_logs não existir
    try {
      await supabase.from('historico_absoluto').insert([
        {
          condominio_id: condominioId,
          modulo: 'Controle de Acesso',
          acao: autorizado ? 'Acesso Liberado (Biometria IA)' : 'Acesso Negado (Biometria IA)',
          descricao: `CPF/ID: ${cpfOuIdentificador} - Motivo: ${motivo}`,
          operador_nome: 'Totem Biometria Facial'
        }
      ]);
    } catch {}
  }
}

/**
 * Executa o fluxo completo de validação facial:
 * 1. Captura da câmera do celular/totem em Base64
 * 2. Busca da foto oficial no Supabase (1:1)
 * 3. Envio para auditoria com IA Gemini
 * 4. Regra estrita de decisão: match === true E confidence_score >= 0.95
 * 5. Abertura do portão ou bloqueio + Log de auditoria
 */
export async function validarAcessoFacial(
  userIdOrCpf: string,
  videoElementId: string,
  statusCallback: (mensagem: string, classeCss: string) => void,
  options?: {
    condominioId?: string;
    onSucesso?: (morador: any, resultado: ResultadoBiometriaFacial) => void;
    onFalha?: (motivo: string, resultado?: ResultadoBiometriaFacial) => void;
  }
): Promise<ResultadoBiometriaFacial | null> {
  try {
    statusCallback('Capturando imagem da biometria...', 'text-yellow-400');

    const video = (document.getElementById(videoElementId) || document.querySelector(`video[id="${videoElementId}"]`) || document.querySelector('video')) as HTMLVideoElement | null;
    if (!video) {
      throw new Error('Câmera não localizada na tela. Toque em "Ligar Câmera".');
    }

    // Se o vídeo ainda estiver carregando, aguarda até 1200ms
    if (video.readyState < 2 || !video.videoWidth) {
      statusCallback('Inicializando sensor da câmera...', 'text-cyan-400');
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if ((video.readyState >= 2 && video.videoWidth > 0) || attempts > 12) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    // 1. Capturar o frame atual da câmera e isolar em Base64 (Canvas)
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64CameraFrame = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];

    statusCallback('Buscando cadastro oficial do morador...', 'text-blue-400');

    // 2. Buscar foto oficial no Supabase (Verificação 1:1)
    const { morador, fotoBase64 } = await buscarFotoOficialMorador(userIdOrCpf, options?.condominioId);

    statusCallback('Analisando biometria facial com IA (Nível Militar)...', 'text-indigo-400');

    // 3. Chamada ao Google Gemini (via endpoint de borda com temperature 0.0)
    const resultado = await compararBiometriaFacial({
      imagemCadastro: fotoBase64,
      imagemCaptura: base64CameraFrame
    });

    // 4. Regra de Decisão Rígida (Confidence Score >= 0.95)
    if (resultado.match && resultado.confidence_score >= 0.95) {
      statusCallback(
        `Acesso Liberado: Bem-vindo, ${morador.nome}! (${(resultado.confidence_score * 100).toFixed(1)}%)`,
        'text-emerald-400 font-bold'
      );
      acionarAberturaDePortaoFisico('pedestrian');
      await registrarLogAuditoria(userIdOrCpf, true, resultado.reason, options?.condominioId || morador.condominio_id);

      if (options?.onSucesso) {
        options.onSucesso(morador, resultado);
      }
      return resultado;
    } else {
      const pontuacao = (resultado.confidence_score * 100).toFixed(1);
      statusCallback(
        `Acesso Negado: ${resultado.reason} (${pontuacao}%)`,
        'text-red-500 font-bold'
      );
      await registrarLogAuditoria(userIdOrCpf, false, resultado.reason, options?.condominioId || morador?.condominio_id);

      if (options?.onFalha) {
        options.onFalha(resultado.reason, resultado);
      }
      return resultado;
    }
  } catch (err: any) {
    console.error('[Biometria] Erro crítico na validação facial:', err);
    statusCallback(`Falha no sistema: ${err.message}`, 'text-red-400 font-bold');
    if (options?.onFalha) {
      options.onFalha(err.message);
    }
    return null;
  }
}
