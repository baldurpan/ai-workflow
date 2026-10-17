import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { planBudget, runChecks, trackingAnswer, type Problem } from '../src/check/rules.ts';
import { check } from '../src/commands/check.ts';
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

  it('never reads archive/, so a retired plan in an old shape is not a false positive', () => {
    write('context/archive/OLD-PLAN.md', `**Status:** Plan of record\n\n${plan('| # | Phase | Status |\n|---|---|---|\n| 1 | x | shipped |\n')}`);
    write('context/roadmap.md', roadmapWith(entry('widgets', 'active', 'plans/WIDGETS-PLAN.md')));
    write('context/plans/WIDGETS-PLAN.md', plan());
    write('context/history.md', '# History\n');
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

describe('the plan size budget', () => {
  // §10.16. The one rule in this command that reports something other than structural breakage: the plan
  // is well-formed and every answer it gives is right, and what it says is that the feature is more than
  // one feature. So it is a note, it fails nothing, and the numbers come from `tracking.md` rather than
  // from here — a project that wants a different ceiling edits that file.
  let budgeted: string;

  before(() => {
    budgeted = mkdtempSync(path.join(tmpdir(), 'aiw-budget-'));
    install(budgeted);
  });
  after(() => rmSync(budgeted, { recursive: true, force: true }));

  /**
   * A plan padded to `size` characters. The shipped fixture's first row is `done`, which holds no
   * reserve any more (§20.7) — so a test about the reserve passes `OPEN`, where both rows are still to
   * be written and the arithmetic in its own comment holds.
   */
  const OPEN = LEDGER.replace('| 1 | scaffold | done |', '| 1 | scaffold | not started |');

  function sized(size: number, ledger = LEDGER): string {
    const base = plan(ledger);
    const padding = '\n' + 'x'.repeat(Math.max(size - base.length - 1, 0));
    return base + padding;
  }

  function budgetNotes(): Problem[] {
    return runChecks(budgeted).filter((p) => /over the .* allows a plan/.test(p.message));
  }

  function setPlan(text: string): void {
    const full = path.join(budgeted, 'context/plans/WIDGETS-PLAN.md');
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text, 'utf8');
    writeFileSync(
      path.join(budgeted, 'context/roadmap.md'),
      roadmapWith(entry('widgets', 'pending', 'plans/WIDGETS-PLAN.md')),
      'utf8',
    );
  }

  it('reads the shipped numbers out of tracking.md', () => {
    assert.deepEqual(planBudget(budgeted), { ceiling: 65_536, reserve: 500, fellBack: [] });
  });

  it('says nothing about a plan comfortably under the line', () => {
    setPlan(sized(40_000));
    assert.deepEqual(budgetNotes(), []);
  });

  it('fires on room-to-spare, not on room-to-fit', () => {
    // 65,000 characters fits. It does not fit with 500 held back for each of the two ledger rows, and by
    // the time both have closed with a sha and a Note it would not have. That gap is the whole rule:
    // the body is written into for the feature's whole life, so a plan that only just fits has failed.
    setPlan(sized(65_000, OPEN));
    const [note, ...rest] = budgetNotes();
    assert.ok(note, 'a plan inside the reserve is reported');
    assert.deepEqual(rest, [], 'once');
    assert.equal(note.level, 'note', 'an oversized plan is not structural breakage');
    assert.match(note.message, /1,000-character reserve for 2 unfinished ledger rows/, 'the reserve is shown');
    assert.match(note.message, /464 over the 65,536/, 'and so is the margin');
    assert.match(note.message, /Run \/feature-plan to split it/, 'it names the command and proposes nothing');
    assert.match(note.rule, /tracking\.md/, 'a false positive points at the file that set the number');
  });

  it('holds the reserve for the rows still to be written, and not for the ones already written', () => {
    // §20.7. The reserve is what a closing row will add: a sha and a one-line Note. A `done` row has
    // already added them and is already counted in the plan's own size, so holding the reserve for it
    // charges those characters twice — and the plan that passed at planning time starts reporting as it
    // succeeds, one phase at a time, which is the one moment the remedy is refused.
    const done = (status: string): string =>
      `# W\n\n### 6.1 Status ledger\n\n| # | Phase | Status | Depends on | Note |\n|---|---|---|---|---|\n` +
      `| 1 | a | ${status} | — | landed in abc1234 |\n| 2 | b | not started | 1 | |\n`;
    const pad = (text: string, size: number): string => text + '\n' + 'x'.repeat(size - text.length - 1);

    setPlan(pad(done('not started'), 65_000));
    assert.equal(budgetNotes().length, 1, 'two open rows: 65,000 + 1,000 is over the line');

    setPlan(pad(done('done'), 65_000));
    assert.deepEqual(budgetNotes(), [], 'one of them closed: the same plan is 500 under it');

    // And where a row has closed, the message stops naming the split. `/feature-plan` refuses to split a
    // plan that is under way, so pointing there is advice the workflow does not take; what is still
    // growing is the Notes, and §6.1 is the rule that bounds them.
    setPlan(pad(done('done'), 65_600));
    const [note] = budgetNotes();
    assert.ok(note, 'it still reports');
    assert.doesNotMatch(note.message, /split/, 'a plan under way is not split');
    assert.match(note.message, /one line per row, per §6\.1 of the plan/);
  });

  it('says when it measured against a number the project never set', () => {
    // §20.2 gave `check` a code-level fallback to the shipped pair, which is safe because it changes no
    // file and fails nothing. Silent is the part that was not safe: a plan reported against 65,536 in an
    // install whose `tracking.md` says nothing reads exactly like one reported against a project answer.
    const tracking = path.join(budgeted, 'context/tracking.md');
    const text = readFileSync(tracking, 'utf8');
    setPlan(sized(1_000));
    writeFileSync(tracking, '# Tracking\n\n## Where tracking lives\n\n**In the working tree.**\n', 'utf8');
    const [note, ...rest] = runChecks(budgeted).filter((p) => /shipped/.test(p.message));
    assert.ok(note, 'it says so');
    assert.deepEqual(rest, [], 'once, not per plan');
    assert.equal(note.level, 'note');
    assert.equal(note.file, 'context/tracking.md', 'at the file that should hold the answer');
    assert.match(note.message, /\*\*Plan size ceiling:\*\* and \*\*Ledger reserve:\*\* are missing/);
    assert.match(note.message, /Run \/onboard/, 'and names the command that writes them');

    // And nothing is said where the fallback changed no verdict, because then it is a fact about the
    // stub rather than about this run — which `update` already reports to that install.
    rmSync(path.join(budgeted, 'context/plans/WIDGETS-PLAN.md'), { force: true });
    writeFileSync(path.join(budgeted, 'context/roadmap.md'), roadmapWith(''), 'utf8');
    assert.deepEqual(runChecks(budgeted).filter((p) => /shipped/.test(p.message)), [], 'no plan, no claim');
    writeFileSync(tracking, text, 'utf8');
  });

  it('a note does not fail the check', () => {
    setPlan(sized(65_000, OPEN));
    assert.equal(check(budgeted), 0, 'exit 0 — nothing here is broken');
  });

  it('follows the numbers when the project changes them', () => {
    // The point of the fields being in a project-owned stub. A repository with longer plans raises the
    // ceiling and the rule moves with it; nothing in the code knows either number.
    const tracking = path.join(budgeted, 'context/tracking.md');
    const text = readFileSync(tracking, 'utf8');
    writeFileSync(tracking, text.replace('**Plan size ceiling:** 65,536', '**Plan size ceiling:** 20,000'), 'utf8');
    assert.equal(planBudget(budgeted).ceiling, 20_000);

    setPlan(sized(40_000));
    assert.equal(budgetNotes().length, 1, 'a plan that passed at the shipped ceiling now reports');

    writeFileSync(tracking, text, 'utf8');
    assert.deepEqual(budgetNotes(), [], 'and stops again when the number goes back');
  });

  it('falls back to the shipped numbers when the fields are gone', () => {
    // Same shape as the column set falling back when `plan-template.md` is missing. A stub somebody
    // rewrote by hand must not silently disable the check or crash it.
    const tracking = path.join(budgeted, 'context/tracking.md');
    const text = readFileSync(tracking, 'utf8');
    writeFileSync(tracking, '# Tracking\n\n## Where tracking lives\n\n**In the working tree.**\n', 'utf8');
    assert.deepEqual(planBudget(budgeted), {
      ceiling: 65_536,
      reserve: 500,
      fellBack: ['Plan size ceiling', 'Ledger reserve'],
    });
    writeFileSync(tracking, text, 'utf8');
  });

  it('ignores retired plans, like every other rule here', () => {
    // An archived plan's size is not actionable: the feature shipped. Validating retired records against
    // current rules is the false-positive machine that makes validators get ignored.
    rmSync(path.join(budgeted, 'context/plans/WIDGETS-PLAN.md'), { force: true });
    writeFileSync(path.join(budgeted, 'context/roadmap.md'), roadmapWith(''), 'utf8');
    const archive = path.join(budgeted, 'context/archive/OLD-PLAN.md');
    mkdirSync(path.dirname(archive), { recursive: true });
    writeFileSync(archive, sized(200_000), 'utf8');
    assert.deepEqual(budgetNotes(), []);
  });
});
