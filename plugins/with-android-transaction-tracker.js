const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');

const SERVICE_NAME = '.MonevoNotificationListenerService';
const PERMISSION_NAME = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';
const ACTION_NAME = 'android.service.notification.NotificationListenerService';

function withNotificationListenerManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults
    );

    if (!Array.isArray(application.service)) {
      application.service = [];
    }

    const exists = application.service.some(
      (s) => s.$?.['android:name'] === SERVICE_NAME
    );

    if (!exists) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:label': '@string/app_name',
          'android:permission': PERMISSION_NAME,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': ACTION_NAME,
                },
              },
            ],
          },
        ],
      });
    }

    return modConfig;
  });
}

function withNativeTrackerSources(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const platformRoot = modConfig.modRequest.platformProjectRoot;

      const srcDir = path.join(projectRoot, 'plugins', 'tracker-native');
      const targetDir = path.join(
        platformRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'tirtharajbarma',
        'subscription'
      );

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir);
        for (const file of files) {
          if (file.endsWith('.kt')) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(targetDir, file);
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      // Check MainApplication.kt registration
      const mainAppPath = path.join(targetDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf8');
        if (!content.includes('TransactionTrackerPackage()')) {
          content = content.replace(
            '// add(MyReactNativePackage())',
            'add(TransactionTrackerPackage())'
          );
          if (!content.includes('TransactionTrackerPackage()')) {
            content = content.replace(
              'PackageList(this).packages.apply {',
              'PackageList(this).packages.apply {\n          add(TransactionTrackerPackage())'
            );
          }
          fs.writeFileSync(mainAppPath, content, 'utf8');
        }
      }

      return modConfig;
    },
  ]);
}

module.exports = function withAndroidTransactionTracker(config) {
  return withNativeTrackerSources(withNotificationListenerManifest(config));
};
