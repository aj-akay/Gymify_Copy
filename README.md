# GYMIFY

Responsive frontend MVP for sample gym discovery in Naga City, Philippines. Built with React, Vite, Tailwind CSS, React Router, and Lucide React.

## Local setup

Requires Node.js 20.19+ or 22.12+ and npm (or pnpm).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production checks:

```sh
npm run build
npm run preview
```

You can use `pnpm install`, `pnpm dev`, and `pnpm build` instead. The included pnpm lockfile records dependency versions.

## Deploy to Vercel

1. Push this repository to your Git provider.
2. Import it as a new Vercel project and select the Vite preset.
3. Use `npm run build` (or `pnpm build`) as the build command and `dist` as the output directory.
4. Deploy. `vercel.json` rewrites application routes to `index.html` so detail pages and other direct links work.

This repository does not imply an existing deployment.

## Data and configuration

All six fictional gym entries and image references live in `src/data/gyms.js`. Names, locations, rates, hours, equipment, amenities, and stock photographs are illustrative, not verified facts. There are no reviews, real partnerships, booking, authentication, or payments. Google Maps links search a neighborhood rather than claiming an exact venue location. Images load from Unsplash; a local system font fallback works if Google Fonts is unavailable.

Replace the sample data with verified information before launch. Set each gym's `contactUrl` to a verified public contact URL to enable its contact action. Add additional validated fields as needed; there are no fabricated contact details.

The partnership page intentionally has no inactive submission form. To connect a hosted inquiry form, set `VITE_PARTNER_FORM_URL` to an HTTPS URL in `.env.local` or Vercel's environment variables, then rebuild. Vite variables are public: never put secrets in them. Without this setting, the page clearly identifies the inquiry channel as an unconnected demo.

## Behavior

- Directory search matches name, neighborhood, and category; selected equipment and amenities use AND matching.
- Monthly budget filters and price sorting operate on numeric sample rates.
- Comparison supports 2–3 gyms, persists selected IDs in localStorage, and explains the selection limit.
- Distance sorting is intentionally absent: verified coordinates and geolocation calculations are not supplied.
- Data is synchronous and local; no artificial loading state or spinner is needed. Image space is reserved while images load. Search empty, missing gym, and unknown route states are implemented.
- Responsive navigation, labeled controls, keyboard focus indicators, skip navigation, semantic comparison table, and reduced-motion support are included.

## Project structure

- `src/data/gyms.js`: replaceable sample data and formatting helpers
- `src/main.jsx`: routes, reusable cards/navigation, directory, detail, comparison and partnership experiences
- `src/styles.css`: Tailwind entry and responsive visual system
- `vercel.json`: SPA route fallback
