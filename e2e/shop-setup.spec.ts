import { expect, openFromMenu, test, testPhone } from "./fixtures";

test("business settings are saved and still there after a reload", async ({ page }) => {
  await page.goto("/en/dashboard");
  await openFromMenu(page, "Settings", "Business details");
  await expect(page).toHaveURL(/\/en\/settings$/);
  await expect(page.getByLabel("Business type")).toHaveValue("ONLINE");
  await page.getByLabel("Days to pay").fill("21");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Days to pay")).toHaveValue("21");
});

test("a category is added", async ({ page }) => {
  const name = `E2E Clothing ${Date.now()}`;
  await page.goto("/en/categories");
  await page.getByRole("button", { name: "Add category" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
});

test("a supplier is added", async ({ page }) => {
  const name = `E2E Wholesale ${Date.now()}`;
  await page.goto("/en/suppliers");
  await page.getByRole("button", { name: "Add supplier" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add supplier" }).click();
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
});

test("a customer is added", async ({ page }) => {
  const name = `E2E Customer ${Date.now()}`;
  await page.goto("/en/customers");
  await page.getByRole("button", { name: "Add customer" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Phone").fill(testPhone());
  await dialog.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
});

test("a warehouse is added", async ({ page }) => {
  const code = `W${String(Date.now()).slice(-5)}`;
  await page.goto("/en/locations");
  await page.getByRole("button", { name: "Add location" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Code").fill(code);
  await dialog.getByLabel("Name", { exact: true }).fill(`E2E Warehouse ${code}`);
  await dialog.getByLabel("Type").selectOption("WAREHOUSE");
  await dialog.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText(`E2E Warehouse ${code}`).filter({ visible: true }).first()).toBeVisible();
});

test("a cashier is added and gets an invite code", async ({ page }) => {
  await page.goto("/en/staff");
  await page.getByRole("button", { name: "Add staff" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(`E2E Cashier ${Date.now()}`);
  await dialog.getByLabel("Role").selectOption("CASHIER");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText("Invite code", { exact: true })).toBeVisible();
});
