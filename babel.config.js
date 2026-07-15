module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind's babel preset must come before the others.
      ["nativewind/babel"],
      ["babel-preset-expo", { "import-attributes": { mustUse: true } }],
    ],
    plugins: [
      // Reanimated plugin must always be last.
      "react-native-reanimated/plugin",
    ],
  };
};
