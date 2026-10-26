const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * SVGs in src/ are imported as React components
 * (e.g. `import Cart from '../assets/images/Cart.svg'`), so route them through
 * react-native-svg-transformer instead of the asset pipeline.
 *
 * Firebase: the @react-native-firebase/* packages are provided as local no-op
 * modules under node_modules/@react-native-firebase/* (no native code, not in
 * package.json — see MERGE_NOTES.md). Standard resolution picks them up; no
 * resolver hook needed.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const {assetExts, sourceExts} = defaultConfig.resolver;

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
