import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, XCircle, RefreshCw, ShieldCheck, DoorOpen, User, Search, Smartphone } from 'lucide-react';
import { supabase } from '../services/supabase';
import { 
  validarAcessoFacial, 
  iniciarLeitorFacial, 
  ResultadoBiometriaFacial 
} from '../services/biometriaFacialService';

export interface BotaoVerificacaoFacialBiometriaProps {
  condominioId?: string;
  moradorId?: string;
  onAcessoLiberado?: (resultado: ResultadoBiometriaFacial, morador?: any) => void;
  onAcessoNegado?: (resultado?: ResultadoBiometriaFacial) => void;
  className?: string;
  embedded?: boolean;
}

export const BotaoVerificacaoFacialBiometria: React.FC<BotaoVerificacaoFacialBiometriaProps> = ({
  condominioId,
  moradorId: moradorIdProp,
  onAcessoLiberado,
  onAcessoNegado,
  className = '',
  embedded = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cpfOuIdentificador, setCpfOuIdentificador] = useState<string>('');
  const [analisando, setAnalisando] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [statusMensagem, setStatusMensagem] = useState<string>('Posicione o rosto no visor e toque em Validar Acesso.');
  const [statusClasse, setStatusClasse] = useState<string>('text-slate-300');
  const [statusTipo, setStatusTipo] = useState<'idle' | 'processando' | 'sucesso' | 'erro'>('idle');
  const [resultadoBio, setResultadoBio] = useState<ResultadoBiometriaFacial | null>(null);

  const [moradoresDisponiveis, setMoradoresDisponiveis] = useState<any[]>([]);
  const [filtroMoradores, setFiltroMoradores] = useState<string>('');

  // 1. Inicializa o feed de vídeo da webcam de forma suave e resiliente
  const ligarCamera = useCallback(async (modo?: 'user' | 'environment') => {
    const targetMode = modo || facingMode;
    try {
      const sucesso = await iniciarLeitorFacial('camera-preview', targetMode);
      setCameraAtiva(sucesso);
      if (sucesso) {
        setStatusMensagem('Câmera ativa. Posicione o rosto no enquadramento e valide.');
        setStatusClasse('text-slate-300');
        setStatusTipo('idle');
      } else {
        setStatusMensagem('Toque no botão "Ativar Câmera" para inicializar o leitor.');
        setStatusClasse('text-slate-400');
        setStatusTipo('idle');
      }
    } catch {
      setCameraAtiva(false);
      setStatusMensagem('Toque no botão "Ativar Câmera" para permitir o acesso.');
      setStatusClasse('text-slate-400');
      setStatusTipo('idle');
    }
  }, [facingMode]);

  const inverterCamera = useCallback(() => {
    const novoModo = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(novoModo);
    ligarCamera(novoModo);
  }, [facingMode, ligarCamera]);

  const desligarCamera = useCallback(() => {
    const video = (document.getElementById('camera-preview') || document.querySelector('video')) as HTMLVideoElement | null;
    if (video && video.srcObject && video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    setCameraAtiva(false);
    setStatusMensagem('Câmera em pausa. Toque em "Ligar Câmera" para retomar.');
    setStatusClasse('text-slate-400');
    setStatusTipo('idle');
  }, []);

  // Inicializa ao montar com pequeno delay para garantir montagem do DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      ligarCamera();
    }, 150);
    return () => {
      clearTimeout(timer);
      desligarCamera();
    };
  }, [ligarCamera, desligarCamera]);

  // Carrega lista de moradores cadastrados no Supabase para busca rápida
  useEffect(() => {
    async function carregarMoradores() {
      try {
        let query = supabase
          .from('moradores')
          .select('id, nome, bloco, unidade, cpf, rg, foto_url, status_acesso')
          .order('nome');

        if (condominioId) {
          query = query.eq('condominio_id', condominioId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          setMoradoresDisponiveis(data);
          if (moradorIdProp) {
            const m = data.find(item => item.id === moradorIdProp);
            if (m) {
              setCpfOuIdentificador(m.cpf || m.nome);
            }
          }
        }
      } catch (err) {
        console.warn('[Supabase] Falha ao listar moradores:', err);
      }
    }

    carregarMoradores();
  }, [condominioId, moradorIdProp]);

  // 2. Executa a validação facial de acordo com a arquitetura definida
  const executarValidacao = async () => {
    if (analisando) return;

    const termo = (cpfOuIdentificador || filtroMoradores).trim();
    if (!termo) {
      setStatusMensagem('Por favor, informe o CPF ou selecione o morador antes de validar.');
      setStatusClasse('text-yellow-400 font-bold');
      setStatusTipo('erro');
      return;
    }

    if (!cameraAtiva) {
      await ligarCamera();
    }

    setAnalisando(true);
    setStatusTipo('processando');
    setResultadoBio(null);

    const res = await validarAcessoFacial(
      termo,
      'camera-preview',
      (mensagem, classeCss) => {
        setStatusMensagem(mensagem);
        setStatusClasse(classeCss);
      },
      {
        condominioId,
        onSucesso: (morador, resultado) => {
          setStatusTipo('sucesso');
          setResultadoBio(resultado);
          if (onAcessoLiberado) {
            onAcessoLiberado(resultado, morador);
          }
        },
        onFalha: (_motivo, resultado) => {
          setStatusTipo('erro');
          if (resultado) setResultadoBio(resultado);
          if (onAcessoNegado) {
            onAcessoNegado(resultado);
          }
        }
      }
    );

    if (res) {
      setResultadoBio(res);
      if (res.match && res.confidence_score >= 0.95) {
        setStatusTipo('sucesso');
      } else {
        setStatusTipo('erro');
      }
    }

    setAnalisando(false);
  };

  const moradoresFiltrados = moradoresDisponiveis.filter(m => {
    if (!filtroMoradores) return true;
    const f = filtroMoradores.toLowerCase();
    return (
      (m.nome && m.nome.toLowerCase().includes(f)) ||
      (m.cpf && m.cpf.includes(f)) ||
      (m.unidade && m.unidade.toLowerCase().includes(f))
    );
  }).slice(0, 6);

  const containerClasses = embedded
    ? `w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col gap-5 text-white ${className}`
    : `min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 ${className}`;

  const innerCardClasses = embedded
    ? 'w-full flex flex-col gap-5'
    : 'w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6';

  return (
    <div className={containerClasses}>
      <div className={innerCardClasses}>
        
        {/* Cabeçalho de Alta Visibilidade */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-emerald-400 flex items-center gap-2">
                <span>PorttoHub Access</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  NÍVEL MILITAR
                </span>
              </h1>
              <p className="text-xs text-slate-400">Controle de Acesso Biométrico Facial 1:1</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={inverterCamera}
              className="text-xs font-semibold text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg bg-slate-950 border border-slate-800 transition cursor-pointer flex items-center gap-1"
              title="Inverter Câmera (Frontal / Traseira)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
            </button>

            <button
              type="button"
              onClick={cameraAtiva ? desligarCamera : () => ligarCamera()}
              className="text-xs font-semibold text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg bg-slate-950 border border-slate-800 transition cursor-pointer flex items-center gap-1"
              title={cameraAtiva ? 'Desligar Câmera' : 'Ligar Câmera'}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline text-[10px]">{cameraAtiva ? 'Desligar' : 'Ligar'}</span>
            </button>
          </div>
        </div>

        {/* Input de Identificação Prévia (CPF ou Matrícula para busca 1:1 no Supabase) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label 
              htmlFor="input-cpf"
              className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>CPF ou Matrícula do Morador</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Verificação Estrita 1:1
            </span>
          </div>

          <div className="relative">
            <input 
              type="text" 
              id="input-cpf" 
              value={cpfOuIdentificador}
              onChange={(e) => {
                setCpfOuIdentificador(e.target.value);
                setFiltroMoradores(e.target.value);
              }}
              placeholder="Digite o CPF ou selecione abaixo..." 
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 text-white font-mono text-sm placeholder:text-slate-500 transition" 
            />
            {cpfOuIdentificador && (
              <button 
                type="button"
                onClick={() => {
                  setCpfOuIdentificador('');
                  setFiltroMoradores('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sugestões Rápidas de Moradores Cadastrados com Foto */}
          {moradoresDisponiveis.length > 0 && !cpfOuIdentificador && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-400 uppercase font-mono flex items-center gap-1">
                <Search className="w-3 h-3 text-slate-400" />
                Cadastros disponíveis para teste rápido:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {moradoresFiltrados.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setCpfOuIdentificador(m.cpf || m.nome);
                      setFiltroMoradores('');
                    }}
                    className="text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/50 rounded-lg px-2.5 py-1 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="font-semibold truncate max-w-[120px]">{m.nome}</span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {m.cpf ? `(${m.cpf.slice(0, 3)}...)` : `Apto ${m.unidade || ''}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feed da Câmera do Celular / Leitor de Acesso com Guia Anatômica Oval */}
        <div className="relative w-full h-72 sm:h-80 bg-black rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner group">
          <video 
            id="camera-preview"
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />

          {/* Overlay quando Câmera não estiver ativa */}
          {!cameraAtiva && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center z-10 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Sensor da Câmera Pronto</p>
                <p className="text-xs text-slate-400 mt-0.5">Toque abaixo para ativar a imagem em tempo real</p>
              </div>
              <button
                type="button"
                onClick={() => ligarCamera()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider py-2.5 px-5 rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Ativar Câmera</span>
              </button>
            </div>
          )}

          {/* Guia Visual Oval Centralizada */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
            <div className={`w-44 sm:w-48 h-60 sm:h-64 border-2 border-dashed rounded-full transition-all duration-300 ${
              statusTipo === 'sucesso' 
                ? 'border-emerald-400 ring-4 ring-emerald-500/30 bg-emerald-500/10' 
                : statusTipo === 'erro' 
                  ? 'border-red-400 ring-4 ring-red-500/30 bg-red-500/10' 
                  : statusTipo === 'processando'
                    ? 'border-cyan-400 animate-pulse'
                    : 'border-emerald-400/70'
            }`} />
          </div>

          {/* Badge Flutuante de Status da Câmera */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
            <span className={`text-[10px] font-mono px-2.5 py-1 rounded-md border flex items-center gap-1.5 backdrop-blur-xs ${
              cameraAtiva 
                ? 'bg-slate-950/80 text-emerald-400 border-emerald-500/30' 
                : 'bg-slate-950/80 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cameraAtiva ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              {cameraAtiva ? 'LEITOR ATIVO' : 'SENSOR EM ESPERA'}
            </span>
            <span className="bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono text-slate-300 px-2.5 py-1 rounded-md border border-slate-700">
              Score Exigido: &ge; 95%
            </span>
          </div>
        </div>

        {/* Botão de Ação Instantânea: Validar Acesso Facial */}
        <button 
          id="btn-verificar"
          type="button"
          onClick={executarValidacao}
          disabled={analisando}
          className={`w-full py-4 font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-base uppercase tracking-wider cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed select-none ${
            statusTipo === 'sucesso'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : statusTipo === 'erro'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
          }`}
        >
          {analisando ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
              <span>Validando Biometria com IA...</span>
            </>
          ) : statusTipo === 'sucesso' ? (
            <>
              <DoorOpen className="w-5 h-5 shrink-0" />
              <span>Portão Liberado (Revalidar)</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>Validar Acesso Facial</span>
            </>
          )}
        </button>

        {/* Display de Status Dinâmico */}
        <div 
          id="status-display" 
          className={`text-center text-sm font-medium min-h-[2.75rem] flex flex-col items-center justify-center bg-slate-950/80 rounded-xl p-3 border border-slate-800 transition-all ${statusClasse}`}
        >
          <div className="flex items-center justify-center gap-2">
            {statusTipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {statusTipo === 'erro' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
            {statusTipo === 'processando' && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
            <span>{statusMensagem}</span>
          </div>

          {resultadoBio && (
            <div className="mt-2 pt-2 border-t border-white/10 w-full text-[11px] font-mono flex items-center justify-around opacity-90 text-slate-300">
              <span>Match: <strong className={resultadoBio.match ? 'text-emerald-400' : 'text-red-400'}>{resultadoBio.match ? 'POSITIVO' : 'NEGATIVO'}</strong></span>
              <span>Certeza: <strong className="text-cyan-400">{(resultadoBio.confidence_score * 100).toFixed(1)}%</strong></span>
              <span>Corte: <strong className="text-amber-400">&ge; 95.0%</strong></span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BotaoVerificacaoFacialBiometria;
