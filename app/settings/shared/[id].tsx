import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  Trash2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { colors, spacing, radius, hexToRGBA } from "@/constants";
import { AppText, AppButton, Avatar } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import {
  fetchShareGroups,
  renameShareGroup,
  removeShareMember,
  leaveShareGroup,
  type GroupInfo,
} from "@/api/supabase";
import { clearSharedSyncState } from "@/utils/sync";

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
  const palette = ["#007AFF", "#FF3B30", "#34C759", "#FF9500", "#5856D6", "#FF2D55", "#00C7BE", "#AF52DE"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });

export default function SharedGroupDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shareGroups, setShareGroups } = useSettingsStore();
  const { syncGroup } = useSubscriptionStore();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const fetched = await fetchShareGroups();
      setShareGroups(fetched.map(toPlain));
      const found = fetched.find((g) => g.id === id) ?? null;
      setGroup(found);
      setLoadError(!found);
      if (found) setNameDraft(found.name);
    } catch {
      setLoadError(true);
    }
  }, [id, setShareGroups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRename = async () => {
    const name = nameDraft.trim();
    if (!name || !group || name === group.name) {
      setEditingName(false);
      return;
    }
    Haptics.selectionAsync();
    setBusy(true);
    try {
      await renameShareGroup(group.id, name);
      await load();
    } catch (e) {
      Alert.alert("Rename failed", String(e));
    } finally {
      setBusy(false);
      setEditingName(false);
    }
  };

  const handleSync = async () => {
    Haptics.selectionAsync();
    setSyncing(true);
    setSyncFailed(false);
    try {
      await syncGroup();
      await load();
      setLastSyncedAt(Date.now());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyCode = async () => {
    if (!group?.code) return;
    Haptics.selectionAsync();
    await Clipboard.setStringAsync(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!group) return;
    Alert.alert("Remove member", `Remove ${memberName} from the group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setBusy(true);
          try {
            await removeShareMember(group.id, memberId);
            await load();
          } catch (e) {
            Alert.alert("Remove failed", String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    if (!group) return;
    const g = group;
    Alert.alert(
      "Leave group?",
      "You'll stop receiving updates from this group. Its shared subscriptions stay on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setBusy(true);
            try {
              await leaveShareGroup(g.id);
              await clearSharedSyncState(g.id);
              const remaining = shareGroups.filter((x) => x.id !== g.id);
              setShareGroups(remaining);
              router.back();
            } catch (e) {
              Alert.alert("Could not leave group", String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const memberCount = group?.members.length ?? 0;

  const syncSubtitle = syncing
    ? "Pulling the latest changes"
    : syncFailed
      ? "Sync failed — tap to retry"
      : lastSyncedAt
        ? `Last synced ${timeAgo(lastSyncedAt)}`
        : "Pull and push the latest changes";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back to groups"
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white} numberOfLines={1} style={styles.headerTitle}>
          {group?.name ?? "Group"}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[48] }]}
      >
        {group ? (
          <>
            {/* ── Group identity ───────────────────────────────── */}
            <View style={styles.section}>
              <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                GROUP
              </AppText>
              <View style={styles.identity}>
                <Avatar size="large" name={group.name} bgColor={avatarColor(group.id)} />
                <View style={styles.identityText}>
                  {editingName ? (
                    <View style={styles.nameInputWrap}>
                      <TextInput
                        style={styles.nameInput}
                        value={nameDraft}
                        onChangeText={setNameDraft}
                        autoFocus
                        maxLength={40}
                        autoCorrect={false}
                        autoCapitalize="words"
                        returnKeyType="done"
                        onSubmitEditing={handleRename}
                        blurOnSubmit={false}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  ) : (
                    <AppText variant="title3" weight="600" color={colors.white} numberOfLines={2} style={styles.groupName}>
                      {group.name}
                    </AppText>
                  )}
                  <AppText variant="footnote" color={colors.textMuted} numberOfLines={1}>
                    {group.role === "owner" ? "Owner" : "Member"} · {memberCount} member
                    {memberCount === 1 ? "" : "s"}
                  </AppText>
                </View>
                {editingName ? (
                  <TouchableOpacity onPress={handleRename} activeOpacity={0.7} style={styles.actionBtn}>
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <AppText variant="body" weight="600" color={colors.accent}>
                        Save
                      </AppText>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setEditingName(true)}
                    activeOpacity={0.7}
                    style={styles.actionBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Rename group"
                  >
                    <AppText variant="body" weight="600" color={colors.accent}>
                      Rename
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Join code (owner only) ───────────────────────── */}
            {group.role === "owner" && group.code && (
              <View style={styles.section}>
                <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                  JOIN CODE
                </AppText>
                <View style={styles.codeBlock}>
                  <AppText variant="title2" weight="700" color={colors.white} style={styles.codeText}>
                    {group.code}
                  </AppText>
                  <TouchableOpacity
                    onPress={handleCopyCode}
                    activeOpacity={0.7}
                    style={[styles.copyBtn, copied && styles.copyBtnCopied]}
                    accessibilityLabel="Copy join code"
                    accessibilityRole="button"
                  >
                    {copied ? (
                      <>
                        <Check size={16} color={colors.success} strokeWidth={3} />
                        <AppText variant="subheadline" weight="600" color={colors.success}>
                          Copied
                        </AppText>
                      </>
                    ) : (
                      <>
                        <Copy size={16} color={colors.accent} />
                        <AppText variant="subheadline" weight="600" color={colors.accent}>
                          Copy
                        </AppText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <AppText variant="footnote" color={colors.textMuted} style={styles.helperText}>
                  Share this code so members can join your group.
                </AppText>
              </View>
            )}

            {/* ── Sync ─────────────────────────────────────────── */}
            <View style={styles.section}>
              <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                SYNC
              </AppText>
              <TouchableOpacity
                onPress={handleSync}
                disabled={syncing}
                activeOpacity={syncing ? 1 : 0.7}
                style={styles.syncRow}
                accessibilityRole="button"
                accessibilityLabel="Sync now"
              >
                <RefreshCw size={17} color={colors.accent} />
                <View style={styles.syncText}>
                  <AppText variant="body" weight="600" color={colors.white}>
                    {syncing ? "Syncing…" : "Sync now"}
                  </AppText>
                  <AppText variant="footnote" color={syncFailed ? colors.danger : colors.textMuted} numberOfLines={1}>
                    {syncSubtitle}
                  </AppText>
                </View>
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <ChevronRight size={17} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            {/* ── Members ──────────────────────────────────────── */}
            <View style={styles.section}>
              <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
                MEMBERS · {memberCount}/10
              </AppText>
              {memberCount === 0 ? (
                <AppText variant="subheadline" color={colors.textMuted} style={styles.noMembers}>
                  No members yet
                </AppText>
              ) : (
                <View>
                  {group.members.map((m, i) => (
                    <View key={m.userId}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.memberRow}>
                        <Avatar size="small" name={m.userName || "?"} bgColor={avatarColor(m.userId)} />
                        <AppText variant="body" weight="500" color={colors.white} numberOfLines={1} style={styles.memberName}>
                          {m.userName}
                        </AppText>
                        {m.isOwner ? (
                          <View style={styles.ownerBadge}>
                            <AppText variant="caption2" weight="600" color={colors.accent}>
                              Owner
                            </AppText>
                          </View>
                        ) : group.role === "owner" ? (
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(m.userId, m.userName)}
                            activeOpacity={0.7}
                            style={styles.removeBtn}
                            accessibilityLabel={`Remove ${m.userName}`}
                            accessibilityRole="button"
                          >
                            <Trash2 size={15} color={colors.danger} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Leave ────────────────────────────────────────── */}
            <View style={styles.leaveSection}>
              <View style={styles.leaveDivider} />
              <TouchableOpacity
                onPress={handleLeave}
                disabled={busy}
                activeOpacity={0.6}
                style={styles.leaveRow}
                accessibilityRole="button"
                accessibilityLabel="Leave group"
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <AppText variant="body" weight="600" color={colors.danger}>
                    Leave group
                  </AppText>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : loadError ? (
          <View style={styles.errorBlock}>
            <AppText variant="headline" weight="600" color={colors.textSecondary}>
              Group not found
            </AppText>
            <AppButton variant="secondary" onPress={() => router.back()} style={styles.errorButton}>
              Go back
            </AppButton>
          </View>
        ) : (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}
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
    paddingTop: spacing[8],
    gap: spacing[28],
  },
  section: {
    gap: spacing[8],
  },
  sectionLabel: {
    letterSpacing: 0.5,
  },

  // Group identity
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[16],
    paddingVertical: spacing[8],
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: spacing[4],
  },
  groupName: {
    flexShrink: 1,
  },
  nameInputWrap: {
    minHeight: 25,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.white,
    paddingVertical: 0,
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: spacing[8],
  },

  // Join code
  codeBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius[12],
    paddingLeft: spacing[16],
    paddingRight: spacing[8],
    minHeight: 60,
  },
  codeText: {
    flex: 1,
    fontFamily: MONO_FONT,
    letterSpacing: 5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    minHeight: 40,
    paddingHorizontal: spacing[12],
    borderRadius: radius[8],
    backgroundColor: hexToRGBA(colors.accent, 0.12),
  },
  copyBtnCopied: {
    backgroundColor: hexToRGBA(colors.success, 0.12),
  },
  helperText: {
    marginTop: spacing[4],
    lineHeight: 18,
  },

  // Sync
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    minHeight: 52,
    paddingVertical: spacing[8],
  },
  syncText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  // Members
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    minHeight: 52,
    paddingVertical: spacing[8],
  },
  memberName: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: -spacing[16],
  },
  noMembers: {
    paddingVertical: spacing[8],
    lineHeight: 18,
  },
  ownerBadge: {
    backgroundColor: hexToRGBA(colors.accent, 0.14),
    borderRadius: radius[8],
    paddingHorizontal: spacing[8],
    paddingVertical: 3,
  },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // Leave
  leaveSection: {
    marginTop: spacing[8],
  },
  leaveDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: -spacing[16],
  },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[8],
    minHeight: 52,
    paddingVertical: spacing[16],
  },

  // States
  errorBlock: {
    alignItems: "center",
    gap: spacing[16],
    paddingTop: spacing[32],
  },
  errorButton: {
    minWidth: 140,
  },
  loadingBlock: {
    alignItems: "center",
    paddingTop: spacing[48],
  },
});