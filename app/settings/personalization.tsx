import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius } from "@/constants";
import { AppText, ProfileAvatar } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import { AVATAR_OPTIONS, AvatarOption } from "@/constants/avatars";

export default function PersonalizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    userName,
    userEmail,
    userTagline,
    userAvatarId,
    setUserName,
    setUserEmail,
    setUserTagline,
    setUserAvatarId,
  } = useSettingsStore();

  const [nameInput, setNameInput] = useState(userName);
  const [emailInput, setEmailInput] = useState(userEmail);
  const [taglineInput, setTaglineInput] = useState(userTagline);
  const [selectedAvatar, setSelectedAvatar] = useState(userAvatarId || "avatar_solaris");
  const [saved, setSaved] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const taglineRef = useRef<TextInput>(null);

  useEffect(() => {
    setNameInput(userName);
    setEmailInput(userEmail);
    setTaglineInput(userTagline);
    setSelectedAvatar(userAvatarId || "avatar_solaris");
  }, [userName, userEmail, userTagline, userAvatarId]);

  const handleSave = async () => {
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setUserName(nameInput.trim());
    await setUserEmail(emailInput.trim());
    await setUserTagline(taglineInput.trim());
    await setUserAvatarId(selectedAvatar);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.back();
    }, 500);
  };

  const hasChanges =
    nameInput.trim() !== userName ||
    emailInput.trim() !== userEmail ||
    taglineInput.trim() !== userTagline ||
    selectedAvatar !== (userAvatarId || "avatar_solaris");

  const handleFocus = (offset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    }, 120);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
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
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[48] + 160 },
        ]}
      >
        {/* Avatar Live Preview */}
        <View style={styles.avatarSection}>
          <ProfileAvatar
            avatarId={selectedAvatar}
            name={nameInput}
            size={80}
            showBorder={true}
          />
          {nameInput.trim() ? (
            <AppText variant="title3" weight="700" color={colors.white} style={{ marginTop: 8 }}>
              {nameInput.trim()}
            </AppText>
          ) : (
            <AppText variant="body" color={colors.textMuted} style={{ marginTop: 8 }}>
              Enter your profile name
            </AppText>
          )}
          {emailInput.trim() ? (
            <AppText variant="footnote" color={colors.textMuted} style={{ marginTop: 2 }}>
              {emailInput.trim()}
            </AppText>
          ) : null}
        </View>

        {/* 1. Illustrated Logo / Avatar Selection Grid */}
        <View>
          <View style={styles.sectionTitleRow}>
            <Sparkles size={13} color="#FF9D66" />
            <AppText
              variant="footnote"
              weight="700"
              color={colors.textMuted}
              style={styles.sectionLabel}
            >
              CHOOSE BESPOKE IDENTITY AVATAR
            </AppText>
          </View>

          <View style={styles.avatarGridCard}>
            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((item) => {
                const isSelected = selectedAvatar === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.avatarTile,
                      isSelected && {
                        borderColor: item.accentColor,
                        backgroundColor: `${item.accentColor}18`,
                      },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedAvatar(item.id);
                    }}
                  >
                    <ProfileAvatar
                      avatarId={item.id}
                      size={44}
                      showBorder={false}
                    />
                    <AppText
                      style={[
                        styles.avatarTileName,
                        isSelected && { color: item.accentColor, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </AppText>
                    {isSelected && (
                      <View style={[styles.selectedCheckBadge, { backgroundColor: item.accentColor }]}>
                        <Check size={9} color="#0E1015" strokeWidth={3.5} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 2. Profile Details Form */}
        <View>
          <AppText
            variant="footnote"
            weight="700"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            PROFILE DETAILS
          </AppText>
          <View style={styles.formCard}>
            {/* Name */}
            <View style={styles.inputRow}>
              <AppText variant="footnote" weight="600" color={colors.textMuted} style={styles.inputLabel}>
                NAME
              </AppText>
              <TextInput
                ref={nameRef}
                style={styles.textInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.textMuted}
                maxLength={32}
                returnKeyType="next"
                autoCapitalize="words"
                autoCorrect={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                onFocus={() => handleFocus(360)}
              />
            </View>
            <View style={styles.inputDivider} />

            {/* Email */}
            <View style={styles.inputRow}>
              <AppText variant="footnote" weight="600" color={colors.textMuted} style={styles.inputLabel}>
                EMAIL
              </AppText>
              <TextInput
                ref={emailRef}
                style={styles.textInput}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="e.g. alex@example.com"
                placeholderTextColor={colors.textMuted}
                maxLength={60}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => taglineRef.current?.focus()}
                blurOnSubmit={false}
                onFocus={() => handleFocus(440)}
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
                placeholder="e.g. Tracking wealth locally"
                placeholderTextColor={colors.textMuted}
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoCapitalize="sentences"
                onFocus={() => handleFocus(520)}
              />
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <AppText variant="footnote" color={colors.textMuted} style={{ lineHeight: 18 }}>
            Your custom identity avatar and name personalize your on-device dashboard. All information is stored 100% locally with zero cloud telemetry.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101114",
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
    paddingVertical: spacing[12],
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing[8],
    paddingHorizontal: spacing[4],
  },
  sectionLabel: {
    letterSpacing: 0.8,
  },
  avatarGridCard: {
    backgroundColor: "#171920",
    borderRadius: radius[16],
    padding: spacing[16],
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  avatarTile: {
    width: "22.5%",
    aspectRatio: 0.9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius[12],
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    paddingVertical: 6,
    position: "relative",
  },
  avatarTileName: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9CA3AF",
    marginTop: 4,
  },
  selectedCheckBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
    backgroundColor: "#171920",
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  inputRow: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  inputLabel: {
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  textInput: {
    color: colors.white,
    fontSize: 15,
    paddingVertical: 4,
  },
  inputDivider: {
    height: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginLeft: spacing[16],
  },
  infoCard: {
    padding: spacing[16],
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
});
