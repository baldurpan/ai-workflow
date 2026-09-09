import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { runChecks, trackingAnswer, type Problem } from '../src/check/rules.ts';
import { install } from '../src/commands/install.ts';
import { readTemplate } from '../src/layout.ts';

let root: string;

function write(rel: string, content: string): void {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

const LEDGER = `| # | Phase | Status | Depends on | Note |
|---|---|---|---|---|
| 1 | scaffold | done | — | |
| 2 | wire it up | not started | 1 | |
`;

function plan(ledger = LEDGER, extra = ''): string {
  return `# Widgets Plan\n\nWritten 2026-09-04.\n\n## 6. Phases\n\n### 6.1 Status ledger\n\n${ledger}\n${extra}`;
}

function roadmapWith(entries: string): string {
  return `# Roadmap\n\n## Features\n\n${entries}`;
}

const entry = (name: string, marker: string, doc: string) =>
  `### ${name} — \`${marker}\`\n\nOne line.\n\n- **Size:** small — a few words\n- **Doc:** [\`${doc}\`](${doc})\n\n`;

const messages = (problems: Problem[]) => problems.map((p) => p.message);

describe('check', () => {
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), 'aiw-check-'));
    install(root);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  it('passes on a fresh install — the commented-out stub examples are not entries', () => {
    assert.deepEqual(runChecks(root), []);
  });

  it('passes on a well-formed roadmap and plan', () => {
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.deepEqual(runChecks(root), []);
  });

  it('flags more than one active entry', () => {
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/plans/GADGETS-PLAN.md', plan());
    write(
      'context/roadmap.md',
      roadmapWith(
        entry('widgets', 'active', 'plans/WIDGETS-PLAN.md') +
          entry('gadgets', 'active', 'plans/GADGETS-PLAN.md'),
      ),
    );
    const found = runChecks(root);
    assert.equal(found.filter((p) => p.rule.includes('At most one')).length, 2);
    assert.ok(found.every((p) => p.rule.length > 0), 'every problem quotes the rule it enforces');
    rmSync(path.join(root, 'context/plans/GADGETS-PLAN.md'));
  });

  it('flags an illegal status word', () => {
    write(
      'context/plans/WIDGETS-PLAN.md',
      plan(LEDGER.replace('not started', 'not-started')),
    );
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes('`not-started`')));
  });

  it('flags a ledger whose columns differ from the template', () => {
    write(
      'context/plans/WIDGETS-PLAN.md',
      plan(`| # | Phase | Status | Note |\n|---|---|---|---|\n| 1 | scaffold | done | |\n`),
    );
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes("the template's are")));
  });

  it('flags a dependency on a phase that does not exist', () => {
    write('context/plans/WIDGETS-PLAN.md', plan(LEDGER.replace('| not started | 1 | |', '| not started | 7 | |')));
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes('depends on phase 7')));
  });

  it('flags a dependency cycle', () => {
    write(
      'context/plans/WIDGETS-PLAN.md',
      plan(`| # | Phase | Status | Depends on | Note |
|---|---|---|---|---|
| 1 | a | not started | 2 | |
| 2 | b | not started | 1 | |
`),
    );
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes('cycle')));
  });

  it('flags a second phase table', () => {
    write('context/plans/WIDGETS-PLAN.md', plan(LEDGER, `\n## 9. Appendix\n\n${LEDGER}`));
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes('a second phase table')));
  });

  it('flags a `**Status:**` header', () => {
    write('context/plans/WIDGETS-PLAN.md', `**Status:** shipped\n\n${plan()}`);
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes('`**Status:**` header')));
  });

  it('flags a plan no roadmap entry points at', () => {
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/plans/ORPHAN-PLAN.md', plan());
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    assert.ok(messages(runChecks(root)).some((m) => m.includes('no roadmap entry points at this plan')));
    rmSync(path.join(root, 'context/plans/ORPHAN-PLAN.md'));
  });

  it('flags a Doc field pointing at a missing file', () => {
    write('context/plans/WIDGETS-PLAN.md', plan());
    write(
      'context/roadmap.md',
      roadmapWith(
        entry('widgets', 'active', 'plans/WIDGETS-PLAN.md') +
          entry('ghosts', 'pending', 'drafts/GONE.md'),
      ),
    );
    assert.ok(messages(runChecks(root)).some((m) => m.includes('`drafts/GONE.md`, which does not exist')));
  });

  it('flags a history link pointing at a missing file', () => {
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    write(
      'context/history.md',
      `# History\n\n| Date | Feature | Outcome | Why | Document |\n|---|---|---|---|---|\n| 2026-09-01 | gone | shipped | because | [\`archive/GONE-PLAN.md\`](archive/GONE-PLAN.md) |\n`,
    );
    assert.ok(messages(runChecks(root)).some((m) => m.includes('archive/GONE-PLAN.md`, which does not exist')));
  });

  it('reports a closed finding as a note, not an error', () => {
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/history.md', '# History\n');
    write(
      'context/findings.md',
      `# Findings\n\n## Open\n\n## Closed\n\n### F-001 — P2 — something — **closed 2026-09-04**\n`,
    );
    const found = runChecks(root);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.level, 'note');
    assert.match(found[0]?.message ?? '', /F-001 is closed and still in the file/);
  });

  it('never reads archive/, so a retired plan in an old shape is not a false positive', () => {
    write('context/archive/OLD-PLAN.md', `**Status:** Plan of record\n\n${plan('| # | Phase | Status |\n|---|---|---|\n| 1 | x | shipped |\n')}`);
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/findings.md', '# Findings\n\n## Open\n\n## Closed\n');
    assert.deepEqual(runChecks(root), []);
  });
});

describe('the tracker answer', () => {
  let alt: string;

  before(() => {
    alt = mkdtempSync(path.join(tmpdir(), 'aiw-tracking-'));
    install(alt);
  });
  after(() => rmSync(alt, { recursive: true, force: true }));

  const setTracking = (body: string) =>
    writeFileSync(path.join(alt, 'context/tracking.md'), body, 'utf8');

  it('a missing file is the working-tree answer', () => {
    rmSync(path.join(alt, 'context/tracking.md'), { force: true });
    assert.equal(trackingAnswer(alt), 'tree');
  });

  it('the shipped stub reads as the working tree, because the alternative is commented', () => {
    setTracking(readTemplate('stubs/tracking.md'));
    assert.equal(trackingAnswer(alt), 'tree');
  });

  it('reads the tracker answer once the alternative is the one kept', () => {
    setTracking('# Tracking\n\n## Where tracking lives\n\n**In an issue tracker.** A feature is an issue.\n');
    assert.equal(trackingAnswer(alt), 'tracker');
  });

  it('does not fault a missing roadmap under the tracker answer', () => {
    rmSync(path.join(alt, 'context/roadmap.md'), { force: true });
    rmSync(path.join(alt, 'context/history.md'), { force: true });
    rmSync(path.join(alt, 'context/plans'), { recursive: true, force: true });
    const problems = runChecks(alt);
    assert.deepEqual(
      problems.filter((p) => p.level === 'error'),
      [],
      `errors: ${messages(problems).join(', ')}`,
    );
  });

  it('still faults a missing roadmap under the working-tree answer', () => {
    setTracking('# Tracking\n\n## Where tracking lives\n\n**In the working tree.** The backlog is roadmap.md.\n');
    const problems = runChecks(alt);
    assert.ok(
      problems.some((p) => p.file === 'context/roadmap.md' && /missing/.test(p.message)),
      `expected the missing-roadmap error, got: ${messages(problems).join(', ')}`,
    );
  });

  // The failure that shipped in 0.8.0: the answer was switched and the entries stayed. They are still
  // well-formed, the file is still there, and nothing else in the workflow can notice — every command
  // reads the tracker, finds nothing, and reports an empty backlog. This is the only detector for it.
  it('faults a backlog left behind under the tracker answer', () => {
    setTracking('# Tracking\n\n## Where tracking lives\n\n**In an issue tracker.** A feature is an issue.\n');
    writeFileSync(
      path.join(alt, 'context/roadmap.md'),
      roadmapWith(entry('widgets', 'pending', 'drafts/WIDGETS.md')),
      'utf8',
    );
    mkdirSync(path.join(alt, 'context/drafts'), { recursive: true });
    writeFileSync(path.join(alt, 'context/drafts/WIDGETS.md'), '# Widgets\n', 'utf8');

    const problems = runChecks(alt);
    const split = problems.find((p) => /tracking\.md says the backlog is in an issue tracker/.test(p.message));
    assert.ok(split, `expected the unmigrated-backlog error, got: ${messages(problems).join(', ')}`);
    assert.equal(split.level, 'error', 'an unreachable backlog is not a note');
    assert.match(split.message, /\/tracking-migrate/, 'the message names the command that resolves it');
  });

  it('says nothing once the backlog has moved', () => {
    rmSync(path.join(alt, 'context/roadmap.md'), { force: true });
    const problems = runChecks(alt);
    assert.deepEqual(
      problems.filter((p) => /issue tracker/.test(p.message)),
      [],
      `errors: ${messages(problems).join(', ')}`,
    );
  });
});
