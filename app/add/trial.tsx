import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View, Keyboard, Animated as RNAnimated, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

import { colors, spacing } from "@/constants";
import { AppButton, Card, AppText } from "@/components/ui";
import ServiceHero from "@/components/common/ServiceHero";
import FormSection from "@/components/form/FormSection";
import InputField from "@/components/form/InputField";
import SelectorField from "@/components/form/SelectorField";
import SwitchField from "@/components/form/SwitchField";
import DateField from "@/components/form/DateField";

// ─── Zod Schema with Cross-Field Validations ──────────────────────────

const trialSubscriptionSchema = z
  .object({
    name: z.string().min(1, "Subscription name is required"),
    trialStartDate: z.date(),
    trialEndDate: z.date(),
    autoRenew: z.boolean(),
    price: z.string().optional(),
    currency: z.string().optional(),
    billingCycle: z.string().optional(),
    category: z.string().min(1, "Category is required"),
    reminder: z.boolean(),
    reminderTime: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.trialEndDate > data.trialStartDate, {
    message: "Trial end date must be after start date",
    path: ["trialEndDate"],
  })
  .refine(
    (data) => {
      if (data.autoRenew) {
        if (!data.price) return false;
        const num = Number(data.price);
        return !isNaN(num) && num > 0;
      }
      return true;
    },
    {
      message: "Price must be greater than zero when auto-renew is enabled",
      path: ["price"],
    }
  );

type TrialFormValues = z.infer<typeof trialSubscriptionSchema>;

// ─── Constants ──────────────────────────────────────────────────────

const CURRENCIES = ["USD ($)", "EUR (€)", "GBP (£)", "INR (₹)", "JPY (¥)", "CAD ($)", "AUD ($)"];
const BILLING_CYCLES = ["Weekly", "Monthly", "Quarterly", "Yearly", "Custom"];
const CATEGORIES = ["Entertainment", "Music", "Productivity", "Storage", "Gaming", "AI", "Shopping", "Health", "Education", "Finance"];
const REMINDER_TIMES = ["Same Day", "1 Day Before", "3 Days Before", "7 Days Before", "30 Days Before"];

function parseReminderDays(reminderTime?: string): number {
  if (!reminderTime) return 1;
  if (reminderTime === "Same Day") return 0;
  if (reminderTime === "1 Day Before") return 1;
  if (reminderTime === "3 Days Before") return 3;
  if (reminderTime === "7 Days Before") return 7;
  if (reminderTime === "30 Days Before") return 30;
  return 1;
}

export default function TrialFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const animBottom = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardVisible(true);
        RNAnimated.timing(animBottom, {
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
  const addSubscription = useSubscriptionStore((state) => state.addSubscription);
  const updateSubscription = useSubscriptionStore((state) => state.updateSubscription);
  const subscriptions = useSubscriptionStore((state) => state.subscriptions);

  // Read service params passed from select screen (or edit params from detail screen)
  const { name, category, brandColor, website, logo, editId } = useLocalSearchParams<{
    name: string;
    category: string;
    brandColor: string;
    website: string;
    logo: string;
    editId?: string;
  }>();

  const isEditMode = Boolean(editId);
  const existingSub = isEditMode ? subscriptions.find((s) => s.id === editId) : null;

  // Map reminder days back to display string
  function reminderDaysToTime(days: number): string {
    if (days === 0) return "Same Day";
    if (days === 1) return "1 Day Before";
    if (days === 3) return "3 Days Before";
    if (days === 7) return "7 Days Before";
    if (days === 30) return "30 Days Before";
    return "1 Day Before";
  }

  function capitalizeCycle(cycle: string): string {
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }

  function formatCurrencyDisplay(code: string): string {
    const map: Record<string, string> = {
      USD: "USD ($)", EUR: "EUR (€)", GBP: "GBP (£)", INR: "INR (₹)",
      JPY: "JPY (¥)", CAD: "CAD ($)", AUD: "AUD ($)",
    };
    return map[code] || "USD ($)";
  }

  // Initialize React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<TrialFormValues>({
    resolver: zodResolver(trialSubscriptionSchema),
    mode: "onChange",
    defaultValues: {
      name: existingSub?.name || name || "",
      trialStartDate: existingSub?.trialStartDate ? new Date(existingSub.trialStartDate) : new Date(),
      trialEndDate: existingSub?.trialEndDate ? new Date(existingSub.trialEndDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      autoRenew: existingSub ? existingSub.price > 0 : true,
      price: existingSub ? String(existingSub.price) : "",
      currency: existingSub ? formatCurrencyDisplay(existingSub.currency) : "USD ($)",
      billingCycle: existingSub ? capitalizeCycle(existingSub.billingCycle) : "Monthly",
      category: existingSub?.category ? capitalizeCycle(existingSub.category) : (category || "Entertainment"),
      reminder: existingSub?.reminderEnabled ?? true,
      reminderTime: existingSub ? reminderDaysToTime(existingSub.reminderDays) : "1 Day Before",
      notes: existingSub?.note || "",
    },
  });

  const isAutoRenewEnabled = watch("autoRenew");
  const isReminderEnabled = watch("reminder");

  const onSubmit = async (data: TrialFormValues) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(true);

    try {
      // Convert "USD ($)" display string back to "USD" code
      const currencyCode = (data.currency || "USD ($)").split(" ")[0].toUpperCase();
      const input = {
        name: data.name,
        color: brandColor || existingSub?.color || colors.accent,
        logoUrl: logo || existingSub?.logoUrl || undefined,
        price: data.autoRenew ? Number(data.price) : 0,
        currency: currencyCode,
        billingCycle: data.autoRenew ? (data.billingCycle?.toLowerCase() as any || "monthly") : "monthly",
        nextBillingDate: data.trialEndDate.toISOString(),
        category: (data.category || "entertainment").toLowerCase() as any,
        reminderEnabled: data.reminder,
        reminderDays: parseReminderDays(data.reminderTime),
        note: data.notes || undefined,
        isTrial: true,
        trialStartDate: data.trialStartDate.toISOString(),
        trialEndDate: data.trialEndDate.toISOString(),
        startDate: data.trialStartDate.toISOString(),
        website: website || existingSub?.website || undefined,
      };

      if (isEditMode && editId) {
        await updateSubscription(editId, input);
      } else {
        await addSubscription(input);
      }
      
      router.dismissAll();
    } catch (error) {
      console.error("Failed to save trial subscription:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 44 : 0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: spacing[16],
            paddingBottom: insets.bottom + spacing[40],
          },
        ]}
      >
        {/* Top Header Card */}
        <Animated.View entering={SlideInUp.duration(350).springify().damping(18)}>
          <Card
            shadow="small"
            style={[
              styles.headerCard,
              {
                backgroundColor: brandColor ? `${brandColor}0F` : colors.card,
                borderColor: brandColor ? `${brandColor}33` : colors.border,
              },
            ]}
          >
            <ServiceHero
              name={name || "Subscription"}
              category={category || ""}
              brandColor={brandColor || colors.accent}
              website={website || undefined}
            />
          </Card>
        </Animated.View>

        {/* Form Fields */}
        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          {/* Section 1: Basic Info */}
          <FormSection title="Trial Details">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <InputField
                  label="Name"
                  value={value}
                  onChangeText={onChange}
                  placeholder="e.g. Netflix Trial"
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="trialStartDate"
              render={({ field: { onChange, value } }) => (
                <DateField label="Trial Start" value={value} onChange={onChange} />
              )}
            />

            <Controller
              control={control}
              name="trialEndDate"
              render={({ field: { onChange, value } }) => (
                <DateField
                  label="Trial End"
                  value={value}
                  onChange={onChange}
                  minimumDate={watch("trialStartDate")}
                />
              )}
            />
          </FormSection>

          {errors.trialEndDate && (
            <View style={styles.errorBanner}>
              <AppButton variant="danger" disabled style={{ width: "100%" }}>
                {errors.trialEndDate.message}
              </AppButton>
            </View>
          )}

          {/* Section 2: Auto Renewal Settings */}
          <FormSection title="Renewal Status">
            <Controller
              control={control}
              name="autoRenew"
              render={({ field: { onChange, value } }) => (
                <SwitchField label="Auto Renew" value={value} onValueChange={onChange} />
              )}
            />

            {isAutoRenewEnabled && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                <Controller
                  control={control}
                  name="price"
                  render={({ field: { onChange, value } }) => (
                    <InputField
                      label="Price After Trial"
                      value={value || ""}
                      onChangeText={onChange}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      error={errors.price?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="currency"
                  render={({ field: { onChange, value } }) => (
                    <SelectorField
                      label="Currency"
                      value={value || "USD ($)"}
                      options={CURRENCIES}
                      onSelect={onChange}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="billingCycle"
                  render={({ field: { onChange, value } }) => (
                    <SelectorField
                      label="Billing Cycle"
                      value={value || "Monthly"}
                      options={BILLING_CYCLES}
                      onSelect={onChange}
                    />
                  )}
                />
              </Animated.View>
            )}
          </FormSection>

          {/* Section 3: Billing Info & Alerts */}
          <FormSection title="General">
            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, value } }) => (
                <SelectorField
                  label="Category"
                  value={value}
                  options={CATEGORIES}
                  onSelect={onChange}
                />
              )}
            />

            <Controller
              control={control}
              name="reminder"
              render={({ field: { onChange, value } }) => (
                <SwitchField label="Enable Reminder" value={value} onValueChange={onChange} />
              )}
            />

            {isReminderEnabled && (
              <Controller
                control={control}
                name="reminderTime"
                render={({ field: { onChange, value } }) => (
                  <SelectorField
                    label="Reminder Time"
                    value={value || "1 Day Before"}
                    options={REMINDER_TIMES}
                    onSelect={onChange}
                  />
                )}
              />
            )}
          </FormSection>

          {/* Section 4: Notes */}
          <FormSection title="Additional Notes">
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, value } }) => (
                <InputField
                  label="Notes"
                  value={value || ""}
                  onChangeText={onChange}
                  placeholder="Trial terms, cancellation conditions, etc."
                  multiline
                />
              )}
            />
          </FormSection>
        </Animated.View>

        {/* Submit button */}
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.buttonWrapper}>
          <AppButton
            variant="primary"
            disabled={!isValid || isSaving}
            loading={isSaving}
            onPress={handleSubmit(onSubmit)}
            style={styles.submitBtn}
          >
            {isEditMode ? "Update Trial" : "Start Trial"}
          </AppButton>
        </Animated.View>
      </ScrollView>

      {keyboardVisible && (
        <RNAnimated.View
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
        </RNAnimated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing[20],
  },
  headerCard: {
    borderWidth: 0.5,
    borderRadius: 20,
    marginBottom: spacing[20],
  },
  buttonWrapper: {
    marginTop: spacing[12],
    alignItems: "center",
  },
  submitBtn: {
    width: "100%",
  },
  errorBanner: {
    marginBottom: spacing[20],
  },
});
