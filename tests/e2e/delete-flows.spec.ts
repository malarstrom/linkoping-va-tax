import { expect, test } from '@playwright/test';

test('can delete a fastighet and reset to a fresh one', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('profile-name-input').fill('Radering');
  await expect(page.getByText('Radering')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid^="delete-profile-"]').first().click();

  await expect(page.getByTestId('profile-name-input')).toHaveValue('Ny fastighet');
});

test('can delete a saved calculation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Resultat' }).click();
  await page.getByTestId('save-calculation-button').click();

  await expect(page.getByText('Sparad beräkning')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-testid^="delete-calculation-"]').first().click();

  await expect(page.getByText('Inga sparade beräkningar.')).toBeVisible();
});
