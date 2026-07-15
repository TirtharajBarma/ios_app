import React, { useTransition } from "react";
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, SlideInUp } from "react-native-reanimated";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

import { colors, spacing } from "@/constants";
import { AppButton, Card } from "@/components/ui";
import ServiceHero from "@/components/common/ServiceHero";
import FormSection from "@/components/form/FormSection";
import InputField from "@/components/form/InputField";
import SelectorField from "@/components/form/SelectorField";
import SwitchField from "@/components/form/SwitchField";
import DateField from "@/components/form/DateField";

// ─── Zod Schema for Paid Form Validation ──────────────────────────────

const paidSubscriptionSchema = z.object({
  name: z.string().min(1, "Subscription name is required"),
  price: z.string()
    .min(1, "Price is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Price must be greater than zero",
    }),
  currency: z.string().min(1, "Currency is required"),
  billingCycle: z.string().min(1, "Billing cycle is required"),
  startDate: z.date(),
  renewalDate: z.date(),
  paymentMethod: z.string().min(1, "Payment method is required"),
  category: z.string().min(1, "Category is required"),
  reminder: z.boolean(),
  reminderTime: z.string().optional(),
  notes: z.string().optional(),
});

type PaidFormValues = z.infer<typeof paidSubscriptionSchema>;

// ─── Constants for Dropdowns ────────────────────────────────────────

const CURRENCIES = ["USD ($)", "EUR (€)", "GBP (£)", "INR (₹)", "JPY (¥)", "CAD ($)", "AUD ($)"];
const BILLING_CYCLES = ["Weekly", "Monthly", "Quarterly", "Yearly", "Custom"];
const PAYMENT_METHODS = ["Credit Card", "Debit Card", "Apple Pay", "Google Pay", "PayPal", "UPI", "Cash"];
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

export default function PaidFormScreen() {
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

  // Form initialization
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<PaidFormValues>({
    resolver: zodResolver(paidSubscriptionSchema),
    mode: "onChange",
    defaultValues: {
      name: name || "",
      price: "",
      currency: "USD ($)",
      billingCycle: "Monthly",
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
      paymentMethod: "Credit Card",
      category: category || "Entertainment",
      reminder: true,
      reminderTime: "1 Day Before",
      notes: "",
    },
  });

  const isReminderEnabled = watch("reminder");

  const onSubmit = (data: PaidFormValues) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    startTransition(async () => {
      try {
        await addSubscription({
          name: data.name,
          color: brandColor || colors.accent,
          logoUrl: name || undefined,
          price: Number(data.price),
          currency: data.currency,
          billingCycle: data.billingCycle.toLowerCase() as any,
          nextBillingDate: data.renewalDate.toISOString(),
          category: data.category.toLowerCase() as any,
          reminderEnabled: data.reminder,
          reminderDays: parseReminderDays(data.reminderTime),
          note: data.notes || undefined,
          isTrial: false,
          startDate: data.startDate.toISOString(),
          paymentMethod: data.paymentMethod,
          website: website || undefined,
        });
        
        router.dismissAll();
      } catch (error) {
        console.error("Failed to add paid subscription:", error);
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
        {/* Top Header Card with Brand Highlight */}
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

        {/* Form Inputs Sections */}
        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          {/* Section 1: Pricing Details */}
          <FormSection title="Pricing & Details">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <InputField
                  label="Name"
                  value={value}
                  onChangeText={onChange}
                  placeholder="e.g. Netflix Premium"
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="price"
              render={({ field: { onChange, value } }) => (
                <InputField
                  label="Price"
                  value={value}
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
                  value={value}
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
                  value={value}
                  options={BILLING_CYCLES}
                  onSelect={onChange}
                />
              )}
            />
          </FormSection>

          {/* Section 2: Renewal Schedule */}
          <FormSection title="Schedule">
            <Controller
              control={control}
              name="startDate"
              render={({ field: { onChange, value } }) => (
                <DateField label="Start Date" value={value} onChange={onChange} />
              )}
            />

            <Controller
              control={control}
              name="renewalDate"
              render={({ field: { onChange, value } }) => (
                <DateField label="First Renewal" value={value} onChange={onChange} />
              )}
            />
          </FormSection>

          {/* Section 3: Billing Info */}
          <FormSection title="Payment & Category">
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field: { onChange, value } }) => (
                <SelectorField
                  label="Payment Method"
                  value={value}
                  options={PAYMENT_METHODS}
                  onSelect={onChange}
                />
              )}
            />

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
          </FormSection>

          {/* Section 4: Reminders */}
          <FormSection title="Alerts">
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

          {/* Section 5: Notes */}
          <FormSection title="Additional Notes">
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, value } }) => (
                <InputField
                  label="Notes"
                  value={value || ""}
                  onChangeText={onChange}
                  placeholder="Billing details, plan limits, etc."
                  multiline
                />
              )}
            />
          </FormSection>
        </Animated.View>

        {/* Large Submission Pill Button */}
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.buttonWrapper}>
          <AppButton
            variant="primary"
            disabled={!isValid || isPending}
            loading={isPending}
            onPress={handleSubmit(onSubmit)}
            style={styles.submitBtn}
          >
            Add Subscription
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
});
