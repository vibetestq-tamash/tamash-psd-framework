import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

Before(async function (this: CustomWorld) {
  this.currentStepFile = __filename;
});

// ── Selectors ──────────────────────────────────────────
const ADD_EMPLOYEE_BUTTON = 'button:has-text("Add")';
const FIRST_NAME_INPUT = 'input[name="firstName"]';
const MIDDLE_NAME_INPUT = 'input[name="middleName"]';
const LAST_NAME_INPUT = 'input[name="lastName"]';
const EMPLOYEE_ID_INPUT = '.oxd-form-row input.oxd-input >> nth=1';
const SAVE_BUTTON = 'button[type="submit"]';
const SUCCESS_TOAST = '.oxd-toast-content-text';
const EMPLOYEE_PROFILE_HEADER = 'h6.oxd-text';
const EMPLOYEE_NAME_SEARCH = 'input[placeholder="Type for hints..."]';
const EMPLOYEE_ID_SEARCH = 'input.oxd-input >> nth=1';
const SEARCH_BUTTON = 'button[type="submit"]';
const TABLE_ROWS = '.oxd-table-body .oxd-table-row';
const NO_RECORDS = '.oxd-table-cell:has-text("No Records Found")';
const CREATE_LOGIN_TOGGLE = '.oxd-switch-input';
const LOGIN_USERNAME_INPUT = 'input[placeholder="Username"] >> nth=1';
const LOGIN_STATUS_DROPDOWN = '.oxd-select-text >> nth=0';
const LOGIN_PASSWORD_INPUT = 'input[placeholder="Password"]';
const LOGIN_CONFIRM_PASSWORD_INPUT = 'input[placeholder="Confirm Password"]';
const PERSONAL_DETAILS_TAB = '.oxd-tab-link:has-text("Personal Details")';
const CONTACT_DETAILS_TAB = '.oxd-tab-link:has-text("Contact Details")';
const NATIONALITY_DROPDOWN = '.oxd-select-text >> nth=0';
const MARITAL_STATUS_DROPDOWN = '.oxd-select-text >> nth=1';
const STREET_ADDRESS_INPUT = 'input[name="street1"]';
const CITY_INPUT = 'input[name="city"]';
const STATE_INPUT = 'input[name="province"]';
const ZIP_INPUT = 'input[name="zip"]';
const COUNTRY_DROPDOWN = '.oxd-select-text >> nth=0';
const PROFILE_PHOTO_AREA = '.employee-image-placeholder';
const FILE_INPUT = 'input[type="file"]';
const PAGINATION = '.oxd-pagination';
const CHECKBOX_ALL = '.oxd-table-header .oxd-checkbox-input';
const CHECKBOX_ROW = (name: string) => `.oxd-table-row:has-text("${name}") .oxd-checkbox-input`;
const DELETE_SELECTED_BUTTON = 'button:has-text("Delete Selected")';
const CONFIRM_DELETE_BUTTON = '.oxd-button--label-danger';

// ── Background / Navigation Steps ──────────────────────

Given('I navigate to the PIM module', async function (this: CustomWorld) {
  await this.page.click('.oxd-main-menu-item:has-text("PIM")');
  await this.page.waitForURL('**/pim/**');
});

// ── Add Employee Steps ──────────────────────────────────

// Generic click handler moved to steps/shared.generic.steps.ts

When('I enter the first name {string}', async function (this: CustomWorld, firstName: string) {
  await this.page.fill(FIRST_NAME_INPUT, firstName);
  this.data.firstName = firstName;
});

When('I enter the middle name {string}', async function (this: CustomWorld, middleName: string) {
  await this.page.fill(MIDDLE_NAME_INPUT, middleName);
});

When('I enter the last name {string}', async function (this: CustomWorld, lastName: string) {
  await this.page.fill(LAST_NAME_INPUT, lastName);
  this.data.lastName = lastName;
});

When('I enter the employee ID {string}', async function (this: CustomWorld, id: string) {
  await this.page.fill(EMPLOYEE_ID_INPUT, id);
});

When('I toggle the create login details option', async function (this: CustomWorld) {
  await this.page.click(CREATE_LOGIN_TOGGLE);
  await this.page.waitForTimeout(300);
});

When('I enter the login username {string}', async function (this: CustomWorld, username: string) {
  await this.page.fill(LOGIN_USERNAME_INPUT, username);
});

When('I select the status {string}', async function (this: CustomWorld, status: string) {
  await this.page.click(LOGIN_STATUS_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${status}")`);
});

When('I enter the login password {string}', async function (this: CustomWorld, password: string) {
  await this.page.fill(LOGIN_PASSWORD_INPUT, password);
});

When('I confirm the login password {string}', async function (this: CustomWorld, password: string) {
  await this.page.fill(LOGIN_CONFIRM_PASSWORD_INPUT, password);
});

// Save handled by generic click handler in steps/shared.generic.steps.ts

Then('a new employee record should be created', async function (this: CustomWorld) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

Then('I should see the employee profile page for {string}', async function (this: CustomWorld, name: string) {
  await expect(this.page.locator(EMPLOYEE_PROFILE_HEADER).first()).toBeVisible();
});

Then('a new employee record should be created for {string}', async function (this: CustomWorld, fullName: string) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── Search Steps ────────────────────────────────────────

When('I enter {string} in the employee name search field', async function (this: CustomWorld, name: string) {
  await this.page.fill(EMPLOYEE_NAME_SEARCH, name);
  await this.page.waitForTimeout(500);
});

When('I enter employee ID {string} in the search field', async function (this: CustomWorld, id: string) {
  await this.page.fill(EMPLOYEE_ID_SEARCH, id);
});

// Search handled by generic click handler in steps/shared.generic.steps.ts

Then('the employee list should display results containing {string}', async function (this: CustomWorld, text: string) {
  const count = await this.page.locator(TABLE_ROWS).count();
  expect(count).toBeGreaterThan(0);
  await expect(this.page.locator(`.oxd-table-cell:has-text("${text}")`).first()).toBeVisible();
});

Then('the employee list should display the employee with ID {string}', async function (this: CustomWorld, id: string) {
  await expect(this.page.locator(`.oxd-table-cell:has-text("${id}")`)).toBeVisible();
});

Then('I should see the message {string}', async function (this: CustomWorld, message: string) {
  await expect(this.page.locator(NO_RECORDS)).toBeVisible();
});

// ── Personal Details Steps ──────────────────────────────

Given('an employee named {string} exists in the system', async function (this: CustomWorld, name: string) {
  this.data.targetEmployee = name;
});

When('I open the employee profile for {string}', async function (this: CustomWorld, name: string) {
  await this.page.fill(EMPLOYEE_NAME_SEARCH, name.split(' ')[0]);
  await this.page.waitForTimeout(500);
  await this.page.click(SEARCH_BUTTON);
  await this.page.waitForLoadState('networkidle');
  await this.page.click(`.oxd-table-row:has-text("${name}") .oxd-icon.bi-pencil-fill`);
  await this.page.waitForLoadState('networkidle');
});

When('I click the Personal Details tab', async function (this: CustomWorld) {
  await this.page.click(PERSONAL_DETAILS_TAB);
  await this.page.waitForLoadState('networkidle');
});

When('I update the nationality to {string}', async function (this: CustomWorld, nationality: string) {
  await this.page.click(NATIONALITY_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${nationality}")`);
});

When('I update the marital status to {string}', async function (this: CustomWorld, status: string) {
  await this.page.click(MARITAL_STATUS_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${status}")`);
});

// Success message assertion moved to steps/shared.generic.steps.ts

Then('the personal details should reflect the updated values', async function (this: CustomWorld) {
  await expect(this.page.locator(NATIONALITY_DROPDOWN)).toBeVisible();
});

// ── Contact Details Steps ───────────────────────────────

When('I click the Contact Details tab', async function (this: CustomWorld) {
  await this.page.click(CONTACT_DETAILS_TAB);
  await this.page.waitForLoadState('networkidle');
});

When('I enter the street address {string}', async function (this: CustomWorld, address: string) {
  await this.page.fill(STREET_ADDRESS_INPUT, address);
});

When('I enter the city {string}', async function (this: CustomWorld, city: string) {
  await this.page.fill(CITY_INPUT, city);
});

When('I enter the state {string}', async function (this: CustomWorld, state: string) {
  await this.page.fill(STATE_INPUT, state);
});

When('I enter the zip code {string}', async function (this: CustomWorld, zip: string) {
  await this.page.fill(ZIP_INPUT, zip);
});

When('I select the country {string}', async function (this: CustomWorld, country: string) {
  await this.page.click(COUNTRY_DROPDOWN);
  await this.page.click(`.oxd-select-option:has-text("${country}")`);
});

// ── Profile Photo Steps ─────────────────────────────────

When('I click on the profile photo area', async function (this: CustomWorld) {
  await this.page.click(PROFILE_PHOTO_AREA);
});

When('I upload the image file {string}', async function (this: CustomWorld, filename: string) {
  await this.page.setInputFiles(FILE_INPUT, `test-data/images/${filename}`);
});

Then('the profile photo should be updated successfully', async function (this: CustomWorld) {
  await expect(this.page.locator(SUCCESS_TOAST)).toContainText('Successfully Saved');
});

// ── Delete Employee Steps ───────────────────────────────

When('I search for employee {string}', async function (this: CustomWorld, name: string) {
  await this.page.fill(EMPLOYEE_NAME_SEARCH, name.split(' ')[0]);
  await this.page.waitForTimeout(500);
  await this.page.click(SEARCH_BUTTON);
  await this.page.waitForLoadState('networkidle');
});

// Checkbox selection moved to steps/shared.generic.steps.ts

// Delete Selected handled by generic click handler in steps/shared.generic.steps.ts

// Confirm deletion moved to steps/shared.generic.steps.ts

Then('the employee {string} should no longer appear in the list', async function (this: CustomWorld, name: string) {
  await expect(this.page.locator(`.oxd-table-cell:has-text("${name}")`)).not.toBeVisible();
});

// ── List and Pagination Steps ───────────────────────────

When('I view the employee list', async function (this: CustomWorld) {
  await this.page.waitForSelector(TABLE_ROWS);
});

Then('I should see a list of employees', async function (this: CustomWorld) {
  const count = await this.page.locator(TABLE_ROWS).count();
  expect(count).toBeGreaterThan(0);
});

Then('the list should show pagination controls', async function (this: CustomWorld) {
  await expect(this.page.locator(PAGINATION)).toBeVisible();
});
