import { addProduct, closeOpenShift, expect, mainLocationId, openCart, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** The test shop sells online, so the screen opens on online orders; switch to the counter. */
async function inShop(page: Page) {
  await expect(page.getByText(/Paid by KBZPay/)).toBeVisible();
  await page.getByRole("radio", { name: "In the shop", exact: true }).click();
}

function fits(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test("a shop sale in cash: scan, quick amounts, the change to give, the slip and the next sale", async ({ page, api }, testInfo) => {
  const product = await addProduct(api, `Cash sale ${Date.now()}`, 3500, 2200, 20);
  const locationId = await mainLocationId(api);
  try {
    await page.goto("/en/sales/new");
    await inShop(page);
    await page.getByRole("button", { name: "Open shift", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close shift", exact: true })).toBeVisible();

    // a scanner (or a name with one match) and Enter: the product is added and the box is ready for the next
    const search = page.getByLabel("Search products");
    await search.fill(product.name);
    await search.press("Enter");
    await expect(search).toHaveValue("");
    await search.fill(product.name);
    const tile = page.locator("#main ul button", { hasText: product.name });
    await expect(tile).toContainText("20 left");
    await tile.click();
    await openCart(page);
    await expect(page.getByLabel("Qty", { exact: true })).toHaveValue("2");
    await expect(page.getByTestId("sale-preview")).toContainText("7,000");

    // cash is already chosen; too little is stopped before the sale, and the error goes once it is put right
    await expect(page.getByRole("radio", { name: "Cash", exact: true })).toHaveAttribute("aria-checked", "true");
    await page.getByLabel("Cash received").fill("5000");
    await expect(page.getByText("2,000 short", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Charge", exact: true }).click();
    const cart = page.getByRole("region", { name: "Cart", exact: true });
    await expect(cart.getByRole("alert")).toContainText("2,000 short");
    await expect(page).toHaveURL(/\/sales\/new$/);
    await page.getByRole("group", { name: "Quick amounts", exact: true }).getByRole("button", { name: "10,000", exact: true }).click();
    await expect(page.getByLabel("Cash received")).toHaveValue("10000");
    await expect(cart.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("p", { hasText: "Change to give" })).toContainText("3,000");
    expect(await fits(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("cash-payment.png") });
    await page.getByRole("button", { name: "Charge", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);

    // the first thing the cashier sees: the change to hand back
    const banner = page.getByRole("region", { name: "Sale complete", exact: true });
    await expect(banner).toContainText("Change to give");
    await expect(banner).toContainText("3,000");
    const slip = page.getByRole("article");
    await expect(slip).toContainText(product.name);
    await expect(slip).toContainText("Cash given");
    await expect(slip).toContainText("10,000");
    await expect(slip).toContainText("Thank you for shopping with us!");
    expect(await fits(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("sale-complete.png"), fullPage: true });

    // printed, the slip is all there is
    await page.emulateMedia({ media: "print" });
    await expect(banner).toBeHidden();
    await expect(page.getByRole("button", { name: "Print receipt" })).toBeHidden();
    await expect(slip).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("receipt-print.png"), fullPage: true });
    await page.emulateMedia({ media: "screen" });

    // the greeting is for the moment of the sale; the slip stays
    await page.reload();
    await expect(slip).toContainText("Change");
    await expect(banner).toHaveCount(0);
    await page.locator("#main").getByRole("link", { name: "New sale", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sales\/new$/);

    // the drawer is counted and the shift closed from the same screen
    await inShop(page);
    await page.getByRole("button", { name: "Close shift", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Close shift", exact: true });
    await expect(drawer).toContainText("7,000");
    await drawer.getByLabel("Counted cash").fill("7000");
    await drawer.getByRole("button", { name: "Close shift", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open shift", exact: true })).toBeVisible();
  } finally {
    await closeOpenShift(api, locationId);
  }
});

test("a phone without crypto.randomUUID (Safari before iOS 15.4) can still charge", async ({ page, api }) => {
  await page.addInitScript(() => {
    delete (Crypto.prototype as { randomUUID?: unknown }).randomUUID;
  });
  const product = await addProduct(api, `Old phone ${Date.now()}`, 2500, 1500, 5);
  await page.goto("/en/sales/new");
  await expect(page.getByText(/Paid by KBZPay/)).toBeVisible();
  await page.getByLabel("Search products").fill(product.name);
  await page.locator("#main ul button", { hasText: product.name }).click();
  await openCart(page);
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sales\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("article")).toContainText(product.name);
});

test("selling more than the store holds: the cart warns, and the refusal names the product", async ({ page, api }) => {
  const product = await addProduct(api, `Last one ${Date.now()}`, 4000, 2500, 1);
  await page.goto("/en/sales/new");
  await expect(page.getByText(/Paid by KBZPay/)).toBeVisible();
  await page.getByLabel("Search products").fill(product.name);
  const tile = page.locator("#main ul button", { hasText: product.name });
  await expect(tile).toContainText("1 left");
  await tile.click();
  await tile.click();
  await openCart(page);
  const cart = page.getByRole("region", { name: "Cart", exact: true });
  await expect(cart).toContainText("Only 1 left");
  await page.getByRole("button", { name: "Charge", exact: true }).click();
  await expect(cart.getByRole("alert")).toContainText(`Not enough stock for ${product.name}.`);
  await expect(cart.getByRole("alert")).not.toContainText("on hand");
  await expect(page).toHaveURL(/\/sales\/new$/);
});
