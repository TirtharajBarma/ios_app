import { parseAmountInput as p } from '../utils/amount';
const cases: [any, number][] = [
  ['1,000', 1000], ['1,23,456.50', 123456.5], ['12,345.67', 12345.67], ['1,5', 1.5], ['₹250', 250], ['Rs. 1,200', 1200],
  ['1k', 1000], ['2.5k', 2500], ['1l', 100000], ['1.5 lakh', 150000], ['2cr', 20000000], ['450', 450], ['450.75', 450.75],
  ['', 0], ['abc', 0], ['0', 0], ['-5', 0], [undefined, 0], [123, 123], ['1,00,000', 100000], ['.5', 0.5],
];
let bad = 0;
for (const [i, w] of cases) { const g = p(i); if (g !== w) { bad++; console.log('FAIL', JSON.stringify(i), g, 'want', w); } }
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
