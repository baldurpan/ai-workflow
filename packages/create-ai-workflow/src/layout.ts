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
  'release',
  'prototype',
  'onboard',
  'tracking-migrate',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

/**
 * The model and effort each command's own orchestration runs on, in the Claude Code copy only.
 *
 * The fixed reading a command does before it touches code — the skill, `workflow.md`, the answer files,
 * the plan — lands in the session that invoked it, and picking a ledger row, writing a brief, running Gate
 * 1 and writing the row back is bookkeeping a mid-tier model does as well as a frontier one. So every
 * command's shell runs on `sonnet` and the two that need judgment do not: `/onboard` runs once and a wrong
 * answer file costs every later run, and the planner and reviewer subagents are pinned up in their own
 * definitions. Aliases rather than dated ids, so they resolve to whatever the account has.
 *
 * One limit, verified against the host's documentation on 2026-09-30: a skill's `model:` holds for the
 * rest of the turn it was invoked in, and the session model resumes on the next prompt. A command that
 * stops to ask — `/feature-implement`'s approval checkpoint, `/release`'s confirmation — runs its
 * remainder on the session model. The lines still cover every one-turn run outright and the first
 * turn of the rest, and they put the intended tier where a reader looks for it. Running the session on
 * `sonnet` is what makes the tier hold across the ask.
 */
export const CLAUDE_SKILL_SETTINGS: Record<SkillName, { model: string; effort: string }> = {
  roadmap: { model: 'sonnet', effort: 'low' },
  'feature-plan': { model: 'sonnet', effort: 'medium' },
  'feature-implement': { model: 'sonnet', effort: 'medium' },
  'feature-status': { model: 'sonnet', effort: 'low' },
  'feature-close': { model: 'sonnet', effort: 'medium' },
  orchestrate: { model: 'sonnet', effort: 'medium' },
  release: { model: 'sonnet', effort: 'medium' },
  prototype: { model: 'sonnet', effort: 'medium' },
  onboard: { model: 'opus', effort: 'high' },
  'tracking-migrate': { model: 'sonnet', effort: 'medium' },
};

/** The frontmatter keys the Claude copy adds. The shared body must carry none of them. */
export const CLAUDE_ONLY_KEYS = ['disable-model-invocation', 'model', 'effort'] as const;

export interface ManagedFile {
  /** Path inside the package's `templates/` directory. */
  source: string;
  /** Destination, relative to the project root, always posix-separated. */
  dest: string;
  /** Applied to the template's text before it is written. */
  transform?: (text: string) => string;
}

/**
 * A skill body is shared verbatim between adapter trees. The Claude Code copy differs by frontmatter only:
 * `disable-model-invocation: true`, and the `model` and `effort` from `CLAUDE_SKILL_SETTINGS`. All three
 * are injected here rather than written into the template, so a second tree can reuse the same body
 * untouched. The skill is identified by its own `name:` line, so a caller needs nothing but the text.
 */
export function claudeSkillTransform(text: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('skill template has no frontmatter block');
  const frontmatter = match[1] as string;
  const name = /^name: (.+)$/m.exec(frontmatter)?.[1]?.trim();
  const settings = name && name in CLAUDE_SKILL_SETTINGS ? CLAUDE_SKILL_SETTINGS[name as SkillName] : null;

  const lines = [
    'disable-model-invocation: true',
    ...(settings ? [`model: ${settings.model}`, `effort: ${settings.effort}`] : []),
  ].filter((line) => !new RegExp(`^${line.split(':')[0]}:`, 'm').test(frontmatter));
  if (lines.length === 0) return text;

  const patched = `---\n${frontmatter}\n${lines.join('\n')}\n---\n`;
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

/**
 * Every file a skill directory ships, as paths relative to it. `SKILL.md` is the body; anything beside it
 * is a supporting file the body tells the agent when to read — `tracker.md` holds the tracker answer's
 * half of five commands, read only where `tracking.md` names the tracker, so a repository on the
 * working-tree answer never loads it.
 */
function skillFiles(name: SkillName): string[] {
  return walk(path.join(templatesDir, 'skills', name)).map(toPosix);
}

/** Every tool-owned file, in the order it should be written and reported. */
export function managedFiles(adapters: readonly Adapter[]): ManagedFile[] {
  // `context/` is walked rather than listed: the notes beside `workflow.md` and each stub are tool-owned
  // for the same reason `plan-template.notes.md` is, and a list here went one file stale each time one
  // was added.
  const files: ManagedFile[] = walk(path.join(templatesDir, 'context')).map((rel) => {
    const posix = toPosix(rel);
    return { source: `context/${posix}`, dest: `context/${posix}` };
  });

  for (const rel of walk(path.join(templatesDir, 'standards'))) {
    const posix = toPosix(rel);
    files.push({ source: `standards/${posix}`, dest: `${STANDARDS_PREFIX}${undotted(posix)}` });
  }

  if (adapters.includes('claude')) {
    for (const name of SKILL_NAMES) {
      for (const rel of skillFiles(name)) {
        const file: ManagedFile = {
          source: `skills/${name}/${rel}`,
          dest: `${ADAPTER_SKILL_DIRS.claude}/${name}/${rel}`,
        };
        if (rel === 'SKILL.md') file.transform = claudeSkillTransform;
        files.push(file);
      }
    }
    for (const rel of walk(path.join(templatesDir, 'claude', 'agents'))) {
      const posix = toPosix(rel);
      files.push({ source: `claude/agents/${posix}`, dest: `.claude/agents/${posix}` });
    }
  }

  // The same bodies, verbatim. No transform: the three keys the Claude copy adds are Claude Code's and
  // mean nothing here, and there is no subagent tree to go with them — the skills already write
  // delegation as optional.
  if (adapters.includes('agents')) {
    for (const name of SKILL_NAMES) {
      for (const rel of skillFiles(name)) {
        files.push({
          source: `skills/${name}/${rel}`,
          dest: `${ADAPTER_SKILL_DIRS.agents}/${name}/${rel}`,
        });
      }
    }
  }

  return files;
}

/**
 * Project-owned files. Written once, at install, and never reachable by `update`.
 *
 * `onboard` marks the six whose content a person supplies, through `/onboard`. The other three are
 * written by the workflow as it runs — a roadmap entry, a history row, a finding — so a question about
 * their shape is `check`'s, and pointing at `/onboard` for one of them would name a command that does not
 * touch it.
 */
export const STUBS: ReadonlyArray<{ source: string; dest: string; onboard: boolean }> = [
  { source: 'stubs/stack.md', dest: 'context/stack.md', onboard: true },
  { source: 'stubs/verify.md', dest: 'context/verify.md', onboard: true },
  { source: 'stubs/executors.md', dest: 'context/executors.md', onboard: true },
  { source: 'stubs/git.md', dest: 'context/git.md', onboard: true },
  { source: 'stubs/tracking.md', dest: 'context/tracking.md', onboard: true },
  { source: 'stubs/release.md', dest: 'context/release.md', onboard: true },
  { source: 'stubs/roadmap.md', dest: 'context/roadmap.md', onboard: false },
  { source: 'stubs/history.md', dest: 'context/history.md', onboard: false },
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
