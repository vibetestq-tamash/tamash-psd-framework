import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

Before(async function (this: CustomWorld) {
  this.currentStepFile = __filename;
});

// ── Selectors ──────────────────────────────────────────
const USERNAME_INPUT = '[name="username"]';
const PASSWORD_INPUT = '[name="password"]';
const LOGIN_BUTTON = 'button:has-text("Login")';
const ERROR_MESSAGE = '.oxd-alert-content-text';
const REQUIRED_ERROR = '.oxd-input-field-error-message';
const DASHBOARD_HEADER = 'h6.oxd-text';
const NAV_MENU = '.oxd-sidepanel';
const USER_PROFILE_MENU = '.oxd-userdropdown-tab';
const LOGOUT_OPTION = '.oxd-userdropdown-link >> text=Logout';
const LOGIN_PAGE_TITLE = '.orangehrm-login-title';

// ── Steps ──────────────────────────────────────────────

Given('I navigate to the OrangeHRM login page {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await expect(this.page.locator(LOGIN_PAGE_TITLE)).toBeVisible();
});

When('I enter username {string}', async function (this: CustomWorld, username: string) {
  await this.page.fill(USERNAME_INPUT, username);
});

When('I enter password {string}', async function (this: CustomWorld, password: string) {
  await this.page.fill(PASSWORD_INPUT, password);
});

When('I click the Login button', async function (this: CustomWorld) {
  await this.page.click(LOGIN_BUTTON);
});

When('I leave the username field empty', async function (this: CustomWorld) {
  await this.page.fill(USERNAME_INPUT, '');
});

When('I leave the password field empty', async function (this: CustomWorld) {
  await this.page.fill(PASSWORD_INPUT, '');
});

When('I click on the user profile menu', async function (this: CustomWorld) {
  await this.page.click(USER_PROFILE_MENU);
  await expect(this.page.locator(LOGOUT_OPTION)).toBeVisible();
});

When('I click the Logout option', async function (this: CustomWorld) {
  await this.page.click(LOGOUT_OPTION);
});

Then('I should be redirected to the Dashboard', async function (this: CustomWorld) {
  await this.page.waitForURL('**/dashboard/**');
  await expect(this.page.locator(DASHBOARD_HEADER).first()).toContainText('Dashboard');
});

Then('I should see the navigation menu', async function (this: CustomWorld) {
  await expect(this.page.locator(NAV_MENU)).toBeVisible();
});

Then('I should see the error message {string}', async function (this: CustomWorld, message: string) {
  await expect(this.page.locator(ERROR_MESSAGE)).toContainText(message);
});

Then('I should remain on the login page', async function (this: CustomWorld) {
  await expect(this.page.locator(LOGIN_PAGE_TITLE)).toBeVisible();
});

Then('I should see the required field error for username', async function (this: CustomWorld) {
  await expect(this.page.locator(REQUIRED_ERROR).first()).toContainText('Required');
});

Then('I should see the required field error for password', async function (this: CustomWorld) {
  await expect(this.page.locator(REQUIRED_ERROR).last()).toContainText('Required');
});

Then('the password field should display masked characters', async function (this: CustomWorld) {
  const inputType = await this.page.locator(PASSWORD_INPUT).getAttribute('type');
  expect(inputType).toBe('password');
});

Then('I should be redirected to the login page', async function (this: CustomWorld) {
  await this.page.waitForURL('**/login');
  await expect(this.page.locator(LOGIN_PAGE_TITLE)).toBeVisible();
});

Then('I should see the {string} after login', async function (this: CustomWorld, result: string) {
  if (result === 'Dashboard') {
    await expect(this.page.locator(DASHBOARD_HEADER).first()).toContainText('Dashboard');
  } else if (result === 'Invalid credentials') {
    await expect(this.page.locator(ERROR_MESSAGE)).toContainText('Invalid credentials');
  } else if (result === 'Required') {
    await expect(this.page.locator(REQUIRED_ERROR).first()).toContainText('Required');
  }
});
