import { expect, test } from "@playwright/test";

test("配布物を読んだページで版を返す", async ({ page }) => {
	await page.goto("/tests/e2e/index.html");
	await expect(page.locator("body")).toHaveAttribute(
		"data-version",
		"v0.0.0-poc",
	);
});
