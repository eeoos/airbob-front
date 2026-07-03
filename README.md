<h1 align="center">$\bf{\large{\color{#6580DD} Codesquad \ - \ Airbob \ Frontend}}$</h1>

## Frontend Setup

```bash
npm install
npm run typecheck
npm run test:ci:no-cache
npm run build
```

Required environment variables:

- `REACT_APP_API_URL`
- `REACT_APP_GOOGLE_MAPS_API_KEY`
- `REACT_APP_TOSS_CLIENT_KEY`
- `REACT_APP_CLOUDFRONT_DOMAIN`

Local development expects the backend API to be reachable through the CRA proxy at `http://localhost:8080`.
