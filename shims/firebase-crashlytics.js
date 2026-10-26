/**
 * No-op stand-in for @react-native-firebase/crashlytics.
 * Errors are just logged to the JS console instead of being reported.
 */
const instance = {
  recordError: (error, jsErrorName) => {
    // eslint-disable-next-line no-console
    console.warn('[crashlytics:noop] recordError', jsErrorName || '', error);
  },
  log: () => {},
  setAttribute: () => Promise.resolve(),
  setAttributes: () => Promise.resolve(),
  setUserId: () => Promise.resolve(),
  setCrashlyticsCollectionEnabled: () => Promise.resolve(),
  isCrashlyticsCollectionEnabled: false,
  checkForUnsentReports: () => Promise.resolve(false),
  deleteUnsentReports: () => Promise.resolve(),
  didCrashOnPreviousExecution: () => Promise.resolve(false),
  sendUnsentReports: () => {},
  crash: () => {},
};

export default function crashlytics() {
  return instance;
}
