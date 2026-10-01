import { addProduct, expect, mainLocationId, send, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function basket(page: Page, name: string, plan: "DEPOSIT"|"UNPAID"="DEPOSIT") {
  await page.goto("/en/sales/new");
  await expect(page.getByText(/Paid by KBZPay/)).toBeVisible();
  await page.getByLabel("Search products").fill(name);
  await page.locator("#main ul button",{hasText:name}).click();
  await page.getByLabel("Name",{exact:true}).fill(`Status buyer ${Date.now()}`);
  await page.getByRole("button",{name:"Add and select"}).click();
  await expect(page.getByRole("button",{name:"Walk-in",exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Payment status",exact:true}).selectOption(plan);
  if(plan==="DEPOSIT") await page.getByLabel("Deposit amount",{exact:true}).fill("5000");
  await expect(page.getByTestId("sale-preview")).toContainText("20,000");
}

async function charge(page:Page) {
  await page.getByRole("button",{name:"Charge",exact:true}).click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
}

async function cancel(page:Page,restock:boolean) {
  await page.getByRole("button",{name:"Cancel sale",exact:true}).click();
  await page.getByRole("combobox",{name:"Return goods to stock?",exact:true}).selectOption(String(restock));
  await page.getByRole("region",{name:"Sale progress",exact:true}).getByLabel("Reason",{exact:true}).fill("Customer changed their mind");
  await page.getByLabel("I checked the money and stock choices and want to cancel this sale.",{exact:true}).check();
  await page.getByRole("button",{name:"Confirm cancellation",exact:true}).click();
  await expect(page.getByTestId("sale-states")).toContainText("Canceled");
}

test("online deposit, close/reopen and final payment update independent states and history",async({page,api},testInfo)=>{
  const product=await addProduct(api,`Status deposit ${Date.now()}`,20000,8000,20);
  await basket(page,product.name);
  await expect(page.getByText("Remaining balance: 15,000",{exact:true})).toBeVisible();
  await page.getByLabel("Deposit amount",{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("deposit-form.png")});
  await charge(page);
  const id=page.url().split("/").pop();
  await expect(page.getByTestId("sale-states")).toHaveText(/OpenDeposit/);
  await page.getByRole("button",{name:"Close sale",exact:true}).click();
  await page.getByRole("region",{name:"Sale progress",exact:true}).getByLabel("Reason",{exact:true}).fill("Delivered to buyer");
  await page.getByRole("button",{name:"Save change",exact:true}).click();
  await expect(page.getByTestId("sale-states")).toHaveText(/ClosedDeposit/);
  await page.getByRole("button",{name:"Reopen sale",exact:true}).click();
  await page.getByRole("region",{name:"Sale progress",exact:true}).getByLabel("Reason",{exact:true}).fill("Delivery needed another attempt");
  await page.getByRole("button",{name:"Save change",exact:true}).click();
  await expect(page.getByTestId("sale-states")).toHaveText(/OpenDeposit/);
  await page.getByRole("button",{name:"Record payment",exact:true}).click();
  await expect(page.getByRole("textbox",{name:/Payment amount/})).toHaveValue("15000");
  await page.getByRole("button",{name:"Save change",exact:true}).click();
  await expect(page.getByTestId("sale-states")).toHaveText(/OpenPaid/);
  await page.getByRole("button",{name:"Record payment",exact:true}).count().then(count=>expect(count).toBe(0));
  await page.getByText("Progress history",{exact:true}).click();
  await expect(page.getByText("Delivered to buyer",{exact:true})).toBeVisible();
  const view=await(await api.get(`/api/sales/${id}`)).json();
  expect(Number(view.paymentState.receivedAmount)).toBe(20000);
  expect(Number(view.paymentState.outstandingAmount)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("paid-receipt.png")});
});

test("canceling a deposit refunds the deposit, clears debt and optionally restores stock",async({page,api},testInfo)=>{
  const product=await addProduct(api,`Status cancel ${Date.now()}`,20000,8000,20);
  await basket(page,product.name);await charge(page);
  const id=page.url().split("/").pop();
  await page.getByRole("button",{name:"Cancel sale",exact:true}).click();
  await expect(page.getByTestId("cancellation-amounts")).toContainText("5,000");
  await expect(page.getByTestId("cancellation-amounts")).toContainText("15,000");
  await expect(page.getByRole("button",{name:"Confirm cancellation",exact:true})).toBeDisabled();
  await page.getByRole("combobox",{name:"Return goods to stock?",exact:true}).selectOption("true");
  await page.getByRole("region",{name:"Sale progress",exact:true}).getByLabel("Reason",{exact:true}).fill("Parcel canceled");
  await page.getByLabel("I checked the money and stock choices and want to cancel this sale.",{exact:true}).check();
  await page.getByRole("button",{name:"Confirm cancellation",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("cancellation-review.png")});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Confirm cancellation",exact:true}).click();
  await expect(page.getByTestId("sale-states")).toHaveText(/CanceledRefunded/);
  await page.reload();
  await expect(page.getByTestId("sale-states")).toHaveText(/CanceledRefunded/);
  expect(await page.getByRole("button",{name:"Reopen sale",exact:true}).count()).toBe(0);
  const view=await(await api.get(`/api/sales/${id}`)).json();
  expect(Number(view.paymentState.refundedAmount)).toBe(5000);
  expect(Number(view.paymentState.creditReleasedAmount)).toBe(15000);
  expect(Number(view.paymentState.outstandingAmount)).toBe(0);
  await page.goto(`/en/products/${product.id}`);
  await expect(page.getByRole("listitem").filter({hasText:"Main"})).toContainText("20");
});

test("unpaid cancellations clear credit without claiming a money refund or restocking unreturned goods",async({page,api})=>{
  const product=await addProduct(api,`Status unpaid ${Date.now()}`,20000,8000,20);
  await basket(page,product.name,"UNPAID");await charge(page);
  await expect(page.getByTestId("sale-states")).toHaveText(/OpenUnpaid/);
  await cancel(page,false);
  await expect(page.getByTestId("sale-states")).toHaveText(/CanceledUnpaid/);
  await page.goto(`/en/products/${product.id}`);
  await expect(page.getByRole("listitem").filter({hasText:"Main"})).toContainText("19");
});

test("sales log filters progress and payment together and shows both badges on a phone",async({page,api},testInfo)=>{
  const product=await addProduct(api,`Status filter ${Date.now()}`,20000,8000,20);
  const locationId=await mainLocationId(api);
  const customer=await send<{id:string}>(api,"POST","/api/customers",{name:`Filter buyer ${Date.now()}`});
  const sale=await send<{id:string;receiptNumber:string}>(api,"POST","/api/sales/checkout",{
    locationId,channel:"ONLINE",customerId:customer.id,idempotencyKey:crypto.randomUUID(),
    lines:[{productId:product.id,quantity:1}],payments:[{method:"CREDIT"}]
  });
  await page.goto("/en/sales");
  await page.getByRole("combobox",{name:"Progress",exact:true}).selectOption("OPEN");
  await page.getByRole("combobox",{name:"Payment",exact:true}).selectOption("UNPAID");
  const row=page.getByRole("link").filter({hasText:sale.receiptNumber});
  await expect(row).toBeVisible();await expect(row).toContainText("Open");await expect(row).toContainText("Unpaid");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("filtered-sales-log.png")});
  await page.getByRole("combobox",{name:"Progress",exact:true}).selectOption("CLOSED");
  await expect(row).toHaveCount(0);
});

test("invalid deposits and credit without a customer are stopped before checkout",async({page,api})=>{
  const product=await addProduct(api,`Status validation ${Date.now()}`,20000,8000,20);
  await basket(page,product.name);
  await page.getByLabel("Deposit amount",{exact:true}).fill("20000");
  await page.getByRole("button",{name:"Charge",exact:true}).click();
  await expect(page.getByRole("region",{name:"Cart",exact:true}).getByRole("alert")).toContainText("Enter a deposit");
  await expect(page).toHaveURL(/\/sales\/new$/);
  await page.getByRole("button",{name:"Walk-in",exact:true}).click();
  await page.getByRole("combobox",{name:"Payment status",exact:true}).selectOption("UNPAID");
  await page.getByRole("button",{name:"Charge",exact:true}).click();
  await expect(page.getByRole("region",{name:"Cart",exact:true}).getByRole("alert")).toContainText(/customer/i);
  await expect(page).toHaveURL(/\/sales\/new$/);
});
