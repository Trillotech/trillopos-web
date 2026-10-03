import { addProduct, BASE_URL, expect, mainLocationId, openCart, send, signIn, test, testPhone } from "./fixtures";
import type { Page } from "@playwright/test";

async function leave(page: Page, label = "Sign out") {
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: /^Account menu:/ }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/(login|register)$/);
}

test("owner invites a cashier; staff joins, sells, renews and signs in again without owner access", async ({ page, api }, testInfo) => {
  const product = await addProduct(api, `Staff sale ${Date.now()}`, 3500, 2200, 20);
  await page.goto("/en/staff");
  await page.getByRole("button", { name: "Add staff", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Invited cashier");
  await dialog.getByRole("combobox", { name: "Role", exact: true }).selectOption("CASHIER");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  const code = (await dialog.locator("p.font-mono").textContent())!.trim();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await leave(page);
  await page.getByRole("link", { name: "Join a shop as staff", exact: true }).click();
  const phone = testPhone();
  await page.getByLabel("Invite code", { exact: true }).fill(code);
  await page.getByLabel("Your name").fill("Invited cashier");
  await page.getByLabel("Phone").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill("staff-password");
  if (testInfo.project.name === "iphone") await page.screenshot({ path: testInfo.outputPath("staff-join.png"), fullPage: true });
  await page.getByRole("button", { name: "Join shop", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/new$/);
  await page.getByLabel("Search products").fill(product.name);
  await page.locator("#main ul button", { hasText: product.name }).click();
  await openCart(page);
  await page.getByRole("radio", { name: "KBZPay", exact: true }).click();
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);
  expect((await page.request.get("/api/org/memberships")).status()).toBe(403);
  expect((await page.request.get("/api/reports/summary")).status()).toBe(403);
  await page.goto(`/en/products/${product.id}`);
  await expect(page.getByRole("heading", { name: product.name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(page.getByText("Average cost", { exact: true })).toHaveCount(0);
  await page.goto("/en/staff");
  await expect(page.getByText("This page is not available for your role.")).toBeVisible();
  await page.context().clearCookies({ name: "trillopos_access" });
  await page.goto("/en/products");
  await expect(page.getByRole("heading", { name: "Product catalog" })).toBeVisible();
  await leave(page);
  await page.getByLabel("Phone").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill("staff-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hello, Invited cashier" })).toBeVisible();
});

for (const role of ["STOCK_MANAGER", "PACKER"] as const) {
  test(`${role} joins with the assigned screens and API permissions`, async ({ page, api }) => {
    await addProduct(api, `${role} lookup`, 3500, 2200, 10);
    const invite = await send<{ inviteCode: string }>(api, "POST", "/api/org/memberships", { displayName: role, role });
    await page.context().clearCookies();
    await page.goto("/en/join");
    await page.getByLabel("Invite code").fill(invite.inviteCode);
    await page.getByLabel("Your name").fill(role);
    await page.getByLabel("Phone").fill(testPhone());
    await page.getByLabel("Password", { exact: true }).fill("staff-password");
    await page.getByRole("button", { name: "Join shop" }).click();
    await expect(page).toHaveURL(role === "PACKER" ? /\/en\/products$/ : /\/en\/dashboard$/);
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.current.role).toBe(role);
    expect(session.memberships).toHaveLength(1);
    expect((await page.request.get("/api/org/memberships")).status()).toBe(403);
    expect((await page.request.get("/api/reports/summary")).status()).toBe(role === "PACKER" ? 403 : 200);
    await page.goto("/en/products/new");
    if (role === "PACKER") {
      await expect(page.getByText("This page is not available for your role.")).toBeVisible();
      expect((await page.request.post("/api/catalog/products", { data: { name: "Forbidden", unit: "PIECE", retailPrice: 100 } })).status()).toBe(403);
      await page.goto("/en/sales/new");
      await expect(page.getByText("This page is not available for your role.")).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Add product", exact: true })).toBeVisible();
      const made = await send<{ id: string }>(page.request, "POST", "/api/catalog/products", { name: "Manager product", unit: "PIECE", retailPrice: 100 });
      await page.goto(`/en/products/${made.id}`);
      await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
      await page.goto("/en/stock");
      await expect(page.getByRole("heading", { name: "Stock", exact: true })).toBeVisible();
    }
  });
}

test("an existing account accepts a code without inheriting its other shop's owner role", async ({ page }) => {
  // The existing signed-in owner joins a different shop as packer.
  const { signUp } = await import("./fixtures");
  const existingPhone = testPhone();
  const existing = await signUp({ phone: existingPhone, password: "existing-password", owner: "Existing owner", business: "Existing shop" });
  await page.context().clearCookies();
  await page.context().addCookies((await existing.storageState()).cookies);
  const other = await signUp({ phone: testPhone(), password: "other-password", owner: "Other owner", business: "Other shop" });
  const invite = await send<{ inviteCode: string }>(other, "POST", "/api/org/memberships", { displayName: "Visiting packer", role: "PACKER" });
  await page.goto("/en/join");
  await expect(page.getByText("This invitation will be added to your signed-in account.")).toBeVisible();
  await page.getByLabel("Invite code").fill(invite.inviteCode);
  await page.getByRole("button", { name: "Join shop" }).click();
  await expect(page).toHaveURL(/\/en\/products$/);
  expect((await (await page.request.get("/api/auth/session")).json()).current.role).toBe("PACKER");
  expect((await page.request.get("/api/org/memberships")).status()).toBe(403);
  expect((await existing.get("/api/org/memberships")).status()).toBe(200);
  await leave(page);
  await page.getByLabel("Phone").fill(existingPhone);
  await page.getByLabel("Password", { exact: true }).fill("existing-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/businesses$/);
  await page.context().clearCookies({ name: "trillopos_access" });
  await page.reload();
  await expect(page.getByText("Existing shop", { exact: true })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Other shop" }).getByRole("button").click();
  await expect(page).toHaveURL(/\/en\/products$/);
  expect((await (await page.request.get("/api/auth/session")).json()).current.role).toBe("PACKER");
  await existing.dispose();
  await other.dispose();
});

test("a bound register signs in by name and PIN, renews, locks, switches staff and can be revoked", async ({ page, shop }, testInfo) => {
  const api = await signIn(shop);
  const locationId = await mainLocationId(api);
  const product = await addProduct(api, `PIN sale ${Date.now()}`, 3500, 2200, 20);
  const member = await send<{ membership: { id: string } }>(api, "POST", "/api/org/memberships", { displayName: "PIN cashier", role: "CASHIER", locationId, pin: "482913" });
  await send(api, "POST", "/api/org/memberships", { displayName: "PIN packer", role: "PACKER", pin: "691824" });
  await page.goto("/en/registers");
  await page.getByRole("button", { name: "Add register", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Staff test register");
  await dialog.getByRole("button", { name: "Add register", exact: true }).click();
  await dialog.getByRole("button", { name: "Use this device as the register" }).click();
  await expect(page).toHaveURL(/\/en\/register$/);
  expect((await (await page.request.get("/api/auth/session")).json()).authenticated).toBe(false);
  expect((await page.context().cookies()).find(cookie => cookie.name === "trillopos_register")?.httpOnly).toBe(true);
  await expect(page.getByRole("combobox", { name: "Staff name", exact: true })).toBeVisible();
  if (testInfo.project.name === "iphone") await page.screenshot({ path: testInfo.outputPath("staff-pin.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Staff name", exact: true }).selectOption(member.membership.id);
  await page.getByLabel("6-digit PIN").fill("000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  await page.getByLabel("6-digit PIN").fill("482913");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/new$/);
  await expect(page.getByRole("combobox", { name: "Store", exact: true })).toHaveValue(locationId);
  const current = (await (await page.request.get("/api/auth/session")).json()).current;
  expect(current.kind).toBe("REGISTER");
  expect(current.role).toBe("CASHIER");
  expect(current.locationId).toBe(locationId);
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open shift", exact: true })).toHaveCount(0);
  await page.getByLabel("Search products").fill(product.name);
  await page.locator("#main ul button", { hasText: product.name }).click();
  await openCart(page);
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);
  await page.context().addCookies([{ name: "trillopos_access", value: "expired", url: BASE_URL }]);
  await page.goto("/en/products");
  await expect(page.getByRole("heading", { name: "Product catalog" })).toBeVisible();
  await leave(page, "Switch staff / lock register");
  await expect(page).toHaveURL(/\/en\/register$/);
  expect((await (await page.request.get("/api/auth/session")).json()).authenticated).toBe(false);
  await page.getByRole("combobox", { name: "Staff name", exact: true }).selectOption({ label: "PIN packer" });
  await page.getByLabel("6-digit PIN").fill("691824");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/products$/);
  await expect(page.getByRole("link", { name: "New sale", exact: true })).toHaveCount(0);
  await page.goto("/en/account");
  await expect(page.getByText("This page is not available for your role.")).toBeVisible();
  await leave(page, "Switch staff / lock register");
  const registers = await (await api.get("/api/registers")).json();
  const register = registers.find((row: { label: string }) => row.label === "Staff test register");
  await send(api, "POST", `/api/registers/${register.id}/revoke`, {});
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  await expect(page.getByLabel("6-digit PIN")).toHaveCount(0);
  await api.dispose();
});
