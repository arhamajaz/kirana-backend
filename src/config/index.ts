import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof configSchema>;
