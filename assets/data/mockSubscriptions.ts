export interface Subscription {
  id: string;
  name: string;
  logoUrl?: string;
  price: number;
  currency: string;
  billingCycle: "monthly" | "yearly";
  nextRenewal: string; // ISO date string (YYYY-MM-DD)
  category: string;
  themeColor: string;
  isTrial: boolean;
}

export const mockSubscriptions: Subscription[] = [
  {
    id: "netflix",
    name: "Netflix",
    price: 15.99,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-07-20",
    category: "Entertainment",
    themeColor: "#E50914",
    isTrial: false,
  },
  {
    id: "spotify",
    name: "Spotify",
    price: 10.99,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-07-22",
    category: "Music",
    themeColor: "#1DB954",
    isTrial: false,
  },
  {
    id: "chatgpt",
    name: "ChatGPT Plus",
    price: 20.00,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-07-18",
    category: "Productivity",
    themeColor: "#10A37F",
    isTrial: false,
  },
  {
    id: "apple-music",
    name: "Apple Music",
    price: 9.99,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-07-28",
    category: "Music",
    themeColor: "#FA243C",
    isTrial: true,
  },
  {
    id: "youtube-premium",
    name: "YouTube Premium",
    price: 13.99,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-08-01",
    category: "Entertainment",
    themeColor: "#FF0000",
    isTrial: false,
  },
  {
    id: "disney-plus",
    name: "Disney+",
    price: 7.99,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-07-25",
    category: "Entertainment",
    themeColor: "#113CCF",
    isTrial: false,
  },
  {
    id: "amazon-prime",
    name: "Amazon Prime",
    price: 139.00,
    currency: "$",
    billingCycle: "yearly",
    nextRenewal: "2026-08-12",
    category: "Utilities",
    themeColor: "#FF9900",
    isTrial: false,
  },
  {
    id: "icloud",
    name: "iCloud+",
    price: 2.99,
    currency: "$",
    billingCycle: "monthly",
    nextRenewal: "2026-07-19",
    category: "Storage",
    themeColor: "#007AFF",
    isTrial: false,
  },
];
