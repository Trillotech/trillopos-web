import { request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

import { addProduct, BASE_URL, expect, mainLocationId, send, test, testPhone } from "./fixtures";

type Role = "OWNER" | "STOCK_MANAGER" | "CASHIER" | "PACKER";
type Kind = "USER" | "REGISTER";
type Cookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

/**
 * Who may open which screen, written out as the shop owner was promised it (the backend enforces
 * every rule again on its own). Signed in on a phone or laptop is a USER; a shared till signed in
 * by name and PIN is a REGISTER.
 */
function allowed(path: string, role: Role, kind: Kind) {
  const stock = role === "OWNER" || role === "STOCK_MANAGER";
  const sells = stock || role === "CASHIER";
  if (path === "/account") return kind === "USER";
  if (path === "/registers") return role === "OWNER" && kind === "USER";
  if (["/settings", "/locations", "/staff"].includes(path)) return role === "OWNER";
  if (path === "/products/new" || path.endsWith("/edit")) return stock;
  if (["/categories", "/stock", "/suppliers", "/payables"].includes(path)) return stock;
  if (path.startsWith("/sales") || ["/customers", "/receivables", "/expenses"].includes(path)) return sells;
  return true; // the dashboard, the catalog and a product's page
}

/** Staff who sign in with their own phone and password: invited by the owner, joined with the code. */
async function joined(api: APIRequestContext, role: Role): Promise<Cookies> {
  const invite = await send<{ inviteCode: string }>(api, "POST", "/api/org/memberships", { displayName: `Audit ${role}`, role });
  const device = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const response = await device.post("/api/auth/join", {
    data: { code: invite.inviteCode, phone: testPhone(), password: "audit-password", fullName: `Audit ${role}` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { cookies } = await device.storageState();
  await device.dispose();
  return cookies;
}

/** Staff at a shared till: the device is bound to the shop by the owner, the person signs in by PIN. */
async function atRegister(api: APIRequestContext, role: Role, locationId: string): Promise<Cookies> {
  const pin = String(200000 + Math.floor(Math.random() * 700000));
  const member = await send<{ membership: { id: string } }>(api, "POST", "/api/org/memberships", {
    displayName: `Audit till ${role}`,
    role,
    locationId: role === "CASHIER" ? locationId : undefined,
    pin,
  });
  const bound = await send<{ deviceCredential: string }>(api, "POST", "/api/registers", { locationId, label: `Audit till ${role} ${Date.now()}` });
  const device = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const paired = await device.post("/api/registers/device", { data: { credential: bound.deviceCredential } });
  expect(paired.ok(), await paired.text()).toBeTruthy();
  const signed = await device.post("/api/registers/pin", { data: { membershipId: member.membership.id, pin } });
  expect(signed.ok(), await signed.text()).toBeTruthy();
  const { cookies } = await device.storageState();
  await device.dispose();
  return cookies;
}

/**
 * Opens every screen as this person and lists what is wrong: a screen they should have that is
 * refused, or one they should not have that opens; a request the screen makes that the server
 * refuses or fails; an error box shown on arrival; a page wider than the phone; a menu entry that
 * leads to a refusal.
 */
async function sweep(page: Page, role: Role, kind: Kind, paths: string[], shot?: (path: string) => Promise<unknown>) {
  const problems: string[] = [];
  const failed: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") && response.status() >= 400) {
      failed.push(`${response.request().method()} ${url.pathname} → ${response.status()}`);
    }
  });
  const refusal = page.getByText("This page is not available for your role.");
  const heading = page.getByRole("heading", { level: 1 });

  for (const path of paths) {
    failed.length = 0;
    await page.goto(`/en${path}`);
    const expected = allowed(path, role, kind);
    // a screen that opens has its heading; a refused one has only the refusal
    const shown = await heading.or(refusal).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    const refused = (await refusal.count()) > 0;
    if (!shown) problems.push(`${path}: showed neither a heading nor a refusal`);
    else if (expected && refused) problems.push(`${path}: refused, but this role should have it`);
    else if (!expected && !refused) problems.push(`${path}: opened, but this role should not have it`);
    await page.waitForLoadState("networkidle");
    if (failed.length) problems.push(`${path}: ${[...new Set(failed)].join(", ")}`);
    const alerts = (await page.getByRole("alert").filter({ hasText: /\S/ }).allInnerTexts()).filter((text) => !refused || !/not available/.test(text));
    if (alerts.length) problems.push(`${path}: error shown "${alerts.join(" | ").replace(/\s+/g, " ")}"`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 0) problems.push(`${path}: ${wide}px wider than the screen`);
    await shot?.(path);
  }

  // the menus offer only what opens: the sidebar, the tab bar and the account menu
  await page.goto("/en/products");
  const offered = await page.locator("aside a[href], nav a[href]").evaluateAll((links) =>
    links.map((link) => new URL((link as HTMLAnchorElement).href).pathname.replace(/^\/(en|my)/, "")));
  for (const path of new Set(offered)) {
    if (path.startsWith("/guide") || path === "") continue;
    if (!allowed(path, role, kind)) problems.push(`menu offers ${path}, which this role cannot open`);
  }
  return problems;
}

const personas: { name: string; role: Role; kind: Kind }[] = [
  { name: "owner", role: "OWNER", kind: "USER" },
  { name: "stock manager", role: "STOCK_MANAGER", kind: "USER" },
  { name: "cashier", role: "CASHIER", kind: "USER" },
  { name: "packer", role: "PACKER", kind: "USER" },
  { name: "cashier at a shared till", role: "CASHIER", kind: "REGISTER" },
  { name: "packer at a shared till", role: "PACKER", kind: "REGISTER" },
];

for (const persona of personas) {
  test(`every screen as the ${persona.name}: the right ones open, cleanly, and the rest say so`, async ({ page, api }, testInfo) => {
    test.setTimeout(240_000);
    const locationId = await mainLocationId(api);
    const product = await addProduct(api, `Audit ${persona.role} ${Date.now()}`, 5000, 3000, 10);
    const sale = await send<{ id: string }>(api, "POST", "/api/sales/checkout", {
      locationId,
      channel: "ONLINE",
      idempotencyKey: crypto.randomUUID(),
      lines: [{ productId: product.id, quantity: 1 }],
      payments: [{ method: "KBZ_PAY" }],
    });
    if (persona.role !== "OWNER") {
      const cookies = persona.kind === "USER" ? await joined(api, persona.role) : await atRegister(api, persona.role, locationId);
      await page.context().clearCookies();
      await page.context().addCookies(cookies);
    }
    const paths = [
      "/dashboard", "/sales", "/sales/held", "/sales/new", `/sales/${sale.id}`,
      "/products", "/products/new", `/products/${product.id}`, `/products/${product.id}/edit`,
      "/categories", "/stock", "/suppliers", "/customers", "/receivables", "/payables", "/expenses",
      "/settings", "/locations", "/staff", "/registers", "/account",
    ];
    // AUDIT_SHOTS=1 keeps a picture of every screen, for looking over each role's view by eye
    const shot = process.env.AUDIT_SHOTS
      ? (path: string) => page.screenshot({ path: testInfo.outputPath(`${path.split("/").filter(Boolean).map((part) => part.length > 20 ? "id" : part).join("-")}.png`), fullPage: true })
      : undefined;
    expect(await sweep(page, persona.role, persona.kind, paths, shot)).toEqual([]);
  });
}
