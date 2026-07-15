import React, { useTransition } from "react";
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

import { colors, spacing } from "@/constants";
import { AppButton, Card } from "@/components/ui";
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
  const [isPending, startTransition] = useTransition();
  const addSubscription = useSubscriptionStore((state) => state.addSubscription);

  // Read service params passed from select screen
  const { name, category, brandColor, website } = useLocalSearchParams<{
    name: string;
    category: string;
    brandColor: string;
    website: string;
  }>();

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
      name: name || "",
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default to 14-day trial
      autoRenew: true,
      price: "",
      currency: "USD ($)",
      billingCycle: "Monthly",
      category: category || "Entertainment",
      reminder: true,
      reminderTime: "1 Day Before",
      notes: "",
    },
  });

  const isAutoRenewEnabled = watch("autoRenew");
  const isReminderEnabled = watch("reminder");

  const onSubmit = (data: TrialFormValues) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    startTransition(async () => {
      try {
        await addSubscription({
          name: data.name,
          color: brandColor || colors.accent,
          logoUrl: name || undefined,
          price: data.autoRenew ? Number(data.price) : 0,
          currency: data.autoRenew ? (data.currency || "USD ($)") : "USD ($)",
          billingCycle: data.autoRenew ? (data.billingCycle?.toLowerCase() as any || "monthly") : "monthly",
          nextBillingDate: data.trialEndDate.toISOString(),
          category: data.category.toLowerCase() as any,
          reminderEnabled: data.reminder,
          reminderDays: parseReminderDays(data.reminderTime),
          note: data.notes || undefined,
          isTrial: true,
          trialStartDate: data.trialStartDate.toISOString(),
          trialEndDate: data.trialEndDate.toISOString(),
          startDate: data.trialStartDate.toISOString(),
          website: website || undefined,
        });
        
        router.dismissAll();
      } catch (error) {
        console.error("Failed to add trial subscription:", error);
      }
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
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
            disabled={!isValid || isPending}
            loading={isPending}
            onPress={handleSubmit(onSubmit)}
            style={styles.submitBtn}
          >
            Start Trial
          </AppButton>
        </Animated.View>
      </ScrollView>
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
