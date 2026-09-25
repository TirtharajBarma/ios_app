import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
  Animated,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Users,
  UserPlus,
  Copy,
  Check,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { colors, spacing, radius, hexToRGBA } from "@/constants";
import { AppText, AppButton, Avatar } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import {
  createShareGroup,
  joinShareGroup,
  fetchShareGroups,
  type GroupInfo,
} from "@/api/supabase";
import { isSupabaseConfigured } from "@/api/supabase";

function toPlain(g: GroupInfo) {
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    role: g.role,
    ownerUserId: g.ownerUserId,
  };
}

function avatarColor(seed: string) {
  const palette = [
    "#F8A888", // Warm Apricot
    "#F39C94", // Warm Coral
    "#F4CD89", // Warm Buttercream
    "#8CD9C8", // Soft Seafoam
    "#9DC6EB", // Soft Powder Sky
    "#C4A7E7", // Soft Lilac
    "#F2AEC4", // Soft Blush Pink
    "#82D0D8", // Muted Teal
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function SharedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, shareGroups, setShareGroups } = useSettingsStore();
  const { syncGroup } = useSubscriptionStore();

  const configured = isSupabaseConfigured();

  const [groups, setGroups] = useState<GroupInfo[]>(() =>
    shareGroups.map((g) => ({ ...g, members: [], sharedCount: 0 })),
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{ name: string; code: string } | null>(null);
  const [dialogCopied, setDialogCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const createInputRef = useRef<TextInput>(null);
  const joinInputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [animBottom] = useState(() => new Animated.Value(0));
  const [createY, setCreateY] = useState(0);
  const [joinY, setJoinY] = useState(0);

  // Keyboard listeners drive the floating "Done" button (mirrors paid.tsx).
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

  const scrollToY = useCallback((y: number) => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 100);
  }, []);

  const focusCreate = useCallback(() => {
    scrollToY(createY);
    setTimeout(() => createInputRef.current?.focus(), 150);
  }, [scrollToY, createY]);

  const focusJoin = useCallback(() => {
    scrollToY(joinY);
    setTimeout(() => joinInputRef.current?.focus(), 150);
  }, [scrollToY, joinY]);

  // ── Data ────────────────────────────────────────────────────────────
  const refreshGroups = useCallback(async () => {
    try {
      const fetched = await fetchShareGroups();
      setGroups(fetched);
      setShareGroups(fetched.map(toPlain));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [setShareGroups]);

  useEffect(() => {
    if (!configured) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshGroups();
  }, [configured, refreshGroups]);

  // Keep the rendered list in sync with the store — e.g. when the user leaves a
  // group on the detail screen and pops back to this screen, the group should
  // disappear immediately instead of lingering until the next refresh.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroups((prev) => {
      const storeById = new Map(shareGroups.map((g) => [g.id, g]));
      const next: GroupInfo[] = [];
      for (const g of prev) {
        const s = storeById.get(g.id);
        if (!s) continue;
        if (s.name !== g.name) next.push({ ...g, name: s.name });
        else next.push(g);
        storeById.delete(g.id);
      }
      for (const s of storeById.values()) {
        next.push({ ...s, members: [], sharedCount: 0 });
      }
      return next;
    });
  }, [shareGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshGroups();
    setRefreshing(false);
  }, [refreshGroups]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    // Guard: require a personalization name so group members see the real name
    if (!userName.trim()) {
      Alert.alert(
        "Set your name first",
        "Add your name so group members know who you are.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Name",
            onPress: () => router.push("/settings/personalization"),
          },
        ]
      );
      return;
    }

    Haptics.selectionAsync();
    setCreateBusy(true);
    try {
      const group = await createShareGroup(name, userName.trim());
      await syncGroup();
      await refreshGroups();
      setNewGroupName("");
      if (group.code) {
        setCreatedGroup({ name: group.name, code: group.code });
      } else {
        router.push(`/settings/shared/${group.id}`);
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Could not create group", String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 6) return;

    // Guard: require a personalization name so group members see the real name
    if (!userName.trim()) {
      Alert.alert(
        "Set your name first",
        "Add your name so group members know who you are.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Name",
            onPress: () => router.push("/settings/personalization"),
          },
        ]
      );
      return;
    }

    Haptics.selectionAsync();
    setJoinBusy(true);
    try {
      const group = await joinShareGroup(code, userName.trim());
      await syncGroup();
      await refreshGroups();
      setJoinCode("");
      router.push(`/settings/shared/${group.id}`);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Provide a clear error message for invalid/already-joined codes
      const msg = String(e);
      if (msg.includes("already") || msg.includes("duplicate")) {
        Alert.alert("Already a member", "You are already a member of this group.");
      } else if (msg.includes("Invalid") || msg.includes("not found")) {
        Alert.alert("Invalid code", "That code doesn't match any group. Check it and try again.");
      } else {
        Alert.alert("Could not join group", msg);
      }
    } finally {
      setJoinBusy(false);
    }
  };

  const handleDialogCopy = async () => {
    if (!createdGroup) return;
    Haptics.selectionAsync();
    await Clipboard.setStringAsync(createdGroup.code);
    setDialogCopied(true);
    setTimeout(() => setDialogCopied(false), 1500);
  };

  const openGroup = (g: GroupInfo) => {
    Haptics.selectionAsync();
    router.push(`/settings/shared/${g.id}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white} numberOfLines={1} style={styles.headerTitle}>
          Shared Groups
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textMuted}
              colors={[colors.accent]}
            />
          }
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[48] }]}
        >
          {!configured ? (
            <View style={styles.infoCard}>
              <AppText variant="footnote" color={colors.textMuted} style={styles.infoText}>
                Shared groups need a backend. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in
                your build environment to enable them.
              </AppText>
            </View>
          ) : (
            <>
              {/* ── Load error ────────────────────────────────────── */}
              {loadError && groups.length === 0 && (
                <View style={styles.errorCard}>
                  <AppText variant="subheadline" weight="600" color={colors.white} style={styles.errorTitle}>
                    Could not load groups
                  </AppText>
                  <AppText variant="footnote" color={colors.textMuted}>
                    Check your connection and try again.
                  </AppText>
                  <AppButton variant="secondary" onPress={onRefresh} loading={refreshing} style={styles.errorRetry}>
                    Retry
                  </AppButton>
                </View>
              )}
              {/* ── Empty state ───────────────────────────────────── */}
              {groups.length === 0 && (
                <View style={styles.emptyBlock}>
                  <View style={styles.emptyIcon}>
                    <Share2 size={20} color={colors.accent} />
                  </View>
                  <AppText variant="title3" weight="700" color={colors.white} style={styles.emptyTitle}>
                    No groups yet
                  </AppText>
                  <AppText variant="subheadline" color={colors.textMuted} style={styles.emptySubtitle}>
                    Create a group with friends, roommates, or family to share subscription costs.
                  </AppText>
                  <AppButton
                    variant="primary"
                    onPress={focusCreate}
                    leftIcon={<Users size={16} color="#fff" />}
                    style={styles.emptyButton}
                  >
                    Create your first group
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    onPress={focusJoin}
                    leftIcon={<UserPlus size={16} color={colors.textPrimary} />}
                  >
                    Join a group
                  </AppButton>
                </View>
              )}

              {/* ── Your groups ───────────────────────────────────── */}
              {groups.length > 0 && (
                <View style={styles.section}>
                  <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                    YOUR GROUPS
                  </AppText>
                  <View style={styles.grouped}>
                    {groups.map((g, i) => (
                      <View key={g.id}>
                        {i > 0 && <View style={styles.insetDivider} />}
                        <TouchableOpacity
                          onPress={() => openGroup(g)}
                          activeOpacity={0.7}
                          style={styles.row}
                          accessibilityRole="button"
                          accessibilityLabel={`${g.name}, ${g.members.length} members`}
                        >
                          <Avatar size="small" name={g.name || "?"} bgColor={avatarColor(g.id)} />
                          <View style={styles.rowText}>
                            <AppText variant="body" weight="600" color={colors.white} numberOfLines={1}>
                              {g.name}
                            </AppText>
                            {g.members.length > 0 || g.sharedCount > 0 ? (
                              <AppText variant="subheadline" color={colors.textMuted} numberOfLines={1}>
                                {g.members.length} member{g.members.length === 1 ? "" : "s"} · {g.sharedCount} shared
                                split{g.sharedCount === 1 ? "" : "s"}
                              </AppText>
                            ) : null}
                          </View>
                          <ChevronRight size={17} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── New group ─────────────────────────────────────── */}
              <View style={styles.section} onLayout={(e) => setCreateY(e.nativeEvent.layout.y)}>
                <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                  NEW GROUP
                </AppText>
                <View style={styles.grouped}>
                  <View style={styles.inputRow}>
                    <AppText variant="footnote" weight="600" color={colors.textMuted} style={styles.inputLabel}>
                      GROUP NAME
                    </AppText>
                    <TextInput
                      ref={createInputRef}
                      style={styles.textInput}
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      placeholder="e.g. Family, Roommates"
                      placeholderTextColor={colors.textMuted}
                      maxLength={40}
                      autoCorrect={false}
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={handleCreate}
                      onFocus={() => scrollToY(createY)}
                    />
                  </View>
                </View>
                <AppButton
                  variant="primary"
                  onPress={handleCreate}
                  disabled={!newGroupName.trim()}
                  loading={createBusy}
                  style={styles.actionBtn}
                >
                  Create group
                </AppButton>
              </View>

              {/* ── Join existing ─────────────────────────────────── */}
              <View style={styles.section} onLayout={(e) => setJoinY(e.nativeEvent.layout.y)}>
                <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                  JOIN EXISTING
                </AppText>
                <View style={styles.grouped}>
                  <View style={styles.inputRow}>
                    <AppText variant="footnote" weight="600" color={colors.textMuted} style={styles.inputLabel}>
                      GROUP CODE
                    </AppText>
                    <TextInput
                      ref={joinInputRef}
                      style={styles.codeInput}
                      value={joinCode}
                      onChangeText={(t) =>
                        setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                      }
                      placeholder="AB12CD"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoComplete="off"
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={handleJoin}
                      onFocus={() => scrollToY(joinY)}
                    />
                    <AppText variant="caption2" color={colors.textMuted} style={styles.codeHint}>
                      6-character code from the group owner
                    </AppText>
                  </View>
                </View>
                <AppButton
                  variant="secondary"
                  onPress={handleJoin}
                  disabled={joinCode.trim().length < 6}
                  loading={joinBusy}
                  style={styles.actionBtn}
                >
                  Join group
                </AppButton>
              </View>

              <View style={styles.infoCard}>
                <AppText variant="footnote" color={colors.textMuted} style={styles.infoText}>
                  New members are added the next time they open the app. You&apos;ll get a notification when something
                  new arrives.
                </AppText>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating "Done" (dismisses keyboard only) */}
      {keyboardVisible && !createdGroup && (
        <Animated.View style={[styles.kbDoneWrap, { bottom: animBottom }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => Keyboard.dismiss()} style={styles.kbDoneBtn}>
            <AppText variant="callout" weight="700" color={colors.white}>
              Done
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Group created dialog */}
      <Modal
        visible={!!createdGroup}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatedGroup(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIcon}>
              <Check size={20} color={colors.success} strokeWidth={3} />
            </View>
            <AppText variant="title3" weight="700" color={colors.white} style={styles.dialogTitle}>
              Group created
            </AppText>
            <AppText variant="subheadline" color={colors.textSecondary} numberOfLines={1}>
              {createdGroup?.name}
            </AppText>
            <AppText variant="footnote" color={colors.textMuted} style={styles.dialogCopy}>
              Your group is ready. Share the code below with your members.
            </AppText>

            <View style={styles.dialogCodeRow}>
              <View style={styles.dialogCodeBox}>
                <AppText variant="title3" weight="800" color={colors.white} style={styles.dialogCodeText}>
                  {createdGroup?.code ?? ""}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={handleDialogCopy}
                activeOpacity={0.7}
                style={styles.dialogCopyBtn}
                accessibilityLabel="Copy join code"
                accessibilityRole="button"
              >
                {dialogCopied ? (
                  <Check size={17} color={colors.success} />
                ) : (
                  <Copy size={17} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <AppButton variant="primary" onPress={() => setCreatedGroup(null)} style={styles.dialogDone}>
              Done
            </AppButton>
          </View>
        </View>
      </Modal>
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
    justifyContent: "center",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[4],
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: spacing[4],
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: {
    maxWidth: 240,
  },
  headerSpacer: {
    width: 44,
    position: "absolute",
    right: spacing[4],
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
    gap: spacing[24],
    paddingTop: spacing[8],
  },
  section: {
    gap: spacing[8],
  },
  sectionLabel: {
    marginBottom: spacing[4],
    paddingHorizontal: spacing[4],
    letterSpacing: 0.5,
  },

  // Grouped container (native form-card pattern)
  grouped: {
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  insetDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: spacing[16],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    minHeight: 58,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  // Form input (shared by create + join)
  inputRow: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    gap: spacing[8],
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
  codeInput: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 6,
    textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius[12],
    paddingVertical: spacing[12],
    height: 48,
  },
  codeHint: {
    textAlign: "center",
    alignSelf: "center",
  },

  // Buttons
  actionBtn: {
    marginTop: spacing[12],
  },

  // Empty state
  emptyBlock: {
    alignItems: "center",
    paddingTop: spacing[8],
    paddingHorizontal: spacing[8],
    gap: spacing[8],
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: hexToRGBA(colors.accent, 0.15),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing[8],
  },
  emptyButton: {
    marginTop: spacing[4],
    alignSelf: "stretch",
  },

  // Load error
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing[16],
    gap: spacing[8],
  },
  errorTitle: {
    textAlign: "center",
  },
  errorRetry: {
    alignSelf: "stretch",
    marginTop: spacing[4],
  },

  // Helper card
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius[12],
    padding: spacing[16],
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  infoText: {
    lineHeight: 18,
  },

  // Keyboard Done button
  kbDoneWrap: {
    position: "absolute",
    right: spacing[20],
    zIndex: 9999,
  },
  kbDoneBtn: {
    backgroundColor: "rgba(30, 30, 30, 0.88)",
    borderRadius: 24,
    paddingHorizontal: spacing[20],
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },

  // Group created dialog
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[24],
  },
  dialogCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius[20],
    padding: spacing[24],
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  dialogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: hexToRGBA(colors.success, 0.16),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[16],
  },
  dialogTitle: {
    marginBottom: spacing[4],
  },
  dialogCopy: {
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing[12],
    marginBottom: spacing[16],
  },
  dialogCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    width: "100%",
    marginBottom: spacing[20],
  },
  dialogCodeBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius[16],
    paddingVertical: spacing[16],
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  dialogCodeText: {
    letterSpacing: 5,
  },
  dialogCopyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  dialogDone: {
    width: "100%",
  },
});