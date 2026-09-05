import path from 'node:path';
import { readFileSync } from 'node:fs';
import { templatesDir, toPosix, walk } from './paths.ts';

export type Adapter = 'claude' | 'agents';

/**
 * Both trees ship. The hosts read disjoint directories — Codex finds `.agents/skills/` and never looks
 * at `.claude/skills/` (§1.2) — so a repository worked on by more than one agent needs both, and a
 * repository worked on by one pays a directory it never opens. Neither tree is ever hand-edited, which
 * is what keeps the duplication structural rather than a drift risk (§5.1).
 */
export const DEFAULT_ADAPTERS: Adapter[] = ['claude', 'agents'];

/** Where each adapter's host looks for project-local skills. */
export const ADAPTER_SKILL_DIRS: Record<Adapter, string> = {
  claude: '.claude/skills',
  agents: '.agents/skills',
};

export function isAdapter(value: unknown): value is Adapter {
  return value === 'claude' || value === 'agents';
}

/** The manifest key for the delimited block inside AGENTS.md. Not a file — a region of one. */
export const AGENTS_BLOCK_KEY = 'AGENTS.md#ai-workflow';

export const CONTEXT_DIR = 'context';
export const MANIFEST_PATH = 'context/.state/manifest.json';
export const STANDARDS_PREFIX = 'context/standards/';

export const SKILL_NAMES = [
  'roadmap',
  'feature-plan',
  'feature-implement',
  'feature-status',
  'feature-close',
  'orchestrate',
  'prototype',
  'onboard',
] as const;

export interface ManagedFile {
  /** Path inside the package's `templates/` directory. */
  source: string;
  /** Destination, relative to the project root, always posix-separated. */
  dest: string;
  /** Applied to the template's text before it is written. */
  transform?: (text: string) => string;
}

/**
 * A skill body is shared verbatim between adapter trees. `disable-model-invocation: true` is the only
 * difference the Claude Code copy carries, and it is injected here rather than written into the template,
 * so a second tree can reuse the same body untouched.
 */
export function claudeSkillTransform(text: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('skill template has no frontmatter block');
  const frontmatter = match[1] as string;
  if (/^disable-model-invocation:/m.test(frontmatter)) return text;
  const patched = `---\n${frontmatter}\ndisable-model-invocation: true\n---\n`;
  return patched + text.slice(match[0].length);
}

/**
 * npm refuses to publish a file named `.gitignore`, so the vendored standards carry theirs as
 * `_dot_gitignore` and it is restored here. Without this the installed tree would quietly differ from the
 * ref `standards/.source` claims it came from.
 */
export function undotted(posix: string): string {
  return posix.replace(/(^|\/)_dot_/, '$1.');
}

/** Every tool-owned file, in the order it should be written and reported. */
export function managedFiles(adapters: readonly Adapter[]): ManagedFile[] {
  const files: ManagedFile[] = [
    { source: 'context/README.md', dest: 'context/README.md' },
    { source: 'context/workflow.md', dest: 'context/workflow.md' },
    { source: 'context/plan-template.md', dest: 'context/plan-template.md' },
    { source: 'context/plan-template.notes.md', dest: 'context/plan-template.notes.md' },
    { source: 'context/roles/coder.md', dest: 'context/roles/coder.md' },
  ];

  for (const rel of walk(path.join(templatesDir, 'standards'))) {
    const posix = toPosix(rel);
    files.push({ source: `standards/${posix}`, dest: `${STANDARDS_PREFIX}${undotted(posix)}` });
  }

  if (adapters.includes('claude')) {
    for (const name of SKILL_NAMES) {
      files.push({
        source: `skills/${name}/SKILL.md`,
        dest: `${ADAPTER_SKILL_DIRS.claude}/${name}/SKILL.md`,
        transform: claudeSkillTransform,
      });
    }
    for (const rel of walk(path.join(templatesDir, 'claude', 'agents'))) {
      const posix = toPosix(rel);
      files.push({ source: `claude/agents/${posix}`, dest: `.claude/agents/${posix}` });
    }
  }

  // The same eight bodies, verbatim. No transform: `disable-model-invocation` is Claude Code's key and
  // means nothing here, and there is no subagent tree to go with it — the skills already write
  // delegation as optional.
  if (adapters.includes('agents')) {
    for (const name of SKILL_NAMES) {
      files.push({
        source: `skills/${name}/SKILL.md`,
        dest: `${ADAPTER_SKILL_DIRS.agents}/${name}/SKILL.md`,
      });
    }
  }

  return files;
}

/** Project-owned files. Written once, at install, and never reachable by `update`. */
export const STUBS: ReadonlyArray<{ source: string; dest: string }> = [
  { source: 'stubs/stack.md', dest: 'context/stack.md' },
  { source: 'stubs/verify.md', dest: 'context/verify.md' },
  { source: 'stubs/executors.md', dest: 'context/executors.md' },
  { source: 'stubs/git.md', dest: 'context/git.md' },
  { source: 'stubs/roadmap.md', dest: 'context/roadmap.md' },
  { source: 'stubs/history.md', dest: 'context/history.md' },
  { source: 'stubs/findings.md', dest: 'context/findings.md' },
];

export const STUB_DIRS = ['context/drafts', 'context/plans', 'context/archive'] as const;

export function readTemplate(source: string): string {
  return readFileSync(path.join(templatesDir, source), 'utf8');
}

/** The rendered content of a managed file — the template with its transform applied. */
export function renderManaged(file: ManagedFile): string {
  const text = readTemplate(file.source);
  return file.transform ? file.transform(text) : text;
}

export function agentsBlockBody(): string {
  return readTemplate('blocks/agents-block.md').trim();
}
