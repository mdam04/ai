
import { test, expect } from '@playwright/test';

test.describe('Browse products and add a product to the cart', () => {
  test('should successfully complete: Browse products and add a product to the cart', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.getByRole('card').first().getByRole('button', {name: 'Add to Cart'}).click();
    const cartCount = await page.locator("//a[@href='/cart']//span[contains(@class,'rounded-full')]").innerText();
    await page.getByRole('link', { name: /ShopEase/ }).click();
    await page.getByRole('link', { name: /Cart \(\d+\)/ }).click();
    await expect(page.locator(".flex.items-center.py-6.border-b")).toBeVisible();
  });
});
  