import { config } from '../src/lib/server/config';
config();
async function main() {
  const connection = process.env.NEON_DATABASE_URL;
  if (!connection) throw new Error('Missing Neon connection');
  const host = new URL(connection).hostname;
  if (!host.endsWith('.neon.tech')) throw new Error('Unexpected Neon host');
  const endpoint = `https://${host.replace(/^[^.]+\./, 'api.')}/sql`;
  const response = await fetch(endpoint, { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(30_000), headers: {
      'Content-Type': 'application/json', 'Neon-Connection-String': connection,
      'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'true',
    }, body: JSON.stringify({ query: 'SELECT 1 AS connected', params: [] }) });
  if (!response.ok) throw new Error(`Neon query failed: HTTP ${response.status}`);
  const value = await response.json() as { rows?: unknown[][] };
  if (String(value.rows?.[0]?.[0]) !== '1') throw new Error('Unexpected Neon result');
  console.log(JSON.stringify({ ok: true, provider: 'Neon', connection: 'verified', secrets: 'withheld' }));
}
main().catch(error => { console.error(error instanceof Error && /^(Missing|Unexpected|Neon query)/.test(error.message) ? error.message : 'Neon connectivity check failed; credentials withheld'); process.exitCode = 1; });
