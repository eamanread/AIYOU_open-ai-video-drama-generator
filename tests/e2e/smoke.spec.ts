import { test, expect } from '@playwright/test';
import { waitForAppReady } from './fixtures/test-helpers';

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = await waitForAppReady(page);
    expect(errors).toHaveLength(0);
  });

  test('canvas or welcome screen is visible', async ({ page }) => {
    await waitForAppReady(page);
    const canvas = page.locator('[data-testid="canvas-board"], .canvas-board');
    const welcome = page.locator('.welcome-screen, [data-testid="welcome"]');
    const visible = (await canvas.count()) > 0 || (await welcome.count()) > 0;
    expect(visible).toBe(true);
  });

  test('settings panel can be opened', async ({ page }) => {
    await waitForAppReady(page);
    const settingsBtn = page.locator('[data-testid="settings-btn"], button:has-text("设置")');
    if (await settingsBtn.count() > 0) {
      await settingsBtn.first().click();
      await expect(
        page.locator('[data-testid="settings-panel"], .settings-panel, dialog')
      ).toBeVisible({ timeout: 3000 });
    }
  });
});
