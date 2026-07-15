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
  createdAt: string;       // ISO Date String
  updatedAt: string;       // ISO Date String
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
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

export const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_subscriptions_is_trial ON subscriptions(isTrial);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_renew_date ON subscriptions(renewDate);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date ON subscriptions(trialEndDate);
`;
