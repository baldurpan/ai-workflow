import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { apply as applyBlock, BlockConflictError, inspect } from '../agents-block.ts';
import {
  AGENTS_BLOCK_KEY,
  STANDARDS_PREFIX,
  agentsBlockBody,
  managedFiles,
  renderManaged,
  type ManagedFile,
} from '../layout.ts';
import { bold, cyan, dim, green, info, red, UserError, warn, yellow } from '../log.ts';
import { readManifest, writeManifest } from '../manifest.ts';
import { exists, hash, packageVersion } from '../paths.ts';

type Action = 'replace' | 'restore' | 'unchanged' | 'conflict' | 'remove' | 'adopt';

interface Step {
  dest: string;
  action: Action;
  note?: string;
}

const LABEL: Record<Action, string> = {
  replace: green('update '),
  restore: green('restore'),
  unchanged: dim('same   '),
  conflict: red('CONFLICT'),
  remove: yellow('remove '),
  adopt: yellow('adopt  '),
};

function readIfExists(file: string): string | null {
  return exists(file) ? readFileSync(file, 'utf8') : null;
}

function sourceRef(text: string | null): string | null {
  return text ? (/^ref=(.+)$/m.exec(text)?.[1]?.trim() ?? null) : null;
}

export function update(root: string, options: { dryRun: boolean; force: boolean }): number {
  const manifest = readManifest(root);
  const files = managedFiles(manifest.adapters);
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
      steps.push({ dest: file.dest, action: 'restore' });
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
  info(dim(`adapters: ${manifest.adapters.join(', ')}`));
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
  info(`  ${cyan('yours, untouched')}    ${dim('context/stack.md, verify.md, executors.md, roadmap.md,')}`);
  info(`                      ${dim('history.md, findings.md, drafts/, plans/, archive/, CLAUDE.md,')}`);
  info(`                      ${dim('and anything else you have added under context/')}`);
  info(dim('  A project-owned file is not in the manifest, so no code path here reaches it.'));

  const installedRef = sourceRef(readIfExists(path.join(root, `${STANDARDS_PREFIX}.source`)));
  const bundledRef = sourceRef(renderManagedSourceMarker(files));
  if (installedRef && bundledRef && installedRef !== bundledRef && !standardsAdopted) {
    info();
    info(`${yellow('!')} the bundled standards moved: ${dim(installedRef.slice(0, 8))} → ${dim(bundledRef.slice(0, 8))}`);
  }

  if (options.dryRun) {
    info();
    info(dim('--dry-run: nothing was written.'));
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
  writeManifest(root, manifest);

  info();
  info(`${green('done')} ${written} file${written === 1 ? '' : 's'} written. Review the diff — nothing was committed.`);
  return 0;
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
