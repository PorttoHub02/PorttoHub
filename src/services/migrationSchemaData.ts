/**
 * Definições oficiais de Esquemas, Tipos e Mapeamento Universal
 * do Módulo Migrador Oficial: Supabase v2.6 Enterprise para o PorttoHub.
 */

export interface ColumnDef {
  name: string;
  type: 'uuid' | 'text' | 'timestamptz' | 'jsonb' | 'boolean' | 'integer' | 'numeric' | 'date';
  primary?: boolean;
  required?: boolean;
  description?: string;
}

export interface TableMigrationModel {
  id: string;
  name: string;
  label: string;
  category: 'Base' | 'Acesso' | 'Encomendas' | 'Custódia' | 'Chaves' | 'Materiais' | 'Rondas' | 'Manutenção' | 'Ocorrências' | 'Sistema' | 'Auditoria' | 'Bancada';
  order: number;
  selected: boolean;
  recordsCount: number;
  targetRecordsCount?: number;
  sourceColumns: ColumnDef[];
  targetColumns: ColumnDef[];
  mapping: Record<string, string>; // ColunaOrigem -> ColunaDestino
  aliases?: string[];
  description: string;
}

export interface ConnectionProfile {
  id: string;
  name: string;
  type: 'source' | 'target' | 'both';
  url: string;
  key: string;
  description?: string;
  isDefault?: boolean;
  status?: 'untested' | 'connected' | 'error';
  latencyMs?: number;
  lastChecked?: string;
}

export const INITIAL_CONNECTIONS_ENTERPRISE: ConnectionProfile[] = [
  {
    id: 'caetano_infport',
    name: 'Produção Antiga (Origem caetano_infport)',
    type: 'source',
    url: 'https://juafrepntyksgqiqzyes.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6Imp1YWZyZXBudHlrc2dxaXF6eWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTk2NDEsImV4cCI6MjEwNTE5NTY0MX0.vIAQfpjj2PXkgF5Lw8txa0OrCitxmUxG8IEhWePM3Is',
    description: 'Banco Supabase v1 legado com dados históricos de portaria',
    isDefault: true
  },
  {
    id: 'caetano_backup_oficial',
    name: 'Backup c/ 247 Entregadores (Origem Oficial)',
    type: 'source',
    url: 'https://fukxrdzhryumbcqibtas.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1a3hyZHpocnl1bWJjcWlidGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NTY3MTUsImV4cCI6MjEwODQzMjcxNX0.f7DAt8NKPu4JMsLX-NMxBorBmFPxXTmtLJ359-ictz0',
    description: 'Base completa com 247 entregadores cadastrados e condomínios',
    isDefault: false
  },
  {
    id: 'porttohub_supabase_novo',
    name: 'Novo Supabase 2026 (Destino PorttoHub)',
    type: 'target',
    url: 'https://pkemipwowkcnstbazlma.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW1pcHdvd2tjbnN0YmF6bG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MjI0MDQsImV4cCI6MjEwODk5ODQwNH0.oGV6ru4O-OgZ-LeSAtZp0kCZZqpK2BR49F1WCbO1yR0',
    description: 'Instância oficial de alta velocidade PostgreSQL com RLS e Edge Engine',
    isDefault: true
  }
];

export const PORTTOHUB_CORE_TABLES_SCHEMA: TableMigrationModel[] = [
  {
    id: 't_condominios',
    name: 'condominios',
    label: 'Condomínios',
    category: 'Base',
    order: 1,
    selected: true,
    recordsCount: 0,
    description: 'Entidade raiz multi-condomínio e configurações estruturais.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'nome', type: 'text', required: true },
      { name: 'cnpj', type: 'text' },
      { name: 'endereco', type: 'text' },
      { name: 'cidade', type: 'text' },
      { name: 'uf', type: 'text' },
      { name: 'telefone_portaria', type: 'text' },
      { name: 'sindico_nome', type: 'text' },
      { name: 'sindico_whatsapp', type: 'text' },
      { name: 'whatsapp_grupo_url', type: 'text' },
      { name: 'tipo_estrutura', type: 'text' },
      { name: 'qtd_blocos', type: 'integer' },
      { name: 'unidades_por_bloco', type: 'integer' },
      { name: 'nomes_blocos', type: 'text' },
      { name: 'locais_armazenamento', type: 'jsonb' },
      { name: 'turnos_plantao', type: 'jsonb' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'nome', type: 'text', required: true },
      { name: 'cnpj', type: 'text' },
      { name: 'endereco', type: 'text' },
      { name: 'cidade', type: 'text' },
      { name: 'uf', type: 'text' },
      { name: 'telefone_portaria', type: 'text' },
      { name: 'sindico_nome', type: 'text' },
      { name: 'sindico_whatsapp', type: 'text' },
      { name: 'whatsapp_grupo_url', type: 'text' },
      { name: 'whatsapp_grupo_portaria', type: 'text' },
      { name: 'escala_plantao', type: 'text' },
      { name: 'horario_diurno_inicio', type: 'text' },
      { name: 'horario_noturno_inicio', type: 'text' },
      { name: 'intervalo_ronda', type: 'integer' },
      { name: 'tipo_estrutura', type: 'text' },
      { name: 'tipo', type: 'text' },
      { name: 'qtd_blocos', type: 'integer' },
      { name: 'unidades_por_bloco', type: 'integer' },
      { name: 'nomes_blocos', type: 'text' },
      { name: 'zeros_esquerda', type: 'boolean' },
      { name: 'locais_armazenamento', type: 'jsonb' },
      { name: 'turnos_plantao', type: 'jsonb' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'rua': 'endereco',
      'logradouro': 'endereco',
      'whatsapp_sindico': 'sindico_whatsapp'
    }
  },
  {
    id: 't_operadores',
    name: 'operadores',
    label: 'Operadores & Porteiros',
    category: 'Acesso',
    order: 2,
    selected: true,
    recordsCount: 0,
    description: 'Usuários do sistema, porteiros e níveis de acesso RBAC.',
    aliases: ['usuarios_sistema', 'usuarios', 'porteiros'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'login', type: 'text', required: true },
      { name: 'senha', type: 'text' },
      { name: 'cargo', type: 'text' },
      { name: 'funcao', type: 'text' },
      { name: 'telefone', type: 'text' },
      { name: 'turno_padrao', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'nivel_acesso', type: 'integer' },
      { name: 'perfil', type: 'text' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'login', type: 'text', required: true },
      { name: 'senha', type: 'text' },
      { name: 'funcao', type: 'text' },
      { name: 'cargo', type: 'text' },
      { name: 'telefone', type: 'text' },
      { name: 'turno_padrao', type: 'text' },
      { name: 'turno', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'nivel_acesso', type: 'integer' },
      { name: 'nivel_acesso_custom_id', type: 'uuid' },
      { name: 'perfil', type: 'text' },
      { name: 'foto_url', type: 'text' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'usuario': 'login',
      'username': 'login',
      'foto': 'foto_url'
    }
  },
  {
    id: 't_moradores',
    name: 'moradores',
    label: 'Moradores & Unidades',
    category: 'Base',
    order: 3,
    selected: true,
    recordsCount: 0,
    description: 'Cadastros de moradores, veículos, contatos e tags RFID.',
    aliases: ['morador', 'cadastros_moradores'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'bloco', type: 'text' },
      { name: 'unidade', type: 'text', required: true },
      { name: 'telefone', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'tipo', type: 'text' },
      { name: 'cpf', type: 'text' },
      { name: 'tag_rfid', type: 'text' },
      { name: 'veiculo_placa', type: 'text' },
      { name: 'veiculo_modelo', type: 'text' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'bloco', type: 'text' },
      { name: 'unidade', type: 'text', required: true },
      { name: 'telefone', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'tipo', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'cpf', type: 'text' },
      { name: 'rg', type: 'text' },
      { name: 'documento', type: 'text' },
      { name: 'foto_url', type: 'text' },
      { name: 'foto', type: 'text' },
      { name: 'tag_rfid', type: 'text' },
      { name: 'codigo_acesso', type: 'text' },
      { name: 'status_acesso', type: 'text' },
      { name: 'veiculo_placa', type: 'text' },
      { name: 'veiculo_modelo', type: 'text' },
      { name: 'contato_emergencia', type: 'text' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'celular': 'telefone',
      'placa': 'veiculo_placa',
      'carro': 'veiculo_modelo'
    }
  },
  {
    id: 't_entregadores',
    name: 'entregadores',
    label: 'Entregadores Frequentes',
    category: 'Encomendas',
    order: 4,
    selected: true,
    recordsCount: 0,
    description: 'Base de entregadores (Correios, Mercado Livre, iFood, etc.).',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'documento', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'telefone', type: 'text' },
      { name: 'foto_url', type: 'text' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'documento', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'telefone', type: 'text' },
      { name: 'foto_url', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'transportadora': 'empresa',
      'rg_cpf': 'documento'
    }
  },
  {
    id: 't_locais_armazenamento',
    name: 'locais_armazenamento',
    label: 'Locais & Escaninhos',
    category: 'Encomendas',
    order: 5,
    selected: true,
    recordsCount: 0,
    description: 'Armários, prateleiras e setores de guarda de volumes.',
    aliases: ['escaninhos', 'locais'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'codigo', type: 'text' },
      { name: 'categoria', type: 'text' },
      { name: 'capacidade', type: 'text' },
      { name: 'ativo', type: 'boolean' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'codigo', type: 'text' },
      { name: 'categoria', type: 'text' },
      { name: 'capacidade', type: 'text' },
      { name: 'descricao', type: 'text' },
      { name: 'observacao', type: 'text' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {}
  },
  {
    id: 't_lotes_re',
    name: 'lotes_re',
    label: 'Lotes RE de Encomendas',
    category: 'Encomendas',
    order: 6,
    selected: true,
    recordsCount: 0,
    description: 'Lotes de recebimento na portaria.',
    aliases: ['lotes', 'recebimentos'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'codigo_re', type: 'text' },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'entregador_id', type: 'uuid' },
      { name: 'qtd_declarada', type: 'integer' },
      { name: 'qtd_triada', type: 'integer' },
      { name: 'status', type: 'text' },
      { name: 'operador_nome', type: 'text' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'codigo_re', type: 'text' },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'entregador_id', type: 'uuid' },
      { name: 'qtd_declarada', type: 'integer' },
      { name: 'qtd_triada', type: 'integer' },
      { name: 'status', type: 'text' },
      { name: 'operador_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      're_codigo': 'codigo_re'
    }
  },
  {
    id: 't_encomendas_itens',
    name: 'encomendas_itens',
    label: 'Encomendas & Pacotes',
    category: 'Encomendas',
    order: 7,
    selected: true,
    recordsCount: 0,
    description: 'Registro de pacotes individuais, rastreio, OCR e baixa com assinatura.',
    aliases: ['encomendas', 'pacotes', 'encomenda_itens', 'itens_encomendas'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'lote_re_id', type: 'uuid' },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'bloco', type: 'text' },
      { name: 'unidade', type: 'text', required: true },
      { name: 'destinatario', type: 'text' },
      { name: 'codigo_barras', type: 'text' },
      { name: 'codigo_rastreio', type: 'text' },
      { name: 'local_armazenamento', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'retirado_por', type: 'text' },
      { name: 'data_recebimento', type: 'timestamptz' },
      { name: 'data_retirada', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'lote_re_id', type: 'uuid' },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'bloco', type: 'text' },
      { name: 'unidade', type: 'text', required: true },
      { name: 'morador_id', type: 'uuid' },
      { name: 'codigo_barras', type: 'text' },
      { name: 'codigo_rastreio', type: 'text' },
      { name: 'destinatario', type: 'text' },
      { name: 'foto_etiqueta_url', type: 'text' },
      { name: 'foto_etiqueta', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'local_armazenamento', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'retirado_por', type: 'text' },
      { name: 'foto_retirada_url', type: 'text' },
      { name: 'foto_comprovante_url', type: 'text' },
      { name: 'data_recebimento', type: 'timestamptz' },
      { name: 'data_retirada', type: 'timestamptz' },
      { name: 'data_hora_retirada', type: 'timestamptz' },
      { name: 'operador_baixa_id', type: 'uuid' },
      { name: 'operador_baixa_nome', type: 'text' },
      { name: 'operador_baixa', type: 'text' },
      { name: 'operador_entrada', type: 'text' },
      { name: 'documento_retirante', type: 'text' },
      { name: 'parentesco_vinculo', type: 'text' },
      { name: 'assinatura_url', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'foto': 'foto_etiqueta_url',
      'escaninho': 'local_armazenamento',
      'recebedor': 'retirado_por'
    }
  },
  {
    id: 't_custodia',
    name: 'custodia',
    label: 'Itens em Custódia',
    category: 'Custódia',
    order: 8,
    selected: true,
    recordsCount: 0,
    description: 'Guarda temporária de pertences de moradores ou visitantes.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'codigo', type: 'text' },
      { name: 'item_descricao', type: 'text', required: true },
      { name: 'categoria', type: 'text' },
      { name: 'unidade', type: 'text' },
      { name: 'bloco', type: 'text' },
      { name: 'depositante_nome', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'data_entrada', type: 'timestamptz' },
      { name: 'data_saida', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'codigo', type: 'text' },
      { name: 'item_descricao', type: 'text', required: true },
      { name: 'categoria', type: 'text' },
      { name: 'unidade', type: 'text' },
      { name: 'bloco', type: 'text' },
      { name: 'depositante_nome', type: 'text' },
      { name: 'depositante_tipo', type: 'text' },
      { name: 'depositante_contato', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'local_armazenamento', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'retirado_por', type: 'text' },
      { name: 'documento_retirante', type: 'text' },
      { name: 'parentesco_retirante', type: 'text' },
      { name: 'data_entrada', type: 'timestamptz' },
      { name: 'data_saida', type: 'timestamptz' },
      { name: 'operador_entrada_nome', type: 'text' },
      { name: 'operador_saida_nome', type: 'text' },
      { name: 'foto_item_url', type: 'text' },
      { name: 'assinatura_retirada_url', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'descricao': 'item_descricao',
      'depositante': 'depositante_nome'
    }
  },
  {
    id: 't_chaves',
    name: 'chaves',
    label: 'Claviculário de Chaves',
    category: 'Chaves',
    order: 9,
    selected: true,
    recordsCount: 0,
    description: 'Gestão de chaves da portaria, áreas comuns e salas técnicas.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'codigo', type: 'text', required: true },
      { name: 'descricao', type: 'text', required: true },
      { name: 'localizacao', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'categoria', type: 'text' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'codigo', type: 'text', required: true },
      { name: 'descricao', type: 'text', required: true },
      { name: 'localizacao', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'categoria', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'sala': 'localizacao'
    }
  },
  {
    id: 't_movimentacao_chaves',
    name: 'movimentacao_chaves',
    label: 'Movimentações de Chaves',
    category: 'Chaves',
    order: 10,
    selected: true,
    recordsCount: 0,
    description: 'Retiradas e devoluções de chaves com registros e assinaturas.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'chave_id', type: 'uuid', required: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'tipo_movimento', type: 'text' },
      { name: 'retirado_por', type: 'text', required: true },
      { name: 'operador_nome', type: 'text' },
      { name: 'data_retirada', type: 'timestamptz' },
      { name: 'data_devolucao', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'chave_id', type: 'uuid', required: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'tipo_movimento', type: 'text' },
      { name: 'retirado_por', type: 'text', required: true },
      { name: 'documento_retirante', type: 'text' },
      { name: 'empresa_retirante', type: 'text' },
      { name: 'telefone_retirante', type: 'text' },
      { name: 'operador_nome', type: 'text' },
      { name: 'data_retirada', type: 'timestamptz' },
      { name: 'data_devolucao', type: 'timestamptz' },
      { name: 'motivo', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    mapping: {}
  },
  {
    id: 't_materiais_posto',
    name: 'materiais_posto',
    label: 'Materiais & Inventário Posto',
    category: 'Materiais',
    order: 11,
    selected: true,
    recordsCount: 0,
    description: 'Rádios comunicadores, lanternas, cones e equipamentos da portaria.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'codigo', type: 'text' },
      { name: 'nome', type: 'text', required: true },
      { name: 'categoria', type: 'text' },
      { name: 'quantidade_total', type: 'integer' },
      { name: 'quantidade_disponivel', type: 'integer' },
      { name: 'estado_conservacao', type: 'text' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'codigo', type: 'text' },
      { name: 'nome', type: 'text', required: true },
      { name: 'categoria', type: 'text' },
      { name: 'quantidade_total', type: 'integer' },
      { name: 'quantidade_disponivel', type: 'integer' },
      { name: 'estado_conservacao', type: 'text' },
      { name: 'localizacao', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'qtd': 'quantidade_total'
    }
  },
  {
    id: 't_prestadores',
    name: 'prestadores',
    label: 'Prestadores & Autorizados',
    category: 'Acesso',
    order: 12,
    selected: true,
    recordsCount: 0,
    description: 'Cadastro de prestadores de serviço, obras e visitantes.',
    aliases: ['prestadores_servico', 'visitantes', 'visitas'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome_completo', type: 'text', required: true },
      { name: 'documento', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'tipo_servico', type: 'text' },
      { name: 'status_acesso', type: 'text' },
      { name: 'unidade', type: 'text' },
      { name: 'bloco', type: 'text' },
      { name: 'cracha', type: 'text' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'perfil_acesso', type: 'text' },
      { name: 'nome_profissional', type: 'text' },
      { name: 'nome_completo', type: 'text', required: true },
      { name: 'documento', type: 'text' },
      { name: 'tipo_documento', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'parentesco_vinculo', type: 'text' },
      { name: 'telefone', type: 'text' },
      { name: 'placa_veiculo', type: 'text' },
      { name: 'modelo_veiculo', type: 'text' },
      { name: 'foto_rosto', type: 'text' },
      { name: 'foto_documento', type: 'text' },
      { name: 'tipo_servico', type: 'text' },
      { name: 'atende_condominio', type: 'boolean' },
      { name: 'unidade', type: 'text' },
      { name: 'bloco', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'status_acesso', type: 'text' },
      { name: 'cracha', type: 'text' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'nome': 'nome_completo',
      'funcao': 'tipo_servico'
    }
  },
  {
    id: 't_rondas_setores',
    name: 'rondas_setores',
    label: 'Setores de Ronda',
    category: 'Rondas',
    order: 13,
    selected: true,
    recordsCount: 0,
    description: 'Setores definidos para fiscalização patrimonial.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'descricao', type: 'text' },
      { name: 'ordem', type: 'integer' },
      { name: 'ativo', type: 'boolean' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'descricao', type: 'text' },
      { name: 'ordem', type: 'integer' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {}
  },
  {
    id: 't_rondas_pontos',
    name: 'rondas_pontos',
    label: 'Pontos de Ronda (QR/GPS)',
    category: 'Rondas',
    order: 14,
    selected: true,
    recordsCount: 0,
    description: 'Pontos físicos de bipagem com geolocalização e QR Code.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'setor_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'codigo_qr', type: 'text' },
      { name: 'latitude', type: 'numeric' },
      { name: 'longitude', type: 'numeric' },
      { name: 'ordem', type: 'integer' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'setor_id', type: 'uuid' },
      { name: 'nome', type: 'text', required: true },
      { name: 'codigo_qr', type: 'text' },
      { name: 'latitude', type: 'numeric' },
      { name: 'longitude', type: 'numeric' },
      { name: 'ordem', type: 'integer' },
      { name: 'ativo', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'qr_code': 'codigo_qr'
    }
  },
  {
    id: 't_rondas_execucao',
    name: 'rondas_execucao',
    label: 'Rondas Executadas',
    category: 'Rondas',
    order: 15,
    selected: true,
    recordsCount: 0,
    description: 'Histórico de rondas patrulhadas com tempo e taxa de cobertura.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'turno', type: 'text' },
      { name: 'data_inicio', type: 'timestamptz' },
      { name: 'data_fim', type: 'timestamptz' },
      { name: 'duracao_segundos', type: 'integer' },
      { name: 'total_pontos', type: 'integer' },
      { name: 'pontos_conferidos', type: 'integer' },
      { name: 'status', type: 'text' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'turno', type: 'text' },
      { name: 'data_inicio', type: 'timestamptz' },
      { name: 'data_fim', type: 'timestamptz' },
      { name: 'duracao_segundos', type: 'integer' },
      { name: 'total_pontos', type: 'integer' },
      { name: 'pontos_conferidos', type: 'integer' },
      { name: 'status', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {}
  },
  {
    id: 't_chamados_manutencao',
    name: 'chamados_manutencao',
    label: 'Chamados & OS Manutenção',
    category: 'Manutenção',
    order: 16,
    selected: true,
    recordsCount: 0,
    description: 'Ordens de serviço de eletricidade, hidráulica, pintura e portões.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'titulo', type: 'text', required: true },
      { name: 'descricao', type: 'text' },
      { name: 'categoria', type: 'text' },
      { name: 'prioridade', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'local', type: 'text' },
      { name: 'solicitante_nome', type: 'text' },
      { name: 'data_abertura', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'titulo', type: 'text', required: true },
      { name: 'descricao', type: 'text' },
      { name: 'categoria', type: 'text' },
      { name: 'prioridade', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'local', type: 'text' },
      { name: 'solicitante_nome', type: 'text' },
      { name: 'solicitante_tipo', type: 'text' },
      { name: 'operador_abertura_id', type: 'uuid' },
      { name: 'operador_abertura_nome', type: 'text' },
      { name: 'data_abertura', type: 'timestamptz' },
      { name: 'data_conclusao', type: 'timestamptz' },
      { name: 'custo_estimado', type: 'numeric' },
      { name: 'custo_real', type: 'numeric' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {}
  },
  {
    id: 't_ocorrencias',
    name: 'ocorrencias',
    label: 'Livro de Ocorrências',
    category: 'Ocorrências',
    order: 17,
    selected: true,
    recordsCount: 0,
    description: 'Livro digital de ocorrências, fotos, barulho e sinistros.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'titulo', type: 'text', required: true },
      { name: 'descricao', type: 'text' },
      { name: 'tipo', type: 'text' },
      { name: 'prioridade', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'operador_nome', type: 'text' },
      { name: 'unidade_bloco', type: 'text' },
      { name: 'data_hora', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'titulo', type: 'text', required: true },
      { name: 'descricao', type: 'text' },
      { name: 'tipo', type: 'text' },
      { name: 'prioridade', type: 'text' },
      { name: 'gravidade', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'foto_url', type: 'text' },
      { name: 'fotos', type: 'jsonb' },
      { name: 'operador_nome', type: 'text' },
      { name: 'operador_id', type: 'uuid' },
      { name: 'operador_login', type: 'text' },
      { name: 'unidade_bloco', type: 'text' },
      { name: 'bloco', type: 'text' },
      { name: 'unidade', type: 'text' },
      { name: 'data_hora', type: 'timestamptz' },
      { name: 'resolucao', type: 'text' },
      { name: 'data_resolucao', type: 'timestamptz' },
      { name: 'operador_resolucao', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {
      'foto': 'foto_url',
      'unidade': 'unidade_bloco'
    }
  },
  {
    id: 't_passagens_posto',
    name: 'passagens_posto',
    label: 'Passagens de Posto',
    category: 'Sistema',
    order: 18,
    selected: true,
    recordsCount: 0,
    description: 'Transição oficial de turno entre porteiros com check de itens.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_sai_nome', type: 'text' },
      { name: 'operador_entra_nome', type: 'text' },
      { name: 'turno_sai', type: 'text' },
      { name: 'turno_entra', type: 'text' },
      { name: 'data_hora', type: 'timestamptz' },
      { name: 'observacoes', type: 'text' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_sai_id', type: 'uuid' },
      { name: 'operador_sai_nome', type: 'text' },
      { name: 'operador_entra_id', type: 'uuid' },
      { name: 'operador_entra_nome', type: 'text' },
      { name: 'turno_sai', type: 'text' },
      { name: 'turno_entra', type: 'text' },
      { name: 'data_hora', type: 'timestamptz' },
      { name: 'materiais_conferidos', type: 'text' },
      { name: 'chaves_pendentes', type: 'text' },
      { name: 'ocorrencias_resumo', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' }
    ],
    mapping: {}
  },
  {
    id: 't_historico_absoluto',
    name: 'historico_absoluto',
    label: 'Histórico & Auditoria',
    category: 'Auditoria',
    order: 19,
    selected: true,
    recordsCount: 0,
    description: 'Trilha imutável de auditoria de eventos e acessos no PorttoHub.',
    aliases: ['auditoria', 'logs_atividades', 'historico'],
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'modulo', type: 'text' },
      { name: 'acao', type: 'text' },
      { name: 'descricao', type: 'text' },
      { name: 'detalhes', type: 'jsonb' },
      { name: 'data_hora', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'operador_login', type: 'text' },
      { name: 'modulo', type: 'text' },
      { name: 'acao', type: 'text' },
      { name: 'descricao', type: 'text' },
      { name: 'detalhes', type: 'jsonb' },
      { name: 'ip', type: 'text' },
      { name: 'criado_em', type: 'timestamptz' },
      { name: 'data_hora', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    mapping: {
      'timestamp': 'data_hora',
      'old_metadata': 'detalhes'
    }
  },
  {
    id: 't_lembretes_portaria',
    name: 'lembretes_portaria',
    label: 'Lembretes de Portaria',
    category: 'Sistema',
    order: 20,
    selected: true,
    recordsCount: 0,
    description: 'Lembretes com alarme e aviso para os próximos plantões.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'mensagem', type: 'text', required: true },
      { name: 'tipo', type: 'text' },
      { name: 'lido', type: 'boolean' },
      { name: 'finalizado', type: 'boolean' },
      { name: 'created_at', type: 'timestamptz' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'unidade_bloco', type: 'text' },
      { name: 'remetente_tipo', type: 'text' },
      { name: 'remetente_nome', type: 'text' },
      { name: 'mensagem', type: 'text', required: true },
      { name: 'tipo', type: 'text' },
      { name: 'lido', type: 'boolean' },
      { name: 'lido_em', type: 'timestamptz' },
      { name: 'lido_por_nome', type: 'text' },
      { name: 'lido_por_id', type: 'uuid' },
      { name: 'finalizado', type: 'boolean' },
      { name: 'finalizado_em', type: 'timestamptz' },
      { name: 'finalizado_por_nome', type: 'text' },
      { name: 'finalizado_por_id', type: 'uuid' },
      { name: 'eh_adm', type: 'boolean' },
      { name: 'data_limite', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'updated_at', type: 'timestamptz' },
      { name: 'prioridade', type: 'text' }
    ],
    mapping: {}
  },
  {
    id: 't_bancada_conferencias',
    name: 'bancada_conferencias',
    label: 'Conferências de Bancada',
    category: 'Bancada',
    order: 21,
    selected: true,
    recordsCount: 0,
    description: 'Sessões de triagem rápida e contagem na bancada da portaria.',
    sourceColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'data_hora', type: 'timestamptz' },
      { name: 'total_volumes', type: 'integer' },
      { name: 'total_unidades', type: 'integer' }
    ],
    targetColumns: [
      { name: 'id', type: 'uuid', primary: true },
      { name: 'condominio_id', type: 'uuid' },
      { name: 'operador_nome', type: 'text' },
      { name: 'operador_id', type: 'uuid' },
      { name: 'data_hora', type: 'timestamptz' },
      { name: 'total_volumes', type: 'integer' },
      { name: 'total_unidades', type: 'integer' },
      { name: 'estruturas_resumo', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'itens', type: 'jsonb' }
    ],
    mapping: {}
  }
];

export function carregarConexoesArmazenadas(): ConnectionProfile[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return INITIAL_CONNECTIONS_ENTERPRISE;
  }
  try {
    const salvo = window.localStorage.getItem('porttohub_migrador_connections_v2');
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Migrador] Falha ao carregar conexões:', err);
  }
  return INITIAL_CONNECTIONS_ENTERPRISE;
}

export function resetarConexoesPadrao(): ConnectionProfile[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('porttohub_migrador_connections_v2');
  }
  return INITIAL_CONNECTIONS_ENTERPRISE;
}

export function salvarConexoesArmazenadas(conexoes: ConnectionProfile[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('porttohub_migrador_connections_v2', JSON.stringify(conexoes));
  }
}

export function carregarMapeamentosArmazenados(): Record<string, Record<string, string>> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const salvo = window.localStorage.getItem('porttohub_column_mappings_v2');
    if (salvo) {
      return JSON.parse(salvo);
    }
  } catch {
    // fallback
  }
  return {};
}

export function salvarMapeamentosArmazenados(mappings: Record<string, Record<string, string>>): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('porttohub_column_mappings_v2', JSON.stringify(mappings));
  }
}
