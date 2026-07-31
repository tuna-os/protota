/**
 * Join a native runtime probe dump (#58) to an app's imported source graph.
 *
 *   npx tsx scripts/match-runtime-profile.mjs <appId> --probe probe.json \
 *     [--source-root dir] [--entry file.blp] [--screen id] [--out report.json]
 *
 * The probe dump comes from the Broadway runner started with a /probe volume
 * (see docs/runtime-probe.md). The source bundle is imported exactly the way
 * the Broadway comparison spec imports it — recursive .blp/.ui/.vala under
 * the source root — so node ids line up with the comparison artifact.
 * Matching is by buildable ID first, then structural gtype ordinal within an
 * already-matched parent; never by pixel position.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blueprintBundleToDocument } from '../src/utils/blueprint';
import { matchRuntimeProfile } from '../src/utils/runtimeProfile';

const args = process.argv.slice(2);
const appId = args.find((argument) => !argument.startsWith('--'));
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const probePath = flag('--probe');
const sourceRoot = flag('--source-root') ?? process.env.BROADWAY_SOURCE_ROOT;
const entry = flag('--entry') ?? process.env.BROADWAY_SOURCE_ENTRY;
const screenId = flag('--screen') ?? process.env.BROADWAY_SCREEN_ID;
const outPath = flag('--out');

if (!appId || !probePath || !sourceRoot || !entry) {
  console.error('Usage: npx tsx scripts/match-runtime-profile.mjs <appId> --probe probe.json --source-root dir --entry file.blp [--screen id] [--out report.json]');
  process.exit(1);
}

const probe = JSON.parse(readFileSync(probePath, 'utf8'));
const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((dirent) => dirent.isFile() && /\.(blp|ui|vala)$/i.test(dirent.name))
  .map((dirent) => {
    const absolute = join(dirent.parentPath, dirent.name);
    return { path: relative(sourceRoot, absolute), content: readFileSync(absolute, 'utf8') };
  });
const document = blueprintBundleToDocument(files, entry, `GNOME ${appId}`);
const screen = document.screens.find((candidate) => candidate.id === screenId) ?? document.screens[0];
const report = matchRuntimeProfile(probe, screen.rootNode);

const summary = {
  appId,
  screen: screen.id,
  ...report,
};
if (outPath) writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
else console.log(JSON.stringify(summary, null, 2));
console.error(
  `${appId}: ${report.matchedNodes}/${report.sourceNodes} source nodes matched ` +
  `(${(report.matchRate * 100).toFixed(1)}% — ${report.byBuildableId} by buildable id, ` +
  `${report.byStructure} structural) against ${report.probeWidgets} probe widgets`,
);
