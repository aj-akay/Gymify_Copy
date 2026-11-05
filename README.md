# GYMIFY

Responsive gym-discovery app for Naga City, Philippines. The React/Vite frontend reads illustrative, read-only gym listings from a Node.js API. The API uses bundled sample data, so the complete app can deploy as one Vercel project without a database service.

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

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). In development, Vite proxies `/api` requests to the backend on port `4000`, so `VITE_API_BASE_URL` can remain blank.

## Backend

The backend is a read-only Express API. The Vercel function in `api/` and the local Express server use the same bundled sample catalogue and endpoints:

- `GET /api/v1/health`
- `GET /api/v1/gyms`
- `GET /api/v1/gyms/options`
- `GET /api/v1/gyms/:id`

Gym listing filters include `q`, `budget`, repeated `equipment` and `amenities`, `sort=featured|low|high`, `featured=true|false`, and repeated or comma-separated `ids`. Selected equipment and amenities use AND matching.

From the backend directory, run API tests with:

```sh
npm test
```

For direct backend setup and the complete endpoint reference, see [backend/README.md](./backend/README.md).

## Deploy frontend and API together to Vercel

The root project is configured for a single Vercel deployment: Vercel builds the Vite frontend and serves the Express API from `api/[...path].js` at the same origin. No Render service, SQLite file, database integration, CORS setup, or `VITE_API_BASE_URL` variable is needed.

1. Push the repository to GitHub and import it in Vercel.
2. Keep the project root at `./`, select **Vite** if prompted, and deploy with the default install/build settings (`pnpm build`, output directory `dist`).
3. Open the Vercel deployment URL. The frontend calls `/api/v1` on that same domain; check `/api/v1/health` to verify the API.

The current catalogue contains only six read-only sample gyms, so it is bundled with the API. To update those samples, edit `backend/src/data/sample-gyms.js` and redeploy. This approach does not persist data changes or support user-submitted listings; add a managed database such as Postgres when the app needs dynamic records.

## Deploy frontend to GitHub Pages

The `.github/workflows/deploy-pages.yml` workflow builds the app with the repository subpath and hash-based routes, then publishes it to GitHub Pages. This avoids blank pages from root-relative asset paths and supports refreshing nested routes.

1. In GitHub, open the repository **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_API_BASE_URL` with the Vercel deployment URL ending in `/api/v1` (for example `https://your-project.vercel.app/api/v1`).
3. Go to **Actions**, enable workflows if asked, and run **Deploy to GitHub Pages** (or push a commit to `main`).
4. Open `https://aj-akay.github.io/Gymify_Copy/`. The routes use a `#`, such as `/Gymify_Copy/#/gyms`.
5. In Vercel project **Settings → Environment Variables**, set `CORS_ORIGINS` to `http://localhost:5173,https://aj-akay.github.io` and redeploy.

GitHub Pages hosts only the static frontend; it does not run the Express API. Set the Actions variable `VITE_API_BASE_URL` to a separately hosted API URL ending in `/api/v1` to load listings there.

## Frontend build and preview

```sh
npm run build
npm run preview
```

For local development, leave `VITE_API_BASE_URL` blank; Vite proxies API requests to the local backend. Vercel production builds use the same-origin `/api/v1` route by default. GitHub Pages builds require a separately hosted API URL.

## Data and scope

Gym names, locations, rates, hours, and photos are illustrative. No gym contacts, booking, payments, authentication, user profiles, or listing-management screens are part of the current UI, so the API does not expose write or account endpoints. Add verified data and an appropriate owner/admin workflow before accepting real listings or enabling management operations.

## Account and inquiry frontend (backend handoff)

Public gym browsing stays available without an account. Comparing and saving gyms now require sign-in. Login/signup/recovery screens and saved-gym UI are prepared for the team's API. The owner partnership page contains a basic inquiry form. Both integrations are **off by default** and explicitly labeled as previews until backend endpoints exist. The existing read-only backend is unchanged.

See [docs/FRONTEND_API.md](docs/FRONTEND_API.md) for the proposed endpoints, response shapes, feature flags, and integration checklist. The gym catalogue API remains read-only; member and inquiry APIs are not implemented. The former hosted-form URL setting is superseded by the inline inquiry form.

### Change spacing yourself

Search `CUSTOMIZE SPACING HERE` in `src/styles.css`:

- `--page-gutter`: horizontal space beside the main content.
- `--page-space`: space above and below inner pages.
- `--card-padding`: space inside gym cards, including the Save action.
- `--panel-padding`: padding inside account and inquiry panels.
- `--field-padding`: padding inside form inputs.
- `--form-gap`: distance between form fields.

For example, increase `--panel-padding` from `clamp(22px, 4vw, 40px)` to `clamp(26px, 4vw, 48px)`. The smallest number applies on narrow screens and the largest caps desktop padding. Layout-specific gaps still live in their named CSS classes. Save while the Vite server runs to see changes.
