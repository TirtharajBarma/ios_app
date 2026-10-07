import { File, Directory, Paths } from "expo-file-system";

const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=128&domain=";

function sanitizeDomain(input: string): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    raw = "https://" + raw;
  }
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(host)) {
      return host;
    }
  } catch {}
  return null;
}

function getCacheDir(): Directory {
  return new Directory(Paths.cache, "favicons");
}

function getFile(domain: string): File {
  const filename = domain.replace(/[^a-zA-Z0-9.-]/g, "_") + ".png";
  return new File(getCacheDir(), filename);
}

export async function getFaviconUri(domain: string): Promise<string | null> {
  const safeHost = sanitizeDomain(domain);
  if (!safeHost) return null;

  const file = getFile(safeHost);

  try {
    if (await file.exists) return file.uri;
  } catch {}

  try {
    const dir = getCacheDir();
    if (!(await dir.exists)) await dir.create();
    const result = await File.downloadFileAsync(
      `${FAVICON_BASE}${encodeURIComponent(safeHost)}`,
      dir,
    );
    return result.uri;
  } catch {
    return null;
  }
}

export async function clearFaviconCache(): Promise<void> {
  try {
    const dir = getCacheDir();
    if (await dir.exists) await dir.delete();
  } catch {}
}
