# GYMIFY API

The Express API serves gym/trainer discovery and authenticated account workflows. It runs locally on Node.js 20.19+ and is also exported as a Vercel serverless function in `api/[...path].js`. Production data/auth are in Supabase Postgres; Stripe handles GYMIFY Premium billing. The API does not use SQLite.

## Local setup

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
corepack pnpm install
corepack pnpm dev
```

Set Supabase values in `backend/.env`; set the browser-visible Supabase URL and anon key in root `.env.local`. `pnpm dev` starts the API on port 4000 and Vite on port 5173. For API tests, run `pnpm backend:test`. Tests use Node's built-in runner and do not require external service credentials.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | Server | Local Express port (defaults to `4000`) |
| `CORS_ORIGINS` | Server | Comma-separated exact browser origins for a separately hosted frontend |
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_ANON_KEY` | Server | Supabase public anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged webhook/database work; never expose to a browser |
| `STRIPE_SECRET_KEY` | Server only | Stripe API access |
| `STRIPE_WEBHOOK_SECRET` | Server only | Verifies webhook signatures |
| `STRIPE_PREMIUM_PRICE_ID` | Server only | Active recurring PHP 175 monthly Price |
| `APP_BASE_URL` | Server | Public app URL for Stripe checkout and portal return URLs |
| `VITE_SUPABASE_URL` | Frontend build | Public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend build | Public Supabase anon/publishable key; RLS must protect all data |
| `VITE_API_BASE_URL` | Frontend build | Leave unset for same-origin Vercel; set to `/api/v1` API origin for other hosts |
| `VITE_INQUIRY_API_ENABLED` | Frontend build | Set to `true` only after inquiry storage and review flow are configured |

Use the root `.env.example` and `backend/.env.example` as templates. Never commit `.env` files or put the service-role key or Stripe secrets in a `VITE_` variable. The browser anon key is public by design.

## Routes

Base path: `/api/v1`. Success responses are `{ "data": ... }`; errors are non-2xx `{ "error": { "code": "...", "message": "..." } }`.

### Public

- `GET /health`
- `GET /gyms`, `GET /gyms/options`, `GET /gyms/:id`
- `GET /trainers`, `GET /trainers/:id` (approved and active profiles only)
- `POST /partnership-inquiries` (validated, consent required, spam honeypot and database rate cap)

### Authenticated

- `GET /me` (profile and subscription status)
- `GET /me/saved-gyms`, `PUT /me/saved-gyms/:gymId`, `DELETE /me/saved-gyms/:gymId`
- `GET /me/trainer-profile`, `PUT /me/trainer-profile`, `PUT /me/trainer-contact`, `PUT /me/trainer-availability` (trainer role)
- `GET /trainers/:id/private` (trainer or gym-goer with accepted connection)
- `POST /trainers/:id/requests` (gym-goer role; transactional monthly quota and availability checks)
- `GET /me/trainer-requests`, `PATCH /me/trainer-requests/:id`
- `GET /me/partner-gyms`, `PATCH /me/partner-gyms/:id` (approved gym partner)
- `POST /billing/checkout`, `POST /billing/portal` (gym-goer role)
- `GET /admin/partnership-inquiries`, `PATCH /admin/partnership-inquiries/:id`, `POST /admin/partners` (admin role)

`POST /billing/webhook` accepts Stripe-signed raw webhook requests. The Vercel function disables automatic body parsing so the signature is verified against the original body.

## Data/security model

The initial Supabase migration is [`../supabase/migrations/20261106000000_initial_schema.sql`](../supabase/migrations/20261106000000_initial_schema.sql). It defines profiles and account roles, gyms/catalogues, partner inquiries/assignments, public trainer profiles, private trainer contact and availability, connection/session requests, saved gyms, subscriptions, and Stripe event deduplication.

RLS is enabled on public-schema tables; application calls use the user's Supabase access token and rely on database policies. The service-role client is used only for Stripe webhook sync. Trainer request quota is serialized per requester and capped at 5/month for Free or 20/month for active Premium/trialing. Session requests require an accepted connection and listed availability; a trainer cannot accept overlapping session times. Private contact and availability are visible only to the trainer and accepted connections.

The initial gym seed data is fictional and marked `sample=true`; verify and replace it before launch. New trainers are not discoverable until reviewed and approved. Partner inquiry does not itself grant partner access. Gym-partner accounts must be invited/approved, and assignments can only target an existing gym.

## Tests and deployment

```sh
corepack pnpm backend:test
corepack pnpm build
```

For production, deploy from the repository root to Vercel so the API and frontend share an origin. Apply the Supabase migration first, configure the environment variables above, and register the Stripe webhook. GitHub Pages requires a separate hosted API and is not recommended for account recovery or billing. See the root [deployment guide](../README.md) for setup, approval operations, and launch checks.
