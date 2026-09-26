import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  useWindowDimensions,
  LayoutAnimation,
  UIManager,
  Keyboard,
} from 'react-native';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Share2,
  Lock,
  Plus,
  Star,
  ShoppingBag,
  Tv,
  Heart,
  Banknote,
  Car,
  Zap,
  MoreHorizontal,
  UtensilsCrossed,
  Check,
  X,
  Search,
  Home,
  Plane,
  Gift,
  BookOpen,
  Music,
  Gamepad2,
  Camera,
  Wrench,
  Leaf,
  Coffee,
  Shield,
  ShieldCheck,
  Tag,
  Sparkles,
  Smile,
  Briefcase,
  Laptop,
  Flame,
  Coins,
  Activity,
  Wifi,
  Smartphone,
  PiggyBank,
  Trash2,
  Cigarette,
  Repeat,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { AppText, ProfileAvatar } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { FixedBottomNav } from './FixedBottomNav';
import { expenseColors } from '@/constants/expenseColors';
import { CURRENCIES } from '@/constants';
import { ExpenseCategory } from '@/types/expense';
import { CategoryIcon, getCategoryBgColor } from './CategoryIcon';
import { AppWalkthroughModal } from './AppWalkthroughModal';
import {
  convertCurrency,
  getCachedExchangeRatesData,
  FALLBACK_EXCHANGE_RATES,
} from '@/utils/currency';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TILE_HEIGHT = 42;
const TILE_GAP = 8;
const ROW_GAP = 10;
const ROW_HEIGHT = 68; // TILE_HEIGHT (42) + marginTop (4) + text (12) + ROW_GAP (10)

const customSpringLayout = {
  duration: 280,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.78,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

// Rich collection of icons for categories
const AVAILABLE_ICONS = [
  { name: 'Cigarette', component: Cigarette },
  { name: 'ShoppingBag', component: ShoppingBag },
  { name: 'Tv', component: Tv },
  { name: 'Repeat', component: Repeat },
  { name: 'Heart', component: Heart },
  { name: 'Banknote', component: Banknote },
  { name: 'Car', component: Car },
  { name: 'Zap', component: Zap },
  { name: 'UtensilsCrossed', component: UtensilsCrossed },
  { name: 'MoreHorizontal', component: MoreHorizontal },
  { name: 'Coins', component: Coins },
  { name: 'Star', component: Star },
  { name: 'Home', component: Home },
  { name: 'Plane', component: Plane },
  { name: 'Gift', component: Gift },
  { name: 'Coffee', component: Coffee },
  { name: 'Gamepad2', component: Gamepad2 },
  { name: 'Music', component: Music },
  { name: 'BookOpen', component: BookOpen },
  { name: 'Briefcase', component: Briefcase },
  { name: 'Laptop', component: Laptop },
  { name: 'PiggyBank', component: PiggyBank },
  { name: 'Flame', component: Flame },
  { name: 'Shield', component: Shield },
  { name: 'Leaf', component: Leaf },
  { name: 'Tag', component: Tag },
  { name: 'Sparkles', component: Sparkles },
];

// Rich warm pastel palette for custom categories
const AVAILABLE_COLORS = [
  '#F8A888', // Warm Peach
  '#F39C94', // Warm Coral
  '#EFA2A2', // Dusty Rose
  '#F2AEC4', // Soft Blush
  '#D6AEE0', // Warm Lavender
  '#C4A7E7', // Soft Lilac
  '#A8B8E8', // Periwinkle
  '#9DC6EB', // Powder Sky
  '#82D0D8', // Seafoam Teal
  '#8CD9C8', // Warm Mint
  '#A3D6B2', // Sage Celadon
  '#F4CD89', // Warm Buttercream
  '#E5B299', // Warm Sand
  '#A2AEBB', // Warm Slate
];

export const ExpenseSettings: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  const {
    monthlyBudget,
    currencySymbol,
    currencyCode,
    categories,
    transactions,
    categoryBudgets,
    setCurrency,
    convertAllCurrencies: convertExpenseCurrencies,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    resetAllData,
  } = useExpenseStore();

  const { userName, userEmail, userAvatarId, setCurrencyCode } = useSettingsStore();
  const { convertAllCurrencies } = useSubscriptionStore();

  const scrollRef = useRef<ScrollView>(null);

  // Grid width measurement to ensure exactly 3 columns with tight spacing
  const [gridMeasuredWidth, setGridMeasuredWidth] = useState(0);
  const baseWidth = gridMeasuredWidth > 0 ? gridMeasuredWidth : screenWidth - 60;
  const tileWidth = Math.floor((baseWidth - 2 * TILE_GAP) / 3);

  // Category Edit / Add State
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [isDraggingAnyTile, setIsDraggingAnyTile] = useState(false);

  // Exit category edit mode when switching tabs or unfocusing
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsEditingCategories(false);
        setIsDraggingAnyTile(false);
      };
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setIsEditingCategories(false);
      setIsDraggingAnyTile(false);
    });
    return unsubscribe;
  }, [navigation]);

  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_EXCHANGE_RATES);

  useEffect(() => {
    getCachedExchangeRatesData()
      .then((data) => {
        if (data?.rates) setRates(data.rates);
      })
      .catch(() => {});
  }, []);

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Star');
  const [selectedColor, setSelectedColor] = useState('#F8A888');
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);

  // Currency Picker State
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  // ── Glitch-free Animated Values for Currency Modal ──
  const currencyTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const currencyBackdropOpacity = useRef(new Animated.Value(0)).current;

  // ── Glitch-free Animated Values for Category Modal ──
  const categoryTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const categoryBackdropOpacity = useRef(new Animated.Value(0)).current;

  // Settings Cards Animated Values
  const animHeader = useRef(new Animated.Value(1)).current;
  const animCurrency = useRef(new Animated.Value(1)).current;
  const animCategories = useRef(new Animated.Value(1)).current;
  const animBudget = useRef(new Animated.Value(1)).current;
  const animData = useRef(new Animated.Value(1)).current;
  const animProfile = useRef(new Animated.Value(1)).current;

  const currentCurrency = useMemo(() => {
    return (
      CURRENCIES.find((c) => c.code === currencyCode) || {
        code: currencyCode || 'INR',
        symbol: currencySymbol || '₹',
        name: 'Indian Rupee',
        flag: '🇮🇳',
      }
    );
  }, [currencyCode, currencySymbol]);

  const customBudgetCount = useMemo(() => {
    return Object.values(categoryBudgets || {}).filter((v) => v > 0).length;
  }, [categoryBudgets]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  // ── Glitch-free Currency Modal Open & Close ──
  const openCurrencyModal = useCallback(() => {
    Haptics.selectionAsync();
    setCurrencySearch('');
    currencyTranslateY.setValue(screenHeight);
    currencyBackdropOpacity.setValue(0);
    setIsCurrencyModalVisible(true);
    Animated.parallel([
      Animated.timing(currencyBackdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(currencyTranslateY, {
        toValue: 0,
        damping: 24,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currencyBackdropOpacity, currencyTranslateY, screenHeight]);

  const closeCurrencyModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(currencyBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(currencyTranslateY, {
        toValue: screenHeight,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsCurrencyModalVisible(false);
    });
  }, [currencyBackdropOpacity, currencyTranslateY, screenHeight]);

  // ── Swipe-down PanResponder for Currency Modal ──
  const currencyPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            currencyTranslateY.setValue(gesture.dy);
            const fade = Math.max(0, 1 - gesture.dy / 250);
            currencyBackdropOpacity.setValue(fade);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 70 || gesture.vy > 0.5) {
            Haptics.selectionAsync();
            closeCurrencyModal();
          } else {
            Animated.parallel([
              Animated.spring(currencyTranslateY, {
                toValue: 0,
                bounciness: 4,
                useNativeDriver: true,
              }),
              Animated.timing(currencyBackdropOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [currencyBackdropOpacity, currencyTranslateY, closeCurrencyModal]
  );

  // ── Glitch-free Category Modal Open & Close ──
  const openCategoryModal = useCallback(
    (cat?: ExpenseCategory) => {
      Haptics.selectionAsync();
      if (cat) {
        setEditingCategoryId(cat.id);
        setCategoryName(cat.name);
        setSelectedIcon(cat.iconName || 'Star');
        setSelectedColor(cat.color || '#F8A888');
      } else {
        setEditingCategoryId(null);
        setCategoryName('');
        setSelectedIcon('Star');
        setSelectedColor('#F8A888');
      }
      categoryTranslateY.setValue(screenHeight);
      categoryBackdropOpacity.setValue(0);
      setIsCategoryModalVisible(true);
      Animated.parallel([
        Animated.timing(categoryBackdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(categoryTranslateY, {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [categoryBackdropOpacity, categoryTranslateY, screenHeight]
  );

  const closeCategoryModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(categoryBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(categoryTranslateY, {
        toValue: screenHeight,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsCategoryModalVisible(false);
    });
  }, [categoryBackdropOpacity, categoryTranslateY, screenHeight]);

  // ── Swipe-down PanResponder for Category Modal ──
  const categoryPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            categoryTranslateY.setValue(gesture.dy);
            const fade = Math.max(0, 1 - gesture.dy / 250);
            categoryBackdropOpacity.setValue(fade);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 70 || gesture.vy > 0.5) {
            Haptics.selectionAsync();
            closeCategoryModal();
          } else {
            Animated.parallel([
              Animated.spring(categoryTranslateY, {
                toValue: 0,
                bounciness: 4,
                useNativeDriver: true,
              }),
              Animated.timing(categoryBackdropOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [categoryBackdropOpacity, categoryTranslateY, closeCategoryModal]
  );

  const handleSelectCurrency = async (item: { code: string; symbol: string; name: string }) => {
    Haptics.selectionAsync();
    const oldCode = currencyCode || 'INR';
    try {
      await Promise.all([
        convertAllCurrencies(oldCode, item.code),
        convertExpenseCurrencies(oldCode, item.code, item.symbol),
        setCurrencyCode(item.code),
      ]);
    } catch (err) {
      console.warn('Currency conversion failed, continuing without converting balances:', err);
      await setCurrencyCode(item.code);
      setCurrency(item.code, item.symbol);
    }
    closeCurrencyModal();
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(customSpringLayout);

    if (editingCategoryId) {
      updateCategory(editingCategoryId, {
        name: categoryName.trim(),
        iconName: selectedIcon,
        color: selectedColor,
      });
    } else {
      addCategory({
        name: categoryName.trim(),
        iconName: selectedIcon,
        color: selectedColor,
      });
    }
    closeCategoryModal();
  };

  const handleInstantDeleteCategory = (catId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(customSpringLayout);
    deleteCategory(catId);
  };

  const handleSmoothReorder = (fromIdx: number, toIdx: number) => {
    reorderCategories(fromIdx, toIdx);
  };

  const handleEraseAllData = () => {
    Alert.alert(
      'Erase All Expense Data',
      'This permanently removes every transaction, account, category, budget and vault. The audit log is intentionally kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Everything',
          style: 'destructive',
          onPress: () => {
            resetAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getTileBgColor = (color: string) => {
    return getCategoryBgColor(color, '28');
  };

  const renderCategoryTileIcon = (iconName?: string, catId?: string, catColor?: string) => {
    return (
      <CategoryIcon
        iconName={iconName}
        catId={catId}
        color={catColor}
        size={18}
        strokeWidth={2}
        fill={true}
      />
    );
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary, zIndex: 10 }} />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        scrollEnabled={!isDraggingAnyTile}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 8,
            paddingBottom: insets.bottom + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.headerContainer,
            {
              opacity: animHeader,
              transform: [
                {
                  translateY: animHeader.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <AppText style={styles.headerTitle}>SETTINGS</AppText>
        </Animated.View>

        {/* 2. Currency Card */}
        <Animated.View
          style={{
            marginTop: 16,
            opacity: animCurrency,
            transform: [
              {
                translateY: animCurrency.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.7}
            onPress={openCurrencyModal}
          >
            <View style={styles.cardRowBetween}>
              <View>
                <AppText style={styles.cardTitle}>CURRENCY</AppText>
                <AppText style={styles.settingMainValue}>
                  {currentCurrency.symbol} {currentCurrency.code} — {currentCurrency.name}
                </AppText>
                <AppText style={styles.settingSubValue}>
                  Preview: {currentCurrency.symbol}12,345
                </AppText>
              </View>
              <ChevronRight size={18} color={expenseColors.textSubtle} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* 3. Compact Categories Card (Reduced Height, Compact Spacing, Hold & Drag) */}
        <Animated.View
          style={[
            styles.categoriesCard,
            {
              opacity: animCategories,
              transform: [
                {
                  translateY: animCategories.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.categoriesCardHeader}>
            <View>
              <AppText style={styles.cardTitleCompact}>CATEGORIES</AppText>
              {isEditingCategories && (
                <AppText style={styles.reorderHint}>Hold & drag to re-order</AppText>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setIsEditingCategories(!isEditingCategories);
              }}
              activeOpacity={0.7}
            >
              <AppText
                style={[
                  styles.editActionText,
                  isEditingCategories && styles.doneActionText,
                ]}
              >
                {isEditingCategories ? 'DONE' : 'EDIT'}
              </AppText>
            </TouchableOpacity>
          </View>

          <View
            style={styles.categoriesGrid}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - gridMeasuredWidth) > 2) {
                setGridMeasuredWidth(w);
              }
            }}
          >
            <DraggableCategoriesGrid
              categories={categories}
              tileWidth={tileWidth}
              isEditing={isEditingCategories}
              getTileBgColor={getTileBgColor}
              renderIcon={renderCategoryTileIcon}
              onOpenEdit={openCategoryModal}
              onInstantDelete={handleInstantDeleteCategory}
              onReorder={handleSmoothReorder}
              openCategoryModal={() => openCategoryModal()}
              setIsDraggingAny={setIsDraggingAnyTile}
            />
          </View>
        </Animated.View>

        {/* 4. Monthly Budget Card */}
        <Animated.View
          style={{
            opacity: animBudget,
            transform: [
              {
                translateY: animBudget.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.7}
            onPress={() => router.push('/settings/budget')}
          >
            <View style={styles.cardRowBetween}>
              <View>
                <AppText style={styles.cardTitle}>MONTHLY BUDGET</AppText>
                <AppText style={styles.settingMainValue}>
                  {`${currentCurrency.symbol}${monthlyBudget.toLocaleString('en-IN')}`}
                </AppText>
                <AppText style={styles.settingSubValue}>
                  {customBudgetCount} {customBudgetCount === 1 ? 'category' : 'categories'} with custom budgets
                </AppText>
              </View>
              <ChevronRight size={18} color={expenseColors.textSubtle} />
            </View>
          </TouchableOpacity>
        </Animated.View>


        <Animated.View
          style={{
            opacity: animData,
            transform: [
              {
                translateY: animData.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.7}
            onPress={() => router.push('/settings/data')}
          >
            <View style={styles.cardRowBetween}>
              <View style={styles.iconRowLeft}>
                <View style={styles.orangeIconCircle}>
                  <Lock size={16} color={expenseColors.accentPeach} />
                </View>
                <View>
                  <AppText style={styles.cardTitle}>YOUR DATA</AppText>
                  <AppText style={styles.settingSubValue}>
                    How your data is stored and secured
                  </AppText>
                </View>
              </View>
              <ChevronRight size={18} color={expenseColors.textSubtle} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* 7. Redesigned Premium Profile Card */}
        <Animated.View
          style={[
            styles.profileCardContainer,
            {
              opacity: animProfile,
              transform: [
                {
                  translateY: animProfile.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.profileCardPressable}
            activeOpacity={0.78}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/settings/personalization');
            }}
          >
            {/* Avatar Focal Point with Frosted Glow Border */}
            <View style={styles.avatarFocalWrapper}>
              <ProfileAvatar
                avatarId={userAvatarId}
                name={userName}
                size={54}
                showBorder={true}
              />
              <View style={styles.avatarPrivateBadge}>
                <ShieldCheck size={10} color="#70D6BC" strokeWidth={2.5} />
              </View>
            </View>

            {/* Profile Hierarchy Info */}
            <View style={styles.profileMetaCol}>
              <View style={styles.profileHeaderLine}>
                <AppText style={styles.profileNamePrimary} numberOfLines={1}>
                  {userName.trim() || 'Personal Vault'}
                </AppText>
                <View style={styles.profileTypeBadge}>
                  <AppText style={styles.profileTypeBadgeText}>LOCAL</AppText>
                </View>
              </View>

              <AppText style={styles.profileEmailSub} numberOfLines={1}>
                {userEmail.trim() || '100% on-device & private'}
              </AppText>

              <View style={styles.profileActionPromptRow}>
                <AppText style={styles.profileActionPromptText}>
                  Personalization & Avatar
                </AppText>
              </View>
            </View>

            {/* Subtle Chevron Action Affordance */}
            <View style={styles.profileChevronCircle}>
              <ChevronRight size={15} color="#A2AEBB" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ══════════════════════════════════════════════
          ADD / EDIT CATEGORY MODAL (GLITCH-FREE)
      ══════════════════════════════════════════════ */}
      <Modal
        visible={isCategoryModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: categoryBackdropOpacity },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeCategoryModal}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [{ translateY: categoryTranslateY }],
                maxHeight: '88%',
                paddingBottom: 0,
              },
            ]}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              style={{ backgroundColor: '#1A1D23' }}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 40, backgroundColor: '#1A1D23' }}
            >
            {/* Gesture Handle Bar Area (Swipe down anywhere here closes like iPhone) */}
            <View {...categoryPanResponder.panHandlers} style={styles.dragHeaderArea}>
              <View style={styles.sheetHandle} />
              <AppText style={styles.modalTitle}>
                {editingCategoryId ? 'EDIT CATEGORY' : 'NEW CATEGORY'}
              </AppText>
              <AppText style={styles.dragHintSub}>Swipe down to dismiss</AppText>
            </View>

            {/* Category Name Input */}
            <View style={styles.inputContainer}>
              <TextInput
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Category name"
                placeholderTextColor="#5A5E6D"
                style={styles.textInput}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            {/* Icon Picker Section */}
            <AppText style={styles.sectionHeading}>ICON</AppText>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.slice(0, 12).map((iconItem) => {
                const isSelected = selectedIcon === iconItem.name;
                const IconComp = iconItem.component;
                return (
                  <TouchableOpacity
                    key={iconItem.name}
                    style={[
                      styles.iconSelectBox,
                      isSelected && styles.iconSelectBoxActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedIcon(iconItem.name)}
                  >
                    <IconComp
                      size={20}
                      color="#FFFFFF"
                      fill={iconItem.name === 'Star' && isSelected ? '#FFFFFF' : 'none'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color Picker Section */}
            <AppText style={styles.sectionHeading}>COLOR</AppText>
            <View style={styles.colorPalette}>
              {AVAILABLE_COLORS.map((col) => {
                const isSelected = selectedColor === col;
                return (
                  <TouchableOpacity
                    key={col}
                    style={[styles.colorCircle, { backgroundColor: col }]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedColor(col)}
                  >
                    {isSelected && (
                      <Check size={16} color="#FFFFFF" strokeWidth={3} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.85}
              onPress={handleSaveCategory}
            >
              <AppText style={styles.submitBtnText}>
                {editingCategoryId ? 'Save Category' : 'Create Category'}
              </AppText>
            </TouchableOpacity>

            {/* Delete button if editing */}
            {editingCategoryId && (
              <TouchableOpacity
                style={styles.deleteCategoryBtn}
                activeOpacity={0.8}
                onPress={() => {
                  handleInstantDeleteCategory(editingCategoryId);
                  closeCategoryModal();
                }}
              >
                <Trash2 size={16} color={expenseColors.accentRed} strokeWidth={2.2} />
                <AppText style={styles.deleteCategoryBtnText}>
                  Delete Category
                </AppText>
              </TouchableOpacity>
            )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════
          CURRENCY PICKER MODAL (GLITCH-FREE SWIPE DOWN)
      ══════════════════════════════════════════════ */}
      <Modal
        visible={isCurrencyModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeCurrencyModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: currencyBackdropOpacity },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeCurrencyModal}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [{ translateY: currencyTranslateY }],
                maxHeight: '82%',
                paddingBottom: 0,
              },
            ]}
          >
            {/* Gesture Handle Bar Area (Swipe down anywhere here closes like iPhone) */}
            <View {...currencyPanResponder.panHandlers} style={styles.dragHeaderArea}>
              <View style={styles.sheetHandle} />
              <AppText style={styles.modalTitle}>SELECT CURRENCY</AppText>
              <AppText style={styles.dragHintSub}>Swipe down to dismiss</AppText>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Search size={16} color="#8E919D" />
              <TextInput
                value={currencySearch}
                onChangeText={setCurrencySearch}
                placeholder="Search currency..."
                placeholderTextColor="#5A5E6D"
                style={styles.searchInput}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {currencySearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCurrencySearch('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <X size={15} color="#8E919D" />
                </TouchableOpacity>
              )}
            </View>

            {/* Currencies List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => Keyboard.dismiss()}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24, backgroundColor: '#1A1D23' }}
              style={{ backgroundColor: '#1A1D23' }}
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
              {filteredCurrencies.map((item) => {
                const isSelected = currencyCode === item.code;
                const activeCode = currencyCode || 'INR';
                const activeCurObj = CURRENCIES.find((c) => c.code === activeCode) || CURRENCIES[0];
                const baseAmt = ['JPY', 'KRW', 'IDR', 'VND'].includes(activeCode)
                  ? 10000
                  : ['INR', 'RUB', 'THB', 'ZAR', 'BRL'].includes(activeCode)
                  ? 1000
                  : 100;
                const sampleConverted = convertCurrency(baseAmt, activeCode, item.code, rates);
                let sampleRateStr = '';
                if (item.code === activeCode) {
                  sampleRateStr = 'Active';
                } else if (sampleConverted > 0) {
                  const formattedAmt = sampleConverted < 1
                    ? sampleConverted.toFixed(3)
                    : sampleConverted < 100
                    ? sampleConverted.toFixed(2)
                    : Math.round(sampleConverted).toLocaleString();
                  sampleRateStr = `${activeCurObj.symbol}${baseAmt.toLocaleString()} ≈ ${item.symbol}${formattedAmt}`;
                }

                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[
                      styles.currencyItemRow,
                      isSelected && styles.currencyItemRowSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectCurrency(item)}
                  >
                    <View style={styles.currencyLeftCol}>
                      <AppText style={styles.currencyFlag}>{item.flag}</AppText>
                      <View>
                        <AppText
                          style={[
                            styles.currencyNameText,
                            isSelected && styles.currencyNameActive,
                          ]}
                        >
                          {item.name}
                        </AppText>
                        <AppText style={styles.currencyCodeSub}>
                          {item.code} · {item.symbol} {sampleRateStr ? `· ${sampleRateStr}` : ''}
                        </AppText>
                      </View>
                    </View>
                    {isSelected && (
                      <Check
                        size={18}
                        color={expenseColors.accentPeach}
                        strokeWidth={2.5}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* App Feature Walkthrough Modal */}
      <AppWalkthroughModal
        visible={showWalkthroughModal}
        onClose={() => setShowWalkthroughModal(false)}
      />


    </View>
  );
};

// ── Draggable Categories Grid with Smooth Slide Transitions & Fluid Drop ──
interface DraggableCategoriesGridProps {
  categories: ExpenseCategory[];
  tileWidth: number;
  isEditing: boolean;
  getTileBgColor: (color: string) => string;
  renderIcon: (iconName?: string, catId?: string, catColor?: string) => React.ReactNode;
  onOpenEdit: (cat: ExpenseCategory) => void;
  onInstantDelete: (id: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  openCategoryModal: () => void;
  setIsDraggingAny: (val: boolean) => void;
}

const DraggableCategoriesGrid: React.FC<DraggableCategoriesGridProps> = ({
  categories,
  tileWidth,
  isEditing,
  getTileBgColor,
  renderIcon,
  onOpenEdit,
  onInstantDelete,
  onReorder,
  openCategoryModal,
  setIsDraggingAny,
}) => {
  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);

  // Animated values for the dragged item
  const dragPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;

  // Animated displacement for all other items shifting dynamically
  const shiftAnims = useRef<{ [id: string]: Animated.ValueXY }>({});
  categories.forEach((cat) => {
    if (!shiftAnims.current[cat.id]) {
      shiftAnims.current[cat.id] = new Animated.ValueXY({ x: 0, y: 0 });
    }
  });

  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const dragOriginIndexRef = useRef<number>(0);
  const hoverIndexRef = useRef<number | null>(null);
  const isDraggingActiveRef = useRef<boolean>(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const getTargetSlot = useCallback(
    (origIdx: number, dx: number, dy: number) => {
      const origCol = origIdx % 3;
      const origRow = Math.floor(origIdx / 3);

      const fingerCenterX = origCol * (tileWidth + TILE_GAP) + dx + tileWidth / 2;
      const fingerCenterY = origRow * ROW_HEIGHT + dy + TILE_HEIGHT / 2;

      let targetCol = Math.floor(fingerCenterX / (tileWidth + TILE_GAP));
      if (targetCol < 0) targetCol = 0;
      if (targetCol > 2) targetCol = 2;

      let targetRow = Math.floor(fingerCenterY / ROW_HEIGHT);
      if (targetRow < 0) targetRow = 0;

      let targetSlot = targetRow * 3 + targetCol;
      if (targetSlot < 0) targetSlot = 0;
      if (targetSlot >= categoriesRef.current.length) {
        targetSlot = categoriesRef.current.length - 1;
      }

      return targetSlot;
    },
    [tileWidth]
  );

  const createPanResponder = useCallback(
    (cat: ExpenseCategory, index: number) => {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => isEditing,
        onMoveShouldSetPanResponder: () => isEditing && isDraggingActiveRef.current,

        onPanResponderGrant: () => {
          if (!isEditing) return;
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
          }
          // 170ms hold triggers lift and reorder mode
          holdTimerRef.current = setTimeout(() => {
            isDraggingActiveRef.current = true;
            dragOriginIndexRef.current = index;
            hoverIndexRef.current = index;
            setDraggingCatId(cat.id);
            setIsDraggingAny(true);
            dragPan.setValue({ x: 0, y: 0 });

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            Animated.spring(dragScale, {
              toValue: 1.12,
              damping: 18,
              stiffness: 280,
              useNativeDriver: true,
            }).start();
          }, 170);
        },

        onPanResponderMove: (_, gesture) => {
          if (!isEditing) return;

          if (!isDraggingActiveRef.current) {
            if (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8) {
              if (holdTimerRef.current) {
                clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
              }
            }
            return;
          }

          // Move the active dragged tile directly
          dragPan.setValue({ x: gesture.dx, y: gesture.dy });

          // Calculate hovered slot
          const origIdx = dragOriginIndexRef.current;
          const targetSlot = getTargetSlot(origIdx, gesture.dx, gesture.dy);

          if (targetSlot !== hoverIndexRef.current) {
            hoverIndexRef.current = targetSlot;
            Haptics.selectionAsync();

            // Smoothly shift all other tiles to clear a spot
            categoriesRef.current.forEach((c, idx) => {
              if (c.id === cat.id) return;

              let vSlot = idx;
              if (origIdx < targetSlot) {
                if (idx > origIdx && idx <= targetSlot) {
                  vSlot = idx - 1;
                }
              } else if (origIdx > targetSlot) {
                if (idx >= targetSlot && idx < origIdx) {
                  vSlot = idx + 1;
                }
              }

              const fromCol = idx % 3;
              const fromRow = Math.floor(idx / 3);
              const toCol = vSlot % 3;
              const toRow = Math.floor(vSlot / 3);

              const shiftX = (toCol - fromCol) * (tileWidth + TILE_GAP);
              const shiftY = (toRow - fromRow) * ROW_HEIGHT;

              const anim = shiftAnims.current[c.id];
              if (anim) {
                Animated.spring(anim, {
                  toValue: { x: shiftX, y: shiftY },
                  damping: 24,
                  stiffness: 300,
                  mass: 0.6,
                  useNativeDriver: true,
                }).start();
              }
            });
          }
        },

        onPanResponderRelease: (_, gesture) => {
          if (!isEditing) return;

          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }

          if (isDraggingActiveRef.current) {
            isDraggingActiveRef.current = false;
            const fromIdx = dragOriginIndexRef.current;
            const toIdx = hoverIndexRef.current ?? fromIdx;

            const origCol = fromIdx % 3;
            const origRow = Math.floor(fromIdx / 3);
            const dropCol = toIdx % 3;
            const dropRow = Math.floor(toIdx / 3);

            const dropTargetX = (dropCol - origCol) * (tileWidth + TILE_GAP);
            const dropTargetY = (dropRow - origRow) * ROW_HEIGHT;

            // Fluid spring drop right into vacant slot!
            Animated.parallel([
              Animated.spring(dragPan, {
                toValue: { x: dropTargetX, y: dropTargetY },
                damping: 24,
                stiffness: 320,
                mass: 0.7,
                useNativeDriver: true,
              }),
              Animated.spring(dragScale, {
                toValue: 1,
                damping: 22,
                stiffness: 300,
                useNativeDriver: true,
              }),
            ]).start(() => {
              // Reset animated values synchronously first to avoid flash on re-render
              dragPan.setValue({ x: 0, y: 0 });
              Object.values(shiftAnims.current).forEach((a) => a.setValue({ x: 0, y: 0 }));
              setDraggingCatId(null);
              hoverIndexRef.current = null;
              setIsDraggingAny(false);

              if (fromIdx !== toIdx) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Use requestAnimationFrame to let the reset render flush before
                // triggering the store reorder (prevents visible flash)
                requestAnimationFrame(() => {
                  onReorder(fromIdx, toIdx);
                });
              }
            });
          } else {
            // Quick tap without holding opens edit modal
            const dist = Math.sqrt(gesture.dx * gesture.dx + gesture.dy * gesture.dy);
            if (dist < 8) {
              onOpenEdit(cat);
            }
          }
        },

        onPanResponderTerminate: () => {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          if (isDraggingActiveRef.current) {
            isDraggingActiveRef.current = false;
            Animated.parallel([
              Animated.spring(dragPan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
              Animated.spring(dragScale, { toValue: 1, useNativeDriver: true }),
              ...Object.values(shiftAnims.current).map((a) =>
                Animated.spring(a, { toValue: { x: 0, y: 0 }, useNativeDriver: true })
              ),
            ]).start(() => {
              dragPan.setValue({ x: 0, y: 0 });
              Object.values(shiftAnims.current).forEach((a) => a.setValue({ x: 0, y: 0 }));
              setDraggingCatId(null);
              hoverIndexRef.current = null;
              setIsDraggingAny(false);
            });
          }
        },
      });
    },
    [dragPan, dragScale, getTargetSlot, isEditing, onOpenEdit, onReorder, setIsDraggingAny, tileWidth]
  );

  const panResponders = useMemo(() => {
    return categories.map((cat, index) => createPanResponder(cat, index));
  }, [categories, createPanResponder]);

  return (
    <>
      {categories.map((cat, index) => {
        const isCurrentDragging = draggingCatId === cat.id;
        const shiftAnim = shiftAnims.current[cat.id];

        return (
          <Animated.View
            key={cat.id}
            style={[
              {
                width: tileWidth,
                alignItems: 'center',
                zIndex: isCurrentDragging ? 9999 : 1,
                elevation: isCurrentDragging ? 20 : 0,
              },
              isCurrentDragging
                ? {
                    transform: [
                      { translateX: dragPan.x },
                      { translateY: dragPan.y },
                      { scale: dragScale },
                    ],
                  }
                : {
                    transform: [
                      { translateX: shiftAnim ? shiftAnim.x : 0 },
                      { translateY: shiftAnim ? shiftAnim.y : 0 },
                    ],
                  },
            ]}
            {...(isEditing ? panResponders[index]?.panHandlers : {})}
          >
            <View
              style={[
                styles.categoryTile,
                { backgroundColor: getTileBgColor(cat.color) },
                isEditing && styles.categoryTileEditing,
                isCurrentDragging && styles.categoryTileDragging,
              ]}
            >
              {renderIcon(cat.iconName, cat.id, cat.color)}

              {/* Red Cross Badge for Instant Delete in Edit Mode */}
              {isEditing && (
                <TouchableOpacity
                  style={styles.deleteCrossBadge}
                  activeOpacity={0.8}
                  onPress={(e) => {
                    e.stopPropagation();
                    onInstantDelete(cat.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={9} color="#FFFFFF" strokeWidth={2.8} />
                </TouchableOpacity>
              )}
            </View>

            <AppText style={styles.categoryTileName} numberOfLines={1}>
              {cat.name.toUpperCase()}
            </AppText>
          </Animated.View>
        );
      })}

      {/* Add New Category Tile (Placed Directly Beside Income / Last Item) */}
      <View style={{ width: tileWidth, alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.addCategoryTile}
          activeOpacity={0.75}
          onPress={openCategoryModal}
        >
          <Plus size={16} color="#8E919D" strokeWidth={2} />
        </TouchableOpacity>
        <AppText style={styles.categoryTileName}>ADD NEW</AppText>
      </View>
    </>
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
  headerTitle: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  cardContainer: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  cardTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  cardRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orangeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingMainValue: {
    color: expenseColors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingSubValue: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  themeTileCol: {
    alignItems: 'center',
    width: '22%',
  },
  themeTile: {
    width: '100%',
    height: 60,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  themePreviewLine1: {
    height: 4,
    width: '60%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
  },
  themePreviewLine2: {
    height: 4,
    width: '40%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
  },
  themeLabel: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  themeSelectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: expenseColors.accentPeach,
  },
  dotPlaceholder: {
    width: 6,
    height: 6,
  },
  editActionText: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.0,
  },
  doneActionText: {
    color: expenseColors.accentPeach,
  },

  // ── Dedicated Compact Categories Card (Reduced Height & Tight Spacing) ──
  categoriesCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  categoriesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleCompact: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  reorderHint: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    columnGap: TILE_GAP,
    rowGap: 10,
  },
  categoryTile: {
    width: '100%',
    height: TILE_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryTileEditing: {
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.35)',
  },
  categoryTileDragging: {
    borderColor: expenseColors.accentPeach,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  addCategoryTile: {
    width: '100%',
    height: TILE_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#323642',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileName: {
    color: '#8E919D',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
  deleteCrossBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: expenseColors.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1.2,
    borderColor: '#16171E',
  },
  incomeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },

  // ── Redesigned Premium Profile Card Styles ──
  profileCardContainer: {
    backgroundColor: '#16171E',
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  profileCardPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  avatarFocalWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPrivateBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16171E',
    borderWidth: 1.2,
    borderColor: 'rgba(112, 214, 188, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMetaCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  profileHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileNamePrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  profileTypeBadge: {
    backgroundColor: 'rgba(112, 214, 188, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(112, 214, 188, 0.3)',
  },
  profileTypeBadgeText: {
    color: '#70D6BC',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  profileEmailSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  profileActionPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  profileActionPromptText: {
    color: expenseColors.accentPeach,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  profileChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },
  destructiveActionRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  destructiveActionText: {
    color: expenseColors.accentRed,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },

  // Modal Common Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    backgroundColor: '#1A1D23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHeaderArea: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 2,
  },
  dragHintSub: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    backgroundColor: '#232633',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  sectionHeading: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 8,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  iconSelectBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelectBoxActive: {
    backgroundColor: '#353948',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: expenseColors.accentPeach,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: '#0F1015',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 139, 139, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 139, 139, 0.3)',
    marginTop: 12,
  },
  deleteCategoryBtnText: {
    color: expenseColors.accentRed,
    fontSize: 15,
    fontWeight: '700',
  },

  // Currency Search & Rows
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232633',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 8,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  currencyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  currencyItemRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
  },
  currencyLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currencyFlag: {
    fontSize: 24,
  },
  currencyNameText: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  currencyNameActive: {
    color: expenseColors.accentPeach,
  },
  currencyCodeSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
  },
});
