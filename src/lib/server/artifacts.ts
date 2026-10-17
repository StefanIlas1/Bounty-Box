import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GeneratedApp } from '../contracts';

/** This exact canonical envelope is shared with the provider runner. */
export function artifactJson(app: GeneratedApp): string {
  return JSON.stringify({ files: [...app.files].sort((a, b) => a.path.localeCompare(b.path)).map(({ path, content }) => ({ path, content })),
    start: { command: app.start.command, args: app.start.args, port: app.start.port },
    loadTest: { command: app.loadTest.command, args: app.loadTest.args },
    requiredEnvNames: [...app.requiredEnvNames].sort(), revision: app.revision });
}
export function artifactDigest(app: GeneratedApp): string {
  return createHash('sha256').update(artifactJson(app)).digest('hex');
}
export function saveArtifact(root: string, app: GeneratedApp): string {
  const json = artifactJson(app);
  const digest = artifactDigest(app);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const dest = join(root, digest + '.json');
  if (existsSync(dest)) {
    if (readFileSync(dest, 'utf8') !== json) throw new Error('Stored artifact digest collision or corruption');
    return digest;
  }
  const temp = join(root, '.' + randomUUID() + '.tmp');
  writeFileSync(temp, json, { flag: 'wx', mode: 0o600 });
  renameSync(temp, dest);
  return digest;
}
export function readArtifact(root: string, digest: string): GeneratedApp {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Invalid artifact digest');
  const app = JSON.parse(readFileSync(join(root, digest + '.json'), 'utf8')) as GeneratedApp;
  if (artifactDigest(app) !== digest) throw new Error('Artifact integrity check failed');
  return app;
}
