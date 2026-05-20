import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber';
import { BrowserContext, Page } from '@playwright/test';
import { HealingSuggestion } from './self-heal';

export class CustomWorld extends World {
  page!: Page;
  context!: BrowserContext;
  data: Record<string, any> = {};

  // self-healing
  healingSuggestions: HealingSuggestion[] = [];
  currentStepFile: string = '';

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
