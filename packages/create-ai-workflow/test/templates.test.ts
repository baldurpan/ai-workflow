import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { claudeSkillTransform, SKILL_NAMES, agentsBlockBody, readTemplate } from '../src/layout.ts';
import { parseFindings, parseHistory, parseRoadmap } from '../src/check/parse.ts';
import { stripComments } from '../src/check/markdown.ts';
import { templatesDir, walk } from '../src/paths.ts';

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

  it('the plan write order is stated where a phase cannot be lost', () => {
    // §10.4: the body is written before the sub-issues exist, so a run that dies between them leaves a
    // complete plan that reads as a draft. The order and the resume are the fix, and both must be written.
    const plan = skillBody('feature-plan');
    assert.match(plan, /commit point/i, 'the sub-issues are named as the commit point');
    // The body lists the phases and the sub-issues carry their status, which is what makes a half-created
    // plan detectable instead of indistinguishable from a draft.
    assert.match(plan, /Status column/i, 'the status column moves out of the body');
    assert.match(plan, /interrupted run/i, 'a partial set of sub-issues has a named verdict');
    assert.match(plan, /count and names/i, 'the reconciliation is mechanical, not a judgement call');
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
    assert.ok(agentsBlockBody().split('\n').length < 40, 'the block is not a second copy of the rules');
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
      /does not silently remove this one/i,
      "an earlier step's default must not delete this answer without saying so",
    );
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
