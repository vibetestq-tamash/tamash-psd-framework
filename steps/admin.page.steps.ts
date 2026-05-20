import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

Before(async function (this: CustomWorld) {
  this.currentStepFile = __filename;
});

// ── Selectors ──────────────────────────────────────────
const ADMIN_MENU_ITEM = (label: string) => `.oxd-topbar-body-nav-tab:has-text("${label}")`;
const ADMIN_SUBMENU_ITEM = (label: string) => `.oxd-topbar-body-nav-tab-link:has-text("${label}")`;
const ADD_BUTTON = 'button:has-text("Add")';
const SAVE_BUTTON = 'button[type="submit"]';
const DELETE_BUTTON = 'button:has-text("Delete")';
const SEARCH_BUTTON = 'button[type="submit"]';
const USER_ROLE_DROPDOWN = '.oxd-select-text >> nth=0';
const STATUS_DROPDOWN = '.oxd-select-text >> nth=1';
const USERNAME_INPUT = 'input[placeholder="Username"]';
const PASSWORD_INPUT = 'input[placeholder="Password"]';
const CONFIRM_PASSWORD_INPUT = 'input[placeholder="Confirm Password"]';
const EMPLOYEE_NAME_INPUT = 'input[placeholder="Type for hints..."]';
const SUCCESS_TOAST = '.oxd-toast-content-text';
const TABLE_ROWS = '.oxd-table-body .oxd-table-row';
const TABLE_CELL = (text: string) => `.oxd-table-cell:has-text("${text}")`;
const EDIT_ICON = (username: string) => `.oxd-table-row:has-text("${username}") .oxd-icon.bi-pencil-fill`;
const CHECKBOX = (username: string) => `.oxd-table-row:has-text("${username}") .oxd-checkbox-input`;
const CONFIRM_DELETE_BUTTON = '.oxd-button--label-danger';
const SEARCH_USERNAME_INPUT = 'input.oxd-input >> nth=0';
const ROLE_FILTER_DROPDOWN = '.oxd-select-text >> nth=0';

// ── Admin Navigation Steps ──────────────────────────────

Given('I navigate to the Admin module', async function (this: CustomWorld) {
  await this.page.click('.oxd-main-menu-item >> text=Admin');
  await this.page.waitForURL('**/admin/**');
});

When('I click {string} from the Admin menu', async function (this: CustomWorld, label: string) {
  await this.page.click(ADMIN_MENU_ITEM(label));
  await expect(this.page.locator(ADMIN_SUBMENU_ITEM('Users')).or(
    this.page.locator(ADMIN_SUBMENU_ITEM('Job Titles'))
  ).or(this.page.locator(ADMIN_SUBMENU_ITEM('Locations')))).toBeVisible();
});

When('I click {string} from the submenu', async function (this: CustomWorld, label: string) {
  await this.page.click(ADMIN_SUBMENU_ITEM(label));
  await this.page.waitForLoadState('networkidle');
});

// Generic click handler moved to steps/shared.generic.steps.ts

// ── Add User Steps ──────────────────────────────────────

When('I select the user role {string}', async function (this: CustomWorld, role: string) {
  await this.page.click(USER_ROLE_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${role}")`);
});

When('I search and select the employee name {string}', async function (this: CustomWorld, name: string) {
  await this.page.fill(EMPLOYEE_NAME_INPUT, name.split(' ')[0]);
  await this.page.waitForSelector('.oxd-autocomplete-option');
  await this.page.click(`.oxd-autocomplete-option:has-text("${name}")`);
});

When('I select the status {string}', async function (this: CustomWorld, status: string) {
  await this.page.click(STATUS_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${status}")`);
});

When('I enter the username {string}', async function (this: CustomWorld, username: string) {
  await this.page.fill(USERNAME_INPUT, username);
  this.data.lastUsername = username;
});

When('I enter the password {string}', async function (this: CustomWorld, password: string) {
  await this.page.fill(PASSWORD_INPUT, password);
});

When('I confirm the password {string}', async function (this: CustomWorld, password: string) {
  await this.page.fill(CONFIRM_PASSWORD_INPUT, password);
});

// Save handled by generic click handler in steps/shared.generic.steps.ts

Then('the user {string} should be created successfully', async function (this: CustomWorld, username: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

Then('it should appear in the users list', async function (this: CustomWorld) {
  await expect(this.page.locator(TABLE_CELL(this.data.lastUsername))).toBeVisible();
});

// ── Search Steps ────────────────────────────────────────

When('I enter username {string} in the search field', async function (this: CustomWorld, username: string) {
  await this.page.fill(SEARCH_USERNAME_INPUT, username);
});

// Search handled by generic click handler in steps/shared.generic.steps.ts

Then('the users list should display results containing {string}', async function (this: CustomWorld, text: string) {
  const count = await this.page.locator(TABLE_ROWS).count();
  expect(count).toBeGreaterThan(0);
  await expect(this.page.locator(TABLE_CELL(text)).first()).toBeVisible();
});

When('I select the user role filter {string}', async function (this: CustomWorld, role: string) {
  await this.page.click(ROLE_FILTER_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${role}")`);
});

Then('all displayed users should have the role {string}', async function (this: CustomWorld, role: string) {
  const rows = this.page.locator(TABLE_ROWS);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(role);
  }
});

// ── Edit User Steps ─────────────────────────────────────

Given('a system user {string} exists', async function (this: CustomWorld, username: string) {
  this.data.targetUsername = username;
});

When('I click the edit icon for user {string}', async function (this: CustomWorld, username: string) {
  await this.page.click(EDIT_ICON(username));
  await this.page.waitForLoadState('networkidle');
});

When('I change the status to {string}', async function (this: CustomWorld, status: string) {
  await this.page.click(STATUS_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${status}")`);
});

// Success message assertion moved to steps/shared.generic.steps.ts

Then('the user {string} should have status {string}', async function (this: CustomWorld, username: string, status: string) {
  await expect(this.page.locator(`.oxd-table-row:has-text("${username}")`)).toContainText(status);
});

// ── Delete User Steps ───────────────────────────────────

// Checkbox selection moved to steps/shared.generic.steps.ts

// Delete button handled by generic click handler in steps/shared.generic.steps.ts

// Confirm deletion moved to steps/shared.generic.steps.ts

Then('{string} should no longer appear in the users list', async function (this: CustomWorld, username: string) {
  await expect(this.page.locator(TABLE_CELL(username))).not.toBeVisible();
});

// ── Job Title Steps ─────────────────────────────────────

When('I enter the job title {string}', async function (this: CustomWorld, title: string) {
  await this.page.fill('input.oxd-input >> nth=0', title);
  this.data.lastJobTitle = title;
});

When('I enter the job description {string}', async function (this: CustomWorld, description: string) {
  await this.page.fill('textarea.oxd-textarea', description);
});

Then('the job title {string} should be created successfully', async function (this: CustomWorld, title: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── Pay Grade Steps ─────────────────────────────────────

When('I enter the pay grade name {string}', async function (this: CustomWorld, name: string) {
  await this.page.fill('input.oxd-input >> nth=0', name);
});

Then('the pay grade {string} should be created successfully', async function (this: CustomWorld, name: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── Employment Status Steps ─────────────────────────────

When('I enter the employment status {string}', async function (this: CustomWorld, status: string) {
  await this.page.fill('input.oxd-input >> nth=0', status);
});

Then('the employment status {string} should be created successfully', async function (this: CustomWorld, status: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── Location Steps ──────────────────────────────────────

When('I enter the location name {string}', async function (this: CustomWorld, name: string) {
  await this.page.fill('input.oxd-input >> nth=0', name);
});

When('I select the country {string}', async function (this: CustomWorld, country: string) {
  await this.page.click('.oxd-select-text >> nth=0');
  await this.page.click(`.oxd-select-option:has-text("${country}")`);
});

When('I enter the state {string}', async function (this: CustomWorld, state: string) {
  await this.page.fill('input[placeholder="Province/State"]', state);
});

When('I enter the city {string}', async function (this: CustomWorld, city: string) {
  await this.page.fill('input[placeholder="City"]', city);
});

Then('the location {string} should be created successfully', async function (this: CustomWorld, name: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── General Info Steps ──────────────────────────────────

Then('I should see the organization general information page', async function (this: CustomWorld) {
  await expect(this.page.locator('h6.oxd-text')).toContainText('General Information');
});

Then('it should display the organization name and details', async function (this: CustomWorld) {
  await expect(this.page.locator('input.oxd-input >> nth=0')).toBeVisible();
});

// ── Nationality Steps ───────────────────────────────────

When('I enter the nationality name {string}', async function (this: CustomWorld, nationality: string) {
  await this.page.fill('input.oxd-input >> nth=0', nationality);
});

Then('the nationality {string} should be created successfully', async function (this: CustomWorld, nationality: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── Outline Step ────────────────────────────────────────

When('I add a new user with role {string} for employee {string}', async function (this: CustomWorld, role: string, employee: string) {
  await this.page.click(ADD_BUTTON);
  await this.page.click(USER_ROLE_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${role}")`);
  await this.page.fill(EMPLOYEE_NAME_INPUT, employee.split(' ')[0]);
  await this.page.waitForSelector('.oxd-autocomplete-option');
  await this.page.click(`.oxd-autocomplete-option:has-text("${employee}")`);
  await this.page.click(STATUS_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("Enabled")`);
  this.data.newUserRole = role;
});

Then('the new user should be created with role {string}', async function (this: CustomWorld, role: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});
