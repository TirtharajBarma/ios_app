import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Pencil, ChevronRight, ArrowUpDown, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format, addMonths, addYears } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";

import { colors, spacing } from "@/constants";
import { AppText, LogoCircle } from "@/components/ui";
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
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showTrialEndDatePicker, setShowTrialEndDatePicker] = useState(false);
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

  const handleBack = () => {
    Keyboard.dismiss();
    Haptics.selectionAsync();
    router.back();
  };

  const handleEditName = () => {
    Haptics.selectionAsync();
    Alert.prompt(
      "Customize Name",
      "Enter custom name for this subscription:",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: (val?: string) => val && setCustomName(val.trim()) },
      ],
      "plain-text",
      customName
    );
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

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!customName.trim()) {
      Alert.alert("Error", "Please enter subscription name");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Compute nextBillingDate
    let nextDate = startDate;
    if (isTrial) {
      nextDate = trialEndDate;
    } else {
      if (billingCycle === "monthly") {
        nextDate = addMonths(startDate, 1);
      } else if (billingCycle === "yearly") {
        nextDate = addYears(startDate, 1);
      } else if (billingCycle === "weekly") {
        nextDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (billingCycle.startsWith("custom:")) {
        const parts = billingCycle.split(":");
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
        nextDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    const input = {
      name: customName,
      color: selectedColor,
      logoUrl: logoStyle === "initial" ? undefined : (customLogoUrl || undefined),
      price: isTrial ? (autoRenew ? Number(amount || 0) : 0) : Number(amount || 0),
      currency: currency,
      billingCycle: billingCycle.toLowerCase() as any,
      nextBillingDate: nextDate.toISOString(),
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
      router.dismissAll();
    } catch (e) {
      console.error("Save subscription failed:", e);
    }
  };

  // Helper labels
  const getCurrencySymbol = (code: string) => {
    if (code === "INR") return "₹";
    if (code === "USD") return "$";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    return "$";
  };

  const formatReminderLabel = (days: number) => {
    if (days === 0) return "Same Day";
    if (days === 1) return "1 Day Before";
    return `${days} Days Before`;
  };

  // Compute renew preview message
  const nextRenewalLabelText = useMemo(() => {
    const startStr = format(startDate, "MMM d");
    let nextDate = startDate;
    if (billingCycle === "monthly") {
      nextDate = addMonths(startDate, 1);
    } else if (billingCycle === "yearly") {
      nextDate = addYears(startDate, 1);
    } else if (billingCycle === "weekly") {
      nextDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (billingCycle.startsWith("custom:")) {
      const parts = billingCycle.split(":");
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
      nextDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    const endStr = format(nextDate, "MMM d, yyyy");
    return `Starts on ${startStr}. Renews on ${endStr} at ${getCurrencySymbol(currency)}${Number(amount || 0).toFixed(2)}.`;
  }, [startDate, billingCycle, currency, amount]);

  return (
    <View
      style={styles.container}
      onStartShouldSetResponder={() => {
        Keyboard.dismiss();
        return false;
      }}
    >
      {/* Dynamic Island status bar gradient glow */}
      <LinearGradient
        colors={["rgba(180, 50, 15, 0.8)", "rgba(0, 0, 0, 0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />

      {/* Navbar Title row */}
      <View style={[styles.navbar, { paddingTop: insets.top + spacing[12] }]}>
        <TouchableOpacity onPress={handleBack} style={styles.navCircleBtn}>
          <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
        <AppText style={styles.navbarTitle}>{isEditMode ? "Edit" : "New"}</AppText>
        <TouchableOpacity onPress={handleSave} style={styles.addBtnContainer}>
          <AppText weight="700" color={colors.white} style={styles.addBtnText}>
            {isEditMode ? "Save" : "Add"}
          </AppText>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[40] }]}
        >
        {/* Service Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: selectedColor }]}>
          <View style={styles.heroLeft}>
            <LogoCircle
              source={logoStyle === "initial" ? undefined : (customLogoUrl || undefined)}
              name={logoStyle === "initial" ? "" : customName}
              color={logoStyle === "badge" ? "#FFFFFF" : selectedColor}
              size={56}
              bordered={logoStyle === "default"}
            />
            <View style={styles.heroText}>
              <AppText weight="800" color={colors.white} style={styles.heroName}>
                {customName}
              </AppText>
              <AppText style={styles.heroStatus}>
                {isTrial ? "Free trial subscription" : "Starts today"}
              </AppText>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              Haptics.selectionAsync();
              setCustomizeVisible(true);
            }}
            style={styles.pencilCircle}
          >
            <Pencil size={15} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Paid / Free Trial Switch Segment */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentTab, !isTrial && styles.segmentTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setIsTrial(false);
            }}
          >
            <AppText
              weight="700"
              color={!isTrial ? colors.white : colors.textSecondary}
              style={styles.segmentText}
            >
              Paid
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentTab, isTrial && styles.segmentTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setIsTrial(true);
            }}
          >
            <AppText
              weight="700"
              color={isTrial ? colors.white : colors.textSecondary}
              style={styles.segmentText}
            >
              Free trial
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Dynamic fields */}
        {(!isTrial || autoRenew) && (
          /* Amount block row */
          <View style={styles.amountCard}>
            <AppText style={styles.fieldLabel}>Amount</AppText>
            <View style={styles.amountRight}>
              <TextInput
                style={styles.amountInput}
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <TouchableOpacity onPress={handleCurrencyPress} style={styles.selectorPill}>
                <AppText style={styles.selectorText}>
                  {currency} ({getCurrencySymbol(currency)})
                </AppText>
                <ArrowUpDown size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
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
                  setShowStartDatePicker((s) => !s);
                  setShowTrialEndDatePicker(false);
                }}
                style={styles.cardRow}
              >
                <AppText style={styles.fieldLabel}>Start date</AppText>
                <AppText style={styles.arrowValueText}>
                  {format(startDate, "MMMM d, yyyy")}
                </AppText>
              </TouchableOpacity>
              {showStartDatePicker && (
                <View style={styles.inlinePickerContainer}>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    themeVariant="dark"
                    onChange={(_, date) => date && setStartDate(date)}
                  />
                </View>
              )}
              <View style={styles.rowDivider} />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowTrialEndDatePicker((s) => !s);
                  setShowStartDatePicker(false);
                }}
                style={styles.cardRow}
              >
                <AppText style={styles.fieldLabel}>Trial ends</AppText>
                <AppText style={styles.arrowValueText}>
                  {format(trialEndDate, "MMMM d, yyyy")}
                </AppText>
              </TouchableOpacity>
              {showTrialEndDatePicker && (
                <View style={styles.inlinePickerContainer}>
                  <DateTimePicker
                    value={trialEndDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    themeVariant="dark"
                    onChange={(_, date) => date && setTrialEndDate(date)}
                  />
                </View>
              )}
              <View style={styles.rowDivider} />
              <View style={styles.cardRow}>
                <AppText style={styles.fieldLabel}>Auto renew</AppText>
                <Switch
                  value={autoRenew}
                  onValueChange={setAutoRenew}
                  trackColor={{ false: "#2C2C2E", true: colors.accent }}
                  thumbColor={colors.white}
                  style={Platform.OS === "ios" ? { marginRight: -2 } : undefined}
                />
              </View>
            </>
          ) : (
            /* Paid fields */
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowStartDatePicker((s) => !s);
                  setShowTrialEndDatePicker(false);
                }}
                style={styles.cardRow}
              >
                <AppText style={styles.fieldLabel}>Start date</AppText>
                <AppText style={styles.arrowValueText}>
                  {format(startDate, "MMMM d, yyyy")}
                </AppText>
              </TouchableOpacity>
              {showStartDatePicker && (
                <View style={styles.inlinePickerContainer}>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    themeVariant="dark"
                    onChange={(_, date) => date && setStartDate(date)}
                  />
                </View>
              )}
              <View style={styles.rowDivider} />
              <View style={styles.cardRow}>
                <AppText style={styles.fieldLabel}>Renewing</AppText>
                <Switch
                  value={renewing}
                  onValueChange={setRenewing}
                  trackColor={{ false: "#2C2C2E", true: colors.accent }}
                  thumbColor={colors.white}
                  style={Platform.OS === "ios" ? { marginRight: -2 } : undefined}
                />
              </View>
              {renewing && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.cardRow}>
                    <AppText style={styles.fieldLabel}>Billing cycle</AppText>
                    <TouchableOpacity onPress={handleCyclePress} style={styles.selectorPill}>
                      <AppText style={styles.selectorText}>
                        {formatBillingCycleLabel(billingCycle)}
                      </AppText>
                      <ArrowUpDown size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {!isTrial && (
          <AppText style={styles.helperText}>{nextRenewalLabelText}</AppText>
        )}

        {/* Payment info Card */}
        <View style={styles.sectionCard}>
          {!isTrial && (
            <>
              <TouchableOpacity onPress={handlePaymentMethodPress} style={styles.cardRow}>
                <AppText style={styles.fieldLabel}>Payment method</AppText>
                <View style={styles.arrowRowRight}>
                  <AppText style={styles.arrowValueText}>{paymentMethod}</AppText>
                  <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
              <View style={styles.rowDivider} />
            </>
          )}
          <TouchableOpacity onPress={handleCategoryPress} style={styles.cardRow}>
            <AppText style={styles.fieldLabel}>Category</AppText>
            <View style={styles.arrowRowRight}>
              <AppText style={styles.arrowValueText}>{category}</AppText>
              <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Renewal Reminder Card */}
        <View style={styles.sectionCard}>
          <View style={styles.cardRow}>
            <AppText style={styles.fieldLabel}>Payment reminder</AppText>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: "#2C2C2E", true: colors.accent }}
              thumbColor={colors.white}
              style={Platform.OS === "ios" ? { marginRight: -2 } : undefined}
            />
          </View>
          {reminderEnabled && (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity onPress={handleReminderOffsetPress} style={styles.cardRow}>
                <AppText style={styles.fieldLabel}>Remind offset</AppText>
                <View style={styles.arrowRowRight}>
                  <AppText style={styles.arrowValueText}>
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
          <View style={[styles.cardRow, { height: "auto", minHeight: 64, alignItems: "flex-start", paddingVertical: spacing[8] }]}>
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (Optional)"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic Slide-Up Bottom Customization Sheet */}
      <Modal
        visible={customizeVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCustomizeVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setCustomizeVisible(false)}
          />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + spacing[20] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ width: 24 }} />
              <AppText style={styles.sheetTitle}>Customize</AppText>
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
                />
                <TouchableOpacity onPress={handleEditName} style={styles.previewNamePill}>
                  <AppText weight="700" color={colors.white} style={styles.previewNameText}>
                    {customName}
                  </AppText>
                </TouchableOpacity>
              </View>

              {/* Color Picker Row */}
              <View style={styles.pickerSection}>
                <AppText style={styles.pickerLabel}>Card Background</AppText>
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
                      Alert.prompt(
                        "Custom Color",
                        "Enter hex code (e.g. #FF5733):",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "OK",
                            onPress: (val?: string) => {
                              if (val && val.startsWith("#") && val.length === 7) {
                                setSelectedColor(val);
                              } else {
                                Alert.alert("Invalid Color", "Please enter a valid hex starting with #");
                              }
                            },
                          },
                        ],
                        "plain-text",
                        selectedColor
                      );
                    }}
                    style={[styles.colorBubble, styles.colorBubbleCustom]}
                  >
                    <ArrowUpDown size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Logo Style Variations Row */}
              <View style={styles.pickerSection}>
                <AppText style={styles.pickerLabel}>Logo Style</AppText>
                <View style={styles.logoVariationRow}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLogoStyle("default");
                    }}
                    style={[styles.logoVarItem, logoStyle === "default" && styles.logoVarItemActive]}
                  >
                    <LogoCircle source={customLogoUrl || undefined} name={customName} color={selectedColor} size={48} bordered />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLogoStyle("badge");
                    }}
                    style={[styles.logoVarItem, logoStyle === "badge" && styles.logoVarItemActive]}
                  >
                    <View style={styles.badgeLogoWrapper}>
                      <LogoCircle source={customLogoUrl || undefined} name={customName} color="#FFFFFF" size={48} />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLogoStyle("initial");
                    }}
                    style={[styles.logoVarItem, logoStyle === "initial" && styles.logoVarItemActive]}
                  >
                    <LogoCircle name={customName} color={selectedColor} size={48} />
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
                        { text: "🍿 Popcorn", onPress: () => { setCustomName("🍿 " + customName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()); setCustomLogoUrl(""); } },
                        { text: "🎵 Music", onPress: () => { setCustomName("🎵 " + customName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()); setCustomLogoUrl(""); } },
                        { text: "🎮 Gaming", onPress: () => { setCustomName("🎮 " + customName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()); setCustomLogoUrl(""); } },
                        { text: "🤖 Tech/AI", onPress: () => { setCustomName("🤖 " + customName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()); setCustomLogoUrl(""); } },
                        { text: "📚 Study", onPress: () => { setCustomName("📚 " + customName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()); setCustomLogoUrl(""); } },
                        { text: "Other Emoji", onPress: () => {
                          Alert.prompt(
                            "Emoji",
                            "Enter a custom emoji character:",
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "OK", onPress: (val?: string) => val && setCustomName(val.trim().charAt(0) + " " + customName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()) }
                            ]
                          );
                        }},
                        { text: "Cancel", style: "cancel" }
                      ]
                    );
                  }}
                  style={styles.sheetActionButton}
                >
                  <AppText style={styles.sheetActionIcon}>🍿</AppText>
                  <AppText weight="700" color={colors.white} style={styles.sheetActionLabel}>Pick icon</AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    Alert.prompt(
                      "Logo Image",
                      "Enter image URL (HTTPS):",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Save",
                          onPress: (val?: string) => {
                            if (val && val.trim().startsWith("http")) {
                              setCustomLogoUrl(val.trim());
                              setLogoStyle("default");
                            } else {
                              Alert.alert("Error", "Please enter a valid https link");
                            }
                          }
                        }
                      ],
                      "plain-text",
                      customLogoUrl || ""
                    );
                  }}
                  style={styles.sheetActionButton}
                >
                  <AppText style={styles.sheetActionIcon}>🖼️</AppText>
                  <AppText weight="700" color={colors.white} style={styles.sheetActionLabel}>Choose image</AppText>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setCustomizeVisible(false)}
              style={styles.sheetDoneBtn}
            >
              <AppText weight="700" style={styles.sheetDoneBtnText}>
                Done
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Beautiful iOS Translucent Dropdown Modal */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
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
                        { label: "Storage", value: "Storage" },
                        { label: "Gaming", value: "Gaming" },
                        { label: "AI", value: "AI" },
                        { label: "Finance", value: "Finance" },
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
                    <AppText style={styles.dropdownTitle}>{data.title}</AppText>
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
                            weight={isSelected ? "700" : "500"}
                            color={isSelected ? colors.white : "rgba(255, 255, 255, 0.7)"}
                            style={styles.dropdownRowLabel}
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
              <AppText style={styles.dropdownTitle}>Custom Billing Cycle</AppText>
            </View>
            <View style={styles.customCycleBody}>
              <View style={styles.customCycleInputRow}>
                <AppText style={styles.customCycleInputLabel}>Every</AppText>
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
                        weight="700"
                        color={isAct ? colors.white : colors.textSecondary}
                        style={styles.customCycleUnitText}
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
                <AppText weight="700" style={styles.customCycleSaveBtnText}>
                  Save
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[12],
    backgroundColor: "transparent",
  },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
  },
  navbarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
  },
  addBtnContainer: {
    height: 32,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    gap: spacing[16],
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    padding: spacing[16],
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  heroText: {
    marginLeft: 14,
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    color: colors.white,
  },
  heroStatus: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 2,
  },
  pencilCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentContainer: {
    height: 38,
    borderRadius: 10,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    padding: 2,
    flexDirection: "row",
  },
  segmentTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  segmentTabActive: {
    backgroundColor: "#2C2C2E",
  },
  segmentText: {
    fontSize: 13,
  },
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: spacing[16],
    height: 60,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
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
    fontSize: 15,
    color: colors.white,
    marginRight: spacing[12],
  },
  selectorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectorText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
  sectionCard: {
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    paddingHorizontal: spacing[16],
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 54,
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: "#2C2C2E",
  },
  arrowRowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrowValueText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing[8],
    marginTop: -spacing[8],
  },
  notesInput: {
    flex: 1,
    fontSize: 14,
    color: colors.white,
    textAlignVertical: "top",
  },
  // Modal Bottom Sheet styling
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalDismissArea: {
    flex: 1,
  },
  sheetContainer: {
    height: "84%",
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#3A3A3C",
    alignSelf: "center",
    marginBottom: spacing[16],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[20],
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
  },
  sheetDoneBtn: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[16],
    width: "100%",
  },
  sheetDoneBtnText: {
    fontSize: 16,
    fontWeight: "700",
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
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewNameText: {
    fontSize: 15,
  },
  pickerSection: {
    gap: 10,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    paddingHorizontal: spacing[4],
  },
  colorRow: {
    gap: 12,
    paddingVertical: 4,
  },
  colorBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    borderColor: "#3A3A3C",
    borderRadius: 16,
    padding: spacing[16],
    alignItems: "center",
    gap: spacing[8],
  },
  sheetActionIcon: {
    fontSize: 24,
  },
  sheetActionLabel: {
    fontSize: 14,
  },
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
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
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
  dropdownRowLabel: {
    fontSize: 15,
  },
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
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  customCycleInputLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    marginRight: spacing[12],
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
    borderRadius: 12,
    padding: 2,
    height: 40,
  },
  customCycleUnitTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  customCycleUnitTabActive: {
    backgroundColor: "#3A3A3C",
  },
  customCycleUnitText: {
    fontSize: 12,
  },
  customCycleSaveBtn: {
    height: 48,
    backgroundColor: colors.white,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[8],
  },
  customCycleSaveBtnText: {
    fontSize: 15,
    color: "#000000",
  },
  inlinePickerContainer: {
    backgroundColor: "#1C1C1E",
    padding: spacing[8],
    borderRadius: 16,
    marginTop: spacing[4],
    marginBottom: spacing[8],
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});
