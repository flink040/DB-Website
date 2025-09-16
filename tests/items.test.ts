import test from 'node:test';
import * as assert from 'node:assert/strict';
import * as supabaseStub from './stubs/supabase-js';
import { __setSupabaseClientFactory } from '../lib/supabase';
import { onRequest } from '../functions/api/items';

__setSupabaseClientFactory(supabaseStub.createClient);
supabaseStub.__resetSupabaseState();

let envCounter = 0;

interface TestEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ITEMS_CREATED_BY_COLUMN?: string;
  ITEMS_DISCORD_ID_COLUMN?: string;
  [key: string]: unknown;
}

const createEnv = (overrides: Partial<TestEnv> = {}) => {
  envCounter += 1;
  const env: TestEnv = {
    SUPABASE_URL: `https://stub-${envCounter}.supabase.co`,
    SUPABASE_ANON_KEY: `anon-key-${envCounter}`,
    ITEMS_CREATED_BY_COLUMN: 'created_by_user_id',
    ITEMS_DISCORD_ID_COLUMN: 'created_by_discord_id',
    ...overrides,
  };
  const cacheKey = `${env.SUPABASE_URL}:${env.SUPABASE_ANON_KEY}`;
  supabaseStub.__resetSupabaseState(cacheKey);
  return { env, cacheKey };
};

const createRequest = (path: string, init?: any) =>
  new Request(`https://example.com${path}`, init);

const queueAuthSuccess = (
  cacheKey: string,
  overrides: { userId?: string; discordId?: string } = {}
) => {
  const userId = overrides.userId ?? 'user-123';
  const discordId = overrides.discordId ?? 'discord-456';
  supabaseStub.__queueAuthResponse(cacheKey, {
    data: {
      user: {
        id: userId,
        identities: [
          {
            provider: 'discord',
            identity_data: { id: discordId },
          },
        ],
      },
    },
    error: null,
  });
};

test('items API returns CORS headers for OPTIONS requests', async () => {
  const { env } = createEnv();
  const request = createRequest('/api/items', { method: 'OPTIONS' });
  const response = await onRequest({ request, env } as any);

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('Access-Control-Allow-Methods'),
    'GET, POST, OPTIONS'
  );
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

test('items API returns an error when Supabase credentials are missing for GET requests', async () => {
  const { env } = createEnv({
    SUPABASE_URL: '   ',
    SUPABASE_ANON_KEY: '   ',
  });

  const request = createRequest('/api/items');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: 'Supabase credentials missing' });
});

test('items API returns items and a next cursor from Supabase results', async () => {
  const { env, cacheKey } = createEnv();

  const supabaseItems = [
    {
      id: 'item-3',
      name: 'Item Three',
      type: 'weapon',
      rarity: 'mega-jackpot',
      released_at: '2023-03-10T00:00:00.000Z',
    },
    {
      id: 'item-2',
      name: 'Item Two',
      type: 'weapon',
      rarity: 'legendaer',
      released_at: '2023-03-09T00:00:00.000Z',
    },
    {
      id: 'item-1',
      name: 'Item One',
      type: 'weapon',
      rarity: 'selten',
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

test('items API includes Supabase error messages in GET responses', async () => {
  const { env, cacheKey } = createEnv();

  supabaseStub.__queueResponse(cacheKey, {
    data: [],
    error: { message: '  row level security prevented\naccess  ' },
  });

  const request = createRequest('/api/items');
  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, 'Failed to retrieve items from the data service.');
  assert.equal(body.cause, 'row level security prevented access');
});

test('items API rejects POST requests without a valid bearer token', async () => {
  const { env } = createEnv();

  const request = createRequest('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Unauthorized Item',
      type: 'weapon',
      rarity: 'jackpot',
      released_at: '2024-01-01T00:00:00Z',
    }),
  });

  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Unauthorized');
});

test('items API returns an error when Supabase credentials are missing for POST requests', async () => {
  const { env } = createEnv({ SUPABASE_ANON_KEY: '  ' });

  const request = createRequest('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token',
    },
    body: JSON.stringify({
      name: 'Item',
      type: 'weapon',
      rarity: 'jackpot',
      released_at: '2024-01-01T00:00:00Z',
    }),
  });

  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, 'Supabase credentials missing');
});

test('items API validates POST request payloads', async () => {
  const { env, cacheKey } = createEnv();
  queueAuthSuccess(cacheKey);

  const accessToken = 'valid-access-token';
  const request = createRequest('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: '  ',
      type: 'weapon',
      rarity: 'jackpot',
    }),
  });

  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 400);
  const errorMessage = typeof body.error === 'string' ? body.error : '';
  assert.equal(/Invalid request body/.test(errorMessage), true);
  assert.equal(supabaseStub.__getLastAuthToken(cacheKey), accessToken);
});

test('items API inserts new items via POST requests', async () => {
  const { env, cacheKey } = createEnv();

  const insertedItem = {
    id: 'item-123',
    name: 'Test Item',
    type: 'weapon',
    rarity: 'jackpot',
    released_at: '2024-01-01T00:00:00.000Z',
  };

  queueAuthSuccess(cacheKey, { userId: 'user-abc', discordId: 'discord-xyz' });

  supabaseStub.__queueResponse(cacheKey, { data: insertedItem });

  const accessToken = 'auth-token';
  const request = createRequest('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: '  Test Item  ',
      type: 'weapon',
      rarity: 'jackpot',
      released_at: '2024-01-01T00:00:00Z',
    }),
  });

  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(body.item, insertedItem);
  assert.equal(supabaseStub.__getLastAuthToken(cacheKey), accessToken);

  const lastQuery = supabaseStub.__getLastQuery(cacheKey);
  if (!lastQuery) {
    throw new Error('Expected Supabase query to be recorded');
  }

  const insertStep = lastQuery.steps.find((step: any) => step[0] === 'insert');
  assert.equal(insertStep !== undefined, true, 'Expected insert step to be recorded');
  assert.deepEqual(insertStep[1], [
    {
      name: 'Test Item',
      type: 'weapon',
      rarity: 'jackpot',
      released_at: '2024-01-01T00:00:00.000Z',
      created_by_user_id: 'user-abc',
      created_by_discord_id: 'discord-xyz',
    },
  ]);

  const maybeSingleStep = lastQuery.steps[lastQuery.steps.length - 1];
  assert.deepEqual(maybeSingleStep, ['maybeSingle']);
});

test('items API includes Supabase error messages in POST responses', async () => {
  const { env, cacheKey } = createEnv();

  queueAuthSuccess(cacheKey, { userId: 'user-123', discordId: 'discord-456' });

  supabaseStub.__queueResponse(cacheKey, {
    data: null,
    error: { message: '  duplicate key\nvalue violates constraint  ' },
  });

  const accessToken = 'valid-token';
  const request = createRequest('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Test Item',
      type: 'weapon',
      rarity: 'jackpot',
      released_at: '2024-01-01T00:00:00Z',
    }),
  });

  const response = await onRequest({ request, env } as any);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.error, 'Failed to create item in the data service.');
  assert.equal(body.cause, 'duplicate key value violates constraint');
  assert.equal(supabaseStub.__getLastAuthToken(cacheKey), accessToken);
});
