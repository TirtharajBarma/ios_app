const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');

const SHORTCUT_ID = 'quick_add_expense';
const SHORTCUT_LABEL = 'Quick add expense';
const QUICK_ADD_PATH = '/quick-add-expense';
const ACTIVITY_CLASS = 'MainActivity';

function shortcutsXml(applicationId) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="${SHORTCUT_ID}"
    android:enabled="true"
    android:icon="@drawable/ic_shortcut_add_expense"
    android:shortcutShortLabel="@string/quick_add_expense_short_label"
    android:shortcutLongLabel="@string/quick_add_expense_short_label">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${applicationId}"
      android:targetClass="${applicationId}.${ACTIVITY_CLASS}">
      <data android:scheme="subscription" android:pathPattern="${QUICK_ADD_PATH}" />
    </intent>
  </shortcut>
</shortcuts>
`;
}

const ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#FFFFFFFF"
    android:pathData="M11,13H5v-2h6V5h2v6h6v2h-6v6h-2V13z" />
</vector>
`;

/**
 * Registers the shortcut on the launcher activity.
 *
 * Static App Shortcuts are declared through activity metadata, which is how the
 * launcher can offer a long-pressed action without any extra code at runtime.
 */
function withShortcutManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults
    );
    // The XML parser stores <activity> children under the singular key.
    const activity = application.activity?.find(
      (entry) => entry.$?.['android:name'] === `.${ACTIVITY_CLASS}`
    );
    if (!activity) {
      throw new Error(
        `with-android-app-shortcut: could not find .${ACTIVITY_CLASS} in the manifest.`
      );
    }

    activity.$ = activity.$ || {};
    activity.$['android:exported'] = 'true';
    activity['meta-data'] = activity['meta-data'] || [];

    const alreadyRegistered = activity['meta-data'].some(
      (entry) => entry.$?.['android:name'] === 'android.app.shortcuts'
    );
    if (!alreadyRegistered) {
      activity['meta-data'].push({
        $: {
          'android:name': 'android.app.shortcuts',
          'android:resource': '@xml/shortcuts',
        },
      });
    }

    return modConfig;
  });
}

/** Writes the shortcut resource, its icon and its label. */
function withShortcutResources(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const applicationId =
        modConfig.android?.package ??
        modConfig.modResults?.manifest?.package;
      if (!applicationId) {
        throw new Error('with-android-app-shortcut: could not resolve the Android package name.');
      }

      const resRoot = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const xmlDir = path.join(resRoot, 'xml');
      const drawableDir = path.join(resRoot, 'drawable');
      const valuesDir = path.join(resRoot, 'values');

      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), shortcutsXml(applicationId));
      fs.writeFileSync(path.join(drawableDir, 'ic_shortcut_add_expense.xml'), ICON_XML);

      const stringsPath = path.join(valuesDir, 'strings.xml');
      const label = `  <string name="quick_add_expense_short_label">${SHORTCUT_LABEL}</string>\n`;
      if (fs.existsSync(stringsPath)) {
        const contents = fs.readFileSync(stringsPath, 'utf8');
        if (!contents.includes('quick_add_expense_short_label')) {
          fs.writeFileSync(stringsPath, contents.replace('</resources>', `${label}</resources>`));
        }
      } else {
        fs.writeFileSync(
          stringsPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${label}</resources>\n`
        );
      }

      return modConfig;
    },
  ]);
}

module.exports = function withAndroidAppShortcut(config) {
  return withShortcutResources(withShortcutManifest(config));
};

module.exports.SHORTCUT_ID = SHORTCUT_ID;
module.exports.SHORTCUTS_FILE = path.join('app', 'src', 'main', 'res', 'xml', 'shortcuts.xml');
module.exports.shortcutsXml = shortcutsXml;
