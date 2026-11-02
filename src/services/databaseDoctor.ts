import { supabase } from './supabase';
import masterSql from '../../supabase_schema_ajuste_completo.sql?raw';

export interface TableDiagnostic {
  canonicalName: string;
  duplicateOrLegacyNames: string[];
  purpose: string;
  category: string;
  status: 'ok' | 'needs_migration' | 'checking' | 'error';
  canonicalCount?: number;
  legacyCounts?: Record<string, number>;
  notes: string;
}

export const CANONICAL_SCHEMA_MAP: TableDiagnostic[] = [
  {
    canonicalName: 'condominios',
    duplicateOrLegacyNames: [],
    purpose: 'Tabela principal multi-tenant de condomínios gerenciados',
    category: 'Cadastros Base',
    status: 'checking',
    notes: 'Essencial. Contém id, nome, endereco, created_at.'
  },
  {
    canonicalName: 'operadores',
    duplicateOrLegacyNames: ['usuarios_sistema'],
    purpose: 'Contas de operadores da portaria, supervisores, síndicos e admin',
    category: 'Segurança & Acesso',
    status: 'checking',
    notes: 'A tabela usuarios_sistema é redundante e pode ser migrada para operadores.'
  },
  {
    canonicalName: 'moradores',
    duplicateOrLegacyNames: ['unidades', 'blocos'],
    purpose: 'Cadastro de moradores com bloco, unidade, telefone WhatsApp',
    category: 'Cadastros Base',
    status: 'checking',
    notes: 'As tabelas avulsas "blocos" e "unidades" são legadas; moradores armazena diretamente bloco e unidade.'
  },
  {
    canonicalName: 'encomendas_itens',
    duplicateOrLegacyNames: ['encomendas'],
    purpose: 'Itens individuais triados e retidos na portaria',
    category: 'Módulo 02 - Encomendas',
    status: 'checking',
    notes: 'A tabela "encomendas" antiga é órfã; o fluxo usa lotes_re + encomendas_itens.'
  },
  {
    canonicalName: 'lotes_re',
    duplicateOrLegacyNames: [],
    purpose: 'Lotes de Recebimento de Entrega (RE) por entregador',
    category: 'Módulo 02 - Encomendas',
    status: 'checking',
    notes: 'Contém código RE diário sequencial e quantidade declarada.'
  },
  {
    canonicalName: 'entregadores',
    duplicateOrLegacyNames: [],
    purpose: 'Entregadores e transportadoras cadastrados',
    category: 'Módulo 02 - Encomendas',
    status: 'checking',
    notes: 'Contém nome, empresa e documento.'
  },
  {
    canonicalName: 'locais_armazenamento',
    duplicateOrLegacyNames: [],
    purpose: 'Locais físicos de triagem e armazenamento de encomendas (Bancadas, Prateleiras, Armários)',
    category: 'Módulo 02 - Encomendas',
    status: 'checking',
    notes: 'Permite cadastro dinâmico dos locais de guarda da portaria.'
  },
  {
    canonicalName: 'custodia',
    duplicateOrLegacyNames: ['custodia_itens'],
    purpose: 'Guarda temporária de itens deixados na portaria (chaves, pacotes, objetos)',
    category: 'Módulo 03 - Custódia',
    status: 'checking',
    notes: 'Custodia.jsx usa "custodia". A tabela "custodia_itens" é duplicata órfã.'
  },
  {
    canonicalName: 'materiais_posto',
    duplicateOrLegacyNames: ['materiais', 'inspecoes_materiais'],
    purpose: 'Inventário e controle de conservação dos equipamentos da guarita (HT, lanterna, etc.)',
    category: 'Módulo 04 - Materiais',
    status: 'checking',
    notes: 'Materiais.jsx gravava em materiais_posto, mas PassagemPosto lia de materiais. Devemos unificar em materiais_posto.'
  },
  {
    canonicalName: 'chaves',
    duplicateOrLegacyNames: [],
    purpose: 'Quadro digital de chaves do condomínio',
    category: 'Módulo 05 - Chaves',
    status: 'checking',
    notes: 'Contém código da chave, identificador, status e tempo limite.'
  },
  {
    canonicalName: 'movimentacao_chaves',
    duplicateOrLegacyNames: ['movimentacoes_chaves'],
    purpose: 'Histórico e status de retiradas/devoluções de chaves',
    category: 'Módulo 05 - Chaves',
    status: 'checking',
    notes: 'A tabela no plural "movimentacoes_chaves" é duplicata órfã.'
  },
  {
    canonicalName: 'checklist_manutencao',
    duplicateOrLegacyNames: [],
    purpose: 'Checklist de rotinas periódicas de manutenção predial',
    category: 'Módulo 06 - Manutenção',
    status: 'checking',
    notes: 'Tarefas diárias, semanais e mensais do manutencista.'
  },
  {
    canonicalName: 'chamados_manutencao',
    duplicateOrLegacyNames: [],
    purpose: 'Ordens de serviço (OS) e chamados corretivos',
    category: 'Módulo 06 - Manutenção',
    status: 'checking',
    notes: 'Contém fotos antes/depois e status do chamado.'
  },
  {
    canonicalName: 'rondas_pontos',
    duplicateOrLegacyNames: ['pontos_ronda'],
    purpose: 'Pontos físicos de ronda com QR Code e coordenadas GPS',
    category: 'Módulo 07 - Rondas',
    status: 'checking',
    notes: 'Rondas.jsx usa rondas_pontos. A tabela "pontos_ronda" é duplicata legada.'
  },
  {
    canonicalName: 'rondas_execucao',
    duplicateOrLegacyNames: ['rondas_execucoes'],
    purpose: 'Sessões de rondas patrimoniais iniciadas e finalizadas',
    category: 'Módulo 07 - Rondas',
    status: 'checking',
    notes: 'A tabela "rondas_execucoes" com final "es" é duplicata.'
  },
  {
    canonicalName: 'rondas_registros',
    duplicateOrLegacyNames: ['registros_ronda'],
    purpose: 'Leituras de QR Code, checklist do ponto e fotos das rondas',
    category: 'Módulo 07 - Rondas',
    status: 'checking',
    notes: 'A tabela "registros_ronda" é duplicata legada.'
  },
  {
    canonicalName: 'rondas_setores',
    duplicateOrLegacyNames: [],
    purpose: 'Setores patrimoniais pertencentes e checklists personalizados de inspeção',
    category: 'Módulo 07 - Rondas',
    status: 'checking',
    notes: 'Configuração dos setores com seus respectivos itens de conferência.'
  },
  {
    canonicalName: 'ocorrencias',
    duplicateOrLegacyNames: [],
    purpose: 'Livro digital de ocorrências internas e de moradores',
    category: 'Módulo 08 - Ocorrências',
    status: 'checking',
    notes: 'Auditado, com prioridade, fotos e disparo para WhatsApp.'
  },
  {
    canonicalName: 'passagens_posto',
    duplicateOrLegacyNames: ['rondas_passagem_posto'],
    purpose: 'Troca de turno e dupla assinatura digital da guarita',
    category: 'Módulo 09 - Passagem de Posto',
    status: 'checking',
    notes: 'Rondas.jsx gravava em rondas_passagem_posto e PassagemPosto.jsx em passagens_posto. Ambas devem usar passagens_posto.'
  },
  {
    canonicalName: 'prestadores',
    duplicateOrLegacyNames: ['visitas_prestadores'],
    purpose: 'Cadastro e registro de entrada/saída de prestadores e obras',
    category: 'Módulo 10 - Prestadores & Obras',
    status: 'checking',
    notes: 'A tabela "visitas_prestadores" é legada e redundante.'
  },
  {
    canonicalName: 'configuracoes',
    duplicateOrLegacyNames: [],
    purpose: 'Parametrização do condomínio e Feature Flags de módulos',
    category: 'Módulo 11 - Configurações',
    status: 'checking',
    notes: 'Armazena ativação dos módulos por condomínio.'
  },
  {
    canonicalName: 'templates_whatsapp',
    duplicateOrLegacyNames: [],
    purpose: 'Modelos configuráveis de mensagens automáticas de WhatsApp',
    category: 'Módulo 11 - Configurações',
    status: 'checking',
    notes: 'Templates com tags como {NOME_MORADOR}, {CODIGO}, etc.'
  },
  {
    canonicalName: 'agenda_emergencia',
    duplicateOrLegacyNames: [],
    purpose: 'Contatos de emergência (Polícia, SAMU, Zelador, Bombeiros)',
    category: 'Módulo 11 - Configurações',
    status: 'checking',
    notes: 'Agenda e botão de pânico rápido.'
  },
  {
    canonicalName: 'lembretes_portaria',
    duplicateOrLegacyNames: [],
    purpose: 'Bloco de mensagens e lembretes da portaria (Portaria ⇄ Moradores)',
    category: 'Comunicação & Mensagens',
    status: 'checking',
    notes: 'Isolamento por condominio_id, unidade_bloco, tipo, lido (booleano) e Realtime.'
  },
  {
    canonicalName: 'bancada_volumes',
    duplicateOrLegacyNames: [],
    purpose: 'Controle de volumes físicos retidos no balcão da guarita',
    category: 'Módulo 11 - Bancada',
    status: 'checking',
    notes: 'Volumes agrupados por estrutura e unidade física.'
  },
  {
    canonicalName: 'bancada_conferencias',
    duplicateOrLegacyNames: [],
    purpose: 'Auditoria de conferência cega e inventário da bancada',
    category: 'Módulo 11 - Bancada',
    status: 'checking',
    notes: 'Snapshots de conferências e divergências de volumes.'
  },
  {
    canonicalName: 'historico_absoluto',
    duplicateOrLegacyNames: ['logs_atividades'],
    purpose: 'Registro imutável de todas as ações operacionais do sistema',
    category: 'Auditoria & Logs',
    status: 'checking',
    notes: 'Trilha de auditoria por condomínio, operador, módulo e ação.'
  },
  {
    canonicalName: 'areas_comuns',
    duplicateOrLegacyNames: [],
    purpose: 'Espaços reserváveis (Churrasqueira, Salão de Festas, etc.)',
    category: 'Áreas Comuns & Reservas',
    status: 'checking',
    notes: 'Parametrização de horários, regras e limites de ocupação.'
  },
  {
    canonicalName: 'reservas_areas_comuns',
    duplicateOrLegacyNames: [],
    purpose: 'Agenda e registros de reservas de áreas comuns por moradores',
    category: 'Áreas Comuns & Reservas',
    status: 'checking',
    notes: 'Controle de turnos, convidados, vistorias e aprovação.'
  },
  {
    canonicalName: 'pontos_acesso',
    duplicateOrLegacyNames: [],
    purpose: 'Catracas, portões e pontos físicos de controle de acesso',
    category: 'Controle de Acesso',
    status: 'checking',
    notes: 'Equipamentos e portas de entrada/saída.'
  },
  {
    canonicalName: 'registros_acesso',
    duplicateOrLegacyNames: ['visitas'],
    purpose: 'Log detalhado de entradas e saídas de pedestres e veículos',
    category: 'Controle de Acesso',
    status: 'checking',
    notes: 'Registro em tempo real com fotos, placas e horários.'
  },
  {
    canonicalName: 'passes_virtuais_qr',
    duplicateOrLegacyNames: [],
    purpose: 'Passes com QR Code temporário para convidados e entregas',
    category: 'Controle de Acesso',
    status: 'checking',
    notes: 'Tokens de acesso rápido para validação na guarita.'
  },
  {
    canonicalName: 'blacklist_bloqueios',
    duplicateOrLegacyNames: [],
    purpose: 'Lista de alerta e restrição de acesso por nome, CPF ou placa',
    category: 'Controle de Acesso',
    status: 'checking',
    notes: 'Alarme visual imediato na portaria ao tentar dar entrada.'
  }
];

export async function runDatabaseAudit(): Promise<{
  diagnostics: TableDiagnostic[];
  orphanedTablesFound: string[];
  totalCanonical: number;
  totalOrphaned: number;
}> {
  const diagnostics: TableDiagnostic[] = JSON.parse(JSON.stringify(CANONICAL_SCHEMA_MAP));
  const orphanedTablesFound: string[] = [];

  for (const diag of diagnostics) {
    try {
      const { count, error } = await supabase
        .from(diag.canonicalName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        diag.status = 'error';
        diag.notes += ` (Erro ao consultar: ${error.message})`;
      } else {
        diag.canonicalCount = count ?? 0;
        diag.status = 'ok';

        // Verificação proativa de colunas essenciais
        if (diag.canonicalName === 'moradores') {
          const { error: colErr } = await supabase.from('moradores').select('cpf, rg, foto_url, tag_rfid, veiculo_placa').limit(1);
          if (colErr && (colErr.message?.includes('does not exist') || colErr.code === '42703' || colErr.code === 'PGRST204')) {
            diag.status = 'needs_migration';
            diag.notes = '⚠️ Colunas faltantes detectadas (foto_url, cpf, rg, veiculo_placa, tag_rfid). Execute o Script de Correção no Supabase.';
          }
        } else if (diag.canonicalName === 'encomendas_itens') {
          const { error: colErr } = await supabase.from('encomendas_itens').select('documento_retirante, assinatura_url, operador_baixa_nome').limit(1);
          if (colErr && (colErr.message?.includes('does not exist') || colErr.code === '42703' || colErr.code === 'PGRST204')) {
            diag.status = 'needs_migration';
            diag.notes = '⚠️ Colunas de baixa/assinatura faltantes. Execute o Script de Correção no Supabase.';
          }
        } else if (diag.canonicalName === 'custodia') {
          const { error: colErr } = await supabase.from('custodia').select('codigo, deixado_por, foto_url').limit(1);
          if (colErr && (colErr.message?.includes('does not exist') || colErr.code === '42703' || colErr.code === 'PGRST204')) {
            diag.status = 'needs_migration';
            diag.notes = '⚠️ Colunas de código, depositante e foto faltantes. Execute o Script de Correção.';
          }
        } else if (diag.canonicalName === 'prestadores') {
          const { error: colErr } = await supabase.from('prestadores').select('foto_rosto, placa_veiculo, foto_documento').limit(1);
          if (colErr && (colErr.message?.includes('does not exist') || colErr.code === '42703' || colErr.code === 'PGRST204')) {
            diag.status = 'needs_migration';
            diag.notes = '⚠️ Colunas de fotos e placas faltantes. Execute o Script de Correção.';
          }
        }
      }
    } catch {
      diag.status = 'error';
    }

    diag.legacyCounts = {};
    for (const legacyName of diag.duplicateOrLegacyNames) {
      try {
        const { count, error } = await supabase
          .from(legacyName)
          .select('*', { count: 'exact', head: true });

        if (!error && typeof count === 'number') {
          diag.legacyCounts[legacyName] = count;
          if (count > 0) {
            diag.status = 'needs_migration';
          }
          orphanedTablesFound.push(legacyName);
        }
      } catch {
        // Tabela não existe ou inacessível
      }
    }
  }

  return {
    diagnostics,
    orphanedTablesFound,
    totalCanonical: diagnostics.length,
    totalOrphaned: orphanedTablesFound.length
  };
}

export function generateMigrationSql(): string {
  return masterSql;
}

export interface CondominioConfigDiagnostic {
  condominioId: string;
  condominioNome: string;
  configId?: string | null;
  status: 'integra' | 'ausente' | 'corrompida';
  detalhesStatus: string;
  featureFlags: {
    mod02_gestao_encomendas: boolean;
    mod03_custodia_itens: boolean;
    mod04_materiais_posto: boolean;
    mod05_quadro_chaves: boolean;
    mod06_gestao_manutencao: boolean;
    mod07_gestao_ronda: boolean;
    mod08_livro_ocorrencias: boolean;
    mod09_passagem_posto: boolean;
    mod10_prestadores_servico: boolean;
  };
  chavesFaltantes: string[];
}

export const REQUIRED_MODULE_KEYS = [
  'mod02_gestao_encomendas',
  'mod03_custodia_itens',
  'mod04_materiais_posto',
  'mod05_quadro_chaves',
  'mod06_gestao_manutencao',
  'mod07_gestao_ronda',
  'mod08_livro_ocorrencias',
  'mod09_passagem_posto',
  'mod10_prestadores_servico'
] as const;

/**
 * Executa verificação de integridade das configurações de módulos
 * para cada condomínio cadastrado na tabela condominios.
 */
export async function auditCondominiosConfigs(): Promise<CondominioConfigDiagnostic[]> {
  try {
    const { data: condominios, error: condErr } = await supabase
      .from('condominios')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (condErr) throw condErr;
    if (!condominios || condominios.length === 0) return [];

    const { data: configs, error: cfgErr } = await supabase
      .from('configuracoes')
      .select('*');

    if (cfgErr) {
      console.warn('Aviso ao consultar configuracoes:', cfgErr.message);
    }

    const listaDiagnosticos: CondominioConfigDiagnostic[] = condominios.map((condo) => {
      const cfg = configs?.find((c) => c.condominio_id === condo.id);

      if (!cfg) {
        return {
          condominioId: condo.id,
          condominioNome: condo.nome || 'Condomínio Sem Nome',
          configId: null,
          status: 'ausente',
          detalhesStatus: 'Nenhum registro encontrado na tabela configuracoes.',
          featureFlags: {
            mod02_gestao_encomendas: true,
            mod03_custodia_itens: true,
            mod04_materiais_posto: true,
            mod05_quadro_chaves: true,
            mod06_gestao_manutencao: true,
            mod07_gestao_ronda: true,
            mod08_livro_ocorrencias: true,
            mod09_passagem_posto: true,
            mod10_prestadores_servico: true
          },
          chavesFaltantes: [...REQUIRED_MODULE_KEYS]
        };
      }

      const flagsJson = typeof cfg.feature_flags === 'object' && cfg.feature_flags !== null 
        ? cfg.feature_flags 
        : {};

      const chavesFaltantes: string[] = [];
      const resolvedFlags: any = {};

      REQUIRED_MODULE_KEYS.forEach((key) => {
        const valColuna = cfg[key];
        const valJson = flagsJson[key];

        if (typeof valColuna === 'boolean') {
          resolvedFlags[key] = valColuna;
        } else if (typeof valJson === 'boolean') {
          resolvedFlags[key] = valJson;
        } else {
          chavesFaltantes.push(key);
          resolvedFlags[key] = true; // valor padrão
        }
      });

      let status: 'integra' | 'ausente' | 'corrompida' = 'integra';
      let detalhesStatus = 'Configuração completa e íntegra (9/9 módulos parametrizados)';

      if (chavesFaltantes.length > 0 || !cfg.feature_flags || typeof cfg.feature_flags !== 'object') {
        status = 'corrompida';
        if (chavesFaltantes.length > 0) {
          detalhesStatus = 'Faltam ' + chavesFaltantes.length + ' chave(s) de modulos: ' + chavesFaltantes.join(', ');
        } else {
          detalhesStatus = 'Campo feature_flags nulo ou não formatado como JSON';
        }
      }

      return {
        condominioId: condo.id,
        condominioNome: condo.nome || 'Condomínio Sem Nome',
        configId: cfg.id,
        status,
        detalhesStatus,
        featureFlags: resolvedFlags,
        chavesFaltantes
      };
    });

    return listaDiagnosticos;
  } catch (err) {
    console.error('Erro na auditoria de configurações de condomínios:', err);
    return [];
  }
}

/**
 * Corrige ou restaura a configuração íntegra de um condomínio específico.
 */
export async function repairCondominioConfig(
  condominioId: string, 
  currentDiag?: CondominioConfigDiagnostic
): Promise<{ success: boolean; error?: string }> {
  try {
    const defaultFlags = {
      mod02_gestao_encomendas: currentDiag?.featureFlags?.mod02_gestao_encomendas ?? true,
      mod03_custodia_itens: currentDiag?.featureFlags?.mod03_custodia_itens ?? true,
      mod04_materiais_posto: currentDiag?.featureFlags?.mod04_materiais_posto ?? true,
      mod05_quadro_chaves: currentDiag?.featureFlags?.mod05_quadro_chaves ?? true,
      mod06_gestao_manutencao: currentDiag?.featureFlags?.mod06_gestao_manutencao ?? true,
      mod07_gestao_ronda: currentDiag?.featureFlags?.mod07_gestao_ronda ?? true,
      mod08_livro_ocorrencias: currentDiag?.featureFlags?.mod08_livro_ocorrencias ?? true,
      mod09_passagem_posto: currentDiag?.featureFlags?.mod09_passagem_posto ?? true,
      mod10_prestadores_servico: currentDiag?.featureFlags?.mod10_prestadores_servico ?? true
    };

    // Atualiza imediatamente cache local do navegador
    localStorage.setItem(`infport_flags_${condominioId}`, JSON.stringify(defaultFlags));

    const fullPayload: any = {
      condominio_id: condominioId,
      feature_flags: defaultFlags,
      ...defaultFlags
    };

    let saved = false;

    // Verifica se já existe registro
    const { data: existing } = await supabase
      .from('configuracoes')
      .select('id')
      .eq('condominio_id', condominioId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('configuracoes')
        .update(fullPayload)
        .eq('id', existing.id);
      if (!error) saved = true;
    } else {
      const { error } = await supabase
        .from('configuracoes')
        .insert([fullPayload]);
      if (!error) saved = true;
    }

    // Fallback caso colunas individuais específicas não estejam no cache do Supabase
    if (!saved) {
      const fallbackPayload = {
        condominio_id: condominioId,
        feature_flags: defaultFlags
      };

      if (existing?.id) {
        const { error: fbErr } = await supabase
          .from('configuracoes')
          .update(fallbackPayload)
          .eq('id', existing.id);
        if (fbErr) throw fbErr;
      } else {
        const { error: fbErr } = await supabase
          .from('configuracoes')
          .insert([fallbackPayload]);
        if (fbErr) throw fbErr;
      }
    }

    // Dispara evento em tempo real para sincronização com o App
    window.dispatchEvent(new CustomEvent('modulos_atualizados', {
      detail: { condominio_id: condominioId, flags: defaultFlags }
    }));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao reparar configuração' };
  }
}

/**
 * Corrige em lote todas as configurações ausentes ou corrompidas de condomínios.
 */
export async function repairAllCondominiosConfigs(): Promise<{ totalRepaired: number; totalErrors: number; errors: string[] }> {
  const diagnostics = await auditCondominiosConfigs();
  const needingRepair = diagnostics.filter((d) => d.status !== 'integra');

  let totalRepaired = 0;
  let totalErrors = 0;
  const errors: string[] = [];

  for (const diag of needingRepair) {
    const res = await repairCondominioConfig(diag.condominioId, diag);
    if (res.success) {
      totalRepaired++;
    } else {
      totalErrors++;
      if (res.error) errors.push(`${diag.condominioNome}: ${res.error}`);
    }
  }

  return { totalRepaired, totalErrors, errors };
}
