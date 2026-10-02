import type { Page } from "@playwright/test";

import { addProduct, expect, mainLocationId, test } from "./fixtures";

/** Shows one product's stock history at one place; returns its rows, newest first. */
async function history(page: Page, productId: string, locationId: string) {
  const ledger = page.getByRole("region", { name: "Stock history" });
  await ledger.getByLabel("Product").selectOption(productId);
  await ledger.getByLabel("Location").selectOption(locationId);
  await ledger.getByRole("button", { name: "Show history" }).click();
  return ledger.getByRole("row");
}

test("stock out: a reason is required, and the history shows it", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Serum ${Date.now()}`, 9500, 6000, 10);
  const main = await mainLocationId(api);
  await page.goto("/en/stock");
  await page.getByRole("button", { name: "New stock entry" }).first().click();
  const entry = page.getByRole("dialog");
  const post = entry.getByRole("button", { name: "Post", exact: true });
  await entry.getByLabel("Type").selectOption("STOCK_OUT");
  await entry.getByLabel("Location").selectOption(main);
  await entry.getByLabel("Product").selectOption(product.id);
  await entry.getByLabel("Quantity").fill("2");
  // stock leaves at its average cost, so no cost is asked for; a reason is
  await expect(entry.getByLabel("Unit cost")).toHaveCount(0);
  await expect(post).toBeDisabled();
  await entry.getByLabel("Reason").selectOption("DAMAGED");
  await post.click();
  await expect(entry).toBeHidden();
  await expect(page.getByText("Stock entry posted.")).toBeVisible();

  const row = (await history(page, product.id, main)).filter({ hasText: "Damaged" });
  await expect(row.getByRole("cell").nth(1)).toContainText("Stock out");
  await expect(row.getByRole("cell").nth(2)).toHaveText("-2");
  await expect(row.getByRole("cell").nth(4)).toHaveText("8");
});

test("count adjustment: fewer or more is chosen every time, and no minus sign is typed", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Toner ${Date.now()}`, 12000, 7000, 10);
  const main = await mainLocationId(api);
  await page.goto("/en/stock");
  const entry = page.getByRole("dialog");
  const post = entry.getByRole("button", { name: "Post", exact: true });

  await page.getByRole("button", { name: "New stock entry" }).first().click();
  await entry.getByLabel("Type").selectOption("ADJUSTMENT");
  await entry.getByLabel("Location").selectOption(main);
  await entry.getByLabel("Product").selectOption(product.id);
  // a phone's number pad has no minus key
  await entry.getByLabel("Difference").fill("3");
  await expect(post).toBeDisabled();
  await entry.getByLabel("Your count").selectOption("fewer");
  await expect(entry.getByLabel("Unit cost")).toHaveCount(0);
  await post.click();
  await expect(entry).toBeHidden();

  await page.getByRole("button", { name: "New stock entry" }).first().click();
  await expect(entry.getByLabel("Your count")).toHaveValue("");
  await entry.getByLabel("Product").selectOption(product.id);
  await entry.getByLabel("Difference").fill("1");
  await entry.getByLabel("Your count").selectOption("more");
  // stock that turns up is valued like any stock coming in
  await expect(post).toBeDisabled();
  await entry.getByLabel("Unit cost").fill("7000");
  await post.click();
  await expect(entry).toBeHidden();

  const counts = (await history(page, product.id, main)).filter({ hasText: "Count correction" });
  await expect(counts).toHaveCount(2);
  await expect(counts.nth(0).getByRole("cell").nth(2)).toHaveText("+1");
  await expect(counts.nth(0).getByRole("cell").nth(4)).toHaveText("8");
  await expect(counts.nth(1).getByRole("cell").nth(2)).toHaveText("-3");
  await expect(counts.nth(1).getByRole("cell").nth(4)).toHaveText("7");
});
