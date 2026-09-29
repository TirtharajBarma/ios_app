const { withGradleProperties } = require("@expo/config-plugins");

/**
 * Restrict the release build to CPU architectures that ship on real handsets.
 *
 * React Native defaults to bundling all four ABIs, and the x86/x86_64 ones exist
 * purely for the Android emulator. They added ~50 MB to a 125 MB sideloaded APK
 * that no physical phone could ever execute.
 *
 * Emulator builds are still reachable without editing this file:
 *   ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
 */
const DESIRED_ARCHITECTURES = "arm64-v8a,armeabi-v7a";

module.exports = function withAndroidReleaseArchitectures(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (prop) => prop.type === "property" && prop.key === "reactNativeArchitectures"
    );

    if (existing) {
      existing.value = DESIRED_ARCHITECTURES;
    } else {
      config.modResults.push({
        type: "property",
        key: "reactNativeArchitectures",
        value: DESIRED_ARCHITECTURES,
      });
    }

    return config;
  });
};
