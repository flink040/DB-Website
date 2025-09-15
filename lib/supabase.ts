import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseClient(env?: SupabaseEnv): SupabaseClient {
  const SUPABASE_URL = env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = env?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration is missing.');
  }

  const cacheKey = `${SUPABASE_URL}:${SUPABASE_ANON_KEY}`;
  let client = clientCache.get(cacheKey);

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: {
        headers: {
          'x-client-info': 'cloudflare-pages-functions',
        },
      },
    });

    clientCache.set(cacheKey, client);
  }

  return client;
}
