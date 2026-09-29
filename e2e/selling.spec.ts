import { addProduct, expect, openFromMenu, test, testPhone } from "./fixtures";
import type { Page } from "@playwright/test";

async function stockAtMain(page: Page, productId: string) {
  await page.goto(`/en/products/${productId}`);
  return page.getByRole("listitem").filter({ hasText: "Main" });
}

/** New sale in online-order mode: find the product and tap it `times` times. */
async function addToCart(page: Page, name: string, times = 1) {
  await page.goto("/en/sales/new");
  await expect(page.getByText(/Paid by KBZPay/)).toBeVisible();
  await page.getByLabel("Search products").fill(name);
  const product = page.locator("#main ul button", { hasText: name });
  for (let i = 0; i < times; i++) {
    await product.click();
  }
}

test("an online order paid by KBZPay: receipt, and the stock goes down", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Thanaka ${Date.now()}`, 3500, 2200, 20);
  await addToCart(page, product.name, 2);
  await page.getByLabel("Method").selectOption("KBZ_PAY");
  await page.getByLabel("Reference").fill("KBZ E2E 0001");
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);
  await expect(page.getByText("7,000").first()).toBeVisible();
  await expect(await stockAtMain(page, product.id)).toContainText("18");
});

test("cash on delivery: sold on credit to a new buyer, then the courier pays", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Longyi ${Date.now()}`, 18000, 12500, 10);
  const buyer = `E2E Buyer ${Date.now()}`;
  await addToCart(page, product.name);
  await page.getByLabel("Name", { exact: true }).fill(buyer);
  await page.getByLabel("Phone (optional)").fill(testPhone());
  await page.getByRole("button", { name: "Add and select" }).click();
  await expect(page.getByText(buyer).first()).toBeVisible();
  await page.getByLabel("Method").selectOption("CREDIT");
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);

  await openFromMenu(page, "Money", "Owed to you");
  await expect(page).toHaveURL(/\/en\/receivables/);
  await page.getByRole("button", { name: new RegExp(buyer) }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Whole amount" }).click();
  await sheet.getByLabel("Method").selectOption("BANK_TRANSFER");
  await sheet.getByLabel("Reference").fill("Royal Express E2E");
  await sheet.getByRole("button", { name: "Record repayment" }).click();
  await expect(page.getByText("Repayment recorded.")).toBeVisible();
});

test("a parcel comes back: the return puts the stock back on the shelf", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Scarf ${Date.now()}`, 22000, 15000, 10);
  await addToCart(page, product.name);
  await page.getByLabel("Method").selectOption("KBZ_PAY");
  await page.getByLabel("Reference").fill("KBZ E2E 0002");
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);
  const receipt = page.url();
  await expect(await stockAtMain(page, product.id)).toContainText("9");

  await page.goto(receipt);
  await page.getByLabel("Return qty").fill("1");
  await expect(page.getByLabel("Restock")).toBeChecked();
  await page.getByLabel("Refund method").selectOption("KBZ_PAY");
  await page.getByRole("button", { name: "Return", exact: true }).click();
  await expect(page.getByText(/^Return recorded/)).toBeVisible();
  await expect(page.getByText("Refunded", { exact: true })).toBeVisible();
  await expect(await stockAtMain(page, product.id)).toContainText("10");
});
