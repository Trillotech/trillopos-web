import { addProduct, expect, send, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function basket(page: Page, name: string) {
  await page.goto("/en/sales/new");
  await expect(page.getByText(/Paid by KBZPay/)).toBeVisible();
  await page.getByLabel("Search products").fill(name);
  await page.locator("#main ul button", { hasText: name }).click();
  await page.getByLabel("Qty", { exact: true }).fill("2");
  await expect(page.getByLabel("Line discount", { exact: true })).toHaveCount(0);
}

test("product discounts can be added, paused, resumed and removed; sales price them automatically", async ({ page, api }, testInfo) => {
  const product = await addProduct(api, `Discount shoes ${Date.now()}`, 20000, 8000, 20);
  await page.goto(`/en/products/${product.id}`);
  await page.getByRole("link", { name: "Add discount", exact: true }).click();
  await page.getByRole("button", { name: "Add discount", exact: true }).click();
  await page.getByLabel("Discount (%)", { exact: true }).fill("10");
  await page.getByRole("heading", { name: "Automatic product discount" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("product-discount.png") });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${product.id}$`));
  await expect(page.getByText("10% · On", { exact: true })).toBeVisible();
  await basket(page, product.name);
  await expect(page.getByTestId("sale-preview")).toContainText("36,000");
  await expect(page.getByTestId("sale-preview")).toContainText("4,000");
  await page.getByTestId("sale-preview").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("discounted-sale.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
  const receipt = page.url();
  await expect(page.getByText("36,000").first()).toBeVisible();

  await page.goto(`/en/products/${product.id}`);
  await page.getByRole("button", { name: "Turn off", exact: true }).click();
  await expect(page.getByText("10% · Off", { exact: true })).toBeVisible();
  await basket(page, product.name);
  await expect(page.getByTestId("sale-preview")).toContainText("40,000");
  await page.goto(`/en/products/${product.id}`);
  await page.getByRole("button", { name: "Turn on", exact: true }).click();
  await expect(page.getByText("10% · On", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove discount", exact: true }).click();
  await expect(page.getByText("No automatic discount", { exact: true })).toBeVisible();
  await basket(page, product.name);
  await expect(page.getByTestId("sale-preview")).toContainText("40,000");
  await page.goto(receipt);
  await expect(page.getByText("36,000").first()).toBeVisible();
});

test("fixed discounts and held carts keep the confirmed amount after product changes", async ({ page, api }) => {
  const product = await addProduct(api, `Fixed discount ${Date.now()}`, 20000, 8000, 20);
  await page.goto(`/en/products/${product.id}/edit`);
  await page.getByRole("button", { name: "Add discount", exact: true }).click();
  await page.getByRole("combobox", { name: "Discount type", exact: true }).selectOption("FIXED");
  await page.getByLabel(/Discount per unit/).fill("1500");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${product.id}$`));
  await basket(page, product.name);
  await expect(page.getByTestId("sale-preview")).toContainText("37,000");
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
  await send(api, "PATCH", `/api/catalog/products/${product.id}`, { retailPrice: 30000, discount: { type: null } });
  await expect(page.getByText(/This cart keeps its saved prices/)).toBeVisible();
  await page.getByRole("button", { name: "Charge 37,000", exact: true }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("37,000").first()).toBeVisible();
});

test("a discount changed in another session requires reviewing the new total", async ({ page, api }) => {
  const product = await addProduct(api, `Review discount ${Date.now()}`, 20000, 8000, 20);
  await send(api, "PATCH", `/api/catalog/products/${product.id}`, { discount: { type: "PERCENT", value: 10 } });
  await basket(page, product.name);
  await expect(page.getByTestId("sale-preview")).toContainText("36,000");
  await send(api, "PATCH", `/api/catalog/products/${product.id}`, { discount: { type: "PERCENT", value: 20 } });
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page.getByRole("region", { name: "Cart", exact: true }).getByRole("alert")).toContainText("Prices changed");
  await expect(page.getByTestId("sale-preview")).toContainText("32,000");
  await expect(page).toHaveURL(/\/sales\/new$/);
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
  await expect(page.getByText("32,000").first()).toBeVisible();
});
