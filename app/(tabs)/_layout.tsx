import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as Haptics from 'expo-haptics';

export default function TabsLayout() {
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
      labelVisibilityMode="labeled"
      disableIndicator={false}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ledger">
        <NativeTabs.Trigger.Label>Ledger</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          md={{ default: 'receipt_long', selected: 'receipt_long' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="visualizer">
        <NativeTabs.Trigger.Label>Visualizer</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar.xaxis', selected: 'chart.bar.xaxis' }}
          md={{ default: 'bar_chart', selected: 'bar_chart' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="import">
        <NativeTabs.Trigger.Label>Import</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'arrow.down.doc', selected: 'arrow.down.doc.fill' }}
          md={{ default: 'file_download', selected: 'file_download' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md={{ default: 'settings', selected: 'settings' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
