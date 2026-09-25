import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
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
  type AuditLogEntry,
  type AuditLevel,
  type AuditLogCounts,
} from '@/utils/auditLog';

const PAGE_SIZE = 60;

const LEVEL_COLORS: Record<string, { fg: string; bg: string }> = {
  action: { fg: '#9DC6EB', bg: 'rgba(157, 198, 235, 0.15)' },
  error: { fg: '#F48B8B', bg: 'rgba(244, 139, 139, 0.15)' },
  warn: { fg: '#F4CD89', bg: 'rgba(244, 205, 137, 0.15)' },
  info: { fg: '#A2AEBB', bg: 'rgba(162, 174, 187, 0.15)' },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export default function ActivityLogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [counts, setCounts] = useState<AuditLogCounts>({ actions: 0, errors: 0, warnings: 0, info: 0, total: 0 });
  const [scopes, setScopes] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<'all' | AuditLevel>('all');
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const reload = useCallback(async (opts?: { resetOffset?: boolean }) => {
    if (opts?.resetOffset) offsetRef.current = 0;
    const [rows, c, s] = await Promise.all([
      getLogs({
        level: levelFilter === 'all' ? undefined : levelFilter,
        scope: scopeFilter ?? undefined,
        query,
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
  }, [levelFilter, scopeFilter, query]);

  useEffect(() => {
    void reload({ resetOffset: true });
  }, [levelFilter, scopeFilter, query, reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload({ resetOffset: true });
    setRefreshing(false);
  }, [reload]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    offsetRef.current += PAGE_SIZE;
    await reload();
    setLoadingMore(false);
  }, [loadingMore, hasMore, reload]);

  const handleExport = async () => {
    Haptics.selectionAsync();
    try {
      const text = await exportAuditLogsText();
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const fileUri = `${docDir}audit_log_export.txt`;
      await FileSystem.writeAsStringAsync(fileUri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Activity Log',
          UTI: 'public.plain-text',
        });
      } else {
        Alert.alert('Export Complete', `Saved to ${fileUri}`);
      }
    } catch {
      Alert.alert('Export Failed', 'Could not export the activity log.');
    }
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Clear Activity Logs',
      'This permanently deletes the local audit trail. This cannot be undone. (Note: “Erase All Stored Data” does NOT clear logs — only this action does.)',
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Logs Cleared', 'The activity log has been permanently deleted.');
          },
        },
      ]
    );
  };

  const levelChips: { key: 'all' | AuditLevel; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'action', label: `Actions ${counts.actions}` },
    { key: 'error', label: `Errors ${counts.errors}` },
    { key: 'warn', label: `Warnings ${counts.warnings}` },
    { key: 'info', label: `Info ${counts.info}` },
  ];

  const renderItem = useCallback(
    ({ item }: { item: AuditLogEntry }) => {
      const lc = LEVEL_COLORS[item.level] ?? LEVEL_COLORS.info;
      const expanded = expandedId === item.id;
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
            <AppText style={styles.logTime}>{formatTime(item.ts)}</AppText>
          </View>
          <AppText style={styles.logMessage} numberOfLines={expanded ? 0 : 2}>
            {item.message}
          </AppText>
          <View style={styles.logRowBottom}>
            <AppText style={styles.logScope}>#{item.scope}</AppText>
            {item.meta ? (
              <View style={styles.metaToggle}>
                <AppText style={styles.metaToggleText}>{expanded ? 'Hide details' : 'Details'}</AppText>
                <ChevronDown size={12} color="#8E919D" style={expanded ? styles.chevronOpen : undefined} />
              </View>
            ) : null}
          </View>
          {expanded && item.meta ? (
            <AppText style={styles.logMeta} selectable>
              {item.meta}
            </AppText>
          ) : null}
        </TouchableOpacity>
      );
    },
    [expandedId]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={expenseColors.accentPeach} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>ACTIVITY LOGS</AppText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.infoBanner}>
        <ShieldAlert size={18} color="#9DC6EB" />
        <AppText style={styles.infoBannerText}>
          A permanent, on-device audit trail of every action. Stored offline in a hidden database — never
          transmitted. Survives “Erase All Stored Data”.
        </AppText>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryMetric}>
          <AppText style={styles.summaryCount}>{counts.total}</AppText>
          <AppText style={styles.summaryLabel}>Total Entries</AppText>
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

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.chipsRow}>
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
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Search size={15} color="#8E919D" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search log entries…"
              placeholderTextColor="#656978"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} style={styles.clearBtn}>
                <X size={15} color="#8E919D" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
            <Share2 size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtnBox} onPress={handleClear} activeOpacity={0.8}>
            <Trash2 size={16} color="#F48B8B" />
          </TouchableOpacity>
        </View>

        {scopes.length > 0 ? (
          <View style={styles.scopeRow}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeListContent}
              data={['all', ...scopes]}
              keyExtractor={(s) => s}
              renderItem={({ item }) => {
                const active = (scopeFilter ?? 'all') === item;
                return (
                  <TouchableOpacity
                    style={[styles.scopeChip, active && styles.scopeChipActive]}
                    onPress={() => setScopeFilter(item === 'all' ? null : item)}
                    activeOpacity={0.8}
                  >
                    <AppText style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>{item}</AppText>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : null}
      </View>

      {/* List */}
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={expenseColors.accentPeach} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          logs.length > 0 ? (
            <View style={styles.listHeaderRow}>
              <Activity size={14} color="#8E919D" />
              <AppText style={styles.listHeaderText}>
                {logs.length} shown {hasMore ? '• scroll for more' : '• end of log'}
              </AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ScrollText size={40} color="#3A3D4A" />
            <AppText style={styles.emptyTitle}>No log entries yet</AppText>
            <AppText style={styles.emptySub}>
              Actions and errors will appear here automatically as you use the app.
            </AppText>
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
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(157, 198, 235, 0.10)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(157, 198, 235, 0.25)',
  },
  infoBannerText: {
    flex: 1,
    color: '#E0E0E0',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D23',
    borderRadius: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryMetric: {
    flex: 1,
    alignItems: 'center',
  },
  summaryCount: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    color: expenseColors.textMuted,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  controls: {
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1E202B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E202B',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  exportBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1E202B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  clearBtnBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 139, 139, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 139, 139, 0.3)',
  },
  scopeRow: {
    flexGrow: 0,
  },
  scopeListContent: {
    gap: 8,
    paddingRight: 8,
  },
  scopeChip: {
    backgroundColor: '#1E202B',
    paddingHorizontal: 12,
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
    textTransform: 'capitalize',
  },
  scopeChipTextActive: {
    color: '#9DC6EB',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 8,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  listHeaderText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '500',
  },
  logRow: {
    backgroundColor: '#181A20',
    borderRadius: 16,
    padding: 16,
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
    borderRadius: 7,
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  logTime: {
    color: '#656978',
    fontSize: 11,
    fontWeight: '500',
  },
  logMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  logRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  logMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#101216',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    color: expenseColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});