# GYMIFY

GYMIFY is a gym and trainer discovery app for Naga City, Philippines. The production architecture uses a React/Vite frontend and Express API on Vercel, Supabase for Postgres and authentication, and PayMongo for GYMIFY's optional Premium purchases. Gym listings in the initial migration are illustrative samples, not verified businesses.

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

If `corepack` is not available, install pnpm 9 with `npm install --global pnpm@9`. Set the Supabase and PayMongo values in `backend/.env`; set the Supabase public URL and anon key in `.env.local`. Keep the service-role key and PayMongo secrets only in `backend/.env`. The frontend starts at `http://localhost:5173` and the API at `http://localhost:4000`. Gym data and account features need a configured Supabase project and the schema migrations below.

Useful commands:

```sh
corepack pnpm build
corepack pnpm backend:test
```

## Set up Supabase

1. Create a Supabase project and keep its database password in a password manager.
2. In **SQL Editor**, run [`supabase/migrations/20261106000000_initial_schema.sql`](./supabase/migrations/20261106000000_initial_schema.sql). It creates the schema, Row Level Security policies, signup trigger, RPCs, and six sample gyms. For future schema changes, add a new migration rather than editing an already-applied migration.
3. To enable Premium payments, also run [`supabase/migrations/20261118000000_paymongo_premium_checkout.sql`](./supabase/migrations/20261118000000_paymongo_premium_checkout.sql).
4. Run [`supabase/migrations/20261119000000_gym_inquiry_review_status.sql`](./supabase/migrations/20261119000000_gym_inquiry_review_status.sql) to enable the `under_review` status for gym-owner inquiries.
5. In **Authentication → URL Configuration**, set the Site URL to your production app and add the exact local and production callback URLs, including `/login` and `/reset-password`.
6. Copy the project URL and public anon key to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Put the project URL, anon key, and service-role key in the server environment as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS; it must never use a `VITE_` variable or be exposed to a browser.
7. Before launch, replace the sample gyms with verified listings and update their sample status. Do not present seeded data as real businesses.

## Set up PayMongo Premium

GYMIFY Premium is a one-time **₱175 purchase for 30 days**. It does not auto-renew; customers can renew manually, including early (extra days are added to the current expiry). Hosted Checkout offers GCash, cards, Maya, and QR Ph when those methods are enabled on the PayMongo account. Configure the server with `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET`; use test-mode values during development.

Run [`supabase/migrations/20261118000000_paymongo_premium_checkout.sql`](./supabase/migrations/20261118000000_paymongo_premium_checkout.sql) in Supabase SQL Editor after the initial schema. Register a PayMongo test webhook at `https://YOUR-APP-DOMAIN/api/v1/billing/webhook` for `checkout_session.payment.paid`, then copy that endpoint's signing secret to `PAYMONGO_WEBHOOK_SECRET`. The webhook is the source of truth for activating or extending Premium; returning from checkout alone never grants access. Test with PayMongo test keys and the webhook test event before using live keys.

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
   - `PAYMONGO_SECRET_KEY`
   - `PAYMONGO_WEBHOOK_SECRET`
   - `APP_BASE_URL` (the exact public Vercel origin, with no trailing slash)
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL` (inquiry receipt, review updates, and admin alerts)

   Leave `VITE_API_BASE_URL` unset for Vercel; the frontend calls the same-origin serverless API. Never add server-only keys as `VITE_` variables.
3. Add your production domain and local callback URLs in Supabase Auth URL Configuration. Register separate PayMongo test and live webhook endpoints when each environment is ready.
4. Deploy. Verify `/api/v1/health`, gym discovery, signup/email verification, saved gyms, trainer requests, inquiry submission, and PayMongo test checkout/webhook before inviting customers.

Vercel deploys the frontend and API together, but it does not create/configure the Supabase or PayMongo projects for you. The service is not live or production-ready until those external services, secrets, auth email settings, verified listings, and operational review are configured.

## Approvals and launch operations

- Gym-partner inquiries are stored privately with a `pending` status. Admins can move them to `under_review`, `approved`, or `declined` in `/admin`; each status change emails the gym owner when email delivery is configured. New inquiries also email the configured admin inbox and send the owner a receipt.
- To enable these emails, configure the server-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `ADMIN_NOTIFICATION_EMAIL` variables. Resend requires a sender address on a domain verified in Resend; the admin inbox can be a Gmail address. Email delivery is optional during local development, and the form will say when email is not configured. Never put these values in a `VITE_` variable.
- Create and email-invite the partner's user in **Supabase → Authentication → Users** first. Then an authenticated admin can assign approved partner access with `POST /api/v1/admin/partners` using `{ "email": "...", "displayName": "...", "gymId": "..." }`. The target gym must already exist.
- Trainer approvals and gym partnership inquiries are managed in the admin dashboard at `/admin`. Its notification bar refreshes pending counts every minute while open; keep admin access tightly restricted.
- To bootstrap the first admin, create and verify your own account, then run this in the Supabase SQL Editor as project owner, replacing the email:

  ```sql
  update public.profiles
  set role = 'admin'
  where id = (
    select id from auth.users where lower(email) = lower('you@example.com')
  );
  ```
- Trainer accounts and profiles start unapproved. Verify qualifications and identity out-of-band before setting `trainer_profiles.verification_status` to `approved` in the Supabase dashboard. Only then do they appear in public discovery.
- Trainers and gym-goers arrange gym membership and trainer-session payments directly. GYMIFY collects only for its 30-day Premium app pass. Contact details and trainer availability are private until a connection is accepted.
- Establish privacy/retention, support, incident response, and account deletion procedures before collecting real customer data. Use a paid Supabase plan with backups/PITR appropriate to the business, test restores, monitor PayMongo webhook failures, and review database access regularly.

The current Premium quota is 5 combined trainer connection/session requests per month on Free and 20 on Premium. Gym browsing is free. The service does not collect gym or trainer fees.

## GitHub Pages (static alternative)

GitHub Pages does not run the API and is not the recommended deployment for account, password-recovery, and billing workflows. If you use it for the static discovery experience, deploy a separately hosted API and set GitHub Actions repository **Variables** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`; set `VITE_INQUIRY_API_ENABLED` to `true` only when the API and database are configured. Configure the hosted API's `CORS_ORIGINS` for the Pages origin. Keep every service-role and PayMongo key on the server.

The repository includes a Render Blueprint as an alternative API host. Configure its required secrets and public app URL in Render before deployment. For password recovery and payment return URLs, use Vercel rather than GitHub Pages.

## Further reference

- [API and database notes](./backend/README.md)
- [Deployment environment variables](./.env.example) and [server environment variables](./backend/.env.example)
- [GitHub Pages workflow](./.github/workflows/deploy-pages.yml)

### Styling

Search `CUSTOMIZE SPACING HERE` in `src/styles.css` for the page gutter, page spacing, card padding, panel padding, field padding, and form gap variables.
