import path from 'node:path';
import { runChecks } from '../check/rules.ts';
import { CONTEXT_DIR } from '../layout.ts';
import { bold, dim, green, info, red, UserError, yellow } from '../log.ts';
import { exists } from '../paths.ts';

/**
 * Reports structural breakage and nothing else. It never writes — there is no `--fix`, because the moment
 * it can repair a ledger, a program's edit competes with a hand edit. Nothing depends on it: delete it and
 * every workflow answer is unchanged.
 */
export function check(root: string): number {
  if (!exists(path.join(root, CONTEXT_DIR))) {
    throw new UserError(
      `no ${CONTEXT_DIR}/ in ${root} — nothing to check.\n` +
        '  Run `npx @baldurpan/create-ai-workflow` to install the overlay.',
    );
  }

  const problems = runChecks(root);
  const errors = problems.filter((p) => p.level === 'error');
  const notes = problems.filter((p) => p.level === 'note');

  if (problems.length === 0) {
    info(`${green('ok')} roadmap, plans, history and findings are structurally sound`);
    return 0;
  }

  for (const problem of problems) {
    const marker = problem.level === 'error' ? red('error') : yellow('note ');
    const where = problem.line ? `${problem.file}:${problem.line}` : problem.file;
    info(`${marker} ${bold(where)}`);
    info(`      ${problem.message}`);
    info(`      ${dim(problem.rule)}`);
    info();
  }

  const parts: string[] = [];
  if (errors.length) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
  if (notes.length) parts.push(`${notes.length} note${notes.length === 1 ? '' : 's'}`);
  info(parts.join(', '));
  if (errors.length === 0) {
    info(dim('Notes do not fail the check — nothing here is structurally broken.'));
  }

  return errors.length > 0 ? 1 : 0;
}
