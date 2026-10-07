import { useEffect, useState, useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@/utils/storage';
import { logAction, logInfo } from '@/utils/auditLog';
import {
  CURRENT_RELEASE_VERSION,
  RELEASE_DESCRIPTION,
  INITIAL_RELEASE_HISTORY,
  ADMIN_NAME,
  ReleaseHistoryItem,
} from '@/constants/version';

const DISCOVERED_KEY = '@app_update_discovered_at';
const PENDING_MESSAGE_KEY = '@app_update_pending_message';
const ACTIVE_VERSION_KEY = '@app_update_active_version';
const ACTIVE_MESSAGE_KEY = '@app_update_active_message';
const LAST_CHECKED_KEY = '@app_update_last_checked_at';
const RELEASE_HISTORY_KEY = '@app_update_history_v2';
const AUTO_OTA_KEY = '@app_setting_auto_ota_v1';
const AUTO_APPLY_48H_KEY = '@app_setting_auto_apply_48h_v1';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

// ── Types ───────────────────────────────────────────────────

export interface ParsedRelease {
  version: string; // e.g. "v1.1.0"
  cleanVersion: string; // e.g. "1.1.0"
  notes: string[];
  summary: string;
  isNativeRequired: boolean;
  nativeNotice?: string;
  buildUrl?: string | null;
  rawMessage: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up_to_date'
  | 'native_required'
  | 'dev_mode'
  | 'error';

export interface AppUpdateInfo {
  isEnabled: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  activeVersion: string;
  activeRelease: ParsedRelease;
  availableRelease: ParsedRelease | null;
  history: ReleaseHistoryItem[];
  updateId: string | null;
  channel: string;
  runtimeVersion: string;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  lastCheckedAt: number | null;
  discoveredAt: number | null;
  daysRemainingBeforeAutoUpdate: number | null;
  manualStatus: UpdateStatus;
  errorMessage: string | null;
  autoOtaEnabled: boolean;
  autoApply48hEnabled: boolean;
  setAutoOtaEnabled: (val: boolean) => Promise<void>;
  setAutoApply48hEnabled: (val: boolean) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToApply: () => Promise<void>;
  openBuildUrl: () => Promise<void>;
  contactAdmin: (targetVersion?: string) => Promise<void>;
}

// ── Semantic Version Utilities ─────────────────────────────

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Parses any standard or prefixed version string (e.g. "v1.0.9", "1.0.10", "v2.1")
 */
export function parseSemVer(verStr: string | null | undefined): SemVer | null {
  if (!verStr || typeof verStr !== 'string') return null;
  const cleaned = verStr.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
    raw: verStr.trim(),
  };
}

/**
 * Compares two semantic version strings properly.
 * Returns:
 *   -1 if vA < vB  (e.g., v1.0.9 < v1.0.10)
 *    0 if vA === vB (e.g., v1.0.0 === 1.0.0)
 *    1 if vA > vB  (e.g., v1.1.0 > v1.0.2)
 */
export function semverCompare(vA: string | null | undefined, vB: string | null | undefined): number {
  const parsedA = parseSemVer(vA);
  const parsedB = parseSemVer(vB);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }
  return 0;
}

export function isSemverNewer(candidate: string, baseline: string): boolean {
  return semverCompare(candidate, baseline) > 0;
}

// ── EAS Manifest Extraction ────────────────────────────────

/**
 * Extracts raw release message safely from any EAS update manifest structure.
 */
export function extractUpdateMessage(manifest: any): string | null {
  if (!manifest) return null;

  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return manifest.trim().length > 0 ? manifest.trim() : null;
    }
  }

  // 1. Direct extra update fields from app.json
  if (parsed?.extra?.expoClient?.extra?.easUpdateMessage) {
    return String(parsed.extra.expoClient.extra.easUpdateMessage);
  }
  if (parsed?.extra?.expoClient?.extra?.updateMessage) {
    return String(parsed.extra.expoClient.extra.updateMessage);
  }
  if (parsed?.extra?.updateMessage) {
    return String(parsed.extra.updateMessage);
  }
  if (parsed?.extra?.easUpdateMessage) {
    return String(parsed.extra.easUpdateMessage);
  }
  if (parsed?.extra?.expoClient?.extra?.updateDescription) {
    return String(parsed.extra.expoClient.extra.updateDescription);
  }

  // 2. Direct metadata object / JSON
  if (parsed?.metadata) {
    if (typeof parsed.metadata === 'object' && parsed.metadata !== null) {
      if (parsed.metadata.message) return String(parsed.metadata.message);
      if (parsed.metadata.msg) return String(parsed.metadata.msg);
    }
    if (typeof parsed.metadata === 'string') {
      try {
        const metaObj = JSON.parse(parsed.metadata);
        if (metaObj?.message) return String(metaObj.message);
        if (metaObj?.msg) return String(metaObj.msg);
      } catch {
        if (parsed.metadata.length > 0 && !parsed.metadata.startsWith('{')) {
          return String(parsed.metadata).trim();
        }
      }
    }
  }

  // 3. Direct extra / expoClient fields
  if (parsed?.extra?.expoClient?.extra?.eas?.message) {
    return String(parsed.extra.expoClient.extra.eas.message);
  }
  if (parsed?.extra?.eas?.message) {
    return String(parsed.extra.eas.message);
  }
  if (parsed?.extra?.message) {
    return String(parsed.extra.message);
  }
  if (parsed?.message) {
    return String(parsed.message);
  }
  if (parsed?.raw?.metadata?.message) {
    return String(parsed.raw.metadata.message);
  }

  // 4. Fallback traversal
  try {
    const queue = [parsed];
    let depth = 0;
    while (queue.length > 0 && depth < 8) {
      depth++;
      const curr = queue.shift();
      if (curr && typeof curr === 'object') {
        for (const [k, v] of Object.entries(curr)) {
          if ((k === 'message' || k === 'msg' || k === 'updateMessage') && typeof v === 'string' && v.trim().length > 0) {
            return v.trim();
          }
          if (v && typeof v === 'object') {
            queue.push(v);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Extracts version token directly from manifest metadata or expoClient config.
 */
export function extractManifestVersion(manifest: any): string | null {
  if (!manifest) return null;
  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return null;
    }
  }

  if (parsed?.extra?.expoClient?.extra?.updateVersion) {
    return String(parsed.extra.expoClient.extra.updateVersion);
  }
  if (parsed?.extra?.updateVersion) {
    return String(parsed.extra.updateVersion);
  }
  if (parsed?.extra?.expoClient?.version) {
    const v = String(parsed.extra.expoClient.version).trim();
    return v.startsWith('v') ? v : `v${v}`;
  }
  if (parsed?.version) {
    const v = String(parsed.version).trim();
    return v.startsWith('v') ? v : `v${v}`;
  }

  const msg = extractUpdateMessage(parsed);
  if (msg) {
    const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (match && match[1]) {
      return `v${match[1]}`;
    }
  }
  return null;
}

/**
 * Calculates next patch semver bump (e.g. v1.1.4 -> v1.1.5).
 */
export function getNextIncrementedVersion(currentVersion: string): string {
  const sem = parseSemVer(currentVersion);
  if (!sem) return currentVersion;
  return `v${sem.major}.${sem.minor}.${sem.patch + 1}`;
}

// ── Multi-Line & Single-Line Release Parser ────────────────

/**
 * Normalizes both single-line ("v1.0.2: Fix A & B") and multi-line release notes
 * into a structured ParsedRelease object.
 */
export function parseReleasePayload(
  rawMessage: string | null | undefined,
  fallbackVersion: string = CURRENT_RELEASE_VERSION
): ParsedRelease {
  let cleanRaw = (rawMessage || '').trim();

  // If cleanRaw is empty or just a version prefix without text, e.g. "v1.1.5:" or "v1.1.4:"
  const isEssentiallyEmpty = !cleanRaw || /^(?:v)?\d+\.\d+(?:\.\d+)?:\s*$/i.test(cleanRaw);

  if (isEssentiallyEmpty) {
    const sem = parseSemVer(fallbackVersion);
    const vStr = sem ? `v${sem.major}.${sem.minor}.${sem.patch}` : fallbackVersion;

    // Look up rich notes from INITIAL_RELEASE_HISTORY if available for this version
    const histItem = INITIAL_RELEASE_HISTORY.find((h) => h.version === vStr);
    const defaultNotes =
      histItem?.notes && histItem.notes.length > 0
        ? histItem.notes
        : ['Verified performance optimizations, bug fixes, and user interface enhancements.'];
    const defaultSummary = histItem?.title || 'Performance optimizations and user interface enhancements.';

    return {
      version: vStr,
      cleanVersion: sem ? `${sem.major}.${sem.minor}.${sem.patch}` : fallbackVersion.replace(/^v/i, ''),
      notes: defaultNotes,
      summary: defaultSummary,
      isNativeRequired: false,
      buildUrl: null,
      rawMessage: '',
    };
  }

  // Check if message itself is stringified JSON containing a nested message
  let text = cleanRaw;
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(text);
      if (parsedJson?.message) text = String(parsedJson.message);
    } catch {
      // keep original
    }
  }

  // Detect native build requirement keywords
  const nativeKeywordsRegex =
    /(?:new\s+native\s+build\s+required|apk\/ipa\s+required|new\s+apk|new\s+ipa|new\s+app\s+build\s+required|requires?\s+(?:a\s+)?new\s+(?:native\s+)?build|contact\s+owner.*(?:apk|ipa|build))/i;
  const isNativeRequired = nativeKeywordsRegex.test(text);

  // Extract optional URL if present (strictly enforce https protocol)
  const urlMatch = text.match(/https:\/\/[^\s"'`<>]+/i);
  let buildUrl: string | null = null;
  if (urlMatch) {
    try {
      const parsed = new URL(urlMatch[0]);
      if (parsed.protocol === "https:") {
        buildUrl = parsed.toString();
      }
    } catch {}
  }

  // Split lines
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. Extract Version Token
  let extractedVersion: string | null = null;
  const firstLine = rawLines[0] || '';

  // Look for version tag like "v1.0.2", "v1.0.12", "version 1.0.2", "1.0.2:"
  const versionMatch = firstLine.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
  if (versionMatch && versionMatch[1]) {
    extractedVersion = `v${versionMatch[1]}`;
  } else {
    // Check fallback in entire text
    const textVersionMatch = text.match(/(?:version|ver|v)\s*(\d+\.\d+(?:\.\d+)?)/i);
    if (textVersionMatch && textVersionMatch[1]) {
      extractedVersion = `v${textVersionMatch[1]}`;
    }
  }

  const finalVersion = extractedVersion || fallbackVersion;
  const sem = parseSemVer(finalVersion);
  const cleanVersion = sem ? `${sem.major}.${sem.minor}.${sem.patch}` : finalVersion.replace(/^v/i, '');

  // 2. Extract Notes
  const cleanNotes: string[] = [];

  const stripBulletPrefix = (s: string) => {
    return s
      .replace(/^[\s•\-\*–—\u2022\u25E6\u2023\u2219]+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]?\s*/i, '')
      .trim();
  };

  let extractedSummary = '';

  if (rawLines.length > 1) {
    // ── FORMAT B: Multi-line ──
    // Line 1 is header/version. Check if Line 1 has description text after version tag
    const firstLineDesc = firstLine
      .replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]?\s*/i, '')
      .trim();
    if (firstLineDesc.length > 3 && !firstLineDesc.toLowerCase().startsWith('release notes')) {
      const cleaned = stripBulletPrefix(firstLineDesc);
      if (cleaned.length > 0) {
        cleanNotes.push(cleaned);
        extractedSummary = cleaned;
      }
    }

    for (let i = 1; i < rawLines.length; i++) {
      const line = stripBulletPrefix(rawLines[i]);
      if (line.length > 0 && !line.toLowerCase().startsWith('release notes')) {
        cleanNotes.push(line);
      }
    }
  } else {
    // ── FORMAT A: Single line ──
    let desc = firstLine.replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–—]\s*/i, '').trim();
    if (!desc || desc === firstLine) {
      const colonIdx = firstLine.indexOf(':');
      if (colonIdx !== -1) {
        desc = firstLine.substring(colonIdx + 1).trim();
      }
    }

    if (desc && desc.length > 0) {
      extractedSummary = desc;
      // Split on bullet symbols or semicolons or bullet conjunctions
      if (desc.includes('•') || desc.includes(';') || desc.includes(' | ')) {
        const parts = desc.split(/[•;|]/).map(stripBulletPrefix).filter((p) => p.length > 0);
        cleanNotes.push(...parts);
      } else if (desc.includes('. ') && desc.length > 60) {
        // Multiple sentences
        const sentences = desc.split(/(?<=\.)\s+/).map(stripBulletPrefix).filter((s) => s.length > 0);
        cleanNotes.push(...sentences);
      } else {
        const cleaned = stripBulletPrefix(desc);
        if (cleaned.length > 0) {
          cleanNotes.push(cleaned);
        }
      }
    }
  }

  // Filter out any empty items or items that are just bare version strings like "v1.1.4:"
  const filteredNotes = cleanNotes.filter(
    (n) => n.length > 0 && !/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?[:\s]*$/i.test(n)
  );

  // Fallback notes if empty
  if (filteredNotes.length === 0) {
    filteredNotes.push(
      isNativeRequired
        ? 'New native binary build required to continue receiving updates.'
        : 'Performance improvements, UI refinements, and bug fixes.'
    );
  }

  const nativeNotice = isNativeRequired
    ? filteredNotes.join(' ') || 'This update requires a new native APK/IPA build.'
    : undefined;

  const finalSummary =
    extractedSummary && !/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?[:\s]*$/i.test(extractedSummary)
      ? extractedSummary
      : filteredNotes.join(' · ');

  return {
    version: finalVersion,
    cleanVersion,
    notes: filteredNotes,
    summary: finalSummary,
    isNativeRequired,
    nativeNotice,
    buildUrl,
    rawMessage: cleanRaw,
  };
}

// ── Update History Persistence ─────────────────────────────

export async function getReleaseHistory(): Promise<ReleaseHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RELEASE_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure CURRENT_RELEASE_VERSION is at the top of history
        const hasCurrent = parsed.some((h: ReleaseHistoryItem) => h.version === CURRENT_RELEASE_VERSION);
        if (!hasCurrent && INITIAL_RELEASE_HISTORY[0]) {
          return [INITIAL_RELEASE_HISTORY[0], ...parsed.filter((h: ReleaseHistoryItem) => h.version !== CURRENT_RELEASE_VERSION)].slice(0, 15);
        }
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_RELEASE_HISTORY;
}

export async function recordAppliedRelease(release: ParsedRelease, updateDate?: Date): Promise<void> {
  try {
    const history = await getReleaseHistory();
    const dateStr = (updateDate || new Date()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newItem: ReleaseHistoryItem = {
      version: release.version,
      date: dateStr,
      notes: release.notes,
      isNativeBuild: release.isNativeRequired,
    };

    // Filter out existing duplicate of same version, then prepend new one
    const filtered = history.filter((h) => h.version !== release.version);
    const updatedHistory = [newItem, ...filtered].slice(0, 15); // keep last 15 releases

    await AsyncStorage.setItem(RELEASE_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch {
    // ignore
  }
}

// ── Dynamic Version Resolvers ──────────────────────────────

export function isEmbeddedLaunchActive(): boolean {
  try {
    return Boolean(Updates.isEmbeddedLaunch || !Updates.updateId);
  } catch {
    return true;
  }
}

export async function getActiveAppVersion(): Promise<string> {
  try {
    // 1. Manifest version from currently running EAS update or embedded manifest
    const manifestVer = (Updates.manifest as any)?.extra?.expoClient?.version;
    if (manifestVer) {
      const vStr = `v${String(manifestVer).replace(/^v/i, '')}`;
      await AsyncStorage.setItem(ACTIVE_VERSION_KEY, vStr);
      return vStr;
    }

    // 2. Compiled JS bundle's own version constant
    if (CURRENT_RELEASE_VERSION) {
      await AsyncStorage.setItem(ACTIVE_VERSION_KEY, CURRENT_RELEASE_VERSION);
      return CURRENT_RELEASE_VERSION;
    }

    const cached = await AsyncStorage.getItem(ACTIVE_VERSION_KEY);
    if (cached && semverCompare(cached, CURRENT_RELEASE_VERSION) >= 0) {
      return cached;
    }
  } catch {
    // fallback
  }
  return CURRENT_RELEASE_VERSION;
}

export function getActiveAppVersionSync(): string {
  try {
    const manifestVer = (Updates.manifest as any)?.extra?.expoClient?.version;
    if (manifestVer) {
      return `v${String(manifestVer).replace(/^v/i, '')}`;
    }

    if (CURRENT_RELEASE_VERSION) {
      return CURRENT_RELEASE_VERSION;
    }
  } catch {
    // fallback
  }
  return CURRENT_RELEASE_VERSION;
}

// ── Background Auto-Update Check ────────────────────────────

export async function checkAndAutoApplyUpdates(): Promise<void> {
  if (!Updates.isEnabled) return;

  try {
    const autoOtaVal = await AsyncStorage.getItem(AUTO_OTA_KEY);
    if (autoOtaVal === 'false') {
      return;
    }

    const discoveredStr = await AsyncStorage.getItem(DISCOVERED_KEY);
    const discoveredAt = discoveredStr ? parseInt(discoveredStr, 10) : null;

    const checkResult = await Updates.checkForUpdateAsync();

    if (checkResult.isAvailable) {
      const now = Date.now();
      const firstSeen = discoveredAt || now;
      if (!discoveredAt) {
        await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());
      }

      const msg = extractUpdateMessage(checkResult.manifest);
      const manifestVer = extractManifestVersion(checkResult.manifest);
      const targetVer = manifestVer || parseReleasePayload(msg).version;
      const activeVer = await getActiveAppVersion();

      if (!checkResult.isRollBackToEmbedded && targetVer && semverCompare(targetVer, activeVer) <= 0) {
        // Active build is already equal or newer than EAS update: never downgrade!
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        return;
      }

      const parsed = parseReleasePayload(msg, targetVer || undefined);

      if (parsed.isNativeRequired) {
        // Do not auto-apply native-required updates via OTA
        return;
      }

      if (msg) {
        await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      }

      logInfo('update', 'New OTA update discovered on channel', {
        channel: Updates.channel,
        version: parsed.version,
      });

      const fetchResult = await Updates.fetchUpdateAsync();

      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      const isAutoApplyEnabled = autoApplyVal !== 'false';

      if (fetchResult.isNew && isAutoApplyEnabled && now - firstSeen >= TWO_DAYS_MS) {
        logAction('update', 'Auto-applying update after 48h unapplied');
        if (msg) {
          await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, msg);
          await AsyncStorage.setItem(ACTIVE_VERSION_KEY, parsed.version);
          await recordAppliedRelease(parsed, new Date());
        }
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        await Updates.reloadAsync();
      }
    } else {
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
    }
  } catch {
    // Fail silently in background
  }
}

// ── Unified Hook for Update Screen & Settings ───────────────

export function useAppUpdateManager(): AppUpdateInfo {
  const [discoveredAt, setDiscoveredAt] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [storedMessage, setStoredMessage] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string>(() => getActiveAppVersionSync());
  const [history, setHistory] = useState<ReleaseHistoryItem[]>(INITIAL_RELEASE_HISTORY);
  const [manualStatus, setManualStatus] = useState<UpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeDownloadProgress, setActiveDownloadProgress] = useState<number>(0);
  const [isManualDownloading, setIsManualDownloading] = useState(false);
  const [autoOtaEnabled, setAutoOtaEnabledState] = useState<boolean>(true);
  const [autoApply48hEnabled, setAutoApply48hEnabledState] = useState<boolean>(true);
  const [checkedManifest, setCheckedManifest] = useState<any | null>(null);

  const {
    currentlyRunning,
    availableUpdate,
    downloadedUpdate,
    isUpdateAvailable: hookAvailable,
    isUpdatePending: hookPending,
    downloadProgress: hookProgress,
    isDownloading: hookDownloading,
  } = Updates.useUpdates();

  // Load persisted state & history on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const isEmbedded = Boolean(
        currentlyRunning.isEmbeddedLaunch ||
        Updates.isEmbeddedLaunch ||
        !currentlyRunning.updateId
      );

      // If running embedded binary (APK / IPA / cable push), wipe stale OTA cache!
      if (isEmbedded) {
        try {
          await AsyncStorage.multiRemove([
            ACTIVE_VERSION_KEY,
            ACTIVE_MESSAGE_KEY,
            PENDING_MESSAGE_KEY,
            DISCOVERED_KEY,
          ]);
        } catch {
          // ignore
        }
      }

      const ver = isEmbedded ? CURRENT_RELEASE_VERSION : await getActiveAppVersion();
      const hist = await getReleaseHistory();
      if (isMounted) {
        setActiveVersion(ver);
        setHistory(hist);
      }

      const discVal = await AsyncStorage.getItem(DISCOVERED_KEY);
      if (isMounted && discVal) setDiscoveredAt(parseInt(discVal, 10));

      const lastCheckedVal = await AsyncStorage.getItem(LAST_CHECKED_KEY);
      if (isMounted && lastCheckedVal) setLastCheckedAt(parseInt(lastCheckedVal, 10));

      const autoOtaVal = await AsyncStorage.getItem(AUTO_OTA_KEY);
      if (isMounted && autoOtaVal !== null) setAutoOtaEnabledState(autoOtaVal !== 'false');

      const autoApplyVal = await AsyncStorage.getItem(AUTO_APPLY_48H_KEY);
      if (isMounted && autoApplyVal !== null) setAutoApply48hEnabledState(autoApplyVal !== 'false');

      const pendMsg = await AsyncStorage.getItem(PENDING_MESSAGE_KEY);
      const activeMsg = await AsyncStorage.getItem(ACTIVE_MESSAGE_KEY);
      const liveMsg =
        extractUpdateMessage(Updates.manifest) ||
        extractUpdateMessage(currentlyRunning?.manifest);

      if (isMounted) {
        setStoredMessage(isEmbedded ? RELEASE_DESCRIPTION : (pendMsg || liveMsg || activeMsg));
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentlyRunning]);

  // Reactive listener to incoming updates
  useEffect(() => {
    const updateManifest = downloadedUpdate?.manifest || availableUpdate?.manifest;
    if (updateManifest) {
      const msg = extractUpdateMessage(updateManifest);
      if (msg) {
        setStoredMessage(msg);
        AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      }
    }
  }, [availableUpdate, downloadedUpdate]);

  const isUpdatePending = hookPending || manualStatus === 'downloaded';
  const isUpdateAvailable = hookAvailable || manualStatus === 'available';
  const isDownloading = hookDownloading || isManualDownloading;
  const downloadProgress = hookProgress || activeDownloadProgress;

  // Active Release Object
  const activeRelease = useMemo(() => {
    const isEmbedded = Boolean(
      currentlyRunning.isEmbeddedLaunch ||
      Updates.isEmbeddedLaunch ||
      !currentlyRunning.updateId
    );
    if (isEmbedded) {
      return parseReleasePayload(RELEASE_DESCRIPTION, CURRENT_RELEASE_VERSION);
    }
    const liveMsg =
      extractUpdateMessage(currentlyRunning?.manifest) ||
      extractUpdateMessage(Updates.manifest) ||
      storedMessage;
    return parseReleasePayload(liveMsg, activeVersion);
  }, [currentlyRunning, storedMessage, activeVersion]);

  // Available Release Object
  const availableRelease = useMemo(() => {
    if (!isUpdateAvailable && !isUpdatePending && manualStatus !== 'native_required') {
      return null;
    }
    const targetManifest =
      checkedManifest ||
      downloadedUpdate?.manifest ||
      availableUpdate?.manifest;

    const manifestVer = extractManifestVersion(targetManifest);
    const msg = extractUpdateMessage(targetManifest) || storedMessage;

    let targetVersion = manifestVer;
    if (!targetVersion && msg) {
      const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
      if (match && match[1]) targetVersion = `v${match[1]}`;
    }
    if (!targetVersion) {
      const topHistory = history.find((h) => h.version !== activeVersion);
      targetVersion = topHistory?.version || getNextIncrementedVersion(activeVersion);
    }

    if (targetVersion && semverCompare(targetVersion, activeVersion) <= 0) {
      return null;
    }

    return parseReleasePayload(msg, targetVersion || undefined);
  }, [
    isUpdateAvailable,
    isUpdatePending,
    manualStatus,
    checkedManifest,
    downloadedUpdate,
    availableUpdate,
    storedMessage,
    activeVersion,
    history,
  ]);

  const daysRemainingBeforeAutoUpdate = discoveredAt
    ? Math.max(0, Math.ceil((discoveredAt + TWO_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  // Check for Updates
  const handleCheckForUpdates = useCallback(async () => {
    if (!Updates.isEnabled) {
      setManualStatus('dev_mode');
      setErrorMessage(null);
      return;
    }

    setManualStatus('checking');
    setErrorMessage(null);

    try {
      const now = Date.now();
      setLastCheckedAt(now);
      await AsyncStorage.setItem(LAST_CHECKED_KEY, now.toString());

      const result = await Updates.checkForUpdateAsync();

      if (result.isAvailable || result.isRollBackToEmbedded) {
        setCheckedManifest(result.manifest);
        const msg = extractUpdateMessage(result.manifest);
        const manifestVer = extractManifestVersion(result.manifest);
        let targetVersion = manifestVer;
        if (!targetVersion && msg) {
          const match = msg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
          if (match && match[1]) targetVersion = `v${match[1]}`;
        }
        if (!targetVersion) {
          const topHistory = history.find((h) => h.version !== activeVersion);
          targetVersion = topHistory?.version || getNextIncrementedVersion(activeVersion);
        }

        // If the server update is older than or equal to our active build, do not downgrade!
        if (!result.isRollBackToEmbedded && targetVersion && semverCompare(targetVersion, activeVersion) <= 0) {
          setCheckedManifest(null);
          setManualStatus('up_to_date');
          await AsyncStorage.removeItem(DISCOVERED_KEY);
          await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
          setDiscoveredAt(null);
          return;
        }

        const parsed = parseReleasePayload(msg, targetVersion || undefined);

        if (msg) {
          setStoredMessage(msg);
          await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
        }

        if (parsed.isNativeRequired) {
          setManualStatus('native_required');
        } else {
          setManualStatus('available');
          setDiscoveredAt(now);
          await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());
        }
      } else {
        setCheckedManifest(null);
        setManualStatus('up_to_date');
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        setDiscoveredAt(null);
        if (currentlyRunning.isEmbeddedLaunch || Updates.isEmbeddedLaunch || !currentlyRunning.updateId) {
          setActiveVersion(CURRENT_RELEASE_VERSION);
        }
      }
    } catch {
      setManualStatus('error');
      setErrorMessage('Unable to check for updates. Check your internet connection.');
    }
  }, [activeVersion, currentlyRunning, history]);

  // Download Update
  const handleDownloadUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;

    if (availableRelease?.isNativeRequired) {
      if (availableRelease.buildUrl) {
        Linking.openURL(availableRelease.buildUrl).catch(() => {});
      }
      return;
    }

    setIsManualDownloading(true);
    setErrorMessage(null);
    setActiveDownloadProgress(0.2);

    try {
      setActiveDownloadProgress(0.55);
      const result = await Updates.fetchUpdateAsync();
      setActiveDownloadProgress(1.0);

      const msg = extractUpdateMessage(result.manifest);
      if (msg) {
        setStoredMessage(msg);
        await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      }

      setManualStatus('downloaded');
      logAction('update', 'Downloaded update successfully');
    } catch {
      setManualStatus('error');
      setErrorMessage('Download failed. Please check your internet connection.');
    } finally {
      setIsManualDownloading(false);
    }
  }, [availableRelease]);

  // Toggle Auto OTA
  const handleSetAutoOta = useCallback(async (val: boolean) => {
    setAutoOtaEnabledState(val);
    await AsyncStorage.setItem(AUTO_OTA_KEY, val ? 'true' : 'false');
  }, []);

  // Toggle Auto Apply 48h
  const handleSetAutoApply48h = useCallback(async (val: boolean) => {
    setAutoApply48hEnabledState(val);
    await AsyncStorage.setItem(AUTO_APPLY_48H_KEY, val ? 'true' : 'false');
  }, []);

  // Contact Admin via WhatsApp
  const handleContactAdmin = useCallback(async (targetVersion?: string) => {
    const ver = targetVersion || availableRelease?.version || activeVersion;
    const msg = `Hey ${ADMIN_NAME}! I saw a new native build (${ver}) for Monevo is available. Could you please share the new APK / IPA installer? Thanks!`;
    const encoded = encodeURIComponent(msg);
    const whatsappAppUrl = `whatsapp://send?text=${encoded}`;
    const webFallbackUrl = `https://api.whatsapp.com/send?text=${encoded}`;

    try {
      const supported = await Linking.canOpenURL(whatsappAppUrl);
      if (supported) {
        await Linking.openURL(whatsappAppUrl);
      } else {
        await Linking.openURL(webFallbackUrl);
      }
    } catch {
      Linking.openURL(webFallbackUrl).catch(() => {});
    }
  }, [availableRelease, activeVersion]);

  // Restart to apply downloaded update
  const handleRestartToApply = useCallback(async () => {
    try {
      if (storedMessage) {
        await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, storedMessage);
        const parsed = parseReleasePayload(storedMessage, activeVersion);
        if (parsed.version && parsed.version !== activeVersion) {
          await recordAppliedRelease(parsed);
        }
      }
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await Updates.reloadAsync();
    } catch {
      Updates.reloadAsync().catch(() => {});
    }
  }, [storedMessage, activeVersion]);

  // Open direct build URL
  const handleOpenBuildUrl = useCallback(async (url?: string) => {
    const target = url || availableRelease?.buildUrl;
    if (target && target.startsWith("https://")) {
      try {
        await Linking.openURL(target);
      } catch {
        // ignore
      }
    }
  }, [availableRelease]);

  return {
    isEnabled: Updates.isEnabled,
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    activeRelease,
    availableRelease,
    history,
    updateId: currentlyRunning.updateId || Updates.updateId || null,
    channel: Updates.channel || 'preview',
    runtimeVersion: Updates.runtimeVersion || '1',
    isEmbeddedLaunch: currentlyRunning.isEmbeddedLaunch,
    createdAt: currentlyRunning.createdAt || Updates.createdAt || null,
    lastCheckedAt,
    discoveredAt,
    daysRemainingBeforeAutoUpdate,
    manualStatus,
    errorMessage,
    autoOtaEnabled,
    autoApply48hEnabled,
    setAutoOtaEnabled: handleSetAutoOta,
    setAutoApply48hEnabled: handleSetAutoApply48h,
    checkForUpdates: handleCheckForUpdates,
    downloadUpdate: handleDownloadUpdate,
    restartToApply: handleRestartToApply,
    openBuildUrl: handleOpenBuildUrl,
    contactAdmin: handleContactAdmin,
  };
}
