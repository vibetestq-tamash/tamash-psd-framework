import { When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

Before(async function (this: CustomWorld) {
  this.currentStepFile = __filename;
});

// Generic click handler for any button by visible text
When('I click the {string} button', async function (this: CustomWorld, label: string) {
  await this.page.click(`button:has-text("${label}")`);
});

// Generic select option from first dropdown on page
When('I select the country {string}', async function (this: CustomWorld, country: string) {
  await this.page.click('.oxd-select-text');
  await this.page.click(`.oxd-select-option:has-text("${country}")`);
});

When('I select the status {string}', async function (this: CustomWorld, status: string) {
  await this.page.click('.oxd-select-text');
  await this.page.click(`.oxd-select-option:has-text("${status}")`);
});

When('I select the checkbox next to {string}', async function (this: CustomWorld, name: string) {
  await this.page.click(`.oxd-table-row:has-text("${name}") .oxd-checkbox-input`);
});

When('I confirm the deletion', async function (this: CustomWorld) {
  await this.page.click('.oxd-button--label-danger');
  await this.page.waitForLoadState('networkidle');
});

Then('I should see the success message {string}', async function (this: CustomWorld, message: string) {
  await expect(this.page.locator('.oxd-toast-content-text')).toContainText(message);
});
