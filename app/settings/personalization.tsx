import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, hexToRGBA } from "@/constants";
import { AppText } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";

export default function PersonalizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, userTagline, setUserName, setUserTagline } = useSettingsStore();

  const [nameInput, setNameInput] = useState(userName);
  const [taglineInput, setTaglineInput] = useState(userTagline);
  const [saved, setSaved] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  const taglineRef = useRef<TextInput>(null);

  useEffect(() => {
    setNameInput(userName);
    setTaglineInput(userTagline);
  }, [userName, userTagline]);

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setUserName(nameInput.trim());
    await setUserTagline(taglineInput.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 600);
  };

  const hasChanges =
    nameInput.trim() !== userName || taglineInput.trim() !== userTagline;

  const initials = nameInput.trim()
    ? nameInput
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleFocus = (offset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }, 150);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white}>
          Personalization
        </AppText>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, !hasChanges && styles.saveBtnDimmed]}
          activeOpacity={0.75}
          disabled={!hasChanges}
        >
          {saved ? (
            <Check size={18} color={colors.success} />
          ) : (
            <AppText
              variant="body"
              weight="600"
              color={hasChanges ? colors.accent : colors.textMuted}
            >
              Save
            </AppText>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[48] },
        ]}
      >
        {/* Avatar Preview */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <AppText style={styles.avatarInitials}>{initials}</AppText>
          </View>
          {nameInput.trim() ? (
            <AppText variant="title3" weight="700" color={colors.white}>
              {nameInput.trim()}
            </AppText>
          ) : (
            <AppText variant="body" color={colors.textMuted}>
              Enter your name below
            </AppText>
          )}
          {taglineInput.trim() ? (
            <AppText variant="footnote" color={colors.textMuted}>
              {taglineInput.trim()}
            </AppText>
          ) : null}
        </View>

        {/* Form */}
        <View>
          <AppText
            variant="footnote"
            weight="700"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            YOUR PROFILE
          </AppText>
          <View style={styles.formCard}>
            {/* Name */}
            <View style={styles.inputRow}>
              <AppText variant="footnote" weight="600" color={colors.textMuted} style={styles.inputLabel}>
                NAME
              </AppText>
              <TextInput
                style={styles.textInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.textMuted}
                maxLength={32}
                returnKeyType="next"
                autoCapitalize="words"
                autoCorrect={false}
                onSubmitEditing={() => taglineRef.current?.focus()}
                blurOnSubmit={false}
                onFocus={() => handleFocus(0)}
              />
            </View>
            <View style={styles.inputDivider} />
            {/* Tagline */}
            <View style={styles.inputRow}>
              <AppText variant="footnote" weight="600" color={colors.textMuted} style={styles.inputLabel}>
                TAGLINE
              </AppText>
              <TextInput
                ref={taglineRef}
                style={styles.textInput}
                value={taglineInput}
                onChangeText={setTaglineInput}
                placeholder="e.g. Keeping tabs on chaos"
                placeholderTextColor={colors.textMuted}
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoCapitalize="sentences"
                onFocus={() => handleFocus(180)}
              />
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <AppText variant="footnote" color={colors.textMuted} style={{ lineHeight: 18 }}>
            Your name shows as initials on the Overview profile button. Your tagline is just for you — a little reminder of your vibe. Everything stays on your device.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111113",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  saveBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  saveBtnDimmed: {
    opacity: 0.4,
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
    gap: spacing[20],
  },
  avatarSection: {
    alignItems: "center",
    gap: spacing[8],
    paddingVertical: spacing[20],
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: hexToRGBA("#FF6030", 0.25),
    borderWidth: 2,
    borderColor: hexToRGBA("#FF6030", 0.4),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
    overflow: "hidden",
  },
  avatarInitials: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#FF8050",
    textAlign: "center",
    textAlignVertical: "center",
  },
  sectionLabel: {
    marginBottom: spacing[8],
    paddingHorizontal: spacing[4],
  },
  formCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: radius[16],
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputRow: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    gap: spacing[4],
  },
  inputLabel: {
    letterSpacing: 0.5,
    fontSize: 11,
  },
  textInput: {
    fontSize: 17,
    color: colors.white,
    fontWeight: "500",
    paddingVertical: spacing[4],
  },
  inputDivider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginLeft: spacing[16],
  },
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius[12],
    padding: spacing[16],
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
});
