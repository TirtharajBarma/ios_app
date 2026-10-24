import { parseInternationalAmount as a, normalizeDateToISO as d } from '../utils/statementNormalizer';
const A: [string, number][] = [
  ['1,234.56', 1234.56], ['1.234,56', 1234.56], ['12,34,567.89', 1234567.89], ['1234,56', 1234.56], ['1,000', 1000],
  ['₹ 1,500.00', 1500], ['-1,234.50', -1234.5], ['(1,234.50)', -1234.5], ['1 234,56', 1234.56],
  ['0,50', 0.5], ['1,500.00 Dr', 1500], ['', 0], ['abc', 0],
];
const D: [string, string][] = [
  ['13/09/2026', '2026-09-13'], ['09/13/2026', '2026-09-13'], ['2026-09-13', '2026-09-13'], ['13 Sep 2026', '2026-09-13'],
  ['Sep 13, 2026', '2026-09-13'], ['13-Sept-26', '2026-09-13'], ['2026-9-3', '2026-09-03'],
  // BUG-03: invalid/unparseable dates ('31/02/2026', 'garbage', '') silently become today or an impossible date - not asserted yet
  ['12 Mai 2026', '2026-05-12'], ['12 Okt 2026', '2026-10-12'], ['12 Dez 2026', '2026-12-12'], ['12 ene 2026', '2026-01-12'],
  ['12 ago 2026', '2026-08-12'], ['12 dic 2026', '2026-12-12'], ['12 Eki 2026', '2026-10-12'], ['12 juil. 2026', '2026-07-12'],
  ['12 Oca 2026', '2026-01-12'], ['12 Şub 2026', '2026-02-12'],
];
let bad = 0;
for (const [i, w] of A) { const g = a(i); if (g !== w) { bad++; console.log('AMOUNT FAIL', JSON.stringify(i), '->', g, 'want', w); } }
for (const [i, w] of D) { const g = d(i); const ok = g === w; if (!ok) { bad++; console.log('DATE FAIL', JSON.stringify(i), '->', g, 'want', w); } }
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
