import { test, expect } from '@playwright/test';
import { waitForAppReady, selectTemplate, getNodeCount, getEdgeCount } from './fixtures/test-helpers';

test.describe('Template selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('selecting Template A populates canvas with nodes', async ({ page }) => {
    await selectTemplate(page, 'template_a');
    const count = await getNodeCount(page);
    expect(count).toBeGreaterThan(0);
  });

  test('selecting Template C creates 5 nodes and 4 connections', async ({ page }) => {
    await selectTemplate(page, 'template_c');
    const nodes = await getNodeCount(page);
    const edges = await getEdgeCount(page);
    expect(nodes).toBe(5);
    expect(edges).toBe(4);
  });

  test('blank workflow has no nodes', async ({ page }) => {
    await selectTemplate(page, 'blank');
    const count = await getNodeCount(page);
    expect(count).toBe(0);
  });

  test('switching template clears old nodes', async ({ page }) => {
    await selectTemplate(page, 'template_a');
    const firstCount = await getNodeCount(page);
    expect(firstCount).toBeGreaterThan(0);

    await selectTemplate(page, 'template_c');
    const secondCount = await getNodeCount(page);
    // Should have Template C's nodes, not accumulated
    expect(secondCount).toBe(5);
  });
});
