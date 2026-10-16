import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type Budget,
  lock,
  ourTemplates,
  readBudget,
  readSets,
  recordSections,
  sizeOf,
  totalOf,
} from '../scripts/budget.ts';

/**
 * The prose budget — DESIGN-RECORD §24.5, and §24.2 for why it exists. §17.2 cut 30,756 bytes out of the
 * per-phase read with nothing holding the line, and 39% of it was back sixteen days later with every
 * addition recorded and none of them summed. A ban is only real if a test enforces it.
 */
const budget: Budget = readBudget();
const cited = (why: string): string | undefined => /§(\d+(?:\.\d+)?)/.exec(why)?.[1];

describe('every file whose prose we ship has a limit', () => {
  it('nothing is unbudgeted', () => {
    const missing = ourTemplates().filter((rel) => budget.files[rel] === undefined);
    assert.deepEqual(missing, [], `add these to templates.budget.json:\n  ${missing.join('\n  ')}`);
  });

  it('nothing in the budget has been deleted or renamed', () => {
    const ours = new Set(ourTemplates());
    const stale = Object.keys(budget.files).filter((rel) => !ours.has(rel));
    assert.deepEqual(stale, [], `remove these from templates.budget.json:\n  ${stale.join('\n  ')}`);
  });
});

describe('a limit is a round number, so a raise shows up as one in the diff', () => {
  it('every one is on a 512-byte boundary', () => {
    for (const [rel, entry] of Object.entries(budget.files)) {
      assert.equal(entry.limit, lock(entry.limit), `${rel}'s limit is not on a 512-byte boundary`);
    }
  });
});

describe('no file is over its limit', () => {
  for (const rel of ourTemplates()) {
    it(rel, () => {
      const { limit } = budget.files[rel] as { limit: number };
      const size = sizeOf(rel);
      assert.ok(
        size <= limit,
        `${rel} is ${size} bytes, ${size - limit} over its limit of ${limit}. Say it in fewer words, ` +
          'move what only one command needs into that command (§24.9), or raise the limit by hand with a ' +
          '`why` naming the section of DESIGN-RECORD.md that justifies it.',
      );
    });
  }
});

describe('a cut is locked in by the commit that earns it', () => {
  // The ratchet, and the half §17.2 did not have. A limit left far above the file is slack the next
  // paragraph spends, which is exactly how the cut came back.
  for (const rel of ourTemplates()) {
    it(rel, () => {
      const { limit } = budget.files[rel] as { limit: number };
      const size = sizeOf(rel);
      assert.ok(
        size > limit - budget.slack,
        `${rel} is ${limit - size} bytes under its limit of ${limit}. Run \`npm run budget:relock\` and ` +
          'commit the lower number with the change that earned it.',
      );
    });
  }
});

describe('a limit names the decision behind it', () => {
  // A generated budget file is too easy to regenerate. The script only ever lowers; a raise is typed, and
  // a raise with no reason is the failure this catches.
  const sections = recordSections();

  it('DESIGN-RECORD.md has sections to cite', () => {
    assert.ok(sections.size > 50, `found ${sections.size}`);
  });

  for (const [name, entry] of [...Object.entries(budget.files), ...Object.entries(budget.ceilings)]) {
    it(name, () => {
      const section = cited(entry.why);
      assert.ok(section !== undefined, `${name}'s \`why\` names no § of DESIGN-RECORD.md: "${entry.why}"`);
      assert.ok(
        sections.has(section),
        `${name} cites §${section}, which DESIGN-RECORD.md does not have`,
      );
    });
  }
});

describe('the two ceilings per-file limits cannot hold', () => {
  it('the always-loaded pair — the only bytes every command pays', () => {
    const entry = budget.ceilings['always-loaded'] as { limit: number; files: string[] };
    const size = totalOf(entry.files);
    assert.ok(size <= entry.limit, `${size} bytes against ${entry.limit}`);
    assert.ok(size > entry.limit - budget.slack, `${entry.limit - size} under — relock`);
  });

  it('every template whose prose is ours, summed', () => {
    const entry = budget.ceilings['our-templates'] as { limit: number };
    const size = totalOf(ourTemplates());
    assert.ok(size <= entry.limit, `${size} bytes against ${entry.limit}`);
    assert.ok(size > entry.limit - budget.slack, `${entry.limit - size} under — relock`);
  });
});

describe('what a command loads is derived from what it links', () => {
  // The read set behind §24.1's table. §17.1's was written out by hand and was 15% stale sixteen days
  // later; this one is recomputed from the skills, so it cannot be.
  const sets = readSets();

  it('every command has one, and it holds the block and its own body', () => {
    assert.equal(sets.length, 10);
    for (const { command, files } of sets) {
      assert.ok(files.includes('blocks/agents-block.md'), `${command} loads the block`);
      assert.ok(
        files.some((rel) => rel.endsWith('SKILL.md')),
        `${command} loads its own body`,
      );
    }
  });

  it('every command reads the file that holds the rules', () => {
    for (const { command, files } of sets) {
      assert.ok(files.includes('context/workflow.md'), `${command} links workflow.md`);
    }
  });

  it('the floor under every command is the always-loaded pair', () => {
    const floor = totalOf(['blocks/agents-block.md', 'context/workflow.md']);
    for (const { command, files } of sets) {
      assert.ok(totalOf(files) >= floor, `${command} is below the floor, which cannot happen`);
    }
  });
});
