import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  changesetConfig,
  changesetReadme,
  detectIndent,
  findPackages,
  patchPackageJson,
  preflight,
  scripts,
  SCRIPT_NAMES,
  workspacePatterns,
} from '../src/commands/release-init.ts';
import { MANIFEST_PATH, readTemplate } from '../src/layout.ts';
import { packageRoot, templatesDir, walk } from '../src/paths.ts';

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'aiw-release-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return root;
}

/** Enough of an install for `hasManifest` — this command refuses where there is no answer to make true. */
const INSTALLED = { [MANIFEST_PATH]: '{}' };
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe('the vendor lives in src/, and that is the whole boundary', () => {
  // The sibling of templates.test.ts's "no template names a release tool", asserted from the other side.
  // That rule is about `templates/` because template prose is inherited by every install, including the Go
  // and Python ones. A CLI subcommand is a program someone chooses to run, so it may name what it installs
  // — and if this ever inverts, one of the two tests goes red instead of the decision going quiet.
  it('names the tool it installs, because a command that installs one has to', () => {
    const source = readFileSync(path.join(packageRoot, 'src/commands/release-init.ts'), 'utf8');
    assert.match(source, /@changesets\/cli/, 'the dependency is named in the command');
  });

  it('leaks none of it into the templates — the skills still read an answer, not a tool', () => {
    const TOOLS = /\b(changesets?|towncrier|semantic-release|release-please)\b/i;
    for (const rel of walk(templatesDir).filter((r) => r.endsWith('.md'))) {
      if (rel.split(path.sep).includes('standards')) continue;
      const hit = TOOLS.exec(readFileSync(path.join(templatesDir, rel), 'utf8'));
      assert.equal(hit, null, `${rel} names a release tool: ${hit?.[0] ?? ''}`);
    }
  });

  it('the scripts name the vendor, because they land in a file that already does', () => {
    // The rule protects `templates/`. These land in one project's package.json, three lines above
    // `@changesets/cli` in its devDependencies — hiding the tool there buys nothing and costs a
    // contributor the one word they would search when a command fails.
    for (const name of SCRIPT_NAMES) assert.match(name, /^changeset:/, `${name} names what it runs`);
  });

  it('the irreversible one is named for what it readies, and never reads as publish', () => {
    // It consumes every pending note, bumps the versions and rewrites the changelogs. `version` named the
    // field it edits; anything with `release` alone in it reads as *publish*, which it does not do.
    assert.ok(SCRIPT_NAMES.includes('changeset:prepare-release'), 'it says what it prepares');
    assert.ok(!SCRIPT_NAMES.some((n) => /version/.test(n)), 'not the field it edits');
    // `prepare-release` is fine — *prepare* is the verb. `changelog:release` is not: there *release* is the
    // verb, and as a verb it means publish.
    assert.ok(
      !SCRIPT_NAMES.some((n) => /(^|:)release$/.test(n)),
      'no script has `release` as its verb, which would read as publish',
    );
    assert.equal(scripts('main')['changeset:prepare-release'], 'changeset version');
  });

  it('the status check carries the flag, so it has one home', () => {
    assert.equal(scripts('main')['changeset:status'], 'changeset status --since=origin/main');
    assert.equal(scripts('trunk')['changeset:status'], 'changeset status --since=origin/trunk');
  });

  it('/onboard offers it and does not run it, and still installs nothing itself', () => {
    const body = readTemplate('skills/onboard/SKILL.md').replace(/\s+/g, ' ');
    assert.match(body, /release-init/, 'Step 9 names the command that closes the gap');
    assert.match(body, /\*\*Offer it; do not run it\.\*\*/, 'and refuses to run it');
    assert.match(body, /\*\*This step installs nothing\.\*\*/, 'the refusal it already had survives');
    assert.match(body, /--private-packages/, 'the sweep it already does is handed over as flags');
  });
});

describe('what the tool would see', () => {
  it('a single-package repository is one package, and that is a real answer', () => {
    const root = tree({ 'package.json': json({ name: 'app', private: true }) });
    assert.deepEqual(findPackages(root), [{ rel: '.', name: 'app', private: true }]);
    rmSync(root, { recursive: true, force: true });
  });

  it('a workspace expands dir/* and leaves the root package out, as the tool does', () => {
    const root = tree({
      'package.json': json({ name: 'root', private: true, workspaces: ['packages/*', 'apps/*'] }),
      'packages/cli/package.json': json({ name: '@scope/cli' }),
      'packages/util/package.json': json({ name: '@scope/util' }),
      'apps/web/package.json': json({ name: 'web', private: true }),
    });
    assert.deepEqual(findPackages(root), [
      { rel: 'apps/web', name: 'web', private: true },
      { rel: 'packages/cli', name: '@scope/cli', private: false },
      { rel: 'packages/util', name: '@scope/util', private: false },
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  it("reads Yarn classic's object form as well as the array", () => {
    assert.deepEqual(workspacePatterns({ workspaces: ['packages/*'] }), ['packages/*']);
    assert.deepEqual(workspacePatterns({ workspaces: { packages: ['libs/*'] } }), ['libs/*']);
    assert.deepEqual(workspacePatterns({}), []);
  });

  it('skips a workspace directory with no package.json instead of inventing one', () => {
    const root = tree({
      'package.json': json({ name: 'root', workspaces: ['packages/*'] }),
      'packages/real/package.json': json({ name: 'real' }),
      'packages/scratch/notes.md': '#\n',
    });
    assert.deepEqual(
      findPackages(root).map((p) => p.name),
      ['real'],
    );
    rmSync(root, { recursive: true, force: true });
  });
});

describe('what it sets up is a gate, and the gate is not only for publishing', () => {
  // The first cut of this command read as a way to publish npm packages. A deploy was mentioned once, as
  // the reason to answer the private-package question — and nowhere did anything say what actually puts an
  // app in front of users. It is the same event as the publish: the merge of the pull request where
  // `changeset:prepare-release` ran. The command cannot write that answer (that is `/onboard`'s file), so
  // what it owes is the event named in the two places it does write — the notes README, and its own report.
  it('the notes README names the event, and says a feature merge is not it', () => {
    const readme = changesetReadme();
    assert.match(readme, /A feature's merge ships nothing/i);
    assert.match(readme, /changeset:prepare-release/, 'the script whose merge is the event');
    assert.match(
      readme,
      /the event for a published package and a deployed app alike/i,
      'one event, not one per artifact kind',
    );
    assert.match(readme, /that path's own version moving in it/i, 'and the per-path condition');
  });

  it('the report refuses both jobs as one gap, and names what either would key on', () => {
    // Matched a printed line at a time, because each one is its own string literal in the report.
    const source = readFileSync(path.join(packageRoot, 'src/commands/release-init.ts'), 'utf8');
    assert.match(
      source,
      /publish nor the deploy, which are two consequences of one event and one gap/,
      'the refusal covers both halves, and says they are not two decisions',
    );
    assert.match(source, /The event is the merge of the pull request where/, 'and names the event');
    assert.match(
      source,
      /condition for either half is that path's own version moving in that merge/,
      'with the condition either job would read',
    );
    assert.match(
      source,
      /release happened, which would deploy an app a package-only release never touched/,
      'and the wrong condition named as wrong, because it is the one someone reaches for',
    );
  });

  it('the private-package question is asked as the gate it wires, not as a preference', () => {
    // Answering it wrong in the safe-looking direction is the failure that hides for months, and the reason
    // it hides is that nothing said what the version was *for*.
    const source = readFileSync(path.join(packageRoot, 'src/commands/release-init.ts'), 'utf8');
    assert.match(source, /version moving on the release merge is what a deploy keys on/i, 'on a terminal');
    assert.match(source, /leaves its deploy with nothing to key on/i, 'and in the refusal without one');
    assert.match(
      source,
      /gets wired to every merge instead/i,
      'including what it degrades into, which is worse than never firing',
    );
  });
});

describe('the private-package answer is written, never defaulted', () => {
  // The single most valuable thing this command does. The vendor default is `{version: false, tag: false}`,
  // so a deployable app recorded as a private package accumulates notes, never bumps, and the deploy half
  // silently does nothing forever.
  it('turns versioning on for a deployed private package', () => {
    const config = JSON.parse(changesetConfig('main', 'version')) as Record<string, unknown>;
    assert.deepEqual(config.privatePackages, { version: true, tag: false });
  });

  it('writes the other answer out too, so a reader can tell a decision from an omission', () => {
    const config = JSON.parse(changesetConfig('main', 'ignore')) as Record<string, unknown>;
    assert.deepEqual(config.privatePackages, { version: false, tag: false });
  });

  it('leaves tagging off either way — a tag on a deployed app is the deploy\'s business', () => {
    for (const answer of ['version', 'ignore'] as const) {
      const config = JSON.parse(changesetConfig('main', answer)) as {
        privatePackages: { tag: boolean };
      };
      assert.equal(config.privatePackages.tag, false);
    }
  });

  it('carries the base branch it detected, and configures no publish', () => {
    const config = JSON.parse(changesetConfig('trunk', 'ignore')) as Record<string, unknown>;
    assert.equal(config.baseBranch, 'trunk');
    assert.equal(config.access, 'restricted', 'nothing here reads as permission to publish');
  });
});

describe('editing someone else\'s manifest', () => {
  it('adds the dependency and the three scripts', () => {
    const patched = JSON.parse(patchPackageJson(json({ name: 'app' }), 'main')) as {
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    assert.match(patched.devDependencies['@changesets/cli'] as string, /^\^3\./);
    assert.deepEqual(Object.keys(patched.scripts).sort(), [...SCRIPT_NAMES].sort());
  });

  it('does not reformat the file it was handed', () => {
    const fourSpace = '{\n    "name": "app",\n    "scripts": {\n        "build": "tsc"\n    }\n}\n';
    assert.equal(detectIndent(fourSpace), '    ');
    const patched = patchPackageJson(fourSpace, 'main');
    assert.match(patched, /\n {4}"name": "app",/, 'the indent it found is the indent it writes');
    assert.ok(patched.endsWith('}\n'), 'and the trailing newline survives');
  });

  it('keeps a sorted object sorted, and appends to one that is not', () => {
    const sorted = json({ name: 'a', devDependencies: { aaa: '1', zzz: '1' } });
    const keys = (
      JSON.parse(patchPackageJson(sorted, 'main')) as { devDependencies: Record<string, string> }
    ).devDependencies;
    assert.deepEqual(Object.keys(keys), ['@changesets/cli', 'aaa', 'zzz']);

    const unsorted = json({ name: 'a', devDependencies: { zzz: '1', aaa: '1' } });
    const appended = (
      JSON.parse(patchPackageJson(unsorted, 'main')) as { devDependencies: Record<string, string> }
    ).devDependencies;
    assert.deepEqual(Object.keys(appended), ['zzz', 'aaa', '@changesets/cli'], 'no reordering');
  });

  it('leaves every script it did not write exactly where it was', () => {
    const before = json({ name: 'a', scripts: { build: 'tsc', test: 'node --test' } });
    const after = (JSON.parse(patchPackageJson(before, 'main')) as { scripts: Record<string, string> })
      .scripts;
    assert.equal(after.build, 'tsc');
    assert.equal(after.test, 'node --test');
  });
});

describe('it reports every refusal, not the first one', () => {
  it('refuses a repository with no install — there is no answer here to make true', () => {
    const root = tree({ 'package.json': json({ name: 'app' }) });
    assert.match(preflight(root).problems.join('\n'), /no ai-workflow install/);
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses a repository with no package.json, and names the shape instead of a tool', () => {
    const root = tree(INSTALLED);
    const problems = preflight(root).problems.join('\n');
    assert.match(problems, /cannot use a JavaScript release tool/);
    assert.match(problems, /## Unreleased/, 'it says what that project would do instead');
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses when something already records notes, and points at /onboard', () => {
    const root = tree({ ...INSTALLED, 'package.json': json({ name: 'a' }), '.changeset/config.json': '{}' });
    const problems = preflight(root).problems.join('\n');
    assert.match(problems, /already exists/);
    assert.match(problems, /\/onboard/, 'the answer is recorded, not installed');
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses to overwrite a script someone wrote', () => {
    const root = tree({
      ...INSTALLED,
      'package.json': json({ name: 'a', scripts: { 'changeset:prepare-release': 'ship.sh' } }),
    });
    assert.match(preflight(root).problems.join('\n'), /already has changeset:prepare-release/);
    rmSync(root, { recursive: true, force: true });
  });

  it('collects them all in one pass, so they are not fixed one round-trip at a time', () => {
    const root = tree({ '.changeset/config.json': '{}' });
    const { problems } = preflight(root);
    assert.equal(problems.length, 3, 'no install, no package.json, and a directory already there');
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves a hand-maintained Unreleased section alone, as the record of that era', () => {
    const root = tree({
      ...INSTALLED,
      'package.json': json({ name: 'a' }),
      'CHANGELOG.md': '# Changelog\n\n## Unreleased\n\n- something\n',
    });
    const { problems, notes } = preflight(root);
    assert.deepEqual(problems, [], 'it is not a refusal');
    assert.match(notes.join('\n'), /left exactly where it is/);
    assert.match(notes.join('\n'), /inventing history/, 'and says why it is not converted');
    rmSync(root, { recursive: true, force: true });
  });
});
