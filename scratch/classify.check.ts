import { classifyNarration, normalizeDateToISO } from '../utils/statementNormalizer';
const cats: any[] = ['cat_food', 'cat_trans', 'cat_shop', 'cat_ent', 'cat_util', 'cat_health', 'cat_fin', 'cat_misc', 'cat_cig', 'cat_salary'].map((id) => ({ id, name: id.replace('cat_', '') }));
const cases: [string, string][] = [
  ['STEAM GAMES', 'cat_ent'], ['COCA COLA', 'cat_misc'], ['UPI-OLA-12345', 'cat_trans'], ['DMART', 'cat_shop'],
  ['STARBUCKS', 'cat_food'], ['HDFC EMI DEBIT', 'cat_fin'], ['TEA STALL', 'cat_food'], ['BUS TICKET', 'cat_trans'],
  ['SYNTAX LTD', 'cat_misc'], ['SWIGGY ORDER', 'cat_food'], ['AIRTEL RECHARGE', 'cat_util'], ['APOLLO PHARMACY', 'cat_health'],
  ['COFFEE HOUSE', 'cat_food'], ['PRIVATE LABEL', 'cat_misc'], ['AMAZON', 'cat_shop'], ['NETFLIX', 'cat_ent'],
];
let bad = 0;
for (const [n, want] of cases) { const got = classifyNarration(n, cats, {}).categoryId; if (got !== want) { bad++; console.log('FAIL', n, got, 'want', want); } }
const d = normalizeDateToISO('01 Oct 26 12:30'); if (d !== '2026-10-01') { bad++; console.log('FAIL date', d); }
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
