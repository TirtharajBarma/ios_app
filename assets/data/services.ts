export interface Service {
  id: string;
  name: string;
  category: "Entertainment" | "Music" | "Productivity" | "Storage" | "Gaming" | "AI" | "Shopping" | "Health" | "Education" | "Finance";
  brandColor: string;
  iconUrl: string;
  whiteBackground?: boolean;
  website?: string;
  isPopular?: boolean;
}

function iconFor(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}

export const services: Service[] = [
  // ─── Popular ───────────────────────────────────────────────────────
  { id: "netflix", name: "Netflix", category: "Entertainment", brandColor: "#E50914", iconUrl: iconFor("netflix.com"), website: "netflix.com", isPopular: true },
  { id: "spotify", name: "Spotify", category: "Music", brandColor: "#1DB954", iconUrl: iconFor("spotify.com"), website: "spotify.com", isPopular: true },
  { id: "youtube-premium", name: "YouTube Premium", category: "Entertainment", brandColor: "#FF0000", iconUrl: iconFor("youtube.com"), website: "youtube.com", isPopular: true },
  { id: "chatgpt", name: "ChatGPT Plus", category: "AI", brandColor: "#10A37F", iconUrl: iconFor("chatgpt.com"), website: "chatgpt.com", isPopular: true },
  { id: "notion", name: "Notion Pro", category: "Productivity", brandColor: "#000000", iconUrl: iconFor("notion.so"), whiteBackground: true, website: "notion.so", isPopular: true },

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
];
