import type { PagesFunction } from '@cloudflare/workers-types';
import { getSupabaseClient, type SupabaseEnv } from '../../lib/supabase';
import {
  jsonError,
  preflightResponse,
  withCache,
  type CacheEnv,
} from '../../lib/cache';
import { parseLimit } from '../../lib/request-params';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type Env = SupabaseEnv & CacheEnv;

const escapeForILike = (value: string): string =>
  value.replace(/[%_]/g, (match) => `\\${match}`);

interface Item {
  id: string;
  name: string;
  type: string;
  rarity: string;
  released_at: string;
  [key: string]: unknown;
}

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

  const limit = parseLimit(
    url.searchParams.get('limit'),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const typeFilter = url.searchParams.get('type')?.trim() || null;
  const rarityFilter = url.searchParams.get('rarity')?.trim() || null;

  return withCache(request, env, async () => {
    let supabase;
    try {
      supabase = getSupabaseClient(env);
    } catch (clientError) {
      console.error(
        'Failed to initialise Supabase client for search request',
        clientError
      );
      return {
        data: { error: 'Could not connect to the data service.' },
        status: 500,
        skipCache: true,
      };
    }

    const filters = {
      type: typeFilter,
      rarity: rarityFilter,
    };

    console.debug('Processing search request', {
      query: q,
      limit,
      filters,
    });

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

    try {
      const response = await query;
      const data = response.data as Item[] | null | undefined;

      if (response.error) {
        const { message, details, hint, code } = response.error;
        console.error('Supabase returned an error when searching items', {
          message,
          details,
          hint,
          code,
          query: q,
          limit,
          filters,
        });
        return {
          data: {
            error: 'Failed to retrieve search results from the data service.',
          },
          status: 500,
          skipCache: true,
        };
      }

      const items: Item[] = data ?? [];

      console.debug('Search request succeeded', {
        query: q,
        limit,
        returned: items.length,
        filters,
      });

      return {
        data: {
          query: q,
          limit,
          filters,
          items,
          count: items.length,
        },
      };
    } catch (queryError) {
      console.error(
        'Unexpected error while executing Supabase search query',
        queryError
      );
      return {
        data: {
          error: 'Failed to retrieve search results from the data service.',
        },
        status: 500,
        skipCache: true,
      };
    }
  });
};
