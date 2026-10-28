/**
 * Application Version and Release Configuration
 * Auto-synced with EAS Updates & Local Builds
 */
export const CURRENT_RELEASE_VERSION = "v1.3.4";
export const RELEASE_DESCRIPTION = "Fix split recovery pill layout overflow and clean redundant (Renewal) tags in ledger";
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
    version: "v1.3.4",
    date: "Oct 29, 2026",
    title: "Fix split recovery pill layout overflow and clean redundant (Renewal) tags in ledger",
    notes: [
          "Fix split recovery pill layout overflow and clean redundant (Renewal) tags in ledger"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.3.3",
    date: "Oct 25, 2026",
    title: "Fixed commitments pacing engine, credit card overdue fix, and settings walkthrough tour",
    notes: [
          "Fixed commitments pacing engine, credit card overdue fix, and settings walkthrough tour"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.3.2",
    date: "Oct 25, 2026",
    title: "3D Vinyl Collectible Avatar System across Cashveil",
    notes: [
          "3D Vinyl Collectible Avatar System across Cashveil"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.3.1",
    date: "Oct 25, 2026",
    title: "Category icon mapping fix, sticky Save header in Category modal, and Software Update polish",
    notes: [
      "Fix category icon mapping so Flame, Laptop, Briefcase and all 30 icons save and display faithfully",
      "Add sticky top Save and Cancel buttons in Category editor so users never have to scroll to save",
      "Software Update: Display unique tail hash for Bundle ID and eliminate duplicate description layout",
      "Remove accidental navigation on budget breach coach alert",
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.3.0",
    date: "Oct 25, 2026",
    title: "Premium polish - dynamic Budget + Buffer pills, tiered spending discipline, and month rollover buffer sweep",
    notes: [
          "Premium polish - dynamic Budget + Buffer pills, tiered spending discipline, and month rollover buffer sweep"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.9",
    date: "Oct 25, 2026",
    title: "Fix transaction long-press race condition and include pre-defined income categories in Ledger filter",
    notes: [
          "Fix transaction long-press race condition and include pre-defined income categories in Ledger filter"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.8",
    date: "Oct 25, 2026",
    title: "Fix credit card name truncation, smart split summarization, and budget-aware streak pacing",
    notes: [
          "Fix credit card name truncation, smart split summarization, and budget-aware streak pacing"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.7",
    date: "Oct 25, 2026",
    title: "Professional polish - unified buffer terminology, aligned unspent leftover, and clean non-repeating labels",
    notes: [
          "Professional polish - unified buffer terminology, aligned unspent leftover, and clean non-repeating labels"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.6",
    date: "Oct 25, 2026",
    title: "Auto-heal split returns from income, exact 31917 salary lock, and 7.9k cushion",
    notes: [
          "Auto-heal split returns from income, exact 31917 salary lock, and 7.9k cushion"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.5",
    date: "Oct 25, 2026",
    title: "Fix cushion buffer calculation, remove cashflow text overlap, top hero buffer state, and multi-goal funding",
    notes: [
          "Fix cushion buffer calculation, remove cashflow text overlap, top hero buffer state, and multi-goal funding"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.4",
    date: "Oct 25, 2026",
    title: "Dynamic salary cushion buffer, savings goal funding protection, and liquid reserve analytics",
    notes: [
          "Dynamic salary cushion buffer, savings goal funding protection, and liquid reserve analytics"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.3",
    date: "Oct 23, 2026",
    title: "Fix split settlement category persistence, lock predefined categories against manipulation, and fix participant layout for long names",
    notes: [
          "Fix split settlement category persistence, lock predefined categories against manipulation, and fix participant layout for long names"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.2",
    date: "Oct 14, 2026",
    title: "Dynamic safe pace harmonization, spike rejection in coach forecast, and fixed commitment shield for streaks",
    notes: [
          "Dynamic safe pace harmonization, spike rejection in coach forecast, and fixed commitment shield for streaks"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.1",
    date: "Oct 14, 2026",
    title: "Activity logs smooth scroll, filtered JSON export with IST timestamps, and financial audit trails",
    notes: [
          "Activity logs smooth scroll, filtered JSON export with IST timestamps, and financial audit trails"
    ],
    type: "ota",
    isNativeBuild: false,
  },
  {
    version: "v1.2.0",
    date: "Oct 13, 2026",
    notes: [
      "v1.2.0: Major native release"
    ],
    isNativeBuild: true,
  },
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
