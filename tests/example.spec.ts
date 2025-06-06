import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  // Navigate to your application
  await page.goto('/');
  
  // Add a simple assertion - check for the correct title
  await expect(page).toHaveTitle(/Playwright Genius/);
  
  // Check that the main heading is visible
  await expect(page.getByText('Analyze Application')).toBeVisible();
  
  // Check that the form inputs are present
  await expect(page.getByLabel('GitHub Repository URL')).toBeVisible();
  await expect(page.getByLabel('Application URL')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyze Repository' })).toBeVisible();
});