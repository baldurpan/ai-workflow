import { linkTargets, parseTables, stripComments, type Table } from './markdown.ts';

export const PHASE_STATUSES = ['not started', 'in progress', 'blocked', 'done'] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export const FEATURE_MARKERS = ['pending', 'active'] as const;

export interface RoadmapEntry {
  name: string;
  marker: string;
  line: number;
  /** The `**Doc:**` link target, relative to `context/`. */
  doc: string | null;
  docLine: number | null;
}

export function parseRoadmap(text: string): RoadmapEntry[] {
  const lines = stripComments(text).split('\n');
  const entries: RoadmapEntry[] = [];
  let current: RoadmapEntry | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;

    const heading = /^###\s+(.*\S)\s*$/.exec(line);
    if (heading) {
      current = null;
      const text = heading[1] as string;
      const marker = /`([^`]+)`\s*$/.exec(text);
      if (!marker) continue;
      const name = text
        .slice(0, marker.index)
        .replace(/[\s—–-]+$/, '')
        .trim();
      if (!name) continue;
      current = { name, marker: (marker[1] as string).trim(), line: i + 1, doc: null, docLine: null };
      entries.push(current);
      continue;
    }

    if (/^##\s/.test(line)) current = null;
    if (!current || current.doc !== null) continue;

    if (/^\s*[-*]\s*\*\*Doc:?\*\*/i.test(line)) {
      current.docLine = i + 1;
      current.doc = linkTargets(line)[0] ?? null;
    }
  }

  return entries;
}

export interface LedgerRow {
  line: number;
  number: number | null;
  name: string;
  status: string;
  dependsOn: number[];
  dependsRaw: string;
}

export interface Ledger {
  table: Table;
  columns: string[];
  rows: LedgerRow[];
}

const isPhaseTable = (table: Table): boolean => {
  const lower = table.header.map((c) => c.toLowerCase());
  return lower.includes('phase') && lower.includes('status');
};

/** Every table in a plan that looks like a phase ledger. More than one is itself a finding. */
export function parseLedgers(text: string): Ledger[] {
  return parseTables(stripComments(text))
    .filter(isPhaseTable)
    .map((table) => {
      const index = (name: string) => table.header.findIndex((c) => c.toLowerCase() === name);
      const numberAt = index('#');
      const phaseAt = index('phase');
      const statusAt = index('status');
      const dependsAt = index('depends on');

      const rows: LedgerRow[] = table.rows.map((row) => {
        const raw = dependsAt === -1 ? '' : (row.cells[dependsAt] ?? '');
        const numberCell = numberAt === -1 ? '' : (row.cells[numberAt] ?? '');
        const parsedNumber = Number.parseInt(numberCell.trim(), 10);
        return {
          line: row.line,
          number: Number.isNaN(parsedNumber) ? null : parsedNumber,
          name: phaseAt === -1 ? '' : (row.cells[phaseAt] ?? ''),
          status: (statusAt === -1 ? '' : (row.cells[statusAt] ?? '')).replace(/`/g, '').trim(),
          dependsRaw: raw,
          dependsOn: parseDepends(raw),
        };
      });

      return { table, columns: table.header, rows };
    });
}

function parseDepends(raw: string): number[] {
  const cleaned = raw.replace(/[`*]/g, '').trim().toLowerCase();
  if (cleaned === '' || cleaned === '—' || cleaned === '–' || cleaned === '-' || cleaned === 'none') {
    return [];
  }
  return cleaned
    .split(/[,\s]+/)
    .map((part) => Number.parseInt(part.replace(/[^0-9]/g, ''), 10))
    .filter((n) => !Number.isNaN(n));
}

export interface Finding {
  id: string;
  line: number;
  section: 'Open' | 'Closed' | null;
  heading: string;
}

export function parseFindings(text: string): Finding[] {
  const lines = stripComments(text).split('\n');
  let section: Finding['section'] = null;
  const out: Finding[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    const h2 = /^##\s+(\S+)/.exec(line);
    if (h2) {
      const name = (h2[1] as string).toLowerCase();
      section = name === 'open' ? 'Open' : name === 'closed' ? 'Closed' : null;
      continue;
    }
    const h3 = /^###\s+(F-\d+)\b(.*)$/.exec(line);
    if (h3) out.push({ id: h3[1] as string, line: i + 1, section, heading: (h3[2] as string).trim() });
  }

  return out;
}

export interface HistoryRow {
  line: number;
  feature: string;
  documents: string[];
}

export function parseHistory(text: string): HistoryRow[] {
  const table = parseTables(stripComments(text)).find((t) =>
    t.header.map((c) => c.toLowerCase()).includes('feature'),
  );
  if (!table) return [];
  const featureAt = table.header.findIndex((c) => c.toLowerCase() === 'feature');

  return table.rows.map((row) => ({
    line: row.line,
    feature: (featureAt === -1 ? '' : (row.cells[featureAt] ?? '')).trim(),
    documents: row.cells.flatMap((cell) => linkTargets(cell)),
  }));
}

/** Lines carrying a `**Status:**` header — the one thing no document under `context/` may state. */
export function statusHeaderLines(text: string): number[] {
  return stripComments(text)
    .split('\n')
    .map((line, i) => (/^\s*\*\*Status:?\*\*/i.test(line) ? i + 1 : 0))
    .filter((n) => n > 0);
}
