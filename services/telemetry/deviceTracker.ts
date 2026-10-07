import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import AsyncStorage from '@/utils/storage';
import { ensureSession } from '@/api/supabase';
import { getActiveAppVersion } from '@/services/updates/updateManager';
import { useSettingsStore } from '@/store/useSettingsStore';

const DEVICE_ID_KEY = '@app_telemetry_device_id';
const LAST_PING_KEY = '@app_telemetry_last_ping_at';
const LAST_VERSION_KEY = '@app_telemetry_last_version';
const LAST_HASH_KEY = '@app_telemetry_last_hash';
const LAUNCH_COUNT_KEY = '@app_telemetry_launch_count';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Generates an anonymous, random device ID stored locally.
 * Zero user names, zero personal data, 100% anonymous.
 */
function generateAnonymousDeviceId(): string {
  const chars = '0123456789abcdef';
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `dev-${Date.now().toString(16)}-${rand}`;
}

/**
 * Tracks anonymous device diagnostic telemetry purely for stability, bug fixes,
 * compatibility, and release updates.
 * STRICTLY gated on user opt-in (`analyticsEnabled`).
 * ZERO personal data, ZERO user names, ZERO GPS.
 */
export async function trackDeviceTelemetry(force: boolean = false): Promise<void> {
  try {
    // Strictly respect the user's analytics opt-in preference
    const isAnalyticsEnabled = useSettingsStore.getState().analyticsEnabled;
    if (!isAnalyticsEnabled) {
      return;
    }

    const now = Date.now();
    const lastPingStr = await AsyncStorage.getItem(LAST_PING_KEY);
    const lastPing = lastPingStr ? parseInt(lastPingStr, 10) : 0;

    // Track total launches on this device
    const launchCountStr = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
    const launchCount = (launchCountStr ? parseInt(launchCountStr, 10) : 0) + 1;
    await AsyncStorage.setItem(LAUNCH_COUNT_KEY, launchCount.toString());

    const brand = Device.brand || (Platform.OS === 'ios' ? 'Apple' : 'Android');
    const modelName = Device.modelName || Device.productName || 'Unknown Model';
    const osName = Device.osName || Platform.OS;
    const osVersion = Device.osVersion || String(Platform.Version);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const channel = Updates.channel || 'preview';

    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateAnonymousDeviceId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    const appVersion = await getActiveAppVersion();
    const updateHash = Updates.updateId
      ? `#${Updates.updateId.slice(0, 8)}`
      : 'Embedded Base';

    // Check if this is a new version or newly launched OTA update hash
    const lastVersion = await AsyncStorage.getItem(LAST_VERSION_KEY);
    const lastHash = await AsyncStorage.getItem(LAST_HASH_KEY);
    const isNewVersionOrHash = appVersion !== lastVersion || updateHash !== lastHash;

    // If neither version nor hash changed, throttle remote pings to once every 2 hours
    if (!force && !isNewVersionOrHash && lastPing && now - lastPing < TWO_HOURS_MS) {
      return;
    }

    const supabase = await ensureSession();
    if (!supabase) return;

    // Send anonymous telemetry strictly through SECURITY DEFINER RPC
    // Note: device_name (owner's personal name) is NEVER collected or uploaded.
    await supabase.rpc('record_device_telemetry', {
      p_device_id: deviceId,
      p_brand: brand,
      p_model_name: modelName,
      p_os_name: osName,
      p_os_version: osVersion,
      p_app_version: appVersion,
      p_update_hash: updateHash,
      p_channel: channel,
      p_timezone: timezone || 'Asia/Kolkata',
      p_total_launches: launchCount,
    });
    
    // Store successful ping state
    await AsyncStorage.setItem(LAST_PING_KEY, now.toString());
    await AsyncStorage.setItem(LAST_VERSION_KEY, appVersion);
    await AsyncStorage.setItem(LAST_HASH_KEY, updateHash);
  } catch (err) {
    // Fail completely silently — zero impact on offline operations
  }
}
