# Camion Temps Admin Frontend

React + TypeScript + Vite admin interface for fleet operations.

## Requirements

- Node.js 20+
- npm 10+

## Environment Variables

This project uses Vite environment variables.

1. Copy `.env.example` to `.env` for local development.
2. Set the backend API base URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ROUTER_MODE=hash
```

For production, create `.env.production` with your production backend URL, for example:

```env
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_ROUTER_MODE=hash
```

`VITE_ROUTER_MODE` supports:

- `hash`: best for static hosting without rewrite rules (`/#/dashboard`).
- `browser`: clean URLs (`/dashboard`) and requires server rewrite fallback to `index.html`.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

Build output is generated in the `dist/` directory.

To test the production build locally:

```bash
npm run preview
```

## Deployment Checklist

- `npm run build` succeeds without TypeScript or lint errors.
- `VITE_API_BASE_URL` points to the production API.
- Hosting serves static files from `dist/`.
- Frontend routing falls back to `index.html` for deep links.
- Backend CORS allows your frontend production domain.

## Fixing Direct URL 404 (SPA Routing)

If `/dashboard` works after in-app navigation but returns 404 on refresh or direct access, your host is not rewriting unknown paths to `index.html`.

This repository includes:

- `public/_redirects` for Netlify.
- `vercel.json` for Vercel.

For Nginx, use a fallback like:

```nginx
location / {
	try_files $uri /index.html;
}
```
