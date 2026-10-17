import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

export function config() {
  // Load credentials for runtime use only; never inspect or print values.
  for (const file of ['.env', '.env.backend.local']) if (existsSync(file)) loadEnvFile(file);
  // Map the CLI-managed resource name to the application adapter at runtime.
  process.env.NEON_DATABASE_URL ??= process.env.NEON_POSTGRES_CONNECTION_STRING;
  return { db: resolve(process.env.BOUNTYBOX_DATA_DIR ?? '.bounty-box', 'runs.sqlite3'),
    token: process.env.BOUNTYBOX_API_TOKEN, port: Number(process.env.PORT ?? 3000) };
}
