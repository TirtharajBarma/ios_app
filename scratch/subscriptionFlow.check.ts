import { normalizeSubName, splitMonthlySaving, calculateMonthlySpend, toSubscriptionCategory } from '../utils/subscriptionUtils';
import { advanceCycle } from '../utils/date';

let bad = 0;
const eq = (got: unknown, want: unknown, label: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { console.log('FAIL', label, got, want); bad++; }
};

eq(normalizeSubName('Netflix.com') === normalizeSubName('NETFLIX India'), true, 'name suffixes');
eq(normalizeSubName(' Spotify! '), 'spotify', 'punctuation');
eq(normalizeSubName(''), '', 'empty');
eq(normalizeSubName(undefined), '', 'undefined');
eq(toSubscriptionCategory('Subscriptions'), 'other', 'custom category');
eq(toSubscriptionCategory('Music'), 'music', 'valid category');

const base: any = { id: 'a', name: 'x', price: 1200, currency: 'INR', billingCycle: 'yearly', isTrial: false, nextBillingDate: '2026-12-01' };
// yearly 1200, split 4 ways: saves 900/yr = 75/month
eq(splitMonthlySaving({ ...base, splitEnabled: true, splitType: 'people', splitValue: 4 }), 75, 'yearly split saving');
// promo discount alone is not a split saving
const promoOnly = { ...base, billingCycle: 'monthly', promoEnabled: true, promoPrice: 500, promoEndDate: '2999-01-01', splitEnabled: true, splitType: 'people', splitValue: 2 };
eq(splitMonthlySaving(promoOnly), 250, 'split on promo price only');
eq(splitMonthlySaving({ ...base, billingCycle: 'weekly', price: 100, splitEnabled: true, splitType: 'people', splitValue: 2 }), 50 * 52 / 12, 'weekly uses periodsPerYear');

// paused subs are not spend
eq(calculateMonthlySpend([{ ...base, billingCycle: 'monthly', isPaused: true }]), 0, 'paused spend');
eq(calculateMonthlySpend([{ ...base, billingCycle: 'monthly' }]), 1200, 'active spend');

// anchor day keeps the 31st after a short month
eq(advanceCycle('2026-02-28', 'monthly', 1, 31).slice(0, 10) >= '2026-03-27', true, 'anchorDay accepted');

if (bad) process.exitCode = 1; else console.log('subscriptionFlow ok');
