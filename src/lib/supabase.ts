import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@config/app.config';

const { url, serviceRoleKey } = config.supabase;

export const supabaseAdmin: SupabaseClient | null =
  url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
