import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { findIndexTable, generateIndexTable } from '../src/commands/standards-add.ts';
import { parseTables } from '../src/check/markdown.ts';
import { managedFiles, readTemplate, undotted } from '../src/layout.ts';
import { templatesDir } from '../src/paths.ts';

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
});
