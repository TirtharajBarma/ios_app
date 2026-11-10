const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Automatically registers the reversed Google OAuth Client ID scheme
 * in Info.plist (CFBundleURLSchemes) on iOS so that ASWebAuthenticationSession /
 * Safari redirect URLs (e.g. `com.googleusercontent.apps.<id>:/oauthredirect`)
 * route directly back into Cashveil.
 */
module.exports = function withGoogleOAuthScheme(config) {
  return withInfoPlist(config, (config) => {
    const iosClientId =
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      (config.extra && config.extra.googleIosClientId);

    if (!iosClientId) {
      return config;
    }

    const reversedScheme = iosClientId.split('.').reverse().join('.');
    const urlTypes = config.modResults.CFBundleURLTypes || [];

    let target = urlTypes.find((item) => Array.isArray(item.CFBundleURLSchemes));
    if (!target) {
      target = { CFBundleURLSchemes: [] };
      urlTypes.push(target);
    }

    if (!target.CFBundleURLSchemes.includes(reversedScheme)) {
      target.CFBundleURLSchemes.push(reversedScheme);
      console.log(`[with-google-oauth-scheme] Added ${reversedScheme} to CFBundleURLSchemes`);
    }

    config.modResults.CFBundleURLTypes = urlTypes;
    return config;
  });
};
