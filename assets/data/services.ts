export interface Service {
  id: string;
  name: string;
  category: "Entertainment" | "Music" | "Productivity" | "Storage" | "Gaming" | "AI" | "Shopping" | "Health" | "Education" | "Finance";
  brandColor: string;
  website?: string;
  isPopular?: boolean;
}

export const services: Service[] = [
  // ─── Popular ───────────────────────────────────────────────────────
  { id: "netflix", name: "Netflix", category: "Entertainment", brandColor: "#E50914", website: "netflix.com", isPopular: true },
  { id: "spotify", name: "Spotify", category: "Music", brandColor: "#1DB954", website: "spotify.com", isPopular: true },
  { id: "apple-music", name: "Apple Music", category: "Music", brandColor: "#FA243C", website: "music.apple.com", isPopular: true },
  { id: "youtube-premium", name: "YouTube Premium", category: "Entertainment", brandColor: "#FF0000", website: "youtube.com", isPopular: true },
  { id: "disney-plus", name: "Disney+", category: "Entertainment", brandColor: "#113CCF", website: "disneyplus.com", isPopular: true },
  { id: "chatgpt", name: "ChatGPT Plus", category: "AI", brandColor: "#10A37F", website: "chatgpt.com", isPopular: true },
  { id: "icloud", name: "iCloud+", category: "Storage", brandColor: "#007AFF", website: "icloud.com", isPopular: true },
  { id: "notion", name: "Notion Pro", category: "Productivity", brandColor: "#000000", website: "notion.so", isPopular: true },
  
  // ─── Entertainment ─────────────────────────────────────────────────
  { id: "hulu", name: "Hulu", category: "Entertainment", brandColor: "#3DBB3E", website: "hulu.com" },
  { id: "hbo-max", name: "Max", category: "Entertainment", brandColor: "#5E26FF", website: "max.com" },
  { id: "prime-video", name: "Prime Video", category: "Entertainment", brandColor: "#00A8E1", website: "primevideo.com" },
  { id: "apple-tv", name: "Apple TV+", category: "Entertainment", brandColor: "#1C1C1E", website: "tv.apple.com" },
  { id: "paramount-plus", name: "Paramount+", category: "Entertainment", brandColor: "#0064FF", website: "paramountplus.com" },
  { id: "peacock", name: "Peacock", category: "Entertainment", brandColor: "#000000", website: "peacocktv.com" },
  { id: "crunchyroll", name: "Crunchyroll", category: "Entertainment", brandColor: "#DF6300", website: "crunchyroll.com" },
  { id: "youtube-tv", name: "YouTube TV", category: "Entertainment", brandColor: "#FF0000", website: "tv.youtube.com" },

  // ─── Music ─────────────────────────────────────────────────────────
  { id: "tidal", name: "Tidal", category: "Music", brandColor: "#000000", website: "tidal.com" },
  { id: "youtube-music", name: "YouTube Music", category: "Music", brandColor: "#FF0000", website: "music.youtube.com" },
  { id: "amazon-music", name: "Amazon Music", category: "Music", brandColor: "#00A8E1", website: "music.amazon.com" },
  { id: "soundcloud", name: "SoundCloud Go", category: "Music", brandColor: "#FF5500", website: "soundcloud.com" },
  { id: "pandora", name: "Pandora Plus", category: "Music", brandColor: "#00A0FF", website: "pandora.com" },

  // ─── Productivity ──────────────────────────────────────────────────
  { id: "figma", name: "Figma", category: "Productivity", brandColor: "#F24E1E", website: "figma.com" },
  { id: "slack", name: "Slack", category: "Productivity", brandColor: "#4A154B", website: "slack.com" },
  { id: "zoom", name: "Zoom", category: "Productivity", brandColor: "#2D8CFF", website: "zoom.us" },
  { id: "github-copilot", name: "GitHub Copilot", category: "Productivity", brandColor: "#24292F", website: "github.com" },
  { id: "microsoft-365", name: "Microsoft 365", category: "Productivity", brandColor: "#EB3C00", website: "microsoft365.com" },
  { id: "adobe-cc", name: "Adobe Creative Cloud", category: "Productivity", brandColor: "#FF0000", website: "adobe.com" },
  { id: "canva", name: "Canva Pro", category: "Productivity", brandColor: "#00C4CC", website: "canva.com" },
  { id: "todoist", name: "Todoist Pro", category: "Productivity", brandColor: "#E44332", website: "todoist.com" },

  // ─── Storage ───────────────────────────────────────────────────────
  { id: "dropbox", name: "Dropbox", category: "Storage", brandColor: "#0061FE", website: "dropbox.com" },
  { id: "google-one", name: "Google One", category: "Storage", brandColor: "#4285F4", website: "one.google.com" },
  { id: "onedrive", name: "OneDrive", category: "Storage", brandColor: "#0078D4", website: "onedrive.live.com" },
  { id: "box-storage", name: "Box", category: "Storage", brandColor: "#0061FC", website: "box.com" },

  // ─── Gaming ────────────────────────────────────────────────────────
  { id: "xbox-pass", name: "Xbox Game Pass", category: "Gaming", brandColor: "#107C10", website: "xbox.com" },
  { id: "ps-plus", name: "PlayStation Plus", category: "Gaming", brandColor: "#003087", website: "playstation.com" },
  { id: "nintendo-online", name: "Nintendo Switch Online", category: "Gaming", brandColor: "#E60012", website: "nintendo.com" },
  { id: "discord-nitro", name: "Discord Nitro", category: "Gaming", brandColor: "#5865F2", website: "discord.com" },
  { id: "ea-play", name: "EA Play", category: "Gaming", brandColor: "#FF304F", website: "ea.com" },

  // ─── AI ────────────────────────────────────────────────────────────
  { id: "claude-pro", name: "Claude Pro", category: "AI", brandColor: "#D29A74", website: "claude.ai" },
  { id: "perplexity-pro", name: "Perplexity Pro", category: "AI", brandColor: "#22B2AC", website: "perplexity.ai" },
  { id: "midjourney", name: "Midjourney", category: "AI", brandColor: "#5E5CE6", website: "midjourney.com" },
  { id: "copilot-pro", name: "Microsoft Copilot Pro", category: "AI", brandColor: "#00A2ED", website: "copilot.microsoft.com" },

  // ─── Shopping ──────────────────────────────────────────────────────
  { id: "amazon-prime", name: "Amazon Prime", category: "Shopping", brandColor: "#FF9900", website: "amazon.com" },
  { id: "costco", name: "Costco Member", category: "Shopping", brandColor: "#005EA6", website: "costco.com" },
  { id: "instacart", name: "Instacart+", category: "Shopping", brandColor: "#43B02A", website: "instacart.com" },
  { id: "shopify", name: "Shopify Store", category: "Shopping", brandColor: "#96BF48", website: "shopify.com" },

  // ─── Health ────────────────────────────────────────────────────────
  { id: "headspace", name: "Headspace", category: "Health", brandColor: "#FF8300", website: "headspace.com" },
  { id: "calm", name: "Calm", category: "Health", brandColor: "#0066FF", website: "calm.com" },
  { id: "myfitnesspal", name: "MyFitnessPal", category: "Health", brandColor: "#0066EE", website: "myfitnesspal.com" },
  { id: "strava", name: "Strava Summit", category: "Health", brandColor: "#FC671A", website: "strava.com" },

  // ─── Education ─────────────────────────────────────────────────────
  { id: "duolingo", name: "Duolingo Super", category: "Education", brandColor: "#58CC02", website: "duolingo.com" },
  { id: "coursera", name: "Coursera Plus", category: "Education", brandColor: "#0056D2", website: "coursera.org" },
  { id: "skillshare", name: "Skillshare", category: "Education", brandColor: "#00FF84", website: "skillshare.com" },
  { id: "masterclass", name: "MasterClass", category: "Education", brandColor: "#1C1C1E", website: "masterclass.com" },

  // ─── Finance ───────────────────────────────────────────────────────
  { id: "ynab", name: "YNAB", category: "Finance", brandColor: "#009CC6", website: "ynab.com" },
  { id: "quickbooks", name: "QuickBooks", category: "Finance", brandColor: "#2CA01C", website: "quickbooks.intuit.com" },
  { id: "robinhood-gold", name: "Robinhood Gold", category: "Finance", brandColor: "#00C805", website: "robinhood.com" },
  { id: "bloomberg", name: "Bloomberg Professional", category: "Finance", brandColor: "#3B5998", website: "bloomberg.com" },
];
