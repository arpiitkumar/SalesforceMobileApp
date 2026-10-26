import { SF_CONSUMER_KEY, SF_CONSUMER_SECRET } from '../secrets';
// auth/loginHandler.js
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { showToast } from '../redux/slices/toastSlice';
import { store } from '../redux/store';
import { loginSuccess } from '../redux/slices/authSlice';
import { apiFetch } from '../utils/apiFetchHooks/useApiFetch';
import fetchUserProfile from '../utils/setDataApis/fetchUserProfile.js';
import axios from 'axios';
import { handleLogoutFun } from '../utils/apiFetchHooks/handleLogoutFun';
import { handleLogoutService } from "../components/logoutHandler";
import { syncSystemLogsOnLogin } from '../utils/InsertNSyncLog';
import { triggerSessionExpired } from '../utils/sessionManager';

export const loginHandler = async (fetchRecords, creds, handleLogout) => {
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
          client_id: SF_CONSUMER_KEY,
          client_secret: SF_CONSUMER_SECRET,
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
        const newAccessToken = response?.data?.access_token;
        const {
          access_token,
          instance_url,
          id,
          issued_at
        } = response.data;
        // console.log('response', JSON.stringify(response))

        store.dispatch(
          loginSuccess({
            accessToken: access_token,
            instanceUrl: instance_url,
            refreshToken,
            userId: userId,
            loginTime: Number(issued_at) || Date.now(),
          })
        );
        console.log("Token Stored Successfully");
        return access_token;
      } catch (err) {
        console.log(
          " Refresh failed:",
          err.response?.data || err.message
        );
        triggerSessionExpired();
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
      Geography__c: userData?.[0]?.Geography__c || "",
      Assigned_Latitude__c: userData?.[0]?.Assigned_Latitude__c,
      Assigned_Longitude__c: userData?.[0]?.Assigned_Longitude__c,
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

    // Fire-and-forget: delete old synced logs, push all unsynced logs to Salesforce
    syncSystemLogsOnLogin().catch(() => { });

    return {
      status: 'success',
      user: userResponse.data,
      accessToken: currentToken, // IMPORTANT
      instanceUrl,
      refreshToken,
      userId
    };

  } catch (error) {

    if (error.response?.status === 401) {
      // console.warn("⚠️ Unauthorized! (Logout disabled)");
      //  Logout commented as requested
      // await handleLogoutFun(store.dispatch);
      await handleLogoutService({
        setIsLoggingOut: null,
        dispatch: store.dispatch,
        handleLogout
      });
    } else {
      console.error(' loginHandler failed:', error);
    }

    return {
      status: 'error',
      message: error.message,
    };
  }
};
