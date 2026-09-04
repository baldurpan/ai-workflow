import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of the published package — the directory holding `templates/`. */
export const packageRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');

export const templatesDir = path.join(packageRoot, 'templates');

export function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/** sha256 of a buffer or string, hex. Line endings are normalised so a CRLF checkout is not a conflict. */
export function hash(content: string | Buffer): string {
  const text = typeof content === 'string' ? content : content.toString('utf8');
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Every file under `dir`, as paths relative to `dir`, sorted. Follows no symlinks. */
export function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full));
  }
  return out.sort();
}

export function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Always forward slashes — manifest keys are portable across platforms. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}
