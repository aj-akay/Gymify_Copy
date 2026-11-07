# GYMIFY

GYMIFY is a gym and trainer discovery app for Naga City, Philippines. The production architecture uses a React/Vite frontend and Express API on Vercel, Supabase for Postgres and authentication, and Stripe for GYMIFY's optional Premium subscription. Gym listings in the initial migration are illustrative samples, not verified businesses.

## Source layout

- `src/features/` contains feature-owned pages, components, context, and data for auth, gyms, trainers, partners, and membership.
- `src/shared/components/` contains UI shared across features.
- `src/services/` contains API clients; `src/lib/` contains external-service setup.
- `src/App.jsx` wires the routes and providers; `src/main.jsx` and `src/styles.css` are the frontend entry point and global styles.
- `backend/src/` contains the Express app, server entry point, and backend data.

## Local development

Requirements: Node.js 20.19 or newer and pnpm 9.

```powershell
Copy-Item .env.example .env.local
Copy-Item backend/.env.example backend/.env
corepack pnpm install
corepack pnpm dev
```

If `corepack` is not available, install pnpm 9 with `npm install --global pnpm@9`. Set the Supabase and Stripe values in `backend/.env`; set the Supabase public URL and anon key in `.env.local`. Keep the service-role key and Stripe secrets only in `backend/.env`. The frontend starts at `http://localhost:5173` and the API at `http://localhost:4000`. Gym data and account features need a configured Supabase project and the schema migration below. Stripe checkout additionally needs Stripe test credentials and a configured monthly Price.

Useful commands:

```sh
corepack pnpm build
corepack pnpm backend:test
```

## Set up Supabase

1. Create a Supabase project and keep its database password in a password manager.
2. In **SQL Editor**, run [`supabase/migrations/20261106000000_initial_schema.sql`](./supabase/migrations/20261106000000_initial_schema.sql). It creates the schema, Row Level Security policies, signup trigger, RPCs, and six sample gyms. For future schema changes, add a new migration rather than editing an already-applied migration.
3. In **Authentication → URL Configuration**, set the Site URL to your production app and add the exact local and production callback URLs, including `/login` and `/reset-password`.
4. Copy the project URL and public anon key to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Put the project URL, anon key, and service-role key in the server environment as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS; it must never use a `VITE_` variable or be exposed to a browser.
5. Before launch, replace the sample gyms with verified listings and update their sample status. Do not present seeded data as real businesses.

## Set up Stripe Premium

In Stripe, create a recurring **₱175 PHP monthly** Price. Configure the API with its Price ID as `STRIPE_PREMIUM_PRICE_ID`, plus server-only `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The API refuses checkout if the configured Price is not active and exactly PHP 175 per month.

Add a Stripe webhook endpoint at `https://YOUR-APP-DOMAIN/api/v1/billing/webhook` for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`. Subscription entitlements are updated from signed webhook events, not from the browser's checkout redirect. Use Stripe test mode until end-to-end testing is complete.

## Deploy the app to Vercel

1. Import this repository into Vercel and leave the project root at the repository root. Use `pnpm build` as the build command and `dist` as the output directory.
2. Add these environment variables to Vercel:

   **Browser-visible configuration** (the Supabase anon key is public; database RLS is mandatory):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_INQUIRY_API_ENABLED=true`

   **Server-only configuration**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PREMIUM_PRICE_ID`
   - `APP_BASE_URL` (the exact public Vercel origin, with no trailing slash)

   Leave `VITE_API_BASE_URL` unset for Vercel; the frontend calls the same-origin serverless API. Never add server-only keys as `VITE_` variables.
3. Add your production domain and local callback URLs in Supabase Auth URL Configuration. Also configure your Stripe webhook URL and secret.
4. Deploy. Verify `/api/v1/health`, gym discovery, signup/email verification, saved gyms, trainer requests, inquiry submission, and Stripe test checkout/webhook before inviting customers.

Vercel deploys the frontend and API together, but it does not create/configure the Supabase or Stripe projects for you. The service is not live or production-ready until those external services, secrets, auth email settings, verified listings, and operational review are configured.

## Approvals and launch operations

- Gym-partner inquiries are stored privately with a pending status. An admin can list and review them through `GET /api/v1/admin/partnership-inquiries` and mark them `approved`, `declined`, or `pending` through `PATCH /api/v1/admin/partnership-inquiries/:id`.
- Create and email-invite the partner's user in **Supabase → Authentication → Users** first. Then an authenticated admin can assign approved partner access with `POST /api/v1/admin/partners` using `{ "email": "...", "displayName": "...", "gymId": "..." }`. The target gym must already exist.
- These admin endpoints are API-only; there is no staff dashboard yet. Use an authenticated admin session to call them and keep admin access tightly restricted.
- To bootstrap the first admin, create and verify your own account, then run this in the Supabase SQL Editor as project owner, replacing the email:

  ```sql
  update public.profiles
  set role = 'admin'
  where id = (
    select id from auth.users where lower(email) = lower('you@example.com')
  );
  ```
- Trainer accounts and profiles start unapproved. Verify qualifications and identity out-of-band before setting `trainer_profiles.verification_status` to `approved` in the Supabase dashboard. Only then do they appear in public discovery.
- Trainers and gym-goers arrange gym membership and trainer-session payments directly. GYMIFY collects only the Premium app subscription. Contact details and trainer availability are private until a connection is accepted.
- Establish privacy/retention, support, incident response, and account deletion procedures before collecting real customer data. Use a paid Supabase plan with backups/PITR appropriate to the business, test restores, monitor Stripe webhook failures, and review database access regularly.

The current Premium quota is 5 combined trainer connection/session requests per month on Free and 20 on Premium. Gym browsing is free. The service does not collect gym or trainer fees.

## GitHub Pages (static alternative)

GitHub Pages does not run the API and is not the recommended deployment for account, password-recovery, and billing workflows. If you use it for the static discovery experience, deploy a separately hosted API and set GitHub Actions repository **Variables** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`; set `VITE_INQUIRY_API_ENABLED` to `true` only when the API and database are configured. Configure the hosted API's `CORS_ORIGINS` for the Pages origin. Keep every service-role and Stripe key on the server.

The repository includes a Render Blueprint as an alternative API host. Configure its required secrets and public app URL in Render before deployment. For password recovery and payment return URLs, use Vercel rather than GitHub Pages.

## Further reference

- [API and database notes](./backend/README.md)
- [Deployment environment variables](./.env.example) and [server environment variables](./backend/.env.example)
- [GitHub Pages workflow](./.github/workflows/deploy-pages.yml)

### Styling

Search `CUSTOMIZE SPACING HERE` in `src/styles.css` for the page gutter, page spacing, card padding, panel padding, field padding, and form gap variables.
