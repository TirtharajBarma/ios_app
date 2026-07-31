/** Brand-logo variant keys available in the curated catalog. */
export type BrandLogoVariantKey = "primary" | "alternate" | "mark";

/**
 * A genuine brand asset bundled with the app (a variant of a brand's own
 * logo). These are real logos sourced from Wikimedia Commons — never
 * fabricated. `source` is a `local:brand:<name>` ref resolved by LogoCircle.
 */
export interface BrandLogoVariant {
  key: BrandLogoVariantKey;
  /** Human label shown under the tile, e.g. "Primary", "Mark". */
  label: string;
  source: string;
}

export interface Service {
  id: string;
  name: string;
  category: "Entertainment" | "Music" | "Productivity" | "Storage" | "Gaming" | "AI" | "Shopping" | "Health" | "Education" | "Finance";
  brandColor: string;
  iconUrl: string;
  whiteBackground?: boolean;
  website?: string;
  isPopular?: boolean;
  /** Curated brand-logo variants. Absent = no genuine bundled assets. */
  logoVariants?: BrandLogoVariant[];
}

function iconFor(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}

function brandVariant(
  key: BrandLogoVariantKey,
  label: string,
  name: string,
): BrandLogoVariant {
  return { key, label, source: `local:brand:${name}` };
}

/** Looks up a catalog service by its stable id. */
export function getServiceById(id?: string | null): Service | null {
  if (!id) return null;
  return services.find((s) => s.id === id) ?? null;
}

/**
 * Returns the selected variant of a service, falling back to the first
 * (primary) variant so a subscription always resolves to a real asset.
 */
export function getBrandVariant(
  service: Service | null | undefined,
  key?: string | null,
): BrandLogoVariant | undefined {
  if (!service?.logoVariants?.length) return undefined;
  return (
    service.logoVariants.find((v) => v.key === key) ?? service.logoVariants[0]
  );
}

export const services: Service[] = [
  // ─── Popular ───────────────────────────────────────────────────────
  { id: "netflix", name: "Netflix", category: "Entertainment", brandColor: "#E50914", iconUrl: iconFor("netflix.com"), website: "netflix.com", isPopular: true,
    logoVariants: [
      brandVariant("primary", "Wordmark", "netflix-primary"),
      brandVariant("mark", "Icon", "netflix-mark"),
    ] },
  { id: "spotify", name: "Spotify", category: "Music", brandColor: "#1DB954", iconUrl: iconFor("spotify.com"), website: "spotify.com", isPopular: true,
    logoVariants: [
      brandVariant("primary", "Wordmark", "spotify-primary"),
      brandVariant("mark", "Mark", "spotify-mark"),
    ] },
  { id: "youtube-premium", name: "YouTube Premium", category: "Entertainment", brandColor: "#FF0000", iconUrl: iconFor("youtube.com"), website: "youtube.com", isPopular: true,
    logoVariants: [
      brandVariant("primary", "Wordmark", "youtube-primary"),
      brandVariant("mark", "Play button", "youtube-mark"),
    ] },
  { id: "chatgpt", name: "ChatGPT Plus", category: "AI", brandColor: "#10A37F", iconUrl: iconFor("chatgpt.com"), website: "chatgpt.com", isPopular: true,
    logoVariants: [brandVariant("primary", "Primary", "chatgpt-primary")] },
  { id: "notion", name: "Notion Pro", category: "Productivity", brandColor: "#000000", iconUrl: iconFor("notion.so"), whiteBackground: true, website: "notion.so", isPopular: true,
    logoVariants: [brandVariant("primary", "Primary", "notion-primary")] },

  // ─── Entertainment ─────────────────────────────────────────────────
  { id: "crunchyroll", name: "Crunchyroll", category: "Entertainment", brandColor: "#DF6300", iconUrl: iconFor("crunchyroll.com"), website: "crunchyroll.com" },
  { id: "jiohotstar", name: "JioHotstar", category: "Entertainment", brandColor: "#0D6EFD", iconUrl: "local:jiohotstar", website: "jiostar.com" },
  { id: "zee5", name: "ZEE5", category: "Entertainment", brandColor: "#8B008B", iconUrl: iconFor("zee5.com"), website: "zee5.com" },
  { id: "sonyliv", name: "SonyLIV", category: "Entertainment", brandColor: "#1F1F1F", iconUrl: iconFor("sonyliv.com"), whiteBackground: true, website: "sonyliv.com" },
  { id: "jiocinema", name: "JioCinema", category: "Entertainment", brandColor: "#2196F3", iconUrl: "local:jiocinema", website: "jiocinema.com" },
  { id: "hoichoi", name: "hoichoi", category: "Entertainment", brandColor: "#E91E63", iconUrl: "local:hoichoi", website: "hoichoi.com" },
  { id: "lionsgate-play", name: "Lionsgate Play", category: "Entertainment", brandColor: "#1A1A1A", iconUrl: "local:lionsgateplay", whiteBackground: true, website: "lionsgateplay.com" },
  { id: "aha", name: "aha", category: "Entertainment", brandColor: "#E50914", iconUrl: "local:aha", website: "ahatelugu.com" },

  // ─── Music ─────────────────────────────────────────────────────────
  { id: "pandora", name: "Pandora Plus", category: "Music", brandColor: "#00A0FF", iconUrl: iconFor("pandora.com"), website: "pandora.com" },
  { id: "jiosaavn", name: "JioSaavn Pro", category: "Music", brandColor: "#2BC5B4", iconUrl: iconFor("jiosaavn.com"), website: "jiosaavn.com" },
  { id: "gaana", name: "Gaana Plus", category: "Music", brandColor: "#E52B50", iconUrl: iconFor("gaana.com"), website: "gaana.com" },

  // ─── Productivity ──────────────────────────────────────────────────
  { id: "zoom", name: "Zoom", category: "Productivity", brandColor: "#2D8CFF", iconUrl: iconFor("zoom.us"), website: "zoom.us" },
  { id: "adobe-cc", name: "Adobe Creative Cloud", category: "Productivity", brandColor: "#FF0000", iconUrl: iconFor("adobe.com"), website: "adobe.com" },
  { id: "todoist", name: "Todoist Pro", category: "Productivity", brandColor: "#E44332", iconUrl: iconFor("todoist.com"), website: "todoist.com" },

  // ─── Storage ───────────────────────────────────────────────────────
  { id: "google-one", name: "Google One", category: "Storage", brandColor: "#1A73E8", iconUrl: iconFor("one.google.com"), whiteBackground: true, website: "one.google.com",
    logoVariants: [brandVariant("primary", "Primary", "google-one-primary")] },
  { id: "box-storage", name: "Box", category: "Storage", brandColor: "#0061FC", iconUrl: iconFor("box.com"), website: "box.com" },

  // ─── Gaming ────────────────────────────────────────────────────────
  { id: "discord-nitro", name: "Discord Nitro", category: "Gaming", brandColor: "#5865F2", iconUrl: iconFor("discord.com"), website: "discord.com" },
  { id: "ea-play", name: "EA Play", category: "Gaming", brandColor: "#FF304F", iconUrl: iconFor("ea.com"), whiteBackground: true, website: "ea.com" },

  // ─── AI ────────────────────────────────────────────────────────────
  { id: "perplexity-pro", name: "Perplexity Pro", category: "AI", brandColor: "#22B2AC", iconUrl: iconFor("perplexity.ai"), website: "perplexity.ai" },
  { id: "copilot-pro", name: "Microsoft Copilot Pro", category: "AI", brandColor: "#00A2ED", iconUrl: iconFor("copilot.microsoft.com"), whiteBackground: true, website: "copilot.microsoft.com" },

  // ─── Shopping ──────────────────────────────────────────────────────
  { id: "costco", name: "Costco Member", category: "Shopping", brandColor: "#005EA6", iconUrl: iconFor("costco.com"), whiteBackground: true, website: "costco.com" },
  { id: "instacart", name: "Instacart+", category: "Shopping", brandColor: "#43B02A", iconUrl: iconFor("instacart.com"), website: "instacart.com" },

  // ─── Health ────────────────────────────────────────────────────────
  { id: "headspace", name: "Headspace", category: "Health", brandColor: "#FF8300", iconUrl: iconFor("headspace.com"), website: "headspace.com" },
  { id: "calm", name: "Calm", category: "Health", brandColor: "#0066FF", iconUrl: iconFor("calm.com"), website: "calm.com" },
  { id: "myfitnesspal", name: "MyFitnessPal", category: "Health", brandColor: "#0066EE", iconUrl: iconFor("myfitnesspal.com"), website: "myfitnesspal.com" },
  { id: "strava", name: "Strava Summit", category: "Health", brandColor: "#FC671A", iconUrl: iconFor("strava.com"), website: "strava.com" },
  { id: "cult-fit", name: "Cult.fit", category: "Health", brandColor: "#FF5722", iconUrl: iconFor("cult.fit"), website: "cult.fit" },
  { id: "healthifyme", name: "HealthifyMe", category: "Health", brandColor: "#4CAF50", iconUrl: "local:healthifyme", website: "healthifyme.com" },
  { id: "practo", name: "Practo Plus", category: "Health", brandColor: "#43A047", iconUrl: iconFor("practo.com"), website: "practo.com" },
  { id: "pharmeasy", name: "PharmEasy", category: "Health", brandColor: "#4FC3F7", iconUrl: iconFor("pharmeasy.in"), website: "pharmeasy.in" },

  // ─── Education ─────────────────────────────────────────────────────
  { id: "duolingo", name: "Duolingo Super", category: "Education", brandColor: "#58CC02", iconUrl: iconFor("duolingo.com"), website: "duolingo.com" },
  { id: "coursera", name: "Coursera Plus", category: "Education", brandColor: "#0056D2", iconUrl: iconFor("coursera.org"), website: "coursera.org" },
  { id: "skillshare", name: "Skillshare", category: "Education", brandColor: "#00FF84", iconUrl: iconFor("skillshare.com"), website: "skillshare.com" },
  { id: "masterclass", name: "MasterClass", category: "Education", brandColor: "#1C1C1E", iconUrl: iconFor("masterclass.com"), whiteBackground: true, website: "masterclass.com" },

  // ─── Finance ───────────────────────────────────────────────────────
  { id: "ynab", name: "YNAB", category: "Finance", brandColor: "#009CC6", iconUrl: iconFor("ynab.com"), website: "ynab.com" },
  { id: "quickbooks", name: "QuickBooks", category: "Finance", brandColor: "#2CA01C", iconUrl: iconFor("quickbooks.intuit.com"), website: "quickbooks.intuit.com" },
  { id: "robinhood-gold", name: "Robinhood Gold", category: "Finance", brandColor: "#00C805", iconUrl: iconFor("robinhood.com"), whiteBackground: true, website: "robinhood.com" },
  { id: "bloomberg", name: "Bloomberg Professional", category: "Finance", brandColor: "#3B5998", iconUrl: iconFor("bloomberg.com"), whiteBackground: true, website: "bloomberg.com" },

  // ─── Curated brand-logo variants ───────────────────────────────────
  { id: "google", name: "Google", category: "Productivity", brandColor: "#4285F4", iconUrl: iconFor("google.com"), whiteBackground: true, website: "google.com",
    logoVariants: [
      brandVariant("primary", "Wordmark", "google-primary"),
      brandVariant("mark", "G", "google-mark"),
    ] },
  { id: "amazon-prime", name: "Amazon Prime", category: "Shopping", brandColor: "#FF9900", iconUrl: iconFor("primevideo.com"), website: "amazon.com",
    logoVariants: [
      brandVariant("primary", "Wordmark", "amazon-prime-primary"),
      brandVariant("mark", "Mark", "amazon-prime-mark"),
    ] },
  { id: "prime-video", name: "Prime Video", category: "Entertainment", brandColor: "#00A8E1", iconUrl: iconFor("primevideo.com"), website: "primevideo.com",
    logoVariants: [
      brandVariant("primary", "Primary", "prime-video-primary"),
      brandVariant("alternate", "Amazon lockup", "prime-video-alternate"),
    ] },
  { id: "apple-music", name: "Apple Music", category: "Music", brandColor: "#FA243C", iconUrl: iconFor("music.apple.com"), website: "music.apple.com",
    logoVariants: [
      brandVariant("primary", "Wordmark", "apple-music-primary"),
      brandVariant("mark", "Apple", "apple-music-mark"),
    ] },
  { id: "apple-tv", name: "Apple TV+", category: "Entertainment", brandColor: "#000000", iconUrl: iconFor("tv.apple.com"), whiteBackground: true, website: "tv.apple.com",
    logoVariants: [
      brandVariant("primary", "Primary", "apple-tv-primary"),
      brandVariant("alternate", "Apple TV+", "apple-tv-alternate"),
    ] },
  { id: "disney-plus", name: "Disney+", category: "Entertainment", brandColor: "#0E3DAB", iconUrl: iconFor("disneyplus.com"), website: "disneyplus.com",
    logoVariants: [brandVariant("primary", "Primary", "disney-plus-primary")] },
  { id: "jio", name: "Jio", category: "Entertainment", brandColor: "#0D6EFD", iconUrl: iconFor("jio.com"), website: "jio.com",
    logoVariants: [brandVariant("primary", "Primary", "jio-primary")] },
  { id: "airtel", name: "Airtel", category: "Entertainment", brandColor: "#E40000", iconUrl: iconFor("airtel.in"), website: "airtel.in",
    logoVariants: [brandVariant("primary", "Primary", "airtel-primary")] },
  { id: "microsoft", name: "Microsoft 365", category: "Productivity", brandColor: "#F25022", iconUrl: iconFor("microsoft.com"), whiteBackground: true, website: "microsoft.com",
    logoVariants: [brandVariant("primary", "Primary", "microsoft-primary")] },
  { id: "github", name: "GitHub", category: "Productivity", brandColor: "#24292E", iconUrl: iconFor("github.com"), whiteBackground: true, website: "github.com",
    logoVariants: [
      brandVariant("primary", "Wordmark", "github-primary"),
      brandVariant("mark", "Octocat", "github-mark"),
    ] },
];
