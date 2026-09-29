import { BASE_URL, expect, test } from "./fixtures";

// every screen in the menu opens, shows its heading, and raises no error in the browser
const screens: [string, string][] = [
  ["/en/dashboard", "Dashboard"],
  ["/en/sales", "Sales log"],
  ["/en/sales/held", "Held sales"],
  ["/en/sales/new", "New sale"],
  ["/en/products", "Product catalog"],
  ["/en/categories", "Categories"],
  ["/en/stock", "Stock"],
  ["/en/suppliers", "Suppliers"],
  ["/en/customers", "Customers"],
  ["/en/receivables", "Owed to you"],
  ["/en/payables", "You owe"],
  ["/en/expenses", "Expenses"],
  ["/en/settings", "Business settings"],
  ["/en/locations", "Locations"],
  ["/en/staff", "Staff"],
  ["/en/registers", "Registers"],
  ["/en/account", "Account"],
  ["/my/dashboard", "အကျဉ်းချုပ်"],
];

for (const [path, heading] of screens) {
  test(`${path} opens`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("an expired sign-in is renewed in place: the page stays where it was", async ({ page }) => {
  await page.context().addCookies([{ name: "trillopos_access", value: "expired", url: BASE_URL }]);
  await page.goto("/en/receivables");
  await expect(page.getByRole("heading", { level: 1, name: "Owed to you" })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/receivables$/);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the shop guide opens in both languages without signing in", async ({ page }) => {
    await page.goto("/my/guide");
    await expect(page.getByRole("heading", { level: 1, name: "TrilloPOS ဖြင့် ဆိုင်ကို စီမံပါ" })).toBeVisible();
    await page.goto("/en/guide");
    await expect(page.getByRole("heading", { level: 1, name: "Run your shop in TrilloPOS" })).toBeVisible();
  });

  test("the language menu switches to Burmese", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel("Language").selectOption("my");
    await expect(page).toHaveURL(/\/my\/login$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "my");
  });

  test("a console page sends a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login$/);
  });
});
