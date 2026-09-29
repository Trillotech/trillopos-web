# TrilloPOS web

Next.js App Router UI for TrilloPOS. The browser talks only to this app. Route handlers under `/api/auth` call `trillopos-backend` and keep access and refresh tokens in httpOnly cookies.

## Run

```powershell
corepack pnpm install
npm run dev -- --port 3100
```

Device Guard on this machine blocks the installed `pnpm.exe`, and at times the `pnpm-native.exe` behind `corepack pnpm` as well. Running scripts needs no pnpm: `npm run dev` runs the same `dev` script from the installed `node_modules`. Start the backend first (see its README); then open http://localhost:3100.

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

## Staff access

Owners add staff in **Settings ? Staff**, choose their role and optionally restrict them to one location.

- **Personal phone:** leave PIN empty, give the employee the invite code, and ask them to choose **Join a shop as staff** on the sign-in page. They create a staff account or use an existing account. Later they use the normal phone/password sign-in. Joining does not create a business.
- **Shared counter device:** add staff with a six-digit PIN (or set a PIN for an active member). On that device, the owner opens **Settings ? Registers**, adds a register and chooses **Use this device as the register**. This signs the owner out. Staff then choose their name and enter their PIN at `/en/register`. **Switch staff / lock register** returns to that screen. The device binding stays in an httpOnly cookie; clearing browser cookies requires setup again. An owner can revoke the register from another device.

Cashiers can sell and take payments; stock managers also manage products, inventory, suppliers and reports; packers have product/stock lookup only. Menus and actions follow the current shop role, and the backend enforces permissions. Packing orders and delivery workflows are still a separate planned feature.
