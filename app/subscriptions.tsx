import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Plus,
  MoreHorizontal,
  Search,
  Repeat,
  Check,
  ChevronRight,
  ArrowUpDown,
  LayoutGrid,
  Calendar,
  Users,
} from "lucide-react-native";
import { parseISO, format, differenceInCalendarDays, startOfDay } from "date-fns";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { AppText, LogoCircle } from "@/components/ui";
import { colors, spacing, radius, getCurrencySymbol } from "@/constants";
import { toMonthly, getSubscriptionActivePrice } from "@/utils/date";

export default function SubscriptionsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subscriptions, removeSubscription, loadSubscriptions } = useSubscriptionStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "price">("date");
  const [groupBy, setGroupBy] = useState<"category" | "none">("category");
  const [hideExpired, setHideExpired] = useState(true);
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideEnding, setHideEnding] = useState(false);

  // Popover Menu State
  const [menuVisible, setMenuVisible] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);

  const menuAnim = useRef(new Animated.Value(0)).current;

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const searchBarBottom = useRef(new Animated.Value(insets.bottom + 12)).current;

  useEffect(() => {
    if (!keyboardVisible) {
      searchBarBottom.setValue(insets.bottom + 12);
    }
  }, [insets.bottom, keyboardVisible]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardVisible(true);
        Animated.timing(searchBarBottom, {
          toValue: e.endCoordinates.height + 10,
          duration: e.duration || 250,
          useNativeDriver: false,
        }).start();
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        setKeyboardVisible(false);
        Animated.timing(searchBarBottom, {
          toValue: insets.bottom + 12,
          duration: (e && e.duration) || 250,
          useNativeDriver: false,
        }).start();
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    if (menuVisible) {
      Animated.spring(menuAnim, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setSortMenuOpen(false);
        setGroupMenuOpen(false);
      });
    }
  }, [menuVisible]);

  const { currencyCode } = useSettingsStore();
  const currencySymbol = getCurrencySymbol(currencyCode);

  const handleCardPress = (sub: any) => {
    Haptics.selectionAsync();
    router.push(`/subscription/${sub.id}`);
  };

  const handleLongPress = (sub: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Subscription",
      `Are you sure you want to delete ${sub.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeSubscription(sub.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getRenewalStatus = (dateStr: string) => {
    try {
      const renewalDate = startOfDay(parseISO(dateStr));
      const today = startOfDay(new Date());
      const diff = differenceInCalendarDays(renewalDate, today);

      if (diff === 0) return { text: "Today", color: "#FF5A00" };
      if (diff === 1) return { text: "Tomorrow", color: "#FF9500" };
      if (diff < 0) return { text: "Overdue", color: "#FF3B30" };
      if (diff <= 7) return { text: `In ${diff} days`, color: "#FFCC00" };
      return { text: format(renewalDate, "MMM d"), color: "rgba(255, 255, 255, 0.4)" };
    } catch {
      return { text: "-", color: "rgba(255, 255, 255, 0.4)" };
    }
  };

  const formatCycleLabel = (rawCycle?: string, cycle?: string): string => {
    const value = rawCycle || cycle || "monthly";
    if (value.toLowerCase() === "monthly") return "Monthly";
    if (value.toLowerCase() === "yearly") return "Yearly";
    if (value.toLowerCase() === "weekly") return "Weekly";
    if (value.toLowerCase() === "quarterly") return "Quarterly";
    return value;
  };

  const isExpired = (sub: any) => {
    if (!sub.isTrial) return false;
    try {
      const trialEnd = startOfDay(parseISO(sub.trialEndDate || sub.nextBillingDate));
      const today = startOfDay(new Date());
      return trialEnd < today;
    } catch {
      return false;
    }
  };

  // Filter & Sort Logic
  const filteredAndSortedSubs = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        // Query search
        if (searchQuery.trim().length > 0) {
          if (!sub.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
          }
        }
        // Filters
        if (hideExpired && isExpired(sub)) return false;
        if (hideCancelled && sub.reminderEnabled === false && !sub.isTrial && !sub.nextBillingDate) return false;
        if (hideEnding) {
          try {
            const trialEnd = sub.isTrial ? parseISO(sub.trialEndDate || sub.nextBillingDate) : null;
            if (trialEnd && differenceInCalendarDays(trialEnd, new Date()) <= 3) return false;
          } catch {
            // ignore parse errors
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "price") {
          const priceA = a.isTrial ? 0 : toMonthly(a.price, a.billingCycle, a.customIntervalMonths);
          const priceB = b.isTrial ? 0 : toMonthly(b.price, b.billingCycle, b.customIntervalMonths);
          return priceB - priceA; // High to Low
        }
        // Default: Renewal Date
        try {
          const dateA = new Date(a.nextBillingDate).getTime();
          const dateB = new Date(b.nextBillingDate).getTime();
          return dateA - dateB;
        } catch {
          return 0;
        }
      });
  }, [subscriptions, searchQuery, sortBy, hideExpired, hideCancelled, hideEnding]);

  // Grouping Logic
  const groupedData = useMemo(() => {
    if (groupBy === "none") {
      return [{ category: "All Subscriptions", items: filteredAndSortedSubs }];
    }

    const groups: { [key: string]: any[] } = {};
    filteredAndSortedSubs.forEach((sub) => {
      const cat = sub.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(sub);
    });

    return Object.keys(groups).map((cat) => ({
      category: cat,
      items: groups[cat],
    }));
  }, [filteredAndSortedSubs, groupBy]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={colors.white} strokeWidth={2.5} />
        </TouchableOpacity>

        <AppText variant="title3" weight="700" color={colors.white}>
          Subscriptions
        </AppText>

        <View style={styles.pillContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/add/search");
            }}
            style={styles.pillIconBtn}
          >
            <Plus size={18} color={colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.pillDivider} />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync();
              setMenuVisible(!menuVisible);
            }}
            style={styles.pillIconBtn}
          >
            <MoreHorizontal size={18} color={colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Scroll */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 88 },
        ]}
      >
        {groupedData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AppText variant="body" color={colors.textMuted} style={styles.emptyText}>
              No subscriptions found
            </AppText>
          </View>
        ) : (
          groupedData.map((group, groupIdx) => {
            // Calculate group total monthly average spend
            const categoryTotal = group.items.reduce((sum, item) => {
              if (item.isTrial) return sum;
              const activePrice = getSubscriptionActivePrice(item);
              return sum + toMonthly(activePrice, item.billingCycle, item.customIntervalMonths);
            }, 0);

            return (
              <View key={group.category} style={styles.categorySection}>
                {groupBy === "category" && (
                  <View style={styles.categoryHeader}>
                    <AppText variant="subheadline" weight="700" color="rgba(255,255,255,0.6)">
                      {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
                    </AppText>
                    <AppText variant="subheadline" weight="600" color="rgba(255,255,255,0.6)">
                      {currencySymbol}{categoryTotal.toFixed(2)}/Month
                    </AppText>
                  </View>
                )}

                <LinearGradient
                  colors={["rgba(35, 35, 37, 0.98)", "rgba(22, 22, 24, 1)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.groupedListContainer}
                >
                  {group.items.map((sub, idx) => {
                    const isLast = idx === group.items.length - 1;

                    return (
                      <TouchableOpacity
                        key={sub.id}
                        activeOpacity={0.8}
                        onPress={() => handleCardPress(sub)}
                        onLongPress={() => handleLongPress(sub)}
                        style={[
                          styles.listItemRow,
                          !isLast && styles.listItemBorder,
                        ]}
                      >
                        <View style={styles.listItemLeft}>
                          <LogoCircle
                            source={sub.logoUrl}
                            name={sub.name}
                            color={sub.color}
                            size={40}
                            bordered
                            website={sub.website}
                          />
                          <View style={styles.listItemTextContainer}>
                            <AppText style={styles.listItemTitle} numberOfLines={1}>
                              {sub.name}
                            </AppText>
                            <AppText style={styles.listItemSubtitle} numberOfLines={1}>
                              {sub.isTrial
                                ? `Trial ends on ${format(parseISO(sub.trialEndDate || sub.nextBillingDate), "MMM d")}`
                                : `Starts on ${format(parseISO(sub.startDate || sub.nextBillingDate), "MMM d")}`}
                            </AppText>
                          </View>
                        </View>

                        <View style={styles.listItemRight}>
                          <AppText style={styles.listItemPrice}>
                            {sub.isTrial
                              ? "Free"
                              : `${currencySymbol}${getSubscriptionActivePrice(sub).toFixed(2)}`}
                          </AppText>
                          <View style={styles.listItemCycleRow}>
                            {sub.splitEnabled && (
                              <Users size={11} color={colors.accent} style={{ marginRight: 2 }} />
                            )}
                            <AppText style={styles.listItemCycle}>
                              {sub.isTrial
                                ? "Trial"
                                : formatCycleLabel(
                                    sub.rawBillingCycle,
                                    sub.billingCycle,
                                  )}
                            </AppText>
                            {!sub.isTrial && (
                              <Repeat size={11} color={colors.textMuted} />
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </LinearGradient>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Bottom Search Bar */}
      <Animated.View style={[styles.searchBarWrapper, { bottom: searchBarBottom }]}>
        <View style={styles.searchBar}>
          <Search size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subscriptions..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </Animated.View>

      {/* Done Button floating above search bar when keyboard is open */}
      {keyboardVisible && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: Animated.add(searchBarBottom, 56),
            right: spacing[20],
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Keyboard.dismiss()}
            style={{
              backgroundColor: "rgba(30, 30, 30, 0.88)",
              borderRadius: 24,
              paddingHorizontal: spacing[20],
              paddingVertical: 10,
              borderWidth: 0.5,
              borderColor: "rgba(255, 255, 255, 0.15)",
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <AppText variant="callout" weight="700" color={colors.white}>
              Done
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Popover Menu Dropdown */}
      {menuVisible && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />

          <Animated.View
            style={[
              styles.menuCard,
              {
                top: insets.top + 60,
                right: 16,
                opacity: menuAnim,
                transform: [
                  {
                    scale: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {!sortMenuOpen && !groupMenuOpen ? (
              <>
                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setSortMenuOpen(true)}
                >
                  <View style={styles.menuRowLeft}>
                    <ArrowUpDown size={15} color={colors.white} />
                    <AppText style={styles.menuText}>Sort By</AppText>
                  </View>
                  <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setGroupMenuOpen(true)}
                >
                  <View style={styles.menuRowLeft}>
                    <LayoutGrid size={15} color={colors.white} />
                    <AppText style={styles.menuText}>Group by</AppText>
                  </View>
                  <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <AppText style={styles.menuSectionHeader}>Filter</AppText>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHideCancelled(!hideCancelled);
                  }}
                >
                  <View style={styles.menuRowLeft}>
                    {hideCancelled && <Check size={14} color={colors.accent} style={{ marginRight: 6 }} />}
                    <AppText style={[styles.menuText, { marginLeft: hideCancelled ? 0 : 20 }]}>
                      Hide cancelled
                    </AppText>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHideExpired(!hideExpired);
                  }}
                >
                  <View style={styles.menuRowLeft}>
                    {hideExpired && <Check size={14} color={colors.accent} style={{ marginRight: 6 }} />}
                    <AppText style={[styles.menuText, { marginLeft: hideExpired ? 0 : 20 }]}>
                      Hide expired
                    </AppText>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHideEnding(!hideEnding);
                  }}
                >
                  <View style={styles.menuRowLeft}>
                    {hideEnding && <Check size={14} color={colors.accent} style={{ marginRight: 6 }} />}
                    <AppText style={[styles.menuText, { marginLeft: hideEnding ? 0 : 20 }]}>
                      Hide ending
                    </AppText>
                  </View>
                </TouchableOpacity>
              </>
            ) : sortMenuOpen ? (
              <>
                <TouchableOpacity
                  style={styles.menuSubHeader}
                  activeOpacity={0.7}
                  onPress={() => setSortMenuOpen(false)}
                >
                  <ChevronLeft size={14} color={colors.accent} />
                  <AppText style={styles.menuSubTitle}>Sort By</AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy("date");
                    setSortMenuOpen(false);
                    setMenuVisible(false);
                  }}
                >
                  <AppText style={[styles.menuText, { color: sortBy === "date" ? colors.accent : colors.white }]}>
                    Renewal Date
                  </AppText>
                  {sortBy === "date" && <Check size={14} color={colors.accent} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy("name");
                    setSortMenuOpen(false);
                    setMenuVisible(false);
                  }}
                >
                  <AppText style={[styles.menuText, { color: sortBy === "name" ? colors.accent : colors.white }]}>
                    Name (A-Z)
                  </AppText>
                  {sortBy === "name" && <Check size={14} color={colors.accent} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy("price");
                    setSortMenuOpen(false);
                    setMenuVisible(false);
                  }}
                >
                  <AppText style={[styles.menuText, { color: sortBy === "price" ? colors.accent : colors.white }]}>
                    Price (High to Low)
                  </AppText>
                  {sortBy === "price" && <Check size={14} color={colors.accent} />}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.menuSubHeader}
                  activeOpacity={0.7}
                  onPress={() => setGroupMenuOpen(false)}
                >
                  <ChevronLeft size={14} color={colors.accent} />
                  <AppText style={styles.menuSubTitle}>Group By</AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGroupBy("category");
                    setGroupMenuOpen(false);
                    setMenuVisible(false);
                  }}
                >
                  <AppText style={[styles.menuText, { color: groupBy === "category" ? colors.accent : colors.white }]}>
                    Category
                  </AppText>
                  {groupBy === "category" && <Check size={14} color={colors.accent} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGroupBy("none");
                    setGroupMenuOpen(false);
                    setMenuVisible(false);
                  }}
                >
                  <AppText style={[styles.menuText, { color: groupBy === "none" ? colors.accent : colors.white }]}>
                    None
                  </AppText>
                  {groupBy === "none" && <Check size={14} color={colors.accent} />}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    paddingHorizontal: 6,
    height: 40,
  },
  pillIconBtn: {
    paddingHorizontal: 8,
    height: "100%",
    justifyContent: "center",
  },
  pillDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  categorySection: {
    marginBottom: spacing[24],
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[8],
    paddingHorizontal: 4,
  },
  groupedListContainer: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.36,
    shadowRadius: 22,
    elevation: 10,
  },
  listItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing[16],
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  listItemTextContainer: {
    marginLeft: spacing[12],
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.white,
  },
  listItemSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: "flex-end",
    marginLeft: spacing[12],
  },
  listItemPrice: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.white,
  },
  listItemCycleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  listItemCycle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  searchBarWrapper: {
    position: "absolute",
    left: spacing[16],
    right: spacing[16],
    zIndex: 100,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(35, 35, 37, 0.95)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 24,
    height: 48,
    paddingHorizontal: spacing[16],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: colors.white,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[64],
  },
  emptyText: {
    fontSize: 16,
  },
  menuCard: {
    position: "absolute",
    width: 200,
    backgroundColor: "rgba(30, 30, 30, 0.96)",
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: spacing[12],
    zIndex: 9999,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
  menuDivider: {
    height: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginVertical: 8,
  },
  menuSectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.4)",
    textTransform: "uppercase",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  menuSubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    marginBottom: 6,
  },
  menuSubTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  },
});
