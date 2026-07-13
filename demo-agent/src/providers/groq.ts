// ───────────────────────────────────────────────────────────────
// Groq LLM Provider
//
// Direct HTTP integration with Groq's OpenAI-compatible API.
// No SDK dependency — avoids version mismatches.
// Groq offers a generous free tier (~30 RPM) with ultra-fast
// inference, ideal for hackathon demos.
// ───────────────────────────────────────────────────────────────

import type { LLMProvider } from './types.js';

interface GroqMessage {
  role: 'system' | 'user';
  content: string;
}

interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
}

export class GroqProvider implements LLMProvider {
  readonly name = 'Groq';
  readonly model: string;
  private apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown error');
      throw new Error(`Groq API error (${res.status}): ${body}`);
    }

    const json = (await res.json()) as GroqResponse;
    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Groq returned an empty response.');
    }

    return content;
  }
}
