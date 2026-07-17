import type { Subscription, NewSubscriptionInput } from "@/types/subscription";

/**
 * Converts subscriptions to a standard CSV string.
 */
export function subscriptionsToCSV(subscriptions: Subscription[]): string {
  const headers = [
    "Name", "Price", "Currency", "Billing Cycle", "Category", 
    "Start Date", "Next Billing Date", "Is Trial", "Notes"
  ];
  
  const rows = subscriptions.map((s) => [
    `"${s.name.replace(/"/g, '""')}"`,
    s.price,
    s.currency,
    s.billingCycle,
    s.category,
    s.startDate || "",
    s.nextBillingDate || "",
    s.isTrial ? "TRUE" : "FALSE",
    `"${(s.note || "").replace(/"/g, '""')}"`
  ]);
  
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

/**
 * Parses CSV string back into Subscription Inputs.
 */
export function parseCSVToSubscriptions(csvText: string): Partial<NewSubscriptionInput>[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  
  return lines.slice(1).map((line) => {
    // Regex matches values, respecting double quotes
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
    const cells = matches.map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    
    const record: any = {};
    headers.forEach((h, idx) => {
      const val = cells[idx];
      if (!val) return;
      if (h.includes("name")) record.name = val;
      else if (h.includes("price")) record.price = Number(val) || 0;
      else if (h.includes("currency")) record.currency = val.toUpperCase();
      else if (h.includes("cycle") || h.includes("billing")) record.billingCycle = val;
      else if (h.includes("category")) record.category = val;
      else if (h.includes("start")) record.startDate = val;
      else if (h.includes("next") || h.includes("due")) record.nextBillingDate = val;
      else if (h.includes("trial")) record.isTrial = val.toLowerCase() === "true" || val === "1";
      else if (h.includes("notes") || h.includes("note")) record.note = val;
    });
    return record;
  });
}
