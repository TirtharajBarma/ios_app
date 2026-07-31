import { File, Directory, Paths } from "expo-file-system";

const FAVICON_BASE = "https://www.google.com/s2/favicons?sz=128&domain=";

function getCacheDir(): Directory {
  return new Directory(Paths.cache, "favicons");
}

function getFile(domain: string): File {
  const filename = domain.replace(/[^a-zA-Z0-9.-]/g, "_") + ".png";
  return new File(getCacheDir(), filename);
}

export async function getFaviconUri(domain: string): Promise<string | null> {
  const file = getFile(domain);

  try {
    if (await file.exists) return file.uri;
  } catch {}

  try {
    const dir = getCacheDir();
    if (!(await dir.exists)) await dir.create();
    const result = await File.downloadFileAsync(
      `${FAVICON_BASE}${domain}`,
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
