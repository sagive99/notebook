import { z } from 'zod';

const configSchema = z.object({
  googleClientId: z
    .string()
    .trim()
    .regex(/^[\w-]+\.apps\.googleusercontent\.com$/u, 'VITE_GOOGLE_CLIENT_ID must be an OAuth web client ID')
    .nullable(),
});

export type AppConfig = z.infer<typeof configSchema>;

/** Parses build-time configuration once at startup; an empty client ID selects local-only mode. */
export const loadConfig = (env: Record<string, string | boolean | undefined>): AppConfig => {
  const rawClientId = typeof env.VITE_GOOGLE_CLIENT_ID === 'string' && env.VITE_GOOGLE_CLIENT_ID.trim() !== '' ? env.VITE_GOOGLE_CLIENT_ID : null;

  return configSchema.parse({ googleClientId: rawClientId });
};
