import test from 'node:test';
import assert from 'node:assert/strict';
import * as supabase from '@supabase/supabase-js';
import { onRequest } from '../functions/api/items';

const supabaseStub: any = supabase;

let envCounter = 0;

const createEnv = () => {
  envCounter += 1;
  const env = {
    SUPABASE_URL: `https://stub-${envCounter}.supabase.co`,
    SUPABASE_ANON_KEY: `anon-key-${envCounter}`,
  };
  const cacheKey = `${env.SUPABASE_URL}:${env.SUPABASE_ANON_KEY}`;
  supabaseStub.__resetSupabaseState(cacheKey);
  return { env, cacheKey };
};

const createRequest = (path: string, init?: any) =>
  new Request(`https://example.com${path}`, init);

test('items API returns CORS headers for OPTIONS requests', async () => {
  const { env } = createEnv();
  const request = createRequest('/api/items', { method: 'OPTIONS' });
  const response = await onRequest({ request, env } as any);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('items API falls back to the default limit when the parameter is invalid', async () => {
  const { env, cacheKey } = createEnv();
  supabaseStub.__queueResponse(cacheKey, { data: [] });

  const request = createRequest('/api/items?limit=not-a-number');
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
  assert.deepEqual(limitStep, ['limit', 21]);
});

test('items API caps the limit to the configured maximum', async () => {
  const { env, cacheKey } = createEnv();
  supabaseStub.__queueResponse(cacheKey, { data: [] });

  const request = createRequest('/api/items?limit=500');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.limit, 100);

  const lastQuery = supabaseStub.__getLastQuery(cacheKey);
  if (!lastQuery) {
    throw new Error('Expected Supabase query to be recorded');
  }
  const limitStep = lastQuery.steps.find((step: any) => step[0] === 'limit');
  assert.deepEqual(limitStep, ['limit', 101]);
});

test('items API applies composite cursor filtering when both released_at and id are provided', async () => {
  const { env, cacheKey } = createEnv();
  supabaseStub.__queueResponse(cacheKey, { data: [] });

  const cursor = '2023-03-01T12:00:00.000Z|item-42';
  const request = createRequest(`/api/items?cursor=${encodeURIComponent(cursor)}`);
  const response = await onRequest({ request, env } as any);
  await response.json();

  assert.equal(response.status, 200);

  const lastQuery = supabaseStub.__getLastQuery(cacheKey);
  if (!lastQuery) {
    throw new Error('Expected Supabase query to be recorded');
  }
  const orStep = lastQuery.steps.find((step: any) => step[0] === 'or');
  assert.deepEqual(orStep, [
    'or',
    'released_at.lt.2023-03-01T12:00:00.000Z,and(released_at.eq.2023-03-01T12:00:00.000Z,id.lt.item-42)',
  ]);
});

test('items API ignores cursor values containing only whitespace', async () => {
  const { env, cacheKey } = createEnv();
  supabaseStub.__queueResponse(cacheKey, { data: [] });

  const request = createRequest('/api/items?cursor=%20%20%20');
  const response = await onRequest({ request, env } as any);
  await response.json();

  assert.equal(response.status, 200);

  const lastQuery = supabaseStub.__getLastQuery(cacheKey);
  if (!lastQuery) {
    throw new Error('Expected Supabase query to be recorded');
  }
  const hasCursorFilter = lastQuery.steps.some(
    (step: any) => step[0] === 'lt' || step[0] === 'or'
  );
  assert.equal(hasCursorFilter, false);
});

test('items API returns items and a next cursor from Supabase results', async () => {
  const { env, cacheKey } = createEnv();

  const supabaseItems = [
    {
      id: 'item-3',
      name: 'Item Three',
      type: 'weapon',
      rarity: 'legendary',
      released_at: '2023-03-10T00:00:00.000Z',
    },
    {
      id: 'item-2',
      name: 'Item Two',
      type: 'weapon',
      rarity: 'rare',
      released_at: '2023-03-09T00:00:00.000Z',
    },
    {
      id: 'item-1',
      name: 'Item One',
      type: 'weapon',
      rarity: 'common',
      released_at: '2023-03-08T00:00:00.000Z',
    },
  ];

  supabaseStub.__queueResponse(cacheKey, { data: supabaseItems });

  const request = createRequest('/api/items?limit=2');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.limit, 2);
  assert.deepEqual(
    body.items.map((item: any) => item.id),
    ['item-3', 'item-2']
  );
  assert.equal(body.nextCursor, '2023-03-08T00:00:00.000Z|item-1');
});
