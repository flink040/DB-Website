import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  SUPABASE_URL: https://taejvzqmlswbgsknthxz.supabase.co;
  SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZWp2enFtbHN3Ymdza250aHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNTE3NjIsImV4cCI6MjA3MjkyNzc2Mn0.nFWly256mUiFAvAEWdvLA9n_DaNXOnV3MtMLXmHIKGc;
}

const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseClient(env: SupabaseEnv): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;

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
