import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ShieldCheck,
  Database,
  Lock,
  FileText,
  Trash2,
  CheckCircle2,
  Sparkles,
  Cpu,
  Layers,
  Printer,
  ScrollText,
  Download,
  Upload,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Updates from 'expo-updates';

import { exportBackup, importBackup } from '@/utils/backupFile';

import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getDeviceAiEngineInfo } from '@/services/onDeviceAi';
import { logAction, logException } from '@/utils/auditLog';
import AsyncStorage from '@/utils/storage';

const EXCHANGE_RATE_CACHE_KEY = '@expense_exchange_rates_v2';

export default function YourDataScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    transactions,
    accounts,
    categories,
    savingsVaults,
    eventFolders,
    monthlyBudget,
    categoryBudgets,
    currencySymbol,
    currencyCode,
    resetAllData,
  } = useExpenseStore(
    useShallow((s) => ({
      transactions: s.transactions,
      accounts: s.accounts,
      categories: s.categories,
      savingsVaults: s.savingsVaults,
      eventFolders: s.eventFolders,
      monthlyBudget: s.monthlyBudget,
      categoryBudgets: s.categoryBudgets,
      currencySymbol: s.currencySymbol,
      currencyCode: s.currencyCode,
      resetAllData: s.resetAllData,
    }))
  );
  const { subscriptions, clearAllSubscriptions } = useSubscriptionStore(
    useShallow((s) => ({
      subscriptions: s.subscriptions,
      clearAllSubscriptions: s.clearAllSubscriptions,
    }))
  );
  const { userName, userEmail, resetSettings } = useSettingsStore(
    useShallow((s) => ({
      userName: s.userName,
      userEmail: s.userEmail,
      resetSettings: s.resetSettings,
    }))
  );
  const aiEngineInfo = useMemo(() => getDeviceAiEngineInfo(), []);

  const handleExportPdf = async () => {
    Haptics.selectionAsync();
    try {
      if (transactions.length === 0 && accounts.length === 0 && subscriptions.length === 0) {
        Alert.alert('No Data', 'There is no financial data to generate a PDF report.');
        return;
      }

      const sym = currencySymbol || '₹';
      const code = currencyCode || 'INR';
      const escape = (str: string | undefined | null) => {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
      const fmt = (n: number | undefined | null) => {
        const val = typeof n === 'number' && !isNaN(n) ? n : 0;
        return val.toLocaleString('en-IN');
      };
      const fmtDate = (dStr: string | undefined | null) => {
        if (!dStr) return '—';
        try {
          const parts = dStr.split('T')[0].split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
          }
          return new Date(dStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
          return dStr;
        }
      };

      // ── Core Metrics ──
      const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalSpent = transactions
        .filter((t) => t.type === 'expense' && t.categoryId !== 'cat_debt_repayment')
        .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
      const netSavings = totalIncome - totalSpent;

      const nonCreditBalance = accounts
        .filter((a) => a.type !== 'credit')
        .reduce((sum, a) => sum + (a.balance || 0), 0);
      const creditDueTotal = accounts
        .filter((a) => a.type === 'credit')
        .reduce((sum, a) => sum + (a.dueAmount || 0), 0);
      const netLiquidPortfolio = nonCreditBalance - creditDueTotal;

      const totalOpeningPortfolio = accounts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);
      const totalVaultsSaved = savingsVaults.reduce((sum, v) => sum + (v.currentAmount || 0), 0);

      // ── Debt (Lend / Borrow & Splits) Metrics ──
      const debtLendTxs = transactions.filter((t) => t.type === 'debt_lend');
      const debtBorrowTxs = transactions.filter((t) => t.type === 'debt_borrow');
      const splitTxs = transactions.filter((t) => t.split && (t.split.friendsShare || 0) > 0);

      const unsettledLend = debtLendTxs.filter((t) => !t.isSettled).reduce((sum, t) => sum + t.amount, 0);
      const unsettledSplitShare = splitTxs.filter((t) => !t.split?.settled).reduce((sum, t) => sum + (t.split?.friendsShare || 0), 0);
      const totalReceivables = unsettledLend + unsettledSplitShare;
      const totalPayables = debtBorrowTxs.filter((t) => !t.isSettled).reduce((sum, t) => sum + t.amount, 0);

      // ── 1. Bank Accounts & Opening Balances Rows ──
      const accountRows = accounts.map((acc) => {
        const isCredit = acc.type === 'credit';
        const typeLabel =
          acc.type === 'savings' ? 'Savings Bank' :
          acc.type === 'credit' ? 'Credit Card' :
          acc.type === 'wallet' ? 'Digital Wallet' : 'Cash / Petty';
        const opening = acc.openingBalance !== undefined ? acc.openingBalance : 0;
        const current = acc.balance || 0;
        const creditInfo = isCredit
          ? `<span style="color: #E84040; font-weight: 700;">${sym}${fmt(acc.dueAmount || 0)} due</span>${(acc.unbilledDue || 0) > 0 ? `<br/><span style="font-size: 10px; color: #777;">incl. ${sym}${fmt(acc.unbilledDue || 0)} not yet billed</span>` : ''}${acc.dueDay ? `<br/><span style="font-size: 10px; color: #777;">Due: ${acc.dueDay}th • Bill: ${acc.billingDay || '—'}th</span>` : ''}`
          : '—';
        const changeSign = acc.monthlyChange > 0 ? '+' : '';
        const changeColor = acc.monthlyChange > 0 ? '#059669' : acc.monthlyChange < 0 ? '#DC2626' : '#6B7280';

        return `
          <tr>
            <td><strong>${escape(acc.name)}</strong>${acc.isArchived ? ' <span style="font-size: 9px; color: #999;">(Archived)</span>' : ''}</td>
            <td><span class="type-pill">${typeLabel}</span></td>
            <td style="text-align: right; color: #4B5563;">${sym}${fmt(opening)}</td>
            <td style="text-align: right; font-weight: 700; color: ${isCredit ? '#DC2626' : '#111827'};">${sym}${fmt(current)}</td>
            <td style="text-align: right;">${creditInfo}</td>
            <td style="text-align: right; color: ${changeColor}; font-weight: 600;">${changeSign}${sym}${fmt(acc.monthlyChange)}</td>
          </tr>
        `;
      }).join('');

      // ── 2. Event & Trip Folders Rows ──
      const folderRows = eventFolders.map((f) => {
        const linkedCount = transactions.filter((t) => t.folderId === f.id || (t.tag && t.tag.toLowerCase() === f.name.toLowerCase())).length;
        return `
          <tr>
            <td><strong>${f.emoji ? `${escape(f.emoji)} ` : ''}${escape(f.name)}</strong></td>
            <td>${fmtDate(f.createdAt)}</td>
            <td style="text-align: center;"><span class="type-pill">${linkedCount} txs</span></td>
            <td style="text-align: right; font-weight: 700; color: #DC2626;">${sym}${fmt(f.totalSpent || 0)}</td>
          </tr>
        `;
      }).join('');

      // ── 3. Receivables & Payables (Lend, Borrow, Splits) Rows ──
      const allDebtsAndSplits: Array<{
        date: string;
        nature: string;
        badgeClass: string;
        person: string;
        amount: number;
        status: string;
        note: string;
      }> = [];

      debtLendTxs.forEach((t) => {
        allDebtsAndSplits.push({
          date: t.date,
          nature: 'Lent to Person',
          badgeClass: 'badge-lend',
          person: t.borrowerOrLender || 'Friend',
          amount: t.amount,
          status: t.isSettled ? '✓ Settled' : '⏳ Outstanding',
          note: t.note || 'Lent money',
        });
      });

      debtBorrowTxs.forEach((t) => {
        allDebtsAndSplits.push({
          date: t.date,
          nature: 'Borrowed from Person',
          badgeClass: 'badge-borrow',
          person: t.borrowerOrLender || 'Lender',
          amount: t.amount,
          status: t.isSettled ? '✓ Settled' : '⏳ Outstanding',
          note: t.note || 'Borrowed money',
        });
      });

      splitTxs.forEach((t) => {
        allDebtsAndSplits.push({
          date: t.date,
          nature: 'Split Bill Share',
          badgeClass: 'badge-split',
          person: t.split?.friendNames || 'Friends',
          amount: t.split?.friendsShare || 0,
          status: t.split?.settled ? '✓ Settled' : '⏳ Outstanding',
          note: t.merchant ? `${t.merchant} (Bill split)` : (t.note || 'Split bill'),
        });
      });

      allDebtsAndSplits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const debtRows = allDebtsAndSplits.map((item) => `
        <tr>
          <td>${fmtDate(item.date)}</td>
          <td><span class="badge ${item.badgeClass}">${item.nature}</span></td>
          <td><strong>${escape(item.person)}</strong></td>
          <td style="text-align: right; font-weight: 700;">${sym}${fmt(item.amount)}</td>
          <td style="text-align: center;"><span class="${item.status.includes('Settled') ? 'status-settled' : 'status-pending'}">${item.status}</span></td>
          <td style="color: #6B7280;">${escape(item.note)}</td>
        </tr>
      `).join('');

      // ── 4. Split Breakdown Rows ──
      const splitBreakdownRows = splitTxs.map((t) => {
        let friendsDetail = '';
        if (t.split?.friends && t.split.friends.length > 0) {
          friendsDetail = t.split.friends.map((f) => `${escape(f.name)}: ${sym}${fmt(f.amount)} (${f.settled ? 'Settled' : 'Pending'})`).join(' • ');
        } else {
          friendsDetail = escape(t.split?.friendNames || 'Friends');
        }

        return `
          <tr>
            <td>${fmtDate(t.date)}</td>
            <td><strong>${escape(t.merchant || t.note || 'Split Expense')}</strong></td>
            <td style="text-align: right; font-weight: 700;">${sym}${fmt(t.amount)}</td>
            <td style="text-align: right; color: #DC2626;">${sym}${fmt(t.split?.yourShare || 0)}</td>
            <td style="text-align: right; color: #2563EB;">${sym}${fmt(t.split?.friendsShare || 0)}</td>
            <td style="font-size: 11px; color: #4B5563;">${friendsDetail}</td>
          </tr>
        `;
      }).join('');

      // ── 5. Active Subscriptions Rows ──
      const subscriptionRows = subscriptions.map((sub) => {
        return `
          <tr>
            <td><strong>${escape(sub.name)}</strong></td>
            <td><span class="type-pill">${escape(sub.category || 'General')}</span></td>
            <td>${escape(sub.billingCycle || 'Monthly')}</td>
            <td style="text-align: right; font-weight: 700;">${sym}${fmt(sub.price)}</td>
            <td>${sub.nextBillingDate ? fmtDate(sub.nextBillingDate) : '—'}</td>
            <td style="text-align: center;">${sub.splitEnabled ? 'Shared / Split' : 'Personal'}</td>
          </tr>
        `;
      }).join('');

      // ── 6. Savings Vaults Rows ──
      const vaultRows = savingsVaults.map((v) => {
        const pct = Math.round(((v.currentAmount || 0) / Math.max(v.targetAmount, 1)) * 100);
        return `
          <tr>
            <td><strong>${v.emoji ? `${escape(v.emoji)} ` : ''}${escape(v.name)}</strong></td>
            <td><span class="type-pill">${escape(v.category || 'Savings')}</span></td>
            <td style="text-align: right;">${sym}${fmt(v.targetAmount)}</td>
            <td style="text-align: right; font-weight: 700; color: #059669;">${sym}${fmt(v.currentAmount)}</td>
            <td style="text-align: center;"><strong>${pct}%</strong></td>
            <td style="text-align: center;"><span class="${v.isCompleted ? 'status-settled' : 'status-pending'}">${v.isCompleted ? 'Completed' : 'In Progress'}</span></td>
          </tr>
        `;
      }).join('');

      // ── 7. Category Spending & Budget Rows ──
      const categoryRows = categories
        .filter((c) => c.id !== 'cat_income')
        .map((cat) => {
          const catSpent = transactions
            .filter((t) => t.type === 'expense' && t.categoryId === cat.id)
            .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
          const pct = totalSpent > 0 ? ((catSpent / totalSpent) * 100).toFixed(1) : '0';
          const budgetLimit = categoryBudgets[cat.id];
          const budgetStatus = budgetLimit
            ? (catSpent <= budgetLimit ? '<span class="status-settled">Within Budget</span>' : `<span class="status-pending">Over by ${sym}${fmt(catSpent - budgetLimit)}</span>`)
            : '—';

          return `
            <tr>
              <td><strong>${cat.emoji ? `${escape(cat.emoji)} ` : ''}${escape(cat.name)}</strong></td>
              <td style="text-align: right; color: #DC2626; font-weight: 700;">${sym}${fmt(catSpent)}</td>
              <td style="text-align: right; color: #4B5563;">${pct}%</td>
              <td style="text-align: right;">${budgetLimit ? `${sym}${fmt(budgetLimit)}` : 'None'}</td>
              <td style="text-align: center;">${budgetStatus}</td>
            </tr>
          `;
        })
        .join('');

      // ── 8. Full Transaction Ledger (ALL TRANSACTIONS) ──
      const sortedTxs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const txRows = sortedTxs.map((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const fromAcc = accounts.find((a) => a.id === t.accountId);
        const toAcc = accounts.find((a) => a.id === t.toAccountId);

        let typeBadge = '';
        let sign = '-';
        let amtColor = '#DC2626';
        let accDisplay = escape(fromAcc?.name || t.accountName || 'Account');

        if (t.type === 'income') {
          typeBadge = '<span class="badge badge-income">Income</span>';
          sign = '+';
          amtColor = '#059669';
        } else if (t.type === 'transfer') {
          typeBadge = '<span class="badge badge-transfer">Transfer</span>';
          sign = '⇄ ';
          amtColor = '#2563EB';
          accDisplay = `${escape(fromAcc?.name || t.accountName || 'Source')} ➔ ${escape(toAcc?.name || t.toAccountName || 'Destination')}`;
        } else if (t.type === 'debt_lend') {
          typeBadge = '<span class="badge badge-lend">Lent</span>';
          sign = '-';
          amtColor = '#7C3AED';
          accDisplay = `${escape(fromAcc?.name || 'Account')} ➔ ${escape(t.borrowerOrLender || 'Friend')}`;
        } else if (t.type === 'debt_borrow') {
          typeBadge = '<span class="badge badge-borrow">Borrowed</span>';
          sign = '+';
          amtColor = '#D97706';
          accDisplay = `${escape(t.borrowerOrLender || 'Lender')} ➔ ${escape(fromAcc?.name || 'Account')}`;
        } else if (t.type === 'vault_deposit') {
          typeBadge = '<span class="badge badge-vault">Vault Deposit</span>';
          sign = '-';
          amtColor = '#D97706';
        } else if (t.type === 'vault_withdraw') {
          typeBadge = '<span class="badge badge-vault">Vault Withdraw</span>';
          sign = '+';
          amtColor = '#059669';
        } else {
          typeBadge = '<span class="badge badge-expense">Expense</span>';
          sign = '-';
          amtColor = '#DC2626';
        }

        const displayAmt = t.split ? t.split.yourShare : t.amount;
        let memo = t.merchant ? `<strong>${escape(t.merchant)}</strong>` : '';
        if (t.note) memo += (memo ? ` • ${escape(t.note)}` : escape(t.note));
        if (t.folderName || t.tag) memo += ` <span class="tag-pill">📁 ${escape(t.folderName || t.tag)}</span>`;
        if (t.split) memo += ` <span class="tag-pill">Split (${escape(t.split.friendNames || 'Friends')})</span>`;

        return `
          <tr>
            <td style="white-space: nowrap;">${fmtDate(t.date)}</td>
            <td>${typeBadge}</td>
            <td>${escape(cat?.name || 'General')}</td>
            <td>${accDisplay}</td>
            <td>${memo || '—'}</td>
            <td style="text-align: right; font-weight: 700; color: ${amtColor}; white-space: nowrap;">${sign}${sym}${fmt(displayAmt)}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Monevo Financial Statement</title>
          <style>
            @page { margin: 20mm 15mm; size: A4 portrait; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              line-height: 1.45;
              padding: 24px;
              margin: 0;
            }
            .header-bar {
              border-bottom: 2px solid #111827;
              padding-bottom: 14px;
              margin-bottom: 22px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .brand-title { font-size: 24px; font-weight: 900; letter-spacing: 1px; color: #111827; margin: 0; text-transform: uppercase; }
            .brand-sub { font-size: 11px; font-weight: 600; color: #4B5563; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
            .meta-box { text-align: right; font-size: 11px; color: #4B5563; }
            .meta-box strong { color: #111827; }

            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .card {
              padding: 12px 14px;
              border: 1px solid #E5E7EB;
              border-radius: 10px;
              background: #F9FAFB;
            }
            .card-title { font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.6px; color: #6B7280; margin-bottom: 4px; }
            .card-val { font-size: 19px; font-weight: 900; color: #111827; }

            .sub-kpi-row {
              display: flex;
              gap: 12px;
              margin-bottom: 24px;
            }
            .sub-kpi-card {
              flex: 1;
              padding: 10px 14px;
              border: 1px solid #E5E7EB;
              border-radius: 8px;
              background: #FFFFFF;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .sub-kpi-label { font-size: 11px; font-weight: 600; color: #4B5563; }
            .sub-kpi-val { font-size: 15px; font-weight: 800; }

            .section-title {
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.6px;
              margin: 26px 0 10px 0;
              border-left: 4px solid #FF9D66;
              padding-left: 8px;
              color: #111827;
              page-break-after: avoid;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 11px;
              page-break-inside: auto;
            }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th {
              text-align: left;
              padding: 7px 9px;
              background: #F3F4F6;
              border-bottom: 2px solid #D1D5DB;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.4px;
              color: #374151;
            }
            td {
              padding: 7px 9px;
              border-bottom: 1px solid #E5E7EB;
              vertical-align: middle;
            }
            .type-pill {
              font-size: 9px;
              font-weight: 600;
              padding: 2px 6px;
              background: #E5E7EB;
              color: #374151;
              border-radius: 4px;
              display: inline-block;
            }
            .tag-pill {
              font-size: 9px;
              font-weight: 600;
              padding: 1px 5px;
              background: #FEF3C7;
              color: #92400E;
              border-radius: 4px;
              display: inline-block;
            }
            .badge {
              font-size: 9px;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
              display: inline-block;
              text-transform: uppercase;
            }
            .badge-income { background: #D1FAE5; color: #065F46; }
            .badge-expense { background: #FEE2E2; color: #991B1B; }
            .badge-transfer { background: #DBEAFE; color: #1E40AF; }
            .badge-lend { background: #EDE9FE; color: #5B21B6; }
            .badge-borrow { background: #FEF3C7; color: #92400E; }
            .badge-split { background: #CCFBF1; color: #115E59; }
            .badge-vault { background: #FFEDD5; color: #9A3412; }

            .status-settled { color: #059669; font-weight: 700; font-size: 10px; }
            .status-pending { color: #DC2626; font-weight: 700; font-size: 10px; }

            .footer {
              font-size: 10px;
              color: #6B7280;
              text-align: center;
              margin-top: 36px;
              border-top: 1px solid #E5E7EB;
              padding-top: 14px;
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="brand-title">Monevo Financial Statement</h1>
              <div class="brand-sub">Comprehensive Portfolio & Transaction Audit Dossier</div>
            </div>
            <div class="meta-box">
              <div><strong>Owner:</strong> ${escape(userName || 'Account Holder')}${userEmail ? ` • ${escape(userEmail)}` : ''}</div>
              <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              <div><strong>Currency:</strong> ${escape(code)} (${sym})</div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="card">
              <div class="card-title">Net Liquid Portfolio</div>
              <div class="card-val" style="color: ${netLiquidPortfolio >= 0 ? '#059669' : '#DC2626'};">${sym}${fmt(netLiquidPortfolio)}</div>
            </div>
            <div class="card">
              <div class="card-title">Total Income Recorded</div>
              <div class="card-val" style="color: #059669;">+${sym}${fmt(totalIncome)}</div>
            </div>
            <div class="card">
              <div class="card-title">Total Expenses Recorded</div>
              <div class="card-val" style="color: #DC2626;">-${sym}${fmt(totalSpent)}</div>
            </div>
          </div>

          <div class="sub-kpi-row">
            <div class="sub-kpi-card">
              <span class="sub-kpi-label">Vault Savings Reserves</span>
              <span class="sub-kpi-val" style="color: #059669;">${sym}${fmt(totalVaultsSaved)}</span>
            </div>
            <div class="sub-kpi-card">
              <span class="sub-kpi-label">Outstanding Receivables (Lent / Splits)</span>
              <span class="sub-kpi-val" style="color: #2563EB;">${sym}${fmt(totalReceivables)}</span>
            </div>
            <div class="sub-kpi-card">
              <span class="sub-kpi-label">Outstanding Payables (Borrowed / Debts)</span>
              <span class="sub-kpi-val" style="color: #DC2626;">${sym}${fmt(totalPayables)}</span>
            </div>
          </div>

          <!-- SECTION 1: BANK ACCOUNTS & OPENING BALANCES -->
          <div class="section-title">1. Bank Accounts Portfolio & Opening Balances (${accounts.length} Accounts)</div>
          <table>
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Type</th>
                <th style="text-align: right;">Opening Balance</th>
                <th style="text-align: right;">Current Balance</th>
                <th style="text-align: right;">Credit Due / Billing Cycle</th>
                <th style="text-align: right;">Monthly Flow</th>
              </tr>
            </thead>
            <tbody>
              ${accountRows || '<tr><td colspan="6" style="text-align: center; color: #888;">No bank accounts logged</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background: #F9FAFB; font-weight: 700;">
                <td colspan="2"><strong>Portfolio Total</strong></td>
                <td style="text-align: right;">${sym}${fmt(totalOpeningPortfolio)}</td>
                <td style="text-align: right; color: ${netLiquidPortfolio >= 0 ? '#059669' : '#DC2626'};">${sym}${fmt(netLiquidPortfolio)}</td>
                <td style="text-align: right; color: #DC2626;">${creditDueTotal > 0 ? `${sym}${fmt(creditDueTotal)} total due` : '—'}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          ${eventFolders.length > 0 ? `
            <!-- SECTION 2: EVENT & TRIP FOLDERS -->
            <div class="section-title">2. Event & Trip Folders (${eventFolders.length} Folders)</div>
            <table>
              <thead>
                <tr>
                  <th>Folder / Trip Name</th>
                  <th>Created Date</th>
                  <th style="text-align: center;">Transactions</th>
                  <th style="text-align: right;">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                ${folderRows}
              </tbody>
            </table>
          ` : ''}

          ${allDebtsAndSplits.length > 0 ? `
            <!-- SECTION 3: RECEIVABLES & PAYABLES (LEND, BORROW & SPLITS) -->
            <div class="section-title">3. Receivables & Payables Log (Lend, Borrow & Shared Expenses)</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nature</th>
                  <th>Person / Counterparty</th>
                  <th style="text-align: right;">Amount</th>
                  <th style="text-align: center;">Status</th>
                  <th>Note / Memo</th>
                </tr>
              </thead>
              <tbody>
                ${debtRows}
              </tbody>
            </table>
          ` : ''}

          ${splitTxs.length > 0 ? `
            <!-- SECTION 4: SPLIT BILL BREAKDOWN -->
            <div class="section-title">4. Bill Splits & Friend Share Audits (${splitTxs.length} Splits)</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th style="text-align: right;">Total Bill</th>
                  <th style="text-align: right;">Your Share</th>
                  <th style="text-align: right;">Friends' Share</th>
                  <th>Friends Breakdown & Status</th>
                </tr>
              </thead>
              <tbody>
                ${splitBreakdownRows}
              </tbody>
            </table>
          ` : ''}

          ${subscriptions.length > 0 ? `
            <!-- SECTION 5: ACTIVE SUBSCRIPTIONS & COMMITMENTS -->
            <div class="section-title">5. Active Subscriptions & Recurring Commitments (${subscriptions.length} Subscriptions)</div>
            <table>
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Category</th>
                  <th>Billing Cycle</th>
                  <th style="text-align: right;">Cost</th>
                  <th>Next Renewal Date</th>
                  <th style="text-align: center;">Ownership</th>
                </tr>
              </thead>
              <tbody>
                ${subscriptionRows}
              </tbody>
            </table>
          ` : ''}

          ${savingsVaults.length > 0 ? `
            <!-- SECTION 6: SAVINGS VAULTS -->
            <div class="section-title">6. Savings Vaults & Reserves (${savingsVaults.length} Vaults)</div>
            <table>
              <thead>
                <tr>
                  <th>Goal Name</th>
                  <th>Category</th>
                  <th style="text-align: right;">Target Amount</th>
                  <th style="text-align: right;">Current Saved</th>
                  <th style="text-align: center;">Progress</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${vaultRows}
              </tbody>
            </table>
          ` : ''}

          <!-- SECTION 7: CATEGORY DISTRIBUTION -->
          <div class="section-title">7. Category Spending & Budget Distribution</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align: right;">Total Spent</th>
                <th style="text-align: right;">Share (%)</th>
                <th style="text-align: right;">Monthly Budget</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRows || '<tr><td colspan="5" style="text-align: center; color: #888;">No category expenses recorded</td></tr>'}
            </tbody>
          </table>

          <!-- SECTION 8: FULL TRANSACTION LEDGER -->
          <div class="section-title">8. Complete Financial Ledger Log (${sortedTxs.length} Records)</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category / Flow</th>
                <th>Account(s) Involved</th>
                <th>Merchant / Memo / Tags</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${txRows || '<tr><td colspan="6" style="text-align: center; color: #888;">No transactions logged</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Personal & Confidential • 100% On-Device Financial Record • Generated by Monevo • Zero Cloud Telemetry
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Complete Financial Report (PDF)',
          UTI: '.pdf',
        });
      } else {
        Alert.alert('PDF Export Complete', `Saved financial report to ${uri}`);
      }
      logAction('export', 'Generated financial statement PDF report', { format: 'pdf', count: transactions.length });
    } catch (err) {
      console.warn('PDF export error:', err);
      logException('export', 'PDF export failed', err);
      Alert.alert('Export Failed', 'Could not generate PDF report.');
    }
  };

  const handleExportBackup = async () => {
    Haptics.selectionAsync();
    try {
      const summary = await exportBackup();
      logAction('export', 'Exported portable JSON backup', summary as unknown as Record<string, unknown>);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Backup Saved Successfully',
        `Complete backup generated:\n• ${summary.transactions} transactions (all ledger records)\n• ${summary.accounts} bank accounts with opening balances\n• ${summary.folders} event folders\n• ${summary.vaults} savings vaults\n• ${summary.subscriptions} subscriptions\n\nKeep the JSON file somewhere safe (iCloud, Drive, WhatsApp, Files) — it contains 100% of your data.`
      );
    } catch (err) {
      console.warn('Backup export error:', err);
      logException('export', 'JSON backup export failed', err);
      Alert.alert('Export Failed', 'Could not create the backup file.');
    }
  };

  const handleImportBackup = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Restore From Backup',
      'This will restore all your bank accounts (with opening balances), transactions, folders, splits, debts, savings vaults, and subscriptions from the backup file.\n\nAnything added since that backup was taken will be replaced.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          onPress: async () => {
            try {
              const summary = await importBackup();
              logAction('import', 'Restored from portable JSON backup', summary as unknown as Record<string, unknown>);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Backup Restored Successfully',
                `All data successfully restored:\n• ${summary.transactions} transactions\n• ${summary.accounts} bank accounts & opening balances\n• ${summary.folders} event folders\n• ${summary.vaults} savings vaults\n• ${summary.subscriptions} subscriptions\n\nYour app state has been fully reloaded.`,
                [{ text: 'OK', onPress: () => Updates.reloadAsync().catch(() => {}) }]
              );
            } catch (err) {
              if (err instanceof Error && err.message === 'cancelled') return;
              console.warn('Backup import error:', err);
              logException('import', 'JSON backup restore failed', err);
              Alert.alert(
                'Restore Failed',
                err instanceof Error ? err.message : 'Could not read that backup file.'
              );
            }
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Clear Local Cache',
      'This removes cached exchange rates and temporary render cache. Your saved transactions and categories will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(EXCHANGE_RATE_CACHE_KEY);
            } catch (err) {
              console.warn('Cache clear error:', err);
              logException('app', 'Local cache clear failed', err);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logAction('app', 'Local cache cleared', { targets: [EXCHANGE_RATE_CACHE_KEY] });
            Alert.alert('Cache Cleared', 'Temporary cache has been cleared.');
          },
        },
      ]
    );
  };

  const executeEraseAll = async () => {
    try {
      // 1. Reset Expense Store (transactions, accounts, categories, vaults, folders, budget, rules, walkthrough flag)
      resetAllData();
      // 2. Reset Subscriptions SQLite database and store
      await clearAllSubscriptions();
      // 3. Reset Settings profile (name, email, tagline, avatar)
      await resetSettings();
      // 4. Clear exchange rate and transient caches
      await AsyncStorage.removeItem(EXCHANGE_RATE_CACHE_KEY).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logAction('security', 'User performed Fresh Start / erased all stored data from Settings');
      Alert.alert(
        'All Data Erased',
        'All stored accounts, transactions, folders, and subscriptions have been permanently removed.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err) {
      console.warn('Error during full fresh start wipe:', err);
      Alert.alert('Error', 'An error occurred while clearing data.');
    }
  };

  const handleDeleteAllData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      'Backup Before Erasing?',
      'You are about to delete all stored data (bank accounts, opening balances, transactions, folders, splits, debts, and subscriptions).\n\nWould you like to export a backup file first so you can restore your data later?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip Backup & Erase',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Warning: Erase Everything?',
              'You chose to skip the backup. All bank accounts, opening balances, transactions, splits, folders, and subscriptions will be permanently erased. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Permanently Erase',
                  style: 'destructive',
                  onPress: executeEraseAll,
                },
              ]
            );
          },
        },
        {
          text: 'Backup First (Recommended)',
          onPress: async () => {
            try {
              const summary = await exportBackup();
              logAction('export', 'Exported portable JSON backup before erase', summary as unknown as Record<string, unknown>);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              setTimeout(() => {
                Alert.alert(
                  'Backup Saved Successfully',
                  `Saved ${summary.transactions} transactions, ${summary.accounts} accounts, and ${summary.subscriptions} subscriptions.\n\nDo you still want to proceed with erasing all stored data?`,
                  [
                    { text: 'Keep My Data', style: 'cancel' },
                    {
                      text: 'Yes, Erase Everything Now',
                      style: 'destructive',
                      onPress: executeEraseAll,
                    },
                  ]
                );
              }, 400);
            } catch (err) {
              console.warn('Pre-erase backup export error:', err);
              Alert.alert(
                'Backup Failed',
                'Could not create the backup file. Your data has NOT been deleted. You can try exporting manually or skip backup.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Skip Backup & Erase Anyway',
                    style: 'destructive',
                    onPress: executeEraseAll,
                  },
                ]
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={expenseColors.accentPeach} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>YOUR DATA & PRIVACY</AppText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <ShieldCheck size={20} color={expenseColors.accentGreen} />
          <AppText style={styles.infoBannerText}>
            This application is built local-first. Your financial data, accounts, budgets, and transactions belong exclusively to you and stay private on your device.
          </AppText>
        </View>

        {/* 1. Live Data Footprint */}
        <View style={styles.sectionContainer}>
          <AppText style={styles.sectionTitle}>DEVICE DATA FOOTPRINT</AppText>
          <View style={styles.card}>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <AppText style={styles.metricCount}>{transactions.length}</AppText>
                <AppText style={styles.metricLabel}>Transactions</AppText>
              </View>
              <View style={styles.metricDividerVertical} />
              <View style={styles.metricCell}>
                <AppText style={styles.metricCount}>{accounts.length}</AppText>
                <AppText style={styles.metricLabel}>Accounts</AppText>
              </View>
              <View style={styles.metricDividerVertical} />
              <View style={styles.metricCell}>
                <AppText style={styles.metricCount}>{categories.length}</AppText>
                <AppText style={styles.metricLabel}>Categories</AppText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(235, 178, 154, 0.15)' }]}>
                <Cpu size={18} color="#EBB29A" />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>AI Engine: {aiEngineInfo.chip}</AppText>
                <AppText style={styles.featureSub}>
                  {aiEngineInfo.name} • 100% Offline Core • Zero cloud latency
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* 2. On-Device AI Architecture & Privacy */}
        <View style={styles.sectionContainer}>
          <View style={styles.titleWithIcon}>
            <Sparkles size={14} color="#EBB29A" />
            <AppText style={styles.sectionTitle}>ON-DEVICE AI PRIVACY GUARANTEE</AppText>
          </View>
          <View style={styles.card}>
            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(92, 228, 154, 0.15)' }]}>
                <Lock size={18} color="#5CE49A" />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>Zero External AI Transmissions</AppText>
                <AppText style={styles.featureSub}>
                  Smart search, natural language queries, and semantic category inferences run exclusively using local heuristics and tokenizer logic directly on your phone hardware. No prompt or transaction is ever transmitted to OpenAI, Google, Anthropic, or any remote servers.
                </AppText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(157, 198, 235, 0.15)' }]}>
                <Layers size={18} color="#9DC6EB" />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>No Model Training on Personal Finances</AppText>
                <AppText style={styles.featureSub}>
                  Your personal notes, merchant names, split expenses, and transaction habits remain untracked. They are never ingested, logged, or used to fine-tune AI models.
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Data Privacy Highlights */}
        <View style={styles.sectionContainer}>
          <AppText style={styles.sectionTitle}>DATA ARCHITECTURE</AppText>
          <View style={styles.card}>
            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(46, 204, 113, 0.15)' }]}>
                <Database size={18} color={expenseColors.accentGreen} />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>Stored 100% on Device</AppText>
                <AppText style={styles.featureSub}>
                  Your data never leaves your phone unless you explicitly choose to export or back it up.
                </AppText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(92, 228, 154, 0.15)' }]}>
                <Lock size={18} color="#5CE49A" />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>Zero Telemetry of Financial Data</AppText>
                <AppText style={styles.featureSub}>
                  We do not collect, read, or sell your purchase details, bank balances, or transaction notes.
                </AppText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 157, 102, 0.15)' }]}>
                <CheckCircle2 size={18} color={expenseColors.accentPeach} />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>No Account Required</AppText>
                <AppText style={styles.featureSub}>
                  Use the app completely anonymously without email verification or mandatory cloud profiles.
                </AppText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(169, 223, 191, 0.15)' }]}>
                <ShieldCheck size={18} color="#A9DFBF" />
              </View>
              <View style={styles.featureTextCol}>
                <AppText style={styles.featureTitle}>Device Diagnostics & Strict Privacy</AppText>
                <AppText style={styles.featureSub}>
                  Anonymous device telemetry (device model, OS version, and release version) is collected purely for stability, bug fixes, and compatibility. Your financial ledger, transactions, accounts, and budgets are strictly 100% on-device and never leave your phone. Your privacy is our topmost priority.
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* 4. Terms & Conditions (T&C) */}
        <View style={styles.sectionContainer}>
          <View style={styles.titleWithIcon}>
            <FileText size={15} color={expenseColors.textSubtle} />
            <AppText style={styles.sectionTitle}>TERMS & CONDITIONS (T&C)</AppText>
          </View>

          <View style={styles.card}>
            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>1. Acceptance of Terms</AppText>
              <AppText style={styles.tcBody}>
                By accessing or using this expense and subscription tracking application, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, please discontinue use.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>2. User Data Ownership & Portability</AppText>
              <AppText style={styles.tcBody}>
                You retain complete, exclusive ownership of all transactions, custom categories, account names, and financial records logged within this application. You may export your entire transaction history to PDF at any time without restriction or fees.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>3. Non-Financial Advisory Disclaimer</AppText>
              <AppText style={styles.tcBody}>
                This application is an informational personal utility designed to assist with manual expense logging, budgeting, and recurring subscription visualization. It does not provide certified financial, investment, legal, tax, or accounting advice. You are solely responsible for your financial decisions.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>4. Local Storage & Backup Responsibility</AppText>
              <AppText style={styles.tcBody}>
                Because this application uses local-first on-device storage, deleting the application or clearing device storage without generating an export backup may result in irreversible data loss. Users are encouraged to utilize the built-in PDF export function regularly.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>5. Security & Biometrics</AppText>
              <AppText style={styles.tcBody}>
                You are responsible for safeguarding device access. Enabling biometric authentication (Face ID / Touch ID) or device passcodes provides an extra layer of privacy for your logged records.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>6. Privacy Commitment & Zero Advertising</AppText>
              <AppText style={styles.tcBody}>
                We never monetize, broker, or transmit your individual expense items, bank balances, or query history to advertising networks or third-party brokers.
              </AppText>
            </View>
          </View>
        </View>

        {/* 5. Data Controls */}
        <View style={styles.sectionContainer}>
          <AppText style={styles.sectionTitle}>DATA CONTROLS</AppText>
          <View style={styles.card}>
            {/* Activity / Audit Log (Shown only on iPhone) */}
            {Platform.OS === 'ios' && (
              <>
                <TouchableOpacity
                  style={styles.actionRow}
                  activeOpacity={0.7}
                  onPress={() => router.push('/settings/logs')}
                >
                  <View style={styles.actionLeft}>
                    <View style={[styles.logsIconBox]}>
                      <ScrollText size={18} color="#9DC6EB" />
                    </View>
                    <View>
                      <AppText style={styles.actionTitle}>View Activity Logs</AppText>
                      <AppText style={styles.actionSub}>Hidden on-device audit trail of every action</AppText>
                    </View>
                  </View>
                  <AppText style={[styles.actionBtnText, { color: '#9DC6EB' }]}>View</AppText>
                </TouchableOpacity>

                <View style={styles.divider} />
              </>
            )}

            {/* Portable JSON backup */}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleExportBackup}
            >
              <View style={styles.actionLeft}>
                <Download size={18} color="#9DC6EB" />
                <View>
                  <AppText style={styles.actionTitle}>Backup All Data (JSON)</AppText>
                  <AppText style={styles.actionSub}>Survives reinstalling the app — save it anywhere</AppText>
                </View>
              </View>
              <AppText style={[styles.actionBtnText, { color: '#9DC6EB' }]}>Export</AppText>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleImportBackup}
            >
              <View style={styles.actionLeft}>
                <Upload size={18} color="#9DC6EB" />
                <View>
                  <AppText style={styles.actionTitle}>Restore From Backup</AppText>
                  <AppText style={styles.actionSub}>Replaces current data with a saved JSON file</AppText>
                </View>
              </View>
              <AppText style={[styles.actionBtnText, { color: '#9DC6EB' }]}>Import</AppText>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* PDF Export */}
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleExportPdf}
            >
              <View style={styles.actionLeft}>
                <Printer size={18} color={expenseColors.accentGreen} />
                <View>
                  <AppText style={styles.actionTitle}>Export Financial Report (PDF)</AppText>
                  <AppText style={styles.actionSub}>Formatted monthly statement & breakdowns</AppText>
                </View>
              </View>
              <AppText style={[styles.actionBtnText, { color: expenseColors.accentGreen }]}>Export</AppText>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleClearCache}
            >
              <View style={styles.actionLeft}>
                <Database size={18} color={expenseColors.textSubtle} />
                <View>
                  <AppText style={styles.actionTitle}>Clear Local Cache</AppText>
                  <AppText style={styles.actionSub}>Free up temporary application storage</AppText>
                </View>
              </View>
              <AppText style={styles.actionBtnText}>Clear</AppText>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleDeleteAllData}
            >
              <View style={styles.actionLeft}>
                <Trash2 size={18} color={expenseColors.accentRed} />
                <View>
                  <AppText style={[styles.actionTitle, { color: expenseColors.accentRed }]}>
                    Erase All Stored Data
                  </AppText>
                  <AppText style={styles.actionSub}>Irreversible reset of all local records</AppText>
                </View>
              </View>
              <AppText style={[styles.actionBtnText, { color: expenseColors.accentRed }]}>
                Delete
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101114',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 20,
    paddingTop: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  infoBannerText: {
    flex: 1,
    color: '#E0E0E0',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionContainer: {
    gap: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#1A1D23',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(157, 198, 235, 0.15)',
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  tcItem: {
    gap: 6,
  },
  tcNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tcBody: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSub: {
    color: expenseColors.textMuted,
    fontSize: 11,
  },
  actionBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  metricCell: {
    alignItems: 'center',
    flex: 1,
  },
  metricCount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  metricLabel: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  metricDividerVertical: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
