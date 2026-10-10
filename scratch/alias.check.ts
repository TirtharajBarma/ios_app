const hasAlias = (hay: string, a: string) =>
  a.length <= 4 ? new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(hay) : hay.includes(a);
const t = (h: string, a: string, w: boolean) => { if (hasAlias(h, a) !== w) { console.log('FAIL', h, a); process.exitCode = 1; } };
t('h&m store', 'h&m', true); t('paid via upi', 'vi', false); t('coca cola', 'ola', false); t('ola cabs', 'ola', true);
t('swiggyinstamart', 'swiggy', true); t('solar', 'gas', false); t('gas bill', 'gas', true);
console.log('ok');
