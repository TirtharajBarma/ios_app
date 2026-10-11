import { toDate, toLocalDateString } from '../utils/date';
const eq = (a: string, b: string, l: string) => { if (a !== b) { console.log('FAIL', l, a, b); process.exitCode = 1; } };
eq(toLocalDateString('2026-10-10'), '2026-10-10', 'date only');
eq(toLocalDateString(new Date(2026, 9, 10).toISOString()), '2026-10-10', 'local midnight stored as ISO');
eq(toLocalDateString(new Date(2026, 0, 1).toISOString()), '2026-01-01', 'year start');
eq(toLocalDateString(new Date(2026, 11, 31, 23, 30).toISOString()), '2026-12-31', 'late evening');
eq(String(toDate('2026-10-10').getDate()), '10', 'toDate day');
eq(toLocalDateString('not-a-date').length === 10 ? 'ok' : 'bad', 'ok', 'garbage falls back to today');
console.log('ok', process.env.TZ);
