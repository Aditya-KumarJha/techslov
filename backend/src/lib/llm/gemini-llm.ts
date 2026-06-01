import { env } from '../../config/env.js';

function truncateForLog(value: string, maxLength = 2000) {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export class GeminiLlm {
  constructor() {
    if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY) {
      throw new Error('Either GEMINI_API_KEY or GROQ_API_KEY is required for text generation');
    }
  }

  async generateGemini(prompt: string) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined');
    }

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
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!response.ok) {
      const body = await response.text();
      const trimmedBody = truncateForLog(body);

      // Keep the failure visible in server logs with the remote payload attached.
      // eslint-disable-next-line no-console
      console.error('Gemini generation request failed', {
        status: response.status,
        statusText: response.statusText,
        body: trimmedBody
      });

      throw new Error(
        `Gemini generation request failed with status ${response.status}: ${trimmedBody || response.statusText}`
      );
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  }

  async generateGroq(prompt: string): Promise<string> {
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not defined');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const trimmedBody = truncateForLog(body);

      // eslint-disable-next-line no-console
      console.error('Groq generation request failed', {
        status: response.status,
        statusText: response.statusText,
        body: trimmedBody
      });

      throw new Error(
        `Groq generation request failed with status ${response.status}: ${trimmedBody || response.statusText}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    return data.choices?.[0]?.message?.content ?? '';
  }

  async generate(prompt: string): Promise<string> {
    try {
      if (env.GEMINI_API_KEY) {
        return await this.generateGemini(prompt);
      }
      throw new Error('Gemini API key is not configured, skipping to fallback.');
    } catch (geminiError) {
      // eslint-disable-next-line no-console
      console.warn('Gemini LLM failed or not configured, attempting fallback to Groq...', geminiError);

      if (env.GROQ_API_KEY) {
        try {
          return await this.generateGroq(prompt);
        } catch (groqError) {
          // eslint-disable-next-line no-console
          console.error('Groq fallback failed as well', groqError);
          throw new Error('Both Gemini and Groq fallback failed. Please try again after sometime.');
        }
      }

      throw new Error('Gemini failed and no Groq fallback is configured. Please try again after sometime.');
    }
  }
}
