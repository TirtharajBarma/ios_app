import { getLastClosingDateStr } from '../utils/creditCard';
const eq = (a: string, b: string) => { if (a !== b) throw new Error(`${a} !== ${b}`); };
eq(getLastClosingDateStr(17, new Date(2026, 9, 9)), '2026-09-17');  // 9 Oct -> closed 17 Sep
eq(getLastClosingDateStr(17, new Date(2026, 9, 17)), '2026-10-17'); // closing day itself
eq(getLastClosingDateStr(17, new Date(2026, 9, 19)), '2026-10-17'); // 19 Oct -> spend after 17 Oct is unbilled
eq(getLastClosingDateStr(17, new Date(2027, 0, 5)), '2026-12-17');  // year rollover
eq(getLastClosingDateStr(31, new Date(2026, 2, 5)), '2026-02-28');  // short month clamp
console.log('ok');

import { getCreditCardDueStatus as st } from '../utils/creditCard';
// bill 17th, due 4th, user's example
let r = st(4, 17, 5000, new Date(2026, 9, 9), 5000);   // 9 Oct, all unbilled -> pay Nov 4
eq(r.dueDateFormatted!, 'Nov 4'); if (!r.isUnbilled) throw new Error('9 Oct unbilled');
r = st(4, 17, 8000, new Date(2026, 9, 19), 3000);      // 19 Oct: 5000 billed (Nov 4), 3000 unbilled
eq(r.dueDateFormatted!, 'Nov 4'); if (r.isUnbilled) throw new Error('billed part wins');
r = st(4, 17, 3000, new Date(2026, 9, 19), 3000);      // 19 Oct, only new spend -> Dec 4
eq(r.dueDateFormatted!, 'Dec 4'); if (!r.isUnbilled) throw new Error('19 Oct unbilled');
r = st(4, 17, 2000, new Date(2026, 9, 10), 0);         // 10 Oct, Sep statement unpaid past Oct 4
eq(r.status, 'overdue');
console.log('ok2');

// short-month clamp: bill 28th, due 30th, Feb 28 -> due Mar 30, not "due today"
r = st(30, 28, 100, new Date(2026, 1, 28), 0);
eq(r.dueDateFormatted!, 'Mar 30'); eq(r.status, 'upcoming');
r = st(31, 30, 100, new Date(2026, 1, 28), 0);
eq(r.dueDateFormatted!, 'Mar 31');
r = st(25, 5, 100, new Date(2026, 9, 28), 0);          // normal case unchanged
eq(r.dueDateFormatted!, 'Oct 25');
console.log('ok3');
