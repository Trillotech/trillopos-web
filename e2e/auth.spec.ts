import { expect, signIn, signUp, test, testPhone, type Shop } from "./fixtures";

// these start signed out
test.use({ storageState: { cookies: [], origins: [] } });

function newShop(label: string): Shop {
  return { phone: testPhone(), password: "e2e-password-1", owner: "E2E Owner", business: `E2E ${label} ${Date.now()}` };
}

test("a new owner creates a business and lands on the dashboard", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByRole("link", { name: "Create a business" }).click();
  await expect(page).toHaveURL(/\/en\/signup$/);
  await page.getByLabel("Your name").fill("Ma Test");
  await page.getByLabel("Business name").fill(`E2E Signup ${Date.now()}`);
  await page.getByLabel("Phone").fill(testPhone());
  await page.getByLabel("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Start selling" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("a wrong password gets a message; the right one opens the dashboard", async ({ page }) => {
  const shop = newShop("Signin");
  await (await signUp(shop)).dispose();
  await page.goto("/en/login");
  await page.getByLabel("Phone").fill(shop.phone);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Phone or password is wrong.")).toBeVisible();
  await page.getByLabel("Password").fill(shop.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
});

test("signing out ends the session", async ({ page }) => {
  const shop = newShop("Signout");
  await (await signUp(shop)).dispose();
  await page.goto("/en/login");
  await page.getByLabel("Phone").fill(shop.phone);
  await page.getByLabel("Password").fill(shop.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole("button", { name: "More", exact: true }).click();
  }
  await page.getByRole("button", { name: /^Account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("changing the password: the new one works, the old one no longer does", async ({ page }) => {
  const shop = newShop("Password");
  await (await signUp(shop)).dispose();
  await page.goto("/en/login");
  await page.getByLabel("Phone").fill(shop.phone);
  await page.getByLabel("Password").fill(shop.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await page.goto("/en/account");
  await page.getByLabel("Current password").fill(shop.password);
  await page.getByLabel(/^New password(?! again)/).fill("e2e-password-2");
  await page.getByLabel("New password again").fill("e2e-password-2");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
  await (await signIn({ ...shop, password: "e2e-password-2" })).dispose();
});

test.describe("before the page's script has loaded (slow connection, old phone)", () => {
  test.use({ javaScriptEnabled: false });

  test("signing in still works, and the password never goes into the address", async ({ page }) => {
    const shop = newShop("NoScript");
    await (await signUp(shop)).dispose();
    await page.goto("/en/login");
    await page.getByLabel("Phone").fill(shop.phone);
    await page.getByLabel("Password").fill(shop.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    expect(page.url()).not.toContain("password");
  });

  test("a wrong password comes back with the message", async ({ page }) => {
    const shop = newShop("NoScriptWrong");
    await (await signUp(shop)).dispose();
    await page.goto("/my/login");
    await page.getByLabel("ဖုန်းနံပါတ်").fill(shop.phone);
    await page.getByLabel("စကားဝှက်").fill("not-the-password");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/my\/login\?error=invalid_credentials$/);
    await expect(page.getByText("ဖုန်းနံပါတ် သို့မဟုတ် စကားဝှက် မမှန်ပါ။")).toBeVisible();
  });
});

test.describe("when the app's code never arrives (an old phone, a dropped connection)", () => {
  test.use({ waitForHydration: false, checkBrowserErrors: false });

  test("signing in still works; another form does nothing rather than put the passwords in the address", async ({ page }) => {
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    const shop = newShop("NoCode");
    await (await signUp(shop)).dispose();

    await page.goto("/en/login");
    await page.getByLabel("Phone").fill(shop.phone);
    await page.getByLabel("Password").fill(shop.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    await page.goto("/en/account");
    await page.getByLabel("Current password").fill(shop.password);
    await page.getByLabel(/^New password(?! again)/).fill("e2e-password-3");
    await page.getByLabel("New password again").fill("e2e-password-3");
    await page.getByRole("button", { name: "Change password" }).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/en\/account$/);
    expect(page.url()).not.toContain("password");
  });
});
