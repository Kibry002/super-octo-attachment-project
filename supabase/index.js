import supabase, {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from '../scripts/supabase-config.js';

export { SUPABASE_URL, SUPABASE_ANON_KEY, supabase };
export * from '../scripts/auth.js';
