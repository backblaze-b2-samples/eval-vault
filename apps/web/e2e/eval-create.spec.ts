import { test, expect } from "@playwright/test";

test.describe("Create eval flow", () => {
  test("should display the create-eval form", async ({ page }) => {
    await page.goto("/evals/new");
    await expect(page).toHaveURL(/evals\/new/);
    // The form's first field renders.
    await expect(page.getByText("Name", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create eval/i }),
    ).toBeVisible();
  });

  test("should reach the form from the evals page", async ({ page }) => {
    await page.goto("/evals");
    await page.getByRole("link", { name: /create eval/i }).first().click();
    await expect(page).toHaveURL(/evals\/new/);
  });
});
