import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  UploadCloud,
  CreditCard,
  ChevronDown,
  CheckCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import { AppText, NativeLiquidMenu } from '@/components/ui';
import { MenuAction } from '@expo/ui/community/menu';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { parsePdfDocument, base64ToUint8Array, isPdfEncrypted } from '@/utils/pdfParser';
import {
  normalizeStatementData,
  NormalizedStatementResult,
  StagedStatementTxn,
} from '@/utils/statementNormalizer';
import { StatementReviewModal } from './StatementReviewModal';
import { ExpenseAccount } from '@/types/expense';

export const ExpenseImport: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    accounts,
    categories,
    transactions,
    addBatchTransactions,
    currencySymbol,
    learnedMerchantRules,
  } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'processing' | 'success'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [importedTxnCount, setImportedTxnCount] = useState<number>(0);
  const [importedTotalAmount, setImportedTotalAmount] = useState<number>(0);

  // Staged Statement Review Result
  const [parsedStatementResult, setParsedStatementResult] = useState<NormalizedStatementResult | null>(null);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState<boolean>(false);

  const animHeader = useRef(new Animated.Value(1)).current;
  const animDropzone = useRef(new Animated.Value(1)).current;
  const animAccount = useRef(new Animated.Value(1)).current;

  const handlePickDocument = async () => {
    if (accounts.length === 0) {
      Alert.alert(
        'Account Required',
        'You must create at least one payment account before importing transactions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Account', onPress: () => router.push('/(tabs)') },
        ]
      );
      return;
    }

    try {
      Haptics.selectionAsync();
      setImportStatus('uploading');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setUploadedFileName(file.name);
        setImportStatus('processing');

        const isPdf =
          file.name.toLowerCase().endsWith('.pdf') ||
          file.mimeType === 'application/pdf';

        let normalizedResult: NormalizedStatementResult;

        if (isPdf) {
          // PDF Parsing Pipeline
          try {
            const base64Data = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const uint8Data = base64ToUint8Array(base64Data);

            if (isPdfEncrypted(uint8Data)) {
              setImportStatus('idle');
              Alert.alert(
                'Password Protected PDF',
                'This bank statement is encrypted with a password. Please unlock the PDF or export an unencrypted statement to import.'
              );
              return;
            }

            const parsedDoc = parsePdfDocument(uint8Data);
            normalizedResult = normalizeStatementData(
              { pdfRows: parsedDoc.allRows, fileName: file.name },
              accounts,
              categories,
              transactions,
              learnedMerchantRules
            );
          } catch (pdfErr) {
            console.warn('PDF Parsing Error:', pdfErr);
            setImportStatus('idle');
            Alert.alert(
              'PDF Parsing Error',
              'Could not extract transactions from this PDF. Please ensure it is a digital bank statement.'
            );
            return;
          }
        } else {
          // CSV / Plain Text Pipeline
          try {
            const rawContent = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            normalizedResult = normalizeStatementData(
              { csvContent: rawContent, fileName: file.name },
              accounts,
              categories,
              transactions,
              learnedMerchantRules
            );
          } catch (csvErr) {
            console.warn('CSV Reading Error:', csvErr);
            setImportStatus('idle');
            Alert.alert(
              'File Error',
              'Could not read the statement file.'
            );
            return;
          }
        }

        if (normalizedResult.transactions.length === 0) {
          setImportStatus('idle');
          Alert.alert(
            'No Transactions Detected',
            'We could not find any recognizable transaction records in this statement. Please make sure the statement contains dates, amounts, and descriptions.'
          );
          return;
        }

        setParsedStatementResult(normalizedResult);
        setImportStatus('idle');
        setIsReviewModalVisible(true);
      } else {
        setImportStatus('idle');
      }
    } catch (err) {
      console.warn('Document picker error:', err);
      setImportStatus('idle');
    }
  };

  const handleConfirmBatchImport = (
    selectedTxs: StagedStatementTxn[],
    targetAccountId?: string
  ) => {
    if (selectedTxs.length === 0) {
      setIsReviewModalVisible(false);
      return;
    }

    // Identify any newly detected accounts that do not exist yet
    const newAccountsToCreate: ExpenseAccount[] = [];
    if (parsedStatementResult?.accountsDetected) {
      parsedStatementResult.accountsDetected.forEach((detectedName) => {
        const exists = accounts.some(
          (a) => a.name.toLowerCase() === detectedName.toLowerCase()
        );
        if (!exists && detectedName !== 'Primary Account' && detectedName !== 'Default Account') {
          const isCredit = /axis|slice|card|zone/i.test(detectedName);
          newAccountsToCreate.push({
            id: `acc_${detectedName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
            name: detectedName,
            type: isCredit ? 'credit' : 'savings',
            balance: 0,
            dueAmount: isCredit ? 0 : undefined,
            txnCountThisMonth: 0,
            monthlyChange: 0,
            statusType: isCredit ? 'due' : 'positive',
          });
        }
      });
    }

    const defaultFallbackAccId = targetAccountId || accounts[0]?.id || 'acc_default';

    const txsToInsert = selectedTxs.map((t) => {
      // Resolve account
      let accId = t.accountId;
      if (!accId || accId === 'acc_default') {
        const matchingNew = newAccountsToCreate.find(
          (na) => na.name.toLowerCase() === t.accountName.toLowerCase()
        );
        if (matchingNew) {
          accId = matchingNew.id;
        } else {
          accId = defaultFallbackAccId;
        }
      }

      return {
        amount: t.amount,
        type: t.type,
        categoryId: t.categoryId,
        accountId: accId,
        date: t.date,
        note: t.narration,
      };
    });

    addBatchTransactions(txsToInsert, newAccountsToCreate);

    setImportedTxnCount(selectedTxs.length);
    setImportedTotalAmount(selectedTxs.reduce((sum, t) => sum + t.amount, 0));
    setIsReviewModalVisible(false);
    setImportStatus('success');
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary, zIndex: 10 }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 8,
            paddingBottom: insets.bottom + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: "IMPORT HUB" */}
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: animHeader,
              transform: [
                {
                  translateY: animHeader.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.titleContainer}>
            <AppText style={styles.titleImport}>IMPORT </AppText>
            <AppText style={styles.titleHub}>HUB</AppText>
          </View>

          <AppText style={styles.uploadTitle}>UNIVERSAL STATEMENT IMPORTER</AppText>
          <AppText style={styles.uploadDescription}>
            Import PDF or CSV statements from ANY bank.{'\n'}
            100% on-device AI classification, duplicate detection & balance reconciliation.
          </AppText>
        </Animated.View>

        {/* File Upload Dropzone Card */}
        <Animated.View
          style={{
            opacity: animDropzone,
            transform: [
              {
                translateY: animDropzone.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={styles.dropzoneCard}
            activeOpacity={0.85}
            onPress={handlePickDocument}
          >
            {importStatus === 'uploading' || importStatus === 'processing' ? (
              <View style={styles.dropzoneInnerContent}>
                <ActivityIndicator size="large" color={expenseColors.accentPeach} />
                <AppText style={styles.dropzoneTitle}>
                  {importStatus === 'uploading' ? 'Reading PDF & CMap encodings...' : 'Normalizing & reconciling statement...'}
                </AppText>
              </View>
            ) : importStatus === 'success' ? (
              <View style={styles.dropzoneInnerContent}>
                <CheckCircle size={44} color={expenseColors.accentGreen} strokeWidth={2} />
                <AppText style={styles.dropzoneTitle}>
                  Imported {importedTxnCount} Transaction{importedTxnCount !== 1 ? 's' : ''}!
                </AppText>
                <AppText style={styles.dropzoneSubtext}>
                  {uploadedFileName || 'Bank Statement'} ({sym}{importedTotalAmount.toLocaleString('en-IN')}) added to Ledger
                </AppText>

                <View style={styles.successActionsRow}>
                  <TouchableOpacity
                    style={styles.viewLedgerBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.selectionAsync();
                      router.push('/(tabs)/ledger');
                    }}
                  >
                    <AppText style={styles.viewLedgerBtnText}>View in Ledger</AppText>
                    <ArrowRight size={13} color="#0F1015" strokeWidth={2.5} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.selectionAsync();
                      setImportStatus('idle');
                      setUploadedFileName(null);
                    }}
                  >
                    <AppText style={styles.resetBtnText}>Upload Another</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.dropzoneInnerContent}>
                <View style={styles.uploadIconContainer}>
                  <UploadCloud size={32} color={expenseColors.textPrimary} strokeWidth={2} />
                </View>

                <AppText style={styles.dropzoneTitle}>
                  DROP BANK STATEMENT OR BROWSE
                </AppText>

                <AppText style={styles.dropzoneSubtext}>
                  PDF • CSV • TEXT BANK STATEMENTS
                </AppText>

                {/* Privacy & Feature Badges */}
                <View style={styles.badgesRow}>
                  <View style={styles.featureBadge}>
                    <ShieldCheck size={11} color={expenseColors.accentGreen} />
                    <AppText style={styles.featureBadgeText}>100% On-Device</AppText>
                  </View>
                  <View style={styles.featureBadge}>
                    <FileText size={11} color={expenseColors.accentPeach} />
                    <AppText style={styles.featureBadgeText}>Multi-Page PDF</AppText>
                  </View>
                  <View style={styles.featureBadge}>
                    <FileSpreadsheet size={11} color="#60A5FA" />
                    <AppText style={styles.featureBadgeText}>Auto Reconciled</AppText>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Default Target Account Card */}
        <Animated.View
          style={[
            styles.accountCard,
            {
              opacity: animAccount,
              transform: [
                {
                  translateY: animAccount.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.accountHeaderRow}>
            <CreditCard size={18} color={expenseColors.textPrimary} />
            <AppText style={styles.accountCardTitle}>DEFAULT FALLBACK ACCOUNT</AppText>
          </View>

          {/* Native Liquid Dropdown */}
          {(() => {
            const accountMenuActions: MenuAction[] = accounts.map((acc) => ({
              id: acc.name,
              title: acc.name,
              image:
                acc.statusType === 'due' || acc.type === 'credit'
                  ? ('creditcard.fill' as any)
                  : acc.name.toLowerCase().includes('wallet') || acc.name.toLowerCase().includes('pay')
                    ? ('wallet.pass.fill' as any)
                    : ('building.columns.fill' as any),
              state: (selectedAccount === acc.name ? 'on' : 'off') as 'on' | 'off',
            }));
            return (
              <NativeLiquidMenu
                title="Select Account"
                actions={accountMenuActions}
                onSelect={(name) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedAccount(name);
                }}
                style={{ width: '100%' }}
              >
                <View style={styles.dropdownSelector}>
                  <AppText
                    style={[
                      styles.dropdownSelectedText,
                      !selectedAccount && { color: expenseColors.textMuted },
                    ]}
                  >
                    {selectedAccount || accounts[0]?.name || 'Select Account'}
                  </AppText>
                  <ChevronDown size={18} color={expenseColors.textSubtle} />
                </View>
              </NativeLiquidMenu>
            );
          })()}

          <AppText style={styles.accountCardDescription}>
            Used as default when the statement does not specify individual account headers.
          </AppText>
        </Animated.View>
      </ScrollView>

      {/* Interactive Statement Review & Reconciliation Modal */}
      <StatementReviewModal
        visible={isReviewModalVisible}
        onClose={() => setIsReviewModalVisible(false)}
        result={parsedStatementResult}
        onConfirmImport={handleConfirmBatchImport}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  titleImport: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  titleHub: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  uploadTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  uploadDescription: {
    color: expenseColors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  dropzoneCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dropzoneTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 1.0,
    textAlign: 'center',
    marginBottom: 8,
  },
  dropzoneSubtext: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E212B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureBadgeText: {
    color: expenseColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
  },
  successActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  viewLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9D66',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
  },
  viewLedgerBtnText: {
    color: '#0F1015',
    fontSize: 12,
    fontWeight: '800',
  },
  resetBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  accountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  accountCardTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#232633',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  dropdownSelectedText: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  accountCardDescription: {
    color: expenseColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
