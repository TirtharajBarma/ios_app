import { safeToSpendToday, forecastMonthEnd, budgetThresholdCrossed, isUnusuallyLarge, trimmedMean } from '../utils/coach';
let bad = 0;
const ok = (c: boolean, l: string) => { if (!c) { bad++; console.log('FAIL', l); } };

// safe to spend: 30k budget, 10k before today, 5k fixed still to pay, 20 days left (incl. today) -> 750/day; 200 spent today
let r = safeToSpendToday({ budget: 30000, spentBeforeToday: 10000, spentToday: 200, upcomingFixed: 5000, daysRemaining: 20 });
ok(r?.perDay === 750 && r?.leftToday === 550, 'safe to spend');
ok(safeToSpendToday({ budget: 0, spentBeforeToday: 0, spentToday: 0, upcomingFixed: 0, daysRemaining: 10 }) === null, 'no budget -> null');
r = safeToSpendToday({ budget: 1000, spentBeforeToday: 1500, spentToday: 0, upcomingFixed: 0, daysRemaining: 5 });
ok(r?.perDay === 0 && r?.leftToday === 0, 'already over budget -> 0, never negative');

// forecast: 10 days of ~500, then 20 days left, 4k fixed to come, 5k spent
const f = forecastMonthEnd({ spentToDate: 5000, dailyVariable: [500, 500, 480, 520, 500, 510, 490, 500, 505, 495], daysLeft: 20, upcomingFixed: 4000 });
ok(!!f && Math.abs(f.forecast - 19000) < 400 && f.low <= f.forecast && f.forecast <= f.high, 'forecast near 19k');
ok(forecastMonthEnd({ spentToDate: 100, dailyVariable: [1, 2, 3], daysLeft: 20, upcomingFixed: 0 }) === null, 'too little data -> null');
// one huge day must not dominate the burn
ok(trimmedMean([100, 100, 100, 100, 100, 100, 100, 100, 100, 5000]) === 100, 'trimmed mean ignores one outlier');

ok(budgetThresholdCrossed(700, 850, 1000) === 80, '80% crossed');
ok(budgetThresholdCrossed(900, 1100, 1000) === 100, '100% crossed');
ok(budgetThresholdCrossed(850, 900, 1000) === null, 'already past 80, not crossed again');
ok(budgetThresholdCrossed(10, 20, 0) === null, 'no budget');

const hist = [300, 350, 320, 400, 380, 340, 360, 310, 330];
ok(isUnusuallyLarge(hist, 1500) === true, 'big order flagged');
ok(isUnusuallyLarge(hist, 400) === false, 'normal order not flagged');
ok(isUnusuallyLarge([300, 350, 400], 5000) === false, 'too little history -> never flags');
ok(isUnusuallyLarge([100, 100, 100, 100, 100, 100, 100, 100], 120) === false, 'no spread: small bump not flagged');
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
