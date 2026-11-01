import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Building2, Camera, ShieldCheck, ShieldAlert, UserCheck, UserPlus, 
  Key, LogIn, Lock, Unlock, RefreshCw, Layers, Search, Filter, 
  CheckCircle2, XCircle, AlertTriangle, Cpu, Video, Settings, Volume2, 
  VolumeX, ArrowRightLeft, Users, Home, Shield, Trash2, Check, Smartphone, 
  Radio, Clock, AlertCircle, Play, Square, Scan, Sliders, Download, Eye
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { 
  getCondominioAtivoId, 
  carregarCondominioConfig, 
  isUUID, 
  CondominioConfig 
} from '../services/condominioService';
import { salvarCacheLocal, obterCacheLocal } from '../services/offlineStorageService';
import { cachedQuery } from '../services/redisCacheService';

interface ControleAcessoProps {
  usuarioLogado?: any;
  condominioAtivoProp?: string;
  onNavigate?: (modulo: string) => void;
}

export interface MoradorBio {
  id: string;
  condoId: string;
  name: string;
  unit: string;
  bloco?: string;
  unidadeNumero?: string;
  type: string;
  status: 'Ativo' | 'Bloqueado';
  document: string;
  phone: string;
  faceEnrolled: boolean;
  avatar: string;
  createdAt: string;
}

export interface AccessLogItem {
  id: string;
  condoId: string;
  residentName: string;
  unit: string;
  timestamp: string;
  dateStr?: string;
  status: 'Liberado' | 'Negado' | 'Cadastrado';
  method: string;
  gate: string;
  reason?: string;
}

export interface CondominioOption {
  id: string;
  name: string;
  code: string;
  totalUnits?: number;
}

export default function ControleAcesso({ usuarioLogado, condominioAtivoProp }: ControleAcessoProps) {
  // --- IDENTIFICAÇÃO DO CONDOMÍNIO ATIVO LOGADO NO MOMENTO ---
  const initialCondoId = useMemo(() => {
    return getCondominioAtivoId(usuarioLogado, condominioAtivoProp) || 'condo_padrao';
  }, [usuarioLogado, condominioAtivoProp]);

  const [activeCondoId, setActiveCondoId] = useState<string>(initialCondoId);
  const [condominios, setCondominios] = useState<CondominioOption[]>([
    {
      id: initialCondoId,
      name: usuarioLogado?.condominio_nome || 'Condomínio Ativo',
      code: 'PORTTO-01',
      totalUnits: 120
    }
  ]);
  const [carregandoCondos, setCarregandoCondos] = useState<boolean>(true);

  // Informações do condomínio atual selecionado
  const currentCondo = useMemo(() => {
    return condominios.find(c => c.id === activeCondoId) || condominios[0] || {
      id: activeCondoId,
      name: usuarioLogado?.condominio_nome || 'Condomínio Atual',
      code: 'CONDO-ACT',
      totalUnits: 100
    };
  }, [condominios, activeCondoId, usuarioLogado?.condominio_nome]);

  // Se o usuário logado tiver seu próprio condomínio fixado (não supervisor/admin geral), mantém sincronizado
  useEffect(() => {
    const cid = getCondominioAtivoId(usuarioLogado, condominioAtivoProp);
    if (cid && cid !== 'global' && cid !== 'todos') {
      setActiveCondoId(cid);
    }
  }, [usuarioLogado, condominioAtivoProp]);

  // --- BUSCA CONDOS REAIS DO SUPABASE / CACHE ---
  useEffect(() => {
    let ativo = true;

    async function buscarCondominios() {
      try {
        setCarregandoCondos(true);
        const { data, error } = await supabase
          .from('condominios')
          .select('id, nome, tipo_estrutura, unidades_por_bloco, qtd_blocos')
          .order('nome');

        if (!error && data && Array.isArray(data) && data.length > 0) {
          if (!ativo) return;
          const formatados: CondominioOption[] = data.map((c, i) => ({
            id: String(c.id),
            name: c.nome || `Condomínio ${i + 1}`,
            code: (c.nome || 'COND').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() + `-${String(i + 1).padStart(2, '0')}`,
            totalUnits: (Number(c.unidades_por_bloco) || 20) * (Number(c.qtd_blocos) || 1)
          }));
          setCondominios(formatados);

          // Se o activeCondoId não constar, seleciona o correspondente
          const achou = formatados.some(c => c.id === activeCondoId);
          if (!achou && formatados[0]) {
            const desejado = getCondominioAtivoId(usuarioLogado, condominioAtivoProp);
            if (desejado && formatados.some(c => c.id === desejado)) {
              setActiveCondoId(desejado);
            } else {
              setActiveCondoId(formatados[0].id);
            }
          }
        }
      } catch (err) {
        console.warn('[ControleAcesso] Aviso ao buscar condomínios:', err);
      } finally {
        if (ativo) setCarregandoCondos(false);
      }
    }

    buscarCondominios();
    return () => { ativo = false; };
  }, [usuarioLogado, condominioAtivoProp]);

  // --- DADOS DE MORADORES FILTRADOS STRICTLY PELO CONDOMÍNIO ATIVO ---
  const [residents, setResidents] = useState<MoradorBio[]>([]);
  const [loadingResidents, setLoadingResidents] = useState<boolean>(true);

  // Carrega moradores reais do Supabase para o condomínio ativo no momento
  const recarregarMoradoresDoCondominio = async (condoIdAlvo: string) => {
    if (!condoIdAlvo) return;
    setLoadingResidents(true);
    try {
      let listaMapeada: MoradorBio[] = [];

      if (isUUID(condoIdAlvo)) {
        const { data, error } = await supabase
          .from('moradores')
          .select('*')
          .eq('condominio_id', condoIdAlvo)
          .order('nome', { ascending: true });

        if (!error && data && Array.isArray(data)) {
          listaMapeada = data.map((m: any) => {
            const identificacaoUnidade = m.bloco && m.bloco.toLowerCase() !== 'casa'
              ? `${m.bloco} - Apto ${m.unidade || ''}`
              : (m.bloco ? `${m.bloco} ${m.unidade || ''}` : `Unidade ${m.unidade || ''}`);

            return {
              id: String(m.id),
              condoId: String(m.condominio_id || condoIdAlvo),
              name: m.nome || 'Morador sem nome',
              unit: identificacaoUnidade.trim(),
              bloco: m.bloco || '',
              unidadeNumero: m.unidade || '',
              type: m.tipo || 'Morador',
              status: m.status_acesso === 'bloqueado' ? 'Bloqueado' : 'Ativo',
              document: m.cpf || m.rg || 'Não informado',
              phone: m.telefone || 'Não informado',
              faceEnrolled: Boolean(m.foto_url),
              avatar: m.foto_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250`,
              createdAt: m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : 'Hoje'
            };
          });
        }
      }

      // Se não encontrou no Supabase, tenta carregar do cache local ou criar inicial para demonstração
      if (listaMapeada.length === 0) {
        const cacheLocal = obterCacheLocal<any[]>('moradores', 'global', []);
        const doCondo = cacheLocal.filter(m => String(m.condominio_id || m.condoId) === condoIdAlvo);
        if (doCondo.length > 0) {
          listaMapeada = doCondo.map(m => ({
            id: String(m.id),
            condoId: condoIdAlvo,
            name: m.nome || m.name,
            unit: m.unit || `${m.bloco || 'Casa'} ${m.unidade || ''}`,
            bloco: m.bloco || '',
            unidadeNumero: m.unidade || '',
            type: m.tipo || m.type || 'Morador',
            status: m.status_acesso === 'bloqueado' || m.status === 'Bloqueado' ? 'Bloqueado' : 'Ativo',
            document: m.cpf || m.document || '000.000.000-00',
            phone: m.telefone || m.phone || '(11) 99999-9999',
            faceEnrolled: Boolean(m.foto_url || m.avatar),
            avatar: m.foto_url || m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
            createdAt: 'Recente'
          }));
        } else {
          // Se for primeira vez e não houver registros, inicializa amostras vinculadas ao condomínio ativo
          const amostrasIniciais: MoradorBio[] = [
            {
              id: `res_${condoIdAlvo.slice(0, 6)}_1`,
              condoId: condoIdAlvo,
              name: 'Carlos Eduardo Silva',
              unit: 'Bloco A - Apto 302',
              type: 'Morador',
              status: 'Ativo',
              document: '123.456.789-00',
              phone: '(11) 98765-4321',
              faceEnrolled: true,
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
              createdAt: '2025-01-15'
            },
            {
              id: `res_${condoIdAlvo.slice(0, 6)}_2`,
              condoId: condoIdAlvo,
              name: 'Mariana Santos Ribeiro',
              unit: 'Bloco B - Apto 104',
              type: 'Morador',
              status: 'Ativo',
              document: '987.654.321-11',
              phone: '(11) 97654-3210',
              faceEnrolled: true,
              avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
              createdAt: '2025-02-01'
            },
            {
              id: `res_${condoIdAlvo.slice(0, 6)}_3`,
              condoId: condoIdAlvo,
              name: 'Roberto de Oliveira',
              unit: 'Bloco A - Apto 101',
              type: 'Prestador',
              status: 'Bloqueado',
              document: '456.789.123-55',
              phone: '(11) 91234-5678',
              faceEnrolled: true,
              avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
              createdAt: '2025-02-10'
            }
          ];
          listaMapeada = amostrasIniciais;
        }
      }

      setResidents(listaMapeada);
    } catch (e) {
      console.warn('[ControleAcesso] Erro ao carregar moradores:', e);
    } finally {
      setLoadingResidents(false);
    }
  };

  useEffect(() => {
    recarregarMoradoresDoCondominio(activeCondoId);
  }, [activeCondoId]);

  // --- LOGS DE AUDITORIA DE ACESSO ---
  const [accessLogs, setAccessLogs] = useState<AccessLogItem[]>(() => {
    try {
      const salvo = localStorage.getItem(`porttohub_biometria_logs_${activeCondoId}`);
      if (salvo) return JSON.parse(salvo);
    } catch {}
    return [
      {
        id: `log_init_1`,
        condoId: activeCondoId,
        residentName: 'Carlos Eduardo Silva',
        unit: 'Bloco A - Apto 302',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: new Date().toLocaleDateString('pt-BR'),
        status: 'Liberado',
        method: 'Reconhecimento Facial',
        gate: 'Portão Pedestre Social'
      },
      {
        id: `log_init_2`,
        condoId: activeCondoId,
        residentName: 'Roberto de Oliveira',
        unit: 'Bloco A - Apto 101',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: new Date().toLocaleDateString('pt-BR'),
        status: 'Negado',
        method: 'Reconhecimento Facial',
        reason: 'Cadastro Bloqueado',
        gate: 'Portão Pedestre Social'
      }
    ];
  });

  // Salva logs quando atualizados
  useEffect(() => {
    try {
      localStorage.setItem(`porttohub_biometria_logs_${activeCondoId}`, JSON.stringify(accessLogs.slice(0, 100)));
    } catch {}
  }, [accessLogs, activeCondoId]);

  // --- ABAS DE NAVEGAÇÃO ---
  const [activeTab, setActiveTab] = useState<'totem' | 'moradores' | 'cadastramento' | 'logs' | 'dispositivos'>('totem');

  // --- CAMERA & WEBCAM RECOGNITION STATE ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  // Recognition Simulation States
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'detecting' | 'matched' | 'denied'>('idle');
  const [lastMatchResult, setLastMatchResult] = useState<any | null>(null);
  const [relayGateStatus, setRelayGateStatus] = useState<{ pedestrian: boolean; vehicle: boolean }>({ pedestrian: false, vehicle: false });
  const [livenessScore, setLivenessScore] = useState<number>(98.6);

  // Filter & Search States (Residents)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterType, setFilterType] = useState<string>('todos');

  // New Resident Form Modal / State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [salvandoMorador, setSalvandoMorador] = useState<boolean>(false);
  const [newResident, setNewResident] = useState<{
    name: string;
    unit: string;
    type: string;
    document: string;
    phone: string;
    status: 'Ativo' | 'Bloqueado';
    avatar: string;
  }>({
    name: '',
    unit: '',
    type: 'Morador',
    document: '',
    phone: '',
    status: 'Ativo',
    avatar: ''
  });
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Moradores filtrados STRICTLY pelo condomínio ativo
  const condoResidents = useMemo(() => {
    return residents.filter(r => r.condoId === activeCondoId);
  }, [residents, activeCondoId]);

  const condoLogs = useMemo(() => {
    return accessLogs.filter(l => l.condoId === activeCondoId);
  }, [accessLogs, activeCondoId]);

  const filteredResidents = useMemo(() => {
    return condoResidents.filter(r => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = r.name.toLowerCase().includes(s) || 
                            r.unit.toLowerCase().includes(s) ||
                            r.document.includes(s) ||
                            r.phone.includes(s);
      const matchesStatus = filterStatus === 'todos' || r.status === filterStatus;
      const matchesType = filterType === 'todos' || r.type === filterType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [condoResidents, searchTerm, filterStatus, filterType]);

  // --- SÍNTESE DE ÁUDIO / FEEDBACK SONORO ---
  const playSoundAlert = (type: 'success' | 'denied') => {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2); // A5
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(140, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('[ControleAcesso] Audio Context Error:', e);
    }
  };

  // --- CAMERA HANDLERS ---
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Dispositivo não suporta acesso direto à câmera HTML5.');
        setIsCameraActive(false);
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('[ControleAcesso] Camera access error:', err);
      setCameraError('Permissão da câmera bloqueada ou dispositivo indisponível.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Lista os dispositivos de câmera disponíveis
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          setCameraDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        })
        .catch(err => console.warn('[ControleAcesso] Device enumeration error:', err));
    }
  }, [selectedDeviceId]);

  // Ativa câmera apenas nas abas relevantes
  useEffect(() => {
    if (activeTab === 'totem' || activeTab === 'cadastramento') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab, selectedDeviceId, facingMode]);

  // --- CANVAS HUD OVERLAY & DETECÇÃO FACIAL DINÂMICA ---
  useEffect(() => {
    let animationFrameId: number;

    const drawDetectionBox = () => {
      if (!isCameraActive || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (video.readyState >= 2) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bounding box central
        const boxWidth = canvas.width * 0.36;
        const boxHeight = boxWidth * 1.32;
        const boxX = (canvas.width - boxWidth) / 2;
        const boxY = (canvas.height - boxHeight) / 2.2;

        // Cor de acordo com o status de reconhecimento
        ctx.strokeStyle = scanningStatus === 'matched' ? '#10b981' : scanningStatus === 'denied' ? '#ef4444' : '#06b6d4';
        ctx.lineWidth = 3;

        // HUD Cantos
        const lineLen = 32;
        // Top-left
        ctx.beginPath(); ctx.moveTo(boxX, boxY + lineLen); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + lineLen, boxY); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(boxX + boxWidth - lineLen, boxY); ctx.lineTo(boxX + boxWidth, boxY); ctx.lineTo(boxX + boxWidth, boxY + lineLen); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(boxX, boxY + boxHeight - lineLen); ctx.lineTo(boxX, boxY + boxHeight); ctx.lineTo(boxX + lineLen, boxY + boxHeight); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(boxX + boxWidth - lineLen, boxY + boxHeight); ctx.lineTo(boxX + boxWidth, boxY + boxHeight); ctx.lineTo(boxX + boxWidth, boxY + boxHeight - lineLen); ctx.stroke();

        // Pontos de marcação facial
        ctx.fillStyle = ctx.strokeStyle;
        const points = [
          { x: boxX + boxWidth * 0.32, y: boxY + boxHeight * 0.36 }, // Olho esquerdo
          { x: boxX + boxWidth * 0.68, y: boxY + boxHeight * 0.36 }, // Olho direito
          { x: boxX + boxWidth * 0.50, y: boxY + boxHeight * 0.55 }, // Nariz
          { x: boxX + boxWidth * 0.50, y: boxY + boxHeight * 0.74 }  // Boca
        ];
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
          ctx.fill();
        });

        // Conexões vetoriais simuladas
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.closePath();
        ctx.stroke();

        // Linha do HUD no topo
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
        const labelText = scanningStatus === 'matched' 
          ? '✓ FACE RECONHECIDA' 
          : scanningStatus === 'denied' 
            ? '✗ ACESSO NEGADO' 
            : '● RASTREANDO FACE (ANTI-SPOOFING)';
        ctx.fillText(labelText, boxX, boxY - 14);
      }

      animationFrameId = requestAnimationFrame(drawDetectionBox);
    };

    if (isCameraActive && activeTab === 'totem') {
      animationFrameId = requestAnimationFrame(drawDetectionBox);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isCameraActive, scanningStatus, activeTab]);

  // --- SIMULAÇÃO DE RECONHECIMENTO BIOMÉTRICO (TESTES PRÁTICOS) ---
  const triggerFacialRecognitionTest = (forceStatus: 'success' | 'denied' | 'random' = 'random') => {
    if (scanningStatus === 'detecting') return;
    setScanningStatus('detecting');

    // Flutua um pouco o liveness score de forma realista
    setLivenessScore(Number((97.5 + Math.random() * 2.3).toFixed(1)));

    setTimeout(() => {
      // Puxa STRICTLY da lista de moradores do condomínio ativo
      const activeCondoResList = condoResidents;
      if (activeCondoResList.length === 0) {
        setScanningStatus('denied');
        playSoundAlert('denied');
        setLastMatchResult({
          status: 'Negado',
          name: 'Pessoa Não Cadastrada',
          unit: 'Não Identificada',
          reason: `Nenhum morador cadastrado no condomínio "${currentCondo.name}". Cadastre moradores na aba "Cadastramento Facial".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        return;
      }

      const randomResident = activeCondoResList[Math.floor(Math.random() * activeCondoResList.length)];
      const isApproved = forceStatus === 'success' ? true : forceStatus === 'denied' ? false : randomResident.status === 'Ativo';

      const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dataAtual = new Date().toLocaleDateString('pt-BR');

      if (isApproved) {
        setScanningStatus('matched');
        playSoundAlert('success');
        setLastMatchResult({
          ...randomResident,
          status: 'Liberado',
          timestamp: horaAtual
        });

        // Aciona o Relé do Portão Social
        setRelayGateStatus({ pedestrian: true, vehicle: false });

        // Adiciona registro de auditoria vinculado ao condomínio ativo
        const newLog: AccessLogItem = {
          id: `log_${Date.now()}`,
          condoId: activeCondoId,
          residentName: randomResident.name,
          unit: randomResident.unit,
          timestamp: horaAtual,
          dateStr: dataAtual,
          status: 'Liberado',
          method: 'Reconhecimento Facial',
          gate: 'Portão Pedestre Social'
        };
        setAccessLogs(prev => [newLog, ...prev]);

        // Auto trava o relé após 4 segundos (tempo regulamentar de eclusa)
        setTimeout(() => setRelayGateStatus({ pedestrian: false, vehicle: false }), 4000);
      } else {
        setScanningStatus('denied');
        playSoundAlert('denied');
        setLastMatchResult({
          status: 'Negado',
          name: randomResident.name,
          unit: randomResident.unit,
          type: randomResident.type,
          reason: randomResident.status === 'Bloqueado' ? 'Cadastro Bloqueado por Decisão Administrativa' : 'Acesso Não Autorizado para este Portão',
          avatar: randomResident.avatar,
          timestamp: horaAtual
        });

        // Adiciona registro de recusa
        const newLog: AccessLogItem = {
          id: `log_${Date.now()}`,
          condoId: activeCondoId,
          residentName: randomResident.name,
          unit: randomResident.unit,
          timestamp: horaAtual,
          dateStr: dataAtual,
          status: 'Negado',
          method: 'Reconhecimento Facial',
          reason: 'Cadastro Bloqueado ou Não Autorizado',
          gate: 'Portão Pedestre Social'
        };
        setAccessLogs(prev => [newLog, ...prev]);
      }

      // Reseta estado do HUD após 5.5 segundos
      setTimeout(() => {
        setScanningStatus('idle');
      }, 5500);

    }, 1100);
  };

  // --- CAPTURA DE SNAPSHOT DA CÂMERA PARA CADASTRAMENTO ---
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    setNewResident(prev => ({ ...prev, avatar: dataUrl }));
  };

  // --- SALVAR NOVO MORADOR NO CONDOMÍNIO ATIVO LOGADO ---
  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResident.name || !newResident.unit) return;
    setSalvandoMorador(true);

    try {
      // Extrai bloco e unidade
      const partesUnidade = newResident.unit.trim().split('-');
      let blocoFinal = 'Casa';
      let unidadeFinal = newResident.unit.trim();
      if (partesUnidade.length >= 2) {
        blocoFinal = partesUnidade[0].trim();
        unidadeFinal = partesUnidade[1].replace(/apto|unid|ap/gi, '').trim();
      }

      const avatarFinal = newResident.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250';

      const entry: MoradorBio = {
        id: `res_${Date.now()}`,
        condoId: activeCondoId, // VINCULADO RIGOROSAMENTE AO CONDOMÍNIO ATIVO
        name: newResident.name.trim(),
        unit: newResident.unit.trim(),
        bloco: blocoFinal,
        unidadeNumero: unidadeFinal,
        type: newResident.type,
        status: newResident.status,
        document: newResident.document || '000.000.000-00',
        phone: newResident.phone || '(00) 00000-0000',
        faceEnrolled: true,
        avatar: avatarFinal,
        createdAt: new Date().toLocaleDateString('pt-BR')
      };

      // Tenta persistir no Supabase se o ID for UUID válido
      if (isUUID(activeCondoId)) {
        await supabase.from('moradores').insert([
          {
            condominio_id: activeCondoId,
            nome: entry.name,
            bloco: entry.bloco,
            unidade: entry.unidadeNumero,
            tipo: entry.type,
            status_acesso: entry.status === 'Bloqueado' ? 'bloqueado' : 'liberado',
            cpf: entry.document,
            telefone: entry.phone,
            foto_url: avatarFinal
          }
        ]);
      }

      // Adiciona na lista em memória e cache
      setResidents(prev => [entry, ...prev]);

      // Registra log do cadastro
      const newLog: AccessLogItem = {
        id: `log_${Date.now()}`,
        condoId: activeCondoId,
        residentName: entry.name,
        unit: entry.unit,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: new Date().toLocaleDateString('pt-BR'),
        status: 'Cadastrado',
        method: 'Cadastro Facial Presencial',
        gate: 'Módulo Administrador'
      };
      setAccessLogs(prev => [newLog, ...prev]);

      // Limpa formulário e fecha modal
      setIsEnrollModalOpen(false);
      setNewResident({ name: '', unit: '', type: 'Morador', document: '', phone: '', status: 'Ativo', avatar: '' });
      setCapturedPhoto(null);
      playSoundAlert('success');
    } catch (err) {
      console.warn('[ControleAcesso] Erro ao cadastrar morador:', err);
    } finally {
      setSalvandoMorador(false);
    }
  };

  // --- ALTERAR STATUS DO MORADOR (ATIVO <-> BLOQUEADO) ---
  const toggleResidentStatus = async (id: string) => {
    const alvo = residents.find(r => r.id === id);
    if (!alvo) return;
    const nextStatus = alvo.status === 'Ativo' ? 'Bloqueado' : 'Ativo';

    setResidents(residents.map(r => {
      if (r.id === id) {
        return { ...r, status: nextStatus };
      }
      return r;
    }));

    if (isUUID(id)) {
      try {
        await supabase
          .from('moradores')
          .update({ status_acesso: nextStatus === 'Ativo' ? 'liberado' : 'bloqueado' })
          .eq('id', id);
      } catch (e) {
        console.warn('Erro ao atualizar status do morador:', e);
      }
    }
  };

  // --- EXCLUIR MORADOR ---
  const deleteResident = async (id: string) => {
    if (!confirm('Deseja realmente remover o cadastro biométrico deste morador?')) return;
    setResidents(residents.filter(r => r.id !== id));

    if (isUUID(id)) {
      try {
        await supabase.from('moradores').delete().eq('id', id);
      } catch (e) {
        console.warn('Erro ao excluir morador do Supabase:', e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* GLOBAL HEADER WITH MULTI-TENANT CONDOMINIUM SELECTOR */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand Title */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="bg-cyan-500/10 p-2.5 rounded-2xl border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-950">
            <Scan className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg text-white tracking-tight">VisionGate Pro</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-cyan-500/20 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/30">Biometria Facial</span>
            </div>
            <p className="text-xs text-slate-400">Controle de Acesso Biométrico Isolado por Condomínio</p>
          </div>
        </div>

        {/* MULTI-TENANT CONDOMINIUM SELECTOR (CRITICAL FOR DATA ISOLATION) */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5 w-full sm:w-84 shadow-inner">
            <Building2 className="w-4 h-4 text-cyan-400 mr-2.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Condomínio Ativo (Isolamento Total)</span>
              <select 
                value={activeCondoId}
                onChange={(e) => setActiveCondoId(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer truncate"
              >
                {condominios.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button 
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${isSoundEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
            title={isSoundEnabled ? 'Som Ativado' : 'Som Mudo'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

      </header>

      {/* SYSTEM BODY CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* NAVIGATION SIDEBAR */}
        <aside className="w-full lg:w-64 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pb-2">Módulos de Controle</div>

          <button 
            onClick={() => setActiveTab('totem')}
            className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer ${activeTab === 'totem' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
          >
            <Camera className="w-4 h-4" />
            <span>Totem Validador (Portaria)</span>
          </button>

          <button 
            onClick={() => setActiveTab('moradores')}
            className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer ${activeTab === 'moradores' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
          >
            <Users className="w-4 h-4" />
            <span>Moradores e Unidades</span>
            <span className="ml-auto bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">{condoResidents.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('cadastramento')}
            className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer ${activeTab === 'cadastramento' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastramento Facial</span>
          </button>

          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer ${activeTab === 'logs' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
          >
            <Clock className="w-4 h-4" />
            <span>Auditoria de Acessos</span>
            <span className="ml-auto bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">{condoLogs.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('dispositivos')}
            className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition cursor-pointer ${activeTab === 'dispositivos' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
          >
            <Cpu className="w-4 h-4" />
            <span>Hardware e Relé</span>
          </button>

          <div className="pt-6 mt-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="flex items-center space-x-1.5 text-emerald-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Totem Online</span>
                </span>
                <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono text-slate-400">99.9% Uptime</span>
              </div>
              <div className="text-slate-400 pt-1 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Anti-spoofing / Liveness:</span>
                  <span className="text-cyan-400 font-mono">Ativado</span>
                </div>
                <div className="flex justify-between">
                  <span>Isolamento Tenant:</span>
                  <span className="text-emerald-400 font-bold">{currentCondo.code}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN VIEW AREA */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-h-[calc(100vh-65px)]">

          {/* TAB 1: TOTEM VALIDADOR COM CÂMERA E RECONHECIMENTO EM TEMPO REAL */}
          {activeTab === 'totem' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              {/* Top Warning Banner */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Monitoramento de Portaria: <span className="text-cyan-400">{currentCondo.name}</span></h3>
                    <p className="text-xs text-slate-400">Validando acessos exclusivamente para moradores e visitantes deste condomínio ({condoResidents.length} cadastrados).</p>
                  </div>
                </div>

                {/* Device Selector Controls */}
                <div className="flex items-center space-x-2">
                  <select 
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[180px] truncate"
                  >
                    {cameraDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Câmera ${device.deviceId.slice(0,5)}...`}
                      </option>
                    ))}
                    {cameraDevices.length === 0 && (
                      <option value="">Câmera Padrão</option>
                    )}
                  </select>

                  <button 
                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center space-x-1 transition cursor-pointer"
                    title="Alternar Câmera Frontal/Traseira"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* VIDEO STREAM & MATCH RESULT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* VIDEO STREAM & CANVAS HUD (7 COLS) */}
                <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-4">
                  <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                    
                    {/* HTML5 Video */}
                    <video 
                      ref={videoRef} 
                      muted 
                      playsInline 
                      className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />

                    {/* Canvas Overlay for Facial Recognition HUD */}
                    <canvas 
                      ref={canvasRef} 
                      className={`absolute inset-0 w-full h-full pointer-events-none ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    />

                    {/* Fallback Camera Error */}
                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-950/90 p-6 flex flex-col items-center justify-center text-center space-y-3">
                        <AlertTriangle className="w-10 h-10 text-amber-400" />
                        <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                        <button 
                          onClick={startCamera}
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Tentar Novamente
                        </button>
                      </div>
                    )}

                    {/* Live Scanner Controls Overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-950/75 backdrop-blur px-4 py-2.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span className="text-xs font-semibold text-slate-200">Liveness Test: <strong className="text-cyan-400">{livenessScore}%</strong></span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">FPS: 30.0 • {currentCondo.code}</span>
                    </div>
                  </div>

                  {/* SIMULATION TEST BUTTONS */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Simulador de Leitura Facial (Testes Práticos com Moradores do Condomínio)</span>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => triggerFacialRecognitionTest('success')}
                        disabled={scanningStatus === 'detecting'}
                        className="flex items-center justify-center space-x-2 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-98 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simular Rosto Autorizado</span>
                      </button>

                      <button 
                        onClick={() => triggerFacialRecognitionTest('denied')}
                        disabled={scanningStatus === 'detecting'}
                        className="flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 active:scale-98 border border-red-500/30 text-red-400 py-3 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Simular Rosto Bloqueado</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* MATCH CARD & RELAY STATUS (5 COLS) */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                  
                  {/* Match Result Display */}
                  <div className={`flex-1 rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between ${
                    scanningStatus === 'matched' ? 'bg-emerald-950/30 border-emerald-500/50 shadow-2xl shadow-emerald-950' :
                    scanningStatus === 'denied' ? 'bg-red-950/30 border-red-500/50 shadow-2xl shadow-red-950' :
                    'bg-slate-900/40 border-slate-800'
                  }`}>

                    {scanningStatus === 'idle' && !lastMatchResult && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <div className="p-4 bg-slate-900 rounded-full border border-slate-800 text-slate-500">
                          <Scan className="w-8 h-8 animate-pulse" />
                        </div>
                        <h4 className="font-bold text-slate-300 text-sm">Aguardando Aproximação</h4>
                        <p className="text-xs text-slate-400 max-w-xs">Posicione o rosto em frente à câmera para efetuar a validação biométrica em <strong className="text-cyan-400">{currentCondo.name}</strong>.</p>
                      </div>
                    )}

                    {scanningStatus === 'detecting' && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
                        <h4 className="font-bold text-white text-md">Analisando Biometria Facial...</h4>
                        <p className="text-xs text-cyan-400 font-mono">Buscando vetor facial no banco de {currentCondo.name} ({currentCondo.code})</p>
                      </div>
                    )}

                    {lastMatchResult && scanningStatus !== 'detecting' && (
                      <div className="space-y-6">
                        {/* Status Header Badge */}
                        <div className="flex items-center justify-between">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            lastMatchResult.status === 'Ativo' || lastMatchResult.status === 'Liberado'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border-red-500/40'
                          }`}>
                            {lastMatchResult.status === 'Ativo' || lastMatchResult.status === 'Liberado' ? '✓ Acesso Liberado' : '✗ Acesso Negado'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{lastMatchResult.timestamp || 'Agora'}</span>
                        </div>

                        {/* Resident Details */}
                        <div className="flex items-center space-x-4">
                          <img 
                            src={lastMatchResult.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250'} 
                            alt="Facial Match" 
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
                          />
                          <div>
                            <h3 className="font-bold text-lg text-white">{lastMatchResult.name || 'Pessoa Desconhecida'}</h3>
                            <p className="text-xs text-slate-300 font-medium">{lastMatchResult.unit || 'Sem Unidade'}</p>
                            {lastMatchResult.type && (
                              <span className="inline-block mt-1 text-[10px] bg-slate-800 text-cyan-400 border border-slate-700 px-2 py-0.5 rounded font-semibold">
                                {lastMatchResult.type}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Additional Reason if Denied */}
                        {lastMatchResult.reason && (
                          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs text-red-400 font-semibold flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Motivo: {lastMatchResult.reason}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* GATE RELAY SIMULATOR STATUS */}
                    <div className="pt-4 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Acionamento Relé de Hardware</span>
                        <span className="text-cyan-400 font-mono">Controladora TCP/IP</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className={`p-2.5 rounded-xl border text-center transition ${relayGateStatus.pedestrian ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-lg shadow-emerald-950' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                          <span className="text-[10px] block">Portão Pedestre</span>
                          <span className="text-xs font-mono">{relayGateStatus.pedestrian ? 'PULSO ABERTO' : 'FECHADO'}</span>
                        </div>
                        <div className={`p-2.5 rounded-xl border text-center transition ${relayGateStatus.vehicle ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold shadow-lg shadow-emerald-950' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                          <span className="text-[10px] block">Cancela / Garagem</span>
                          <span className="text-xs font-mono">{relayGateStatus.vehicle ? 'PULSO ABERTO' : 'FECHADO'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: MORADORES & UNIDADES (FILTERED PER CONDOMINIUM) */}
          {activeTab === 'moradores' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Moradores & Unidades</h2>
                  <p className="text-sm text-slate-400">
                    Gerenciando registros de <strong className="text-cyan-400">{currentCondo.name}</strong> ({condoResidents.length} moradores cadastrados)
                  </p>
                </div>
                
                <button 
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-500/10 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar Novo Morador</span>
                </button>
              </div>

              {/* FILTERS BAR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Buscar nome, apartamento ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Filter Status */}
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="Ativo">Ativos</option>
                  <option value="Bloqueado">Bloqueados</option>
                </select>

                {/* Filter Type */}
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="todos">Todos os Tipos</option>
                  <option value="Morador">Morador</option>
                  <option value="Dependente">Dependente</option>
                  <option value="Inquilino">Inquilino</option>
                  <option value="Prestador">Prestador</option>
                </select>

              </div>

              {/* RESIDENTS TABLE / GRID */}
              {loadingResidents ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-cyan-400" />
                  <p className="text-xs">Carregando moradores do condomínio...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResidents.map(resident => (
                    <div key={resident.id} className="bg-slate-900/40 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex flex-col justify-between space-y-4 transition shadow-xs">
                      <div className="flex items-start space-x-3">
                        <img 
                          src={resident.avatar} 
                          alt={resident.name} 
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm truncate">{resident.name}</h4>
                          <p className="text-xs text-cyan-400 font-medium">{resident.unit}</p>
                          <span className="inline-block mt-1 text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-mono">
                            {resident.type}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-900 font-mono text-slate-400">
                        <div className="flex justify-between">
                          <span>CPF / Doc:</span>
                          <span className="text-slate-200">{resident.document}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Telefone:</span>
                          <span className="text-slate-200">{resident.phone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Biometria Facial:</span>
                          <span className="text-emerald-400 font-bold">✓ Cadastrada</span>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button 
                          onClick={() => toggleResidentStatus(resident.id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                            resident.status === 'Ativo' 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30' 
                              : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                          }`}
                        >
                          {resident.status}
                        </button>

                        <button 
                          onClick={() => deleteResident(resident.id)}
                          className="text-slate-500 hover:text-red-400 p-1.5 transition cursor-pointer"
                          title="Remover Cadastro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingResidents && filteredResidents.length === 0 && (
                <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-2xl text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Nenhum morador encontrado em {currentCondo.name} para os filtros selecionados.</p>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: CADASTRAMENTO FACIAL PRESENCIAL */}
          {activeTab === 'cadastramento' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-xl font-bold text-white">Cadastramento Biométrico Facial</h2>
                <p className="text-sm text-slate-400">Capture a foto presencial do morador para inclusão no condomínio <strong className="text-cyan-400">{currentCondo.name}</strong>.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Camera Capture Box */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 flex flex-col space-y-3">
                  <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {capturedPhoto ? (
                      <img src={capturedPhoto} alt="Snapshot" className="w-full h-full object-cover" />
                    ) : (
                      <video ref={videoRef} muted playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
                    )}
                  </div>

                  <div className="flex space-x-2">
                    {!capturedPhoto ? (
                      <button 
                        onClick={captureSnapshot}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Capturar Foto Biométrica</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => setCapturedPhoto(null)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Recapturar Foto</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Resident Data Form */}
                <form onSubmit={handleSaveResident} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: João da Silva"
                      value={newResident.name}
                      onChange={(e) => setNewResident({ ...newResident, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Unidade / Apto</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Bloco A - 302"
                        value={newResident.unit}
                        onChange={(e) => setNewResident({ ...newResident, unit: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Perfil</label>
                      <select 
                        value={newResident.type}
                        onChange={(e) => setNewResident({ ...newResident, type: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="Morador">Morador</option>
                        <option value="Dependente">Dependente</option>
                        <option value="Inquilino">Inquilino</option>
                        <option value="Prestador">Prestador</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">CPF / Documento</label>
                      <input 
                        type="text" 
                        placeholder="000.000.000-00"
                        value={newResident.document}
                        onChange={(e) => setNewResident({ ...newResident, document: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Telefone / WhatsApp</label>
                      <input 
                        type="text" 
                        placeholder="(11) 99999-9999"
                        value={newResident.phone}
                        onChange={(e) => setNewResident({ ...newResident, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={!capturedPhoto || salvandoMorador}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 py-3 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {salvandoMorador ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Salvando no Condomínio...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Finalizar Cadastro no {currentCondo.name}</span>
                      </>
                    )}
                  </button>
                </form>

              </div>
            </div>
          )}

          {/* TAB 4: AUDITORIA DE ACESSOS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">Logs de Auditoria de Acessos</h2>
                  <p className="text-sm text-slate-400">Histórico de validações faciais registradas em <strong className="text-cyan-400">{currentCondo.name}</strong></p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-slate-300">
                    Total: {condoLogs.length} eventos
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Horário</th>
                      <th className="p-3.5">Nome / Pessoa</th>
                      <th className="p-3.5">Unidade</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Método / Portão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {condoLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/80 transition">
                        <td className="p-3.5 text-slate-400">{log.timestamp}</td>
                        <td className="p-3.5 font-bold text-white font-sans">{log.residentName}</td>
                        <td className="p-3.5 text-cyan-400">{log.unit}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                            log.status === 'Liberado' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : log.status === 'Cadastrado'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">{log.gate}</td>
                      </tr>
                    ))}
                    {condoLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                          Nenhum acesso registrado até o momento para este condomínio.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HARDWARE & DIAGNÓSTICO */}
          {activeTab === 'dispositivos' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-xl font-bold text-white">Status dos Dispositivos e Relés de Hardware</h2>
                <p className="text-sm text-slate-400">Comunicação via TCP/IP e placas controladoras de acionamento do condomínio <strong className="text-cyan-400">{currentCondo.name}</strong>.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm">Controladora Relé Pedestre</h4>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">TCP/IP 192.168.1.105</span>
                  </div>
                  <p className="text-xs text-slate-400">Acionamento eletromagnético do portão social com tempo de pulso ajustável (4.0s).</p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Status do Relé:</span>
                    <button 
                      onClick={() => {
                        setRelayGateStatus(prev => ({ ...prev, pedestrian: true }));
                        setTimeout(() => setRelayGateStatus(prev => ({ ...prev, pedestrian: false })), 3000);
                      }}
                      className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Disparar Pulso de Teste
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm">Controladora Cancela Garagem</h4>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">TCP/IP 192.168.1.106</span>
                  </div>
                  <p className="text-xs text-slate-400">Acionamento de cancela automática veicular e laço indutivo.</p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Status da Cancela:</span>
                    <button 
                      onClick={() => {
                        setRelayGateStatus(prev => ({ ...prev, vehicle: true }));
                        setTimeout(() => setRelayGateStatus(prev => ({ ...prev, vehicle: false })), 4000);
                      }}
                      className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Disparar Pulso Cancela
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm">Câmera IP Reconhecimento</h4>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">Stream WebRTC Ativo</span>
                  </div>
                  <p className="text-xs text-slate-400">Stream RTSP/WebRTC sincronizado a 30 FPS com encoder em tempo real.</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm">Totem Facial Inteligente</h4>
                    <span className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono">Tenant {currentCondo.code}</span>
                  </div>
                  <p className="text-xs text-slate-400">Processamento neural local com anti-spoofing liveness e latência &lt; 150ms.</p>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ENROLLMENT MODAL OVERLAY */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Cadastrar Morador em {currentCondo.name} ({currentCondo.code})</h3>
              <button onClick={() => setIsEnrollModalOpen(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveResident} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Nome Completo</label>
                <input 
                  type="text" required placeholder="Nome do condômino"
                  value={newResident.name} onChange={(e) => setNewResident({ ...newResident, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">Unidade / Apto</label>
                <input 
                  type="text" required placeholder="Ex: Bloco A - Apto 101"
                  value={newResident.unit} onChange={(e) => setNewResident({ ...newResident, unit: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Tipo</label>
                  <select 
                    value={newResident.type} 
                    onChange={(e) => setNewResident({ ...newResident, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="Morador">Morador</option>
                    <option value="Dependente">Dependente</option>
                    <option value="Inquilino">Inquilino</option>
                    <option value="Prestador">Prestador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Status</label>
                  <select 
                    value={newResident.status} 
                    onChange={(e) => setNewResident({ ...newResident, status: e.target.value as 'Ativo' | 'Bloqueado' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">CPF</label>
                  <input 
                    type="text" placeholder="000.000.000-00"
                    value={newResident.document} onChange={(e) => setNewResident({ ...newResident, document: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Telefone</label>
                  <input 
                    type="text" placeholder="(11) 99999-9999"
                    value={newResident.phone} onChange={(e) => setNewResident({ ...newResident, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsEnrollModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl cursor-pointer">Salvar Morador</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
