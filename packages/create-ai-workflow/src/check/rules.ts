import { readFileSync } from 'node:fs';
import path from 'node:path';
import { exists, walk } from '../paths.ts';
import {
  PHASE_STATUSES,
  parseFindings,
  parseHistory,
  parseLedgers,
  parseRoadmap,
  statusHeaderLines,
  type Ledger,
} from './parse.ts';

export interface Problem {
  level: 'error' | 'note';
  file: string;
  line?: number;
  message: string;
  /** The rule this enforces, and where it is written down. A false positive points at the stale doc. */
  rule: string;
}

/** Used only when `context/plan-template.md` is missing — the template is the source of truth. */
const FALLBACK_COLUMNS = ['#', 'Phase', 'Status', 'Depends on', 'Note'];

const RULES = {
  columns:
    'context/plan-template.notes.md — "the ledger\'s column set is fixed — `check` compares every plan\'s ledger against the template\'s"',
  status:
    'context/workflow.md — "Phase | the plan\'s ledger, Status column | `not started`, `in progress`, `blocked`, `done`"',
  depends:
    'context/workflow.md — "take the lowest-numbered phase that is not `done` and whose `Depends on` entries are all `done`"',
  active: 'context/workflow.md — "At most one roadmap entry is `active`."',
  statusHeader:
    'context/README.md — "No document states its own status. There is no `**Status:**` header anywhere under `context/`."',
  oneTable:
    'context/plan-template.md §6.1 — "Exactly one table in this document has these columns. Do not add a second phase table"',
  orphanPlan:
    'context/workflow.md — "whether a feature has a plan | whether its **Doc** field points into `plans/`"',
  deadLink:
    'context/workflow.md — "Each entry\'s **Doc** field points at its document" · "a link into `context/archive/`"',
  closedFinding:
    'context/findings.md — "Closed findings leave this file … This file must not grow for the life of the project."',
} as const;

function read(root: string, rel: string): string | null {
  const full = path.join(root, rel);
  return exists(full) ? readFileSync(full, 'utf8') : null;
}

export function expectedColumns(root: string): string[] {
  const template = read(root, 'context/plan-template.md');
  const ledger = template ? parseLedgers(template)[0] : undefined;
  return ledger ? ledger.columns : FALLBACK_COLUMNS;
}

/**
 * Reads `roadmap.md`, `plans/`, `history.md` and `findings.md` — never `archive/`. A retired plan encodes
 * whatever format was current when it was written, and validating historical records against current rules
 * is the false-positive machine that makes validators get ignored.
 */
export function runChecks(root: string): Problem[] {
  const problems: Problem[] = [];
  const columns = expectedColumns(root);

  const roadmapText = read(root, 'context/roadmap.md');
  const roadmap = roadmapText ? parseRoadmap(roadmapText) : [];

  if (roadmapText === null) {
    problems.push({
      level: 'error',
      file: 'context/roadmap.md',
      message: 'missing — the Tier-1 backlog is where every feature status lives',
      rule: RULES.active,
    });
  }

  // More than one entry marked `active`.
  const active = roadmap.filter((entry) => entry.marker === 'active');
  if (active.length > 1) {
    for (const entry of active) {
      problems.push({
        level: 'error',
        file: 'context/roadmap.md',
        line: entry.line,
        message: `"${entry.name}" is marked \`active\`, and so ${active.length === 2 ? 'is' : 'are'} ${active
          .filter((e) => e !== entry)
          .map((e) => `"${e.name}"`)
          .join(', ')}`,
        rule: RULES.active,
      });
    }
  }

  // A `Doc` field pointing at a missing file. Targets are relative to `context/`.
  for (const entry of roadmap) {
    if (!entry.doc || /^[a-z]+:/i.test(entry.doc)) continue;
    const target = path.join(root, 'context', decodeURI(entry.doc));
    if (!exists(target)) {
      problems.push({
        level: 'error',
        file: 'context/roadmap.md',
        line: entry.docLine ?? entry.line,
        message: `"${entry.name}" points its **Doc** at \`${entry.doc}\`, which does not exist`,
        rule: RULES.deadLink,
      });
    }
  }

  // A `history.md` link pointing at a missing file.
  const historyText = read(root, 'context/history.md');
  for (const row of historyText ? parseHistory(historyText) : []) {
    for (const target of row.documents) {
      if (/^[a-z]+:/i.test(target)) continue;
      if (!exists(path.join(root, 'context', decodeURI(target)))) {
        problems.push({
          level: 'error',
          file: 'context/history.md',
          line: row.line,
          message: `the row for "${row.feature}" links \`${target}\`, which does not exist`,
          rule: RULES.deadLink,
        });
      }
    }
  }

  // A closed finding still sitting in findings.md.
  const findingsText = read(root, 'context/findings.md');
  for (const finding of findingsText ? parseFindings(findingsText) : []) {
    if (finding.section === 'Closed') {
      problems.push({
        level: 'note',
        file: 'context/findings.md',
        line: finding.line,
        message: `${finding.id} is closed and still in the file — it belongs in the retiring plan's log`,
        rule: RULES.closedFinding,
      });
    }
  }

  // `**Status:**` headers, in the files this command reads.
  const scanned = [
    'context/roadmap.md',
    'context/history.md',
    'context/findings.md',
    ...planPaths(root),
  ];
  for (const rel of scanned) {
    const text = read(root, rel);
    if (text === null) continue;
    for (const line of statusHeaderLines(text)) {
      problems.push({
        level: 'error',
        file: rel,
        line,
        message: 'a `**Status:**` header — a document that states its own status is a copy that goes stale',
        rule: RULES.statusHeader,
      });
    }
  }

  // Every plan under plans/.
  const pointedAt = new Set(
    roadmap
      .filter((entry) => entry.doc?.startsWith('plans/'))
      .map((entry) => path.posix.normalize(entry.doc as string)),
  );

  for (const rel of planPaths(root)) {
    const text = read(root, rel) as string;
    const relFromContext = rel.slice('context/'.length);

    if (!pointedAt.has(relFromContext)) {
      problems.push({
        level: 'error',
        file: rel,
        message: 'no roadmap entry points at this plan — nothing can reach it, and nothing retires it',
        rule: RULES.orphanPlan,
      });
    }

    const ledgers = parseLedgers(text);
    if (ledgers.length === 0) {
      problems.push({
        level: 'error',
        file: rel,
        message: 'no phase ledger — a document in `plans/` is one that has an executable ledger',
        rule: RULES.columns,
      });
      continue;
    }
    if (ledgers.length > 1) {
      for (const ledger of ledgers.slice(1)) {
        problems.push({
          level: 'error',
          file: rel,
          line: ledger.table.line,
          message: `a second phase table (the first is at line ${(ledgers[0] as Ledger).table.line}) — a differently-shaped one nearby is a decoy that gets read by mistake`,
          rule: RULES.oneTable,
        });
      }
    }

    const ledger = ledgers[0] as Ledger;
    if (ledger.columns.join(' | ') !== columns.join(' | ')) {
      problems.push({
        level: 'error',
        file: rel,
        line: ledger.table.line,
        message: `ledger columns are \`${ledger.columns.join(' | ')}\`; the template's are \`${columns.join(' | ')}\``,
        rule: RULES.columns,
      });
    }

    for (const row of ledger.rows) {
      if (!(PHASE_STATUSES as readonly string[]).includes(row.status)) {
        problems.push({
          level: 'error',
          file: rel,
          line: row.line,
          message: `phase ${row.number ?? '?'} has status \`${row.status}\`; it must be one of ${PHASE_STATUSES.map((s) => `\`${s}\``).join(', ')}`,
          rule: RULES.status,
        });
      }
    }

    problems.push(...dependencyProblems(rel, ledger));
  }

  return problems;
}

function planPaths(root: string): string[] {
  const dir = path.join(root, 'context', 'plans');
  if (!exists(dir)) return [];
  return walk(dir)
    .filter((rel) => rel.endsWith('.md'))
    .map((rel) => path.posix.join('context/plans', rel.split(path.sep).join('/')));
}

function dependencyProblems(file: string, ledger: Ledger): Problem[] {
  const problems: Problem[] = [];
  const numbers = new Set(ledger.rows.map((row) => row.number).filter((n): n is number => n !== null));

  for (const row of ledger.rows) {
    for (const dependency of row.dependsOn) {
      if (!numbers.has(dependency)) {
        problems.push({
          level: 'error',
          file,
          line: row.line,
          message: `phase ${row.number ?? '?'} depends on phase ${dependency}, which is not in the ledger`,
          rule: RULES.depends,
        });
      }
    }
  }

  const edges = new Map<number, number[]>();
  for (const row of ledger.rows) {
    if (row.number !== null) edges.set(row.number, row.dependsOn.filter((d) => numbers.has(d)));
  }

  const state = new Map<number, 'visiting' | 'done'>();
  const reported = new Set<string>();

  const visit = (node: number, stack: number[]): void => {
    if (state.get(node) === 'done') return;
    if (state.get(node) === 'visiting') {
      const cycle = [...stack.slice(stack.indexOf(node)), node];
      const key = [...cycle].sort((a, b) => a - b).join(',');
      if (!reported.has(key)) {
        reported.add(key);
        problems.push({
          level: 'error',
          file,
          line: ledger.rows.find((row) => row.number === node)?.line,
          message: `the \`Depends on\` column forms a cycle: ${cycle.join(' → ')}`,
          rule: RULES.depends,
        });
      }
      return;
    }
    state.set(node, 'visiting');
    for (const next of edges.get(node) ?? []) visit(next, [...stack, node]);
    state.set(node, 'done');
  };

  for (const node of edges.keys()) visit(node, []);
  return problems;
}
