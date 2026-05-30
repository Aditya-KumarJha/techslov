import { env } from '../../config/env.js';

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class GeminiLlm {
  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for Gemini text generation');
    }
  }

  async generate(prompt: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 900
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini generation request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  }
}
