# Frontend integration handoff

This change adds frontend screens only. The existing `backend/` stays unchanged and remains read-only. The following routes are a **proposed contract**, not implemented backend endpoints. Coordinate with the backend team before enabling either feature flag.

## Enable after implementation

Copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL` to the API root, and enable `VITE_MEMBER_API_ENABLED=true` and/or `VITE_INQUIRY_API_ENABLED=true`. Rebuild after changing Vercel environment variables. Keep these false until the corresponding endpoints work.

With flags false: discovery stays public; Compare and Saved show an account gate; account forms explicitly identify the missing integration and disable submission; the inquiry form checks required fields and reports **nothing was sent or stored**. No fake accounts, credentials in localStorage, staff tools, or backend changes are included.

## Response convention

Use the existing envelope: `{ "data": ... }` on success, or a non-2xx response with `{ "error": { "message": "Readable message", "code": "OPTIONAL_CODE" } }`.

The frontend uses `credentials: include`. Use secure HttpOnly session cookies, HTTPS in production, restricted CORS origins, appropriate SameSite settings, and server-side CSRF/origin checks for mutations. Never rely on the frontend login gate for authorization. No service keys or passwords belong in Vite environment variables.

## Proposed account routes

| Method and path (relative to API root) | Request | Success `data` |
| --- | --- | --- |
| GET `/auth/session` | Cookie | `{ "user": { "id": "stable-string-id", "name": "Name", "email": "email@example.com" } }` or `{ "user": null }` |
| POST `/auth/login` | `{ "email", "password" }` | `{}` and set the session cookie; frontend checks `/auth/session` afterward |
| POST `/auth/register` | `{ "name", "email", "password" }` | `{}`; frontend asks user to verify email if needed, then sign in |
| POST `/auth/logout` | Cookie | `{}` and invalidate the session cookie |
| POST `/auth/forgot-password` | `{ "email" }` | `{}`; use a neutral result regardless of account existence |

Use JSON success responses (including logout and deletes), not empty 204 responses. Registration does not assume automatic login. Password recovery email and token validation must be supplied by the backend; the reset-instructions screen currently sends a request only. The team must also define where reset-email links lead and implement the final password update flow before enabling recovery in production.

Validate emails, enforce password rules, verify account ownership as appropriate, and rate-limit auth requests server-side. The UI's 8-character minimum for registration is only client-side feedback.

## Proposed saved gym routes (authenticated)

| Method and path | Success `data` |
| --- | --- |
| GET `/me/saved-gyms` | `{ "gymIds": ["forge-fitness"] }` |
| PUT `/me/saved-gyms/:gymId` | `{}`; idempotently save for the current session user |
| DELETE `/me/saved-gyms/:gymId` | `{}`; remove only from the current user's list |

The server must derive identity from the session, enforce ownership, and validate gym IDs. Keep listing IDs aligned with the existing gym API. The frontend now reads listings through `src/contexts/GymsContext.jsx`. Unknown saved IDs are reported as unavailable. Notes/status/profile/staff management are outside this frontend request.

Comparison requires login but is currently held only in page memory, scoped to the signed-in user, capped at three gyms. Reloading resets it. Persistent comparison storage can be added by the backend team later. There is no paid subscription or payment UI.

## Proposed inquiry route (public)

POST `/partnership-inquiries` with:

```json
{
  "gymName": "Example Gym",
  "contactName": "Owner Name",
  "email": "owner@example.com",
  "phone": "optional",
  "location": "Street or barangay in Naga City",
  "message": "optional",
  "consent": true
}
```

Return `{ "data": {} }` only after actually accepting/storing the inquiry. Validate fields and consent, restrict lengths, rate-limit and mitigate spam server-side. Use 400/422 for validation, 429 for rate limiting, and non-2xx on failure. Inquiry contents must not be exposed through public listing APIs. Agree a privacy/retention policy before collecting real personal data. Sending an inquiry does not activate a partnership or initiate payment.

## Files to connect

- `src/services/memberApi.js`: feature flags, API transport, safe return routes.
- `src/contexts/AuthContext.jsx`: session/login/logout.
- `src/contexts/SavedContext.jsx`: saved-gym load and mutations.
- `src/pages/AuthPage.jsx`: login, signup, password recovery request UI.
- `src/components/InquiryForm.jsx`: inquiry form and preview validation.
- `src/components/MemberGate.jsx`: guest prompt for member pages.

## Manual acceptance checks

1. Flags false: all public routes work; Compare/Saved show gates; card Save/Compare actions lead to login; no account API request is sent; inquiry preview never claims delivery.
2. Connected backend: register, verify if required, sign in, save/unsave, refresh, compare two or three gyms, sign out, verify saved data is unavailable to another user.
3. Check session errors, invalid credentials, unavailable saved-list service, save failures, inquiry submission failures, and disabled repeated submits.
4. Test keyboard navigation, required fields, mobile navbar, narrow screens, and direct links on Vercel.
