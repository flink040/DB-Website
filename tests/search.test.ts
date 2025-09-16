import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/search';
import * as supabase from '@supabase/supabase-js';

const supabaseStub: any = supabase;

let envCounter = 0;

interface TestEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  [key: string]: unknown;
}

const createEnv = (overrides: Partial<TestEnv> = {}) => {
  envCounter += 1;
  const env: TestEnv = {
    SUPABASE_URL: `https://stub-search-${envCounter}.supabase.co`,
    SUPABASE_ANON_KEY: `anon-key-search-${envCounter}`,
    ...overrides,
  };
  const cacheKey = `${env.SUPABASE_URL}:${env.SUPABASE_ANON_KEY}`;
  supabaseStub.__resetSupabaseState(cacheKey);
  return { env, cacheKey };
};

const createRequest = (path: string, init?: any) =>
  new Request(`https://example.com${path}`, init);

test('search API returns CORS headers for OPTIONS requests', async () => {
  const request = createRequest('/api/search', { method: 'OPTIONS' });
  const response = await onRequest({ request, env: {} } as any);

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('Access-Control-Allow-Methods'),
    'GET, POST, OPTIONS'
  );
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('search API requires the "q" query parameter', async () => {
  const request = createRequest('/api/search', { method: 'GET' });
  const response = await onRequest({ request, env: {} } as any);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: 'Query parameter "q" is required' });
});

test('search API rejects unsupported HTTP methods', async () => {
  const request = createRequest('/api/search', { method: 'POST' });
  const response = await onRequest({ request, env: {} } as any);
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.deepEqual(body, { error: 'Method not allowed' });
});

test('search API returns a helpful error when Supabase configuration is missing', async () => {
  const request = createRequest('/api/search?q=legendary', { method: 'GET' });
  const response = await onRequest({ request, env: {} } as any);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: 'Could not connect to the data service.' });
});

test('search API falls back to the default limit when the parameter is invalid', async () => {
  const { env, cacheKey } = createEnv();
  supabaseStub.__queueResponse(cacheKey, { data: [] });

  const request = createRequest('/api/search?q=legendary&limit=not-a-number');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.limit, 20);

  const lastQuery = supabaseStub.__getLastQuery(cacheKey);
  if (!lastQuery) {
    throw new Error('Expected Supabase query to be recorded');
  }

  assert.equal(lastQuery.table, 'items');
  const limitStep = lastQuery.steps.find((step: any) => step[0] === 'limit');
  assert.deepEqual(limitStep, ['limit', 20]);
});

test('search API handles Supabase errors gracefully', async () => {
  const { env, cacheKey } = createEnv();
  supabaseStub.__queueResponse(cacheKey, {
    data: null,
    error: {
      message: 'search failed',
      details: 'invalid query',
      hint: 'check filters',
      code: '400',
    },
  });

  const request = createRequest('/api/search?q=legendary&type=weapon&rarity=rare');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    error: 'Failed to retrieve search results from the data service.',
  });
});

test('search API returns search results from Supabase', async () => {
  const { env, cacheKey } = createEnv();
  const supabaseItems = [
    {
      id: 'item-1',
      name: 'Sword of Testing',
      type: 'weapon',
      rarity: 'rare',
      released_at: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 'item-2',
      name: 'Axe of Assertions',
      type: 'weapon',
      rarity: 'legendary',
      released_at: '2023-01-02T00:00:00.000Z',
    },
  ];

  supabaseStub.__queueResponse(cacheKey, { data: supabaseItems });

  const request = createRequest('/api/search?q=test');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.limit, 20);
  assert.deepEqual(body.query, 'test');
  assert.deepEqual(body.filters, { type: null, rarity: null });
  assert.deepEqual(
    body.items.map((item: any) => item.id),
    ['item-1', 'item-2']
  );
  assert.equal(body.count, 2);
});
