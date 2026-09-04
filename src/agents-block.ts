/**
 * The AGENTS.md block. The tool never owns that file — it owns a delimited region inside it, and
 * everything outside the markers is the user's.
 */

export const START_MARKER = '<!-- ai-workflow:start -->';
export const END_MARKER = '<!-- ai-workflow:end -->';

export type BlockState =
  /** No AGENTS.md at all. */
  | { kind: 'no-file' }
  /** The file exists but carries no block. */
  | { kind: 'no-markers' }
  /** Exactly one well-formed block. `body` is its content, trimmed. */
  | { kind: 'present'; body: string; start: number; end: number }
  /** A second paste. Refuse — replacing one of two is a coin flip. */
  | { kind: 'duplicate'; count: number }
  /** Unclosed, inverted, or an end with no start. Refuse; never re-append blindly. */
  | { kind: 'malformed'; reason: string };

function allIndexesOf(haystack: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) {
    out.push(i);
  }
  return out;
}

export function inspect(text: string | null): BlockState {
  if (text === null) return { kind: 'no-file' };

  const starts = allIndexesOf(text, START_MARKER);
  const ends = allIndexesOf(text, END_MARKER);

  if (starts.length === 0 && ends.length === 0) return { kind: 'no-markers' };
  if (starts.length > 1 || ends.length > 1) {
    return { kind: 'duplicate', count: Math.max(starts.length, ends.length) };
  }
  if (starts.length === 1 && ends.length === 0) {
    return { kind: 'malformed', reason: 'an opening marker with no closing marker' };
  }
  if (starts.length === 0 && ends.length === 1) {
    return { kind: 'malformed', reason: 'a closing marker with no opening marker' };
  }

  const start = starts[0] as number;
  const end = ends[0] as number;
  if (end < start) {
    return { kind: 'malformed', reason: 'the closing marker appears before the opening marker' };
  }

  const body = text.slice(start + START_MARKER.length, end).trim();
  return { kind: 'present', body, start, end: end + END_MARKER.length };
}

/** The full block, markers included, as it is written into a file. */
export function render(body: string): string {
  return `${START_MARKER}\n${body.trim()}\n${END_MARKER}`;
}

export class BlockConflictError extends Error {}

/**
 * The file text after writing `body` into it. Refuses on `duplicate` and `malformed` — those are the two
 * states where guessing which region to replace could destroy the user's own content.
 */
export function apply(text: string | null, body: string): string {
  const state = inspect(text);
  const block = render(body);

  switch (state.kind) {
    case 'no-file':
      return `# AGENTS.md\n\nThe agent-neutral entry point for this repository.\n\n${block}\n`;
    case 'no-markers': {
      const existing = (text as string).replace(/\s+$/, '');
      return `${existing}\n\n${block}\n`;
    }
    case 'present': {
      const before = (text as string).slice(0, state.start);
      const after = (text as string).slice(state.end);
      return `${before}${block}${after}`;
    }
    case 'duplicate':
      throw new BlockConflictError(
        `AGENTS.md contains ${state.count} ai-workflow blocks. Delete the extra one, then re-run — ` +
          'replacing one of two would be a coin flip.',
      );
    case 'malformed':
      throw new BlockConflictError(
        `AGENTS.md has ${state.reason}. Fix the markers by hand, then re-run — re-appending blindly ` +
          'would leave two partial blocks.',
      );
  }
}
