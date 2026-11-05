# GYMIFY API

Read-only REST API for the gym discovery, directory, detail, and comparison screens in the GYMIFY frontend. The backend uses Express and the bundled sample catalogue, and requires Node.js 20.19 or newer.

All seeded gyms are clearly marked sample listings. The API is public and read-only because the current frontend has no account, login, or gym-management workflow.

## Run locally

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
cd backend
npm install
npm run dev
```

Or, from this directory:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default and serves the six sample gyms from `src/data/sample-gyms.js`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed to call the API |

Use `backend/.env.example` as the environment template. Do not commit `.env` files.

## API

Base URL: `/api/v1`. Responses use `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "..." } }` on errors. Only read operations are currently exposed.

### `GET /health`

Returns `{ "data": { "status": "ok" } }`.

### `GET /gyms`

Returns gym objects with the frontend's existing fields: `id`, `name`, `area`, `address`, `monthly`, `day`, `category`, `description`, `equipment`, `amenities`, `hours`, `image`, `featured`, `sample`, and `contactUrl`.

Optional query parameters:

| Parameter | Behavior |
|---|---|
| `q` | Case-insensitive substring search across gym name, neighborhood, and category; max 100 characters |
| `budget` | Maximum monthly rate, whole number from 0 to 100000 |
| `equipment` | Exact equipment name; repeat for multiple AND-matched filters |
| `amenities` | Exact amenity name; repeat for multiple AND-matched filters |
| `sort` | `featured` (default), `low`, or `high`; ties preserve seeded order |
| `featured` | Filter with `true` or `false` |
| `ids` | One or more gym slugs, repeated or comma-separated |

Example:

```text
GET /api/v1/gyms?q=strength&budget=1500&equipment=Free%20weights&amenities=Parking&sort=low
```

### `GET /gyms/options`

Returns alphabetized equipment and amenity values from the sample catalogue for the directory filter controls.

### `GET /gyms/:id`

Returns one gym by its slug. Returns `404` with error code `GYM_NOT_FOUND` if the slug is unknown.

Invalid filters return `400`; unsupported HTTP methods return `405`; unconfigured browser origins return `403`. Database failures are logged on the server and return a generic `500` response.

## Tests

```sh
npm test
```

Tests use Node's built-in test runner and a local ephemeral HTTP port. They cover sample records, filters, sorting, gym detail, error responses, methods, and same-origin/CORS behavior.

## Deployment

The root `api/[...path].js` function serves this API on Vercel alongside the Vite frontend. Both use the same bundled sample catalogue, so a deployment does not require a database or separate API host. The catalogue is read-only and changes only when the code is redeployed. If gyms later need to be created or edited at runtime, migrate the catalogue to managed Postgres before adding write endpoints.
