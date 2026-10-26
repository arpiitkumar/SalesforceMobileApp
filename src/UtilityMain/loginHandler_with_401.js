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
    const { accessToken, instanceUrl, userId, refreshToken } = creds;

    if (!accessToken || !instanceUrl || !userId || !refreshToken) {
      throw new Error('Missing Salesforce credentials');
    }
    console.log("-ACCESS TOKEN- :: -INSTANCE URL- :: -USER ID- :: -refreshToken- ::",
      accessToken, instanceUrl, userId, refreshToken);

    await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "delete_all",
    });

    console.log('getting user >>>>>>>>>>>>>>>>')

    // 🔥 refresh function (UPDATED)
    const refreshAccessToken = async () => {
      try {

        console.log("🔄 Refreshing access token...");

        const body = new URLSearchParams({
          grant_type: "refresh_token",
          client_id: "REDACTED_SECRET",
          client_secret: "REDACTED_SECRET",
          refresh_token: refreshToken
        }).toString();

        const response = await axios.post(
          "https://login.salesforce.com/services/oauth2/token",
          body,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        const newAccessToken = response.data.access_token;

        store.dispatch(
          loginSuccess({
            accessToken: newAccessToken,
            instanceUrl: response.data.instance_url,
            refreshToken,
            userId,
            loginTime: Date.now(),
          })
        );

        console.log("New Access Token Generated");

        return newAccessToken;

      } catch (err) {

        console.log(
          " Refresh failed:",
          err.response?.data || err.message
        );

        return null;
      }
    };

    let currentToken = accessToken;
    let userResponse;

    try {
      userResponse = await axios.get(
        `${instanceUrl}/services/data/v61.0/sobjects/User/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );
    } catch (error) {

      if (error.response?.status === 401) {

        console.warn("401 received, trying refresh...");

        const newToken = await refreshAccessToken();

        if (!newToken) throw error;

        currentToken = newToken;

        // 🔁 retry same call
        userResponse = await axios.get(
          `${instanceUrl}/services/data/v61.0/sobjects/User/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
          }
        );

      } else {
        throw error;
      }
    }

    console.log('after getting user >>>>>>>>>>>>>>>>')

    const userData = await fetchUserProfile(
      fetchRecords,
      userId,
      currentToken,
      instanceUrl
    );

    console.log('user Data from login handler ............', JSON.stringify(userData))

    const userDataForDb = {
      Sf_Id: userId,
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
        accessToken: currentToken,
        instanceUrl,
        refreshToken,
        userId,
        loginTime: Date.now(),
      })
    );

    return {
      status: 'success',
      user: userResponse.data,
    };

  } catch (error) {

    if (error.response?.status === 401) {

      // console.warn("⚠️ Unauthorized! (Logout disabled)");

      //  Logout commented as requested
      // await handleLogoutFun(store.dispatch);

    } else {
      console.error(' loginHandler failed:', error);
    }

    return {
      status: 'error',
      message: error.message,
    };
  }
};