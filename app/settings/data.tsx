import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';

import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { useExpenseStore } from '@/store/useExpenseStore';
import { getDeviceAiEngineInfo } from '@/services/onDeviceAi';
import { logAction, logException } from '@/utils/auditLog';
import AsyncStorage from '@/utils/storage';

const EXCHANGE_RATE_CACHE_KEY = '@subo_exchange_rates';

export default function YourDataScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { transactions, accounts, categories, resetAllData, currencySymbol } = useExpenseStore();
  const aiEngineInfo = useMemo(() => getDeviceAiEngineInfo(), []);

  const handleExportPdf = async () => {
    Haptics.selectionAsync();
    try {
      if (transactions.length === 0) {
        Alert.alert('No Data', 'There are no transactions to generate a PDF financial report.');
        return;
      }

      const totalSpent = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
      const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const netSavings = totalIncome - totalSpent;
      const ledgerRowCount = Math.min(transactions.length, 300);

      const categoryRows = categories
        .filter((c) => c.id !== 'cat_income')
        .map((cat) => {
          const catSpent = transactions
            .filter((t) => t.type === 'expense' && t.categoryId === cat.id)
            .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
          if (catSpent === 0) return '';
          const pct = totalSpent > 0 ? ((catSpent / totalSpent) * 100).toFixed(1) : '0';
          return `
            <tr>
              <td><strong>${cat.name}</strong></td>
              <td style="text-align: right; color: #E84040; font-weight: 600;">${currencySymbol}${catSpent.toLocaleString('en-IN')}</td>
              <td style="text-align: right; color: #555;">${pct}%</td>
            </tr>
          `;
        })
        .filter(Boolean)
        .join('');

      const txRows = transactions
        .slice(0, 300)
        .map((t) => {
          const cat = categories.find((c) => c.id === t.categoryId);
          const acc = accounts.find((a) => a.id === t.accountId);
          const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄' : '-';
          const color = t.type === 'income' ? '#70D6BC' : t.type === 'transfer' ? '#9DC6EB' : '#F48B8B';
          const displayAmt = t.split ? t.split.yourShare : t.amount;
          return `
            <tr>
              <td>${new Date(t.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td>${cat?.name || 'Expense'}</td>
              <td>${acc?.name || 'Account'}</td>
              <td>${t.note || (t.split ? `Split (${t.split.friendNames})` : '-')}</td>
              <td style="text-align: right; font-weight: bold; color: ${color};">${sign}${currencySymbol}${displayAmt.toLocaleString('en-IN')}</td>
            </tr>
          `;
        })
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1c1c1e; background: #ffffff; line-height: 1.4; }
            .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            h1 { font-size: 24px; margin: 0; text-transform: uppercase; letter-spacing: 0.6px; color: #111; }
            .meta { font-size: 11px; color: #666; margin-top: 4px; }
            .summary-cards { display: flex; gap: 14px; margin-bottom: 24px; }
            .card { flex: 1; padding: 14px; border: 1px solid #e2e4e8; border-radius: 10px; background: #f8f9fa; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #777; font-weight: 700; margin-bottom: 6px; }
            .card-val { font-size: 20px; font-weight: 800; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
            th { text-align: left; padding: 9px 10px; background: #f1f2f4; border-bottom: 2px solid #ccc; text-transform: uppercase; font-size: 10px; color: #555; }
            td { padding: 9px 10px; border-bottom: 1px solid #eee; }
            .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 24px 0 10px 0; border-left: 4px solid #FF9D66; padding-left: 8px; color: #222; }
            .footer { font-size: 10px; color: #999; text-align: center; margin-top: 36px; border-top: 1px solid #eee; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Financial Statement Report</h1>
              <div class="meta">Export Period: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-title">Total Income</div>
              <div class="card-val" style="color: #70D6BC;">+${currencySymbol}${totalIncome.toLocaleString('en-IN')}</div>
            </div>
            <div class="card">
              <div class="card-title">Total Expenses</div>
              <div class="card-val" style="color: #F48B8B;">-${currencySymbol}${totalSpent.toLocaleString('en-IN')}</div>
            </div>
            <div class="card">
              <div class="card-title">Net Balance</div>
              <div class="card-val" style="color: ${netSavings >= 0 ? '#70D6BC' : '#F48B8B'};">${netSavings >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(netSavings).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div class="section-title">Category Spending Distribution</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align: right;">Amount Spent</th>
                <th style="text-align: right;">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRows || '<tr><td colspan="3" style="text-align: center; color: #888;">No expenses recorded</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">Transaction Ledger Log (${ledgerRowCount}${transactions.length > 300 ? ` of ${transactions.length}` : ''} total${transactions.length > 300 ? ' — newest 300 shown' : ''})</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Account</th>
                <th>Note / Merchant</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${txRows}
            </tbody>
          </table>

          <div class="footer">
            Personal & Confidential • 100% On-Device Financial Record • Zero Cloud Telemetry
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export Financial Report (PDF)',
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

  const handleDeleteAllData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      'Delete All Stored Data',
      'This action is irreversible. All transactions, accounts, and custom settings will be permanently erased. The hidden activity/audit log is intentionally retained as a permanent record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Everything',
          style: 'destructive',
          onPress: () => {
            resetAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logAction('security', 'User erased all stored data from Settings');
            Alert.alert('Data Erased', 'All data on this device has been erased and restored to clean initial state.');
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
            {/* Activity / Audit Log */}
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
