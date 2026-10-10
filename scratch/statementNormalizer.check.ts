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
