import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { claudeSkillTransform, SKILL_NAMES, agentsBlockBody, readTemplate } from '../src/layout.ts';
import { parseFindings, parseHistory, parseRoadmap } from '../src/check/parse.ts';
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
    const adopt = onboard.indexOf('## Step 1 — Adopt');
    const prune = onboard.indexOf('## Step 7 — Prune');
    assert.ok(adopt > 0, 'the adoption step exists');
    assert.ok(prune > adopt, 'pruning comes after every step that writes a destination');
    assert.match(onboard, /Nothing is deleted here/, 'the adoption step deletes nothing');
    assert.match(onboard, /Copy before cut/, 'the ordering is stated as a standing rule');
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
