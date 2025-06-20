
import { test, expect } from '@playwright/test';

test.describe('Navigate to non existing route', () => {
  test('should successfully complete: Navigate to non existing route', async ({ page }) => {
    await page.goto('http://localhost:8080/non-existing-route');
    await expect(page.getByText("404")).toBeVisible();
  });
});
  