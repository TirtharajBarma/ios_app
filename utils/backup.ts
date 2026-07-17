import * as FileSystem from "expo-file-system";
import type { Subscription } from "@/types/subscription";

const BACKUP_LIMIT = 3;

/**
 * Saves a rolling JSON backup history locally on the device.
 */
export async function triggerAutoBackup(subscriptions: Subscription[]): Promise<void> {
  try {
    const dir = `${(FileSystem as any).documentDirectory}backups/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const payload = {
      version: 1,
      backupDate: new Date().toISOString(),
      subscriptions,
    };

    const fileUri = `${dir}backup-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload));

    // Keep only the last N backups
    const files = await FileSystem.readDirectoryAsync(dir);
    const sorted = files
      .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
      .sort((a, b) => {
        const timeA = Number(a.replace("backup-", "").replace(".json", ""));
        const timeB = Number(b.replace("backup-", "").replace(".json", ""));
        return timeA - timeB;
      });

    if (sorted.length > BACKUP_LIMIT) {
      const toDelete = sorted.slice(0, sorted.length - BACKUP_LIMIT);
      for (const file of toDelete) {
        await FileSystem.deleteAsync(`${dir}${file}`).catch(() => {});
      }
    }
  } catch (error) {
    console.warn("AutoBackup Engine: Failed to write backup snapshot", error);
  }
}
