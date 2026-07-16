import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Keyboard,
  Platform,
  Animated,
  type ScrollView as RNScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Pencil,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format, addMonths, addYears } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";

import { colors, spacing, hexToRGBA, CURRENCIES, getCurrencySymbol } from "@/constants";
import {
  AppText,
  LogoCircle,
  SwipeDownSheet,
  Toggle,
  PressableScale,
} from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getNextRenewalDate } from "@/utils/date";

/* ── Constants ──────────────────────────────────────────────────────── */

const PRESET_COLORS = [
  "#E50914",
  "#1DB954",
  "#007AFF",
  "#4285F4",
  "#00A8E1",
  "#FF9900",
  "#4A154B",
  "#FF9500",
  "#58CC02",
  "#AF52DE",
];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const startOfCalendarMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);
const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/* ── Reusable Presentational Components ─────────────────────────────── */

type SectionCardProps = { children: React.ReactNode; style?: object };
const SectionCard = ({ children, style }: SectionCardProps) => (
  <View style={[sectionStyles.card, style]}>{children}</View>
);

type RowProps = { children: React.ReactNode; height?: number };
const Row = ({ children, height = 56 }: RowProps) => (
  <View style={[sectionStyles.row, { height }]}>{children}</View>
);

const RowDivider = () => <View style={sectionStyles.divider} />;

type SwitchRowProps = {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
};
const SwitchRow = ({ label, value, onValueChange }: SwitchRowProps) => (
  <Row>
    <AppText variant="subheadline" weight="600" color={colors.white}>
      {label}
    </AppText>
    <View style={sectionStyles.switchSlot}>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  </Row>
);

type SelectorRowProps = { label: string; value: string; onPress: () => void };
const SelectorRow = ({ label, value, onPress }: SelectorRowProps) => (
  <Row>
    <AppText variant="subheadline" weight="600" color={colors.white}>
      {label}
    </AppText>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={sectionStyles.selectorPill}
    >
      <AppText variant="caption1" weight="700" color={colors.white}>
        {value}
      </AppText>
      <ArrowUpDown
        size={12}
        color={colors.textSecondary}
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  </Row>
);

type ArrowRowProps = { label: string; value: string; onPress: () => void };
const ArrowRow = ({ label, value, onPress }: ArrowRowProps) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <Row>
      <AppText variant="subheadline" weight="600" color={colors.white}>
        {label}
      </AppText>
      <View style={sectionStyles.arrowRight}>
        <AppText variant="callout" color={colors.textSecondary} weight="500">
          {value}
        </AppText>
        <ChevronRight
          size={16}
          color={colors.textMuted}
          style={{ marginLeft: 4 }}
        />
      </View>
    </Row>
  </TouchableOpacity>
);

type DateRowProps = { label: string; value: string; onPress: () => void };
const DateRow = ({ label, value, onPress }: DateRowProps) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <Row>
      <AppText variant="subheadline" weight="600" color={colors.white}>
        {label}
      </AppText>
      <AppText variant="callout" color={colors.textSecondary} weight="500">
        {value}
      </AppText>
    </Row>
  </TouchableOpacity>
);

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  divider: {
    height: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  switchSlot: {
    width: 52,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  arrowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  valueInput: {
    color: colors.white,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 4,
  },
});

/* ── Main Screen ────────────────────────────────────────────────────── */

export default function UnifiedFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addSubscription, updateSubscription, subscriptions } =
    useSubscriptionStore();

  const {
    name,
    category: initialCategory,
    brandColor,
    website,
    logo,
    editId,
  } = useLocalSearchParams<{
    name: string;
    category: string;
    brandColor: string;
    website: string;
    logo: string;
    editId?: string;
  }>();

  const isEditMode = Boolean(editId);
  const existingSub = isEditMode
    ? subscriptions.find((s) => s.id === editId)
    : null;

  // --- Dynamic Style States ---
  const [selectedColor, setSelectedColor] = useState(
    () => existingSub?.color || brandColor || colors.accent,
  );
  const [customLogoUrl, setCustomLogoUrl] = useState(
    () => existingSub?.logoUrl || logo || "",
  );
  const [logoStyle, setLogoStyle] = useState<"default" | "badge" | "initial">(
    "default",
  );
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<
    "currency" | "cycle" | "payment" | "category" | "reminder" | null
  >(null);

  // --- Form Input States ---
  const [isTrial, setIsTrial] = useState(
    existingSub ? existingSub.isTrial : false,
  );
  const [customName, setCustomName] = useState(
    () => existingSub?.name || name || "Subscription",
  );
  const [amount, setAmount] = useState(() =>
    existingSub ? String(existingSub.price) : "",
  );
  const [currency, setCurrency] = useState(() => {
    if (!existingSub) return useSettingsStore.getState().currencyCode || "INR";
    return (existingSub.currency || "INR").slice(0, 3).toUpperCase();
  });
  const [startDate, setStartDate] = useState(() =>
    existingSub
      ? new Date(existingSub.startDate || existingSub.createdAt)
      : new Date(),
  );
  const [trialEndDate, setTrialEndDate] = useState(() =>
    existingSub?.trialEndDate
      ? new Date(existingSub.trialEndDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  );
  const [renewing, setRenewing] = useState(() =>
    existingSub ? existingSub.price > 0 : true,
  );
  const [billingCycle, setBillingCycle] = useState(() => {
    if (!existingSub) return "monthly";
    return existingSub.rawBillingCycle || existingSub.billingCycle || "monthly";
  });

  // Split Bill States
  const [splitEnabled, setSplitEnabled] = useState(
    () => existingSub?.splitEnabled || false,
  );
  const [splitType, setSplitType] = useState<"people" | "percentage" | "share">(
    () => existingSub?.splitType || "people",
  );
  const [splitValue, setSplitValue] = useState(() =>
    existingSub?.splitValue ? String(existingSub.splitValue) : "2",
  );

  // Promo / Introductory Pricing States
  const [promoEnabled, setPromoEnabled] = useState(
    () => existingSub?.promoEnabled || false,
  );
  const [promoPrice, setPromoPrice] = useState(() =>
    existingSub?.promoPrice ? String(existingSub.promoPrice) : "",
  );
  const [promoDurationValue, setPromoDurationValue] = useState(() =>
    existingSub?.promoDurationValue
      ? String(existingSub.promoDurationValue)
      : "3",
  );
  const [promoDurationUnit, setPromoDurationUnit] = useState<
    "weeks" | "months" | "years" | "cycles"
  >(() => existingSub?.promoDurationUnit || "months");

  const previewPrice = useMemo(() => {
    const basePrice = Number(amount || 0);
    const val = Number(splitValue || 1);
    if (splitType === "people") return basePrice / (val || 1);
    if (splitType === "percentage") return basePrice * (val / 100);
    return val;
  }, [amount, splitType, splitValue]);

  const [splitCardY, setSplitCardY] = useState(0);
  const [promoCardY, setPromoCardY] = useState(0);
  const [notesCardY, setNotesCardY] = useState(0);

  const [showCustomCycleModal, setShowCustomCycleModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameBeforeEdit, setNameBeforeEdit] = useState("");
  const [showColorEditModal, setShowColorEditModal] = useState(false);
  const [colorEditValue, setColorEditValue] = useState("");
  const [activeDatePicker, setActiveDatePicker] = useState<
    "startDate" | "trialEnd" | null
  >(null);
  const [calendarMode, setCalendarMode] = useState<"days" | "months" | "years">(
    "days",
  );

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [animBottom] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardVisible(true);
        Animated.timing(animBottom, {
          toValue: e.endCoordinates.height + 10,
          duration: e.duration || 250,
          useNativeDriver: false,
        }).start();
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        animBottom.setValue(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [animBottom]);

  const getYearRangeStart = (date: Date) => date.getFullYear() - 5;
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfCalendarMonth(startDate),
  );
  const [calendarSnapshot, setCalendarSnapshot] = useState<{
    startDate: Date;
    trialEndDate: Date;
  } | null>(null);
  const [customCycleVal, setCustomCycleVal] = useState(() => {
    if (existingSub?.rawBillingCycle?.startsWith("custom:"))
      return existingSub.rawBillingCycle.split(":")[1] || "1";
    return "1";
  });
  const [customCycleUnit, setCustomCycleUnit] = useState<
    "days" | "weeks" | "months" | "years"
  >(() => {
    if (existingSub?.rawBillingCycle?.startsWith("custom:"))
      return (existingSub.rawBillingCycle.split(":")[2] || "months") as any;
    return "months";
  });

  const formatBillingCycleLabel = (cycle: string) => {
    if (!cycle) return "Monthly";
    if (cycle === "custom") return "Custom";
    if (cycle.startsWith("custom:")) {
      const parts = cycle.split(":");
      const val = parts[1] || "1";
      const unit =
        (parts[2] || "months").charAt(0).toUpperCase() +
        (parts[2] || "months").slice(1);
      return `Every ${val} ${unit}`;
    }
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  };

  const [paymentMethod, setPaymentMethod] = useState(
    () => existingSub?.paymentMethod || "None",
  );
  const [category, setCategory] = useState(() =>
    existingSub?.category
      ? existingSub.category.charAt(0).toUpperCase() +
        existingSub.category.slice(1)
      : initialCategory || "Entertainment",
  );
  const [reminderEnabled, setReminderEnabled] = useState(() =>
    existingSub ? existingSub.reminderEnabled : true,
  );
  const [reminderDays, setReminderDays] = useState(() => {
    if (existingSub) return existingSub.reminderDays;
    const globalTiming = useSettingsStore.getState().notificationTiming;
    if (globalTiming === "3days") return 3;
    if (globalTiming === "1week") return 7;
    return 1;
  });
  const [autoRenew, setAutoRenew] = useState(() =>
    existingSub ? existingSub.price > 0 : true,
  );
  const [notes, setNotes] = useState(() => existingSub?.note || "");

  const scrollRef = useRef<RNScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const [initialFormState] = useState(() => ({
    selectedColor,
    customLogoUrl,
    customName,
    amount,
    currency,
    startDate: startDate.getTime(),
    trialEndDate: trialEndDate.getTime(),
    renewing,
    billingCycle,
    customCycleVal,
    customCycleUnit,
    paymentMethod,
    category,
    reminderEnabled,
    reminderDays,
    notes,
  }));

  const hasUnsavedChanges = useMemo(() => {
    return (
      initialFormState.selectedColor !== selectedColor ||
      initialFormState.customLogoUrl !== customLogoUrl ||
      initialFormState.customName !== customName ||
      initialFormState.amount !== amount ||
      initialFormState.currency !== currency ||
      initialFormState.startDate !== startDate.getTime() ||
      initialFormState.trialEndDate !== trialEndDate.getTime() ||
      initialFormState.renewing !== renewing ||
      initialFormState.billingCycle !== billingCycle ||
      initialFormState.customCycleVal !== customCycleVal ||
      initialFormState.customCycleUnit !== customCycleUnit ||
      initialFormState.paymentMethod !== paymentMethod ||
      initialFormState.category !== category ||
      initialFormState.reminderEnabled !== reminderEnabled ||
      initialFormState.reminderDays !== reminderDays ||
      initialFormState.notes !== notes
    );
  }, [
    amount,
    billingCycle,
    category,
    currency,
    customCycleUnit,
    customCycleVal,
    customLogoUrl,
    customName,
    notes,
    paymentMethod,
    reminderDays,
    reminderEnabled,
    renewing,
    selectedColor,
    startDate,
    trialEndDate,
    initialFormState,
  ]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from(
      { length: daysInMonth },
      (_, index) => new Date(year, month, index + 1),
    );
    return [...blanks, ...days];
  }, [calendarMonth]);

  const selectedCalendarDate =
    activeDatePicker === "trialEnd" ? trialEndDate : startDate;

  const openDatePicker = (picker: "startDate" | "trialEnd") => {
    const date = picker === "trialEnd" ? trialEndDate : startDate;
    setCalendarMonth(startOfCalendarMonth(date));
    setCalendarSnapshot({
      startDate: new Date(startDate),
      trialEndDate: new Date(trialEndDate),
    });
    setCalendarMode("days");
    setActiveDatePicker(picker);
  };

  const handleCalendarDateSelect = (date: Date) => {
    Haptics.selectionAsync();
    if (activeDatePicker === "trialEnd") setTrialEndDate(date);
    else setStartDate(date);
  };

  const handleBack = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    if (!hasUnsavedChanges) {
      router.back();
      return;
    }
    Alert.alert(
      "Discard changes?",
      "Your unsaved changes will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ],
    );
  };
  const handleEditName = () => {
    Haptics.selectionAsync();
    setNameBeforeEdit(customName);
    setIsEditingName(true);
  };
  const handleSaveName = () => {
    if (!isEditingName) return;
    setIsEditingName(false);
    const trimmed = customName.trim();
    if (!trimmed) {
      setCustomName(nameBeforeEdit);
    } else {
      setCustomName(trimmed);
      if (trimmed !== nameBeforeEdit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };
  const handleCurrencyPress = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    setActivePicker("currency");
  };
  const handleCyclePress = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    setActivePicker("cycle");
  };
  const handlePaymentMethodPress = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    setActivePicker("payment");
  };
  const handleCategoryPress = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    setActivePicker("category");
  };
  const handleReminderOffsetPress = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    setActivePicker("reminder");
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    Keyboard.dismiss();
    if (isSaving) return;
    if (!customName.trim()) {
      Alert.alert("Error", "Please enter subscription name");
      return;
    }
    if (!isTrial && renewing && (!amount || Number(amount) <= 0)) {
      Alert.alert("Error", "Please enter a valid subscription amount");
      return;
    }
    if (promoEnabled && (!promoPrice || Number(promoPrice) < 0)) {
      Alert.alert("Error", "Please enter a valid promo price");
      return;
    }
    if (promoEnabled && (!promoDurationValue || Number(promoDurationValue) <= 0)) {
      Alert.alert("Error", "Promo duration must be at least 1");
      return;
    }
    if (isTrial && trialEndDate <= startDate) {
      Alert.alert("Error", "Trial end date must be after start date");
      return;
    }

    setIsSaving(true);

    let nextDate: Date | null = startDate;
    if (isTrial) {
      nextDate = trialEndDate;
    } else if (!renewing) {
      nextDate = null;
    } else {
      nextDate = getNextRenewalDate(
        startDate,
        billingCycle,
        Number(customCycleVal) || 1,
      );
    }

    const normalizedBillingCycle = billingCycle.startsWith("custom:")
      ? "custom"
      : billingCycle.toLowerCase();

    let calculatedPromoEndDate: string | undefined = undefined;
    if (promoEnabled) {
      const pVal = Number(promoDurationValue) || 1;
      let pEnd = new Date(startDate);
      if (promoDurationUnit === "weeks")
        pEnd.setDate(pEnd.getDate() + pVal * 7);
      else if (promoDurationUnit === "months")
        pEnd.setMonth(pEnd.getMonth() + pVal);
      else if (promoDurationUnit === "years")
        pEnd.setFullYear(pEnd.getFullYear() + pVal);
      else if (promoDurationUnit === "cycles") {
        let monthsPerCycle = 1;
        if (billingCycle === "weekly") monthsPerCycle = 0.23;
        else if (billingCycle === "bi-weekly") monthsPerCycle = 0.46;
        else if (billingCycle === "monthly") monthsPerCycle = 1;
        else if (billingCycle === "quarterly") monthsPerCycle = 3;
        else if (billingCycle === "semi-yearly") monthsPerCycle = 6;
        else if (billingCycle === "yearly") monthsPerCycle = 12;
        else if (billingCycle.startsWith("custom:"))
          monthsPerCycle = Number(customCycleVal) || 1;
        pEnd.setMonth(pEnd.getMonth() + Math.round(pVal * monthsPerCycle));
      }
      calculatedPromoEndDate = pEnd.toISOString();
    }

    const input = {
      name: customName,
      color: selectedColor,
      logoUrl: logoStyle === "initial" ? undefined : customLogoUrl || undefined,
      price: isTrial
        ? autoRenew
          ? Number(amount || 0)
          : 0
        : Number(amount || 0),
      currency: currency.slice(0, 3).toUpperCase(),
      billingCycle: normalizedBillingCycle as any,
      rawBillingCycle: billingCycle,
      customIntervalMonths: billingCycle.startsWith("custom:")
        ? Number(customCycleVal) || 1
        : undefined,
      nextBillingDate: nextDate
        ? nextDate.toISOString()
        : startDate.toISOString(),
      category: category.toLowerCase() as any,
      reminderEnabled: reminderEnabled,
      reminderDays: reminderDays,
      note: notes || undefined,
      isTrial: isTrial,
      trialStartDate: isTrial ? startDate.toISOString() : undefined,
      trialEndDate: isTrial ? trialEndDate.toISOString() : undefined,
      startDate: startDate.toISOString(),
      paymentMethod: paymentMethod === "None" ? undefined : paymentMethod,
      website: website || existingSub?.website || undefined,
      splitEnabled: splitEnabled,
      splitType: splitEnabled ? splitType : undefined,
      splitValue: splitEnabled ? Number(splitValue || 1) : undefined,
      promoEnabled: promoEnabled,
      promoPrice: promoEnabled ? Number(promoPrice || 0) : undefined,
      promoDurationValue: promoEnabled
        ? Number(promoDurationValue || 1)
        : undefined,
      promoDurationUnit: promoEnabled ? promoDurationUnit : undefined,
      promoStartDate: promoEnabled ? startDate.toISOString() : undefined,
      promoEndDate: calculatedPromoEndDate,
    };

    try {
      if (isEditMode && editId) await updateSubscription(editId, input);
      else await addSubscription(input);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } catch (e) {
      console.error("Save subscription failed:", e);
      Alert.alert(
        "Save Failed",
        "Could not save subscription. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatReminderLabel = (days: number) => {
    if (days === 0) return "Same Day";
    if (days === 1) return "1 Day Before";
    return `${days} Days Before`;
  };

  const nextRenewalLabelText = useMemo(() => {
    if (isTrial)
      return `Trial starts on ${format(startDate, "MMM d")}. Ends on ${format(trialEndDate, "MMM d, yyyy")}.`;
    const startStr = format(startDate, "MMM d");
    const nextDate = getNextRenewalDate(
      startDate,
      billingCycle,
      Number(customCycleVal) || 1,
    );
    const endStr = format(nextDate, "MMM d, yyyy");
    if (!renewing)
      return `Starts on ${startStr}. One-time payment of ${getCurrencySymbol(currency)}${Number(amount || 0).toFixed(2)}.`;
    return `Starts on ${startStr}. Renews on ${endStr} at ${getCurrencySymbol(currency)}${Number(amount || 0).toFixed(2)}.`;
  }, [
    startDate,
    billingCycle,
    currency,
    amount,
    isTrial,
    trialEndDate,
    renewing,
    customCycleVal,
  ]);

  const scrollAmountInput = () => {
    setTimeout(
      () => scrollRef.current?.scrollTo({ y: 130, animated: true }),
      100,
    );
  };
  const scrollCardToY = (y: number) => {
    setTimeout(
      () => scrollRef.current?.scrollTo({ y: y - 20, animated: true }),
      150,
    );
  };
  const scrollNotes = () => {
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({ y: notesCardY - 150, animated: true }),
      150,
    );
  };

  const isModalActive =
    isEditingName ||
    showColorEditModal ||
    showCustomCycleModal ||
    customizeVisible ||
    activePicker !== null ||
    activeDatePicker !== null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          hexToRGBA(selectedColor, 0.55),
          hexToRGBA(selectedColor, 0.18),
          "rgba(0, 0, 0, 0)",
        ]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <View style={[styles.navbar, { paddingTop: insets.top + spacing[8] }]}>
        <PressableScale
          onPress={handleBack}
          scale={0.9}
          style={styles.navCircleBtn}
        >
          <ChevronLeft size={24} color={colors.white} strokeWidth={2.5} />
        </PressableScale>
        <AppText variant="title3" weight="700" color={colors.white}>
          {isEditMode ? "Edit" : "New"}
        </AppText>
        <PressableScale
          onPress={handleSave}
          scale={0.92}
          style={styles.addBtnContainer}
        >
          <AppText variant="subheadline" weight="700" color={colors.black}>
            {isEditMode ? "Save" : "Add"}
          </AppText>
        </PressableScale>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing[40] },
          ]}
        >
          {/* ── Hero ────────────────────────────────────────────────── */}
          <View style={styles.heroWrap}>
            <View style={[styles.heroCard, { backgroundColor: selectedColor }]}>
              <PressableScale
                onPress={() => {
                  Keyboard.dismiss();
                  Haptics.selectionAsync();
                  setCustomizeVisible(true);
                }}
                scale={0.85}
                style={styles.pencilCircle}
              >
                <Pencil size={16} color={colors.white} />
              </PressableScale>
              <LogoCircle
                source={
                  logoStyle === "initial"
                    ? undefined
                    : customLogoUrl || undefined
                }
                name={logoStyle === "initial" ? "" : customName}
                color={logoStyle === "badge" ? "#FFFFFF" : selectedColor}
                size={96}
                bordered={logoStyle === "default"}
                website={website}
              />
              {isEditingName ? (
                <View style={styles.heroNamePill}>
                  <TextInput
                    style={{
                      color: colors.white,
                      fontSize: 20,
                      fontWeight: "700",
                      letterSpacing: 0.38,
                      padding: 0,
                      margin: 0,
                      minWidth: 100,
                      textAlign: "center",
                    }}
                    value={customName}
                    onChangeText={setCustomName}
                    autoFocus
                    selectTextOnFocus
                    onBlur={handleSaveName}
                    onSubmitEditing={handleSaveName}
                    returnKeyType="done"
                    placeholder="Subscription name"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  />
                </View>
              ) : (
                <PressableScale
                  onPress={handleEditName}
                  scale={0.96}
                  style={styles.heroNamePill}
                >
                  <AppText variant="title3" weight="700" color={colors.white}>
                    {customName}
                  </AppText>
                </PressableScale>
              )}
              <AppText variant="footnote" style={styles.heroStatus}>
                {isTrial
                  ? "Free trial subscription"
                  : `Starts ${format(startDate, "MMM d")}`}
              </AppText>
            </View>
          </View>

          {/* ── Paid / Trial Segment ───────────────────────────────── */}
          <View style={styles.segmentContainer}>
            <PressableScale
              onPress={() => {
                Haptics.selectionAsync();
                setIsTrial(false);
              }}
              scale={0.96}
              style={[styles.segmentTab, !isTrial && styles.segmentTabActive]}
            >
              <AppText
                variant="subheadline"
                weight="700"
                color={!isTrial ? colors.white : colors.textSecondary}
              >
                Paid
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={() => {
                Haptics.selectionAsync();
                setIsTrial(true);
              }}
              scale={0.96}
              style={[styles.segmentTab, isTrial && styles.segmentTabActive]}
            >
              <AppText
                variant="subheadline"
                weight="700"
                color={isTrial ? colors.white : colors.textSecondary}
              >
                Free trial
              </AppText>
            </PressableScale>
          </View>

          {/* ── Amount ─────────────────────────────────────────────── */}
          {(!isTrial || autoRenew) && (
            <View style={styles.amountCard}>
              <AppText variant="subheadline" weight="600" color={colors.white}>
                Amount
              </AppText>
              <View style={styles.amountRight}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  onFocus={scrollAmountInput}
                />
                <TouchableOpacity
                  onPress={handleCurrencyPress}
                  activeOpacity={0.7}
                  style={styles.selectorPill}
                >
                  <AppText variant="caption1" weight="700" color={colors.white}>
                    {currency} ({getCurrencySymbol(currency)})
                  </AppText>
                  <ArrowUpDown
                    size={12}
                    color={colors.textSecondary}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Billing ────────────────────────────────────────────── */}
          <SectionCard>
            {isTrial ? (
              <>
                <DateRow
                  label="Start date"
                  value={format(startDate, "MMMM d, yyyy")}
                  onPress={() => openDatePicker("startDate")}
                />
                <RowDivider />
                <DateRow
                  label="Trial ends"
                  value={format(trialEndDate, "MMMM d, yyyy")}
                  onPress={() => openDatePicker("trialEnd")}
                />
                <RowDivider />
                <SwitchRow
                  label="Auto renew"
                  value={autoRenew}
                  onValueChange={setAutoRenew}
                />
              </>
            ) : (
              <>
                <DateRow
                  label="Start date"
                  value={format(startDate, "MMMM d, yyyy")}
                  onPress={() => openDatePicker("startDate")}
                />
                <RowDivider />
                <SwitchRow
                  label="Renewing"
                  value={renewing}
                  onValueChange={setRenewing}
                />
                {renewing && (
                  <>
                    <RowDivider />
                    <SelectorRow
                      label="Billing cycle"
                      value={formatBillingCycleLabel(billingCycle)}
                      onPress={handleCyclePress}
                    />
                  </>
                )}
              </>
            )}
          </SectionCard>

          <AppText variant="caption1" style={styles.helperText}>
            {nextRenewalLabelText}
          </AppText>

          {/* ── Payment & Category ─────────────────────────────────── */}
          <SectionCard>
            {!isTrial && (
              <>
                <ArrowRow
                  label="Payment method"
                  value={paymentMethod}
                  onPress={handlePaymentMethodPress}
                />
                <RowDivider />
              </>
            )}
            <ArrowRow
              label="Category"
              value={category}
              onPress={handleCategoryPress}
            />
          </SectionCard>

          {/* ── Reminder ───────────────────────────────────────────── */}
          <SectionCard>
            <SwitchRow
              label="Payment reminder"
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
            />
            {reminderEnabled && (
              <>
                <RowDivider />
                <ArrowRow
                  label="Remind offset"
                  value={formatReminderLabel(reminderDays)}
                  onPress={handleReminderOffsetPress}
                />
              </>
            )}
          </SectionCard>

          {/* ── Split Bill (advanced) ──────────────────────────────── */}
          <View
            style={styles.advancedSection}
            onLayout={(e) => setSplitCardY(e.nativeEvent.layout.y)}
          >
            <SectionCard>
              <SwitchRow
                label="Split bill / Share cost"
                value={splitEnabled}
                onValueChange={setSplitEnabled}
              />
              {splitEnabled && (
                <>
                  <RowDivider />
                  {/* Split type — full-width segmented control */}
                  <AppText
                    variant="caption1"
                    weight="700"
                    color={colors.textSecondary}
                    style={styles.sectionLabel}
                  >
                    SPLIT TYPE
                  </AppText>
                  <View style={styles.segmentRow}>
                    {(["people", "percentage", "share"] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSplitType(t);
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.segmentBtn,
                          splitType === t && styles.segmentBtnActive,
                        ]}
                      >
                        <AppText
                          style={[
                            styles.segmentBtnText,
                            splitType === t && styles.segmentBtnTextActive,
                          ]}
                        >
                          {t === "people"
                            ? "People"
                            : t === "percentage"
                              ? "Percent"
                              : "Fixed"}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <RowDivider />
                  {/* Value — big prominent input */}
                  <AppText
                    variant="caption1"
                    weight="700"
                    color={colors.textSecondary}
                    style={styles.sectionLabel}
                  >
                    {splitType === "people"
                      ? "NUMBER OF PEOPLE"
                      : splitType === "percentage"
                        ? "YOUR PERCENTAGE"
                        : "YOUR FIXED SHARE"}
                  </AppText>
                  <TextInput
                    style={styles.bigNumberInput}
                    placeholder={
                      splitType === "people"
                        ? "2"
                        : splitType === "percentage"
                          ? "50"
                          : "50.00"
                    }
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={splitValue}
                    onChangeText={setSplitValue}
                    onFocus={() => scrollCardToY(splitCardY)}
                  />
                  {Number(amount || 0) > 0 && (
                    <>
                      <RowDivider />
                      <Row height={38}>
                        <AppText
                          variant="caption1"
                          color={colors.textSecondary}
                        >
                          Your share:
                        </AppText>
                        <AppText
                          variant="callout"
                          weight="700"
                          color={colors.accent}
                        >
                          {getCurrencySymbol(currency)}
                          {previewPrice.toFixed(2)} / cycle
                        </AppText>
                      </Row>
                    </>
                  )}
                </>
              )}
            </SectionCard>
          </View>

          {/* ── Promo (advanced) ───────────────────────────────────── */}
          <View
            style={styles.advancedSection}
            onLayout={(e) => setPromoCardY(e.nativeEvent.layout.y)}
          >
            <SectionCard>
              <SwitchRow
                label="Introductory promo price"
                value={promoEnabled}
                onValueChange={setPromoEnabled}
              />
              {promoEnabled && (
                <>
                  <RowDivider />
                  {/* Promo price — big input */}
                  <AppText
                    variant="caption1"
                    weight="700"
                    color={colors.textSecondary}
                    style={styles.sectionLabel}
                  >
                    PROMO PRICE
                  </AppText>
                  <TextInput
                    style={styles.bigNumberInput}
                    placeholder="149.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={promoPrice}
                    onChangeText={setPromoPrice}
                    onFocus={() => scrollCardToY(promoCardY)}
                  />
                  <RowDivider />
                  {/* Promo duration — full-width segmented then number */}
                  <AppText
                    variant="caption1"
                    weight="700"
                    color={colors.textSecondary}
                    style={styles.sectionLabel}
                  >
                    PROMO DURATION
                  </AppText>
                  <View style={styles.segmentRow}>
                    {(["weeks", "months", "years"] as const).map((u) => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setPromoDurationUnit(u);
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.segmentBtn,
                          promoDurationUnit === u && styles.segmentBtnActive,
                        ]}
                      >
                        <AppText
                          style={[
                            styles.segmentBtnText,
                            promoDurationUnit === u &&
                              styles.segmentBtnTextActive,
                          ]}
                        >
                          {u === "weeks"
                            ? "Weeks"
                            : u === "months"
                              ? "Months"
                              : "Years"}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <AppText
                    variant="caption1"
                    weight="700"
                    color={colors.textSecondary}
                    style={styles.sectionLabel}
                  >
                    HOW MANY?
                  </AppText>
                  <TextInput
                    style={styles.bigNumberInput}
                    placeholder="3"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={promoDurationValue}
                    onChangeText={setPromoDurationValue}
                    onFocus={() => scrollCardToY(promoCardY)}
                  />
                </>
              )}
            </SectionCard>
          </View>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <View onLayout={(e) => setNotesCardY(e.nativeEvent.layout.y)}>
            <SectionCard style={{ paddingVertical: 14 }}>
              <AppText
                variant="caption1"
                weight="700"
                color={colors.textSecondary}
                style={[styles.sectionLabel, { paddingTop: 0 }]}
              >
                NOTE
              </AppText>
              <TextInput
                ref={notesInputRef}
                style={styles.notesInput}
                placeholder="Write something..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                onFocus={scrollNotes}
                multiline
                numberOfLines={4}
              />
            </SectionCard>
          </View>

        </ScrollView>
      </View>

      {/* ── Customization Sheet ────────────────────────────────────── */}
      <SwipeDownSheet
        visible={customizeVisible}
        onClose={() => setCustomizeVisible(false)}
        containerStyle={{
          paddingBottom: insets.bottom + spacing[20],
          paddingHorizontal: spacing[20],
        }}
      >
        <View style={styles.sheetHeader}>
          <View style={{ width: 24 }} />
          <AppText variant="title3" weight="700" color={colors.white}>
            Customize
          </AppText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetScroll}
        >
          {/* Card Preview */}
          <View
            style={[styles.previewCard, { backgroundColor: selectedColor }]}
          >
            <LogoCircle
              source={
                logoStyle === "initial" ? undefined : customLogoUrl || undefined
              }
              name={logoStyle === "initial" ? "" : customName}
              color={logoStyle === "badge" ? "#FFFFFF" : selectedColor}
              size={112}
              bordered={logoStyle === "default"}
              website={website}
            />
            {isEditingName ? (
              <View style={styles.previewNamePill}>
                <TextInput
                  style={{
                    color: colors.white,
                    fontSize: 15,
                    fontWeight: "700",
                    letterSpacing: -0.24,
                    padding: 0,
                    margin: 0,
                    minWidth: 100,
                    textAlign: "center",
                  }}
                  value={customName}
                  onChangeText={setCustomName}
                  autoFocus
                  selectTextOnFocus
                  onBlur={handleSaveName}
                  onSubmitEditing={handleSaveName}
                  returnKeyType="done"
                  placeholder="Subscription name"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleEditName}
                style={styles.previewNamePill}
              >
                <AppText variant="subheadline" weight="700" color={colors.white}>
                  {customName}
                </AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Color Picker */}
          <View style={styles.pickerSection}>
            <AppText
              variant="subheadline"
              weight="600"
              color={colors.textSecondary}
            >
              Card Background
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorRow}
            >
              {PRESET_COLORS.map((c) => {
                const isActive =
                  selectedColor.toLowerCase() === c.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedColor(c);
                    }}
                    style={[styles.colorBubble, { backgroundColor: c }]}
                  >
                    {isActive && <View style={styles.colorBubbleActiveInner} />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setColorEditValue(selectedColor);
                  setShowColorEditModal(true);
                }}
                style={[styles.colorBubble, styles.colorBubbleCustom]}
              >
                <ArrowUpDown size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Logo Style */}
          <View style={styles.pickerSection}>
            <AppText
              variant="subheadline"
              weight="600"
              color={colors.textSecondary}
            >
              Logo Style
            </AppText>
            <View style={styles.logoVariationRow}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLogoStyle("default");
                }}
                style={[
                  styles.logoVarItem,
                  logoStyle === "default" && styles.logoVarItemActive,
                ]}
              >
                <LogoCircle
                  source={customLogoUrl || undefined}
                  name={customName}
                  color={selectedColor}
                  size={48}
                  bordered
                  website={website}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLogoStyle("badge");
                }}
                style={[
                  styles.logoVarItem,
                  logoStyle === "badge" && styles.logoVarItemActive,
                ]}
              >
                <View style={styles.badgeLogoWrapper}>
                  <LogoCircle
                    source={customLogoUrl || undefined}
                    name={customName}
                    color="#FFFFFF"
                    size={48}
                    website={website}
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLogoStyle("initial");
                }}
                style={[
                  styles.logoVarItem,
                  logoStyle === "initial" && styles.logoVarItemActive,
                ]}
              >
                <LogoCircle
                  name={customName}
                  color={selectedColor}
                  size={48}
                  website={website}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Icon / Image buttons */}
          <View style={styles.sheetButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                Alert.alert(
                  "Pick Icon",
                  "Choose an emoji to represent this service:",
                  [
                    {
                      text: "🍿 Popcorn",
                      onPress: () => {
                        setCustomLogoUrl("🍿");
                        setLogoStyle("default");
                      },
                    },
                    {
                      text: "🎵 Music",
                      onPress: () => {
                        setCustomLogoUrl("🎵");
                        setLogoStyle("default");
                      },
                    },
                    {
                      text: "🎮 Gaming",
                      onPress: () => {
                        setCustomLogoUrl("🎮");
                        setLogoStyle("default");
                      },
                    },
                    {
                      text: "🤖 Tech/AI",
                      onPress: () => {
                        setCustomLogoUrl("🤖");
                        setLogoStyle("default");
                      },
                    },
                    {
                      text: "📚 Study",
                      onPress: () => {
                        setCustomLogoUrl("📚");
                        setLogoStyle("default");
                      },
                    },
                    { text: "Cancel", style: "cancel" },
                  ],
                );
              }}
              style={styles.sheetActionButton}
            >
              <AppText variant="title3" style={styles.sheetActionIcon}>
                🍿
              </AppText>
              <AppText variant="subheadline" weight="700" color={colors.white}>
                Pick icon
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                Haptics.selectionAsync();
                const { status } =
                  await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== "granted") {
                  Alert.alert(
                    "Permission Required",
                    "Please grant photo library access to choose an image.",
                  );
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.8,
                });
                if (!result.canceled && result.assets[0]) {
                  setCustomLogoUrl(result.assets[0].uri);
                  setLogoStyle("default");
                }
              }}
              style={styles.sheetActionButton}
            >
              <AppText variant="title3" style={styles.sheetActionIcon}>
                🖼️
              </AppText>
              <AppText variant="subheadline" weight="700" color={colors.white}>
                Choose image
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <PressableScale
          onPress={() => setCustomizeVisible(false)}
          scale={0.97}
          style={styles.sheetDoneBtn}
        >
          <AppText
            variant="callout"
            weight="700"
            style={styles.sheetDoneBtnText}
          >
            Done
          </AppText>
        </PressableScale>
      </SwipeDownSheet>

      {/* ── Picker Dropdown Modal (iOS action sheet style) ─────────── */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.dropdownOverlay}>
          {/* Backdrop — tap to dismiss */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          />

          <View
            style={[styles.dropdownSheet, { marginBottom: 8 + insets.bottom }]}
          >
            {(() => {
              const data = (() => {
                switch (activePicker) {
                  case "currency":
                    return {
                      title: "Currency",
                      selectedValue: currency,
                      onSelect: (val: string) => setCurrency(val),
                      options: CURRENCIES.map((c) => ({
                        label: `${c.code} (${c.symbol})`,
                        value: c.code,
                      })),
                    };
                  case "cycle":
                    return {
                      title: "Billing Cycle",
                      selectedValue: billingCycle.startsWith("custom:")
                        ? "custom"
                        : billingCycle,
                      onSelect: (val: string) => {
                        if (val === "custom") {
                          setActivePicker(null);
                          setShowCustomCycleModal(true);
                        } else setBillingCycle(val as any);
                      },
                      options: [
                        { label: "Weekly", value: "weekly" },
                        { label: "Bi-weekly", value: "bi-weekly" },
                        { label: "Monthly", value: "monthly" },
                        { label: "Quarterly", value: "quarterly" },
                        { label: "Semi-yearly", value: "semi-yearly" },
                        { label: "Yearly", value: "yearly" },
                        { label: "Custom...", value: "custom" },
                      ],
                    };
                  case "payment":
                    return {
                      title: "Payment Method",
                      selectedValue: paymentMethod,
                      onSelect: (val: string) => setPaymentMethod(val),
                      options: [
                        { label: "Credit Card", value: "Credit Card" },
                        { label: "Apple Pay", value: "Apple Pay" },
                        { label: "Google Pay", value: "Google Pay" },
                        { label: "PayPal", value: "PayPal" },
                        { label: "None", value: "None" },
                      ],
                    };
                  case "category":
                    return {
                      title: "Category",
                      selectedValue: category,
                      onSelect: (val: string) => setCategory(val),
                      options: [
                        { label: "Entertainment", value: "Entertainment" },
                        { label: "Music", value: "Music" },
                        { label: "Productivity", value: "Productivity" },
                        { label: "Health", value: "Health" },
                        { label: "Education", value: "Education" },
                        { label: "Gaming", value: "Gaming" },
                        { label: "AI", value: "AI" },
                        { label: "News", value: "News" },
                        { label: "Cloud", value: "Cloud" },
                        { label: "Shopping", value: "Shopping" },
                        { label: "Finance", value: "Finance" },
                        { label: "Other", value: "Other" },
                      ],
                    };
                  case "reminder":
                    return {
                      title: "Remind me",
                      selectedValue: String(reminderDays),
                      onSelect: (val: string) => setReminderDays(Number(val)),
                      options: [
                        { label: "Same Day", value: "0" },
                        { label: "1 Day Before", value: "1" },
                        { label: "3 Days Before", value: "3" },
                        { label: "7 Days Before", value: "7" },
                      ],
                    };
                  default:
                    return null;
                }
              })();
              if (!data) return null;
              return (
                <>
                  {/* Options card */}
                  <View style={styles.dropdownCard}>
                    <View style={styles.dropdownHeader}>
                      <AppText
                        variant="caption1"
                        weight="500"
                        color={colors.textSecondary}
                        style={styles.dropdownTitle}
                      >
                        {data.title}
                      </AppText>
                    </View>
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      bounces={false}
                    >
                      {data.options.map((opt, idx) => {
                        const isSelected =
                          String(data.selectedValue).toLowerCase() ===
                          opt.value.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.dropdownRow,
                              idx === data.options.length - 1 &&
                                styles.dropdownRowLast,
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              data.onSelect(opt.value);
                              setActivePicker(null);
                            }}
                          >
                            <AppText
                              variant="body"
                              weight={isSelected ? "600" : "400"}
                              style={[
                                styles.dropdownOptionText,
                                isSelected && styles.dropdownOptionTextSelected,
                              ]}
                            >
                              {opt.label}
                            </AppText>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Cancel */}
                  <TouchableOpacity
                    style={styles.dropdownCancel}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActivePicker(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <AppText variant="body" weight="600" color={colors.white}>
                      Cancel
                    </AppText>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Custom Cycle Modal ─────────────────────────────────────── */}
      <Modal
        visible={showCustomCycleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomCycleModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.dropdownOverlay}>
            <TouchableOpacity
              style={styles.dropdownDismissArea}
              activeOpacity={1}
              onPress={() => setShowCustomCycleModal(false)}
            />
            <View style={styles.customCycleCard}>
              <View style={styles.dropdownHeader}>
                <AppText
                  variant="caption1"
                  weight="700"
                  color={colors.textSecondary}
                  style={styles.dropdownTitle}
                >
                  Custom Billing Cycle
                </AppText>
              </View>
              <View style={styles.customCycleBody}>
                <View style={styles.customCycleInputRow}>
                  <AppText
                    variant="subheadline"
                    color={colors.textSecondary}
                    style={styles.customCycleInputLabel}
                  >
                    Every
                  </AppText>
                  <TextInput
                    style={styles.customCycleInput}
                    keyboardType="numeric"
                    value={customCycleVal}
                    onChangeText={(val) =>
                      setCustomCycleVal(val.replace(/[^0-9]/g, ""))
                    }
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.customCycleUnitRow}>
                  {(["days", "weeks", "months", "years"] as const).map((unit) => {
                    const isAct = customCycleUnit === unit;
                    return (
                      <TouchableOpacity
                        key={unit}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCustomCycleUnit(unit);
                        }}
                        style={[
                          styles.customCycleUnitTab,
                          isAct && styles.customCycleUnitTabActive,
                        ]}
                      >
                        <AppText
                          variant="caption1"
                          weight="700"
                          color={isAct ? colors.white : colors.textSecondary}
                        >
                          {unit.charAt(0).toUpperCase() + unit.slice(1)}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    const valNum = Number(customCycleVal) || 1;
                    setBillingCycle(`custom:${valNum}:${customCycleUnit}`);
                    setShowCustomCycleModal(false);
                  }}
                  style={styles.customCycleSaveBtn}
                >
                  <AppText
                    variant="subheadline"
                    weight="700"
                    color={colors.black}
                  >
                    Save
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Date Picker Modal ──────────────────────────────────────── */}
      <Modal
        visible={activeDatePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDatePicker(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.datePickerBackdrop}
          onPress={() => setActiveDatePicker(null)}
        />
        <BlurView intensity={80} tint="dark" style={styles.datePickerModal}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                if (calendarSnapshot) {
                  setStartDate(calendarSnapshot.startDate);
                  setTrialEndDate(calendarSnapshot.trialEndDate);
                }
                setActiveDatePicker(null);
              }}
              style={styles.datePickerCancelBtn}
            >
              <AppText
                variant="callout"
                weight="600"
                color={colors.textSecondary}
              >
                Cancel
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                setCalendarSnapshot(null);
                setActiveDatePicker(null);
              }}
              style={styles.datePickerDoneBtn}
            >
              <AppText variant="callout" weight="700" color={colors.black}>
                Done
              </AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerBody}>
            <View style={styles.calendarTitleRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (calendarMode === "days") setCalendarMode("months");
                  else if (calendarMode === "months") setCalendarMode("years");
                  else setCalendarMode("days");
                }}
                style={styles.calendarMonthGroup}
              >
                <AppText
                  variant="title2"
                  weight="700"
                  color={colors.white}
                  numberOfLines={1}
                  style={styles.calendarMonthTitle}
                >
                  {calendarMode === "days"
                    ? format(calendarMonth, "MMMM yyyy")
                    : calendarMode === "months"
                      ? format(calendarMonth, "yyyy")
                      : `${getYearRangeStart(calendarMonth)} - ${getYearRangeStart(calendarMonth) + 11}`}
                </AppText>
                <ChevronRight
                  size={18}
                  color={colors.textSecondary}
                  style={{
                    marginLeft: 6,
                    transform: [
                      {
                        rotate:
                          calendarMode === "days"
                            ? "0deg"
                            : calendarMode === "months"
                              ? "90deg"
                              : "180deg",
                      },
                    ],
                  }}
                />
              </TouchableOpacity>
              <View style={styles.calendarNavGroup}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (calendarMode === "days")
                      setCalendarMonth((d) => addMonths(d, -1));
                    else if (calendarMode === "months")
                      setCalendarMonth((d) => addYears(d, -1));
                    else setCalendarMonth((d) => addYears(d, -12));
                  }}
                  style={styles.calendarArrowBtn}
                >
                  <ChevronLeft size={24} color={colors.white} strokeWidth={3} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (calendarMode === "days")
                      setCalendarMonth((d) => addMonths(d, 1));
                    else if (calendarMode === "months")
                      setCalendarMonth((d) => addYears(d, 1));
                    else setCalendarMonth((d) => addYears(d, 12));
                  }}
                  style={styles.calendarArrowBtn}
                >
                  <ChevronRight
                    size={24}
                    color={colors.white}
                    strokeWidth={3}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {calendarMode === "days" && (
              <>
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((day) => (
                    <AppText
                      key={day}
                      variant="caption1"
                      weight="700"
                      color={colors.textSecondary}
                      style={styles.weekdayText}
                    >
                      {day}
                    </AppText>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((date, index) => {
                    const selected = date
                      ? isSameCalendarDay(date, selectedCalendarDate)
                      : false;
                    return (
                      <View
                        key={date ? date.toISOString() : `blank-${index}`}
                        style={styles.calendarDayCell}
                      >
                        {date && (
                          <PressableScale
                            onPress={() => handleCalendarDateSelect(date)}
                            scale={0.88}
                            style={[
                              styles.calendarDayButton,
                              selected && styles.calendarDayButtonSelected,
                            ]}
                          >
                            <AppText
                              variant="title2"
                              weight={selected ? "700" : "400"}
                              color={colors.white}
                              style={styles.calendarDayText}
                            >
                              {date.getDate()}
                            </AppText>
                          </PressableScale>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {calendarMode === "months" && (
              <View style={styles.monthYearGrid}>
                {MONTHS_SHORT.map((mName, idx) => {
                  const isCurrent = idx === calendarMonth.getMonth();
                  return (
                    <PressableScale
                      key={mName}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCalendarMonth((prev) => {
                          const next = new Date(prev);
                          next.setMonth(idx);
                          return next;
                        });
                        setCalendarMode("days");
                      }}
                      style={[
                        styles.monthYearGridItem,
                        isCurrent && styles.monthYearGridItemActive,
                      ]}
                    >
                      <AppText
                        variant="body"
                        weight={isCurrent ? "700" : "500"}
                        color={isCurrent ? colors.white : colors.textSecondary}
                      >
                        {mName}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            )}

            {calendarMode === "years" && (
              <View style={styles.monthYearGrid}>
                {Array.from({ length: 12 }, (_, idx) => {
                  const targetYear = getYearRangeStart(calendarMonth) + idx;
                  const isCurrent = targetYear === calendarMonth.getFullYear();
                  return (
                    <PressableScale
                      key={targetYear}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCalendarMonth((prev) => {
                          const next = new Date(prev);
                          next.setFullYear(targetYear);
                          return next;
                        });
                        setCalendarMode("months");
                      }}
                      style={[
                        styles.monthYearGridItem,
                        isCurrent && styles.monthYearGridItemActive,
                      ]}
                    >
                      <AppText
                        variant="body"
                        weight={isCurrent ? "700" : "500"}
                        color={isCurrent ? colors.white : colors.textSecondary}
                      >
                        {targetYear}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </View>
        </BlurView>
      </Modal>



      {/* ── Color Edit Modal ───────────────────────────────────────── */}
      <Modal
        visible={showColorEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowColorEditModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.datePickerBackdrop}
          onPress={() => setShowColorEditModal(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 36 }} pointerEvents="box-none">
            <BlurView intensity={80} tint="dark" style={styles.datePickerModalRelative}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity
                  onPress={() => setShowColorEditModal(false)}
                  style={styles.datePickerCancelBtn}
                >
                  <AppText
                    variant="callout"
                    weight="600"
                    color={colors.textSecondary}
                  >
                    Cancel
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
                    if (hexPattern.test(colorEditValue)) {
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );
                      setSelectedColor(colorEditValue);
                      setShowColorEditModal(false);
                    } else {
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Error,
                      );
                      Alert.alert(
                        "Invalid Color",
                        "Please enter a valid hex color (e.g. #FF5733)",
                      );
                    }
                  }}
                  style={styles.datePickerDoneBtn}
                >
                  <AppText variant="callout" weight="700" color={colors.black}>
                    Done
                  </AppText>
                </TouchableOpacity>
              </View>
              <View
                style={{
                  paddingHorizontal: spacing[24],
                  paddingBottom: spacing[24],
                }}
              >
                <TextInput
                  style={{
                    backgroundColor: "#2C2C2E",
                    borderRadius: 12,
                    padding: spacing[16],
                    fontSize: 17,
                    color: colors.white,
                    borderWidth: 0.5,
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                  placeholder="#FF5733"
                  placeholderTextColor={colors.textMuted}
                  value={colorEditValue}
                  onChangeText={setColorEditValue}
                  autoFocus
                  selectTextOnFocus
                  autoCapitalize="characters"
                />
              </View>
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Keyboard Done Button ───────────────────────────────────── */}
      {keyboardVisible && !isModalActive && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: animBottom,
            left: spacing[20],
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Keyboard.dismiss()}
            style={styles.kbDoneBtn}
          >
            <AppText variant="callout" weight="700" color={colors.white}>
              Done
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: spacing[8],
    zIndex: 2,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnContainer: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing[8],
    gap: 16,
  },

  // Hero
  heroWrap: {
    alignItems: "center",
    paddingTop: spacing[12],
    paddingBottom: spacing[4],
  },
  heroCard: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: spacing[28],
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[8],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  pencilCircle: {
    position: "absolute",
    top: spacing[16],
    right: spacing[16],
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroNamePill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: spacing[8],
    borderRadius: 999,
  },
  heroStatus: { color: "rgba(255, 255, 255, 0.8)" },

  // Segment
  segmentContainer: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 3,
    flexDirection: "row",
  },
  segmentTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  segmentTabActive: {
    backgroundColor: "#2C2C2E",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },

  // Amount
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1C1C1E",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 58,
  },
  amountRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  amountInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
    marginRight: spacing[12],
  },
  selectorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  // Helper
  helperText: { color: colors.textMuted, paddingHorizontal: 4, marginTop: -4 },

  // Advanced sections — reduced visual weight
  advancedSection: { opacity: 0.92 },

  // Notes
  notesInput: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
    textAlignVertical: "top",
    minHeight: 80,
    paddingHorizontal: spacing[4],
  },

  // Section sub-label (SPLIT TYPE, NOTE, etc.)
  sectionLabel: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
    paddingBottom: spacing[8],
    letterSpacing: 0.7,
  },

  // Full-width segmented control
  segmentRow: {
    flexDirection: "row",
    marginBottom: spacing[8],
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
  },
  segmentBtnTextActive: { color: "#000000" },

  // Big number input (people count, price, duration)
  bigNumberInput: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -1,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[12],
    paddingTop: 0,
  },

  // Customization sheet
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetDoneBtn: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    width: "100%",
  },
  sheetDoneBtnText: { color: "#000000" },
  sheetScroll: { gap: 24, paddingBottom: 40 },
  previewCard: {
    height: 260,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing[8],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  previewNamePill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: spacing[8],
    borderRadius: 999,
  },
  pickerSection: { gap: 10 },
  colorRow: { gap: 12, paddingVertical: 4 },
  colorBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  colorBubbleActiveInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
  },
  colorBubbleCustom: {
    backgroundColor: "#2C2C2E",
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  logoVariationRow: { flexDirection: "row", gap: 16, paddingVertical: 4 },
  logoVarItem: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 999,
    padding: 2,
  },
  logoVarItemActive: { borderColor: colors.accent },
  badgeLogoWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetButtonsRow: { flexDirection: "row", gap: 12, marginTop: spacing[8] },
  sheetActionButton: {
    flex: 1,
    backgroundColor: "#2C2C2E",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: spacing[8],
  },
  sheetActionIcon: { fontSize: 28 },

  // Dropdown — iOS action sheet style
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  dropdownSheet: {
    marginHorizontal: 12,
    maxHeight: "74%",
    gap: 8,
  },
  dropdownCard: {
    backgroundColor: "#2C2C2E",
    borderRadius: 18,
    overflow: "hidden",
    maxHeight: "84%",
  },
  dropdownHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  dropdownTitle: { textAlign: "center", letterSpacing: 0 },
  dropdownRow: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
  },
  dropdownRowLast: { borderBottomWidth: 0 },
  dropdownOptionText: { textAlign: "center", color: colors.white },
  dropdownOptionTextSelected: { color: "#0A84FF" },
  dropdownCancel: {
    backgroundColor: "#2C2C2E",
    borderRadius: 18,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownDismissArea: { ...StyleSheet.absoluteFill },

  // Custom cycle
  customCycleCard: {
    width: "86%",
    backgroundColor: "#1C1C1E",
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    alignSelf: "center",
    marginBottom: 32,
  },
  customCycleBody: { padding: 24, gap: 20 },
  customCycleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 64,
  },
  customCycleInputLabel: { marginRight: spacing[8] },
  customCycleInput: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    color: colors.white,
    fontWeight: "700",
    padding: 0,
  },
  customCycleUnitRow: {
    flexDirection: "row",
    backgroundColor: "#2C2C2E",
    borderRadius: 18,
    padding: 4,
    height: 52,
  },
  customCycleUnitTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  customCycleUnitTabActive: { backgroundColor: "#3A3A3C" },
  customCycleSaveBtn: {
    height: 58,
    backgroundColor: colors.white,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[8],
  },

  // Date picker
  datePickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  datePickerModal: {
    position: "absolute",
    left: 36,
    right: 36,
    top: "45%",
    backgroundColor: "rgba(36, 36, 38, 0.82)",
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 12,
  },
  datePickerModalRelative: {
    width: "100%",
    backgroundColor: "rgba(36, 36, 38, 0.82)",
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 12,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 12,
  },
  datePickerCancelBtn: { paddingVertical: spacing[8], paddingHorizontal: 12 },
  datePickerDoneBtn: {
    paddingVertical: spacing[8],
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
  },
  datePickerBody: {
    paddingHorizontal: 22,
    paddingTop: spacing[8],
    paddingBottom: 22,
  },
  calendarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: spacing[12],
  },
  calendarMonthGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  calendarMonthTitle: { flexShrink: 1 },
  calendarNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
  },
  calendarArrowBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  weekdayRow: { flexDirection: "row", marginBottom: 16 },
  weekdayText: { flex: 1, textAlign: "center", letterSpacing: 0 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayButtonSelected: { backgroundColor: "#3A3A3C" },
  calendarDayText: { textAlign: "center" },
  monthYearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: spacing[8],
  },
  monthYearGridItem: {
    width: "30%",
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  monthYearGridItemActive: {
    backgroundColor: "#3A3A3C",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },

  // Keyboard done
  kbDoneBtn: {
    backgroundColor: "rgba(30, 30, 30, 0.88)",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
