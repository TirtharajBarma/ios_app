/**
 * Merchant Catalog & Narration Normalizer (100% Offline, Microsecond Execution)
 *
 * Maps messy bank SMS / UPI narrations (e.g. "UPI/42819/ZOMATO_ONLINE")
 * to clean canonical merchant names and their respective category mappings.
 */

export interface CanonicalMerchant {
  name: string;
  aliases: string[];
  defaultCategoryId: string;
  iconName?: string;
}

export const CANONICAL_MERCHANTS: CanonicalMerchant[] = [
  // ── Food & Dining ──
  {
    name: 'Swiggy',
    aliases: ['swiggy', 'swigy', 'swgy', 'swiggy instamart', 'bundl technologies'],
    defaultCategoryId: 'cat_food',
    iconName: 'UtensilsCrossed',
  },
  {
    name: 'Zomato',
    aliases: ['zomato', 'zomto', 'zmto', 'zomato online', 'zomato limited'],
    defaultCategoryId: 'cat_food',
    iconName: 'UtensilsCrossed',
  },
  {
    name: 'Starbucks',
    aliases: ['starbucks', 'starbux', 'starbucks coffee', 'tata starbucks'],
    defaultCategoryId: 'cat_food',
    iconName: 'Coffee',
  },
  {
    name: "McDonald's",
    aliases: ['mcdonalds', 'mcdonald', 'mcd', 'hardcastle restaurants'],
    defaultCategoryId: 'cat_food',
    iconName: 'UtensilsCrossed',
  },
  {
    name: 'KFC',
    aliases: ['kfc', 'kentucky fried chicken', 'sapphire foods', 'devyani international'],
    defaultCategoryId: 'cat_food',
    iconName: 'UtensilsCrossed',
  },
  {
    name: "Domino's",
    aliases: ['dominos', 'domino', 'jubilant foodworks'],
    defaultCategoryId: 'cat_food',
    iconName: 'UtensilsCrossed',
  },
  {
    name: 'Blinkit',
    aliases: ['blinkit', 'blnkt', 'grofers'],
    defaultCategoryId: 'cat_food',
    iconName: 'ShoppingBag',
  },
  {
    name: 'Zepto',
    aliases: ['zepto', 'kiranakart'],
    defaultCategoryId: 'cat_food',
    iconName: 'ShoppingBag',
  },
  {
    name: 'Instamart',
    aliases: ['instamart', 'swiggy instamart'],
    defaultCategoryId: 'cat_food',
    iconName: 'ShoppingBag',
  },
  {
    name: 'Blue Tokai',
    aliases: ['blue tokai', 'bluetokai', 'blue tokai coffee'],
    defaultCategoryId: 'cat_food',
    iconName: 'Coffee',
  },
  {
    name: 'Third Wave Coffee',
    aliases: ['third wave', 'third wave coffee', 'twc'],
    defaultCategoryId: 'cat_food',
    iconName: 'Coffee',
  },
  {
    name: 'Chaayos',
    aliases: ['chaayos', 'chayos', 'sunshine teahouse'],
    defaultCategoryId: 'cat_food',
    iconName: 'Coffee',
  },
  {
    name: 'Chai Point',
    aliases: ['chai point', 'chaipoint', 'mountain trail'],
    defaultCategoryId: 'cat_food',
    iconName: 'Coffee',
  },

  // ── Transport & Travel ──
  {
    name: 'Uber',
    aliases: ['uber', 'uber trip', 'uber india', 'help.uber'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Car',
  },
  {
    name: 'Ola',
    aliases: ['ola', 'ola cabs', 'ani technologies'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Car',
  },
  {
    name: 'Rapido',
    aliases: ['rapido', 'roppen transportation'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Bike',
  },
  {
    name: 'BluSmart',
    aliases: ['blusmart', 'blu smart', 'gensol'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Car',
  },
  {
    name: 'IRCTC',
    aliases: ['irctc', 'indian railways', 'railway ticket'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Train',
  },
  {
    name: 'MakeMyTrip',
    aliases: ['makemytrip', 'mmt'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Plane',
  },
  {
    name: 'IndiGo',
    aliases: ['indigo', 'interglobe aviation'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Plane',
  },
  {
    name: 'Shell',
    aliases: ['shell', 'shell petrol', 'shell fuel'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Fuel',
  },
  {
    name: 'Indian Oil',
    aliases: ['indian oil', 'iocl', 'indianoil'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Fuel',
  },
  {
    name: 'HP Petrol',
    aliases: ['hp petrol', 'hpcl', 'hindustan petroleum'],
    defaultCategoryId: 'cat_trans',
    iconName: 'Fuel',
  },

  // ── Shopping & E-Commerce ──
  {
    name: 'Amazon',
    aliases: ['amazon', 'amzn', 'amzn mktp', 'amazon seller', 'amazon pay'],
    defaultCategoryId: 'cat_shop',
    iconName: 'ShoppingBag',
  },
  {
    name: 'Flipkart',
    aliases: ['flipkart', 'flpkrt', 'flipkart internet'],
    defaultCategoryId: 'cat_shop',
    iconName: 'ShoppingBag',
  },
  {
    name: 'Myntra',
    aliases: ['myntra', 'myntra designs'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Shirt',
  },
  {
    name: 'Ajio',
    aliases: ['ajio', 'reliance ajio'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Shirt',
  },
  {
    name: 'Zara',
    aliases: ['zara', 'inditex'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Shirt',
  },
  {
    name: 'H&M',
    aliases: ['h&m', 'hm', 'hennes & mauritz'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Shirt',
  },
  {
    name: 'Uniqlo',
    aliases: ['uniqlo', 'fast retailing'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Shirt',
  },
  {
    name: 'Nykaa',
    aliases: ['nykaa', 'fsn e-commerce'],
    defaultCategoryId: 'cat_shop',
    iconName: 'ShoppingBag',
  },
  {
    name: 'Croma',
    aliases: ['croma', 'infiniti retail'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Tv',
  },
  {
    name: 'Decathlon',
    aliases: ['decathlon', 'decathlon sports'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Activity',
  },
  {
    name: 'Apple',
    aliases: ['apple.com', 'apple store', 'apple services', 'itunes'],
    defaultCategoryId: 'cat_shop',
    iconName: 'Smartphone',
  },

  // ── Entertainment & Subscriptions ──
  {
    name: 'Netflix',
    aliases: ['netflix', 'netflix.com'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Film',
  },
  {
    name: 'Spotify',
    aliases: ['spotify', 'spotify india'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Music',
  },
  {
    name: 'Disney+ Hotstar',
    aliases: ['hotstar', 'disney', 'disney plus', 'disney+ hotstar', 'novi digital'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Tv',
  },
  {
    name: 'YouTube',
    aliases: ['youtube', 'youtube premium', 'google youtube'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Video',
  },
  {
    name: 'BookMyShow',
    aliases: ['bookmyshow', 'bms', 'bigtree entertainment'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Ticket',
  },
  {
    name: 'PVR INOX',
    aliases: ['pvr', 'inox', 'pvr cinemas', 'inox leisure'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Film',
  },
  {
    name: 'PlayStation',
    aliases: ['playstation', 'psn', 'sony interactive'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Gamepad2',
  },
  {
    name: 'Steam',
    aliases: ['steam', 'steampowered', 'valve'],
    defaultCategoryId: 'cat_ent',
    iconName: 'Gamepad2',
  },

  // ── Health & Fitness ──
  {
    name: 'Cult.fit',
    aliases: ['cult.fit', 'cultfit', 'curefit', 'cult pass'],
    defaultCategoryId: 'cat_health',
    iconName: 'Activity',
  },
  {
    name: 'Tata 1mg',
    aliases: ['1mg', 'tata 1mg', 'tata 1 mg'],
    defaultCategoryId: 'cat_health',
    iconName: 'Pill',
  },
  {
    name: 'Apollo Pharmacy',
    aliases: ['apollo', 'apollo pharmacy', 'apollo hospitals'],
    defaultCategoryId: 'cat_health',
    iconName: 'Pill',
  },
  {
    name: 'PharmEasy',
    aliases: ['pharmeasy', 'axelia solutions'],
    defaultCategoryId: 'cat_health',
    iconName: 'Pill',
  },

  // ── Utilities & Bills ──
  {
    name: 'Airtel',
    aliases: ['airtel', 'bharti airtel', 'airtel prepaid', 'airtel broadband'],
    defaultCategoryId: 'cat_util',
    iconName: 'Smartphone',
  },
  {
    name: 'Jio',
    aliases: ['jio', 'reliance jio', 'jio prepaid', 'jiofiber'],
    defaultCategoryId: 'cat_util',
    iconName: 'Wifi',
  },
  {
    name: 'Tata Play',
    aliases: ['tata play', 'tataplay', 'tata sky'],
    defaultCategoryId: 'cat_util',
    iconName: 'Tv',
  },

  // ── Finance & Investments ──
  {
    name: 'Zerodha',
    aliases: ['zerodha', 'zerodha broking'],
    defaultCategoryId: 'cat_fin',
    iconName: 'TrendingUp',
  },
  {
    name: 'Groww',
    aliases: ['groww', 'nextbillion'],
    defaultCategoryId: 'cat_fin',
    iconName: 'TrendingUp',
  },
  {
    name: 'INDmoney',
    aliases: ['indmoney', 'ind money'],
    defaultCategoryId: 'cat_fin',
    iconName: 'TrendingUp',
  },
  {
    name: 'CRED',
    aliases: ['cred', 'dreamplug'],
    defaultCategoryId: 'cat_fin',
    iconName: 'CreditCard',
  },
];

/**
 * Normalizes any text (such as note, merchant name, or narration)
 * to a Canonical Merchant if recognized.
 */
export function identifyCanonicalMerchant(text: string): CanonicalMerchant | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const m of CANONICAL_MERCHANTS) {
    if (m.aliases.some((alias) => lower.includes(alias))) {
      return m;
    }
  }

  return null;
}

/**
 * Extracts candidate merchant query string from user query.
 */
export function extractMerchantFromQuery(query: string): CanonicalMerchant | null {
  const q = query.toLowerCase();
  for (const m of CANONICAL_MERCHANTS) {
    if (m.aliases.some((alias) => q.includes(alias))) {
      return m;
    }
  }
  return null;
}
