import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

Before(async function (this: CustomWorld) {
  this.currentStepFile = __filename;
});

// ── Selectors ──────────────────────────────────────────
const DASHBOARD_HEADER = 'h6.oxd-text';
const NAV_MENU = '.oxd-sidepanel';
const QUICK_LAUNCH_SECTION = '.oxd-quick-launch';
const NAV_MENU_ITEM = (label: string) => `.oxd-main-menu-item:has-text("${label}")`;
const USER_PROFILE_AVATAR = '.oxd-userdropdown-tab';
const PROFILE_DROPDOWN = '.oxd-userdropdown-list';
const SEARCH_ICON = '.oxd-icon.bi-search';
const SEARCH_BAR = '[placeholder="Search"]';
const SEARCH_RESULTS = '.oxd-main-menu-item';
const SIDEBAR_TOGGLE = '.oxd-icon.bi-list';
const SIDEBAR = '.oxd-sidebar';
const QUICK_LAUNCH_WIDGET = (name: string) => `.oxd-quick-launch-card:has-text("${name}")`;
const WIDGET = (name: string) => `.oxd-grid-item:has-text("${name}")`;

// ── Shared Background Steps ──────────────────────────────
Given('I am logged in as {string} with password {string}', async function (this: CustomWorld, username: string, password: string) {
  this.data.username = username;
  this.data.password = password;
});

Given('the application URL is {string}', async function (this: CustomWorld, url: string) {
  await this.page.goto(url);
  await this.page.fill('[name="username"]', this.data.username);
  await this.page.fill('[name="password"]', this.data.password);
  await this.page.click('button:has-text("Login")');
  await this.page.waitForURL('**/dashboard/**');
});

// ── Dashboard Steps ──────────────────────────────────────

Then('I should be on the Dashboard page', async function (this: CustomWorld) {
  await expect(this.page.locator(DASHBOARD_HEADER).first()).toContainText('Dashboard');
});

Then('the dashboard header should display {string}', async function (this: CustomWorld, text: string) {
  await expect(this.page.locator(DASHBOARD_HEADER).first()).toContainText(text);
});

Then('the navigation menu should be visible', async function (this: CustomWorld) {
  await expect(this.page.locator(NAV_MENU)).toBeVisible();
});

When('I am on the Dashboard page', async function (this: CustomWorld) {
  await expect(this.page.locator(DASHBOARD_HEADER).first()).toContainText('Dashboard');
});

Then('I should see the Quick Launch section', async function (this: CustomWorld) {
  await expect(this.page.locator(QUICK_LAUNCH_SECTION)).toBeVisible();
});

Then('it should contain shortcut icons for key modules', async function (this: CustomWorld) {
  const count = await this.page.locator('.oxd-quick-launch-card').count();
  expect(count).toBeGreaterThan(0);
});

When('I click {string} in the navigation menu', async function (this: CustomWorld, label: string) {
  await this.page.click(NAV_MENU_ITEM(label));
});

Then('I should be on the PIM Employee List page', async function (this: CustomWorld) {
  await this.page.waitForURL('**/pim/**');
  await expect(this.page.locator(DASHBOARD_HEADER).first()).toBeVisible();
});

Then('the page title should display {string}', async function (this: CustomWorld, title: string) {
  await expect(this.page.locator(DASHBOARD_HEADER).first()).toContainText(title);
});

Then('I should be on the Leave module page', async function (this: CustomWorld) {
  await this.page.waitForURL('**/leave/**');
});

Then('I should be on the Recruitment Vacancies page', async function (this: CustomWorld) {
  await this.page.waitForURL('**/recruitment/**');
});

Then('I should be on the Admin User Management page', async function (this: CustomWorld) {
  await this.page.waitForURL('**/admin/**');
});

When('I click on the user profile avatar in the top bar', async function (this: CustomWorld) {
  await this.page.click(USER_PROFILE_AVATAR);
  await expect(this.page.locator(PROFILE_DROPDOWN)).toBeVisible();
});

Then('a dropdown menu should appear', async function (this: CustomWorld) {
  await expect(this.page.locator(PROFILE_DROPDOWN)).toBeVisible();
});

Then('the menu should display the logged-in username', async function (this: CustomWorld) {
  await expect(this.page.locator(PROFILE_DROPDOWN)).toContainText(this.data.username);
});

When('I click {string} from the dropdown', async function (this: CustomWorld, option: string) {
  await this.page.click(`.oxd-userdropdown-link >> text=${option}`);
});

Then('I should be on the My Info page', async function (this: CustomWorld) {
  await this.page.waitForURL('**/pim/viewMyDetails**');
});

Then('I should see the {string} widget', async function (this: CustomWorld, widgetName: string) {
  await expect(this.page.locator(WIDGET(widgetName))).toBeVisible();
});

When('I click on the search icon in the navigation', async function (this: CustomWorld) {
  await this.page.click(SEARCH_ICON);
  await expect(this.page.locator(SEARCH_BAR)).toBeVisible();
});

When('I type {string} in the search bar', async function (this: CustomWorld, text: string) {
  await this.page.fill(SEARCH_BAR, text);
});

Then('the search results should show relevant navigation links containing {string}', async function (this: CustomWorld, text: string) {
  const results = this.page.locator(SEARCH_RESULTS);
  const count = await results.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const linkText = await results.nth(i).textContent();
    expect(linkText?.toLowerCase()).toContain(text.toLowerCase());
  }
});

When('I click the sidebar toggle button', async function (this: CustomWorld) {
  await this.page.click(SIDEBAR_TOGGLE);
});

Then('the sidebar should collapse', async function (this: CustomWorld) {
  await expect(this.page.locator(SIDEBAR)).toHaveClass(/--collapsed/);
});

When('I click the sidebar toggle button again', async function (this: CustomWorld) {
  await this.page.click(SIDEBAR_TOGGLE);
});

Then('the sidebar should expand', async function (this: CustomWorld) {
  await expect(this.page.locator(SIDEBAR)).not.toHaveClass(/--collapsed/);
});
