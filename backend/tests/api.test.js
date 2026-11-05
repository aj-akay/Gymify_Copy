import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import vercelApi from '../../api/[...path].js';

const app = vercelApi;
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

test('health endpoint responds with a consistent success envelope', async () => {
  const response = await fetch(apiUrl('/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { status: 'ok' } });
});

test('gym listings include all six seeded records with related data', async () => {
  const response = await fetch(apiUrl('/gyms'));
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.length, 6);
  assert.equal(data[0].id, 'forge-fitness');
  assert.equal(data[0].sample, true);
  assert.ok(data[0].equipment.includes('Squat racks'));
  assert.ok(data[0].amenities.includes('Lockers'));
  assert.equal(data[0].contactUrl, null);
});

test('gym search, budget, and equipment filters combine with AND semantics', async () => {
  const response = await fetch(apiUrl('/gyms?q=strength&budget=1200&equipment=Free%20weights&amenities=Parking'));
  const { data } = await response.json();
  assert.deepEqual(data.map((gym) => gym.id), ['forge-fitness', 'everyday-strength', 'iron-yard']);
});

test('price sorting and featured filtering preserve deterministic results', async () => {
  const response = await fetch(apiUrl('/gyms?featured=true&sort=low'));
  const { data } = await response.json();
  assert.deepEqual(data.map((gym) => gym.id), ['everyday-strength', 'forge-fitness', 'district-athletics']);
});

test('gym detail returns the record for its slug', async () => {
  const response = await fetch(apiUrl('/gyms/forge-fitness'));
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.name, 'Forge Fitness Club');
  assert.equal(data.monthly, 1200);
});

test('filter options are read from the equipment and amenity catalogues', async () => {
  const response = await fetch(apiUrl('/gyms/options'));
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.equipment, ['Cable machines', 'Cardio machines', 'Free weights', 'Kettlebells', 'Squat racks']);
  assert.deepEqual(data.amenities, ['Air conditioning', 'Lockers', 'Parking', 'Showers']);
});

test('unknown gyms and routes return structured 404 errors', async () => {
  const gymResponse = await fetch(apiUrl('/gyms/not-a-gym'));
  assert.equal(gymResponse.status, 404);
  assert.deepEqual(await gymResponse.json(), {
    error: { code: 'GYM_NOT_FOUND', message: 'No gym was found with that ID.' },
  });

  const routeResponse = await fetch(apiUrl('/unknown'));
  assert.equal(routeResponse.status, 404);
  assert.equal((await routeResponse.json()).error.code, 'NOT_FOUND');
});

test('invalid filters, methods, and unconfigured browser origins are rejected', async () => {
  const invalidFilter = await fetch(apiUrl('/gyms?sort=nearest'));
  assert.equal(invalidFilter.status, 400);
  assert.equal((await invalidFilter.json()).error.code, 'INVALID_QUERY');

  const unsupportedMethod = await fetch(apiUrl('/gyms'), { method: 'POST' });
  assert.equal(unsupportedMethod.status, 405);

  const blockedOrigin = await fetch(apiUrl('/gyms'), { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(blockedOrigin.status, 403);
});

test('same-origin deployments do not require a CORS allowlist', async () => {
  const host = `127.0.0.1:${server.address().port}`;
  const response = await fetch(apiUrl('/health'), {
    headers: { Origin: `http://${host}` },
  });
  assert.equal(response.status, 200);

  const wrongScheme = await fetch(apiUrl('/health'), {
    headers: { Origin: `https://${host}` },
  });
  assert.equal(wrongScheme.status, 403);
});
