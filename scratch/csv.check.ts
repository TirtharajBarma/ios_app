import { subscriptionsToCSV, parseCSVToSubscriptions } from '../utils/csv';
const out = subscriptionsToCSV([{ name: '=HYPERLINK("x")', price: 1, note: 'a,b\nline2' } as any]);
const back = parseCSVToSubscriptions(out)[0] as any;
const t = parseCSVToSubscriptions('Name,Price\n"Foo",1,000\n"Bar","1,000"')
let bad = 0;
if (!out.includes(`"'=HYPERLINK`)) { bad++; console.log('FAIL guard'); }
if (back.name !== '=HYPERLINK("x")' || back.note !== 'a,b\nline2') { bad++; console.log('FAIL roundtrip', back); }
if ((t[1] as any).price !== 1000) { bad++; console.log('FAIL num', t); }
console.log(bad ? `${bad} failing` : 'ok');
if (bad) process.exitCode = 1;
