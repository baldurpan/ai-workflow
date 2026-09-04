#!/usr/bin/env node
import { main } from './cli.ts';
import { fail, UserError } from './log.ts';

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof UserError) fail(error.message);
    else fail((error as Error).stack ?? String(error));
    process.exitCode = 1;
  });
