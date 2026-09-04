import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  apply,
  BlockConflictError,
  END_MARKER,
  inspect,
  render,
  START_MARKER,
} from '../src/agents-block.ts';

const BODY = '## Planning workflow\n\nsomething useful';

describe('AGENTS.md block', () => {
  it('creates the file when there is none', () => {
    const result = apply(null, BODY);
    assert.match(result, /^# AGENTS\.md/);
    assert.ok(result.includes(render(BODY)));
  });

  it('appends to a file that has no markers, leaving it intact', () => {
    const existing = '# AGENTS.md\n\nOur own rules.\n';
    const result = apply(existing, BODY);
    assert.ok(result.startsWith('# AGENTS.md\n\nOur own rules.'));
    assert.ok(result.includes(render(BODY)));
    assert.equal(result.match(new RegExp(START_MARKER, 'g'))?.length, 1);
  });

  it('replaces between the markers and never appends twice', () => {
    const once = apply('# AGENTS.md\n\nOurs.\n', BODY);
    const twice = apply(once, 'new body');
    assert.equal(twice.match(new RegExp(START_MARKER, 'g'))?.length, 1);
    assert.ok(twice.includes('new body'));
    assert.ok(!twice.includes('something useful'));
    assert.ok(twice.includes('Ours.'), 'content outside the block survives');
  });

  it('preserves content after the block', () => {
    const text = `# A\n\n${render('old')}\n\n## Trailing section\n\nkeep me\n`;
    const result = apply(text, 'new');
    assert.ok(result.includes('## Trailing section'));
    assert.ok(result.includes('keep me'));
    assert.ok(result.includes('new'));
  });

  it('refuses a duplicated block rather than guessing which to replace', () => {
    const text = `${render('a')}\n\n${render('b')}\n`;
    assert.equal(inspect(text).kind, 'duplicate');
    assert.throws(() => apply(text, BODY), BlockConflictError);
  });

  it('refuses an unclosed block', () => {
    const text = `# A\n\n${START_MARKER}\nbody\n`;
    assert.equal(inspect(text).kind, 'malformed');
    assert.throws(() => apply(text, BODY), BlockConflictError);
  });

  it('refuses a closing marker with no opening one', () => {
    assert.equal(inspect(`# A\n\nbody\n${END_MARKER}\n`).kind, 'malformed');
  });

  it('refuses inverted markers', () => {
    const text = `${END_MARKER}\nbody\n${START_MARKER}\n`;
    const state = inspect(text);
    assert.equal(state.kind, 'malformed');
    assert.match(state.kind === 'malformed' ? state.reason : '', /before the opening/);
  });

  it('reports the body so an edit can be detected by hash', () => {
    const state = inspect(apply(null, BODY));
    assert.equal(state.kind, 'present');
    assert.equal(state.kind === 'present' ? state.body : '', BODY);
  });
});
