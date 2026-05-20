import { Page } from '@playwright/test';
import * as fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export type HealingProvider = 'claude' | 'openai' | 'gemini' | 'ollama' | 'grok';

export interface HealingSuggestion {
  step: string;
  brokenSelector: string;
  suggestedSelector: string;
  reason: string;
  confidence: number;
  provider: HealingProvider;
  file: string;
}

interface HealingResponse {
  selector: string;
  reason: string;
  confidence: number;
}

// ── Provider Implementations ───────────────────────────────────────────────

async function healWithClaude(prompt: string): Promise<HealingResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  if (response.content[0].type !== 'text') throw new Error('Unexpected Claude response type');
  return JSON.parse(response.content[0].text.trim());
}

async function healWithOpenAI(prompt: string): Promise<HealingResponse> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('Empty OpenAI response');
  return JSON.parse(text.trim());
}

async function healWithGemini(prompt: string): Promise<HealingResponse> {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 500
    }
  });

  const text = response.text;
  if (!text) throw new Error('Empty Gemini response');
  return JSON.parse(text.trim());
}

async function healWithOllama(prompt: string): Promise<HealingResponse> {
  const { Ollama } = await import('ollama');
  const ollamaConfig: { host?: string; headers?: Record<string, string> } = {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434'
  };
  if (process.env.OLLAMA_API_KEY) {
    ollamaConfig.headers = { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` };
  }
  const client = new Ollama(ollamaConfig);

  const response = await client.chat({
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    messages: [{ role: 'user', content: prompt }],
    format: 'json'
  });

  const text = response.message?.content;
  if (!text) throw new Error('Empty Ollama response');
  return JSON.parse(text.trim());
}

async function healWithGrok(prompt: string): Promise<HealingResponse> {
  // Grok uses an OpenAI-compatible API
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1'
  });

  const response = await client.chat.completions.create({
    model: process.env.GROK_MODEL || 'grok-3',
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('Empty Grok response');
  return JSON.parse(text.trim());
}

// ── Provider dispatch map ──────────────────────────────────────────────────

const PROVIDERS: Record<HealingProvider, (prompt: string) => Promise<HealingResponse>> = {
  claude: healWithClaude,
  openai: healWithOpenAI,
  gemini: healWithGemini,
  ollama: healWithOllama,
  grok:   healWithGrok
};

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(failedStep: string, error: string, snapshot: object): string {
  return `
A Playwright test step failed. Identify the broken selector and suggest the correct replacement.

Failed step : "${failedStep}"
Error       : "${error}"

Current page accessibility tree:
${JSON.stringify(snapshot, null, 2)}

Respond ONLY with a JSON object in this exact format — no markdown, no extra text:
{
  "selector": "the new Playwright locator string",
  "reason": "one sentence explaining why this selector is correct",
  "confidence": 0.0
}

confidence must be a number between 0.0 and 1.0.
`.trim();
}

// ── Core healing function ──────────────────────────────────────────────────

export async function healSelector(
  page: Page,
  failedStep: string,
  error: string
): Promise<HealingSuggestion | null> {
  const provider = (process.env.HEALING_PROVIDER || 'claude') as HealingProvider;
  const confidenceThreshold = parseFloat(process.env.HEALING_CONFIDENCE_THRESHOLD || '0.7');

  const healFn = PROVIDERS[provider];
  if (!healFn) {
    console.warn(`[self-heal] Unknown provider: "${provider}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`);
    return null;
  }

  try {
    let snapshot: any = null;
    try {
      if ((page as any).accessibility && typeof (page as any).accessibility.snapshot === 'function') {
        snapshot = await (page as any).accessibility.snapshot();
      } else {
        console.warn('[self-heal] accessibility.snapshot not available; falling back to page HTML');
        const html = await page.content();
        snapshot = { html };
      }
    } catch (snapErr) {
      console.warn('[self-heal] Failed to capture accessibility snapshot, falling back to page HTML', snapErr);
      try {
        const html = await page.content();
        snapshot = { html };
      } catch (htmlErr) {
        console.warn('[self-heal] Failed to capture page HTML as fallback', htmlErr);
        return null;
      }
    }

    const prompt = buildPrompt(failedStep, error, snapshot);
    const parsed = await healFn(prompt);

    const parsedConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    if (parsedConfidence < confidenceThreshold) {
      console.warn(`[self-heal] Low confidence (${parsed.confidence}) from ${provider} for step: "${failedStep}" — skipping`);
      return null;
    }

    return {
      step: failedStep,
      brokenSelector: extractSelectorFromError(error),
      suggestedSelector: parsed.selector,
      reason: parsed.reason,
      confidence: parsedConfidence,
      provider,
      file: ''  // filled in by the hook
    };
  } catch (err) {
    console.error(`[self-heal] Provider "${provider}" failed:`, err);
    return null;
  }
}

// ── Extract broken selector from Playwright error message ─────────────────

function extractSelectorFromError(error: string): string {
  const patterns = [
    /waiting for locator\('(.+?)'\)/,
    /locator\('(.+?)'\)/,
    /waiting for (.+?)(?:\s|$)/
  ];
  for (const pattern of patterns) {
    const match = error.match(pattern);
    if (match) return match[1];
  }
  return 'unknown';
}

// ── Level 3: Apply the fix directly to the step file ──────────────────────

export function applyHealedSelector(
  filePath: string,
  oldSelector: string,
  newSelector: string
): boolean {
  if (!filePath || oldSelector === 'unknown') return false;

  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // try single-quoted then double-quoted constant values
    const singleQuoted = content.replace(`'${oldSelector}'`, `'${newSelector}'`);
    const changed = singleQuoted !== content;

    if (changed) {
      fs.writeFileSync(filePath, singleQuoted, 'utf-8');
    } else {
      const doubleQuoted = content.replace(`"${oldSelector}"`, `"${newSelector}"`);
      if (doubleQuoted === content) return false;
      fs.writeFileSync(filePath, doubleQuoted, 'utf-8');
    }

    console.log(`[self-heal] Auto-healed: "${oldSelector}" → "${newSelector}" in ${filePath}`);
    return true;
  } catch (err) {
    console.error('[self-heal] Failed to apply fix:', err);
    return false;
  }
}

// ── Write healing suggestions to JSON report ──────────────────────────────

export function writeHealingReport(suggestions: HealingSuggestion[]): void {
  const reportPath = 'reports/healing-report.json';

  try {
    let existing: object[] = [];
    if (fs.existsSync(reportPath)) {
      existing = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    }

    const updated = [
      ...existing,
      { timestamp: new Date().toISOString(), suggestions }
    ];

    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[self-heal] Failed to write healing report:', err);
  }
}
