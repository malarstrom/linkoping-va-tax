import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('persists a profile revision across reload', async ({ page }) => {
  await page.goto('/');

  const nameInput = page.getByTestId('profile-name-input');
  await expect(nameInput).toHaveValue('Ny fastighet');

  await nameInput.fill('QA-fastighet');
  await expect(page.getByText('QA-fastighet')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('profile-name-input')).toHaveValue('QA-fastighet');
  await expect(page.getByText('Revisioner:')).toBeVisible();
});

test('reruns a saved calculation against another taxeversion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Resultat' }).click();

  await page.getByTestId('save-calculation-button').click();
  await expect(page.getByText('Sparad beräkning')).toBeVisible();
  await expect(page.getByTestId('tax-version-select')).toContainText('Taxa 2026-09-01');

  await page.getByTestId('tax-version-select').click();
  await page.getByRole('option', { name: 'Taxa 2026-01-01 (arkivkopia)' }).click();

  await page.getByTestId('rerun-calculation-button').click();

  await expect(page.getByTestId('tax-version-select')).toContainText('Taxa 2026-01-01 (arkivkopia)');
});

test('exports and imports with conflict handling', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-json-button').click();
  const download = await downloadPromise;

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'va-taxemotor-'));
  const exportPath = path.join(dir, 'workspace.json');
  await download.saveAs(exportPath);

  await page.getByTestId('profile-name-input').fill('Efter export');
  await expect(page.getByText('Efter export')).toBeVisible();

  await page.getByTestId('import-json-button').click();
  await page.locator('input[type="file"]').setInputFiles(exportPath);

  await expect(page.getByText('Importkonflikter')).toBeVisible();
  await page.locator('[data-testid^="import-resolution-"]').first().click();
  await page.getByRole('option', { name: 'Behåll nuvarande' }).click();
  await page.getByRole('button', { name: 'Importera val' }).click();

  await expect(page.getByTestId('profile-name-input')).toHaveValue('Efter export');
});
