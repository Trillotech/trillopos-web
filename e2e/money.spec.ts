import { addProduct, expect, openFromMenu, send, test } from "./fixtures";

test("new stock from a supplier: posted, owed to the supplier, then paid", async ({ page, api }) => {
  const product = await addProduct(api, `E2E Cream ${Date.now()}`, 9500, 6000, 3);
  const supplier = await send<{ id: string; name: string }>(api, "POST", "/api/catalog/suppliers", {
    name: `E2E Supplier ${Date.now()}`,
    phone: "09000000201",
    paymentTermsDays: 14,
  });
  await page.goto("/en/stock");
  await page.getByRole("button", { name: "New stock entry" }).first().click();
  const entry = page.getByRole("dialog");
  await entry.getByLabel("Type").selectOption("STOCK_IN");
  await entry.getByLabel("Supplier").selectOption(supplier.id);
  await entry.getByLabel("Product").selectOption(product.id);
  await entry.getByLabel("Quantity").fill("10");
  await entry.getByLabel("Unit cost").fill("5800");
  await entry.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("A supplier debt was added under You owe.")).toBeVisible();

  await openFromMenu(page, "Money", "You owe");
  await expect(page).toHaveURL(/\/en\/payables/);
  await page.getByRole("button", { name: new RegExp(supplier.name) }).click();
  const payment = page.getByRole("dialog");
  await payment.getByRole("button", { name: "Whole amount" }).click();
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();

  await page.goto(`/en/products/${product.id}`);
  await expect(page.getByRole("listitem").filter({ hasText: "Main" })).toContainText("13");
});

test("an expense: add its category, record it, and see it listed", async ({ page }) => {
  const category = `E2E Delivery ${Date.now()}`;
  await page.goto("/en/expenses");
  await page.getByRole("button", { name: "Categories" }).click();
  const categories = page.getByRole("dialog");
  await categories.getByLabel("New category").fill(category);
  await categories.getByRole("button", { name: "Add category" }).click();
  await expect(categories.getByText(category)).toBeVisible();
  await categories.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Record expense" }).first().click();
  const expense = page.getByRole("dialog");
  await expense.getByLabel("Category").selectOption({ label: category });
  await expense.getByLabel("Amount").fill("6000");
  await expense.getByLabel("Description").fill("Courier fees E2E");
  await expense.getByRole("button", { name: "Record expense" }).click();
  await expect(page.getByText("Courier fees E2E").filter({ visible: true }).first()).toBeVisible();
});
