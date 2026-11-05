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

## Deploy frontend and API

The repository includes a Render Blueprint in `render.yaml` for the API. To publish the site:

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**, select this GitHub repository, and deploy the `gymify-api` service defined in `render.yaml`. Copy its public URL, for example `https://gymify-api.onrender.com`.
3. In Vercel, import the same GitHub repository. Keep the project root at `./`, use `npm run build` (or `pnpm build`) as the build command, and `dist` as the output directory.
4. In Vercel project **Settings → Environment Variables**, add `VITE_API_BASE_URL` with the Render URL plus `/api/v1` (for example `https://gymify-api.onrender.com/api/v1`) for Production. Add it for Preview too if you use preview deployments, then redeploy.
5. After Vercel assigns the frontend URL, open the Render service **Environment** settings and set `CORS_ORIGINS` to `http://localhost:5173,https://your-project.vercel.app` (replace the example domain with the exact Vercel domain). Save and redeploy/restart the API.
6. Check `https://your-api.onrender.com/api/v1/health` and `https://your-project.vercel.app`. The site should show the seeded sample gyms.

The first request to a free Render service may take a little while if it has been idle. This setup is for the current read-only sample listings: Render's free filesystem is temporary, so the SQLite database can be recreated on restart and seeded again. Do not use this deployment to store important or user-submitted data without moving to persistent database storage.

## Frontend build and preview

```sh
npm run build
npm run preview
```

For local development, leave `VITE_API_BASE_URL` blank; Vite proxies API requests to the local backend. Production builds require the deployed HTTPS API URL and show a clear configuration error if it is missing rather than silently requesting `localhost`.

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
