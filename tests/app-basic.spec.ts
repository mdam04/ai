import { test, expect } from '@playwright/test';

test.describe('Playwright Genius App', () => {
  test('should load the homepage correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/Playwright Genius/);
    
    // Check main heading
    await expect(page.getByText('Analyze Application')).toBeVisible();
    
    // Check form elements
    await expect(page.getByLabel('GitHub Repository URL')).toBeVisible();
    await expect(page.getByLabel('Application URL')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze Repository' })).toBeVisible();
  });

  test('should show validation errors for invalid URLs', async ({ page }) => {
    await page.goto('/');
    
    // Fill in invalid URLs
    await page.getByLabel('GitHub Repository URL').fill('invalid-url');
    await page.getByLabel('Application URL').fill('also-invalid');
    
    // Try to submit
    await page.getByRole('button', { name: 'Analyze Repository' }).click();
    
    // Should show validation errors
    await expect(page.getByText('Please enter a valid GitHub repository URL.')).toBeVisible();
    await expect(page.getByText('Please enter a valid application URL.')).toBeVisible();
  });

  test('should accept valid URLs', async ({ page }) => {
    await page.goto('/');
    
    // Fill in valid URLs
    await page.getByLabel('GitHub Repository URL').fill('https://github.com/microsoft/playwright');
    await page.getByLabel('Application URL').fill('https://playwright.dev');
    
    // Submit button should be enabled and clickable
    const submitButton = page.getByRole('button', { name: 'Analyze Repository' });
    await expect(submitButton).toBeEnabled();
    
    // Click submit (this will start the analysis process)
    await submitButton.click();
    
    // Should show loading state
    await expect(page.getByText('Analyzing...')).toBeVisible();
  });
});