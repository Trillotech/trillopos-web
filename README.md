# TrilloPOS web

Next.js App Router UI for TrilloPOS. The browser talks only to this app. Route handlers under `/api/auth` call `trillopos-backend` and keep access and refresh tokens in httpOnly cookies.

## Run

```powershell
corepack pnpm install
npm run dev
```

Device Guard on this machine blocks the installed `pnpm.exe`, and at times the `pnpm-native.exe` behind `corepack pnpm` as well. Running scripts needs no pnpm: `npm run dev` runs the same `dev` script from the installed `node_modules`. Start the backend first (see its README); then open http://localhost:3000.

Copy `.env.example` to `.env.local` if the API is not on `http://localhost:8080`.

## OpenAPI client

`src/lib/api/schema.ts` is generated from `openapi/backend.json`, which is the springdoc document from the backend (`springdoc-openapi` 3.1.1, Boot 4.1).

```powershell
cd ../trillopos-backend
./mvnw -Dtest=OpenApiExportTest test
Copy-Item target/openapi.json ../trillopos-web/openapi/backend.json
cd ../trillopos-web
corepack pnpm openapi
```

## Tests

End-to-end tests click through the app the way a shop owner does, in three browser engines: iPhone Safari's (WebKit), Android Chrome and a laptop. Every run signs up its own test shops, so they run against a local stack only, never the live site. Start the local backend and database first (see the backend README), then:

```powershell
node node_modules/@playwright/test/cli.js install webkit   # once per computer
npm run build
npm run test:e2e
```

`npm run test:e2e` first checks that the built code parses on older phones (`scripts/check-old-browsers.mjs`: iOS 15+ Safari, Chrome 90+; the targets are `browserslist` in `package.json`), then runs the tests in `e2e/`. The report is in `e2e-report/`; a failure keeps a screenshot and a trace in `test-results/`.

Errors from people's browsers are logged by the web container: `docker compose logs web | grep client-error` on the server.
