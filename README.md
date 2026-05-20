# PSD Framework

Playwright + Cucumber + TypeScript automation framework using Page Step Definitions, with optional AI-powered selector self-healing.

## What This Framework Is

PSD (Page Step Definitions) is a design where each feature area has its own step-definition file and keeps selectors close to the steps that use them.

Example in this project:
- Login steps: steps/login.page.steps.ts
- Dashboard steps: steps/dashboard.page.steps.ts
- Admin steps: steps/admin.page.steps.ts
- PIM steps: steps/pim.page.steps.ts
- Shared reusable steps: steps/shared.generic.steps.ts

This gives very fast traceability:
Failed scenario step -> step file -> selector/action -> fix.

## Key Architecture

- BDD runner and reporting
  - Cucumber config: cucumber.js
  - Feature files: features/
  - HTML/JSON reports: reports/

- Browser lifecycle and failure handling
  - Hooks: hooks/hooks.ts
  - Opens browser/context per scenario
  - Captures screenshot on failure
  - Triggers AI healing on failed steps

- Shared test context
  - World object: utils/world.ts
  - Stores page/context, scenario data, current step file, healing suggestions

- Common reusable actions
  - Utilities: utils/page-actions.ts

- AI selector self-healing engine
  - Core logic: utils/self-heal.ts
  - Providers supported:
    - claude
    - openai
    - gemini
    - ollama
    - grok

## Why Page Step Definitions

Compared to deep POM traversal, PSD keeps intent and implementation very close:

- Easier maintenance
  - Selector constants live near matching steps
  - Less file hopping during debugging

- Better readability for business and QA
  - Feature text maps directly to executable steps

- Faster root-cause analysis
  - Failures are localized to a small step file scope

- Better fit for AI-assisted updates
  - AI has less ambiguity about what failed and where to patch

## AI Advantages In This Framework

## 1) Intelligent selector healing

When a step fails due to a locator issue, the framework can:
- Capture the failed step text and error
- Capture current page context (accessibility snapshot, with HTML fallback)
- Ask an AI provider for a replacement selector
- Return confidence-scored suggestion

## 2) Confidence-gated safety

Healing suggestions are accepted only when confidence is above threshold.
This reduces risky replacements.

Relevant environment variable:
- HEALING_CONFIDENCE_THRESHOLD (default 0.7)

## 3) Flexible healing modes

Configured through HEALING_MODE in hooks/hooks.ts:

- off
  - No healing attempted

- report
  - Generate suggestions and write healing report
  - Recommended to start with

- auto
  - Apply selector replacements directly to step files
  - Also writes report for audit

## 4) Multi-provider AI strategy

You are not locked to one LLM vendor. Switch provider through environment configuration without changing framework code.

## 5) Clear audit trail

Healing output is written to reports/healing-report.json and printed to console in report mode.

This helps teams:
- Review AI reasoning
- Validate confidence
- Track recurring flaky selectors/components

## 6) Better long-term maintainability

PSD + AI healing reduces mean time to repair after UI changes:
- Smaller blast radius when selectors break
- Faster, localized updates
- Better parallel work between QA and dev teams

## Getting Started

Prerequisites:
- Node.js 18+
- npm

Install:
- npm install

Run all tests:
- npm test

Run by tag:
- npm run test:smoke
- npm run test:login
- npm run test:dashboard
- npm run test:admin
- npm run test:pim

## Environment Configuration

Use .env (see .env.example) to configure AI providers and modes.

Common variables:
- HEALING_MODE=off|report|auto
- HEALING_PROVIDER=claude|openai|gemini|ollama|grok
- HEALING_CONFIDENCE_THRESHOLD=0.7

Provider examples:
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- GEMINI_API_KEY
- OLLAMA_HOST
- OLLAMA_API_KEY (optional)
- GROK_API_KEY
- GROK_BASE_URL (optional)

Optional model overrides:
- CLAUDE_MODEL
- OPENAI_MODEL
- GEMINI_MODEL
- OLLAMA_MODEL
- GROK_MODEL

## Typical Failure-To-Fix Flow

1. Scenario step fails.
2. AfterStep hook asks AI for selector replacement.
3. Suggestion is stored with confidence and reason.
4. After hook either:
   - prints and reports suggestion (report mode), or
   - updates selector in step file (auto mode).
5. Team reviews healing report and reruns suite.

## Project Structure

- cucumber.js
- package.json
- tsconfig.json
- docs/
- features/
- hooks/
- reports/
- steps/
- utils/

## Recommended Team Workflow With AI

1. Keep HEALING_MODE=report in CI.
2. Review healing-report.json during triage.
3. Promote trusted patterns to stable selectors/constants.
4. Use HEALING_MODE=auto only in controlled environments.
5. Track repeated failures to improve selector strategy.

## Summary

This framework combines:
- BDD clarity (Cucumber)
- Browser automation strength (Playwright)
- PSD maintainability (co-located page steps + selectors)
- AI acceleration (self-healing with confidence and audit)

Result: faster troubleshooting, fewer brittle locator outages, and better productivity when teams use AI-assisted test maintenance.