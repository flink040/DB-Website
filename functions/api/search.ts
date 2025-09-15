import type { PagesFunction } from '@cloudflare/workers-types';
import { getSupabaseClient, type SupabaseEnv } from '../../lib/supabase';
import {
  jsonError,
  preflightResponse,
  withCache,
  type CacheEnv,
} from '../../lib/cache';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type Env = SupabaseEnv & CacheEnv;

const parseLimit = (value: string | null): number => {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

const escapeForILike = (value: string): string =>
  value.replace(/[%_]/g, (match) => `\\${match}`);

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();

  if (!q) {
    return jsonError('Query parameter "q" is required', 400);
  }

  const limit = parseLimit(url.searchParams.get('limit'));
  const typeFilter = url.searchParams.get('type')?.trim() || null;
  const rarityFilter = url.searchParams.get('rarity')?.trim() || null;

  return withCache(request, env, async () => {
    const supabase = getSupabaseClient(env);

    let query = supabase
      .from('items')
      .select('*')
      .ilike('name', `%${escapeForILike(q)}%`)
      .order('released_at', { ascending: false })
      .limit(limit);

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    if (rarityFilter) {
      query = query.eq('rarity', rarityFilter);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: { error: error.message },
        status: 500,
        skipCache: true,
      };
    }

    const items = data ?? [];

    return {
      data: {
        query: q,
        limit,
        filters: {
          type: typeFilter,
          rarity: rarityFilter,
        },
        items,
        count: items.length,
      },
    };
  });
};
