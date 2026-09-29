import { expect, test } from "./fixtures";

type Product = { id: string; name: string; sizeLabel?: string; productGroupKey?: string };
type Balance = { productId: string; quantity: number | string };

test("adding a shoe in sizes: every size is its own product, with its own stock", async ({ page, api }) => {
  const model = `E2E Chuck 70 ${Date.now()}`;
  await page.goto("/en/products/new");
  await page.getByLabel("Product name").fill(model);
  await page.getByLabel("Size chart").selectOption({ label: "Shoes · US men" });

  // a size chart and no size says so, instead of saving nothing
  await page.getByLabel("Retail price").fill("180000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Tap at least one size.")).toBeVisible();

  for (const size of ["8.5", "9", "10"]) {
    await page.getByRole("button", { name: size, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "9", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "9.5", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Opening quantity for US M 8.5").fill("1");
  await page.getByLabel("Opening quantity for US M 9").fill("2");
  await expect(page.getByText(`Saves 3 products, like “${model} · US M 8.5”.`)).toBeVisible();

  // stock needs its cost, or the stock value would be wrong
  await page.getByRole("button", { name: "Save 3 sizes" }).click();
  await expect(page.getByText("Enter the opening unit cost too, so your stock value is right.")).toBeVisible();
  await page.getByLabel("Opening unit cost").fill("120000");
  await page.getByRole("button", { name: "Save 3 sizes" }).click();

  await expect(page).toHaveURL(/\/en\/products\?added=.*&sizes=3$/);
  await expect(page.getByText(`Saved 3 sizes of ${model}.`)).toBeVisible();
  for (const size of ["8.5", "9", "10"]) {
    await expect(page.getByText(`${model} · US M ${size}`, { exact: true }).filter({ visible: true })).toBeVisible();
  }

  const products = ((await (await api.get("/api/catalog/products")).json()) as Product[]).filter((row) => row.name.startsWith(model));
  expect(products.map((row) => row.sizeLabel).sort()).toEqual(["10", "8.5", "9"]);
  expect(new Set(products.map((row) => row.productGroupKey)).size).toBe(1);
  const balances = (await (await api.get("/api/catalog/balances")).json()) as Balance[];
  const stock = (size: string) =>
    balances.filter((row) => row.productId === products.find((p) => p.sizeLabel === size)?.id).reduce((sum, row) => sum + Number(row.quantity), 0);
  expect([stock("8.5"), stock("9"), stock("10")]).toEqual([1, 2, 0]);
});

test("a category with a size chart opens Add product on its sizes", async ({ page }) => {
  const category = `E2E Footwear ${Date.now()}`;
  await page.goto("/en/categories");
  await page.getByRole("button", { name: "Add category" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(category);
  await dialog.getByLabel("Size chart").selectOption({ label: "Shoes · EU" });
  await dialog.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("button", { name: new RegExp(category) })).toContainText("Sizes: Shoes · EU");

  const model = `E2E Sandal ${Date.now()}`;
  await page.goto("/en/products/new");
  await page.getByLabel("Product name").fill(model);
  await page.getByLabel("Category").selectOption({ label: category });
  // the category's chart is chosen by itself, sizes ready to tap
  await expect(page.getByLabel("Size chart").locator("option:checked")).toHaveText("Shoes · EU");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save 25 sizes" })).toBeVisible();
  await page.getByRole("button", { name: "None", exact: true }).click();
  await page.getByRole("button", { name: "40", exact: true }).click();
  await page.getByRole("button", { name: "41", exact: true }).click();
  // no stock yet is fine: the sizes wait for a stock-in
  await page.getByLabel("Retail price").fill("25000");
  await page.getByRole("button", { name: "Save 2 sizes" }).click();
  await expect(page.getByText(`Saved 2 sizes of ${model}.`)).toBeVisible();
  await expect(page.getByText(`${model} · EU 40`, { exact: true }).filter({ visible: true })).toBeVisible();
});

test("size charts: take a ready-made one, trim it, make your own, delete it", async ({ page }) => {
  await page.goto("/en/categories");
  await page.getByRole("button", { name: "Size charts", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Size charts", exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Add Clothes · XS S M L XL" }).click();
  await expect(dialog.getByRole("button", { name: "Edit Clothes · XS S M L XL" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add Clothes · XS S M L XL" })).toHaveCount(0);

  // a shop that sells only S to XL keeps only those
  await dialog.getByRole("button", { name: "Edit Clothes · XS S M L XL" }).click();
  await expect(dialog.getByRole("heading", { name: "Edit size chart", exact: true })).toBeVisible();
  await dialog.getByLabel("Sizes").fill("S, M, L, XL");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByText("4 sizes · S, M, L, XL")).toBeVisible();

  const rings = `E2E Rings ${Date.now()}`;
  await dialog.getByRole("button", { name: "Make your own" }).click();
  await dialog.getByLabel("Name", { exact: true }).fill(rings);
  await dialog.getByLabel("Short name").fill("No.");
  await dialog.getByLabel("Sizes").fill("6\n7\n8");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByText("3 sizes · 6, 7, 8")).toBeVisible();

  await dialog.getByRole("button", { name: `Edit ${rings}` }).click();
  await dialog.getByRole("button", { name: "Delete size chart" }).click();
  await dialog.getByRole("button", { name: "Yes, delete" }).click();
  await expect(dialog.getByRole("button", { name: `Edit ${rings}` })).toHaveCount(0);
  await expect(dialog.getByText("4 sizes · S, M, L, XL")).toBeVisible();
});

test("the size charts speak Burmese", async ({ page }) => {
  await page.goto("/my/products/new");
  const select = page.getByLabel("ဆိုဒ်ဇယား");
  await expect(select.locator("option", { hasText: "ဖိနပ် · US အမျိုးသမီး" })).toHaveCount(1);
  await select.selectOption({ label: "ဖိနပ် · US အမျိုးသမီး" });
  await page.getByRole("button", { name: "7.5", exact: true }).click();
  await expect(page.getByLabel("US W 7.5 ၏ အဖွင့်အရေအတွက်")).toBeVisible();
  await expect(page.getByRole("button", { name: "ဆိုဒ် 1 ခု သိမ်းမည်" })).toBeVisible();
});
