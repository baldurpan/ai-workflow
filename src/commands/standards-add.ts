import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseTables } from '../check/markdown.ts';
import { STANDARDS_PREFIX } from '../layout.ts';
import { bold, cyan, dim, green, info, UserError, warn } from '../log.ts';
import { readManifest, writeManifest } from '../manifest.ts';
import { exists, walk } from '../paths.ts';

const INDEX_HEADER = ['If the task involves…', 'Load…'];

function git(args: string[], cwd?: string): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const message = (error as { stderr?: string }).stderr ?? (error as Error).message;
    throw new UserError(`git ${args[0]} failed:\n  ${message.trim()}`);
  }
}

/**
 * The conditional-loading table is the interface, not the files behind it — agents read that table and pull
 * exactly what it names. A tree whose README has no usable table is a tree the skills cannot navigate.
 */
export function findIndexTable(readme: string, root: string): { rows: number; missing: string[] } | null {
  for (const table of parseTables(readme)) {
    if (table.header.length < 2 || table.rows.length < 2) continue;
    const targets = table.rows.flatMap((row) =>
      [...(row.cells[1] ?? '').matchAll(/\]\(([^)\s#]+)/g)].map((m) => m[1] as string),
    );
    if (targets.length < 2) continue;
    const missing = targets.filter((t) => !/^[a-z]+:/i.test(t) && !existsSync(path.join(root, t)));
    return { rows: table.rows.length, missing: [...new Set(missing)] };
  }
  return null;
}

export function generateIndexTable(root: string): string {
  const files = walk(root).filter((rel) => rel.endsWith('.md') && path.dirname(rel) !== '.');
  const byDir = new Map<string, string[]>();
  for (const rel of files) {
    const dir = rel.split(path.sep)[0] as string;
    byDir.set(dir, [...(byDir.get(dir) ?? []), rel.split(path.sep).join('/')]);
  }

  const lines = [
    '## Conditional loading',
    '',
    '**Generated from this tree\'s directory structure at install time.** It is a starting point, not a',
    'considered index — rewrite the left column to say what each group is actually *for*, because that is',
    'the column agents match against.',
    '',
    `| ${INDEX_HEADER.join(' | ')} |`,
    '|---|---|',
  ];
  for (const [dir, paths] of [...byDir].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const links = paths.map((p) => `[\`${p}\`](${p})`).join(', ');
    lines.push(`| ${dir} | ${links} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function standardsAdd(
  root: string,
  url: string,
  options: { generateIndex: boolean },
): Promise<number> {
  const manifest = readManifest(root);
  const destination = path.join(root, STANDARDS_PREFIX.replace(/\/$/, ''));

  const scratch = mkdtempSync(path.join(tmpdir(), 'ai-workflow-standards-'));
  try {
    info(`${dim('cloning')} ${url}`);
    git(['clone', '--depth', '1', '--quiet', url, scratch]);
    const ref = git(['rev-parse', 'HEAD'], scratch).trim();

    const readmePath = path.join(scratch, 'README.md');
    if (!exists(readmePath)) {
      throw new UserError(
        'that repository has no README.md.\n' +
          `  The skills say "consult the conditional loading table in ${STANDARDS_PREFIX}README.md";\n` +
          '  without that file there is nothing for an agent to traverse. Refusing to install it.',
      );
    }

    const readme = readFileSync(readmePath, 'utf8');
    const table = findIndexTable(readme, scratch);
    let generated: string | null = null;

    if (table === null) {
      info();
      warn('that README has no conditional-loading table.');
      info(dim('  Agents read that table and load exactly what it names. Without one, the standards are'));
      info(dim('  present but unreachable, and every task loads nothing or everything.'));
      info();
      const ok = options.generateIndex || (await confirm('Generate one from the directory structure?'));
      if (!ok) {
        throw new UserError(
          'refusing to install a standards tree the skills cannot navigate.\n' +
            '  Add a conditional-loading table to that repo\'s README.md, or re-run with --generate-index.',
        );
      }
      generated = generateIndexTable(scratch);
    } else if (table.missing.length > 0) {
      warn(
        `the conditional-loading table names ${table.missing.length} file${table.missing.length === 1 ? '' : 's'} that ` +
          'do not exist in that repository:',
      );
      for (const missing of table.missing.slice(0, 10)) info(`    ${missing}`);
      if (table.missing.length > 10) info(dim(`    …and ${table.missing.length - 10} more`));
      info(dim('  Installed anyway — those rows will simply never resolve.'));
    } else {
      info(`${green('ok')} conditional-loading table found — ${table.rows} rows, every target resolves`);
    }

    rmSync(path.join(scratch, '.git'), { recursive: true, force: true });
    if (generated) {
      writeFileSync(readmePath, `${readme.replace(/\s+$/, '')}\n\n${generated}`, 'utf8');
    }
    writeFileSync(
      path.join(scratch, '.source'),
      `# Origin of this standards tree. Project-owned: \`update\` does not reach it.\n` +
        `origin=${url}\nref=${ref}\nvendored=${new Date().toISOString()}\n`,
      'utf8',
    );

    rmSync(destination, { recursive: true, force: true });
    cpSync(scratch, destination, { recursive: true });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  // Whatever lands is project-owned from this point — it drops out of the manifest, so `update` can never
  // clobber it.
  let dropped = 0;
  for (const key of Object.keys(manifest.managedFiles)) {
    if (key.startsWith(STANDARDS_PREFIX)) {
      delete manifest.managedFiles[key];
      dropped += 1;
    }
  }
  writeManifest(root, manifest);

  info();
  info(`${green('done')} ${STANDARDS_PREFIX} replaced from ${bold(url)}`);
  if (dropped > 0) {
    info(dim(`  ${dropped} entries dropped from the manifest — this tree is yours now, and updates`));
    info(dim('  will never overwrite it.'));
  }
  info(`  Review the diff, then check that ${cyan(`${STANDARDS_PREFIX}README.md`)} reads as an index an agent`);
  info('  would actually follow. Nothing was committed.');
  return 0;
}
