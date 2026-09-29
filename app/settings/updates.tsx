import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  RefreshCw,
  Download,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  FileText,
  Smartphone,
  Layers,
  ArrowRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { AUTHOR_CREDIT } from '@/constants/version';
import { useAppUpdateManager, getNextVersion } from '@/services/updates/updateManager';

function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Just now';
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date | null): string {
  if (!d) return 'Recent update';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function UpdatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    isEnabled,
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    releaseDescription,
    availableVersion,
    availableDescription,
    bundleSize,
    updateId,
    channel,
    runtimeVersion,
    isEmbeddedLaunch,
    createdAt,
    lastCheckedAt,
    daysRemainingBeforeAutoUpdate,
    manualStatus,
    errorMessage,
    checkForUpdates,
    downloadUpdate,
    restartToApply,
  } = useAppUpdateManager();

  const isChecking = manualStatus === 'checking';
  const pct = Math.round(downloadProgress * 100);

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      {/* ── Top Bar ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color={expenseColors.accentPeach} strokeWidth={2.4} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Software Update</AppText>
        <View style={styles.channelHeaderPill}>
          <AppText style={styles.channelHeaderPillText}>{channel}</AppText>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* ══════════════════════════════════════════════════
            CASE 1: UPDATE READY TO APPLY
        ══════════════════════════════════════════════════ */}
        {(isUpdatePending || manualStatus === 'downloaded') ? (
          <View style={styles.stateContainer}>
            <View style={styles.heroCard}>
              <View style={[styles.heroIconCircle, styles.iconCircleGreen]}>
                <RotateCw size={26} color="#70D6BC" strokeWidth={2.4} />
              </View>
              <View style={[styles.statusBadge, styles.badgeGreen]}>
                <AppText style={[styles.statusBadgeText, { color: '#70D6BC' }]}>Ready to Install</AppText>
              </View>
              <AppText style={styles.heroTitle}>Update Ready to Apply</AppText>
              <AppText style={styles.heroSubtitle}>
                {availableVersion ? `Version ${availableVersion}` : 'The latest update package'} has been downloaded and verified on your device.
              </AppText>
            </View>

            {/* Instruction Card */}
            <View style={styles.guidanceCard}>
              <View style={styles.guidanceIconCircle}>
                <Smartphone size={18} color="#70D6BC" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.guidanceTitle}>To finish updating:</AppText>
                <AppText style={styles.guidanceBody}>
                  Tap <AppText style={styles.guidanceBodyHighlight}>Restart App Now</AppText> below, or swipe this app away from your phone's <AppText style={styles.guidanceBodyHighlight}>Recent Apps / App Switcher</AppText> and reopen it.
                </AppText>
              </View>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.restartBtn]}
              activeOpacity={0.82}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                restartToApply();
              }}
            >
              <RotateCw size={18} color="#0D1117" strokeWidth={2.4} />
              <AppText style={[styles.primaryActionBtnText, { color: '#0D1117' }]}>
                Restart App Now
              </AppText>
            </TouchableOpacity>
          </View>
        ) : isDownloading ? (
          /* ══════════════════════════════════════════════════
              CASE 2: DOWNLOADING IN PROGRESS
          ══════════════════════════════════════════════════ */
          <View style={styles.stateContainer}>
            <View style={styles.heroCard}>
              <View style={[styles.heroIconCircle, styles.iconCircleBlue]}>
                <Download size={26} color="#9DC6EB" strokeWidth={2.4} />
              </View>
              <View style={[styles.statusBadge, styles.badgeBlue]}>
                <AppText style={[styles.statusBadgeText, { color: '#9DC6EB' }]}>{pct}% Downloaded</AppText>
              </View>
              <AppText style={styles.heroTitle}>Downloading Update</AppText>
              <AppText style={styles.heroSubtitle}>
                Fetching bundle assets and code ({bundleSize})...
              </AppText>

              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(pct, 6)}%` }]} />
                </View>
              </View>
            </View>
          </View>
        ) : (isUpdateAvailable || manualStatus === 'available') ? (
          /* ══════════════════════════════════════════════════
              CASE 3: NEW UPDATE AVAILABLE
          ══════════════════════════════════════════════════ */
          <View style={styles.stateContainer}>
            {/* Version Transition Hero Card */}
            <View style={styles.heroCard}>
              <View style={[styles.heroIconCircle, styles.iconCirclePeach]}>
                <Sparkles size={26} color={expenseColors.accentPeach} strokeWidth={2.2} />
              </View>
              <View style={[styles.statusBadge, styles.badgePeach]}>
                <AppText style={[styles.statusBadgeText, { color: expenseColors.accentPeach }]}>New Release Available</AppText>
              </View>

              <AppText style={styles.heroTitle}>Software Update Ready</AppText>

              {/* Version Jump Graphic */}
              <View style={styles.versionTransitionWrap}>
                <View style={styles.versionFromBox}>
                  <AppText style={styles.versionFromText}>{activeVersion}</AppText>
                </View>
                <ArrowRight size={16} color={expenseColors.accentPeach} strokeWidth={2.4} />
                <View style={styles.versionToBox}>
                  <AppText style={styles.versionToText}>{availableVersion || getNextVersion(activeVersion)}</AppText>
                </View>
              </View>

              <AppText style={styles.heroSubtitle}>
                Download Size: {bundleSize} · Release Channel: {channel}
              </AppText>
            </View>

            {/* What's New / Description Card */}
            <View style={styles.releaseNotesCard}>
              <View style={styles.releaseNotesHeader}>
                <FileText size={15} color={expenseColors.accentPeach} />
                <AppText style={styles.releaseNotesTitle}>
                  What's in {availableVersion || 'this release'}
                </AppText>
              </View>
              <AppText style={styles.releaseNotesBody}>
                {availableDescription || 'Includes performance optimizations, UI polish, and bug fixes.'}
              </AppText>
            </View>

            {/* 48-Hour Auto-Apply Notice */}
            {daysRemainingBeforeAutoUpdate !== null && (
              <View style={styles.autoUpdateNoticeCard}>
                <Clock size={16} color="#F4CD89" />
                <View style={{ flex: 1 }}>
                  <AppText style={styles.autoUpdateNoticeTitle}>Automatic Update</AppText>
                  <AppText style={styles.autoUpdateNoticeBody}>
                    Will automatically activate in {daysRemainingBeforeAutoUpdate <= 1 ? 'less than 24 hours' : `${daysRemainingBeforeAutoUpdate} days`} if unapplied.
                  </AppText>
                </View>
              </View>
            )}

            {/* Download Action Button */}
            <TouchableOpacity
              style={styles.primaryActionBtn}
              activeOpacity={0.82}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                downloadUpdate();
              }}
            >
              <Download size={18} color="#FFFFFF" strokeWidth={2.4} />
              <AppText style={styles.primaryActionBtnText}>
                Download & Install Update ({bundleSize})
              </AppText>
            </TouchableOpacity>
          </View>
        ) : (manualStatus === 'error' || errorMessage) ? (
          /* ══════════════════════════════════════════════════
              CASE 4: ERROR / OFFLINE
          ══════════════════════════════════════════════════ */
          <View style={styles.stateContainer}>
            <View style={styles.heroCard}>
              <View style={[styles.heroIconCircle, styles.iconCircleRed]}>
                <AlertCircle size={28} color="#FF6B6B" strokeWidth={2.4} />
              </View>
              <View style={[styles.statusBadge, styles.badgeRed]}>
                <AppText style={[styles.statusBadgeText, { color: '#FF6B6B' }]}>Connection Error</AppText>
              </View>
              <AppText style={styles.heroTitle}>Unable to Check Updates</AppText>
              <AppText style={styles.heroSubtitle}>
                {errorMessage || 'Could not connect to update servers. Check your connection.'}
              </AppText>
            </View>

            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.checkAgainBtn]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                checkForUpdates();
              }}
            >
              <RefreshCw size={17} color={expenseColors.accentPeach} strokeWidth={2.2} />
              <AppText style={[styles.primaryActionBtnText, { color: expenseColors.accentPeach }]}>
                Try Again
              </AppText>
            </TouchableOpacity>
          </View>
        ) : (
          /* ══════════════════════════════════════════════════
              CASE 5: UP TO DATE (DEFAULT RESTING STATE)
          ══════════════════════════════════════════════════ */
          <View style={styles.stateContainer}>
            {/* Status Hero Card */}
            <View style={styles.heroCard}>
              <View style={[styles.heroIconCircle, styles.iconCircleGreen]}>
                {isChecking ? (
                  <ActivityIndicator size="small" color="#70D6BC" />
                ) : (
                  <CheckCircle2 size={30} color="#70D6BC" strokeWidth={2.2} />
                )}
              </View>

              <View style={[styles.statusBadge, styles.badgeGreen]}>
                <AppText style={[styles.statusBadgeText, { color: '#70D6BC' }]}>Latest Version</AppText>
              </View>

              <AppText style={styles.heroTitle}>
                {isChecking ? 'Checking for Updates...' : 'App is Up to Date'}
              </AppText>
              <AppText style={styles.heroSubtitle}>
                Version {activeVersion} {isEmbeddedLaunch ? '· Base Binary' : '· Over-the-Air'}
              </AppText>

              {/* Timestamp Metadata */}
              <View style={styles.metadataMetaRow}>
                <Clock size={12} color="#656A7A" />
                <AppText style={styles.lastCheckedSubtext}>
                  Last checked: {formatRelativeTime(lastCheckedAt)} · Installed: {formatDate(createdAt)}
                </AppText>
              </View>
            </View>

            {/* What's New in This Version Card */}
            {releaseDescription && (
              <View style={styles.releaseNotesCard}>
                <View style={styles.releaseNotesHeader}>
                  <FileText size={15} color={expenseColors.accentPeach} />
                  <AppText style={styles.releaseNotesTitle}>
                    What's New in {activeVersion}
                  </AppText>
                </View>
                <AppText style={styles.releaseNotesBody}>
                  {releaseDescription}
                </AppText>
              </View>
            )}

            {/* Build & System Details Grouped Card */}
            <View style={styles.sectionHeaderWrap}>
              <Layers size={13} color="#6F7485" />
              <AppText style={styles.sectionCategoryHeader}>SYSTEM INFORMATION</AppText>
            </View>

            <View style={styles.groupedTableCard}>
              <InfoRow
                label="Active Version"
                value={`${activeVersion} (${isEmbeddedLaunch ? 'Base' : 'OTA'})`}
                valueColor="#70D6BC"
              />
              <View style={styles.tableDivider} />
              <InfoRow label="Binary Build" value="v1.0.0 (Build 1)" />
              <View style={styles.tableDivider} />
              <InfoRow label="Release Channel" value={channel} />
              <View style={styles.tableDivider} />
              <InfoRow label="Runtime Target" value={`Version ${runtimeVersion}`} />
              <View style={styles.tableDivider} />
              <InfoRow
                label="Active Update Hash"
                value={updateId ? `#${updateId.slice(0, 8)}` : isEmbeddedLaunch ? 'Embedded Base' : 'Live Bundle'}
                isMonospace={true}
              />
              <View style={styles.tableDivider} />
              <InfoRow
                label="Code Source"
                value={isEmbeddedLaunch ? 'Embedded Base APK' : 'Over-The-Air Live Bundle'}
              />
            </View>

            {/* Check for Updates Action Button */}
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.checkAgainBtn]}
              activeOpacity={0.8}
              disabled={isChecking}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                checkForUpdates();
              }}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={expenseColors.accentPeach} />
              ) : (
                <RefreshCw size={17} color={expenseColors.accentPeach} strokeWidth={2.2} />
              )}
              <AppText style={[styles.primaryActionBtnText, { color: expenseColors.accentPeach }]}>
                {isChecking ? 'Checking for Updates...' : 'Check for Update'}
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footerWrap}>
          <AppText style={styles.footerAuthorText}>
            {AUTHOR_CREDIT}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  isMonospace,
  valueColor,
}: {
  label: string;
  value: string;
  isMonospace?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.tableRow}>
      <AppText style={styles.tableLabel}>{label}</AppText>
      <AppText
        style={[
          styles.tableValue,
          valueColor ? { color: valueColor } : undefined,
          isMonospace && styles.tableValueMonospace,
        ]}
        numberOfLines={1}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#101114',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 157, 102, 0.1)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  channelHeaderPill: {
    backgroundColor: 'rgba(255, 157, 102, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.2)',
  },
  channelHeaderPillText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  stateContainer: {
    gap: 16,
  },
  heroCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    textAlign: 'center',
  },
  heroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 14,
  },
  iconCircleGreen: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    borderColor: 'rgba(112, 214, 188, 0.3)',
  },
  iconCircleBlue: {
    backgroundColor: 'rgba(157, 198, 235, 0.12)',
    borderColor: 'rgba(157, 198, 235, 0.3)',
  },
  iconCirclePeach: {
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  iconCircleRed: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  badgeGreen: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    borderColor: 'rgba(112, 214, 188, 0.25)',
  },
  badgeBlue: {
    backgroundColor: 'rgba(157, 198, 235, 0.12)',
    borderColor: 'rgba(157, 198, 235, 0.25)',
  },
  badgePeach: {
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  badgeRed: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#9EABB8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  versionTransitionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  versionFromBox: {
    backgroundColor: '#1E212B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  versionFromText: {
    color: '#8E919D',
    fontSize: 13,
    fontWeight: '600',
  },
  versionToBox: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  versionToText: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '700',
  },
  metadataMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lastCheckedSubtext: {
    color: '#656A7A',
    fontSize: 11,
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    marginTop: 18,
    paddingTop: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E212B',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9DC6EB',
  },
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(112, 214, 188, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.25)',
  },
  guidanceIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(112, 214, 188, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  guidanceTitle: {
    color: '#70D6BC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  guidanceBody: {
    color: '#D1EAE2',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  guidanceBodyHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  releaseNotesCard: {
    backgroundColor: '#171920',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.2)',
  },
  releaseNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  releaseNotesTitle: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  releaseNotesBody: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  autoUpdateNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(244, 205, 137, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 205, 137, 0.2)',
  },
  autoUpdateNoticeTitle: {
    color: '#F4CD89',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  autoUpdateNoticeBody: {
    color: '#C4CCD8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionCategoryHeader: {
    color: '#6F7485',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: expenseColors.accentPeach,
    height: 52,
    borderRadius: 16,
    shadowColor: expenseColors.accentPeach,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  restartBtn: {
    backgroundColor: '#70D6BC',
    shadowColor: '#70D6BC',
  },
  checkAgainBtn: {
    backgroundColor: 'rgba(255, 157, 102, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  groupedTableCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  tableLabel: {
    color: '#8E919D',
    fontSize: 13,
    fontWeight: '500',
  },
  tableValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tableValueMonospace: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: expenseColors.accentPeach,
  },
  tableDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginLeft: 16,
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  footerAuthorText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
    fontWeight: '500',
  },
});
