import remoteConfig from '@react-native-firebase/remote-config';
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';



/**
 * 🔥 Fetch update config from Firebase
 */
export const checkForUpdate = async () => {
  try {
    // 🔥 IMPORTANT: Disable cache for DEV
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: 0, // force fetch
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
    });

    // 2️⃣ Fetch from Firebase
    const activated = await remoteConfig().fetchAndActivate();
    // console.log('🔥 Remote Config activated:', activated);

    const allKeys = remoteConfig().getAll();
    // console.log('🔥 All Remote Config:', allKeys);

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
    const data = {
      currentVersion,
      latestVersion,
      minVersion,
      forceUpdate: remoteConfig().getBoolean('force_update'),
      message: remoteConfig().getString('update_message'),
      storeUrl,
    };

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
