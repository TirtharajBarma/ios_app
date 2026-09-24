import React from 'react';
import {
  Modal,
  Pressable,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AppText from './AppText';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface LiquidPopoverItem {
  id: string;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  onPress: () => void;
}

export interface LiquidPopoverMenuProps {
  visible: boolean;
  anchorRect: { x: number; y: number; width: number; height: number } | null;
  items: LiquidPopoverItem[];
  footerAction?: {
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
  };
  onClose: () => void;
}

export const LiquidPopoverMenu: React.FC<LiquidPopoverMenuProps> = ({
  visible,
  anchorRect,
  items,
  footerAction,
  onClose,
}) => {
  if (!visible || !anchorRect) return null;

  const MENU_WIDTH = Math.max(anchorRect.width, 210);
  let left = anchorRect.x;
  if (left + MENU_WIDTH > SCREEN_WIDTH - 16) {
    left = SCREEN_WIDTH - MENU_WIDTH - 16;
  }
  if (left < 16) {
    left = 16;
  }

  const estimatedHeight = Math.min(items.length * 48 + (footerAction ? 44 : 0), 280);
  let top = anchorRect.y + anchorRect.height + 6;
  if (top + estimatedHeight > SCREEN_HEIGHT - 40 && anchorRect.y - estimatedHeight - 6 > 40) {
    top = anchorRect.y - estimatedHeight - 6;
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.menuWrapper, { top, left, width: MENU_WIDTH }]}>
          <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
            <View style={styles.innerContent}>
              <ScrollView
                style={{ maxHeight: 260 }}
                showsVerticalScrollIndicator={true}
                bounces={true}
                keyboardShouldPersistTaps="handled"
              >
                {items.map((item, index) => {
                  const isSelected = item.isSelected;
                  return (
                    <React.Fragment key={item.id}>
                      <TouchableOpacity
                        style={[
                          styles.menuItem,
                          isSelected && styles.menuItemActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          onClose();
                          item.onPress();
                        }}
                      >
                        <View style={styles.menuItemLeft}>
                          {item.icon && <View style={styles.iconCircle}>{item.icon}</View>}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <AppText
                              style={[
                                styles.itemLabel,
                                isSelected && styles.itemLabelActive,
                              ]}
                              numberOfLines={1}
                            >
                              {item.label}
                            </AppText>
                            {item.subLabel ? (
                              <AppText style={styles.itemSubLabel} numberOfLines={1}>
                                {item.subLabel}
                              </AppText>
                            ) : null}
                          </View>
                        </View>
                        {isSelected && <Check size={15} color="#FF9D66" />}
                      </TouchableOpacity>
                      {index < items.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  );
                })}

                {footerAction && (
                  <>
                    <View style={styles.divider} />
                    <TouchableOpacity
                      style={styles.footerBtn}
                      activeOpacity={0.75}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        onClose();
                        footerAction.onPress();
                      }}
                    >
                      {footerAction.icon || <Plus size={14} color="#FF9D66" />}
                      <AppText style={styles.footerBtnText}>{footerAction.label}</AppText>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </View>
          </BlurView>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  menuWrapper: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(22, 24, 34, 0.88)',
  },
  innerContent: {
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 157, 102, 0.14)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    color: '#E0E3EB',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  itemLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  itemSubLabel: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
  },
  footerBtnText: {
    color: '#FF9D66',
    fontSize: 12,
    fontWeight: '800',
  },
});
