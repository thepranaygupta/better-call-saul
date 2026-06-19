import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI client tests — mock global.fetch, never hit the real Azure API.
// ---------------------------------------------------------------------------

// We need to dynamically import the module after setting env vars,
// so we can test the env-var checks properly.
async function loadModule() {
  // Clear the module cache so env var changes take effect
  vi.resetModules();
  return import('@/lib/ai/client');
}

// Helpers to set/clear Azure env vars
function setAzureEnv() {
  process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
  process.env.AZURE_OPENAI_API_KEY = 'test-api-key';
  process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o';
  process.env.AZURE_OPENAI_API_VERSION = '2024-06-01';
}

function clearAzureEnv() {
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
  delete process.env.AZURE_OPENAI_API_VERSION;
}

// A simple Zod schema for testing azureOpenAI's validation path
const testSchema = z.object({
  name: z.string(),
  value: z.number(),
});

/**
 * Build a mock Response that mimics the Azure OpenAI chat completions shape.
 */
function mockAzureResponse(content: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    json: async () => ({
      choices: [{ message: { content } }],
    }),
    text: async () => content,
    headers: new Headers(),
  } as unknown as Response;
}

function mockEmptyResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ choices: [] }),
    text: async () => '{"choices":[]}',
    headers: new Headers(),
  } as unknown as Response;
}

function mockErrorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    statusText: 'Bad Request',
    json: async () => ({}),
    text: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isAIAvailable', () => {
  afterEach(() => {
    clearAzureEnv();
  });

  it('returns false when env vars are missing', async () => {
    clearAzureEnv();
    const { isAIAvailable } = await loadModule();
    expect(isAIAvailable()).toBe(false);
  });

  it('returns false when only some env vars are set', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    // AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_API_VERSION are missing
    const { isAIAvailable } = await loadModule();
    expect(isAIAvailable()).toBe(false);
  });

  it('returns true when all 4 env vars are set', async () => {
    setAzureEnv();
    const { isAIAvailable } = await loadModule();
    expect(isAIAvailable()).toBe(true);
  });
});

describe('azureOpenAI', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAzureEnv();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    clearAzureEnv();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('throws when env vars are not configured', async () => {
    clearAzureEnv();
    const { azureOpenAI } = await loadModule();
    await expect(
      azureOpenAI('system', 'user', testSchema),
    ).rejects.toThrow('Azure OpenAI is not configured');
  });

  it('throws descriptive error on non-200 response', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockErrorResponse(429, 'Rate limit exceeded'),
    );
    const { azureOpenAI } = await loadModule();
    await expect(
      azureOpenAI('system', 'user', testSchema),
    ).rejects.toThrow(/Azure OpenAI API error 429/);
  });

  it('throws on empty response (no choices)', async () => {
    fetchSpy.mockResolvedValueOnce(mockEmptyResponse());
    const { azureOpenAI } = await loadModule();
    await expect(
      azureOpenAI('system', 'user', testSchema),
    ).rejects.toThrow(/empty response/i);
  });

  it('throws on non-JSON content', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockAzureResponse('This is plain text, not JSON'),
    );
    const { azureOpenAI } = await loadModule();
    await expect(
      azureOpenAI('system', 'user', testSchema),
    ).rejects.toThrow(/non-JSON content/i);
  });

  it('throws on Zod validation failure (valid JSON but wrong shape)', async () => {
    // Valid JSON but does not match testSchema (missing "value" number)
    fetchSpy.mockResolvedValueOnce(
      mockAzureResponse(JSON.stringify({ name: 'test', extra: true })),
    );
    const { azureOpenAI } = await loadModule();
    await expect(
      azureOpenAI('system', 'user', testSchema),
    ).rejects.toThrow(/schema validation/i);
  });

  it('returns validated data on success', async () => {
    const payload = { name: 'hello', value: 42 };
    fetchSpy.mockResolvedValueOnce(
      mockAzureResponse(JSON.stringify(payload)),
    );
    const { azureOpenAI } = await loadModule();
    const result = await azureOpenAI('system', 'user', testSchema);
    expect(result).toEqual(payload);
  });

  it('sends correct request shape to Azure', async () => {
    const payload = { name: 'check', value: 1 };
    fetchSpy.mockResolvedValueOnce(
      mockAzureResponse(JSON.stringify(payload)),
    );
    const { azureOpenAI } = await loadModule();
    await azureOpenAI('my system prompt', 'my user prompt', testSchema);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain('openai/deployments/gpt-4o/chat/completions');
    expect(url).toContain('api-version=2024-06-01');
    expect(options.method).toBe('POST');
    expect(options.headers['api-key']).toBe('test-api-key');

    const body = JSON.parse(options.body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'my system prompt' },
      { role: 'user', content: 'my user prompt' },
    ]);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('throws on network error (fetch rejects)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { azureOpenAI } = await loadModule();
    await expect(
      azureOpenAI('system', 'user', testSchema),
    ).rejects.toThrow(/network error.*ECONNREFUSED/i);
  });
});
