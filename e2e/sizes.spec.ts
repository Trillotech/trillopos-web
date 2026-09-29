import { expect, send, test } from "./fixtures";

type Product = { id: string; name: string; sizeLabel?: string; sizeEquivalents?: string; productGroupKey?: string };
type Balance = { productId: string; quantity: number | string };

test("adding sneakers in sizes: each size is its own product and knows its size in every system", async ({ page, api }) => {
  const model = `E2E Air Force ${Date.now()}`;
  await page.goto("/en/products/new");
  await page.getByLabel("Product name").fill(model);
  await page.getByLabel("Size chart").selectOption({ label: "Sneakers · US sizes" });
  await expect(page.getByText("Named by US M, with US W · UK · EU · CM beside each size.")).toBeVisible();

  // a size chart and no size says so, instead of saving nothing
  await page.getByLabel("Retail price").fill("180000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Tap at least one size.")).toBeVisible();

  for (const size of ["8.5", "9", "10"]) {
    await page.getByRole("button", { name: size, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "9", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "9.5", exact: true })).toHaveAttribute("aria-pressed", "false");
  // each picked size with its match in the other systems
  await expect(page.getByText("US W 10.5 · UK 8 · EU 42.5 · CM 27", { exact: true })).toBeVisible();
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
  await expect(page.getByText("US W 10.5 · UK 8 · EU 42.5 · CM 27", { exact: true }).filter({ visible: true })).toBeVisible();

  // a customer asks for EU 42.5: the search finds the US M 9
  await page.getByLabel("Search by name, SKU, or barcode").fill(`${model} EU 42.5`);
  await expect(page.getByText(`${model} · US M 9`, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(`${model} · US M 8.5`, { exact: true }).filter({ visible: true })).toHaveCount(0);

  const products = ((await (await api.get("/api/catalog/products")).json()) as Product[]).filter((row) => row.name.startsWith(model));
  expect(products.map((row) => row.sizeLabel).sort()).toEqual(["10", "8.5", "9"]);
  expect(products.find((row) => row.sizeLabel === "9")?.sizeEquivalents).toBe("US W 10.5 · UK 8 · EU 42.5 · CM 27");
  expect(new Set(products.map((row) => row.productGroupKey)).size).toBe(1);
  const balances = (await (await api.get("/api/catalog/balances")).json()) as Balance[];
  const stock = (size: string) =>
    balances.filter((row) => row.productId === products.find((p) => p.sizeLabel === size)?.id).reduce((sum, row) => sum + Number(row.quantity), 0);
  expect([stock("8.5"), stock("9"), stock("10")]).toEqual([1, 2, 0]);
});

test("a category with a size chart opens Add product on its sizes, every system beside them", async ({ page }) => {
  const category = `E2E Footwear ${Date.now()}`;
  await page.goto("/en/categories");
  await page.getByRole("button", { name: "Add category" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(category);
  await dialog.getByLabel("Size chart").selectOption({ label: "Shoes · EU sizes" });
  await dialog.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("button", { name: new RegExp(category) })).toContainText("Sizes: Shoes · EU sizes");

  const model = `E2E Sandal ${Date.now()}`;
  await page.goto("/en/products/new");
  await page.getByLabel("Product name").fill(model);
  await page.getByLabel("Category").selectOption({ label: category });
  // the category's chart is chosen by itself, sizes ready to tap
  await expect(page.getByLabel("Size chart").locator("option:checked")).toHaveText("Shoes · EU sizes");
  await expect(page.getByText("Named by EU, with UK · US M · US W · CM beside each size.")).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save 14 sizes" })).toBeVisible();
  await page.getByRole("button", { name: "None", exact: true }).click();
  await page.getByRole("button", { name: "40", exact: true }).click();
  await page.getByRole("button", { name: "41", exact: true }).click();
  await expect(page.getByText("UK 7.5 · US M 8.5 · US W 10 · CM 26", { exact: true })).toBeVisible();
  // no stock yet is fine: the sizes wait for a stock-in
  await page.getByLabel("Retail price").fill("25000");
  await page.getByRole("button", { name: "Save 2 sizes" }).click();
  await expect(page.getByText(`Saved 2 sizes of ${model}.`)).toBeVisible();
  await expect(page.getByText(`${model} · EU 40`, { exact: true }).filter({ visible: true })).toBeVisible();
});

test("size charts: label by another system, drop a size, make your own table, delete it", async ({ page }) => {
  await page.goto("/en/categories");
  await page.getByRole("button", { name: "Size charts", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Size charts", exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Add Women’s clothes" }).click();
  await expect(dialog.getByRole("button", { name: "Edit Women’s clothes" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add Women’s clothes" })).toHaveCount(0);

  // this shop labels its dresses in EU numbers and sells no 32
  await dialog.getByRole("button", { name: "Edit Women’s clothes" }).click();
  await expect(dialog.getByRole("heading", { name: "Edit size chart", exact: true })).toBeVisible();
  await dialog.getByLabel("Label stock with").selectOption({ label: "EU" });
  await expect(dialog.getByLabel("Name of system 1", { exact: true })).toHaveValue("EU");
  await expect(dialog.getByLabel("Size, row 1", { exact: true })).toHaveValue("XXS");
  await dialog.getByRole("button", { name: "Remove size 32" }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByText("9 sizes · EU · Size · UK · US")).toBeVisible();

  // a table of its own: ring sizes in two systems
  const rings = `E2E Rings ${Date.now()}`;
  await dialog.getByRole("button", { name: "Make your own" }).click();
  await dialog.getByLabel("Name", { exact: true }).fill(rings);
  await dialog.getByLabel("Name of system 1", { exact: true }).fill("US");
  await dialog.getByRole("button", { name: "Add a system" }).click();
  await dialog.getByLabel("Name of system 2", { exact: true }).fill("EU");
  const sizes = [["6", "51.5"], ["7", "54"], ["8", ""]];
  for (const [row, [us, eu]] of sizes.entries()) {
    await dialog.getByLabel(`US, row ${row + 1}`, { exact: true }).fill(us);
    if (eu) {
      await dialog.getByLabel(`EU, row ${row + 1}`, { exact: true }).fill(eu);
    }
  }
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("button", { name: `Edit ${rings}` })).toBeVisible();
  await expect(dialog.getByRole("listitem").filter({ hasText: rings })).toContainText("3 sizes · US · EU");

  await dialog.getByRole("button", { name: `Edit ${rings}` }).click();
  await dialog.getByRole("button", { name: "Delete size chart" }).click();
  await dialog.getByRole("button", { name: "Yes, delete" }).click();
  await expect(dialog.getByRole("button", { name: `Edit ${rings}` })).toHaveCount(0);
  await expect(dialog.getByText("9 sizes · EU · Size · UK · US")).toBeVisible();
});

test("one brand runs small: its sizes are corrected on the product, and the sale screen finds them", async ({ page, api }) => {
  const chart = await send<{ id: string }>(api, "POST", "/api/catalog/size-charts", { templateKey: "shoes" });
  const model = `E2E Stan Smith ${Date.now()}`;
  const [shoe] = await send<Product[]>(api, "POST", "/api/catalog/products/sizes", {
    name: model,
    unit: "PIECE",
    retailPrice: 150000,
    sizeChartId: chart.id,
    sellOnline: true,
    sizes: [{ label: "42" }],
  });
  expect(shoe.sizeEquivalents).toBe("UK 8 · US M 9 · US W 10.5 · CM 26.5");

  await page.goto(`/en/products/${shoe.id}/edit`);
  await expect(page.getByLabel("Same size in other systems")).toHaveValue("UK 8 · US M 9 · US W 10.5 · CM 26.5");
  await page.getByLabel("Same size in other systems").fill("UK 8 · US M 8.5 · US W 10 · CM 26.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/products/${shoe.id}$`));
  await expect(page.getByText("Same size: UK 8 · US M 8.5 · US W 10 · CM 26.5")).toBeVisible();

  // the customer says "US 8.5": the sale screen finds the EU 42
  await page.goto("/en/sales/new");
  await page.getByLabel("Search products").fill(`${model} us 8.5`);
  await expect(page.locator("#main ul button", { hasText: `${model} · EU 42` })).toContainText("US M 8.5");
});

test("the size charts speak Burmese", async ({ page }) => {
  await page.goto("/my/products/new");
  // a chart this test shop has not taken yet, so it is still the library's, named in Burmese
  const select = page.getByLabel("ဆိုဒ်ဇယား");
  await expect(select.locator("option", { hasText: "ကလေးဖိနပ်" })).toHaveCount(1);
  await select.selectOption({ label: "ကလေးဖိနပ်" });
  await page.getByRole("button", { name: "32", exact: true }).click();
  await expect(page.getByLabel("EU 32 ၏ အဖွင့်အရေအတွက်")).toBeVisible();
  await expect(page.getByText("UK 13 · US 1Y · CM 20", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ဆိုဒ် 1 ခု သိမ်းမည်" })).toBeVisible();
});
