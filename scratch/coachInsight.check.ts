import { buildCoachInsight, CoachInput } from '../utils/coachInsight';
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const base = (o: Partial<CoachInput> = {}): CoachInput => ({
  now: new Date(2026, 9, 15), budget: 30000, spentToDate: 12000, spentToday: 300,
  dailySpend: [800, 0, 900, 700, 0, 850, 800, 750, 0, 820, 790, 760, 0, 800], upcomingFixed: 1000,
  bills: [], liquid: 50000, categories: [], lastMonth: null, format: fmt, ...o,
});
let bad = 0;
const ok = (c: boolean, l: string) => { if (!c) { bad++; console.log('FAIL', l); } };

// bill the accounts cannot cover wins over everything
let r = buildCoachInsight(base({ bills: [{ name: 'HDFC', billed: 18000, dueInDays: 2 }], liquid: 15000, spentToDate: 40000 }));
ok(r?.type === 'bill' && /fall short by about ₹3,000/.test(r.sub), 'bill shortfall first');
// a bill that is covered is not shown (the notification already covers it)
r = buildCoachInsight(base({ bills: [{ name: 'HDFC', billed: 18000, dueInDays: 2 }], liquid: 50000 }));
ok(r?.type !== 'bill', 'covered bill stays quiet');
// bill far away: quiet
r = buildCoachInsight(base({ bills: [{ name: 'HDFC', billed: 18000, dueInDays: 9 }], liquid: 100 }));
ok(r?.type !== 'bill', 'bill 9 days away stays quiet');
// over budget
r = buildCoachInsight(base({ spentToDate: 31500 }));
ok(r?.type === 'over' && /₹1,500 over/.test(r.title), 'over budget');
// on pace to overspend: heavy recent burn
r = buildCoachInsight(base({ spentToDate: 20000, dailySpend: Array(14).fill(1500) }));
ok(r?.type === 'forecast', 'forecast overspend');
// normal month: safe-to-spend today
r = buildCoachInsight(base());
ok(r?.type === 'safe' && /safe to spend today/.test(r.title), 'safe today');
// allowance used
r = buildCoachInsight(base({ spentToday: 5000 }));
ok(r?.type === 'safe' && /allowance is used/.test(r.title), 'allowance used');
// no budget -> nothing (unless a bill)
ok(buildCoachInsight(base({ budget: 0 })) === null, 'no budget -> quiet');
// first days of month: no safe-to-spend / no forecast
ok(buildCoachInsight(base({ now: new Date(2026, 9, 2), spentToDate: 500, spentToday: 100 })) === null, 'day 2 -> quiet');
// little history: no forecast even if spending is high
r = buildCoachInsight(base({ spentToDate: 25000, dailySpend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3000, 4000] }));
ok(r?.type !== 'forecast', 'too little history -> no forecast');
// category at 85% and over; per-category ids end with the month so a dismissal lasts the month
r = buildCoachInsight(base({ categories: [{ id: 'cat_food', name: 'Food', spent: 4250, budget: 5000 }] }));
ok(r?.type === 'category' && /Food has used 85%/.test(r.title) && r.id.endsWith('2026-10'), 'category 80%');
r = buildCoachInsight(base({ categories: [{ id: 'cat_food', name: 'Food', spent: 5600, budget: 5000 }] }));
ok(r?.type === 'category' && /₹600 over its budget/.test(r.title), 'category over beats safe-to-spend');
r = buildCoachInsight(base({ spentToDate: 31500, categories: [{ id: 'cat_food', name: 'Food', spent: 5600, budget: 5000 }] }));
ok(r?.type === 'over', 'overall over budget beats a category');
ok(buildCoachInsight(base({ categories: [{ id: 'cat_food', name: 'Food', spent: 3000, budget: 5000 }] }))?.type === 'safe', 'category at 60% stays quiet');
ok(buildCoachInsight(base({ budget: 0, categories: [{ id: 'cat_food', name: 'Food', spent: 4500, budget: 5000 }] }))?.type === 'category', 'category budgets work without a monthly budget');
// month end: unspent budget
r = buildCoachInsight(base({ now: new Date(2026, 9, 29), spentToDate: 24000, spentToday: 100 }));
ok(r?.type === 'recap' && /₹6,000 of this month's budget is unspent/.test(r.title), 'month-end recap');
ok(buildCoachInsight(base({ now: new Date(2026, 9, 29), spentToDate: 29500, spentToday: 100 }))?.type !== 'recap', 'month-end: almost no budget left -> no recap');
// month start recap
r = buildCoachInsight(base({ now: new Date(2026, 9, 1), spentToDate: 0, spentToday: 0, lastMonth: { label: 'September', spent: 21400, topCategory: 'Food' } }));
ok(r?.type === 'recap' && /September: ₹21,400 spent/.test(r.title) && /Food was the biggest/.test(r.sub), 'month-start recap');
ok(buildCoachInsight(base({ now: new Date(2026, 9, 1), spentToDate: 0, spentToday: 0, lastMonth: null })) === null, 'no last month -> quiet');
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
