/**
 * Quoting for commands the app shows for the user to paste into a terminal.
 *
 * The values come from the open document (its title) and from typed paths, so
 * the shell must read each one as a single literal word. Single quotes are
 * the only POSIX quoting with no expansion inside; double quotes still expand
 * `$(...)`, backticks and `$VAR`.
 */

/** Characters every POSIX shell passes through unchanged anywhere in a word. */
const BARE_WORD = /^[A-Za-z0-9_@%+:,./-]+$/;

/** One literal shell word: bare when it needs no quoting, else single-quoted. */
export function shellQuote(value: string): string {
  if (BARE_WORD.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** As {@link shellQuote}, but a leading `~/` stays bare so the shell expands it. */
export function shellQuotePath(path: string): string {
  return path.startsWith('~/') ? `~/${shellQuote(path.slice(2))}` : shellQuote(path);
}
