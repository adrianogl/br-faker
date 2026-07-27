#!/usr/bin/env node
/**
 * Assemble the loadable extension directory.
 *
 * tsup emits the scripts; this copies the manifest, the two pages and the
 * icons alongside them, then zips the result for the Chrome Web Store.
 */
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const pkg = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(pkg));

const DIST = join(pkg, 'dist');
const SRC = join(pkg, 'src');
const ICONS = join(pkg, 'icons');
const LOCALES = join(pkg, '_locales');
const ZIP = join(repoRoot, 'br-faker-extension.zip');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(join(DIST, 'background.js')))) {
  console.error('missing dist/background.js — tsup has not run');
  process.exit(1);
}

if (!(await exists(LOCALES))) {
  console.error(`missing ${LOCALES} — the manifest declares default_locale`);
  process.exit(1);
}

if (!(await exists(ICONS))) {
  console.error(`missing ${ICONS} — run "npm run icon" from the repo root first`);
  process.exit(1);
}

for (const file of ['manifest.json', 'popup.html', 'options.html']) {
  await copyFile(join(SRC, file), join(DIST, file));
}

await mkdir(join(DIST, 'icons'), { recursive: true });
for (const icon of await readdir(ICONS)) {
  await copyFile(join(ICONS, icon), join(DIST, 'icons', icon));
}

// Chrome resolves __MSG_*__ and chrome.i18n from _locales at load time, so a
// missing catalogue shows raw keys in the interface rather than failing loudly.
for (const locale of await readdir(LOCALES)) {
  await mkdir(join(DIST, '_locales', locale), { recursive: true });
  await copyFile(join(LOCALES, locale, 'messages.json'), join(DIST, '_locales', locale, 'messages.json'));
}

// Keep the manifest version in step with the workspace version, so a release
// tag and the version Chrome reports cannot drift apart.
const rootPackage = JSON.parse(
  await import('node:fs/promises').then((fs) => fs.readFile(join(repoRoot, 'package.json'), 'utf8')),
);
const manifestPath = join(DIST, 'manifest.json');
const manifest = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(manifestPath, 'utf8')));
manifest.version = rootPackage.version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// Assert the directory Chrome will load is complete before zipping it.
// tsup cleans dist on every run, so a build that skipped this script leaves
// the scripts without their manifest — an extension that fails to load with
// nothing but ERR_FILE_NOT_FOUND to go on.
const referenced = [
  `_locales/${manifest.default_locale}/messages.json`,
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  'content.js',
  ...Object.values(manifest.icons),
];

for (const file of referenced) {
  if (!(await exists(join(DIST, file)))) {
    console.error(`dist is incomplete: manifest references ${file}, which is missing`);
    process.exit(1);
  }
}

await rm(ZIP, { force: true });
await run('zip', ['-q', '-r', ZIP, '.'], { cwd: DIST });

const { size } = await stat(ZIP);
console.log(`built ${DIST} — load it unpacked from chrome://extensions`);
console.log(`built ${ZIP} (${(size / 1024).toFixed(0)} KB) for the Web Store`);
