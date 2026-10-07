#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const messageArg = args.join(' ').trim();

if (!messageArg) {
  console.error('\x1b[31m[Error] Please provide a release message.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run update "v1.0.13: Fix Money Collect glitch and improve Ledger UI"');
  console.log('       or: npx eas update --branch preview --message "v1.0.13\\n• Fixed Money Collect\\n• Improved UI"');
  process.exit(1);
}

// 1. Extract version tag (e.g., "v1.0.13")
const versionMatch = messageArg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
const extractedVersion = versionMatch ? `v${versionMatch[1]}` : 'v1.0.0';

// 2. Extract description (after ':' or '-')
let description = messageArg;
const colonIdx = messageArg.indexOf(':');
const dashIdx = messageArg.indexOf('-');
if (colonIdx !== -1) {
  description = messageArg.substring(colonIdx + 1).trim();
} else if (dashIdx !== -1) {
  description = messageArg.substring(dashIdx + 1).trim();
}

// 3. Update constants/version.ts preserving types and history
const versionFilePath = path.join(__dirname, '..', 'constants', 'version.ts');

let currentFile = '';
try {
  currentFile = fs.readFileSync(versionFilePath, 'utf-8');
} catch {
  // ignore
}

const noteLines = description
  .split(/[\n•;|]/)
  .map((s) => s.replace(/^[\s•\-\*–—]+\s*/, '').trim())
  .filter((s) => s.length > 0);

const notesArray = noteLines.length > 0 ? noteLines : [description];

let updatedContent = currentFile;
if (
  updatedContent.includes('export const CURRENT_RELEASE_VERSION') &&
  updatedContent.includes('export const INITIAL_RELEASE_HISTORY') &&
  updatedContent.includes('ADMIN_NAME')
) {
  updatedContent = updatedContent.replace(
    /export const CURRENT_RELEASE_VERSION = ".*?";/,
    `export const CURRENT_RELEASE_VERSION = "${extractedVersion}";`
  );
  updatedContent = updatedContent.replace(
    /export const RELEASE_DESCRIPTION = .*?;/,
    `export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};`
  );

  // Prepend to INITIAL_RELEASE_HISTORY if not already present
  if (!updatedContent.includes(`version: "${extractedVersion}"`)) {
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedNotes = JSON.stringify(notesArray, null, 6).replace(/\n/g, '\n    ');
    const newItemStr = `  {\n    version: "${extractedVersion}",\n    date: "${todayStr}",\n    title: ${JSON.stringify(description)},\n    notes: ${formattedNotes},\n    type: "ota",\n    isNativeBuild: false,\n  },`;

    updatedContent = updatedContent.replace(
      /export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem\[\] = \[\n/,
      `export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [\n${newItemStr}\n`
    );
  }
} else {
  updatedContent = `/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates & Local Builds
 */
export const CURRENT_RELEASE_VERSION = "${extractedVersion}";
export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const ADMIN_NAME = "Tirtharaj";
export const AUTHOR_CREDIT = "Built with ❤️ by Tirtharaj";

export interface ReleaseHistoryItem {
  version: string;
  date: string;
  notes: string[];
  isNativeBuild?: boolean;
  summary?: string;
}

export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [
  {
    version: "${extractedVersion}",
    date: "Current Release",
    notes: ${JSON.stringify(notesArray, null, 6)},
    isNativeBuild: false,
  },
  {
    version: "v1.0.0",
    date: "Initial Base Release",
    notes: [
      "Offline-first subscription tracker, multi-account ledger, and split bills",
      "Biometric app lock with Face ID and fingerprint authentication",
    ],
    isNativeBuild: true,
  },
];
`;
}

fs.writeFileSync(versionFilePath, updatedContent, 'utf-8');

// Synchronize package.json and app.json version
const semverRaw = extractedVersion.replace(/^v/i, '');
try {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = semverRaw;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = semverRaw;
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.updateVersion = extractedVersion;
    appJson.expo.extra.updateDescription = description;
    appJson.expo.extra.updateNotes = notesArray;
    appJson.expo.extra.easUpdateMessage = messageArg;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
} catch (e) {
  // ignore
}

console.log(`\x1b[32m✔ Version synchronized to ${extractedVersion} across version.ts, package.json, and app.json\x1b[0m`);
console.log(`\x1b[32m✔ Release notes: "${description}"\x1b[0m`);
console.log(`\x1b[36m🚀 Publishing EAS Update to channel preview...\x1b[0m\n`);

// 4. Run eas update without shell interpolation so special characters like '&' work cleanly
const result = spawnSync(
  'npx',
  ['eas', 'update', '--branch', 'preview', '--environment', 'preview', '--non-interactive', '--message', messageArg],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`\n\x1b[32m✔ Update ${extractedVersion} published successfully!\x1b[0m`);
