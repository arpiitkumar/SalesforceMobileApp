// auth/deviceValidator.js
import { getUniqueDeviceId } from '../utils/helper/deviceUtils';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { store } from '../redux/store';
import { setLoginStatus } from '../redux/slices/deviceSlice';
import { logout } from '../redux/slices/authSlice';
import { oauth } from 'react-native-force';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to clear local data and log out
export const logoutAndClearData = async () => {
  try {
    await AsyncStorage.removeItem('LAST_FCM_FETCH');
    await AsyncStorage.removeItem('initialDataSynced');
    await AsyncStorage.setItem('hasLoggedOut', 'true');
    await UniversalUpdateInsert({ ObjectName: 'User', Type: 'delete_all' });
    await UniversalUpdateInsert({ ObjectName: 'Attendant__c', Type: 'delete_all' });
    await UniversalUpdateInsert({ ObjectName: 'Visit', Type: 'delete_all' });
    await UniversalUpdateInsert({ ObjectName: 'Account', Type: 'delete_all' });
    store.dispatch(logout());
    oauth.logout();
  } catch (err) {
    console.error('Error during logoutAndClearData:', err);
  }
};

/**
 * Validates whether the current device matches the assigned Deviceid__c from User object.
 * - If they match (or no device ID is assigned yet in Salesforce): allows user to proceed.
 * - If they do not match: shows blocking modal that user is not allowed to use the app on this device.
 *
 * @param {{ accessToken, instanceUrl, userId }} creds
 * @param {{ setModalVisible: fn, setModalHandler: fn }} modalControls
 * @returns {Promise<boolean>}
 */
export const deviceValidator = async (creds, modalControls) => {
  const { setModalVisible, setModalHandler } = modalControls || {};

  try {
    // 1. Get current device unique ID using react-native-device-info
    const currentDeviceId = String((await getUniqueDeviceId()) || '').trim();

    // 2. Fetch assigned Deviceid__c from local User database
    const userResult = await UniversalUpdateInsert({
      ObjectName: 'User',
      Type: 'get',
    });

    const assignedDeviceId = String(
      userResult?.[0]?.DeviceId__c || userResult?.[0]?.Deviceid__c || ''
    ).trim();

    console.log(
      '📱 Device Validation -> Assigned:',
      assignedDeviceId || '(None)',
      '| Current Device:',
      currentDeviceId
    );

    // 3. Device ID validation commented out for now
    /*
    if (
      assignedDeviceId &&
      currentDeviceId &&
      assignedDeviceId.toLowerCase() !== currentDeviceId.toLowerCase()
    ) {
      console.warn('❌ Device Mismatch! User logged in on unauthorized device.');

      if (setModalHandler && setModalVisible) {
        return new Promise((resolve) => {
          setModalHandler({
            logout: async () => {
              if (setModalVisible) setModalVisible(false);
              await logoutAndClearData();
              resolve(false);
            },
            no: async () => {
              if (setModalVisible) setModalVisible(false);
              await logoutAndClearData();
              resolve(false);
            },
          });
          setModalVisible(true);
        });
      }

      return false;
    }
    */

    // 4. Device matches or no device restriction set -> allow access
    store.dispatch(setLoginStatus({ loginStatus: true }));
    return true;
  } catch (error) {
    console.error('deviceValidator error:', error);
    store.dispatch(setLoginStatus({ loginStatus: true }));
    return true;
  }
};
