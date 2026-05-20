# Playwright MCP Agent — Auto-Generate Page Step Definitions

## What This Agent Does

This agent reads a Cucumber feature file, opens a live browser using the
Playwright MCP server, explores each step by navigating and inspecting the
real DOM, and generates a complete `*.page.steps.ts` file following the
Page Step Definitions architecture.

No guessing selectors from documentation.
No screenshots.
The agent inspects the real running application.

---

## How It Works

```
Read feature file
  ↓
Parse every Given / When / Then step
  ↓
For each step:
  browser_navigate  → open the relevant page
  browser_snapshot  → get the accessibility tree
  browser_click /
  browser_type /
  browser_hover     → interact to confirm elements exist
  ↓
Map each step to a real selector from the live DOM
  ↓
Generate [page].page.steps.ts following the framework rules
```

The agent uses the accessibility tree — structured data showing every
interactive element, its role, label, and ref. This is more reliable than
CSS inspection and works without vision models.

---

## Setup

### Step 1 — Install Playwright MCP

```bash
npx @playwright/mcp@latest
```

### Step 2 — Configure in VSCode (GitHub Copilot / Claude Code)

Add to `.vscode/settings.json`:

```json
{
  "github.copilot.chat.experimental.mcp.servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

For Claude Code, add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Step 3 — Start the application

The agent needs a running application to explore.

```bash
npm run dev        # or however your app starts
```

---

## Agent Prompt

Use this prompt with your AI agent (Claude Code, GitHub Copilot Agent,
Cursor Agent) when Playwright MCP is connected:

```
You are a test automation agent. Your job is to read a Cucumber feature file
and generate a complete Page Step Definitions file for it.

Follow these rules strictly:

ARCHITECTURE RULES:
- Follow the Page Step Definitions pattern — NOT Page Object Model
- The output file must be named [page-name].page.steps.ts
- All selectors go as named const at the top of the file
- Every step uses async function(this: CustomWorld) — never arrow functions
- Use this.page for all Playwright calls — never a singleton page
- Step names must be page-scoped to avoid global Cucumber conflicts
- Never create page classes, base classes, or inheritance

YOUR PROCESS FOR EACH STEP:
1. Read the step text from the feature file
2. Use browser_navigate to open the relevant page
3. Use browser_snapshot to get the accessibility tree
4. Identify the element the step refers to from the snapshot
5. Use browser_click / browser_type to confirm the element works
6. Record the best locator strategy:
   - Prefer: getByRole, getByLabel, getByTestId, data-testid
   - Acceptable: CSS id selectors (#id)
   - Avoid: CSS class selectors (.class) — they break easily
   - Never: XPath

SELECTOR PRIORITY (use in this order):
1. data-testid attribute  →  [data-testid="login-submit"]
2. ARIA role + name       →  getByRole('button', { name: 'Login' })
3. Label                  →  getByLabel('Username')
4. Placeholder            →  getByPlaceholder('Enter email')
5. ID                     →  #login-btn
6. CSS selector           →  .login-form input (last resort)

OUTPUT FORMAT:
Generate a complete [page].page.steps.ts file using this exact structure:

import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

// ── Selectors ──────────────────────────────────────────
const SELECTOR_NAME = 'selector-value';

// ── Steps ──────────────────────────────────────────────
Before(async function(this: CustomWorld) {
  this.currentStepFile = __filename;
});

Given('...', async function(this: CustomWorld) { ... });
When('...', async function(this: CustomWorld) { ... });
Then('...', async function(this: CustomWorld) { ... });

Feature file to process: [PASTE FEATURE FILE PATH OR CONTENT]
Base URL of the application: [PASTE BASE URL]
```

---

## Step-by-Step Agent Workflow

### Phase 1 — Parse the Feature File

The agent reads the feature file and extracts:

```
Feature: Login

Scenario: Successful login
  Given user is on the login page          → navigate to /login
  When user logs in with credentials       → find username, password, button
  Then user should see the dashboard       → find dashboard heading

Scenario: Invalid credentials
  Given user is on the login page          → same page
  When user enters wrong credentials       → same fields
  Then user should see error message       → find error element
```

It groups steps by page. All login steps go into `login.page.steps.ts`.

---

### Phase 2 — Explore Each Page

For each unique page the agent:

```
browser_navigate("https://yourapp.com/login")
  ↓
browser_snapshot()
  ↓
Returns accessibility tree:
  - textbox "Username" [ref=e3]
  - textbox "Password" [ref=e5]
  - button "Login" [ref=e8]
  - text "Don't have an account?" [ref=e11]
```

The agent reads the tree and maps each step to a real element.

---

### Phase 3 — Confirm Selectors by Interaction

The agent does not just read — it interacts to confirm:

```
browser_type(ref=e3, "test@example.com")   → confirms username field works
browser_type(ref=e5, "password123")        → confirms password field works
browser_click(ref=e8)                      → confirms login button works
browser_snapshot()                         → checks what page appeared after
```

This catches:
- Elements that exist in the DOM but are disabled
- Elements hidden behind scroll
- Steps that navigate to a different page
- Assertions that need a specific element to be visible

---

### Phase 4 — Generate the Step File

After exploring all steps the agent generates:

```ts
// steps/login.page.steps.ts

import { Given, When, Then, Before } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../utils/world';

// ── Selectors ──────────────────────────────────────────
const USERNAME_INPUT    = '[data-testid="username"]';
const PASSWORD_INPUT    = '[data-testid="password"]';
const LOGIN_BUTTON      = '[data-testid="login-submit"]';
const ERROR_MESSAGE     = '[data-testid="error-message"]';
const DASHBOARD_HEADING = 'h1';

// ── Steps ──────────────────────────────────────────────
Before(async function(this: CustomWorld) {
  this.currentStepFile = __filename;
});

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

When('user enters username {string}', async function(
  this: CustomWorld, username: string
) {
  await this.page.fill(USERNAME_INPUT, username);
});

When('user enters password {string}', async function(
  this: CustomWorld, password: string
) {
  await this.page.fill(PASSWORD_INPUT, password);
});

When('user clicks login', async function(this: CustomWorld) {
  await this.page.click(LOGIN_BUTTON);
});

Then('user should see the dashboard', async function(this: CustomWorld) {
  await expect(this.page.locator(DASHBOARD_HEADING)).toBeVisible();
});

Then('user should see error {string}', async function(
  this: CustomWorld, message: string
) {
  await expect(this.page.locator(ERROR_MESSAGE)).toHaveText(message);
});
```

---

## Multi-Page Feature Files

When a feature file touches multiple pages the agent splits the output:

```gherkin
# invoice.feature
Scenario: Create invoice after login
  Given user is on the login page          → login.page.steps.ts
  When user logs in with credentials       → login.page.steps.ts
  Then user should see the dashboard       → login.page.steps.ts
  When user navigates to invoices          → invoice.page.steps.ts
  And user creates a new invoice           → invoice.page.steps.ts
  Then invoice should appear in the list   → invoice.page.steps.ts
```

The agent:
1. Groups steps by the page they operate on
2. Generates one file per page
3. Each file registers its own `__filename` in `Before`

Cucumber's global registry wires them together automatically at runtime.

---

## Selector Strategy Decision Tree

The agent follows this decision tree when choosing a selector:

```
Does the element have data-testid?
  YES → use [data-testid="value"]                     ← most stable
  NO  ↓

Does the element have an ARIA role + visible name?
  YES → use getByRole('button', { name: 'Submit' })   ← very stable
  NO  ↓

Does the element have a label?
  YES → use getByLabel('Email address')               ← stable
  NO  ↓

Does the element have a placeholder?
  YES → use getByPlaceholder('Enter your email')      ← acceptable
  NO  ↓

Does the element have a stable ID?
  YES → use #element-id                               ← acceptable
  NO  ↓

Use CSS selector as last resort                       ← fragile, flag it
```

When a fragile selector is used the agent adds a comment:

```ts
// ⚠️  Fragile selector — ask dev to add data-testid
const SUBMIT_BUTTON = '.form-actions > button:last-child';
```

---

## Handling Authentication

Many apps require login before reaching the pages under test.

Use Playwright MCP's session persistence to avoid re-authenticating on every
exploration run:

```bash
# Start MCP server with persistent session
npx @playwright/mcp@latest --storage-state=.auth/session.json
```

Or instruct the agent:

```
Before exploring any page that requires authentication:
1. Use browser_navigate to go to the login page
2. Use browser_type and browser_click to log in
3. Use browser_save_storage to save the session state
4. All subsequent browser_navigate calls will use this session
```

---

## Agent Output Checklist

Before saving the generated file the agent verifies:

```
✅ File named [page].page.steps.ts
✅ All selectors defined as const at the top
✅ Every step uses async function(this: CustomWorld)
✅ No arrow functions
✅ this.page used everywhere — no singleton import
✅ Before hook registers __filename
✅ Step names include page context (no generic names)
✅ Both granular and composed steps provided where needed
✅ Assertions use expect(this.page.locator(...))
✅ No page classes created
✅ No base class imports
✅ Fragile selectors flagged with ⚠️ comment
```

---

## Running the Agent in VSCode

### With GitHub Copilot Agent Mode

1. Open the feature file in VSCode
2. Open Copilot Chat → switch to Agent mode
3. Paste the agent prompt above
4. Include the feature file content and base URL
5. Copilot uses Playwright MCP to explore and generates the step file

### With Claude Code

```bash
claude "Read features/login.feature. Use Playwright MCP to explore
https://localhost:3000 and generate steps/login.page.steps.ts
following the Page Step Definitions architecture in SKILL.md"
```

Claude Code reads `SKILL.md` for architecture rules, uses Playwright MCP to
explore the live app, and writes the step file directly.

---

## Example Run — What the Agent Does

**Input:**

```gherkin
# features/login.feature
Feature: Login

  Scenario: Successful login
    Given user is on the login page
    When user logs in with "admin@test.com" and "password123"
    Then user should see the dashboard

  Scenario: Invalid credentials
    Given user is on the login page
    When user logs in with "wrong@test.com" and "wrongpass"
    Then user should see error "Invalid username or password"
```

**Agent actions:**

```
1. browser_navigate("http://localhost:3000/login")
2. browser_snapshot()
   → finds: textbox[Username], textbox[Password], button[Sign In]
3. browser_type(ref=e3, "admin@test.com")
4. browser_type(ref=e5, "password123")
5. browser_click(ref=e8)
6. browser_snapshot()
   → finds: heading[Welcome back, Admin]  ← dashboard confirmed
7. browser_navigate("http://localhost:3000/login")
8. browser_type(ref=e3, "wrong@test.com")
9. browser_type(ref=e5, "wrongpass")
10. browser_click(ref=e8)
11. browser_snapshot()
    → finds: alert[Invalid username or password]  ← error confirmed
```

**Output:** complete `login.page.steps.ts` with real selectors confirmed
against the live application.

---

## Why MCP for This Task

Playwright MCP is the right tool for step generation because:

- **Accessibility tree over screenshots** — structured data, not pixel
  interpretation. More reliable selector extraction.
- **Real DOM inspection** — selectors are confirmed against the actual
  running application, not guessed from documentation or designs.
- **Interaction confirmation** — the agent clicks and types to verify
  elements actually work, not just that they exist in the DOM.
- **Persistent sessions** — authenticated pages can be explored without
  re-logging in on every step.

The result is a step file where every selector has been verified against the
live application before a single test is written.
