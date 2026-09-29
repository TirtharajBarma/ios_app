import { useEffect, useState, useCallback } from 'react';
import * as Updates from 'expo-updates';
import AsyncStorage from '@/utils/storage';
import { logAction, logInfo } from '@/utils/auditLog';
import { CURRENT_RELEASE_VERSION, RELEASE_DESCRIPTION } from '@/constants/version';

const DISCOVERED_KEY = '@app_update_discovered_at';
const PENDING_MESSAGE_KEY = '@app_update_pending_message';
const ACTIVE_VERSION_KEY = '@app_update_active_version';
const ACTIVE_MESSAGE_KEY = '@app_update_active_message';
const LAST_CHECKED_KEY = '@app_update_last_checked_at';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

export interface AppUpdateInfo {
  isEnabled: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  updateMessage: string | null;
  activeVersion: string;
  releaseDescription: string;
  availableVersion: string | null;
  availableDescription: string | null;
  bundleSize: string;
  updateId: string | null;
  channel: string;
  runtimeVersion: string;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  lastCheckedAt: number | null;
  discoveredAt: number | null;
  daysRemainingBeforeAutoUpdate: number | null;
  manualStatus: 'idle' | 'checking' | 'available' | 'downloaded' | 'up_to_date' | 'dev_mode' | 'error';
  errorMessage: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToApply: () => Promise<void>;
}

/**
 * Computes logical next patch version from current version string (e.g. v1.0.8 -> v1.0.9).
 */
export function getNextVersion(current: string): string {
  const match = current.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const patch = parseInt(match[3], 10) + 1;
    return `v${major}.${minor}.${patch}`;
  }
  return 'v1.0.9';
}

/**
 * Extracts human-readable release message from EAS update manifest.
 */
export function extractUpdateMessage(manifest: any): string | null {
  if (!manifest) return null;

  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return manifest.length > 0 ? manifest : null;
    }
  }

  // 1. Direct metadata object or string
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
          return String(parsed.metadata);
        }
      }
    }
  }

  // 2. Direct extra fields
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

  // 3. Fallback search through object properties
  try {
    const queue = [parsed];
    let depth = 0;
    while (queue.length > 0 && depth < 10) {
      depth++;
      const curr = queue.shift();
      if (curr && typeof curr === 'object') {
        for (const [k, v] of Object.entries(curr)) {
          if ((k === 'message' || k === 'msg') && typeof v === 'string' && v.trim().length > 0) {
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
 * Extracts version string like "v1.0.6", "1.0.6", "v2.0" from update message.
 */
export function extractVersionFromMessage(message: string | null | undefined): string | null {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed) return null;

  const versionMatch = trimmed.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
  if (versionMatch && versionMatch[1]) {
    return `v${versionMatch[1]}`;
  }

  const prefix = trimmed.split(/[:\-–]/)[0]?.trim();
  if (prefix) {
    const prefixMatch = prefix.match(/^v?(\d+\.\d+(?:\.\d+)?)/i);
    if (prefixMatch && prefixMatch[1]) {
      return `v${prefixMatch[1]}`;
    }
  }

  return null;
}

/**
 * Extracts clean description part from message (removes version prefix)
 */
export function extractDescriptionFromMessage(message: string | null | undefined): string | null {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed) return null;

  // Remove leading version tag like "v1.0.9:" or "v1.0.9 -" or "Version 1.0.9:"
  const withoutVersion = trimmed.replace(/^(?:v|ver|version)?\s*\d+\.\d+(?:\.\d+)?\s*[:\-–]\s*/i, '').trim();
  if (withoutVersion && withoutVersion.length > 0) {
    return withoutVersion;
  }

  const colonIdx = trimmed.indexOf(':');
  const dashIdx = trimmed.indexOf('-');
  if (colonIdx !== -1) {
    const sub = trimmed.substring(colonIdx + 1).trim();
    if (sub.length > 0) return sub;
  } else if (dashIdx !== -1) {
    const sub = trimmed.substring(dashIdx + 1).trim();
    if (sub.length > 0) return sub;
  }
  return trimmed;
}

/**
 * Resolves active app version dynamically
 */
export async function getActiveAppVersion(): Promise<string> {
  try {
    const manifestMsg = extractUpdateMessage(Updates.manifest);
    const parsedFromManifest = extractVersionFromMessage(manifestMsg);
    if (parsedFromManifest) {
      await AsyncStorage.setItem(ACTIVE_VERSION_KEY, parsedFromManifest);
      return parsedFromManifest;
    }

    const cachedVersion = await AsyncStorage.getItem(ACTIVE_VERSION_KEY);
    if (cachedVersion) {
      return cachedVersion;
    }
  } catch {
    // ignore
  }

  return CURRENT_RELEASE_VERSION;
}

export function getActiveAppVersionSync(): string {
  try {
    const manifestMsg = extractUpdateMessage(Updates.manifest);
    const parsed = extractVersionFromMessage(manifestMsg);
    if (parsed) return parsed;
  } catch {
    // ignore
  }
  return CURRENT_RELEASE_VERSION;
}

/**
 * Checks for updates in the background and applies auto-update if unapplied for > 2 days.
 */
export async function checkAndAutoApplyUpdates(): Promise<void> {
  if (!Updates.isEnabled) return;

  try {
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
      if (msg) {
        await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
      }

      logInfo('update', 'New update discovered on channel', {
        channel: Updates.channel,
        message: msg,
      });

      const fetchResult = await Updates.fetchUpdateAsync();

      if (fetchResult.isNew && now - firstSeen >= TWO_DAYS_MS) {
        logAction('update', 'Auto-applying update after 2 days unapplied');
        if (msg) {
          await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, msg);
          const ver = extractVersionFromMessage(msg);
          if (ver) {
            await AsyncStorage.setItem(ACTIVE_VERSION_KEY, ver);
          }
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
    // Fail silently
  }
}

/**
 * Unified hook for the Software Update screen and Settings badge.
 */
export function useAppUpdateManager(): AppUpdateInfo {
  const [discoveredAt, setDiscoveredAt] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [storedMessage, setStoredMessage] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string>(() => getActiveAppVersionSync());
  const [manualStatus, setManualStatus] = useState<'idle' | 'checking' | 'available' | 'downloaded' | 'up_to_date' | 'dev_mode' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeDownloadProgress, setActiveDownloadProgress] = useState<number>(0);
  const [isManualDownloading, setIsManualDownloading] = useState(false);

  const {
    currentlyRunning,
    availableUpdate,
    downloadedUpdate,
    isUpdateAvailable: hookAvailable,
    isUpdatePending: hookPending,
    downloadProgress: hookProgress,
    isDownloading: hookDownloading,
  } = Updates.useUpdates();

  useEffect(() => {
    let isMounted = true;

    async function initStorage() {
      const ver = await getActiveAppVersion();
      if (isMounted) setActiveVersion(ver);

      const discVal = await AsyncStorage.getItem(DISCOVERED_KEY);
      if (isMounted && discVal) setDiscoveredAt(parseInt(discVal, 10));

      const lastCheckedVal = await AsyncStorage.getItem(LAST_CHECKED_KEY);
      if (isMounted && lastCheckedVal) setLastCheckedAt(parseInt(lastCheckedVal, 10));

      const pendMsg = await AsyncStorage.getItem(PENDING_MESSAGE_KEY);
      const activeMsg = await AsyncStorage.getItem(ACTIVE_MESSAGE_KEY);
      const liveMsg = extractUpdateMessage(Updates.manifest) || extractUpdateMessage(currentlyRunning?.manifest);

      if (isMounted) {
        setStoredMessage(pendMsg || liveMsg || activeMsg);
      }
    }

    initStorage();

    return () => {
      isMounted = false;
    };
  }, [currentlyRunning]);

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

  const fallbackNext = getNextVersion(activeVersion);
  const availableVersion = extractVersionFromMessage(storedMessage) || (isUpdateAvailable || isUpdatePending ? fallbackNext : null);
  const availableDescription = extractDescriptionFromMessage(storedMessage) || (isUpdateAvailable || isUpdatePending ? 'Includes performance optimizations, UI polish, and bug fixes.' : null);

  const daysRemainingBeforeAutoUpdate = discoveredAt
    ? Math.max(0, Math.ceil((discoveredAt + TWO_DAYS_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

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
        setManualStatus('available');
        setDiscoveredAt(now);
        await AsyncStorage.setItem(DISCOVERED_KEY, now.toString());

        const msg = extractUpdateMessage(result.manifest);
        if (msg) {
          setStoredMessage(msg);
          await AsyncStorage.setItem(PENDING_MESSAGE_KEY, msg);
        }
      } else {
        setManualStatus('up_to_date');
        await AsyncStorage.removeItem(DISCOVERED_KEY);
        await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
        setDiscoveredAt(null);
      }
    } catch {
      setManualStatus('error');
      setErrorMessage('Unable to check for updates. Check your internet connection.');
    }
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;
    setIsManualDownloading(true);
    setErrorMessage(null);
    setActiveDownloadProgress(0.15);

    try {
      setActiveDownloadProgress(0.5);
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
  }, []);

  const handleRestartToApply = useCallback(async () => {
    try {
      const msgToApply = storedMessage || (await AsyncStorage.getItem(PENDING_MESSAGE_KEY));
      if (msgToApply) {
        await AsyncStorage.setItem(ACTIVE_MESSAGE_KEY, msgToApply);
        const ver = extractVersionFromMessage(msgToApply);
        if (ver) {
          await AsyncStorage.setItem(ACTIVE_VERSION_KEY, ver);
        }
      }
      await AsyncStorage.removeItem(DISCOVERED_KEY);
      await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
      await Updates.reloadAsync();
    } catch {
      setErrorMessage('Could not restart automatically. Please close and reopen the app.');
    }
  }, [storedMessage]);

  return {
    isEnabled: Updates.isEnabled,
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    updateMessage: storedMessage,
    activeVersion,
    releaseDescription: RELEASE_DESCRIPTION || 'Includes performance optimizations, UI polish, and bug fixes.',
    availableVersion,
    availableDescription,
    bundleSize: '~6.8 MB',
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
    checkForUpdates: handleCheckForUpdates,
    downloadUpdate: handleDownloadUpdate,
    restartToApply: handleRestartToApply,
  };
}
