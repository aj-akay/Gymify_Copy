# GYMIFY

Responsive gym-discovery app for Naga City, Philippines. The React/Vite frontend reads gym listings from a separately runnable Node.js API backed by SQLite. Listings are seeded sample data, not verified businesses.

## Requirements

- Node.js 20.19 or later.
- npm, or pnpm for the frontend.

## Local development

Install the frontend dependencies from the repository root:

```sh
npm install
```

In the first terminal, start the API:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

In a second terminal, start Vite:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Open the local URL printed by Vite. The frontend defaults to `http://localhost:4000/api/v1`; set `VITE_API_BASE_URL` in `.env.local` if the API runs elsewhere. The API permits the Vite origin at `http://localhost:5173` by default; configure `CORS_ORIGINS` in `backend/.env` for another origin.

The backend creates `backend/data/gymify.sqlite`, applies its SQL migration, and seeds the six sample listings on first startup. The database file and environment files are ignored by Git.

## Backend

The backend is an Express API using SQLite. Read-only endpoints serve the features currently present in the frontend:

- `GET /api/v1/health`
- `GET /api/v1/gyms`
- `GET /api/v1/gyms/options`
- `GET /api/v1/gyms/:id`

Gym listing filters include `q`, `budget`, repeated `equipment` and `amenities`, `sort=featured|low|high`, `featured=true|false`, and repeated or comma-separated `ids`. Selected equipment and amenities use AND matching.

From the backend directory, run API tests with:

```sh
npm test
```

For direct backend setup and the complete endpoint and schema reference, see [backend/README.md](./backend/README.md).

## Frontend build and preview

```sh
npm run build
npm run preview
```

The existing Vercel configuration serves the frontend as a single-page app. Deploy the API separately and set its HTTPS URL as `VITE_API_BASE_URL`; configure the API's `CORS_ORIGINS` to the frontend origin. SQLite requires persistent disk storage, so use a persistent-volume host for the API or migrate to a managed relational database before deploying to an ephemeral/serverless runtime.

## Data and scope

Gym names, locations, rates, hours, and photos are illustrative. No gym contacts, booking, payments, authentication, user profiles, or listing-management screens are part of the current UI, so the API does not expose write or account endpoints. Add verified data and an appropriate owner/admin workflow before accepting real listings or enabling management operations.
