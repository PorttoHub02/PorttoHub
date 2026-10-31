/**
 * PorttoHub — Módulo Oficial de Supabase Storage
 * Conecta-se ao bucket 'encomendas' no Supabase Project pkemipwowkcnstbazlma
 */
export {
  SUPABASE_PROJECT_URL as DEFAULT_SUPABASE_URL,
  SUPABASE_ANON_KEY as DEFAULT_SUPABASE_KEY,
  DEFAULT_STORAGE_BUCKET,
  obterSupabaseUrl,
  obterSupabaseKey,
  obterStorageBucket,
  supabaseStorage
} from './supabase';
