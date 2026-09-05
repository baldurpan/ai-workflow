import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { apply as applyBlock, BlockConflictError } from '../agents-block.ts';
import {
  ADAPTER_SKILL_DIRS,
  AGENTS_BLOCK_KEY,
  CONTEXT_DIR,
  DEFAULT_ADAPTERS,
  STUB_DIRS,
  STUBS,
  agentsBlockBody,
  managedFiles,
  readTemplate,
  renderManaged,
} from '../layout.ts';
import { bold, cyan, dim, green, info, UserError, warn } from '../log.ts';
import { SCHEMA_VERSION, writeManifest, type Manifest } from '../manifest.ts';
import { exists, hash, packageVersion } from '../paths.ts';

const CLAUDE_MD_IMPORT = '@AGENTS.md';

function write(root: string, dest: string, content: string): void {
  const full = path.join(root, dest);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

export function install(root: string): number {
  if (exists(path.join(root, CONTEXT_DIR))) {
    throw new UserError(
      `${CONTEXT_DIR}/ already exists in ${root}.\n` +
        '  This tool overlays onto a repository that does not have one; it does not merge into an\n' +
        '  existing directory. If this is an earlier install, run `update` instead. If it is yours,\n' +
        '  move it aside first.',
    );
  }

  const adapters = DEFAULT_ADAPTERS;
  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    version: packageVersion(),
    adapters: [...adapters],
    managedFiles: {},
  };

  info(bold('Installing the ai-workflow overlay'));
  info();

  const managed = managedFiles(adapters);
  for (const file of managed) {
    const content = renderManaged(file);
    write(root, file.dest, content);
    manifest.managedFiles[file.dest] = hash(content);
  }
  info(`${green('+')} ${managed.length} tool-owned files ${dim('(replaced on update)')}`);
  info(
    dim(
      `    the seven skills go to ${adapters.map((a) => `${ADAPTER_SKILL_DIRS[a]}/`).join(' and ')} — ` +
        'one body, one directory per host, neither hand-edited',
    ),
  );

  for (const stub of STUBS) {
    write(root, stub.dest, readTemplate(stub.source));
  }
  for (const dir of STUB_DIRS) {
    write(root, `${dir}/.gitkeep`, '');
  }
  info(
    `${green('+')} ${STUBS.length} project-owned stubs and ${STUB_DIRS.length} directories ` +
      `${dim('(yours — the updater cannot reach them)')}`,
  );

  const agentsPath = path.join(root, 'AGENTS.md');
  const body = agentsBlockBody();
  const before = exists(agentsPath) ? readFileSync(agentsPath, 'utf8') : null;
  try {
    writeFileSync(agentsPath, applyBlock(before, body), 'utf8');
  } catch (error) {
    if (error instanceof BlockConflictError) throw new UserError(error.message);
    throw error;
  }
  manifest.managedFiles[AGENTS_BLOCK_KEY] = hash(body);
  info(`${green(before === null ? '+' : '~')} AGENTS.md ${dim('— the delimited block only')}`);

  const claudeMdPath = path.join(root, 'CLAUDE.md');
  if (!exists(claudeMdPath)) {
    writeFileSync(
      claudeMdPath,
      `# CLAUDE.md\n\n${CLAUDE_MD_IMPORT}\n\nThe import above is this project's agent-neutral instruction set, expanded into context at launch.\n**Everything that is not Claude-Code-specific belongs there, not here.**\n`,
      'utf8',
    );
    info(`${green('+')} CLAUDE.md ${dim(`— one ${CLAUDE_MD_IMPORT} line. Yours from here on.`)}`);
  } else if (!readFileSync(claudeMdPath, 'utf8').includes(CLAUDE_MD_IMPORT)) {
    warn(
      `CLAUDE.md exists without an ${CLAUDE_MD_IMPORT} import — left untouched.\n` +
        `  Add the single line ${cyan(CLAUDE_MD_IMPORT)} to it so the block above reaches Claude Code.`,
    );
  }

  writeManifest(root, manifest);

  info();
  info(bold('Next'));
  info(`  1. Review the diff. ${dim('Nothing was committed — that is deliberate.')}`);
  info(`  2. Run ${cyan('/onboard')} in your agent to fill in verify.md, executors.md and stack.md.`);
  if (before !== null) {
    info(
      dim(
        '     AGENTS.md already said things of its own — /onboard folds those into the three files\n' +
          '     above and prunes what it moved, asking before anything is deleted.',
      ),
    );
  }
  info(`  3. ${cyan('/roadmap "some idea"')} starts the loop.`);
  return 0;
}
