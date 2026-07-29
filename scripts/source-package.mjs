#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const [sourceRootArg, entry, output] = process.argv.slice(2);
if (!sourceRootArg || !entry || !output) {
  throw new Error('Usage: node scripts/source-package.mjs <source-root> <entry> <output>');
}

const sourceRoot = resolve(sourceRootArg);
const extension = entry.endsWith('.ui') ? '.ui' : '.blp';
const files = readdirSync(sourceRoot, { recursive: true })
  .filter((path) => typeof path === 'string' && path.endsWith(extension))
  .map((path) => ({ path, content: readFileSync(join(sourceRoot, path), 'utf8') }));

if (!files.some((file) => file.path === entry)) {
  throw new Error(`Entry ${entry} was not found below ${sourceRoot}`);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ version: 1, entry, files }, null, 2)}\n`);
console.log(`Packaged ${files.length} ${extension} source files from ${relative(process.cwd(), sourceRoot) || '.'}`);
