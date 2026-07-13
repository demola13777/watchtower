// ───────────────────────────────────────────────────────────────
// Provider Factory
//
// Instantiates the active LLM provider based on environment
// configuration. Adding a new provider is a single case statement.
// ───────────────────────────────────────────────────────────────

import type { LLMProvider } from './types.js';
import { OpenRouterProvider } from './openrouter.js';
import { GroqProvider } from './groq.js';

export function createProvider(): LLMProvider {
  const providerName = process.env.LLM_PROVIDER || 'groq';

  switch (providerName.toLowerCase()) {
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is required. See .env.example');
      const model = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free';
      return new OpenRouterProvider(apiKey, model);
    }

    case 'groq': {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('GROQ_API_KEY is required. Get one free at https://console.groq.com/keys');
      const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      return new GroqProvider(apiKey, model);
    }

    // Future providers:
    // case 'openai': { ... }
    // case 'anthropic': { ... }

    default:
      throw new Error(`Unknown LLM provider: "${providerName}". Supported: groq, openrouter`);
  }
}
