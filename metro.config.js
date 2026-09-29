const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Auto-detects EAS Update message from parent process tree during `eas update`
 * and synchronizes `constants/version.ts` in real time before Metro bundling.
 */
function autoSyncEasVersion() {
  try {
    let pid = process.pid;
    let foundMessage = process.env.EAS_UPDATE_MESSAGE || null;

    if (!foundMessage) {
      for (let i = 0; i < 8; i++) {
        try {
          const ppidStr = execSync(`ps -o ppid= -p ${pid}`, { stdio: ["pipe", "pipe", "ignore"] }).toString().trim();
          if (!ppidStr || ppidStr === "0" || ppidStr === "1") break;
          const ppid = parseInt(ppidStr, 10);
          const cmd = execSync(`ps -o args= -p ${ppid}`, { stdio: ["pipe", "pipe", "ignore"] }).toString().trim();

          const match = cmd.match(/(?:--message|-m)(?:\s+|=)(?:["']([^"']+)["']|([^\s]+))/);
          if (match) {
            foundMessage = match[1] || match[2];
            break;
          }
          pid = ppid;
        } catch {
          break;
        }
      }
    }

    if (foundMessage) {
      const versionMatch = foundMessage.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
      const extractedVersion = versionMatch ? `v${versionMatch[1]}` : null;

      let description = foundMessage;
      const colonIdx = foundMessage.indexOf(":");
      const dashIdx = foundMessage.indexOf("-");
      if (colonIdx !== -1) {
        description = foundMessage.substring(colonIdx + 1).trim();
      } else if (dashIdx !== -1) {
        description = foundMessage.substring(dashIdx + 1).trim();
      }
      if (!description || description.length === 0) {
        description = foundMessage;
      }

      if (extractedVersion) {
        const versionFilePath = path.join(__dirname, "constants", "version.ts");
        const content = `/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates
 */
export const CURRENT_RELEASE_VERSION = "${extractedVersion}";
export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const AUTHOR_CREDIT = "Built with ❤️ by Tirtharaj";
`;
        fs.writeFileSync(versionFilePath, content, "utf-8");
        console.log(`\n\x1b[32m[Metro Bundler] Auto-synced EAS update: "${foundMessage}" -> Version: ${extractedVersion}\x1b[0m\n`);
      }
    }
  } catch {
    // Fail silently in non-EAS environments
  }
}

autoSyncEasVersion();

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
