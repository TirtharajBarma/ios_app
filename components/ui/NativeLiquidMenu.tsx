import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MenuView as ExpoMenuView, NativeActionEvent } from '@expo/ui/community/menu';
import { LiquidDropdownModal, LiquidDropdownOption } from './LiquidDropdownModal';
import { expenseColors } from '@/constants/expenseColors';

/**
 * Visual/behavioural flags for a menu action.
 */
export type MenuActionAttributes = {
  disabled?: boolean;
  hidden?: boolean;
  /** Renders the row label in the destructive (red) colour. */
  destructive?: boolean;
};

/**
 * A single dropdown row. Compatible with `@expo/ui`'s `MenuAction` on iOS
 * and `LiquidDropdownModal` on Android.
 */
export type MenuAction = {
  id?: string;
  title: string;
  subLabel?: string;
  state?: 'on' | 'off';
  attributes?: MenuActionAttributes;
  /**
   * SF Symbol name on iOS (e.g. 'fork.knife', 'creditcard.fill').
   */
  image?: string | unknown;
  imageColor?: string;
  subactions?: MenuAction[];
  displayInline?: boolean;
};

export interface NativeLiquidMenuProps {
  title?: string;
  actions: MenuAction[];
  onSelect: (actionId: string) => void;
  onPress?: () => void;
  children: React.ReactNode;
  shouldOpenOnLongPress?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Platform-Adaptive Apple Liquid Dropdown Menu:
 * - On iOS: Uses real UIKit / SwiftUI `UIMenu` with Apple Metal shaders, SF Symbols,
 *   checkmarks, and system popover physics. Measured concrete pixel width ensures the
 *   button expands to 100% of its flex column.
 * - On Android: Uses high-intensity frosted glass `BlurView` modal with specular borders.
 */
export const NativeLiquidMenu: React.FC<NativeLiquidMenuProps> = ({
  title,
  actions,
  onSelect,
  onPress,
  children,
  shouldOpenOnLongPress,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) {
      setContainerWidth(w);
    }
  }, [containerWidth]);

  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);

  const visibleActions = useMemo(
    () => actions.filter((action) => !action.attributes?.hidden),
    [actions]
  );

  // Flatten actions & subactions for the Android / fallback modal list
  const options = useMemo<LiquidDropdownOption<string>[]>(() => {
    const list: LiquidDropdownOption<string>[] = [];
    visibleActions.forEach((action) => {
      if (action.subactions && action.subactions.length > 0) {
        action.subactions.forEach((sub) => {
          if (!sub.attributes?.hidden) {
            list.push({
              id: sub.id ?? sub.title,
              label: sub.title,
              subLabel: sub.subLabel || (action.title ? `${action.title.toUpperCase()}` : undefined),
              disabled: sub.attributes?.disabled,
              color: sub.attributes?.destructive
                ? expenseColors.accentRed
                : undefined,
            });
          }
        });
      } else {
        list.push({
          id: action.id ?? action.title,
          label: action.title,
          subLabel: action.subLabel,
          disabled: action.attributes?.disabled,
          color: action.attributes?.destructive
            ? expenseColors.accentRed
            : undefined,
        });
      }
    });
    return list;
  }, [visibleActions]);

  const selectedId = useMemo(() => {
    for (const action of visibleActions) {
      if (action.state === 'on') return action.id;
      if (action.subactions) {
        const activeSub = action.subactions.find((s) => s.state === 'on');
        if (activeSub) return activeSub.id;
      }
    }
    return undefined;
  }, [visibleActions]);

  const handleSelect = useCallback(
    (option: LiquidDropdownOption<string>) => {
      onSelect(option.id);
    },
    [onSelect]
  );

  const flattenedStyle = (style ? (StyleSheet.flatten(style) || {}) : {}) as Record<string, any>;
  const isCompact =
    flattenedStyle.alignSelf === 'flex-start' ||
    flattenedStyle.alignSelf === 'flex-end' ||
    flattenedStyle.alignSelf === 'center' ||
    flattenedStyle.width === 'auto' ||
    (typeof flattenedStyle.width === 'number' && flattenedStyle.width > 0);
  const isFullWidth = !isCompact && (flattenedStyle.width === undefined || flattenedStyle.width === '100%');
  const compactAlign = flattenedStyle.alignSelf || 'flex-start';

  // On iOS, render real Apple UIKit / SwiftUI UIMenu with the dynamic pixel-width bridge
  if (Platform.OS === 'ios') {
    return (
      <View
        onLayout={isFullWidth ? handleLayout : undefined}
        style={[
          isFullWidth ? { width: '100%', alignSelf: 'stretch', minWidth: 0 } : { alignSelf: compactAlign },
          style,
        ]}
      >
        <ExpoMenuView
          title={title}
          actions={actions as any}
          onPressAction={({ nativeEvent }: NativeActionEvent) => {
            if (nativeEvent.event) {
              onSelect(nativeEvent.event);
            }
          }}
          shouldOpenOnLongPress={shouldOpenOnLongPress}
          style={isFullWidth && containerWidth ? { width: containerWidth, alignSelf: 'stretch' } : { alignSelf: compactAlign }}
        >
          <View style={isFullWidth && containerWidth ? { width: containerWidth, alignSelf: 'stretch' } : { alignSelf: compactAlign }}>
            {children}
          </View>
        </ExpoMenuView>
      </View>
    );
  }

  // On Android / Web, render high-intensity Frosted BlurView Modal
  return (
    <View style={[isFullWidth ? { width: '100%', alignSelf: 'stretch' } : { alignSelf: compactAlign }, style]}>
      <Pressable
        style={isFullWidth ? { width: '100%', alignSelf: 'stretch' } : { alignSelf: compactAlign }}
        onPress={shouldOpenOnLongPress ? (onPress ?? undefined) : openMenu}
        onLongPress={
          shouldOpenOnLongPress
            ? () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                openMenu();
              }
            : undefined
        }
        delayLongPress={260}
        android_disableSound
        focusable={false}
        accessible={false}
      >
        {children}
      </Pressable>

      <LiquidDropdownModal
        visible={open}
        title={title ?? ''}
        options={options}
        selectedId={selectedId}
        onSelect={handleSelect}
        onClose={closeMenu}
      />
    </View>
  );
};

export default NativeLiquidMenu;

