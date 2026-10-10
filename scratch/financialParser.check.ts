import { parseFinancialText } from '../utils/financialParser';

type Exp = { fin: boolean; type?: string; amount?: number; merchant?: RegExp };
const cases: [string, Exp][] = [
  // ── must keep working ──
  ['Rs.450.00 debited from A/c XX1234 on 10-10-26 to VPA swiggy@icici. UPI Ref 123', { fin: true, type: 'expense', amount: 450 }],
  ['INR 3,250.00 spent on HDFC Credit Card XX5678 at STARBUCKS on 10-Oct-26.', { fin: true, type: 'expense', amount: 3250, merchant: /starbucks/i }],
  ['Your a/c no. XX9012 is credited with Rs 50,000.00 salary on 25-Oct-26', { fin: true, type: 'income', amount: 50000 }],
  ['₹250 paid to Rapido via UPI', { fin: true, type: 'expense', amount: 250, merchant: /rapido/i }],
  ['Rs 1,23,456.78 debited from a/c XX1234 at AMAZON on 10-10-26', { fin: true, type: 'expense', amount: 123456.78 }],
  ['Rs.350 debited by a/c XX1234 transfer to RAMESH KUMAR on 10-10-26', { fin: true, type: 'expense', amount: 350, merchant: /ramesh/i }],
  ['Your OTP is 482913. Do not share with anyone.', { fin: false }],
  ['Pre-approved personal loan of Rs 5,00,000. Apply now!', { fin: false }],
  ['Refund of Rs 899 for order from MYNTRA has been credited to card ending 5678', { fin: true, type: 'income', amount: 899 }],
  // ── audit failures ──
  ['Your EMI of Rs 4,500 for loan a/c 1234 has been debited', { fin: true, type: 'expense', amount: 4500 }],
  ['Your credit card XX5678 payment of Rs 15,000 received. Thank you', { fin: false }],
  ['Payment of Rs.2000 due on 15th for card XX1234', { fin: false }],
  ['Your a/c XX1234 balance is Rs 5,000.00. Debit card used at ATM', { fin: false }],
  ['Rs 1,200.00 debited from a/c XX1234. Info: UPI-ZOMATO-123. Avl Bal INR 5,000.00', { fin: true, type: 'expense', amount: 1200, merchant: /^zomato$/i }],
];

let bad = 0;
for (const [text, e] of cases) {
  const r = parseFinancialText(text, 'TEST');
  const ok =
    r.isFinancial === e.fin &&
    (!e.fin || ((!e.type || r.type === e.type) && (!e.amount || r.amount === e.amount) && (!e.merchant || e.merchant.test(r.merchant || ''))));
  if (!ok) { bad++; console.log('FAIL:', text, '=>', JSON.stringify({ fin: r.isFinancial, type: r.type, amount: r.amount, merchant: r.merchant })); }
}
console.log(bad === 0 ? `ok (${cases.length})` : `${bad}/${cases.length} failing`);
if (bad) process.exitCode = 1;
