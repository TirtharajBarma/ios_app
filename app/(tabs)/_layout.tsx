import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/useSettingsStore';

export default function TabsLayout() {
  const pendingCount = useSettingsStore((s) => s.pendingTransactions?.length ?? 0);

  return (
    <NativeTabs
      blurEffect="systemMaterialDark"
      backgroundColor="#12141A"
      tintColor="#FF9D66"
      iconColor={{ default: '#8E919D', selected: '#FF9D66' }}
      labelStyle={{
        default: { color: '#8E919D', fontSize: 11 },
        selected: { color: '#FF9D66', fontSize: 11, fontWeight: '700' },
      }}
      indicatorColor="rgba(255, 157, 102, 0.18)"
      rippleColor="rgba(255, 157, 102, 0.12)"
      disableTransparentOnScrollEdge={true}
      tabBarRespectsIMEInsets={true}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
      labelVisibilityMode="labeled"
      disableIndicator={false}
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets={true}>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ledger" disableAutomaticContentInsets={true}>
        <NativeTabs.Trigger.Label>Ledger</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          md={{ default: 'receipt_long', selected: 'receipt_long' }}
        />
        {pendingCount > 0 ? (
          <NativeTabs.Trigger.Badge>{String(pendingCount)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="visualizer" disableAutomaticContentInsets={true}>
        <NativeTabs.Trigger.Label>Visualizer</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar.xaxis', selected: 'chart.bar.xaxis' }}
          md={{ default: 'bar_chart', selected: 'bar_chart' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="import" disableAutomaticContentInsets={true}>
        <NativeTabs.Trigger.Label>Import</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'arrow.down.doc', selected: 'arrow.down.doc.fill' }}
          md={{ default: 'file_download', selected: 'file_download' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings" disableAutomaticContentInsets={true}>
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md={{ default: 'settings', selected: 'settings' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
