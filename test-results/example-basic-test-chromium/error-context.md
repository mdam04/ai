# Test info

- Name: basic test
- Location: C:\Users\SST\playwright-genius\tests\example.spec.ts:3:5

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toHaveTitle(expected)

Locator: locator(':root')
Expected pattern: /Next.js/
Received string:  "Playwright Genius"
Call log:
  - expect.toHaveTitle with timeout 5000ms
  - waiting for locator(':root')
    8 × locator resolved to <html lang="en">…</html>
      - unexpected value "Playwright Genius"

    at C:\Users\SST\playwright-genius\tests\example.spec.ts:8:22
```

# Page snapshot

```yaml
- banner:
  - link "Playwright Genius":
    - /url: /
    - img
    - text: Playwright Genius
  - navigation
- main:
  - text: Analyze Application Enter the GitHub repository URL and the live application URL to begin analysis.
  - img
  - text: GitHub Repository URL
  - textbox "GitHub Repository URL"
  - img
  - text: Application URL
  - textbox "Application URL"
  - button "Analyze Repository"
  - img
  - text: GitHub API Token (Optional)
  - textbox "GitHub API Token (Optional)"
  - paragraph: Token is stored in your browser's local storage. Leave blank for public repositories (rate limits may apply).
- region "Notifications (F8)":
  - list
- button "Open Next.js Dev Tools":
  - img
- alert
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 |
  3 | test('basic test', async ({ page }) => {
  4 |   // Navigate to your application
  5 |   await page.goto('http://localhost:9002');
  6 |   
  7 |   // Add a simple assertion
> 8 |   await expect(page).toHaveTitle(/Next.js/);
    |                      ^ Error: Timed out 5000ms waiting for expect(locator).toHaveTitle(expected)
  9 | }); 
```