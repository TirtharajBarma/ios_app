const { withInfoPlist } = require('@expo/config-plugins');
const { withSwiftSources } = require('./withSwiftSources');

const SOURCE_DIR = 'native-ios';
const GROUP_NAME = 'native-ios';
const SCENE_DELEGATE_CLASS = '$(PRODUCT_MODULE_NAME).SceneDelegate';

/**
 * Adopts the UIScene lifecycle so the app can launch on iOS 27.
 *
 * iOS 27 validates scene adoption at launch and traps with
 * `EXC_BREAKPOINT` / `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`
 * when it decides no `UIApplicationSceneManifest` is declared. Expo SDK 57 /
 * RN 0.86 build the React Native window in `AppDelegate` only, so without this
 * the app force-quits before any JavaScript loads.
 *
 * The validator reads the manifest statically, so the scene configuration has to
 * be declared in Info.plist -- implementing
 * `application:configurationForConnectingSceneSession:options:` at runtime
 * alone does not satisfy it.
 *
 * `SceneDelegate.swift` then hands the window that `AppDelegate` already
 * created to the scene, so the React Native setup is not duplicated.
 */
function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return modConfig;
  });

  return withSwiftSources(config, {
    sourceDir: SOURCE_DIR,
    groupName: GROUP_NAME,
    pluginName: 'with-ios-scene-lifecycle',
  });
}

module.exports = withIosSceneLifecycle;
