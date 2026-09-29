#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const messageArg = args.join(' ').trim();

if (!messageArg) {
  console.error('\x1b[31m[Error] Please provide a release message.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run update "v1.0.5: Added new features and bug fixes"');
  process.exit(1);
}

// 1. Extract version tag (e.g., "v1.0.5")
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

// 3. Update constants/version.ts
const versionFilePath = path.join(__dirname, '..', 'constants', 'version.ts');
const newVersionContent = `/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates
 */
export const CURRENT_RELEASE_VERSION = "${extractedVersion}";
export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const AUTHOR_CREDIT = "Built with ❤️ by Tirtharaj";
`;

fs.writeFileSync(versionFilePath, newVersionContent, 'utf-8');
console.log(`\x1b[32m✔ Version synchronized to ${extractedVersion}\x1b[0m`);
console.log(`\x1b[32m✔ Release notes: "${description}"\x1b[0m`);
console.log(`\x1b[36m🚀 Publishing EAS Update to channel preview...\x1b[0m\n`);

// 4. Run eas update
const result = spawnSync('npx', ['eas', 'update', '--branch', 'preview', '--message', `"${messageArg}"`], {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`\n\x1b[32m✔ Update ${extractedVersion} published successfully!\x1b[0m`);
