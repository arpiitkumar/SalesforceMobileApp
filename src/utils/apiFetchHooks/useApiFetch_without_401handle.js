import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { oauth } from 'react-native-force';
import { logout } from '../../redux/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useApiFetch = () => {
  const dispatch = useDispatch();
  const { accessToken, loginTime, instanceUrl, sessionTime ,refreshToken } = useSelector(state => state.auth);
  //const navigation = useNavigation();
  console.log("refreshToken TOKEN=======", refreshToken)
  const apiFetch = async (method, objectName, payload = {}, apiType = 'standard',
    overrideAccessToken = null,
    overrideInstanceUrl = null
  ) => {
    try {
      const token = overrideAccessToken || accessToken;
      const baseURL = overrideInstanceUrl || instanceUrl;

      if (!token || !baseURL) {
        return { status: 'error', message: 'Authentication Failed: Missing Access Token or Instance URL' };
      }
      const url =
        apiType === 'standard'
          ? `/services/data/v61.0/ui-api/${objectName}`
          : apiType === 'SObjects' ? `/services/data/v61.0/${objectName}`
            : apiType === 'notification' ? `/services/data/v61.0/${objectName}` : `/services/apexrest/${objectName}`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      console.log('url ', baseURL + url)
      const config = {
        method: method.toUpperCase(),
        baseURL,
        url,
        headers,
        data: ['POST', 'PATCH'].includes(method.toUpperCase()) ? payload : undefined,
      };

      console.log('API Request:', config);

      const response = await axios(config);

      if (response.status === 201) {
        return { status: 'success', message: 'Record Created Successfully!', data: response?.data };
      }

      return { status: 'success', data: response.data };
    } catch (error) {
      console.error('API Error:', error);
      if (error.response) {
        const { status, data } = error.response;
        let errorMessage = data?.message || 'Unknown error';
        switch (status) {
          case 400: errorMessage = 'Bad Request: Check the input parameters.'; break;
          // case 401: errorMessage = 'Unauthorized: Invalid credentials or session expired.'; break;
          case 401:
            errorMessage = 'Unauthorized: Invalid credentials or session expired.';
            //navigation.navigate('DummyLoginScreen');
            break;
          case 403: errorMessage = 'Forbidden: You do not have permission for this action.'; break;
          case 404: errorMessage = 'Not Found: Requested resource does not exist.'; break;
          case 500: errorMessage = 'Internal Server Error: Something went wrong on the server.'; break;
        }

        return { status: 'error', message: errorMessage };
      }

      return { status: 'error', message: 'Network Error: Please check your internet connection.' };
    }
  };


  const apiComposite = async (
    method,
    objectName,
    payload = {},
    // apiType param kept for signature parity but ignored; composite endpoint is used always
    apiType = 'composite',
    overrideAccessToken = null,
    overrideInstanceUrl = null
  ) => {
    try {
      const token = overrideAccessToken || accessToken;
      const baseURL = overrideInstanceUrl || instanceUrl;

      if (!token || !baseURL) {
        return { status: 'error', message: 'Authentication Failed: Missing Access Token or Instance URL' };
      }

      // Composite endpoint is fixed
      const url = `/services/data/v61.0/composite`;

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // If you want to send the composite body in the exact Salesforce compositeRequest format,
      // pass it as payload. This function doesn't transform the payload to give you flexibility.
      const config = {
        method: method.toUpperCase(),
        baseURL,
        url,
        headers,
        data: ['POST', 'PATCH'].includes(method.toUpperCase()) ? payload : undefined,
      };

      console.log('Composite API Request:', config);

      const response = await axios(config);

      if (response.status === 201) {
        return { status: 'success', message: 'Composite request created successfully!', data: response?.data };
      }

      return { status: 'success', data: response.data };
    } catch (error) {
      console.error('Composite API Error:', error);
      if (error.response) {
        const { status, data } = error.response;
        let errorMessage = data?.message || 'Unknown error';
        switch (status) {
          case 400: errorMessage = 'Bad Request: Check the input parameters.'; break;
          case 401: errorMessage = 'Unauthorized: Invalid credentials or session expired.'; break;
          case 403: errorMessage = 'Forbidden: You do not have permission for this action.'; break;
          case 404: errorMessage = 'Not Found: Requested resource does not exist.'; break;
          case 500: errorMessage = 'Internal Server Error: Something went wrong on the server.'; break;
        }
        return { status: 'error', message: errorMessage };
      }
      return { status: 'error', message: 'Network Error: Please check your internet connection.' };
    }
  };




  const fetchRecords = async (
    ObjectName,
    soqlQuery = '',
    overrideAccessToken = null,
    overrideInstanceUrl = null
  ) => {
    const token = overrideAccessToken || accessToken;
    const baseURL = overrideInstanceUrl || instanceUrl;

    if (!token || !baseURL) {
      return { status: 'error', message: 'Missing authentication details' };
    }

    try {
      const defaultQuery =
        'SELECT id, Subject, Description, StartDateTime, EndDateTime FROM Event ORDER BY CreatedDate DESC LIMIT 200';
      const encodedQuery = encodeURIComponent(soqlQuery || defaultQuery);
      const url = `${baseURL}/services/data/v61.0/query/?q=${encodedQuery}`;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // console.log('Fetch Records URL:', url);
      // console.log('Fetch Records Headers:', headers);

      let allRecords = [];
      let nextUrl = url;

      // loop till all pages fetched
      while (nextUrl) {
        const response = await axios.get(nextUrl, { headers });
        const data = response.data;

        // add current page records
        allRecords = [...allRecords, ...data.records];

        if (data.done) {
          // no more pages
          nextUrl = null;
        } else {
          // build next page URL
          nextUrl = `${baseURL}${data.nextRecordsUrl}`;
        }
      }

      return allRecords;
    } catch (error) {
      console.error('Fetch Records Error:', error.response?.data || error.message);
      return { status: 'error', message: 'Failed to fetch records' };
    }
  };

  const handleLogout = async () => {
    // Implement your logout logic (e.g., clearing Redux state or redirecting)
    await AsyncStorage.setItem("hasLoggedOut", "true");
    dispatch(logout());
    oauth.logout();

    console.log('Logged out and cleared auth state');
  };

  return { apiFetch, apiComposite, fetchRecords, handleLogout };
};