import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { render } from '../src/agents-block.ts';
import { install } from '../src/commands/install.ts';
import { update } from '../src/commands/update.ts';
import { AGENTS_BLOCK_KEY, SKILL_NAMES, STANDARDS_PREFIX } from '../src/layout.ts';
import { UserError } from '../src/log.ts';
import { readManifest } from '../src/manifest.ts';
import { exists } from '../src/paths.ts';

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), 'aiw-install-'));
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

describe('install', () => {
  it('writes both trees, the block, and a manifest that draws the ownership boundary', () => {
    const root = scratch();
    quiet(() => install(root));

    for (const name of SKILL_NAMES) {
      const skill = readFileSync(path.join(root, `.claude/skills/${name}/SKILL.md`), 'utf8');
      assert.match(skill, /^---\n/);
      assert.match(skill, /^disable-model-invocation: true$/m);
    }

    const manifest = readManifest(root);
    for (const owned of [
      'context/stack.md',
      'context/verify.md',
      'context/executors.md',
      'context/roadmap.md',
      'context/history.md',
      'context/findings.md',
      'CLAUDE.md',
    ]) {
      assert.ok(exists(path.join(root, owned)), `${owned} was written`);
      assert.equal(manifest.managedFiles[owned], undefined, `${owned} is not in the manifest`);
    }
    assert.ok(manifest.managedFiles['context/workflow.md']);
    assert.ok(manifest.managedFiles[AGENTS_BLOCK_KEY]);
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves the stubs empty of commands — no detection, no guessing', () => {
    const root = scratch();
    quiet(() => install(root));
    const verify = readFileSync(path.join(root, 'context/verify.md'), 'utf8');
    assert.match(verify, /## Lint\n\n```bash\n```/);
    assert.match(verify, /## Test\n\n```bash\n```/);
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses when context/ already exists rather than merging', () => {
    const root = scratch();
    quiet(() => install(root));
    assert.throws(() => quiet(() => install(root)), UserError);
    rmSync(root, { recursive: true, force: true });
  });

  it('merges into an existing AGENTS.md instead of owning it', () => {
    const root = scratch();
    writeFileSync(path.join(root, 'AGENTS.md'), '# AGENTS.md\n\nMy standing rules.\n', 'utf8');
    quiet(() => install(root));
    const text = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    assert.ok(text.includes('My standing rules.'));
    assert.ok(text.includes('<!-- ai-workflow:start -->'));
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves an existing CLAUDE.md alone', () => {
    const root = scratch();
    writeFileSync(path.join(root, 'CLAUDE.md'), '# Mine\n', 'utf8');
    quiet(() => install(root));
    assert.equal(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), '# Mine\n');
    rmSync(root, { recursive: true, force: true });
  });
});

describe('update', () => {
  it('restores a deleted managed file and never touches a project-owned one', () => {
    const root = scratch();
    quiet(() => install(root));

    rmSync(path.join(root, 'context/workflow.md'));
    writeFileSync(path.join(root, 'context/verify.md'), 'MY COMMANDS\n', 'utf8');
    writeFileSync(path.join(root, 'context/decisions.md'), 'mine\n', 'utf8');

    const code = quiet(() => update(root, { dryRun: false, force: false }));
    assert.equal(code, 0);
    assert.ok(exists(path.join(root, 'context/workflow.md')));
    assert.equal(readFileSync(path.join(root, 'context/verify.md'), 'utf8'), 'MY COMMANDS\n');
    assert.equal(readFileSync(path.join(root, 'context/decisions.md'), 'utf8'), 'mine\n');
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a conflict on an edited managed file and writes nothing', () => {
    const root = scratch();
    quiet(() => install(root));
    const workflow = path.join(root, 'context/workflow.md');
    writeFileSync(workflow, 'edited\n', 'utf8');
    rmSync(path.join(root, 'context/plan-template.md'));

    assert.throws(() => quiet(() => update(root, { dryRun: false, force: false })), UserError);
    assert.equal(readFileSync(workflow, 'utf8'), 'edited\n');
    assert.ok(!exists(path.join(root, 'context/plan-template.md')), 'nothing was written at all');
    rmSync(root, { recursive: true, force: true });
  });

  it('--force backs the edited copy up and takes ours', () => {
    const root = scratch();
    quiet(() => install(root));
    const workflow = path.join(root, 'context/workflow.md');
    writeFileSync(workflow, 'edited\n', 'utf8');

    quiet(() => update(root, { dryRun: false, force: true }));
    assert.equal(readFileSync(`${workflow}.bak`, 'utf8'), 'edited\n');
    assert.match(readFileSync(workflow, 'utf8'), /# The planning workflow/);
    rmSync(root, { recursive: true, force: true });
  });

  it('--dry-run changes nothing', () => {
    const root = scratch();
    quiet(() => install(root));
    rmSync(path.join(root, 'context/workflow.md'));
    quiet(() => update(root, { dryRun: true, force: false }));
    assert.ok(!exists(path.join(root, 'context/workflow.md')));
    rmSync(root, { recursive: true, force: true });
  });

  it('replaces the block in AGENTS.md without disturbing what surrounds it', () => {
    const root = scratch();
    writeFileSync(path.join(root, 'AGENTS.md'), '# Head\n\nkeep me\n', 'utf8');
    quiet(() => install(root));
    writeFileSync(
      path.join(root, 'AGENTS.md'),
      `# Head\n\nkeep me\n\n${render('stale')}\n\n## Tail\n\nalso keep me\n`,
      'utf8',
    );
    quiet(() => update(root, { dryRun: false, force: true }));
    const text = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    assert.ok(text.includes('keep me'));
    assert.ok(text.includes('also keep me'));
    assert.ok(!text.includes('stale'));
    assert.equal(text.match(/ai-workflow:start/g)?.length, 1);
    rmSync(root, { recursive: true, force: true });
  });

  it('hands the standards tree over once it is edited, and stops reaching it', () => {
    const root = scratch();
    quiet(() => install(root));
    const readme = path.join(root, `${STANDARDS_PREFIX}README.md`);
    writeFileSync(readme, '# Ours now\n', 'utf8');

    const code = quiet(() => update(root, { dryRun: false, force: false }));
    assert.equal(code, 0, 'an edited standards tree is an adoption, not a conflict');
    assert.equal(readFileSync(readme, 'utf8'), '# Ours now\n');
    const after = readManifest(root);
    assert.equal(
      Object.keys(after.managedFiles).filter((k) => k.startsWith(STANDARDS_PREFIX)).length,
      0,
    );

    quiet(() => update(root, { dryRun: false, force: true }));
    assert.equal(readFileSync(readme, 'utf8'), '# Ours now\n', 'even --force cannot reach it now');
    rmSync(root, { recursive: true, force: true });
  });
});
