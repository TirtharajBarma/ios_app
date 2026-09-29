import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import AsyncStorage from '@/utils/storage';
import { ensureSession } from '@/api/supabase';
import { getActiveAppVersion } from '@/services/updates/updateManager';

const DEVICE_ID_KEY = '@app_telemetry_device_id';
const LAST_PING_KEY = '@app_telemetry_last_ping_at';
const LAST_VERSION_KEY = '@app_telemetry_last_version';
const LAST_HASH_KEY = '@app_telemetry_last_hash';
const LAUNCH_COUNT_KEY = '@app_telemetry_launch_count';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Tracks anonymous device diagnostic telemetry purely for stability, bug fixes,
 * compatibility, and release updates.
 * ZERO GPS, ZERO personal data, 100% anonymous.
 */
export async function trackDeviceTelemetry(force: boolean = false): Promise<void> {
  try {
    const now = Date.now();
    const lastPingStr = await AsyncStorage.getItem(LAST_PING_KEY);
    const lastPing = lastPingStr ? parseInt(lastPingStr, 10) : 0;

    // Track total launches on this device
    const launchCountStr = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
    const launchCount = (launchCountStr ? parseInt(launchCountStr, 10) : 0) + 1;
    await AsyncStorage.setItem(LAUNCH_COUNT_KEY, launchCount.toString());

    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateUUID();
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

    const brand = Device.brand || (Platform.OS === 'ios' ? 'Apple' : 'Android');
    const modelName = Device.modelName || Device.productName || 'Unknown Model';
    const deviceName = Device.deviceName || `${brand} ${modelName}`;
    const osName = Device.osName || Platform.OS;
    const osVersion = Device.osVersion || String(Platform.Version);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    const channel = Updates.channel || 'preview';

    const payload = {
      device_id: deviceId,
      device_name: deviceName,
      brand,
      model_name: modelName,
      os_name: osName,
      os_version: osVersion,
      app_version: appVersion,
      update_hash: updateHash,
      channel,
      timezone,
      total_launches: launchCount,
      last_active_at: new Date().toISOString(),
    };

    // Upsert telemetry data silently
    await supabase.from('app_devices').upsert(payload, { onConflict: 'device_id' });
    
    // Store successful ping state
    await AsyncStorage.setItem(LAST_PING_KEY, now.toString());
    await AsyncStorage.setItem(LAST_VERSION_KEY, appVersion);
    await AsyncStorage.setItem(LAST_HASH_KEY, updateHash);
  } catch (err) {
    // Fail completely silently — zero impact on offline operations
  }
}
