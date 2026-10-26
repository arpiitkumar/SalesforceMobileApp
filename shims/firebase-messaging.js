/**
 * No-op stand-in for @react-native-firebase/messaging.
 * Firebase / FCM is not configured for this build. All methods resolve harmlessly
 * so the FCM code paths in src/ (token fetch, channel creation, permission
 * request — all already wrapped in try/catch and "non-blocking") do nothing.
 */
const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};
const AndroidImportance = {NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5};

const instance = {
  AuthorizationStatus,
  AndroidImportance,
  android: {
    createChannel: () => Promise.resolve(null),
    deleteChannel: () => Promise.resolve(),
    getChannel: () => Promise.resolve(null),
    getChannels: () => Promise.resolve([]),
  },
  getToken: () => Promise.resolve(''),
  getAPNSToken: () => Promise.resolve(null),
  deleteToken: () => Promise.resolve(),
  hasPermission: () => Promise.resolve(AuthorizationStatus.AUTHORIZED),
  requestPermission: () => Promise.resolve(AuthorizationStatus.AUTHORIZED),
  registerDeviceForRemoteMessages: () => Promise.resolve(),
  unregisterDeviceForRemoteMessages: () => Promise.resolve(),
  isDeviceRegisteredForRemoteMessages: true,
  setAutoInitEnabled: () => Promise.resolve(),
  subscribeToTopic: () => Promise.resolve(),
  unsubscribeFromTopic: () => Promise.resolve(),
  onMessage: () => () => {},
  onNotificationOpenedApp: () => () => {},
  onTokenRefresh: () => () => {},
  onDeletedMessages: () => () => {},
  onMessageSent: () => () => {},
  onSendError: () => () => {},
  setBackgroundMessageHandler: () => {},
  getInitialNotification: () => Promise.resolve(null),
  getIsHeadless: () => Promise.resolve(false),
};

function messaging() {
  return instance;
}
messaging.AuthorizationStatus = AuthorizationStatus;
messaging.AndroidImportance = AndroidImportance;

export default messaging;
export {AuthorizationStatus, AndroidImportance};
