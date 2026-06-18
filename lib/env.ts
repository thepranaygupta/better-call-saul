import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.url(),
  // Azure OpenAI is optional — app runs without AI
  AZURE_OPENAI_ENDPOINT: z.url().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
});

// Fail fast at startup if required env vars are missing
export const env = envSchema.parse(process.env);
