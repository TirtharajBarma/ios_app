import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Home, ReceiptText, BarChart3, CloudDownload, Settings } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';

export type ExpenseTabType = 'home' | 'ledger' | 'visualizer' | 'import' | 'settings';

interface FixedBottomNavProps {
  activeTab?: ExpenseTabType;
  onTabPress?: (tab: ExpenseTabType) => void;
}

export const FixedBottomNav: React.FC<FixedBottomNavProps> = ({
  activeTab = 'home',
  onTabPress,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const navItems: Array<{ id: ExpenseTabType; label: string; IconComponent: any }> = [
    { id: 'home', label: 'Home', IconComponent: Home },
    { id: 'ledger', label: 'Ledger', IconComponent: ReceiptText },
    { id: 'visualizer', label: 'Visualizer', IconComponent: BarChart3 },
    { id: 'import', label: 'Import', IconComponent: CloudDownload },
    { id: 'settings', label: 'Settings', IconComponent: Settings },
  ];

  const handlePress = (id: ExpenseTabType) => {
    if (onTabPress) {
      onTabPress(id);
    }
    const targetRoute = id === 'home' ? '/(tabs)' : `/(tabs)/${id}`;
    router.replace(targetRoute as any);
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.contentRow}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const iconColor = isActive ? expenseColors.textPrimary : expenseColors.textMuted;
          const textColor = isActive ? expenseColors.textPrimary : expenseColors.textMuted;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              activeOpacity={0.7}
              onPress={() => handlePress(item.id)}
            >
              <item.IconComponent size={22} color={iconColor} strokeWidth={isActive ? 2.5 : 2} />
              <AppText style={[styles.navLabel, { color: textColor }]}>
                {item.label}
              </AppText>

              {/* Active Indicator Dot */}
              {isActive ? (
                <View style={styles.activeDot} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: expenseColors.bgPrimary,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    zIndex: 100,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 4,
  },
  navLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: expenseColors.textPrimary,
    marginTop: 2,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 2,
  },
});
