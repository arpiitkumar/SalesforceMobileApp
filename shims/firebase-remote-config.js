/**
 * No-op stand-in for @react-native-firebase/remote-config.
 *
 * Keeps an in-memory map of whatever setDefaults() provides, so the app-update
 * check in src/components/updateService.js reads back its own defaults
 * (fetchAndActivate() resolves false → "no update", offline_db_schema_version
 * falls back to its default). Nothing is fetched from the network.
 */
const defaults = {};

const asValue = key => {
  const v = defaults[key];
  return {
    asString: () => (v == null ? '' : String(v)),
    asNumber: () => Number(v || 0),
    asBoolean: () => v === true || v === 'true' || v === 1 || v === '1',
    getSource: () => 'default',
  };
};

const instance = {
  setConfigSettings: () => Promise.resolve(),
  setDefaults: d => {
    Object.assign(defaults, d || {});
    return Promise.resolve();
  },
  setDefaultsFromResource: () => Promise.resolve(),
  fetch: () => Promise.resolve(),
  activate: () => Promise.resolve(false),
  fetchAndActivate: () => Promise.resolve(false),
  ensureInitialized: () => Promise.resolve(),
  reset: () => Promise.resolve(),
  getAll: () => {
    const out = {};
    Object.keys(defaults).forEach(k => {
      out[k] = asValue(k);
    });
    return out;
  },
  getValue: key => asValue(key),
  getString: key => asValue(key).asString(),
  getNumber: key => asValue(key).asNumber(),
  getBoolean: key => asValue(key).asBoolean(),
  get lastFetchTime() {
    return 0;
  },
  get lastFetchStatus() {
    return 'no_fetch_yet';
  },
};

export default function remoteConfig() {
  return instance;
}
