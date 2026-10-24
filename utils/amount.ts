/**
 * Parses what a user types or pastes into an amount field.
 * "1,000" -> 1000, "1,23,456.50" -> 123456.5, "1,5" -> 1.5, "₹250" -> 250, "1k" -> 1000, "2.5l" -> 250000.
 * Returns 0 when nothing usable was entered (callers already reject amounts <= 0).
 */
export function parseAmountInput(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0;
  if (!raw) return 0;
  let s = String(raw).toLowerCase().replace(/[₹$€£\s]|rs\.?|inr/g, '');
  let mult = 1;
  const suffix = s.match(/(k|lakhs?|lacs?|l|cr|crores?)$/);
  if (suffix) {
    const u = suffix[1];
    mult = u === 'k' ? 1e3 : u.startsWith('cr') ? 1e7 : 1e5;
    s = s.slice(0, s.length - u.length);
  }
  if (s.includes(',')) {
    const grouped = /^\d{1,3}(?:,\d{2,3})+(?:\.\d+)?$/.test(s);
    const decimalComma = /^\d+,\d{1,2}$/.test(s) && !s.includes('.');
    s = decimalComma ? s.replace(',', '.') : grouped ? s.replace(/,/g, '') : s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  const v = n * mult;
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}
