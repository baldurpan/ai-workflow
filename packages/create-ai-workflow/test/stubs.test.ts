import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runChecks } from '../src/check/rules.ts';
import { install } from '../src/commands/install.ts';
import { update } from '../src/commands/update.ts';
import { readTemplate } from '../src/layout.ts';
import { exists } from '../src/paths.ts';
import { sections, stubGaps } from '../src/stubs.ts';

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), 'aiw-stubs-'));
}

const quiet = <T>(fn: () => T): T => {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return fn();
  } finally {
    process.stdout.write = write;
  }
};

/** Run something and return everything it wrote to stdout. */
function capture(fn: () => void): string {
  const write = process.stdout.write.bind(process.stdout);
  let out = '';
  process.stdout.write = (chunk: string | Uint8Array) => {
    out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = write;
  }
  return out;
}

const drop = (root: string, rel: string, heading: string): void => {
  const full = path.join(root, rel);
  const text = readFileSync(full, 'utf8');
  assert.ok(text.includes(`## ${heading}\n`), `${rel} has a "${heading}" section to drop`);
  writeFileSync(full, text.replace(`## ${heading}\n`, ''), 'utf8');
};

describe('reading a stub\'s sections', () => {
  it('takes the headings in order', () => {
    assert.deepEqual(sections(readTemplate('stubs/stack.md')), [
      'Layout',
      'Conventions',
      'Documentation',
      'Also in `context/`',
    ]);
  });

  it('ignores a heading inside a fence or a comment', () => {
    // stack.md sketches a directory layout in a fenced block and carries its guidance in comments. A `##`
    // in either is an illustration, and counting it would report a gap nobody can close.
    assert.deepEqual(sections('## Real\n\n```\n## Fenced\n```\n\n<!--\n## Commented\n-->\n'), ['Real']);
  });
});

describe('what an update cannot write', () => {
  it('a fresh install has no gaps — the stubs are what this version ships', () => {
    const root = scratch();
    quiet(() => install(root));
    assert.deepEqual(stubGaps(root), []);
    rmSync(root, { recursive: true, force: true });
  });

  it('names a section this version added, per file', () => {
    const root = scratch();
    quiet(() => install(root));
    drop(root, 'context/stack.md', 'Documentation');

    assert.deepEqual(stubGaps(root), [{ dest: 'context/stack.md', section: 'Documentation' }]);
    rmSync(root, { recursive: true, force: true });
  });

  it('names a stub that is not there at all', () => {
    // The shape of an install made before `git.md` shipped: `update` cannot restore it, because a pass
    // that writes missing stubs is a pass that can overwrite one someone deleted on purpose.
    const root = scratch();
    quiet(() => install(root));
    rmSync(path.join(root, 'context/git.md'));

    assert.deepEqual(stubGaps(root), [{ dest: 'context/git.md' }]);
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves the files /onboard does not fill to `check`', () => {
    // roadmap.md, history.md and findings.md are written by the workflow as it runs, not by a person
    // answering questions. `check` already reports a missing roadmap; naming `/onboard` for one would
    // send someone to a command that never opens it.
    const root = scratch();
    quiet(() => install(root));
    rmSync(path.join(root, 'context/roadmap.md'));
    drop(root, 'context/findings.md', 'Closed');

    assert.deepEqual(stubGaps(root), []);
    assert.deepEqual(
      runChecks(root).map((p) => p.file),
      ['context/roadmap.md'],
      'the ledger files are check\'s business, and it does report them',
    );
    rmSync(root, { recursive: true, force: true });
  });

  it('reads backticks and case as formatting, not identity', () => {
    const root = scratch();
    quiet(() => install(root));
    const stack = path.join(root, 'context/stack.md');
    writeFileSync(
      stack,
      readFileSync(stack, 'utf8').replace('## Also in `context/`', '## ALSO IN context/'),
      'utf8',
    );

    assert.deepEqual(stubGaps(root), []);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('update reports the gaps and writes nothing', () => {
  it('ends by naming the files and the command that fills them', () => {
    const root = scratch();
    quiet(() => install(root));
    drop(root, 'context/stack.md', 'Documentation');
    rmSync(path.join(root, 'context/git.md'));

    const out = capture(() => {
      const code = update(root, { dryRun: false, force: false });
      assert.equal(code, 0, 'a gap is a note — it does not fail the update');
    });

    assert.match(out, /^Next$/m);
    assert.match(out, /context\/stack\.md has no "Documentation" section/);
    assert.match(out, /context\/git\.md is missing/);
    assert.match(out, /\/onboard/);
    assert.ok(!exists(path.join(root, 'context/git.md')), 'update still writes no project-owned file');
    rmSync(root, { recursive: true, force: true });
  });

  it('says nothing when there is nothing to say', () => {
    const root = scratch();
    quiet(() => install(root));
    const out = capture(() => update(root, { dryRun: true, force: false }));

    assert.doesNotMatch(out, /^Next$/m, 'a current install is not nagged');
    rmSync(root, { recursive: true, force: true });
  });

  it('reports them under --dry-run too — the gap is a state of the repo, not of the write', () => {
    const root = scratch();
    quiet(() => install(root));
    drop(root, 'context/verify.md', 'Test');

    const out = capture(() => update(root, { dryRun: true, force: false }));
    assert.match(out, /context\/verify\.md has no "Test" section/);
    rmSync(root, { recursive: true, force: true });
  });
});
