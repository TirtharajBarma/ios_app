function renewalDaysInMonth(cycle: string, ref: Date, year: number, month: number, daysInMonth: number): number[] {
  const dayIdx = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86400000);
  if (cycle === 'weekly' || cycle === 'bi-weekly') {
    const step = cycle === 'weekly' ? 7 : 14;
    const refIdx = dayIdx(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const startIdx = dayIdx(year, month, 1);
    const first = startIdx + ((((refIdx - startIdx) % step) + step) % step);
    const days: number[] = [];
    for (let i = first; i < startIdx + daysInMonth; i += step) days.push(i - startIdx + 1);
    return days;
  }
  if (cycle === 'yearly' && ref.getMonth() !== month) return [];
  if (cycle !== 'monthly' && cycle !== 'daily' && cycle !== 'yearly' && !(ref.getFullYear() === year && ref.getMonth() === month)) return [];
  return [Math.min(ref.getDate(), daysInMonth)];
}

const eq = (got: number[], want: number[], label: string) => { if (JSON.stringify(got) !== JSON.stringify(want)) { console.log('FAIL', label, got, want); process.exitCode = 1; } };
const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
eq(renewalDaysInMonth('weekly', new Date(2026, 9, 7), 2026, 9, 31), [7, 14, 21, 28], 'weekly oct');
eq(renewalDaysInMonth('weekly', new Date(2026, 9, 7), 2026, 10, 30), [4, 11, 18, 25], 'weekly nov');
eq(renewalDaysInMonth('bi-weekly', new Date(2026, 9, 7), 2026, 9, 31), [7, 21], 'biweekly oct');
eq(renewalDaysInMonth('monthly', new Date(2026, 0, 31), 2026, 3, dim(2026, 3)), [30], 'monthly 31 in april');
eq(renewalDaysInMonth('monthly', new Date(2026, 0, 31), 2026, 1, dim(2026, 1)), [28], 'monthly 31 in feb');
eq(renewalDaysInMonth('yearly', new Date(2026, 2, 15), 2026, 3, 30), [], 'yearly other month');
eq(renewalDaysInMonth('yearly', new Date(2026, 3, 15), 2027, 3, 30), [15], 'yearly same month');
eq(renewalDaysInMonth('quarterly', new Date(2026, 9, 9), 2026, 9, 31), [9], 'quarterly this month');
eq(renewalDaysInMonth('quarterly', new Date(2026, 9, 9), 2026, 10, 30), [], 'quarterly other month');
console.log('ok');
