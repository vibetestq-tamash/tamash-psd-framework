# Enterprise Autonomous Test Automation Agent — Detailed Plan

## Vision

Transform the existing Playwright + Cucumber framework into an **enterprise-grade autonomous testing agent** that:
- Reads Gherkin feature files as goals
- Perceives the live DOM via `pageQL.js` semantic index
- Reasons using LLMs (Claude / OpenAI / Gemini / Ollama / Grok)
- Executes Playwright actions without pre-written step definitions
- Self-heals broken selectors at runtime
- Provides full observability via LangSmith traces

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CUCUMBER RUNNER                           │
│  features/*.feature  →  hooks/hooks.ts  →  steps/           │
└──────────────────────────────┬──────────────────────────────┘
                               │ unknown step
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              AUTONOMOUS AGENT (LangGraph)                    │
│                                                             │
│  ParseIntent → BuildQuery → ExecuteAction → VerifyResult   │
│       ↑              ↑           ↓                          │
│       └── HealElement ←── Failure ←──────────────────────  │
│                                                             │
│  pageQL.js (DOM Perception Layer)                           │
│  LangSmith (Observability Layer)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## New Folder & File Structure

```
psd-framework/
├── agents/
│   ├── core/
│   │   ├── state.ts                  ← AgentState type definition
│   │   └── agent-runner.ts           ← LangGraph StateGraph wiring
│   ├── nodes/
│   │   ├── parse-intent.ts           ← Gherkin → structured intent
│   │   ├── build-query.ts            ← intent → pageQL query object
│   │   ├── execute-action.ts         ← pageQL result → Playwright action
│   │   ├── verify-result.ts          ← assert expected state post-action
│   │   ├── heal-element.ts           ← delegates to utils/self-heal.ts
│   │   └── report-node.ts            ← LangSmith trace summary
│   ├── tools/
│   │   ├── pageql-tool.ts            ← inject pageql.js + run queries
│   │   ├── playwright-action-tool.ts ← wraps page-actions.ts methods
│   │   └── dom-snapshot-tool.ts      ← captures pageQL.index as JSON
│   ├── prompts/
│   │   ├── intent-parser.prompt.ts   ← system prompt for ParseIntent node
│   │   └── query-builder.prompt.ts   ← system prompt for BuildQuery node
│   ├── step-generator.ts             ← reads features, generates step stubs
│   └── index.ts                      ← agent entry point & exports
├── steps/
│   ├── autonomous.steps.ts           ← NEW: catch-all Cucumber step router
│   ├── login.page.steps.ts           ← existing
│   ├── dashboard.page.steps.ts       ← existing
│   ├── admin.page.steps.ts           ← existing
│   ├── pim.page.steps.ts             ← existing
│   └── shared.generic.steps.ts       ← existing
├── hooks/
│   └── hooks.ts                      ← UPDATE: inject pageql.js in Before
├── utils/
│   ├── world.ts                      ← UPDATE: add agentRunner property
│   ├── pageql.js                     ← existing (perception layer)
│   ├── page-actions.ts               ← existing
│   └── self-heal.ts                  ← existing (reused by heal-element node)
└── .env                              ← ADD: LangSmith + agent env vars
```

---

## Phase 1 — Infrastructure & Dependencies

**Goal:** Install LangChain packages and create the foundation types.

### Step 1.1 — Install npm packages

```bash
npm install @langchain/core @langchain/langgraph langsmith @langchain/anthropic @langchain/openai
```

**Rationale:** `@langchain/core` provides the tool/prompt abstractions. `@langchain/langgraph` provides the StateGraph orchestrator. `langsmith` provides tracing. The existing SDKs (anthropic, openai, etc.) remain as direct clients for `self-heal.ts`.

### Step 1.2 — Create `agents/core/state.ts`

Define the shared state that flows through all LangGraph nodes:

```typescript
export interface AgentState {
  // Input
  stepText: string;               // raw Gherkin step text
  page: Page;                     // Playwright page instance
  world: CustomWorld;             // Cucumber world (data bag)

  // Parsed intent
  intent: {
    action: 'click' | 'fill' | 'select' | 'navigate' | 'assert' | 'upload';
    target: {
      label?: string;
      text?: string;
      targetElement?: string;     // pageQL type: button, textbox, dropdown...
      placeholder?: string;
      ariaLabel?: string;
    };
    value?: string;               // for fill/select actions
    assertion?: {
      type: 'visible' | 'text' | 'url' | 'count' | 'state';
      expected: string | boolean;
    };
  } | null;

  // pageQL
  pageqlQuery: Record<string, any> | null;   // built query object
  pageqlResults: IndexRecord[];              // matching elements from DOM

  // Execution
  actionResult: 'success' | 'failure' | null;
  actionError: string | null;

  // Verification
  verificationPassed: boolean | null;
  verificationError: string | null;

  // Self-healing
  healAttempts: number;
  maxHealAttempts: number;         // default: 3
  healingSuggestion: HealingSuggestion | null;

  // Observability
  traces: TraceEntry[];
  provider: HealingProvider;
}

interface TraceEntry {
  node: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  timestamp: number;
}
```

### Step 1.3 — Create `agents/tools/pageql-tool.ts`

Wraps `pageql.js` injection and query execution:

```typescript
// Injects pageql.js once per page context (idempotent)
export async function injectPageQL(page: Page): Promise<void>

// Runs a pageQL query and returns structured IndexRecord[]
export async function queryPageQL(page: Page, query: Record<string, any>): Promise<IndexRecord[]>

// Captures full pageQL.index snapshot for LLM context (capped at 50 records for token budget)
export async function snapshotPageQL(page: Page): Promise<IndexRecord[]>
```

**Security note:** `page.evaluate()` is used — no user-controlled code injection. Queries are constructed programmatically, not from raw user input.

### Step 1.4 — Create `agents/tools/dom-snapshot-tool.ts`

Provides a token-efficient DOM snapshot for LLM prompts:

```typescript
// Returns only fields useful for LLM reasoning (strips element reference, boundingBox details)
export function toPromptSafeSnapshot(records: IndexRecord[]): PromptRecord[]

interface PromptRecord {
  uid: string;
  targetElement: string;
  text: string;
  label: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  state: { visible: boolean; disabled: boolean; checked: boolean };
  container: string | null;
}
```

### Step 1.5 — Update `.env`

Add LangSmith and agent-specific environment variables:

```env
# LangSmith Observability
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_PROJECT=psd-framework-agent
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com

# Agent LLM Provider (separate from HEALING_PROVIDER for flexibility)
AGENT_PROVIDER=claude                          # claude | openai | gemini | ollama | grok
AGENT_MAX_HEAL_ATTEMPTS=3
AGENT_CONFIDENCE_THRESHOLD=0.75
AGENT_SNAPSHOT_MAX_RECORDS=50                 # cap records sent to LLM
```

---

## Phase 2 — LangGraph Agent Nodes

**Goal:** Build each processing node independently. Each node is a pure function `(state: AgentState) => Partial<AgentState>`.

### Node 1: `agents/nodes/parse-intent.ts` — ParseIntent

**Input:** `state.stepText`
**Output:** `state.intent`

**Responsibility:** Convert a Gherkin step string into a structured intent object.

**LLM Prompt strategy:**
```
System: You are a test automation intent parser. Convert Gherkin step text into a structured JSON intent.

Rules:
- action must be one of: click, fill, select, navigate, assert, upload
- targetElement must match pageQL types: button, textbox, dropdown, checkbox, radio, link, cell, tab
- Extract any quoted strings as 'value'
- For assertions, determine type: visible | text | url | count | state

Gherkin step: "{stepText}"

Respond ONLY with valid JSON matching the IntentSchema. No markdown.
```

**Example transformations:**
| Gherkin Step | Intent JSON |
|---|---|
| `I click the Login button` | `{ action: "click", target: { text: "Login", targetElement: "button" } }` |
| `I enter username "testadmin"` | `{ action: "fill", target: { label: "Username", targetElement: "textbox" }, value: "testadmin" }` |
| `I should see the error message "Invalid credentials"` | `{ action: "assert", assertion: { type: "text", expected: "Invalid credentials" } }` |
| `I select the user role "Admin"` | `{ action: "select", target: { label: "User Role", targetElement: "dropdown" }, value: "Admin" }` |

### Node 2: `agents/nodes/build-query.ts` — BuildQuery

**Input:** `state.intent`, `state.page`
**Output:** `state.pageqlQuery`, `state.pageqlResults`

**Responsibility:** Translate structured intent into a pageQL query, execute it, and return matching DOM records.

**Strategy:**
1. Direct translation for simple intents (no LLM needed — deterministic mapping):
   ```typescript
   // intent.target.label → pageQL { label: "...", targetElement: "..." }
   // intent.target.text  → pageQL { text: "...", targetElement: "..." }
   ```
2. LLM-assisted for ambiguous intents — provide DOM snapshot + intent, ask LLM to produce pageQL query
3. Execute query via `queryPageQL(page, builtQuery)`
4. If results empty → transition to HealElement node

**SQL-style query examples:**
```sql
SELECT * FROM elements WHERE label = 'Username' AND targetElement = 'textbox'
SELECT * FROM elements WHERE text = 'Login' AND targetElement = 'button' AND state.visible = true
SELECT * FROM elements WHERE targetElement = 'dropdown' AND label = 'User Role'
```

### Node 3: `agents/nodes/execute-action.ts` — ExecuteAction

**Input:** `state.intent`, `state.pageqlResults`
**Output:** `state.actionResult`, `state.actionError`

**Responsibility:** Map `intent.action` to the correct Playwright method on the best-matching element.

**Action mapping:**
```typescript
switch (intent.action) {
  case 'click':    await results[0].element.click()     // via page.locator uid
  case 'fill':     await page.locator(`[data-uid]`).fill(intent.value)
  case 'select':   await page.locator(`[data-uid]`).selectOption(intent.value)
  case 'navigate': await page.goto(intent.value)
  case 'upload':   await page.locator(`[data-uid]`).setInputFiles(intent.value)
  case 'assert':   // handled by VerifyResult node
}
```

**Element selection strategy:** Use `pageqlResults[0]` (highest importance score). If multiple results exist with similar scores, LLM decides which uid to use.

### Node 4: `agents/nodes/verify-result.ts` — VerifyResult

**Input:** `state.intent`, `state.page`
**Output:** `state.verificationPassed`, `state.verificationError`

**Responsibility:** After every action, verify the outcome. Enforces the **Action + Verification** principle.

**Verification strategies by action:**
| Action | Verification |
|---|---|
| `click` (button) | Re-query the element; assert state changed (e.g. page navigated, modal opened) |
| `fill` | Re-query textbox; assert `value` matches what was filled |
| `select` | Re-query dropdown; assert `value` matches selection |
| `navigate` | Assert `page.url()` contains expected path |
| `assert visible` | Re-query element; assert `state.visible === true` |
| `assert text` | Assert element `text` contains expected string |
| `assert url` | Assert `page.url()` matches pattern |

### Node 5: `agents/nodes/heal-element.ts` — HealElement

**Input:** `state.stepText`, `state.actionError`, `state.page`
**Output:** `state.healingSuggestion`, `state.healAttempts++`

**Responsibility:** When element not found or action fails, delegate to existing `healSelector()` from `utils/self-heal.ts`. Feeds suggestion back to BuildQuery.

```typescript
import { healSelector } from '../../utils/self-heal';

export async function healElementNode(state: AgentState): Promise<Partial<AgentState>> {
  if (state.healAttempts >= state.maxHealAttempts) {
    // Transition to ReportNode with failure
  }
  const suggestion = await healSelector(state.page, state.stepText, state.actionError!);
  // Convert HealingSuggestion selector → new pageQL query
  // Return updated pageqlQuery for retry
}
```

### Node 6: `agents/nodes/report-node.ts` — ReportNode

**Input:** full `AgentState`
**Output:** structured trace appended to `state.traces`

**Responsibility:** Emit a structured trace record for LangSmith and Cucumber report. Includes: step text, intent parsed, pageQL query used, element chosen, action taken, verification result, heal attempts, LLM provider, confidence scores.

---

## Phase 3 — LangGraph State Machine

**File:** `agents/core/agent-runner.ts`

### Graph Definition

```typescript
import { StateGraph, END } from '@langchain/langgraph';

const graph = new StateGraph<AgentState>()
  .addNode('parseIntent',    parseIntentNode)
  .addNode('buildQuery',     buildQueryNode)
  .addNode('executeAction',  executeActionNode)
  .addNode('verifyResult',   verifyResultNode)
  .addNode('healElement',    healElementNode)
  .addNode('report',         reportNode)

  .addEdge('parseIntent', 'buildQuery')
  .addEdge('buildQuery',  'executeAction')

  .addConditionalEdges('executeAction', (state) => {
    if (state.actionResult === 'failure') return 'healElement';
    if (state.intent?.action === 'assert')  return 'verifyResult';
    return 'verifyResult';
  })

  .addConditionalEdges('verifyResult', (state) => {
    if (!state.verificationPassed) return 'healElement';
    return 'report';
  })

  .addConditionalEdges('healElement', (state) => {
    if (state.healAttempts >= state.maxHealAttempts) return 'report';
    return 'buildQuery';   // retry with healed query
  })

  .addEdge('report', END)
  .setEntryPoint('parseIntent');

export const agentRunner = graph.compile();
```

### Public API

```typescript
export async function runStep(world: CustomWorld, stepText: string): Promise<void>
```

This is the single method called from `steps/autonomous.steps.ts`.

---

## Phase 4 — Cucumber Integration

### Step 4.1 — Create `steps/autonomous.steps.ts`

Catch-all step that routes unknown steps to the agent:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../utils/world';
import { runStep } from '../agents';

// Catch-all: matches any step not already defined in other step files
// Cucumber resolution order: specific step files first, this file last
Given(/^(.*)$/, async function (this: CustomWorld, stepText: string) {
  await runStep(this, stepText);
});
When(/^(.*)$/, async function (this: CustomWorld, stepText: string) {
  await runStep(this, stepText);
});
Then(/^(.*)$/, async function (this: CustomWorld, stepText: string) {
  await runStep(this, stepText);
});
```

**Conflict resolution:** Cucumber matches the most specific regex first. Existing step files (login, dashboard, admin, pim) define precise string matches, so they will always win over the `^(.*)$` catch-all. The agent only fires for genuinely unimplemented steps.

### Step 4.2 — Update `cucumber.js`

Add `autonomous.steps.ts` **last** in the require order (ensures it is lowest priority):

```javascript
require: [
  'utils/world.ts',
  'hooks/hooks.ts',
  'steps/login.page.steps.ts',
  'steps/dashboard.page.steps.ts',
  'steps/admin.page.steps.ts',
  'steps/pim.page.steps.ts',
  'steps/shared.generic.steps.ts',
  'steps/autonomous.steps.ts',   // ← catch-all last
]
```

### Step 4.3 — Update `hooks/hooks.ts`

Inject `pageql.js` as an init script so every page load has the semantic index available:

```typescript
Before(async function (this: CustomWorld) {
  this.context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  this.page = await this.context.newPage();

  // Inject pageQL semantic index into every page navigation
  await this.page.addInitScript({ path: 'utils/pageql.js' });

  this.data = {};
  this.healingSuggestions = [];
});
```

### Step 4.4 — Update `utils/world.ts`

Add `agentRunner` reference for shared state per scenario:

```typescript
import { AgentState } from '../agents/core/state';

export class CustomWorld extends World {
  page!: Page;
  context!: BrowserContext;
  data: Record<string, any> = {};
  healingSuggestions: HealingSuggestion[] = [];
  currentStepFile: string = '';

  // Agent state bag — shared across all steps in a scenario
  agentContext: Partial<AgentState> = {};
}
```

---

## Phase 5 — Step Generator (Design-Time Tool)

**File:** `agents/step-generator.ts`

**Purpose:** At design time, scan all feature files and generate TypeScript step stub files for any step not yet implemented. This bridges the gap between fully autonomous execution (catch-all) and IDE-friendly explicit step definitions.

### CLI Usage

```bash
npx ts-node agents/step-generator.ts --feature features/pim.feature --output steps/pim.page.steps.ts
npx ts-node agents/step-generator.ts --all --dry-run   # preview all missing steps
```

### How It Works

1. Parse `features/*.feature` using Gherkin parser
2. Extract all unique step texts
3. Compare against existing step definitions (regex parse `steps/*.steps.ts`)
4. For each unimplemented step, generate:

```typescript
// AUTO-GENERATED by agents/step-generator.ts
// Review and customize before committing

When('I enter username {string}', async function (this: CustomWorld, username: string) {
  await runStep(this, `I enter username "${username}"`);
});
```

5. Write output to the appropriate steps file or a new `steps/<feature>.generated.steps.ts`

---

## Phase 6 — LangSmith Observability

**Goal:** Full trace visibility for every LLM decision the agent makes.

### Configuration

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=<your_key>
LANGCHAIN_PROJECT=psd-framework-agent
```

### What Gets Traced Per Step

Each `runStep()` call creates a top-level LangSmith run with:

```
Run: "autonomous-step"
  ├── metadata.feature: "OrangeHRM Login"
  ├── metadata.scenario: "Successful login with valid credentials"
  ├── metadata.step: "I enter username 'testadmin'"
  ├── metadata.provider: "claude"
  │
  ├── child: "parse-intent"
  │     input:  { stepText: "I enter username 'testadmin'" }
  │     output: { action: "fill", target: { label: "Username" }, value: "testadmin" }
  │
  ├── child: "build-query"
  │     input:  { intent: {...}, snapshotSize: 23 }
  │     output: { query: { label: "Username", targetElement: "textbox" }, results: 1 }
  │
  ├── child: "execute-action"
  │     input:  { uid: "e_username", action: "fill", value: "testadmin" }
  │     output: { actionResult: "success" }
  │
  └── child: "verify-result"
        input:  { expectedValue: "testadmin" }
        output: { verificationPassed: true }
```

### LangSmith Datasets (Evaluation)

Build evaluation datasets from your existing feature files to score agent accuracy over time:

| Dataset | Description |
|---|---|
| `step-intent-parsing` | Gherkin step → expected intent JSON |
| `query-building` | intent + DOM snapshot → expected pageQL query |
| `element-selection` | pageQL results → expected element chosen |

Run evals after every LLM model upgrade or prompt change.

---

## Phase 7 — Enterprise Hardening

### 7.1 — Parallel Execution Safety

Current `cucumber.js` runs `parallel: 2`. Each worker needs isolated state:
- `browser` is shared (BeforeAll/AfterAll) ✓
- `context` and `page` are per-scenario (Before/After) ✓
- `agentRunner` (LangGraph graph object) is stateless and can be shared ✓
- `AgentState` is created fresh per `runStep()` call ✓

No changes needed for parallel safety.

### 7.2 — Token Budget Management

To prevent LLM cost overruns:
```typescript
const SNAPSHOT_MAX_RECORDS = parseInt(process.env.AGENT_SNAPSHOT_MAX_RECORDS || '50');

// Filter: only visible, non-disabled records within viewport
const relevantRecords = snapshot
  .filter(r => r.state.visible && !r.state.disabled)
  .sort((a, b) => b.importance - a.importance)
  .slice(0, SNAPSHOT_MAX_RECORDS);
```

### 7.3 — Retry & Circuit Breaker

```typescript
// Per-step configuration
const MAX_HEAL_ATTEMPTS = parseInt(process.env.AGENT_MAX_HEAL_ATTEMPTS || '3');
const CONFIDENCE_THRESHOLD = parseFloat(process.env.AGENT_CONFIDENCE_THRESHOLD || '0.75');
```

If `healAttempts >= MAX_HEAL_ATTEMPTS`, the agent fails fast with a descriptive error and full LangSmith trace URL for debugging.

### 7.4 — Prompt Injection Protection

All DOM text fed to LLM prompts is sanitized:
```typescript
function sanitizeForPrompt(text: string): string {
  // Strip any instruction-like patterns from page content before sending to LLM
  return text.replace(/\b(ignore|disregard|forget|system|assistant)\b/gi, '[filtered]');
}
```

### 7.5 — Cost Tracking

LangSmith automatically tracks token usage per run. Additionally log to Cucumber report:

```typescript
// In report-node.ts
this.attach(JSON.stringify({
  agentStep: state.stepText,
  provider: state.provider,
  healAttempts: state.healAttempts,
  traceUrl: langSmithRunUrl
}), 'application/json');
```

---

## Verification Checklist

### Regression (existing tests must not break)
- [ ] `npm test -- --tags @smoke` passes without agent involvement
- [ ] `npm test -- --tags @login` passes (all steps defined in `login.page.steps.ts`)
- [ ] `npm test -- --tags @pim` passes
- [ ] Self-healing still fires on `AfterStep` for element-not-found errors

### Autonomous execution
- [ ] Create `features/agent-test.feature` with no corresponding step file
- [ ] Run `npm test -- --tags @agent` → agent auto-executes all steps
- [ ] LangSmith dashboard shows full trace with child nodes
- [ ] Verify `verificationPassed: true` for each step in traces

### Self-healing integration
- [ ] Intentionally rename a selector in an existing step
- [ ] Run the scenario → `healElement` node fires
- [ ] LangSmith trace shows heal attempt with suggested fix
- [ ] With `HEALING_MODE=auto` → fix is applied to step file

### Step generator
- [ ] Run `npx ts-node agents/step-generator.ts --all --dry-run`
- [ ] Output shows all unimplemented steps from all feature files
- [ ] Generated stubs compile without TypeScript errors

---

## Implementation Order Summary

| Phase | Tasks | Depends On | Estimated Complexity |
|---|---|---|---|
| 1 | Install packages, create state.ts, tools | — | Low |
| 2 | Build 6 LangGraph nodes | Phase 1 | High |
| 3 | Wire LangGraph state machine | Phase 2 | Medium |
| 4 | Cucumber integration (catch-all steps, hooks update) | Phase 3 | Low |
| 5 | Step generator CLI | Phase 3 | Medium |
| 6 | LangSmith tracing configuration | Phase 3 | Low |
| 7 | Enterprise hardening (parallel safety, token budget, security) | Phase 4 | Medium |

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `AGENT_PROVIDER` | `claude` | LLM for intent parsing and query building |
| `AGENT_MAX_HEAL_ATTEMPTS` | `3` | Max retries via heal-element node |
| `AGENT_CONFIDENCE_THRESHOLD` | `0.75` | Min confidence to accept LLM output |
| `AGENT_SNAPSHOT_MAX_RECORDS` | `50` | Max pageQL records sent to LLM |
| `HEALING_PROVIDER` | `claude` | LLM for self-heal.ts (element recovery) |
| `HEALING_MODE` | `report` | `off` \| `report` \| `auto` |
| `HEALING_CONFIDENCE_THRESHOLD` | `0.7` | Min confidence to apply self-heal fix |
| `LANGCHAIN_TRACING_V2` | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | — | LangSmith API key |
| `LANGCHAIN_PROJECT` | `psd-framework-agent` | LangSmith project name |
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `GROK_API_KEY` | — | Grok API key |
