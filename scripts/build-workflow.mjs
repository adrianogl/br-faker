#!/usr/bin/env node
/**
 * Package the Alfred workflow.
 *
 * Takes the bundle produced by `tsup` (dist/workflow/br-faker.cjs), drops it
 * next to info.plist and zips the result as a .alfredworkflow, which is what
 * Alfred installs on double-click.
 */
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const BUNDLE = join(root, 'dist', 'workflow', 'br-faker.cjs');
const STAGING = join(root, 'dist', 'alfred-br-faker');

// Committed at the repo root, not under the ignored dist/, so the file has a
// stable download URL on GitHub and can be installed without cloning.
const OUTPUT = join(root, 'alfred-br-faker.alfredworkflow');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(BUNDLE))) {
  console.error(`missing ${BUNDLE} — run "npm run build" first`);
  process.exit(1);
}

await rm(STAGING, { recursive: true, force: true });
await rm(OUTPUT, { force: true });
await mkdir(STAGING, { recursive: true });

await copyFile(BUNDLE, join(STAGING, 'br-faker.cjs'));

const workflowDir = join(root, 'workflow');
for (const entry of await readdir(workflowDir)) {
  await copyFile(join(workflowDir, entry), join(STAGING, entry));
}

// `zip` ships with macOS, and Alfred expects a plain zip with the files at the
// archive root — hence -j is not used, we cd into the staging dir instead.
await run('zip', ['-q', '-r', OUTPUT, '.'], { cwd: STAGING });

await rm(STAGING, { recursive: true, force: true });

const { size } = await stat(OUTPUT);
console.log(`built ${OUTPUT} (${(size / 1024).toFixed(0)} KB)`);
console.log('double-click it to install into Alfred');
console.log('commit it so the download link stays current');
