// utils/deviceUtils.js

import DeviceInfo from 'react-native-device-info';

/**
 * Returns the Android ID of the device
 * Example: 'a1b2c3d4e5f6g7h8'
 */
export const getAndroidDeviceId = async () => {
  try {
    const androidId = await DeviceInfo.getAndroidId();
    return androidId;
  } catch (error) {
    console.error('Error fetching Android ID:', error);
    return null;
  }
};

/**
 * Returns a unique device ID (platform-independent)
 * Example: '9bf5bba0-6e06-11ec-90d6-0242ac120003'
 */
export const getUniqueDeviceId = () => {
  try {
    return DeviceInfo.getUniqueId();
  } catch (error) {
    console.error('Error fetching Unique ID:', error);
    return null;
  }
};
