import type { PagesFunction } from '@cloudflare/workers-types';
import { getSupabaseClient, type SupabaseEnv } from '../../lib/supabase';
import {
  jsonError,
  preflightResponse,
  withCache,
  type CacheEnv,
} from '../../lib/cache';

interface Item {
  id: string;
  name: string;
  type: string;
  rarity: string;
  released_at: string;
  [key: string]: unknown;
}

type Env = SupabaseEnv & CacheEnv;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseLimit = (value: string | null): number => {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

interface Cursor {
  releasedAt?: string;
  id?: string;
}

const parseCursor = (value: string | null): Cursor | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split('|', 2);
  const cursor: Cursor = {};

  const first = parts[0];
  if (first) {
    if (!Number.isNaN(Date.parse(first))) {
      cursor.releasedAt = first;
    } else {
      cursor.id = first;
    }
  }

  const second = parts[1];
  if (second) {
    cursor.id = second;
  }

  if (!cursor.releasedAt && !cursor.id) {
    return null;
  }

  return cursor;
};

const buildCursor = (item: Item | undefined): string | null => {
  if (!item) {
    return null;
  }

  if (item.released_at) {
    return `${item.released_at}|${item.id}`;
  }

  return item.id ?? null;
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  return withCache(request, env, async () => {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const cursor = parseCursor(url.searchParams.get('cursor'));

    const supabase = getSupabaseClient(env);

    let query = supabase
      .from('items')
      .select('*')
      .order('released_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (cursor?.releasedAt && cursor?.id) {
      query = query.or(
        `released_at.lt.${cursor.releasedAt},and(released_at.eq.${cursor.releasedAt},id.lt.${cursor.id})`
      );
    } else if (cursor?.releasedAt) {
      query = query.lt('released_at', cursor.releasedAt);
    } else if (cursor?.id) {
      query = query.lt('id', cursor.id);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: { error: error.message },
        status: 500,
        skipCache: true,
      };
    }

    const items: Item[] = data ?? [];

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const overflow = items.pop();
      nextCursor = buildCursor(overflow);
    }

    return {
      data: {
        items,
        nextCursor,
        limit,
      },
    };
  });
};
