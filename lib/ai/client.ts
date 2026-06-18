import { z } from 'zod';

/**
 * Check whether all required Azure OpenAI env vars are set.
 * The app must work fully without AI — this is used to gate AI features.
 */
export function isAIAvailable(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_DEPLOYMENT &&
    process.env.AZURE_OPENAI_API_VERSION
  );
}

/**
 * Thin wrapper around Azure OpenAI chat completions.
 *
 * - Calls the Azure OpenAI REST API directly via fetch (no SDK dependency).
 * - Requests JSON mode (`response_format: { type: 'json_object' }`).
 * - Validates the response against a caller-supplied Zod schema, guaranteeing
 *   the return type at runtime — not just at compile time.
 * - Throws descriptive errors on network failure, API errors, or validation
 *   mismatches so callers can handle graceful degradation.
 */
export async function azureOpenAI<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !deployment || !apiVersion) {
    throw new Error(
      'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_VERSION.',
    );
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        store: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.3,
        top_p: 0.9,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    throw new Error(
      `Azure OpenAI network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(unable to read body)');
    throw new Error(
      `Azure OpenAI API error ${response.status} ${response.statusText}: ${errorBody}`,
    );
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      'Azure OpenAI returned an empty response (no choices[0].message.content).',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `Azure OpenAI returned non-JSON content: ${content.slice(0, 200)}`,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Azure OpenAI response failed schema validation: ${JSON.stringify(result.error.issues ?? result.error, null, 2)}`,
    );
  }

  return result.data;
}
