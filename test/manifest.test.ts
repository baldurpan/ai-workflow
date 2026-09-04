import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseArgs } from '../src/cli.ts';
import { install } from '../src/commands/install.ts';
import { standardsAdd } from '../src/commands/standards-add.ts';
import { STANDARDS_PREFIX } from '../src/layout.ts';
import { UserError } from '../src/log.ts';
import { readManifest, SCHEMA_VERSION, writeManifest } from '../src/manifest.ts';
import { exists } from '../src/paths.ts';

const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = write;
  }
};

describe('manifest', () => {
  it('round-trips, with keys sorted so a diff is readable', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'aiw-manifest-'));
    mkdirSync(path.join(root, 'context/.state'), { recursive: true });
    writeManifest(root, {
      schemaVersion: SCHEMA_VERSION,
      version: '1.2.3',
      adapters: ['claude'],
      managedFiles: { 'z.md': 'b', 'a.md': 'a' },
    });
    const text = readFileSync(path.join(root, 'context/.state/manifest.json'), 'utf8');
    assert.ok(text.indexOf('"a.md"') < text.indexOf('"z.md"'));
    assert.equal(readManifest(root).version, '1.2.3');
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses a schema it did not write, rather than guessing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'aiw-manifest-'));
    mkdirSync(path.join(root, 'context/.state'), { recursive: true });
    writeFileSync(
      path.join(root, 'context/.state/manifest.json'),
      JSON.stringify({ schemaVersion: 99, managedFiles: {} }),
      'utf8',
    );
    assert.throws(() => readManifest(root), UserError);
    rmSync(root, { recursive: true, force: true });
  });

  it('drops an adapter it does not know rather than acting on it', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'aiw-manifest-'));
    mkdirSync(path.join(root, 'context/.state'), { recursive: true });
    writeFileSync(
      path.join(root, 'context/.state/manifest.json'),
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        version: '9.9.9',
        adapters: ['claude', 'jetbrains'],
        managedFiles: {},
      }),
      'utf8',
    );
    assert.deepEqual(readManifest(root).adapters, ['claude']);
    rmSync(root, { recursive: true, force: true });
  });

  it('says what to run when there is no install at all', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'aiw-manifest-'));
    assert.throws(() => readManifest(root), /no manifest/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('argument parsing', () => {
  it('defaults the bare invocation to install — the create-* convention', () => {
    assert.equal(parseArgs([]).command, 'install');
  });

  it('reads the flags each command needs', () => {
    const args = parseArgs(['update', '--dry-run', '--force', '--dir', '/tmp/x']);
    assert.equal(args.command, 'update');
    assert.ok(args.dryRun && args.force);
    assert.equal(args.dir, path.resolve('/tmp/x'));
  });

  it('carries the standards subcommand and its URL', () => {
    const args = parseArgs(['standards', 'add', 'https://example.com/x.git']);
    assert.deepEqual(args.rest, ['add', 'https://example.com/x.git']);
  });

  it('rejects an unknown option instead of ignoring it', () => {
    assert.throws(() => parseArgs(['--wat']), UserError);
  });
});

describe('standards add', () => {
  it('installs a conforming tree and hands ownership over', async () => {
    const source = mkdtempSync(path.join(tmpdir(), 'aiw-src-'));
    mkdirSync(path.join(source, 'rust'), { recursive: true });
    writeFileSync(
      path.join(source, 'README.md'),
      '# Rust standards\n\n| If the task involves… | Load… |\n|---|---|\n| Any task | [`rust/core.md`](rust/core.md) |\n| Errors | [`rust/errors.md`](rust/errors.md) |\n',
      'utf8',
    );
    writeFileSync(path.join(source, 'rust/core.md'), '# core\n', 'utf8');
    writeFileSync(path.join(source, 'rust/errors.md'), '# errors\n', 'utf8');
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: source, stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
    git(['init', '-q', '-b', 'main']);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.']);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);

    const root = mkdtempSync(path.join(tmpdir(), 'aiw-dest-'));
    await quiet(() => install(root));
    await quiet(() => standardsAdd(root, source, { generateIndex: false }));

    assert.ok(exists(path.join(root, `${STANDARDS_PREFIX}rust/core.md`)));
    assert.ok(!exists(path.join(root, `${STANDARDS_PREFIX}typescript/rules.md`)), 'the default is gone');
    assert.ok(!exists(path.join(root, `${STANDARDS_PREFIX}.git`)), 'no nested git repository');
    assert.match(readFileSync(path.join(root, `${STANDARDS_PREFIX}.source`), 'utf8'), /^ref=[0-9a-f]{40}$/m);

    const manifest = readManifest(root);
    assert.equal(
      Object.keys(manifest.managedFiles).filter((k) => k.startsWith(STANDARDS_PREFIX)).length,
      0,
      'whatever lands is project-owned from that point',
    );

    rmSync(source, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses a tree the skills cannot navigate', async () => {
    const source = mkdtempSync(path.join(tmpdir(), 'aiw-src-'));
    writeFileSync(path.join(source, 'README.md'), '# Standards\n\nNo table here.\n', 'utf8');
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: source, stdio: 'ignore', env });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.'], { cwd: source, stdio: 'ignore', env });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'i'], { cwd: source, stdio: 'ignore', env });

    const root = mkdtempSync(path.join(tmpdir(), 'aiw-dest-'));
    await quiet(() => install(root));
    await assert.rejects(
      quiet(() => standardsAdd(root, source, { generateIndex: false })),
      /cannot navigate/,
    );
    assert.ok(exists(path.join(root, `${STANDARDS_PREFIX}README.md`)), 'the default is untouched');

    rmSync(source, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });
});
