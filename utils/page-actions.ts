import { Page } from '@playwright/test';

export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `reports/screenshots/${name}.png` });
}

export async function dismissAlertIfPresent(page: Page): Promise<void> {
  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
  });
}

export async function selectDropdownByText(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).selectOption({ label: text });
}

export async function clearAndFill(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).clear();
  await page.locator(selector).fill(value);
}
