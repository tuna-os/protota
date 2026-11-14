/**
 * Shell quoting for the pasted write-back command (src/utils/shellQuote.ts).
 *
 * The hostile cases run through a real `sh`: the claim is about what a shell
 * does with the text, so string comparison alone would not prove it.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { shellQuote, shellQuotePath } from '../utils/shellQuote';

/** What `sh` passes to a program as the one argument written as `word`. */
const argumentSeenBySh = (word: string, env: Record<string, string> = {}): string =>
  execFileSync('sh', ['-c', `printf '%s' ${word}`], {
    encoding: 'utf8',
    // A word that is not literal can redirect into a file; keep that out of the checkout.
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? '', ...env },
  });

describe('shellQuote', () => {
  it('leaves plain words bare', () => {
    expect(shellQuote('untitled-gnome-app.mockup.json')).toBe('untitled-gnome-app.mockup.json');
    expect(shellQuote('/home/me/src/calc')).toBe('/home/me/src/calc');
  });

  it('single-quotes anything else', () => {
    expect(shellQuote('/home/me/My Apps/calc')).toBe("'/home/me/My Apps/calc'");
    expect(shellQuote('my-app-(v2).mockup.json')).toBe("'my-app-(v2).mockup.json'");
    expect(shellQuote('')).toBe("''");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  it.each([
    'a;echo;.mockup.json',
    'a|cat',
    'a&&echo',
    'a(b)',
    '$(echo run).mockup.json',
    '`echo run`',
    '$MARK',
    'a"$(echo run)"',
    "a'$(echo run)'",
    'a\\$(echo run)',
    'a>b<c',
    'a b\tc',
    '*?[a]#!~',
  ])('reaches the program as the literal text: %s', (value) => {
    expect(argumentSeenBySh(shellQuote(value), { MARK: 'expanded' })).toBe(value);
  });
});

describe('shellQuotePath', () => {
  it('keeps a leading ~/ for the shell to expand', () => {
    expect(shellQuotePath('~/src/gnome-calculator')).toBe('~/src/gnome-calculator');
    expect(shellQuotePath('~/My Apps/calc')).toBe("~/'My Apps/calc'");
  });

  it('quotes the rest of a home-relative path literally', () => {
    const seen = argumentSeenBySh(shellQuotePath('~/a;echo run'), { HOME: '/home/me' });
    expect(seen).toBe('/home/me/a;echo run');
  });

  it('quotes other paths as one word', () => {
    expect(shellQuotePath('/home/me/My Apps/calc')).toBe("'/home/me/My Apps/calc'");
  });
});
