import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonError, jsonResponse, preflightResponse } from '../../../lib/cache';

interface PublicAuthEnv {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  DISCORD_REDIRECT_URI?: string;
}

export const onRequest: PagesFunction<PublicAuthEnv> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  const supabaseUrl = env.PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration for auth config endpoint');
    return jsonError('Supabase configuration is missing.', 500);
  }

  const payload: Record<string, unknown> = {
    supabaseUrl,
    supabaseAnonKey,
  };

  if (env.DISCORD_REDIRECT_URI) {
    payload.discordRedirectUri = env.DISCORD_REDIRECT_URI;
  }

  return jsonResponse(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
};
