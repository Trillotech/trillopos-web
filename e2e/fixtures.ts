import { test as base, expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export type Shop = { phone: string; password: string; owner: string; business: string };
type State = Awaited<ReturnType<APIRequestContext["storageState"]>>;

/** A Myanmar mobile number no real person uses in a test database: 09 + 9 random digits. */
export function testPhone() {
  return `09${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

export async function signUp(details: Shop) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const response = await api.post("/api/auth/signup", {
    data: { phone: details.phone, password: details.password, fullName: details.owner, businessName: details.business },
  });
  expect(response.status(), await response.text()).toBe(201);
  return api;
}

export async function signIn(shop: Shop) {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const response = await api.post("/api/auth/login", { data: { phone: shop.phone, password: shop.password } });
  expect(response.status(), await response.text()).toBe(200);
  return api;
}

/** POST/PATCH through the web app's own routes, as the screens do; fails the test on an error. */
export async function send<T>(api: APIRequestContext, method: "POST" | "PATCH", path: string, data: unknown): Promise<T> {
  const response = await api.fetch(path, { method, data });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

export async function mainLocationId(api: APIRequestContext) {
  const locations = (await (await api.get("/api/catalog/locations")).json()) as { id: string; code: string }[];
  return locations.find((row) => row.code === "MAIN")?.id ?? locations[0].id;
}

export async function addProduct(api: APIRequestContext, name: string, price: number, cost: number, quantity: number) {
  const locationId = await mainLocationId(api);
  return send<{ id: string; name: string }>(api, "POST", "/api/catalog/products", {
    name,
    unit: "PIECE",
    retailPrice: price,
    reorderPoint: 2,
    trackInventory: true,
    sellInPos: true,
    sellOnline: true,
    taxable: true,
    active: true,
    openingStock: [{ locationId, quantity, unitCost: cost }],
  });
}

type Fixtures = {
  page: Page;
  api: APIRequestContext;
  /** Wait for html[data-hydrated] after goto/reload. Off for pages whose script is blocked on purpose. */
  waitForHydration: boolean;
  /** Fail the test on a script error in the browser. Off where errors are the point of the test. */
  checkBrowserErrors: boolean;
};
type WorkerFixtures = { shop: Shop };

export const test = base.extend<Fixtures, WorkerFixtures>({
  waitForHydration: [true, { option: true }],
  checkBrowserErrors: [true, { option: true }],
  // one test shop per browser setup, set up the way the shop guide says
  shop: [
    async ({}, use, workerInfo) => {
      const shop: Shop = {
        phone: testPhone(),
        password: "e2e-password-1",
        owner: "E2E Owner",
        business: `E2E ${workerInfo.project.name} ${Date.now()}`,
      };
      const api = await signUp(shop);
      await send(api, "PATCH", "/api/org/organization", {
        businessType: "ONLINE",
        defaultTaxRate: "0",
        defaultCreditLimit: "300000",
        defaultCreditTermDays: 14,
      });
      await api.dispose();
      await use(shop);
    },
    { scope: "worker" },
  ],
  // every test signs in afresh: sessions never share a refresh token
  storageState: async ({ shop }, use) => {
    const api = await signIn(shop);
    const state: State = await api.storageState();
    await api.dispose();
    await use(state);
  },
  // the same signed-in session, for setting up data quickly through the app's routes
  api: async ({ storageState }, use) => {
    const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: storageState as State });
    await use(api);
    await api.dispose();
  },
  // a script error in the browser fails the test, even when the screen looks right
  page: async ({ page, javaScriptEnabled, waitForHydration, checkBrowserErrors }, use) => {
    const problems: string[] = [];
    // WebKit reports the requests it drops when the page moves on; they break nothing
    const dropped = /Failed to load resource|Load failed|access control checks/i;
    page.on("pageerror", (error) => {
      if (!dropped.test(error.message)) problems.push(`page error: ${error.message}`);
    });
    page.on("console", (message) => {
      if (message.type() === "error" && !dropped.test(message.text())) {
        problems.push(`console error: ${message.text()}`);
      }
    });
    // like a person, wait for a page to be ready before using it (html[data-hydrated])
    if (javaScriptEnabled !== false && waitForHydration) {
      for (const name of ["goto", "reload"] as const) {
        const original = page[name].bind(page) as (...args: unknown[]) => Promise<unknown>;
        (page as unknown as Record<string, unknown>)[name] = async (...args: unknown[]) => {
          const response = await original(...args);
          await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
          return response;
        };
      }
    }
    await use(page);
    if (checkBrowserErrors) {
      expect(problems, "errors in the browser").toEqual([]);
    }
  },
});

export { expect };

/** Opens a page of the app's menu the way a person does: sidebar on a laptop, More on a phone. */
export async function openFromMenu(page: Page, group: string | null, item: string) {
  const isPhone = (page.viewportSize()?.width ?? 1280) < 768;
  const menu = isPhone ? page.getByRole("dialog", { name: "Menu" }) : page.locator("aside");
  if (isPhone) {
    await page.getByRole("button", { name: "More", exact: true }).click();
  }
  if (group) {
    await menu.getByRole("button", { name: group, exact: true }).click();
  }
  await menu.getByRole("link", { name: item, exact: true }).click();
}
