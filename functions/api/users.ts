import type { PagesFunction } from '@cloudflare/workers-types';
import { jsonError, jsonResponse, preflightResponse } from '../../lib/cache';
import { getSupabaseClient, type SupabaseEnv } from '../../lib/supabase';

interface ProfilePayload {
  userId: string;
  discordId: string | null;
}

interface ProfilesEnv extends SupabaseEnv {
  PROFILES_TABLE?: string;
  PROFILES_USER_ID_COLUMN?: string;
  PROFILES_DISCORD_ID_COLUMN?: string;
}

type Env = ProfilesEnv;

const DEFAULT_TABLE_NAME = 'profiles';
const DEFAULT_USER_ID_COLUMN = 'id';
const DEFAULT_DISCORD_ID_COLUMN = 'discord_id';

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

const parsePayload = async (request: Request): Promise<ProfilePayload | Response> => {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.warn('Failed to parse JSON body for profile sync request', error);
    return jsonError('Request body must be valid JSON.', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError('Request body must be a JSON object.', 400);
  }

  const record = body as Record<string, unknown>;

  const rawUserId = record.userId;
  if (typeof rawUserId !== 'string') {
    return jsonError('userId must be a string.', 400);
  }

  const userId = rawUserId.trim();
  if (!userId) {
    return jsonError('userId must not be empty.', 400);
  }

  let discordId: string | null = null;
  if (record.discordId === null || typeof record.discordId === 'undefined') {
    discordId = null;
  } else if (typeof record.discordId === 'string') {
    const trimmedDiscordId = record.discordId.trim();
    discordId = trimmedDiscordId || null;
  } else {
    return jsonError('discordId must be a string or null.', 400);
  }

  return { userId, discordId };
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const accessToken = extractBearerToken(request.headers.get('Authorization'));
  if (!accessToken) {
    return jsonError('Unauthorized', 401);
  }

  const payloadOrResponse = await parsePayload(request);
  if (payloadOrResponse instanceof Response) {
    return payloadOrResponse;
  }

  const { userId, discordId } = payloadOrResponse;

  let authClient;
  try {
    authClient = getSupabaseClient(env);
  } catch (clientError) {
    console.error('Failed to initialise Supabase client for profile auth lookup', clientError);
    return jsonError('Could not connect to the data service.', 500);
  }

  let supabaseUserId: string | null = null;
  try {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error) {
      console.warn('Supabase rejected provided access token for profile sync', {
        message: error.message,
        status: error.status,
      });
      return jsonError('Unauthorized', 401);
    }
    supabaseUserId = data?.user?.id ?? null;
  } catch (lookupError) {
    console.error('Unexpected error while verifying access token with Supabase', lookupError);
    return jsonError('Could not verify credentials with the data service.', 500);
  }

  if (!supabaseUserId) {
    console.warn('Supabase returned no user for provided access token during profile sync');
    return jsonError('Unauthorized', 401);
  }

  if (supabaseUserId !== userId) {
    console.warn('Received profile sync request for mismatching user ID', {
      expected: supabaseUserId,
      received: userId,
    });
    return jsonError('Forbidden', 403);
  }

  let supabase;
  try {
    supabase = getSupabaseClient(env, { accessToken });
  } catch (clientError) {
    console.error('Failed to initialise Supabase client for profile sync', clientError);
    return jsonError('Could not connect to the data service.', 500);
  }

  const tableName = env.PROFILES_TABLE?.trim() || DEFAULT_TABLE_NAME;
  const userIdColumn = env.PROFILES_USER_ID_COLUMN?.trim() || DEFAULT_USER_ID_COLUMN;
  const discordIdColumn = env.PROFILES_DISCORD_ID_COLUMN?.trim() || DEFAULT_DISCORD_ID_COLUMN;

  const upsertPayload: Record<string, unknown> = { [userIdColumn]: userId };
  if (discordIdColumn) {
    upsertPayload[discordIdColumn] = discordId;
  }

  try {
    const { error } = await supabase.from(tableName).upsert(upsertPayload, {
      onConflict: userIdColumn,
    });

    if (error) {
      const { message, details, hint, code } = error;
      console.error('Supabase returned an error when upserting profile', {
        message,
        details,
        hint,
        code,
      });
      return jsonError('Failed to update profile in the data service.', 500);
    }
  } catch (upsertError) {
    console.error('Unexpected error while upserting profile in Supabase', upsertError);
    return jsonError('Failed to update profile in the data service.', 500);
  }

  return jsonResponse(
    { success: true },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
};
