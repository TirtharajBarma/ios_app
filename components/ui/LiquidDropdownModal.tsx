import React from 'react';
import {
  Modal,
  Pressable,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AppText from './AppText';
import { expenseColors } from '@/constants/expenseColors';

export interface LiquidDropdownOption<T = string> {
  id: T;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  badge?: string;
}

export interface LiquidDropdownModalProps<T = string> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: LiquidDropdownOption<T>[];
  selectedId?: T;
  onSelect: (option: LiquidDropdownOption<T>) => void;
  onClose: () => void;
  footerAction?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
  };
}

export function LiquidDropdownModal<T = string>({
  visible,
  title,
  subtitle,
  options,
  selectedId,
  onSelect,
  onClose,
  footerAction,
}: LiquidDropdownModalProps<T>) {
  const handleSelect = (opt: LiquidDropdownOption<T>) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(opt);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.cardWrapper} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalCard}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardOverlay} />

            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <AppText style={styles.title}>{title}</AppText>
                {subtitle && <AppText style={styles.subtitle}>{subtitle}</AppText>}
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={16} color="#A0A5B5" />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {options.map((opt, idx) => {
                const isSelected = selectedId === opt.id;
                return (
                  <TouchableOpacity
                    key={String(opt.id)}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleSelect(opt)}
                  >
                    <View style={styles.optionLeft}>
                      {opt.icon && (
                        <View style={styles.iconContainer}>
                          {opt.icon}
                        </View>
                      )}
                      <View style={{ flexShrink: 1 }}>
                        <AppText
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </AppText>
                        {opt.subLabel && (
                          <AppText style={styles.optionSubLabel} numberOfLines={1}>
                            {opt.subLabel}
                          </AppText>
                        )}
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.checkWrap}>
                        <Check size={16} color={expenseColors.accentPeach} strokeWidth={2.8} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Optional Footer Action (e.g. Add Account) */}
            {footerAction && (
              <TouchableOpacity
                style={styles.footerBtn}
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  footerAction.onPress();
                }}
              >
                {footerAction.icon}
                <AppText style={styles.footerBtnText}>{footerAction.label}</AppText>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 380,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    maxHeight: 480,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.55,
        shadowRadius: 28,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 28, 36, 0.82)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  optionItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#E0E3EB',
    fontSize: 14,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  optionSubLabel: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 177, 149, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '700',
  },
});
