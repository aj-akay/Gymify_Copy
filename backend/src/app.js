import express from 'express';
import { getGymById, getGymFilterOptions, listGyms, openDatabase } from './database.js';

const API_PREFIX = '/api/v1';

class RequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseList(parameters, key, maxItems) {
  const values = parameters.getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length > maxItems) {
    throw new RequestError(400, 'INVALID_QUERY', `Use no more than ${maxItems} ${key} values.`);
  }
  return [...new Set(values)];
}

function parseGymFilters(parameters) {
  const allowed = new Set(['q', 'budget', 'equipment', 'amenities', 'sort', 'featured', 'ids']);
  for (const key of parameters.keys()) {
    if (!allowed.has(key)) throw new RequestError(400, 'INVALID_QUERY', `Unknown query parameter: ${key}.`);
  }

  const query = parameters.get('q')?.trim() || '';
  if (query.length > 100) {
    throw new RequestError(400, 'INVALID_QUERY', 'Search text must be 100 characters or fewer.');
  }

  const budgetValue = parameters.get('budget');
  let budget;
  if (budgetValue !== null) {
    budget = Number(budgetValue);
    if (!budgetValue.trim() || !Number.isSafeInteger(budget) || budget < 0 || budget > 100000) {
      throw new RequestError(400, 'INVALID_QUERY', 'Budget must be a whole number between 0 and 100000.');
    }
  }

  const sort = parameters.get('sort') || 'featured';
  if (!['featured', 'low', 'high'].includes(sort)) {
    throw new RequestError(400, 'INVALID_QUERY', 'Sort must be featured, low, or high.');
  }

  const featuredValue = parameters.get('featured');
  if (featuredValue !== null && featuredValue !== 'true' && featuredValue !== 'false') {
    throw new RequestError(400, 'INVALID_QUERY', 'Featured must be true or false.');
  }

  const ids = parseList(parameters, 'ids', 6);
  if (ids.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
    throw new RequestError(400, 'INVALID_QUERY', 'Gym IDs must be lowercase slugs.');
  }

  return {
    query,
    budget,
    equipment: parseList(parameters, 'equipment', 20),
    amenities: parseList(parameters, 'amenities', 20),
    sort,
    featured: featuredValue === null ? undefined : featuredValue === 'true',
    ids: ids.length ? ids : undefined,
  };
}

function sendError(response, status, code, message) {
  response.status(status).json({ error: { code, message } });
}

export function createApp({
  database = openDatabase(),
  corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  logger = console,
} = {}) {
  const app = express();
  const allowedOrigins = new Set(corsOrigins);
  app.disable('x-powered-by');

  app.use((request, response, next) => {
    const origin = request.get('Origin');
    if (origin && !allowedOrigins.has(origin)) {
      sendError(response, 403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.');
      return;
    }
    if (origin) {
      response.set('Access-Control-Allow-Origin', origin);
      response.vary('Origin');
    }
    response.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  });

  app.get(`${API_PREFIX}/health`, (_request, response) => {
    response.json({ data: { status: 'ok' } });
  });

  app.get(`${API_PREFIX}/gyms`, (request, response) => {
    const parameters = new URL(request.originalUrl, 'http://localhost').searchParams;
    response.json({ data: listGyms(database, parseGymFilters(parameters)) });
  });

  app.get(`${API_PREFIX}/gyms/options`, (request, response) => {
    if (request.query && Object.keys(request.query).length > 0) {
      throw new RequestError(400, 'INVALID_QUERY', 'The filters endpoint does not accept query parameters.');
    }
    response.json({ data: getGymFilterOptions(database) });
  });

  app.get(`${API_PREFIX}/gyms/:id`, (request, response) => {
    const gym = getGymById(database, request.params.id);
    if (!gym) {
      sendError(response, 404, 'GYM_NOT_FOUND', 'No gym was found with that ID.');
      return;
    }
    response.json({ data: gym });
  });

  app.use((request, response, next) => {
    if (request.method === 'GET') {
      sendError(response, 404, 'NOT_FOUND', 'The requested API route was not found.');
      return;
    }
    const isKnownRoute = request.path === `${API_PREFIX}/health`
      || request.path === `${API_PREFIX}/gyms`
      || request.path === `${API_PREFIX}/gyms/options`
      || /^\/api\/v1\/gyms\/[^/]+$/.test(request.path);
    if (isKnownRoute) {
      response.set('Allow', 'GET, OPTIONS');
      sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported.');
      return;
    }
    next();
  });

  app.use((_request, response) => {
    sendError(response, 404, 'NOT_FOUND', 'The requested API route was not found.');
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof RequestError) {
      sendError(response, error.status, error.code, error.message);
      return;
    }
    logger.error('Unhandled API error:', error);
    sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
  });

  return app;
}
