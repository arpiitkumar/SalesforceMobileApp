/**
 * No-op stand-in for @react-native-firebase/app.
 *
 * Firebase is not configured for this build (no google-services.json). This shim
 * is aliased in metro.config.js so `src/` imports keep resolving and every
 * Firebase call becomes a safe no-op instead of crashing at startup.
 */
const app = {
  name: '[DEFAULT]',
  options: {projectId: 'no-firebase', appId: 'no-firebase'},
  automaticDataCollectionEnabled: false,
};

export function getApp() {
  return app;
}
export function getApps() {
  return [app];
}
export function initializeApp() {
  return Promise.resolve(app);
}
export function deleteApp() {
  return Promise.resolve();
}

const firebase = {app: getApp, apps: [app], initializeApp};
export default firebase;
