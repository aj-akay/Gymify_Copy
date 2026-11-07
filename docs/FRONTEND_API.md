# Frontend/API integration

The frontend uses the same-origin `/api/v1` API by default. Local Vite development proxies it to `localhost:4000`; Vercel routes it to the Express function in `api/[...path].js`. For a separate static frontend, set `VITE_API_BASE_URL` to the hosted API base URL ending in `/api/v1` and configure the API's exact `CORS_ORIGINS`.

The frontend Supabase client uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. It signs users in and retains the Supabase session. `memberRequest` sends that session as a bearer token; the API verifies it and runs database queries under the user's RLS policies. Never expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET` in frontend build variables.

## Feature behavior

- Gym discovery and trainer discovery are public. Gym catalogue entries are still sample records until verified and replaced.
- Compare and saved gyms require a signed-in account. Saved gyms persist in Supabase; comparison is session-local.
- Trainer signup creates a pending profile. Only verified/approved profiles appear publicly. Contact details and weekly availability are private until an accepted connection.
- Free gym-goer accounts can create 5 combined trainer connection/session requests per month. Active Premium users can create 20. Session requests require an accepted connection and fit the trainer's available schedule.
- Gym partnership inquiries are public and consent-based. An inquiry does not create an account or grant access. An admin reviews the inquiry and assigns access only after a partner user and gym record exist.
- Premium billing is for the GYMIFY app plan only. Gym memberships and trainer-session payments are arranged directly with the providers.

## Configuration and verification

Copy `.env.example` to `.env.local` and `backend/.env.example` to `backend/.env`. Account services require the browser Supabase URL/key and a correctly configured server API. Inquiry submissions remain in preview mode until `VITE_INQUIRY_API_ENABLED=true` is set at build time.

Before public launch, apply the Supabase migration, set auth redirect URLs, configure Stripe's exact PHP 175 monthly Price and signed webhook, replace sample listings, and test email verification/recovery, role-based access, inquiry review, trainer approval, quota enforcement, session overlap handling, checkout, cancellation, and webhook retries.

See the root [README](../README.md) for deployment steps and [backend reference](../backend/README.md) for the routes and data model.
