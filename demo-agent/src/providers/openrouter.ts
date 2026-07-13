// ───────────────────────────────────────────────────────────────
// OpenRouter LLM Provider
//
// Default provider using OpenRouter's OpenAI-compatible API.
// OpenRouter provides access to dozens of models (including
// free-tier options) through a single API key, making Watch
// Tower truly provider-agnostic.
//
// Includes retry with exponential backoff for free-tier rate
// limits (429 responses).
// ───────────────────────────────────────────────────────────────

import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LLMProvider } from './types.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'OpenRouter';
  readonly model: string;
  private provider: ReturnType<typeof createOpenRouter>;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.provider = createOpenRouter({ apiKey });
  }

  async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text } = await generateText({
          model: this.provider(this.model),
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.3,
          maxTokens: 1024,
        });

        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const is429 = lastError.message.includes('429') || lastError.message.includes('Too Many');

        if (!is429 || attempt === MAX_RETRIES) break;

        // Exponential backoff: 2s → 4s → 8s
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error(`Failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message ?? 'unknown'}`);
  }
}
