import { Before, After, AfterStep, BeforeAll, AfterAll, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser } from '@playwright/test';
import { CustomWorld } from '../utils/world';
import { healSelector, applyHealedSelector, writeHealingReport } from '../utils/self-heal';

const HEALING_MODE = (process.env.HEALING_MODE || 'report') as 'off' | 'report' | 'auto';

let browser: Browser;

// Extend default step timeout to allow slow page navigation/actions
setDefaultTimeout(60 * 1000);

BeforeAll(async function () {
  browser = await chromium.launch({ headless: false });
});

AfterAll(async function () {
  await browser.close();
});

Before(async function (this: CustomWorld) {
  this.context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  this.page = await this.context.newPage();
  this.data = {};
  this.healingSuggestions = [];
});

// ── Catch failures and request AI healing ──────────────────────────────────

AfterStep(async function (this: CustomWorld, { result, pickleStep }: any) {
  if (HEALING_MODE === 'off') return;
  if (result?.status !== Status.FAILED || !result.message) return;

  const suggestion = await healSelector(this.page, pickleStep.text, result.message);
  if (suggestion) {
    suggestion.file = this.currentStepFile;
    this.healingSuggestions.push(suggestion);
  }
});

// ── After: screenshot, healing report or auto-fix ──────────────────────────

After(async function (this: CustomWorld, scenario) {
  if (scenario.result?.status === Status.FAILED) {
    const screenshot = await this.page.screenshot();
    this.attach(screenshot, 'image/png');
  }

  if (this.healingSuggestions.length > 0) {
    if (HEALING_MODE === 'report') {
      console.log('\n─────────────────────────────────────────────');
      console.log('  Self-Healing Suggestions');
      console.log('─────────────────────────────────────────────');
      this.healingSuggestions.forEach((s, i) => {
        console.log(`\n[${i + 1}] Step      : ${s.step}`);
        console.log(`    Provider  : ${s.provider}`);
        console.log(`    Broken    : ${s.brokenSelector}`);
        console.log(`    Fix       : ${s.suggestedSelector}`);
        console.log(`    Reason    : ${s.reason}`);
        console.log(`    Confidence: ${(s.confidence * 100).toFixed(0)}%`);
        console.log(`    File      : ${s.file}`);
      });
      console.log('\n─────────────────────────────────────────────\n');
      writeHealingReport(this.healingSuggestions);
    }

    if (HEALING_MODE === 'auto') {
      console.log('\n[self-heal] Applying auto-fixes...');
      for (const s of this.healingSuggestions) {
        applyHealedSelector(s.file, s.brokenSelector, s.suggestedSelector);
      }
      writeHealingReport(this.healingSuggestions);
    }
  }

  await this.context.close();
});
