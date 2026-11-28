import { test as base, expect } from "@playwright/test";
import sharp from "sharp";

const PW = "e2e correct horse battery";
const LOCAL = new Set(["127.0.0.1", "localhost"]);

// Auto fixture: every test fails if the page made ANY request to a non-local host.
const test = base.extend<{ external: string[] }>({
  external: [
    async ({ page }, use) => {
      const hits: string[] = [];
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (/^(https?|wss?):$/.test(u.protocol) && !LOCAL.has(u.hostname))
          hits.push(r.url());
      });
      await use(hits);
      expect(hits, "requests that left localhost").toEqual([]);
    },
    { auto: true },
  ],
});

test.describe.configure({ mode: "serial" });

test("setup, add a product with a photo, record a sale, visit every page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);

  await page.getByPlaceholder("Shop name").fill("E2E Shop");
  await page.getByPlaceholder("Password (12+ characters)").fill(PW);
  await page.getByPlaceholder("Repeat password").fill(PW);
  await page.getByRole("button", { name: "Create vault" }).click();

  // recovery code screen: prove "I wrote it down" by typing the last 6 characters
  const code = (await page.locator("code").first().innerText()).trim();
  await page.getByLabel(/last 6 characters/i).fill(code.slice(-6));
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto("/products/new");
  await page.getByPlaceholder("SKU", { exact: true }).fill("E2E-1");
  await page.getByPlaceholder("Name", { exact: true }).fill("E2E Ring");
  await page.getByPlaceholder("Selling price").fill("1500");
  await page.getByPlaceholder("Opening stock").fill("5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);

  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#c0392b" },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "ring.png", mimeType: "image/png", buffer: png });
  const thumb = page.locator('img[src*="/api/images/"]').first();
  await expect(thumb).toBeVisible();
  await expect
    .poll(() =>
      thumb.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth),
    )
    .toBeGreaterThan(0);

  await page.getByPlaceholder("Qty").fill("1");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  for (const path of [
    "/dashboard",
    "/products",
    "/buylist",
    "/categories",
    "/import",
    "/settings",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("lock, wrong password is rejected, right password unlocks, locked API returns 401", async ({
  page,
}) => {
  // new browser context = no cookie, so the app sends us to the unlock screen
  await page.goto("/products");
  await expect(page).toHaveURL(/\/unlock$/);
  await page.getByPlaceholder("Password", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText("E2E Ring")).toBeVisible();

  await page.getByRole("button", { name: "Lock" }).click();
  await expect(page).toHaveURL(/\/unlock$/);
  expect((await page.request.get("/api/backup")).status()).toBe(401);

  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("definitely the wrong one");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Wrong password.")).toBeVisible();

  await page.waitForTimeout(2500); // the throttle after one failure is 2 seconds
  await page.getByPlaceholder("Password", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/products$/);
});
