import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments, stripFences } from './check/markdown.ts';
import { readTemplate, STUBS } from './layout.ts';
import { exists } from './paths.ts';

export interface StubGap {
  /** The project-owned file, as an install-relative path. */
  dest: string;
  /** A `##` heading this version's stub has and the installed file does not. Absent when the file is. */
  section?: string;
}

/**
 * The `##` headings of a markdown document, in order.
 *
 * Fenced blocks and HTML comments are blanked first: the stubs ship their examples commented out and
 * `stack.md` carries a fenced layout sketch, and a heading inside either is an illustration rather than a
 * section of the document.
 */
export function sections(text: string): string[] {
  return [...stripComments(stripFences(text)).matchAll(/^## +(.+?)\s*$/gm)].map((m) => m[1] as string);
}

/** Backticks, case and run-together whitespace are formatting, not identity. */
function normalise(heading: string): string {
  return heading.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** A project-owned file a past version shipped and this one no longer reads. */
export interface RetiredFile {
  dest: string;
  /** Entries still in it, so the report can say how much triage is owed rather than just that some is. */
  entries: number;
}

/**
 * Files an install may still carry that this version has dropped from the workflow. `update` cannot remove
 * one — it is project-owned and absent from the manifest, which is the whole point of that boundary — so
 * the only thing this tool may do is say the file is no longer read and leave it exactly where it is.
 *
 * `context/findings.md` is the first: a blocking defect now lives in its phase's ledger row, and anything
 * that outlives its phase is an issue. Nothing reads the file, so what is in it is neither acted on nor
 * lost — it just sits there looking like state.
 */
export function retiredFiles(root: string): RetiredFile[] {
  const out: RetiredFile[] = [];

  const findings = path.join(root, 'context/findings.md');
  if (exists(findings)) {
    const text = stripComments(readFileSync(findings, 'utf8'));
    out.push({ dest: 'context/findings.md', entries: [...text.matchAll(/^### +F-\d+/gm)].length });
  }

  return out;
}

/**
 * What this version's stubs expect that the install does not have — a stub file that is missing outright,
 * or one whose sections this version has added to.
 *
 * `update` reports this and writes nothing. Stubs are project-owned and deliberately absent from the
 * manifest, so nothing here can reach them; `/onboard` is the only thing that fills one, and until it runs
 * a command can be pointed at a section of a file that does not have it.
 *
 * **Only the stubs `/onboard` fills are examined.** `roadmap.md` and `history.md` are written by the
 * workflow rather than by a person, so their shape is `check`'s question — and a report that named
 * `/onboard` for a file that command never opens would be sending someone somewhere useless.
 *
 * A section the user deleted on purpose and one this version added look identical from here, and both are
 * reported. Telling them apart would mean recording stub state in the manifest, which is the one place the
 * design keeps free of project-owned files — and the fix is the same either way.
 */
export function stubGaps(root: string): StubGap[] {
  const gaps: StubGap[] = [];

  for (const stub of STUBS.filter((s) => s.onboard)) {
    const full = path.join(root, stub.dest);
    if (!exists(full)) {
      gaps.push({ dest: stub.dest });
      continue;
    }

    const have = new Set(sections(readFileSync(full, 'utf8')).map(normalise));
    for (const section of sections(readTemplate(stub.source))) {
      if (!have.has(normalise(section))) gaps.push({ dest: stub.dest, section });
    }
  }

  return gaps;
}
