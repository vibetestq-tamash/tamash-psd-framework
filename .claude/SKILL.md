---
name: page-step-definitions-framework
description: >
  Use this skill to scaffold, build, or extend a Playwright + Cucumber test automation
  framework using the Page Step Definitions architecture. Trigger whenever the user asks
  to create a new test framework, add a new page step file, add hooks, set up the world
  object, create test data utilities, write feature files, or write step definitions for
  any page. Also trigger when the user asks to fix a broken step, resolve a parallel
  execution issue, or debug a Cucumber step conflict. This skill defines the ONLY
  correct architecture for this project — never fall back to POM, page classes, or
  class inheritance.
---

# Page Step Definitions — AI-Native Playwright + Cucumber Framework

## Core Architecture

```
Feature File
  → Page Step Definitions  (*.page.steps.ts)
    → Playwright
```

**The step definition file IS the page class — without the class wrapper.**

Never use:
- Page Object classes
- Base page classes
- Class inheritance
- Singleton `page` imports

Always use:
- `this.page` from the `CustomWorld` object
- Direct Playwright API calls
- Selectors as constants at the top of each step file

---

## Project Structure

```
/features
  login.feature
  invoice.feature

/steps
  login.page.steps.ts        ← one file per page
  invoice.page.steps.ts

/hooks
  hooks.ts                   ← Before/After lifecycle only

/utils
  world.ts                   ← CustomWorld definition
  page-actions.ts            ← shared Playwright utilities
  test-data.ts               ← Faker data generators
```

**Naming convention for step files:** `[page-name].page.steps.ts`

For complex pages, split by section:
```
checkout.address.page.steps.ts
checkout.payment.page.steps.ts
checkout.summary.page.steps.ts
```

---

## File Templates

### utils/world.ts

```ts
import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
import { BrowserContext, Page } from '@playwright/test';

export class CustomWorld extends World {
  page!: Page;
  context!: BrowserContext;
  data: Record<string, any> = {};

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
```

---

### hooks/hooks.ts

```ts
import { Before, After } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { CustomWorld } from '../utils/world';

Before(async function(this: CustomWorld) {
  const browser = await chromium.launch();
  this.context = await browser.newContext();
  this.page = await this.context.newPage();
});

After(async function(this: CustomWorld) {
  await this.context.close();
});
```

---

### [page].page.steps.ts — Step File Template

```ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

// ── Selectors ──────────────────────────────────────────
const SELECTOR_ONE = '#selector';
const SELECTOR_TWO = '.selector';

// ── Steps ──────────────────────────────────────────────
Given('...', async function(this: CustomWorld) {
  await this.page.goto('/path');
});

When('...', async function(this: CustomWorld) {
  await this.page.click(SELECTOR_ONE);
});

Then('...', async function(this: CustomWorld) {
  await expect(this.page.locator(SELECTOR_TWO)).toBeVisible();
});
```

**Rules for every step file:**
1. All selectors for this page go at the top as `const` — never inline
2. Every step uses `async function(this: CustomWorld)` — never arrow functions (arrow functions lose `this`)
3. Use direct Playwright calls — never wrap them in helper methods within the file
4. Step names must include page context to avoid global conflicts

---

### utils/page-actions.ts — Shared Utilities

```ts
import { Page } from '@playwright/test';

export async function acceptCookieBanner(page: Page) {
  const banner = page.locator('#cookie-accept');
  if (await banner.isVisible()) {
    await banner.click();
  }
}

export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `screenshots/${name}.png` });
}
```

Only add functions here that are genuinely needed across multiple pages.
Pass `this.page` explicitly — never import a shared page instance.

---

### utils/test-data.ts — Faker Generators

```ts
import { faker } from '@faker-js/faker';

export function generateUser() {
  return {
    email: faker.internet.email(),
    password: faker.internet.password(),
    name: faker.person.fullName()
  };
}

export function generateInvoice() {
  return {
    number: faker.string.uuid(),
    amount: faker.finance.amount(),
    customer: faker.company.name()
  };
}
```

Always generate fresh data per scenario. Never hardcode test data in step files.
Store generated data in `this.data` for cross-step access within a scenario.

---

## Step Design Rules

### 1. Provide both granular and composed steps

```ts
// Granular — for edge case scenarios
When('user enters username {string}', async function(this: CustomWorld, username: string) {
  await this.page.fill(USERNAME_INPUT, username);
});

// Composed — for happy path scenarios
When('user logs in with {string} and {string}', async function(this: CustomWorld, username: string, password: string) {
  await this.page.fill(USERNAME_INPUT, username);
  await this.page.fill(PASSWORD_INPUT, password);
  await this.page.click(LOGIN_BUTTON);
});
```

### 2. Use business language — not UI mechanics

```ts
// ✅ correct
When('user submits invoice form', ...)
When('user approves payment', ...)

// ❌ wrong
When('user clicks button with id submit-btn', ...)
```

### 3. Step names must be page-scoped to avoid conflicts

```ts
// ✅ correct — unique across all files
When('user submits login form', ...)
When('user submits invoice form', ...)

// ❌ wrong — will conflict globally
When('user clicks submit', ...)
When('user clicks submit', ...)
```

### 4. Use small primitives — avoid monolithic steps

```ts
// ✅ correct
login()
createInvoice()
approveInvoice()

// ❌ wrong
completeFullInvoiceWorkflow()
```

---

## Sharing State Between Steps (Cross-File)

Use `this.data` on the World object to pass data between steps in different files:

```ts
// login.page.steps.ts — store
Then('user is logged in', async function(this: CustomWorld) {
  this.data.userId = await this.page.locator('#user-id').textContent();
});

// invoice.page.steps.ts — consume
When('user creates invoice', async function(this: CustomWorld) {
  await this.page.fill(USER_FIELD, this.data.userId);
});
```

`this.data` is automatically scoped to the scenario and reset after each run.

---

## Cross-Page Step Reuse

Cucumber registers ALL step definitions globally at runtime.

A step defined in `login.page.steps.ts` is automatically available in `invoice.feature`:

```gherkin
# invoice.feature
Scenario: Create invoice after login
  Given user is on the login page
  When user logs in with "admin@test.com" and "password123"
  Then user should see the dashboard
  When user navigates to invoices
  And user creates a new invoice
```

No imports. No wiring. Cucumber handles it.

---

## package.json Dependencies

```json
{
  "dependencies": {
    "@cucumber/cucumber": "^10.0.0",
    "@playwright/test": "^1.40.0",
    "@faker-js/faker": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## cucumber.js Config

```js
// cucumber.js
module.exports = {
  default: {
    require: [
      'utils/world.ts',
      'hooks/hooks.ts',
      'steps/**/*.page.steps.ts'
    ],
    requireModule: ['ts-node/register'],
    format: ['progress', 'html:reports/cucumber-report.html'],
    paths: ['features/**/*.feature'],
    parallel: 4
  }
};
```

---

## What NEVER to Do

| Never | Instead |
|---|---|
| Create a `pages/` directory | Put logic in `*.page.steps.ts` |
| Create a `BasePage` class | Add shared utilities to `page-actions.ts` |
| Use `extends BasePage` | Import utility functions directly |
| Import a singleton `page` | Use `this.page` from CustomWorld |
| Use arrow functions in steps | Use `async function(this: CustomWorld)` |
| Hardcode test data | Use generators from `test-data.ts` |
| Write generic step names | Scope step names to the page |
| Create wrapper methods for Playwright | Call Playwright API directly |

---

## Quick Reference — When Adding a New Page

1. Create `/steps/[page-name].page.steps.ts`
2. Add selectors as `const` at the top
3. Write `Given/When/Then` using `async function(this: CustomWorld)`
4. Use `this.page` for all Playwright calls
5. Store any data needed by other steps in `this.data`
6. Name steps with page context: `'user submits [page] form'`
7. No new files needed in `/hooks` or `/utils` unless adding genuinely new shared utilities
