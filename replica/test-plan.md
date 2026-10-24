# Test plan: Cashveil

No `replica/recon.md` exists, so flows come from `replica/features.csv`.
Playwright is not used: this is a native Expo app (SQLite, notifications, Siri) and web mode does not run the real storage. Automated checks are Node scripts under `scratch/`; the rest is manual on a device or simulator.

## Automated (run: `npx sucrase-node scratch/<name>.check.ts`, plus `npx tsc --noEmit`)
| Area | Check | Result |
| --- | --- | --- |
| Typecheck | `tsc --noEmit` | pass |
| Amounts, aliases, fuzzy, classify, coach, renewal days, card cycle, dates, statement parser | 11 existing checks | pass |
| Amount/date edge cases, non-English months | `parserEdge.check.ts` (new) | pass after BUG-01/02 fixes |
| Lint | `expo lint` | fail: 316 errors (BUG-05) |

## Manual (device or simulator)
- F-IMP-H1: import a CSV, a PDF and a password-protected PDF; review screen shows right dates and amounts.
- F-IMP-E1: re-import the same file; duplicates flagged. F-IMP-E2: empty file, 5,000-row file, wrong password, file with a bad date (BUG-03).
- F-IMP-E3: German, Spanish and Turkish bank statements (month names, comma decimals, Dr/Cr).
- F-ACC-H1: add account, set opening balance, transfer between accounts; transfer is not spending.
- F-BUD-H1: set overall and per-category budget; over-budget ring turns on.
- F-SUB-H1: add subscription, get renewal reminder; change time zone and check the reminder.
- F-LED-H1: bulk select, recategorise, delete 100+ rows.
- F-PRIV-H1: biometric lock, JSON backup and restore on a second device, offline use, airplane mode.
- F-SIRI-H1: log an expense from Siri and Shortcuts.
- Every screen: small iPhone width, dark mode, VoiceOver labels, large text.
