export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Computes a normalized similarity score between 0.0 and 1.0.
 */
export function stringSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  // Direct substring bonus
  if (str1.includes(str2) || str2.includes(str1)) {
    const minLen = Math.min(str1.length, str2.length);
    const maxLen = Math.max(str1.length, str2.length);
    return Math.max(0.8, minLen / maxLen);
  }

  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Fuzzy token matcher with tolerance scaled to word length.
 */
export function fuzzyMatch(term: string, target: string, threshold = 0.75): boolean {
  const t = term.toLowerCase().trim();
  const tgt = target.toLowerCase().trim();
  if (!t || !tgt) return false;
  if (t === tgt) return true;

  // Substring matches only count for words long enough to mean something ("ent" inside "spent" must not match)
  if (t.length >= 4 && tgt.includes(t)) return true;
  if (tgt.length >= 4 && t.includes(tgt)) return true;

  // Typo tolerance scales with length: none for short words ("show" is not "shop"), more for longer ones
  const maxLen = Math.max(t.length, tgt.length);
  if (maxLen < 5) return false;
  const dist = levenshteinDistance(t, tgt);
  const allowed = maxLen <= 7 ? 1 : maxLen <= 8 ? 2 : 3; // "groceries" vs "grocery" differ by 3
  return dist <= allowed && 1 - dist / maxLen >= threshold - 0.1;
}


const chk = (a: string, b: string, want: boolean, th?: number) => { if (fuzzyMatch(a, b, th) !== want) { console.log('FAIL', a, b, want); process.exitCode = 1; } };
chk('show', 'shop', false, 0.72); chk('spent', 'ent', false, 0.75); chk('under', 'auto', false); chk('less', 'lens', false);
chk('transprt', 'transport', true, 0.72); chk('swigy', 'swiggy', true); chk('zomatto', 'zomato', true);
chk('food', 'foods', true); chk('food', 'food', true); chk('groceries', 'grocery', true, 0.72); chk('shopping', 'shop', true, 0.72);
chk('cola', 'ola', false); chk('september', 'sept', true);
console.log('ok');
