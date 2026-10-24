import { normalizeStatementData } from '../utils/statementNormalizer';

const row = (y: number, ...texts: string[]) => ({ y, page: 1, items: texts.map((text, i) => ({ text, x: i * 60, y, width: 50, height: 10 } as any)) });
const rows = [
  row(10, 'State Bank of India', 'Statement'),
  row(20, '10/10/26', 'NEFT-FRIEND', '0.00', '2,000.00', '99,000.00'),
  row(30, '10/10/26', 'UPI-OLA', '500.00', '93,800.00'),
  row(40, '10/10/26', 'CHQ DEP', '0.00', '300.00', '8,000.00'),
  row(50, '11/10/26', 'UPI-SWIGGY', '450.00', '1,00,000.00'),
  row(60, '12/10/26', 'SAL ACME 0000555', '85,000.00', '2,00,000.00'),
];
const r = normalizeStatementData({ pdfRows: rows as any }, [], [], []);
const got = r.transactions.map((t) => `${t.type}:${t.amount}`);
const want = ['income:2000', 'expense:500', 'income:300', 'expense:450', 'expense:85000'];
const ok = JSON.stringify(got) === JSON.stringify(want);
console.log(ok ? 'ok' : `FAIL got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
if (!ok) process.exitCode = 1;

// --- CSV / amount / date regressions ---
import { parseInternationalAmount as pia, normalizeDateToISO as nd } from '../utils/statementNormalizer';
let bad = 0;
const eq = (n: string, g: any, w: any) => { if (JSON.stringify(g) !== JSON.stringify(w)) { bad++; console.log('FAIL', n, JSON.stringify(g), 'want', JSON.stringify(w)); } };
const csv = normalizeStatementData({ csvContent: 'Date,Narration,Amount,Balance\n2026-10-10,UPI-SWIGGY,-500.00,9500.00\n2026-10-11,REFUND (ZOMATO),(250.00),9250.00\n2026-10-12,SALARY ACME,1000.00,10250.00' } as any, [], [], []);
eq('csv', csv.transactions.map((t) => `${t.type}:${t.amount}`), ['expense:500', 'expense:250', 'income:1000']);
eq('csv narr', csv.transactions[0].narration.includes('-'), false);
eq('pia', ['Rs.1,234.00', 'Rs. 500', 'INR 500'].map(pia), [1234, 500, 500]);
eq('date', [nd('2026-10-11 14:30:00'), nd('11 10 2026'), nd('31/02/2026'), nd('garbage')], ['2026-10-11', '2026-10-11', '', '']);
const xfer = normalizeStatementData({ pdfRows: [row(10, 'State Bank of India'), row(20, '10/10/26', 'TRANSFER FROM SELF', '0.00', '700.00', '5,000.00')] as any }, [], [], []);
eq('xfer credit', [xfer.transactions[0]?.type, xfer.reconciliation.totalCredits, xfer.reconciliation.totalDebits], ['transfer', 700, 0]);
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
