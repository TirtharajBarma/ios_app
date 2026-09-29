const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Personal ("free") Apple Developer teams cannot provision the Push
 * Notifications capability. Any local device build fails to sign with:
 *
 *   Cannot create a iOS App Development provisioning profile for
 *   "com.tirtharajbarma.subscription". Personal development teams do not
 *   support the Push Notifications capability.
 *
 * `expo-notifications` adds `aps-environment` to the entitlements plist during
 * prebuild, and prebuild regenerates the file every run, so editing it by hand
 * does not survive. This plugin strips it for local builds only, and only when
 * explicitly opted into:
 *
 *   EXPO_LOCAL_NO_PUSH=1 npx expo run:ios --device
 *
 * EAS builds, release builds and CI are untouched, so push notifications and
 * `expo-updates` keep working everywhere that matters. The only thing given up
 * on an opted-in local build is background push-driven OTA updates, which a
 * local debug build cannot use anyway.
 */
module.exports = function withIosLocalNoPush(config) {
  if (process.env.EXPO_LOCAL_NO_PUSH !== '1') {
    return config;
  }

  return withEntitlementsPlist(config, (config) => {
    if (config.modResults['aps-environment']) {
      delete config.modResults['aps-environment'];
      console.log(
        '[with-ios-local-no-push] removed aps-environment for this local build'
      );
    }
    return config;
  });
};
