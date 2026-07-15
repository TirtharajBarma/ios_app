import { getDatabase } from "./database";
import { createSubscription } from "./queries";
import type { DbSubscription } from "./schema";

const SEED_DATA: Omit<DbSubscription, "createdAt" | "updatedAt">[] = [
  {
    id: "netflix-seed",
    name: "Netflix",
    logo: "https://logo.clearbit.com/netflix.com",
    website: "netflix.com",
    category: "Entertainment",
    price: 15.99,
    currency: "USD ($)",
    billingCycle: "Monthly",
    isTrial: 0,
    trialStartDate: null,
    trialEndDate: null,
    renewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    startDate: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: "Credit Card",
    brandColor: "#E50914",
    notes: "Premium Ultra-HD 4-Screen plan",
    reminderEnabled: 1,
    reminderDays: 1,
  },
  {
    id: "spotify-seed",
    name: "Spotify",
    logo: "https://logo.clearbit.com/spotify.com",
    website: "spotify.com",
    category: "Music",
    price: 10.99,
    currency: "USD ($)",
    billingCycle: "Monthly",
    isTrial: 0,
    trialStartDate: null,
    trialEndDate: null,
    renewDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
    startDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: "Apple Pay",
    brandColor: "#1DB954",
    notes: "Spotify Premium Family plan",
    reminderEnabled: 1,
    reminderDays: 3,
  },
  {
    id: "chatgpt-seed",
    name: "ChatGPT Plus",
    logo: "https://logo.clearbit.com/chatgpt.com",
    website: "chatgpt.com",
    category: "AI",
    price: 20.00,
    currency: "USD ($)",
    billingCycle: "Monthly",
    isTrial: 0,
    trialStartDate: null,
    trialEndDate: null,
    renewDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days from now
    startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: "Debit Card",
    brandColor: "#10A37F",
    notes: "AI coding and writing tasks",
    reminderEnabled: 1,
    reminderDays: 1,
  },
  {
    id: "apple-music-seed",
    name: "Apple Music",
    logo: "https://logo.clearbit.com/apple.com",
    website: "music.apple.com",
    category: "Music",
    price: 10.99,
    currency: "USD ($)",
    billingCycle: "Monthly",
    isTrial: 1,
    trialStartDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
    trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days left in trial
    renewDate: null,
    startDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: "Apple Pay",
    brandColor: "#FA243C",
    notes: "Free trial through Apple hardware bundle",
    reminderEnabled: 1,
    reminderDays: 1,
  },
  {
    id: "disney-seed",
    name: "Disney+",
    logo: "https://logo.clearbit.com/disneyplus.com",
    website: "disneyplus.com",
    category: "Entertainment",
    price: 139.99,
    currency: "USD ($)",
    billingCycle: "Yearly",
    isTrial: 0,
    trialStartDate: null,
    trialEndDate: null,
    renewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months from now
    startDate: new Date(Date.now() - 185 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: "PayPal",
    brandColor: "#113CCF",
    notes: "Annual bundle membership",
    reminderEnabled: 1,
    reminderDays: 7,
  },
  {
    id: "google-one-seed",
    name: "Google One",
    logo: "https://logo.clearbit.com/google.com",
    website: "one.google.com",
    category: "Storage",
    price: 1.99,
    currency: "USD ($)",
    billingCycle: "Monthly",
    isTrial: 0,
    trialStartDate: null,
    trialEndDate: null,
    renewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    startDate: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: "Google Pay",
    brandColor: "#4285F4",
    notes: "100GB Google Drive cloud storage",
    reminderEnabled: 0,
    reminderDays: 0,
  },
];

/**
 * Seeds the database if there are no existing subscriptions.
 */
export async function seedDatabase(): Promise<boolean> {
  try {
    const db = getDatabase();
    
    // Check if subscriptions exist
    const countResult = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM subscriptions;");
    const count = countResult?.count ?? 0;

    if (count > 0) {
      console.log(`Database: Skipping seed because ${count} subscriptions already exist.`);
      return false;
    }

    console.log("Database: Seeding initial subscription records...");
    for (const record of SEED_DATA) {
      await createSubscription(record);
    }
    console.log(`Database: Seeding complete. Inserted ${SEED_DATA.length} records.`);
    return true;
  } catch (error) {
    console.error("Database: Failed to seed database", error);
    return false;
  }
}
