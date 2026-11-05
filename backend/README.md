# GYMIFY API

Read-only REST API for the gym discovery, directory, detail, and comparison screens in the GYMIFY frontend. The backend uses Express and `better-sqlite3`. It requires Node.js 20.19 or newer.

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

The API listens on `http://localhost:4000` by default. It creates the SQLite database, applies pending SQL migrations, and seeds the six sample gyms on first start. The `data/` directory is ignored by Git.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins allowed to call the API |
| `GYMIFY_DATABASE_PATH` | `backend/data/gymify.sqlite` | SQLite database file; relative paths resolve from the backend working directory |

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

Returns alphabetized equipment and amenity values from their database catalogues for the directory filter controls.

### `GET /gyms/:id`

Returns one gym by its slug. Returns `404` with error code `GYM_NOT_FOUND` if the slug is unknown.

Invalid filters return `400`; unsupported HTTP methods return `405`; unconfigured browser origins return `403`. Database failures are logged on the server and return a generic `500` response.

## Database

Schema migration: `database/migrations/001-initial.sql`. SQLite foreign keys are enabled. The schema contains:

- `gyms`: core listing information and display order.
- `equipment` and `amenities`: unique names for reusable catalogue values.
- `gym_equipment` and `gym_amenities`: composite-key join tables with foreign keys.

Sample seed records are maintained in `src/data/sample-gyms.js`. Existing databases are not reseeded or overwritten on restart. Schema changes should be made in a new, incrementally numbered migration and applied before seeding or serving requests.

## Tests

```sh
npm test
```

Tests use Node's built-in test runner, an in-memory SQLite database, and a local ephemeral HTTP port. They cover seeded records, filters, sorting, gym detail, error responses, methods, and CORS.

## Deployment note

SQLite is appropriate for local development and a small persistent-volume host. Do not use the default file database on an ephemeral or serverless filesystem; use persistent disk or migrate to a managed relational database before production deployment. Set `CORS_ORIGINS` to the exact HTTPS frontend origin and provide the frontend's `VITE_API_BASE_URL` at build time.

For a demo deployment, the repository's `render.yaml` configures a free Render web service. Its ephemeral disk is acceptable only for the existing read-only sample listings, which are seeded again when the service starts. Configure `CORS_ORIGINS` with the deployed frontend's exact origin in Render and set the Vercel build variable `VITE_API_BASE_URL` to the Render API URL ending in `/api/v1`. Do not store user-submitted or important data in this SQLite deployment.
