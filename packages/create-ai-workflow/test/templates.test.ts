import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  CLAUDE_ONLY_KEYS,
  CLAUDE_SKILL_SETTINGS,
  claudeSkillTransform,
  SKILL_NAMES,
  STUBS,
  agentsBlockBody,
  readTemplate,
} from '../src/layout.ts';
import { parseHistory, parseLedgers, parseRoadmap } from '../src/check/parse.ts';
import { stripComments } from '../src/check/markdown.ts';
import { sections } from '../src/stubs.ts';
import { exists, packageRoot, templatesDir, walk } from '../src/paths.ts';

/** The shared body alone — frontmatter and the working-tree procedure. */
const skillMain = (name: string) => readTemplate(`skills/${name}/SKILL.md`);

/**
 * Everything a skill can put in front of an agent: the body, plus every supporting file beside it. Those
 * are read conditionally — `tracker.md` only where `tracking.md` names the tracker, `split.md` only where
 * a plan came out over its budget — so a given invocation loads a subset. An invariant about what a
 * command *says* has to hold across all of them, which is what this concatenation is for.
 *
 * It is a directory walk rather than a list for the same reason `skillFiles` is: a list went one file
 * stale the first time a skill grew a second supporting file.
 */
const skillBody = (name: string) => {
  const dir = path.join(templatesDir, 'skills', name);
  return walk(dir)
    .filter((rel) => rel.endsWith('.md'))
    .sort((a, b) => (a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b)))
    .map((rel) => readFileSync(path.join(dir, rel), 'utf8'))
    .join('\n');
};

/**
 * The workflow's own prose. `standards/` is excluded: it names tools and stacks by design, which these
 * rules forbid everywhere else.
 */
function ourTemplates(): { rel: string; text: string }[] {
  return walk(templatesDir)
    .filter((rel) => !rel.split(path.sep).includes('standards'))
    .filter((rel) => rel.endsWith('.md'))
    .map((rel) => ({ rel, text: readFileSync(path.join(templatesDir, rel), 'utf8') }));
}

describe('skill frontmatter', () => {
  it('every skill declares its own name and a narrow, explicit-invocation description', () => {
    for (const name of SKILL_NAMES) {
      const text = skillMain(name);
      assert.match(text, new RegExp(`^name: ${name}$`, 'm'), `${name} declares its name`);
      assert.match(text, /^description: /m, `${name} has a description`);
      assert.match(text, /Explicit invocation only/, `${name} says so in prose`);
      assert.match(text, /Do NOT match on/, `${name} names what it must not match`);
    }
  });

  it('the Claude copy differs from the shared body by its frontmatter lines only', () => {
    // Three keys, all Claude Code's: the switch that keeps a skill from auto-firing, and the model and
    // effort the command's own orchestration runs on. Nothing below the frontmatter may differ.
    for (const name of SKILL_NAMES) {
      const body = skillMain(name);
      const claude = claudeSkillTransform(body);
      const added = claude.split('\n').filter((line) => !body.split('\n').includes(line));
      const settings = CLAUDE_SKILL_SETTINGS[name];
      assert.deepEqual(added, [
        'disable-model-invocation: true',
        `model: ${settings.model}`,
        `effort: ${settings.effort}`,
      ]);
    }
  });

  it('every skill has a model and an effort, as aliases rather than dated ids', () => {
    // An alias resolves to whatever the account has; a dated id is a line to update when models turn over,
    // in a file `update` replaces and a person never opens.
    for (const name of SKILL_NAMES) {
      const { model, effort } = CLAUDE_SKILL_SETTINGS[name];
      assert.match(model, /^[a-z]+$/, `${name} pins an alias, not an id (${model})`);
      assert.ok(['low', 'medium', 'high', 'xhigh', 'max'].includes(effort), `${name} effort ${effort}`);
    }
  });

  it('the transform is idempotent', () => {
    const once = claudeSkillTransform(skillMain('roadmap'));
    assert.equal(claudeSkillTransform(once), once);
  });

  it('the shared body carries no adapter-only frontmatter', () => {
    for (const name of SKILL_NAMES) {
      const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skillMain(name))?.[1] ?? '';
      for (const key of CLAUDE_ONLY_KEYS) {
        assert.doesNotMatch(frontmatter, new RegExp(`^${key}:`, 'm'), `${name} carries ${key}`);
      }
    }
  });
});

describe('the tracker answer is read only where it applies', () => {
  // Five commands carry a second procedure for the issue-tracker answer. In the body it was a third to two
  // thirds of what every invocation read, on the working-tree answer as much as the other — so it lives in
  // a file beside the body, which the body names and the agent opens only where tracking.md says to.
  const SPLIT = ['roadmap', 'feature-plan', 'feature-implement', 'feature-status', 'feature-close'];

  it('the five that have one keep it beside the body, and the body points at it', () => {
    for (const name of SPLIT) {
      const tracker = path.join(templatesDir, 'skills', name, 'tracker.md');
      assert.ok(exists(tracker), `${name} ships a tracker.md`);
      assert.match(readFileSync(tracker, 'utf8'), /^## Under the tracker answer$/m);
      assert.doesNotMatch(skillMain(name), /^## Under the tracker answer$/m, `${name}'s body no longer holds it`);
      assert.match(skillMain(name), /\[`tracker\.md`\]\(tracker\.md\)/, `${name}'s body names the file`);
      assert.match(
        skillMain(name).replace(/\s+/g, ' '),
        /where that file names the tracker/i,
        `${name} says when to read it`,
      );
    }
  });

  it('the four that have none ship none', () => {
    for (const name of SKILL_NAMES.filter((n) => !SPLIT.includes(n))) {
      assert.ok(!exists(path.join(templatesDir, 'skills', name, 'tracker.md')), `${name} has no tracker half`);
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

describe('a plan has a size budget, and overflow is a scope signal', () => {
  // An issue body has a hard ceiling. The tempting reading is that the ceiling is a defect of the tracker
  // answer to be worked around; the design's reading is the opposite — a plan that overflows a body is a
  // feature that is several features, and the tracker was simply the first thing to say so. §10.16 gives
  // the working-tree answer the same check, because the field measurement says the plans that answer
  // actually produces have a median of 49 KB and six of twenty-three were over the body limit, with
  // nothing in the tree ever mentioning it.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const plan = flat(skillBody('feature-plan'));
  const migrate = flat(skillBody('tracking-migrate'));
  const tracking = readTemplate('stubs/tracking.md');

  it('the numbers have one home, and it is the stub that holds every tracking answer', () => {
    // Same rule as the forge command and the issue type: a skill asks for the fact, `tracking.md` answers
    // it. A limit written into a skill is one no project could change.
    assert.match(tracking, /\*\*Plan size ceiling:\*\* 65,536 characters/, 'the ceiling is a field');
    assert.match(tracking, /\*\*Ledger reserve:\*\* 500 characters per phase row/, 'so is the reserve');
    for (const name of SKILL_NAMES) {
      assert.doesNotMatch(skillBody(name), /65,?536/, `${name} hardcodes the ceiling`);
      assert.doesNotMatch(skillBody(name), /\b500 characters\b/, `${name} hardcodes the reserve`);
    }
    for (const name of ['feature-plan', 'feature-implement', 'tracking-migrate']) {
      assert.match(
        flat(skillBody(name)),
        /How much a plan may hold/,
        `${name} asks for the fact by section name rather than knowing it`,
      );
    }
  });

  it('the budget is a `##` section, so an install without it is told', () => {
    // It has to survive /onboard deleting `### Under the tracker answer` on a tree install, which a `##`
    // does by construction. And it has to be *reported*: `tracking.md` is project-owned, so `update`
    // cannot add the section to an existing install, and `stubGaps` compares `##` headings only. A `###`
    // here would have been silent in exactly the installs that need to hear it.
    assert.ok(
      sections(tracking).some((heading) => /^How much a plan may hold$/.test(heading)),
      'stubGaps compares this heading',
    );
    assert.ok(
      tracking.indexOf('## How much a plan may hold') > tracking.indexOf('### Under the tracker answer'),
      'and it sits outside the subsection /onboard deletes',
    );
    assert.match(flat(skillBody('onboard')), /How much a plan may hold/, '/onboard is what fills it');
  });

  it('a missing section is named rather than guessed around', () => {
    // The same rule this workflow applies to a path release.md does not cover: name the gap, do not
    // invent policy mid-run, and do not refuse the work over it either.
    assert.match(plan, /name the gap, do not invent a\s*number/i);
    assert.match(plan, /`check` carries its own fallback/i, 'and the check still reports in that install');
  });

  it('the same number holds under both answers, so a plan is portable', () => {
    // A tree threshold above the body limit would let a repository build plans that adopting a tracker
    // then refuses — which turns /tracking-migrate's refusal into a trap rather than a backstop.
    assert.match(flat(tracking), /The number is the same under both answers, and that is deliberate/);
    assert.match(flat(migrate), /A repository that has been measuring never reaches this refusal/);
  });

  it('/feature-plan measures before it writes, under both answers', () => {
    // Under the tracker answer the body is a single write, so a failed one is the worst possible place to
    // discover the plan was too big. In the tree there is no failed write at all — the plan just lands,
    // which is why that answer needed the check stated rather than inherited.
    assert.match(plan, /Do this before the write, not after one fails/i, 'the check precedes the write');
    assert.match(plan, /does it fit with room for the rows still to be written/i, 'the reserve is the point');
    assert.match(plan, /Say the measurement in the report either way/i, 'a silent check is not trusted');
    assert.match(
      flat(skillMain('feature-plan')),
      /it is measured under both tracking answers/i,
      "the body says so, not just the tracker half",
    );
  });

  it('the split proposal is a supporting file, read only when the measurement fires', () => {
    // §17.2's rule, applied again: prose that only some invocations need does not ride every invocation.
    // Every /feature-plan run measures; almost none of them split.
    const split = path.join(templatesDir, 'skills', 'feature-plan', 'split.md');
    assert.ok(exists(split), 'it lives beside the body');
    assert.match(skillMain('feature-plan'), /\[`split\.md`\]\(split\.md\)/, 'the body names the file');
    assert.match(
      flat(skillMain('feature-plan')),
      /only when the measurement|Over the budget/i,
      'and says when to read it',
    );
    assert.doesNotMatch(skillMain('feature-plan'), /Three ways out are refused/, 'the argument is not in the body');
  });

  it('/feature-plan splits the feature rather than shrinking the plan', () => {
    assert.match(plan, /The only honest response is to split the feature/i);
    for (const escape of [
      /Trimming the plan until it fits/i,
      /Continuing the plan into a second document/i,
      /Linking out to a gist or a paste/i,
    ]) {
      assert.match(plan, escape, `the escape ${String(escape)} is named and refused`);
    }
    assert.match(plan, /## Propose, then ask/, "a scope decision is the user's, not the command's");
    assert.match(plan, /The phase list is already the seam/i, 'and the plan proposes its own split');
    assert.match(plan, /write nothing until the user answers/i);
  });

  it('the split keeps the entry and opens no hierarchy', () => {
    // §10.10 removed the one-object-per-phase design. A split that produced a parent would put the phase
    // ordering back into a second home by another route.
    assert.match(plan, /keeps the first chunk/i, 'the entry is reused, so a thread survives');
    assert.match(plan, /No parent entry/i, 'and nothing hierarchical replaces it');
    assert.doesNotMatch(plan, /sub-issue/i);
  });

  it('/tracking-migrate refuses rather than guessing at a split', () => {
    // A migration that split a feature would be making a scope decision on the way past, which is the
    // same thing its ledger-disagreement refusal already declines to do.
    assert.match(migrate, /A plan too large for an issue body/i, 'it is in the refusal list');
    assert.match(migrate, /Never shorten a plan to make it fit/i, 'the standing rule matches the refusal');
  });

  it('/feature-implement never drops a ledger row to make space', () => {
    // The row is the phase's only home. Every other thing in the body can be recovered from somewhere;
    // a status that was never written is gone.
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /shorten your own Note until the row fits/i);
    assert.match(implement, /Never drop a row/i);
  });

  it('check reports an oversized plan as a note, and a note fails nothing', () => {
    // The one rule in `check` that is not structural breakage: the document is well-formed and every
    // answer it gives is right. So it may not fail the check, and it may not propose the split either —
    // that is /feature-plan's, and `check` stays the thing you can delete without changing an answer.
    const rules = readFileSync(path.join(packageRoot, 'src/check/rules.ts'), 'utf8');
    assert.match(rules, /level: 'note'/, 'the budget rule is the note level');
    assert.match(rules, /Run \/feature-plan to split it/, 'it names the command and proposes nothing');
    assert.match(flat(tracking), /`check` reports a plan over the line as a \*\*note\*\*/, 'the stub says so');
    assert.match(flat(tracking), /a note does not fail the check/i);
  });
});

describe('the ledger Note is one line', () => {
  // Measured across 23 plans in four installs on 2026-10-16: 142 ledger rows, a median Note of 440
  // characters and a longest of 6,714 — a phase log in a table cell that nothing wraps. 113 of the 142
  // were over 200 characters. The column has no visible bound, which is why the rule has to be written.
  const flat = (text: string) => text.replace(/\s+/g, ' ');

  it('the rule lives in the ledger that travels with every plan', () => {
    // plan-template.md §6.1 is the one home: the ledger goes into a plan document under one answer and
    // into an issue body under the other, and the rule goes with it either way.
    const template = flat(readTemplate('context/plan-template.md'));
    assert.match(template, /\*\*The Note is one line/, 'the template states it');
    assert.match(template, /understand or resume the Status beside it/, 'and says what the line is for');
  });

  it('the detail has somewhere to go, and the rule says where', () => {
    // A rule that only forbids produces a session that drops the measurement rather than relocating it.
    for (const text of [flat(readTemplate('context/plan-template.md')), flat(skillBody('feature-implement'))]) {
      assert.match(text, /measurements|test counts/i, 'it names what does not belong in the Note');
      assert.match(text, /commit message/i, 'and the commit message as one home');
      assert.match(text, /report/i, 'and the run report as the other');
    }
  });

  it('/feature-implement cites the rule rather than restating it', () => {
    // §2.5: two independently-worded copies of one rule is the drift this design exists to prevent. The
    // skill carries the one sentence that is its own — where the gate output goes instead.
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /\*\*The Note is one line\*\*, per §6\.1 of the plan itself/, 'it cites the home');
    assert.match(implement, /Gate 1's output, the test counts and the measurements do not go in it/);
  });

  it('the opening write is bound by the same rule as the closing one', () => {
    // §2.8's two writes. The opening Note is the one a resuming session reads, so it is the one most
    // likely to be written as a narrative of what is about to happen.
    assert.match(flat(skillMain('feature-implement')), /\*\*One line\*\*, by the same rule step 11 applies/);
  });

  it('the reserve is sized against the one-line rule, and says so', () => {
    // If the Note is not one line the reserve is wrong, and the failure shows up as a body at its limit
    // three phases from the end. Naming the dependency is what makes that diagnosable.
    assert.match(
      flat(skillBody('feature-implement')),
      /a Note stopped being one line/,
      'the tracker half names the dependency',
    );
    assert.match(
      flat(readTemplate('context/tracking.notes.md')),
      /one sha and a one-line Note per row/,
      'and the notes file says what the reserve was sized from',
    );
  });
});

describe('a brief carries the phase, not the plan', () => {
  // §17.1's reading budget never counted the plan, and three readers open one on every phase. The field
  // measurement puts the median plan at 49 KB — 62% on top of the whole 78 KB budget, per reader, per
  // phase. The phase's own §6.2 section is a median 24% of the document.
  const flat = (text: string) => text.replace(/\s+/g, ' ');

  it('every phase carries the decisions that govern it, as the Standards line already did', () => {
    // §17.3 made the plan the one traversal of the standards table. §3 is the same shape of problem one
    // section over: a constraint that lives only there either rides a whole-plan read or gets re-decided.
    const template = readTemplate('context/plan-template.md');
    const phases = template.split('#### Phase').slice(1);
    assert.ok(phases.length >= 2, 'the template ships more than one phase section');
    for (const phase of phases) {
      assert.match(phase, /\*\*Standards:\*\*/, 'the standards line is there');
      assert.match(phase, /\*\*Decisions:\*\*/, 'and so is the decisions line');
    }
  });

  it('both dispatch briefs name the section rather than the document', () => {
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /it names the phase rather than the plan/i, 'the coder brief');
    assert.match(implement, /\*\*The section, not the plan\*\*/, 'the reviewer brief');
    assert.match(implement, /A whole-plan read is the fallback, not the route/i, 'and the fallback is named');
  });

  it('a plan written before the lines existed still works', () => {
    // The same fallback §17.3 wrote for the Standards line. A rule that bricks existing plans is one
    // nobody can adopt.
    assert.match(
      flat(skillBody('feature-implement')),
      /A plan written before phases carried these lines has neither/i,
      'the skill names the fallback',
    );
    assert.match(flat(readTemplate('context/roles/coder.md')), /Where the brief has no such line, read §3/);
  });

  it('the roles read the lines and treat the decisions as settled', () => {
    const coder = flat(readTemplate('context/roles/coder.md'));
    assert.match(coder, /\*\*That section is the brief, not the whole plan\.\*\*/);
    assert.match(coder, /\*\*They are settled\.\*\*/, 'a decision is not the coder\'s to re-open');
    const reviewer = flat(readFileSync(path.join(templatesDir, 'claude/agents/reviewer.agent.md'), 'utf8'));
    assert.match(reviewer, /whether the implementation honoured it — not whether it was right/);
  });

  it('the planner writes both lines and is told the budget it is drafting into', () => {
    const planner = flat(readFileSync(path.join(templatesDir, 'claude/agents/planner.agent.md'), 'utf8'));
    assert.match(planner, /\*\*Every phase also carries a `Decisions:` line\*\*/);
    assert.match(planner, /\*\*Keep the plan within its budget\.\*\*/);
    assert.match(planner, /more than one feature's worth/, 'and can say so itself');
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
    assert.match(workflow, /\*\*`--all` repeats the pick above\*\*/, 'the phase-status rules account for it');
    const readme = readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
    assert.match(readme, /\/feature-implement \[--all\]/, "the package README's diagram carries it");
  });
});

describe('a round is formed by the command, and nothing types a flag for it', () => {
  // §26 measured it before building it: 115 phases across 18 archived plans could have run in 107 rounds
  // rather than 115 — 8 rounds saved, in 6 of the 18 — once a round is required to hold phases that share
  // no file. That is too little to be worth a flag a user has to learn and remember, so the command
  // decides each round by itself. Which removes the permission argument a typed flag would have carried
  // (§18.2) and replaces it with a written exception in `workflow.md`, so every rule below has to be in
  // prose somewhere `update` reaches, and the refusals §26 designed are fallbacks instead.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const parallel = flat(readTemplate('skills/feature-implement/parallel.md'));
  const skill = skillMain('feature-implement');
  const executors = readTemplate('stubs/executors.md');

  it('no flag asks for it, and none turns it on', () => {
    const usage = skill.slice(skill.indexOf('## Usage'), skill.indexOf('## 1.'));
    assert.doesNotMatch(usage, /--parallel|--round|--wide|--jobs/, 'the usage block gains no flag');
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /--parallel\b/, `${rel} types a flag for it`);
    }
    assert.match(parallel, /There is no flag/i, 'the contract says so');
    assert.match(flat(skill), /No flag asks for this and none turns it on/i, 'and so does the step that decides');
  });

  it('it is opened on a condition, like the other halves beside a body', () => {
    // The `tracker.md` and `split.md` shape, per §24.9. A round forms in a minority of plans, so a run
    // that cannot form one does not pay for the contract that describes it.
    assert.ok(exists(path.join(templatesDir, 'skills', 'feature-implement', 'parallel.md')));
    assert.match(skill, /\[`parallel\.md`\]\(parallel\.md\)/, 'the body names the file');
    assert.match(flat(skill), /Where that is true, read \[`parallel\.md`\]/, 'and says when to open it');
    assert.match(parallel, /A round of one phase with nothing left behind is an ordinary run and reads none of this/i);

    // It has a second reader, and without it the keep rule below is prose nobody opens: a kept tree is
    // landed by the run that *resumes* its phase, and that run forms a round of one.
    assert.match(parallel, /where step 4 found a row whose Note names a tree a previous round left/);
    assert.match(flat(skill), /\*\*If the Note names a tree, this phase's work is already in it\*\*/);
    assert.match(flat(skill), /land that tree before briefing anybody/);
  });

  it('a phase joins a round only when nothing it depends on is unfinished, and nothing is part-done', () => {
    // Step 3's own test, unweakened: a round is a wider pick, never a different one.
    assert.match(parallel, /\*\*Runnable\*\* is step 3's test and nothing weaker/);
    assert.match(parallel, /not `done`, every `Depends on` `done`/);
    // And one narrower than step 3's, which a round needs and a single phase does not: an `in progress`
    // or `blocked` phase has half-work and a Note in the feature's own tree, and a scratch tree branched
    // from HEAD does not have them. That phase is step 3's resume, which runs alone.
    assert.match(parallel, /\*\*A round holds `not started` phases only\.\*\*/);
    assert.match(parallel, /\*\*A resumed phase runs alone\*\*/);
    assert.match(flat(skill), /Where this phase and another runnable one are both `not started`/);
  });

  it('sharing any path keeps a phase out, prose counts, and a path that contains another is one', () => {
    // `Depends on` orders information, not files: of the 26 multi-phase rounds in the corpus, 12 shared a
    // code path and 11 shared only prose. Allowing the prose ones would have bought 11 rounds and paid in
    // guaranteed conflicts in `verify.md` and `README.md` — the files that say what the commands are.
    assert.match(
      parallel,
      /\*\*Shares no path\*\* is read off the phases' \*\*Files:\*\* lines, and \*\*a path that contains another is an overlap\*\*/,
    );
    // Compared whole, `src/` and `src/a.ts` are two strings and the round forms. They are one place, and
    // the two coders find out by both editing it.
    assert.match(parallel, /a directory or a glob on one line and a file under it on another are the same place/);
    // The plan is the one path two phases may both name: this command is its only writer, and the field
    // writes it onto a phase's own `Files:` line — `SUN-CALENDAR-FEED`'s phases 6 and 9 both do.
    assert.match(parallel, /\*\*The plan's own path is the one exclusion\*\*/);
    assert.match(parallel, /\*\*Prose counts\*\* otherwise — a `\.md` file, a README, anything under `context\/`/);
    assert.match(flat(skill), /share \*\*no path\*\* on their \*\*Files:\*\* lines, prose included/);
  });

  it('the round is said out loud, with the test that left each phase out', () => {
    assert.match(parallel, /\*\*Say the round before any coder starts\.\*\*/);
    assert.match(parallel, /an overlap, \*\*naming the path\*\*, or the cap/);
  });

  it('the cap lives in executors.md, defaults to 3, and 1 turns it off', () => {
    // §4.3's reason for that file: the number is a fact about this machine and this account — the usage
    // limit three agents at once runs into — not something an invocation should re-type.
    assert.match(parallel, /\*\*3 where\s*that file says nothing, and 1 turns this off\.\*\*/);
    assert.match(executors, /At most 3 phases of one plan run at once/);
    assert.match(executors, /\*\*1 turns that off\*\*/);
    const coder = executors.slice(executors.indexOf('## Coder'), executors.indexOf('## Reviewer'));
    assert.match(coder, /At most 3 phases/, 'it is the Coder answer that carries it');
    assert.match(readTemplate('context/executors.notes.md'), /concurrency number is separate/i, 'documented');
  });

  it('it counts coders, because the gates are serial', () => {
    assert.match(parallel, /It counts coders, which is all there is to count/);
    assert.match(
      parallel,
      /\*\*Both gates run in the feature's own tree, one phase at a time, in phase order\*\*/,
      'the gates do not move into the scratch trees',
    );
    assert.match(parallel, /Nothing runs the verification stack in two trees at once/);
    assert.match(parallel, /two loops per gate, per phase/, 'the loopback cap is unchanged');
  });

  it('nothing refuses — every line falls back to one phase at a time, once, with its reason', () => {
    assert.match(parallel, /\*\*Nothing here refuses\.\*\*/);
    assert.match(
      parallel,
      /\*\*says so once, before the first phase\*\*, naming the file and the answer that decided it/,
    );
    for (const [what, re] of [
      ['the user commits', /\*Who commits\* — \*\*the user commits\*\*/],
      ['no coder but the host', /\*Coder\* — not configured, or in-host/],
      ['a host that cannot run two at once', /the host cannot run two coders at once/],
      ['no fresh-tree answer', /has no \*\*Prepare a fresh tree\*\* answer/],
      ['the cap is 1', /the cap is \*\*1\*\* \| the project said one at a time/],
      ['the tree cannot be made', /`git worktree add` fails, for any reason/],
      // §26.20: the host's own write rules are a limit no answer file records. A coder asked to approve
      // every file it writes is not running unattended, and one sealed into a tree its host chose cannot
      // be pointed at this command's. Both are fallbacks, named, not refusals.
      [
        'the host will not let a coder write there',
        /the host will not let a coder write in the tree this command can make, or confines it to one of the host's own/,
      ],
    ] as const) {
      assert.match(parallel, re, `${what} falls back rather than refusing`);
    }
    assert.match(parallel, /\*\*say which of the two it was\*\*, the recorded answer or the runtime/);
    // And *where work lands* is not one of them. §26.4 had a row for the main working tree with the
    // default branch checked out; it came from `/orchestrate --pr`, which pushes. A round commits, which
    // an ordinary phase on that branch already does under that answer — and 13 of the 18 measured plans
    // live in a repository shaped exactly that way, so the row turned the feature off where it is wanted.
    assert.doesNotMatch(parallel, /default branch checked out/, 'a round commits; it never pushes');
    assert.doesNotMatch(parallel, /\*Where work lands\*/, 'that answer decides nothing here');
  });

  it('the scratch tree is plain git, detached, inside the working tree, and ignored', () => {
    // The user's own line: these are scratch space, not workspaces, and they are not wanted in the tools
    // that manage one. The *location* is §26.22's correction — the repository's admin directory is the
    // one place a host is most likely to refuse, and under `git.md`'s worktree answer it is not even
    // inside the session's own directory.
    assert.match(parallel, /git worktree add --detach "\.phase-trees\/<PLAN>-phase-<n>" HEAD/);
    assert.match(parallel, /\*\*No branch is created\*\*/);
    assert.match(parallel, /the invocation \[`executors\.md`\].*names is not used/);
    assert.match(parallel, /\*\*Inside this working tree\*\*/);
    assert.match(parallel, /\*\*The path is fixed\*\*/, 'the location is the identity');
    assert.match(parallel, /\*\*recorded absolute\*\*/, 'a Note is read from another directory');
    assert.doesNotMatch(parallel, /--git-dir/, 'nothing is asked to write under the admin directory');

    // §26.25. The first version of this test asserted that a dotted path is invisible to a glob, which
    // is true of two glob libraries and false of the tools the field actually runs: Biome 2.5.15 lints
    // under a dotted directory unless the folder is git-ignored *and* it is configured to read that
    // file, and Vitest 5's default include runs tests there. So the ignore entry is the property, the
    // dot is not, and no claim here stands in for running this project's own commands.
    assert.match(parallel, /\*\*And ignored, which is what keeps Gate 1 honest\.\*\*/);
    assert.match(parallel, /The leading dot is not enough/, 'the claim that was wrong is named');
    assert.match(parallel, /lints the other phases' half-written work/);
    assert.match(parallel, /`\/onboard` \*\*proves\*\* that against this project's own Gate 1 commands/);
    assert.doesNotMatch(parallel, /does not descend into a path segment/, 'that claim is gone');
    // Which also retires the staging rule: an ignored tree is absent from `status` and from `git add -A`.
    assert.doesNotMatch(parallel, /never `git add -A`/, 'the ignore entry does that job');
    assert.match(parallel, /keeps a tree out of `git status` and out of `git add -A`/);
  });

  it('a round will not form while the phase trees are not ignored, and /onboard proves they are', () => {
    // The cheap half runs every round; the half that needs this project's own tools runs once, in the
    // command that already runs them all. Verified on git 2.56.0: `check-ignore` answers before the
    // directory exists, which is when a round asks — but only with the trailing slash, because a
    // directory-only pattern cannot match a path git cannot see is a directory.
    assert.match(parallel, /`git check-ignore -q \.phase-trees\/` exits non-zero, run at the top of the working tree/);
    assert.match(parallel, /\*\*Keep the trailing slash\*\*/);
    const onboard = flat(skillBody('onboard'));
    assert.match(onboard, /\*\*Then put the phase trees out of Gate 1's way, and prove they are\.\*\*/);
    assert.match(onboard, /\*\*Write `\.phase-trees\/` into this project's `\.gitignore`\*\* at the repository root/);
    assert.match(onboard, /Not `\.git\/info\/exclude`/, 'per-clone, and inside a directory a host may refuse');
    assert.match(onboard, /one the lint command must reject, and one test that must fail/);
    assert.match(onboard, /\*\*None of them may see either file\.\*\*/);
    assert.match(onboard, /\*\*Say which tool and which setting\*\*/);
    // And the way out is the switch that already exists, rather than a second answer for one fact.
    assert.match(onboard, /\*\*Where it cannot be fixed, set the cap to 1\*\*/);
    assert.match(onboard, /\*\*Remove the planted files\*\*/);
    // Named by shape, never by tool: §4.2 keeps every real command in `verify.md`.
    for (const { rel, text } of ourTemplates()) {
      assert.doesNotMatch(text, /\b(biome|vitest|eslint|jest|prettier)\b/i, `${rel} names a tool`);
    }
  });

  it('a runtime that can isolate a coder itself is described, never named, and has to pass three tests', () => {
    // §4.3 again, and the same rule the coder and reviewer answers follow: what it does, not what it is.
    assert.match(parallel, /Where the runtime can give a coder its own temporary tree of this repository/);
    assert.match(parallel, /one whose commits are objects in this repository/);
    assert.match(parallel, /A copy or a fresh clone is not that/);
    // The first test is the one a real runtime fails: an isolation worktree is commonly cut from the
    // default branch, which is a tree with none of the feature's work in it rather than an isolated one.
    assert.match(parallel, /`git -C <tree> rev-parse HEAD` is \*\*the sha this round recorded\*\*/);
    assert.match(parallel, /\*\*something removes it when the phase lands\*\*/);
    assert.match(parallel, /Any of the three failing is a fallback like the rest/);
    // And what is different about it is reported rather than swept: it has a branch, so the removal rule
    // below does not cover it, and removing it leaves a ref this workflow never deletes.
    assert.match(parallel, /\*\*It is not this command's tree, so it is reported rather than swept\.\*\*/);
    assert.match(parallel, /\*\*nothing here deletes a ref\*\*/);
    assert.match(parallel, /reads a branch on a worktree as a feature in flight/);
  });

  it('the plan has one writer, and the coder is told the copy beside it is stale', () => {
    assert.match(parallel, /\*\*Only this command writes the ledger, and only in the feature's own tree\.\*\*/);
    assert.match(parallel, /Coders never touch the plan/);
    assert.match(parallel, /\*\*The round's rows open in one write\*\*, before any tree is made/);
    assert.match(parallel, /the plan here is a stale copy and is not to be edited/);
    // Which leaves step 7's §9 rule with no hands: it says the phase answers the open question it
    // settled, and in a round the phase is a coder that may not write the file. So the coder reports and
    // the one writer writes, in the commit that carries the row — the rule keeps its reader.
    assert.match(parallel, /\*\*An open question this phase settles is still answered in the plan's §9\*\*/);
    assert.match(parallel, /\*\*The coder reports what its phase settled and this command writes the answer\*\*/);
    assert.match(parallel, /\*\*A closing row names the tip its work was at\*\*/);
    assert.doesNotMatch(
      readTemplate('context/roles/coder.md'),
      /cherry-pick|worktree|scratch (tree|checkout)|round/i,
      'committing is a property of this dispatch, not of the role',
    );
  });

  it('a coder in a round is told the others are running, and what that costs', () => {
    // Coders in a round run at the same time, so anything binding a fixed port collides — the field case
    // is a Playwright config on port 47321 with `reuseExistingServer: false`. Gate 1 runs one phase at a
    // time in the feature's own tree, so that is where such a test belongs; what the coder owes is to say
    // which assertions it did not run, or the gap is invisible.
    assert.match(parallel, /\*\*The brief is step 7's, plus four sentences and no more:\*\*/);
    assert.match(parallel, /other coders are running beside you and this tree is a fresh checkout/);
    // And the third thing a fresh checkout does not have, beside a free port and a running server: a
    // secret. `.env` is untracked by definition, so `git worktree add` leaves it behind — a test that
    // needs one fails in the tree for a reason that is nothing to do with the phase.
    assert.match(parallel, /a test that needs a server, a fixed port, or a secret the tree does not hold/);
    assert.match(parallel, /nothing kept out of git came across into it/);
    assert.match(parallel, /say in your output which assertions you did not run/);
    // And the same collision reaches the one command the orchestrator runs per tree.
    assert.match(parallel, /\*\*If it fails in a tree, the round does not run\*\*/);
    assert.match(parallel, /a command there may bind a port the tree beside it holds/);
  });

  it('what lands is the whole tree as a range, and the row rides it', () => {
    // How many commits a coder makes in its own tree is its own business, so the phase is `<base>..<tip>`
    // and not the tip. Verified on git 2.56.0: `git cherry-pick -n <base>..<tip>` applies every commit in
    // the range, stages all of it, commits nothing and leaves no sequencer state — so one commit still
    // carries the phase's change and its ledger row, which is `git.md`'s *one commit per phase*.
    assert.match(parallel, /Per phase, in phase order:/);
    assert.match(parallel, /`git cherry-pick -n <base>\.\.<tip>` — \*\*the whole tree, however many commits are in it\*\*/);
    assert.match(parallel, /\*\*The range, not the tip\.\*\*/);
    assert.match(parallel, /Landing the tip alone would drop work silently/);
    assert.match(parallel, /\*\*One commit\*\*, carrying the phase's change and its row/);
    assert.match(parallel, /A merge would add a commit per phase that no granularity answer names/);
    // The base is read when the tree is made, because the feature branch moves as the round lands.
    assert.match(parallel, /\*\*Record the sha `HEAD` resolved to\.\*\* It is this tree's base/);
    assert.match(parallel, /the base cannot be read back afterwards/);
  });

  it('an unfinished scratch tree lands nothing and is treated as a coder that stopped short', () => {
    // Uncommitted work in a scratch tree is not a candidate to land: there is nothing to cherry-pick, and
    // a phase whose coder stopped short is step 11's *some landed* row, not a landing.
    assert.match(parallel, /\*\*Check the coder finished\.\*\* `git -C <tree> status --porcelain` is empty/);
    assert.match(parallel, /\*\*nothing from that phase lands\*\*/);
    assert.match(parallel, /its row stays `in progress` naming what remains, per step 11, and its tree is kept/);
    assert.match(parallel, /Uncommitted work in a scratch tree is not a candidate to land/);
  });

  it('a real diff overlap lands the earlier phase and sends the later one back to run alone', () => {
    // A `Files:` line is a prediction and the field says it grows — `CUTOVER`'s phase 6 went from three
    // paths to eleven, by the phase itself. So the test that formed the round runs again on the facts.
    assert.match(parallel, /\*\*Check the real diff\.\*\* `git diff --name-only <base>\.\.<tip>`/);
    assert.match(parallel, /\*\*The earlier phase stands\.\*\*/);
    assert.match(parallel, /\*\*The later phase's work is thrown away\.\*\*/);
    assert.match(parallel, /\*\*Run that phase again, one at a time, on the combined tree\*\*/);
    assert.match(parallel, /at most once per phase per round/, 'the re-run cannot loop');
    // And the Note has to let go of the tree, or §26.20's resume rule lands the one tree whose work was
    // deliberately discarded — the same bug as the sweep's, with the sign flipped.
    assert.match(parallel, /\*\*Its Note stops naming its tree\.\*\*/);
    assert.match(parallel, /this is the one tree whose work must not be landed/);
    assert.match(parallel, /never merged — nothing here has the standing to decide/, 'no conflict is resolved');
    // And it is checked one command earlier than the conflict. Verified on git 2.56.0: a range that
    // conflicts stops part-applied with the sequencer open — recoverable, unlike a single sha, which
    // leaves no cherry-pick in progress at all. Either way the way out is a choice between two coders'
    // versions of a file, which is the decision this rule exists to never make.
    assert.match(parallel, /\*\*The check is before the cherry-pick, not after\.\*\*/);
    assert.match(parallel, /A range that conflicts stops part-applied with the sequencer open/);
  });

  it('a phase that blocks ends the landing, and every later tree is kept for the next run', () => {
    // §26.20: *does not hold the others back* was true of the phases that landed **before** it and false
    // of the ones after. Landing is in phase order on one tree, and the loopback moved into that tree —
    // so a blocked phase leaves its half-work there, and carrying on cherry-picks the next phase onto it
    // and gates it against it. Every failure from then on belongs to a phase that did not cause it.
    assert.match(parallel, /\*\*A phase that ends `blocked` ends this round's landing\.\*\*/);
    assert.match(parallel, /\*\*Every later tree is kept\*\*/);
    assert.match(parallel, /would cherry-pick \*k\*\+1 onto \*k\*'s half-work and gate it there/);
    assert.match(parallel, /\*\*A phase that closed `blocked` ends the landing here\*\*/, 'in the steps too');
    // The Note carries the tip beside the path, because the path is what a sweep destroys.
    assert.match(parallel, /\*\*A blocked phase's Note names the tree its work is in, and the tip it is at\.\*\*/);
    assert.match(parallel, /`git merge-base <branch> <tip>` recovers the base/);
    assert.match(parallel, /\*\*The next round does not start\*\*/);
    assert.match(parallel, /each phase is reported as it lands/);
  });

  it('removal is of this command’s own trees only, and never forced', () => {
    // `workflow.md` says nothing removes a worktree *under any answer, any flag or any command*. This is
    // the one exception and it is written where that sentence is, per §4.7: an implicit scope reads as a
    // grant. Verified on git 2.56.0: without `--force`, removal refuses a tree holding modified or
    // untracked files and succeeds where the only leftovers are ignored — so it cannot destroy work a
    // coder failed to commit.
    assert.match(parallel, /\*\*Only a tree this command made, at the path above, detached and with no branch\*\*/);
    assert.match(parallel, /never with\s*`--force`/);
    assert.match(parallel, /`git worktree remove <path>`, never `--force`/);
    assert.match(parallel, /refuses a tree holding\s*modified or untracked files/);
    assert.match(parallel, /A refusal is reported, not forced/);
  });

  it('a tree with a branch on it is never touched, and the sweep is by location', () => {
    assert.match(
      parallel,
      /`git worktree list --porcelain` prints `branch` for every worktree the recorded invocation has ever made and `detached` for these/,
    );
    assert.match(parallel, /A tree with a branch on it is never touched/);
    // §26.20's first finding, and the one that destroyed work: *removing what it finds there by the same
    // test* was the removal test, which is about the tree's shape. A tree whose phase did not land is
    // kept — and a coder that did its job committed, so that tree is clean, so removal succeeds and the
    // commit it held becomes unreachable while the Note still names the path. The test is the row.
    assert.match(parallel, /\*\*A tree goes when its phase's row reads `done`\*\*/);
    assert.match(parallel, /\*\*otherwise kept, with its path and its tip in the report\.\*\*/);
    assert.match(
      parallel,
      /\*\*A later run sweeps that directory first, and removes only a tree whose row reads `done`\.\*\* \*\*Read the ledger before the sweep\.\*\*/,
    );
    assert.match(parallel, /A clean tree is not an abandoned one/);
    assert.match(parallel, /\*\*A tree whose path names another plan is left alone\*\*/);
  });

  it('the exception is written where the absolute rule is, in a file `update` reaches', () => {
    // A stub cannot carry it: `update` never writes one, so an existing install would keep an absolute
    // rule while the command had an exception to it. That is the §23.3 argument about one home and its
    // readers, applied to a rule that just grew a carve-out.
    const workflow = readTemplate('context/workflow.md');
    assert.match(workflow, /removes a worktree under any answer, any\s*flag or any command/);
    assert.match(workflow, /The one exception is not a worktree in that sense/);
    assert.match(workflow, /\*\*detached, branchless checkout in `\.phase-trees\/`\*\*/);
    assert.match(workflow, /removes it\s*when its row reads `done`/);
    assert.match(workflow, /Not by the recorded invocation, and no other command makes or removes one/);
    // And the always-loaded block's standing rule names both homes, or it contradicts the exception.
    assert.match(agentsBlockBody(), /`context\/git\.md`\]\(context\/git\.md\) or/);
    assert.match(agentsBlockBody(), /\[`context\/workflow\.md`\]\(context\/workflow\.md\) says so/);
  });

  it('a gate failure loops back in the feature’s own tree, and nothing is reset', () => {
    // The design reset the staged cherry-pick and re-briefed the coder in its scratch tree, which needed
    // an exception to `git.md`'s *discarding someone's work* list. It needs neither: the cherry-pick is
    // already staged in the feature's own tree, which is the state step 10 re-briefs a coder in on any
    // ordinary phase — and that tree holds the phases that landed earlier in the round, which the scratch
    // tree does not, so a failure the combination caused cannot be seen from there at all.
    assert.match(parallel, /\*\*A gate failure loops back in the feature's own tree\*\* — never in the scratch tree/);
    assert.match(parallel, /\*\*nothing is reset\.\*\*/);
    assert.match(parallel, /the state step 10 re-briefs a coder in on any ordinary phase/);
    assert.match(parallel, /missing the phases that landed earlier in the round/);
    assert.doesNotMatch(parallel, /reset --hard|comes off with a reset/, 'no reset, so no exception for one');
    assert.doesNotMatch(parallel, /uncommitted work has no second copy/i, 'that list is untouched');
  });

  it('a prepared tree has to come back clean, or the round does not run', () => {
    // *Prepare a fresh tree* runs before any coder, so a step that rewrites a lockfile or writes a
    // generated file nobody ignores dirties the tree before the phase has started — and from there the
    // phase's own state is unreadable: landing reads a clean phase as a coder that stopped short, and the
    // overlap check sees a path every phase in the round touched. Verified on git 2.56.0:
    // `status --porcelain` is empty when the only leftovers are ignored, ` M` for a rewritten lockfile,
    // `??` for a generated file that is not ignored.
    assert.match(parallel, /\*\*Then the tree has to be clean: `git -C <tree> status --porcelain` prints nothing\.\*\*/);
    assert.match(parallel, /\*\*before the phase started\*\*/);
    assert.match(parallel, /landing reads a clean phase as a coder that stopped short/);
    assert.match(parallel, /\*\*name the files it changed\*\*/);
    assert.match(parallel, /`--porcelain` does not list ignored files/, 'an installed dependency is not dirt');

    // The two answers that keep it clean belong where that section is filled in, not here.
    const notes = flat(readTemplate('context/verify.notes.md'));
    assert.match(notes, /\*\*These commands have to leave the tree clean\*\*/);
    // Named by its shape and not by a package manager: §4.2 keeps every real command in `verify.md`, and
    // three of the four violations in the reference repo named a tool the project did not have.
    assert.match(notes, /\*\*Use the install form that reads the lockfile rather than rewriting it\*\*/);
    assert.match(notes, /usually a `--frozen-lockfile` or `--immutable` flag/);
    assert.match(notes, /\*\*gitignore anything a step here generates\*\*/);

    // And `/onboard` proves the answer it writes, in a clone — which is not a worktree, because nothing
    // in this workflow makes one of those but `/feature-implement`'s own scratch checkout.
    const onboard = flat(skillBody('onboard'));
    assert.match(onboard, /Verify \*Prepare a fresh tree\* in a tree that is actually fresh/);
    assert.match(onboard, /`git clone --no-hardlinks \. <tmp>`\. \*\*That is not a worktree\*\*/);
    assert.match(onboard, /`git -C <tmp> status --porcelain` must print nothing/);
    assert.match(onboard, /\*\*A dirty tree is a wrong answer, not something to work around:\*\*/);
    assert.match(onboard, /no commit yet there is nothing to clone/, 'and it says so rather than guessing');
  });

  it('the report names which phases ran side by side, and every fallback', () => {
    assert.match(parallel, /\*\*Which phases ran side by side\*\*, and which ran alone/);
    assert.match(parallel, /\*\*Every fallback, with the file and the answer that caused it\*\* — once, not per phase/);
    assert.match(parallel, /\*\*Every tree still on disk, by path\*\*, and the sha of anything thrown away/);
  });

  it('a detached tree is nobody’s claim, so the status sweep skips it', () => {
    // `/feature-status` reads `git worktree list` and treats a tree as a feature in flight. A scratch
    // checkout is a checkout of this repository, roadmap and all, so without this it would be reported as
    // a second feature — and the sweep would read a stale ledger out of it.
    const status = flat(skillMain('feature-status'));
    assert.match(status, /\*\*Skip the ones with no branch\.\*\*/);
    assert.match(status, /a tree with no branch is nobody's claim/);
    assert.match(status, /read nothing out of it, and remove nothing/);
  });

  it('verify.md carries the fresh-tree answer, below the line Gate 1 stops at', () => {
    // The field already wrote this fact as prose with no reader: all three live `verify.md` files say what
    // a fresh checkout needs, and one of them says it in so many words — *in a new worktree this is not
    // optional and not shared*. A coder in a scratch tree cannot run §23's failing assertion without it.
    const verify = readTemplate('stubs/verify.md');
    const names = sections(verify);
    assert.ok(names.includes('Prepare a fresh tree'), 'it is a `##` section, so `update` reports the gap');
    assert.ok(
      names.indexOf('Prepare a fresh tree') > names.indexOf('Not run by Gate 1'),
      'below that line, so Gate 1 never runs it on an ordinary phase',
    );
    assert.match(verify, /\*\*Gate 1 does not run it\*\*/);
    assert.match(flat(verify), /\*\*Empty is an answer with a cost\.\*\*/);
    assert.match(flat(verify), /falls back to one phase at a time and names this section as the reason/);
    assert.match(readTemplate('context/verify.notes.md'), /^## Prepare a fresh tree$/m, 'the notes mirror it');
    assert.match(flat(skillBody('onboard')), /goes in \*Prepare a fresh tree\*/, '/onboard asks for it');
  });

  it('the round reaches the tracker answer too', () => {
    // The opening write batches and the closing ones do not, which is not a symmetry worth having: under
    // this answer the row does not travel inside the commit, so a run that dies two phases into a round
    // would leave two commits recorded nowhere but git. One more write window costs less than that.
    const tracker = flat(readTemplate('skills/feature-implement/tracker.md'));
    assert.match(tracker, /\*\*The round's rows open in one body write\.\*\*/);
    assert.match(tracker, /\*\*They close one write per phase, as it lands\.\*\*/);
    assert.match(tracker, /recorded nowhere but git/);
    // And a sha that resolves: the scratch commit has no branch and stops existing with its tree.
    assert.match(tracker, /\*\*The sha in a closing row is the commit on the feature branch\*\*/);
    assert.match(tracker, /\*\*The heartbeat names every phase in the round\*\*/);
  });
});

describe('--pr ends the run at a pull request without becoming policy', () => {
  // `/orchestrate` refused to push at all, because `git.md`'s push answer is written about a feature and an
  // ad-hoc change has none. The flag is legitimate on the other source of permission that file names — the
  // user asking in this session, in plain words — and a typed flag is that ask. So the invariant worth
  // guarding is the boundary: it buys this invocation's commit, push and pull request, it creates no
  // worktree, it branches off nothing by itself, it lifts no refusal, and it does not merge.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const body = skillBody('orchestrate');
  const start = body.indexOf('## 7. `--pr`');
  const pr = flat(body.slice(start, body.indexOf('## 8. Report')));

  it('the flag is in the usage block and has a section of its own', () => {
    assert.ok(start > 0, 'the flag has a section of its own');
    const usage = body.slice(body.indexOf('## Usage'), body.indexOf('## 1.'));
    assert.match(usage, /\/orchestrate --pr "<what to do>"/, 'the prose form is shown');
    assert.match(usage, /\/orchestrate --pr #<issue>/, 'and the issue form, since a bug is why this exists');
    assert.match(skillMain('orchestrate'), /^description: .*--pr/m, 'the description carries it, like --all');
  });

  it('the flag is the permission, and it rewrites no answer', () => {
    // The failure this prevents is the flag being implemented as "set git.md to the agent commits": that
    // would authorise every later invocation, which is the opposite of asking by name.
    assert.match(pr, /the permission, not a new `git\.md` answer/i);
    assert.match(pr, /in this session in plain words/i, 'it names the source it rests on');
    assert.match(pr, /What it authorises is \*\*this invocation\*\*/, 'and the scope of what it bought');
    assert.match(pr, /nothing here is written into `git\.md`/i, 'no answer file is edited');
  });

  it('it cannot invent a branch, and never a worktree', () => {
    assert.match(pr, /HEAD is not the default branch/, 'the case the flag is built for');
    assert.match(pr, /stop before the commit/i, 'and the case it refuses');
    assert.match(pr, /asked for by name each time/i, 'pushing the default branch is still that');
    assert.match(pr, /executors\.md/, 'a branch comes from the recorded command or not at all');
    assert.match(pr, /improvise `git checkout -b`/, 'an empty section is not a licence to improvise');
    assert.match(pr, /makes a worktree rather than a branch\*\* → stop/i, 'the worktree case stops');
    // Step 6's existing refusal has to survive the flag, not be softened by it.
    assert.match(flat(body), /the flag does not change it\*\* — step 7 pushes a branch and creates no tree/);
  });

  it('nothing reaches a pull request that would not have been handed back', () => {
    for (const [what, re] of [
      ['a scope step 1 refused', /step 1 refuses the scope/i],
      ['a gate that did not come back clean', /Gate 1 does not come back clean/i],
      ['a push that is not a fast-forward', /will not fast-forward/i],
    ] as const) {
      assert.match(pr, re, `${what} must stop before the push`);
    }
    assert.match(pr, /Nothing is committed and nothing is pushed/i, 'the handback stays a handback');
    assert.match(pr, /not where unfinished work goes to be verified/i, "the PR's purpose is stated");
    assert.match(pr, /lifts no refusal/i, 'and the flag widens nothing');
  });

  it('nothing merges, and nothing stays alive watching a check run', () => {
    // The flag that was asked for alongside this one was --automerge. `git.md` reserves merging in one
    // line, and an agent polling CI is a half-finished run in the one command that keeps no resumable
    // record. Both refusals are in the skill so neither has to be re-argued.
    assert.match(pr, /\*\*Nothing merges it\.\*\*/, 'stated as flatly as /feature-close states it');
    assert.match(pr, /Not on green CI/i, 'the green-CI reading is named and refused');
    assert.match(pr, /review and merge are yours/i, "and git.md's line is quoted");
    assert.match(pr, /does not delete a branch, enable the forge's own auto-merge, or stay alive/i);
    assert.match(flat(body), /Nothing merges, and nothing waits for CI/, 'the Rules list carries it too');
  });

  it('the release-note ask survives the flag', () => {
    // --pr names where the run ends, not that nobody is reading. The bump level is a judgment that
    // release.md has confirmed before the note is written, and a flag that silently asserted it would be
    // the one place this command guesses at a version.
    assert.match(pr, /release-note ask still happens/i);
    assert.match(pr, /names where the run ends, not that nobody is reading/i);
  });

  it('every document that shows the command shows the flag', () => {
    // Same rule as --all: the tables are where a reader learns the command exists, and a flag missing from
    // them is a flag nobody types.
    assert.match(readTemplate('context/workflow.md'), /`\/orchestrate \[--pr\]`/, 'the tier table carries it');
    assert.match(
      readTemplate('context/workflow.md'),
      /A typed flag or a typed command is that ask/,
      'and the git rules do — both shapes of it, since /release is the second',
    );
    assert.match(agentsBlockBody(), /`--pr` ends it at a pull request/, 'the always-loaded block carries it');
    const readme = readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
    assert.match(readme, /With `--pr` the run ends at a pull request/, "the package README's table carries it");
  });

  it('every push outside a feature is accounted for where the push answer is summarised', () => {
    // workflow.md said a push happens once per feature, at /feature-close. That sentence became false the
    // moment this flag shipped, and an answer file may not hold a false answer. /release made it false a
    // second time, in the same sentence — which is the reason this assertion counts rather than quotes.
    const workflow = flat(readTemplate('context/workflow.md'));
    assert.match(
      workflow,
      /the only pushes outside them are the two asked for by name: `\/orchestrate --pr`, and `\/release`/,
    );
    assert.match(
      workflow,
      /under any answer, any flag or any command/,
      'and the merge refusal covers the flag and the command alike',
    );
  });
});

describe('/release is the one command that consumes notes, and the order is what makes it safe', () => {
  // release.md has always named the ship event as *the merge of the release pull request*, and nothing in
  // the workflow created one: `/feature-close --release` fuses the release into a feature's own merge, which
  // is a different shape rather than that one. The invariants here are about the *order*, because the script
  // the Bump wire names cannot be run twice — so a gate run after it, on a default branch that turns out to
  // be red, leaves a tree whose notes are gone and whose release cannot be cut again.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const body = skillBody('release');
  const at = (heading: string) => {
    const i = body.indexOf(heading);
    assert.ok(i > 0, `${heading} exists`);
    return i;
  };
  const slice = (from: string, to: string) => flat(body.slice(at(from), at(to)));

  it('the irreversible step runs last, after the gate and after the branch exists', () => {
    // The three orderings, each load-bearing and each stated in the skill with its reason: Gate 1 before
    // anything is consumed, the confirmation before anything is created, and the branch before the script.
    assert.ok(
      at('## 2. Gate 1, before anything is consumed') < at('## 4. Make the branch, then run the Bump wire'),
      'Gate 1 precedes the Bump wire',
    );
    assert.ok(
      at('## 3. Show what it will consume') < at('## 4. Make the branch, then run the Bump wire'),
      'and so does the confirmation',
    );
    const gate = slice('## 2. Gate 1', '## 3. Show what it will consume');
    assert.match(gate, /cannot be run twice/i, 'the reason the gate is second');
    assert.match(gate, /the one unrecoverable state in this design/i, 'and what it is protecting against');
    assert.match(gate, /Nothing created, nothing consumed, nothing to undo/i, 'a red gate costs nothing');
    const bump = slice('## 4. Make the branch', '## 5. Read the diff');
    assert.match(bump, /The branch exists before the notes are consumed/i, 'the second ordering');
    assert.match(bump, /exactly once/i, 'and the script runs once');
    assert.match(bump, /If it fails part-way, stop/i, 'a half-consumed set is never re-run');
  });

  it('there is no Gate 2, and the skill says why rather than omitting it', () => {
    // A reviewer dispatched to read a generated changelog is theatre, and a command that simply left Gate 2
    // out would read as an oversight next to every other command that lands anything.
    const gate = slice('## 2. Gate 1', '## 3. Show what it will consume');
    assert.match(gate, /There is no Gate 2, and that is deliberate/i);
    assert.match(gate, /the review this change needs is a \*\*person's, on the pull request\*\*/i);
  });

  it('it runs the wire the answer names and knows no tool', () => {
    // §11.7, applied to the one command whose whole purpose is running the mechanism. The sibling test
    // above already forbids naming a vendor anywhere in templates/; this is the positive half.
    const all = flat(body);
    assert.match(all, /release\.md/, 'it reads the answer');
    assert.match(all, /\*Bump\* wire/, 'and the wire by name');
    assert.match(all, /No \*Bump\* wire in \[`context\/release\.md`\]/i, 'refusing where it is empty');
    assert.match(all, /Name no release tool/i, 'and it says so in the words the other commands use');
  });

  it('every refusal ends the run before anything is created or consumed', () => {
    const refuse = slice('## 1. Refuse, before anything else', '## 2. Gate 1');
    assert.match(refuse, /Nothing is created and nothing is run until all five pass/i);
    for (const [what, re] of [
      ['no wire', /No \*Bump\* wire/],
      ['nothing records notes', /answer is \*nothing\*/],
      ['no pending notes', /No notes are pending/],
      ['no branch command', /No invocation under \*Branch and worktree\*/],
      ['the wrong ref, or a dirty tree', /HEAD is not the default branch, or the working tree is not clean/],
    ] as const) {
      assert.match(refuse, re, `${what} is a refusal`);
    }
    // The over-eager refusal worth naming: a feature in flight is not this release's business, and an agent
    // that refused on it would make the command unusable in exactly the repositories it is written for.
    assert.match(refuse, /A feature in flight is not a reason to refuse/i);
    assert.match(refuse, /the notes on this ref are exactly the changes on this ref/i, 'and why');
  });

  it('it never improvises the branch, and a separate tree is welcome here only because it is said to be', () => {
    // /orchestrate --pr refuses a worktree outright. This command does not, and the difference has to be
    // written down in both places or the next reader resolves it by picking one.
    const all = flat(body);
    assert.match(all, /Never run a bare `git checkout -b`, `git branch` or `git worktree add`/i);
    assert.match(all, /executors\.md/, 'the invocation has one home');
    assert.match(all, /A separate working tree is welcome here/i, 'the departure is explicit');
    assert.match(
      all,
      /`\/orchestrate --pr` refuses one because an ad-hoc change has no feature/i,
      'and it names what it is departing from',
    );
    assert.match(
      flat(readTemplate('context/workflow.md')),
      /`\/release` is the one command that may make one for something that is not a feature/i,
      'and the standing rule accounts for it, so the two do not disagree',
    );
  });

  it('the confirmation shows the whole blast radius and says the level is now final', () => {
    // C3 put the bump confirmation where the note is written because a level is cheap until the release.
    // This command *is* the release, so it is the place that gap actually closes — and the stub's own
    // paragraph had to say so too, or the file would describe a gap that no longer exists.
    const confirm = slice('## 3. Show what it will consume', '## 4. Make the branch');
    assert.match(confirm, /List \*\*every pending note\.\*\*/, 'every one, not just this session\'s');
    assert.match(confirm, /notes other people wrote/i, 'including work nobody here shipped');
    assert.match(confirm, /Every level is now final, and say so while asking/i);
    assert.match(confirm, /This command is that release/i, 'and it names why the gap is gone');
    assert.match(
      flat(readTemplate('stubs/release.md')),
      /`\/release` is where that gap finally closes, and it says so while asking/i,
      'the answer file no longer describes a gap that outlives the command',
    );
  });

  it('it writes no note, because it has nothing of its own to announce', () => {
    // The inverse of every other command's obligation. A release commit carrying a note would be a release
    // describing itself, and it is also the exact shape of the placeholder §11.12 forbids.
    const all = flat(body);
    assert.match(all, /Never write a release note here/i);
    assert.match(all, /a release commit carrying a note is a release describing itself/i);
    assert.match(all, /Do not write a note to silence it/i, 'and the red check is not fixed with one');
    assert.match(all, /the check is asking the wrong question/i, "§11.12's conclusion, at the point it bites");
  });

  it('nothing merges, nothing waits for CI, and nothing is removed', () => {
    const all = flat(body);
    assert.match(all, /### Nothing merges it/, 'stated as flatly as /orchestrate --pr states it');
    assert.match(all, /review and merge are yours/i, "and git.md's line is quoted");
    assert.match(all, /stay alive watching a check run/i, 'no polling, same as --pr');
    assert.match(all, /It removes nothing either/i, 'and the tree it made outlives it');
    assert.match(all, /Nothing merges, nothing waits for CI, and nothing is removed/, 'the Rules carry it');
  });

  it('a moved version is not a shipped change, and the report has to say so', () => {
    // C13, and the one claim this command is most likely to overstate: it has just run the thing that
    // publishes in most people's heads, and it has not published anything.
    const report = slice('## 7. Report', '## Rules');
    assert.match(report, /Never report this as released, published, deployed or live/i);
    assert.match(report, /a version moved in a branch, and that is all that has happened/i);
    assert.match(report, /Say what this is waiting for/i);
    assert.match(report, /never inferred/i, 'and what the merge ships is read, not guessed');
  });

  it('the typed command is the permission, and it rewrites no answer', () => {
    // Same source /orchestrate --pr rests on, and the same failure to avoid: implementing this as "set
    // git.md to the agent commits" would authorise every later invocation.
    const all = flat(body);
    assert.match(all, /The typed command is the permission, not a new answer/i);
    assert.match(all, /What it authorises is \*\*this invocation\*\*/);
    assert.match(all, /nothing here is written into \[`context\/git\.md`\]/i);
    assert.match(all, /A sentence is not a command/i, 'and prose is not the ask');
  });

  it('every document that shows the command set shows it', () => {
    // Same rule as --all and --pr: the tables are where a reader learns a command exists.
    const workflow = readTemplate('context/workflow.md');
    assert.match(workflow, /\| `\/release` \| the one act that consumes notes \|/, 'the command table');
    assert.match(flat(workflow), /`\/release` — cut the accumulated notes into a release pull request/, 'the tier table');
    assert.match(agentsBlockBody(), /`\/release`/, 'the always-loaded block');
    const readme = readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
    assert.match(readme, /\| `\/release` \| consumes every note waiting on the default branch/, "the package README");
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
    // Raised by one in §26: the standing rule names two permission homes rather than one, because the
    // scratch checkout a round runs in is authorised by `workflow.md` and not by `git.md`. A second
    // pointer is still a pointer — what this guards is the block growing a copy of what it points at.
    const lines = agentsBlockBody().split('\n').length;
    assert.ok(lines - SKILL_NAMES.length < 33, `the block is not a second copy of the rules (${lines})`);
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
  // The stub holds the answers; what each section takes, the alternative answers and the mechanism's
  // settings are in the notes beside it, read by /onboard when it fills the stub. An invariant about what
  // the answer file *says* is asserted on the stub; one about what it *teaches* is asserted on both.
  const answer = `${stub}\n${readTemplate('context/release.notes.md')}`;
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
    // The alternatives ship in the notes beside the stub, the way git.md's and tracking.md's do — a fresh
    // install that carried two answers would have none.
    const live = stripComments(stub);
    assert.doesNotMatch(live, /\*\*Per phase\.\*\*/, 'the second granularity ships in the notes');
    assert.match(live, /\*\*Once per feature\.\*\*/, 'the first one does not');
    assert.match(answer, /\*\*Per phase\.\*\*/, 'and the notes carry it, copy-ready');
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
    const body = flat(answer);
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
    assert.match(flat(answer), /`\/orchestrate` has neither value/i, 'the stub says it too, for a reader');
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
    assert.match(flat(answer), /named in the report, given no note, and left alone/i);
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
    assert.match(readTemplate('context/stack.notes.md'), /A generated changelog is not a surface/i);
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
    const body = flat(answer);
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
    const body = flat(answer);
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
    const body = flat(answer);
    assert.match(body, /A deploy that leaves no tag and no release is the failure that looks like success/i);
    assert.match(
      body,
      /usually off by default for exactly the paths that deploy/i,
      'and says the default is what produces it, so nobody has to have chosen it',
    );
  });

  it('Release is a wire of its own, because nothing else in a deploy would produce one', () => {
    const body = flat(answer);
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
    const body = flat(answer);
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
    const body = flat(answer);
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
    for (const text of [answer, skillBody('onboard')]) {
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
    assert.match(flat(answer), /what exempts the release commit from it/i, 'the answer records the exemption');
    assert.match(
      flat(answer),
      /are there pending notes\?\* as a proxy for \*is this change described\?\*/i,
      'and says which two questions the check confuses',
    );
    assert.match(
      flat(answer),
      /it is the same \*this path's version moved\* the last answer in (this file|`?release\.md`?) already uses/i,
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

  it('a typed flag or command is the shape of the ask, and nothing else is', () => {
    // workflow.md forbids running what bumps "except when the user asks for it in that turn", and until
    // now nothing said what asking looked like — leaving an agent to read "and ship it" three messages
    // back as permission to consume every pending note in the repository. Two shapes ship, and the rule
    // is that the list is closed rather than that it has one member.
    const rule = flat(readTemplate('context/workflow.md'));
    assert.match(rule, /A command or a flag typed in the turn it takes effect is what that asking looks like/i);
    assert.match(rule, /those are the only two shapes of it this workflow ships/i, 'the list is closed');
    assert.match(rule, /neither is inferred from prose: a sentence is not a command/i);
    for (const shape of [/`\/release`/, /`\/feature-close --release`/]) {
      assert.match(rule, shape, `the table names ${String(shape)}`);
    }
    const body = flat(skillBody('feature-close'));
    assert.match(body, /A sentence is not a flag/i, 'and the command says the same from its own side');
    assert.match(
      body,
      /If the user asked for a release and typed no flag, name `\/release` rather than assuming this one/i,
      'and it names the other shape rather than taking the ask for itself',
    );
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
    assert.match(flat(answer), /A wire names something that has run, or says that it has not/i);
    assert.match(flat(answer), /Written, never run\*+ is a real\s*answer/i, 'and the honest answer is named');

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
      // §22's lesson, applied here rather than predicted again: a grade does not have to be spelled
      // `P2` to be promised. The reviewer's own frontmatter advertised "a verdict with severities" for
      // five versions after its body said there is no scale — and a description is what a host shows
      // when it picks a subagent, so it is the one line a caller reads before briefing one.
      assert.doesNotMatch(
        text,
        /(verdict|review|report)[^.]{0,40}severit/i,
        `${rel} promises a graded verdict, and the gate takes one bit`,
      );
    }
    // And over the two documents that describe the rule rather than execute it, per §22.5.
    for (const rel of ['INVARIANTS.md', 'README.md']) {
      assert.doesNotMatch(
        flat(readFileSync(path.join(packageRoot, rel), 'utf8')),
        /(verdict|review|report)[^.]{0,40}severit/i,
        `${rel} promises a graded verdict`,
      );
    }
    assert.match(flat(workflow), /blocking or it is not/i, 'the one bit replaces it');
    assert.match(flat(workflow), /There is no severity scale/i, 'and the absence is stated');
    assert.match(
      readTemplate('claude/agents/reviewer.agent.md'),
      /^description: .*with every item blocking or not\./m,
      "the reviewer's description says what its verdict is",
    );
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

    // Reading the backlog is every command's business — "the open issues carrying the backlog label" is
    // how half of them find it at all. Only putting something *into* it is restricted, so this looks for a
    // sentence that names the backlog and routes something there, and lets it stand only if it refuses or
    // hands the decision to /roadmap.
    //
    // **It is keyed on `backlog`, not on `backlog label`, and that is the whole repair.** The first
    // version of this test matched the label, and `/orchestrate` went four versions saying a non-blocking
    // observation "needs code changes, in which case it is work and belongs in the backlog per
    // tracking.md" — the rule §14.3 called not a bar and §15.3 replaced, contradicting the same file's own
    // step 5 two paragraphs later. It spelled neither "label" nor an applying verb, so nothing saw it, and
    // the comments on the tests above described the fix as landed. §12.5's lesson, a second time: a test
    // keyed on the exact words of one violation misses every sibling that never needed them.
    const ROUTES = /\b(appl(y|ies|ying)|adds?|adding|appends?|appending|belongs?|enters?|labell?ed)\b/i;
    const REFUSES = /\b(never|not|no|refuse|refuses)\b/i;
    const DEFERS = /`\/roadmap`/;
    // §22.5: the guard ran over `skills/` only, and the sentence survived in `INVARIANTS.md` — the file
    // that states this rule for a reader deciding whether to trust the tool, where it went on saying a
    // non-blocking observation is work "unless it needs code changes" for as long as it took somebody to
    // read it. §22.4 predicted exactly this and the prediction was not acted on: a guard misses the
    // document that *describes* the rule as readily as it misses the sentence that breaks it. Every file
    // whose prose is ours, plus the two at the package root that explain the workflow to a human.
    const routed: { name: string; text: string }[] = [
      ...SKILL_NAMES.filter((name) => !MAY_WRITE_THE_LABEL.has(name)).map((name) => ({
        name,
        text: skillBody(name),
      })),
      ...['INVARIANTS.md', 'README.md'].map((rel) => ({
        name: rel,
        text: readFileSync(path.join(packageRoot, rel), 'utf8'),
      })),
    ];
    for (const { name, text } of routed) {
      for (const sentence of flat(text).split(/(?<=[.:])\s+/)) {
        if (!/backlog/i.test(sentence) || !ROUTES.test(sentence)) continue;
        assert.ok(
          REFUSES.test(sentence) || DEFERS.test(sentence),
          `${name} routes work into the backlog, and only /roadmap admits new work: "${sentence}"`,
        );
      }
    }
    // And the three ends are stated where the rule is explained, not just where it is executed.
    const invariants = flat(readFileSync(path.join(packageRoot, 'INVARIANTS.md'), 'utf8'));
    assert.match(invariants, /\*\*kind decides which, not size and not whether it needs code changes\*\*/);
    assert.match(invariants, /every true observation about code does, which is no bar at all/);

    // And the condition that made the stale sentence look reasonable is named where it bit, so the next
    // reader of that paragraph meets the reason rather than the rule alone.
    for (const name of GATES) {
      assert.match(
        flat(skillBody(name)),
        /kind decides which/i,
        `${name} must route a non-blocking observation by kind`,
      );
    }
    assert.match(
      flat(skillBody('orchestrate')),
      /not whether it needs code changes/i,
      'the bar that was not a bar is named where it was still in force',
    );
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

  // Cost was the only axis the sort had, and it cannot place a check the calendar fails. A dependency
  // audit is cheap enough for any gate and turns red when an advisory is published against a lockfile
  // nobody touched — so a gate that runs it blocks the next phase for a condition that phase did not
  // cause. The sorting question is therefore two questions, and both files ask the second one.
  it('a check a change does not cause is sorted out of the gate, however cheap it is', () => {
    const verify = flat(readTemplate('stubs/verify.md'));
    assert.match(verify, /attribution is the second/);
    assert.match(verify, /holds the check clean as a standing invariant/, 'the exception is stated');
    assert.match(verify, /a dependency audit/, 'the case that produced the rule is named');

    const onboard = flat(skillBody('onboard'));
    assert.match(onboard, /whether a change is what makes it fail/);
    assert.match(onboard, /holds the check clean as a standing invariant/);
    // Asked nowhere is answered nowhere: the example list is the only place the category comes up at all.
    assert.match(onboard, /a visual snapshot, a dependency audit/);
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
    assert.match(plan, /The order between chunks is a relationship, not a sentence/);
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

describe('the planned label is a rendering, and nothing reads it', () => {
  // §10.15: the backlog is observable and was not legible. *Has a plan* is a ledger in an issue body,
  // which renders as nothing on the issues list, so a person scanning it cannot tell an idea from a
  // planned feature. One label fixes that — and it is only safe because no command consults it. The
  // moment a ranking or a refusal branches on it, the body stops being the single answer and the label
  // becomes a second one that can disagree.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const tracking = readTemplate('stubs/tracking.md');

  it('both labels are parameters of the stub, and the stub is the only place they are named', () => {
    assert.match(tracking, /\*\*Backlog label:\*\* `workflow:feature`/);
    assert.match(tracking, /\*\*Planned label:\*\* `workflow:planned`/);
    // The literal name is the tracker's vocabulary, which §10.8 keeps in one file so a different tracker
    // is a rewrite of this section rather than of the skills. They say "the planned label" and nothing more.
    // /onboard is exempt for the reason it is exempt from naming an issue type: it collects the answer
    // that goes into the stub, so it has to be able to say what ships as the default.
    for (const name of SKILL_NAMES) {
      if (name === 'onboard') continue;
      assert.doesNotMatch(
        skillBody(name),
        /workflow:planned/,
        `${name} spells the planned label's literal name; tracking.md is where it is named`,
      );
    }
  });

  it('the body stays the answer, and the clause that says so is written down', () => {
    // The whole of why this is not a second source of truth. §10.11 gives the issue's type the same
    // standing, and Priority: is the near miss — it IS read, by one ranking, and had to be argued for.
    assert.match(
      flat(tracking),
      /No ranking, refusal, selection, gate or report may branch on the planned label/,
    );
    assert.match(flat(tracking), /whether the issue body holds a phase ledger/i);
  });

  it('only /feature-plan and /tracking-migrate apply it, and /roadmap refuses', () => {
    // The mirror of 'nothing enters the backlog except through /roadmap'. A plan is what earns the label,
    // so the two commands that write a plan into a body are the two that may apply it. /roadmap opens
    // ideas and adopts other people's issues — both Tier 1 by definition.
    const MAY_APPLY = new Set(['feature-plan', 'tracking-migrate']);
    const APPLIES = /\b(apply|applies|applying|add|adds|adding|set|sets|setting)\b/i;
    const REFUSES = /\b(never|not|no|refuse|refuses|cannot)\b/i;
    for (const name of SKILL_NAMES) {
      if (MAY_APPLY.has(name) || name === 'onboard') continue;
      for (const sentence of flat(skillBody(name)).split(/(?<=[.:])\s+/)) {
        if (!/planned label/i.test(sentence) || !APPLIES.test(sentence)) continue;
        assert.match(
          sentence,
          REFUSES,
          `${name} applies the planned label, and only a command that writes a plan may: "${sentence}"`,
        );
      }
    }
    assert.match(flat(skillBody('roadmap')), /\*\*Never apply the planned label\.\*\*/);
    assert.match(flat(skillBody('feature-plan')), /### The planned label, applied here/);
  });

  it('/feature-status is the only command that looks at it, and it only reports', () => {
    // Looking is not reading: the disagreement is named, never resolved, and never turned into a next
    // action. This command writes nothing at all, which is what makes it the only safe place for it.
    const status = flat(skillBody('feature-status'));
    assert.match(status, /A planned label that disagrees with the body/);
    assert.match(status, /the body wins, always/i);
    assert.match(status, /This is the only place the label is looked at at all/);
    // Every other skill may say it does NOT read the label — /roadmap's print has to say so outright,
    // since it holds the body open and the label is right there. A sentence that reads it is the failure;
    // a sentence that refuses to is the invariant being stated.
    const REFUSES = /\b(never|not|no|refuse|refuses|cannot|without)\b/i;
    for (const name of SKILL_NAMES) {
      if (name === 'feature-status') continue;
      for (const sentence of flat(skillBody(name)).split(/(?<=[.:])\s+/)) {
        if (!/\breads?\b[^.]*\bplanned label\b/i.test(sentence)) continue;
        assert.match(sentence, REFUSES, `${name} must not read the planned label: "${sentence}"`);
      }
    }
  });

  it('/onboard creates both labels, because creating one outranks applying one', () => {
    // Verified 2026-09-22: applying an existing label needs triage, creating one needs write, and
    // applying a name that does not exist fails rather than creating it. So the labels are made once by
    // the command that runs before any work, and everything after it only applies what it finds.
    const onboard = flat(skillBody('onboard'));
    assert.match(onboard, /\*\*Two label names\.\*\*/);
    assert.match(onboard, /\*\*Create either label if it is absent\*\*/);
    assert.match(onboard, /only one that creates a label/i);
    assert.match(flat(tracking), /Creating the label needs more than applying it/);
  });

  it('nothing removes it, including a close', () => {
    // A closed issue has left the list the label is read from, so there is nothing to clean up — the same
    // shape as `blocked by`, which nothing clears on the way out either.
    assert.match(flat(tracking), /It is not removed on the way out/);
    assert.match(flat(skillBody('feature-plan')), /\*\*Never remove one\.\*\*/);
  });
});

describe("/roadmap's print has a shape under the tracker answer", () => {
  // PLAN.md item 8: the no-argument print was written for the working tree and three of its four steps
  // name things the tracker answer does not have — the pending/active marker, the Doc field, and `active`
  // itself. The translation table remapped step 1 and repaired none of the rest, so "say which entries
  // have a plan and which do not" survived as an instruction with no mechanism under the answer where
  // satisfying it is hardest. That is the surface the legibility report (§10.15) landed on.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const roadmap = skillBody('roadmap');

  it('the three steps that name tree-only things are remapped, not left dangling', () => {
    const table = flat(roadmap);
    assert.match(table, /the print's `pending` \/ `active` \*\*marker\*\* \| the assignee/);
    assert.match(table, /the print's \*\*Doc\*\* field \| nothing to print/);
    assert.match(table, /the print's \*nothing is `active`\* \| no issue carrying the backlog label is assigned/);
    assert.match(table, /\*\*The print has its own shape under this answer\*\*/);
  });

  it('it groups by tier, which is the question the report was asked', () => {
    assert.match(roadmap, /^### The backlog, printed$/m);
    assert.match(flat(roadmap), /Group by tier, because that is the question this command answers/);
    // An empty group is an answer somebody came for; a heading that vanishes reads as a backlog nobody read.
    assert.match(flat(roadmap), /An empty group still prints, with `\(0\)`/);
  });

  it('a plan is the ledger\'s presence, and the print stops there', () => {
    // The body is already in hand, so the Status column is one glance away — which is exactly why this
    // line has to be written down. /feature-status answers where a feature stands; this answers what is
    // on the list, and the existing rule against reporting phase status has to survive the substrate move.
    assert.match(flat(roadmap), /\*\*Look for the phase ledger\. Do not read it\.\*\*/);
    // The rule the working-tree answer already carried, which the substrate move must not drop.
    assert.match(flat(roadmap), /read a plan.s ledger or report phase status/);
  });

  it('it derives the tier from the body and never from the label', () => {
    // The label is a rendering for the issues list. A report that consulted it would derive a fact from a
    // copy with the original already open, and would go wrong exactly when the copy is stale.
    assert.match(flat(roadmap), /\*\*Do not read the planned label, and do not print it\.\*\*/);
    assert.match(flat(roadmap), /The body decides, every time/);
  });

  it('it still refuses to pick a candidate', () => {
    // Unchanged under both answers, and the reason is unchanged: /feature-plan ranks and asks, so a name
    // suggested here either duplicates that ranking or contradicts it.
    assert.match(flat(roadmap), /If nothing is assigned, name `\/feature-plan`\*\* — and \*\*do not pick a candidate/i);
  });
});

describe('a question the plan could not settle has an end at close', () => {
  // The field report: baldurpan.com retired features `shipped` whose history rows read "the Icelandic and
  // VoiceOver check await the owner" and "the owner's wording (Q11, Q18), the halo and look (Q16, Q20) and
  // an iPhone check (Q14) await". `/feature-implement` surfaces §9 at activation and nothing read it
  // again, so the questions were archived into a file no command opens. None of the three endings in
  // *What happens to a defect the gate found* fitted one: an owner check is not a defect, nobody wants a
  // history row for "read the Icelandic", and `notes.md` is deleted at the close — which is the moment the
  // check becomes real.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const workflow = readTemplate('context/workflow.md');
  const close = flat(skillBody('feature-close'));

  it('the contract has a section of its own, beside the one it is modelled on', () => {
    assert.match(workflow, /^## What happens to a question the plan could not settle$/m);
    assert.match(workflow, /^## What happens to a defect the gate found$/m, 'the sibling is still there');
    assert.match(flat(workflow), /It is not a defect/, 'and the two are told apart');
  });

  it('the contract only one command acts on lives in that command', () => {
    // §24.9. `/feature-close` is the only command that reads §9 after activation, so the ends, the
    // destinations and the Outcome rule were 4,665 bytes on `workflow.md` that nine other commands paid
    // for and none of them used. What stays is the standing rule — which does have several readers, since
    // a phase answers what it settles — and a pointer. The ends have one home, and this is it.
    const holders = ourTemplates()
      .filter(({ text }) => /\*\*waived\*\*/.test(text))
      .map(({ rel }) => rel);
    assert.deepEqual(holders, [path.join('skills', 'feature-close', 'SKILL.md')], 'one home for the ends');
    assert.match(flat(workflow), /are `\/feature-close`'s/, 'and the rule names the command that holds them');
    assert.equal(
      (workflow.match(/\| End \| When \| Where the record lives \|/g) ?? []).length,
      2,
      'and no third copy of the destinations table is left behind',
    );
  });

  it('three ends, and the user picks rather than the run', () => {
    // §24.9: the ends are `/feature-close`'s, which is the only command that reads §9 after activation.
    // The standing rule stays where every command already looks, in one blockquote.
    for (const end of [/\*\*answered\*\*/, /\*\*filed\*\*/, /\*\*waived\*\*/]) {
      assert.match(close, end, `the command names ${String(end)}`);
    }
    assert.match(flat(workflow), /answered, filed or waived/i, 'the rule names them without the table');
    assert.match(flat(workflow), /picked by the user item by item/i, 'and says whose call it is');
    assert.match(close, /silence is not a waiver/i, 'and the command applies it');
  });

  it('/feature-close reads the section nothing has read since activation', () => {
    assert.match(close, /§9 Open questions/, 'it names the section');
    assert.match(close, /this is the last command that ever will/i, 'and says why it is here');
    assert.match(close, /\*\*Note\*\* column of its ledger/, 'the ledger Note is swept with it');
  });

  it('it runs before the writes, because both of them carry its result', () => {
    assert.match(close, /before anything is written/i);
    assert.match(close, /Nothing afterwards would have anything to amend/i);
    // The two destinations for an end that is not a filing.
    assert.match(close, /the why names it and the issue that carries it/i, 'the row points at the filing');
    assert.match(close, /§9 travels with it, carrying the ends/i, 'the archive holds the rest');
  });

  it('a filed check goes on the bug shelf, as what it is and never into the backlog', () => {
    // §24.4: the destination rule had two bodies in one file. It has one, and this section cites it.
    assert.match(flat(workflow), /the shelf \*A bug is not a backlog entry\* already names/i, 'cited');
    assert.match(flat(workflow), /the kind is not a bug/i, 'with the one thing that differs');
    assert.match(close, /wherever this project already files bugs/i, 'the destination is the project\'s own');
    assert.match(close, /\*\*Never the backlog label\*\*/, 'and the rule that governs it');
    assert.match(close, /filed as what it is, and\s*not as a bug/i, 'the kind is not the destination');
    assert.match(close, /not written up as a defect/i);
  });

  it('a project that files bugs nowhere gets two ends, not an invented store', () => {
    assert.match(close, /two ends rather than three/i);
    assert.match(close, /not invent a store/i);
    assert.match(close, /not hold up the retirement/i, 'and a gap is not a refusal, as everywhere else');
  });

  it('the Outcome column gains no value, because the file is append-only', () => {
    // The tempting fix is a fourth outcome word. `history.md` is append-only and never edited, so that
    // word outlives the check by as long as the repository lasts; and under the tracker answer the column
    // is the close reason, which has two values and no room for a third. §24.4: the rule belongs to the
    // file it governs and to the command that writes the row — the argument is in the notes, once.
    const history = flat(readTemplate('stubs/history.md'));
    assert.match(history, /append-only/i, 'the stub says what it is');
    assert.match(history, /nothing can withdraw/i, 'and what that costs a status');
    assert.match(history, /the issue that carries it/i, 'where the person who would add a word is reading');
    assert.match(close, /the outcome stays `shipped` and gains no value/i, 'the writer of the row');
    assert.match(close, /the why names it and the issue that carries it/i);
    assert.match(flat(readTemplate('context/workflow.notes.md')), /a status nothing can withdraw/i);
  });

  it('nothing new accumulates — no file, no stub, no check rule, no status', () => {
    // §12 and §14's whole lesson. The bound is the lifecycle: one plan's §9, archived and never read
    // again, so nothing carries into the next feature. A store watched while it grows is the thing that
    // was removed twice.
    assert.equal(
      STUBS.find((s) => /owner|check/i.test(s.dest)),
      undefined,
      'an install ships a store for these',
    );
    const rules = readFileSync(path.join(packageRoot, 'src/check/rules.ts'), 'utf8');
    assert.doesNotMatch(rules, /owner check/i, 'check grew a reader, which is what makes a store silent');
    assert.match(close, /This adds no status and no fourth phase state/i);
    assert.match(close, /does not gate one/i, 'and it cannot hold a phase open');
  });

  it('notes.md keeps its unconditional delete, and the two files are told apart', () => {
    assert.match(close, /not the `notes\.md` triage refused further down/i);
    assert.match(close, /that file is a gate's and grows without bound/i, 'the two files are told apart');
    assert.match(close, /§9 is the plan's and is bounded by it/i);
    // The refusal this must not have reopened.
    assert.match(close, /delete it — whole/i);
    assert.match(close, /do not assign each line a disposition/i);
  });

  it('a phase answers what it settles, the way it fixes what it makes untrue', () => {
    const implement = flat(skillBody('feature-implement'));
    assert.match(implement, /answered in the plan's §9, by this phase/i);
    assert.match(implement, /Leave the items this phase did not settle alone/i);
    assert.match(implement, /step 11 does not test for it/i, 'settling one is not a phase obligation');
  });

  it('the planner is told the section has readers after it', () => {
    assert.match(flat(readTemplate('context/plan-template.md')), /items need a person/i);
    assert.match(flat(readTemplate('context/plan-template.notes.md')), /two readers after you/i);
    assert.match(flat(skillBody('feature-plan')), /which of them need a person/i);
    assert.match(flat(readTemplate('claude/agents/planner.agent.md')), /which ones need a person/i);
  });

  it('the tracker answer moves where it is written and nothing else', () => {
    const tracker = flat(readTemplate('skills/feature-close/tracker.md'));
    assert.match(tracker, /§9 is a section of the body, and the body is the plan/i);
    assert.match(tracker, /the closing comment names it, by number/i);
    // The primitive someone will reach for and must not: `blocked by` is between features.
    assert.match(tracker, /no `blocked by` relationship/i);
    assert.match(tracker, /an owner check is not one/i);
  });

  it('--dropped still gives a landed phase\'s check an end', () => {
    // Same rule the release note already follows in that mode: the check belongs to the code that landed,
    // not to the outcome the feature was later given.
    assert.match(close, /The open-questions pass still runs, and it still runs first/i);
    assert.match(close, /waived by construction/i, 'and an item about work never written costs one line');
  });
});

describe('an expected value has a source, and it is never the code under test', () => {
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const workflow = readTemplate('context/workflow.md');
  const coder = readTemplate('context/roles/coder.md');
  const planner = readTemplate('claude/agents/planner.agent.md');
  const reviewer = readTemplate('claude/agents/reviewer.agent.md');

  // The hole was that neither gate asked where an expectation came from. A test asserting whatever the
  // code returned is green on the first run and on every run after, so Gate 1 passes it and Gate 2 walks a
  // checklist that was never asked about the number. The same shape as the documentation rule and the
  // surface rule: no gate fails, so the fix is a rule with one home and four readers that cite it.
  it('the rule has one home, and it is the file every command already cites', () => {
    assert.match(workflow, /^### An expected value has a source, and it is never the code under test$/m);
    assert.match(flat(workflow), /work test-first in thin slices/);
    assert.match(flat(workflow), /before the code that produces it runs/);
    assert.match(flat(workflow), /expectation back out of the code under test/);
    assert.match(flat(readTemplate('context/workflow.notes.md')), /A test that asserts whatever the function returned/);
  });

  it('the blockquote is written once, and the readers cite it rather than restating it', () => {
    const OPENING = /> \*\*Where a change has behaviour you can observe at a seam/;
    const holders = ourTemplates().filter(({ text }) => OPENING.test(text)).map(({ rel }) => rel);
    assert.deepEqual(holders, [path.join('context', 'workflow.md')], 'one file carries the rule itself');

    const TITLE = /\*An expected value has a source, and it is never the code under test\*/;
    for (const [rel, text] of [
      ['context/roles/coder.md', coder],
      ['context/plan-template.notes.md', readTemplate('context/plan-template.notes.md')],
      ['claude/agents/planner.agent.md', planner],
      ['claude/agents/reviewer.agent.md', reviewer],
    ] as const) {
      assert.match(text, TITLE, `${rel} names the rule`);
      assert.match(text, /workflow\.md/, `${rel} points at its home`);
    }
  });

  it('the coder works test-first in slices and decides the value before the code runs', () => {
    const text = flat(coder);
    assert.match(text, /\*\*work test-first, in thin slices\.\*\*/);
    assert.match(text, /A slice is one observable behaviour at that seam/);
    assert.match(text, /\*\*Decide what the seam should produce\.\*\*/);
    assert.match(text, /\*\*Check it against something that is not the implementation\.\*\*/);
    assert.match(text, /\*\*Never the code under test\*\*/);
    // The three circular sources, named — each agrees with the implementation by construction.
    assert.match(text, /never a helper this change also touches/);
    assert.match(text, /never a reference implementation written for this task/);
    // Without this the loop closes the wrong way: the expectation moves until the code passes.
    assert.match(text, /Picking whichever value passes is the failure/);
    assert.match(text, /\*\*Write down what decided each value\*\*/);
  });

  it('the coder is told where the rule does not apply, and that silence is not that answer', () => {
    const text = flat(coder);
    assert.match(text, /Documentation, configuration, and wiring that only passes a value through/);
    assert.match(text, /tests the framework/);
    assert.match(text, /the unanswered question reads exactly like a skipped step/);
  });

  it('the plan names what decides each value, and the planner is the one who finds it', () => {
    const template = readTemplate('context/plan-template.md');
    assert.match(template, /^## 8\. Verification$/m);
    assert.match(flat(template), /\*\*What decides each value this feature computes\.\*\*/);
    assert.match(template, /^\| Value \| What decides it \|$/m);
    assert.match(flat(readTemplate('context/plan-template.notes.md')), /each value the feature computes gets a source/);
    assert.match(flat(planner), /\*\*Name what decides every value the feature computes\.\*\*/);
    // The source is research, and research that came back empty is the section this repository already has
    // for that — not a number the implementation gets to choose.
    assert.match(flat(planner), /is an \*\*open question\*\*, not a number for the implementation to pick/);
    assert.match(flat(template), /A value whose source could not be found belongs in §9/);
  });

  it('the value table is not a second phase ledger', () => {
    // `check` finds a ledger by its columns, and more than one in a document is itself a finding. A table
    // in §8 with a Status column beside a Phase one would be read as a decoy ledger.
    const ledgers = parseLedgers(readTemplate('context/plan-template.md'));
    assert.equal(ledgers.length, 1, 'the status ledger is still the only table shaped like one');
  });

  it('the reviewer raises both findings on a green suite, as standing checks', () => {
    const text = flat(reviewer);
    assert.match(text, /\*\*Two checks are standing: they run on every review, whether or not the checklist names them\.\*\*/);
    assert.match(text, /\*\*An expected value with no traceable source is a finding, even though the tests are green\.\*\*/);
    assert.match(text, /\*\*A rule the code implements that no test asserts is a finding too\.\*\*/);
    // The reviewer is called after Gate 1 passed, which is exactly why the green is not evidence.
    assert.match(text, /proves only that the tests and the code agree with each other/);
    assert.match(text, /a passing assertion is not evidence for it/);
    // Severity is still the one bit this review has: §12 deleted the scale and nothing re-adds it.
    assert.match(text, /Judge both by step 3 like anything else/);
  });

  it('the marker check is offered as a Gate 1 section, and only verify.md names its command', () => {
    const notes = flat(readTemplate('context/verify.notes.md'));
    assert.match(notes, /no test in the suite is skipped, focused or expected to fail/);
    assert.match(notes, /\*\*Optional on purpose:\*\*/, 'a project may use a skip deliberately');
    assert.match(notes, /the command belongs in \[`verify\.md`\]\(verify\.md\)'s block and nowhere else/);

    const onboard = flat(skillBody('onboard'));
    assert.match(onboard, /offer one candidate of your own, and only this one/i);
    assert.match(onboard, /skipped, focused or expected to fail/);
    assert.match(onboard, /\*\*Offer it; do not assume it\.\*\*/);
    // It is a gate-section candidate like any other, so step 4 runs it before step 5 writes it down.
    assert.match(onboard, /it is run in step 4 before it is written down/);
  });

  it('the marker category is named, and its syntax is spelled nowhere', () => {
    // A marker's spelling is a runtime fact: `.skip`, `xit` and a focus prefix differ per runner, and a
    // template that spells one has picked a stack. The three words are what every runner has.
    const SYNTAX = [
      /\b(?:it|test|describe|suite)\s*\.\s*(?:skip|only|todo|fails|failing)\b/,
      /\b[xf](?:it|describe)\s*\(/,
      /\bt\.Skip\(/,
    ];
    for (const { rel, text } of ourTemplates()) {
      for (const pattern of SYNTAX) {
        assert.doesNotMatch(text, pattern, `${rel} spells a marker instead of naming it (${String(pattern)})`);
      }
    }
  });
});
