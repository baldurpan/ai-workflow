/**
 * The prose budget — DESIGN-RECORD §24.5.
 *
 *   npm run budget:report   what every command loads, and every file against its limit
 *   npm run budget:relock   write back the limits that have fallen, and only those
 *
 * `--relock` lowers a limit and can never raise one. A raise is typed by hand, with a `why` naming the
 * section of DESIGN-RECORD.md that justifies it — a budget a script can raise is a budget that
 * regenerates itself out of existence, which is what §24.2 watched happen to §17.2's cut.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');
export const templatesDir = path.join(packageRoot, 'templates');
export const budgetPath = path.join(packageRoot, 'templates.budget.json');
export const designRecordPath = path.join(packageRoot, '..', '..', 'DESIGN-RECORD.md');

export interface Entry {
  limit: number;
  why: string;
}

export interface Budget {
  note: string;
  slack: number;
  ceilings: Record<string, Entry & { files?: string[] }>;
  files: Record<string, Entry>;
}

/** Round up to the next 512 bytes. A limit is the line a file is already at, not a target. */
export const lock = (size: number): number => Math.ceil(size / 512) * 512;

/**
 * Files whose prose a command reads. `standards/` is left out: it is reference content a phase loads row by row
 * through the conditional table, and §25 leaves budgeting it as a separate decision.
 */
export function ourTemplates(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(templatesDir, full).split(path.sep).join('/'));
    }
  };
  walk(templatesDir);
  return out.filter((rel) => rel.endsWith('.md') && !rel.startsWith('standards/')).sort();
}

export const sizeOf = (rel: string): number => statSync(path.join(templatesDir, rel)).size;

export const readBudget = (): Budget => JSON.parse(readFileSync(budgetPath, 'utf8')) as Budget;

/** The `§N` and `§N.M` sections DESIGN-RECORD.md actually has, so a `why` cannot cite a missing one. */
export function recordSections(): Set<string> {
  const text = readFileSync(designRecordPath, 'utf8');
  return new Set([...text.matchAll(/^#{2,3} (\d+(?:\.\d+)?)[.\s]/gm)].map((m) => m[1] as string));
}

/**
 * What a command loads before it opens a source file, derived from the links its body carries rather
 * than from a list somebody keeps. A tool-owned file a command tells you to read is a markdown link; one
 * it only names in passing — the project's own `roadmap.md`, or a path it hands to a subagent — is bare
 * backticks. §17.1's table went stale against the files it measured; a derived one cannot.
 */
export function readSets(): { command: string; files: string[] }[] {
  const ours = new Set(ourTemplates());
  const block = 'blocks/agents-block.md';
  return readdirSync(path.join(templatesDir, 'skills'))
    .sort()
    .map((name) => {
      const body = readFileSync(path.join(templatesDir, 'skills', name, 'SKILL.md'), 'utf8');
      const linked = [...body.matchAll(/]\(\.\.\/\.\.\/\.\.\/context\/([a-z-]+(?:\.notes)?\.md)\)/g)].map(
        (m) => m[1] as string,
      );
      const files = [block, `skills/${name}/SKILL.md`];
      for (const name of [...new Set(linked)].sort()) {
        const stub = `stubs/${name}`;
        files.push(ours.has(stub) ? stub : `context/${name}`);
      }
      return { command: `/${name}`, files: files.filter((rel) => ours.has(rel)) };
    });
}

export const totalOf = (files: readonly string[]): number =>
  files.reduce((sum, rel) => sum + sizeOf(rel), 0);

function report(): void {
  const budget = readBudget();
  const rows = ourTemplates().map((rel) => ({
    rel,
    size: sizeOf(rel),
    limit: budget.files[rel]?.limit,
  }));
  const pad = Math.max(...rows.map((r) => r.rel.length));
  console.log('file'.padEnd(pad), '    bytes', '    limit', '  left');
  for (const { rel, size, limit } of rows.sort((a, b) => b.size - a.size)) {
    const left = limit === undefined ? 'UNBUDGETED' : String(limit - size);
    console.log(rel.padEnd(pad), String(size).padStart(9), String(limit ?? '—').padStart(9), left.padStart(7));
  }
  console.log('\nwhat a command loads before it opens a source file:\n');
  for (const { command, files } of readSets()) {
    console.log(`${command.padEnd(20)} ${String(totalOf(files)).padStart(8)}  ${files.length} files`);
  }
  console.log(
    `\nalways loaded: ${totalOf(budget.ceilings['always-loaded']?.files ?? [])}` +
      `  ·  our templates: ${totalOf(ourTemplates())} across ${ourTemplates().length} files`,
  );
}

function relock(): void {
  const budget = readBudget();
  const refused: string[] = [];
  const lowered: string[] = [];
  for (const rel of ourTemplates()) {
    const size = sizeOf(rel);
    const entry = budget.files[rel];
    if (entry === undefined) {
      budget.files[rel] = { limit: lock(size), why: 'TODO — name the DESIGN-RECORD section' };
      lowered.push(`${rel} added at ${lock(size)}`);
      continue;
    }
    if (size > entry.limit) {
      refused.push(`${rel} is ${size - entry.limit} over its limit of ${entry.limit}`);
      continue;
    }
    if (lock(size) < entry.limit) {
      lowered.push(`${rel} ${entry.limit} → ${lock(size)}`);
      entry.limit = lock(size);
    }
  }
  const always = budget.ceilings['always-loaded'];
  if (always !== undefined) {
    const size = totalOf(always.files ?? []);
    if (size <= always.limit && lock(size) < always.limit) {
      lowered.push(`always-loaded ${always.limit} → ${lock(size)}`);
      always.limit = lock(size);
    }
  }
  const all = budget.ceilings['our-templates'];
  if (all !== undefined) {
    const size = totalOf(ourTemplates());
    if (size <= all.limit && lock(size) < all.limit) {
      lowered.push(`our-templates ${all.limit} → ${lock(size)}`);
      all.limit = lock(size);
    }
  }
  budget.files = Object.fromEntries(Object.entries(budget.files).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`, 'utf8');
  for (const line of lowered) console.log(`lowered  ${line}`);
  for (const line of refused) console.log(`REFUSED  ${line}`);
  if (refused.length > 0) {
    console.log(
      '\nThis script only lowers. Raising a limit is a decision: write the section of DESIGN-RECORD.md\n' +
        'that justifies it, then type the new number and name that section in the entry\'s `why`.',
    );
    process.exitCode = 1;
  }
  if (lowered.length === 0 && refused.length === 0) console.log('every limit is already at its floor');
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  if (process.argv.includes('--relock')) relock();
  else report();
}
