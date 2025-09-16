import type { PagesFunction } from '@cloudflare/workers-types';
import { getSupabaseClient, type SupabaseEnv } from '../../lib/supabase';
import {
  jsonError,
  jsonResponse,
  preflightResponse,
  withCache,
  type CacheEnv,
} from '../../lib/cache';
import { parseLimit } from '../../lib/request-params';

interface Item {
  id: string;
  name: string;
  type: string;
  rarity: string;
  released_at: string;
  [key: string]: unknown;
}

interface ItemsApiEnv {
  ITEMS_API_TOKEN?: string;
}

type Env = SupabaseEnv & CacheEnv & ItemsApiEnv;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface Cursor {
  releasedAt?: string;
  id?: string;
}

type ValidationResult =
  | { data: Record<string, unknown> }
  | { error: string };

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

const extractBearerToken = (header: string | null): string | null => {
  if (!header) {
    return null;
  }

  const trimmed = header.trim();

  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = trimmed.slice('bearer '.length).trim();
  return token || null;
};

const validateNewItemPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const record = payload as Record<string, unknown>;
  const errors: string[] = [];

  const readRequiredString = (value: unknown, field: string): string | null => {
    if (typeof value !== 'string') {
      errors.push(`${field} must be a string.`);
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      errors.push(`${field} must not be empty.`);
      return null;
    }

    return trimmed;
  };

  const name = readRequiredString(record.name, 'name');
  const type = readRequiredString(record.type, 'type');
  const rarity = readRequiredString(record.rarity, 'rarity');

  let releasedAtIso: string | null = null;
  if (typeof record.released_at !== 'string') {
    errors.push('released_at must be an ISO-8601 date string.');
  } else {
    const trimmed = record.released_at.trim();
    if (!trimmed) {
      errors.push('released_at must not be empty.');
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        errors.push('released_at must be a valid date.');
      } else {
        releasedAtIso = parsed.toISOString();
      }
    }
  }

  if (errors.length > 0 || !name || !type || !rarity || !releasedAtIso) {
    return {
      error: `Invalid request body: ${errors.join(' ')}`,
    };
  }

  const sanitized: Record<string, unknown> = {
    name,
    type,
    rarity,
    released_at: releasedAtIso,
  };

  return { data: sanitized };
};

const handlePostRequest = async (request: Request, env: Env): Promise<Response> => {
  const token = env.ITEMS_API_TOKEN;

  if (!token) {
    console.error('ITEMS_API_TOKEN is not configured; refusing POST /api/items request');
    return jsonError(
      'Bitte logge dich ein, bevor du Items zur Datenbank hinzufügst',
      500
    );
  }

  const providedToken = extractBearerToken(request.headers.get('Authorization'));
  if (!providedToken || providedToken !== token) {
    return jsonError('Unauthorized', 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (parseError) {
    console.warn('Failed to parse POST /api/items payload', parseError);
    return jsonError('Invalid JSON body', 400);
  }

  const validationResult = validateNewItemPayload(payload);
  if ('error' in validationResult) {
    console.warn('Validation failed for POST /api/items payload', {
      message: validationResult.error,
    });
    return jsonError(validationResult.error, 400);
  }

  const insertPayload = validationResult.data;

  let supabase;
  try {
    supabase = getSupabaseClient(env);
  } catch (clientError) {
    console.error(
      'Failed to initialise Supabase client for create item request',
      clientError
    );
    return jsonError('Could not connect to the data service.', 500);
  }

  try {
    const response = await supabase
      .from('items')
      .insert([insertPayload])
      .select('*')
      .maybeSingle();

    if (response.error) {
      const { message, details, hint, code } = response.error;
      console.error('Supabase returned an error when inserting an item', {
        message,
        details,
        hint,
        code,
      });
      return jsonError('Failed to create item in the data service.', 500);
    }

    const inserted = (Array.isArray(response.data)
      ? response.data[0]
      : response.data) as Item | null | undefined;

    if (!inserted) {
      console.error('Supabase insert returned no data for POST /api/items');
      return jsonError('Failed to create item in the data service.', 500);
    }

    return jsonResponse(
      { item: inserted },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (insertError) {
    console.error('Unexpected error while inserting item into Supabase', insertError);
    return jsonError('Failed to create item in the data service.', 500);
  }
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (request.method === 'POST') {
    return handlePostRequest(request, env);
  }

  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405);
  }

  return withCache(request, env, async () => {
    const url = new URL(request.url);
    const limit = parseLimit(
      url.searchParams.get('limit'),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const cursor = parseCursor(url.searchParams.get('cursor'));

    console.debug('Processing items request', {
      limit,
      cursor,
    });

    let supabase;
    try {
      supabase = getSupabaseClient(env);
    } catch (clientError) {
      console.error('Failed to initialise Supabase client for items request', clientError);
      return {
        data: { error: 'Could not connect to the data service.' },
        status: 500,
        skipCache: true,
      };
    }

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

    let data: Item[] | null | undefined;
    try {
      const response = await query;
      data = response.data as Item[] | null | undefined;
      if (response.error) {
        const { message, details, hint, code } = response.error;
        console.error('Supabase returned an error when fetching items', {
          message,
          details,
          hint,
          code,
          limit,
          cursor,
        });
        return {
          data: { error: 'Failed to retrieve items from the data service.' },
          status: 500,
          skipCache: true,
        };
      }
    } catch (queryError) {
      console.error('Unexpected error while executing Supabase query for items', queryError);
      return {
        data: { error: 'Failed to retrieve items from the data service.' },
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

    console.debug('Items request succeeded', {
      limit,
      cursor,
      returned: items.length,
      hasNext: Boolean(nextCursor),
    });

    return {
      data: {
        items,
        nextCursor,
        limit,
      },
    };
  });
};
