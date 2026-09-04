const useColour = process.stdout.isTTY && !process.env.NO_COLOR;

const wrap = (code: string) => (s: string) => (useColour ? `\x1b[${code}m${s}\x1b[0m` : s);

export const bold = wrap('1');
export const dim = wrap('2');
export const red = wrap('31');
export const green = wrap('32');
export const yellow = wrap('33');
export const cyan = wrap('36');

export function info(message = ''): void {
  process.stdout.write(`${message}\n`);
}

export function warn(message: string): void {
  process.stdout.write(`${yellow('!')} ${message}\n`);
}

export function fail(message: string): void {
  process.stderr.write(`${red('error')} ${message}\n`);
}

/** An error whose message is meant for the user — printed without a stack trace. */
export class UserError extends Error {}
