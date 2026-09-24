import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { MenuView, MenuAction, NativeActionEvent } from '@expo/ui/community/menu';

export interface NativeLiquidMenuProps {
  title?: string;
  actions: MenuAction[];
  onSelect: (actionId: string) => void;
  children: React.ReactNode;
  shouldOpenOnLongPress?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const NativeLiquidMenu: React.FC<NativeLiquidMenuProps> = ({
  title,
  actions,
  onSelect,
  children,
  shouldOpenOnLongPress,
  style,
}) => {
  return (
    <MenuView
      title={title}
      actions={actions}
      shouldOpenOnLongPress={shouldOpenOnLongPress}
      onPressAction={({ nativeEvent }: NativeActionEvent) => {
        if (nativeEvent.event) {
          onSelect(nativeEvent.event);
        }
      }}
      style={style}
    >
      {children}
    </MenuView>
  );
};

export default NativeLiquidMenu;
