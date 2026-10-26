import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { oauth } from 'react-native-force';
import { logout, setAuthData } from '../../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleLogoutService } from "../../components/logoutHandler";
import { loginSuccess } from '../../redux/slices/authSlice';
import { triggerSessionExpired } from '../sessionManager';

export const useApiFetch = () => {
  const dispatch = useDispatch();
  const { accessToken, instanceUrl, refreshToken } = useSelector(state => state.auth);

  // console.log("refreshToken TOKEN=======", refreshToken);

  // REFRESH TOKEN FUNCTION
  const refreshAccessToken = async () => {
    try {
      console.log("🔄 Refreshing access token...");
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: "REDACTED_SECRET",
        client_secret: "REDACTED_SECRET",
        refresh_token: refreshToken,
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
      // const newAccessToken = response.data.access_token;
      //  dispatch(
      //   setAuthData({
      //     accessToken: newAccessToken,
      //     instanceUrl: response.data.instance_url,
      //     refreshToken: refreshToken,
      //   })
      // );
      const {
        access_token,
        instance_url,
        id,
        issued_at
      } = response.data;
      dispatch(
        loginSuccess({
          accessToken: access_token || accessToken,
          instanceUrl: instance_url || instanceUrl,
          refreshToken,   // old hi rahega
          loginTime: Number(issued_at) || Date.now(),
        })
      );
      console.log("New access token received");
      // return newAccessToken;
      return access_token;
    } catch (error) {
      console.log(
        " Refresh Token Failed:",
        error.response?.data || error.message
      );
      triggerSessionExpired();
      return null;
    }
  };

  // =========================================================
  // ======================= apiFetch =========================
  // =========================================================
  const apiFetch = async (
    method,
    objectName,
    payload = {},
    apiType = 'standard',
    overrideAccessToken = null,
    overrideInstanceUrl = null
  ) => {
    const ayncaccessToken = await AsyncStorage.getItem('accessToken_for_datasyncer');
    const ayncinstanceUrl = await AsyncStorage.getItem('instanceUrl_for_datasyncer');
    let token = overrideAccessToken || accessToken || ayncaccessToken;
    const baseURL = overrideInstanceUrl || instanceUrl || ayncinstanceUrl;

    if (!token || !baseURL) {
      return { status: 'error', message: 'Authentication Failed: Missing Access Token or Instance URL' };
    }

    const url =
      apiType === 'standard'
        ? `/services/data/v61.0/ui-api/${objectName}`
        : apiType === 'SObjects'
          ? `/services/data/v61.0/${objectName}`
          : apiType === 'notification'
            ? `/services/data/v61.0/${objectName}`
            : `/services/apexrest/${objectName}`;

    const makeRequest = async () => {
      const config = {
        method: method.toUpperCase(),
        baseURL,
        url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: ['POST', 'PATCH'].includes(method.toUpperCase()) ? payload : undefined,
      };

      // REQUEST LOG
      console.log("Salesforce API Request:", {
        method: config.method,
        baseURL: config.baseURL,
        url: config.url,
        headers: config.headers,
        payload: config.data,
      });

      return await axios(config);
    };

    try {
      const response = await makeRequest();

      // RESPONSE LOG
      console.log("Salesforce API Response:", response.data);
      if (response.status === 201) {
        return { status: 'success', message: 'Record Created Successfully!', data: response?.data };
      }
      return { status: 'success', data: response.data };
    } catch (error) {
      //  ERROR LOG
      console.log("Salesforce API Error:", error.response?.data || error.message);
      if (error.response?.status === 401) {
        console.log("Access token expired. Refreshing token...");
        const newToken = await refreshAccessToken();
        if (!newToken) {
          return { status: 'error', message: 'Unauthorized: Invalid credentials or session expired.' };
        }
        token = newToken;
        console.log("Retrying API request with new token...");
        const retryResponse = await makeRequest();
        // RETRY RESPONSE LOG
        console.log("Salesforce API Retry Response:", retryResponse.data);
        if (retryResponse.status === 201) {
          return { status: 'success', message: 'Record Created Successfully!', data: retryResponse?.data };
        }
        return { status: 'success', data: retryResponse.data };
      }

      if (error.response) {
        const { status, data } = error.response;
        let errorMessage = data?.message || 'Unknown error';

        switch (status) {
          case 400: errorMessage = 'Bad Request: Check the input parameters.'; break;
          case 403: errorMessage = 'Forbidden: You do not have permission for this action.'; break;
          case 404: errorMessage = 'Not Found: Requested resource does not exist.'; break;
          case 500: errorMessage = 'Internal Server Error: Something went wrong on the server.'; break;
        }

        return { status: 'error', message: errorMessage };
      }

      return { status: 'error', message: 'Network Error: Please check your internet connection.' };
    }
  };

  // =========================================================
  // ===================== apiComposite =======================
  // =========================================================
  const apiComposite = async (
    method,
    objectName,
    payload = {},
    apiType = 'composite',
    overrideAccessToken = null,
    overrideInstanceUrl = null
  ) => {

    let token = overrideAccessToken || accessToken;
    const baseURL = overrideInstanceUrl || instanceUrl;
    const url = `/services/data/v61.0/composite`;

    const makeRequest = async () => {

      const requestConfig = {
        method: method.toUpperCase(),
        baseURL,
        url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: ['POST', 'PATCH'].includes(method.toUpperCase()) ? payload : undefined,
      };

      // REQUEST LOG
      // console.log("Composite API Request:", JSON.stringify({
      //   method: requestConfig.method,
      //   baseURL: requestConfig.baseURL,
      //   url: requestConfig.url,
      //   headers: requestConfig.headers,
      //   data: requestConfig.data,
      // }));

      return await axios(requestConfig);
    };

    try {
      const response = await makeRequest();

      // RESPONSE LOG
      console.log("Composite API Response:", response.data);

      if (response.status === 201) {
        return { status: 'success', message: 'Composite request created successfully!', data: response?.data };
      }

      return { status: 'success', data: response.data };

    } catch (error) {

      //  ERROR LOG
      console.log("Composite API Error:", error.response?.data || error.message);

      if (error.response?.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          return { status: 'error', message: 'Unauthorized: Invalid credentials or session expired.' };
        }

        token = newToken;

        console.log("Retrying with new access token...");

        const retryResponse = await makeRequest();

        console.log("Composite Retry Response:", retryResponse.data);

        if (retryResponse.status === 201) {
          return { status: 'success', message: 'Composite request created successfully!', data: retryResponse?.data };
        }

        return { status: 'success', data: retryResponse.data };
      }

      if (error.response) {
        const { status, data } = error.response;
        let errorMessage = data?.message || 'Unknown error';

        switch (status) {
          case 400: errorMessage = 'Bad Request: Check the input parameters.'; break;
          case 403: errorMessage = 'Forbidden: You do not have permission for this action.'; break;
          case 404: errorMessage = 'Not Found: Requested resource does not exist.'; break;
          case 500: errorMessage = 'Internal Server Error: Something went wrong on the server.'; break;
        }

        return { status: 'error', message: errorMessage };
      }

      return { status: 'error', message: 'Network Error: Please check your internet connection.' };
    }
  };

  // =========================================================
  // ===================== fetchRecords =======================
  // =========================================================
  const fetchRecords = async (
    ObjectName,
    soqlQuery = '',
    overrideAccessToken = null,
    overrideInstanceUrl = null
  ) => {

    let token = overrideAccessToken || accessToken;
    const baseURL = overrideInstanceUrl || instanceUrl;

    if (!token || !baseURL) {
      return { status: 'error', message: 'Missing authentication details' };
    }

    try {
      const encodedQuery = encodeURIComponent(soqlQuery);
      let nextUrl = `${baseURL}/services/data/v61.0/query/?q=${encodedQuery}`;

      let allRecords = [];

      while (nextUrl) {
        try {
          const response = await axios.get(nextUrl, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          const data = response.data;
          allRecords = [...allRecords, ...data.records];

          nextUrl = data.done ? null : `${baseURL}${data.nextRecordsUrl}`;

        } catch (err) {

          if (err.response?.status === 401) {
            const newToken = await refreshAccessToken();
            if (!newToken) return [];

            token = newToken;
            continue;
          }

          throw err;
        }
      }

      return allRecords;

    } catch (error) {
      console.error('Fetch Records Error:', error.response?.data || error.message);
      return { status: 'error', message: 'Failed to fetch records' };
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.setItem("hasLoggedOut", "true");
    dispatch(logout());
    setTimeout(async () => {
      await AsyncStorage.setItem('app_installed', 'true');
    }, 1000);
    oauth.logout();
    console.log('Logged out and cleared auth state');
  };

  return { apiFetch, apiComposite, fetchRecords, handleLogout };
};