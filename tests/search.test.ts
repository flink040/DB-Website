import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/search';

test('search API returns CORS headers for OPTIONS requests', async () => {
  const request = new Request('https://example.com/api/search', { method: 'OPTIONS' });
  const response = await onRequest({ request, env: {} } as any);

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('Access-Control-Allow-Methods'),
    'GET, POST, OPTIONS'
  );
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('search API requires the "q" query parameter', async () => {
  const request = new Request('https://example.com/api/search', { method: 'GET' });
  const response = await onRequest({ request, env: {} } as any);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: 'Query parameter "q" is required' });
});

test('search API rejects unsupported HTTP methods', async () => {
  const request = new Request('https://example.com/api/search', { method: 'POST' });
  const response = await onRequest({ request, env: {} } as any);
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.deepEqual(body, { error: 'Method not allowed' });
});
