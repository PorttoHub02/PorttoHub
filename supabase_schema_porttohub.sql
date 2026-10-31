-- ==============================================================================
-- PORTTOHUB 2.0 - ESQUEMA MESTRE POSTGRESQL & SUPABASE (PROJETO OFICIAL)
-- URL: https://pkemipwowkcnstbazlma.supabase.co
-- ARQUITETURA: PostgreSQL + Supabase PostgREST + Realtime + RLS + Storage
-- OTIMIZADO PARA: Cloudflare Pages / Workers, Edge Latency e PWA Local-First
-- ==============================================================================

BEGIN;

-- Extensões Essenciais de Performance e Criptografia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função Utilitária Global para Atualização Automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. CADASTROS BASE & MULTI-TENANCY
-- ------------------------------------------------------------------------------

-- Tabela: condominios (Tabela Raiz do Sistema Multi-Tenant)
CREATE TABLE IF NOT EXISTS public.condominios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  cnpj TEXT,
  cidade TEXT DEFAULT 'São Paulo',
  uf TEXT DEFAULT 'SP',
  telefone_portaria TEXT,
  sindico_nome TEXT,
  sindico_whatsapp TEXT,
  whatsapp_grupo_url TEXT,
  whatsapp_grupo_portaria TEXT,
  escala_plantao TEXT DEFAULT '06_18',
  horario_diurno_inicio TEXT DEFAULT '06:00',
  horario_noturno_inicio TEXT DEFAULT '18:00',
  intervalo_ronda INTEGER DEFAULT 15,
  tipo_estrutura TEXT DEFAULT 'apartamentos',
  tipo TEXT DEFAULT 'residencial',
  qtd_blocos INTEGER DEFAULT 1,
  unidades_por_bloco INTEGER DEFAULT 100,
  nomes_blocos TEXT,
  zeros_esquerda BOOLEAN DEFAULT TRUE,
  locais_armazenamento JSONB DEFAULT '["Bancada Principal", "Prateleira A", "Prateleira B", "Chão / Caixas Grandes"]'::jsonb,
  turnos_plantao JSONB DEFAULT '{"diurno": "06:00 - 18:00", "noturno": "18:00 - 06:00"}'::jsonb,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: configuracoes (Feature Flags e Parametrizações por Condomínio)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  niveis_acesso JSONB DEFAULT '[]'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  whatsapp_modulos JSONB DEFAULT '{"encomendas": true, "visitantes": true, "ocorrencias": true}'::jsonb,
  locais_armazenamento JSONB DEFAULT '["Bancada Principal", "Prateleira A", "Prateleira B", "Chão / Caixas Grandes"]'::jsonb,
  setores_ronda JSONB DEFAULT '[]'::jsonb,
  turnos_plantao JSONB DEFAULT '{}'::jsonb,
  dados_tenant JSONB DEFAULT '{}'::jsonb,
  mod01_cadastros_base BOOLEAN DEFAULT TRUE,
  mod02_gestao_encomendas BOOLEAN DEFAULT TRUE,
  mod03_custodia_itens BOOLEAN DEFAULT TRUE,
  mod04_materiais_posto BOOLEAN DEFAULT TRUE,
  mod05_quadro_chaves BOOLEAN DEFAULT TRUE,
  mod06_gestao_manutencao BOOLEAN DEFAULT TRUE,
  mod07_gestao_ronda BOOLEAN DEFAULT TRUE,
  mod08_livro_ocorrencias BOOLEAN DEFAULT TRUE,
  mod09_passagem_posto BOOLEAN DEFAULT TRUE,
  mod10_prestadores_servico BOOLEAN DEFAULT TRUE,
  mod11_bancada_conferencia BOOLEAN DEFAULT TRUE,
  mod12_historico_absoluto BOOLEAN DEFAULT TRUE,
  mod_portal_sindico BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: operadores (Equipe de Portaria, Zeladoria, Supervisão e Síndico)
CREATE TABLE IF NOT EXISTS public.operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  senha TEXT,
  funcao TEXT DEFAULT 'Porteiro',
  cargo TEXT DEFAULT 'Porteiro',
  perfil TEXT DEFAULT 'operador',
  telefone TEXT,
  email TEXT,
  turno TEXT DEFAULT 'Diurno',
  turno_padrao TEXT DEFAULT 'Diurno',
  nivel_acesso TEXT DEFAULT 'operador',
  permissoes JSONB DEFAULT '{"modulos": ["*"]}'::jsonb,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: moradores (Unidades, Veículos, Biometria/Tags e WhatsApp)
CREATE TABLE IF NOT EXISTS public.moradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  bloco TEXT DEFAULT '',
  unidade TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  cpf TEXT,
  rg TEXT,
  documento TEXT,
  tipo TEXT DEFAULT 'Morador',
  foto_url TEXT,
  foto TEXT,
  tag_rfid TEXT,
  codigo_acesso TEXT,
  status_acesso TEXT DEFAULT 'liberado',
  veiculo_placa TEXT,
  veiculo_modelo TEXT,
  contato_emergencia TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. GESTÃO DE ENCOMENDAS, LOTES & TRIAGEM INTELIGENTE
-- ------------------------------------------------------------------------------

-- Tabela: entregadores (Entregadores e Transportadoras Frequentes)
CREATE TABLE IF NOT EXISTS public.entregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  empresa TEXT,
  documento TEXT,
  telefone TEXT,
  foto_url TEXT,
  frequencia TEXT DEFAULT 'recorrente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: lotes_re (Lotes de Recebimento de Entrega diários)
CREATE TABLE IF NOT EXISTS public.lotes_re (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  codigo_re TEXT NOT NULL,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  entregador_id UUID REFERENCES public.entregadores(id) ON DELETE SET NULL,
  entregador_nome TEXT,
  empresa TEXT,
  quantidade_declarada INTEGER DEFAULT 1,
  quantidade_triada INTEGER DEFAULT 0,
  status TEXT DEFAULT 'concluido',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: encomendas_itens (Itens Individuais com Rastreio, Foto e Baixa)
CREATE TABLE IF NOT EXISTS public.encomendas_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  lote_re_id UUID REFERENCES public.lotes_re(id) ON DELETE SET NULL,
  codigo_re TEXT,
  codigo_rastreio TEXT,
  codigo_pacote TEXT,
  destinatario_nome TEXT,
  unidade TEXT NOT NULL,
  bloco TEXT DEFAULT '',
  unidade_bloco TEXT,
  tipo_volume TEXT DEFAULT 'Pacote Pequeno',
  local_armazenamento TEXT DEFAULT 'Bancada Principal',
  transportadora TEXT,
  remetente TEXT,
  foto_url TEXT,
  status TEXT DEFAULT 'aguardando_retirada',
  operador_triagem_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_triagem_nome TEXT,
  operador_baixa_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_baixa_nome TEXT,
  retirante_nome TEXT,
  documento_retirante TEXT,
  parentesco_retirante TEXT,
  assinatura_url TEXT,
  comprovante_url TEXT,
  data_retirada TIMESTAMPTZ,
  dias_retencao INTEGER DEFAULT 0,
  notificacao_enviada BOOLEAN DEFAULT FALSE,
  notificacao_whatsapp BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: locais_armazenamento
CREATE TABLE IF NOT EXISTS public.locais_armazenamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  setor TEXT,
  capacidade_maxima INTEGER DEFAULT 50,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. CUSTÓDIA TEMPORÁRIA DE ITENS & OBJETOS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custodia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  codigo TEXT,
  descricao TEXT NOT NULL,
  categoria TEXT DEFAULT 'objeto',
  unidade_bloco TEXT,
  unidade TEXT,
  bloco TEXT,
  deixado_por TEXT,
  telefone_depositante TEXT,
  tipo_depositante TEXT DEFAULT 'Morador',
  destinatario TEXT,
  foto_url TEXT,
  localizacao_guarda TEXT DEFAULT 'Armário de Custódia',
  status TEXT DEFAULT 'retido',
  operador_entrada_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_entrada_nome TEXT,
  operador_saida_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_saida_nome TEXT,
  retirado_por TEXT,
  documento_retirante TEXT,
  assinatura_url TEXT,
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_saida TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. MATERIAIS & EQUIPAMENTOS DO POSTO DE SERVIÇO
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.materiais_posto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT DEFAULT 'Equipamento',
  quantidade INTEGER DEFAULT 1,
  estado_conservacao TEXT DEFAULT 'Bom',
  status TEXT DEFAULT 'disponivel',
  local_guarda TEXT DEFAULT 'Guarita',
  numero_patrimonio TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. QUADRO DIGITAL DE CHAVES & MOVIMENTAÇÕES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  identificacao TEXT NOT NULL,
  setor TEXT DEFAULT 'Áreas Comuns',
  sala_local TEXT,
  status TEXT DEFAULT 'disponivel',
  responsavel_atual TEXT,
  telefone_responsavel TEXT,
  retirada_em TIMESTAMPTZ,
  previsao_devolucao TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.movimentacao_chaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  chave_id UUID REFERENCES public.chaves(id) ON DELETE CASCADE,
  chave_codigo TEXT,
  chave_identificacao TEXT,
  tipo TEXT NOT NULL, -- retirada | devolucao
  responsavel_nome TEXT NOT NULL,
  responsavel_documento TEXT,
  responsavel_telefone TEXT,
  responsavel_tipo TEXT DEFAULT 'Prestador',
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  assinatura_url TEXT,
  data_retirada TIMESTAMPTZ DEFAULT NOW(),
  data_devolucao TIMESTAMPTZ,
  status TEXT DEFAULT 'em_aberto',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. MANUTENÇÃO PREDIAL, CHECKLISTS & ORDENS DE SERVIÇO
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.checklist_manutencao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  periodicidade TEXT DEFAULT 'diaria',
  setor TEXT DEFAULT 'Geral',
  descricao TEXT,
  responsavel TEXT,
  status TEXT DEFAULT 'pendente',
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chamados_manutencao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  codigo TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  setor TEXT,
  local TEXT,
  prioridade TEXT DEFAULT 'media',
  status TEXT DEFAULT 'aberto',
  solicitante_nome TEXT,
  solicitante_unidade TEXT,
  operador_abertura_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_abertura_nome TEXT,
  responsavel_execucao TEXT,
  foto_antes_url TEXT,
  foto_depois_url TEXT,
  custo_estimado NUMERIC(10, 2) DEFAULT 0.00,
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. RONDAS PATRIMONIAIS, QR CODES & AUDITORIA GPS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rondas_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 1,
  checklist_itens JSONB DEFAULT '["Luzes acesas", "Portas trancadas", "Sem anormalidades"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rondas_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  setor_id UUID REFERENCES public.rondas_setores(id) ON DELETE SET NULL,
  setor_nome TEXT,
  codigo_ponto TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  ordem INTEGER DEFAULT 1,
  qr_token TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rondas_execucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  turno TEXT DEFAULT 'Noturno',
  tipo_ronda TEXT DEFAULT 'Padrao',
  status TEXT DEFAULT 'em_andamento',
  total_pontos INTEGER DEFAULT 0,
  pontos_concluidos INTEGER DEFAULT 0,
  pontos_nao_conformes INTEGER DEFAULT 0,
  inicio_em TIMESTAMPTZ DEFAULT NOW(),
  fim_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rondas_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  execucao_id UUID REFERENCES public.rondas_execucao(id) ON DELETE CASCADE,
  ponto_id UUID REFERENCES public.rondas_pontos(id) ON DELETE SET NULL,
  ponto_nome TEXT,
  setor_nome TEXT,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  status_ponto TEXT DEFAULT 'conforme',
  checklist_respostas JSONB DEFAULT '{}'::jsonb,
  fotos JSONB DEFAULT '[]'::jsonb,
  observacao TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  horario_leitura TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. LIVRO DIGITAL DE OCORRÊNCIAS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  codigo TEXT,
  titulo TEXT NOT NULL,
  tipo TEXT DEFAULT 'Interna',
  gravidade TEXT DEFAULT 'baixa',
  prioridade TEXT DEFAULT 'normal',
  unidade_bloco TEXT,
  unidade TEXT,
  bloco TEXT,
  relato TEXT NOT NULL,
  envolvidos TEXT,
  providencias_tomadas TEXT,
  operador_registro_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_registro_nome TEXT,
  sindico_notificado BOOLEAN DEFAULT FALSE,
  fotos JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'registrada',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. PASSAGEM DE POSTO COM DUPLA ASSINATURA DIGITAL
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.passagens_posto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  turno_sainte TEXT NOT NULL,
  turno_entrante TEXT NOT NULL,
  operador_sainte_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_sainte_nome TEXT NOT NULL,
  operador_entrante_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_entrante_nome TEXT NOT NULL,
  data_passagem TIMESTAMPTZ DEFAULT NOW(),
  checklist_posto JSONB DEFAULT '{}'::jsonb,
  materiais_conferidos JSONB DEFAULT '[]'::jsonb,
  pendencias TEXT,
  ocorrencias_relevantes TEXT,
  chaves_retidas TEXT,
  assinatura_sainte_url TEXT,
  assinatura_entrante_url TEXT,
  status TEXT DEFAULT 'concluida',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. PRESTADORES DE SERVIÇO, OBRAS & CONTROLE DE ACESSO
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  empresa TEXT,
  documento TEXT,
  tipo_servico TEXT,
  unidade_destino TEXT,
  bloco_destino TEXT,
  autorizante_nome TEXT,
  foto_rosto TEXT,
  foto_documento TEXT,
  placa_veiculo TEXT,
  status TEXT DEFAULT 'autorizado',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prestadores_acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  prestador_nome TEXT NOT NULL,
  empresa TEXT,
  documento TEXT,
  tipo TEXT DEFAULT 'Prestador',
  unidade_destino TEXT,
  bloco_destino TEXT,
  operador_entrada_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_entrada_nome TEXT,
  operador_saida_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_saida_nome TEXT,
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_saida TIMESTAMPTZ,
  veiculo_placa TEXT,
  status TEXT DEFAULT 'no_local',
  cracha_numero TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. COMUNICAÇÃO, BANCADA & LEMBRETES DE PORTARIA
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lembretes_portaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_bloco TEXT,
  tipo TEXT DEFAULT 'aviso',
  remetente TEXT DEFAULT 'Portaria',
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT FALSE,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  prioridade TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bancada_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  codigo_barras TEXT,
  volume_tipo TEXT DEFAULT 'Caixa',
  remetente TEXT,
  transportadora TEXT,
  unidade_bloco TEXT,
  unidade TEXT,
  bloco TEXT,
  morador_nome TEXT,
  status TEXT DEFAULT 'na_bancada',
  localizacao TEXT DEFAULT 'Balcão de Triagem',
  foto_url TEXT,
  data_chegada TIMESTAMPTZ DEFAULT NOW(),
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bancada_conferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  data_conferencia TIMESTAMPTZ DEFAULT NOW(),
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  total_volumes_esperados INTEGER DEFAULT 0,
  total_volumes_conferidos INTEGER DEFAULT 0,
  divergencias TEXT,
  status TEXT DEFAULT 'concluido',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.templates_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  titulo TEXT NOT NULL,
  texto_template TEXT NOT NULL,
  variaveis_disponiveis JSONB DEFAULT '["{NOME_MORADOR}", "{UNIDADE}", "{CODIGO}", "{LINK}"]'::jsonb,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agenda_emergencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  celular TEXT,
  cargo_orgao TEXT,
  categoria TEXT DEFAULT 'Emergência',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.historico_absoluto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  registro_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  ip_origem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. RESERVAS DE ÁREAS COMUNS & CONTROLE DE ACESSO
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.areas_comuns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'outro',
  start_hour TEXT DEFAULT '08:00',
  end_hour TEXT DEFAULT '22:00',
  slot_duration_minutes INTEGER DEFAULT 60,
  capacity INTEGER DEFAULT 30,
  description TEXT,
  rules JSONB DEFAULT '[]'::jsonb,
  cleaning_fee NUMERIC(10, 2) DEFAULT 0.00,
  requires_approval BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  color TEXT DEFAULT '#4f46e5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reservas_areas_comuns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  area_id UUID REFERENCES public.areas_comuns(id) ON DELETE CASCADE,
  unit_id TEXT,
  unit_number TEXT NOT NULL,
  unit_block TEXT DEFAULT '',
  resident_id TEXT,
  resident_name TEXT NOT NULL,
  resident_phone TEXT,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT DEFAULT 'confirmada',
  guest_count INTEGER DEFAULT 1,
  notes TEXT,
  cleaning_fee NUMERIC(10, 2) DEFAULT 0.00,
  reservation_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pontos_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'pedestre',
  sentido TEXT DEFAULT 'bidirecional',
  ip_controladora TEXT,
  porta_rele INTEGER DEFAULT 1,
  status TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.registros_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  ponto_acesso_id UUID REFERENCES public.pontos_acesso(id) ON DELETE SET NULL,
  ponto_acesso_nome TEXT,
  pessoa_tipo TEXT DEFAULT 'Morador',
  pessoa_id TEXT,
  pessoa_nome TEXT NOT NULL,
  documento TEXT,
  bloco TEXT,
  unidade TEXT,
  sentido TEXT DEFAULT 'entrada',
  metodo TEXT DEFAULT 'tag_rfid',
  autorizacao TEXT DEFAULT 'permitido',
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  operador_nome TEXT,
  foto_evento_url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.passes_virtuais_qr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  convidado_nome TEXT NOT NULL,
  convidado_documento TEXT,
  unidade TEXT NOT NULL,
  bloco TEXT,
  morador_id UUID REFERENCES public.moradores(id) ON DELETE SET NULL,
  morador_nome TEXT,
  token_qr TEXT UNIQUE NOT NULL,
  validade_inicio TIMESTAMPTZ NOT NULL,
  validade_fim TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'ativo',
  usos_restantes INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.blacklist_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  motivo TEXT NOT NULL,
  foto_url TEXT,
  cadastrado_por TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. ÍNDICES DE PERFORMANCE ULTRA-RÁPIDA (SUB-MILLISECOND QUERIES)
-- ------------------------------------------------------------------------------

-- Índices Compostos Multi-Tenant por condomínio e status
CREATE INDEX IF NOT EXISTS idx_encomendas_condo_status ON public.encomendas_itens(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_encomendas_unidade_bloco ON public.encomendas_itens(condominio_id, unidade, bloco);
CREATE INDEX IF NOT EXISTS idx_encomendas_rastreio ON public.encomendas_itens(codigo_rastreio);
CREATE INDEX IF NOT EXISTS idx_encomendas_created ON public.encomendas_itens(condominio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moradores_condo_unid ON public.moradores(condominio_id, unidade, bloco);
CREATE INDEX IF NOT EXISTS idx_moradores_cpf ON public.moradores(cpf);
CREATE INDEX IF NOT EXISTS idx_moradores_tag_rfid ON public.moradores(tag_rfid);
CREATE INDEX IF NOT EXISTS idx_moradores_veiculo_placa ON public.moradores(veiculo_placa);

CREATE INDEX IF NOT EXISTS idx_custodia_condo_status ON public.custodia(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_chaves_condo_status ON public.chaves(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_condo_data ON public.ocorrencias(condominio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestadores_acessos_status ON public.prestadores_acessos(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_lembretes_condo_lido ON public.lembretes_portaria(condominio_id, lido);
CREATE INDEX IF NOT EXISTS idx_reservas_condo_data ON public.reservas_areas_comuns(condominio_id, date, status);
CREATE INDEX IF NOT EXISTS idx_rondas_exec_condo ON public.rondas_execucao(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_historico_condo_modulo ON public.historico_absoluto(condominio_id, modulo, created_at DESC);

-- ------------------------------------------------------------------------------
-- 14. TRIGGERS DE ATUALIZAÇÃO AUTOMÁTICA (updated_at)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'condominios', 'configuracoes', 'operadores', 'moradores', 'entregadores',
    'lotes_re', 'encomendas_itens', 'locais_armazenamento', 'custodia', 'materiais_posto',
    'chaves', 'movimentacao_chaves', 'checklist_manutencao', 'chamados_manutencao',
    'rondas_setores', 'rondas_pontos', 'rondas_execucao', 'rondas_registros',
    'ocorrencias', 'passagens_posto', 'prestadores', 'prestadores_acessos',
    'lembretes_portaria', 'bancada_volumes', 'bancada_conferencias', 'templates_whatsapp',
    'agenda_emergencia', 'areas_comuns', 'reservas_areas_comuns', 'pontos_acesso',
    'passes_virtuais_qr', 'blacklist_bloqueios'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_update_%I ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_update_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t, t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. SEGURANÇA & ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

-- Habilita RLS em todas as tabelas
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_re ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encomendas_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais_armazenamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custodia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais_posto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacao_chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rondas_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rondas_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rondas_execucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rondas_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passagens_posto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores_acessos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes_portaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancada_volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancada_conferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_emergencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_absoluto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas_comuns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_areas_comuns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pontos_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes_virtuais_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist_bloqueios ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Resilientes para PostgREST (Permite anon e authenticated)
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'condominios', 'configuracoes', 'operadores', 'moradores', 'entregadores',
    'lotes_re', 'encomendas_itens', 'locais_armazenamento', 'custodia', 'materiais_posto',
    'chaves', 'movimentacao_chaves', 'checklist_manutencao', 'chamados_manutencao',
    'rondas_setores', 'rondas_pontos', 'rondas_execucao', 'rondas_registros',
    'ocorrencias', 'passagens_posto', 'prestadores', 'prestadores_acessos',
    'lembretes_portaria', 'bancada_volumes', 'bancada_conferencias', 'templates_whatsapp',
    'agenda_emergencia', 'historico_absoluto', 'areas_comuns', 'reservas_areas_comuns',
    'pontos_acesso', 'registros_acesso', 'passes_virtuais_qr', 'blacklist_bloqueios'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Acesso Total PorttoHub %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Acesso Total PorttoHub %I" ON public.%I FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 16. SUPABASE REALTIME (PUBLICAÇÃO REATIVA)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.encomendas_itens,
  public.custodia,
  public.chaves,
  public.ocorrencias,
  public.lembretes_portaria,
  public.bancada_volumes,
  public.rondas_execucao,
  public.reservas_areas_comuns;

-- ------------------------------------------------------------------------------
-- 17. SUPABASE STORAGE (BUCKETS & POLÍTICAS DE UPLOAD)
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('encomendas', 'encomendas', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('documentos', 'documentos', true, 15728640, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('assinaturas', 'assinaturas', true, 5242880, ARRAY['image/png', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de Storage para upload público de fotos de encomendas e assinaturas
DROP POLICY IF EXISTS "Public Storage Read PorttoHub" ON storage.objects;
CREATE POLICY "Public Storage Read PorttoHub" ON storage.objects
  FOR SELECT TO public, anon, authenticated USING (bucket_id IN ('encomendas', 'documentos', 'assinaturas'));

DROP POLICY IF EXISTS "Public Storage Insert PorttoHub" ON storage.objects;
CREATE POLICY "Public Storage Insert PorttoHub" ON storage.objects
  FOR INSERT TO public, anon, authenticated WITH CHECK (bucket_id IN ('encomendas', 'documentos', 'assinaturas'));

DROP POLICY IF EXISTS "Public Storage Update PorttoHub" ON storage.objects;
CREATE POLICY "Public Storage Update PorttoHub" ON storage.objects
  FOR UPDATE TO public, anon, authenticated USING (bucket_id IN ('encomendas', 'documentos', 'assinaturas'));

-- ------------------------------------------------------------------------------
-- 18. DADOS INICIAIS DE BOOTSTRAP (CONDOMÍNIO E OPERADOR INICIAL)
-- ------------------------------------------------------------------------------

-- Cria um condomínio padrão para iniciar imediatamente
DO $$
DECLARE
  v_condo_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.condominios WHERE nome = 'Condomínio Residencial Portto Real') THEN
    INSERT INTO public.condominios (nome, endereco, cidade, uf, tipo_estrutura, qtd_blocos, unidades_por_bloco)
    VALUES ('Condomínio Residencial Portto Real', 'Av. Paulista, 1000 - Bela Vista', 'São Paulo', 'SP', 'apartamentos', 2, 80)
    RETURNING id INTO v_condo_id;

    -- Cria configurações do condomínio padrão
    INSERT INTO public.configuracoes (condominio_id)
    VALUES (v_condo_id);

    -- Cria operador administrador inicial
    INSERT INTO public.operadores (condominio_id, nome, login, senha, funcao, cargo, perfil, nivel_acesso)
    VALUES (v_condo_id, 'Supervisor Geral', 'admin', 'admin123', 'Supervisor', 'Supervisor', 'admin', 'admin');

    -- Cria áreas comuns padrão
    INSERT INTO public.areas_comuns (condominio_id, name, type, start_hour, end_hour, slot_duration_minutes, capacity, description, cleaning_fee, color)
    VALUES 
      (v_condo_id, 'Churrasqueira Gourmet', 'churrasqueira', '10:00', '22:00', 240, 25, 'Espaço com churrasqueira a carvão, freezer e mesas.', 50.00, '#f97316'),
      (v_condo_id, 'Salão de Festas Principal', 'festa', '12:00', '23:00', 360, 80, 'Salão amplo climatizado com cozinha completa.', 120.00, '#8b5cf6'),
      (v_condo_id, 'Quadra Poliesportiva', 'quadra', '07:00', '22:00', 60, 20, 'Quadra para futebol, vôlei e basquete.', 0.00, '#0ea5e9');

    -- Cria templates WhatsApp padrão
    INSERT INTO public.templates_whatsapp (condominio_id, chave, titulo, texto_template)
    VALUES 
      (v_condo_id, 'encomenda_chegada', 'Chegada de Encomenda', 'Olá {NOME_MORADOR}, sua encomenda ({CODIGO}) chegou na portaria do {CONDOMINIO} e já está disponível para retirada.'),
      (v_condo_id, 'encomenda_retirada', 'Confirmação de Retirada', 'Olá {NOME_MORADOR}, confirmamos a retirada da sua encomenda ({CODIGO}) na portaria.'),
      (v_condo_id, 'aviso_visitante', 'Visitante na Portaria', 'Olá {NOME_MORADOR}, informamos que {VISITANTE} está na portaria aguardando autorização para entrar.');

  END IF;
END;
$$;

-- Recarrega o Schema Cache do PostgREST no Supabase
NOTIFY pgrst, 'reload schema';

COMMIT;
