import { addProduct, expect, mainLocationId, send, test } from "./fixtures";

// a long name once widened the best-sellers card past a phone's screen, and the tab bar stopped taking taps
test("a long product name never makes the dashboard wider than the screen", async ({ page, api }) => {
  const name = `E2E Extra long product name that tops the best sellers ${Date.now()}`;
  const product = await addProduct(api, name, 900000, 500000, 10);
  await send(api, "POST", "/api/sales/checkout", {
    locationId: await mainLocationId(api),
    channel: "ONLINE",
    idempotencyKey: crypto.randomUUID(),
    lines: [{ productId: product.id, quantity: 1 }],
    payments: [{ method: "KBZ_PAY" }],
  });
  await page.goto("/en/dashboard");
  await expect(page.getByText(name).first()).toBeVisible();
  // clientWidth, not innerWidth: a phone zooms out to fit a page that is too wide, and innerWidth follows it
  const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sizes[0], `page ${sizes[0]}px wide on a ${sizes[1]}px screen`).toBeLessThanOrEqual(sizes[1]);
});
