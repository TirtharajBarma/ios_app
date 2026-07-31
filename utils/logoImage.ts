import { File, Directory, Paths } from "expo-file-system";

function extFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  const ext = match ? match[1].toLowerCase() : "jpg";
  return /^[a-zA-Z0-9]{1,5}$/.test(ext) ? `.${ext}` : ".jpg";
}

/**
 * Copies a user-picked image into app-controlled permanent storage so it
 * survives cache evictions and app restarts. ImagePicker returns URIs inside
 * the OS-managed temp/cache directory which can disappear later.
 *
 * Returns the permanent URI on success, or the original URI if the copy fails
 * (e.g. `ph://` / `content://` sources that aren't regular files).
 */
export async function persistLogoImage(sourceUri: string): Promise<string> {
  try {
    const dir = new Directory(Paths.document, "logos");
    if (!(await dir.exists)) await dir.create();

    const name = `logo_${Date.now()}${extFromUri(sourceUri)}`;
    const destination = new File(dir, name);
    const source = new File(sourceUri);

    if (!(await source.exists)) return sourceUri;
    await source.copy(destination);
    return destination.uri;
  } catch {
    return sourceUri;
  }
}

/**
 * Deletes a previously persisted logo image from app-controlled storage.
 * Safely ignores URIs that are not app-stored files (e.g. `ph://`, remote
 * URLs), so abandoned copies don't accumulate after a custom image is
 * replaced or removed.
 */
export async function deleteLogoImage(uri?: string | null): Promise<void> {
  if (!uri || !uri.startsWith("file:") || !uri.includes("/logos/")) return;
  try {
    const file = new File(uri);
    if (await file.exists) await file.delete();
  } catch {
    // Non-fatal: an orphaned file is harmless; never block the UI on cleanup.
  }
}
