import type { PagesFunction } from '@cloudflare/workers-types';
import { getSupabaseClient, type SupabaseEnv } from '../../../lib/supabase';
import {
  jsonError,
  preflightResponse,
  withCache,
  type CacheEnv,
} from '../../../lib/cache';

type Env = SupabaseEnv & CacheEnv;

interface ItemWithRelations {
  id: string;
  name: string;
  type: string;
  rarity: string;
  released_at: string;
  [key: string]: unknown;
  item_enchantments?: Array<{ enchantments?: Record<string, unknown> | null } | null>;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  const id = typeof params?.id === 'string' ? params.id : null;

  if (!id) {
    return jsonError('Item id is required', 400);
  }

  return withCache(request, env, async () => {
    const supabase = getSupabaseClient(env);

    const { data, error } = await supabase
      .from('items')
      .select(
        `*,
        item_enchantments (
          enchantments (*)
        )`
      )
      .eq('id', id)
      .maybeSingle<ItemWithRelations>();

    if (error) {
      return {
        data: { error: error.message },
        status: 500,
        skipCache: true,
      };
    }

    if (!data) {
      return {
        data: { error: 'Item not found' },
        status: 404,
        skipCache: true,
      };
    }

    const enchantments = (data.item_enchantments ?? [])
      .map((relation) => relation?.enchantments ?? null)
      .filter((enchantment): enchantment is Record<string, unknown> => Boolean(enchantment));

    const { item_enchantments, ...item } = data;

    return {
      data: {
        item: {
          ...item,
          enchantments,
        },
      },
    };
  });
};
