export interface DbSubscription {
  id: string;
  name: string;
  logo: string | null;
  website: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  billingCycle: string | null;
  isTrial: number; // 0 = false, 1 = true
  trialStartDate: string | null; // ISO Date String
  trialEndDate: string | null;   // ISO Date String
  renewDate: string | null;      // ISO Date String
  startDate: string | null;      // ISO Date String
  paymentMethod: string | null;
  brandColor: string | null;
  notes: string | null;
  reminderEnabled: number; // 0 = false, 1 = true
  reminderDays: number;    // number of days before
  
  // Splitting
  splitEnabled?: number; // 0 or 1
  splitType?: string | null;
  splitValue?: number | null;

  // Promo
  promoEnabled?: number; // 0 or 1
  promoPrice?: number | null;
  promoDurationValue?: number | null;
  promoDurationUnit?: string | null;
  promoStartDate?: string | null;
  promoEndDate?: string | null;

  isPaused?: number; // 0 or 1

  createdAt: string;       // ISO Date String
  updatedAt: string;       // ISO Date String
}

export interface DbTransaction {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  date: string;
  createdAt: string;
}

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    website TEXT,
    category TEXT,
    price REAL,
    currency TEXT,
    billingCycle TEXT,
    isTrial INTEGER DEFAULT 0,
    trialStartDate TEXT,
    trialEndDate TEXT,
    renewDate TEXT,
    startDate TEXT,
    paymentMethod TEXT,
    brandColor TEXT,
    notes TEXT,
    reminderEnabled INTEGER DEFAULT 0,
    reminderDays INTEGER DEFAULT 0,
    splitEnabled INTEGER DEFAULT 0,
    splitType TEXT,
    splitValue REAL,
    promoEnabled INTEGER DEFAULT 0,
    promoPrice REAL,
    promoDurationValue INTEGER,
    promoDurationUnit TEXT,
    promoStartDate TEXT,
    promoEndDate TEXT,
    isPaused INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    subscriptionId TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(subscriptionId) REFERENCES subscriptions(id) ON DELETE CASCADE
  );
`;

export const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_subscriptions_is_trial ON subscriptions(isTrial);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_renew_date ON subscriptions(renewDate);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date ON subscriptions(trialEndDate);
  CREATE INDEX IF NOT EXISTS idx_transactions_sub_id ON transactions(subscriptionId);
`;
