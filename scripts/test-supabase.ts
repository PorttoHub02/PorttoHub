/**
 * Script de Teste e Validação da Conexão com o Supabase Oficial
 * Projeto: pkemipwowkcnstbazlma
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pkemipwowkcnstbazlma.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW1pcHdvd2tjbnN0YmF6bG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MjI0MDQsImV4cCI6MjEwODk5ODQwNH0.oGV6ru4O-OgZ-LeSAtZp0kCZZqpK2BR49F1WCbO1yR0';

console.log('--- TESTE DE CONEXÃO SUPABASE (PORTTOHUB) ---');
console.log('URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testarConexao() {
  const tabelasParaChecar = [
    'condominios',
    'configuracoes',
    'operadores',
    'moradores',
    'encomendas_itens',
    'lotes_re',
    'custodia',
    'chaves',
    'rondas_execucao',
    'ocorrencias',
    'passagens_posto',
    'areas_comuns'
  ];

  console.log('\nVerificando tabelas no Supabase:');
  for (const tabela of tabelasParaChecar) {
    try {
      const { data, error, count } = await supabase
        .from(tabela)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === 'PGRST205') {
          console.log(`❌ [${tabela}]: Tabela ainda não criada no banco (Execute o supabase_schema_porttohub.sql)`);
        } else {
          console.log(`⚠️ [${tabela}]: Erro (${error.code}) - ${error.message}`);
        }
      } else {
        console.log(`✅ [${tabela}]: Conectada e pronta! Total de registros: ${count ?? 0}`);
      }
    } catch (err: any) {
      console.log(`❌ [${tabela}]: Erro de rede: ${err.message}`);
    }
  }

  // Testa buckets do Storage
  console.log('\nVerificando Buckets de Storage:');
  try {
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    if (bError) {
      console.log('⚠️ Storage listBuckets:', bError.message);
    } else {
      console.log('✅ Buckets encontrados:', buckets?.map(b => b.name).join(', ') || 'Nenhum bucket criado ainda');
    }
  } catch (e: any) {
    console.log('⚠️ Erro ao verificar storage:', e.message);
  }
}

testarConexao();
