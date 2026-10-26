// auth/deviceValidator.js

import { getUniqueDeviceId } from '../utils/helper/deviceUtils';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { store } from '../redux/store';
import { setLoginStatus } from '../redux/slices/deviceSlice';
import { logout } from '../redux/slices/authSlice';
import { oauth } from 'react-native-force';
import { showToast } from '../redux/slices/toastSlice';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InsertNSyncLog } from '../utils/InsertNSyncLog';



// Helper to PATCH the new DeviceId into Salesforce
const updateFcmInSalesforce = async (userId, token, url, fCMtoken) => {

  const fullUrl = `${url}/services/data/v60.0/sobjects/User/${userId}`;
  const endpoint = `/services/data/v60.0/sobjects/User/${userId} (FCM_Token__c)`;
  const payload = { FCM_Token__c: fCMtoken };
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };


  try {
    const res = await axios.patch(
      `${url}/services/data/v60.0/sobjects/User/${userId}`,
      { FCM_Token__c: fCMtoken },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('response from update FCM:', JSON.stringify(res?.status));

    // 📝 Log the FCM-token integration call (direct axios, not via apiFetch)
    InsertNSyncLog({
      endpoint,
      requestBody: { FCM_Token__c: fCMtoken },
      responseBody: res.data || { status: res.status },
      statusCode: res.status,
    }).catch(() => {});

    return res.status === 204;
  } catch (error) {
    console.warn('Failed to update FCM token in Salesforce:', error?.message);

    // 📝 Log the failure
    InsertNSyncLog({
      endpoint,
      requestBody: { FCM_Token__c: fCMtoken },
      responseBody: error.response?.data || { message: error.message },
      statusCode: error.response?.status || 0,
      loggingType: 'Error',
    }).catch(() => {});

    return false;
  }
};

/**
 * Validates whether the current device matches the savedDeviceid__c
 * If mismatch, shows modal and returns a promise that resolves to true/false
 * depending on user choice.
 *
 * @param {{ accessToken, instanceUrl, userId }} creds
 
 * @returns {Promise<boolean>}
 */
// auth/deviceValidator.js

export const updateFcmToken = async (creds, fcmToken) => {
  try {
    const { accessToken, instanceUrl, userId } = creds;

    const updated = await updateFcmInSalesforce(
      userId,
      accessToken,
      instanceUrl,
      fcmToken
    );

    if (updated) {
      await UniversalUpdateInsert({
        ObjectName: 'User',
        Type: 'insert',
        data: {
          Sf_Id: userId,
          FCM_Token__c: fcmToken,
        },
      });

      store.dispatch(setLoginStatus({ loginStatus: true }));
      return true;
    }

    return false;
  } catch (err) {
    console.log('updateFcmToken error:', err);
    return false;
  }
};
