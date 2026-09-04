import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MANIFEST_PATH, isAdapter, type Adapter } from './layout.ts';
import { UserError } from './log.ts';
import { exists } from './paths.ts';

export const SCHEMA_VERSION = 1;

export interface Manifest {
  schemaVersion: number;
  version: string;
  adapters: Adapter[];
  /** Destination path (posix) → sha256 of the content this tool wrote. */
  managedFiles: Record<string, string>;
}

export function manifestPath(root: string): string {
  return path.join(root, MANIFEST_PATH);
}

export function hasManifest(root: string): boolean {
  return exists(manifestPath(root));
}

export function readManifest(root: string): Manifest {
  const file = manifestPath(root);
  if (!exists(file)) {
    throw new UserError(
      `no manifest at ${MANIFEST_PATH} — this repository has no ai-workflow install to update.\n` +
        '  Run `npx @baldurpan/create-ai-workflow` to install one.',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new UserError(`${MANIFEST_PATH} is not valid JSON: ${(error as Error).message}`);
  }
  const manifest = parsed as Partial<Manifest>;
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new UserError(
      `${MANIFEST_PATH} has schemaVersion ${String(manifest.schemaVersion)}; this tool writes ${SCHEMA_VERSION}.`,
    );
  }
  if (!manifest.managedFiles || typeof manifest.managedFiles !== 'object') {
    throw new UserError(`${MANIFEST_PATH} has no managedFiles map.`);
  }
  // An adapter this version does not know is dropped rather than carried: `managedFiles` still lists
  // whatever it wrote, so `update` reports those files as no longer shipped instead of losing them.
  const adapters = (manifest.adapters ?? []).filter(isAdapter);
  return {
    schemaVersion: SCHEMA_VERSION,
    version: manifest.version ?? '0.0.0',
    adapters: adapters.length ? adapters : ['claude'],
    managedFiles: manifest.managedFiles,
  };
}

export function writeManifest(root: string, manifest: Manifest): void {
  const file = manifestPath(root);
  mkdirSync(path.dirname(file), { recursive: true });
  const ordered: Manifest = {
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    adapters: manifest.adapters,
    managedFiles: Object.fromEntries(
      Object.entries(manifest.managedFiles).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  };
  writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}
