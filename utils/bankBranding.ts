/**
 * Popular Banks, Credit Cards, Wallets & Financial Institutions Branding Resolver
 * Maps names to crystal-clear, high-resolution official brand logos.
 */

export interface BankBrand {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  brandColor: string;
  type?: 'savings' | 'credit' | 'wallet' | 'cash';
}

// Curated high-res domains for popular Indian and International banks, cards & fintechs
const KNOWN_FINANCIAL_DOMAINS: Record<string, { domain: string; brandColor: string; type?: 'savings' | 'credit' | 'wallet' }> = {
  // Top Indian Banks
  hdfc: { domain: 'hdfcbank.com', brandColor: '#004C8F', type: 'savings' },
  'hdfc bank': { domain: 'hdfcbank.com', brandColor: '#004C8F', type: 'savings' },
  sbi: { domain: 'sbi.co.in', brandColor: '#280071', type: 'savings' },
  'state bank of india': { domain: 'sbi.co.in', brandColor: '#280071', type: 'savings' },
  'state bank': { domain: 'sbi.co.in', brandColor: '#280071', type: 'savings' },
  icici: { domain: 'icicibank.com', brandColor: '#F58220', type: 'savings' },
  'icici bank': { domain: 'icicibank.com', brandColor: '#F58220', type: 'savings' },
  axis: { domain: 'axisbank.com', brandColor: '#97144D', type: 'savings' },
  'axis bank': { domain: 'axisbank.com', brandColor: '#97144D', type: 'savings' },
  kotak: { domain: 'kotak.com', brandColor: '#ED1C24', type: 'savings' },
  'kotak mahindra': { domain: 'kotak.com', brandColor: '#ED1C24', type: 'savings' },
  'kotak bank': { domain: 'kotak.com', brandColor: '#ED1C24', type: 'savings' },
  pnb: { domain: 'pnbindia.in', brandColor: '#A20000', type: 'savings' },
  'punjab national bank': { domain: 'pnbindia.in', brandColor: '#A20000', type: 'savings' },
  bob: { domain: 'bankofbaroda.in', brandColor: '#F26522', type: 'savings' },
  'bank of baroda': { domain: 'bankofbaroda.in', brandColor: '#F26522', type: 'savings' },
  canara: { domain: 'canarabank.com', brandColor: '#0072BC', type: 'savings' },
  'canara bank': { domain: 'canarabank.com', brandColor: '#0072BC', type: 'savings' },
  indusind: { domain: 'indusind.com', brandColor: '#981F26', type: 'savings' },
  'indusind bank': { domain: 'indusind.com', brandColor: '#981F26', type: 'savings' },
  yes: { domain: 'yesbank.in', brandColor: '#0B5DA2', type: 'savings' },
  'yes bank': { domain: 'yesbank.in', brandColor: '#0B5DA2', type: 'savings' },
  idfc: { domain: 'idfcfirstbank.com', brandColor: '#9E1B32', type: 'savings' },
  'idfc first': { domain: 'idfcfirstbank.com', brandColor: '#9E1B32', type: 'savings' },
  'idfc first bank': { domain: 'idfcfirstbank.com', brandColor: '#9E1B32', type: 'savings' },
  federal: { domain: 'federalbank.co.in', brandColor: '#004F9F', type: 'savings' },
  'federal bank': { domain: 'federalbank.co.in', brandColor: '#004F9F', type: 'savings' },
  rbl: { domain: 'rblbank.com', brandColor: '#003B6F', type: 'savings' },
  'rbl bank': { domain: 'rblbank.com', brandColor: '#003B6F', type: 'savings' },
  'standard chartered': { domain: 'sc.com', brandColor: '#009E49', type: 'savings' },
  stanchart: { domain: 'sc.com', brandColor: '#009E49', type: 'savings' },
  hsbc: { domain: 'hsbc.co.in', brandColor: '#DB0011', type: 'savings' },
  citi: { domain: 'citi.com', brandColor: '#003B70', type: 'savings' },
  citibank: { domain: 'citi.com', brandColor: '#003B70', type: 'savings' },
  dbs: { domain: 'dbs.com', brandColor: '#E60000', type: 'savings' },
  'dbs bank': { domain: 'dbs.com', brandColor: '#E60000', type: 'savings' },
  aubank: { domain: 'aubank.in', brandColor: '#7A1C78', type: 'savings' },
  'au small finance': { domain: 'aubank.in', brandColor: '#7A1C78', type: 'savings' },
  'au bank': { domain: 'aubank.in', brandColor: '#7A1C78', type: 'savings' },

  // Fintech Cards & Neo-banks
  slice: { domain: 'sliceit.com', brandColor: '#6D4AFF', type: 'credit' },
  'slice card': { domain: 'sliceit.com', brandColor: '#6D4AFF', type: 'credit' },
  onecard: { domain: 'getonecard.app', brandColor: '#18181B', type: 'credit' },
  'one card': { domain: 'getonecard.app', brandColor: '#18181B', type: 'credit' },
  cred: { domain: 'cred.club', brandColor: '#121212', type: 'credit' },
  'cred card': { domain: 'cred.club', brandColor: '#121212', type: 'credit' },
  'cred pay': { domain: 'cred.club', brandColor: '#121212', type: 'credit' },
  fi: { domain: 'fi.money', brandColor: '#00D09C', type: 'savings' },
  'fi money': { domain: 'fi.money', brandColor: '#00D09C', type: 'savings' },
  jupiter: { domain: 'jupiter.money', brandColor: '#FF6B4A', type: 'savings' },
  'jupiter money': { domain: 'jupiter.money', brandColor: '#FF6B4A', type: 'savings' },
  uni: { domain: 'uni.cards', brandColor: '#05D380', type: 'credit' },
  'uni card': { domain: 'uni.cards', brandColor: '#05D380', type: 'credit' },
  scapia: { domain: 'scapia.cards', brandColor: '#FF4F5A', type: 'credit' },
  'scapia card': { domain: 'scapia.cards', brandColor: '#FF4F5A', type: 'credit' },
  niyo: { domain: 'goniyo.com', brandColor: '#0070BA', type: 'savings' },

  // Wallets & UPI Providers
  amazon: { domain: 'amazon.in', brandColor: '#FF9900', type: 'wallet' },
  'amazon pay': { domain: 'amazon.in', brandColor: '#FF9900', type: 'wallet' },
  paytm: { domain: 'paytm.com', brandColor: '#002E6E', type: 'wallet' },
  'paytm wallet': { domain: 'paytm.com', brandColor: '#002E6E', type: 'wallet' },
  phonepe: { domain: 'phonepe.com', brandColor: '#5F259F', type: 'wallet' },
  'google pay': { domain: 'pay.google.com', brandColor: '#4285F4', type: 'wallet' },
  gpay: { domain: 'pay.google.com', brandColor: '#4285F4', type: 'wallet' },
  mobikwik: { domain: 'mobikwik.com', brandColor: '#0077CC', type: 'wallet' },
  freecharge: { domain: 'freecharge.in', brandColor: '#FF7000', type: 'wallet' },
  apple: { domain: 'apple.com', brandColor: '#000000', type: 'wallet' },
  'apple card': { domain: 'apple.com', brandColor: '#000000', type: 'credit' },
  'apple cash': { domain: 'apple.com', brandColor: '#000000', type: 'wallet' },
  'apple pay': { domain: 'apple.com', brandColor: '#000000', type: 'wallet' },

  // Global Cards & Banks
  amex: { domain: 'americanexpress.com', brandColor: '#006FCF', type: 'credit' },
  'american express': { domain: 'americanexpress.com', brandColor: '#006FCF', type: 'credit' },
  chase: { domain: 'chase.com', brandColor: '#117ACA', type: 'savings' },
  revolut: { domain: 'revolut.com', brandColor: '#191C1F', type: 'wallet' },
  wise: { domain: 'wise.com', brandColor: '#163300', type: 'wallet' },
  paypal: { domain: 'paypal.com', brandColor: '#003087', type: 'wallet' },
  'cash app': { domain: 'cash.app', brandColor: '#00D632', type: 'wallet' },
  barclays: { domain: 'barclays.co.uk', brandColor: '#00AEEF', type: 'savings' },
  'bank of america': { domain: 'bankofamerica.com', brandColor: '#E31837', type: 'savings' },
  bofa: { domain: 'bankofamerica.com', brandColor: '#E31837', type: 'savings' },
  'wells fargo': { domain: 'wellsfargo.com', brandColor: '#D71E28', type: 'savings' },
};

/**
 * Builds crystal-clear, high-resolution official brand logo URLs
 */
export function getLogoUrlForDomain(domain: string): string {
  // unavatar.io delivers official vector SVG / high-definition transparent brand logos
  return `https://unavatar.io/${domain}`;
}

/**
 * Fallback high-res Favicon / Icon URL if primary is unavailable
 */
export function getFallbackFaviconUrl(domain: string, size = 128): string {
  return `https://icon.horse/icon/${domain}`;
}

/**
 * Resolves a bank/card/wallet name to its brand details and official logo URL
 */
export function getBankBranding(
  accountName?: string,
  accountType?: string
): {
  isBranded: boolean;
  domain?: string;
  logoUrl?: string;
  fallbackUrl?: string;
  brandColor?: string;
} {
  if (!accountName || typeof accountName !== 'string') {
    return { isBranded: false };
  }

  const clean = accountName.toLowerCase().trim();

  // If cash or generic name, don't brand
  if (clean === 'cash' || clean === 'wallet' || clean === 'bank' || clean === 'credit card' || clean === 'all') {
    return { isBranded: false };
  }

  // 1. Direct or partial match from known entities
  for (const [key, info] of Object.entries(KNOWN_FINANCIAL_DOMAINS)) {
    if (clean === key || clean.includes(key) || key.includes(clean)) {
      return {
        isBranded: true,
        domain: info.domain,
        logoUrl: getLogoUrlForDomain(info.domain),
        fallbackUrl: getFallbackFaviconUrl(info.domain),
        brandColor: info.brandColor,
      };
    }
  }

  // 2. Dynamic heuristics for custom banks
  const singleWord = clean.replace(/[^a-z0-9]/g, '');
  if (singleWord.length >= 3 && !['bank', 'card', 'save', 'checking', 'account'].includes(singleWord)) {
    const fallbackDomain = `${singleWord}.com`;
    return {
      isBranded: true,
      domain: fallbackDomain,
      logoUrl: getLogoUrlForDomain(fallbackDomain),
      fallbackUrl: getFallbackFaviconUrl(fallbackDomain),
    };
  }

  return { isBranded: false };
}
