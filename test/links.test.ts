import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { install } from '../src/commands/install.ts';
import { exists, walk } from '../src/paths.ts';

let root: string;

const quiet = <T>(fn: () => T): T => {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return fn();
  } finally {
    process.stdout.write = write;
  }
};

/** Markdown files this tool writes — the vendored standards are excluded, they are not ours. */
function ourInstalledMarkdown(): string[] {
  return [
    ...walk(path.join(root, 'context'))
      .map((rel) => path.join('context', rel))
      .filter((rel) => !rel.split(path.sep).includes('standards')),
    ...walk(path.join(root, '.claude')).map((rel) => path.join('.claude', rel)),
    'AGENTS.md',
    'CLAUDE.md',
  ].filter((rel) => rel.endsWith('.md'));
}

describe('every relative link resolves after install', () => {
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), 'aiw-links-'));
    quiet(() => install(root));
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  it('has files to check', () => {
    assert.ok(ourInstalledMarkdown().length > 15);
  });

  it('resolves every one', () => {
    const broken: string[] = [];

    for (const rel of ourInstalledMarkdown()) {
      const text = readFileSync(path.join(root, rel), 'utf8');
      // Skip fenced blocks and blockquoted examples — those are illustrations, not live links.
      const body = text.replace(/```[\s\S]*?```/g, '').replace(/^>.*$/gm, '');

      // plan-template.md is written for its copy site — its links must resolve from context/plans/.
      const from = rel === path.join('context', 'plan-template.md') ? 'context/plans/x.md' : rel;

      for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = (match[1] as string).split('#')[0] as string;
        if (target === '' || /^[a-z]+:/i.test(target)) continue;
        // `<PLACEHOLDER>` paths in templates are for the agent to fill in.
        if (target.includes('<')) continue;
        const resolved = path.resolve(path.dirname(path.join(root, from)), decodeURI(target));
        if (!exists(resolved)) broken.push(`${rel} → ${target}`);
      }
    }

    assert.deepEqual(broken, [], `broken links:\n  ${broken.join('\n  ')}`);
  });
});
