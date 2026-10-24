import type { Subscription, NewSubscriptionInput } from "@/types/subscription";

// Quote a text cell; prefix ' on leading = + - @ (or tab/CR) so spreadsheets don't run it as a formula
const quote = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
const unquoteFormula = (v: string) => v.replace(/^'(?=[=+\-@\t\r])/, "");
const toNum = (v: string) => Number(v.replace(/,/g, ""));

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
    quote(s.name || ""),
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
    quote(s.website || ""),
    quote(s.note || "")
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

/** Quote-aware CSV parser: quoted fields may contain commas, newlines and "" escapes. */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  const endRow = () => {
    row.push(current.trim());
    current = "";
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      current += char;
    }
  }
  endRow();
  return rows;
}

/**
 * Parses CSV string back into Subscription Inputs safely.
 */
export function parseCSVToSubscriptions(csvText: string): Partial<NewSubscriptionInput>[] {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());

  return rows.slice(1).map((cells) => {
    const record: any = {};

    headers.forEach((h, idx) => {
      const raw = cells[idx];
      const val = raw === undefined ? raw : unquoteFormula(raw);
      if (val === undefined || val === "") return;

      if (h === "name" || h.includes("name")) record.name = val;
      else if (h === "price") record.price = isNaN(toNum(val)) ? 0 : toNum(val);
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
      else if (h === "reminder days") record.reminderDays = isNaN(toNum(val)) ? 1 : toNum(val);
      else if (h === "split enabled") record.splitEnabled = val.toUpperCase() === "TRUE" || val === "1";
      else if (h === "split type") record.splitType = val;
      else if (h === "split value") record.splitValue = isNaN(toNum(val)) ? undefined : toNum(val);
      else if (h === "promo enabled") record.promoEnabled = val.toUpperCase() === "TRUE" || val === "1";
      else if (h === "promo price") record.promoPrice = isNaN(toNum(val)) ? undefined : toNum(val);
      else if (h === "promo end date") record.promoEndDate = val;
      else if (h === "website") record.website = val;
      else if (h === "notes" || h === "note") record.note = val;
    });

    return record;
  });
}
