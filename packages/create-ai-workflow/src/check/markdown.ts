export interface TableRow {
  line: number;
  cells: string[];
}

export interface Table {
  /** 1-based line of the header row. */
  line: number;
  header: string[];
  rows: TableRow[];
}

/**
 * Blank out HTML comments, preserving line count so reported line numbers stay true. The stubs ship their
 * example entries commented out, so a parser that reads them would find a phantom roadmap entry on a fresh
 * install.
 */
export function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, ' '));
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Every GitHub-flavoured pipe table in the text. */
export function parseTables(text: string): Table[] {
  const lines = text.split('\n');
  const tables: Table[] = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    const header = lines[i] as string;
    const separator = lines[i + 1] as string;
    if (!header.trim().startsWith('|') || !SEPARATOR.test(separator)) continue;

    const table: Table = { line: i + 1, header: splitCells(header), rows: [] };
    let j = i + 2;
    for (; j < lines.length; j += 1) {
      const row = lines[j] as string;
      if (!row.trim().startsWith('|')) break;
      table.rows.push({ line: j + 1, cells: splitCells(row) });
    }
    tables.push(table);
    i = j - 1;
  }

  return tables;
}

/** The link targets in a line of markdown, in order. */
export function linkTargets(line: string): string[] {
  const out: string[] = [];
  const pattern = /\]\(([^)\s]+)/g;
  for (let m = pattern.exec(line); m !== null; m = pattern.exec(line)) out.push(m[1] as string);
  return out;
}
