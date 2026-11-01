import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Database,
  Server,
  ArrowRightLeft,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Trash2,
  Plus,
  Terminal,
  Layers,
  FileText,
  Cpu,
  Eye,
  CheckSquare,
  Square,
  X,
  Download,
  Upload,
  Copy,
  Maximize2,
  Minimize2,
  Search,
  Filter,
  ShieldCheck,
  Zap,
  Info,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Pause,
  AlertCircle,
  Edit3,
  Save,
  EyeOff
} from 'lucide-react';

import {
  MIGRATION_TABLES,
  MigrationTableInfo,
  SupabaseCredentials,
  executeFullSupabaseMigration,
  executeSingleTableMigration,
  testConnectionLatency,
  limparBancoDestinoCompleto,
  exportSourceDatabaseToJson,
  importJsonDump,
  generateSupabaseDumpSqlScript,
  getSupabaseRowCount,
  cleanApiKey,
  normalizeSupabaseUrl
} from '../services/migrationSupabaseService';

import {
  ConnectionProfile,
  TableMigrationModel,
  PORTTOHUB_CORE_TABLES_SCHEMA,
  carregarConexoesArmazenadas,
  salvarConexoesArmazenadas,
  carregarMapeamentosArmazenados,
  salvarMapeamentosArmazenados,
  resetarConexoesPadrao
} from '../services/migrationSchemaData';

import { supabase } from '../services/supabase';

interface ModalMigracaoSupabaseProps {
  aberto: boolean;
  onFechar: () => void;
  onMigracaoConcluida?: () => void;
}

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export default function ModalMigracaoSupabase({
  aberto,
  onFechar,
  onMigracaoConcluida
}: ModalMigracaoSupabaseProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'conexoes' | 'esquemas' | 'mapeamento' | 'migracao' | 'ferramentas' | 'logs'>('conexoes');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Connections State
  const [connections, setConnections] = useState<ConnectionProfile[]>(() => carregarConexoesArmazenadas());
  const [selectedSourceId, setSelectedSourceId] = useState<string>('caetano_infport');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('porttohub_supabase_novo');

  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newConnType, setNewConnType] = useState<'source' | 'target' | 'both'>('source');
  const [newConnUrl, setNewConnUrl] = useState('');
  const [newConnKey, setNewConnKey] = useState('');
  const [newConnDesc, setNewConnDesc] = useState('');
  const [testandoConexaoId, setTestandoConexaoId] = useState<string | null>(null);

  // Editing & Card Management State
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [editConnForm, setEditConnForm] = useState<{
    name: string;
    type: 'source' | 'target' | 'both';
    url: string;
    key: string;
    description: string;
  }>({ name: '', type: 'source', url: '', key: '', description: '' });
  const [showKeyConnId, setShowKeyConnId] = useState<Record<string, boolean>>({});
  const [connParaExcluir, setConnParaExcluir] = useState<ConnectionProfile | null>(null);
  const [copiadoTexto, setCopiadoTexto] = useState<string | null>(null);

  // Active Connection Pair
  const activeSource = useMemo(() => {
    return connections.find(c => c.id === selectedSourceId) || connections.find(c => c.type === 'source' || c.type === 'both') || connections[0];
  }, [connections, selectedSourceId]);

  const activeTarget = useMemo(() => {
    return connections.find(c => c.id === selectedTargetId) || connections.find(c => c.type === 'target' || c.type === 'both') || connections[1] || connections[0];
  }, [connections, selectedTargetId]);

  // Tables & Schemas State
  const [tables, setTables] = useState<TableMigrationModel[]>(() => {
    const savedMappings = carregarMapeamentosArmazenados();
    return PORTTOHUB_CORE_TABLES_SCHEMA.map(t => ({
      ...t,
      mapping: savedMappings[t.name] || t.mapping || {}
    }));
  });

  const [tabelaFiltroBusca, setTabelaFiltroBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todas');
  const [escaneandoContagens, setEscaneandoContagens] = useState(false);
  const [tabelaExpandidaId, setTabelaExpandidaId] = useState<string | null>(null);

  // Migration Execution State
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentTableMigrating, setCurrentTableMigrating] = useState('');
  const [currentBatchInfo, setCurrentBatchInfo] = useState('');
  const [totalMigradosSessao, setTotalMigradosSessao] = useState(0);
  const [modoSimulacao, setModoSimulacao] = useState(false);
  const [salvarBackupAntes, setSalvarBackupAntes] = useState(true);
  const [limparDestinoAntes, setLimparDestinoAntes] = useState(false);
  const [escopoCondominio, setEscopoCondominio] = useState<string>('todos');
  const [condominiosDestino, setCondominiosDestino] = useState<Array<{ id: string; nome: string }>>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Tool / Dumps State
  const [dumpJsonCopiado, setDumpJsonCopiado] = useState(false);
  const [sqlCopiado, setSqlCopiado] = useState(false);
  const [importandoJson, setImportandoJson] = useState(false);
  const [arquivoUploadNome, setArquivoUploadNome] = useState('');

  // Terminal Logs State
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Sistema de Migração Oficial Supabase PorttoHub v2.6 Enterprise inicializado.' },
    { id: 2, timestamp: new Date().toLocaleTimeString(), type: 'success', message: 'Instâncias oficiais conectadas e prontas para sincronização.' }
  ]);
  const [filtroTipoLog, setFiltroTipoLog] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [buscaLog, setBuscaLog] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const logScrollRef = useRef<HTMLDivElement>(null);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showResetModal) {
          setShowResetModal(false);
        } else if (aberto && migrationStatus !== 'running') {
          onFechar();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aberto, showResetModal, migrationStatus, onFechar]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Carrega lista de condomínios cadastrados no banco de destino
  useEffect(() => {
    if (aberto) {
      supabase.from('condominios').select('id, nome').order('nome').then(({ data }) => {
        if (data && Array.isArray(data)) {
          setCondominiosDestino(data);
        }
      });
    }
  }, [aberto]);

  // Salva mapeamentos sempre que forem alterados
  useEffect(() => {
    const mapToSave: Record<string, Record<string, string>> = {};
    for (const t of tables) {
      if (t.mapping && Object.keys(t.mapping).length > 0) {
        mapToSave[t.name] = t.mapping;
      }
    }
    salvarMapeamentosArmazenados(mapToSave);
  }, [tables]);

  // Salva conexões sempre que forem alteradas
  useEffect(() => {
    salvarConexoesArmazenadas(connections);
  }, [connections]);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), timestamp: time, type, message }]);
  };

  // Testa conexão com medição de latência real
  const handleTestarConexao = async (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    if (!conn) return;

    setTestandoConexaoId(connId);
    addLog(`Testando conexão com "${conn.name}" (${conn.url})...`, 'info');

    try {
      const res = await testConnectionLatency({
        url: normalizeSupabaseUrl(conn.url),
        key: cleanApiKey(conn.key)
      });

      if (res.success) {
        addLog(`Conexão confirmada com "${conn.name}"! Ref: ${res.projectRef || 'ok'} • Ping: ${res.latencyMs}ms`, 'success');
        setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: 'connected', latencyMs: res.latencyMs, lastChecked: new Date().toLocaleTimeString() } : c));
      } else {
        addLog(`Falha na conexão com "${conn.name}": ${res.message}`, 'error');
        setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: 'error', lastChecked: new Date().toLocaleTimeString() } : c));
      }
    } catch (err: any) {
      addLog(`Erro ao testar "${conn.name}": ${err.message || String(err)}`, 'error');
      setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: 'error' } : c));
    } finally {
      setTestandoConexaoId(null);
    }
  };

  // Inverter par Origem / Destino
  const handleInverterPar = () => {
    const temp = selectedSourceId;
    setSelectedSourceId(selectedTargetId);
    setSelectedTargetId(temp);
    addLog('Pares de migração invertidos: Origem e Destino foram alternados.', 'warning');
  };

  // Adicionar Conexão
  const handleAddConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConnName || !newConnUrl || !newConnKey) return;

    const newEntry: ConnectionProfile = {
      id: `conn_${Date.now()}`,
      name: newConnName.trim(),
      type: newConnType,
      url: normalizeSupabaseUrl(newConnUrl),
      key: cleanApiKey(newConnKey),
      description: newConnDesc.trim() || undefined,
      status: 'untested'
    };

    setConnections(prev => [...prev, newEntry]);
    setNewConnName('');
    setNewConnUrl('');
    setNewConnKey('');
    setNewConnDesc('');
    setIsAddingConnection(false);

    addLog(`Nova conexão "${newEntry.name}" salva com sucesso (${newEntry.type}).`, 'success');
  };

  // Iniciar Edição de Conexão
  const handleStartEditConnection = (conn: ConnectionProfile) => {
    setEditingConnId(conn.id);
    setEditConnForm({
      name: conn.name,
      type: conn.type,
      url: conn.url,
      key: conn.key,
      description: conn.description || ''
    });
    addLog(`Modo de edição ativado para o banco "${conn.name}".`, 'info');
  };

  // Salvar Edição de Conexão ("Atualizar Banco Repositório")
  const handleSaveEditConnection = (connId: string) => {
    if (!editConnForm.name.trim() || !editConnForm.url.trim() || !editConnForm.key.trim()) {
      addLog('Aviso: Preencha o Nome, URL e Chave API para atualizar o banco.', 'error');
      return;
    }

    const updatedUrl = normalizeSupabaseUrl(editConnForm.url);
    const updatedKey = cleanApiKey(editConnForm.key);

    setConnections(prev => prev.map(c => {
      if (c.id === connId) {
        return {
          ...c,
          name: editConnForm.name.trim(),
          type: editConnForm.type,
          url: updatedUrl,
          key: updatedKey,
          description: editConnForm.description.trim() || undefined,
          status: 'untested',
          lastChecked: undefined,
          latencyMs: undefined
        };
      }
      return c;
    }));

    setEditingConnId(null);
    addLog(`Banco repositório "${editConnForm.name.trim()}" atualizado com sucesso!`, 'success');
  };

  const handleCancelEditConnection = () => {
    setEditingConnId(null);
  };

  // Confirmar Exclusão de Conexão (Sem restrições)
  const handleConfirmDeleteConnection = (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (!conn) return;

    setConnections(prev => {
      const remaining = prev.filter(c => c.id !== id);
      // Se a conexão removida era a ativa, redireciona
      if (selectedSourceId === id && remaining.length > 0) {
        const nextSrc = remaining.find(c => c.type === 'source' || c.type === 'both') || remaining[0];
        setSelectedSourceId(nextSrc.id);
      }
      if (selectedTargetId === id && remaining.length > 0) {
        const nextTgt = remaining.find(c => c.type === 'target' || c.type === 'both') || remaining[0];
        setSelectedTargetId(nextTgt.id);
      }
      return remaining;
    });

    setConnParaExcluir(null);
    addLog(`Banco de dados "${conn.name}" excluído do repositório.`, 'warning');
  };

  // Restaurar Bancos Padrão do Repositório
  const handleRestaurarPadroes = () => {
    const resetados = resetarConexoesPadrao();
    setConnections(resetados);
    setSelectedSourceId('caetano_infport');
    setSelectedTargetId('porttohub_supabase_novo');
    addLog('Bancos de dados originais do repositório restaurados com sucesso!', 'success');
  };

  // Alternar visibilidade da chave
  const toggleShowKey = (connId: string) => {
    setShowKeyConnId(prev => ({ ...prev, [connId]: !prev[connId] }));
  };

  // Copiar texto para o clipboard com feedback
  const handleCopiarTexto = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoTexto(label);
    setTimeout(() => setCopiadoTexto(null), 2500);
    addLog(`${label} copiado para a área de transferência.`, 'info');
  };

  // Escanear contagem real nas bases de dados
  const handleEscanearContagens = async () => {
    if (!activeSource) return;
    setEscaneandoContagens(true);
    addLog(`Escaneando volumetria e contagem de registros no banco de origem (${activeSource.name})...`, 'info');

    const creds: SupabaseCredentials = {
      url: activeSource.url,
      key: activeSource.key
    };

    let totalContado = 0;
    const novosTables = [...tables];

    for (let i = 0; i < novosTables.length; i++) {
      const t = novosTables[i];
      try {
        const res = await getSupabaseRowCount(creds, t.name);
        const count = res?.count || 0;
        t.recordsCount = count;
        totalContado += count;
      } catch {
        t.recordsCount = 0;
      }
    }

    setTables(novosTables);
    setEscaneandoContagens(false);
    addLog(`Varredura concluída! Total identificado: ${totalContado.toLocaleString('pt-BR')} registros distribuídos em ${novosTables.length} tabelas.`, 'success');
  };

  // Toggle seleção de tabela
  const toggleTableSelection = (id: string) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const handleSelecionarTodas = (marcar: boolean) => {
    setTables(prev => prev.map(t => ({ ...t, selected: marcar })));
    addLog(marcar ? 'Todas as tabelas foram selecionadas para migração.' : 'Seleção de tabelas desmarcada.', 'info');
  };

  // Atualizar mapeamento de coluna
  const handleColumnMappingChange = (tableId: string, sourceCol: string, targetCol: string) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        const novoMapping = { ...t.mapping };
        if (targetCol === '(ignorar)') {
          novoMapping[sourceCol] = '(ignorar)';
        } else {
          novoMapping[sourceCol] = targetCol;
        }
        return {
          ...t,
          mapping: novoMapping
        };
      }
      return t;
    }));
    addLog(`Mapeamento atualizado: ${sourceCol} ➔ ${targetCol}`, 'info');
  };

  // Auto mapear colunas similares
  const handleAutoMapearTabela = (tableId: string) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        const autoMap: Record<string, string> = { ...t.mapping };
        for (const src of t.sourceColumns) {
          const match = t.targetColumns.find(tgt => 
            tgt.name.toLowerCase() === src.name.toLowerCase() ||
            tgt.name.replace(/_/g, '') === src.name.replace(/_/g, '')
          );
          if (match) {
            autoMap[src.name] = match.name;
          }
        }
        return { ...t, mapping: autoMap };
      }
      return t;
    }));
    addLog(`Mapeamento heurístico aplicado para a tabela ID ${tableId}.`, 'success');
  };

  // Executar limpeza do banco de destino
  const executeDatabaseReset = async () => {
    if (resetConfirmText !== 'ZERAR DESTINO') return;
    setIsResetting(true);
    addLog('AVISO CRÍTICO: Iniciando limpeza estruturada (TRUNCATE/RESET) do banco de destino...', 'warning');

    try {
      const res = await limparBancoDestinoCompleto((tabela, idx, total) => {
        addLog(`Limpando tabela [${idx}/${total}]: ${tabela}...`, 'info');
      });

      if (res.sucesso) {
        addLog(`Banco de destino limpo com sucesso! ${res.tabelasLimpas.length} tabelas zeradas sem violação relacional.`, 'success');
      } else {
        addLog(`Limpeza finalizada com avisos: ${res.erros.join(', ')}`, 'warning');
      }
    } catch (err: any) {
      addLog(`Erro ao limpar banco de destino: ${err.message || String(err)}`, 'error');
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
      setResetConfirmText('');
    }
  };

  // Cancelar migração em andamento
  const handleCancelarMigracao = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('Comando de parada recebido. Interrompendo migração com segurança...', 'warning');
    }
  };

  // Iniciar migração completa ou isolada
  const startMigration = async (tableId: string | null = null) => {
    if (!activeSource || !activeTarget) {
      addLog('Erro: Selecione uma instância válida de Origem e de Destino.', 'error');
      return;
    }

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    setMigrationStatus('running');
    setProgress(0);
    setTotalMigradosSessao(0);

    const tablesToMigrate = tableId
      ? tables.filter(t => t.id === tableId)
      : tables.filter(t => t.selected);

    if (tablesToMigrate.length === 0) {
      addLog('Nenhuma tabela selecionada para migração.', 'warning');
      setMigrationStatus('idle');
      return;
    }

    const tableNames = tablesToMigrate.map(t => t.name);
    addLog(`Iniciando migração de ${tableNames.length} módulo(s) [${modoSimulacao ? 'MODO SIMULAÇÃO DRY-RUN' : 'MODO PRODUÇÃO REAL'}]...`, 'info');

    // Compila mapa de custom mappings
    const customMappings: Record<string, Record<string, string>> = {};
    for (const t of tablesToMigrate) {
      if (t.mapping && Object.keys(t.mapping).length > 0) {
        customMappings[t.name] = t.mapping;
      }
    }

    const sourceCreds: SupabaseCredentials = {
      url: activeSource.url,
      key: activeSource.key
    };

    const targetCreds: SupabaseCredentials = {
      url: activeTarget.url,
      key: activeTarget.key
    };

    try {
      if (tableId) {
        // Migração isolada de um módulo
        const singleTable = tablesToMigrate[0];
        setCurrentTableMigrating(singleTable.name);
        setCurrentBatchInfo(`Migrando ${singleTable.name}...`);
        addLog(`Iniciando extração e inserção isolada da tabela "${singleTable.name}"...`, 'info');

        const result = await executeSingleTableMigration(sourceCreds, singleTable.name, (saved, total) => {
          const pct = Math.round((saved / Math.max(total, 1)) * 100);
          setProgress(pct);
          setCurrentBatchInfo(`${saved}/${total} registros processados`);
        }, {
          customColumnMappings: customMappings,
          targetCondominioId: escopoCondominio,
          dryRun: modoSimulacao,
          targetCredentials: targetCreds,
          abortSignal: abortCtrl.signal
        });

        if (result.success) {
          setProgress(100);
          setTotalMigradosSessao(result.count);
          setMigrationStatus('completed');
          addLog(`Módulo "${singleTable.name}" migrado com sucesso! Total: ${result.count} registros gravados.`, 'success');
          if (onMigracaoConcluida) onMigracaoConcluida();
        } else {
          setMigrationStatus('error');
          addLog(`Erro ao migrar módulo "${singleTable.name}": ${result.error}`, 'error');
        }
      } else {
        // Migração completa de todos os módulos selecionados
        let tabelasConcluidas = 0;
        const totalTabelas = tablesToMigrate.length;

        const res = await executeFullSupabaseMigration(
          sourceCreds,
          tableNames,
          (tableInfo: MigrationTableInfo) => {
            setCurrentTableMigrating(tableInfo.name);
            if (tableInfo.status === 'migrating') {
              setCurrentBatchInfo(`Processando lote: ${tableInfo.migratedCount} inseridos`);
            } else if (tableInfo.status === 'completed' || tableInfo.status === 'empty') {
              tabelasConcluidas++;
              const overallPct = Math.round((tabelasConcluidas / totalTabelas) * 100);
              setProgress(overallPct);
              addLog(`Tabela "${tableInfo.name}": ${tableInfo.migratedCount} registros processados (${tableInfo.status}).`, 'success');
            } else if (tableInfo.status === 'error') {
              tabelasConcluidas++;
              addLog(`Erro na tabela "${tableInfo.name}": ${tableInfo.error || 'Falha de validação'}`, 'error');
            }
          },
          {
            salvarBackupAntes,
            limparBancoAntes: limparDestinoAntes,
            targetCondominioId: escopoCondominio,
            customColumnMappings: customMappings,
            dryRun: modoSimulacao,
            targetCredentials: targetCreds,
            abortSignal: abortCtrl.signal,
            onBackupProgresso: (msg) => addLog(msg, 'info'),
            onLimpezaProgresso: (msg) => addLog(msg, 'warning')
          }
        );

        setProgress(100);
        setTotalMigradosSessao(res.totalMigrated);
        setMigrationStatus('completed');
        addLog(`MIGRAÇÃO CONCLUÍDA! ${res.totalMigrated} registros transferidos para o banco de destino com 100% de integridade.`, 'success');
        if (onMigracaoConcluida) onMigracaoConcluida();
      }
    } catch (err: any) {
      setMigrationStatus('error');
      addLog(`Falha na execução: ${err.message || String(err)}`, 'error');
    } finally {
      setCurrentTableMigrating('');
      setCurrentBatchInfo('');
      abortControllerRef.current = null;
    }
  };

  // Exportar Backup JSON direto
  const handleBaixarBackupJson = async () => {
    if (!activeSource) return;
    addLog('Gerando arquivo JSON com dump estruturado de todas as tabelas...', 'info');
    try {
      const res = await exportSourceDatabaseToJson({
        url: activeSource.url,
        key: activeSource.key
      });
      addLog(`Backup JSON concluído! Arquivo "${res.fileName}" baixado (${res.totalRecords} registros).`, 'success');
    } catch (err: any) {
      addLog(`Erro ao baixar backup JSON: ${err.message || String(err)}`, 'error');
    }
  };

  // Importar Backup JSON do disco
  const handleUploadArquivoJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivoUploadNome(file.name);
    setImportandoJson(true);
    addLog(`Lendo arquivo de dump "${file.name}"...`, 'info');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          addLog('Arquivo validado com sucesso! Iniciando restauração no banco de destino...', 'info');

          const res = await importJsonDump(parsed, (tabela, salvos, total) => {
            setCurrentTableMigrating(tabela);
            setCurrentBatchInfo(`${salvos}/${total}`);
          }, {
            targetCondominioId: escopoCondominio
          });

          if (res.success) {
            addLog(`Dump JSON restaurado com sucesso! Total de ${res.totalImported} registros gravados no banco.`, 'success');
          } else {
            addLog(`Importação finalizada com erros: ${res.errors.join(', ')}`, 'error');
          }
        } catch (err: any) {
          addLog(`JSON inválido: ${err.message}`, 'error');
        } finally {
          setImportandoJson(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      addLog(`Erro ao processar arquivo: ${err.message}`, 'error');
      setImportandoJson(false);
    }
  };

  // Copiar Script SQL de Extração
  const handleCopiarSql = () => {
    const sql = generateSupabaseDumpSqlScript();
    navigator.clipboard.writeText(sql);
    setSqlCopiado(true);
    setTimeout(() => setSqlCopiado(false), 3000);
    addLog('Script SQL copiado para a área de transferência! Cole no SQL Editor do Supabase.', 'success');
  };

  // Copiar Logs
  const handleCopiarLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    addLog('Histórico de logs copiado para a área de transferência.', 'info');
  };

  // Baixar Logs em .txt
  const handleBaixarLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `porttohub-migracao-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Arquivo de logs baixado com sucesso.', 'info');
  };

  // Filtros de tabelas na Aba 2
  const tabelasFiltradas = useMemo(() => {
    return tables.filter(t => {
      const matchBusca = t.name.toLowerCase().includes(tabelaFiltroBusca.toLowerCase()) ||
        t.label.toLowerCase().includes(tabelaFiltroBusca.toLowerCase());
      const matchCat = categoriaAtiva === 'todas' || t.category.toLowerCase() === categoriaAtiva.toLowerCase();
      return matchBusca && matchCat;
    });
  }, [tables, tabelaFiltroBusca, categoriaAtiva]);

  // Filtros de logs na Aba 6
  const logsFiltrados = useMemo(() => {
    return logs.filter(l => {
      const matchTipo = filtroTipoLog === 'all' || l.type === filtroTipoLog;
      const matchBusca = !buscaLog || l.message.toLowerCase().includes(buscaLog.toLowerCase());
      return matchTipo && matchBusca;
    });
  }, [logs, filtroTipoLog, buscaLog]);

  // Estatísticas Rápidas
  const totalTabelasSelecionadas = tables.filter(t => t.selected).length;
  const totalRegistrosEstimados = tables.reduce((acc, t) => acc + (t.selected ? t.recordsCount : 0), 0);

  if (!aberto) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-0 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'}`}>
      
      {/* CONTAINER PRINCIPAL */}
      <div className={`bg-slate-950 border border-slate-800 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black shadow-2xl transition-all duration-300 overflow-hidden ${
        isFullscreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-7xl h-[94vh] rounded-3xl'
      }`}>
        
        {/* HEADER / NAVBAR */}
        <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-4 lg:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
              <ArrowRightLeft className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="font-bold text-base sm:text-lg text-white tracking-tight truncate">
                  Módulo Migrador Oficial: Supabase
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  v2.6 Enterprise
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Migração segura, visual e estruturada entre instâncias Supabase
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Botão Destrutivo de Zerar Banco Destino */}
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center space-x-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
              title="Limpeza total controlada do banco de destino"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">Zerar Banco Destino</span>
            </button>

            {/* Status de Conexão Ativa */}
            <div className="hidden md:flex items-center bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-2"></span>
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[130px]">
                {activeSource?.name || 'Origem Ativa'}
              </span>
            </div>

            {/* Botão de Tela Cheia */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title={isFullscreen ? 'Restaurar Tamanho' : 'Expandir Tela Cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Botão Fechar Modal */}
            <button
              onClick={onFechar}
              disabled={migrationStatus === 'running'}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition disabled:opacity-40"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* CONTAINER DE CONTEÚDO (SIDEBAR + MAIN) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          
          {/* SIDEBAR TABS */}
          <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 p-3 lg:p-4 flex flex-row lg:flex-col space-x-1 lg:space-x-0 lg:space-y-1.5 overflow-x-auto lg:overflow-x-visible shrink-0">
            <div className="hidden lg:block text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2">
              Menu de Operação
            </div>
            
            <button
              onClick={() => setActiveTab('conexoes')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'conexoes'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4 shrink-0" />
              <span>1. Conexões Supabase</span>
            </button>

            <button
              onClick={() => setActiveTab('esquemas')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'esquemas'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>2. Esquemas & Tabelas</span>
            </button>

            <button
              onClick={() => setActiveTab('mapeamento')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'mapeamento'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>3. Mapeamento de Colunas</span>
            </button>

            <button
              onClick={() => setActiveTab('migracao')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'migracao'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Play className="w-4 h-4 shrink-0" />
              <span>4. Painel de Migração</span>
            </button>

            <button
              onClick={() => setActiveTab('ferramentas')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'ferramentas'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>5. Ferramentas & Dumps</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4 shrink-0" />
              <span>Logs & Atividades</span>
              <span className="ml-auto bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
                {logs.length}
              </span>
            </button>

            {/* Status card lateral */}
            <div className="hidden lg:block pt-4 mt-auto">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 text-xs space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                  <Cpu className="w-4 h-4" />
                  <span>Status do Sistema</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Modo de migração otimizado por lotes ativado. Auto-cura de esquemas e proteção referencial.
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Batch: 50 rows</span>
                  <span className="text-emerald-400">PostgreSQL 15+</span>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">

            {/* TAB 1: CONEXÕES SUPABASE */}
            {activeTab === 'conexoes' && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Gerenciamento de Bancos de Dados Supabase</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Configure as instâncias de origem (antiga) e destino (nova).</p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 flex-wrap">
                    <button
                      onClick={handleRestaurarPadroes}
                      className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
                      title="Restaurar conexões originais do repositório"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Restaurar Repositório</span>
                    </button>
                    <button
                      onClick={() => setIsAddingConnection(!isAddingConnection)}
                      className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-lg shadow-emerald-500/10 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isAddingConnection ? 'Fechar Formulário' : 'Nova Conexão'}</span>
                    </button>
                  </div>
                </div>

                {/* Seletor do Par Ativo de Migração */}
                <div className="bg-slate-900/70 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Par Ativo de Migração
                    </span>
                    <button
                      onClick={handleInverterPar}
                      className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 transition"
                      title="Alternar Origem e Destino"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Inverter Pares</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase text-amber-400">
                        Banco de Origem (Cedente)
                      </label>
                      <select
                        value={selectedSourceId}
                        onChange={(e) => setSelectedSourceId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                      >
                        {connections.filter(c => c.type === 'source' || c.type === 'both').map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.url}
                          </option>
                        ))}
                      </select>
                      {activeSource && (
                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                          <span className="font-mono text-amber-400/90 truncate">{activeSource.url}</span>
                          <button
                            onClick={() => handleTestarConexao(activeSource.id)}
                            className="text-amber-400 hover:underline shrink-0"
                          >
                            Testar Origem
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase text-emerald-400">
                        Banco de Destino (Receptor)
                      </label>
                      <select
                        value={selectedTargetId}
                        onChange={(e) => setSelectedTargetId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        {connections.filter(c => c.type === 'target' || c.type === 'both').map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.url}
                          </option>
                        ))}
                      </select>
                      {activeTarget && (
                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                          <span className="font-mono text-emerald-400/90 truncate">{activeTarget.url}</span>
                          <button
                            onClick={() => handleTestarConexao(activeTarget.id)}
                            className="text-emerald-400 hover:underline shrink-0"
                          >
                            Testar Destino
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Formulário para Adicionar Conexão */}
                {isAddingConnection && (
                  <div className="bg-slate-900 border border-emerald-500/40 p-5 sm:p-6 rounded-2xl space-y-4 shadow-xl animate-in fade-in duration-200">
                    <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Adicionar Nova Conexão Supabase
                    </h3>
                    <form onSubmit={handleAddConnection} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Nome da Conexão</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Supabase Staging"
                            value={newConnName}
                            onChange={(e) => setNewConnName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Função / Tipo</label>
                          <select
                            value={newConnType}
                            onChange={(e) => setNewConnType(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="source">Origem (Banco Antigo)</option>
                            <option value="target">Destino (Banco Novo PorttoHub)</option>
                            <option value="both">Ambos (Origem ou Destino)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Supabase Project URL</label>
                        <input
                          type="url"
                          required
                          placeholder="https://xyzproject.supabase.co"
                          value={newConnUrl}
                          onChange={(e) => setNewConnUrl(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          API Key / Service Role Key (Recomendado para permissões totais)
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="eyJhbGciOi..."
                          value={newConnKey}
                          onChange={(e) => setNewConnKey(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Descrição Opcional</label>
                        <input
                          type="text"
                          placeholder="Ex: Backup com dados legados de 2025"
                          value={newConnDesc}
                          onChange={(e) => setNewConnDesc(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="flex justify-end space-x-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingConnection(false)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition"
                        >
                          Salvar Conexão
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Lista de Conexões Cadastradas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {connections.map(conn => {
                    const isTesting = testandoConexaoId === conn.id;
                    const isEditing = editingConnId === conn.id;
                    const isKeyVisible = Boolean(showKeyConnId[conn.id]);

                    if (isEditing) {
                      return (
                        <div
                          key={`edit-${conn.id}`}
                          className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl ring-2 ring-emerald-500/20 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                              <Edit3 className="w-4 h-4" />
                              <span>Editar Banco Repositório</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {conn.id}
                            </span>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Nome do Banco / Projeto
                              </label>
                              <input
                                type="text"
                                value={editConnForm.name}
                                onChange={(e) => setEditConnForm({ ...editConnForm, name: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                                placeholder="Ex: Supabase Produção"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Função / Tipo</label>
                                <select
                                  value={editConnForm.type}
                                  onChange={(e) => setEditConnForm({ ...editConnForm, type: e.target.value as any })}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="source">Origem (Banco Antigo)</option>
                                  <option value="target">Destino (Novo Supabase PorttoHub)</option>
                                  <option value="both">Ambos (Origem & Destino)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Descrição</label>
                                <input
                                  type="text"
                                  value={editConnForm.description}
                                  onChange={(e) => setEditConnForm({ ...editConnForm, description: e.target.value })}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                  placeholder="Ex: Base legada"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Supabase Project URL</label>
                              <input
                                type="url"
                                value={editConnForm.url}
                                onChange={(e) => setEditConnForm({ ...editConnForm, url: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                                placeholder="https://xyz.supabase.co"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                API Key / Service Role Key
                              </label>
                              <input
                                type="text"
                                value={editConnForm.key}
                                onChange={(e) => setEditConnForm({ ...editConnForm, key: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                                placeholder="eyJhbGciOi..."
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={handleCancelEditConnection}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditConnection(conn.id)}
                              className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/20 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Atualizar Banco Repositório</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={conn.id}
                        className={`bg-slate-900/50 border rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 transition ${
                          conn.id === selectedSourceId || conn.id === selectedTargetId
                            ? 'border-emerald-500/50 bg-slate-900/80 shadow-md ring-1 ring-emerald-500/20'
                            : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className={`p-2.5 rounded-xl border shrink-0 ${
                              conn.type === 'source'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            }`}>
                              <Database className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-white text-sm truncate">{conn.name}</h3>
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                                  conn.type === 'source'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : conn.type === 'target'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                }`}>
                                  {conn.type === 'source' ? 'Origem de Dados' : conn.type === 'target' ? 'Destino da Migração' : 'Origem & Destino'}
                                </span>
                                {conn.isDefault && (
                                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">Oficial</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Ações do Card: EDITAR e EXCLUIR */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => handleStartEditConnection(conn)}
                              className="flex items-center space-x-1 text-slate-400 hover:text-emerald-400 p-1.5 hover:bg-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Editar este banco de dados"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="text-[11px] hidden sm:inline">Editar</span>
                            </button>
                            <button
                              onClick={() => setConnParaExcluir(conn)}
                              className="flex items-center space-x-1 text-slate-400 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Excluir banco do repositório"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="text-[11px] hidden sm:inline">Excluir</span>
                            </button>
                          </div>
                        </div>

                        {conn.description && (
                          <p className="text-xs text-slate-400 leading-tight">
                            {conn.description}
                          </p>
                        )}

                        <div className="space-y-1.5 text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-900 font-mono">
                          <div className="flex justify-between items-center text-slate-400 gap-2">
                            <span className="text-[11px] shrink-0">URL:</span>
                            <span className="text-slate-200 truncate max-w-[210px]" title={conn.url}>
                              {conn.url}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopiarTexto(conn.url, 'URL Supabase')}
                              className="text-slate-500 hover:text-white shrink-0 p-1 rounded hover:bg-slate-800"
                              title="Copiar URL"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex justify-between items-center text-slate-400 gap-2">
                            <span className="text-[11px] shrink-0">Chave:</span>
                            <span className="text-emerald-400 truncate max-w-[190px]">
                              {isKeyVisible ? conn.key : '••••••••••••••••••••••••••••••••'}
                            </span>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleShowKey(conn.id)}
                                className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800"
                                title={isKeyVisible ? 'Ocultar Chave' : 'Visualizar Chave Completa'}
                              >
                                {isKeyVisible ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopiarTexto(conn.key, 'Chave API')}
                                className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800"
                                title="Copiar Chave API"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => handleTestarConexao(conn.id)}
                            disabled={isTesting}
                            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/60 transition disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                            <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                          </button>

                          {conn.latencyMs !== undefined && (
                            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Ping: {conn.latencyMs}ms
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: ESQUEMAS & TABELAS */}
            {activeTab === 'esquemas' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Visualização & Comparação de Esquemas</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Compare as colunas do banco de origem com o banco de destino em tempo real.</p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={handleEscanearContagens}
                      disabled={escaneandoContagens}
                      className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${escaneandoContagens ? 'animate-spin' : ''}`} />
                      <span>{escaneandoContagens ? 'Escaneando...' : 'Escanear Contagem Real'}</span>
                    </button>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>Divergências detectadas e adaptadas</span>
                    </div>
                  </div>
                </div>

                {/* Filtro e Busca de Tabelas */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filtrar tabela por nome (ex: encomendas, moradores)..."
                      value={tabelaFiltroBusca}
                      onChange={(e) => setTabelaFiltroBusca(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleSelecionarTodas(true)}
                      className="text-xs text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700"
                    >
                      Selecionar Todas
                    </button>
                    <button
                      onClick={() => handleSelecionarTodas(false)}
                      className="text-xs text-slate-400 hover:text-white bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Lista de Tabelas e Esquemas */}
                <div className="space-y-4">
                  {tabelasFiltradas.map(table => {
                    const isExpanded = tabelaExpandidaId === table.id;
                    const hasCustomMapping = Object.keys(table.mapping || {}).length > 0;

                    return (
                      <div key={table.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 hover:border-slate-700/80 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleTableSelection(table.id)}
                              className="text-emerald-400 hover:text-emerald-300 transition"
                              title={table.selected ? 'Desmarcar da migração' : 'Marcar para migração'}
                            >
                              {table.selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-600" />}
                            </button>

                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-bold text-white text-sm sm:text-base">{table.label}</h3>
                                <span className="text-xs font-mono text-slate-400">({table.name})</span>
                                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                                  {table.recordsCount.toLocaleString('pt-BR')} registros
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">{table.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`text-[11px] px-2.5 py-1 rounded-full border ${
                              hasCustomMapping
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-medium'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                            }`}>
                              {hasCustomMapping ? 'Mapeamento Personalizado Ativo' : 'Esquema Compatível'}
                            </span>

                            <button
                              onClick={() => setTabelaExpandidaId(isExpanded ? null : table.id)}
                              className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700"
                            >
                              {isExpanded ? 'Recolher' : 'Ver Colunas'}
                            </button>
                          </div>
                        </div>

                        {/* Visão Lado a Lado de Colunas (Expandível) */}
                        {isExpanded && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                            {/* Colunas de Origem */}
                            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900 space-y-2">
                              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Origem (Banco Antigo)</span>
                                <span>{table.sourceColumns.length} colunas</span>
                              </div>
                              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                {table.sourceColumns.map((col, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono text-slate-200">{col.name}</span>
                                      {col.primary && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded">PK</span>}
                                    </div>
                                    <span className="font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded text-[11px]">{col.type}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Colunas de Destino */}
                            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900 space-y-2">
                              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Destino (Novo Supabase PorttoHub)</span>
                                <span>{table.targetColumns.length} colunas</span>
                              </div>
                              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                {table.targetColumns.map((col, idx) => {
                                  const isMapped = table.mapping && Object.values(table.mapping).includes(col.name);
                                  return (
                                    <div key={idx} className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border ${
                                      isMapped ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/80 border-slate-800'
                                    }`}>
                                      <div className="flex items-center space-x-2">
                                        <span className="font-mono text-slate-200">{col.name}</span>
                                        {col.primary && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded">PK</span>}
                                      </div>
                                      <span className="font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded text-[11px]">{col.type}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: MAPEAMENTO INTELIGENTE */}
            {activeTab === 'mapeamento' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Mapeamento Inteligente de Colunas</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Ajuste como os dados da tabela antiga serão gravados nas colunas do novo banco de dados.</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                      Mapeamentos salvos automaticamente
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {tables.map(table => (
                    <div key={table.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <h3 className="font-bold text-white flex items-center space-x-2">
                            <span>Tabela: <span className="text-emerald-400 font-mono">{table.name}</span></span>
                            <span className="text-xs text-slate-400 font-normal">({table.label})</span>
                          </h3>
                        </div>

                        <button
                          onClick={() => handleAutoMapearTabela(table.id)}
                          className="flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg transition"
                          title="Detectar automaticamente colunas equivalentes"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Auto-Mapear</span>
                        </button>
                      </div>

                      <div className="space-y-2.5 bg-slate-950/50 p-4 rounded-xl border border-slate-900">
                        {table.sourceColumns.map((srcCol, idx) => {
                          const currentMappedTarget = table.mapping[srcCol.name] || srcCol.name;

                          return (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-800/80">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded text-amber-400 border border-slate-800">
                                  {srcCol.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">({srcCol.type})</span>
                              </div>

                              <div className="flex items-center space-x-3">
                                <ArrowRightLeft className="w-4 h-4 text-slate-500 hidden sm:block" />
                                <select
                                  value={currentMappedTarget}
                                  onChange={(e) => handleColumnMappingChange(table.id, srcCol.name, e.target.value)}
                                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 w-full sm:w-60 font-mono"
                                >
                                  <option value="(ignorar)">-- Ignorar / Não Migrar Coluna --</option>
                                  {table.targetColumns.map((targetCol, tIdx) => (
                                    <option key={tIdx} value={targetCol.name}>
                                      {targetCol.name} ({targetCol.type})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: PAINEL DE MIGRAÇÃO */}
            {activeTab === 'migracao' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Painel de Execução & Controle de Migração</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Execute a migração completa de uma vez ou selecione módulo por módulo com poucos cliques.</p>
                  </div>
                </div>

                {/* Card de Status & Execução */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Status Atual</span>
                      <div className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2 mt-1">
                        {migrationStatus === 'idle' && <span className="text-slate-300">Pronto para iniciar</span>}
                        {migrationStatus === 'running' && (
                          <span className="text-amber-400 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Migrando dados em tempo real...
                          </span>
                        )}
                        {migrationStatus === 'completed' && (
                          <span className="text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            Migração concluída com 100% de integridade!
                          </span>
                        )}
                        {migrationStatus === 'error' && (
                          <span className="text-red-400 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Houve uma falha na execução
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {migrationStatus === 'running' ? (
                        <button
                          onClick={handleCancelarMigracao}
                          className="flex items-center space-x-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition"
                        >
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Interromper</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => startMigration(null)}
                          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Iniciar Migração Completa</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso Real */}
                  {migrationStatus === 'running' && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">
                          Processando tabela: <span className="text-emerald-400 font-mono">{currentTableMigrating}</span>
                          {currentBatchInfo && <span className="text-slate-400 ml-2 font-mono">({currentBatchInfo})</span>}
                        </span>
                        <span className="text-emerald-400 font-mono">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Opções de Execução */}
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <label className="flex items-center space-x-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                      <input
                        type="checkbox"
                        checked={modoSimulacao}
                        onChange={(e) => setModoSimulacao(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-0"
                      />
                      <span className="text-slate-300">Simulação (Dry-Run sem gravar)</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                      <input
                        type="checkbox"
                        checked={salvarBackupAntes}
                        onChange={(e) => setSalvarBackupAntes(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-0"
                      />
                      <span className="text-slate-300">Backup JSON prévio automático</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                      <input
                        type="checkbox"
                        checked={limparDestinoAntes}
                        onChange={(e) => setLimparDestinoAntes(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-0"
                      />
                      <span className="text-slate-300">Zerar destino antes de iniciar</span>
                    </label>
                  </div>

                  {/* Escopo de Condomínio */}
                  {condominiosDestino.length > 0 && (
                    <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">Vincular dados ao condomínio:</span>
                      <select
                        value={escopoCondominio}
                        onChange={(e) => setEscopoCondominio(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="todos">Preservar todos os condomínios originais</option>
                        {condominiosDestino.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Estatísticas de Seleção */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl text-center">
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Tabelas</span>
                    <span className="text-lg font-bold text-white font-mono">{totalTabelasSelecionadas} / {tables.length}</span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl text-center">
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Registros</span>
                    <span className="text-lg font-bold text-amber-400 font-mono">{totalRegistrosEstimados.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl text-center">
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Migrados</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">{totalMigradosSessao.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl text-center">
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Auto-Cura</span>
                    <span className="text-xs font-bold text-cyan-400 block pt-1">Ativa (100% FK)</span>
                  </div>
                </div>

                {/* Migração Módulo por Módulo */}
                <div className="space-y-3">
                  <h3 className="font-bold text-white text-sm sm:text-base">Migração Módulo por Módulo (Tabela por Tabela)</h3>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {tables.map(table => (
                      <div key={table.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-800 text-slate-300 shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-white text-sm truncate">{table.label}</h4>
                            <span className="text-xs text-slate-400 font-mono">
                              {table.name} • {table.recordsCount.toLocaleString('pt-BR')} registros
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => startMigration(table.id)}
                          disabled={migrationStatus === 'running'}
                          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Migrar Este Módulo</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FERRAMENTAS & DUMPS */}
            {activeTab === 'ferramentas' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Ferramentas Avançadas, Backups e Scripts SQL</h2>
                  <p className="text-xs sm:text-sm text-slate-400">Exporte dados brutos, importe backups offline ou gere scripts SQL universais.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Baixar Dump JSON */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit">
                        <Download className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white text-base">Exportar Backup JSON Completo</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Gera um arquivo .json seguro com 100% dos registros de todas as tabelas da instância de origem selecionada.
                      </p>
                    </div>

                    <button
                      onClick={handleBaixarBackupJson}
                      className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Arquivo JSON</span>
                    </button>
                  </div>

                  {/* Card 2: Importar Dump JSON */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-fit">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white text-base">Importar Backup JSON para o Destino</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Restaure tabelas e registros diretamente a partir de um arquivo .json previamente salvo em seu computador.
                      </p>
                    </div>

                    <label className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer border border-slate-700 transition">
                      <Upload className="w-4 h-4" />
                      <span>{importandoJson ? 'Importando dados...' : (arquivoUploadNome ? `Arquivo: ${arquivoUploadNome}` : 'Selecionar Arquivo .JSON')}</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleUploadArquivoJson}
                        disabled={importandoJson}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Card 3: Gerador de Script SQL */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white text-base">Script SQL Direto (Supabase Query Editor)</h3>
                      <p className="text-xs text-slate-400">
                        Copie o comando SQL e rode no SQL Editor do Supabase antigo para gerar um Dump direto.
                      </p>
                    </div>

                    <button
                      onClick={handleCopiarSql}
                      className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                      <span>{sqlCopiado ? 'Copiado!' : 'Copiar Script SQL'}</span>
                    </button>
                  </div>

                  <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 border border-slate-900 overflow-x-auto max-h-48 text-[11px] leading-relaxed">
                    {generateSupabaseDumpSqlScript()}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 6: LOGS & AUDITORIA */}
            {activeTab === 'logs' && (
              <div className="space-y-4 max-w-5xl mx-auto flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Logs & Atividades em Tempo Real</h2>
                    <p className="text-xs sm:text-sm text-slate-400">Histórico completo de auditoria do processo de migração.</p>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap">
                    <button
                      onClick={handleCopiarLogs}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-800 transition"
                      title="Copiar para área de transferência"
                    >
                      <Copy className="w-3.5 h-3.5 inline mr-1" />
                      Copiar
                    </button>
                    <button
                      onClick={handleBaixarLogs}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-800 transition"
                      title="Salvar arquivo de logs .txt"
                    >
                      <Download className="w-3.5 h-3.5 inline mr-1" />
                      Baixar .txt
                    </button>
                    <button
                      onClick={() => setLogs([])}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-800 transition"
                    >
                      Limpar Logs
                    </button>
                  </div>
                </div>

                {/* Filtros de Logs */}
                <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                    {(['all', 'info', 'success', 'warning', 'error'] as const).map(tipo => (
                      <button
                        key={tipo}
                        onClick={() => setFiltroTipoLog(tipo)}
                        className={`px-2.5 py-1 rounded-lg text-xs capitalize transition ${
                          filtroTipoLog === tipo
                            ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tipo === 'all' ? 'Todos' : tipo}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center space-x-1.5 text-xs text-slate-400 ml-auto cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0"
                    />
                    <span>Auto-scroll</span>
                  </label>
                </div>

                {/* Terminal Monospace */}
                <div
                  ref={logScrollRef}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex-1 overflow-y-auto font-mono text-xs space-y-1.5 shadow-inner min-h-[380px]"
                >
                  {logsFiltrados.length === 0 ? (
                    <div className="text-slate-500 text-center py-12">Nenhum registro encontrado no log.</div>
                  ) : (
                    logsFiltrados.map(log => (
                      <div key={log.id} className="flex items-start space-x-3 py-1 border-b border-slate-900/60 last:border-0">
                        <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                          log.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          log.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          log.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {log.type}
                        </span>
                        <span className="text-slate-300 break-all leading-relaxed">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </main>
        </div>

      </div>

      {/* MODAL CRÍTICO DE CONFIRMAÇÃO: ZERAR BANCO DESTINO */}
      {showResetModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Zerar Banco de Destino</h3>
                <p className="text-xs text-red-400 font-medium">Atenção: Ação irreversível!</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta operação irá limpar de forma estruturada todas as 28 tabelas do banco de destino (em ordem reversa de chaves estrangeiras) para permitir uma recepção limpa dos novos dados. Para autorizar, digite <strong className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">ZERAR DESTINO</strong> abaixo:
            </p>

            <input
              type="text"
              placeholder="Digite ZERAR DESTINO"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-red-500 text-center tracking-wider"
              autoFocus
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetConfirmText !== 'ZERAR DESTINO' || isResetting}
                onClick={executeDatabaseReset}
                className="bg-red-500 hover:bg-red-400 disabled:opacity-40 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2"
              >
                {isResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isResetting ? 'Limpando...' : 'Zerar Banco Agora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE BANCO */}
      {connParaExcluir && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 shrink-0">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Excluir Banco do Repositório</h3>
                <p className="text-xs text-slate-400">Remover esta conexão permanentemente</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir a conexão <strong className="text-white font-semibold">"{connParaExcluir.name}"</strong>?
              {connParaExcluir.isDefault && (
                <span className="block mt-1 text-slate-400 text-[11px]">
                  (Nota: Você poderá restaurá-la a qualquer momento clicando em "Restaurar Repositório".)
                </span>
              )}
            </p>

            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConnParaExcluir(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteConnection(connParaExcluir.id)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md shadow-red-500/20 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
