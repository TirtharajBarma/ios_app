#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const verArg = (args[0] || '').trim();

if (!verArg) {
  console.error('\x1b[31m[Error] Please provide a version number.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run set-version 1.1.1 [optional description]');
  process.exit(1);
}

const cleanedVer = verArg.replace(/^v/i, '');
const versionTag = `v${cleanedVer}`;
const description = args.slice(1).join(' ').trim() || `${versionTag}: Native Release Build`;

// 1. Update package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = cleanedVer;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`\x1b[32m✔ package.json version updated to ${cleanedVer}\x1b[0m`);
} catch (err) {
  console.error('Failed to update package.json', err);
}

// 2. Update app.json
const appJsonPath = path.join(__dirname, '..', 'app.json');
try {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = cleanedVer;
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.updateVersion = versionTag;
    appJson.expo.extra.updateDescription = description;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
  console.log(`\x1b[32m✔ app.json version updated to ${cleanedVer}\x1b[0m`);
} catch (err) {
  console.error('Failed to update app.json', err);
}

// 3. Update constants/version.ts
const versionFilePath = path.join(__dirname, '..', 'constants', 'version.ts');
try {
  let content = fs.readFileSync(versionFilePath, 'utf-8');
  content = content.replace(
    /export const CURRENT_RELEASE_VERSION = ".*?";/,
    `export const CURRENT_RELEASE_VERSION = "${versionTag}";`
  );
  content = content.replace(
    /export const RELEASE_DESCRIPTION = .*?;/,
    `export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};`
  );

  // Prepend to history if not present
  if (
    content.includes('export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [') &&
    !content.includes(`version: "${versionTag}"`)
  ) {
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const newItemStr = `  {\n    version: "${versionTag}",\n    date: "${todayStr}",\n    notes: [\n      ${JSON.stringify(description)}\n    ],\n    isNativeBuild: true,\n  },`;
    content = content.replace(
      /export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem\[\] = \[\n/,
      `export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [\n${newItemStr}\n`
    );
  }

  fs.writeFileSync(versionFilePath, content, 'utf-8');
  console.log(`\x1b[32m✔ constants/version.ts synchronized to ${versionTag}\x1b[0m`);
} catch (err) {
  console.error('Failed to update constants/version.ts', err);
}

console.log(`\x1b[36m🎉 All versions synchronized to ${versionTag} (${cleanedVer}) for native builds!\x1b[0m`);
