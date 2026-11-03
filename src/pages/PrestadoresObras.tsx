import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import ModalLeitorDocumentoOCR from '../components/ModalLeitorDocumentoOCR';
import { registrarAtividade } from '../services/auditoriaService';
import { comprimirImagemBase64 } from '../services/imageUtils';
import { ImagemOtimizada } from '../components/ImagemOtimizada';
import { 
  carregarCondominioConfig,
  isEstruturaCasas,
  formatarIdentificacaoUnidade,
  getCondominioAtivoId
} from '../services/condominioService';
import { formatarLinkWhatsApp } from '../services/configWhatsappService';
import { verificarPermissao } from '../services/permissoesService';
import { 
  UserCheck, 
  Building2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  X, 
  Search, 
  Plus, 
  Camera, 
  Scan, 
  LogIn, 
  LogOut, 
  Phone, 
  MessageSquare, 
  RefreshCw, 
  FileText, 
  Calendar, 
  Volume2, 
  VolumeX, 
  Shield, 
  ArrowRight, 
  UserPlus, 
  Car, 
  Tag, 
  Users, 
  Timer, 
  Pencil, 
  HardHat, 
  Filter, 
  ChevronDown,
  Info,
  KeyRound,
  Check,
  ShieldCheck,
  Sparkles,
  Home,
  CreditCard,
  Settings,
  History
} from 'lucide-react';
import ModalConfigHorariosObrasMudancas from '../components/ModalConfigHorariosObrasMudancas';
import HistoricoAcessoPainelPrincipal from '../components/HistoricoAcessoPainelPrincipal';
import { invalidarCacheTabela } from '../services/redisCacheService';


export type PerfilAcesso = 'autorizado' | 'prestador_unidade' | 'prestador_condominio';
export type TipoValidade = 'hoje' | 'amanha' | '3_dias' | '7_dias' | '30_dias' | 'personalizado' | 'permanente';
export type CriterioBusca = 'CPF' | 'Nome' | 'Unidade' | 'Placa';

export const OPCOES_PARENTESCO = [
  'Mãe',
  'Pai',
  'Filho(a)',
  'Irmão(ã)',
  'Cônjuge / Namorado(a)',
  'Avô(ó)',
  'Neto(a)',
  'Tio(a) / Primo(a)',
  'Amigo(a)',
  'Entregador Eventual',
  'Diarista Frequente',
  'Outro'
];

interface PrestadoresObrasProps {
  usuarioLogado?: any;
}

export default function PrestadoresObras({ usuarioLogado }: PrestadoresObrasProps) {
  const [idCondominio, setIdCondominio] = useState(() => getCondominioAtivoId(usuarioLogado));
  const operadorNome = usuarioLogado?.nome || usuarioLogado?.login || 'Operador da Portaria';

  // Permissões do operador para este módulo
  const permissoesOperador = useMemo(() => {
    return {
      visualizar: verificarPermissao(usuarioLogado, 'autorizados', 'visualizar'),
      cadastrar: verificarPermissao(usuarioLogado, 'autorizados', 'cadastrar') || verificarPermissao(usuarioLogado, 'autorizados', 'criar'),
      darEntrada: verificarPermissao(usuarioLogado, 'autorizados', 'dar_entrada'),
      darSaida: verificarPermissao(usuarioLogado, 'autorizados', 'dar_saida'),
      editar: verificarPermissao(usuarioLogado, 'autorizados', 'editar'),
      excluir: verificarPermissao(usuarioLogado, 'autorizados', 'excluir'),
      perfil: usuarioLogado?.perfil || 'Operador'
    };
  }, [usuarioLogado]);

  // Configuração da estrutura do condomínio
  const [condoConfig, setCondoConfig] = useState<any>(null);

  useEffect(() => {
    const handleCondoChange = (e: any) => {
      const novoId = e?.detail?.id;
      if (novoId && novoId !== 'global' && novoId !== 'todos') {
        setIdCondominio(novoId);
      } else {
        setIdCondominio(getCondominioAtivoId(usuarioLogado));
      }
    };
    window.addEventListener('infport:condominio_alterado', handleCondoChange);
    return () => window.removeEventListener('infport:condominio_alterado', handleCondoChange);
  }, [usuarioLogado]);

  useEffect(() => {
    async function carregarConfigCondo() {
      if (idCondominio && idCondominio !== 'global' && idCondominio !== 'todos') {
        try {
          const cfg = await carregarCondominioConfig(idCondominio);
          setCondoConfig(cfg);
        } catch (e) {
          console.warn('Erro ao carregar configuracao do condominio:', e);
        }
      }
    }
    carregarConfigCondo();
  }, [idCondominio]);

  const eEstruturaCasas = isEstruturaCasas(condoConfig?.tipo_estrutura);

  // Abas principais
  const [abaAtiva, setAbaAtiva] = useState<'permanencia' | 'cadastros' | 'historico' | 'permissoes'>('cadastros');

  // Dados
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [prestadoresAtivos, setPrestadoresAtivos] = useState<any[]>([]);
  const [visitasHoje, setVisitasHoje] = useState<any[]>([]);
  const [historicoAcessos, setHistoricoAcessos] = useState<any[]>([]);
  const [moradores, setMoradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Filtros Avançados por Categoria de Entrada
  const [filtroCategoria, setFiltroCategoria] = useState<'todos' | 'autorizado' | 'prestador_unidade' | 'prestador_condominio'>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'dentro' | 'entradas_hoje' | 'validos' | 'vencidos'>('todos');
  const [busca, setBusca] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState<string>('todas');
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  // Estados do Menu Principal de Busca (Seleção por CPF, Nome, Unidade e Placa)
  const [criterioBusca, setCriterioBusca] = useState<CriterioBusca>('Nome');
  const [painelBuscaAberto, setPainelBuscaAberto] = useState(false);
  const containerBuscaRef = React.useRef<HTMLDivElement>(null);
  const inputBuscaGlobalRef = React.useRef<HTMLInputElement>(null);

  const criteriosBusca: { id: CriterioBusca; rotulo: string; icone: React.ComponentType<{ className?: string }>; placeholderExemplo: string }[] = [
    { id: 'CPF', rotulo: 'CPF', icone: CreditCard, placeholderExemplo: 'Digite o CPF (ex: 000.000.000-00 ou números)...' },
    { id: 'Nome', rotulo: 'Nome', icone: UserCheck, placeholderExemplo: 'Digite o nome do autorizado ou prestador...' },
    { id: 'Unidade', rotulo: 'Unidade', icone: Home, placeholderExemplo: 'Digite a unidade ou casa (ex: 142, Bloco A)...' },
    { id: 'Placa', rotulo: 'Placa', icone: Car, placeholderExemplo: 'Digite a placa do veículo (ex: ABC-1234 ou BRA2E19)...' },
  ];

  // Estados dos Fluxos de 1-Clique (Fast-Lane Portaria)
  const [tempoLimitePorPrestador, setTempoLimitePorPrestador] = useState<Record<string, number>>({});
  const [crachaPorPrestador, setCrachaPorPrestador] = useState<Record<string, string>>({});
  const [whatsappAutomatico, setWhatsappAutomatico] = useState<boolean>(true);

  // Tempo e Alerta Sonoro
  const [tempoAtual, setTempoAtual] = useState(Date.now());
  const [alertaSonoroHabilitado, setAlertaSonoroHabilitado] = useState(true);

  // Modais
  const [modalNovoCadastro, setModalNovoCadastro] = useState(false);
  const [modalEditarCadastro, setModalEditarCadastro] = useState(false);
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [fabLiberacaoAberto, setFabLiberacaoAberto] = useState(false);

  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [modalProrrogar, setModalProrrogar] = useState(false);
  const [modalOcrAberto, setModalOcrAberto] = useState(false);
  const [modalVisualizarFoto, setModalVisualizarFoto] = useState<string | null>(null);
  const [modalPermissoes, setModalPermissoes] = useState(false);
  const [modalConfigHorarios, setModalConfigHorarios] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<any | null>(null);

  useEffect(() => {
    const handleAbrir = () => setModalConfigHorarios(true);
    window.addEventListener('porttohub:abrir_config_horarios', handleAbrir);
    return () => window.removeEventListener('porttohub:abrir_config_horarios', handleAbrir);
  }, []);


  // Formulário de Cadastro / Liberação / Edição
  const [perfilAcesso, setPerfilAcesso] = useState<PerfilAcesso>('autorizado');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [documento, setDocumento] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CPF');
  const [empresa, setEmpresa] = useState('');
  const [parentescoVinculo, setParentescoVinculo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');
  const [unidade, setUnidade] = useState('');
  const [bloco, setBloco] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fotoRosto, setFotoRosto] = useState('');
  const [fotoDocumento, setFotoDocumento] = useState('');
  const [tipoValidade, setTipoValidade] = useState<TipoValidade>('hoje');
  const [dataValidadeInicio, setDataValidadeInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataValidadeFim, setDataValidadeFim] = useState(new Date().toISOString().slice(0, 10));
  const [termoReutilizacao, setTermoReutilizacao] = useState('');
  const [sugestoesReutilizacao, setSugestoesReutilizacao] = useState<any[]>([]);

  // Formulário de Entrada
  const [tempoMaximoMinutos, setTempoMaximoMinutos] = useState<number>(240);
  const [tempoMaximoCustomizado, setTempoMaximoCustomizado] = useState<string>('');
  const [crachaEntrada, setCrachaEntrada] = useState('');
  const [placaEntrada, setPlacaEntrada] = useState('');
  const [observacoesEntrada, setObservacoesEntrada] = useState('');
  const [alertaExpiracaoConfirmado, setAlertaExpiracaoConfirmado] = useState(false);

  // Formulário de Saída (Apenas Prestadores)
  const [crachaDevolvido, setCrachaDevolvido] = useState(true);
  const [observacoesSaida, setObservacoesSaida] = useState('');

  // Formulário de Prorrogação
  const [minutosProrrogacao, setMinutosProrrogacao] = useState(60);
  const [prorrogarCustomizado, setProrrogarCustomizado] = useState<string>('');

  // Atualização em tempo real do cronômetro a cada 1 segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setTempoAtual(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Beep sonoro sutil quando há prestador estourado
  const emitirAlertaSonoro = () => {
    if (!alertaSonoroHabilitado) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  // Som agradável de entrada rápida (Dois tons em harmonia E5 -> A5)
  const emitirBeepEntrada = () => {
    if (!alertaSonoroHabilitado) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);
    } catch {}
  };

  // Som de encerramento e saída rápida (Tom descendente D5 -> A4)
  const emitirBeepSaida = () => {
    if (!alertaSonoroHabilitado) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  };

  // Fecha o dropdown suspenso de busca ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerBuscaRef.current && !containerBuscaRef.current.contains(e.target as Node)) {
        setPainelBuscaAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Atalho de teclado global: tecla '/' ou Ctrl+K foca instantaneamente na barra de busca e abre o painel
  useEffect(() => {
    const handleKeyShortcut = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== inputBuscaGlobalRef.current) {
        e.preventDefault();
        inputBuscaGlobalRef.current?.focus();
        inputBuscaGlobalRef.current?.select();
        setPainelBuscaAberto(true);
      } else if (e.key === 'Escape' && painelBuscaAberto) {
        setPainelBuscaAberto(false);
      }
    };
    window.addEventListener('keydown', handleKeyShortcut);
    return () => window.removeEventListener('keydown', handleKeyShortcut);
  }, [painelBuscaAberto]);

  // Carrega dados iniciais
  useEffect(() => {
    carregarTudo();
    carregarMoradores();

    const handleAbrirPermanencia = () => {
      setAbaAtiva('permanencia');
    };
    window.addEventListener('infport_abrir_permanencia_prestadores', handleAbrirPermanencia);
    return () => {
      window.removeEventListener('infport_abrir_permanencia_prestadores', handleAbrirPermanencia);
    };
  }, [idCondominio]);

  // Carrega moradores para autocompletar unidades e telefones
  const carregarMoradores = async () => {
    if (!idCondominio || idCondominio === 'global' || idCondominio === 'todos') {
      setMoradores([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('moradores')
        .select('id, nome, bloco, unidade, telefone')
        .eq('condominio_id', idCondominio)
        .order('unidade');
      if (data) setMoradores(data);
    } catch (e) {
      console.warn('Erro ao carregar moradores:', e);
    }
  };

  const carregarTudo = async () => {
    if (!idCondominio || idCondominio === 'global' || idCondominio === 'todos') {
      setCadastros([]);
      setPrestadoresAtivos([]);
      setVisitasHoje([]);
      setHistoricoAcessos([]);
      return;
    }

    setLoading(true);
    try {
      // 1. Cadastros mestres de pessoas autorizadas e prestadores
      const cadQuery = supabase
        .from('prestadores')
        .select('*')
        .eq('condominio_id', idCondominio)
        .order('created_at', { ascending: false })
        .range(0, 79);
      const { data: dadosCadastros, error: erroCad } = await cadQuery;
      if (erroCad) throw erroCad;
      setCadastros(dadosCadastros || []);

      // 2. Acessos de Prestadores com Permanência Ativa (Saída Pendente)
      // REGRA: Apenas prestadores (prestador_unidade e prestador_condominio) necessitam de controle de permanência e saída!
      let prestadoresDentro: any[] = [];
      try {
        const acessosQuery = supabase
          .from('prestadores_acessos')
          .select('*')
          .eq('condominio_id', idCondominio)
          .neq('perfil_acesso', 'autorizado')
          .is('data_hora_saida', null)
          .order('data_hora_entrada', { ascending: false })
          .range(0, 49);
        const { data: acessosDb, error: erroAcessos } = await acessosQuery;

        if (!erroAcessos && acessosDb && acessosDb.length > 0) {
          prestadoresDentro = acessosDb;
        } else {
          // Fallback para tabela prestadores onde status_acesso seja DENTRO e NÃO seja perfil 'autorizado'
          prestadoresDentro = (dadosCadastros || [])
            .filter((p: any) => 
              p.perfil_acesso !== 'autorizado' && 
              (p.status_acesso === 'EM_ANDAMENTO' || p.status_acesso === 'DENTRO')
            )
            .map((p: any) => ({
              id: p.id,
              prestador_id: p.id,
              condominio_id: p.condominio_id,
              perfil_acesso: p.perfil_acesso || (p.atende_condominio ? 'prestador_condominio' : 'prestador_unidade'),
              nome_completo: p.nome_profissional || p.nome_completo,
              documento: p.documento,
              empresa: p.empresa,
              parentesco_vinculo: p.parentesco_vinculo,
              unidade: p.unidade,
              bloco: p.bloco,
              foto_rosto: p.foto_rosto,
              cracha: p.cracha_atribuido || p.cracha,
              placa_veiculo: p.placa_veiculo,
              data_hora_entrada: p.data_hora_entrada || p.created_at,
              tempo_maximo_minutos: p.tempo_maximo_minutos || 240,
              limite_permanencia_ate: p.limite_permanencia_ate,
              operador_entrada_nome: p.operador_entrada_nome || 'Operador',
              status_acesso: 'DENTRO'
            }));
        }
      } catch {
        prestadoresDentro = (dadosCadastros || []).filter((p: any) => 
          p.perfil_acesso !== 'autorizado' && 
          (p.status_acesso === 'EM_ANDAMENTO' || p.status_acesso === 'DENTRO')
        );
      }
      setPrestadoresAtivos(prestadoresDentro);

      // 3. Entradas de Visitantes & Família Registradas Hoje (Circulação Livre)
      const dataHojeInicio = new Date();
      dataHojeInicio.setHours(0, 0, 0, 0);
      try {
        const visitasQuery = supabase
          .from('prestadores_acessos')
          .select('*')
          .eq('condominio_id', idCondominio)
          .eq('perfil_acesso', 'autorizado')
          .gte('data_hora_entrada', dataHojeInicio.toISOString())
          .order('data_hora_entrada', { ascending: false })
          .range(0, 49);
        const { data: dadosVisitas } = await visitasQuery;
        if (dadosVisitas) {
          setVisitasHoje(dadosVisitas);
        }
      } catch {}

      // 4. Histórico Geral Concluído
      try {
        const histQuery = supabase
          .from('prestadores_acessos')
          .select('*')
          .eq('condominio_id', idCondominio)
          .order('data_hora_entrada', { ascending: false })
          .range(0, 49);
        const { data: histDb } = await histQuery;
        if (histDb) setHistoricoAcessos(histDb);
      } catch {}

    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao carregar dados: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete para reutilização de cadastros anteriores
  useEffect(() => {
    if (!termoReutilizacao || termoReutilizacao.trim().length < 2) {
      setSugestoesReutilizacao([]);
      return;
    }
    const termo = termoReutilizacao.toLowerCase();
    const filtrados = cadastros.filter((c: any) => 
      (c.nome_profissional || c.nome_completo || '').toLowerCase().includes(termo) ||
      (c.documento || '').replace(/\D/g, '').includes(termo.replace(/\D/g, ''))
    ).slice(0, 5);
    setSugestoesReutilizacao(filtrados);
  }, [termoReutilizacao, cadastros]);

  const selecionarParaReutilizar = (item: any) => {
    setNomeCompleto(item.nome_profissional || item.nome_completo || '');
    setDocumento(item.documento || '');
    setTipoDocumento(item.tipo_documento || 'CPF');
    setEmpresa(item.empresa || '');
    setParentescoVinculo(item.parentesco_vinculo || '');
    setTelefone(item.telefone || '');
    setPlacaVeiculo(item.placa_veiculo || '');
    setFotoRosto(item.foto_rosto || '');
    setFotoDocumento(item.foto_documento || '');
    setTipoServico(item.tipo_servico || '');
    setObservacoes(item.observacoes || '');
    if (item.perfil_acesso) setPerfilAcesso(item.perfil_acesso as PerfilAcesso);
    if (item.unidade && item.unidade !== 'Condomínio') setUnidade(item.unidade);
    if (item.bloco && item.bloco !== 'Área Comum') setBloco(item.bloco);
    setSugestoesReutilizacao([]);
    setTermoReutilizacao('');
    setMensagem({ tipo: 'sucesso', texto: 'Dados recuperados com sucesso! Ajuste a validade e confirme.' });
  };

  // Edição de cadastro
  const abrirEdicaoCadastro = (item: any) => {
    setIdEdicao(item.id);
    setNomeCompleto(item.nome_profissional || item.nome_completo || '');
    setDocumento(item.documento || '');
    setTipoDocumento(item.tipo_documento || 'CPF');
    setEmpresa(item.empresa || '');
    setParentescoVinculo(item.parentesco_vinculo || '');
    setTelefone(item.telefone || '');
    setPlacaVeiculo(item.placa_veiculo || '');
    setFotoRosto(item.foto_rosto || '');
    setFotoDocumento(item.foto_documento || '');
    setTipoServico(item.tipo_servico || '');
    setObservacoes(item.observacoes || '');
    setPerfilAcesso((item.perfil_acesso as PerfilAcesso) || 'autorizado');
    setUnidade(item.unidade === 'Condomínio' ? '' : item.unidade || '');
    setBloco(item.bloco === 'Área Comum' ? '' : item.bloco || '');
    setTipoValidade((item.tipo_validade as TipoValidade) || 'hoje');
    if (item.data_validade_inicio) setDataValidadeInicio(item.data_validade_inicio.slice(0, 10));
    if (item.data_validade_fim) setDataValidadeFim(item.data_validade_fim.slice(0, 10));
    setModalEditarCadastro(true);
  };

  const fecharModalCadastro = () => {
    setModalNovoCadastro(false);
    setModalEditarCadastro(false);
    setIdEdicao(null);
    setNomeCompleto('');
    setDocumento('');
    setTipoDocumento('CPF');
    setEmpresa('');
    setParentescoVinculo('');
    setTelefone('');
    setPlacaVeiculo('');
    setUnidade('');
    setBloco('');
    setTipoServico('');
    setObservacoes('');
    setFotoRosto('');
    setFotoDocumento('');
    setTipoValidade('hoje');
    setTermoReutilizacao('');
    setSugestoesReutilizacao([]);
  };

  const abrirNovaLiberacao = (tipo: PerfilAcesso) => {
    fecharModalCadastro();
    setPerfilAcesso(tipo);
    if (tipo === 'prestador_condominio') {
      setUnidade('Condomínio');
      setBloco('Área Comum');
    } else {
      setUnidade('');
      setBloco('');
    }
    setModalNovoCadastro(true);
    setFabLiberacaoAberto(false);
  };

  // Abertura com dados pré-preenchidos do Menu de Busca (5 Abas)
  const abrirNovoAcessoComDados = (criterio?: CriterioBusca, valor?: string) => {
    fecharModalCadastro();
    if (criterio && valor && valor.trim()) {
      const valLimpo = valor.trim();
      if (criterio === 'CPF') {
        setDocumento(valLimpo);
        setTipoDocumento('CPF');
      } else if (criterio === 'Placa') {
        setPlacaVeiculo(valLimpo.toUpperCase());
      } else if (criterio === 'Nome') {
        setNomeCompleto(valLimpo);
      } else if (criterio === 'Unidade') {
        setUnidade(valLimpo);
      }
    }
    setPainelBuscaAberto(false);
    setModalNovoCadastro(true);
    setFabLiberacaoAberto(false);
  };

  // OCR de Documentos
  const handleOcrConfirmado = (dados: {
    nomeCompleto: string;
    documento: string;
    tipoDocumento: string;
    fotoDocumentoBase64?: string;
    fotoRostoBase64?: string;
    empresa?: string;
  }) => {
    setNomeCompleto(dados.nomeCompleto);
    setDocumento(dados.documento);
    setTipoDocumento(dados.tipoDocumento);
    if (dados.fotoDocumentoBase64) setFotoDocumento(dados.fotoDocumentoBase64);
    if (dados.fotoRostoBase64) setFotoRosto(dados.fotoRostoBase64);
    if (dados.empresa && !empresa) setEmpresa(dados.empresa);
    setModalOcrAberto(false);
    setMensagem({ 
      tipo: 'sucesso', 
      texto: `Documento digitalizado: ${dados.nomeCompleto} (${dados.documento})` 
    });
  };

  // Upload manual de foto do rosto
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await comprimirImagemBase64(file, 800, 800, 0.75);
      setFotoRosto(b64);
      setMensagem({ tipo: 'sucesso', texto: 'Foto do rosto carregada e otimizada!' });
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Falha ao processar foto.' });
    }
  };

  // Cálculo de datas de validade da autorização
  const calcularDatasValidade = (tipo: TipoValidade): { inicio: string; fim: string | null } => {
    const agora = new Date();
    const hojeStr = agora.toISOString().slice(0, 10);

    if (tipo === 'permanente') {
      return { inicio: hojeStr, fim: null };
    }
    if (tipo === 'hoje') {
      const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
      return { inicio: hojeStr, fim: fimHoje.toISOString() };
    }
    if (tipo === 'amanha') {
      const amanhaInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 0, 0, 0);
      const amanhaFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 23, 59, 59);
      return { inicio: amanhaInicio.toISOString(), fim: amanhaFim.toISOString() };
    }
    if (tipo === '3_dias') {
      const fim3 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 3, 23, 59, 59);
      return { inicio: hojeStr, fim: fim3.toISOString() };
    }
    if (tipo === '7_dias') {
      const fim7 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 7, 23, 59, 59);
      return { inicio: hojeStr, fim: fim7.toISOString() };
    }
    if (tipo === '30_dias') {
      const fim30 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 30, 23, 59, 59);
      return { inicio: hojeStr, fim: fim30.toISOString() };
    }
    return {
      inicio: dataValidadeInicio ? `${dataValidadeInicio}T00:00:00.000Z` : hojeStr,
      fim: dataValidadeFim ? `${dataValidadeFim}T23:59:59.999Z` : null
    };
  };

  // Verificação de validade da liberação cadastrada
  const checarValidade = (item: any): { valido: boolean; expirou: boolean; texto: string; cor: string } => {
    if (item.tipo_validade === 'permanente' || !item.data_validade_fim) {
      return { 
        valido: true, 
        expirou: false, 
        texto: 'Permanente (Livre)', 
        cor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
      };
    }
    const tFim = new Date(item.data_validade_fim).getTime();
    const dataFimFormatada = new Date(item.data_validade_fim).toLocaleDateString('pt-BR');

    if (Date.now() > tFim) {
      return {
        valido: false,
        expirou: true,
        texto: `Venceu em ${dataFimFormatada}`,
        cor: 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      };
    }
    return {
      valido: true,
      expirou: false,
      texto: `Válido até ${dataFimFormatada}`,
      cor: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    };
  };

  // Cronômetro de permanência: Apenas para PRESTADORES!
  const checarPermanencia = (item: any) => {
    const ehVisitante = item.perfil_acesso === 'autorizado';
    if (ehVisitante || !item.limite_permanencia_ate) {
      return {
        status: 'livre',
        minutosRestantes: 9999,
        texto: 'Permanência Livre (Visita)',
        corFundo: 'bg-slate-900 border-slate-800',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        estourado: false
      };
    }

    const tLimite = new Date(item.limite_permanencia_ate).getTime();
    const diffMs = tLimite - tempoAtual;
    const estourado = diffMs <= 0;

    const absMs = Math.abs(diffMs);
    const horas = Math.floor(absMs / 3600000);
    const minutos = Math.floor((absMs % 3600000) / 60000);
    const segundos = Math.floor((absMs % 60000) / 1000);
    const formatado = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

    if (estourado) {
      return {
        status: 'estourado',
        minutosRestantes: 0,
        texto: `ESTOURADO: +${formatado}`,
        corFundo: 'bg-red-950/70 border-red-500/80 shadow-lg shadow-red-950/40',
        badge: 'bg-red-600 text-white font-black animate-pulse',
        estourado: true
      };
    }

    const minutosTotais = Math.floor(diffMs / 60000);
    if (minutosTotais < 20) {
      return {
        status: 'alerta',
        minutosRestantes: minutosTotais,
        texto: `Atenção: resta ${formatado}`,
        corFundo: 'bg-amber-950/50 border-amber-500/70',
        badge: 'bg-amber-500 text-slate-950 font-black',
        estourado: false
      };
    }

    return {
      status: 'normal',
      minutosRestantes: minutosTotais,
      texto: `Restante: ${formatado}`,
      corFundo: 'bg-slate-900 border-slate-800',
      badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      estourado: false
    };
  };

  // Salvar Novo Cadastro
  const salvarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });

    if (!nomeCompleto.trim()) {
      setMensagem({ tipo: 'erro', texto: 'O Nome Completo é obrigatório.' });
      return;
    }

    if (perfilAcesso === 'autorizado' && !unidade.trim()) {
      setMensagem({ tipo: 'erro', texto: `Para Visitante / Família, informe ${eEstruturaCasas ? 'o Número da Casa' : 'a Unidade'} de destino.` });
      return;
    }

    if (perfilAcesso === 'prestador_unidade' && (!documento.trim() || !unidade.trim())) {
      setMensagem({ tipo: 'erro', texto: `Para Prestador da Unidade, o Documento e ${eEstruturaCasas ? 'o Número da Casa' : 'a Unidade'} são obrigatórios.` });
      return;
    }

    setLoading(true);
    try {
      const datasValidade = calcularDatasValidade(tipoValidade);
      const condoEfetivo = (!idCondominio || idCondominio === 'global' || idCondominio === 'todos')
        ? getCondominioAtivoId(usuarioLogado)
        : idCondominio;

      const payload: any = {
        condominio_id: condoEfetivo,
        perfil_acesso: perfilAcesso,
        nome_profissional: nomeCompleto.trim(),
        documento: documento.trim() || null,
        tipo_documento: tipoDocumento,
        empresa: perfilAcesso === 'autorizado' ? (parentescoVinculo || 'Visitante/Família') : empresa.trim(),
        parentesco_vinculo: parentescoVinculo.trim() || null,
        telefone: telefone.trim() || null,
        placa_veiculo: placaVeiculo.trim() || null,
        foto_rosto: fotoRosto || null,
        foto_url: fotoRosto || null,
        foto_documento: fotoDocumento || null,
        tipo_servico: tipoServico.trim() || (perfilAcesso === 'autorizado' ? 'Visita Familiar' : 'Serviços Gerais'),
        atende_condominio: perfilAcesso === 'prestador_condominio',
        unidade: perfilAcesso === 'prestador_condominio' ? 'Condomínio' : unidade.trim(),
        bloco: perfilAcesso === 'prestador_condominio' ? 'Área Comum' : (eEstruturaCasas ? 'Casa' : bloco.trim()),
        observacoes: observacoes.trim(),
        tipo_validade: tipoValidade,
        data_validade_inicio: datasValidade.inicio,
        data_validade_fim: datasValidade.fim,
        status_acesso: 'AUTORIZADO',
        operador_entrada_nome: operadorNome
      };

      const { error } = await supabase.from('prestadores').insert([payload]);
      if (error) throw error;

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'CRIAR',
        descricao: `Cadastrou liberação para ${nomeCompleto.trim()} (${perfilNome(perfilAcesso)}) - Destino: ${payload.unidade} ${payload.bloco || ''}.`,
        detalhes: { nome: nomeCompleto.trim(), perfil: perfilAcesso, unidade: payload.unidade, tipoValidade },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      setMensagem({ 
        tipo: 'sucesso', 
        texto: perfilAcesso === 'autorizado'
          ? `Visitante/Familiar ${nomeCompleto} autorizado! Entrada pode ser dada com 1 clique (sem necessidade de saída).`
          : `Prestador ${nomeCompleto} cadastrado com sucesso!`
      });
      invalidarCacheTabela('prestadores', condoEfetivo).catch(() => {});
      fecharModalCadastro();
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao cadastrar: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Salvar Edição
  const salvarEdicaoCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idEdicao) return;
    setLoading(true);

    try {
      const datasValidade = calcularDatasValidade(tipoValidade);
      const payload: any = {
        perfil_acesso: perfilAcesso,
        nome_profissional: nomeCompleto.trim(),
        documento: documento.trim() || null,
        tipo_documento: tipoDocumento,
        empresa: perfilAcesso === 'autorizado' ? (parentescoVinculo || 'Visitante/Família') : empresa.trim(),
        parentesco_vinculo: parentescoVinculo.trim() || null,
        telefone: telefone.trim() || null,
        placa_veiculo: placaVeiculo.trim() || null,
        foto_rosto: fotoRosto || null,
        foto_url: fotoRosto || null,
        foto_documento: fotoDocumento || null,
        tipo_servico: tipoServico.trim() || null,
        atende_condominio: perfilAcesso === 'prestador_condominio',
        unidade: perfilAcesso === 'prestador_condominio' ? 'Condomínio' : unidade.trim(),
        bloco: perfilAcesso === 'prestador_condominio' ? 'Área Comum' : (eEstruturaCasas ? 'Casa' : bloco.trim()),
        observacoes: observacoes.trim(),
        tipo_validade: tipoValidade,
        data_validade_inicio: datasValidade.inicio,
        data_validade_fim: datasValidade.fim
      };

      const { error } = await supabase.from('prestadores').update(payload).eq('id', idEdicao);
      if (error) throw error;

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'EDITAR',
        descricao: `Atualizou autorização de ${nomeCompleto.trim()} (${perfilNome(perfilAcesso)}).`,
        detalhes: { id: idEdicao, nome: nomeCompleto.trim(), perfil: perfilAcesso },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      setMensagem({ tipo: 'sucesso', texto: `Cadastro de ${nomeCompleto} atualizado com sucesso!` });
      invalidarCacheTabela('prestadores', idCondominio).catch(() => {});
      fecharModalCadastro();
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao atualizar: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // FLUXO DE ENTRADA INTELIGENTE:
  // - VISITANTES / FAMÍLIA: SÓ DAR ENTRADA, NÃO PRECISA DAR SAÍDA!
  // - PRESTADORES: CONTROLE DE TEMPO, LIMITE DE PERMANÊNCIA E SAÍDA OBRIGATÓRIA
  // =========================================================================
  const abrirModalEntradaPara = (pessoa: any) => {
    setItemSelecionado(pessoa);
    setTempoMaximoMinutos(240);
    setTempoMaximoCustomizado('');
    setCrachaEntrada(pessoa.cracha_atribuido || '');
    setPlacaEntrada(pessoa.placa_veiculo || '');
    setObservacoesEntrada('');
    setAlertaExpiracaoConfirmado(false);
    setModalEntrada(true);
  };

  const confirmarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado) return;

    const statusValidade = checarValidade(itemSelecionado);
    if (statusValidade.expirou && !alertaExpiracaoConfirmado) {
      setMensagem({ 
        tipo: 'erro', 
        texto: 'Atenção: A liberação está vencida. Interfone para o morador e confirme a autorização de hoje.' 
      });
      return;
    }

    setLoading(true);
    try {
      const ehVisitante = itemSelecionado.perfil_acesso === 'autorizado';
      const agora = new Date();

      if (ehVisitante) {
        // =====================================================================
        // REGRA DE OURO: VISITANTE / FAMÍLIA
        // Apenas registra a entrada auditada. NÃO precisa dar saída!
        // Não gera cronômetro regressivo, não exige devolução de crachá.
        // =====================================================================
        await supabase
          .from('prestadores')
          .update({
            data_hora_entrada: agora.toISOString(),
            status_acesso: 'AUTORIZADO', // Mantém liberado sem pendência de saída!
            operador_entrada_nome: operadorNome,
            placa_veiculo: placaEntrada.trim() || itemSelecionado.placa_veiculo || null
          })
          .eq('id', itemSelecionado.id);

        try {
          await supabase.from('prestadores_acessos').insert([{
            condominio_id: idCondominio,
            prestador_id: itemSelecionado.id,
            perfil_acesso: 'autorizado',
            nome_completo: itemSelecionado.nome_profissional || itemSelecionado.nome_completo,
            documento: itemSelecionado.documento || null,
            empresa: itemSelecionado.parentesco_vinculo || itemSelecionado.empresa || 'Visitante/Família',
            parentesco_vinculo: itemSelecionado.parentesco_vinculo || null,
            unidade: itemSelecionado.unidade,
            bloco: itemSelecionado.bloco,
            foto_rosto: itemSelecionado.foto_rosto,
            cracha: null,
            placa_veiculo: placaEntrada.trim() || itemSelecionado.placa_veiculo || null,
            data_hora_entrada: agora.toISOString(),
            data_hora_saida: null, // Sem controle de permanência
            tempo_maximo_minutos: null,
            limite_permanencia_ate: null,
            status_acesso: 'CONCLUIDO', // Entrada direta concluída com sucesso
            operador_entrada_nome: operadorNome,
            observacoes: observacoesEntrada.trim() || 'Entrada de visitante/família (circulação livre)'
          }]);
        } catch {}

        await registrarAtividade({
          modulo: 'Autorizados',
          acao: 'ENTRADA',
          descricao: `Registrou ENTRADA de ${itemSelecionado.nome_profissional || itemSelecionado.nome_completo} (Visitante/Família) para ${itemSelecionado.unidade} ${itemSelecionado.bloco || ''}. Permanência livre (sem necessidade de saída).`,
          detalhes: {
            pessoaId: itemSelecionado.id,
            nome: itemSelecionado.nome_profissional || itemSelecionado.nome_completo,
            unidade: itemSelecionado.unidade,
            ehVisitante: true
          },
          operador_nome: operadorNome,
          condominio_id: idCondominio
        });

        setMensagem({ 
          tipo: 'sucesso', 
          texto: `✅ Entrada registrada! ${itemSelecionado.nome_profissional || itemSelecionado.nome_completo} liberado para acesso à unidade (Visita livre - sem necessidade de dar saída).` 
        });

      } else {
        // =====================================================================
        // PRESTADORES DE SERVIÇO / OBRAS:
        // Controle estrito de permanência, horário limite e saída necessária.
        // =====================================================================
        const minutosEfetivos = tempoMaximoCustomizado ? parseInt(tempoMaximoCustomizado, 10) || 240 : tempoMaximoMinutos;
        const limitePermanencia = new Date(agora.getTime() + minutosEfetivos * 60000).toISOString();

        await supabase
          .from('prestadores')
          .update({
            status_acesso: 'DENTRO',
            data_hora_entrada: agora.toISOString(),
            data_hora_saida: null,
            cracha_atribuido: crachaEntrada.trim() || null,
            tempo_maximo_minutos: minutosEfetivos,
            limite_permanencia_ate: limitePermanencia,
            operador_entrada_nome: operadorNome,
            placa_veiculo: placaEntrada.trim() || itemSelecionado.placa_veiculo || null
          })
          .eq('id', itemSelecionado.id);

        try {
          await supabase.from('prestadores_acessos').insert([{
            condominio_id: idCondominio,
            prestador_id: itemSelecionado.id,
            perfil_acesso: itemSelecionado.perfil_acesso || 'prestador_unidade',
            nome_completo: itemSelecionado.nome_profissional || itemSelecionado.nome_completo,
            documento: itemSelecionado.documento,
            empresa: itemSelecionado.empresa,
            parentesco_vinculo: itemSelecionado.parentesco_vinculo,
            unidade: itemSelecionado.unidade,
            bloco: itemSelecionado.bloco,
            foto_rosto: itemSelecionado.foto_rosto,
            cracha: crachaEntrada.trim() || null,
            placa_veiculo: placaEntrada.trim() || itemSelecionado.placa_veiculo || null,
            data_hora_entrada: agora.toISOString(),
            tempo_maximo_minutos: minutosEfetivos,
            limite_permanencia_ate: limitePermanencia,
            status_acesso: 'DENTRO',
            operador_entrada_nome: operadorNome,
            observacoes: observacoesEntrada.trim() || null
          }]);
        } catch {}

        await registrarAtividade({
          modulo: 'Autorizados',
          acao: 'ENTRADA',
          descricao: `Registrou ENTRADA de prestador ${itemSelecionado.nome_profissional || itemSelecionado.nome_completo} para ${itemSelecionado.unidade} ${itemSelecionado.bloco || ''}. Tempo max: ${Math.floor(minutosEfetivos / 60)}h. Crachá: ${crachaEntrada || 'N/A'}.`,
          detalhes: {
            pessoaId: itemSelecionado.id,
            nome: itemSelecionado.nome_profissional || itemSelecionado.nome_completo,
            unidade: itemSelecionado.unidade,
            cracha: crachaEntrada,
            tempoMaximo: minutosEfetivos
          },
          operador_nome: operadorNome,
          condominio_id: idCondominio
        });

        const horaLimiteFmt = new Date(limitePermanencia).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setMensagem({ 
          tipo: 'sucesso', 
          texto: `Entrada de ${itemSelecionado.nome_profissional || itemSelecionado.nome_completo} registrada! Permanência autorizada até às ${horaLimiteFmt}.` 
        });
        setAbaAtiva('permanencia');
      }

      setModalEntrada(false);
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao registrar entrada: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Saída de Prestadores (Apenas Prestadores)
  const abrirModalSaidaPara = (item: any) => {
    setItemSelecionado(item);
    setCrachaDevolvido(true);
    setObservacoesSaida('');
    setModalSaida(true);
  };

  const confirmarSaida = async () => {
    if (!itemSelecionado) return;
    setLoading(true);

    try {
      const agora = new Date().toISOString();
      const targetId = itemSelecionado.prestador_id || itemSelecionado.id;

      await supabase
        .from('prestadores')
        .update({
          status_acesso: 'AUTORIZADO',
          data_hora_saida: agora,
          operador_saida_nome: operadorNome
        })
        .eq('id', targetId);

      try {
        await supabase
          .from('prestadores_acessos')
          .update({
            data_hora_saida: agora,
            status_acesso: 'CONCLUIDO',
            operador_saida_nome: operadorNome,
            observacoes: observacoesSaida.trim() || undefined
          })
          .eq('status_acesso', 'DENTRO')
          .eq('prestador_id', targetId);
      } catch {}

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'SAIDA',
        descricao: `Registrou SAÍDA do prestador ${itemSelecionado.nome_completo || itemSelecionado.nome_profissional}. Crachá: ${crachaDevolvido ? 'Devolvido' : 'Pendente'}.`,
        detalhes: {
          nome: itemSelecionado.nome_completo || itemSelecionado.nome_profissional,
          cracha: itemSelecionado.cracha || itemSelecionado.cracha_atribuido,
          crachaDevolvido
        },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      setMensagem({ tipo: 'sucesso', texto: `Saída de ${itemSelecionado.nome_completo || itemSelecionado.nome_profissional} concluída com sucesso!` });
      setModalSaida(false);
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao registrar saída: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Prorrogação de Tempo de Prestador
  const handleProrrogarTempo = async () => {
    if (!itemSelecionado) return;
    setLoading(true);

    try {
      const minAdicionados = prorrogarCustomizado ? (parseInt(prorrogarCustomizado, 10) || 60) : minutosProrrogacao;
      const tAntigo = itemSelecionado.limite_permanencia_ate ? new Date(itemSelecionado.limite_permanencia_ate).getTime() : Date.now();
      const novoLimite = new Date(Math.max(Date.now(), tAntigo) + minAdicionados * 60000).toISOString();
      const novoLimiteFmt = new Date(novoLimite).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const targetId = itemSelecionado.prestador_id || itemSelecionado.id;

      await supabase
        .from('prestadores')
        .update({ limite_permanencia_ate: novoLimite })
        .eq('id', targetId);

      try {
        await supabase
          .from('prestadores_acessos')
          .update({ limite_permanencia_ate: novoLimite })
          .eq('status_acesso', 'DENTRO')
          .eq('prestador_id', targetId);
      } catch {}

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'EDITAR',
        descricao: `Prorrogou tempo do prestador ${itemSelecionado.nome_completo || itemSelecionado.nome_profissional} em +${minAdicionados} minutos (Novo limite: ${novoLimiteFmt}).`,
        detalhes: { novoLimite, minutosAdicionados: minAdicionados },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      setMensagem({ 
        tipo: 'sucesso', 
        texto: `Permanência prorrogada em +${minAdicionados}m! Novo limite: até às ${novoLimiteFmt}.` 
      });
      setModalProrrogar(false);
      setProrrogarCustomizado('');
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao prorrogar: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Notificações WhatsApp Inteligentes (Visitante vs Prestador)
  const dispararWhatsAppEntrada = (item: any) => {
    const nome = item.nome_profissional || item.nome_completo;
    const agora = new Date();
    const dataHoje = agora.toLocaleDateString('pt-BR');
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nomeOp = operadorNome;
    const perfil = item.perfil_acesso || 'autorizado';
    const ehVisitante = perfil === 'autorizado';

    if (perfil === 'prestador_condominio') {
      const telSindico = usuarioLogado?.condominio?.sindico_whatsapp?.replace(/\D/g, '') || '';
      const horaLimiteStr = item.limite_permanencia_ate 
        ? `\n⏰ *Permanência autorizada até às:* ${new Date(item.limite_permanencia_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` 
        : '';
      const texto = `🛠️ *AVISO DE MANUTENÇÃO - PORTARIA*\nO prestador *${nome}* (${item.empresa || 'Serviços'}) registrou *ENTRADA* no condomínio às *${hora}* em *${dataHoje}*. Crachá: ${item.cracha || item.cracha_atribuido || 'N/A'}.${horaLimiteStr}\n• Operador: ${nomeOp}`;
      const url = formatarLinkWhatsApp(telSindico, texto, nomeOp);
      window.open(url, '_blank');
    } else {
      const moradorDestino = moradores.find((m: any) => 
        m.unidade?.toString().trim().toLowerCase() === item.unidade?.toString().trim().toLowerCase() &&
        (!item.bloco || m.bloco?.toString().trim().toLowerCase() === item.bloco?.toString().trim().toLowerCase())
      );
      const telMorador = moradorDestino?.telefone?.replace(/\D/g, '') || item.telefone?.replace(/\D/g, '') || '';
      const rotuloDestino = formatarIdentificacaoUnidade(item.unidade, item.bloco, condoConfig?.tipo_estrutura);

      let texto = '';
      if (ehVisitante) {
        texto = `👋 *AVISO DE VISITA - PORTARIA*\nOlá! Informamos que seu visitante/familiar *${nome}* (${item.parentesco_vinculo || 'Visita'}) acabou de registrar entrada na portaria para ${rotuloDestino} às *${hora}* do dia *${dataHoje}*.\n• Tenha uma excelente visita!\n• Operador: ${nomeOp}`;
      } else {
        const horaLimiteStr = item.limite_permanencia_ate 
          ? `\n⏰ *Permanência autorizada até às:* ${new Date(item.limite_permanencia_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` 
          : '';
        texto = `🔧 *AVISO DE PRESTADOR - PORTARIA*\nInformamos que o prestador *${nome}* (${item.empresa || 'Serviços'}) registrou entrada para ${rotuloDestino} às *${hora}* do dia *${dataHoje}*.${horaLimiteStr}\n• Operador: ${nomeOp}`;
      }
      const url = formatarLinkWhatsApp(telMorador, texto, nomeOp);
      window.open(url, '_blank');
    }
  };

  const perfilNome = (p: string) => {
    switch (p) {
      case 'autorizado': return 'Visitante / Família';
      case 'prestador_unidade': return 'Prestador da Unidade';
      case 'prestador_condominio': return 'Prestador do Condomínio';
      default: return 'Autorizado';
    }
  };

  const perfilBadge = (p: string) => {
    switch (p) {
      case 'autorizado':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'prestador_unidade':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'prestador_condominio':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  // Sugestão preditiva do próximo crachá disponível
  const sugerirProximoCracha = (): string => {
    const crachasUsados = prestadoresAtivos
      .map((p: any) => parseInt(p.cracha || p.cracha_atribuido || '0', 10))
      .filter((n: number) => !isNaN(n) && n > 0);
    const max = crachasUsados.length > 0 ? Math.max(...crachasUsados) : 10;
    return (max + 1).toString().padStart(3, '0');
  };

  // =========================================================================
  // FLUXOS DE 1-CLIQUE (FAST-LANE ACTIONS - SEM ABRIR MODAIS DESNECESSÁRIOS)
  // =========================================================================

  // 1. Visitante / Família: Entrada Instantânea em 1-Clique com auditoria e WhatsApp
  const darEntradaRapidaVisitante = async (item: any) => {
    if (!permissoesOperador.darEntrada) return;
    setLoading(true);
    try {
      const agora = new Date();
      await supabase
        .from('prestadores')
        .update({
          data_hora_entrada: agora.toISOString(),
          status_acesso: 'AUTORIZADO',
          operador_entrada_nome: operadorNome,
        })
        .eq('id', item.id);

      try {
        await supabase.from('prestadores_acessos').insert([{
          condominio_id: idCondominio,
          prestador_id: item.id,
          perfil_acesso: 'autorizado',
          nome_completo: item.nome_profissional || item.nome_completo,
          documento: item.documento || null,
          empresa: item.parentesco_vinculo || item.empresa || 'Visitante/Família',
          parentesco_vinculo: item.parentesco_vinculo || null,
          unidade: item.unidade,
          bloco: item.bloco,
          foto_rosto: item.foto_rosto,
          cracha: null,
          placa_veiculo: item.placa_veiculo || null,
          data_hora_entrada: agora.toISOString(),
          data_hora_saida: null,
          status_acesso: 'CONCLUIDO',
          operador_entrada_nome: operadorNome,
          observacoes: 'Entrada rápida de visitante (1-clique - circulação livre)'
        }]);
      } catch {}

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'ENTRADA',
        descricao: `[1-CLIQUE] Registrou ENTRADA de ${item.nome_profissional || item.nome_completo} (Visitante/Família) para ${item.unidade} ${item.bloco || ''}.`,
        detalhes: { pessoaId: item.id, nome: item.nome_profissional || item.nome_completo, unidade: item.unidade },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      emitirBeepEntrada();
      if (whatsappAutomatico) {
        dispararWhatsAppEntrada(item);
      }
      setMensagem({
        tipo: 'sucesso',
        texto: `✅ Entrada registrada! ${item.nome_profissional || item.nome_completo} liberado(a) com sucesso (1-Clique)!`
      });
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao registrar entrada rápida: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // 2. Prestador de Serviço: Entrada com seleção de tempo (1h, 2h, 4h, 8h) e crachá
  const darEntradaRapidaPrestador = async (item: any) => {
    if (!permissoesOperador.darEntrada) return;
    setLoading(true);
    try {
      const agora = new Date();
      const minutos = tempoLimitePorPrestador[item.id] || 240;
      const cracha = crachaPorPrestador[item.id] || item.cracha_atribuido || sugerirProximoCracha();
      const limitePermanencia = new Date(agora.getTime() + minutos * 60000).toISOString();

      await supabase
        .from('prestadores')
        .update({
          status_acesso: 'DENTRO',
          data_hora_entrada: agora.toISOString(),
          data_hora_saida: null,
          cracha_atribuido: cracha || null,
          tempo_maximo_minutos: minutos,
          limite_permanencia_ate: limitePermanencia,
          operador_entrada_nome: operadorNome,
        })
        .eq('id', item.id);

      try {
        await supabase.from('prestadores_acessos').insert([{
          condominio_id: idCondominio,
          prestador_id: item.id,
          perfil_acesso: item.perfil_acesso || 'prestador_unidade',
          nome_completo: item.nome_profissional || item.nome_completo,
          documento: item.documento,
          empresa: item.empresa,
          parentesco_vinculo: item.parentesco_vinculo,
          unidade: item.unidade,
          bloco: item.bloco,
          foto_rosto: item.foto_rosto,
          cracha: cracha || null,
          placa_veiculo: item.placa_veiculo || null,
          data_hora_entrada: agora.toISOString(),
          tempo_maximo_minutos: minutos,
          limite_permanencia_ate: limitePermanencia,
          status_acesso: 'DENTRO',
          operador_entrada_nome: operadorNome,
          observacoes: 'Entrada rápida 1-clique com crachá e tempo'
        }]);
      } catch {}

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'ENTRADA',
        descricao: `[1-CLIQUE] Registrou ENTRADA de prestador ${item.nome_profissional || item.nome_completo}. Crachá #${cracha || 'N/A'}, Limite: ${Math.floor(minutos / 60)}h.`,
        detalhes: { pessoaId: item.id, nome: item.nome_profissional || item.nome_completo, cracha, tempoMaximo: minutos },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      emitirBeepEntrada();
      if (whatsappAutomatico) {
        dispararWhatsAppEntrada({ ...item, cracha, limite_permanencia_ate: limitePermanencia });
      }
      const horaFmt = new Date(limitePermanencia).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setMensagem({
        tipo: 'sucesso',
        texto: `✅ Prestador ${item.nome_profissional || item.nome_completo} em trânsito! Crachá #${cracha} (Limite até às ${horaFmt}).`
      });
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao registrar entrada rápida: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // 3. Prestador Dentro: Saída Imediata em 1-Clique (devolve crachá, audita e calcula tempo)
  const darSaidaRapidaPrestador = async (item: any) => {
    if (!permissoesOperador.darSaida) return;
    setLoading(true);
    try {
      const agora = new Date().toISOString();
      const targetId = item.prestador_id || item.id;

      await supabase
        .from('prestadores')
        .update({
          status_acesso: 'AUTORIZADO',
          data_hora_saida: agora,
          operador_saida_nome: operadorNome
        })
        .eq('id', targetId);

      try {
        await supabase
          .from('prestadores_acessos')
          .update({
            data_hora_saida: agora,
            status_acesso: 'CONCLUIDO',
            operador_saida_nome: operadorNome
          })
          .eq('status_acesso', 'DENTRO')
          .eq('prestador_id', targetId);
      } catch {}

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'SAIDA',
        descricao: `[1-CLIQUE] Registrou SAÍDA do prestador ${item.nome_completo || item.nome_profissional}. Crachá devolvido.`,
        detalhes: { nome: item.nome_completo || item.nome_profissional, cracha: item.cracha || item.cracha_atribuido },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      emitirBeepSaida();
      setMensagem({
        tipo: 'sucesso',
        texto: `✅ Saída de ${item.nome_completo || item.nome_profissional} concluída com sucesso! Crachá liberado.`
      });
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao registrar saída rápida: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // 4. Prorrogação Rápida (+30m, +1h) em 1-Clique
  const prorrogarRapidoPrestador = async (item: any, minutosAdicionais: number) => {
    setLoading(true);
    try {
      const tAntigo = item.limite_permanencia_ate ? new Date(item.limite_permanencia_ate).getTime() : Date.now();
      const novoLimite = new Date(Math.max(Date.now(), tAntigo) + minutosAdicionais * 60000).toISOString();
      const novoLimiteFmt = new Date(novoLimite).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const targetId = item.prestador_id || item.id;

      await supabase
        .from('prestadores')
        .update({ limite_permanencia_ate: novoLimite })
        .eq('id', targetId);

      try {
        await supabase
          .from('prestadores_acessos')
          .update({ limite_permanencia_ate: novoLimite })
          .eq('status_acesso', 'DENTRO')
          .eq('prestador_id', targetId);
      } catch {}

      await registrarAtividade({
        modulo: 'Autorizados',
        acao: 'EDITAR',
        descricao: `[1-CLIQUE] Prorrogou permanência de ${item.nome_completo || item.nome_profissional} em +${minutosAdicionais}m (Até ${novoLimiteFmt}).`,
        detalhes: { novoLimite, minutosAdicionados: minutosAdicionais },
        operador_nome: operadorNome,
        condominio_id: idCondominio
      });

      emitirBeepEntrada();
      setMensagem({
        tipo: 'sucesso',
        texto: `⏱️ Tempo prorrogado em +${minutosAdicionais}m para ${item.nome_completo || item.nome_profissional} (Novo limite: até às ${novoLimiteFmt})!`
      });
      await carregarTudo();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao prorrogar: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Filtragem Dinâmica por Categoria, Status, Busca e Unidade
  const cadastrosFiltrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    return cadastros.filter((c: any) => {
      // 1. Filtro por Categoria de Entrada
      if (filtroCategoria !== 'todos') {
        if (c.perfil_acesso !== filtroCategoria) return false;
      }

      // 2. Filtro por Status
      const prestadorNoLocal = prestadoresAtivos.find((a: any) => (a.prestador_id || a.id) === c.id);
      const estaDentro = Boolean(prestadorNoLocal);

      if (filtroStatus === 'dentro') {
        if (!estaDentro) return false;
      } else if (filtroStatus === 'entradas_hoje') {
        const dataHojeStr = new Date().toISOString().slice(0, 10);
        const teveEntradaHoje = c.data_hora_entrada && c.data_hora_entrada.startsWith(dataHojeStr);
        if (!teveEntradaHoje) return false;
      } else if (filtroStatus === 'validos') {
        const infoVal = checarValidade(c);
        if (!infoVal.valido) return false;
      } else if (filtroStatus === 'vencidos') {
        const infoVal = checarValidade(c);
        if (!infoVal.expirou) return false;
      }

      // 3. Filtro por Unidade / Bloco
      if (filtroUnidade !== 'todas') {
        if ((c.unidade || '').toString().trim() !== filtroUnidade) return false;
      }

      // 4. Busca Preditiva Inteligente conectada às 5 abas de critérios com fallback universal
      if (buscaNorm) {
        const nome = (c.nome_profissional || c.nome_completo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const doc = (c.documento || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const emp = (c.empresa || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const uni = (c.unidade || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const blo = (c.bloco || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const pla = (c.placa_veiculo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const vin = (c.parentesco_vinculo || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        let bateCriterio = false;
        if (criterioBusca === 'CPF') {
          bateCriterio = doc.includes(buscaNorm);
        } else if (criterioBusca === 'Nome') {
          bateCriterio = nome.includes(buscaNorm) || emp.includes(buscaNorm) || vin.includes(buscaNorm);
        } else if (criterioBusca === 'Unidade') {
          bateCriterio = uni.includes(buscaNorm) || blo.includes(buscaNorm);
        } else if (criterioBusca === 'Placa') {
          bateCriterio = pla.includes(buscaNorm);
        }

        if (!bateCriterio) return false;
      }

      return true;
    }).sort((a: any, b: any) => {
      // Ordenação: pessoas que estão DENTRO ou ESTOURADAS aparecem com máxima prioridade no topo
      const estaDentroA = prestadoresAtivos.some((p: any) => (p.prestador_id || p.id) === a.id);
      const estaDentroB = prestadoresAtivos.some((p: any) => (p.prestador_id || p.id) === b.id);
      if (estaDentroA !== estaDentroB) {
        return estaDentroA ? -1 : 1;
      }

      // Critério secundário: liberações vencidas vão para o final
      const aVal = checarValidade(a);
      const bVal = checarValidade(b);
      const aExpirou = aVal.expirou ? 1 : 0;
      const bExpirou = bVal.expirou ? 1 : 0;
      if (aExpirou !== bExpirou) {
        return aExpirou - bExpirou;
      }

      // Critério terciário: registros mais recentes primeiro
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dataB - dataA;
    });
  }, [cadastros, filtroCategoria, filtroStatus, busca, filtroUnidade, prestadoresAtivos, criterioBusca]);


  // Lista única de unidades para o filtro
  const listaUnidadesDisponiveis = useMemo(() => {
    const sets = new Set<string>();
    cadastros.forEach(c => {
      if (c.unidade && c.unidade !== 'Condomínio') sets.add(c.unidade.toString().trim());
    });
    return Array.from(sets).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [cadastros]);

  // Contagens de estatísticas
  const estatisticas = useMemo(() => {
    const totalPrestadoresDentro = prestadoresAtivos.length;
    const estourados = prestadoresAtivos.filter(a => checarPermanencia(a).estourado).length;
    const totalVisitantes = cadastros.filter(c => c.perfil_acesso === 'autorizado').length;
    const totalPrestadoresCadastrados = cadastros.filter(c => c.perfil_acesso !== 'autorizado').length;
    const totalVisitasHoje = visitasHoje.length;

    return {
      prestadoresDentro: totalPrestadoresDentro,
      estourados,
      visitantes: totalVisitantes,
      prestadores: totalPrestadoresCadastrados,
      visitasHoje: totalVisitasHoje,
      totalCadastros: cadastros.length
    };
  }, [cadastros, prestadoresAtivos, visitasHoje, tempoAtual]);

  // Toca alerta sonoro se tiver algum prestador estourado e o som estiver habilitado
  useEffect(() => {
    if (estatisticas.estourados > 0 && alertaSonoroHabilitado) {
      emitirAlertaSonoro();
    }
  }, [estatisticas.estourados, alertaSonoroHabilitado]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      

      {/* FEEDBACK DE MENSAGEM */}
      {mensagem.texto && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between animate-in fade-in duration-150 ${
          mensagem.tipo === 'sucesso' 
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
            : 'bg-red-950/80 text-red-300 border-red-500/40'
        }`}>
          <div className="flex items-center gap-2">
            {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
            <span>{mensagem.texto}</span>
          </div>
          <button onClick={() => setMensagem({ tipo: '', texto: '' })} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BARRA DE NAVEGAÇÃO PRINCIPAL: BOTÃO LISTA DE AUTORIZADOS & CONTROLES */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900 p-2.5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none w-full sm:w-auto">
          {/* BOTÃO PRINCIPAL: LISTA DE AUTORIZADOS */}
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('cadastros');
              setBusca('');
              setPainelBuscaAberto(false);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 ${
              abaAtiva === 'cadastros'
                ? 'bg-purple-600 text-white shadow-purple-600/30 ring-2 ring-purple-400/40'
                : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Users className={`w-4 h-4 ${abaAtiva === 'cadastros' ? 'text-white' : 'text-purple-400'}`} />
            <span>Lista de Autorizados</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              abaAtiva === 'cadastros' ? 'bg-purple-800 text-purple-100' : 'bg-slate-800 text-slate-300'
            }`}>
              {estatisticas.totalCadastros || cadastros.length}
            </span>
          </button>

          {/* PRESTADORES NO LOCAL (PERMANÊNCIA) */}
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('permanencia');
              setPainelBuscaAberto(false);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
              abaAtiva === 'permanencia'
                ? 'bg-blue-600 text-white shadow-blue-600/30 ring-2 ring-blue-400/40'
                : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <HardHat className={`w-4 h-4 ${abaAtiva === 'permanencia' ? 'text-white' : 'text-blue-400'}`} />
            <span>No Local</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              abaAtiva === 'permanencia' ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-300'
            }`}>
              {prestadoresAtivos.length}
            </span>
            {estatisticas.estourados > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Prestador estourado" />
            )}
          </button>

          {/* HISTÓRICO DE ACESSOS */}
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('historico');
              setPainelBuscaAberto(false);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
              abaAtiva === 'historico'
                ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <History className={`w-4 h-4 ${abaAtiva === 'historico' ? 'text-white' : 'text-emerald-400'}`} />
            <span>Histórico</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              abaAtiva === 'historico' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
            }`}>
              {visitasHoje.length + historicoAcessos.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PAINEL DE CONTROLE DE TELA ÚNICA: MOTOR DE BUSCA COM SELEÇÃO POR CPF, NOME, UNIDADE */}
      {/* ========================================================================= */}
      <div ref={containerBuscaRef} className="relative z-30 bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-3.5 shadow-xl">
        
        {/* SELETOR DE CRITÉRIO DE PESQUISA: CPF, NOME, UNIDADE, PLACA */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              <span className="hidden xs:inline">Buscar por:</span>
            </span>

            {criteriosBusca.map((crit) => {
              const IconeCrit = crit.icone;
              const ativo = criterioBusca === crit.id;
              return (
                <button
                  key={crit.id}
                  type="button"
                  onClick={() => {
                    setCriterioBusca(crit.id);
                    inputBuscaGlobalRef.current?.focus();
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs active:scale-95 ${
                    ativo
                      ? 'bg-purple-600 text-white shadow-purple-600/30 ring-2 ring-purple-400/40'
                      : 'bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                  title={`Filtrar especificamente por ${crit.rotulo}`}
                >
                  <IconeCrit className={`w-3.5 h-3.5 ${ativo ? 'text-white' : 'text-purple-400'}`} />
                  <span>{crit.rotulo}</span>
                </button>
              );
            })}
          </div>

          <span className="text-[10px] text-purple-400 font-mono font-semibold hidden md:inline-flex items-center gap-1">
            <span>Filtro ativo:</span>
            <strong className="uppercase bg-purple-950/60 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
              {criterioBusca}
            </strong>
          </span>
        </div>

        {/* 2. CAMPO DE BUSCA COM ÍCONE DE LUPA E BUSCA UNIVERSAL PREDITIVA */}
        <div className="relative">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-purple-400 pointer-events-none" />
              <input
                ref={inputBuscaGlobalRef}
                type="text"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  if (!painelBuscaAberto) setPainelBuscaAberto(true);
                }}
                onFocus={() => {
                  if (busca.trim().length > 0) setPainelBuscaAberto(true);
                }}
                placeholder={
                  criterioBusca === 'CPF'
                    ? "Digite o CPF (ex: 000.000.000-00 ou apenas números)..."
                    : criterioBusca === 'Nome'
                    ? "Digite o nome da pessoa ou prestador..."
                    : criterioBusca === 'Unidade'
                    ? "Digite a unidade ou casa (ex: 142, Bloco A)..."
                    : "Digite a placa do veículo (ex: ABC-1234 ou BRA2E19)..."
                }
                className="w-full bg-slate-950 text-white text-sm sm:text-base pl-11 pr-28 py-3 rounded-xl border-2 border-slate-700/80 focus:outline-none focus:border-purple-500 transition-all font-semibold placeholder:text-slate-500 shadow-inner"
              />
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-purple-300 bg-purple-950/80 border border-purple-800/80 rounded-md">
                  {criterioBusca}
                </span>
                {busca ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBusca('');
                      inputBuscaGlobalRef.current?.focus();
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-xs">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Toggle de WhatsApp Automático e Botão de Ação Direta */}
            <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
              <label
                htmlFor="toggle-whatsapp-auto"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer select-none hover:border-slate-700 transition"
                title="Disparar WhatsApp formatado automaticamente ao liberar entrada"
              >
                <input
                  id="toggle-whatsapp-auto"
                  type="checkbox"
                  checked={whatsappAutomatico}
                  onChange={(e) => setWhatsappAutomatico(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">WhatsApp Automático</span>
                  <span className="sm:hidden">WhatsApp</span>
                </span>
              </label>
            </div>
          </div>

          {/* 2.3 PAINEL DE ORIENTAÇÃO E AÇÃO (DROPDOWN SUSPENSO AO FOCAR OU DIGITAR) */}
          {painelBuscaAberto && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border-2 border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md">
              {/* Mensagem Orientativa para o Operador & Botão + Novo Acesso */}
              <div className="p-3 sm:p-4 bg-slate-950/90 border-b border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                    <Info className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-xs sm:text-sm font-black text-slate-100">
                      Busca preditiva inteligente de pessoas e autorizados
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {busca ? `Filtrando por ${criterioBusca}: "${busca}"` : `Pesquisando por: ${criterioBusca} (digite para filtrar)`}
                    </p>
                  </div>
                </div>

                {permissoesOperador.cadastrar && (
                  <button
                    type="button"
                    onClick={() => abrirNovoAcessoComDados(criterioBusca, busca)}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl text-xs uppercase flex items-center justify-center gap-2 transition shadow-md shadow-purple-600/30 active:scale-95 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Novo acesso</span>
                  </button>
                )}
              </div>

              {/* Lista Preditiva em Tempo Real dentro do Dropdown */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-1 sm:p-2">
                {cadastrosFiltrados.slice(0, 6).map((cad: any) => {
                  const ehVisitante = cad.perfil_acesso === 'autorizado';
                  const prestadorNoLocal = prestadoresAtivos.find((a: any) => (a.prestador_id || a.id) === cad.id);
                  const estaDentro = Boolean(prestadorNoLocal);
                  const perm = estaDentro ? checarPermanencia(prestadorNoLocal) : null;

                  return (
                    <div
                      key={cad.id}
                      className="p-2.5 sm:p-3 hover:bg-slate-800/70 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {cad.foto_rosto ? (
                            <img
                              src={cad.foto_rosto}
                              alt={cad.nome_completo}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300 font-bold text-xs">
                              {(cad.nome_profissional || cad.nome_completo || 'P').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          {estaDentro && (
                            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900 animate-pulse" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-white truncate">
                              {cad.nome_profissional || cad.nome_completo}
                            </h4>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              ehVisitante
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {ehVisitante ? 'Visitante' : 'Prestador'}
                            </span>
                            {estaDentro && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${perm?.estourado ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
                                {perm?.estourado ? 'ESTOURADO' : 'DENTRO'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap mt-0.5 font-medium">
                            <span className="text-purple-300 font-bold">
                              {eEstruturaCasas ? 'Casa' : 'Unid'}: {cad.unidade || 'Geral'} {cad.bloco && `(${cad.bloco})`}
                            </span>
                            {cad.documento && (
                              <span>Doc: <strong className="text-slate-300 font-mono">{cad.documento}</strong></span>
                            )}
                            {cad.placa_veiculo && (
                              <span>Placa: <strong className="text-slate-300 font-mono uppercase">{cad.placa_veiculo}</strong></span>
                            )}
                            {cad.empresa && (
                              <span>Emp: {cad.empresa}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ações de 1 Clique no próprio Dropdown */}
                      <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        {ehVisitante ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              darEntradaRapidaVisitante(cad);
                              setPainelBuscaAberto(false);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Entrada 1-Clique</span>
                          </button>
                        ) : estaDentro ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              darSaidaRapidaPrestador(prestadorNoLocal);
                              setPainelBuscaAberto(false);
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Saída Imediata</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              darEntradaRapidaPrestador(cad);
                              setPainelBuscaAberto(false);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Entrada Rápida</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setItemSelecionado(cad);
                            setPainelBuscaAberto(false);
                            setAbaAtiva('cadastros');
                          }}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                          title="Focar na lista"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {cadastrosFiltrados.length === 0 && (
                  <div className="py-6 px-4 text-center space-y-3">
                    <p className="text-xs sm:text-sm text-slate-400 font-semibold">
                      Nenhum cadastro encontrado para o critério <strong className="text-purple-400">{criterioBusca}</strong> {busca && `com termo "${busca}"`}.
                    </p>
                    {permissoesOperador.cadastrar && (
                      <button
                        type="button"
                        onClick={() => abrirNovoAcessoComDados(criterioBusca, busca)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase transition shadow-md shadow-emerald-600/30 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Cadastrar Novo Acesso agora com "{busca || criterioBusca}"</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Rodapé do Dropdown com atalhos */}
              <div className="p-2 sm:p-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Pressione <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">ESC</kbd> para fechar</span>
                <button
                  type="button"
                  onClick={() => setPainelBuscaAberto(false)}
                  className="text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                >
                  Fechar Painel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contador de Registros e Limpar Busca */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            <strong className="text-white">{cadastrosFiltrados.length}</strong> pessoa(s) listada(s)
          </span>
          {busca.trim() && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="text-[11px] text-red-400 hover:text-red-300 font-bold ml-1 cursor-pointer flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Limpar busca
            </button>
          )}
        </div>
      </div>

      {/* BANNER PERSISTENTE DE ALARME DE TEMPO ESTOURADO */}
      {estatisticas.estourados > 0 && (
        <div className="p-3.5 rounded-2xl bg-red-600 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse border-2 border-red-400">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wide">
                ALERTA GUANTA: {estatisticas.estourados} PRESTADOR(ES) COM TEMPO ESTOURADO!
              </p>
              <p className="text-xs text-red-100">
                O limite de permanência foi ultrapassado. Verifique com a unidade ou registre a saída imediata.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={emitirAlertaSonoro}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Testar alarme sonoro"
            >
              <Volume2 className="w-4 h-4" /> Som
            </button>
            <button
              type="button"
              onClick={() => {
                setAbaAtiva('cadastros');
                setFiltroStatus('dentro');
              }}
              className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-black transition cursor-pointer shadow-sm uppercase tracking-wide"
            >
              Ver Estourados
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LISTA DINÂMICA DE PESSOAS (CARD DESIGN ULTRA-RÁPIDO COM 1-CLIQUE) */}
      {/* ========================================================================= */}
      {abaAtiva === 'cadastros' && (
        <div className="space-y-3.5">
          {cadastrosFiltrados.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm sm:text-base font-bold text-slate-300">Nenhum autorizado encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Nenhum registro corresponde aos filtros selecionados. Tente ajustar os filtros ou clique em "Nova Liberação" para cadastrar.
              </p>
              {permissoesOperador.cadastrar && (
                <button
                  type="button"
                  onClick={() => {
                    fecharModalCadastro();
                    setModalNovoCadastro(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs uppercase inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Autorizado</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {cadastrosFiltrados.map((item) => {
                const perfil = item.perfil_acesso || 'autorizado';
                const destinoFormatado = perfil === 'prestador_condominio' 
                  ? 'Área Comum / Condomínio' 
                  : formatarIdentificacaoUnidade(item.unidade, item.bloco, condoConfig?.tipo_estrutura);
                const vinculoOuEmpresa = item.empresa || item.parentesco_vinculo;
                const ehVisitante = perfil === 'autorizado';
                const infoValidade = checarValidade(item);
                const prestadorNoLocal = prestadoresAtivos.find((a: any) => (a.prestador_id || a.id) === item.id);
                const jaEstaDentro = Boolean(prestadorNoLocal);

                return (
                  <div
                    key={item.id}
                    className={`group bg-slate-900/90 hover:bg-slate-850 p-3 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs hover:shadow-md ${
                      infoValidade.expirou 
                        ? 'border-amber-500/30 bg-amber-950/10' 
                        : jaEstaDentro 
                        ? 'border-blue-500/40 bg-blue-950/15' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Foto e Informações Principais */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      
                      {/* Avatar Moderno */}
                      <div
                        onClick={() => (item.foto_rosto || item.foto_url) && setModalVisualizarFoto(item.foto_rosto || item.foto_url)}
                        className="relative w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 cursor-pointer group-hover:border-purple-500/50 transition-colors"
                        title={item.foto_rosto || item.foto_url ? 'Clique para ampliar a foto' : ''}
                      >
                        {(item.foto_rosto || item.foto_url) ? (
                          <ImagemOtimizada 
                            src={item.foto_rosto || item.foto_url} 
                            alt={item.nome_profissional || 'Autorizado'} 
                            permitirAmpliar={false}
                            className="w-full h-full object-cover" 
                          />
                        ) : ehVisitante ? (
                          <Users className="w-5 h-5 text-purple-400" />
                        ) : perfil === 'prestador_condominio' ? (
                          <Building2 className="w-5 h-5 text-amber-400" />
                        ) : (
                          <HardHat className="w-5 h-5 text-blue-400" />
                        )}

                        {/* Indicador de presença se estiver dentro */}
                        {jaEstaDentro && (
                          <span 
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-slate-900 shadow-sm animate-pulse"
                            title="Presente no local"
                          />
                        )}
                      </div>

                      {/* Dados e Badges */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Badge de Categoria */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${perfilBadge(perfil)}`}>
                            {perfilNome(perfil)}
                          </span>

                          {/* Validade */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${infoValidade.cor}`}>
                            {infoValidade.texto}
                          </span>

                          {/* Indicador No Local (Apenas se estiver dentro) */}
                          {jaEstaDentro && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                              <Timer className="w-3 h-3 text-blue-400" /> No Local
                            </span>
                          )}
                        </div>

                        {/* Nome Completo */}
                        <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate">
                          {item.nome_profissional || item.nome_completo}
                        </h4>

                        {/* Metadados Essenciais (Destino em destaque + Vínculo/Empresa + Documento) */}
                        <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                          {/* Destino destacado */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700/80 font-bold text-[11px]">
                            {perfil === 'prestador_condominio' ? <Building2 className="w-3 h-3 text-amber-400" /> : <Home className="w-3 h-3 text-amber-400" />}
                            <span>{destinoFormatado}</span>
                          </span>

                          {/* Vínculo ou Empresa */}
                          {vinculoOuEmpresa && (
                            <span className="text-slate-300 text-xs font-medium">
                              • {vinculoOuEmpresa}
                            </span>
                          )}

                          {/* Documento */}
                          {item.documento && (
                            <span className="text-slate-400 font-mono text-[11px]">
                              • {item.documento}
                            </span>
                          )}

                          {/* Placa do Veículo */}
                          {item.placa_veiculo && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/60">
                              <Car className="w-3 h-3 text-slate-400" />
                              {item.placa_veiculo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO DE STATUS E CRONÔMETRO (SE ESTIVER DENTRO) */}
                    {jaEstaDentro && (
                      <div className="w-full md:w-auto my-2 md:my-0 flex items-center gap-2">
                        {(() => {
                          const infoPerm = checarPermanencia(prestadorNoLocal || item);
                          return (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono border flex items-center gap-1.5 ${
                                infoPerm.estourado
                                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                                  : infoPerm.status === 'alerta'
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                                  : 'bg-blue-950 text-blue-300 border-blue-800'
                              }`}>
                                <Timer className="w-3.5 h-3.5" />
                                <span>{infoPerm.texto}</span>
                              </span>

                              {/* Crachá */}
                              {(prestadorNoLocal?.cracha || item.cracha_atribuido) && (
                                <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                                  Crachá: <strong className="text-white font-bold">#{prestadorNoLocal?.cracha || item.cracha_atribuido}</strong>
                                </span>
                              )}

                              {/* Prorrogação Rápida em 1-Clique */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => prorrogarRapidoPrestador(prestadorNoLocal || item, 30)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                                  title="Prorrogar 30 minutos em 1-clique"
                                >
                                  +30m
                                </button>
                                <button
                                  type="button"
                                  onClick={() => prorrogarRapidoPrestador(prestadorNoLocal || item, 60)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                                  title="Prorrogar 1 hora em 1-clique"
                                >
                                  +1h
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* SELEÇÃO RÁPIDA DE DURAÇÃO E CRACHÁ (SE PRESTADOR FORA) */}
                    {!jaEstaDentro && !ehVisitante && (
                      <div className="w-full md:w-auto my-2 md:my-0 flex items-center gap-2 flex-wrap bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                        {/* Chips de Duração 1h, 2h, 4h, 8h */}
                        <div className="flex items-center gap-1">
                          {[60, 120, 240, 480].map((mins) => {
                            const selecionado = (tempoLimitePorPrestador[item.id] || 240) === mins;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setTempoLimitePorPrestador((prev) => ({ ...prev, [item.id]: mins }))}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                                  selecionado
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                              >
                                {mins / 60}h
                              </button>
                            );
                          })}
                        </div>

                        {/* Input de Crachá Rápido */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-slate-500">#</span>
                          <input
                            type="text"
                            value={crachaPorPrestador[item.id] !== undefined ? crachaPorPrestador[item.id] : (item.cracha_atribuido || sugerirProximoCracha())}
                            onChange={(e) => setCrachaPorPrestador((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Crachá"
                            className="w-14 bg-slate-900 text-white text-xs font-mono font-bold text-center px-1.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                            title="Número do crachá para este acesso"
                          />
                        </div>
                      </div>
                    )}

                    {/* AÇÕES DE ENTRADA, SAÍDA E EDIÇÃO (TOUCH-FRIENDLY >= 44px) */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                      {/* Telefone / Ligação direta */}
                      {item.telefone && (
                        <a
                          href={`tel:${item.telefone}`}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center justify-center min-w-[42px] min-h-[42px]"
                          title={`Ligar para ${item.nome_profissional || item.nome_completo}`}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}

                      {/* Notificar WhatsApp */}
                      <button
                        type="button"
                        onClick={() => dispararWhatsAppEntrada(item)}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer flex items-center justify-center min-w-[42px] min-h-[42px]"
                        title="Enviar mensagem WhatsApp ao morador"
                        aria-label="Notificar WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {/* Editar Cadastro */}
                      {permissoesOperador.editar && (
                        <button
                          type="button"
                          onClick={() => abrirEdicaoCadastro(item)}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center justify-center min-w-[42px] min-h-[42px]"
                          title="Editar cadastro ou renovar validade"
                          aria-label="Editar cadastro"
                        >
                          <Pencil className="w-4 h-4 text-purple-400" />
                        </button>
                      )}

                      {/* BOTÕES DE FLUXO DE 1-CLIQUE */}
                      {ehVisitante ? (
                        /* VISITANTES: 1-CLIQUE ENTRADA DIRETA */
                        <button
                          type="button"
                          onClick={() => darEntradaRapidaVisitante(item)}
                          disabled={!permissoesOperador.darEntrada || loading}
                          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-2 transition shadow-sm cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 min-h-[44px]"
                          title="Registrar entrada do visitante em 1-clique"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Dar Entrada (1-Clique)</span>
                        </button>
                      ) : jaEstaDentro ? (
                        /* PRESTADOR DENTRO: 1-CLIQUE DAR SAÍDA */
                        <button
                          type="button"
                          onClick={() => darSaidaRapidaPrestador(prestadorNoLocal || item)}
                          disabled={!permissoesOperador.darSaida || loading}
                          className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-2 transition shadow-md shadow-red-600/20 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 min-h-[44px]"
                          title="Registrar saída imediata (devolve crachá)"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Dar Saída (1-Clique)</span>
                        </button>
                      ) : (
                        /* PRESTADOR FORA: 1-CLIQUE ENTRADA COM TEMPO E CRACHÁ */
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => darEntradaRapidaPrestador(item)}
                            disabled={!permissoesOperador.darEntrada || loading}
                            className={`font-black px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-2 transition shadow-md active:scale-95 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 min-h-[44px] ${
                              infoValidade.expirou
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                            }`}
                            title="Registrar entrada com o tempo e crachá selecionados"
                          >
                            <LogIn className="w-4 h-4" />
                            <span>{infoValidade.expirou ? 'Entrada (Vencido)' : 'Dar Entrada (1-Clique)'}</span>
                          </button>

                          {/* Botão de Modal Completo de Entrada (Se precisar de detalhes extras) */}
                          <button
                            type="button"
                            onClick={() => abrirModalEntradaPara(item)}
                            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer min-h-[44px]"
                            title="Abrir modal com observações personalizadas"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: PRESTADORES NO LOCAL (PERMANÊNCIA & CRONÔMETRO DE SAÍDA) */}
      {/* ========================================================================= */}
      {abaAtiva === 'permanencia' && (
        <div className="space-y-4">
          
          {/* Banner Explicativo */}
          <div className="bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
              <span>
                Prestadores em serviço no condomínio com controle de tempo: <strong className="text-white">{prestadoresAtivos.length}</strong>
              </span>
            </div>
            {estatisticas.estourados > 0 && (
              <span className="text-red-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {estatisticas.estourados} com tempo estourado!
              </span>
            )}
          </div>

          {/* Cards de Prestadores Ativos */}
          {prestadoresAtivos.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <Timer className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm sm:text-base font-bold text-slate-300">Nenhum prestador em permanência no momento</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Não há prestadores de serviço ou equipes de obra no condomínio com saída pendente. Visitantes e familiares possuem livre circulação e não requerem controle de permanência.
              </p>
              <button
                type="button"
                onClick={() => setAbaAtiva('cadastros')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Users className="w-4 h-4" />
                <span>Ver Lista de Autorizados</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {prestadoresAtivos.map((item) => {
                const infoPermanencia = checarPermanencia(item);
                const perfil = item.perfil_acesso || 'prestador_unidade';
                const horaEntradaFmt = item.data_hora_entrada 
                  ? new Date(item.data_hora_entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
                  : '--:--';

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl p-4 border transition duration-200 flex flex-col justify-between gap-3 text-white ${infoPermanencia.corFundo}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <div 
                            onClick={() => (item.foto_rosto || item.foto_url) && setModalVisualizarFoto(item.foto_rosto || item.foto_url)}
                            className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden shrink-0 cursor-pointer flex items-center justify-center text-slate-500"
                          >
                            {(item.foto_rosto || item.foto_url) ? (
                              <ImagemOtimizada 
                                src={item.foto_rosto || item.foto_url} 
                                alt={item.nome_completo || 'Prestador'} 
                                permitirAmpliar={false}
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <HardHat className="w-7 h-7 text-blue-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${perfilBadge(perfil)}`}>
                              {perfilNome(perfil)}
                            </span>
                            <h4 className="font-extrabold text-sm text-white truncate mt-1">
                              {item.nome_completo || item.nome_profissional}
                            </h4>
                            <p className="text-[11px] text-slate-300 truncate">
                              {item.empresa || 'Serviços'}
                            </p>
                          </div>
                        </div>

                        {item.cracha && (
                          <span className="px-2 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-black shrink-0">
                            Crachá {item.cracha}
                          </span>
                        )}
                      </div>

                      {/* Destino e Dados de Entrada */}
                      <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Destino:</span>
                          <span className="font-bold text-white">
                            {perfil === 'prestador_condominio' 
                              ? 'Área Comum / Condomínio' 
                              : formatarIdentificacaoUnidade(item.unidade, item.bloco, condoConfig?.tipo_estrutura)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Entrada registrada:</span>
                          <span className="font-mono text-emerald-400 font-bold">{horaEntradaFmt} ({item.operador_entrada_nome || 'Op'})</span>
                        </div>
                        {item.limite_permanencia_ate && (
                          <div className="flex items-center justify-between text-slate-200 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/25 mt-1">
                            <span className="text-amber-400 font-bold text-[11px]">Autorizado até:</span>
                            <span className="font-mono text-amber-200 font-black text-xs">
                              Até às {new Date(item.limite_permanencia_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Cronômetro Regressivo */}
                      <div className={`p-3 rounded-2xl border text-center space-y-1 ${
                        infoPermanencia.estourado 
                          ? 'bg-red-950/80 border-red-500 text-red-200' 
                          : infoPermanencia.status === 'alerta'
                          ? 'bg-amber-950/60 border-amber-500/70 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase">
                          <Timer className={`w-3.5 h-3.5 ${infoPermanencia.estourado ? 'animate-bounce text-red-400' : 'text-blue-400'}`} />
                          <span>{infoPermanencia.estourado ? 'Tempo Esgotado' : 'Permanência em Andamento'}</span>
                        </div>
                        <div className="font-mono text-sm sm:text-base font-black tracking-wider">
                          {infoPermanencia.texto}
                        </div>
                      </div>
                    </div>

                    {/* Ações: Dar Saída e Prorrogar */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => abrirModalSaidaPara(item)}
                          disabled={!permissoesOperador.darSaida}
                          className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-3 rounded-xl text-xs uppercase flex items-center justify-center gap-1 transition shadow-md active:scale-95 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Dar Saída</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => dispararWhatsAppEntrada(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition shadow-md active:scale-95 cursor-pointer"
                          title="Enviar aviso via WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setItemSelecionado(item);
                          setMinutosProrrogacao(60);
                          setModalProrrogar(true);
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1.5 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                      >
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Prorrogar Tempo (+1h / +2h)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Feed de Visitas de Hoje (Sem Saída Necessária) */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-purple-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Entradas de Visitantes e Familiares Registradas Hoje ({visitasHoje.length})</span>
              </h3>
              <span className="text-[10px] text-slate-400">Circulação livre • Sem necessidade de saída</span>
            </div>

            {visitasHoje.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">Nenhuma visita registrada na data de hoje.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {visitasHoje.slice(0, 10).map((v) => (
                  <div key={v.id} className="py-2.5 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-purple-400 border border-slate-700 shrink-0">
                        {v.foto_rosto ? (
                          <img src={v.foto_rosto} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <Users className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-white truncate">{v.nome_completo}</strong>
                        <span className="text-[11px] text-slate-400">
                          {formatarIdentificacaoUnidade(v.unidade, v.bloco, condoConfig?.tipo_estrutura)} • {v.empresa || v.parentesco_vinculo || 'Visita'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <span className="font-mono text-emerald-400 font-bold text-[11px]">
                        Entrada: {v.data_hora_entrada ? new Date(v.data_hora_entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </span>
                      <button
                        type="button"
                        onClick={() => dispararWhatsAppEntrada(v)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
                        title="Enviar WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: HISTÓRICO GERAL AUDITADO & ACESSOS RECENTES */}
      {/* ========================================================================= */}
      {abaAtiva === 'historico' && (
        <div className="space-y-4">
          <HistoricoAcessoPainelPrincipal
            condominioId={idCondominio}
            usuarioLogado={usuarioLogado}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO CADASTRO OU EDIÇÃO DE AUTORIZADO */}
      {/* ========================================================================= */}
      {(modalNovoCadastro || modalEditarCadastro) && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 text-white space-y-4 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                  modalEditarCadastro 
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    : perfilAcesso === 'autorizado'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : perfilAcesso === 'prestador_unidade'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {modalEditarCadastro ? (
                    <Pencil className="w-5 h-5" />
                  ) : perfilAcesso === 'autorizado' ? (
                    <Users className="w-5 h-5" />
                  ) : perfilAcesso === 'prestador_unidade' ? (
                    <HardHat className="w-5 h-5" />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg text-white uppercase">
                      {modalEditarCadastro 
                        ? 'Editar Cadastro / Liberação' 
                        : perfilAcesso === 'autorizado'
                          ? 'Nova Liberação: Visitante'
                          : perfilAcesso === 'prestador_unidade'
                            ? 'Nova Liberação: Prestador Un'
                            : 'Nova Liberação: Prestador Cond'}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider hidden sm:inline-block ${
                      perfilAcesso === 'autorizado'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        : perfilAcesso === 'prestador_unidade'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {perfilAcesso === 'autorizado' ? 'Visitante' : perfilAcesso === 'prestador_unidade' ? 'Prestador Un' : 'Prestador Cond'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {modalEditarCadastro 
                      ? 'Atualize dados, fotos ou validade' 
                      : perfilAcesso === 'autorizado'
                        ? 'Formulário de liberação para amigos, convidados e familiares da unidade'
                        : perfilAcesso === 'prestador_unidade'
                          ? 'Formulário de liberação para obras, diaristas e reformas particulares da unidade'
                          : 'Formulário de liberação para manutenção predial e obras em áreas comuns'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fecharModalCadastro}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BUSCA RÁPIDA DE REUTILIZAÇÃO (Apenas em novo cadastro) */}
            {!modalEditarCadastro && (
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5 relative">
                <label className="block text-[11px] font-black uppercase text-indigo-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Reutilizar Cadastro de Quem já Visitou Anteriormente
                </label>
                <input
                  type="text"
                  value={termoReutilizacao}
                  onChange={(e) => setTermoReutilizacao(e.target.value)}
                  placeholder="Digite nome ou CPF/RG para autocompletar..."
                  className="w-full bg-slate-900 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
                {sugestoesReutilizacao.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-2xl mt-1 shadow-2xl z-30 overflow-hidden divide-y divide-slate-800">
                    {sugestoesReutilizacao.map((sug) => (
                      <div
                        key={sug.id}
                        onClick={() => selecionarParaReutilizar(sug)}
                        className="p-2.5 hover:bg-indigo-950/60 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div className="flex items-center gap-2">
                          <strong className="block text-white">{sug.nome_profissional || sug.nome_completo}</strong>
                          <span className="text-[10px] text-slate-400">Doc: {sug.documento || 'N/A'} • {sug.empresa || sug.unidade}</span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-400">Reutilizar →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={modalEditarCadastro ? salvarEdicaoCadastro : salvarCadastro} className="space-y-3.5">
              
              {/* Nome Completo + Botão OCR */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase text-slate-300">
                    Nome Completo *
                  </label>
                  <button
                    type="button"
                    onClick={() => setModalOcrAberto(true)}
                    className="text-purple-400 hover:text-purple-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Scan className="w-3.5 h-3.5" /> Ler CNH/RG com IA (OCR)
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  placeholder="Nome completo da pessoa..."
                  className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Documento e Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                    Documento ({tipoDocumento})
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(e.target.value)}
                      className="bg-slate-950 text-white text-xs p-2 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      <option value="CPF">CPF</option>
                      <option value="RG">RG</option>
                      <option value="CNH">CNH</option>
                      <option value="Outro">Outro</option>
                    </select>
                    <input
                      type="text"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      placeholder="Número do documento..."
                      className="flex-1 bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Campos específicos por perfil */}
              {perfilAcesso === 'autorizado' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                      Parentesco ou Vínculo
                    </label>
                    <select
                      value={parentescoVinculo}
                      onChange={(e) => setParentescoVinculo(e.target.value)}
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Selecione o vínculo...</option>
                      {OPCOES_PARENTESCO.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                      Placa do Veículo (se houver)
                    </label>
                    <input
                      type="text"
                      value={placaVeiculo}
                      onChange={(e) => setPlacaVeiculo(e.target.value)}
                      placeholder="ABC-1234"
                      className="w-full bg-slate-950 text-white font-mono uppercase text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                      Empresa Prestadora
                    </label>
                    <input
                      type="text"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      placeholder="Nome da empresa ou autônomo..."
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                      Placa do Veículo
                    </label>
                    <input
                      type="text"
                      value={placaVeiculo}
                      onChange={(e) => setPlacaVeiculo(e.target.value)}
                      placeholder="ABC-1234"
                      className="w-full bg-slate-950 text-white font-mono uppercase text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Unidade / Destino */}
              {perfilAcesso !== 'prestador_condominio' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                      {eEstruturaCasas ? 'Número da Casa *' : 'Unidade / Apartamento *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={unidade}
                      onChange={(e) => setUnidade(e.target.value)}
                      placeholder={eEstruturaCasas ? "Ex: Casa 45" : "Ex: 101, 102..."}
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {!eEstruturaCasas && (
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                        Bloco / Torre
                      </label>
                      <input
                        type="text"
                        value={bloco}
                        onChange={(e) => setBloco(e.target.value)}
                        placeholder="Ex: Bloco A"
                        className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Foto do Rosto */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <label className="block text-xs font-black uppercase text-emerald-400 flex items-center justify-between">
                  <span>Foto do Rosto (Segurança da Guarita)</span>
                  {fotoRosto && <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-bold"><CheckCircle2 className="w-3 h-3" /> Foto anexada</span>}
                </label>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-slate-500">
                    {fotoRosto ? (
                      <img src={fotoRosto} alt="Rosto" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1">
                    <label className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 inline-flex items-center gap-1.5 transition cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{fotoRosto ? 'Trocar Foto do Rosto' : 'Tirar Foto ou Carregar'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleFotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Validade da Autorização */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <label className="block text-xs font-black uppercase text-amber-400">
                  Prazo de Validade da Liberação:
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoValidade('hoje')}
                    className={`p-2 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                      tipoValidade === 'hoje'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoValidade('7_dias')}
                    className={`p-2 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                      tipoValidade === '7_dias'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    7 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoValidade('30_dias')}
                    className={`p-2 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                      tipoValidade === '30_dias'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    30 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoValidade('permanente')}
                    className={`p-2 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                      tipoValidade === 'permanente'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Permanente ♾️
                  </button>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={fecharModalCadastro}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs uppercase transition shadow-lg active:scale-95 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {loading ? 'Salvando...' : (modalEditarCadastro ? 'Salvar Alterações' : 'Salvar Liberação')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRO DE ENTRADA INTELIGENTE */}
      {/* - VISITANTES/FAMÍLIA: SÓ DAR ENTRADA, NÃO PEDE SAÍDA! */}
      {/* - PRESTADORES: TEMPO MÁXIMO, CRACHÁ E SAÍDA CONTROLADA */}
      {/* ========================================================================= */}
      {modalEntrada && itemSelecionado && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 text-white space-y-4 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                  itemSelecionado.perfil_acesso === 'autorizado'
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white uppercase">
                    {itemSelecionado.perfil_acesso === 'autorizado' 
                      ? 'Registrar Entrada de Visitante / Família' 
                      : 'Registrar Entrada de Prestador de Serviço'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {itemSelecionado.perfil_acesso === 'autorizado' 
                      ? 'Livre permanência (não necessita de saída)' 
                      : 'Controle de permanência interna e devolução de crachá'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalEntrada(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo da Pessoa */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 border border-slate-700">
                {itemSelecionado.foto_rosto ? (
                  <img src={itemSelecionado.foto_rosto} alt="" className="w-full h-full object-cover" />
                ) : itemSelecionado.perfil_acesso === 'autorizado' ? (
                  <Users className="w-6 h-6 text-purple-400" />
                ) : (
                  <HardHat className="w-6 h-6 text-blue-400" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-white text-sm truncate">
                  {itemSelecionado.nome_profissional || itemSelecionado.nome_completo}
                </h4>
                <p className="text-xs text-slate-300">
                  {itemSelecionado.empresa || itemSelecionado.parentesco_vinculo || 'Visitante'} • Destino: <strong className="text-amber-300">{formatarIdentificacaoUnidade(itemSelecionado.unidade, itemSelecionado.bloco, condoConfig?.tipo_estrutura)}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={confirmarEntrada} className="space-y-4">
              
              {/* Se for Visitante/Família: Informativo de Livre Acesso */}
              {itemSelecionado.perfil_acesso === 'autorizado' ? (
                <div className="bg-purple-950/40 border border-purple-500/40 p-4 rounded-2xl text-xs space-y-1.5">
                  <span className="font-black text-purple-300 block flex items-center gap-1.5 uppercase text-xs">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    Livre Circulação • Sem Necessidade de Saída
                  </span>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    A entrada deste visitante/familiar será auditada no sistema. Ele não possui limite de horas e a portaria não precisará dar saída quando ele for embora.
                  </p>
                </div>
              ) : (
                /* Se for Prestador: Tempo Máximo de Permanência */
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase text-amber-400 flex items-center justify-between">
                    <span>Tempo Máximo de Permanência do Prestador:</span>
                    <span className="text-slate-400 font-normal">
                      {tempoMaximoCustomizado ? `${tempoMaximoCustomizado} min` : `${Math.floor(tempoMaximoMinutos / 60)}h`}
                    </span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => { setTempoMaximoMinutos(60); setTempoMaximoCustomizado(''); }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                        tempoMaximoMinutos === 60 && !tempoMaximoCustomizado
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      1 Hora
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTempoMaximoMinutos(120); setTempoMaximoCustomizado(''); }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                        tempoMaximoMinutos === 120 && !tempoMaximoCustomizado
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      2 Horas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTempoMaximoMinutos(240); setTempoMaximoCustomizado(''); }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                        tempoMaximoMinutos === 240 && !tempoMaximoCustomizado
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      4 Horas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTempoMaximoMinutos(480); setTempoMaximoCustomizado(''); }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                        tempoMaximoMinutos === 480 && !tempoMaximoCustomizado
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      8 Horas (Obra)
                    </button>
                  </div>

                  {/* Horário limite calculado */}
                  <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" /> Horário Limite de Permanência:
                    </span>
                    <span className="font-mono text-amber-200 font-black">
                      Até às {new Date(Date.now() + (tempoMaximoCustomizado ? parseInt(tempoMaximoCustomizado, 10) || 240 : tempoMaximoMinutos) * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}

              {/* Crachá (apenas para prestadores) e Placa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                {itemSelecionado.perfil_acesso !== 'autorizado' && (
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-300 mb-1 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-amber-400" /> Crachá Físico Entregue
                    </label>
                    <input
                      type="text"
                      value={crachaEntrada}
                      onChange={(e) => setCrachaEntrada(e.target.value)}
                      placeholder="Ex: #12"
                      className="w-full bg-slate-900 text-white font-mono font-bold text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <div className={itemSelecionado.perfil_acesso === 'autorizado' ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] font-black uppercase text-slate-300 mb-1 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-emerald-400" /> Placa do Veículo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={placaEntrada}
                    onChange={(e) => setPlacaEntrada(e.target.value)}
                    placeholder="ABC-1234"
                    className="w-full bg-slate-900 text-white font-mono uppercase text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => dispararWhatsAppEntrada(itemSelecionado)}
                  className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Avisar WhatsApp</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalEntrada(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`font-black px-5 py-2.5 rounded-xl text-xs uppercase transition shadow-lg active:scale-95 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 ${
                      itemSelecionado.perfil_acesso === 'autorizado'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                    }`}
                  >
                    {loading ? 'Registrando...' : 'Confirmar Entrada'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SAÍDA DE PRESTADOR & DEVOLUÇÃO DE CRACHÁ */}
      {/* ========================================================================= */}
      {modalSaida && itemSelecionado && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base uppercase text-white flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-500" />
                Registrar Saída do Prestador
              </h3>
              <button onClick={() => setModalSaida(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <strong className="block text-white text-sm">
                {itemSelecionado.nome_completo || itemSelecionado.nome_profissional}
              </strong>
              <p className="text-xs text-slate-400">
                Destino: {formatarIdentificacaoUnidade(itemSelecionado.unidade, itemSelecionado.bloco, condoConfig?.tipo_estrutura)}
              </p>
              {itemSelecionado.cracha && (
                <p className="text-xs text-amber-300 font-mono font-bold pt-1">
                  Crachá entregue na portaria: #{itemSelecionado.cracha}
                </p>
              )}
            </div>

            {itemSelecionado.cracha && (
              <label className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={crachaDevolvido}
                  onChange={(e) => setCrachaDevolvido(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500"
                />
                <span className="text-xs font-bold text-white">
                  Confirmar devolução do crachá #{itemSelecionado.cracha} na guarita
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalSaida(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarSaida}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase transition shadow-lg active:scale-95 cursor-pointer"
              >
                {loading ? 'Registrando...' : 'Confirmar Saída'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRORROGAR TEMPO DE PRESTADOR */}
      {/* ========================================================================= */}
      {modalProrrogar && itemSelecionado && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Prorrogação de Tempo de Prestador
              </h3>
              <button onClick={() => setModalProrrogar(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase">
                Adicionar mais tempo de permanência:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { m: 30, lbl: '+30m' },
                  { m: 60, lbl: '+1h' },
                  { m: 120, lbl: '+2h' },
                  { m: 240, lbl: '+4h' }
                ].map(opc => (
                  <button
                    key={opc.m}
                    type="button"
                    onClick={() => { setMinutosProrrogacao(opc.m); setProrrogarCustomizado(''); }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      minutosProrrogacao === opc.m && !prorrogarCustomizado
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' 
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {opc.lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalProrrogar(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleProrrogarTempo}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase cursor-pointer"
              >
                {loading ? 'Salvando...' : 'Confirmar Prorrogação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GESTÃO DE PERMISSÕES & REGRAS DO MÓDULO */}
      {/* ========================================================================= */}
      {modalPermissoes && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase text-white">
                    Gestão de Acessos & Permissões
                  </h3>
                  <p className="text-xs text-slate-400">
                    Regras operacionais configuradas para a portaria
                  </p>
                </div>
              </div>

              <button onClick={() => setModalPermissoes(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status do Operador Conectado */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Operador Atual:</span>
                <strong className="text-white">{operadorNome}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Perfil de Acesso:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                  {permissoesOperador.perfil}
                </span>
              </div>
            </div>

            {/* Matriz de Permissões do Operador */}
            <div className="space-y-1.5 text-xs">
              <span className="block font-black uppercase text-slate-400 text-[10px]">
                Suas Permissões neste Módulo:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Visualizar</span>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Dar Entrada</span>
                  {permissoesOperador.darEntrada ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Dar Saída</span>
                  {permissoesOperador.darSaida ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Cadastrar</span>
                  {permissoesOperador.cadastrar ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Editar</span>
                  {permissoesOperador.editar ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Excluir</span>
                  {permissoesOperador.excluir ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-red-400" />}
                </div>
              </div>
            </div>

            {/* Regras Operacionais Claras */}
            <div className="bg-purple-950/25 border border-purple-500/30 p-3.5 rounded-2xl text-xs space-y-2">
              <span className="font-bold text-purple-300 block flex items-center gap-1.5 uppercase text-[11px]">
                <Info className="w-4 h-4 text-purple-400" /> Política de Acessos:
              </span>
              <ul className="text-slate-300 text-[11px] space-y-1 list-disc pl-4">
                <li><strong>Visitantes & Família:</strong> Só precisa dar entrada. Sem controle de permanência ou exigência de saída.</li>
                <li><strong>Prestadores da Unidade & Condomínio:</strong> Permanência com limite de horário, alarme de estouro e devolução obrigatória de crachá na saída.</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalPermissoes(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OCR */}
      {modalOcrAberto && (
        <ModalLeitorDocumentoOCR
          aberto={modalOcrAberto}
          onFechar={() => setModalOcrAberto(false)}
          onDadosConfirmados={handleOcrConfirmado}
        />
      )}

      {/* MODAL VISUALIZAR FOTO EXPANDIDA */}
      {modalVisualizarFoto && (
        <div 
          onClick={() => setModalVisualizarFoto(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <div className="max-w-md w-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 p-2">
            <img src={modalVisualizarFoto} alt="Foto Expandida" className="w-full h-auto max-h-[80vh] object-contain rounded-2xl mx-auto" />
            <p className="text-center text-xs text-slate-400 pt-2">Clique em qualquer lugar para fechar</p>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAÇÃO DE HORÁRIOS DE OBRAS E MUDANÇAS */}
      {modalConfigHorarios && (
        <ModalConfigHorariosObrasMudancas
          aberto={modalConfigHorarios}
          onFechar={() => setModalConfigHorarios(false)}
          condominioId={idCondominio}
          condominioNome={condoConfig?.nome}
          operadorNome={operadorNome}
        />
      )}

      {/* ========================================================================= */}
      {/* BOTÃO FLUTUANTE DE NOVA LIBERAÇÃO NO CANTO INFERIOR DIREITO (ACIMA DO MENU) */}
      {/* ========================================================================= */}
      {permissoesOperador.cadastrar && !modalNovoCadastro && !modalEditarCadastro && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-40 flex flex-col items-end">
          {/* Menu Suspenso Speed-Dial com os 3 Tipos de Liberação */}
          {fabLiberacaoAberto && (
            <>
              {/* Backdrop para fechar ao clicar fora */}
              <div
                className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150"
                onClick={() => setFabLiberacaoAberto(false)}
              />

              <div className="relative z-40 mb-3 space-y-2 w-72 sm:w-84 animate-in slide-in-from-bottom-3 zoom-in-95 duration-150">
                <div className="bg-slate-900/98 backdrop-blur-xl p-3.5 rounded-3xl shadow-2xl border border-slate-700/80 space-y-2.5 text-white">
                  <div className="px-1 pb-2 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Nova Liberação de Acesso
                      </span>
                      <p className="text-[10px] text-slate-400">Escolha o formulário de liberação:</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFabLiberacaoAberto(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                      title="Fechar"
                      aria-label="Fechar opções"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Opção 1: Visitante */}
                  <button
                    type="button"
                    onClick={() => abrirNovaLiberacao('autorizado')}
                    className="w-full p-2.5 rounded-2xl border border-slate-800 hover:border-purple-500/80 bg-slate-950/70 hover:bg-purple-950/40 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-xs group-hover:text-purple-300">
                            Visitante
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Família / Amigos
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Amigos e familiares • Sem pendência de saída
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 shrink-0 group-hover:translate-x-1 transition" />
                  </button>

                  {/* Opção 2: Prestador Un */}
                  <button
                    type="button"
                    onClick={() => abrirNovaLiberacao('prestador_unidade')}
                    className="w-full p-2.5 rounded-2xl border border-slate-800 hover:border-blue-500/80 bg-slate-950/70 hover:bg-blue-950/40 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                        <HardHat className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-xs group-hover:text-blue-300">
                            Prestador Un
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Unidade
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Reformas particulares, obras e diaristas
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 shrink-0 group-hover:translate-x-1 transition" />
                  </button>

                  {/* Opção 3: Prestador Cond */}
                  <button
                    type="button"
                    onClick={() => abrirNovaLiberacao('prestador_condominio')}
                    className="w-full p-2.5 rounded-2xl border border-slate-800 hover:border-amber-500/80 bg-slate-950/70 hover:bg-amber-950/40 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-xs group-hover:text-amber-300">
                            Prestador Cond
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Condomínio
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Manutenção predial e obras em áreas comuns
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0 group-hover:translate-x-1 transition" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Botão Flutuante Principal (FAB) - Apenas Ícone */}
          <button
            type="button"
            onClick={() => setFabLiberacaoAberto(prev => !prev)}
            className={`relative z-40 group w-14 h-14 rounded-2xl shadow-2xl transition-all duration-200 border-2 cursor-pointer active:scale-95 flex items-center justify-center ${
              fabLiberacaoAberto
                ? 'bg-slate-900 text-white border-slate-700 shadow-slate-950/50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 hover:scale-105 shadow-emerald-500/30'
            }`}
            title={fabLiberacaoAberto ? 'Fechar opções' : 'Nova Liberação de Acesso'}
            aria-label="Nova Liberação de Acesso"
          >
            {fabLiberacaoAberto ? (
              <X className="w-6 h-6 text-white transition-transform duration-200" />
            ) : (
              <UserPlus className="w-6 h-6 text-slate-950 transition-transform duration-200 group-hover:scale-110" />
            )}
          </button>
        </div>
      )}

    </div>
  );
}
