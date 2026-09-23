import type { Subscription, NewSubscriptionInput } from "@/types/subscription";

/**
 * Converts subscriptions to a standard CSV string with full field preservation.
 */
export function subscriptionsToCSV(subscriptions: Subscription[]): string {
  const headers = [
    "Name", "Price", "Currency", "Billing Cycle", "Category", 
    "Start Date", "Next Billing Date", "Is Trial", "Trial End Date",
    "Color", "Logo Icon", "Reminder Enabled", "Reminder Days",
    "Split Enabled", "Split Type", "Split Value",
    "Promo Enabled", "Promo Price", "Promo End Date",
    "Website", "Notes"
  ];

  const rows = subscriptions.map((s) => [
    `"${(s.name || "").replace(/"/g, '""')}"`,
    s.price ?? 0,
    s.currency || "USD",
    s.rawBillingCycle || s.billingCycle || "monthly",
    s.category || "other",
    s.startDate || "",
    s.nextBillingDate || "",
    s.isTrial ? "TRUE" : "FALSE",
    s.trialEndDate || "",
    s.color || "#007AFF",
    s.logoIcon || "",
    s.reminderEnabled ? "TRUE" : "FALSE",
    s.reminderDays ?? 1,
    s.splitEnabled ? "TRUE" : "FALSE",
    s.splitType || "",
    s.splitValue ?? "",
    s.promoEnabled ? "TRUE" : "FALSE",
    s.promoPrice ?? "",
    s.promoEndDate || "",
    `"${(s.website || "").replace(/"/g, '""')}"`,
    `"${(s.note || "").replace(/"/g, '""')}"`
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Parses CSV string back into Subscription Inputs safely.
 */
export function parseCSVToSubscriptions(csvText: string): Partial<NewSubscriptionInput>[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const cells = parseCSVLine(line);
    const record: any = {};

    headers.forEach((h, idx) => {
      const val = cells[idx];
      if (val === undefined || val === "") return;

      if (h === "name" || h.includes("name")) record.name = val;
      else if (h === "price") record.price = isNaN(Number(val)) ? 0 : Number(val);
      else if (h === "currency") record.currency = val.toUpperCase();
      else if (h === "billing cycle" || h.includes("cycle")) {
        record.rawBillingCycle = val;
        record.billingCycle = val.startsWith("custom:") ? "custom" : val.toLowerCase();
      }
      else if (h === "category") record.category = val.toLowerCase();
      else if (h === "start date" || h === "start") record.startDate = val;
      else if (h === "next billing date" || h === "next") record.nextBillingDate = val;
      else if (h === "is trial" || h === "trial") record.isTrial = val.toUpperCase() === "TRUE" || val === "1";
      else if (h === "trial end date") record.trialEndDate = val;
      else if (h === "color") record.color = val;
      else if (h === "logo icon" || h === "logo") record.logoIcon = val;
      else if (h === "reminder enabled") record.reminderEnabled = val.toUpperCase() === "TRUE" || val === "1";
      else if (h === "reminder days") record.reminderDays = isNaN(Number(val)) ? 1 : Number(val);
      else if (h === "split enabled") record.splitEnabled = val.toUpperCase() === "TRUE" || val === "1";
      else if (h === "split type") record.splitType = val;
      else if (h === "split value") record.splitValue = isNaN(Number(val)) ? undefined : Number(val);
      else if (h === "promo enabled") record.promoEnabled = val.toUpperCase() === "TRUE" || val === "1";
      else if (h === "promo price") record.promoPrice = isNaN(Number(val)) ? undefined : Number(val);
      else if (h === "promo end date") record.promoEndDate = val;
      else if (h === "website") record.website = val;
      else if (h === "notes" || h === "note") record.note = val;
    });

    return record;
  });
}
