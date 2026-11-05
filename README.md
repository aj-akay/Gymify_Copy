# GYMIFY

Responsive gym-discovery app for Naga City, Philippines. The React/Vite frontend reads gym listings from a separately runnable Node.js API backed by SQLite. Listings are seeded sample data, not verified businesses.

## Requirements

- Node.js 20.19 or later.
- npm, or pnpm for the frontend.

## Local development

Install frontend and backend dependencies:

```sh
npm install
npm install --prefix backend
```

Copy the optional local API settings, then start the API and frontend together:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). In development, Vite proxies `/api` requests to the backend on port `4000`, so `VITE_API_BASE_URL` can remain blank. The API initializes and seeds the SQLite database on startup.

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

The existing Vercel configuration serves the frontend as a single-page app; it does not deploy the backend. Deploy the API separately, set its HTTPS URL as `VITE_API_BASE_URL` in the frontend build environment, and configure the API's `CORS_ORIGINS` to the frontend origin. Production builds now show a clear configuration error rather than silently requesting `localhost`. SQLite requires persistent disk storage, so use a persistent-volume host for the API or migrate to a managed relational database before deploying to an ephemeral/serverless runtime.

## Data and scope

Gym names, locations, rates, hours, and photos are illustrative. No gym contacts, booking, payments, authentication, user profiles, or listing-management screens are part of the current UI, so the API does not expose write or account endpoints. Add verified data and an appropriate owner/admin workflow before accepting real listings or enabling management operations.

## Account and inquiry frontend (backend handoff)

Public gym browsing stays available without an account. Comparing and saving gyms now require sign-in. Login/signup/recovery screens and saved-gym UI are prepared for the team's API. The owner partnership page contains a basic inquiry form. Both integrations are **off by default** and explicitly labeled as previews until backend endpoints exist. The existing read-only backend is unchanged.

See [docs/FRONTEND_API.md](docs/FRONTEND_API.md) for the proposed endpoints, response shapes, feature flags, and integration checklist. The former hosted-form URL setting is superseded by the inline inquiry form.

### Change spacing yourself

Search `CUSTOMIZE SPACING HERE` in `src/styles.css`:

- `--page-gutter`: horizontal space beside the main content.
- `--page-space`: space above and below inner pages.
- `--card-padding`: space inside gym cards, including the Save action.
- `--panel-padding`: padding inside account and inquiry panels.
- `--field-padding`: padding inside form inputs.
- `--form-gap`: distance between form fields.

For example, increase `--panel-padding` from `clamp(22px, 4vw, 40px)` to `clamp(26px, 4vw, 48px)`. The smallest number applies on narrow screens and the largest caps desktop padding. Layout-specific gaps still live in their named CSS classes. Save while the Vite server runs to see changes.
