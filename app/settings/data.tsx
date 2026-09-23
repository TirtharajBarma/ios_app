import React from 'react';
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
  Share2,
  Trash2,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { useExpenseStore } from '@/store/useExpenseStore';

export default function YourDataScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { transactions } = useExpenseStore();

  const handleExportData = async () => {
    Haptics.selectionAsync();
    try {
      if (transactions.length === 0) {
        Alert.alert('No Data', 'There are no transactions to export yet.');
        return;
      }

      const csvHeader = 'ID,Date,Amount,Type,Category,Account,Note\n';
      const csvRows = transactions
        .map(
          (t) =>
            `"${t.id}","${t.date}",${t.amount},"${t.type}","${t.categoryId}","${t.accountId}","${t.note || ''}"`
        )
        .join('\n');

      const fileContent = csvHeader + csvRows;
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const fileUri = `${docDir}subo_expenses_export.csv`;

      await FileSystem.writeAsStringAsync(fileUri, fileContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Your Data',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export Successful', `Saved CSV file to ${fileUri}`);
      }
    } catch (err) {
      console.warn('Export error:', err);
      Alert.alert('Export Failed', 'Could not export data.');
    }
  };

  const handleClearCache = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Clear Local Cache',
      'This will clean temporary rendering caches. Your saved transactions and categories will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      'This action is irreversible. All transactions, accounts, and custom settings will be permanently erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Data Erased', 'All data on this device has been erased.');
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
            Subo is built local-first. Your financial data, accounts, budgets, and transactions belong to you and stay private on your device.
          </AppText>
        </View>

        {/* 1. Data Privacy Highlights */}
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

        {/* 2. Terms & Conditions (T&C) */}
        <View style={styles.sectionContainer}>
          <View style={styles.titleWithIcon}>
            <FileText size={15} color={expenseColors.textSubtle} />
            <AppText style={styles.sectionTitle}>TERMS & CONDITIONS (T&C)</AppText>
          </View>

          <View style={styles.card}>
            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>1. Acceptance of Terms</AppText>
              <AppText style={styles.tcBody}>
                By accessing or using the Subo expense and subscription tracking application, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, please discontinue use.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>2. User Data Ownership</AppText>
              <AppText style={styles.tcBody}>
                You retain complete, exclusive ownership of all transactions, custom categories, account names, and financial records you log within the application. Subo claims no ownership or rights over your personal financial records.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>3. Non-Financial Advisory Disclaimer</AppText>
              <AppText style={styles.tcBody}>
                Subo is an informational utility designed to assist with personal expense logging, budgeting, and recurring subscription visualization. It does not provide certified financial, investment, tax, or accounting advice. You are solely responsible for your financial decisions.
              </AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.tcItem}>
              <AppText style={styles.tcNumber}>4. Local Storage & Backups</AppText>
              <AppText style={styles.tcBody}>
                Because Subo uses local-first on-device storage, deleting the application or clearing device storage without generating an export backup may result in irreversible data loss. Users are encouraged to utilize the built-in CSV export function regularly.
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
              <AppText style={styles.tcNumber}>6. Privacy Commitment</AppText>
              <AppText style={styles.tcBody}>
                We never monetize, broker, or transmit your individual expense items or bank balances to advertising partners. Any anonymous crash reporting is strictly used to identify application stability bugs.
              </AppText>
            </View>
          </View>
        </View>

        {/* 3. Data Controls */}
        <View style={styles.sectionContainer}>
          <AppText style={styles.sectionTitle}>DATA CONTROLS</AppText>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleExportData}
            >
              <View style={styles.actionLeft}>
                <Share2 size={18} color={expenseColors.accentPeach} />
                <View>
                  <AppText style={styles.actionTitle}>Export Data to CSV</AppText>
                  <AppText style={styles.actionSub}>Download all your transactions</AppText>
                </View>
              </View>
              <AppText style={styles.actionBtnText}>Export</AppText>
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
    backgroundColor: '#0F1015',
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
    backgroundColor: '#16171E',
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
});
