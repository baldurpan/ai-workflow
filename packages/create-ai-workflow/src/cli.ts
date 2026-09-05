import path from 'node:path';
import { check } from './commands/check.ts';
import { install } from './commands/install.ts';
import { standardsAdd } from './commands/standards-add.ts';
import { update } from './commands/update.ts';
import { bold, cyan, dim, info, UserError } from './log.ts';
import { packageVersion } from './paths.ts';

const USAGE = `${bold('create-ai-workflow')} — overlay a tiered planning workflow onto an existing repository

${bold('Usage')}
  npx @baldurpan/create-ai-workflow                      install into this repository
  npm  create @baldurpan/ai-workflow                     the same thing, shorter
  npx @baldurpan/create-ai-workflow update               replace the tool-owned files with this version
  npx @baldurpan/create-ai-workflow standards add <url>  swap context/standards/ for a git repository
  npx @baldurpan/create-ai-workflow check                report structural breakage; never writes

${bold('Options')}
  --dir <path>        act on this directory instead of the working directory
  --dry-run           ${dim('update:')} print the plan and change nothing
  --force             ${dim('update:')} back up edited files (.bak) and take ours
  --generate-index    ${dim('standards add:')} build a conditional-loading table without asking
  --version, --help

${bold('What it installs')}
  context/            the workflow's documents. Tool-owned files are replaced on update; your
                      roadmap, plans, findings, stack, verify and executors never are.
  .claude/            eight skills and two subagent definitions, for Claude Code.
  .agents/            the same eight skills, for Codex and anything else reading that tree.
  AGENTS.md           a delimited block, merged into whatever is already there.
  CLAUDE.md           a single ${cyan('@AGENTS.md')} line, and only if the file does not exist.

Nothing is committed. Review the diff, then run ${cyan('/onboard')} in your agent.
`;

interface Args {
  command: string;
  rest: string[];
  dir: string;
  dryRun: boolean;
  force: boolean;
  generateIndex: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: '',
    rest: [],
    dir: process.cwd(),
    dryRun: false,
    force: false,
    generateIndex: false,
    help: false,
    version: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    switch (arg) {
      case '--dir':
        i += 1;
        args.dir = path.resolve(argv[i] ?? '.');
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--generate-index':
        args.generateIndex = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--version':
      case '-v':
        args.version = true;
        break;
      default:
        if (arg.startsWith('-')) throw new UserError(`unknown option ${arg}`);
        positional.push(arg);
    }
  }

  args.command = positional[0] ?? 'install';
  args.rest = positional.slice(1);
  return args;
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  if (args.help) {
    info(USAGE);
    return 0;
  }
  if (args.version) {
    info(packageVersion());
    return 0;
  }

  switch (args.command) {
    case 'install':
      return install(args.dir);
    case 'update':
      return update(args.dir, { dryRun: args.dryRun, force: args.force });
    case 'check':
      return check(args.dir);
    case 'standards': {
      const [sub, url] = args.rest;
      if (sub !== 'add') {
        throw new UserError('the only standards subcommand is `standards add <git-url>`');
      }
      if (!url) throw new UserError('`standards add` needs a git URL');
      return standardsAdd(args.dir, url, { generateIndex: args.generateIndex });
    }
    default:
      throw new UserError(
        `unknown command \`${args.command}\`. Run with --help for the four it knows.`,
      );
  }
}
