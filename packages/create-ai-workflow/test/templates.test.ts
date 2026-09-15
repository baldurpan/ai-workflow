import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { claudeSkillTransform, SKILL_NAMES, STUBS, agentsBlockBody, readTemplate } from '../src/layout.ts';
import { parseHistory, parseRoadmap } from '../src/check/parse.ts';
import { stripComments } from '../src/check/markdown.ts';
import { sections } from '../src/stubs.ts';
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

describe('git happens on instruction, never on initiative', () => {
  // The field report behind this: agents creating worktrees and branches nobody asked for, and committing.
  // §4.4 named the unstated-premise failure and §4.5 added the answers; both are about what the *workflow's
  // commands* do. What was missing is the rule one level up — that those answers are not standing leave to
  // use git, and that nothing else grants it. The rule is invariant, so it lives in tool-owned files that
  // `update` actually reaches; git.md carries the half that is about what its own answers do not cover.

  it('the standing rule names staging, which is half a commit', () => {
    // `git add` was absent from every list for four versions, so "leave it in the working tree" was
    // satisfiable by an agent that staged everything first — editing what the user's own commit captures.
    const workflow = readTemplate('context/workflow.md');
    assert.match(workflow, /\bstages?\b/i, 'workflow.md names staging');
    assert.match(workflow, /\bunstaged\b/i, 'and says what the handover looks like');
    assert.match(agentsBlockBody(), /\bstage\b/i, 'the always-loaded block names it too');
    for (const name of ['feature-implement', 'orchestrate']) {
      assert.match(skillBody(name), /\bunstaged\b/i, `${name} hands over an unstaged tree`);
    }
  });

  it('permission is never inferred, and the option-text case is named', () => {
    // The sharpest failure is self-granted: the agent writes an option whose text mentions committing, the
    // user picks that option for its other merits, and the agent reads its own words back as consent.
    const homes = [readTemplate('context/workflow.md'), readTemplate('stubs/git.md')];
    for (const text of homes) {
      assert.match(text, /not inferred/i, 'the rule is stated as such');
      assert.match(text, /option text/i, 'and the option-text case is named explicitly');
    }
  });

  it('the operations that are never standing policy are listed by name', () => {
    // These are the ones no `git.md` answer may authorise, however the four questions were answered.
    const git = readTemplate('stubs/git.md');
    for (const op of [/force-push/i, /default branch/i, /rewriting published history/i]) {
      assert.match(git, op, `git.md names ${op}`);
    }
    assert.match(readTemplate('context/workflow.md'), /never standing policy/i, 'workflow.md says it too');
  });

  it('git.md carries the section as a heading, so `update` reports it to old installs', () => {
    // A stub is project-owned and `update` cannot write one. A new `##` is what stubGaps reports and what
    // sends an existing install to /onboard; the same words inside an existing section reach nobody.
    const heading = sections(readTemplate('stubs/git.md')).find((s) => /authorise/i.test(s));
    assert.ok(heading, 'the rule is its own ## section');
  });

  it('/onboard writes that section rather than asking about it', () => {
    // Every other thing Step 4 touches is a question. This one is not, and an /onboard that offered it as
    // a choice would let the answer be negotiated away in exactly the sessions that most need it.
    const onboard = skillBody('onboard');
    assert.match(onboard, /Never negotiate away/i, 'it is written, not asked');
    assert.match(onboard, /What no answer here authorises/, 'and it names the section it writes');
  });
});

describe('a worktree is made by the recorded command or not at all', () => {
  // git.md said "how one is created belongs in executors.md" and /onboard said to record it there — but
  // executors.md had only Coder and Reviewer, so there was nowhere to put it. Nothing on disk named a
  // worktree command, which is how an agent arrives at `git worktree add` and a tree with no env files.

  it('executors.md has a section to hold the invocation', () => {
    const heading = sections(readTemplate('stubs/executors.md')).find((s) => /Branch and worktree/i.test(s));
    assert.ok(heading, 'the third dispatch answer has a home');
  });

  it('an empty section means no worktree, not an improvised one', () => {
    const executors = readTemplate('stubs/executors.md');
    assert.match(executors, /git worktree add/, 'the tempting fallback is named');
    assert.match(executors, /Never run a bare/i, 'and refused');
    assert.match(
      skillBody('feature-implement'),
      /Never improvise the command/i,
      'the command that would make one says so at the point it would',
    );
  });

  it('no template hardcodes a worktree invocation outside the step that asks for one', () => {
    // §4.3: a skill that names a command bakes one machine's setup into a tool that ships everywhere.
    // /onboard is the exception by design — it *asks*, and a named example there is a suggestion the user
    // overrides. Anywhere else it would be an execution path nobody chose.
    for (const { rel, text } of ourTemplates()) {
      if (rel === path.join('skills', 'onboard', 'SKILL.md')) continue;
      const hit = /@northguild\/worktree|\bworktree (branch|checkout|cleanup)\b/.exec(text);
      assert.equal(hit, null, `${rel} hardcodes a worktree invocation: ${hit?.[0] ?? ''}`);
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

describe('what a change announces is an answer, not an assumption', () => {
  // `release.md` is the sixth file in the shape of verify.md, executors.md, git.md and tracking.md, and the
  // first whose answer can be *false*: "no lint step" is accurate in a project with no linter, but "a change
  // is announced by writing a note" is a lie in a repository where nothing records one — the same defect as
  // a `done` row whose Files: do not exist. Everything here guards that the answer stays true, that it is
  // asked per path, and that the commands defer to it rather than knowing a tool.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const stub = readTemplate('stubs/release.md');
  // The three commands that put changes into the product. /prototype is excluded on purpose: a throwaway
  // mockup under prototypes/ ships to nobody, so there is nothing for it to announce.
  const LANDS_SHIPPABLE = ['feature-implement', 'feature-close', 'orchestrate'] as const;

  it('the stub is registered as one /onboard fills, so update reports it under Next', () => {
    // An upgraded install cannot receive a project-owned file (§4.1), so the only path to this stub is the
    // Next block naming /onboard. Registering it with onboard:false would make that report silent.
    const entry = STUBS.find((s) => s.dest === 'context/release.md');
    assert.ok(entry, 'release.md is a stub');
    assert.equal(entry?.onboard, true, 'a person supplies its content, through /onboard');
  });

  it('no template names a release tool, the same way none names a forge command', () => {
    // §10.8's rule, one file over. The skills ask for the *fact* — what records a note here — and the stub
    // answers it, which is what keeps a repository with no package.json a section edit rather than a
    // rewrite of three skills. /onboard needs no exemption: its detection step describes the shapes
    // ("a notes directory", "an `## Unreleased` heading") instead of naming the tools that produce them.
    const TOOLS = /\b(changesets?|towncrier|semantic-release|release-please|lerna|auto-changelog|goreleaser|standard-version|release-it)\b/i;
    for (const { rel, text } of ourTemplates()) {
      const hit = TOOLS.exec(text);
      assert.equal(hit, null, `${rel} names a release tool: ${hit?.[0] ?? ''}`);
    }
  });

  it('the shipped answer is true of every repository, so an install behaves as it did', () => {
    assert.match(stub, /\*\*Nothing here announces a change\.\*\*/, 'the answer is written out');
    assert.match(stub, /\*\*Nothing records a note here\.\*\*/, 'and so is the mechanism answer');
    // The alternatives ship commented, the way git.md's and tracking.md's do — a fresh install that carried
    // two answers would have none.
    const live = stripComments(stub);
    assert.doesNotMatch(live, /\*\*Per phase\.\*\*/, 'the second granularity ships commented out');
    assert.match(live, /\*\*Once per feature\.\*\*/, 'the first one does not');
  });

  it('every command that lands shippable code defers to the file instead of knowing a tool', () => {
    for (const name of LANDS_SHIPPABLE) {
      const body = flat(skillBody(name));
      assert.match(body, /release\.md/, `${name} must read the answer before closing out`);
      assert.match(body, /what records a note/i, `${name} asks for the fact rather than naming a mechanism`);
    }
  });

  it('the answer is per path and the granularity is per project — two axes, not one', () => {
    // A granularity column in the table would let one repository write per-phase notes for its app and
    // per-feature notes for its package, which makes "when does this command write" depend on what the
    // phase happened to touch.
    const body = flat(stub);
    assert.match(body, /The unit is the path, not the change/i, 'one change can owe two notes');
    assert.match(body, /what leaves this repository as a unit/i, 'granularity is a fact about the repo');
  });

  it('/orchestrate closes the cell the granularity answer leaves empty', () => {
    // Both of its values are plan vocabulary and this command has no entry, no plan and no ledger. An agent
    // resolving that alone either calls the change a feature (a guess) or decides the answer never fires
    // and ships a user-visible fix unannounced — and nothing goes red either way.
    const body = flat(skillBody('orchestrate'));
    assert.match(body, /the change is the unit/i, 'the missing value is supplied');
    assert.match(body, /The table still governs/i, 'and the per-path judgment still applies');
    assert.match(flat(stub), /`\/orchestrate` has neither value/i, 'the stub says it too, for a reader');
  });

  it('a script that writes never becomes a Gate 1 candidate', () => {
    // Step 7 sweeps package.json scripts and step 3 *runs* every candidate. Once `release-init` has put a
    // versioning script in that file, an unguarded sweep bumps every package and writes changelogs during
    // onboarding — and an interactive note-writing script hangs the agent outright. The guard names the
    // shape, not the script, so it holds for a project that wired its own.
    const body = flat(skillBody('onboard'));
    assert.match(body, /A script that writes is not a candidate/i);
    assert.match(body, /do not run one to find out what it does/i, 'because step 3 runs candidates');
    assert.match(body, /belongs on the pull request/i, "and §11.8's note check stays out of Gate 1");
  });

  it('nothing in the workflow may run what consumes the notes', () => {
    // The asymmetry the rule rests on: writing a note is a tracked file that publishes nothing, while
    // consuming them takes *every* pending note — other people's included — and where a deploy watches
    // versions it ships. A skill that ran it would release somebody else's unshipped work.
    const rule = readTemplate('context/workflow.md').replace(/\s+/g, ' ');
    assert.match(rule, /Never run what bumps, tags, publishes or deploys/i);
    assert.match(rule, /Only when the user asks for it in that turn/i, 'and the one exception is explicit');
    assert.match(rule, /every.{0,3} pending note/i, 'it says why: the blast radius is not this change');
    // Named by shape. A skill naming the tool would fail the sibling rule two tests up.
    assert.doesNotMatch(rule, /\b(changesets?|towncrier|semantic-release)\b/i);
  });

  it('both writers are told a note is short, because neither vendor enforces it', () => {
    // Nothing in any mechanism caps the summary, and an agent handed "write the note" writes an essay:
    // the phase log it just produced is right there and reads like source material. It is not — the
    // audience is someone deciding whether this affects them.
    for (const name of ['feature-close', 'feature-implement']) {
      const body = flat(skillBody(name));
      assert.match(body, /A note is one or two sentences/i, `${name} caps the note`);
      assert.match(body, /not\s+reviewing the diff/i, `${name} says who reads it`);
    }
  });

  it('re-entering the work updates the note rather than writing a second one', () => {
    // A resumed phase and a Gate 2 loopback both come back through step 7. Mechanisms that collect notes
    // use non-colliding filenames on purpose, so two files describing one change do not conflict — they
    // are both counted, and the announcement says the same thing twice.
    const body = flat(skillBody('feature-implement'));
    assert.match(body, /does not write a second note/i);
    assert.match(body, /both counted/i, 'and says what the duplicate actually costs');
  });

  it('a note that is owed rides the phase, so nothing new refuses `done`', () => {
    // Putting the note's path on the Files: line is what makes step 11's existing rule cover it. A separate
    // refusal would be a second home for the same judgment.
    const body = flat(skillBody('feature-implement'));
    assert.match(body, /put the note's path on the phase's `Files:` line/i);
    assert.match(body, /doc update or note has\s*not landed has not landed/i);
  });

  it('/feature-close confirms the levels under both granularities, and writes none when dropped', () => {
    // The bump level is a per-change judgment, so it is asked. Putting the ask inside /feature-implement
    // would make it fire between phases, which is exactly what --all exists to avoid — so it happens where
    // the notes leave the machine instead, whichever command wrote them.
    const body = flat(skillBody('feature-close'));
    assert.match(body, /last moment before the feature's notes leave this machine/i);
    assert.match(body, /Per phase\*\* → the phases already wrote them/i, 'it reads rather than re-writes');
    assert.match(body, /No release note is written here, and none is removed/i, '--dropped announces nothing');
    assert.match(body, /retired with no note and why/i, 'a declined note is reported, not silent');
  });

  it('--all gains no new stop, because nothing in the loop asks', () => {
    // The one cell that would have broken the flag: per phase + a published package + a level that has to
    // be confirmed. Resolved by moving the confirmation to /feature-close, so the stop list is untouched.
    const body = skillBody('feature-implement');
    const all = flat(body.slice(body.indexOf('## 14. `--all`'), body.indexOf('## Under the tracker answer')));
    assert.doesNotMatch(all, /release/i, 'the flag has nothing to say about notes');
  });

  it('a path the table does not cover is reported — never faked, never a refusal', () => {
    // verify.md's "a missing entry is skipped, never faked" generalised to a file whose entries are paths.
    // Writing a note invents policy for a path nobody answered for; refusing blocks ordinary work over a
    // gap in a configuration file.
    for (const name of LANDS_SHIPPABLE) {
      assert.match(flat(skillBody(name)), /does not cover is named/i, `${name} reports the gap`);
    }
    assert.match(flat(stub), /named in the report, given no note, and left alone/i);
  });

  it('the tracker answer changes nothing here, and the absence is stated', () => {
    // Every sibling stub has an "Under the tracker answer" section, so this one's missing section would
    // otherwise read as an omission. A note is an artifact of the change, not workflow state.
    assert.deepEqual(
      sections(stub).filter((h) => /tracker/i.test(h)),
      [],
      'no tracker section exists',
    );
    assert.match(flat(stub), /There is no \*Under the tracker answer\* section here/i);
    for (const name of ['feature-implement', 'feature-close']) {
      assert.match(
        flat(skillBody(name)),
        /artifact of the change rather than workflow state/i,
        `${name} says so where it describes the tracker answer`,
      );
    }
  });

  it('the rule has one home, and the fact has one place to be read', () => {
    const workflow = readTemplate('context/workflow.md');
    assert.match(workflow, /^### What a change announces is an answer, not an assumption$/m);
    assert.match(workflow, /\| whether a change owes a release note \|/, 'the one-source-of-truth table has it');
  });

  it('a generated changelog is an output, not a documentation surface', () => {
    // A plan that listed one in its §7 would be proposing to hand-edit something a tool rewrites.
    assert.match(readTemplate('stubs/stack.md'), /A generated changelog is not a surface/i);
  });

  it('the reviewer points at the file and reads the granularity before judging', () => {
    // Under *once per feature* a phase owes nothing, so a reviewer that checked for a note per phase would
    // fail every phase of every feature in such a repository.
    const reviewer = flat(readTemplate('claude/agents/reviewer.agent.md'));
    assert.match(reviewer, /check whatever `context\/release\.md` requires/i);
    assert.match(reviewer, /granularity answer before judging/i);
    assert.match(reviewer, /Name no release tool/i);
  });

  it('/onboard writes the true answer or the true answer plus a named gap — never a false one', () => {
    const raw = skillBody('onboard');
    const step = flat(raw.slice(raw.indexOf('## Step 9 — Release'), raw.indexOf('## Step 10')));
    assert.ok(step.length > 0, 'the release step exists');
    assert.match(step, /This step installs nothing/i, 'phase A collects an answer and mutates nothing');
    assert.match(step, /name what is missing, and stop/i, 'the refusal is written as a refusal');
    assert.match(step, /Never leave the file saying changes are announced while nothing consumes the notes/i);
    // The invariant is that every sweep item is said back, empty ones included — the number is how the
    // prose states it, so the sentence and the list have to agree or the step asks for five findings out
    // of six. Derived rather than typed: adding a seventh item fails here until the sentence moves too.
    const sweep = step.slice(
      step.indexOf('A check, not a question'),
      step.indexOf('### Then ask, per path'),
    );
    const numbered = [...sweep.matchAll(/(?:^|\s)(\d+)\. \*\*/g)].map((m) => Number(m[1]));
    assert.deepEqual(
      numbered,
      numbered.map((_, i) => i + 1),
      'the sweep is a list numbered from one, with nothing skipped',
    );
    const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    assert.match(
      step,
      new RegExp(`Say all ${SPELLED[numbered.length]} back in a line each, including the empty ones`, 'i'),
      'it reports like Step 5, and says back as many as it swept',
    );
    assert.match(step, /do not generate one/i, 'the release job is named as a gap, not written');
  });

  it('/onboard asks it after the layout it depends on is settled', () => {
    // Matched by name, not by number: the claim is the ordering. The step needs Stack's layout to know
    // which paths exist, and it edits the Documentation index Stack just wrote.
    const onboard = skillBody('onboard');
    const stack = onboard.indexOf('## Step 8 — Stack');
    const release = onboard.indexOf('## Step 9 — Release');
    const prune = onboard.search(/^## Step \d+ — Prune/m);
    assert.ok(stack > 0 && release > stack, 'release comes after stack');
    assert.ok(prune > release, 'and pruning still comes last');
  });

  // The answer had a front half and no back half. Notes accumulated, a release consumed them — and what
  // that release *did* was written down as four unwired gaps (bump, tag, publish, deploy) under a heading
  // that said this project does none of them. So the mechanism read as a way to publish packages, and the
  // repository whose artifact is a deployed app got nothing but a config flag: the section that should have
  // said "this app goes live on that merge" said only that the workflow would not do it.
  it('the last answer is the event, and it is one event rather than one per artifact kind', () => {
    const headings = sections(stub);
    assert.ok(
      headings.includes('What a release ships, and on what event'),
      'the file has a section for what a merge does, not just for what it will not do',
    );
    assert.ok(
      !headings.some((h) => /does not do here/i.test(h)),
      'and the list of four gaps it replaced is gone, so there is one place to read it',
    );
    const body = flat(stub);
    assert.match(body, /one event, not one per artifact kind/i);
    assert.match(body, /merge of the release pull request/i, 'the event is named');
    assert.match(
      body,
      /Publishing a package and deploying an app are two consequences of that single merge/i,
      'a deploy is the same event as a publish, not a separate design',
    );
    assert.match(body, /A feature's merge ships nothing/i, 'and a feature merge is not that event');
  });

  it('the shipped ship answer is true of every repository, like the first one', () => {
    // An install that carried a live per-path ship table would be claiming an event nobody wired. The
    // shipped answer says the event has not been written down — not that nothing reaches users.
    const live = stripComments(stub);
    assert.match(live, /nothing here ships on a merge/i, 'the answer is written out');
    assert.doesNotMatch(live, /On the release merge/, 'the per-path ship table ships commented out');
  });

  // Found in the field on a repository that deploys and never publishes. Everything worked — notes
  // consumed, version moved, gate fired, production updated — and the tags and releases pages were both
  // empty, because nothing in a deploy's path ever creates either. The publish half hides this: the
  // command that publishes tags as a side effect, so a repository that publishes gets a record without
  // deciding to have one. §11.10 made the *trigger* uniform across artifact kinds and left the *record*
  // per artifact kind; this is the other half of that sentence.
  it('the event leaves a record, and it is the same record whichever half a path got', () => {
    const body = flat(stub);
    assert.match(
      body,
      /Every path that merge ships leaves a tag and a release behind/i,
      'the record is stated as uniform rather than left to the artifact kind',
    );
    assert.match(
      body,
      /record belongs to the event, not to the kind of artifact/i,
      'and it is stated as the same sentence the event itself was fixed with',
    );
    assert.match(
      body,
      /Leaves behind/,
      'the per-path table has a column for it, so a deploy-only repo cannot skip it',
    );
  });

  it('names the failure that looks like success, since every step of it reports green', () => {
    const body = flat(stub);
    assert.match(body, /A deploy that leaves no tag and no release is the failure that looks like success/i);
    assert.match(
      body,
      /usually off by default for exactly the paths that deploy/i,
      'and says the default is what produces it, so nobody has to have chosen it',
    );
  });

  it('Release is a wire of its own, because nothing else in a deploy would produce one', () => {
    const body = flat(stub);
    assert.match(body, /\*\*Release\*\* — what turns a tag into the page someone reads/i);
    assert.match(
      body,
      /Do not assume the publish step owns this/i,
      'the Tag wire says why it is empty in a repository that only deploys',
    );
    // The skill has to collect five, or the stub has a wire nothing fills.
    assert.match(
      skillBody('onboard'),
      /what bumps a version, what tags, what cuts a\s+release, what publishes and what deploys/i,
      '/onboard Step 9 asks for all five',
    );
  });

  it('the tagging setting is recorded next to the versioning one it is always confused with', () => {
    const body = flat(stub);
    assert.match(body, /\*\*Whether private packages get tagged\.\*\*/i);
    assert.match(
      body,
      /separate switch from the one above and commonly off by default too/i,
      'two switches, one question — which is the shape that produced the field failure',
    );
    assert.match(body, /three settings of the mechanism/i, 'and the count above them agrees');
  });

  it('the gate is per path, and what it reads is that path own version', () => {
    // `a release happened` is the condition someone reaches for, and it deploys production off a release
    // that only bumped a package. The honest condition is narrower, and it is where the bump level chosen
    // for a note stops being prose.
    const body = flat(stub);
    assert.match(body, /what it reads is that path's own version/i);
    assert.match(body, /never \*a release happened\*/i, 'the wrong condition is named as wrong');
    assert.match(body, /A path that deploys has to be versioned/i, 'or there is nothing to key on');
    assert.match(
      body,
      /wired to every merge of the base branch is not gated at all/i,
      'and the shape it degrades into is named too',
    );
  });

  it('landing a change is not shipping it, in every file that finishes work', () => {
    // The failure this closes is a report, not a file: an agent that lands a phase or retires a feature
    // says the thing is live, because nothing told it that a merge and a deploy are different events.
    assert.match(flat(stub), /Landing a change is not shipping it/i, 'the rule is in the answer');
    assert.match(
      flat(readTemplate('context/workflow.md')),
      /Landing a change is not shipping it, and that holds for a deployed app as much as a published package/i,
      'and in the standing rules, where both halves are named',
    );
    assert.match(
      flat(skillBody('feature-close')),
      /Retiring a feature is not shipping it/i,
      'the command that hands a feature over says what it is waiting for',
    );
    assert.match(
      flat(skillBody('feature-implement')),
      /A landed phase has shipped nothing, under either granularity/i,
      'and so does the one that lands a phase',
    );
  });

  it('*per phase* no longer rests on a phase reaching users, because it does not', () => {
    // Its old justification was "a deployed app, where each phase reaches users on its own" — which the
    // ship answer contradicts outright: under it a landed phase has shipped nothing either. The value
    // still exists; what it claims is about entries in a changelog.
    for (const text of [stub, skillBody('onboard')]) {
      assert.doesNotMatch(flat(text), /each phase reaches users on its own/i);
      assert.match(flat(text), /cuts a release about as often as it merges/i);
    }
  });

  it('/onboard collects the event, reports the ungated deploy, and still writes no job', () => {
    const raw = skillBody('onboard');
    const step = flat(raw.slice(raw.indexOf('## Step 9 — Release'), raw.indexOf('## Step 10')));
    assert.match(step, /Whether anything publishes or deploys, and on what event/i, 'the sweep asks when');
    assert.match(
      step,
      /a deploy wired to every merge of the base branch, in a repository that records notes, ships whatever unreleased work is in the tree/i,
      'the contradiction is named as the defect it is',
    );
    assert.match(step, /Do not rewire it/i, 'and it stays a report');
    assert.match(step, /one event, not one per artifact kind/i, 'the ask is one answer for both halves');
    assert.match(step, /that path's own version moving/i, 'including the condition');
    assert.match(
      step,
      /covers the deploy exactly as much as the publish, and they are one gap rather than two/i,
      'the refusal to generate one covers both, and says why that is not two decisions',
    );
    assert.match(step, /This step installs nothing/i, 'and it still installs nothing');
  });

  it('the fact has a row wherever a merge is what someone is asking about', () => {
    assert.match(
      readTemplate('context/workflow.md'),
      /\| what a merge publishes or deploys \|/,
      'the one-source-of-truth table answers it, so nothing infers it from a version existing',
    );
  });

  // Found in the field, as a numbered step in a repository's own documented flow: close the feature, run
  // the script that consumes the notes, then write an EMPTY note so the note check goes green again. The
  // check asks *are there pending notes?* as a proxy for *is this change described?*, and those come apart
  // on exactly one commit — the release, where every description has just become the changelog. So the one
  // push that owes nothing is the one the check fails, and the way out it teaches is a note that describes
  // nothing, written to satisfy a gate. This is the same class as §11.11: every step reports success.
  it('a note check is exempted on the release commit, and reuses the ship gate rather than inventing one', () => {
    assert.match(flat(stub), /what exempts the release commit from it/i, 'the answer records the exemption');
    assert.match(
      flat(stub),
      /are there pending notes\?\* as a proxy for \*is this change described\?\*/i,
      'and says which two questions the check confuses',
    );
    assert.match(
      flat(stub),
      /it is the same \*this path's version moved\* the last answer in this file already uses/i,
      'the condition is the gate that already exists, not a second rule that can disagree with it',
    );
  });

  it('a note that describes nothing is never written to satisfy a check', () => {
    // Live prose, not a fill-in: it holds in every repository that has a check at all, and the moment it
    // is needed is the moment somebody is staring at a red square with a one-command way to clear it.
    const live = flat(stripComments(stub));
    assert.match(live, /A note that describes nothing is never written to satisfy a check/i);
    assert.match(live, /the signal that the check is asking the wrong question/i, 'it says what to fix');
    assert.match(live, /has stopped being one/i, 'and what a gate a lie satisfies is worth');
    // The rule reaches the command that would be the one to reach for it, at the moment it would.
    assert.match(
      flat(skillBody('feature-close')),
      /do not write a note to silence it/i,
      'and the command that opens the pull request carries it',
    );
  });

  it('--release is the shape of the ask, and nothing else is', () => {
    // workflow.md forbids running what bumps "except when the user asks for it in that turn", and until
    // now nothing said what asking looked like — leaving an agent to read "and ship it" three messages
    // back as permission to consume every pending note in the repository.
    const rule = flat(readTemplate('context/workflow.md'));
    assert.match(rule, /`\/feature-close --release` is what that asking looks like/i);
    assert.match(rule, /A flag typed in the turn it takes effect/i, 'it is not inferred from prose');
    const body = flat(skillBody('feature-close'));
    assert.match(body, /A sentence is not a flag/i, 'and the command says the same from its own side');
    assert.match(body, /the script its Bump wire names/i, 'it runs the answer, never a tool it knows');
    assert.match(body, /there is no Bump wire/i, 'and refuses where the answer is not written down');
    assert.match(body, /takes \*\*every\*\* pending note/i, 'the blast radius is shown before it runs');
    assert.match(body, /`--release` is refused in this mode/i, '--dropped has no note to release');
  });

  it('the sweep reads the note check, because that is the only channel an existing install has', () => {
    // The stub is project-owned and written once, and `stubGaps` reports a missing `##` heading and
    // nothing finer — so a rule added inside a section reaches new installs only. Step 9 is the one thing
    // that looks at a repository again after it was set up, which makes the sweep the channel for anything
    // found in the field. Exactly the shape of C16, which added the tags sweep for the same reason.
    const raw = skillBody('onboard');
    const step = flat(raw.slice(raw.indexOf('## Step 9 — Release'), raw.indexOf('## Step 10')));
    assert.match(step, /what it does on the release commit/i, 'the sweep asks the question at all');
    assert.match(step, /The finding is not the red square/i, 'and what it is actually looking for');
    assert.match(
      step,
      /a documented step that writes an empty note is this same finding, already paid for/i,
      'the tell is a workaround that has become a procedure, which is how it was found',
    );
    assert.match(step, /Do not rewire it\*\*, the same as step 4/i, 'it reports and changes no workflow');
    assert.match(step, /Say all six back in a line each/i, 'and it is counted with the others');
    assert.match(
      step,
      /plus what exempts the release commit from that check/i,
      'and the answer file carries it, which is what reaches the next reader',
    );
  });

  it('a wire names a mechanism that ran, because a file that reads correctly is only a claim', () => {
    // The third instance of one pattern, all three found in the field. C16: the file says tags are cut
    // and there are none. §11.12: the check asks a question that is wrong on one commit. This: the job
    // has never run. Here /onboard recorded a Tag wire as "cut by ci.yml's record job" while that file
    // could not load at all — every word of the description accurate, the mechanism dead. §11.2 guards
    // against naming a mechanism that is not on disk; this one is on disk, reads correctly, and is inert.
    //
    // It is structural rather than bad luck: the tool refuses to generate the release job, so that job is
    // always written by someone else and Step 9 reads it back as the source of truth.
    assert.match(flat(stub), /A wire names something that has run, or says that it has not/i);
    assert.match(flat(stub), /Written, never run\*+ is a real\s*answer/i, 'and the honest answer is named');

    const raw = skillBody('onboard');
    const step = flat(raw.slice(raw.indexOf('## Step 9 — Release'), raw.indexOf('## Step 10')));
    assert.match(step, /say whether it has ever run/i, 'asked of everything the sweep named');
    assert.match(step, /Never run is a real answer/i, 'and never-run is recorded rather than skipped');
    assert.match(
      step,
      /inert in its entirety, and reading it will not show you/i,
      'the case that is invisible from the tree',
    );
    assert.match(
      step,
      /failed run with no job inside to open/i,
      'named by its tell rather than by a forge, the way the tags sweep is',
    );
    assert.match(step, /verification gate\s*is probably down with it/i, 'and what it costs beyond this file');
  });

  it('--release says the level is final, because it deletes the gap that made it cheap', () => {
    // C3 put the bump confirmation where the notes leave the machine on the reasoning that a level is
    // free to correct right up to the release. The flag puts the release in the same breath, so the
    // reasoning survives and its conclusion does not — and the user has to be told that while being asked.
    const body = flat(skillBody('feature-close'));
    assert.match(body, /now final, and say so while asking it/i);
    assert.match(body, /deletes the gap it was relying on/i, 'it names what changed rather than restating');
    assert.match(
      body,
      /the change still is not shipped/i,
      'and a moved version in a branch is still not shipped — C13 is unweakened by the flag',
    );
  });
});

describe('a defect the gate found has one home, and it is the ledger', () => {
  // `findings.md` was a parallel status system for phases wearing a second vocabulary. `P0`–`P3` sat next
  // to `not started`/`in progress`/`blocked`/`done` and the two had to be kept in sync by discipline, which
  // is what produced a 76 KB file of defects nothing could close — large enough to come back truncated to
  // the very gate that was supposed to read it. The file is gone. A blocking defect is fixed, or it is the
  // `blocked` status the ledger already has a word for, or it is an issue. Everything here guards that one
  // vocabulary and that nothing re-grows a second place to record a defect.
  //
  // §14 qualifies the last clause and nothing above it: a *non-blocking* note has a file again, and what
  // makes it not the deleted one is that no gate reads it and no branch outlives it. The tests marked §14
  // below are that boundary.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const workflow = readTemplate('context/workflow.md');
  const OWNS_A_GATE = ['feature-implement', 'orchestrate'] as const;

  it('nothing the tool installs mentions the file, or ships it', () => {
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /findings\.md/, `${rel} still points at the deleted file`);
    }
    assert.equal(
      STUBS.find((s) => s.dest === 'context/findings.md'),
      undefined,
      'an install would still write it',
    );
  });

  it('nor asks a report for a count out of it', () => {
    // §12.5: this matched `findings.md` only, and two references survived four versions because neither
    // needed the path — `/feature-status` printed a `Findings:` row in its report block and
    // `/feature-implement` listed findings by id. A deletion test keyed on a path misses every reference
    // that never spelled one, so what has to be absent is a report asking for findings as a countable
    // store. A reviewer's *finding* is ordinary English and stays — it is the thing the ledger records.
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /^\s*Findings:/m, `${rel} still prints a findings count`);
      assert.doesNotMatch(text, /findings? (written|closed|open)/i, `${rel} still tracks findings`);
    }
  });

  it('the severity scale is gone, because it was the second vocabulary', () => {
    // The scale's only real question was "does this block the phase", which is one bit. Four values
    // invited a `P3` to be filed and kept, which is the drift — a note nothing acts on, read by every
    // later phase, against code that has moved.
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /\bP0\b|\bP[1-3]\b/, `${rel} still grades severity`);
    }
    assert.match(flat(workflow), /blocking or it is not/i, 'the one bit replaces it');
    assert.match(flat(workflow), /There is no severity scale/i, 'and the absence is stated');
  });

  it('one status vocabulary, and the ledger is the record', () => {
    assert.match(workflow, /^## What happens to a defect the gate found$/m);
    assert.match(flat(workflow), /no second status vocabulary/i);
    assert.match(flat(workflow), /because it is already the record/i, 'the ledger was always carrying this');
  });

  it('a blocking item has three ends and the run picks one before it reports', () => {
    // The third end was called "an issue" until §15, which is the ambiguity that let a defect and a
    // feature share a destination. It is `filed` now, and *A bug is not a backlog entry* says which.
    for (const end of [/\*\*fixed\*\*/, /\*\*`blocked`\*\*/, /\*\*filed\*\*/]) {
      assert.match(workflow, end, `the contract names ${String(end)}`);
    }
  });

  // §14 supersedes the shape these four guarded, not the reason for them. The old rule sent every
  // non-blocking observation that "needs code changes" to the backlog — a condition every true observation
  // about code meets — and the field ran it into 20 finding-issues in one repository against 0 in another
  // on the same install. The cheap end is a branch-local file again. What keeps it from being `findings.md`
  // is that it gates nothing and does not survive the branch, and that is what these assert.
  // `plan-template.notes.md` and a project's own `ops-notes.md` are different files; the lookbehind is what
  // keeps this keyed on the one that matters.
  const NOTES = /(?<![\w.-])notes\.md/;

  it('a non-blocking observation is split by kind, and both ends are named', () => {
    // §14.3: "unless it needs code changes" was not a bar. §12.4's test is — it is the one the hand triage
    // of 35 real defects actually used, and it had never been written into a template.
    const w = flat(workflow);
    assert.match(w, /kind decides which/i, 'the axis is named');
    assert.match(w, /user-visible,? or a regression would land green/i, 'and the promotion test is stated');
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /user-visible,? or a regression would land green/i, 'the gate applies it');
    assert.match(implement, NOTES, 'and the other end has somewhere to go');
  });

  it('nothing reads the file, which is what keeps §12.1 from recurring', () => {
    // The 76 KB file's real failure was never clutter: it came back truncated to the very gate that read
    // it, so the check was answering from a file it had not seen. A file nothing reads cannot fail so
    // quietly — and a `check` rule about it would be exactly that reader.
    assert.match(flat(workflow), /\*\*Nothing reads it\*\*/, 'the contract says so outright');
    const rules = readFileSync(path.join(packageRoot, 'src/check/rules.ts'), 'utf8');
    assert.doesNotMatch(rules, NOTES, 'check grew a rule that reads it');
    assert.equal(
      STUBS.find((s) => s.dest === 'context/notes.md'),
      undefined,
      'an install ships one, so every branch would edit a file held in common',
    );
  });

  it('the branch it belongs to is the whole of its bound', () => {
    // §12.2 built the scheduled sweep — three dispositions, a `check` rule for orphans, every acceptance
    // test passing — and it still bounded the tail while leaving the accumulation. The delete is
    // unconditional for that reason, and a triage at retirement is the cost being refused.
    const close = flat(skillBody('feature-close'));
    assert.match(close, /delete it — whole/i, 'the delete is whole');
    assert.match(close, /do not assign each line a disposition/i, 'and it is not a per-entry ceremony');
    assert.match(flat(workflow), /no triage, no dispositions, no sweep/i, 'the contract says the same');
    assert.match(close, /Glancing at it on the way past is fine; triaging it is not/i);
    assert.match(flat(workflow), /it does not survive one/i, 'and the contract names the bound');
  });

  it('a non-blocking observation still dies where there is no branch to bound it', () => {
    // `/orchestrate` has no branch and no close, so a file only it wrote is the one that outlives every
    // branch. It keeps the old rule exactly, and says why it departs from the new one.
    const body = flat(skillBody('orchestrate'));
    assert.match(body, /writes no `context\/notes\.md`/i, 'it names the departure');
    assert.match(body, /dies with the session/i, 'and keeps the end that needs no bound');
  });

  it('a defect against an already-done phase reopens that phase', () => {
    // The alternative is a record elsewhere saying "this phase is done and also broken", which is the
    // exact shape of the thing that was just deleted.
    assert.match(flat(workflow), /sets that phase back to `blocked`/i);
    assert.match(flat(workflow), /leave the row claiming `done`/i);
  });

  it('a capped gate writes the row before it escalates', () => {
    // The old rule wrote the finding before the loopback for this reason; the ledger row inherits it.
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /before you escalate/i);
    assert.match(implement, /Escalating is not a substitute for recording/i, 'the principle survives');
    assert.match(flat(workflow), /the row is written before the hand-back/i);
  });

  it('/orchestrate hands back instead, because it has no ledger to write to', () => {
    // The one place the deleted file did something nothing else did. The honest answer is that a
    // commit-sized change which cannot pass its gates is not a thing to file away.
    const body = flat(skillBody('orchestrate'));
    assert.match(body, /has no ledger/i);
    assert.match(body, /handed back, not filed away/i);
    assert.match(body, /still worth doing, it is a bug/i, 'and work is not lost on the way past');
  });

  it('/feature-close refuses once, because `done` already covers it', () => {
    // Two refusals where one would do: an open blocker meant its gate had not passed, which meant the row
    // was not `done`, which the ledger check already caught.
    const close = flat(skillBody('feature-close'));
    assert.match(close, /One check, not two/i);
    assert.match(close, /nothing left for a second refusal to catch/i);
  });

  it('update tells an install the file is no longer read, and never removes it', () => {
    // A project-owned file is outside the manifest by design, so the report is the whole of what the tool
    // may do about one.
    const src = readFileSync(path.join(packageRoot, 'src/stubs.ts'), 'utf8');
    assert.match(src, /export function retiredFiles/, 'the detector exists');
    assert.match(src, /project-owned and absent from the manifest/, 'and says why it only reports');
  });
});

describe('a bug is not a backlog entry', () => {
  // The backlog is a list of features. `/feature-implement` used to send every qualifying finding to it
  // "per tracking.md", and tracking.md says the backlog is the labelled issues — so a gate read the two
  // together and labelled real defects into the list you pick features from. One repository reached 14 of
  // them ranking against its actual roadmap. A defect is a third category the loop had no word for:
  // recorded, unlike a task, and not planned, unlike a feature.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const workflow = readTemplate('context/workflow.md');
  const GATES = ['feature-implement', 'orchestrate'] as const;

  it('the contract names the category and says where it goes', () => {
    assert.match(workflow, /^### A bug is not a backlog entry$/m);
    assert.match(flat(workflow), /wherever this project already files bugs/i);
    assert.match(flat(workflow), /third category the loop had no word for/i);
  });

  it('a gate never applies the backlog label', () => {
    // The label is what /roadmap writes, and that command applies the worth-adopting test first. A gate
    // that labels an issue itself appends to the backlog while skipping the only test that decides whether
    // it belongs there — and writes an entry missing the Priority the ranking reads.
    assert.match(flat(workflow), /\*\*A gate never applies the backlog label\.\*\*/);
    for (const name of GATES) {
      assert.match(
        flat(skillBody(name)),
        /not apply the backlog label|Never the backlog label/i,
        `${name} must refuse to label`,
      );
    }
  });

  it('a finding that really is a feature is handed to /roadmap, not appended', () => {
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /adding\s+one is `\/roadmap`'s/i, 'it names the owner of the backlog');
    assert.match(implement, /do not append to the backlog from here/i);
  });

  it('/orchestrate takes an issue, so a bug has a route through the gates', () => {
    // Without it the tracker and the work never touch: you retype the issue as a sentence and close it by
    // hand afterwards. A task-sized defect has no backlog entry and never will, so this is its only path.
    const body = skillBody('orchestrate');
    assert.match(body, /\/orchestrate #<issue>/, 'the form is in the usage block');
    assert.match(flat(body), /Refuse an issue that carries the backlog label/i, 'a feature is not its work');
    assert.match(flat(body), /Closes #<issue>/, 'and the commit is what closes it');
    assert.match(
      flat(body),
      /Never close the issue by hand as a separate act/i,
      'a close that does not ride the change can outrun it',
    );
  });

  it('nothing enters the backlog except through /roadmap', () => {
    // Three commands write the label and only one of them admits new work. /tracking-migrate relocates a
    // backlog that already exists and /feature-plan subdivides one entry already in it — so the
    // worth-adopting test is still applied exactly once per entry, by /roadmap, at the only moment anyone
    // is deciding whether to have it. Any fourth writer would be a way in that skips that decision.
    const MAY_WRITE_THE_LABEL = new Set(['roadmap', 'tracking-migrate', 'feature-plan']);
    assert.match(flat(workflow), /Nothing enters the backlog except through `\/roadmap`/);

    // Reading the label is every command's business — "the open issues carrying the backlog label" is how
    // half of them find the backlog at all. Only writing it is restricted, so this looks for a sentence
    // that both names the label and applies one, and lets it stand only if it is a refusal.
    const APPLIES = /\b(apply|applies|applying|add|adds|adding)\b/i;
    const REFUSES = /\b(never|not|no|refuse|refuses)\b/i;
    for (const name of SKILL_NAMES) {
      if (MAY_WRITE_THE_LABEL.has(name)) continue;
      for (const sentence of flat(skillBody(name)).split(/(?<=[.:])\s+/)) {
        if (!/backlog label/i.test(sentence) || !APPLIES.test(sentence)) continue;
        assert.match(
          sentence,
          REFUSES,
          `${name} applies the backlog label, and only /roadmap admits new work: "${sentence}"`,
        );
      }
    }
  });

  it('the tracker answer says how a change closes an issue, and the skills do not', () => {
    // Same rule as every other forge detail: tracking.md is the only file that spells one.
    assert.match(readTemplate('stubs/tracking.md'), /how a change closes one/i);
    assert.match(flat(readTemplate('stubs/tracking.md')), /A bug is not a backlog entry/i);
  });
});

describe('a surface with no gate is asked for, not noticed', () => {
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const workflow = readTemplate('context/workflow.md');

  // The conditional table in `standards/README.md` is keyed on *if the task involves…*. Most rows answer
  // themselves; accessibility, performance and security do not — they are properties of the change that
  // the reader has to have thought of first, so the row that says accessibility is part of the definition
  // of done is reached only by somebody who had already agreed.
  it('the rule lives in workflow.md, beside the one it is modelled on', () => {
    assert.match(workflow, /^### The standards table is keyed on a question nothing asks$/m);
    // `flat` keeps the blockquote markers, so assert on phrases that do not straddle a wrapped line.
    assert.match(flat(workflow), /Write the answer down/);
    assert.match(flat(workflow), /saying nothing is not/);
    // Its sibling can no longer claim to be the only ungated output, now that there is a second rule.
    assert.doesNotMatch(flat(workflow), /Documentation is the one output with no gate behind it/);
  });

  it('the planning and ad-hoc paths cite it rather than restating it', () => {
    // Two independently-worded copies of one rule is the drift the standing-rules section exists to stop.
    for (const name of ['feature-plan', 'orchestrate']) {
      const body = flat(skillBody(name));
      assert.match(body, /surface question/i, `${name} asks it`);
      assert.match(body, /hot path/i, `${name} names the middle one`);
      assert.match(body, /trust boundary/i, `${name} names the last one`);
      assert.match(body, /standing rule in \[`context\/workflow\.md`\]/, `${name} cites the rule`);
    }
  });

  it('a surface that was found is proved somewhere, or it is an open question', () => {
    // A standard named in a phase's review expectations and nowhere checkable is a rule nobody runs.
    const plan = flat(skillBody('feature-plan'));
    assert.match(plan, /§8 Verification with what proves each surface/);
    assert.match(plan, /end-to-end pass in a real browser/);
    assert.match(plan, /say so in §9 rather\s*than inventing one/);
    assert.match(flat(readTemplate('context/plan-template.notes.md')), /end-to-end pass in a real browser/);
  });

  it('nothing shipped names a browser driver', () => {
    // §4.2 generalised: which tool drives a browser is `verify.md`'s answer, and a winner hardcoded into a
    // template is one more stack assumption baked into a tool that installs everywhere.
    const DRIVERS = /\b(playwright|cypress|puppeteer|selenium|webdriver|lighthouse|percy|chromatic)\b/i;
    for (const { rel, text } of ourTemplates()) {
      const hit = DRIVERS.exec(text);
      assert.equal(hit, null, `${rel} names a browser driver: ${hit?.[0] ?? ''}`);
    }
  });
});

describe('Gate 1 reads a list, not four headings', () => {
  const flat = (text: string) => text.replace(/\s+/g, ' ');

  // The four are what every project has, not the whole of what one checks. A project with a fast
  // accessibility suite and nowhere to record it is a project where the gate reports green for a change
  // that broke it — and exiling it to *Not run by Gate 1* is the same outcome with a heading on it.
  it('every place that names the order says where the list ends', () => {
    const named = [
      ['context/workflow.md', readTemplate('context/workflow.md')],
      ['feature-implement', skillBody('feature-implement')],
      ['orchestrate', skillBody('orchestrate')],
    ] as const;
    for (const [rel, text] of named) {
      assert.match(flat(text), /every section above \*?Not run by Gate\s*1\*?/i, `${rel} bounds the list`);
      assert.match(flat(text), /Lint → Typecheck → Build → Test/, `${rel} still leads with the four`);
    }
  });

  it('the stub says a heading of your own is run like any other', () => {
    const verify = flat(readTemplate('stubs/verify.md'));
    assert.match(verify, /The four headings are not a limit/);
    assert.match(verify, /whether this gate can afford it on every phase/);
  });

  it('/onboard asks for what the four do not cover, and sorts by cost', () => {
    const onboard = flat(skillBody('onboard'));
    assert.match(onboard, /Ask what else this project runs to prove a change is good/);
    assert.match(onboard, /Ask specifically about the end-to-end one wherever this project has a user interface/);
    assert.match(onboard, /sort each one by whether Gate 1 can afford it/i);
    // The section is a record of a check that exists and runs elsewhere — without the name it reads as a
    // check nobody runs, which is a different and much worse fact.
    assert.match(onboard, /\*\*Name what does run each one\*\*/);
  });
});

describe('what a feature waits on is a relationship, not a sentence', () => {
  // §10.14: the order between two features is the one fact the working-tree answer has nowhere to keep —
  // there it is read out of `history.md` after the blocker ships. The tracker has a native relationship
  // for it, so under that answer the backlog can say what is unavailable and why before either feature
  // starts. Two properties keep it from becoming §10.10's sub-issues all over again: it is set between
  // features and never phases, and it has exactly one home, so no body line or comment restates it.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const tracking = flat(readTemplate('stubs/tracking.md'));

  it('the primitive and its vocabulary live in tracking.md, like the label and the type', () => {
    assert.match(tracking, /which features have to land before this one \| the issue's \*\*blocked by\*\*/);
    assert.match(tracking, /\*\*Never a body line and never a comment\.\*\*/);
    assert.match(tracking, /\*\*Between features only\.\*\*/, 'a phase is a row, never an object with edges');
    // The skills say what they need in the tracker's words; the forge test above keeps the how in here.
    assert.match(tracking, /gh issue edit --add-blocked-by/, 'the one file that may name the forge, does');
  });

  it('/roadmap records the order the user named, and invents none', () => {
    const roadmap = flat(skillBody('roadmap'));
    assert.match(roadmap, /The order between entries, where the idea names one/);
    assert.match(roadmap, /\*\*Do not go looking for one\.\*\*/);
    // A wrong relationship is not a cosmetic error: a blocked entry drops out of what gets offered next.
    assert.match(roadmap, /hides work and nobody is told why/);
    assert.match(roadmap, /\*\*Leave its relationships exactly as they are\*\*/, 'adoption rewrites nothing');
  });

  it('/feature-plan reads it before the ranking and writes it after the research', () => {
    const plan = flat(skillBody('feature-plan'));
    assert.match(plan, /\*\*An issue with an open blocker is not a candidate\.\*\*/);
    assert.match(plan, /which open issues have to land before this one\?/);
    // Planning is not activation, so a blocked entry is still plannable when the user names it.
    assert.match(plan, /A named entry is planned even when it is blocked/);
  });

  it('the split records its own dependency edges rather than describing them', () => {
    const plan = flat(skillBody('feature-plan'));
    assert.match(plan, /The order between the chunks is a relationship, not a sentence/);
    // 0.16.0's split wrote "a line naming the chunk it depends on" into each new body, which is the
    // second home tracking.md now refuses. The line is gone; the relationship replaces it.
    assert.doesNotMatch(plan, /a line naming the chunk it depends on/);
  });

  it('a blocker is a stop where work starts, and nothing clears one on the way out', () => {
    assert.match(flat(skillBody('feature-implement')), /\*\*Step 2 stops on one\.\*\*/);
    // A dropped blocker satisfies the relationship without doing the work, and only the close says so.
    assert.match(flat(skillBody('feature-close')), /\*\*For `--dropped` it is not\.\*\*/);
    assert.match(flat(skillBody('feature-close')), /\*\*leave the relationship alone\*\*/);
    // The migration has nothing to carry: no tree file records an order between two features.
    assert.match(flat(skillBody('tracking-migrate')), /an order between two features \| nothing in the tree/);
  });

  it('/feature-status reports what is waiting and writes nothing', () => {
    const status = flat(skillBody('feature-status'));
    assert.match(status, /What the backlog is waiting on/);
    assert.match(status, /\*\*Waiting is not a discrepancy\.\*\*/);
    // The two states that are: work under way on ground that has not landed, and a backlog that cannot move.
    assert.match(status, /\*\*An assigned issue with an open blocker\.\*\*/);
    assert.match(status, /\*\*A cycle\*\*/);
  });
});
