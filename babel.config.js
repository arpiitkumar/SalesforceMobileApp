module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Required by @nozbe/watermelondb model decorators (@field, @children, ...)
    ['@babel/plugin-proposal-decorators', {legacy: true}],
  ],
};
