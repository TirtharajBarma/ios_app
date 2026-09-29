const { withSwiftSources } = require('./withSwiftSources');

const SOURCE_DIR = 'app-intents';
const GROUP_NAME = 'app-intents';

/**
 * Adds every `app-intents/*.swift` file to the app target.
 *
 * `expo.experiments.inlineModules` makes autolinking read this directory so
 * `ExpenseQuickAddModule.swift` is discovered as an Expo module, but it does not
 * guarantee the other Swift files are compiled.
 */
function withAppIntentsSources(config) {
  return withSwiftSources(config, {
    sourceDir: SOURCE_DIR,
    groupName: GROUP_NAME,
    pluginName: 'with-app-intents',
  });
}

module.exports = withAppIntentsSources;
