import { test, expect } from '@playwright/test';
import { waitForAppReady, selectTemplate } from './fixtures/test-helpers';

test.describe('Canvas interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await selectTemplate(page, 'template_c');
  });

  test('drag node changes its position', async ({ page }) => {
    const node = page.locator('[data-testid="node-card"], .node-card').first();
    const box = await node.boundingBox();
    if (!box) return;

    await node.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 80, { steps: 5 });
    await page.mouse.up();

    const newBox = await node.boundingBox();
    expect(newBox!.x).not.toBe(box.x);
  });

  test('wheel zoom changes viewport scale', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-board"], .canvas-board').first();
    const before = await canvas.evaluate((el) => el.style.transform || '');

    await canvas.hover();
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(200);

    const after = await canvas.evaluate((el) => el.style.transform || '');
    // Transform string should differ after zoom
    expect(after).not.toBe(before);
  });

  test('box-select selects multiple nodes', async ({ page }) => {
    const canvas = page.locator('[data-testid="canvas-board"], .canvas-board').first();
    const box = await canvas.boundingBox();
    if (!box) return;

    // Draw a large selection rectangle across the canvas
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(200);
    const selected = await page.locator('.node-card.selected, [data-selected="true"]').count();
    expect(selected).toBeGreaterThanOrEqual(2);
  });
});
