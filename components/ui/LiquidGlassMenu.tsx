import React from 'react';
import {
  Modal,
  Pressable,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, GlassContainer } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';

export interface LiquidGlassMenuItem {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
}

export interface LiquidGlassMenuProps {
  visible: boolean;
  position?: { x: number; y: number };
  onClose: () => void;
  items: LiquidGlassMenuItem[];
  style?: StyleProp<ViewStyle>;
}

export const LiquidGlassMenu: React.FC<LiquidGlassMenuProps> = ({
  visible,
  position = { x: 20, y: 100 },
  onClose,
  items,
  style,
}) => {
  const handleItemPress = (item: LiquidGlassMenuItem) => {
    if (Platform.OS === 'ios') {
      if (item.destructive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
    onClose();
    item.onPress();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.glassModalOverlay} onPress={onClose}>
        <View
          style={[
            styles.glassMenuContainer,
            { position: 'absolute', top: position.y, left: position.x },
            style,
          ]}
        >
          {Platform.OS === 'ios' ? (
            <GlassContainer style={styles.glassContainer}>
              <GlassView
                glassEffectStyle="regular"
                tintColor="rgba(255, 255, 255, 0.08)"
                isInteractive={true}
                style={styles.iosLiquidMenu}
              >
                {items.map((item, index) => (
                  <React.Fragment key={item.label}>
                    <TouchableOpacity
                      style={styles.glassMenuItem}
                      activeOpacity={0.7}
                      onPress={() => handleItemPress(item)}
                    >
                      {item.icon}
                      <AppText
                        style={[
                          styles.glassMenuText,
                          item.destructive && styles.deleteMenuText,
                        ]}
                      >
                        {item.label}
                      </AppText>
                    </TouchableOpacity>
                    {index < items.length - 1 && <View style={styles.glassMenuDivider} />}
                  </React.Fragment>
                ))}
              </GlassView>
            </GlassContainer>
          ) : (
            <View style={styles.androidMenu}>
              <BlurView intensity={95} tint="dark" style={styles.blurMenu}>
                {items.map((item, index) => (
                  <React.Fragment key={item.label}>
                    <TouchableOpacity
                      style={styles.glassMenuItem}
                      activeOpacity={0.7}
                      onPress={() => handleItemPress(item)}
                    >
                      {item.icon}
                      <AppText
                        style={[
                          styles.glassMenuText,
                          item.destructive && styles.deleteMenuText,
                        ]}
                      >
                        {item.label}
                      </AppText>
                    </TouchableOpacity>
                    {index < items.length - 1 && <View style={styles.glassMenuDivider} />}
                  </React.Fragment>
                ))}
              </BlurView>
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  glassModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  glassMenuContainer: {
    width: 250,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 25,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  glassContainer: {
    width: '100%',
    borderRadius: 16,
  },
  iosLiquidMenu: {
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    backgroundColor: 'rgba(20, 22, 30, 0.75)',
  },
  androidMenu: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1C24',
  },
  blurMenu: {
    borderRadius: 16,
    paddingVertical: 6,
  },
  glassMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  glassMenuText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  deleteMenuText: {
    color: '#FF453A', // Apple System Destructive Red
    fontWeight: '600',
  },
  glassMenuDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 2,
    marginHorizontal: 16,
  },
});
