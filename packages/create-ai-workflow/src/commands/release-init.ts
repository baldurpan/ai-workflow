import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { CONTEXT_DIR } from '../layout.ts';
import { bold, cyan, dim, green, info, UserError, warn } from '../log.ts';
import { hasManifest } from '../manifest.ts';
import { exists } from '../paths.ts';

/**
 * The one command in this tool that names a vendor, and the one that mutates `package.json`.
 *
 * It lives in `src/` rather than in a skill on purpose. The no-release-tool rule (DESIGN-RECORD §11.7) is a
 * rule about `templates/` — that prose is inherited by every install, including the Go and Python ones, so
 * a skill named after a JavaScript tool would be nonsense in half the repositories it lands in. This is a
 * program someone chooses to run, it refuses where it does not apply, and the test that forbids the vendor
 * name goes on scanning templates and goes on passing.
 *
 * It sets up the *note* half and stops. Nothing here tags, publishes or deploys — that last step plus its
 * credentials depends on branch protections and registry auth, and a generated workflow there does damage
 * (`/onboard` Step 9 says so, and still does after this command exists).
 *
 * **What it sets up is not a publishing mechanism, and the private-package answer is where that shows.** The
 * event it makes available is the merge of the pull request where `changeset:prepare-release` ran: the notes
 * are gone, the versions have moved, the changelogs are written. Publishing a package and deploying an app
 * are two consequences of that one merge, and the condition for either is *this path's version moved in it*
 * — which is why an app that deploys has to be versioned here, and why the question below is the one thing
 * this command refuses to guess. `context/release.md`'s *what a release ships* answer is where the event is
 * written down; `/onboard` writes it, and this is what makes it true.
 */

const CHANGESET_DIR = '.changeset';
const CLI_DEP = '@changesets/cli';
/** Pinned deliberately: the config below is written against this major, including `privatePackages`. */
const CLI_RANGE = '^3.0.2';
const CONFIG_SCHEMA = 'https://unpkg.com/@changesets/config@4.0.0/schema.json';

/**
 * They name the vendor, and that is deliberate. §11.7's rule protects `templates/` — prose every install
 * inherits — and these land in one project's `package.json`, three lines above `@changesets/cli` in its
 * devDependencies. Hiding the tool in the script name while it sits in the same file buys nothing and
 * costs a contributor the one word they would search when a command fails.
 *
 * `context/release.md` still records *the script name, never the raw command*, so flags keep one home; and
 * the skills still name no tool, which is the rule that was actually load-bearing.
 */
export const SCRIPT_NAMES = ['changeset:add', 'changeset:prepare-release', 'changeset:status'] as const;

export function scripts(baseBranch: string): Record<string, string> {
  return {
    'changeset:add': 'changeset',
    // `prepare-release`, not `version`: this is the only one of the three that cannot be run twice. It
    // consumes every pending note — deleting the files — bumps the versions and rewrites the changelogs,
    // and where a deploy watches versions it is the button that ships. Naming it for the field it edits
    // said none of that, and anything with `release` alone in it reads as *publish*, which it does not do.
    'changeset:prepare-release': 'changeset version',
    // A fetched remote is required for this to mean anything, and it exits non-zero when packages changed
    // without a note — which is it working. It stays out of `verify.md`: Gate 1 runs per phase and would
    // flag every docs-only change. The gate that wants it is CI, on the pull request.
    'changeset:status': `changeset status --since=origin/${baseBranch}`,
  };
}

export interface Pkg {
  /** Directory relative to the repository root, posix, `.` for a single-package repo. */
  rel: string;
  name: string;
  private: boolean;
}

/** `workspaces` is an array in npm and pnpm, and `{ packages: [...] }` in Yarn classic. */
export function workspacePatterns(manifest: unknown): string[] {
  const ws = (manifest as { workspaces?: unknown }).workspaces;
  if (Array.isArray(ws)) return ws.filter((p): p is string => typeof p === 'string');
  const packages = (ws as { packages?: unknown } | undefined)?.packages;
  if (Array.isArray(packages)) return packages.filter((p): p is string => typeof p === 'string');
  return [];
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function directoriesUnder(root: string, rel: string): string[] {
  try {
    return readdirSync(path.join(root, rel), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => `${rel}/${e.name}`);
  } catch {
    return [];
  }
}

/**
 * The packages a release tool would see. Only `dir/*` and literal paths are expanded — the shapes a
 * workspace actually uses. Anything cleverer here would be a glob engine written to be wrong in a way
 * nobody notices until a package is silently missing from the report.
 *
 * In a workspace the root package is not included, because the tool does not version it either.
 */
export function findPackages(root: string): Pkg[] {
  const rootManifest = readJson(path.join(root, 'package.json'));
  if (!rootManifest) return [];

  const patterns = workspacePatterns(rootManifest);
  if (patterns.length === 0) {
    return [
      {
        rel: '.',
        name: typeof rootManifest.name === 'string' ? rootManifest.name : path.basename(root),
        private: rootManifest.private === true,
      },
    ];
  }

  const dirs = new Set<string>();
  for (const pattern of patterns) {
    const clean = pattern.replace(/\/+$/, '');
    if (clean.endsWith('/*') || clean.endsWith('/**')) {
      for (const dir of directoriesUnder(root, clean.replace(/\/\*+$/, ''))) dirs.add(dir);
    } else if (!clean.includes('*')) {
      dirs.add(clean);
    }
  }

  const found: Pkg[] = [];
  for (const rel of [...dirs].sort()) {
    const manifest = readJson(path.join(root, rel, 'package.json'));
    if (!manifest) continue;
    found.push({
      rel,
      name: typeof manifest.name === 'string' ? manifest.name : rel,
      private: manifest.private === true,
    });
  }
  return found;
}

/** Never throws: a repository with no git, or no remote, gets the conventional answer. */
export function detectBaseBranch(root: string): string {
  const git = (args: string[]): string | null => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
  const head = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace(/^origin\//, '');
  return git(['branch', '--show-current']) || 'main';
}

export type PrivateAnswer = 'version' | 'ignore';

/**
 * Written from the answer rather than from the vendor's default, which is the single most valuable thing
 * this command does. The default is `{ version: false, tag: false }` — so a deployable app recorded as a
 * private package accumulates notes, never bumps, and the deploy half silently does nothing forever.
 *
 * Both answers are written out explicitly, including the one that matches the default, so that a reader
 * can tell a decision from an omission.
 */
export function changesetConfig(baseBranch: string, privatePackages: PrivateAnswer): string {
  const config = {
    $schema: CONFIG_SCHEMA,
    changelog: '@changesets/cli/changelog',
    commit: false,
    fixed: [],
    linked: [],
    // The default, and the safe one. Publishing is not configured by this command, so nothing here should
    // read as permission to publish.
    access: 'restricted',
    baseBranch,
    updateInternalDependencies: 'patch',
    ignore: [],
    // Tagging stays off either way: a tag on a deployed app is the deploy's business, not the note's — and
    // the deploy has a better thing to key on, which is that app's own version moving in the release merge.
    privatePackages: { version: privatePackages === 'version', tag: false },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function changesetReadme(): string {
  return `# Release notes, one file per change

Each file here is one note: YAML front matter naming the packages and their bump levels, then a markdown
summary that becomes the changelog entry.

\`\`\`md
---
"some-package": minor
---

What changed, written for whoever reads the release.
\`\`\`

**One or two sentences.** A note is read by someone deciding whether this affects them, not reviewing the
diff — so it says what changed for them and stops.

**Filenames are random on purpose.** Two differently-named files never conflict when two branches merge —
which is why a re-entered phase updates its existing note rather than writing a second one.

**A feature's merge ships nothing.** Its note lands here and waits. What ships is the merge of the pull
request where \`changeset:prepare-release\` was run — the notes consumed, the versions moved, the changelogs
written — and that one merge is the event for a published package and a deployed app alike. The condition for
either is **that path's own version moving in it**: a release that bumped only a package must not deploy the
app.

The answers that govern what gets a note here — which paths announce, to whom, how often, and what that merge
publishes or deploys — live in [\`../${CONTEXT_DIR}/release.md\`](../${CONTEXT_DIR}/release.md), not in
this file.
`;
}

/** Two spaces unless the file says otherwise — editing someone's manifest should not reformat it. */
export function detectIndent(text: string): string {
  const match = /\n([ \t]+)"/.exec(text);
  return match?.[1] ?? '  ';
}

/** Alphabetical where the object already is, appended where it is not. Either way, no reordering. */
function insert(
  object: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  const keys = Object.keys(object);
  const sorted = keys.every((k, i) => i === 0 || (keys[i - 1] as string) <= k);
  const next = [...keys, key];
  if (sorted) next.sort();
  return Object.fromEntries(next.map((k) => [k, k === key ? value : (object[k] as string)]));
}

export function patchPackageJson(text: string, baseBranch: string): string {
  const manifest = JSON.parse(text) as Record<string, unknown>;
  const indent = detectIndent(text);

  let devDependencies = (manifest.devDependencies ?? {}) as Record<string, string>;
  devDependencies = insert(devDependencies, CLI_DEP, CLI_RANGE);

  let scriptBlock = (manifest.scripts ?? {}) as Record<string, string>;
  for (const [name, command] of Object.entries(scripts(baseBranch))) {
    scriptBlock = insert(scriptBlock, name, command);
  }

  manifest.scripts = scriptBlock;
  manifest.devDependencies = devDependencies;
  const trailing = text.endsWith('\n') ? '\n' : '';
  return JSON.stringify(manifest, null, indent) + trailing;
}

export interface Preflight {
  problems: string[];
  notes: string[];
  packages: Pkg[];
}

/**
 * Every refusal, not the first one. Fixing them one round-trip at a time is the failure this shape exists
 * to prevent — the same reason `/tracking-migrate` reports its whole list before writing anything.
 */
export function preflight(root: string): Preflight {
  const problems: string[] = [];
  const notes: string[] = [];

  if (!hasManifest(root)) {
    problems.push(
      'this repository has no ai-workflow install.\n' +
        '    This command exists to make `context/release.md` true, and that file is not here.\n' +
        '    Run `npx @baldurpan/create-ai-workflow` first.',
    );
  }

  const manifestPath = path.join(root, 'package.json');
  if (!exists(manifestPath)) {
    problems.push(
      'no package.json here, so this project cannot use a JavaScript release tool.\n' +
        '    Its answer is a hand-maintained `## Unreleased` section, or whatever its own ecosystem\n' +
        '    uses. Put one in place, then run `/onboard` — Step 9 will find it and record it.',
    );
  }

  if (exists(path.join(root, CHANGESET_DIR))) {
    problems.push(
      `${CHANGESET_DIR}/ already exists — something already records notes here.\n` +
        '    Nothing to set up. Run `/onboard` to record it in `context/release.md`.',
    );
  }

  const packages = findPackages(root);
  const text = exists(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  if (text) {
    const existing = ((JSON.parse(text) as Record<string, unknown>).scripts ?? {}) as Record<
      string,
      string
    >;
    const taken = SCRIPT_NAMES.filter((name) => name in existing);
    if (taken.length > 0) {
      const named =
        taken.length === 1
          ? (taken[0] as string)
          : `${taken.slice(0, -1).join(', ')} and ${taken.at(-1) as string}`;
      problems.push(
        `package.json already has ${named}.\n` +
          '    Overwriting a script someone wrote is not this command\'s call. Rename or remove\n' +
          '    them, or set this up by hand and run `/onboard`.',
      );
    }
  }

  const changelog = path.join(root, 'CHANGELOG.md');
  if (exists(changelog) && /^##\s+\[?unreleased/im.test(readFileSync(changelog, 'utf8'))) {
    notes.push(
      'CHANGELOG.md has an `## Unreleased` section. It is left exactly where it is — the tool\n' +
        '    writes below it, and that section stands as the record of how this repository worked\n' +
        '    before. Converting those bullets into note files would be inventing history.',
    );
  }

  return { problems, notes, packages };
}

async function ask(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function releaseInit(
  root: string,
  options: { dryRun: boolean; privatePackages: PrivateAnswer | null },
): Promise<number> {
  const { problems, notes, packages } = preflight(root);
  if (problems.length > 0) {
    throw new UserError(
      `cannot set up a release note mechanism here.\n\n  ${problems.map((p) => `- ${p}`).join('\n\n  ')}`,
    );
  }

  const publishable = packages.filter((p) => !p.private);
  const privates = packages.filter((p) => p.private);
  const baseBranch = detectBaseBranch(root);

  info(bold('What is here'));
  info(
    `  ${publishable.length} publishable package${publishable.length === 1 ? '' : 's'}` +
      (publishable.length > 0 ? ` ${dim(publishable.map((p) => p.name).join(', '))}` : ''),
  );
  info(
    `  ${privates.length} private package${privates.length === 1 ? '' : 's'}` +
      (privates.length > 0 ? ` ${dim(privates.map((p) => p.name).join(', '))}` : ''),
  );
  info(`  base branch ${dim(baseBranch)}`);
  for (const note of notes) {
    info();
    warn(note);
  }

  // The one judgment in the command, and the one thing it must not guess. Getting it wrong in the safe-
  // looking direction is the failure that hides for months: notes accumulate, no version moves, the deploy
  // never fires.
  let answer: PrivateAnswer = options.privatePackages ?? 'ignore';
  if (privates.length > 0 && options.privatePackages === null) {
    if (!process.stdin.isTTY) {
      throw new UserError(
        `this repository has ${privates.length} private package${privates.length === 1 ? '' : 's'} and nothing to ask.\n` +
          '  A private package is not versioned by default. If one of them is a deployed app, that\n' +
          '  default leaves its deploy with nothing to key on: the version never moves on the release\n' +
          '  merge, so the deploy either never fires or gets wired to every merge instead — which ships\n' +
          '  whatever notes happen to be pending. Re-run with `--private-packages version` if any of\n' +
          '  these is deployed, or `--private-packages ignore` if they are all fixtures:\n' +
          privates.map((p) => `    ${p.name} ${dim(p.rel)}`).join('\n'),
      );
    }
    info();
    info(dim('  A private package is not versioned by default — it would collect notes and never bump.'));
    info(dim('  That version moving on the release merge is what a deploy keys on, so left off, the app'));
    info(dim('  either never deploys or gets wired to every merge instead — which ships whatever notes'));
    info(dim("  happen to be pending, other people's included."));
    answer = (await ask('  Is any of those private packages deployed?')) ? 'version' : 'ignore';
  }

  const config = changesetConfig(baseBranch, answer);
  const readme = changesetReadme();
  const manifestPath = path.join(root, 'package.json');
  const patched = patchPackageJson(readFileSync(manifestPath, 'utf8'), baseBranch);

  info();
  info(bold(options.dryRun ? 'Would write' : 'Wrote'));
  info(`  ${green('+')} ${CHANGESET_DIR}/config.json ${dim(`privatePackages.version: ${answer === 'version'}`)}`);
  info(`  ${green('+')} ${CHANGESET_DIR}/README.md ${dim('— the note format, and a pointer to context/release.md')}`);
  info(`  ${green('~')} package.json ${dim(`— ${CLI_DEP} ${CLI_RANGE}, and ${SCRIPT_NAMES.length} scripts`)}`);
  for (const [name, command] of Object.entries(scripts(baseBranch))) {
    info(`      ${cyan(name)} ${dim(command)}`);
  }

  if (options.dryRun) {
    info();
    info(dim('  --dry-run: nothing was written.'));
    return 0;
  }

  mkdirSync(path.join(root, CHANGESET_DIR), { recursive: true });
  writeFileSync(path.join(root, CHANGESET_DIR, 'config.json'), config, 'utf8');
  writeFileSync(path.join(root, CHANGESET_DIR, 'README.md'), readme, 'utf8');
  writeFileSync(manifestPath, patched, 'utf8');

  info();
  info(bold('Next'));
  info(`  1. ${cyan('npm install')} ${dim('— this command writes files and runs nothing.')}`);
  info(`  2. Run ${cyan('/onboard')}. Step 9 will find ${CHANGESET_DIR}/ and record it in`);
  info(`     ${cyan(`${CONTEXT_DIR}/release.md`)} — the answer nothing could write until now.`);
  info();
  info(bold('What this did not do'));
  info(dim('  Nothing here tags, publishes or deploys, and no CI workflow was generated — neither the'));
  info(dim('  publish nor the deploy, which are two consequences of one event and one gap rather than'));
  info(`  ${dim('two. The event is the merge of the pull request where')} ${cyan('changeset:prepare-release')} ${dim('ran.')}`);
  info(dim('  Write those jobs yourself: the credentials and the branch protections are yours, and the'));
  info(dim("  condition for either half is that path's own version moving in that merge — never that a"));
  info(dim('  release happened, which would deploy an app a package-only release never touched.'));
  info(dim('  Nothing was committed.'));
  return 0;
}
