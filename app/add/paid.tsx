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
  KeyboardAvoidingView,
  Platform,
  Animated,
  type ScrollView as RNScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Pencil, ChevronRight, ArrowUpDown, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format, addMonths, addYears } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";

import { colors, spacing, hexToRGBA } from "@/constants";
import { AppText, LogoCircle, SwipeDownSheet, Toggle, PressableScale } from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

const PRESET_COLORS = [
  "#E50914", // Netflix Red
  "#1DB954", // Spotify Green
  "#007AFF", // Apple Blue
  "#4285F4", // Google Blue
  "#00A8E1", // Disney Teal
  "#FF9900", // Amazon Orange
  "#4A154B", // Slack Purple
  "#FF9500", // Warning Orange
  "#58CC02", // Duolingo Green
  "#AF52DE", // System Purple
];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfCalendarMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function UnifiedFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addSubscription, updateSubscription, subscriptions } = useSubscriptionStore();

  const { name, category: initialCategory, brandColor, website, logo, editId } = useLocalSearchParams<{
    name: string;
    category: string;
    brandColor: string;
    website: string;
    logo: string;
    editId?: string;
  }>();

  const isEditMode = Boolean(editId);
  const existingSub = isEditMode ? subscriptions.find((s) => s.id === editId) : null;

  // --- Dynamic Style States ---
  const [selectedColor, setSelectedColor] = useState(() => existingSub?.color || brandColor || colors.accent);
  const [customLogoUrl, setCustomLogoUrl] = useState(() => existingSub?.logoUrl || logo || "");
  const [logoStyle, setLogoStyle] = useState<"default" | "badge" | "initial">("default");
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<"currency" | "cycle" | "payment" | "category" | "reminder" | null>(null);

  // --- Form Input States ---
  const [isTrial, setIsTrial] = useState(existingSub ? existingSub.isTrial : false);
  const [customName, setCustomName] = useState(() => existingSub?.name || name || "Subscription");
  const [amount, setAmount] = useState(() => existingSub ? String(existingSub.price) : "");
  const [currency, setCurrency] = useState(() => {
    if (!existingSub) return "INR";
    return (existingSub.currency || "INR").slice(0, 3).toUpperCase();
  });
  const [startDate, setStartDate] = useState(() => existingSub ? new Date(existingSub.startDate || existingSub.createdAt) : new Date());
  const [trialEndDate, setTrialEndDate] = useState(() => existingSub?.trialEndDate ? new Date(existingSub.trialEndDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const [renewing, setRenewing] = useState(() => existingSub ? existingSub.price > 0 : true);
  const [billingCycle, setBillingCycle] = useState(() => {
    if (!existingSub) return "monthly";
    return existingSub.rawBillingCycle || existingSub.billingCycle || "monthly";
  });

  const [showCustomCycleModal, setShowCustomCycleModal] = useState(false);
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [nameEditValue, setNameEditValue] = useState("");
  const [showColorEditModal, setShowColorEditModal] = useState(false);
  const [colorEditValue, setColorEditValue] = useState("");
  const [activeDatePicker, setActiveDatePicker] = useState<"startDate" | "trialEnd" | null>(null);
  const [calendarMode, setCalendarMode] = useState<"days" | "months" | "years">("days");

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const animBottom = useRef(new Animated.Value(0)).current;

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
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        animBottom.setValue(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const getYearRangeStart = (date: Date) => {
    return date.getFullYear() - 5;
  };
  const [calendarMonth, setCalendarMonth] = useState(() => startOfCalendarMonth(startDate));
  const [calendarSnapshot, setCalendarSnapshot] = useState<{ startDate: Date; trialEndDate: Date } | null>(null);
  const [customCycleVal, setCustomCycleVal] = useState(() => {
    if (existingSub?.rawBillingCycle?.startsWith("custom:")) {
      return existingSub.rawBillingCycle.split(":")[1] || "1";
    }
    return "1";
  });
  const [customCycleUnit, setCustomCycleUnit] = useState<"days" | "weeks" | "months" | "years">(() => {
    if (existingSub?.rawBillingCycle?.startsWith("custom:")) {
      return (existingSub.rawBillingCycle.split(":")[2] || "months") as any;
    }
    return "months";
  });

  const formatBillingCycleLabel = (cycle: string) => {
    if (!cycle) return "Monthly";
    if (cycle === "custom") return "Custom";
    if (cycle.startsWith("custom:")) {
      const parts = cycle.split(":");
      const val = parts[1] || "1";
      const unit = parts[2] || "months";
      const unitCapitalized = unit.charAt(0).toUpperCase() + unit.slice(1);
      return `Every ${val} ${unitCapitalized}`;
    }
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  };
  const [paymentMethod, setPaymentMethod] = useState(() => existingSub?.paymentMethod || "None");
  const [category, setCategory] = useState(() => existingSub?.category ? (existingSub.category.charAt(0).toUpperCase() + existingSub.category.slice(1)) : (initialCategory || "Entertainment"));
  const [reminderEnabled, setReminderEnabled] = useState(() => existingSub ? existingSub.reminderEnabled : true);
  const [reminderDays, setReminderDays] = useState(() => existingSub ? existingSub.reminderDays : 1);
  const [autoRenew, setAutoRenew] = useState(() => existingSub ? existingSub.price > 0 : true);
  const [notes, setNotes] = useState(() => existingSub?.note || "");

  const scrollRef = useRef<RNScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);

  // When the notes field is focused, lift it above the on-screen keyboard.
  // Only scroll when the notes field specifically is focused, not on every keyboard show.
  // (The Notes field's own onFocus handler handles the scroll.)

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
    return [...blanks, ...days];
  }, [calendarMonth]);

  const selectedCalendarDate = activeDatePicker === "trialEnd" ? trialEndDate : startDate;

  const openDatePicker = (picker: "startDate" | "trialEnd") => {
    const date = picker === "trialEnd" ? trialEndDate : startDate;
    setCalendarMonth(startOfCalendarMonth(date));
    setCalendarSnapshot({ startDate: new Date(startDate), trialEndDate: new Date(trialEndDate) });
    setCalendarMode("days");
    setActiveDatePicker(picker);
  };

  const handleCalendarDateSelect = (date: Date) => {
    Haptics.selectionAsync();
    if (activeDatePicker === "trialEnd") {
      setTrialEndDate(date);
    } else {
      setStartDate(date);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    router.back();
  };

  const handleEditName = () => {
    Haptics.selectionAsync();
    setNameEditValue(customName);
    setShowNameEditModal(true);
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

    setIsSaving(true);

    // Compute nextBillingDate
    let nextDate: Date | null = startDate;
    if (isTrial) {
      nextDate = trialEndDate;
    } else if (!renewing) {
      nextDate = null;
    } else {
      const cycle = billingCycle;
      if (cycle === "monthly") {
        nextDate = addMonths(startDate, 1);
      } else if (cycle === "yearly") {
        nextDate = addYears(startDate, 1);
      } else if (cycle === "quarterly") {
        nextDate = addMonths(startDate, 3);
      } else if (cycle === "semi-yearly") {
        nextDate = addMonths(startDate, 6);
      } else if (cycle === "weekly") {
        nextDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (cycle === "bi-weekly") {
        nextDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      } else if (cycle.startsWith("custom:")) {
        const parts = cycle.split(":");
        const val = Number(parts[1]) || 1;
        const unit = parts[2] || "months";
        if (unit === "days") {
          nextDate = new Date(startDate.getTime() + val * 24 * 60 * 60 * 1000);
        } else if (unit === "weeks") {
          nextDate = new Date(startDate.getTime() + val * 7 * 24 * 60 * 60 * 1000);
        } else if (unit === "months") {
          nextDate = addMonths(startDate, val);
        } else if (unit === "years") {
          nextDate = addYears(startDate, val);
        }
      } else {
        nextDate = addMonths(startDate, 1);
      }
    }

    const normalizedBillingCycle = billingCycle.startsWith("custom:")
      ? "custom"
      : billingCycle.toLowerCase();

    const input = {
      name: customName,
      color: selectedColor,
      logoUrl: logoStyle === "initial" ? undefined : (customLogoUrl || undefined),
      price: isTrial ? (autoRenew ? Number(amount || 0) : 0) : Number(amount || 0),
      currency: currency.slice(0, 3).toUpperCase(),
      billingCycle: normalizedBillingCycle as any,
      rawBillingCycle: billingCycle,
      customIntervalMonths: billingCycle.startsWith("custom:") ? (Number(customCycleVal) || 1) : undefined,
      nextBillingDate: nextDate ? nextDate.toISOString() : startDate.toISOString(),
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
    };

    try {
      if (isEditMode && editId) {
        await updateSubscription(editId, input);
      } else {
        await addSubscription(input);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissAll();
    } catch (e) {
      console.error("Save subscription failed:", e);
      Alert.alert("Save Failed", "Could not save subscription. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper labels
  const getCurrencySymbol = (code: string) => {
    if (code === "INR") return "₹";
    if (code === "USD") return "$";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    if (code === "JPY") return "¥";
    if (code === "CAD" || code === "AUD") return "$";
    return "$";
  };

  const formatReminderLabel = (days: number) => {
    if (days === 0) return "Same Day";
    if (days === 1) return "1 Day Before";
    return `${days} Days Before`;
  };

  // Compute renew preview message
  const nextRenewalLabelText = useMemo(() => {
    if (isTrial) {
      return `Trial starts on ${format(startDate, "MMM d")}. Ends on ${format(trialEndDate, "MMM d, yyyy")}.`;
    }
    const startStr = format(startDate, "MMM d");
    let nextDate = startDate;
    const cycle = billingCycle;
    if (cycle === "monthly") {
      nextDate = addMonths(startDate, 1);
    } else if (cycle === "yearly") {
      nextDate = addYears(startDate, 1);
    } else if (cycle === "quarterly") {
      nextDate = addMonths(startDate, 3);
    } else if (cycle === "semi-yearly") {
      nextDate = addMonths(startDate, 6);
    } else if (cycle === "weekly") {
      nextDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (cycle === "bi-weekly") {
      nextDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    } else if (cycle.startsWith("custom:")) {
      const parts = cycle.split(":");
      const val = Number(parts[1]) || 1;
      const unit = parts[2] || "months";
      if (unit === "days") {
        nextDate = new Date(startDate.getTime() + val * 24 * 60 * 60 * 1000);
      } else if (unit === "weeks") {
        nextDate = new Date(startDate.getTime() + val * 7 * 24 * 60 * 60 * 1000);
      } else if (unit === "months") {
        nextDate = addMonths(startDate, val);
      } else if (unit === "years") {
        nextDate = addYears(startDate, val);
      }
    } else {
      nextDate = addMonths(startDate, 1);
    }
    const endStr = format(nextDate, "MMM d, yyyy");
    if (!renewing) {
      return `Starts on ${startStr}. One-time payment of ${getCurrencySymbol(currency)}${Number(amount || 0).toFixed(2)}.`;
    }
    return `Starts on ${startStr}. Renews on ${endStr} at ${getCurrencySymbol(currency)}${Number(amount || 0).toFixed(2)}.`;
  }, [startDate, billingCycle, currency, amount, isTrial, trialEndDate, renewing]);

  return (
    <View
      style={styles.container}
    >
      {/* Large soft brand-color wash behind the hero — bleeds into the screen */}
      <LinearGradient
        colors={[hexToRGBA(selectedColor, 0.55), hexToRGBA(selectedColor, 0.18), "rgba(0, 0, 0, 0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      {/* Navbar Title row */}
      <View style={[styles.navbar, { paddingTop: insets.top + spacing[8] }]}>
        <PressableScale onPress={handleBack} scale={0.9} style={styles.navCircleBtn}>
          <ChevronLeft size={24} color={colors.white} strokeWidth={2.5} />
        </PressableScale>
        <AppText variant="title3" weight="700" color={colors.white}>
          {isEditMode ? "Edit" : "New"}
        </AppText>
        <PressableScale onPress={handleSave} scale={0.92} style={styles.addBtnContainer}>
          <AppText variant="subheadline" weight="700" color={colors.black}>
            {isEditMode ? "Save" : "Add"}
          </AppText>
        </PressableScale>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 44 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[40] }]}
        >
        {/* Service Hero Card — tall poster */}
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
              source={logoStyle === "initial" ? undefined : (customLogoUrl || undefined)}
              name={logoStyle === "initial" ? "" : customName}
              color={logoStyle === "badge" ? "#FFFFFF" : selectedColor}
              size={96}
              bordered={logoStyle === "default"}
              website={website}
            />
            <PressableScale onPress={handleEditName} scale={0.96} style={styles.heroNamePill}>
              <AppText variant="title3" weight="700" color={colors.white}>
                {customName}
              </AppText>
            </PressableScale>
            <AppText variant="footnote" style={styles.heroStatus}>
              {isTrial ? "Free trial subscription" : `Starts ${format(startDate, "MMM d")}`}
            </AppText>
          </View>
        </View>

        {/* Paid / Free Trial Switch Segment */}
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

        {/* Dynamic fields */}
        {(!isTrial || autoRenew) && (
          /* Amount block row */
          <View style={styles.amountCard}>
            <AppText variant="subheadline" weight="600" color={colors.white} style={styles.fieldLabel}>
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
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: 130, animated: true });
                  }, 100);
                }}
              />
              <PressableScale onPress={handleCurrencyPress} scale={0.92} style={styles.selectorPill}>
                <AppText variant="caption1" weight="700" color={colors.white}>
                  {currency} ({getCurrencySymbol(currency)})
                </AppText>
                <ArrowUpDown size={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </PressableScale>
            </View>
          </View>
        )}

        {/* Billing Cards details */}
        <View style={styles.sectionCard}>
          {isTrial ? (
            /* Trial fields */
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  openDatePicker("startDate");
                }}
                style={styles.cardRow}
              >
                <AppText variant="subheadline" weight="600" color={colors.white}>Start date</AppText>
                <AppText variant="callout" color={colors.textSecondary} weight="500">
                  {format(startDate, "MMMM d, yyyy")}
                </AppText>
              </TouchableOpacity>
              <View style={styles.rowDivider} />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  openDatePicker("trialEnd");
                }}
                style={styles.cardRow}
              >
                <AppText variant="subheadline" weight="600" color={colors.white}>Trial ends</AppText>
                <AppText variant="callout" color={colors.textSecondary} weight="500">
                  {format(trialEndDate, "MMMM d, yyyy")}
                </AppText>
              </TouchableOpacity>
              <View style={styles.rowDivider} />
              <View style={styles.cardRow}>
                <AppText variant="subheadline" weight="600" color={colors.white}>Auto renew</AppText>
                <View style={styles.switchSlot}>
                  <Toggle
                    value={autoRenew}
                    onValueChange={setAutoRenew}
                  />
                </View>
              </View>
            </>
          ) : (
            /* Paid fields */
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  openDatePicker("startDate");
                }}
                style={styles.cardRow}
              >
                <AppText variant="subheadline" weight="600" color={colors.white}>Start date</AppText>
                <AppText variant="callout" color={colors.textSecondary} weight="500">
                  {format(startDate, "MMMM d, yyyy")}
                </AppText>
              </TouchableOpacity>
              <View style={styles.rowDivider} />
              <View style={styles.cardRow}>
                <AppText variant="subheadline" weight="600" color={colors.white}>Renewing</AppText>
                <View style={styles.switchSlot}>
                  <Toggle
                    value={renewing}
                    onValueChange={setRenewing}
                  />
                </View>
              </View>
              {renewing && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.cardRow}>
                    <AppText variant="subheadline" weight="600" color={colors.white}>Billing cycle</AppText>
                    <PressableScale onPress={handleCyclePress} scale={0.92} style={styles.selectorPill}>
                      <AppText variant="caption1" weight="700" color={colors.white}>
                        {formatBillingCycleLabel(billingCycle)}
                      </AppText>
                      <ArrowUpDown size={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                    </PressableScale>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <AppText variant="caption1" style={styles.helperText}>{nextRenewalLabelText}</AppText>

        {/* Payment info Card */}
        <View style={styles.sectionCard}>
          {!isTrial && (
            <>
              <TouchableOpacity onPress={handlePaymentMethodPress} style={styles.cardRow}>
                <AppText variant="subheadline" weight="600" color={colors.white}>Payment method</AppText>
                <View style={styles.arrowRowRight}>
                  <AppText variant="callout" color={colors.textSecondary} weight="500">{paymentMethod}</AppText>
                  <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
              <View style={styles.rowDivider} />
            </>
          )}
          <TouchableOpacity onPress={handleCategoryPress} style={styles.cardRow}>
            <AppText variant="subheadline" weight="600" color={colors.white}>Category</AppText>
            <View style={styles.arrowRowRight}>
              <AppText variant="callout" color={colors.textSecondary} weight="500">{category}</AppText>
              <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Renewal Reminder Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardRow}>
            <AppText variant="subheadline" weight="600" color={colors.white}>Payment reminder</AppText>
            <View style={styles.switchSlot}>
              <Toggle
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
              />
            </View>
          </View>
          {reminderEnabled && (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity onPress={handleReminderOffsetPress} style={styles.cardRow}>
                <AppText variant="subheadline" weight="600" color={colors.white}>Remind offset</AppText>
                <View style={styles.arrowRowRight}>
                  <AppText variant="callout" color={colors.textSecondary} weight="500">
                    {formatReminderLabel(reminderDays)}
                  </AppText>
                  <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Notes Input block */}
        <View style={styles.sectionCard}>
          <View style={[styles.cardRow, { height: "auto", minHeight: 120, alignItems: "flex-start", paddingVertical: spacing[12] }]}>
            <TextInput
              ref={notesInputRef}
              style={styles.notesInput}
              placeholder="Notes (Optional)"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              multiline
              numberOfLines={5}
            />
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic Slide-Up Bottom Customization Sheet — iOS swipe-down to dismiss */}
      <SwipeDownSheet
        visible={customizeVisible}
        onClose={() => setCustomizeVisible(false)}
        containerStyle={{ paddingBottom: insets.bottom + spacing[20], paddingHorizontal: spacing[20] }}
      >
        <View style={styles.sheetHeader}>
          <View style={{ width: 24 }} />
          <AppText variant="title3" weight="700" color={colors.white}>Customize</AppText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
          {/* Card Preview */}
          <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
            <LogoCircle
              source={logoStyle === "initial" ? undefined : (customLogoUrl || undefined)}
              name={logoStyle === "initial" ? "" : customName}
              color={logoStyle === "badge" ? "#FFFFFF" : selectedColor}
              size={112}
              bordered={logoStyle === "default"}
              website={website}
            />
            <TouchableOpacity onPress={handleEditName} style={styles.previewNamePill}>
              <AppText variant="subheadline" weight="700" color={colors.white}>
                {customName}
              </AppText>
            </TouchableOpacity>
          </View>

          {/* Color Picker Row */}
          <View style={styles.pickerSection}>
            <AppText variant="subheadline" weight="600" color={colors.textSecondary}>Card Background</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
              {PRESET_COLORS.map((c) => {
                const isActive = selectedColor.toLowerCase() === c.toLowerCase();
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

          {/* Logo Style Variations Row */}
          <View style={styles.pickerSection}>
            <AppText variant="subheadline" weight="600" color={colors.textSecondary}>Logo Style</AppText>
            <View style={styles.logoVariationRow}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLogoStyle("default");
                }}
                style={[styles.logoVarItem, logoStyle === "default" && styles.logoVarItemActive]}
              >
                <LogoCircle source={customLogoUrl || undefined} name={customName} color={selectedColor} size={48} bordered website={website} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLogoStyle("badge");
                }}
                style={[styles.logoVarItem, logoStyle === "badge" && styles.logoVarItemActive]}
              >
                <View style={styles.badgeLogoWrapper}>
                  <LogoCircle source={customLogoUrl || undefined} name={customName} color="#FFFFFF" size={48} website={website} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setLogoStyle("initial");
                }}
                style={[styles.logoVarItem, logoStyle === "initial" && styles.logoVarItemActive]}
              >
                <LogoCircle name={customName} color={selectedColor} size={48} website={website} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Icon Picker / Custom Image Buttons */}
          <View style={styles.sheetButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                Alert.alert(
                  "Pick Icon",
                  "Choose an emoji to represent this service:",
                  [
                    { text: "🍿 Popcorn", onPress: () => { setCustomLogoUrl("🍿"); setLogoStyle("default"); } },
                    { text: "🎵 Music", onPress: () => { setCustomLogoUrl("🎵"); setLogoStyle("default"); } },
                    { text: "🎮 Gaming", onPress: () => { setCustomLogoUrl("🎮"); setLogoStyle("default"); } },
                    { text: "🤖 Tech/AI", onPress: () => { setCustomLogoUrl("🤖"); setLogoStyle("default"); } },
                    { text: "📚 Study", onPress: () => { setCustomLogoUrl("📚"); setLogoStyle("default"); } },
                    { text: "Cancel", style: "cancel" }
                  ]
                );
              }}
              style={styles.sheetActionButton}
            >
              <AppText variant="title3" style={styles.sheetActionIcon}>🍿</AppText>
              <AppText variant="subheadline" weight="700" color={colors.white}>Pick icon</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                Haptics.selectionAsync();
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== "granted") {
                  Alert.alert("Permission Required", "Please grant photo library access to choose an image.");
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
              <AppText variant="title3" style={styles.sheetActionIcon}>🖼️</AppText>
              <AppText variant="subheadline" weight="700" color={colors.white}>Choose image</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>

          <PressableScale
            onPress={() => setCustomizeVisible(false)}
            scale={0.97}
            style={styles.sheetDoneBtn}
          >
            <AppText variant="callout" weight="700" style={styles.sheetDoneBtnText}>
              Done
            </AppText>
          </PressableScale>
      </SwipeDownSheet>

      {/* Beautiful iOS Translucent Dropdown Modal */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownDismissArea}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          />
          <View style={styles.dropdownCard}>
            {(() => {
              const data = (() => {
                switch (activePicker) {
                  case "currency":
                    return {
                      title: "Popular currencies",
                      selectedValue: currency,
                      onSelect: (val: string) => setCurrency(val),
                      options: [
                        { label: "INR (₹)", value: "INR" },
                        { label: "USD ($)", value: "USD" },
                        { label: "EUR (€)", value: "EUR" },
                        { label: "GBP (£)", value: "GBP" },
                        { label: "JPY (¥)", value: "JPY" },
                        { label: "AUD ($)", value: "AUD" },
                        { label: "CAD ($)", value: "CAD" },
                      ],
                    };
                  case "cycle":
                    return {
                      title: "Billing cycle",
                      selectedValue: billingCycle.startsWith("custom:") ? "custom" : billingCycle,
                      onSelect: (val: string) => {
                        if (val === "custom") {
                          setActivePicker(null);
                          setShowCustomCycleModal(true);
                        } else {
                          setBillingCycle(val as any);
                        }
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
                      title: "Payment method",
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
                      title: "Remind offset",
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
                  <View style={styles.dropdownHeader}>
                    <AppText variant="caption1" weight="700" color={colors.textSecondary} style={styles.dropdownTitle}>
                      {data.title}
                    </AppText>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {data.options.map((opt, idx) => {
                      const isSelected = String(data.selectedValue).toLowerCase() === opt.value.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.dropdownRow,
                            idx === data.options.length - 1 && styles.dropdownRowLast,
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            data.onSelect(opt.value);
                            setActivePicker(null);
                          }}
                        >
                          <AppText
                            variant="subheadline"
                            weight={isSelected ? "700" : "500"}
                            color={isSelected ? colors.white : "rgba(255, 255, 255, 0.7)"}
                          >
                            {opt.label}
                          </AppText>
                          {isSelected && (
                            <Check size={18} color={colors.accent} strokeWidth={2.5} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Premium iOS style Custom Cycle Dialog Modal */}
      <Modal
        visible={showCustomCycleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomCycleModal(false)}
      >
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownDismissArea}
            activeOpacity={1}
            onPress={() => setShowCustomCycleModal(false)}
          />
          <View style={styles.customCycleCard}>
            <View style={styles.dropdownHeader}>
              <AppText variant="caption1" weight="700" color={colors.textSecondary} style={styles.dropdownTitle}>
                Custom Billing Cycle
              </AppText>
            </View>
            <View style={styles.customCycleBody}>
              <View style={styles.customCycleInputRow}>
                <AppText variant="subheadline" color={colors.textSecondary}>Every</AppText>
                <TextInput
                  style={styles.customCycleInput}
                  keyboardType="numeric"
                  value={customCycleVal}
                  onChangeText={(val) => setCustomCycleVal(val.replace(/[^0-9]/g, ""))}
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
                      style={[styles.customCycleUnitTab, isAct && styles.customCycleUnitTabActive]}
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
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  const valNum = Number(customCycleVal) || 1;
                  setBillingCycle(`custom:${valNum}:${customCycleUnit}`);
                  setShowCustomCycleModal(false);
                }}
                style={styles.customCycleSaveBtn}
              >
                <AppText variant="subheadline" weight="700" color={colors.black}>
                  Save
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
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
              <AppText variant="callout" weight="600" color={colors.textSecondary}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setCalendarSnapshot(null);
                setActiveDatePicker(null);
              }}
              style={styles.datePickerDoneBtn}
            >
              <AppText variant="callout" weight="700" color={colors.black}>Done</AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.datePickerBody}>
            <View style={styles.calendarTitleRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (calendarMode === "days") {
                    setCalendarMode("months");
                  } else if (calendarMode === "months") {
                    setCalendarMode("years");
                  } else {
                    setCalendarMode("days");
                  }
                }}
                style={styles.calendarMonthGroup}
              >
                <AppText variant="title2" weight="700" color={colors.white}>
                  {calendarMode === "days"
                    ? format(calendarMonth, "MMMM yyyy")
                    : calendarMode === "months"
                    ? format(calendarMonth, "yyyy")
                    : `${getYearRangeStart(calendarMonth)} - ${getYearRangeStart(calendarMonth) + 11}`}
                </AppText>
                <ChevronRight
                  size={16}
                  color={colors.textSecondary}
                  style={{
                    marginLeft: 6,
                    transform: [{ rotate: calendarMode === "days" ? "0deg" : calendarMode === "months" ? "90deg" : "180deg" }],
                  }}
                />
              </TouchableOpacity>
              <View style={styles.calendarNavGroup}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (calendarMode === "days") {
                      setCalendarMonth((date) => addMonths(date, -1));
                    } else if (calendarMode === "months") {
                      setCalendarMonth((date) => addYears(date, -1));
                    } else {
                      setCalendarMonth((date) => addYears(date, -12));
                    }
                  }}
                  style={styles.calendarArrowBtn}
                >
                  <ChevronLeft size={30} color={colors.white} strokeWidth={3} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (calendarMode === "days") {
                      setCalendarMonth((date) => addMonths(date, 1));
                    } else if (calendarMode === "months") {
                      setCalendarMonth((date) => addYears(date, 1));
                    } else {
                      setCalendarMonth((date) => addYears(date, 12));
                    }
                  }}
                  style={styles.calendarArrowBtn}
                >
                  <ChevronRight size={30} color={colors.white} strokeWidth={3} />
                </TouchableOpacity>
              </View>
            </View>

            {calendarMode === "days" && (
              <>
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((day) => (
                    <AppText key={day} variant="caption1" weight="700" color={colors.textSecondary} style={styles.weekdayText}>
                      {day}
                    </AppText>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((date, index) => {
                    const selected = date ? isSameCalendarDay(date, selectedCalendarDate) : false;
                    return (
                      <View key={date ? date.toISOString() : `blank-${index}`} style={styles.calendarDayCell}>
                        {date && (
                          <PressableScale
                            onPress={() => handleCalendarDateSelect(date)}
                            scale={0.88}
                            style={[styles.calendarDayButton, selected && styles.calendarDayButtonSelected]}
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
                  const currentMonthIdx = calendarMonth.getMonth();
                  const isCurrent = idx === currentMonthIdx;
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
                  const startYear = getYearRangeStart(calendarMonth);
                  const targetYear = startYear + idx;
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

      {/* Name Edit Modal (cross-platform) */}
      <Modal
        visible={showNameEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameEditModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.datePickerBackdrop}
          onPress={() => setShowNameEditModal(false)}
        />
        <BlurView intensity={80} tint="dark" style={styles.datePickerModal}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity onPress={() => setShowNameEditModal(false)} style={styles.datePickerCancelBtn}>
              <AppText variant="callout" weight="600" color={colors.textSecondary}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (nameEditValue.trim()) setCustomName(nameEditValue.trim());
                setShowNameEditModal(false);
              }}
              style={styles.datePickerDoneBtn}
            >
              <AppText variant="callout" weight="700" color={colors.black}>Done</AppText>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: spacing[24], paddingBottom: spacing[24] }}>
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
              placeholder="Subscription name"
              placeholderTextColor={colors.textMuted}
              value={nameEditValue}
              onChangeText={setNameEditValue}
              autoFocus
              selectTextOnFocus
            />
          </View>
        </BlurView>
      </Modal>

      {/* Color Edit Modal (cross-platform) */}
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
        <BlurView intensity={80} tint="dark" style={styles.datePickerModal}>
          <View style={styles.datePickerHeader}>
            <TouchableOpacity onPress={() => setShowColorEditModal(false)} style={styles.datePickerCancelBtn}>
              <AppText variant="callout" weight="600" color={colors.textSecondary}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const hexPattern = /^#[0-9A-Fa-f]{6}$/;
                if (hexPattern.test(colorEditValue)) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setSelectedColor(colorEditValue);
                  setShowColorEditModal(false);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert("Invalid Color", "Please enter a valid hex color (e.g. #FF5733)");
                }
              }}
              style={styles.datePickerDoneBtn}
            >
              <AppText variant="callout" weight="700" color={colors.black}>Done</AppText>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: spacing[24], paddingBottom: spacing[24] }}>
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
      </Modal>

      {keyboardVisible && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: animBottom,
            right: spacing[20],
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Keyboard.dismiss()}
            style={{
              backgroundColor: "rgba(30, 30, 30, 0.88)",
              borderRadius: 24,
              paddingHorizontal: spacing[20],
              paddingVertical: 10,
              borderWidth: 0.5,
              borderColor: "rgba(255, 255, 255, 0.15)",
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
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
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
    gap: spacing[16],
  },
  // ── Hero (tall poster) ──────────────────────────────────────────────
  heroWrap: {
    alignItems: "center",
    paddingTop: spacing[16],
    paddingBottom: spacing[8],
  },
  heroCard: {
    width: "100%",
    borderRadius: 28,
    paddingVertical: spacing[32],
    paddingHorizontal: spacing[20],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[12],
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
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
    borderRadius: 999,
  },
  heroStatus: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  // ── Segmented control (chunky pill) ─────────────────────────────────
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
  // ── Amount ──────────────────────────────────────────────────────────
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1C1C1E",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    paddingHorizontal: spacing[20],
    height: 64,
  },
  fieldLabel: {},
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
  // ── Grouped cards ───────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: "#1C1C1E",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    paddingHorizontal: spacing[20],
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 58,
  },
  switchSlot: {
    width: 52,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  switchAlign: {
    alignSelf: "center",
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  arrowRowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  helperText: {
    color: colors.textMuted,
    paddingHorizontal: spacing[8],
    marginTop: -spacing[8],
  },
  notesInput: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
    textAlignVertical: "top",
    minHeight: 100,
  },
  // ── Modal Bottom Sheet ──────────────────────────────────────────────
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[20],
  },
  sheetDoneBtn: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[16],
    width: "100%",
  },
  sheetDoneBtnText: {
    color: "#000000",
  },
  sheetScroll: {
    gap: spacing[24],
    paddingBottom: spacing[40],
  },
  previewCard: {
    height: 260,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing[12],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  previewNamePill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: 999,
  },
  pickerSection: {
    gap: 10,
  },
  colorRow: {
    gap: 12,
    paddingVertical: 4,
  },
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
  logoVariationRow: {
    flexDirection: "row",
    gap: spacing[16],
    paddingVertical: 4,
  },
  logoVarItem: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 999,
    padding: 2,
  },
  logoVarItemActive: {
    borderColor: colors.accent,
  },
  badgeLogoWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetButtonsRow: {
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[8],
  },
  sheetActionButton: {
    flex: 1,
    backgroundColor: "#2C2C2E",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: spacing[16],
    alignItems: "center",
    gap: spacing[8],
  },
  sheetActionIcon: {
    fontSize: 28,
  },
  // ── Dropdown modal ──────────────────────────────────────────────────
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownDismissArea: {
    ...StyleSheet.absoluteFill,
  },
  dropdownCard: {
    width: "82%",
    maxHeight: "60%",
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  dropdownHeader: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  dropdownTitle: {
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    paddingHorizontal: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  dropdownRowLast: {
    borderBottomWidth: 0,
  },
  // ── Custom cycle dialog ─────────────────────────────────────────────
  customCycleCard: {
    width: "85%",
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  customCycleBody: {
    padding: spacing[20],
    gap: spacing[16],
  },
  customCycleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  customCycleInput: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
    fontWeight: "700",
  },
  customCycleUnitRow: {
    flexDirection: "row",
    backgroundColor: "#2C2C2E",
    borderRadius: 14,
    padding: 3,
    height: 44,
  },
  customCycleUnitTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  customCycleUnitTabActive: {
    backgroundColor: "#3A3A3C",
  },
  customCycleSaveBtn: {
    height: 50,
    backgroundColor: colors.white,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[8],
  },
  // ── Date Picker Modal ───────────────────────────────────────────────
  datePickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  datePickerModal: {
    position: "absolute",
    left: spacing[40],
    right: spacing[40],
    top: "46%",
    backgroundColor: "rgba(36, 36, 38, 0.78)",
    borderRadius: 28,
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
    paddingHorizontal: spacing[24],
    paddingTop: spacing[24],
    paddingBottom: spacing[16],
  },
  datePickerCancelBtn: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
  },
  datePickerDoneBtn: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
  },
  datePickerBody: {
    paddingHorizontal: spacing[24],
    paddingTop: spacing[8],
    paddingBottom: spacing[24],
  },
  calendarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[20],
  },
  calendarMonthGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  calendarNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[20],
  },
  calendarArrowBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: spacing[16],
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    letterSpacing: 0,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
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
  calendarDayButtonSelected: {
    backgroundColor: "#3A3A3C",
  },
  calendarDayText: {
    textAlign: "center",
  },
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
    marginBottom: spacing[12],
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  monthYearGridItemActive: {
    backgroundColor: "#3A3A3C",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
});
