import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export interface SupabaseClientOptions {
  accessToken?: string;
}

export type SupabaseClientFactory = typeof createClient;

const clientCache = new Map<string, SupabaseClient>();
let createClientFactory: SupabaseClientFactory = createClient;

export function __setSupabaseClientFactory(factory: SupabaseClientFactory): void {
  createClientFactory = factory;
  clientCache.clear();
}

export function __resetSupabaseClientFactory(): void {
  createClientFactory = createClient;
  clientCache.clear();
}

const buildClient = (
  url: string,
  anonKey: string,
  { accessToken }: SupabaseClientOptions = {}
): SupabaseClient => {
  const headers: Record<string, string> = {
    'x-client-info': 'cloudflare-pages-functions',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return createClientFactory(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers,
    },
  });
};

export function getSupabaseClient(
  env?: SupabaseEnv,
  options: SupabaseClientOptions = {}
): SupabaseClient {
  const SUPABASE_URL = env?.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = env?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration is missing.');
  }

  if (options.accessToken) {
    return buildClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
  }

  const cacheKey = `${SUPABASE_URL}:${SUPABASE_ANON_KEY}`;
  let client = clientCache.get(cacheKey);

  if (!client) {
    client = buildClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    clientCache.set(cacheKey, client);
  }

  return client;
}
