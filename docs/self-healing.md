# Self-Healing Automation — Implementation Guide

## Overview

Self-healing is the ability of the framework to detect a failed step, identify
the broken selector, consult an AI to find the correct replacement, and either
suggest or apply the fix automatically.

This guide covers three levels of self-healing — from the safest (Level 2:
report after run) to the most autonomous (Level 3: auto-fix the file).

---

## Why This Architecture Makes Self-Healing Effective

In a traditional POM framework, when a step fails the AI must traverse multiple
files to find the broken selector:

```
Step failed
  → Which step file?
    → Which page class?
      → Which method?
        → Which selector inside the method?
```

In Page Step Definitions, the path is direct:

```
Step failed
  → Which step file? login.page.steps.ts
    → Selector is at the top of that file — fixed in one line
```

Selectors are named constants, co-located, and findable. The AI always knows
exactly what to fix and exactly where.

---

## How Self-Healing Works

```
Step Fails
  ↓
AfterStep hook fires
  ↓
Grab accessibility tree (page.accessibility.snapshot)
  ↓
Send failed step text + accessibility tree to Claude API
  ↓
Claude suggests the correct new selector
  ↓
Store suggestion in this.data.healingSuggestions
  ↓
After hook prints healing report  (Level 2)
  OR
After hook rewrites the selector constant in the file  (Level 3)
```

---

## Project Structure After Adding Self-Healing

```
/features
  login.feature
  invoice.feature

/steps
  login.page.steps.ts
  invoice.page.steps.ts

/hooks
  hooks.ts                   ← AfterStep + After hooks added here

/utils
  world.ts
  page-actions.ts
  test-data.ts
  self-heal.ts               ← new file — healing logic lives here
```

---

## Step 1 — Install Dependencies

```bash
npm install @anthropic-ai/sdk
```

Set your API key in the environment:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Or add it to a `.env` file and load with `dotenv`:

```bash
npm install dotenv
```

```ts
// cucumber.js
require('dotenv').config();
```

---

## Step 2 — Create utils/self-heal.ts

This file contains all healing logic. It is the only place that calls the
Anthropic API.

```ts
// utils/self-heal.ts
import { Page } from '@playwright/test';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

const client = new Anthropic();

// ── Types ──────────────────────────────────────────────
export interface HealingSuggestion {
  step: string;
  brokenSelector: string;
  suggestedSelector: string;
  file: string;
  constantName: string;
}

// ── Core healing function ──────────────────────────────
export async function healSelector(
  page: Page,
  failedStep: string,
  error: string
): Promise<HealingSuggestion | null> {
  try {
    // grab the accessibility tree — this is the AI's view of the current page
    const snapshot = await page.accessibility.snapshot();

    if (!snapshot) return null;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `
          A Playwright test step failed.

          Failed step : "${failedStep}"
          Error       : "${error}"

          Current page accessibility tree:
          ${JSON.stringify(snapshot, null, 2)}

          Identify the element this step is trying to interact with.
          Suggest the best Playwright locator to fix this step.

          Respond ONLY with a JSON object in this exact format:
          {
            "selector": "the new locator string",
            "reason": "one sentence explaining why this selector is correct"
          }
        `
      }]
    });

    if (response.content[0].type !== 'text') return null;

    const raw = response.content[0].text.trim();
    const parsed = JSON.parse(raw);

    return {
      step: failedStep,
      brokenSelector: extractSelectorFromError(error),
      suggestedSelector: parsed.selector,
      file: '',           // filled in by the hook
      constantName: ''    // filled in by the hook
    };

  } catch (err) {
    console.error('Self-heal failed:', err);
    return null;
  }
}

// ── Extract the broken selector from the error message ─
function extractSelectorFromError(error: string): string {
  // Playwright errors contain the selector in the message
  // e.g. "Timeout waiting for #login-btn"
  const match = error.match(/waiting for (.+?)(?:\s|$)/);
  return match ? match[1] : 'unknown';
}

// ── Level 3: Apply the fix directly to the step file ──
export function applyHealedSelector(
  filePath: string,
  oldSelector: string,
  newSelector: string,
  constantName: string
): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // replace the named constant value at the top of the file
    const updated = content.replace(
      `'${oldSelector}'`,
      `'${newSelector}'`
    );

    if (updated === content) {
      // try double quotes
      const updatedDouble = content.replace(
        `"${oldSelector}"`,
        `"${newSelector}"`
      );
      if (updatedDouble === content) return false;
      fs.writeFileSync(filePath, updatedDouble);
    } else {
      fs.writeFileSync(filePath, updated);
    }

    console.log(`✅ Auto-healed: ${constantName}`);
    console.log(`   ${oldSelector} → ${newSelector}`);
    console.log(`   in ${filePath}`);
    return true;

  } catch (err) {
    console.error('Failed to apply heal:', err);
    return false;
  }
}
```

---

## Step 3 — Update utils/world.ts

Add a `healingSuggestions` array and `stepFilePath` to the World object:

```ts
// utils/world.ts
import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
import { BrowserContext, Page } from '@playwright/test';
import { HealingSuggestion } from './self-heal';

export class CustomWorld extends World {
  page!: Page;
  context!: BrowserContext;
  data: Record<string, any> = {};

  // self-healing
  healingSuggestions: HealingSuggestion[] = [];
  currentStepFile: string = '';   // set by each step file — explained below

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
```

---

## Step 4 — Register Step File Path in Each Step File

Each step file registers its own path on the World object. This tells the
healing engine exactly which file to fix.

```ts
// steps/login.page.steps.ts
import { Given, When, Then, Before } from '@cucumber/cucumber';
import { CustomWorld } from '../utils/world';

// register this file's path for self-healing
Before(async function(this: CustomWorld) {
  this.currentStepFile = __filename;
});

// ── Selectors ──────────────────────────────────────────
const USERNAME_INPUT    = '#username';
const PASSWORD_INPUT    = '#password';
const LOGIN_BUTTON      = '#login-btn';
const ERROR_MESSAGE     = '.error-message';
const DASHBOARD_HEADING = 'h1.dashboard-title';

// ── Steps ──────────────────────────────────────────────
Given('user is on the login page', async function(this: CustomWorld) {
  await this.page.goto('/login');
});

When('user logs in with {string} and {string}', async function(
  this: CustomWorld, username: string, password: string
) {
  await this.page.fill(USERNAME_INPUT, username);
  await this.page.fill(PASSWORD_INPUT, password);
  await this.page.click(LOGIN_BUTTON);
});

Then('user should see the dashboard', async function(this: CustomWorld) {
  await expect(this.page.locator(DASHBOARD_HEADING)).toBeVisible();
});
```

---

## Step 5 — Update hooks/hooks.ts

Add `AfterStep` to catch failures and trigger healing, and update `After` to
print the report or apply fixes.

### Level 2 — Healing Report (Recommended Starting Point)

```ts
// hooks/hooks.ts
import { Before, After, AfterStep, ITestCaseHookParameter } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { CustomWorld } from '../utils/world';
import { healSelector } from '../utils/self-heal';

Before(async function(this: CustomWorld) {
  const browser = await chromium.launch();
  this.context = await browser.newContext();
  this.page = await this.context.newPage();
});

// ── Catch failures and request AI healing ──────────────
AfterStep(async function(this: CustomWorld, { result, pickleStep }: ITestCaseHookParameter) {
  if (result?.status === 'FAILED' && result.message) {
    const suggestion = await healSelector(
      this.page,
      pickleStep.text,
      result.message
    );

    if (suggestion) {
      suggestion.file = this.currentStepFile;
      this.healingSuggestions.push(suggestion);
    }
  }
});

// ── Print healing report after scenario ───────────────
After(async function(this: CustomWorld) {
  if (this.healingSuggestions.length > 0) {
    console.log('\n─────────────────────────────────────');
    console.log('🔧  Self-Healing Suggestions');
    console.log('─────────────────────────────────────');

    this.healingSuggestions.forEach((s, i) => {
      console.log(`\n[${i + 1}] Failed step    : ${s.step}`);
      console.log(`    Broken selector : ${s.brokenSelector}`);
      console.log(`    Suggested fix   : ${s.suggestedSelector}`);
      console.log(`    File            : ${s.file}`);
    });

    console.log('\n─────────────────────────────────────\n');
  }

  await this.context.close();
});
```

**Output after a failed run:**

```
─────────────────────────────────────
🔧  Self-Healing Suggestions
─────────────────────────────────────

[1] Failed step    : user clicks login
    Broken selector : #login-btn
    Suggested fix   : [data-testid="login-submit"]
    File            : /steps/login.page.steps.ts

─────────────────────────────────────
```

The developer applies one-line fix:

```ts
// Before
const LOGIN_BUTTON = '#login-btn';

// After
const LOGIN_BUTTON = '[data-testid="login-submit"]';
```

---

### Level 3 — Autonomous Fix (Auto-Rewrite the File)

Replace the `After` hook with this version to apply fixes without human
intervention:

```ts
// hooks/hooks.ts — Level 3 After hook
After(async function(this: CustomWorld) {
  if (this.healingSuggestions.length > 0) {
    console.log('\n🔧 Applying self-healing fixes...\n');

    for (const suggestion of this.healingSuggestions) {
      if (suggestion.file && suggestion.brokenSelector) {
        applyHealedSelector(
          suggestion.file,
          suggestion.brokenSelector,
          suggestion.suggestedSelector,
          suggestion.constantName
        );
      }
    }
  }

  await this.context.close();
});
```

The file is rewritten automatically. The next run uses the healed selector.

> **Recommendation:** Use Level 2 first. Move to Level 3 only after validating
> that healing suggestions are accurate for your application.

---

## Execution Flow — What Happens When a Step Fails

```
1. Step runs → Playwright throws timeout error

2. AfterStep hook fires
   - result.status === 'FAILED'
   - page.accessibility.snapshot() captures the current DOM
   - Claude API receives: failed step text + accessibility tree
   - Claude returns: suggested selector + reason

3. Suggestion stored in this.healingSuggestions

4. Remaining steps in scenario continue (or skip, depending on config)

5. After hook fires
   - Level 2: prints healing report to console
   - Level 3: rewrites selector constant in step file
```

---

## Continuing Execution After a Failed Step

By default Cucumber stops a scenario on the first failure. To continue
executing remaining steps after a failure, add this to `cucumber.js`:

```js
// cucumber.js
module.exports = {
  default: {
    // ...existing config...
    worldParameters: {},
    // continue running remaining steps after a failure
    // so all broken selectors are collected in one run
    strict: false
  }
};
```

Or use `@soft` tags on scenarios that should continue on failure:

```gherkin
@soft
Scenario: Full checkout flow
  Given user is on the login page
  When user logs in with "admin@test.com" and "password123"
  Then user should see the dashboard        ← fails, healing triggered
  When user navigates to invoices           ← still runs
  And user creates a new invoice            ← still runs, may also heal
```

This collects all broken selectors in one run rather than fixing them one at a
time across multiple runs.

---

## Adding a Healing Confidence Threshold

Ask Claude to rate its confidence in the suggestion. Skip low-confidence fixes:

```ts
// utils/self-heal.ts — updated prompt
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 500,
  messages: [{
    role: 'user',
    content: `
      A Playwright test step failed.

      Failed step : "${failedStep}"
      Error       : "${error}"

      Current page accessibility tree:
      ${JSON.stringify(snapshot, null, 2)}

      Respond ONLY with a JSON object:
      {
        "selector": "the new locator string",
        "reason": "one sentence explanation",
        "confidence": 0.0 to 1.0
      }
    `
  }]
});

const parsed = JSON.parse(response.content[0].text.trim());

// only apply fixes with high confidence
if (parsed.confidence < 0.8) {
  console.warn(`⚠️  Low confidence heal (${parsed.confidence}): ${failedStep}`);
  return null;
}
```

---

## Healing Report in CI

In CI pipelines, write healing suggestions to a JSON file instead of console
output so they can be tracked over time:

```ts
// hooks/hooks.ts — CI-friendly After hook
import * as fs from 'fs';
import * as path from 'path';

After(async function(this: CustomWorld) {
  if (this.healingSuggestions.length > 0) {
    const reportPath = path.join('reports', 'healing-report.json');

    // append to existing report or create new
    let existing = [];
    if (fs.existsSync(reportPath)) {
      existing = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    }

    const updated = [
      ...existing,
      {
        timestamp: new Date().toISOString(),
        suggestions: this.healingSuggestions
      }
    ];

    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(updated, null, 2));
    console.log(`🔧 Healing report written to ${reportPath}`);
  }

  await this.context.close();
});
```

---

## Why Selectors Are Healable in This Architecture

The reason self-healing is clean in this framework:

```ts
// login.page.steps.ts
const LOGIN_BUTTON = '#login-btn';    ← one named constant
                                         one file
                                         one line to fix
```

The AI does not need to:
- Search multiple page class files
- Understand inheritance chains
- Identify which method wraps which selector
- Worry about breaking shared abstractions

It reads the accessibility tree, finds the element, suggests a selector, and
replaces one string. That is the entire operation.

---

## Levels Summary

| Level | Trigger | AI Role | Human Role |
|---|---|---|---|
| Level 2 | AfterStep failure | Suggest selector | Review and apply fix |
| Level 3 | AfterStep failure | Suggest + rewrite file | Review commit |

---

## Files Added by Self-Healing

```
/utils
  self-heal.ts        ← healing logic + file rewrite
  world.ts            ← updated: healingSuggestions + currentStepFile

/hooks
  hooks.ts            ← updated: AfterStep + After with healing

/reports
  healing-report.json ← generated at runtime (CI mode)
```

No changes to feature files or step files beyond registering `__filename` in
a `Before` hook at the top of each step file.
