import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { apply as applyBlock, BlockConflictError, inspect } from '../agents-block.ts';
import {
  AGENTS_BLOCK_KEY,
  DEFAULT_ADAPTERS,
  STANDARDS_PREFIX,
  STUB_DIRS,
  STUBS,
  agentsBlockBody,
  managedFiles,
  renderManaged,
  type ManagedFile,
} from '../layout.ts';
import { bold, cyan, dim, green, info, red, UserError, yellow } from '../log.ts';
import { readManifest, writeManifest } from '../manifest.ts';
import { exists, hash, packageVersion } from '../paths.ts';
import { retiredFiles, stubGaps, type RetiredFile, type StubGap } from '../stubs.ts';

type Action = 'replace' | 'restore' | 'add' | 'unchanged' | 'conflict' | 'remove' | 'adopt';

interface Step {
  dest: string;
  action: Action;
  note?: string;
}

const LABEL: Record<Action, string> = {
  replace: green('update '),
  restore: green('restore'),
  add: green('add    '),
  unchanged: dim('same   '),
  conflict: red('CONFLICT'),
  remove: yellow('remove '),
  adopt: yellow('adopt  '),
};

function readIfExists(file: string): string | null {
  return exists(file) ? readFileSync(file, 'utf8') : null;
}

/**
 * The project-owned list, derived from `STUBS` and `STUB_DIRS` rather than retyped. §4.1 makes the
 * ownership boundary a property of the data structure; a hand-written copy of it here would be a second
 * place to remember, and it was already one stub out of date before this was derived.
 */
function projectOwnedLines(width = 62): string[] {
  const names = [
    `context/${path.posix.basename(STUBS[0]?.dest ?? '')}`,
    ...STUBS.slice(1).map((s) => path.posix.basename(s.dest)),
    ...STUB_DIRS.map((d) => `${path.posix.basename(d)}/`),
    'CLAUDE.md',
  ];

  const lines: string[] = [];
  let line = '';
  for (const name of names) {
    const next = line ? `${line} ${name},` : `${name},`;
    if (line && next.length > width) {
      lines.push(line);
      line = `${name},`;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.push('and anything else you have added under context/');
  return lines;
}

function sourceRef(text: string | null): string | null {
  return text ? (/^ref=(.+)$/m.exec(text)?.[1]?.trim() ?? null) : null;
}

export function update(root: string, options: { dryRun: boolean; force: boolean }): number {
  const manifest = readManifest(root);

  // Adapters reconcile to what this version ships rather than to what the install recorded. An install
  // made before a tree existed is the only way that tree ever arrives, and a tree this version has
  // dropped falls through to the no-longer-shipped branch below and is removed. Both are reported.
  const adapters = DEFAULT_ADAPTERS;
  const gained = adapters.filter((a) => !manifest.adapters.includes(a));
  const dropped = manifest.adapters.filter((a) => !adapters.includes(a));

  const files = managedFiles(adapters);
  const byDest = new Map<string, ManagedFile>(files.map((f) => [f.dest, f]));

  // The standards tree is tool-owned only while it is ours and unmodified. One edited file makes the whole
  // tree the project's — half-managed is worse than either, because the README's conditional table and the
  // files it names have to agree.
  const standardsInManifest = Object.keys(manifest.managedFiles).filter((p) =>
    p.startsWith(STANDARDS_PREFIX),
  );
  const standardsEdited = standardsInManifest.some((dest) => {
    const onDisk = readIfExists(path.join(root, dest));
    return onDisk === null ? false : hash(onDisk) !== manifest.managedFiles[dest];
  });
  const standardsAdopted = standardsInManifest.length === 0 || standardsEdited;

  const steps: Step[] = [];

  for (const file of files) {
    if (file.dest.startsWith(STANDARDS_PREFIX) && standardsAdopted) continue;

    const recorded = manifest.managedFiles[file.dest];
    const target = renderManaged(file);
    const onDisk = readIfExists(path.join(root, file.dest));

    if (onDisk === null) {
      steps.push(
        recorded === undefined
          ? { dest: file.dest, action: 'add', note: 'new in this version' }
          : { dest: file.dest, action: 'restore' },
      );
    } else if (recorded === undefined) {
      steps.push({
        dest: file.dest,
        action: 'conflict',
        note: 'exists but is not in the manifest — this tool did not write it',
      });
    } else if (hash(onDisk) === recorded) {
      steps.push({ dest: file.dest, action: hash(target) === recorded ? 'unchanged' : 'replace' });
    } else {
      steps.push({ dest: file.dest, action: 'conflict', note: 'edited since it was installed' });
    }
  }

  if (standardsAdopted && standardsInManifest.length > 0) {
    steps.push({
      dest: `${STANDARDS_PREFIX}*`,
      action: 'adopt',
      note: 'edited — the whole standards tree becomes project-owned and drops out of the manifest',
    });
  }

  // Anything the manifest still lists that this version no longer ships.
  for (const dest of Object.keys(manifest.managedFiles)) {
    if (dest === AGENTS_BLOCK_KEY || byDest.has(dest)) continue;
    if (dest.startsWith(STANDARDS_PREFIX) && standardsAdopted) continue;
    const onDisk = readIfExists(path.join(root, dest));
    if (onDisk === null) continue;
    steps.push(
      hash(onDisk) === manifest.managedFiles[dest]
        ? { dest, action: 'remove', note: 'no longer shipped' }
        : { dest, action: 'conflict', note: 'no longer shipped, and edited — left in place' },
    );
  }

  // The AGENTS.md block.
  const agentsPath = path.join(root, 'AGENTS.md');
  const agentsText = readIfExists(agentsPath);
  const body = agentsBlockBody();
  const state = inspect(agentsText);
  const recordedBlock = manifest.managedFiles[AGENTS_BLOCK_KEY];
  let blockStep: Step;
  if (state.kind === 'duplicate' || state.kind === 'malformed') {
    blockStep = { dest: AGENTS_BLOCK_KEY, action: 'conflict', note: describeBad(state) };
  } else if (state.kind === 'no-file' || state.kind === 'no-markers') {
    blockStep = { dest: AGENTS_BLOCK_KEY, action: 'restore' };
  } else if (hash(state.body) === recordedBlock) {
    blockStep = {
      dest: AGENTS_BLOCK_KEY,
      action: hash(body) === recordedBlock ? 'unchanged' : 'replace',
    };
  } else {
    blockStep = { dest: AGENTS_BLOCK_KEY, action: 'conflict', note: 'edited since it was installed' };
  }
  steps.push(blockStep);

  // Report.
  info(bold(`ai-workflow ${manifest.version} → ${packageVersion()}`));
  info(
    dim(
      gained.length || dropped.length
        ? `adapters: ${manifest.adapters.join(', ')} → ${adapters.join(', ')}`
        : `adapters: ${adapters.join(', ')}`,
    ),
  );
  info();

  const conflicts = steps.filter((s) => s.action === 'conflict');
  const changing = steps.filter((s) => s.action !== 'unchanged');

  if (changing.length === 0) {
    info(green('Everything tool-owned is already up to date.'));
  }
  for (const step of changing) {
    info(`  ${LABEL[step.action]} ${step.dest}${step.note ? dim(`  — ${step.note}`) : ''}`);
  }
  const same = steps.length - changing.length;
  if (same > 0) info(dim(`  ${same} file${same === 1 ? '' : 's'} already current`));

  info();
  info(bold('Ownership'));
  info(`  ${green('replaced by update')}  ${dim('the tool-owned files above — every one is in the manifest')}`);
  for (const [i, line] of projectOwnedLines().entries()) {
    const label = i === 0 ? `  ${cyan('yours, untouched')}    ` : '                      ';
    info(label + dim(line));
  }
  info(dim('  A project-owned file is not in the manifest, so no code path here reaches it.'));

  const installedRef = sourceRef(readIfExists(path.join(root, `${STANDARDS_PREFIX}.source`)));
  const bundledRef = sourceRef(renderManagedSourceMarker(files));
  if (installedRef && bundledRef && installedRef !== bundledRef && !standardsAdopted) {
    info();
    info(`${yellow('!')} the bundled standards moved: ${dim(installedRef.slice(0, 8))} → ${dim(bundledRef.slice(0, 8))}`);
  }

  const gaps = stubGaps(root);
  const retired = retiredFiles(root);

  if (options.dryRun) {
    info();
    info(dim('--dry-run: nothing was written.'));
    reportNext(gaps, retired);
    return conflicts.length > 0 && !options.force ? 1 : 0;
  }

  if (conflicts.length > 0 && !options.force) {
    info();
    throw new UserError(
      `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} — nothing was written.\n` +
        '  Each file above was edited after this tool wrote it. Re-run with --force to back up the\n' +
        '  edited copy alongside it (.bak) and take ours, or move your version aside first.',
    );
  }

  // Apply.
  let written = 0;
  for (const step of steps) {
    if (step.dest === AGENTS_BLOCK_KEY) continue;
    if (step.action === 'unchanged' || step.action === 'adopt') continue;
    const full = path.join(root, step.dest);

    if (step.action === 'remove') {
      rmSync(full, { force: true });
      delete manifest.managedFiles[step.dest];
      written += 1;
      continue;
    }
    if (step.action === 'conflict') {
      if (!byDest.has(step.dest)) continue; // no longer shipped and edited — leave it alone
      copyFileSync(full, `${full}.bak`);
    }
    const file = byDest.get(step.dest);
    if (!file) continue;
    const content = renderManaged(file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
    manifest.managedFiles[step.dest] = hash(content);
    written += 1;
  }

  if (standardsAdopted) {
    for (const dest of standardsInManifest) delete manifest.managedFiles[dest];
  }

  if (blockStep.action !== 'unchanged') {
    if (blockStep.action === 'conflict' && agentsText !== null) {
      copyFileSync(agentsPath, `${agentsPath}.bak`);
    }
    try {
      writeFileSync(agentsPath, applyBlock(agentsText, body), 'utf8');
    } catch (error) {
      if (error instanceof BlockConflictError) throw new UserError(error.message);
      throw error;
    }
    manifest.managedFiles[AGENTS_BLOCK_KEY] = hash(body);
    written += 1;
  }

  manifest.version = packageVersion();
  manifest.adapters = [...adapters];
  writeManifest(root, manifest);

  info();
  info(`${green('done')} ${written} file${written === 1 ? '' : 's'} written. Review the diff — nothing was committed.`);
  reportNext(gaps, retired);
  return 0;
}

/**
 * What this update leaves for a person. Printed last, because everything above it has already happened and
 * nothing here can: both halves are about project-owned files, which no code path in this tool reaches.
 *
 * These are notes, never errors — the exit code is the conflict count's to set. A tool that failed an
 * update over the contents of a file it is forbidden to touch would be reporting someone else's business
 * as its own breakage.
 */
function reportNext(gaps: StubGap[], retired: RetiredFile[]): void {
  if (gaps.length === 0 && retired.length === 0) return;

  info();
  info(bold('Next'));

  for (const gap of gaps) {
    info(
      gap.section === undefined
        ? `  ${yellow('!')} ${gap.dest} ${dim('is missing — a stub is project-owned, so update cannot write one')}`
        : `  ${yellow('!')} ${gap.dest} ${dim(`has no "${gap.section}" section — this version's stub has one`)}`,
    );
  }
  if (gaps.length > 0) {
    info(
      `  Run ${cyan('/onboard')} in your agent. ${dim('It is re-runnable, and it is the only thing that')}`,
    );
    info(`  ${dim('reaches these files — the commands above now read them.')}`);
    if (retired.length > 0) info();
  }

  reportRetired(retired);
}

/**
 * Files this version has dropped, still sitting in the install. The rule that replaced them is in the
 * templates this update just wrote; what is already in the file is a person's to triage, because no
 * release can decide retrospectively what should have happened to a defect recorded a year ago.
 *
 * Reported, never touched. A project-owned file is outside the manifest by design, and a tool that started
 * deleting them would be reaching across the one boundary the whole ownership model rests on.
 */
function reportRetired(retired: RetiredFile[]): void {
  for (const file of retired) {
    info(
      `  ${yellow('!')} ${file.dest} ${dim('is no longer part of the workflow — nothing reads it any more')}`,
    );
    if (file.entries > 0) {
      info(`    ${dim(`${file.entries} ${file.entries === 1 ? 'entry is' : 'entries are'} still in it`)}`);
    }
    info(`    ${dim('A blocking defect now lives in its phase\'s ledger row — status `blocked`, the')}`);
    info(`    ${dim('reason in the Note — and anything that outlives its phase is an issue. Triage')}`);
    info(`    ${dim('what is in there once, then delete the file. Nothing here will: it is yours.')}`);
  }
}

function describeBad(state: { kind: 'duplicate'; count: number } | { kind: 'malformed'; reason: string }) {
  return state.kind === 'duplicate'
    ? `${state.count} ai-workflow blocks in AGENTS.md — delete the extra one`
    : `${state.reason} — fix the markers by hand`;
}

function renderManagedSourceMarker(files: ManagedFile[]): string | null {
  const marker = files.find((f) => f.dest === `${STANDARDS_PREFIX}.source`);
  return marker ? renderManaged(marker) : null;
}
