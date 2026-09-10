import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { claudeSkillTransform, SKILL_NAMES, agentsBlockBody, readTemplate } from '../src/layout.ts';
import { parseFindings, parseHistory, parseRoadmap } from '../src/check/parse.ts';
import { stripComments } from '../src/check/markdown.ts';
import { packageRoot, templatesDir, walk } from '../src/paths.ts';

const skillBody = (name: string) => readTemplate(`skills/${name}/SKILL.md`);

/** Files whose content is ours. `standards/` is vendored third-party content and is excluded. */
function ourTemplates(): { rel: string; text: string }[] {
  return walk(templatesDir)
    .filter((rel) => !rel.split(path.sep).includes('standards'))
    .filter((rel) => rel.endsWith('.md'))
    .map((rel) => ({ rel, text: readFileSync(path.join(templatesDir, rel), 'utf8') }));
}

describe('skill frontmatter', () => {
  it('every skill declares its own name and a narrow, explicit-invocation description', () => {
    for (const name of SKILL_NAMES) {
      const text = skillBody(name);
      assert.match(text, new RegExp(`^name: ${name}$`, 'm'), `${name} declares its name`);
      assert.match(text, /^description: /m, `${name} has a description`);
      assert.match(text, /Explicit invocation only/, `${name} says so in prose`);
      assert.match(text, /Do NOT match on/, `${name} names what it must not match`);
    }
  });

  it('the Claude copy differs from the shared body by exactly one line', () => {
    for (const name of SKILL_NAMES) {
      const body = skillBody(name);
      const claude = claudeSkillTransform(body);
      const added = claude.split('\n').filter((line) => !body.split('\n').includes(line));
      assert.deepEqual(added, ['disable-model-invocation: true']);
    }
  });

  it('the transform is idempotent', () => {
    const once = claudeSkillTransform(skillBody('roadmap'));
    assert.equal(claudeSkillTransform(once), once);
  });

  it('the shared body carries no adapter-only frontmatter', () => {
    for (const name of SKILL_NAMES) {
      assert.doesNotMatch(skillBody(name), /disable-model-invocation/);
    }
  });
});

describe('runtime neutrality', () => {
  const RUNTIME_SPECIFIC = [
    /\bsubagent_type\b/,
    /\bAskUserQuestion\b/,
    /`Agent` tool/,
    /\bBash tool\b/,
  ];

  it('no skill body names a runtime primitive', () => {
    for (const name of SKILL_NAMES) {
      const text = skillBody(name);
      for (const pattern of RUNTIME_SPECIFIC) {
        assert.doesNotMatch(text, pattern, `${name} must stay neutral (${String(pattern)})`);
      }
    }
  });

  it('delegation is written as optional everywhere it appears', () => {
    for (const name of SKILL_NAMES) {
      const text = skillBody(name);
      if (!/[Dd]elegate/.test(text)) continue;
      assert.match(
        text,
        /if (one is configured|your runtime provides one)|otherwise/,
        `${name} must let a runtime without subagents fall back`,
      );
    }
  });
});

describe('one home for commands', () => {
  // §4.2 and §7.1: verify.md is the only file that names a verification command. The reference repo
  // violated this in four places, three of which named a tool it did not have.
  const COMMANDS =
    /\b(pnpm|yarn |npm run|npm test|nx run|vitest|jest|biome|eslint|prettier|tsc\b|cargo (build|test|check|clippy|fmt)|go test|pytest|composer (install|run)|bundle exec|make (test|build|lint|check|all))\b/;

  it('no skill, agent, role or block names one', () => {
    for (const { rel, text } of ourTemplates()) {
      if (rel === path.join('stubs', 'verify.md')) continue;
      const hit = COMMANDS.exec(text);
      assert.equal(hit, null, `${rel} names a verification command: ${hit?.[0] ?? ''}`);
    }
  });
});

describe('one home for dispatch', () => {
  // The reverse of §4.2's rule about verification commands, for executors. Which coder or reviewer runs
  // is a per-machine fact, so it belongs in executors.md, written by /onboard from an answer. A host name
  // in a shipped template is a winner hardcoded — and hosts change their review facilities underneath us.
  const HOSTS = /\b(codex|claude|agy|aider|cursor-agent|opencode|goose|copilot|gemini)\b/i;

  // `CLAUDE.md` and `.claude/` are paths this tool writes, named in the ownership table because a reader
  // has to know which files are theirs. A path is not an invocation.
  const PATHS = /(`?CLAUDE\.md`?|\.claude\/|\.agents\/)/g;

  it('nothing shipped names a coding-agent CLI', () => {
    for (const { rel, text } of ourTemplates()) {
      const hit = HOSTS.exec(text.replace(PATHS, ''));
      assert.equal(hit, null, `${rel} names a host: ${hit?.[0] ?? ''}`);
    }
  });

  it('the skills point at executors.md rather than at an invocation', () => {
    const dispatching = SKILL_NAMES.filter((name) => /Gate 2|reviewer|coder/i.test(skillBody(name)));
    assert.ok(dispatching.length > 0);
    for (const name of dispatching) {
      assert.match(skillBody(name), /executors\.md/, `${name} names the dispatch home`);
    }
  });
});

describe('one home for git etiquette', () => {
  // The workflow described phases as commit-sized and `done` as landed without ever saying who commits —
  // which an agent, given no policy, resolves by committing every phase in a repository it was installed
  // into. The answer lives in git.md, and every command that lands code reads it before closing out.
  const LANDS_CODE = ['feature-implement', 'orchestrate', 'feature-close', 'prototype'];

  it('every command that lands code names the policy home', () => {
    for (const name of LANDS_CODE) {
      assert.match(skillBody(name), /git\.md/, `${name} must read the commit policy before closing out`);
    }
  });

  it('no template carries the phrasing that used to imply the answer', () => {
    // "in the same commit as the work" reads as an instruction to commit. What survives is "as part of
    // the same change", which is true under either answer.
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /in the same commit as the work/i, `${rel}`);
    }
  });
});

describe('one home for the tracker', () => {
  // §10.8: the skills describe the *fact* they need and `tracking.md` says how this project answers it.
  // A forge command in a skill is the same failure as a verification command in one — it hardcodes a
  // winner, and it is what makes a second tracker a rewrite of eight files instead of one section.
  const FORGE = /\bgh (issue|pr|api|repo|label)\b|api\.github\.com|\bglab\b|\bjira\b/i;

  it('no skill names a forge command', () => {
    for (const name of SKILL_NAMES) {
      const hit = FORGE.exec(skillBody(name));
      assert.equal(hit, null, `${name} names a forge invocation: ${hit?.[0] ?? ''}`);
    }
  });

  it('every skill that reads workflow state points at tracking.md', () => {
    const READS_STATE = ['roadmap', 'feature-plan', 'feature-implement', 'feature-status', 'feature-close'];
    for (const name of READS_STATE) {
      assert.match(skillBody(name), /tracking\.md/, `${name} must name where workflow state lives`);
    }
  });

  it('the stub ships the working-tree answer, so an install reads as the tree', () => {
    const stub = readTemplate('stubs/tracking.md');
    assert.match(stub, /\*\*In the working tree\.\*\*/, 'the shipped answer is written out');
    // The alternative ships commented, the way git.md's do — otherwise a fresh install would carry two.
    assert.doesNotMatch(
      stripComments(stub),
      /\*\*In an issue tracker\.\*\*/,
      'the tracker answer ships commented out',
    );
  });

  it('the plan is one write, so no run can leave half of it', () => {
    // Replaces 0.9.0's write-order test, whose premise §10.10 removed. That test guarded the window
    // between writing the body and creating one sub-issue per phase: a run dying in between left a
    // complete plan that read as a draft forever, and the fix was an ordering plus a reconciliation.
    // With the ledger back in the body there is no second object and therefore no window, so what has to
    // be asserted now is the absence — that the ledger is unchanged and the body is a single write.
    const plan = skillBody('feature-plan');
    assert.match(plan, /the body is one write/i, 'the atomicity is stated, not left to be inferred');
    assert.match(plan, /does not change shape/i, 'the ledger is the same table under both answers');
    assert.doesNotMatch(plan, /sub-issue/i, 'no phase is a separate object any more');
  });

  it('a closing row carries the evidence a commit cannot', () => {
    // §10.10: under the working-tree answer the row rides inside the commit, so it cannot disagree with
    // the code. A body edit cannot, so the sha in the Note is what replaces that atomicity — and a done
    // row with no evidence at all is a state the working-tree answer is structurally unable to produce.
    const implement = skillBody('feature-implement');
    assert.match(implement, /sha in the Note/i, 'the closing write names its commit');
    assert.match(implement, /cannot ride the commit/i, 'and says plainly what it is standing in for');
    assert.match(
      skillBody('feature-status'),
      /no evidence/i,
      'the reader stops on a done row that cannot be tied to the repository',
    );
  });

  it('no skill names an issue type, because nothing in the loop reads one', () => {
    // §10.11 lets /roadmap and /feature-plan SET a type and forbids anything from branching on it. That
    // property cannot be tested directly, so this is a proxy for it: the type's vocabulary lives in
    // tracking.md, the same way no skill names a forge command. A skill that started naming Bug or Task
    // would be one edit away from reading them.
    // /onboard is the exception, and it is the same exception §10.8 draws everywhere else: it is the one
    // command that COLLECTS a project-owned answer, so it has to name what it is asking about. Collecting
    // a parameter is not reading it, and nothing /onboard writes is consulted by the loop.
    for (const name of SKILL_NAMES.filter((n) => n !== 'onboard')) {
      assert.doesNotMatch(skillBody(name), /issue type/i, `${name} names the type vocabulary directly`);
    }
    assert.match(readTemplate('stubs/tracking.md'), /the issue's type/i, 'the primitive lives in the stub');
  });
});

describe('a plan too large for its home is a scope signal', () => {
  // An issue body has a hard ceiling and a plan document has none. The tempting reading is that the
  // ceiling is a defect of the tracker answer to be worked around; the design's reading is the opposite —
  // a plan that overflows a body is a feature that is several features, and this substrate is simply the
  // first thing to say so. Everything here guards that the workaround is refused and the split is offered.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const plan = flat(skillBody('feature-plan'));
  const migrate = flat(skillBody('tracking-migrate'));

  it('the number is a fact of the substrate, so only tracking.md states it', () => {
    // Same rule as the forge command and the issue type: a skill asks for the fact, `tracking.md` answers
    // it. A limit written into a skill is one a different tracker could not change.
    assert.match(readTemplate('stubs/tracking.md'), /65,536 characters/, 'the ceiling has one home');
    for (const name of SKILL_NAMES) {
      assert.doesNotMatch(skillBody(name), /65,?536/, `${name} hardcodes the tracker's ceiling`);
    }
    for (const name of ['feature-plan', 'feature-implement', 'tracking-migrate']) {
      assert.match(
        flat(skillBody(name)),
        /how large a body may be|body has a size limit/i,
        `${name} asks for the fact rather than knowing it`,
      );
    }
  });

  it('/feature-plan measures before the one write, not after one fails', () => {
    // The body is a single write, so there is no partial state to recover from — which also means a
    // failed write is the worst possible place to discover the plan was too big, with the research done
    // and nowhere to put it.
    assert.match(plan, /before writing, not after a write fails/i, 'the check precedes the write');
    assert.match(plan, /room to spare/i, 'and it leaves room for the rows written later');
  });

  it('/feature-plan splits the feature rather than shrinking the plan', () => {
    assert.match(plan, /the only honest response is to split the feature/i);
    for (const escape of [/Trimming the plan until it fits/i, /Continuing the plan into comments/i, /Linking out to a document or a paste/i]) {
      assert.match(plan, escape, `the escape ${String(escape)} is named and refused`);
    }
    assert.match(plan, /\*\*Propose, then ask\.\*\*/, 'a scope decision is the user\'s, not the command\'s');
    assert.match(plan, /write nothing until the user answers/i);
  });

  it('the split keeps the issue and opens no hierarchy', () => {
    // §10.10 removed the one-object-per-phase design. A split that produced a parent issue would put the
    // phase ordering back into a second home by another route.
    assert.match(plan, /keeps the first chunk/i, 'the id is reused, so the thread survives');
    assert.match(plan, /No parent issue/i, 'and nothing hierarchical replaces it');
    assert.doesNotMatch(skillBody('feature-plan'), /sub-issue/i);
  });

  it('/tracking-migrate refuses rather than guessing at a split', () => {
    // A migration that split a feature would be making a scope decision on the way past, which is the
    // same thing its ledger-disagreement refusal already declines to do.
    assert.match(migrate, /A plan too large for an issue body/i, 'it is in the refusal list');
    assert.match(migrate, /several features/i, 'and says what the overflow means');
    assert.match(migrate, /Never shorten a plan to make it fit/i, 'the standing rule matches the refusal');
  });

  it('/feature-implement never drops a ledger row to make space', () => {
    // The row is the phase's only home. Every other thing in the body can be recovered from somewhere;
    // a status that was never written is gone.
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /shorten your own Note until the row fits/i);
    assert.match(implement, /Never drop a row/i);
  });
});

describe('changing the answer is not moving the work', () => {
  // 0.8.0 shipped /onboard able to write the tracker answer over a repository whose backlog, plans and
  // active feature were all still files. Every command then read the tracker, found nothing, and reported
  // an empty backlog — the entries were not lost, they were unreachable, which is worse because it looks
  // like a clean install. The answer and the data are now two commands, and neither may produce that state.
  // Prose wraps at 110 columns, so every assertion here reads the flattened text: a claim that fits on
  // one line today is one edit away from being split across two, and a test that noticed would be
  // testing the line breaks rather than the rule.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const onboard = flat(skillBody('onboard'));
  const migrate = flat(skillBody('tracking-migrate'));
  const raw = skillBody('onboard');
  const step5 = flat(raw.slice(raw.indexOf('## Step 5 — Tracking'), raw.indexOf('## Step 6')));

  it('/onboard looks at the tree before it writes the tracker answer', () => {
    assert.match(step5, /before the answer is written/i, 'the check precedes the write');
    assert.match(step5, /empty backlog/i, 'it names what the split actually costs a reader');
    assert.match(step5, /\/tracking-migrate/, 'it names the command that finishes the switch');
  });

  it('/onboard refuses the switch while a phase is in progress', () => {
    assert.match(step5, /Refuse the tracker answer/i, 'the refusal is written as a refusal');
    assert.match(step5, /A phase is `in progress`/, 'and it names the condition that fires it');
  });

  it('/onboard never writes the answer and removes the tree files in one run', () => {
    // Removal is the irreversible half. /onboard cannot show a remote write as a diff beforehand, so it is
    // not allowed to trade one for the other.
    assert.match(step5, /Never write the tracker answer and delete the tree files in the same run/i);
  });

  it('the migration never invents the substrate it writes into', () => {
    // Its refusal list is what keeps the two commands from both owning the answer: the repository and the
    // labels are Step 5's to collect, and a migration that guessed one would write into the wrong place.
    assert.match(migrate, /It moves data\. It does not choose the substrate\./);
    assert.match(migrate, /name `\/onboard`/, 'it points at the command that owns the answer');
  });

  it('nothing is removed before the thing that replaces it exists', () => {
    // The safety argument for a bulk of non-atomic remote writes. Per feature, additively, removal last:
    // a run that dies leaves every feature in exactly one substrate, never in neither.
    assert.match(migrate, /Never remove a tree file before the issue that replaces it exists/);
    assert.match(migrate, /never in neither substrate/i);
  });

  it('resuming is observed, not recorded', () => {
    // Nothing in this workflow caches state. A migration is the obvious place to reach for a progress
    // file, and a progress file is a second home for a fact the tracker already answers.
    assert.match(migrate, /by observation, not by a state file/i);
    assert.match(migrate, /Never create a second issue for a name that already has one/);
  });

  it('the frozen era is never converted, and every file that could says so', () => {
    for (const [where, text] of [
      ['/tracking-migrate', migrate],
      ['/onboard', onboard],
      ['the stub', flat(readTemplate('stubs/tracking.md'))],
    ] as const) {
      assert.match(text, /looks real and is not/, `${where} says why history is not fabricated`);
    }
    assert.match(migrate, /Never convert `history\.md` or `archive\/`/);
  });

  it('the migration runs one way and says why', () => {
    // Tracker -> tree reads like an undo and is not one: a thread, a reporter and subscribers have no
    // markdown equivalent, so the reverse would discard the reason the answer was taken.
    assert.match(migrate, /There is no reverse/i);
    assert.match(migrate, /reads like an undo and is not one/);
  });
});

describe('the ledger row opens before the work', () => {
  // `in progress` was a legal status that nothing ever wrote. Every mention of it across the skills and
  // `workflow.md` was a read ("if it is already `in progress`, resume") or a retain ("*stays* `in
  // progress`") — wording that presupposes an entry-write which was never specified. A phase went
  // `not started` → `done` in one step, and a run interrupted mid-phase left a tree with half a phase in
  // it under a row claiming nothing had started.
  it('/feature-implement sets the row as a step of its own, before the work', () => {
    const body = skillBody('feature-implement');
    const opens = body.indexOf('## 6. Open the ledger row');
    const works = body.indexOf('## 7. Do the work');
    assert.ok(opens > 0, 'the opening write is a step, not a clause inside another one');
    assert.ok(works > opens, 'the row is set before any code is written');
  });

  it('every step number the skill cites resolves to a heading it has', () => {
    // The opening write was inserted mid-list, so every "go to step n" shifted with it.
    const body = skillBody('feature-implement');
    const headings = new Set([...body.matchAll(/^## (\d+)\. /gm)].map((m) => m[1]));
    const cited = [...body.matchAll(/\bstep (\d+)\b/g)].map((m) => m[1]);
    assert.ok(cited.length > 0, 'the skill cross-references its own steps');
    for (const n of cited) {
      assert.ok(headings.has(n), `step ${n} is cited but no "## ${n}." heading exists`);
    }
  });

  it('the phase-status rules name the entry-write, not only the reads', () => {
    assert.match(readTemplate('context/workflow.md'), /written twice/);
    assert.match(readTemplate('context/plan-template.md'), /goes to `in progress` when work/);
  });
});

describe('--all runs the phases without crossing a tier', () => {
  // The flag is legitimate because phase to phase is not a tier boundary — this command already owns the
  // phases within a plan. What it removes is the pause where a user reads a phase's report before the next
  // one builds on it, so the stop list *is* the feature: without it the flag is a licence to sweep past a
  // `blocked` phase, a capped gate and an open P0 in one unattended run. Flattened, per the note above.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const body = skillBody('feature-implement');
  const start = body.indexOf('## 14. `--all`');
  const all = flat(body.slice(start, body.indexOf('## Under the tracker answer')));

  it('the flag is in the usage block, not only in prose', () => {
    assert.ok(start > 0, 'the flag has a section of its own');
    assert.match(body.slice(body.indexOf('## Usage'), body.indexOf('## 1.')), /\/feature-implement --all/);
  });

  it('it re-enters at the phase steps and never re-runs the approval checkpoint', () => {
    assert.match(all, /go back to step 3/i, 'the loop says where it re-enters');
    // Activation, the branch or worktree and the marker are once per feature. Re-running step 2 would put
    // a second approval checkpoint and a second branch decision inside a loop that already has consent.
    assert.match(all, /Step 2 does not run again/i);
  });

  it('every condition that ends a single run ends the loop', () => {
    for (const [what, re] of [
      ['a phase that ended blocked or part-landed', /closed `blocked`/],
      ['a gate at its loopback cap', /two-loop cap/],
      ['an open P0 or P1 tied to the phase', /open `P0` or `P1`/],
      ['a ledger that disagrees with the repo', /step 5's disagreement/],
      ['nothing runnable', /`Depends on` that is not `done`/],
    ] as const) {
      assert.match(all, re, `${what} must stop the loop`);
    }
  });

  it('it stops at the tier boundary rather than crossing it', () => {
    // A flag on this command is not the user typing the next one.
    assert.match(all, /never crosses into `\/feature-close`/);
  });

  it('the two answers a loop cannot assume are stated before the first phase', () => {
    // The shipped reviewer is the host reading its own diff and the shipped git answer leaves each phase in
    // the tree. One phase of either is a considered default; four unattended phases of the first compound,
    // and four phases of the second cannot be cut back into the four commits git.md says they are.
    assert.match(all, /executors\.md/, 'which reviewer runs is said up front');
    assert.match(all, /git\.md/, 'who commits is said up front');
    assert.match(all, /decline the continuation/, 'the user-commits answer ends the loop after one phase');
  });

  it('the per-phase report is not deferred to a summary at the end', () => {
    assert.match(all, /reports every phase, as that phase ends/);
  });

  it('the heartbeat carries the loop under the tracker answer', () => {
    // An assignee is a lock with no expiry, and a run that dies four phases deep leaves exactly the one a
    // run that died after one phase leaves. The boundary comments are what say so from outside it.
    assert.match(flat(body), /Under `--all` the heartbeat is the only thing outside the run/);
  });

  it('every document that shows the command shows the flag', () => {
    // Documentation is part of the change: the diagram and the command table are where a reader learns the
    // command exists at all, and a flag missing from them is a flag nobody types.
    const workflow = readTemplate('context/workflow.md');
    assert.match(workflow, /\/feature-implement \[--all\]/, 'the tier diagram carries it');
    assert.match(workflow, /One run is one phase, unless `--all`/, 'the phase-status rules account for it');
    const readme = readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
    assert.match(readme, /\/feature-implement \[--all\]/, "the package README's diagram carries it");
  });
});

describe('documentation is part of the change', () => {
  // A plan could name every file it touched and still leave the README describing the flag it renamed.
  // Nothing fails for that — docs are the one output with no gate behind them — so the drift is invisible
  // until someone follows the old instructions. The fix is three files with one job each: stack.md says
  // where the docs are, the plan's §7 says what this feature makes untrue there, and the phase that makes
  // it untrue carries the path on its own `Files:` line.
  it('the rule has one home, and it is the file every command already cites', () => {
    assert.match(readTemplate('context/workflow.md'), /^### Documentation is part of the change$/m);
  });

  it('the plan template has the section, and the notes say what goes in it', () => {
    assert.match(readTemplate('context/plan-template.md'), /^## 7\. Documentation$/m);
    assert.match(readTemplate('context/plan-template.notes.md'), /\*\*§7 Documentation\*\*/);
  });

  it('the stub has somewhere to record where the docs are', () => {
    assert.match(readTemplate('stubs/stack.md'), /^## Documentation$/m);
  });

  it('every command that plans or lands work reads the index', () => {
    for (const name of ['feature-plan', 'feature-implement', 'orchestrate', 'onboard']) {
      assert.match(skillBody(name), /Documentation/, `${name} must account for the project's own docs`);
    }
  });

  it('an empty index is never read as "there are no docs"', () => {
    // The failure this guards is the same shape as §4.4's: an unstated premise is not neutral. A section
    // nobody filled in and a project that documents itself nowhere are different facts, and a command that
    // cannot tell them apart resolves the ambiguity the cheap way, every time.
    assert.match(skillBody('feature-plan'), /is not evidence that there\s+are no docs/);
    assert.match(skillBody('onboard'), /Write "none" if there is none/);
  });

  it('a documentation row is carried by a phase, not left as a follow-up', () => {
    assert.match(skillBody('feature-plan'), /`Files:` line names the same path/);
    assert.match(readTemplate('context/plan-template.notes.md'), /row with no phase is a follow-up/);
  });
});

describe('a §-citation names the section it points at', () => {
  // Inserting §7 pushed Verification and Open questions down one. Every citation that carries the section
  // *name* has to move with it — and a citation that does not carry one (`// SMART-CROP-PLAN.md §7.3`,
  // written for a plan of unknown vintage) is left alone, which is why only titled ones are checked.
  const sections = new Map(
    [...readTemplate('context/plan-template.md').matchAll(/^#{2,4} (\d+(?:\.\d+)?)\.? +(.+)$/gm)].map(
      (m) => [m[1] as string, m[2] as string],
    ),
  );

  it('reads the template', () => {
    assert.ok(sections.size > 8, 'the template numbers its sections');
  });

  it('resolves every titled citation in every template we ship', () => {
    const wrong: string[] = [];

    for (const { rel, text } of ourTemplates()) {
      for (const match of text.matchAll(/§(\d+(?:\.\d+)?) (\*{0,2}[A-Z][a-z]+)/g)) {
        const [, number, cited] = match as unknown as [string, string, string];
        const word = cited.replace(/\*/g, '');
        const title = sections.get(number);
        if (title === undefined || !title.startsWith(word)) {
          wrong.push(`${rel}: §${number} ${word} — the template's §${number} is "${title ?? 'missing'}"`);
        }
      }
    }

    assert.deepEqual(wrong, [], `stale section citations:\n  ${wrong.join('\n  ')}`);
  });
});

describe('no document states its own status', () => {
  it('nothing the tool installs carries a **Status:** header', () => {
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /^\s*\*\*Status:?\*\*/m, `${rel}`);
    }
  });
});

describe('the stubs are inert', () => {
  // A commented-out or quoted example must not read as real content to anything that scans the file —
  // not just to `check`, which strips comments, but to an agent or a one-off script too.
  it('the roadmap stub contains no parseable entry', () => {
    assert.deepEqual(parseRoadmap(readTemplate('stubs/roadmap.md')), []);
  });

  it('the findings stub contains no parseable finding', () => {
    assert.deepEqual(parseFindings(readTemplate('stubs/findings.md')), []);
  });

  it('the history stub has a table and no rows', () => {
    assert.deepEqual(parseHistory(readTemplate('stubs/history.md')), []);
  });
});

describe('the AGENTS.md block', () => {
  it('inlines the command table, because command names are undiscoverable', () => {
    const body = agentsBlockBody();
    for (const name of SKILL_NAMES) {
      assert.ok(body.includes(`/${name}`), `${name} is named in the block`);
    }
  });

  it('stays small — everything but the commands is a pointer', () => {
    // The ceiling is on the *prose*, not on the file, so a ninth command costs a row and nothing else.
    // A flat line count would have made the block's one legitimate growth indistinguishable from the
    // failure it guards — the block turning into a second copy of the rules.
    const lines = agentsBlockBody().split('\n').length;
    assert.ok(lines - SKILL_NAMES.length < 32, `the block is not a second copy of the rules (${lines})`);
  });
});

describe('/onboard adopts an existing AGENTS.md', () => {
  const onboard = skillBody('onboard');

  it('classifies before it moves, and moves before it deletes', () => {
    // Matched by name, not by number: steps get inserted, and the claim here is the ordering.
    const adopt = onboard.indexOf('## Step 1 — Adopt');
    const prune = onboard.search(/^## Step \d+ — Prune/m);
    assert.ok(adopt > 0, 'the adoption step exists');
    assert.ok(prune > adopt, 'pruning comes after every step that writes a destination');
    assert.match(onboard, /Nothing is deleted here/, 'the adoption step deletes nothing');
    assert.match(onboard, /Copy before cut/, 'the ordering is stated as a standing rule');
  });

  it('the tracking step reports even when it has nothing to ask', () => {
    // Shipped in 0.8.0 silent in its most common case: a new repo has no remote, and Step 4's default is
    // *neither* a push nor a pull request, so both checks closed at once and the step asked nothing — and
    // asking nothing was read as saying nothing. A step that can ask nothing must still report.
    // Prose wraps, so every assertion here is whitespace-tolerant.
    const step = onboard
      .slice(onboard.indexOf('## Step 5 — Tracking'), onboard.indexOf('## Step 6'))
      .replace(/\s+/g, ' ');
    assert.ok(step.length > 0, 'the tracking step exists');
    assert.match(step, /in one line — always/i, 'it reports its outcome unconditionally');
    assert.match(step, /name what would make it available/i, 'a failed precondition names its own fix');
    assert.match(
      step,
      /never removes it/i,
      "an earlier step's default must not delete this answer without saying so",
    );
    // §10.10: the tracker answer stopped requiring git.md's push answer when the phase row came back into
    // the body — no part of it waits for a commit to reach the default branch any more. The pairing is
    // still recommended, for a reason that is about several agents seeing each other's work rather than
    // about a mechanism, and a step that presented it as a requirement would be quoting a deleted one.
    assert.match(step, /works under every \*Push and pull request\* answer/i, 'the pairing is not a requirement');
    assert.match(step, /visible to exactly one of them/i, 'and the reason to pair them anyway is stated');
  });

  it('asks rather than guessing on the two undecidable rows', () => {
    for (const pattern of [/\*\*Unsure\*\*/, /\*\*Contradicts\*\*/, /Quote both and ask which stands/]) {
      assert.match(onboard, pattern, `the adoption step names ${String(pattern)}`);
    }
  });

  it('never lets an inherited command skip the run', () => {
    // The whole point of Step 5 is that a written command has exited 0. A command lifted out of prose
    // someone wrote months ago is the likeliest of all to have rotted, so it enters as a candidate.
    assert.match(onboard, /a \*\*candidate\*\* for `context\/verify\.md`/);
    assert.match(onboard, /Never write a command that has not passed/);
  });

  it('keeps the tool-owned block out of the migration in both directions', () => {
    assert.match(onboard, /Never touch the region between the `ai-workflow` markers/);
    assert.match(onboard, /nothing migrates into it/);
  });

  it('loses nothing it could not place', () => {
    assert.match(onboard, /Never delete a claim you could not place/);
  });
});
