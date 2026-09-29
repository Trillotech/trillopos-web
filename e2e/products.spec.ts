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

test("deleting a product from the list: asks first, writes off its stock, and it leaves the list", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Nike ${Date.now()}`, 350000, 310000, 4);
  await page.goto("/en/products");
  await page.getByLabel("Search by name, SKU, or barcode").fill(product.name);
  const bin = page.getByRole("button", { name: `Delete ${product.name}` }).filter({ visible: true });

  // Cancel keeps it
  await bin.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Delete ${product.name}?` })).toBeVisible();
  await expect(dialog.getByText(/It still has 4 in stock/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText(product.name).filter({ visible: true }).first()).toBeVisible();

  // Yes, delete removes it
  await bin.click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText(`${product.name} deleted.`)).toBeVisible();
  await expect(page.getByText(product.name, { exact: true }).filter({ visible: true })).toHaveCount(0);
  const balances = (await (await api.get("/api/catalog/balances")).json()) as { productId: string; quantity: number }[];
  expect(balances.filter((row) => row.productId === product.id).every((row) => Number(row.quantity) === 0)).toBeTruthy();
});

test("deleting a product from its own page returns to the list with a message", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Converse ${Date.now()}`, 285000, 240000, 2);
  await page.goto(`/en/products/${product.id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL(/\/en\/products\?deleted=/);
  await expect(page.getByText(`${product.name} deleted.`)).toBeVisible();
});
