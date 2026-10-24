import { parseTxDate, renewalDaysInMonth } from '../utils/localDate';
import { getNextRenewalDate } from '../utils/date';
import { buildCoachInsight, CoachInput } from '../utils/coachInsight';
let bad = 0;
const ok = (c: boolean, l: string) => { if (!c) { bad++; console.log('FAIL', l); } };

ok(parseTxDate('2026-10-10').getDate() === 10 && parseTxDate('2026-10-10').getHours() === 12, 'local day, not UTC');

// every cycle must agree with getNextRenewalDate (the store's scheduler) across 14 months
const start = new Date(2026, 0, 15, 12);
for (const cycle of ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'semi-yearly', 'yearly', 'custom:2:months', 'custom:10:days', 'custom:3:weeks', 'custom:2:years']) {
  const sched = cycle === 'daily' ? 'custom:1:days' : cycle;
  const expected = new Set<string>();
  const occ: Date[] = [];
  let d = start; // the start date itself is a renewal
  for (let i = 0; i < 600 && d.getFullYear() < 2028; i++) {
    expected.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    occ.push(d);
    d = getNextRenewalDate(start, sched, 1, d);
  }
  for (let m = 0; m < 14; m++) {
    const y = 2026 + Math.floor(m / 12), mo = m % 12;
    // ref = a later occurrence, so backward enumeration is exercised; start bounds the first month
    const ref = occ[Math.min(4, occ.length - 1)];
    const days = renewalDaysInMonth(cycle, ref, y, mo, 1, start);
    const exp = Array.from({ length: 31 }, (_, i) => i + 1).filter((day) => expected.has(`${y}-${mo}-${day}`));
    ok(days.join() === exp.join(), `${cycle} ${y}-${mo + 1} ${days} vs ${exp}`);
  }
}
// nothing before the subscription started
ok(renewalDaysInMonth('monthly', new Date(2026, 9, 15, 12), 2026, 5, 1, new Date(2026, 8, 1, 12)).length === 0, 'no renewal before start month');
ok(renewalDaysInMonth('quarterly', new Date(2026, 9, 15, 12), 2026, 9).join() === '15', 'quarterly this month');
ok(renewalDaysInMonth('quarterly', new Date(2026, 9, 15, 12), 2026, 10).length === 0, 'quarterly off month');
ok(renewalDaysInMonth('monthly', new Date(2026, 0, 31, 12), 2026, 3).join() === '30', 'clamp 31st in April');

// coach: singular day, and exactly-100% category is not "over"
const base = (o: Partial<CoachInput> = {}): CoachInput => ({
  now: new Date(2026, 9, 30), budget: 30000, spentToDate: 31000, spentToday: 0,
  dailySpend: [], upcomingFixed: 0, bills: [], liquid: 50000, categories: [], lastMonth: null, format: (n) => String(n), ...o,
});
ok(/1 day left/.test(buildCoachInsight(base())?.sub || ''), 'singular day left');
const c = buildCoachInsight(base({ spentToDate: 1000, categories: [{ id: 'cat_food', name: 'Food', spent: 5000, budget: 5000 }] }));
ok(!/over its budget/.test(c?.title || ''), 'exactly 100% is not over');
if (!bad) console.log('ok');
process.exitCode = bad ? 1 : 0;
