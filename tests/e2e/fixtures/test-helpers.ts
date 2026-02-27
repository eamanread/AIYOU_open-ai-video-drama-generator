/**
 * E2E test helpers — shared locators and wait utilities.
 */

import { Page, expect } from '@playwright/test';

/** Wait for the app to finish initial hydration. */
export async function waitForAppReady(page: Page) {
  // The app renders either a welcome screen or the canvas container
  await page.waitForSelector('[data-testid="app-root"], [data-testid="canvas-board"], .welcome-screen', {
    timeout: 15_000,
  });
  // No uncaught JS errors
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // Give a moment for any async hydration
  await page.waitForTimeout(500);
  return errors;
}

/** Click a template card by template ID. */
export async function selectTemplate(page: Page, templateId: string) {
  await page.click(`[data-template-id="${templateId}"]`);
  await page.waitForTimeout(300); // animation settle
}

/** Count visible nodes on the canvas. */
export async function getNodeCount(page: Page): Promise<number> {
  return page.locator('[data-testid="node-card"], .node-card').count();
}

/** Count visible connections/edges on the canvas. */
export async function getEdgeCount(page: Page): Promise<number> {
  return page.locator('[data-testid="connection-line"], .connection-line, path.edge').count();
}

/** Get the node status badge text for a given node. */
export async function getNodeStatus(page: Page, nodeId: string): Promise<string | null> {
  const badge = page.locator(`[data-node-id="${nodeId}"] [data-testid="status-badge"]`);
  if (await badge.count() === 0) return null;
  return badge.getAttribute('data-status');
}
