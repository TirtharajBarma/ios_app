/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates & Local Builds
 */
export const CURRENT_RELEASE_VERSION = "v1.1.8";
export const RELEASE_DESCRIPTION = "Fix Safe to spend amount visibility and smooth dynamic calendar carousel";
export const APP_BINARY_VERSION = "v1.0.0 (Build 1)";
export const ADMIN_NAME = "Tirtharaj";
export const AUTHOR_CREDIT = "Built with ❤️ by Tirtharaj";

export interface ReleaseHistoryItem {
  version: string;
  date: string;
  title?: string;
  notes: string[];
  type?: 'ota' | 'binary';
  isNativeBuild?: boolean;
}

export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [
  {
    version: "v1.1.8",
    date: "Oct 7, 2026",
    title: "Fix Safe to spend amount visibility and smooth dynamic calendar carousel",
    notes: [
          "Fix Safe to spend amount visibility and smooth dynamic calendar carousel"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.1.7",
    date: "Oct 7, 2026",
    title: "Fix financial ledger invariants, calendar algorithms, and mobile UI layouts",
    notes: [
          "Fix financial ledger invariants, calendar algorithms, and mobile UI layouts"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.1.6",
    date: "Oct 7, 2026",
    title: "fix the unnecessary text... & minor bug fix...",
    notes: [
          "fix the unnecessary text... & minor bug fix..."
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.1.5",
    date: "Oct 6, 2026",
    title: "Security Hardening & Apple-Style Update UI",
    notes: [
      "Row-Level Security activated on all shared group tables",
      "Diagnostic telemetry fully anonymized with opt-in privacy controls",
      "Biometric app lock fails closed and evaluates early on startup",
      "Apple HIG software update interface with clean version history",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.1.4",
    date: "Oct 6, 2026",
    title: "Software Update Redesign & Polish",
    notes: [
      "Authentic Apple iOS Software Update UI with typography hierarchy",
      "Clean version history table with build metadata",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.1.2",
    date: "Oct 6, 2026",
    title: "Cache Synchronization & Stability",
    notes: [
      "Improved cache synchronization and OTA update management",
      "Optimized storage persistence across cold restarts",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.1.1",
    date: "Oct 6, 2026",
    title: "Liquid UI & Ledger Enhancements",
    notes: [
      "Liquid glass context menus and haptic feedback",
      "Expense ledger refinements and performance upgrades",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.0.0",
    date: "Sep 2026",
    title: "Initial Base Release",
    notes: [
      "Complete offline-first expense & subscription tracking",
      "Native iOS App Intents and Home Screen shortcuts",
      "Biometric app lock with Face ID and passcode fallback",
    ],
    type: "binary",
    isNativeBuild: true,
  },
];
