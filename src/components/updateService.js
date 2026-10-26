import remoteConfig from '@react-native-firebase/remote-config';
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';



/**
 * 🔥 Fetch update config from Firebase
 */
// NOTE: cache key bumped to V2 so existing installs re-fetch once and pick
// up the new offline_db_schema_version field instead of serving stale cache.
const CACHE_KEY = 'RC_CACHE_DATA_V2';
const TIME_KEY = 'LAST_RC_FETCH';

export const checkForUpdate = async () => {
  try {
    const lastFetch = await AsyncStorage.getItem(TIME_KEY);
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);

    const now = Date.now();

    const Five_HOURS = 5 * 60 * 60 * 1000;
    // ⏱️ Skip API but return cached data
    if (lastFetch && now - Number(lastFetch) < Five_HOURS) {
      console.log('⏳ Using cached Remote Config');
      return cachedData ? JSON.parse(cachedData) : null;
    }

    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: Five_HOURS,
    });

    console.log(
      '🔥 Firebase Project:',
      getApp().options.projectId
    );

    // 1️⃣ Defaults (fallback only)
    await remoteConfig().setDefaults({
      android_latest_version: '1.0.0',
      android_min_version: '1.0.0',
      ios_latest_version: '1.0.0',
      ios_min_version: '1.0.0',
      force_update: false,
      update_message: 'New update available',
      store_url_android: '',
      store_url_ios: '',
      // Single shared offline-DB schema version (integer, monotonic).
      // Bump this in Firebase to trigger a one-time DB rebuild + re-sync.
      offline_db_schema_version: '1',
    });

    // 2️⃣ Fetch from Firebase
    const activated = await remoteConfig().fetchAndActivate();
    console.log('🔥 Remote Config activated:', activated);

    const allKeys = remoteConfig().getAll();
    console.log('🔥 All Remote Config:', allKeys);

    // 3️⃣ Current app version
    const currentVersion = DeviceInfo.getVersion();
    console.log('currentVersion', currentVersion, Platform.OS)

    // 4️⃣ Platform-based values
    const latestVersion =
      Platform.OS === 'android'
        ? remoteConfig().getString('android_latest_version')
        : remoteConfig().getString('ios_latest_version');

    const minVersion =
      Platform.OS === 'android'
        ? remoteConfig().getString('android_min_version')
        : remoteConfig().getString('ios_min_version');

    const storeUrl =
      Platform.OS === 'android'
        ? remoteConfig().getString('store_url_android')
        : remoteConfig().getString('store_url_ios');
    console.log()
    const dbSchemaVersion =
      parseInt(remoteConfig().getString('offline_db_schema_version'), 10) || 1;

    const data = {
      currentVersion,
      latestVersion,
      minVersion,
      forceUpdate: remoteConfig().getBoolean('force_update'),
      message: remoteConfig().getString('update_message'),
      storeUrl,
      dbSchemaVersion,
    };

    await AsyncStorage.setItem(TIME_KEY, now.toString());
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));

    console.log('🔥 Update data from Firebase:', data);
    return data;
  } catch (error) {
    console.error(' Remote Config error:', error);
    return null;
  }
};

/**
 * 🔥 Compare semantic versions
 */
export const compareVersion = (v1, v2) => {
  if (!v1 || !v2) return 0;

  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

/**
 * 🔥 Remote offline-DB schema version (integer).
 * Reuses checkForUpdate()'s fetch + 5h cache. Returns null when Remote
 * Config is unreachable (e.g. offline) so callers can safely defer migration.
 */
export const getRemoteSchemaVersion = async () => {
  try {
    const data = await checkForUpdate();
    if (!data || data.dbSchemaVersion == null) return null;
    return Number(data.dbSchemaVersion);
  } catch (error) {
    console.error(' getRemoteSchemaVersion error:', error);
    return null;
  }
};
