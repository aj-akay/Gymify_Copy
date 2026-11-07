import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

const app = createApp({ logger: { error() {} } });
let server;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
});

after(async () => {
  server.close();
  await once(server, 'close');
});

function apiUrl(path) {
  return `http://127.0.0.1:${server.address().port}/api/v1${path}`;
}

test('health endpoint responds without requiring paid service credentials', async () => {
  const response = await fetch(apiUrl('/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { status: 'ok' } });
});

test('authenticated routes reject missing bearer tokens', async () => {
  const response = await fetch(apiUrl('/me'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: 'AUTH_REQUIRED', message: 'Please sign in to continue.' },
  });
});

test('admin routes reject missing bearer tokens', async () => {
  const response = await fetch(apiUrl('/admin/partnership-inquiries'));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('partnership inquiries require consent before database access', async () => {
  const response = await fetch(apiUrl('/partnership-inquiries'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gymName: 'Sample Gym',
      contactName: 'Test User',
      email: 'test@example.com',
      location: 'Naga City',
      consent: false,
    }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'CONSENT_REQUIRED');
});

test('gym query parameters are validated before database access', async () => {
  const response = await fetch(apiUrl('/gyms?sort=nearest'));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_QUERY');
});

test('cross-origin requests are rejected and same-origin requests are allowed', async () => {
  const blocked = await fetch(apiUrl('/health'), {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(blocked.status, 403);

  const origin = `http://127.0.0.1:${server.address().port}`;
  const sameOrigin = await fetch(apiUrl('/health'), { headers: { Origin: origin } });
  assert.equal(sameOrigin.status, 200);
  assert.equal(sameOrigin.headers.get('access-control-allow-origin'), origin);
});

test('unknown routes and unsupported methods use structured API errors', async () => {
  const unknown = await fetch(apiUrl('/missing'));
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, 'NOT_FOUND');

  const unsupported = await fetch(apiUrl('/gyms'), { method: 'POST' });
  assert.equal(unsupported.status, 405);
  assert.equal((await unsupported.json()).error.code, 'METHOD_NOT_ALLOWED');
});
