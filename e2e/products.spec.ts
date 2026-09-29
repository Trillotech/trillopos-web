import { addProduct, expect, test } from "./fixtures";

test("adding a product with opening stock, then finding it in the list and on its page", async ({ page }) => {
  const name = `E2E Longyi ${Date.now()}`;
  await page.goto("/en/products");
  await page.getByRole("link", { name: "Add product" }).first().click();
  await expect(page).toHaveURL(/\/en\/products\/new$/);
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Opening unit cost").fill("12500");
  await page.getByLabel("Retail price").fill("18000");
  // the place for the opening stock is chosen by itself (it was empty on the pilot's iPhone)
  await expect(page.getByLabel("Opening stock location")).not.toHaveValue("");
  await page.getByLabel("Opening quantity").fill("30");
  // an online shop sells new products online unless unticked
  await expect(page.getByLabel("Sell online")).toBeChecked();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Main" })).toContainText("30");
  await page.goto("/en/products");
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
});

test("Save says what is missing instead of doing nothing", async ({ page }) => {
  await page.goto("/en/products/new");
  await expect(page.getByLabel("Opening stock location")).not.toHaveValue("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Enter the product name.")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/products\/new$/);
});

test("changing a product's price", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Scarf ${Date.now()}`, 22000, 15000, 5);
  await page.goto(`/en/products/${product.id}/edit`);
  await expect(page.getByLabel("Product name")).toHaveValue(product.name);
  await page.getByLabel("Retail price").fill("23000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/products/${product.id}$`));
  await expect(page.getByText("23,000").first()).toBeVisible();
});
