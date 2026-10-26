// auth/loginHandler.js
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { showToast } from '../redux/slices/toastSlice';
import { store } from '../redux/store';
import { loginSuccess } from '../redux/slices/authSlice';
import { apiFetch } from '../utils/apiFetchHooks/useApiFetch';
import fetchUserProfile from '../utils/setDataApis/fetchUserProfile.js';
import axios from 'axios';
import { handleLogoutFun } from '../utils/apiFetchHooks/handleLogoutFun';

export const loginHandler = async (fetchRecords, creds) => {
  try {
    //  console.log('INSIDE Login handler>>>>>>>>>>>>')
    const { accessToken, instanceUrl, userId, refreshToken } = creds;

    if (!accessToken || !instanceUrl || !userId || !refreshToken) {
      throw new Error('Missing Salesforce credentials');
    }
    console.log("-ACCESS TOKEN- :: -INSTANCE URL- :: -USER ID- :: -refreshToken- ::", accessToken, instanceUrl, userId, refreshToken);
    await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "delete_all",
    });

    console.log('getting user >>>>>>>>>>>>>>>>')

    const userResponse = await axios.get(
      `${instanceUrl}/services/data/v61.0/sobjects/User/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('after getting user >>>>>>>>>>>>>>>>')
    const userData = await fetchUserProfile(fetchRecords, creds.userId, creds.accessToken, creds.instanceUrl);

    console.log('user Data from login handler ............', JSON.stringify(userData))
    const userDataForDb = {
      Sf_Id: creds.userId,
      DeviceId__c: userData?.[0]?.Deviceid__c,
      Name: userData?.[0]?.Name,
      Role: userData?.[0]?.UserRole?.Name,
      DeveloperName: userData?.[0]?.User_Type__c,
      Email: userData?.[0]?.Email,
      Phone: userData?.[0]?.Phone,
      EmployeeCode__c: userData?.[0]?.EmployeeCode__c,
    };
    console.log('USER DATA AND ROLE::::', userDataForDb);

    await UniversalUpdateInsert({
      ObjectName: 'User',
      Type: 'insert',
      data: userDataForDb
    });

    store.dispatch(
      loginSuccess({
        accessToken,
        instanceUrl,
        refreshToken,
        userId,
        loginTime: Date.now(),
      })
    );

    // console.log('loginHandler: User saved and auth set');

    return {
      status: 'success',
      user: userResponse.data,
    };
  } catch (error) {
    if (error.response?.status === 401) {
      console.warn("⚠️ Unauthorized! Logging out...");
      await handleLogoutFun(store.dispatch);
    } else {
      console.error(' loginHandler failed:', error);
    }

    // store.dispatch(
    //   showToast({
    //     message: 'Login failed. Could not fetch user data.',
    //     type: 'error',
    //   })
    // );

    return {
      status: 'error',
      message: error.message,
    };
  }
};