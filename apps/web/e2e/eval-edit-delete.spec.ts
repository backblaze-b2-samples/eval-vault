import { test, expect } from "@playwright/test";

// Smoke coverage for the edit/delete UI. Like the create spec, these assert the
// client-rendered shell — a full round-trip (create → edit → delete against B2)
// is exercised manually with the dev servers up.
test.describe("Edit / delete eval flow", () => {
  test("edit route renders the Edit eval shell", async ({ page }) => {
    await page.goto("/evals/some-eval/edit");
    await expect(page).toHaveURL(/evals\/some-eval\/edit/);
    await expect(
      page.getByRole("heading", { name: /edit eval/i }),
    ).toBeVisible();
  });
});
