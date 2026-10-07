import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { ADMIN_NAME, APP_BINARY_VERSION, AUTHOR_CREDIT } from '@/constants/version';
import Constants from 'expo-constants';
import { useAppUpdateManager } from '@/services/updates/updateManager';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Just now';
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date | null): string {
  const target = d || new Date();
  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function UpdatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [isRestarting, setIsRestarting] = useState(false);

  const {
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
    activeVersion,
    activeRelease,
    availableRelease,
    history,
    updateId,
    channel,
    runtimeVersion,
    isEmbeddedLaunch,
    createdAt,
    lastCheckedAt,
    manualStatus,
    errorMessage,
    checkForUpdates,
    downloadUpdate,
    restartToApply,
    openBuildUrl,
    contactAdmin,
  } = useAppUpdateManager();

  const isChecking = manualStatus === 'checking';
  const isNativeRequired =
    manualStatus === 'native_required' || (availableRelease?.isNativeRequired ?? false);
  const pct = Math.round(downloadProgress * 100);

  const toggleHistory = () => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFullHistory((prev) => !prev);
  };

  const toggleVersionItem = (ver: string) => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedVersions((prev) => ({
      ...prev,
      [ver]: !prev[ver],
    }));
  };

  const handleCopyBundleHash = useCallback(async (hash: string) => {
    await Clipboard.setStringAsync(hash);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }, []);

  const handleRestart = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setIsRestarting(true);
    setTimeout(() => {
      restartToApply();
    }, 250);
  };

  const displayVersion = activeVersion.startsWith('v') ? activeVersion.slice(1) : activeVersion;
  const nativeBuildDisplay = Constants.nativeAppVersion
    ? `v${Constants.nativeAppVersion} (Build ${Constants.nativeBuildVersion || '1'})`
    : APP_BINARY_VERSION;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Apple iOS Standard Navigation Header ── */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          style={styles.backButton}
          activeOpacity={0.65}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
        >
          <ChevronLeft size={22} color={expenseColors.accentPeach} strokeWidth={2.4} />
          <AppText style={styles.backButtonText}>Settings</AppText>
        </TouchableOpacity>

        <AppText style={styles.navTitle} numberOfLines={1}>
          Software Update
        </AppText>

        <View style={styles.navRightPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: insets.bottom + 40 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isChecking}
            onRefresh={checkForUpdates}
            tintColor={expenseColors.accentPeach}
          />
        }
      >
        {/* ════════════════════════════════════════════════════
            HERO UPDATE STAGE (STATUS / AVAILABLE / RESTART)
        ════════════════════════════════════════════════════ */}
        {isUpdatePending || manualStatus === 'downloaded' ? (
          /* ── CASE 1: UPDATE READY TO INSTALL (RESTART TO UPDATE) ── */
          <View style={styles.sectionWrap}>
            <View style={styles.cardGroup}>
              <View style={styles.cardPadding}>
                <View style={styles.updateTitleRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.heroVersionTitle}>
                      Monevo {availableRelease?.cleanVersion || 'Update'}
                    </AppText>
                    <AppText style={styles.heroSubText}>
                      Monevo Inc. · Ready to Install
                    </AppText>
                  </View>
                  <View style={styles.badgeSuccess}>
                    <AppText style={styles.badgeSuccessText}>Downloaded</AppText>
                  </View>
                </View>

                <View style={styles.separator} />

                <AppText style={styles.bodyDescription}>
                  The update has finished downloading and is ready to apply. Restart Monevo to complete the installation.
                </AppText>

                {availableRelease?.notes && availableRelease.notes.length > 0 && (
                  <View style={styles.releaseNotesBox}>
                    <AppText style={styles.releaseNotesTitle}>What's New</AppText>
                    {availableRelease.notes.map((note, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <View style={styles.bulletDot} />
                        <AppText style={styles.bulletText}>{note}</AppText>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 18 }]}
                  activeOpacity={0.8}
                  onPress={handleRestart}
                  disabled={isRestarting}
                >
                  {isRestarting ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <RotateCw size={17} color="#000000" strokeWidth={2.4} />
                      <AppText style={styles.primaryButtonText}>Restart to Update</AppText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : isDownloading ? (
          /* ── CASE 2: DOWNLOADING IN PROGRESS ── */
          <View style={styles.sectionWrap}>
            <View style={styles.cardGroup}>
              <View style={styles.cardPadding}>
                <View style={styles.updateTitleRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.heroVersionTitle}>
                      Monevo {availableRelease?.cleanVersion || 'Update'}
                    </AppText>
                    <AppText style={styles.heroSubText}>
                      Downloading update package…
                    </AppText>
                  </View>
                  <AppText style={styles.progressPercentText}>{pct}%</AppText>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(pct, 6)}%` }]} />
                </View>

                <AppText style={styles.progressFootnote}>
                  Please keep Monevo open while files are verified.
                </AppText>
              </View>
            </View>
          </View>
        ) : isNativeRequired ? (
          /* ── CASE 3: NATIVE BUILD REQUIRED (.APK / .IPA) ── */
          <View style={styles.sectionWrap}>
            <View style={styles.cardGroup}>
              <View style={styles.cardPadding}>
                <View style={styles.updateTitleRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.heroVersionTitle}>
                      {availableRelease?.version || 'New Build'}
                    </AppText>
                    <AppText style={styles.heroSubText}>
                      Native Installer Required (.apk / .ipa)
                    </AppText>
                  </View>
                  <View style={styles.badgeNotice}>
                    <AppText style={styles.badgeNoticeText}>New Build</AppText>
                  </View>
                </View>

                <View style={styles.separator} />

                <AppText style={styles.bodyDescription}>
                  This release contains native engine upgrades. Contact the developer ({ADMIN_NAME}) to receive the latest installer.
                </AppText>

                <View style={{ gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.8}
                    onPress={() => contactAdmin(availableRelease?.version)}
                  >
                    <MessageSquare size={17} color="#000000" strokeWidth={2.2} />
                    <AppText style={styles.primaryButtonText}>
                      Request Installer via WhatsApp
                    </AppText>
                  </TouchableOpacity>

                  {availableRelease?.buildUrl && (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      activeOpacity={0.8}
                      onPress={() => openBuildUrl()}
                    >
                      <ExternalLink size={16} color={expenseColors.accentPeach} />
                      <AppText style={styles.secondaryButtonText}>
                        Download Directly
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : isUpdateAvailable || manualStatus === 'available' ? (
          /* ── CASE 4: UPDATE AVAILABLE TO DOWNLOAD ── */
          <View style={styles.sectionWrap}>
            <View style={styles.cardGroup}>
              <View style={styles.cardPadding}>
                <View style={styles.updateTitleRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.heroVersionTitle}>
                      Monevo {availableRelease?.cleanVersion || 'Update'}
                    </AppText>
                    <AppText style={styles.heroSubText}>
                      Monevo Inc. · Over-the-Air Update
                    </AppText>
                  </View>
                  <View style={styles.badgeAccent}>
                    <AppText style={styles.badgeAccentText}>Available</AppText>
                  </View>
                </View>

                <View style={styles.separator} />

                <AppText style={styles.bodyDescription}>
                  {availableRelease?.summary ||
                    'This update includes verified performance optimizations, bug fixes, and user interface enhancements.'}
                </AppText>

                {availableRelease?.notes && availableRelease.notes.length > 0 && (
                  <View style={styles.releaseNotesBox}>
                    <AppText style={styles.releaseNotesTitle}>What's New</AppText>
                    {availableRelease.notes.map((note, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <View style={styles.bulletDot} />
                        <AppText style={styles.bulletText}>{note}</AppText>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 18 }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    downloadUpdate();
                  }}
                >
                  <Download size={17} color="#000000" strokeWidth={2.4} />
                  <AppText style={styles.primaryButtonText}>Download and Install</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : manualStatus === 'error' || errorMessage ? (
          /* ── CASE 5: ERROR STATE ── */
          <View style={styles.sectionWrap}>
            <View style={styles.cardGroup}>
              <View style={styles.cardPadding}>
                <View style={styles.centeredBlock}>
                  <AlertCircle size={36} color="#FF453A" strokeWidth={2} />
                  <AppText style={[styles.centeredTitle, { color: '#FF453A' }]}>
                    Unable to Check for Updates
                  </AppText>
                  <AppText style={styles.centeredSubtitle}>
                    {errorMessage || 'An error occurred while checking for updates. Check your internet connection.'}
                  </AppText>
                </View>

                <TouchableOpacity
                  style={[styles.secondaryButton, { marginTop: 12 }]}
                  activeOpacity={0.7}
                  onPress={checkForUpdates}
                >
                  <RefreshCw size={15} color={expenseColors.accentPeach} />
                  <AppText style={styles.secondaryButtonText}>Try Again</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* ── CASE 6: UP TO DATE (APPLE CLEAN SERENE HERO) ── */
          <View style={styles.sectionWrap}>
            <View style={styles.upToDateHeroContainer}>
              <View style={styles.checkCircleIcon}>
                <CheckCircle2 size={44} color="#30D158" strokeWidth={2.2} />
              </View>

              <AppText style={styles.upToDateVersionNumber}>
                Monevo {displayVersion}
              </AppText>
              <AppText style={styles.upToDateStatusLabel}>
                Monevo is up to date
              </AppText>
              <AppText style={styles.upToDateTimestamp}>
                Last checked: {formatRelativeTime(lastCheckedAt)}
              </AppText>
            </View>

            {/* Apple Inset Action Row: Check for Updates */}
            <View style={styles.cardGroup}>
              <TouchableOpacity
                style={styles.checkActionRow}
                activeOpacity={0.7}
                disabled={isChecking}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  checkForUpdates();
                }}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color={expenseColors.accentPeach} />
                ) : (
                  <RefreshCw size={16} color={expenseColors.accentPeach} strokeWidth={2.2} />
                )}
                <AppText style={styles.checkActionRowText}>
                  {isChecking ? 'Checking for Updates…' : 'Check for Updates'}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            SECTION 2: ABOUT THIS BUILD (INSTALLATION INFO)
        ════════════════════════════════════════════════════ */}
        <View style={styles.sectionWrap}>
          <AppText style={styles.sectionHeaderTitle}>ABOUT THIS BUILD</AppText>

          <View style={styles.cardGroup}>
            <View style={styles.tableRow}>
              <AppText style={styles.rowLabel}>Version</AppText>
              <AppText style={styles.rowValueHighlight}>{activeVersion}</AppText>
            </View>

            <View style={styles.tableDivider} />

            <View style={styles.tableRow}>
              <AppText style={styles.rowLabel}>Build</AppText>
              <AppText style={styles.rowValue}>{nativeBuildDisplay}</AppText>
            </View>

            <View style={styles.tableDivider} />

            <View style={styles.tableRow}>
              <AppText style={styles.rowLabel}>Channel</AppText>
              <AppText style={styles.rowValue}>{channel}</AppText>
            </View>

            <View style={styles.tableDivider} />

            <View style={styles.tableRow}>
              <AppText style={styles.rowLabel}>Installation</AppText>
              <AppText style={styles.rowValue}>
                {isEmbeddedLaunch ? 'Embedded Base' : 'Over-the-Air (OTA)'}
              </AppText>
            </View>

            <View style={styles.tableDivider} />

            <View style={styles.tableRow}>
              <AppText style={styles.rowLabel}>Runtime Target</AppText>
              <AppText style={styles.rowValue}>Runtime {runtimeVersion}</AppText>
            </View>

            <View style={styles.tableDivider} />

            <TouchableOpacity
              style={styles.tableRow}
              activeOpacity={0.7}
              onPress={() => {
                if (updateId) handleCopyBundleHash(updateId);
              }}
            >
              <AppText style={styles.rowLabel}>Bundle ID</AppText>
              <View style={styles.rowValueWithIcon}>
                <AppText style={[styles.rowValue, styles.monospaceText]}>
                  {updateId ? `#${updateId.slice(0, 10)}…` : isEmbeddedLaunch ? 'Embedded' : 'Live Bundle'}
                </AppText>
                {updateId && (
                  copiedHash ? (
                    <Check size={14} color="#30D158" strokeWidth={2.4} />
                  ) : (
                    <Copy size={13} color="#8E8E93" />
                  )
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════
            SECTION 3: WHAT'S NEW IN THIS VERSION
        ════════════════════════════════════════════════════ */}
        {activeRelease?.notes && activeRelease.notes.length > 0 && (
          <View style={styles.sectionWrap}>
            <AppText style={styles.sectionHeaderTitle}>
              WHAT'S NEW IN {activeVersion}
            </AppText>

            <View style={styles.cardGroup}>
              <View style={styles.cardPadding}>
                {activeRelease.notes.map((note, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <AppText style={styles.bulletText}>{note}</AppText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            SECTION 4: VERSION HISTORY ARCHIVE (APP STORE / TESTFLIGHT)
        ════════════════════════════════════════════════════ */}
        {history && history.length > 0 && (
          <View style={styles.sectionWrap}>
            <AppText style={styles.sectionHeaderTitle}>VERSION HISTORY</AppText>

            <View style={styles.cardGroup}>
              {(showFullHistory ? history : history.slice(0, 3)).map((item, idx, arr) => {
                const isCurrent = item.version === activeVersion;
                const isExpanded = expandedVersions[item.version] ?? (idx === 0);
                const isLast = idx === arr.length - 1;

                return (
                  <View key={item.version + idx}>
                    <TouchableOpacity
                      style={styles.historyItemHeader}
                      activeOpacity={0.7}
                      onPress={() => toggleVersionItem(item.version)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.historyVersionRow}>
                          <AppText style={styles.historyVersionLabel}>{item.version}</AppText>
                          {isCurrent && (
                            <View style={styles.currentIndicator}>
                              <AppText style={styles.currentIndicatorText}>Current</AppText>
                            </View>
                          )}
                          <View style={styles.installTypeIndicator}>
                            <AppText style={styles.installTypeIndicatorText}>
                              {item.isNativeBuild ? 'Native' : 'OTA'}
                            </AppText>
                          </View>
                        </View>
                        <AppText style={styles.historyDateLabel}>{item.date}</AppText>
                      </View>

                      {isExpanded ? (
                        <ChevronUp size={16} color="#8E8E93" />
                      ) : (
                        <ChevronDown size={16} color="#8E8E93" />
                      )}
                    </TouchableOpacity>

                    {isExpanded && item.notes && item.notes.length > 0 && (
                      <View style={styles.historyNotesWrap}>
                        {item.notes.map((note: string, nIdx: number) => (
                          <View key={nIdx} style={styles.historyBulletRow}>
                            <View style={styles.historyBulletDot} />
                            <AppText style={styles.historyBulletText}>{note}</AppText>
                          </View>
                        ))}
                      </View>
                    )}

                    {!isLast && <View style={styles.tableDivider} />}
                  </View>
                );
              })}

              {history.length > 3 && (
                <>
                  <View style={styles.tableDivider} />
                  <TouchableOpacity
                    style={styles.expandHistoryRow}
                    activeOpacity={0.7}
                    onPress={toggleHistory}
                  >
                    <AppText style={styles.expandHistoryRowText}>
                      {showFullHistory ? 'Show Recent Only' : `View All ${history.length} Releases`}
                    </AppText>
                    {showFullHistory ? (
                      <ChevronUp size={15} color={expenseColors.accentPeach} />
                    ) : (
                      <ChevronDown size={15} color={expenseColors.accentPeach} />
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            SECTION 5: DEVELOPER & FEEDBACK
        ════════════════════════════════════════════════════ */}
        <View style={styles.sectionWrap}>
          <AppText style={styles.sectionHeaderTitle}>DEVELOPER</AppText>

          <View style={styles.cardGroup}>
            <View style={styles.tableRow}>
              <AppText style={styles.rowLabel}>Developer</AppText>
              <AppText style={styles.rowValue}>{ADMIN_NAME}</AppText>
            </View>

            <View style={styles.tableDivider} />

            <TouchableOpacity
              style={styles.disclosureRow}
              activeOpacity={0.7}
              onPress={() => contactAdmin()}
            >
              <AppText style={styles.disclosureRowText}>Send Feedback / Report Issue</AppText>
              <ChevronRight size={17} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Apple-styled Muted Footer ── */}
        <View style={styles.footerContainer}>
          <AppText style={styles.footerBrandText}>MONEVO</AppText>
          <AppText style={styles.footerAuthorText}>{AUTHOR_CREDIT}</AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 80,
  },
  backButtonText: {
    color: expenseColors.accentPeach,
    fontSize: 17,
    fontWeight: '400',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  navRightPlaceholder: {
    minWidth: 80,
  },

  scrollContainer: {
    paddingTop: 16,
  },
  sectionWrap: {
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 16,
  },

  /* ── Apple Inset Card Group ── */
  cardGroup: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPadding: {
    padding: 18,
  },
  tableDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },

  /* ── Up to Date Hero ── */
  upToDateHeroContainer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  checkCircleIcon: {
    marginBottom: 14,
  },
  upToDateVersionNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  upToDateStatusLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '400',
    marginTop: 4,
  },
  upToDateTimestamp: {
    fontSize: 13,
    color: '#636366',
    marginTop: 8,
  },

  checkActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  checkActionRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: expenseColors.accentPeach,
  },

  /* ── Hero Update Available / Downloaded Stage ── */
  updateTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroVersionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubText: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 3,
  },
  bodyDescription: {
    fontSize: 14,
    color: '#E5E5EA',
    lineHeight: 20,
  },
  releaseNotesBox: {
    marginTop: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 14,
  },
  releaseNotesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: expenseColors.accentPeach,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#D1D1D6',
    lineHeight: 18,
  },

  /* ── Badges ── */
  badgeSuccess: {
    backgroundColor: 'rgba(48, 209, 88, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSuccessText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeAccent: {
    backgroundColor: 'rgba(255, 157, 102, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeAccentText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeNotice: {
    backgroundColor: 'rgba(255, 214, 10, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeNoticeText: {
    color: '#FFD60A',
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── Apple Rounded Action Buttons ── */
  primaryButton: {
    backgroundColor: expenseColors.accentPeach,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: {
    color: expenseColors.accentPeach,
    fontSize: 15,
    fontWeight: '600',
  },

  /* ── Downloading Progress ── */
  progressPercentText: {
    fontSize: 15,
    fontWeight: '600',
    color: expenseColors.accentPeach,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: expenseColors.accentPeach,
    borderRadius: 3,
  },
  progressFootnote: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 10,
    textAlign: 'center',
  },

  /* ── Centered Error ── */
  centeredBlock: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  centeredTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 10,
  },
  centeredSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },

  /* ── Inset Table Rows (Apple HIG) ── */
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 48,
  },
  rowLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  rowValue: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '400',
  },
  rowValueHighlight: {
    fontSize: 15,
    color: '#30D158',
    fontWeight: '600',
  },
  rowValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monospaceText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },

  /* ── Disclosure Row ── */
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  disclosureRowText: {
    fontSize: 16,
    color: expenseColors.accentPeach,
    fontWeight: '400',
  },

  /* ── Version History Rows ── */
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  historyVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyVersionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currentIndicator: {
    backgroundColor: 'rgba(255, 157, 102, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: expenseColors.accentPeach,
  },
  installTypeIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  installTypeIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  historyDateLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  historyNotesWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 2,
  },
  historyBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  historyBulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8E8E93',
    marginTop: 7,
  },
  historyBulletText: {
    flex: 1,
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  expandHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  expandHistoryRowText: {
    fontSize: 14,
    fontWeight: '500',
    color: expenseColors.accentPeach,
  },

  /* ── Apple Footer ── */
  footerContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  footerBrandText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#48484A',
    letterSpacing: 1.5,
  },
  footerAuthorText: {
    fontSize: 11,
    color: '#48484A',
    marginTop: 2,
  },
});
