# Bugs

Found by running the typecheck, lint, the existing `scratch/*.check.ts` suite and a new `scratch/parserEdge.check.ts`.
Run any check with: `npx sucrase-node scratch/<name>.check.ts`

## BUG-01 (S2, FIXED) Non-English month names import as January
- Steps: parse `12 Mai 2026`, `12 Okt 2026`, `12 Dez 2026`, `12 ene 2026`, `12 ago 2026`, `12 Eki 2026` with `normalizeDateToISO`.
- Expected: 2026-05-12 / 10-12 / 12-12 / 01-12 / 08-12 / 10-12. Actual: all `2026-01-12`.
- Cause: unknown month word defaulted to month 01 in `utils/statementNormalizer.ts`.
- Fix: month table for en/de/es/fr/pt/tr; unknown words no longer match. Test: `scratch/parserEdge.check.ts`.
- Not yet done: the PDF row-detection regex (~line 530) still only matches `[A-Za-z]` month words, so accented months (`Şub`, `févr`) are not recognised as transaction rows in PDFs.

## BUG-02 (S2, FIXED) Accounting negatives `(1,234.50)` parse as 0
- Expected -1234.5, actual 0. Fix: parentheses handled in `parseInternationalAmount`. Test: `scratch/parserEdge.check.ts`.

## BUG-03 (S2, OPEN) Unparseable or impossible dates are imported silently
- `normalizeDateToISO('garbage')` and `('')` return today's date; `'31/02/2026'` returns `2026-02-31`.
- Impact: a bad row is saved under the wrong date with no warning. Should flag the row in the review screen instead.
- Needs a decision on how callers (`statementNormalizer.ts` ~538, ~799) should flag it, so not changed yet.

## BUG-04 (S3, OPEN) `parseInternationalAmount('Rs. 99')` returns 0.99
- The currency strip keeps `.`, leaving `.99`. Current callers pre-strip `Rs.`, so this is latent, not user-visible today.

## BUG-05 (S3, OPEN) Lint: 316 errors, 301 warnings (`npx expo lint`)
- Mostly React-compiler rules (e.g. `react-hooks/refs` in `components/ui/SwipeDownSheet.tsx:121`). Typecheck is clean (0 errors).

## To check (not reproduced)
- `1.234` reads as 1.234 (European thousands vs decimal is ambiguous).
- XLSX/XLS import does not exist (parity gap, not a bug).
- Receipt scan, keyword rules, Dr/Cr columns, CSV/PDF export: code exists, never exercised.
