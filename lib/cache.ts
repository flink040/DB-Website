import type { KVNamespace } from '@cloudflare/workers-types';

export const BROWSER_CACHE_TTL_SECONDS = 60;

export interface CacheEnv {
  ITEM_CACHE?: KVNamespace;
}

interface CacheEntry {
  data: unknown;
  status: number;
}

export interface CachedComputeResult {
  data: unknown;
  status?: number;
  skipCache?: boolean;
}

function applyCorsAndCachingHeaders(headers: Headers): Headers {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, apikey'
  );
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.append('Vary', 'Origin');
  headers.append('Vary', 'Authorization');
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', `public, max-age=${BROWSER_CACHE_TTL_SECONDS}`);
  }
  return headers;
}

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = applyCorsAndCachingHeaders(new Headers(init.headers));
  const body = JSON.stringify(data ?? null);
  return new Response(body, {
    ...init,
    headers,
  });
}

export function jsonError(message: string, status = 400): Response {
  return jsonResponse(
    {
      error: message,
    },
    { status }
  );
}

export function preflightResponse(): Response {
  const headers = applyCorsAndCachingHeaders(new Headers());
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, {
    status: 204,
    headers,
  });
}

export async function withCache(
  request: Request,
  env: CacheEnv,
  compute: () => Promise<CachedComputeResult>
): Promise<Response> {
  const cacheKey = `v1:${request.url}`;
  const namespace = env.ITEM_CACHE;

  if (namespace) {
    try {
      const cached = (await namespace.get(cacheKey, { type: 'json' })) as CacheEntry | null;
      if (cached) {
        return jsonResponse(cached.data, { status: cached.status });
      }
    } catch (error) {
      console.error('Failed to read from KV cache', error);
    }
  }

  const result = await compute();
  const status = result.status ?? 200;

  if (!result.skipCache && namespace && status >= 200 && status < 300) {
    const entry: CacheEntry = { data: result.data, status };
    try {
      await namespace.put(cacheKey, JSON.stringify(entry), {
        expirationTtl: BROWSER_CACHE_TTL_SECONDS,
      });
    } catch (error) {
      console.error('Failed to write to KV cache', error);
    }
  }

  return jsonResponse(result.data, { status });
}
