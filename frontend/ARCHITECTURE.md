# Frontend Architecture

The frontend source is organized by feature and shared layers.

## Structure

- `src/app/pages`: route-level screens grouped by domain (`auth`, `catalog`, `cart`, `profile`, `admin`, `staff`, `payment`).
- `src/app/components`: reusable UI pieces grouped by concern (`layout`, `catalog`, `admin`).
- `src/app/context`: app-wide state providers.
- `src/app/hooks`: reusable state/data hooks.
- `src/app/lib`: API clients and browser storage helpers.
- `src/app/data`: shared domain types and static fallback data.
- `src/app/types`: cross-feature TypeScript types.

## Notes

The current source tree is missing the original Vite entrypoint/config files (`package.json`, `index.html`, `vite.config`, `src/main.tsx`). The app can still be served from `dist`, but source changes require restoring those build files before running `npm run build`.
