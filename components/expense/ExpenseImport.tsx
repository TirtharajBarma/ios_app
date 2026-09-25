import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  CheckCircle2,
  FileText,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Target,
  AlertTriangle,
  Wallet,
  Sparkles,
  Edit3,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
import { StatementReviewModal, OpeningBalancesData } from './StatementReviewModal';
import { SetOpeningBalancesModal } from './SetOpeningBalancesModal';
import { SetBudgetModal } from './SetBudgetModal';
import { ExpenseAccount } from '@/types/expense';

export const ExpenseImport: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const {
    accounts,
    categories,
    transactions,
    addBatchTransactions,
    updateAccount,
    currencySymbol,
    monthlyBudget,
    setMonthlyBudget,
    learnedMerchantRules,
    statementSetup,
    setStatementSetup,
    formatAmount,
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
  const [isOpeningBalanceModalVisible, setIsOpeningBalanceModalVisible] = useState<boolean>(false);
  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState<boolean>(false);

  // Smooth scroll to top on focus & clean up temporary import states on blur
  useFocusEffect(
    useCallback(() => {
      const rafId = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      return () => {
        cancelAnimationFrame(rafId);
        setImportStatus('idle');
        setUploadedFileName(null);
        setParsedStatementResult(null);
        setIsReviewModalVisible(false);
      };
    }, [])
  );

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
            let base64Data = '';
            try {
              base64Data = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } catch {
              const decodedUri = decodeURIComponent(file.uri);
              base64Data = await FileSystem.readAsStringAsync(decodedUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            }

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
            const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
            console.warn('PDF Parsing Error:', errMsg, pdfErr);
            setImportStatus('idle');
            Alert.alert(
              'PDF Parsing Error',
              `Could not extract transactions from this PDF.\n\nError: ${errMsg}\n\nPlease ensure it is a digital bank statement.`
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
    targetAccountId?: string,
    openingBalances?: OpeningBalancesData,
    budget?: number
  ) => {
    if (selectedTxs.length === 0) {
      setIsReviewModalVisible(false);
      return;
    }

    // 1. Identify any newly detected accounts that do not exist yet
    const newAccountsToCreate: ExpenseAccount[] = [];
    if (parsedStatementResult?.accountsDetected) {
      parsedStatementResult.accountsDetected.forEach((detectedName) => {
        const exists = accounts.some(
          (a) => a.name.toLowerCase() === detectedName.toLowerCase()
        );
        if (!exists && detectedName !== 'Primary Account' && detectedName !== 'Default Account') {
          const assignedType = openingBalances?.types[detectedName] || 'savings';
          const isCredit = assignedType === 'credit';
          const isWallet = assignedType === 'wallet';
          const customBal = openingBalances?.balances[detectedName] ?? 0;

          newAccountsToCreate.push({
            id: `acc_${detectedName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: detectedName,
            type: assignedType,
            balance: isCredit ? 0 : customBal,
            dueAmount: isCredit && customBal > 0 ? customBal : undefined,
            txnCountThisMonth: 0,
            monthlyChange: 0,
            statusType: isCredit && customBal > 0 ? 'due' : 'positive',
            openingBalance: isCredit ? 0 : customBal,
          });
        }
      });
    }

    // Also create any custom accounts added during step 1
    if (openingBalances?.newAccounts && openingBalances.newAccounts.length > 0) {
      openingBalances.newAccounts.forEach((cAcc) => {
        const isCredit = cAcc.type === 'credit';
        newAccountsToCreate.push({
          id: `acc_${cAcc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: cAcc.name,
          type: cAcc.type,
          balance: isCredit ? 0 : cAcc.balance,
          dueAmount: isCredit && cAcc.balance > 0 ? cAcc.balance : undefined,
          txnCountThisMonth: 0,
          monthlyChange: 0,
          statusType: isCredit && cAcc.balance > 0 ? 'due' : 'positive',
          openingBalance: isCredit ? 0 : cAcc.balance,
        });
      });
    }

    const defaultFallbackAccId = targetAccountId || accounts[0]?.id || 'acc_default';
    const allAccountsList = [...accounts, ...newAccountsToCreate];

    const txsToInsert = selectedTxs.map((t) => {
      // Resolve exact account ID from existing accounts or newly staged accounts
      const matchingAcc = allAccountsList.find(
        (a) => a.name.toLowerCase() === t.accountName?.toLowerCase()
      );
      const accId = matchingAcc?.id || t.accountId || defaultFallbackAccId;
      const accName = matchingAcc?.name || t.accountName;

      let toAccId = t.toAccountId;
      let toAccName = t.toAccountName;
      if (t.type === 'transfer' && toAccName) {
        const matchingTo = allAccountsList.find(
          (a) => a.name.toLowerCase() === toAccName?.toLowerCase()
        );
        if (matchingTo) toAccId = matchingTo.id;
      }

      return {
        amount: t.amount,
        type: t.type,
        categoryId: t.categoryId,
        accountId: accId,
        accountName: accName,
        toAccountId: toAccId,
        toAccountName: toAccName,
        date: t.date,
        note: t.narration,
      };
    });

    addBatchTransactions(txsToInsert, newAccountsToCreate);

    // Update existing accounts with opening balances if provided
    if (openingBalances) {
      accounts.forEach((acc) => {
        const assignedType = openingBalances.types[acc.id] || acc.type || 'savings';
        const isCredit = assignedType === 'credit';
        const numBal = openingBalances.balances[acc.id];

        const updates: Partial<ExpenseAccount> = {
          type: assignedType,
          statusType: isCredit && (numBal ?? 0) > 0 ? 'due' : 'positive',
        };

        if (numBal !== undefined && !isNaN(numBal) && numBal >= 0) {
          if (isCredit) {
            updates.dueAmount = numBal;
            updates.balance = 0;
            updates.openingBalance = 0;
          } else {
            updates.balance = numBal;
            updates.openingBalance = numBal;
            updates.dueAmount = undefined;
          }
        }

        updateAccount(acc.id, updates);
      });
    }

    // Update monthly budget if provided (allow 0)
    if (budget !== undefined && !isNaN(budget) && budget >= 0) {
      setMonthlyBudget(budget);
    }

    setStatementSetup({
      hasImported: true,
      openingBalancesConfigured: true,
      budgetConfigured: budget !== undefined ? true : statementSetup?.budgetConfigured,
      lastImportTimestamp: Date.now(),
    });

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
        ref={scrollRef}
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
                  {uploadedFileName || 'Bank Statement'} ({formatAmount(importedTotalAmount)}) added to Ledger
                </AppText>

                {/* Setup Steps Status Card */}
                <View style={styles.setupStepsCard}>
                  <View style={styles.setupStepRow}>
                    <CheckCircle2 size={16} color="#70D6BC" />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.setupStepTitle}>1. PDF Statement Imported</AppText>
                      <AppText style={styles.setupStepDesc}>{importedTxnCount} transactions categorized</AppText>
                    </View>
                  </View>

                  <View style={styles.stepDivider} />

                  <View style={styles.setupStepRow}>
                    {statementSetup?.openingBalancesConfigured ? (
                      <CheckCircle2 size={16} color="#70D6BC" />
                    ) : (
                      <Wallet size={16} color="#60A5FA" />
                    )}
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.setupStepTitle}>
                        2. Opening Balances {statementSetup?.openingBalancesConfigured ? '✓' : ''}
                      </AppText>
                      <AppText style={styles.setupStepDesc}>
                        {statementSetup?.openingBalancesConfigured
                          ? 'Starting balances and dues active'
                          : 'Set initial funds so Total Balance is exact'}
                      </AppText>
                    </View>
                    <TouchableOpacity
                      style={statementSetup?.openingBalancesConfigured ? styles.adjustBtn : styles.actionBtnSmall}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.selectionAsync();
                        setIsOpeningBalanceModalVisible(true);
                      }}
                    >
                      <AppText style={statementSetup?.openingBalancesConfigured ? styles.adjustBtnText : styles.actionBtnSmallText}>
                        {statementSetup?.openingBalancesConfigured ? 'Adjust' : 'Set'}
                      </AppText>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stepDivider} />

                  <View style={styles.setupStepRow}>
                    {statementSetup?.budgetConfigured || monthlyBudget > 0 ? (
                      <CheckCircle2 size={16} color="#70D6BC" />
                    ) : (
                      <Target size={16} color="#FF9D66" />
                    )}
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.setupStepTitle}>
                        3. Monthly Budget {statementSetup?.budgetConfigured || monthlyBudget > 0 ? '✓' : ''}
                      </AppText>
                      <AppText style={styles.setupStepDesc}>
                        {statementSetup?.budgetConfigured || monthlyBudget > 0
                          ? `Active Target: ${formatAmount(monthlyBudget)}`
                          : 'Set spending limit runway'}
                      </AppText>
                    </View>
                    <TouchableOpacity
                      style={statementSetup?.budgetConfigured || monthlyBudget > 0 ? styles.adjustBtn : styles.actionBtnSmall}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.selectionAsync();
                        setIsBudgetModalVisible(true);
                      }}
                    >
                      <AppText style={statementSetup?.budgetConfigured || monthlyBudget > 0 ? styles.adjustBtnText : styles.actionBtnSmallText}>
                        {statementSetup?.budgetConfigured || monthlyBudget > 0 ? 'Adjust' : 'Set Goal'}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Classification Notice */}
                <View style={styles.aiWarningCard}>
                  <AlertTriangle size={15} color="#FFB84D" />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.aiWarningTitle}>AUTOMATIC CLASSIFICATION NOTICE</AppText>
                    <AppText style={styles.aiWarningText}>
                      Categories and payment accounts have been mapped automatically. You can review or adjust any details directly in The Ledger.
                    </AppText>
                  </View>
                </View>

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

      {/* Interactive Set Opening Balances Modal */}
      <SetOpeningBalancesModal
        visible={isOpeningBalanceModalVisible}
        onClose={() => setIsOpeningBalanceModalVisible(false)}
        onSaveSuccess={() => {
          setTimeout(() => {
            setIsBudgetModalVisible(true);
          }, 350);
        }}
      />

      {/* Interactive Set Monthly Budget Modal */}
      <SetBudgetModal
        visible={isBudgetModalVisible}
        onClose={() => setIsBudgetModalVisible(false)}
        onSuccess={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }}
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
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    marginBottom: 16,
  },
  dropzoneInnerContent: {
    alignItems: 'center',
  },
  uploadIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  dropzoneTitle: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  dropzoneSubtext: {
    color: expenseColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: 'center',
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
    gap: 4,
    backgroundColor: '#1E212A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureBadgeText: {
    color: expenseColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  aiWarningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 184, 77, 0.08)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.2)',
    marginVertical: 14,
    width: '100%',
  },
  aiWarningTitle: {
    color: '#FFB84D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  aiWarningText: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 15,
  },
  setupStepsCard: {
    backgroundColor: '#161922',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
    marginVertical: 10,
    gap: 10,
  },
  setupStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setupStepTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  setupStepDesc: {
    color: '#8E919D',
    fontSize: 11,
    marginTop: 1,
  },
  stepDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 26,
  },
  actionBtnSmall: {
    backgroundColor: '#FF9D66',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnSmallText: {
    color: '#0D0E12',
    fontSize: 11,
    fontWeight: '800',
  },
  adjustBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  adjustBtnText: {
    color: '#E0E3EB',
    fontSize: 11,
    fontWeight: '600',
  },
  successActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  viewLedgerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: expenseColors.accentPeach,
    borderRadius: 12,
    paddingVertical: 12,
  },
  viewLedgerBtnText: {
    color: '#0F1015',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resetBtn: {
    backgroundColor: '#1C1F2B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resetBtnText: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
  },
  accountCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#171922',
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dropdownSelectedText: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  accountCardDescription: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
