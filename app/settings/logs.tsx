import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronDown,
  ScrollText,
  Search,
  X,
  Share2,
  Trash2,
  ShieldAlert,
  Activity,
  Download,
  FilterX,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import {
  getLogs,
  getLogCounts,
  getLogScopes,
  clearAuditLogs,
  exportAuditLogsText,
  exportAuditLogsJson,
  formatIstShortTime,
  formatIstTimestamp,
  type AuditLogEntry,
  type AuditLevel,
  type AuditLogCounts,
} from '@/utils/auditLog';

const PAGE_SIZE = 50;

const LEVEL_COLORS: Record<string, { fg: string; bg: string }> = {
  action: { fg: '#9DC6EB', bg: 'rgba(157, 198, 235, 0.15)' },
  error: { fg: '#F48B8B', bg: 'rgba(244, 139, 139, 0.15)' },
  warn: { fg: '#F4CD89', bg: 'rgba(244, 205, 137, 0.15)' },
  info: { fg: '#A2AEBB', bg: 'rgba(162, 174, 187, 0.15)' },
};

export default function ActivityLogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [counts, setCounts] = useState<AuditLogCounts>({ actions: 0, errors: 0, warnings: 0, info: 0, total: 0 });
  const [scopes, setScopes] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<'all' | AuditLevel>('all');
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const offsetRef = useRef(0);

  // Debounce search input by 250ms so typing never freezes SQLite or JS thread
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  // Initial and filtered loader
  const reload = useCallback(
    async (opts?: { resetOffset?: boolean }) => {
      if (opts?.resetOffset) {
        offsetRef.current = 0;
      }
      try {
        const [rows, c, s] = await Promise.all([
          getLogs({
            level: levelFilter === 'all' ? undefined : levelFilter,
            scope: scopeFilter ?? undefined,
            query: debouncedQuery,
            limit: PAGE_SIZE,
            offset: offsetRef.current,
          }),
          getLogCounts(),
          getLogScopes(),
        ]);
        setLogs((prev) => (offsetRef.current === 0 ? rows : [...prev, ...rows]));
        setCounts(c);
        setScopes(s);
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        // fail-safe
      }
    },
    [levelFilter, scopeFilter, debouncedQuery]
  );

  useEffect(() => {
    void reload({ resetOffset: true });
  }, [levelFilter, scopeFilter, debouncedQuery, reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload({ resetOffset: true });
    setRefreshing(false);
  }, [reload]);

  // Buttery pagination: only query the next page, never re-count or re-scope
  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || refreshing || logs.length === 0) return;
    setLoadingMore(true);
    try {
      const nextOffset = offsetRef.current + PAGE_SIZE;
      const rows = await getLogs({
        level: levelFilter === 'all' ? undefined : levelFilter,
        scope: scopeFilter ?? undefined,
        query: debouncedQuery,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      offsetRef.current = nextOffset;
      if (rows.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setLogs((prev) => [...prev, ...rows]);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, refreshing, logs.length, levelFilter, scopeFilter, debouncedQuery]);

  // Export handlers
  const runExportJson = async (filteredOnly: boolean) => {
    setIsExporting(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const options = filteredOnly
        ? {
            level: levelFilter === 'all' ? undefined : levelFilter,
            scope: scopeFilter ?? undefined,
            query: debouncedQuery || undefined,
            limit: 5000,
          }
        : { limit: 5000 };

      const jsonStr = await exportAuditLogsJson(options);
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = filteredOnly
        ? `cashveil_audit_logs_filtered_${dateTag}.json`
        : `cashveil_audit_logs_all_${dateTag}.json`;
      const fileUri = `${docDir}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: filteredOnly ? 'Export Filtered Audit Logs (JSON)' : 'Export All Audit Logs (JSON)',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Export Saved', `Logs saved to ${fileUri}`);
      }
    } catch {
      Alert.alert('Export Failed', 'Could not export the activity log JSON.');
    } finally {
      setIsExporting(false);
    }
  };

  const runExportText = async () => {
    setIsExporting(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const text = await exportAuditLogsText();
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const dateTag = new Date().toISOString().slice(0, 10);
      const fileUri = `${docDir}cashveil_audit_logs_${dateTag}.txt`;

      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Activity Log (Text)',
          UTI: 'public.plain-text',
        });
      } else {
        Alert.alert('Export Complete', `Saved to ${fileUri}`);
      }
    } catch {
      Alert.alert('Export Failed', 'Could not export the activity log.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportOptions = () => {
    Haptics.selectionAsync().catch(() => {});
    const isFiltered = levelFilter !== 'all' || scopeFilter !== null || !!debouncedQuery.trim();

    Alert.alert(
      'Export Activity Logs',
      `All timestamps are formatted in Indian Standard Time (IST, UTC+05:30) with parsed calculation & event metadata.`,
      [
        {
          text: `Export Filtered JSON (${logs.length} ${isFiltered ? 'matching' : 'current'})`,
          onPress: () => void runExportJson(true),
        },
        {
          text: `Export All Logs JSON (${counts.total} total)`,
          onPress: () => void runExportJson(false),
        },
        {
          text: 'Export Plain Text (.txt)',
          onPress: () => void runExportText(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      'Clear Activity Logs',
      'This permanently deletes the local on-device audit trail. This cannot be undone. (Note: “Erase All Stored Data” does NOT clear logs — only this action does.)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Logs',
          style: 'destructive',
          onPress: async () => {
            await clearAuditLogs();
            setLogs([]);
            setCounts({ actions: 0, errors: 0, warnings: 0, info: 0, total: 0 });
            setHasMore(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert('Logs Cleared', 'The activity log has been permanently deleted.');
          },
        },
      ]
    );
  };

  const resetAllFilters = () => {
    setLevelFilter('all');
    setScopeFilter(null);
    setQuery('');
    setDebouncedQuery('');
  };

  const hasActiveFilters = levelFilter !== 'all' || scopeFilter !== null || !!debouncedQuery.trim();

  const levelChips: { key: 'all' | AuditLevel; label: string }[] = useMemo(
    () => [
      { key: 'all', label: `All (${counts.total})` },
      { key: 'action', label: `Actions (${counts.actions})` },
      { key: 'error', label: `Errors (${counts.errors})` },
      { key: 'warn', label: `Warnings (${counts.warnings})` },
      { key: 'info', label: `Info (${counts.info})` },
    ],
    [counts]
  );

  const renderItem = useCallback(
    ({ item }: { item: AuditLogEntry }) => {
      const lc = LEVEL_COLORS[item.level] ?? LEVEL_COLORS.info;
      const expanded = expandedId === item.id;
      const istTime = formatIstShortTime(item.ts);
      const fullIstTime = formatIstTimestamp(item.ts);

      let prettyMeta = item.meta;
      if (item.meta) {
        try {
          const parsed = JSON.parse(item.meta);
          prettyMeta = JSON.stringify(parsed, null, 2);
        } catch {
          prettyMeta = item.meta;
        }
      }

      return (
        <TouchableOpacity
          style={styles.logRow}
          activeOpacity={0.8}
          onPress={() => setExpandedId(expanded ? null : item.id)}
        >
          <View style={styles.logRowTop}>
            <View style={[styles.levelPill, { backgroundColor: lc.bg }]}>
              <AppText style={[styles.levelPillText, { color: lc.fg }]}>{item.level.toUpperCase()}</AppText>
            </View>
            <AppText style={styles.logTime}>{istTime}</AppText>
          </View>

          <AppText style={styles.logMessage} numberOfLines={expanded ? 0 : 2}>
            {item.message}
          </AppText>

          <View style={styles.logRowBottom}>
            <AppText style={styles.logScope}>#{item.scope}</AppText>
            <View style={styles.metaToggle}>
              <AppText style={styles.metaToggleText}>{expanded ? 'Hide details' : 'Details'}</AppText>
              <ChevronDown size={12} color="#8E919D" style={expanded ? styles.chevronOpen : undefined} />
            </View>
          </View>

          {expanded ? (
            <View style={styles.expandedContainer}>
              <View style={styles.timestampRow}>
                <AppText style={styles.timestampLabel}>Time (IST):</AppText>
                <AppText style={styles.timestampVal} selectable>
                  {fullIstTime}
                </AppText>
              </View>
              <View style={styles.timestampRow}>
                <AppText style={styles.timestampLabel}>UTC ISO:</AppText>
                <AppText style={styles.timestampVal} selectable>
                  {item.ts}
                </AppText>
              </View>
              {prettyMeta ? (
                <View style={styles.metaBox}>
                  <AppText style={styles.metaBoxTitle}>PAYLOAD / METADATA</AppText>
                  <AppText style={styles.logMeta} selectable>
                    {prettyMeta}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [expandedId]
  );

  // Everything that was previously static (banner, summary, chips) now scrolls
  // naturally with the FlatList so the screen is buttery smooth and never stuck
  const renderListHeader = useMemo(() => {
    return (
      <View style={styles.scrollableHeaderContainer}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <ShieldAlert size={18} color="#9DC6EB" />
          <AppText style={styles.infoBannerText}>
            On-device audit trail of transactions, balance calculations, settlements, and errors. Stored offline
            in SQLite — never uploaded. Survives app resets.
          </AppText>
        </View>

        {/* Summary Metrics */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryMetric}>
            <AppText style={styles.summaryCount}>{counts.total}</AppText>
            <AppText style={styles.summaryLabel}>Total Logs</AppText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryMetric}>
            <AppText style={[styles.summaryCount, { color: '#F48B8B' }]}>{counts.errors}</AppText>
            <AppText style={styles.summaryLabel}>Errors</AppText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryMetric}>
            <AppText style={[styles.summaryCount, { color: '#F4CD89' }]}>{counts.warnings}</AppText>
            <AppText style={styles.summaryLabel}>Warnings</AppText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryMetric}>
            <AppText style={[styles.summaryCount, { color: '#9DC6EB' }]}>{counts.actions}</AppText>
            <AppText style={styles.summaryLabel}>Actions</AppText>
          </View>
        </View>

        {/* Level Filters (Horizontal Scroll) */}
        <View style={styles.chipsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {levelChips.map((c) => {
              const active = levelFilter === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLevelFilter(c.key)}
                  activeOpacity={0.8}
                >
                  <AppText style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Scope Filters (Horizontal Scroll) */}
        {scopes.length > 0 ? (
          <View style={styles.scopeSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {['all', ...scopes].map((item) => {
                const active = (scopeFilter ?? 'all') === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.scopeChip, active && styles.scopeChipActive]}
                    onPress={() => setScopeFilter(item === 'all' ? null : item)}
                    activeOpacity={0.8}
                  >
                    <AppText style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>
                      {item === 'all' ? 'All Scopes' : `#${item}`}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Active Filter Strip with Reset Button */}
        {hasActiveFilters ? (
          <View style={styles.activeFilterStrip}>
            <AppText style={styles.activeFilterText}>
              Filters active:{' '}
              {levelFilter !== 'all' ? `${levelFilter.toUpperCase()} ` : ''}
              {scopeFilter ? `#${scopeFilter} ` : ''}
              {debouncedQuery ? `“${debouncedQuery}”` : ''}
            </AppText>
            <TouchableOpacity onPress={resetAllFilters} style={styles.resetFilterBtn} hitSlop={8}>
              <FilterX size={13} color="#F48B8B" />
              <AppText style={styles.resetFilterText}>Reset</AppText>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Section title & count */}
        <View style={styles.listHeaderRow}>
          <Activity size={14} color="#8E919D" />
          <AppText style={styles.listHeaderText}>
            {logs.length} displayed {hasMore ? '• scroll for more' : '• all logs loaded'}
          </AppText>
        </View>
      </View>
    );
  }, [
    counts,
    levelChips,
    levelFilter,
    scopes,
    scopeFilter,
    hasActiveFilters,
    debouncedQuery,
    logs.length,
    hasMore,
  ]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Pinned Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={expenseColors.accentPeach} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <AppText style={styles.headerTitle}>ACTIVITY LOGS</AppText>
          <AppText style={styles.headerSubtitle}>IST (UTC+05:30) · ON-DEVICE AUDIT</AppText>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleExportOptions}
            activeOpacity={0.8}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Share2 size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerActionBtn, styles.clearBtnBox]} onPress={handleClear} activeOpacity={0.8}>
            <Trash2 size={18} color="#F48B8B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Pinned Quick Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Search size={15} color="#8E919D" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search logs, calculations, accounts, errors…"
            placeholderTextColor="#656978"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
              <X size={15} color="#8E919D" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.quickJsonExportBtn}
          onPress={() => void runExportJson(true)}
          activeOpacity={0.8}
        >
          <Download size={15} color="#9DC6EB" />
          <AppText style={styles.quickJsonExportText}>JSON</AppText>
        </TouchableOpacity>
      </View>

      {/* Main FlatList with fluid inertia scrolling */}
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={expenseColors.accentPeach} />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.15}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreFooter}>
              <ActivityIndicator size="small" color={expenseColors.accentPeach} />
              <AppText style={styles.loadingMoreText}>Loading more logs…</AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ScrollText size={42} color="#3A3D4A" />
            <AppText style={styles.emptyTitle}>
              {hasActiveFilters ? 'No matching logs found' : 'No log entries yet'}
            </AppText>
            <AppText style={styles.emptySub}>
              {hasActiveFilters
                ? 'Try clearing your search query or relaxing your level and scope filters.'
                : 'Actions, calculation checks, and errors will appear here automatically as you use the app.'}
            </AppText>
            {hasActiveFilters ? (
              <TouchableOpacity style={styles.emptyResetBtn} onPress={resetAllFilters} activeOpacity={0.8}>
                <AppText style={styles.emptyResetBtnText}>Reset Filters</AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101114',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerSubtitle: {
    color: '#8E919D',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#1E202B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  clearBtnBox: {
    backgroundColor: 'rgba(244, 139, 139, 0.12)',
    borderColor: 'rgba(244, 139, 139, 0.3)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  quickJsonExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(157, 198, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(157, 198, 235, 0.3)',
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
  },
  quickJsonExportText: {
    color: '#9DC6EB',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollableHeaderContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 198, 235, 0.08)',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(157, 198, 235, 0.2)',
  },
  infoBannerText: {
    flex: 1,
    color: '#D4DCED',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181A20',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryMetric: {
    flex: 1,
    alignItems: 'center',
  },
  summaryCount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    color: expenseColors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  chipsSection: {
    marginBottom: 8,
  },
  chipsScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    backgroundColor: '#1A1D24',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  scopeSection: {
    marginBottom: 10,
  },
  scopeScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  scopeChip: {
    backgroundColor: '#1A1D24',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  scopeChipActive: {
    backgroundColor: 'rgba(157, 198, 235, 0.15)',
    borderColor: '#9DC6EB',
  },
  scopeChipText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  scopeChipTextActive: {
    color: '#9DC6EB',
    fontWeight: '700',
  },
  activeFilterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(244, 205, 137, 0.10)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(244, 205, 137, 0.25)',
  },
  activeFilterText: {
    flex: 1,
    color: '#F4CD89',
    fontSize: 11,
    fontWeight: '600',
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  resetFilterText: {
    color: '#F48B8B',
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  listHeaderText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  logRow: {
    backgroundColor: '#181A20',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  logRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  logTime: {
    color: '#7E8392',
    fontSize: 11,
    fontWeight: '600',
  },
  logMessage: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  logRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  logScope: {
    color: '#656978',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaToggleText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  expandedContainer: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestampLabel: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  timestampVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metaBox: {
    marginTop: 6,
    backgroundColor: '#0F1014',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  metaBoxTitle: {
    color: '#656978',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  logMeta: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingMoreFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingMoreText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyResetBtn: {
    marginTop: 12,
    backgroundColor: '#1E202B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyResetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});