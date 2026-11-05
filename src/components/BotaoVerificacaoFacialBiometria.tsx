import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, XCircle, RefreshCw, ShieldCheck, DoorOpen, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { compararBiometriaFacial, ResultadoBiometriaFacial } from '../services/biometriaFacialService';

export interface BotaoVerificacaoFacialBiometriaProps {
  condominioId?: string;
  moradorId?: string;
  onAcessoLiberado?: (resultado: ResultadoBiometriaFacial) => void;
  onAcessoNegado?: (resultado: ResultadoBiometriaFacial) => void;
  className?: string;
}

export const BotaoVerificacaoFacialBiometria: React.FC<BotaoVerificacaoFacialBiometriaProps> = ({
  condominioId,
  moradorId: moradorIdProp,
  onAcessoLiberado,
  onAcessoNegado,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [statusTexto, setStatusTexto] = useState<string>('Câmera pronta para validação facial');
  const [statusTipo, setStatusTipo] = useState<'idle' | 'processando' | 'sucesso' | 'erro'>('idle');
  const [resultadoBio, setResultadoBio] = useState<ResultadoBiometriaFacial | null>(null);

  const [moradoresDisponiveis, setMoradoresDisponiveis] = useState<any[]>([]);
  const [moradorSelecionadoId, setMoradorSelecionadoId] = useState<string>(moradorIdProp || '');
  const [moradorSelecionadoNome, setMoradorSelecionadoNome] = useState<string>('');

  // 1. Função que ativa a webcam do dispositivo no elemento <video>
  const ativarCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraAtiva(true);
      setStatusTexto('Câmera ativa. Posicione o rosto no enquadramento e clique em Validar.');
      setStatusTipo('idle');
    } catch (err: any) {
      console.error('[Webcam] Erro ao acessar câmera:', err);
      setCameraAtiva(false);
      setStatusTexto('Permissão de câmera negada ou dispositivo indisponível.');
      setStatusTipo('erro');
    }
  }, []);

  const desativarCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
  }, []);

  // Inicializa a câmera ao montar o componente
  useEffect(() => {
    ativarCamera();
    return () => {
      desativarCamera();
    };
  }, [ativarCamera, desativarCamera]);

  // Carrega moradores cadastrados no condomínio via Supabase para seleção ou validação
  useEffect(() => {
    async function carregarMoradores() {
      try {
        let query = supabase
          .from('moradores')
          .select('id, nome, bloco, unidade, foto_url, status_acesso')
          .order('nome');

        if (condominioId) {
          query = query.eq('condominio_id', condominioId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          setMoradoresDisponiveis(data);
          if (!moradorSelecionadoId) {
            setMoradorSelecionadoId(data[0].id);
            setMoradorSelecionadoNome(data[0].nome);
          }
        }
      } catch (err) {
        console.warn('[Supabase] Falha ao listar moradores para biometria:', err);
      }
    }

    carregarMoradores();
  }, [condominioId, moradorSelecionadoId]);

  // Atualiza nome ao trocar seleção
  useEffect(() => {
    if (moradorSelecionadoId && moradoresDisponiveis.length > 0) {
      const m = moradoresDisponiveis.find(item => item.id === moradorSelecionadoId);
      if (m) setMoradorSelecionadoNome(m.nome);
    }
  }, [moradorSelecionadoId, moradoresDisponiveis]);

  // Busca a foto oficial de cadastro no banco de dados Supabase
  const buscarFotoOficialMorador = async (id: string): Promise<string> => {
    // 1. Tenta pegar da lista já carregada em memória
    const moradorLocal = moradoresDisponiveis.find(m => m.id === id);
    if (moradorLocal && moradorLocal.foto_url) {
      return moradorLocal.foto_url;
    }

    // 2. Consulta direta ao Supabase
    const { data, error } = await supabase
      .from('moradores')
      .select('foto_url, nome')
      .eq('id', id)
      .single();

    if (error || !data?.foto_url) {
      throw new Error(`Morador selecionado (${data?.nome || id}) não possui foto oficial cadastrada no sistema.`);
    }

    return data.foto_url;
  };

  // 2 e 3. Função disparada pelo botão "Validar Acesso"
  const executarReconhecimentoFacial = async () => {
    if (analisando) return;

    if (!videoRef.current || !cameraAtiva) {
      await ativarCamera();
    }

    setAnalisando(true);
    setStatusTexto('Analisando biometria facial com IA Gemini 3.8 Flash...');
    setStatusTipo('processando');
    setResultadoBio(null);

    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        throw new Error('Aguarde o vídeo da webcam inicializar completamente.');
      }

      // Passo A: Capturar frame atual da webcam em Base64 através do Canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível inicializar o contexto 2D do Canvas.');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64CameraFrame = canvas.toDataURL('image/jpeg', 0.85);

      // Passo B: Obter a foto de cadastro oficial do morador no Supabase
      if (!moradorSelecionadoId) {
        throw new Error('Nenhum morador selecionado para comparação biométrica.');
      }
      const fotoCadastroOficial = await buscarFotoOficialMorador(moradorSelecionadoId);

      // Passo C: Chamar a API de Biometria Facial do Gemini
      const resposta: ResultadoBiometriaFacial = await compararBiometriaFacial({
        imagemCadastro: fotoCadastroOficial,
        imagemCaptura: base64CameraFrame
      });

      setResultadoBio(resposta);

      // Passo D: Regra estrita de validação (match === true E confidence_score >= 0.90)
      if (resposta.match && resposta.confidence_score >= 0.90) {
        const certezaPercent = (resposta.confidence_score * 100).toFixed(1);
        setStatusTexto(`Acesso Liberado! (${certezaPercent}% de certeza) — ${resposta.reason}`);
        setStatusTipo('sucesso');

        if (onAcessoLiberado) {
          onAcessoLiberado(resposta);
        }
      } else {
        const certezaPercent = (resposta.confidence_score * 100).toFixed(1);
        setStatusTexto(`Acesso Negado: ${resposta.reason} (Confiabilidade: ${certezaPercent}%)`);
        setStatusTipo('erro');

        if (onAcessoNegado) {
          onAcessoNegado(resposta);
        }
      }
    } catch (error: any) {
      console.error('[Biometria] Erro na validação facial:', error);
      setStatusTexto(error.message || 'Erro ao processar biometria. Tente novamente.');
      setStatusTipo('erro');
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-4 p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full mx-auto text-white ${className}`}>
      
      {/* Topo do Card de Validação */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Validação Biométrica Facial
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              IA Gemini 3.8 Flash + Tolerância Zero
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={cameraAtiva ? desativarCamera : ativarCamera}
          className="text-[11px] font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer"
          title={cameraAtiva ? 'Desligar webcam' : 'Ligar webcam'}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{cameraAtiva ? 'Desligar' : 'Ligar'}</span>
        </button>
      </div>

      {/* Seletor de Morador (caso não tenha sido fixado por prop) */}
      {moradoresDisponiveis.length > 0 && (
        <div className="w-full space-y-1">
          <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-cyan-400" />
              Cadastro Oficial para Comparação:
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">
              {moradoresDisponiveis.length} cadastrados
            </span>
          </label>
          <select
            value={moradorSelecionadoId}
            onChange={(e) => setMoradorSelecionadoId(e.target.value)}
            disabled={analisando}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
          >
            {moradoresDisponiveis.map(m => (
              <option key={m.id} value={m.id}>
                {m.nome} — {m.bloco ? `${m.bloco} - ` : ''}Apto {m.unidade || ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Frame de Vídeo da Webcam */}
      <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner group">
        <video
          id="webcam"
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Guia Visual Anatômica de Enquadramento */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
          <div className={`w-36 h-48 rounded-full border-2 border-dashed transition-all duration-300 ${
            statusTipo === 'sucesso' 
              ? 'border-emerald-400 ring-4 ring-emerald-500/30 bg-emerald-500/10' 
              : statusTipo === 'erro' 
                ? 'border-red-400 ring-4 ring-red-500/30 bg-red-500/10' 
                : statusTipo === 'processando'
                  ? 'border-cyan-400 animate-pulse'
                  : 'border-white/40'
          }`} />
        </div>

        {/* Status Flutuante sobre o Vídeo */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <span className="bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE WEBCAM
          </span>
          {moradorSelecionadoNome && (
            <span className="bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 truncate max-w-[150px]">
              Alvo: {moradorSelecionadoNome}
            </span>
          )}
        </div>
      </div>

      {/* Botão de Disparo "Validar Acesso Facial" */}
      <button 
        id="btn-verificar" 
        type="button"
        onClick={executarReconhecimentoFacial}
        disabled={analisando || !cameraAtiva}
        className={`w-full py-3.5 px-4 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed select-none ${
          statusTipo === 'sucesso'
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            : statusTipo === 'erro'
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-500/25'
        }`}
      >
        {analisando ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Processando Biometria com IA...</span>
          </>
        ) : statusTipo === 'sucesso' ? (
          <>
            <DoorOpen className="w-4 h-4 shrink-0" />
            <span>Portão Liberado (Revalidar)</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Validar Acesso Facial</span>
          </>
        )}
      </button>

      {/* Exibição Estruturada de Retorno e Status */}
      <div 
        id="status-retorno" 
        className={`w-full text-xs font-bold text-center p-3 rounded-xl border transition-all ${
          statusTipo === 'sucesso'
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
            : statusTipo === 'erro'
              ? 'bg-red-950/60 border-red-500/50 text-red-300'
              : statusTipo === 'processando'
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 animate-pulse'
                : 'bg-slate-950/80 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center justify-center gap-1.5">
          {statusTipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {statusTipo === 'erro' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {statusTipo === 'processando' && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />}
          <span>{statusTexto}</span>
        </div>

        {resultadoBio && (
          <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-mono flex items-center justify-around opacity-90">
            <span>Match: <strong>{resultadoBio.match ? 'POSITIVO' : 'NEGATIVO'}</strong></span>
            <span>Certeza: <strong>{(resultadoBio.confidence_score * 100).toFixed(1)}%</strong></span>
            <span>Exigido: <strong>&ge; 90.0%</strong></span>
          </div>
        )}
      </div>

    </div>
  );
};

export default BotaoVerificacaoFacialBiometria;
