import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  TextInput,
  useWindowDimensions,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  CreditCard,
  Banknote,
  Users,
  Repeat,
  Flame,
  ShieldCheck,
  Check,
  ArrowRight,
  ArrowLeftRight,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Tv,
  User,
  Mail,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

import { AppText, ProfileAvatar } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { AVATAR_OPTIONS } from '@/constants/avatars';
import { parsePdfDocument, base64ToUint8Array } from '@/utils/pdfParser';
import { normalizeStatementData, NormalizedStatementResult, StagedStatementTxn } from '@/utils/statementNormalizer';
import { EditAccountModal } from './EditAccountModal';
import { StatementReviewModal } from './StatementReviewModal';

const TOTAL_MOMENTS = 7;

interface AppWalkthroughModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AppWalkthroughModal: React.FC<AppWalkthroughModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const {
    accounts,
    setMonthlyBudget,
    setHasSeenWalkthrough,
    currencySymbol,
    categories,
    transactions,
    addBatchTransactions,
    learnedMerchantRules,
  } = useExpenseStore();

  const { setUserName, setUserEmail, setUserAvatarId } = useSettingsStore();

  const sym = currencySymbol || '₹';
  const [currentMoment, setCurrentMoment] = useState<number>(0);
  const scrollRef = useRef<ScrollView>(null);
  const profileScrollRef = useRef<ScrollView>(null);

  // Profile Inputs for Final Moment — strictly empty on start
  const [inputName, setInputName] = useState<string>('');
  const [inputEmail, setInputEmail] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('avatar_astro');

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Real modals triggered from optional setup moments
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [showBudgetPicker, setShowBudgetPicker] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importReviewResult, setImportReviewResult] = useState<NormalizedStatementResult | null>(null);
  const [isReviewModalVisible, setIsReviewModalVisible] = useState<boolean>(false);

  // Demo interactive state in moments
  const [demoSplitSettled, setDemoSplitSettled] = useState<boolean>(false);
  const [demoSelectedCategory, setDemoSelectedCategory] = useState<string>('food');

  const animateToMoment = (targetIndex: number) => {
    Haptics.selectionAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.2,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: targetIndex > currentMoment ? 15 : -15,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentMoment(targetIndex);
      scrollRef.current?.scrollTo({ x: targetIndex * screenWidth, animated: false });
      slideAnim.setValue(targetIndex > currentMoment ? -15 : 15);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentMoment < TOTAL_MOMENTS - 1) {
      animateToMoment(currentMoment + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentMoment > 0) {
      animateToMoment(currentMoment - 1);
    }
  };

  const handleComplete = async () => {
    if (!inputName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert('Name Required', 'Please enter your name to complete setup and personalize your ledger.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await setUserName(inputName.trim());
    await setUserEmail(inputEmail.trim()); // explicitly save empty string if blank
    await setUserAvatarId(selectedAvatar);
    setHasSeenWalkthrough(true);
    onClose();
  };

  // Statement import action from Moment 6
  const handlePickStatement = async () => {
    try {
      Haptics.selectionAsync().catch(() => {});
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || (file.mimeType && file.mimeType.includes('pdf'));

        let normalized: NormalizedStatementResult;

        if (isPdf) {
          const base64Data = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const uint8Array = base64ToUint8Array(base64Data);
          const parsed = await parsePdfDocument(uint8Array);
          normalized = normalizeStatementData(
            { pdfRows: parsed.allRows, fileName: file.name },
            accounts,
            categories,
            transactions,
            learnedMerchantRules
          );
        } else {
          const rawText = await FileSystem.readAsStringAsync(file.uri);
          normalized = normalizeStatementData(
            { csvContent: rawText, fileName: file.name },
            accounts,
            categories,
            transactions,
            learnedMerchantRules
          );
        }

        setImportReviewResult(normalized);
        setIsReviewModalVisible(true);
      }
    } catch (err) {
      console.warn('Walkthrough statement import error:', err);
      Alert.alert('Statement Parser', 'Could not parse the selected file. You can import statements anytime from Settings.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = (selectedTxs: StagedStatementTxn[], targetAccountId?: string) => {
    if (!selectedTxs || selectedTxs.length === 0) {
      setIsReviewModalVisible(false);
      return;
    }

    const defaultAccId = targetAccountId || accounts[0]?.id || 'acc_primary';

    const txsToCreate = selectedTxs.map((staged) => ({
      amount: staged.amount,
      type: staged.type,
      categoryId: staged.categoryId || 'cat_food',
      accountId: defaultAccId,
      date: staged.date,
      note: staged.narration,
    }));

    addBatchTransactions(txsToCreate);
    setIsReviewModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    handleNext();
  };

  // Story definition for all 7 cinematic moments
  const MOMENTS = [
    {
      id: 'big_picture',
      headline: 'Your money.\nOne clear picture.',
      subtitle: 'A private, local-first command center for your liquid wealth, spending, and debts.',
      hasSetup: false,
    },
    {
      id: 'accounts',
      headline: 'Everything in\none place.',
      subtitle: 'Bank accounts, credit lines, and cash. Self-transfers move money without distorting spending totals.',
      hasSetup: true,
      setupAction: 'Add an Account',
      setupHandler: () => setShowAddAccountModal(true),
    },
    {
      id: 'ledger',
      headline: 'Know where every\nrupee goes.',
      subtitle: 'An ultra-fast transaction ledger with editorial typography, vector category icons, and instant search.',
      hasSetup: false,
    },
    {
      id: 'splits',
      headline: 'Shared money,\nwithout the mess.',
      subtitle: 'Split bills stay grouped in one folder. Track individual shares, see who owes what, and settle in one tap.',
      hasSetup: false,
    },
    {
      id: 'subscriptions',
      headline: 'Anticipate recurring\ncommitments.',
      subtitle: 'Renewal countdowns for Netflix, Spotify, iCloud, paired with a 4-tier spending heatmap calendar.',
      hasSetup: true,
      setupAction: 'Set Spending Goal',
      setupHandler: () => setShowBudgetPicker(true),
    },
    {
      id: 'importer',
      headline: 'Bring your financial\nhistory with you.',
      subtitle: '100% on-device AI statement engine. Parses PDF & CSV statements from any bank with zero cloud leaks.',
      hasSetup: true,
      setupAction: 'Import Statement (PDF/CSV)',
      setupHandler: handlePickStatement,
    },
    {
      id: 'profile',
      headline: 'Personalize your\nlocal profile.',
      subtitle: 'Stored exclusively on your device. Zero cloud sync or account registration required.',
      hasSetup: false,
    },
  ];

  const currentMomentData = MOMENTS[currentMoment] || MOMENTS[0];

  const avatarInitials = inputName.trim()
    ? inputName
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '✦';

  const isNameFilled = Boolean(inputName.trim());

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleComplete}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#101114" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#101114' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.canvas, { paddingTop: Math.max(insets.top + 12, 28) }]}>
          {/* Top Minimal Segmented Progress Bar */}
          <View style={styles.topBar}>
            {currentMoment > 0 ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handlePrev}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} />
            )}

            <View style={styles.progressSegments}>
              {MOMENTS.map((_, idx) => {
                const isActive = idx === currentMoment;
                const isPast = idx < currentMoment;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.segmentBar,
                      isActive && styles.segmentBarActive,
                      isPast && styles.segmentBarPast,
                    ]}
                  />
                );
              })}
            </View>

            <View style={{ width: 28 }} />
          </View>

          {/* ══════════════════════════════════════════════════════════
              MOMENTS 0 TO 5: STANDARD PRODUCT STORY STAGES
             ══════════════════════════════════════════════════════════ */}
          {currentMoment < 6 ? (
            <>
              {/* Center Product Showcase Canvas */}
              <Animated.View
                style={[
                  styles.stageContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* MOMENT 1: BIG PICTURE SHOWCASE */}
                {currentMoment === 0 && (
                  <View style={styles.momentStage}>
                    <View style={styles.heroBalanceShowcase}>
                      <View style={styles.heroBalanceHeader}>
                        <AppText style={styles.heroBalanceLabel}>TOTAL BALANCE</AppText>
                        <AppText style={styles.heroBalanceValue}>{sym}48,250</AppText>
                      </View>

                      {/* Dynamic Floating Arc Preview */}
                      <View style={styles.heroArcRow}>
                        {[
                          { name: 'FOOD', icon: UtensilsCrossed, color: '#A9DFBF', pct: '38%', amt: `${sym}18,400` },
                          { name: 'SHOPPING', icon: ShoppingBag, color: '#76D2C4', pct: '25%', amt: `${sym}12,200` },
                          { name: 'TRANS', icon: Car, color: '#F39C94', pct: '13%', amt: `${sym}6,500` },
                          { name: 'ENT', icon: Tv, color: '#D2B4DE', pct: '10%', amt: `${sym}4,800` },
                        ].map((cat) => {
                          const isSel = demoSelectedCategory === cat.name.toLowerCase();
                          const IconComp = cat.icon;
                          return (
                            <TouchableOpacity
                              key={cat.name}
                              activeOpacity={0.8}
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setDemoSelectedCategory(cat.name.toLowerCase());
                              }}
                              style={[
                                styles.heroArcBubble,
                                isSel && { borderColor: cat.color, backgroundColor: `${cat.color}22` },
                              ]}
                            >
                              <IconComp size={16} color={cat.color} />
                              <AppText style={[styles.heroArcPct, { color: cat.color }]}>{cat.pct}</AppText>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Account Connection Pill */}
                      <View style={styles.heroAccountsBar}>
                        <View style={styles.heroAccountChip}>
                          <View style={[styles.heroAccountDot, { backgroundColor: '#70D6BC' }]} />
                          <AppText style={styles.heroAccountName}>HDFC Bank</AppText>
                          <AppText style={styles.heroAccountAmt}>{sym}34,200</AppText>
                        </View>
                        <View style={styles.heroAccountChip}>
                          <View style={[styles.heroAccountDot, { backgroundColor: '#FF9D66' }]} />
                          <AppText style={styles.heroAccountName}>Primary Cash</AppText>
                          <AppText style={styles.heroAccountAmt}>{sym}14,050</AppText>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* MOMENT 2: MULTI-ACCOUNT HUB */}
                {currentMoment === 1 && (
                  <View style={styles.momentStage}>
                    <View style={styles.accountsShowcaseStack}>
                      {/* Bank Card */}
                      <View style={styles.accountShowcaseCard}>
                        <View style={[styles.accountIconBox, { backgroundColor: 'rgba(112, 214, 188, 0.15)' }]}>
                          <Building2 size={18} color="#70D6BC" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.accountCardTitle}>HDFC SALARY ACCOUNT</AppText>
                          <AppText style={styles.accountCardSub}>Liquid Bank · Primary</AppText>
                        </View>
                        <AppText style={styles.accountCardBal}>{sym}34,200</AppText>
                      </View>

                      {/* Credit Card with Due Amount */}
                      <View style={styles.accountShowcaseCard}>
                        <View style={[styles.accountIconBox, { backgroundColor: 'rgba(255, 157, 102, 0.15)' }]}>
                          <CreditCard size={18} color="#FF9D66" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.accountCardTitle}>SLICE / AXIS CARD</AppText>
                          <AppText style={styles.accountCardSub}>Credit Line · Due in 6 days</AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AppText style={[styles.accountCardBal, { color: '#F48B8B' }]}>{sym}3,800</AppText>
                          <AppText style={styles.accountCardStatus}>DUE</AppText>
                        </View>
                      </View>

                      {/* Cash Account */}
                      <View style={styles.accountShowcaseCard}>
                        <View style={[styles.accountIconBox, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
                          <Banknote size={18} color="#A78BFA" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.accountCardTitle}>PRIMARY PHYSICAL CASH</AppText>
                          <AppText style={styles.accountCardSub}>Cash in Hand</AppText>
                        </View>
                        <AppText style={styles.accountCardBal}>{sym}14,050</AppText>
                      </View>

                      {/* Self Transfer Demonstration Pill */}
                      <View style={styles.transferDemonstrationPill}>
                        <ArrowLeftRight size={13} color="#9DC6EB" />
                        <AppText style={styles.transferDemoText}>
                          Internal Transfers: HDFC → Cash {sym}5,000 (No Net Expense)
                        </AppText>
                      </View>
                    </View>
                  </View>
                )}

                {/* MOMENT 3: EDITORIAL LEDGER */}
                {currentMoment === 2 && (
                  <View style={styles.momentStage}>
                    <View style={styles.ledgerShowcaseCard}>
                      {/* Search Bar */}
                      <View style={styles.searchBarDemo}>
                        <Search size={13} color="#60A5FA" />
                        <AppText style={styles.searchBarText}>"Blue Tokai Coffee" or "Food"...</AppText>
                      </View>

                      {/* Transaction Rows */}
                      <View style={styles.txRowDemo}>
                        <View style={[styles.txIconBox, { backgroundColor: 'rgba(169, 223, 191, 0.15)' }]}>
                          <UtensilsCrossed size={16} color="#A9DFBF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.txTitleDemo}>BLUE TOKAI COFFEE</AppText>
                          <AppText style={styles.txMetaDemo}>FOOD & DINING · 02:45 PM</AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AppText style={styles.txAmountExpense}>-{sym}240</AppText>
                          <AppText style={styles.txAccountPill}>CASH</AppText>
                        </View>
                      </View>

                      <View style={styles.txRowDemo}>
                        <View style={[styles.txIconBox, { backgroundColor: 'rgba(210, 180, 222, 0.15)' }]}>
                          <Tv size={16} color="#D2B4DE" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.txTitleDemo}>APPLE ONE BUNDLE</AppText>
                          <AppText style={styles.txMetaDemo}>SUBSCRIPTION · YESTERDAY</AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AppText style={styles.txAmountExpense}>-{sym}365</AppText>
                          <AppText style={styles.txAccountPill}>SLICE</AppText>
                        </View>
                      </View>

                      <View style={styles.txRowDemo}>
                        <View style={[styles.txIconBox, { backgroundColor: 'rgba(112, 214, 188, 0.15)' }]}>
                          <Banknote size={16} color="#70D6BC" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.txTitleDemo}>SALARY DEPOSIT</AppText>
                          <AppText style={styles.txMetaDemo}>INCOME · SEP 01</AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AppText style={styles.txAmountIncome}>+{sym}75,000</AppText>
                          <AppText style={styles.txAccountPill}>HDFC</AppText>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* MOMENT 4: GROUP SPLITS & DEBT SETTLEMENTS */}
                {currentMoment === 3 && (
                  <View style={styles.momentStage}>
                    <View style={styles.splitFolderShowcase}>
                      {/* Folder Header */}
                      <View style={styles.splitFolderHeader}>
                        <View style={styles.splitFolderBadge}>
                          <Users size={13} color="#FF9D66" />
                          <AppText style={styles.splitFolderBadgeText}>GROUP SPLIT FOLDER</AppText>
                        </View>
                        <AppText style={styles.splitFolderTotal}>{sym}299</AppText>
                      </View>

                      <AppText style={styles.splitFolderName}>YOUTUBE FAMILY PLAN</AppText>
                      <AppText style={styles.splitFolderSubtitle}>Entertainment · 5 Participants</AppText>

                      {/* Participant breakdown */}
                      <View style={styles.splitParticipantsList}>
                        <View style={styles.splitParticipantRow}>
                          <AppText style={styles.participantName}>You (Payer)</AppText>
                          <AppText style={styles.participantShare}>My share: {sym}50</AppText>
                          <View style={styles.settledBadge}>
                            <Check size={10} color="#70D6BC" />
                            <AppText style={styles.settledBadgeText}>PAID</AppText>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[styles.splitParticipantRow, styles.interactiveParticipantRow]}
                          activeOpacity={0.8}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                            setDemoSplitSettled(!demoSplitSettled);
                          }}
                        >
                          <AppText style={styles.participantName}>Arnab</AppText>
                          <AppText style={styles.participantShare}>Owes: {sym}50</AppText>
                          <View
                            style={[
                              styles.pendingBadge,
                              demoSplitSettled && { backgroundColor: 'rgba(112, 214, 188, 0.15)', borderColor: 'rgba(112, 214, 188, 0.3)' },
                            ]}
                          >
                            <AppText
                              style={[
                                styles.pendingBadgeText,
                                demoSplitSettled && { color: '#70D6BC' },
                              ]}
                            >
                              {demoSplitSettled ? 'SETTLED ✓' : 'TAP TO SETTLE'}
                            </AppText>
                          </View>
                        </TouchableOpacity>

                        <View style={styles.splitParticipantRow}>
                          <AppText style={styles.participantName}>Aditi</AppText>
                          <AppText style={styles.participantShare}>Share: {sym}50</AppText>
                          <View style={styles.settledBadge}>
                            <Check size={10} color="#70D6BC" />
                            <AppText style={styles.settledBadgeText}>SETTLED</AppText>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* MOMENT 5: SUBSCRIPTIONS & HEATMAP */}
                {currentMoment === 4 && (
                  <View style={styles.momentStage}>
                    <View style={styles.subHeatStack}>
                      {/* Subscription Card */}
                      <View style={styles.subCardDemo}>
                        <View style={[styles.subIconCircle, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                          <Repeat size={18} color="#FBBF24" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.subCardTitle}>NETFLIX 4K ULTRA</AppText>
                          <AppText style={styles.subCardDue}>Renews in 4 days (Oct 01)</AppText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <AppText style={styles.subCardPrice}>{sym}649</AppText>
                          <AppText style={styles.subCardAnnual}>{sym}7,788 / yr</AppText>
                        </View>
                      </View>

                      {/* Heatmap Calendar Mini */}
                      <View style={styles.heatCardDemo}>
                        <View style={styles.heatCardHeader}>
                          <View style={styles.heatCardBadge}>
                            <Flame size={12} color="#FB7185" />
                            <AppText style={styles.heatCardBadgeText}>4-TIER SPENDING HEATMAP</AppText>
                          </View>
                          <AppText style={styles.heatStreakText}>🔥 8-Day Streak</AppText>
                        </View>

                        <View style={styles.heatMatrixGrid}>
                          {[0, 1, 0, 3, 2, 1, 0, 2, 0, 1, 0, 3, 1, 2, 0, 1, 2, 0, 3, 1, 0].map((val, idx) => {
                            const colors = ['#1D2029', '#7A2432', '#B93246', '#FB7185'];
                            return (
                              <View
                                key={idx}
                                style={[styles.heatMatrixCell, { backgroundColor: colors[val] }]}
                              />
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* MOMENT 6: ON-DEVICE STATEMENT IMPORTER */}
                {currentMoment === 5 && (
                  <View style={styles.momentStage}>
                    <View style={styles.importerShowcaseCard}>
                      <View style={styles.importerDocHeader}>
                        <View style={styles.importerDocIcon}>
                          <FileSpreadsheet size={20} color="#70D6BC" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={styles.importerDocName}>HDFC_Statement_Sep2026.pdf</AppText>
                          <AppText style={styles.importerDocMeta}>48 Transactions · Auto-Categorized</AppText>
                        </View>
                        <View style={styles.privacyShieldTag}>
                          <ShieldCheck size={12} color="#70D6BC" />
                          <AppText style={styles.privacyShieldTagText}>LOCAL ONLY</AppText>
                        </View>
                      </View>

                      <View style={styles.reconciliationPill}>
                        <CheckCircle2 size={14} color="#70D6BC" />
                        <AppText style={styles.reconciliationPillText}>
                          Opening {sym}12,400 → Closing {sym}18,920 (Reconciled ✓)
                        </AppText>
                      </View>

                      <View style={styles.importerFeaturesList}>
                        <AppText style={styles.importerFeatureItem}>
                          • 100% on-device AI spatial row & text parser
                        </AppText>
                        <AppText style={styles.importerFeatureItem}>
                          • Auto-detects HDFC, SBI, ICICI, Axis & custom formats
                        </AppText>
                        <AppText style={styles.importerFeatureItem}>
                          • Mathematical reconciliation & duplicate protection
                        </AppText>
                      </View>
                    </View>
                  </View>
                )}
              </Animated.View>

              {/* Bottom Story Content & Action Deck */}
              <View style={[styles.bottomDeck, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
                <AppText style={styles.momentHeadline}>{currentMomentData.headline}</AppText>
                <AppText style={styles.momentSubtitle}>{currentMomentData.subtitle}</AppText>

                <View style={styles.actionsBar}>
                  {currentMomentData.hasSetup ? (
                    <View style={styles.setupActionGroup}>
                      <TouchableOpacity
                        style={styles.primaryActionButton}
                        activeOpacity={0.85}
                        onPress={() => currentMomentData.setupHandler?.()}
                      >
                        <AppText style={styles.primaryActionText}>{currentMomentData.setupAction}</AppText>
                        <ChevronRight size={16} color="#0E1015" strokeWidth={2.8} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.maybeLaterButton}
                        activeOpacity={0.7}
                        onPress={handleNext}
                      >
                        <AppText style={styles.maybeLaterText}>Maybe later</AppText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.primaryActionButton}
                      activeOpacity={0.85}
                      onPress={handleNext}
                    >
                      <AppText style={styles.primaryActionText}>Continue</AppText>
                      <ArrowRight size={16} color="#0E1015" strokeWidth={2.8} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          ) : (
            /* ══════════════════════════════════════════════════════════
               MOMENT 7: PERSONAL PROFILE CREATION (SCROLLABLE & SAFE)
               ══════════════════════════════════════════════════════════ */
            <ScrollView
              ref={profileScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={[
                styles.profileScrollContainer,
                { paddingBottom: Math.max(insets.bottom + 24, 40) },
              ]}
            >
              {/* Header Title & Subtitle */}
              <View style={styles.profileHeaderBlock}>
                <AppText style={styles.momentHeadline}>{currentMomentData.headline}</AppText>
                <AppText style={styles.momentSubtitle}>{currentMomentData.subtitle}</AppText>
              </View>

              {/* Profile Card */}
              <View style={styles.profileShowcaseCard}>
                {/* Live Avatar Preview Header */}
                <View style={styles.profileAvatarHeader}>
                  <ProfileAvatar
                    avatarId={selectedAvatar}
                    name={inputName}
                    size={52}
                    showBorder={true}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.profilePreviewName} numberOfLines={1}>
                      {inputName.trim() || 'Your Name'}
                    </AppText>
                    <AppText style={styles.profilePreviewEmail} numberOfLines={1}>
                      {inputEmail.trim() || 'local@device.private'}
                    </AppText>
                  </View>
                </View>

                {/* Avatar Selection Row */}
                <View style={{ marginVertical: 8 }}>
                  <AppText style={styles.profileInputLabel}>CHOOSE YOUR PROFILE LOGO</AppText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
                  >
                    {AVATAR_OPTIONS.map((av) => {
                      const isSel = selectedAvatar === av.id;
                      return (
                        <TouchableOpacity
                          key={av.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedAvatar(av.id);
                          }}
                          style={{
                            padding: 3,
                            borderRadius: 24,
                            borderWidth: 2,
                            borderColor: isSel ? av.accentColor : 'transparent',
                          }}
                        >
                          <ProfileAvatar avatarId={av.id} size={38} showBorder={false} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Privacy Badge */}
                <View style={styles.profilePrivacyPill}>
                  <ShieldCheck size={14} color="#70D6BC" />
                  <AppText style={styles.profilePrivacyText}>
                    100% On-Device · Syncs directly to your Settings profile
                  </AppText>
                </View>

                {/* Input Fields */}
                <View style={styles.profileInputsContainer}>
                  <View style={styles.profileInputGroup}>
                    <AppText style={styles.profileInputLabel}>YOUR NAME (REQUIRED)</AppText>
                    <View style={styles.profileInputRow}>
                      <User size={15} color={isNameFilled ? '#FFFFFF' : '#8E919D'} />
                      <TextInput
                        style={styles.profileTextInput}
                        placeholder="Enter your name"
                        placeholderTextColor="#6B7280"
                        value={inputName}
                        onChangeText={setInputName}
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="next"
                        onFocus={() => {
                          setTimeout(() => {
                            profileScrollRef.current?.scrollTo({ y: 30, animated: true });
                          }, 100);
                        }}
                      />
                    </View>
                  </View>

                  <View style={styles.profileInputGroup}>
                    <AppText style={styles.profileInputLabel}>EMAIL ADDRESS (OPTIONAL)</AppText>
                    <View style={styles.profileInputRow}>
                      <Mail size={15} color="#8E919D" />
                      <TextInput
                        style={styles.profileTextInput}
                        placeholder="e.g. name@example.com"
                        placeholderTextColor="#6B7280"
                        value={inputEmail}
                        onChangeText={setInputEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        returnKeyType="done"
                        onFocus={() => {
                          setTimeout(() => {
                            profileScrollRef.current?.scrollTo({ y: 90, animated: true });
                          }, 100);
                        }}
                        onSubmitEditing={() => {
                          if (isNameFilled) handleComplete();
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Complete Setup Action Button */}
              <View style={styles.profileActionContainer}>
                <TouchableOpacity
                  style={[
                    styles.primaryActionButton,
                    !isNameFilled && styles.primaryActionDisabled,
                  ]}
                  activeOpacity={isNameFilled ? 0.85 : 1}
                  onPress={handleComplete}
                  disabled={!isNameFilled}
                >
                  <AppText
                    style={[
                      styles.primaryActionText,
                      !isNameFilled && { color: '#8E919D' },
                    ]}
                  >
                    Start exploring 🚀
                  </AppText>
                  <ArrowRight
                    size={16}
                    color={isNameFilled ? '#0E1015' : '#8E919D'}
                    strokeWidth={2.8}
                  />
                </TouchableOpacity>

                {!isNameFilled && (
                  <AppText style={styles.nameRequiredPrompt}>
                    Please enter your name above to launch your ledger
                  </AppText>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Real Modals connected from setup actions */}
      <EditAccountModal
        visible={showAddAccountModal}
        account={null}
        onClose={() => setShowAddAccountModal(false)}
      />

      {/* Budget Goal Picker Modal */}
      {showBudgetPicker && (
        <Modal
          visible={showBudgetPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBudgetPicker(false)}
        >
          <View style={styles.budgetModalBackdrop}>
            <View style={styles.budgetModalCard}>
              <AppText style={styles.budgetModalTitle}>Monthly Spending Target</AppText>
              <AppText style={styles.budgetModalSub}>
                Choose a monthly budget runway for your liquid spending:
              </AppText>

              <View style={styles.budgetPillsGrid}>
                {[15000, 30000, 50000, 100000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.budgetSelectPill}
                    activeOpacity={0.7}
                    onPress={() => {
                      setMonthlyBudget(amt);
                      setShowBudgetPicker(false);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      handleNext();
                    }}
                  >
                    <AppText style={styles.budgetSelectPillText}>{sym}{amt.toLocaleString('en-IN')}</AppText>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.budgetCancelBtn}
                activeOpacity={0.7}
                onPress={() => setShowBudgetPicker(false)}
              >
                <AppText style={styles.budgetCancelBtnText}>Cancel</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Statement Review Modal */}
      <StatementReviewModal
        visible={isReviewModalVisible}
        onClose={() => setIsReviewModalVisible(false)}
        result={importReviewResult}
        onConfirmImport={handleConfirmImport}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#101114',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 36,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSegments: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginHorizontal: 12,
  },
  segmentBar: {
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  segmentBarActive: {
    width: 32,
    backgroundColor: '#FFFFFF',
  },
  segmentBarPast: {
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  stageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  momentStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Moment 1 Hero Balance
  heroBalanceShowcase: {
    width: '100%',
    backgroundColor: '#161922',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  heroBalanceHeader: {
    gap: 4,
  },
  heroBalanceLabel: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroBalanceValue: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  heroArcRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroArcBubble: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#1C202B',
  },
  heroArcPct: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  heroAccountsBar: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  heroAccountChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C202B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  heroAccountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroAccountName: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    flex: 1,
  },
  heroAccountAmt: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  // Moment 2 Accounts
  accountsShowcaseStack: {
    width: '100%',
    gap: 10,
  },
  accountShowcaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161922',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  accountIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  accountCardSub: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  accountCardBal: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  accountCardStatus: {
    color: '#F48B8B',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  transferDemonstrationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(157, 198, 235, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 4,
  },
  transferDemoText: {
    color: '#9DC6EB',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  // Moment 3 Ledger
  ledgerShowcaseCard: {
    width: '100%',
    backgroundColor: '#161922',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 10,
  },
  searchBarDemo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1C202B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  searchBarText: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  txRowDemo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  txIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitleDemo: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  txMetaDemo: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  txAmountExpense: {
    color: '#F48B8B',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  txAmountIncome: {
    color: '#70D6BC',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  txAccountPill: {
    color: '#8E919D',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  // Moment 4 Splits
  splitFolderShowcase: {
    width: '100%',
    backgroundColor: '#161922',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    gap: 10,
  },
  splitFolderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitFolderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  splitFolderBadgeText: {
    color: '#FF9D66',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  splitFolderTotal: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  splitFolderName: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  splitFolderSubtitle: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 15,
  },
  splitParticipantsList: {
    gap: 6,
    marginTop: 6,
  },
  splitParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C202B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  interactiveParticipantRow: {
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    flex: 1,
  },
  participantShare: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 15,
    marginRight: 10,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(112, 214, 188, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  settledBadgeText: {
    color: '#70D6BC',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: 'rgba(255, 157, 102, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  pendingBadgeText: {
    color: '#FF9D66',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  // Moment 5 Subscriptions & Heatmap
  subHeatStack: {
    width: '100%',
    gap: 12,
  },
  subCardDemo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161922',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  subIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  subCardDue: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  subCardPrice: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  subCardAnnual: {
    color: '#8E919D',
    fontSize: 9,
    lineHeight: 12,
    marginTop: 2,
  },
  heatCardDemo: {
    backgroundColor: '#161922',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 10,
  },
  heatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heatCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heatCardBadgeText: {
    color: '#FB7185',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  heatStreakText: {
    color: '#FB7185',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  heatMatrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'space-between',
  },
  heatMatrixCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  // Moment 6 Importer
  importerShowcaseCard: {
    width: '100%',
    backgroundColor: '#161922',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 12,
  },
  importerDocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  importerDocIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(112, 214, 188, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importerDocName: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  importerDocMeta: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  privacyShieldTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  privacyShieldTagText: {
    color: '#70D6BC',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
  },
  reconciliationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(112, 214, 188, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  reconciliationPillText: {
    color: '#70D6BC',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  importerFeaturesList: {
    gap: 4,
    paddingTop: 4,
  },
  importerFeatureItem: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
  },
  // Moment 7 Profile Scrollable Stage
  profileScrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 18,
  },
  profileHeaderBlock: {
    gap: 6,
  },
  profileShowcaseCard: {
    backgroundColor: '#161922',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    gap: 14,
  },
  profileAvatarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF9D66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#0E1015',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  profilePreviewName: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  profilePreviewEmail: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  profilePrivacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profilePrivacyText: {
    color: '#70D6BC',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    flex: 1,
  },
  profileInputsContainer: {
    gap: 12,
    marginTop: 4,
  },
  profileInputGroup: {
    gap: 5,
  },
  profileInputLabel: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  profileInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C202B',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileTextInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
  },
  profileActionContainer: {
    gap: 10,
    marginTop: 6,
  },
  nameRequiredPrompt: {
    color: '#F48B8B',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Bottom Deck (Moments 0 to 5)
  bottomDeck: {
    paddingHorizontal: 24,
    gap: 14,
  },
  momentHeadline: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  momentSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  actionsBar: {
    marginTop: 6,
  },
  setupActionGroup: {
    gap: 10,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionDisabled: {
    backgroundColor: '#252936',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryActionText: {
    color: '#0E1015',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  maybeLaterButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  maybeLaterText: {
    color: '#8E919D',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  // Budget Modal
  budgetModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  budgetModalCard: {
    width: '100%',
    backgroundColor: '#161922',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    gap: 14,
  },
  budgetModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  budgetModalSub: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  budgetPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  budgetSelectPill: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1C202B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  budgetSelectPillText: {
    color: '#FBBF24',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  budgetCancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  budgetCancelBtnText: {
    color: '#8E919D',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
});
