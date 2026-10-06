import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { findIndexTable, generateIndexTable } from '../src/commands/standards-add.ts';
import { parseTables } from '../src/check/markdown.ts';
import { managedFiles, readTemplate, undotted } from '../src/layout.ts';
import { exists, templatesDir, toPosix, walk } from '../src/paths.ts';

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'aiw-standards-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  return root;
}

const CONFORMING = `# Standards

| If the task involves… | Load… |
|---|---|
| Any task | [\`philosophy/core.md\`](philosophy/core.md) |
| TypeScript | [\`typescript/rules.md\`](typescript/rules.md) |
`;

describe('the conditional-loading table is the interface', () => {
  it('accepts a table whose every target resolves', () => {
    const root = tree({
      'README.md': CONFORMING,
      'philosophy/core.md': '#\n',
      'typescript/rules.md': '#\n',
    });
    const found = findIndexTable(CONFORMING, root);
    assert.deepEqual(found, { rows: 2, missing: [] });
    rmSync(root, { recursive: true, force: true });
  });

  it('reports targets the table names but the tree does not have', () => {
    const root = tree({ 'README.md': CONFORMING, 'philosophy/core.md': '#\n' });
    assert.deepEqual(findIndexTable(CONFORMING, root)?.missing, ['typescript/rules.md']);
    rmSync(root, { recursive: true, force: true });
  });

  it('finds no table in a README that has none — the caller then refuses or generates', () => {
    const root = tree({ 'README.md': '# Standards\n\nJust prose.\n' });
    assert.equal(findIndexTable('# Standards\n\nJust prose.\n', root), null);
    rmSync(root, { recursive: true, force: true });
  });

  it('ignores a table that carries no links, so a prose table is not mistaken for the index', () => {
    const readme = '| A | B |\n|---|---|\n| one | two |\n| three | four |\n';
    const root = tree({ 'README.md': readme });
    assert.equal(findIndexTable(readme, root), null);
    rmSync(root, { recursive: true, force: true });
  });

  it('generates a navigable table from a directory structure', () => {
    const root = tree({
      'README.md': '# S\n',
      'php/rules.md': '#\n',
      'typescript/rules.md': '#\n',
      'typescript/naming.md': '#\n',
    });
    const generated = generateIndexTable(root);
    const table = parseTables(generated)[0];
    assert.ok(table);
    assert.deepEqual(table.header, ['If the task involves…', 'Load…']);
    assert.deepEqual(
      table.rows.map((r) => r.cells[0]),
      ['php', 'typescript'],
    );
    assert.equal(findIndexTable(generated, root)?.missing.length, 0);
    rmSync(root, { recursive: true, force: true });
  });

  it("the bundled default's own table resolves — the skills point at it by name", () => {
    const readme = readTemplate('standards/README.md');
    const found = findIndexTable(readme, path.join(templatesDir, 'standards'));
    assert.ok(found, 'the bundled README has a conditional-loading table');
    assert.deepEqual(found.missing, [], 'every file it names is vendored');
    assert.ok(found.rows > 10);
  });

  it('restores the dotfile npm cannot publish, so the tree matches the ref it claims', () => {
    const dests = managedFiles(['claude']).map((f) => f.dest);
    assert.ok(dests.includes('context/standards/templates/.gitignore'));
    assert.ok(!dests.some((d) => d.includes('_dot_')));
    assert.equal(undotted('templates/_dot_gitignore'), 'templates/.gitignore');
    assert.equal(undotted('typescript/rules.md'), 'typescript/rules.md');
  });

  it('installs no file a tool would auto-discover as its own config', () => {
    const dests = managedFiles(['claude']).map((f) => f.dest);
    assert.ok(dests.includes('context/standards/templates/biome-example.json'));
    assert.ok(
      !dests.some((d) => path.basename(d) === 'biome.json'),
      'a vendored biome.json configures Biome for the files beside it, in every project this installs into',
    );
  });

  it('records where it came from, so update can say when upstream moved', () => {
    const marker = readTemplate('standards/.source');
    assert.match(marker, /^origin=https:\/\/github\.com\/\S+$/m);
    assert.match(marker, /^ref=[0-9a-f]{40}$/m);
  });

  // 0.20.1 corrected ten references to a scope that no longer exists — `@northguild/gmt` and
  // `@northguild/worktree` were still written as `@burglekitt/*`, so every link and import in
  // `tooling/dates.md`, `tooling/ci.md` and `docs/SPEC.md` was dead. Upstream kept the old name for two
  // further releases, which made this the one correction a faithful re-vendor would silently undo: copy the
  // tree over, and the dead scope is back in every install with nothing to catch it. Upstream is fixed as
  // of c39e58b, so this now asserts agreement rather than a divergence — and it is the assertion, not the
  // agreement, that keeps the next re-vendor honest.
  it('names no package scope that was renamed away, however the tree was last vendored', () => {
    const stale = walk(path.join(templatesDir, 'standards'))
      .filter((rel) => /\.(md|json|ts|tsx|js)$/.test(rel))
      .filter((rel) => readTemplate(`standards/${toPosix(rel)}`).includes('burglekitt'));
    assert.deepEqual(stale, [], 'the standards tree points at @northguild, not the old @burglekitt scope');
  });

  // `tooling/dates.md` bans the `Date` object outright and names the lint plugin that enforces it. The ban
  // held in that one file while six others handed a `Date` out — `z.coerce.date()` in three schema docs and
  // the good example, `Date` as a type in `typescript/rules.md` — and the conditional-loading table sent a
  // forms or validation task to every one of them except `dates.md`. A doc that contradicts the rule is
  // worse than a missing doc, because the examples are what gets copied.
  it('contradicts its own Date ban in no code example — prose may name the banned forms, code may not', () => {
    const offenders: string[] = [];
    for (const rel of walk(path.join(templatesDir, 'standards'))) {
      const posix = toPosix(rel);
      if (!/\.(md|ts|tsx|js)$/.test(posix)) continue;
      // dates.md states the ban, so it is the one file that may write the banned forms out in full.
      if (posix === 'tooling/dates.md') continue;
      const text = readTemplate(`standards/${posix}`);
      // Only what an agent would copy counts: fenced blocks in markdown, the whole of a code file. Prose
      // that forbids `z.coerce.date()` has to be able to say `z.coerce.date()`.
      const code = posix.endsWith('.md')
        ? [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]).join('\n')
        : text;
      for (const [pattern, label] of [
        [/z\.coerce\.date\(/, 'z.coerce.date()'],
        [/z\.date\(/, 'z.date()'],
        [/new Date\(/, 'new Date()'],
        [/\bDate\.(now|parse|UTC)\(/, 'a Date static'],
        [/:\s*Date[;,\s)\]}]/, 'Date as a type'],
      ] as const) {
        if (pattern.test(code)) offenders.push(`${posix} — ${label}`);
      }
    }
    assert.deepEqual(offenders, [], 'no code example outside tooling/dates.md writes a banned Date form');
  });

  // Re-vendoring is a copy, and a copy silently reverts whatever this repository changed downstream. It
  // happened: `tooling/biome.md` points at `templates/biome-example.json` because a vendored `biome.json`
  // would configure Biome for every file beside it, and copying upstream's file back over put three links
  // to a name that does not exist here. Nothing noticed, because `links.test.ts` excludes this tree as
  // third-party. Resolving the links is the cheapest check that would have.
  it('has no relative link pointing at a file the vendored tree does not have', () => {
    const standards = path.join(templatesDir, 'standards');
    const broken: string[] = [];
    for (const rel of walk(standards)) {
      const posix = toPosix(rel);
      if (!/\.(md|tsx?|js)$/.test(posix)) continue;
      const dir = path.posix.dirname(posix);
      for (const [, target] of readTemplate(`standards/${posix}`).matchAll(/\]\(([^)]+)\)/g)) {
        const [file] = target.split('#');
        if (!file || /^(https?:|mailto:)/.test(file)) continue;
        const resolved = path.posix.normalize(path.posix.join(dir, file));
        if (!exists(path.join(standards, resolved))) broken.push(`${posix} → ${target}`);
      }
    }
    assert.deepEqual(broken, [], 'every relative link inside the vendored standards resolves');
  });
});
