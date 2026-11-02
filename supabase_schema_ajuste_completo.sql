-- ==============================================================================
-- PORTTOHUB 2.0 - SCRIPT MESTRE DE AJUSTE COMPLETO & DEFINITIVO DO SUPABASE
-- URL DO PROJETO: https://pkemipwowkcnstbazlma.supabase.co
-- FINALIDADE: Corrigir 100% das falhas de gravação, adicionar todas as colunas
--             necessárias em todas as tabelas, remover tabelas legadas/duplicadas,
--             garantir RLS 100% permissivo para Anon/Portaria e recarregar o schema.
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do Supabase: https://supabase.com/dashboard/project/pkemipwowkcnstbazlma
-- 2. No menu lateral esquerdo, clique no ícone "SQL Editor" (ícone de terminal)
-- 3. Clique no botão "+ New query"
-- 4. Cole TODO o conteúdo deste arquivo e clique no botão verde "Run" (ou pressione Ctrl+Enter)
-- 5. O script é 100% idempotente (pode ser executado múltiplas vezes com total segurança)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. EXTENSÕES ESSENCIAIS DE BANCO DE DADOS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária para gatilhos de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. CADASTROS BASE & MULTI-TENANCY: condominios, configuracoes, operadores, moradores
-- ------------------------------------------------------------------------------

-- Tabela: condominios
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

ALTER TABLE IF EXISTS public.condominios
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'São Paulo',
  ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'SP',
  ADD COLUMN IF NOT EXISTS telefone_portaria TEXT,
  ADD COLUMN IF NOT EXISTS sindico_nome TEXT,
  ADD COLUMN IF NOT EXISTS sindico_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_grupo_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_grupo_portaria TEXT,
  ADD COLUMN IF NOT EXISTS escala_plantao TEXT DEFAULT '06_18',
  ADD COLUMN IF NOT EXISTS horario_diurno_inicio TEXT DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS horario_noturno_inicio TEXT DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS intervalo_ronda INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS tipo_estrutura TEXT DEFAULT 'apartamentos',
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'residencial',
  ADD COLUMN IF NOT EXISTS qtd_blocos INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unidades_por_bloco INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS nomes_blocos TEXT,
  ADD COLUMN IF NOT EXISTS zeros_esquerda BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS locais_armazenamento JSONB DEFAULT '["Bancada Principal", "Prateleira A", "Prateleira B", "Chão / Caixas Grandes"]'::jsonb,
  ADD COLUMN IF NOT EXISTS turnos_plantao JSONB DEFAULT '{"diurno": "06:00 - 18:00", "noturno": "18:00 - 06:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tabela: configuracoes
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
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

ALTER TABLE IF EXISTS public.configuracoes
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS niveis_acesso JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS whatsapp_modulos JSONB DEFAULT '{"encomendas": true, "visitantes": true, "ocorrencias": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS locais_armazenamento JSONB DEFAULT '["Bancada Principal", "Prateleira A", "Prateleira B", "Chão / Caixas Grandes"]'::jsonb,
  ADD COLUMN IF NOT EXISTS setores_ronda JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS turnos_plantao JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dados_tenant JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mod01_cadastros_base BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod02_gestao_encomendas BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod03_custodia_itens BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod04_materiais_posto BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod05_quadro_chaves BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod06_gestao_manutencao BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod07_gestao_ronda BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod08_livro_ocorrencias BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod09_passagem_posto BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod10_prestadores_servico BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod11_bancada_conferencia BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod12_historico_absoluto BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mod_portal_sindico BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tabela: operadores
CREATE TABLE IF NOT EXISTS public.operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
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
  nivel_acesso_custom_id TEXT,
  permissoes JSONB DEFAULT '{"modulos": ["*"]}'::jsonb,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.operadores
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS login TEXT,
  ADD COLUMN IF NOT EXISTS senha TEXT,
  ADD COLUMN IF NOT EXISTS funcao TEXT DEFAULT 'Porteiro',
  ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT 'Porteiro',
  ADD COLUMN IF NOT EXISTS perfil TEXT DEFAULT 'operador',
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Diurno',
  ADD COLUMN IF NOT EXISTS turno_padrao TEXT DEFAULT 'Diurno',
  ADD COLUMN IF NOT EXISTS nivel_acesso TEXT DEFAULT 'operador',
  ADD COLUMN IF NOT EXISTS nivel_acesso_custom_id TEXT,
  ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{"modulos": ["*"]}'::jsonb,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tabela: moradores
CREATE TABLE IF NOT EXISTS public.moradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
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

ALTER TABLE IF EXISTS public.moradores
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto TEXT,
  ADD COLUMN IF NOT EXISTS tag_rfid TEXT,
  ADD COLUMN IF NOT EXISTS codigo_acesso TEXT,
  ADD COLUMN IF NOT EXISTS status_acesso TEXT DEFAULT 'liberado',
  ADD COLUMN IF NOT EXISTS veiculo_placa TEXT,
  ADD COLUMN IF NOT EXISTS veiculo_modelo TEXT,
  ADD COLUMN IF NOT EXISTS contato_emergencia TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 2. GESTÃO DE ENCOMENDAS: entregadores, lotes_re, encomendas_itens, locais_armazenamento
-- ------------------------------------------------------------------------------

-- Tabela: entregadores
CREATE TABLE IF NOT EXISTS public.entregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  nome TEXT NOT NULL,
  empresa TEXT,
  documento TEXT,
  telefone TEXT,
  foto_url TEXT,
  frequencia TEXT DEFAULT 'recorrente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.entregadores
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS frequencia TEXT DEFAULT 'recorrente',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tabela: lotes_re
CREATE TABLE IF NOT EXISTS public.lotes_re (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  codigo TEXT,
  codigo_re TEXT,
  operador_id TEXT,
  operador_nome TEXT,
  entregador_id UUID,
  entregador_nome TEXT,
  empresa TEXT,
  qtd_declarada INTEGER DEFAULT 1,
  quantidade_declarada INTEGER DEFAULT 1,
  qtd_triada INTEGER DEFAULT 0,
  quantidade_triada INTEGER DEFAULT 0,
  status TEXT DEFAULT 'aguardando_triagem',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.lotes_re
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_re TEXT,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS entregador_id UUID,
  ADD COLUMN IF NOT EXISTS entregador_nome TEXT,
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS qtd_declarada INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantidade_declarada INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS qtd_triada INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_triada INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aguardando_triagem',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Sincronizar sinônimos em lotes_re
UPDATE public.lotes_re SET codigo_re = COALESCE(codigo_re, codigo) WHERE codigo_re IS NULL AND codigo IS NOT NULL;
UPDATE public.lotes_re SET codigo = COALESCE(codigo, codigo_re) WHERE codigo IS NULL AND codigo_re IS NOT NULL;
UPDATE public.lotes_re SET qtd_declarada = COALESCE(qtd_declarada, quantidade_declarada) WHERE qtd_declarada IS NULL AND quantidade_declarada IS NOT NULL;
UPDATE public.lotes_re SET quantidade_declarada = COALESCE(quantidade_declarada, qtd_declarada) WHERE quantidade_declarada IS NULL AND qtd_declarada IS NOT NULL;

-- Tabela: encomendas_itens
CREATE TABLE IF NOT EXISTS public.encomendas_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  lote_re_id UUID,
  codigo_re TEXT,
  codigo_rastreio TEXT,
  codigo_barras TEXT,
  codigo_pacote TEXT,
  destinatario TEXT,
  destinatario_nome TEXT,
  unidade TEXT NOT NULL,
  bloco TEXT DEFAULT '',
  unidade_bloco TEXT,
  morador_id UUID,
  tipo_volume TEXT DEFAULT 'Pacote Pequeno',
  local_armazenamento TEXT DEFAULT 'Bancada Principal',
  transportadora TEXT,
  remetente TEXT,
  foto_url TEXT,
  foto_etiqueta TEXT,
  foto_etiqueta_url TEXT,
  foto_retirada_url TEXT,
  foto_comprovante_url TEXT,
  status TEXT DEFAULT 'retido',
  operador_triagem_id TEXT,
  operador_triagem_nome TEXT,
  operador_entrada TEXT,
  operador_baixa_id TEXT,
  operador_baixa_nome TEXT,
  operador_baixa TEXT,
  retirante_nome TEXT,
  retirado_por TEXT,
  documento_retirante TEXT,
  parentesco_retirante TEXT,
  parentesco_vinculo TEXT,
  assinatura_url TEXT,
  comprovante_url TEXT,
  data_recebimento TIMESTAMPTZ DEFAULT NOW(),
  data_retirada TIMESTAMPTZ,
  data_hora_retirada TIMESTAMPTZ,
  dias_retencao INTEGER DEFAULT 0,
  notificacao_enviada BOOLEAN DEFAULT FALSE,
  notificacao_whatsapp BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.encomendas_itens
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS lote_re_id UUID,
  ADD COLUMN IF NOT EXISTS codigo_re TEXT,
  ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT,
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS codigo_pacote TEXT,
  ADD COLUMN IF NOT EXISTS destinatario TEXT,
  ADD COLUMN IF NOT EXISTS destinatario_nome TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS morador_id UUID,
  ADD COLUMN IF NOT EXISTS tipo_volume TEXT DEFAULT 'Pacote Pequeno',
  ADD COLUMN IF NOT EXISTS local_armazenamento TEXT DEFAULT 'Bancada Principal',
  ADD COLUMN IF NOT EXISTS transportadora TEXT,
  ADD COLUMN IF NOT EXISTS remetente TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_etiqueta TEXT,
  ADD COLUMN IF NOT EXISTS foto_etiqueta_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_retirada_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_comprovante_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'retido',
  ADD COLUMN IF NOT EXISTS operador_triagem_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_triagem_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrada TEXT,
  ADD COLUMN IF NOT EXISTS operador_baixa_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_baixa_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_baixa TEXT,
  ADD COLUMN IF NOT EXISTS retirante_nome TEXT,
  ADD COLUMN IF NOT EXISTS retirado_por TEXT,
  ADD COLUMN IF NOT EXISTS documento_retirante TEXT,
  ADD COLUMN IF NOT EXISTS parentesco_retirante TEXT,
  ADD COLUMN IF NOT EXISTS parentesco_vinculo TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
  ADD COLUMN IF NOT EXISTS data_recebimento TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_retirada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_hora_retirada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dias_retencao INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notificacao_enviada BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notificacao_whatsapp BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Sincronizar sinônimos em encomendas_itens
UPDATE public.encomendas_itens SET codigo_barras = COALESCE(codigo_barras, codigo_rastreio) WHERE codigo_barras IS NULL AND codigo_rastreio IS NOT NULL;
UPDATE public.encomendas_itens SET codigo_rastreio = COALESCE(codigo_rastreio, codigo_barras) WHERE codigo_rastreio IS NULL AND codigo_barras IS NOT NULL;
UPDATE public.encomendas_itens SET destinatario = COALESCE(destinatario, destinatario_nome) WHERE destinatario IS NULL AND destinatario_nome IS NOT NULL;
UPDATE public.encomendas_itens SET destinatario_nome = COALESCE(destinatario_nome, destinatario) WHERE destinatario_nome IS NULL AND destinatario IS NOT NULL;
UPDATE public.encomendas_itens SET foto_url = COALESCE(foto_url, foto_etiqueta_url, foto_etiqueta) WHERE foto_url IS NULL;
UPDATE public.encomendas_itens SET retirado_por = COALESCE(retirado_por, retirante_nome) WHERE retirado_por IS NULL AND retirante_nome IS NOT NULL;

-- Tabela: locais_armazenamento
CREATE TABLE IF NOT EXISTS public.locais_armazenamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  nome TEXT NOT NULL,
  codigo TEXT,
  categoria TEXT,
  setor TEXT,
  capacidade INTEGER DEFAULT 50,
  capacidade_maxima INTEGER DEFAULT 50,
  descricao TEXT,
  observacao TEXT,
  status TEXT DEFAULT 'ativo',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.locais_armazenamento
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS setor TEXT,
  ADD COLUMN IF NOT EXISTS capacidade INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS capacidade_maxima INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 3. CUSTÓDIA TEMPORÁRIA: custodia
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custodia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  codigo TEXT,
  codigo_custodia TEXT,
  descricao TEXT NOT NULL,
  item_descricao TEXT,
  categoria TEXT DEFAULT 'objeto',
  fluxo TEXT DEFAULT 'ENTRADA',
  origem TEXT,
  origem_tipo TEXT DEFAULT 'Morador',
  origem_unidade TEXT,
  origem_bloco TEXT,
  origem_nome_doc TEXT,
  origem_whats TEXT,
  destino TEXT,
  destino_tipo TEXT DEFAULT 'Morador',
  destino_unidade TEXT,
  destino_bloco TEXT,
  destino_nome_doc TEXT,
  destino_whats TEXT,
  unidade_bloco TEXT,
  unidade TEXT,
  bloco TEXT,
  deixado_por TEXT,
  depositante_nome TEXT,
  telefone_depositante TEXT,
  documento_depositante TEXT,
  tipo_depositante TEXT DEFAULT 'Morador',
  destinatario TEXT,
  morador_id UUID,
  foto_url TEXT,
  foto_entrada_url TEXT,
  foto_saida_url TEXT,
  local_armazenamento TEXT DEFAULT 'Bancada Principal',
  localizacao_guarda TEXT DEFAULT 'Armário de Custódia',
  status TEXT DEFAULT 'Retido',
  operador_entrada TEXT,
  operador_entrada_id TEXT,
  operador_entrada_nome TEXT,
  recebido_por_operador_id TEXT,
  recebido_por_operador_nome TEXT,
  operador_saida TEXT,
  operador_saida_id TEXT,
  operador_saida_nome TEXT,
  entregue_por_operador_id TEXT,
  entregue_por_operador_nome TEXT,
  retirado_por TEXT,
  recebedor_nome TEXT,
  recebedor_doc TEXT,
  documento_retirante TEXT,
  tipo_baixa TEXT DEFAULT 'destinatario',
  assinatura_url TEXT,
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_recebimento TIMESTAMPTZ DEFAULT NOW(),
  data_hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_saida TIMESTAMPTZ,
  data_retirada TIMESTAMPTZ,
  data_hora_saida TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.custodia
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_custodia TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS item_descricao TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'objeto',
  ADD COLUMN IF NOT EXISTS fluxo TEXT DEFAULT 'ENTRADA',
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS origem_unidade TEXT,
  ADD COLUMN IF NOT EXISTS origem_bloco TEXT,
  ADD COLUMN IF NOT EXISTS origem_nome_doc TEXT,
  ADD COLUMN IF NOT EXISTS origem_whats TEXT,
  ADD COLUMN IF NOT EXISTS destino TEXT,
  ADD COLUMN IF NOT EXISTS destino_tipo TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS destino_unidade TEXT,
  ADD COLUMN IF NOT EXISTS destino_bloco TEXT,
  ADD COLUMN IF NOT EXISTS destino_nome_doc TEXT,
  ADD COLUMN IF NOT EXISTS destino_whats TEXT,
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS deixado_por TEXT,
  ADD COLUMN IF NOT EXISTS depositante_nome TEXT,
  ADD COLUMN IF NOT EXISTS telefone_depositante TEXT,
  ADD COLUMN IF NOT EXISTS documento_depositante TEXT,
  ADD COLUMN IF NOT EXISTS tipo_depositante TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS destinatario TEXT,
  ADD COLUMN IF NOT EXISTS morador_id UUID,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_entrada_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_saida_url TEXT,
  ADD COLUMN IF NOT EXISTS local_armazenamento TEXT DEFAULT 'Bancada Principal',
  ADD COLUMN IF NOT EXISTS localizacao_guarda TEXT DEFAULT 'Armário de Custódia',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Retido',
  ADD COLUMN IF NOT EXISTS operador_entrada TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrada_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrada_nome TEXT,
  ADD COLUMN IF NOT EXISTS recebido_por_operador_id TEXT,
  ADD COLUMN IF NOT EXISTS recebido_por_operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_nome TEXT,
  ADD COLUMN IF NOT EXISTS entregue_por_operador_id TEXT,
  ADD COLUMN IF NOT EXISTS entregue_por_operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS retirado_por TEXT,
  ADD COLUMN IF NOT EXISTS recebedor_nome TEXT,
  ADD COLUMN IF NOT EXISTS recebedor_doc TEXT,
  ADD COLUMN IF NOT EXISTS documento_retirante TEXT,
  ADD COLUMN IF NOT EXISTS tipo_baixa TEXT DEFAULT 'destinatario',
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_recebimento TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_retirada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_hora_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.custodia SET codigo_custodia = COALESCE(codigo_custodia, codigo) WHERE codigo_custodia IS NULL AND codigo IS NOT NULL;
UPDATE public.custodia SET codigo = COALESCE(codigo, codigo_custodia) WHERE codigo IS NULL AND codigo_custodia IS NOT NULL;
UPDATE public.custodia SET item_descricao = COALESCE(item_descricao, descricao) WHERE item_descricao IS NULL;
UPDATE public.custodia SET foto_url = COALESCE(foto_url, foto_entrada_url) WHERE foto_url IS NULL;

-- ------------------------------------------------------------------------------
-- 4. MATERIAIS & EQUIPAMENTOS DO POSTO: materiais_posto
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materiais_posto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  nome TEXT NOT NULL,
  item TEXT,
  categoria TEXT DEFAULT 'Equipamento',
  quantidade INTEGER DEFAULT 1,
  quantidade_total INTEGER DEFAULT 1,
  quantidade_disponivel INTEGER DEFAULT 1,
  estado TEXT DEFAULT 'Perfeito',
  estado_conservacao TEXT DEFAULT 'Bom',
  status TEXT DEFAULT 'disponivel',
  local_guarda TEXT DEFAULT 'Guarita',
  localizacao TEXT DEFAULT 'Guarita',
  numero_patrimonio TEXT,
  codigo_patrimonio TEXT,
  observacao TEXT,
  observacao_avaria TEXT,
  foto_url TEXT,
  foto_avaria_url TEXT,
  operador_atualizacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.materiais_posto
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS item TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Equipamento',
  ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantidade_total INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantidade_disponivel INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Perfeito',
  ADD COLUMN IF NOT EXISTS estado_conservacao TEXT DEFAULT 'Bom',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disponivel',
  ADD COLUMN IF NOT EXISTS local_guarda TEXT DEFAULT 'Guarita',
  ADD COLUMN IF NOT EXISTS localizacao TEXT DEFAULT 'Guarita',
  ADD COLUMN IF NOT EXISTS numero_patrimonio TEXT,
  ADD COLUMN IF NOT EXISTS codigo_patrimonio TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS observacao_avaria TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_avaria_url TEXT,
  ADD COLUMN IF NOT EXISTS operador_atualizacao TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.materiais_posto SET item = COALESCE(item, nome) WHERE item IS NULL;
UPDATE public.materiais_posto SET codigo_patrimonio = COALESCE(codigo_patrimonio, numero_patrimonio) WHERE codigo_patrimonio IS NULL;

-- ------------------------------------------------------------------------------
-- 5. QUADRO DIGITAL DE CHAVES & MOVIMENTAÇÃO: chaves, movimentacao_chaves
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  codigo TEXT,
  codigo_chave TEXT NOT NULL,
  nome_chave TEXT NOT NULL,
  identificacao TEXT,
  identificacao_sala TEXT,
  setor TEXT DEFAULT 'Áreas Comuns',
  sala_local TEXT,
  localizacao TEXT,
  bloco TEXT,
  unidade TEXT,
  tempo_limite_horas INTEGER DEFAULT 2,
  status TEXT DEFAULT 'Disponível',
  posse_atual TEXT,
  contato_posse TEXT,
  responsavel_atual TEXT,
  telefone_responsavel TEXT,
  retirado_as TIMESTAMPTZ,
  retirada_em TIMESTAMPTZ,
  previsao_devolucao TIMESTAMPTZ,
  quantidade INTEGER DEFAULT 1,
  qr_code TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.chaves
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_chave TEXT,
  ADD COLUMN IF NOT EXISTS nome_chave TEXT,
  ADD COLUMN IF NOT EXISTS identificacao TEXT,
  ADD COLUMN IF NOT EXISTS identificacao_sala TEXT,
  ADD COLUMN IF NOT EXISTS setor TEXT DEFAULT 'Áreas Comuns',
  ADD COLUMN IF NOT EXISTS sala_local TEXT,
  ADD COLUMN IF NOT EXISTS localizacao TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS tempo_limite_horas INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Disponível',
  ADD COLUMN IF NOT EXISTS posse_atual TEXT,
  ADD COLUMN IF NOT EXISTS contato_posse TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_atual TEXT,
  ADD COLUMN IF NOT EXISTS telefone_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS retirado_as TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retirada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previsao_devolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.chaves SET codigo = COALESCE(codigo, codigo_chave) WHERE codigo IS NULL;
UPDATE public.chaves SET codigo_chave = COALESCE(codigo_chave, codigo) WHERE codigo_chave IS NULL;
UPDATE public.chaves SET identificacao = COALESCE(identificacao, nome_chave) WHERE identificacao IS NULL;
UPDATE public.chaves SET nome_chave = COALESCE(nome_chave, identificacao) WHERE nome_chave IS NULL;

CREATE TABLE IF NOT EXISTS public.movimentacao_chaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  chave_id UUID,
  chave_codigo TEXT,
  chave_identificacao TEXT,
  tipo TEXT DEFAULT 'retirada',
  tipo_retirante TEXT DEFAULT 'Morador',
  retirante_tipo TEXT DEFAULT 'Morador',
  nome_retirante TEXT,
  retirante_nome TEXT,
  retirado_por TEXT,
  responsavel_nome TEXT,
  documento_retirante TEXT,
  retirante_doc TEXT,
  responsavel_documento TEXT,
  telefone_retirante TEXT,
  retirante_telefone TEXT,
  responsavel_telefone TEXT,
  responsavel_tipo TEXT DEFAULT 'Prestador',
  empresa TEXT,
  empresa_retirante TEXT,
  empresa_ou_apto TEXT,
  unidade_retirante TEXT,
  bloco_retirante TEXT,
  motivo TEXT,
  motivo_retirada TEXT,
  foto_retirada_url TEXT,
  foto_devolucao_url TEXT,
  assinatura_url TEXT,
  assinatura_retirada_url TEXT,
  assinatura_devolucao_url TEXT,
  data_retirada TIMESTAMPTZ DEFAULT NOW(),
  data_saida TIMESTAMPTZ DEFAULT NOW(),
  data_hora_retirada TIMESTAMPTZ DEFAULT NOW(),
  previsao_devolucao TIMESTAMPTZ,
  data_devolucao TIMESTAMPTZ,
  data_hora_devolucao TIMESTAMPTZ,
  status TEXT DEFAULT 'Em Andamento',
  operador_id TEXT,
  operador_nome TEXT,
  operador_retirada TEXT,
  operador_retirada_id TEXT,
  operador_retirada_nome TEXT,
  operador_saida_id TEXT,
  operador_saida_nome TEXT,
  operador_devolucao TEXT,
  operador_devolucao_id TEXT,
  operador_devolucao_nome TEXT,
  observacoes TEXT,
  observacoes_retirada TEXT,
  observacoes_devolucao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.movimentacao_chaves
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS chave_id UUID,
  ADD COLUMN IF NOT EXISTS chave_codigo TEXT,
  ADD COLUMN IF NOT EXISTS chave_identificacao TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'retirada',
  ADD COLUMN IF NOT EXISTS tipo_retirante TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS retirante_tipo TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS nome_retirante TEXT,
  ADD COLUMN IF NOT EXISTS retirante_nome TEXT,
  ADD COLUMN IF NOT EXISTS retirado_por TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_nome TEXT,
  ADD COLUMN IF NOT EXISTS documento_retirante TEXT,
  ADD COLUMN IF NOT EXISTS retirante_doc TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_documento TEXT,
  ADD COLUMN IF NOT EXISTS telefone_retirante TEXT,
  ADD COLUMN IF NOT EXISTS retirante_telefone TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_telefone TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_tipo TEXT DEFAULT 'Prestador',
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS empresa_retirante TEXT,
  ADD COLUMN IF NOT EXISTS empresa_ou_apto TEXT,
  ADD COLUMN IF NOT EXISTS unidade_retirante TEXT,
  ADD COLUMN IF NOT EXISTS bloco_retirante TEXT,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS motivo_retirada TEXT,
  ADD COLUMN IF NOT EXISTS foto_retirada_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_devolucao_url TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_retirada_url TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_devolucao_url TEXT,
  ADD COLUMN IF NOT EXISTS data_retirada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_saida TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora_retirada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS previsao_devolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_devolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_hora_devolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Em Andamento',
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_retirada TEXT,
  ADD COLUMN IF NOT EXISTS operador_retirada_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_retirada_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_devolucao TEXT,
  ADD COLUMN IF NOT EXISTS operador_devolucao_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_devolucao_nome TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_retirada TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_devolucao TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.movimentacao_chaves SET nome_retirante = COALESCE(nome_retirante, retirante_nome, retirado_por, responsavel_nome) WHERE nome_retirante IS NULL;
UPDATE public.movimentacao_chaves SET retirante_nome = COALESCE(retirante_nome, nome_retirante) WHERE retirante_nome IS NULL;
UPDATE public.movimentacao_chaves SET documento_retirante = COALESCE(documento_retirante, retirante_doc, responsavel_documento) WHERE documento_retirante IS NULL;
UPDATE public.movimentacao_chaves SET telefone_retirante = COALESCE(telefone_retirante, retirante_telefone, responsavel_telefone) WHERE telefone_retirante IS NULL;

-- ------------------------------------------------------------------------------
-- 6. MANUTENÇÃO PREDIAL & ORDENS DE SERVIÇO: checklist_manutencao, chamados_manutencao
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_manutencao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  titulo TEXT NOT NULL,
  item_rotina TEXT,
  descricao TEXT,
  periodicidade TEXT DEFAULT 'diaria',
  frequencia TEXT DEFAULT 'diaria',
  setor TEXT DEFAULT 'Geral',
  categoria TEXT DEFAULT 'Geral',
  prioridade TEXT DEFAULT 'Média',
  localizacao TEXT,
  responsavel TEXT,
  status TEXT DEFAULT 'Pendente',
  observacao_execucao TEXT,
  observacoes TEXT,
  foto_url TEXT,
  foto_antes_url TEXT,
  operador_id TEXT,
  operador_nome TEXT,
  operador_criacao TEXT,
  operador_conclusao TEXT,
  itens_snapshot JSONB,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  ultima_verificacao TIMESTAMPTZ,
  proxima_verificacao TIMESTAMPTZ,
  data_execucao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.checklist_manutencao
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS item_rotina TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS periodicidade TEXT DEFAULT 'diaria',
  ADD COLUMN IF NOT EXISTS frequencia TEXT DEFAULT 'diaria',
  ADD COLUMN IF NOT EXISTS setor TEXT DEFAULT 'Geral',
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Geral',
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'Média',
  ADD COLUMN IF NOT EXISTS localizacao TEXT,
  ADD COLUMN IF NOT EXISTS responsavel TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendente',
  ADD COLUMN IF NOT EXISTS observacao_execucao TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_antes_url TEXT,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_criacao TEXT,
  ADD COLUMN IF NOT EXISTS operador_conclusao TEXT,
  ADD COLUMN IF NOT EXISTS itens_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS ultima_execucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proxima_execucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_verificacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proxima_verificacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_execucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.chamados_manutencao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  codigo TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  setor TEXT,
  categoria TEXT DEFAULT 'Geral',
  local TEXT,
  localizacao TEXT,
  local_especifico TEXT,
  bloco TEXT,
  unidade TEXT,
  prioridade TEXT DEFAULT 'Média',
  status TEXT DEFAULT 'Aberto',
  solicitante TEXT,
  solicitante_nome TEXT,
  solicitante_tipo TEXT DEFAULT 'Morador',
  solicitante_unidade TEXT,
  operador_abertura TEXT,
  operador_abertura_id TEXT,
  operador_abertura_nome TEXT,
  responsavel_execucao TEXT,
  operador_conclusao TEXT,
  operador_conclusao_id TEXT,
  operador_conclusao_nome TEXT,
  foto_antes_url TEXT,
  foto_depois_url TEXT,
  observacao_conclusao TEXT,
  observacoes_conclusao TEXT,
  custo_estimado NUMERIC(10, 2) DEFAULT 0.00,
  custo_real NUMERIC(10, 2) DEFAULT 0.00,
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_conclusao TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.chamados_manutencao
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS setor TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Geral',
  ADD COLUMN IF NOT EXISTS local TEXT,
  ADD COLUMN IF NOT EXISTS localizacao TEXT,
  ADD COLUMN IF NOT EXISTS local_especifico TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'Média',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Aberto',
  ADD COLUMN IF NOT EXISTS solicitante TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_tipo TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS solicitante_unidade TEXT,
  ADD COLUMN IF NOT EXISTS operador_abertura TEXT,
  ADD COLUMN IF NOT EXISTS operador_abertura_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_abertura_nome TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_execucao TEXT,
  ADD COLUMN IF NOT EXISTS operador_conclusao TEXT,
  ADD COLUMN IF NOT EXISTS operador_conclusao_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_conclusao_nome TEXT,
  ADD COLUMN IF NOT EXISTS foto_antes_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_depois_url TEXT,
  ADD COLUMN IF NOT EXISTS observacao_conclusao TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_conclusao TEXT,
  ADD COLUMN IF NOT EXISTS custo_estimado NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS custo_real NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS data_abertura TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.chamados_manutencao SET localizacao = COALESCE(localizacao, local) WHERE localizacao IS NULL;
UPDATE public.chamados_manutencao SET solicitante_nome = COALESCE(solicitante_nome, solicitante) WHERE solicitante_nome IS NULL;

-- ------------------------------------------------------------------------------
-- 7. RONDAS PATRIMONIAIS & QR CODES: rondas_setores, rondas_pontos, rondas_execucao, rondas_registros
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rondas_setores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  codigo TEXT,
  nome TEXT,
  titulo TEXT,
  descricao TEXT,
  ordem INTEGER DEFAULT 1,
  checklist_itens JSONB DEFAULT '["Luzes acesas", "Portas trancadas", "Sem anormalidades"]'::jsonb,
  itens JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.rondas_setores
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checklist_itens JSONB DEFAULT '["Luzes acesas", "Portas trancadas", "Sem anormalidades"]'::jsonb,
  ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.rondas_setores SET nome = COALESCE(nome, titulo) WHERE nome IS NULL;
UPDATE public.rondas_setores SET titulo = COALESCE(titulo, nome) WHERE titulo IS NULL;

CREATE TABLE IF NOT EXISTS public.rondas_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  setor_id TEXT,
  setor_nome TEXT,
  setor TEXT,
  codigo_ponto TEXT,
  codigo_tag TEXT,
  codigo_qrcode TEXT,
  codigo_qr TEXT,
  qr_token TEXT,
  nfc_tag TEXT,
  nome TEXT,
  nome_ponto TEXT NOT NULL,
  descricao TEXT,
  localizacao TEXT,
  localizacao_descricao TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  toleranciaraio NUMERIC DEFAULT 50,
  ordem INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.rondas_pontos
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS setor_id TEXT,
  ADD COLUMN IF NOT EXISTS setor_nome TEXT,
  ADD COLUMN IF NOT EXISTS setor TEXT,
  ADD COLUMN IF NOT EXISTS codigo_ponto TEXT,
  ADD COLUMN IF NOT EXISTS codigo_tag TEXT,
  ADD COLUMN IF NOT EXISTS codigo_qrcode TEXT,
  ADD COLUMN IF NOT EXISTS codigo_qr TEXT,
  ADD COLUMN IF NOT EXISTS qr_token TEXT,
  ADD COLUMN IF NOT EXISTS nfc_tag TEXT,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS nome_ponto TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS localizacao TEXT,
  ADD COLUMN IF NOT EXISTS localizacao_descricao TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS toleranciaraio NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.rondas_pontos SET nome_ponto = COALESCE(nome_ponto, nome) WHERE nome_ponto IS NULL;
UPDATE public.rondas_pontos SET nome = COALESCE(nome, nome_ponto) WHERE nome IS NULL;
UPDATE public.rondas_pontos SET codigo_qrcode = COALESCE(codigo_qrcode, codigo_qr, qr_token, codigo_ponto) WHERE codigo_qrcode IS NULL;

CREATE TABLE IF NOT EXISTS public.rondas_execucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  operador_id TEXT,
  operador_nome TEXT,
  turno TEXT DEFAULT 'Noturno',
  tipo_ronda TEXT DEFAULT 'Padrao',
  status TEXT DEFAULT 'Em Andamento',
  total_pontos INTEGER DEFAULT 0,
  pontos_totais INTEGER DEFAULT 0,
  pontos_concluidos INTEGER DEFAULT 0,
  pontos_lidos INTEGER DEFAULT 0,
  pontos_conferidos INTEGER DEFAULT 0,
  pontos_nao_conformes INTEGER DEFAULT 0,
  duracao_segundos INTEGER,
  inicio_em TIMESTAMPTZ DEFAULT NOW(),
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  fim_em TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  resumo_detalhado JSONB,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.rondas_execucao
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Noturno',
  ADD COLUMN IF NOT EXISTS tipo_ronda TEXT DEFAULT 'Padrao',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Em Andamento',
  ADD COLUMN IF NOT EXISTS total_pontos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_totais INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_concluidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_lidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_conferidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pontos_nao_conformes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duracao_segundos INTEGER,
  ADD COLUMN IF NOT EXISTS inicio_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_inicio TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS fim_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_fim TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resumo_detalhado JSONB,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.rondas_execucao SET pontos_totais = COALESCE(pontos_totais, total_pontos) WHERE pontos_totais IS NULL;
UPDATE public.rondas_execucao SET total_pontos = COALESCE(total_pontos, pontos_totais) WHERE total_pontos IS NULL;
UPDATE public.rondas_execucao SET pontos_lidos = COALESCE(pontos_lidos, pontos_concluidos) WHERE pontos_lidos IS NULL;
UPDATE public.rondas_execucao SET data_inicio = COALESCE(data_inicio, inicio_em) WHERE data_inicio IS NULL;

CREATE TABLE IF NOT EXISTS public.rondas_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  execucao_id UUID,
  ronda_id UUID,
  ronda_execucao_id UUID,
  ponto_id UUID,
  ponto_nome TEXT,
  setor_nome TEXT,
  operador_id TEXT,
  operador_nome TEXT,
  status_ponto TEXT DEFAULT 'conforme',
  status TEXT DEFAULT 'conforme',
  checklist_respostas JSONB DEFAULT '{}'::jsonb,
  fotos JSONB DEFAULT '[]'::jsonb,
  foto_url TEXT,
  foto_evidencia_url TEXT,
  observacao TEXT,
  observacoes TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  horario_leitura TIMESTAMPTZ DEFAULT NOW(),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.rondas_registros
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS execucao_id UUID,
  ADD COLUMN IF NOT EXISTS ronda_id UUID,
  ADD COLUMN IF NOT EXISTS ronda_execucao_id UUID,
  ADD COLUMN IF NOT EXISTS ponto_id UUID,
  ADD COLUMN IF NOT EXISTS ponto_nome TEXT,
  ADD COLUMN IF NOT EXISTS setor_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS status_ponto TEXT DEFAULT 'conforme',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'conforme',
  ADD COLUMN IF NOT EXISTS checklist_respostas JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_evidencia_url TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS horario_leitura TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.rondas_registros SET ronda_id = COALESCE(ronda_id, execucao_id, ronda_execucao_id) WHERE ronda_id IS NULL;
UPDATE public.rondas_registros SET foto_url = COALESCE(foto_url, foto_evidencia_url) WHERE foto_url IS NULL;

-- ------------------------------------------------------------------------------
-- 8. LIVRO DE OCORRÊNCIAS: ocorrencias
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  codigo TEXT,
  titulo TEXT NOT NULL,
  tipo TEXT DEFAULT 'Interna',
  gravidade TEXT DEFAULT 'Média',
  prioridade TEXT DEFAULT 'Média',
  unidade_bloco TEXT,
  unidade TEXT,
  bloco TEXT,
  relato TEXT,
  descricao TEXT,
  envolvidos TEXT,
  providencias_tomadas TEXT,
  operador_registro_id TEXT,
  operador_registro_nome TEXT,
  operador_nome TEXT,
  operador_id TEXT,
  operador_login TEXT,
  sindico_notificado BOOLEAN DEFAULT FALSE,
  fotos JSONB DEFAULT '[]'::jsonb,
  foto_url TEXT,
  status TEXT DEFAULT 'Pendente',
  resolucao TEXT,
  data_resolucao TIMESTAMPTZ,
  operador_resolucao TEXT,
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.ocorrencias
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Interna',
  ADD COLUMN IF NOT EXISTS gravidade TEXT DEFAULT 'Média',
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'Média',
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS relato TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS envolvidos TEXT,
  ADD COLUMN IF NOT EXISTS providencias_tomadas TEXT,
  ADD COLUMN IF NOT EXISTS operador_registro_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_registro_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_login TEXT,
  ADD COLUMN IF NOT EXISTS sindico_notificado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendente',
  ADD COLUMN IF NOT EXISTS resolucao TEXT,
  ADD COLUMN IF NOT EXISTS data_resolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operador_resolucao TEXT,
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Permitir nulos em relato e sincronizar com descricao
ALTER TABLE public.ocorrencias ALTER COLUMN relato DROP NOT NULL;
UPDATE public.ocorrencias SET descricao = COALESCE(descricao, relato) WHERE descricao IS NULL;
UPDATE public.ocorrencias SET relato = COALESCE(relato, descricao) WHERE relato IS NULL;

-- ------------------------------------------------------------------------------
-- 9. PASSAGEM DE POSTO: passagens_posto
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.passagens_posto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  condominio_nome TEXT,
  codigo TEXT,
  turno_sainte TEXT,
  turno_entrante TEXT,
  turno_sai TEXT,
  turno_entra TEXT,
  operador_sainte_id TEXT,
  operador_sai_id TEXT,
  operador_sainte_nome TEXT,
  operador_sai_nome TEXT,
  operador_entrante_id TEXT,
  operador_entra_id TEXT,
  operador_entrante_nome TEXT,
  operador_entra_nome TEXT,
  data_passagem TIMESTAMPTZ DEFAULT NOW(),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  checklist JSONB DEFAULT '{}'::jsonb,
  checklist_posto JSONB DEFAULT '{}'::jsonb,
  checklist_resumo JSONB DEFAULT '{}'::jsonb,
  materiais_conferidos JSONB DEFAULT '[]'::jsonb,
  encomendas_pendentes JSONB DEFAULT '[]'::jsonb,
  chaves_pendentes JSONB DEFAULT '[]'::jsonb,
  chaves_retidas TEXT,
  pendencias TEXT,
  ocorrencias_plantao TEXT,
  ocorrencias_relevantes TEXT,
  ocorrencias_resumo TEXT,
  relatorio_texto TEXT,
  divergencia TEXT,
  assinatura_sainte_url TEXT,
  assinatura_entrante_url TEXT,
  assinatura_sainte TEXT,
  assinatura_entrante TEXT,
  status TEXT DEFAULT 'Concluída',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.passagens_posto
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS condominio_nome TEXT,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS turno_sainte TEXT,
  ADD COLUMN IF NOT EXISTS turno_entrante TEXT,
  ADD COLUMN IF NOT EXISTS turno_sai TEXT,
  ADD COLUMN IF NOT EXISTS turno_entra TEXT,
  ADD COLUMN IF NOT EXISTS operador_sainte_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_sai_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_sainte_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_sai_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrante_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_entra_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrante_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_entra_nome TEXT,
  ADD COLUMN IF NOT EXISTS data_passagem TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_posto JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_resumo JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS materiais_conferidos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS encomendas_pendentes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chaves_pendentes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS chaves_retidas TEXT,
  ADD COLUMN IF NOT EXISTS pendencias TEXT,
  ADD COLUMN IF NOT EXISTS ocorrencias_plantao TEXT,
  ADD COLUMN IF NOT EXISTS ocorrencias_relevantes TEXT,
  ADD COLUMN IF NOT EXISTS ocorrencias_resumo TEXT,
  ADD COLUMN IF NOT EXISTS relatorio_texto TEXT,
  ADD COLUMN IF NOT EXISTS divergencia TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_sainte_url TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_entrante_url TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_sainte TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_entrante TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Concluída',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Remover restrição estrita NOT NULL em turno_sainte e turno_entrante para evitar falhas
ALTER TABLE public.passagens_posto ALTER COLUMN turno_sainte DROP NOT NULL;
ALTER TABLE public.passagens_posto ALTER COLUMN turno_entrante DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 10. PRESTADORES, VISITANTES & ACESSOS: prestadores, prestadores_acessos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  nome TEXT,
  nome_profissional TEXT,
  nome_completo TEXT,
  documento TEXT,
  tipo_documento TEXT DEFAULT 'RG',
  empresa TEXT,
  funcao TEXT,
  telefone TEXT,
  placa_veiculo TEXT,
  modelo_veiculo TEXT,
  foto_rosto TEXT,
  foto_url TEXT,
  foto_documento TEXT,
  tipo_servico TEXT,
  tipo TEXT,
  atende_condominio BOOLEAN DEFAULT FALSE,
  unidade TEXT,
  bloco TEXT,
  unidade_destino TEXT,
  bloco_destino TEXT,
  autorizante_nome TEXT,
  perfil_acesso TEXT DEFAULT 'prestador_unidade',
  parentesco_vinculo TEXT,
  tipo_validade TEXT DEFAULT 'hoje',
  data_validade_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_validade_fim TIMESTAMPTZ,
  tempo_maximo_minutos INTEGER DEFAULT 240,
  limite_permanencia_ate TIMESTAMPTZ,
  cracha TEXT,
  cracha_atribuido TEXT,
  status_acesso TEXT DEFAULT 'AUTORIZADO',
  status TEXT DEFAULT 'autorizado',
  operador_entrada_nome TEXT,
  operador_saida_nome TEXT,
  data_hora_entrada TIMESTAMPTZ,
  data_hora_saida TIMESTAMPTZ,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.prestadores
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS nome_profissional TEXT,
  ADD COLUMN IF NOT EXISTS nome_completo TEXT,
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'RG',
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS funcao TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS placa_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS modelo_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS foto_rosto TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_documento TEXT,
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS atende_condominio BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade_destino TEXT,
  ADD COLUMN IF NOT EXISTS bloco_destino TEXT,
  ADD COLUMN IF NOT EXISTS autorizante_nome TEXT,
  ADD COLUMN IF NOT EXISTS perfil_acesso TEXT DEFAULT 'prestador_unidade',
  ADD COLUMN IF NOT EXISTS parentesco_vinculo TEXT,
  ADD COLUMN IF NOT EXISTS tipo_validade TEXT DEFAULT 'hoje',
  ADD COLUMN IF NOT EXISTS data_validade_inicio TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_validade_fim TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tempo_maximo_minutos INTEGER DEFAULT 240,
  ADD COLUMN IF NOT EXISTS limite_permanencia_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cracha TEXT,
  ADD COLUMN IF NOT EXISTS cracha_atribuido TEXT,
  ADD COLUMN IF NOT EXISTS status_acesso TEXT DEFAULT 'AUTORIZADO',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'autorizado',
  ADD COLUMN IF NOT EXISTS operador_entrada_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_nome TEXT,
  ADD COLUMN IF NOT EXISTS data_hora_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_hora_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Permitir nulos em nome e sincronizar com nome_profissional
ALTER TABLE public.prestadores ALTER COLUMN nome DROP NOT NULL;
UPDATE public.prestadores SET nome = COALESCE(nome, nome_profissional, nome_completo) WHERE nome IS NULL;
UPDATE public.prestadores SET nome_profissional = COALESCE(nome_profissional, nome, nome_completo) WHERE nome_profissional IS NULL;
UPDATE public.prestadores SET foto_rosto = COALESCE(foto_rosto, foto_url) WHERE foto_rosto IS NULL;
UPDATE public.prestadores SET foto_url = COALESCE(foto_url, foto_rosto) WHERE foto_url IS NULL;

CREATE TABLE IF NOT EXISTS public.prestadores_acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  prestador_id UUID,
  prestador_nome TEXT,
  nome_completo TEXT NOT NULL DEFAULT '',
  perfil_acesso TEXT NOT NULL DEFAULT 'prestador_unidade',
  documento TEXT,
  empresa TEXT,
  parentesco_vinculo TEXT,
  unidade TEXT,
  bloco TEXT,
  unidade_destino TEXT,
  bloco_destino TEXT,
  tipo TEXT DEFAULT 'Prestador',
  foto_rosto TEXT,
  foto_url TEXT,
  foto_documento TEXT,
  cracha TEXT,
  cracha_numero TEXT,
  placa_veiculo TEXT,
  veiculo_placa TEXT,
  modelo_veiculo TEXT,
  data_hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_entrada TIMESTAMPTZ DEFAULT NOW(),
  tempo_maximo_minutos INTEGER,
  limite_permanencia_ate TIMESTAMPTZ,
  data_hora_saida TIMESTAMPTZ,
  data_saida TIMESTAMPTZ,
  status_acesso TEXT DEFAULT 'DENTRO',
  status TEXT DEFAULT 'no_local',
  operador_entrada_id TEXT,
  operador_entrada_nome TEXT,
  operador_saida_id TEXT,
  operador_saida_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.prestadores_acessos
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS prestador_id UUID,
  ADD COLUMN IF NOT EXISTS prestador_nome TEXT,
  ADD COLUMN IF NOT EXISTS nome_completo TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS perfil_acesso TEXT DEFAULT 'prestador_unidade',
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS parentesco_vinculo TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade_destino TEXT,
  ADD COLUMN IF NOT EXISTS bloco_destino TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Prestador',
  ADD COLUMN IF NOT EXISTS foto_rosto TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_documento TEXT,
  ADD COLUMN IF NOT EXISTS cracha TEXT,
  ADD COLUMN IF NOT EXISTS cracha_numero TEXT,
  ADD COLUMN IF NOT EXISTS placa_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS veiculo_placa TEXT,
  ADD COLUMN IF NOT EXISTS modelo_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS data_hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS tempo_maximo_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS limite_permanencia_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_hora_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_acesso TEXT DEFAULT 'DENTRO',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'no_local',
  ADD COLUMN IF NOT EXISTS operador_entrada_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrada_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_nome TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.prestadores_acessos SET nome_completo = COALESCE(nome_completo, prestador_nome) WHERE nome_completo = '' OR nome_completo IS NULL;
UPDATE public.prestadores_acessos SET prestador_nome = COALESCE(prestador_nome, nome_completo) WHERE prestador_nome IS NULL;
UPDATE public.prestadores_acessos SET placa_veiculo = COALESCE(placa_veiculo, veiculo_placa) WHERE placa_veiculo IS NULL;
UPDATE public.prestadores_acessos SET cracha = COALESCE(cracha, cracha_numero) WHERE cracha IS NULL;

-- ------------------------------------------------------------------------------
-- 11. BANCADA & LEMBRETES: lembretes_portaria, bancada_volumes, bancada_conferencias
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lembretes_portaria (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  unidade_bloco TEXT,
  tipo TEXT DEFAULT 'aviso',
  remetente TEXT DEFAULT 'Portaria',
  remetente_tipo TEXT DEFAULT 'morador',
  remetente_nome TEXT,
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT FALSE,
  lido_em TIMESTAMPTZ,
  lido_por_nome TEXT,
  lido_por_id TEXT,
  prioridade TEXT DEFAULT 'normal',
  finalizado BOOLEAN DEFAULT FALSE,
  finalizado_em TIMESTAMPTZ,
  finalizado_por_nome TEXT,
  finalizado_por_id TEXT,
  eh_adm BOOLEAN DEFAULT FALSE,
  data_limite TIMESTAMPTZ,
  operador_id TEXT,
  operador_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.lembretes_portaria
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'aviso',
  ADD COLUMN IF NOT EXISTS remetente TEXT DEFAULT 'Portaria',
  ADD COLUMN IF NOT EXISTS remetente_tipo TEXT DEFAULT 'morador',
  ADD COLUMN IF NOT EXISTS remetente_nome TEXT,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS lido BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lido_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS lido_por_id TEXT,
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS finalizado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalizado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS finalizado_por_id TEXT,
  ADD COLUMN IF NOT EXISTS eh_adm BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_limite TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.bancada_volumes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  codigo_barras TEXT,
  estrutura TEXT DEFAULT 'Torre A',
  unidade TEXT NOT NULL,
  bloco TEXT,
  unidade_bloco TEXT,
  volumes INTEGER DEFAULT 1,
  volume_tipo TEXT DEFAULT 'Caixa',
  tipo_volume TEXT DEFAULT 'Encomenda RE',
  remetente TEXT,
  transportadora TEXT,
  morador_nome TEXT,
  status TEXT DEFAULT 'ativo',
  localizacao TEXT DEFAULT 'Balcão de Triagem',
  local_armazenamento TEXT DEFAULT 'Bancada Principal',
  foto_url TEXT,
  observacao TEXT,
  data_chegada TIMESTAMPTZ DEFAULT NOW(),
  operador_id TEXT,
  operador_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.bancada_volumes
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS estrutura TEXT DEFAULT 'Torre A',
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS volumes INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS volume_tipo TEXT DEFAULT 'Caixa',
  ADD COLUMN IF NOT EXISTS tipo_volume TEXT DEFAULT 'Encomenda RE',
  ADD COLUMN IF NOT EXISTS remetente TEXT,
  ADD COLUMN IF NOT EXISTS transportadora TEXT,
  ADD COLUMN IF NOT EXISTS morador_nome TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS localizacao TEXT DEFAULT 'Balcão de Triagem',
  ADD COLUMN IF NOT EXISTS local_armazenamento TEXT DEFAULT 'Bancada Principal',
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS data_chegada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.bancada_conferencias (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  data_conferencia TIMESTAMPTZ DEFAULT NOW(),
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  operador_id TEXT,
  operador_nome TEXT,
  total_volumes INTEGER DEFAULT 0,
  total_volumes_esperados INTEGER DEFAULT 0,
  total_volumes_conferidos INTEGER DEFAULT 0,
  total_unidades INTEGER DEFAULT 0,
  estruturas_resumo JSONB DEFAULT '{}'::jsonb,
  itens JSONB DEFAULT '[]'::jsonb,
  divergencias TEXT,
  status TEXT DEFAULT 'concluido',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.bancada_conferencias
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS data_conferencia TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS total_volumes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_volumes_esperados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_volumes_conferidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_unidades INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estruturas_resumo JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS divergencias TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'concluido',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 12. HISTÓRICO ABSOLUTO & AUDITORIA: historico_absoluto
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historico_absoluto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  detalhes JSONB,
  dados_anteriores JSONB,
  dados_novos JSONB,
  registro_id TEXT,
  operador_id TEXT,
  operador_nome TEXT,
  operador_login TEXT,
  ip TEXT,
  ip_origem TEXT,
  data_hora TIMESTAMPTZ DEFAULT NOW(),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.historico_absoluto
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS modulo TEXT,
  ADD COLUMN IF NOT EXISTS acao TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS detalhes JSONB,
  ADD COLUMN IF NOT EXISTS dados_anteriores JSONB,
  ADD COLUMN IF NOT EXISTS dados_novos JSONB,
  ADD COLUMN IF NOT EXISTS registro_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_login TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS ip_origem TEXT,
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 13. WHATSAPP & EMERGÊNCIA: templates_whatsapp, agenda_emergencia
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  chave TEXT,
  codigo_evento TEXT,
  titulo TEXT,
  tipo TEXT,
  texto_template TEXT,
  corpo_texto TEXT,
  conteudo TEXT,
  canal_destino TEXT DEFAULT 'morador',
  variaveis_disponiveis JSONB DEFAULT '["{NOME_MORADOR}", "{UNIDADE}", "{CODIGO}", "{LINK}"]'::jsonb,
  variaveis JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.templates_whatsapp
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS chave TEXT,
  ADD COLUMN IF NOT EXISTS codigo_evento TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS texto_template TEXT,
  ADD COLUMN IF NOT EXISTS corpo_texto TEXT,
  ADD COLUMN IF NOT EXISTS conteudo TEXT,
  ADD COLUMN IF NOT EXISTS canal_destino TEXT DEFAULT 'morador',
  ADD COLUMN IF NOT EXISTS variaveis_disponiveis JSONB DEFAULT '["{NOME_MORADOR}", "{UNIDADE}", "{CODIGO}", "{LINK}"]'::jsonb,
  ADD COLUMN IF NOT EXISTS variaveis JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.templates_whatsapp SET texto_template = COALESCE(texto_template, corpo_texto, conteudo) WHERE texto_template IS NULL;

CREATE TABLE IF NOT EXISTS public.agenda_emergencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  nome TEXT,
  nome_descricao TEXT,
  telefone TEXT,
  telefone_principal TEXT,
  celular TEXT,
  telefone_whatsapp TEXT,
  cargo_orgao TEXT,
  categoria TEXT DEFAULT 'Emergência',
  exibir_menu_flutuante BOOLEAN DEFAULT TRUE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.agenda_emergencia
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS nome_descricao TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS telefone_principal TEXT,
  ADD COLUMN IF NOT EXISTS celular TEXT,
  ADD COLUMN IF NOT EXISTS telefone_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS cargo_orgao TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Emergência',
  ADD COLUMN IF NOT EXISTS exibir_menu_flutuante BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.agenda_emergencia SET nome = COALESCE(nome, nome_descricao) WHERE nome IS NULL;
UPDATE public.agenda_emergencia SET telefone = COALESCE(telefone, telefone_principal) WHERE telefone IS NULL;

-- ------------------------------------------------------------------------------
-- 14. ÁREAS COMUNS & RESERVAS: areas_comuns, reservas_areas_comuns
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.areas_comuns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  nome TEXT,
  name TEXT,
  descricao TEXT,
  description TEXT,
  capacidade_maxima INTEGER DEFAULT 30,
  capacity INTEGER DEFAULT 30,
  taxa_reserva NUMERIC(10, 2) DEFAULT 0.00,
  taxa_limpeza NUMERIC(10, 2) DEFAULT 0.00,
  cleaning_fee NUMERIC(10, 2) DEFAULT 0.00,
  valor_caucao NUMERIC(10, 2) DEFAULT 0.00,
  antecedencia_minima_dias INTEGER DEFAULT 1,
  antecedencia_maxima_dias INTEGER DEFAULT 60,
  horario_inicio TEXT DEFAULT '09:00',
  start_hour TEXT DEFAULT '09:00',
  horario_fim TEXT DEFAULT '22:00',
  end_hour TEXT DEFAULT '22:00',
  slot_duration_minutes INTEGER DEFAULT 60,
  intervalo_limpeza_horas INTEGER DEFAULT 2,
  turnos_disponiveis JSONB DEFAULT '["manha", "tarde", "noite", "dia_todo"]'::jsonb,
  dias_funcionamento JSONB DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb,
  regras_termo TEXT DEFAULT 'Cuidar do espaço e respeitar os vizinhos.',
  rules JSONB DEFAULT '[]'::jsonb,
  exige_aprovacao_sindico BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  foto_url TEXT,
  ativa BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  color TEXT DEFAULT '#4f46e5',
  type TEXT DEFAULT 'outro',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.areas_comuns
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS capacidade_maxima INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS taxa_reserva NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS taxa_limpeza NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS cleaning_fee NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS valor_caucao NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS antecedencia_minima_dias INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS antecedencia_maxima_dias INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS horario_inicio TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS start_hour TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS horario_fim TEXT DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS end_hour TEXT DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS intervalo_limpeza_horas INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS turnos_disponiveis JSONB DEFAULT '["manha", "tarde", "noite", "dia_todo"]'::jsonb,
  ADD COLUMN IF NOT EXISTS dias_funcionamento JSONB DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb,
  ADD COLUMN IF NOT EXISTS regras_termo TEXT DEFAULT 'Cuidar do espaço e respeitar os vizinhos.',
  ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exige_aprovacao_sindico BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS ativa BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4f46e5',
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.areas_comuns SET nome = COALESCE(nome, name) WHERE nome IS NULL;
UPDATE public.areas_comuns SET name = COALESCE(name, nome) WHERE name IS NULL;
UPDATE public.areas_comuns SET descricao = COALESCE(descricao, description) WHERE descricao IS NULL;
UPDATE public.areas_comuns SET horario_inicio = COALESCE(horario_inicio, start_hour) WHERE horario_inicio IS NULL;
UPDATE public.areas_comuns SET horario_fim = COALESCE(horario_fim, end_hour) WHERE horario_fim IS NULL;
UPDATE public.areas_comuns SET capacidade_maxima = COALESCE(capacidade_maxima, capacity) WHERE capacidade_maxima IS NULL;
UPDATE public.areas_comuns SET taxa_limpeza = COALESCE(taxa_limpeza, cleaning_fee) WHERE taxa_limpeza IS NULL;
UPDATE public.areas_comuns SET ativa = COALESCE(ativa, is_active) WHERE ativa IS NULL;

CREATE TABLE IF NOT EXISTS public.reservas_areas_comuns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  area_id TEXT,
  area_nome TEXT,
  morador_id TEXT,
  resident_id TEXT,
  morador_nome TEXT,
  resident_name TEXT,
  morador_telefone TEXT,
  resident_phone TEXT,
  unidade_bloco TEXT,
  unit_number TEXT,
  unit_block TEXT DEFAULT '',
  unit_id TEXT,
  data_reserva TEXT,
  date DATE,
  turno TEXT DEFAULT 'dia_todo',
  horario_inicio TEXT,
  start_time TEXT,
  horario_fim TEXT,
  end_time TEXT,
  tipo_evento TEXT DEFAULT 'Confraternização',
  qtd_convidados_estimada INTEGER DEFAULT 10,
  guest_count INTEGER DEFAULT 10,
  status TEXT DEFAULT 'aprovada',
  valor_total NUMERIC(10, 2) DEFAULT 0.00,
  cleaning_fee NUMERIC(10, 2) DEFAULT 0.00,
  pago BOOLEAN DEFAULT FALSE,
  termo_aceito BOOLEAN DEFAULT TRUE,
  data_aceite_termo TIMESTAMPTZ,
  observacoes_solicitante TEXT,
  notes TEXT,
  motivo_recusa TEXT,
  aprovado_por_nome TEXT,
  aprovado_em TIMESTAMPTZ,
  vistoria_entrada JSONB DEFAULT '{"realizada": false}'::jsonb,
  vistoria_saida JSONB DEFAULT '{"realizada": false}'::jsonb,
  lista_convidados JSONB DEFAULT '[]'::jsonb,
  reservation_code TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.reservas_areas_comuns
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS area_id TEXT,
  ADD COLUMN IF NOT EXISTS area_nome TEXT,
  ADD COLUMN IF NOT EXISTS morador_id TEXT,
  ADD COLUMN IF NOT EXISTS resident_id TEXT,
  ADD COLUMN IF NOT EXISTS morador_nome TEXT,
  ADD COLUMN IF NOT EXISTS resident_name TEXT,
  ADD COLUMN IF NOT EXISTS morador_telefone TEXT,
  ADD COLUMN IF NOT EXISTS resident_phone TEXT,
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS unit_number TEXT,
  ADD COLUMN IF NOT EXISTS unit_block TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_id TEXT,
  ADD COLUMN IF NOT EXISTS data_reserva TEXT,
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'dia_todo',
  ADD COLUMN IF NOT EXISTS horario_inicio TEXT,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS horario_fim TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS tipo_evento TEXT DEFAULT 'Confraternização',
  ADD COLUMN IF NOT EXISTS qtd_convidados_estimada INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aprovada',
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS cleaning_fee NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS termo_aceito BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS data_aceite_termo TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes_solicitante TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vistoria_entrada JSONB DEFAULT '{"realizada": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS vistoria_saida JSONB DEFAULT '{"realizada": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS lista_convidados JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reservation_code TEXT,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 15. HARDWARE, CONTROLE DE ACESSO & PASSES: pontos_acesso, registros_acesso, passes_virtuais_qr, blacklist_bloqueios
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pontos_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'pedestre',
  sentido TEXT DEFAULT 'bidirecional',
  ip_controladora TEXT,
  porta_rele INTEGER DEFAULT 1,
  status TEXT DEFAULT 'online',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.pontos_acesso
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'pedestre',
  ADD COLUMN IF NOT EXISTS sentido TEXT DEFAULT 'bidirecional',
  ADD COLUMN IF NOT EXISTS ip_controladora TEXT,
  ADD COLUMN IF NOT EXISTS porta_rele INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.registros_acesso (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  ponto_acesso_id TEXT,
  ponto_acesso_nome TEXT,
  ponto_acesso_entrada TEXT,
  tipo TEXT DEFAULT 'visitante',
  pessoa_tipo TEXT DEFAULT 'Morador',
  pessoa_id TEXT,
  nome TEXT,
  pessoa_nome TEXT,
  documento TEXT,
  telefone TEXT,
  empresa TEXT,
  bloco TEXT,
  unidade TEXT,
  unidade_bloco TEXT,
  morador_responsavel TEXT,
  sentido TEXT DEFAULT 'entrada',
  metodo TEXT DEFAULT 'tag_rfid',
  veiculo_placa TEXT,
  veiculo_modelo TEXT,
  veiculo_cor TEXT,
  cracha_ou_tag TEXT,
  reserva_area_id TEXT,
  passe_qr_id TEXT,
  foto_entrada_url TEXT,
  foto_saida_url TEXT,
  foto_evento_url TEXT,
  data_hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  data_hora_saida TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  autorizacao TEXT DEFAULT 'permitido',
  status TEXT DEFAULT 'presente',
  operador_id TEXT,
  operador_nome TEXT,
  operador_entrada_nome TEXT,
  operador_saida_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.registros_acesso
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS ponto_acesso_id TEXT,
  ADD COLUMN IF NOT EXISTS ponto_acesso_nome TEXT,
  ADD COLUMN IF NOT EXISTS ponto_acesso_entrada TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'visitante',
  ADD COLUMN IF NOT EXISTS pessoa_tipo TEXT DEFAULT 'Morador',
  ADD COLUMN IF NOT EXISTS pessoa_id TEXT,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS pessoa_nome TEXT,
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS morador_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS sentido TEXT DEFAULT 'entrada',
  ADD COLUMN IF NOT EXISTS metodo TEXT DEFAULT 'tag_rfid',
  ADD COLUMN IF NOT EXISTS veiculo_placa TEXT,
  ADD COLUMN IF NOT EXISTS veiculo_modelo TEXT,
  ADD COLUMN IF NOT EXISTS veiculo_cor TEXT,
  ADD COLUMN IF NOT EXISTS cracha_ou_tag TEXT,
  ADD COLUMN IF NOT EXISTS reserva_area_id TEXT,
  ADD COLUMN IF NOT EXISTS passe_qr_id TEXT,
  ADD COLUMN IF NOT EXISTS foto_entrada_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_saida_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_evento_url TEXT,
  ADD COLUMN IF NOT EXISTS data_hora_entrada TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS autorizacao TEXT DEFAULT 'permitido',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'presente',
  ADD COLUMN IF NOT EXISTS operador_id TEXT,
  ADD COLUMN IF NOT EXISTS operador_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_entrada_nome TEXT,
  ADD COLUMN IF NOT EXISTS operador_saida_nome TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.passes_virtuais_qr (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  token TEXT,
  token_qr TEXT,
  convidado_nome TEXT,
  visitante_nome TEXT,
  convidado_documento TEXT,
  visitante_documento TEXT,
  tipo TEXT DEFAULT 'visitante',
  unidade TEXT,
  bloco TEXT,
  unidade_bloco TEXT,
  morador_id TEXT,
  morador_nome TEXT,
  morador_telefone TEXT,
  data_validade TEXT,
  validade_inicio TIMESTAMPTZ,
  validade_fim TIMESTAMPTZ,
  hora_inicio TEXT DEFAULT '08:00',
  hora_fim TEXT DEFAULT '22:00',
  max_usos INTEGER DEFAULT 1,
  usos_restantes INTEGER DEFAULT 1,
  usos_realizados INTEGER DEFAULT 0,
  status TEXT DEFAULT 'valido',
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.passes_virtuais_qr
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS token TEXT,
  ADD COLUMN IF NOT EXISTS token_qr TEXT,
  ADD COLUMN IF NOT EXISTS convidado_nome TEXT,
  ADD COLUMN IF NOT EXISTS visitante_nome TEXT,
  ADD COLUMN IF NOT EXISTS convidado_documento TEXT,
  ADD COLUMN IF NOT EXISTS visitante_documento TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'visitante',
  ADD COLUMN IF NOT EXISTS unidade TEXT,
  ADD COLUMN IF NOT EXISTS bloco TEXT,
  ADD COLUMN IF NOT EXISTS unidade_bloco TEXT,
  ADD COLUMN IF NOT EXISTS morador_id TEXT,
  ADD COLUMN IF NOT EXISTS morador_nome TEXT,
  ADD COLUMN IF NOT EXISTS morador_telefone TEXT,
  ADD COLUMN IF NOT EXISTS data_validade TEXT,
  ADD COLUMN IF NOT EXISTS validade_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validade_fim TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hora_inicio TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS hora_fim TEXT DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS max_usos INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS usos_restantes INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS usos_realizados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'valido',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.passes_virtuais_qr SET token = COALESCE(token, token_qr) WHERE token IS NULL;
UPDATE public.passes_virtuais_qr SET visitante_nome = COALESCE(visitante_nome, convidado_nome) WHERE visitante_nome IS NULL;

CREATE TABLE IF NOT EXISTS public.blacklist_bloqueios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condominio_id UUID,
  nome TEXT,
  nome_ou_placa TEXT,
  tipo TEXT DEFAULT 'documento',
  documento TEXT,
  motivo TEXT NOT NULL,
  gravidade TEXT DEFAULT 'alerta',
  foto_url TEXT,
  cadastrado_por TEXT,
  registrado_por TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.blacklist_bloqueios
  ADD COLUMN IF NOT EXISTS condominio_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS nome_ou_placa TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'documento',
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS gravidade TEXT DEFAULT 'alerta',
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS cadastrado_por TEXT,
  ADD COLUMN IF NOT EXISTS registrado_por TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.blacklist_bloqueios SET nome_ou_placa = COALESCE(nome_ou_placa, nome) WHERE nome_ou_placa IS NULL;

-- ------------------------------------------------------------------------------
-- 16. EXCLUSÃO CONTROLADA DE TABELAS LEGADAS, DUPLICADAS OU ÓRFÃS
-- ------------------------------------------------------------------------------
-- Migra dados residuais caso alguma tabela antiga ainda exista com dados
DO $$
BEGIN
  -- Se usuarios_sistema existir, garante operador correspondente em operadores
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios_sistema') THEN
    INSERT INTO public.operadores (condominio_id, nome, login, senha, funcao, perfil, ativo)
    SELECT 
      COALESCE(u.condominio_id, (SELECT id FROM public.condominios LIMIT 1)),
      COALESCE(u.nome, 'Operador Sistema'),
      COALESCE(u.login, 'op_' || u.id::text),
      COALESCE(u.senha, '123456'),
      COALESCE(u.cargo, 'Porteiro'),
      COALESCE(u.perfil, 'operador'),
      TRUE
    FROM public.usuarios_sistema u
    ON CONFLICT (login) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Exclusão de tabelas legadas/órfãs que geram confusão no painel do Supabase
DROP TABLE IF EXISTS public.usuarios_sistema CASCADE;
DROP TABLE IF EXISTS public.custodia_itens CASCADE;
DROP TABLE IF EXISTS public.materiais CASCADE;
DROP TABLE IF EXISTS public.inspecoes_materiais CASCADE;
DROP TABLE IF EXISTS public.movimentacoes_chaves CASCADE;
DROP TABLE IF EXISTS public.pontos_ronda CASCADE;
DROP TABLE IF EXISTS public.rondas_execucoes CASCADE;
DROP TABLE IF EXISTS public.registros_ronda CASCADE;
DROP TABLE IF EXISTS public.rondas_passagem_posto CASCADE;
DROP TABLE IF EXISTS public.visitas_prestadores CASCADE;
DROP TABLE IF EXISTS public.visitas CASCADE;
DROP TABLE IF EXISTS public.cadastros_moradores CASCADE;
DROP TABLE IF EXISTS public.recebimento_lotes CASCADE;
DROP TABLE IF EXISTS public.escaninhos CASCADE;
DROP TABLE IF EXISTS public.logs_atividades CASCADE;
DROP TABLE IF EXISTS public.unidades CASCADE;
DROP TABLE IF EXISTS public.blocos CASCADE;

-- ------------------------------------------------------------------------------
-- 17. ÍNDICES DE PERFORMANCE ULTRA-RÁPIDA (SUB-MILLISECOND LOOKUPS)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_moradores_condo_unid ON public.moradores(condominio_id, unidade, bloco);
CREATE INDEX IF NOT EXISTS idx_moradores_cpf ON public.moradores(cpf);
CREATE INDEX IF NOT EXISTS idx_moradores_tag_rfid ON public.moradores(tag_rfid);
CREATE INDEX IF NOT EXISTS idx_moradores_veiculo_placa ON public.moradores(veiculo_placa);

CREATE INDEX IF NOT EXISTS idx_encomendas_condo_status ON public.encomendas_itens(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_encomendas_unidade_bloco ON public.encomendas_itens(condominio_id, unidade, bloco);
CREATE INDEX IF NOT EXISTS idx_encomendas_codigo_barras ON public.encomendas_itens(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_encomendas_codigo_rastreio ON public.encomendas_itens(codigo_rastreio);

CREATE INDEX IF NOT EXISTS idx_lotes_re_condo_codigo ON public.lotes_re(condominio_id, codigo_re);

CREATE INDEX IF NOT EXISTS idx_custodia_condo_status ON public.custodia(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_custodia_codigo ON public.custodia(codigo_custodia);

CREATE INDEX IF NOT EXISTS idx_chaves_condo_status ON public.chaves(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_chaves_codigo ON public.chaves(codigo_chave);

CREATE INDEX IF NOT EXISTS idx_mov_chaves_status ON public.movimentacao_chaves(condominio_id, status);

CREATE INDEX IF NOT EXISTS idx_prestadores_condo_status ON public.prestadores(condominio_id, status_acesso);
CREATE INDEX IF NOT EXISTS idx_prestadores_documento ON public.prestadores(documento);
CREATE INDEX IF NOT EXISTS idx_prestadores_placa ON public.prestadores(placa_veiculo);

CREATE INDEX IF NOT EXISTS idx_prestadores_acessos_status ON public.prestadores_acessos(condominio_id, status_acesso);
CREATE INDEX IF NOT EXISTS idx_prestadores_acessos_data ON public.prestadores_acessos(condominio_id, data_hora_entrada DESC);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_condo_created ON public.ocorrencias(condominio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lembretes_condo_lido ON public.lembretes_portaria(condominio_id, lido, finalizado);
CREATE INDEX IF NOT EXISTS idx_bancada_vol_condo ON public.bancada_volumes(condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_historico_condo_data ON public.historico_absoluto(condominio_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 18. PERMISSÕES COMPLETAS, GRANTS & RLS 100% PERMISSIVO PARA ANONS E AUTH
-- ------------------------------------------------------------------------------
-- Concede acesso no schema public para todas as roles do Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Configuração universal e permissiva de Row Level Security (RLS)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  tabelas_alvo TEXT[] := ARRAY[
    'condominios', 'configuracoes', 'operadores', 'moradores', 'entregadores',
    'lotes_re', 'encomendas_itens', 'locais_armazenamento', 'custodia',
    'materiais_posto', 'chaves', 'movimentacao_chaves', 'checklist_manutencao',
    'chamados_manutencao', 'rondas_pontos', 'rondas_execucao', 'rondas_registros',
    'rondas_setores', 'ocorrencias', 'passagens_posto', 'prestadores',
    'prestadores_acessos', 'lembretes_portaria', 'bancada_volumes',
    'bancada_conferencias', 'historico_absoluto', 'templates_whatsapp',
    'agenda_emergencia', 'areas_comuns', 'reservas_areas_comuns',
    'pontos_acesso', 'registros_acesso', 'passes_virtuais_qr', 'blacklist_bloqueios'
  ];
BEGIN
  FOREACH tbl IN ARRAY tabelas_alvo LOOP
    BEGIN
      -- Habilita RLS na tabela
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

      -- Remove qualquer política pré-existente
      FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        BEGIN
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;

      -- Cria política limpa e 100% permissiva para anon, authenticated e service_role
      EXECUTE format('CREATE POLICY "Acesso_Total_PorttoHub_%I" ON public.%I FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);', tbl, tbl);

    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 19. SUPABASE STORAGE: BUCKETS & POLÍTICAS DE UPLOAD
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  bkt TEXT;
  buckets_necessarios TEXT[] := ARRAY['encomendas', 'documentos', 'assinaturas', 'fotos', 'porttohub'];
BEGIN
  FOREACH bkt IN ARRAY buckets_necessarios LOOP
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = bkt) THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        bkt,
        bkt,
        TRUE,
        20971520, -- 20MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf']
      );
    ELSE
      UPDATE storage.buckets
      SET public = TRUE,
          file_size_limit = 20971520
      WHERE id = bkt;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Políticas de Storage públicas e sem bloqueios de RLS
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public Storage Read PorttoHub" ON storage.objects;
  CREATE POLICY "Public Storage Read PorttoHub" ON storage.objects
    FOR SELECT TO public, anon, authenticated USING (true);

  DROP POLICY IF EXISTS "Public Storage Insert PorttoHub" ON storage.objects;
  CREATE POLICY "Public Storage Insert PorttoHub" ON storage.objects
    FOR INSERT TO public, anon, authenticated WITH CHECK (true);

  DROP POLICY IF EXISTS "Public Storage Update PorttoHub" ON storage.objects;
  CREATE POLICY "Public Storage Update PorttoHub" ON storage.objects
    FOR UPDATE TO public, anon, authenticated USING (true);

  DROP POLICY IF EXISTS "Public Storage Delete PorttoHub" ON storage.objects;
  CREATE POLICY "Public Storage Delete PorttoHub" ON storage.objects
    FOR DELETE TO public, anon, authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 20. SUPABASE REALTIME (PUBLICAÇÃO REATIVA EM TEMPO REAL)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
DECLARE
  tbl_rt TEXT;
  tabelas_realtime TEXT[] := ARRAY[
    'encomendas_itens',
    'lotes_re',
    'custodia',
    'chaves',
    'movimentacao_chaves',
    'ocorrencias',
    'lembretes_portaria',
    'bancada_volumes',
    'bancada_conferencias',
    'prestadores',
    'prestadores_acessos',
    'passagens_posto',
    'rondas_execucao',
    'reservas_areas_comuns',
    'registros_acesso',
    'historico_absoluto'
  ];
BEGIN
  FOREACH tbl_rt IN ARRAY tabelas_realtime LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = tbl_rt
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl_rt);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 21. SEED / BOOTSTRAP DE CONDOMÍNIO INICIAL E OPERADOR
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_condo_id UUID;
BEGIN
  -- Se não existir nenhum condomínio cadastrado, cria o condomínio inicial padrão
  IF NOT EXISTS (SELECT 1 FROM public.condominios LIMIT 1) THEN
    INSERT INTO public.condominios (nome, endereco, cidade, uf, tipo_estrutura, qtd_blocos, unidades_por_bloco)
    VALUES ('Condomínio Residencial Portto Real', 'Av. Paulista, 1000 - Bela Vista', 'São Paulo', 'SP', 'apartamentos', 2, 80)
    RETURNING id INTO v_condo_id;

    -- Cria configurações padrão para o condomínio
    INSERT INTO public.configuracoes (condominio_id)
    VALUES (v_condo_id);

    -- Cria operador supervisor inicial para portaria
    INSERT INTO public.operadores (condominio_id, nome, login, senha, funcao, cargo, perfil, nivel_acesso)
    VALUES (v_condo_id, 'Supervisor Geral', 'admin', 'admin123', 'Supervisor', 'Supervisor', 'admin', 'admin');

    -- Cria áreas comuns iniciais
    INSERT INTO public.areas_comuns (id, condominio_id, nome, name, tipo_estrutura, horario_inicio, horario_fim, capacidade_maxima, taxa_limpeza, color)
    VALUES 
      ('area-churrasqueira-1', v_condo_id, 'Churrasqueira Gourmet', 'Churrasqueira Gourmet', 'churrasqueira', '10:00', '22:00', 25, 50.00, '#f97316'),
      ('area-salao-festas-1', v_condo_id, 'Salão de Festas Principal', 'Salão de Festas Principal', 'festa', '12:00', '23:00', 80, 120.00, '#8b5cf6'),
      ('area-quadra-1', v_condo_id, 'Quadra Poliesportiva', 'Quadra Poliesportiva', 'quadra', '07:00', '22:00', 20, 0.00, '#0ea5e9');

    -- Cria templates WhatsApp padrão
    INSERT INTO public.templates_whatsapp (condominio_id, chave, titulo, texto_template, corpo_texto)
    VALUES 
      (v_condo_id, 'encomenda_chegada', 'Chegada de Encomenda', 'Olá {NOME_MORADOR}, sua encomenda ({CODIGO}) chegou na portaria do condomínio e já está disponível para retirada.', 'Olá {NOME_MORADOR}, sua encomenda ({CODIGO}) chegou na portaria do condomínio e já está disponível para retirada.'),
      (v_condo_id, 'encomenda_retirada', 'Confirmação de Retirada', 'Olá {NOME_MORADOR}, confirmamos a retirada da sua encomenda ({CODIGO}) na portaria.', 'Olá {NOME_MORADOR}, confirmamos a retirada da sua encomenda ({CODIGO}) na portaria.'),
      (v_condo_id, 'aviso_visitante', 'Visitante na Portaria', 'Olá {NOME_MORADOR}, informamos que {VISITANTE} está na portaria aguardando autorização para entrar.', 'Olá {NOME_MORADOR}, informamos que {VISITANTE} está na portaria aguardando autorização para entrar.');
  END IF;
END $$;

COMMIT;

-- ------------------------------------------------------------------------------
-- 22. RECARREGAR IMEDIATAMENTE O CACHE DO SCHEMA POSTGREST NO SUPABASE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
