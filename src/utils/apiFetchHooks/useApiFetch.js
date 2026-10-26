import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { oauth } from "react-native-force";
import { logout, setAuthData } from "../../redux/slices/authSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { handleLogoutService } from "../../components/logoutHandler";
import { loginSuccess } from "../../redux/slices/authSlice";
import { InsertNSyncLog, logApiResponse } from "../InsertNSyncLog";
import { triggerSessionExpired } from "../sessionManager";

export const useApiFetch = () => {
  const dispatch = useDispatch();
  const { accessToken, instanceUrl, refreshToken } = useSelector(
    (state) => state.auth,
  );

  // console.log("refreshToken TOKEN=======", refreshToken);

  // REFRESH TOKEN FUNCTION
  const refreshAccessToken = async () => {
    try {
      console.log("🔄 Refreshing access token...");
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id:
          "REDACTED_SECRET",
        client_secret:
          "REDACTED_SECRET",
        refresh_token: refreshToken,
      }).toString();
      const response = await axios.post(
        "https://login.salesforce.com/services/oauth2/token",
        body,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
      // const newAccessToken = response.data.access_token;
      //  dispatch(
      //   setAuthData({
      //     accessToken: newAccessToken,
      //     instanceUrl: response.data.instance_url,
      //     refreshToken: refreshToken,
      //   })
      // );
      const { access_token, instance_url, id, issued_at } = response.data;
      dispatch(
        loginSuccess({
          accessToken: access_token || accessToken,
          instanceUrl: instance_url || instanceUrl,
          refreshToken, // old hi rahega
          loginTime: Number(issued_at) || Date.now(),
        }),
      );
      console.log("New access token received");
      // return newAccessToken;
      return access_token;
    } catch (error) {
      console.log(
        " Refresh Token Failed:",
        error.response?.data || error.message,
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
    apiType = "standard",
    overrideAccessToken = null,
    overrideInstanceUrl = null,
  ) => {
    const ayncaccessToken = await AsyncStorage.getItem(
      "accessToken_for_datasyncer",
    );
    const ayncinstanceUrl = await AsyncStorage.getItem(
      "instanceUrl_for_datasyncer",
    );
    let token = overrideAccessToken || accessToken || ayncaccessToken;
    const baseURL = overrideInstanceUrl || instanceUrl || ayncinstanceUrl;

    if (!token || !baseURL) {
      return {
        status: "error",
        message: "Authentication Failed: Missing Access Token or Instance URL",
      };
    }

    const url =
      apiType === "standard"
        ? `/services/data/v61.0/ui-api/${objectName}`
        : apiType === "SObjects"
        ? `/services/data/v61.0/${objectName}`
        : apiType === "notification"
        ? `/services/data/v61.0/${objectName}`
        : `/services/apexrest/${objectName}`;

    const makeRequest = async () => {
      const config = {
        method: method.toUpperCase(),
        baseURL,
        url,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: ["POST", "PATCH"].includes(method.toUpperCase())
          ? payload
          : undefined,
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

      // 📝 Log API call (captures body-level failures on HTTP 2xx too)
      logApiResponse({
        endpoint: url,
        requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
          ? payload
          : {},
        responseData: response.data,
        statusCode: response.status,
      }).catch(() => {}); // fire-and-forget

      if (response.status === 201) {
        return {
          status: "success",
          message: "Record Created Successfully!",
          data: response?.data,
          headers: response.headers,
        };
      }
      return {
        status: "success",
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      //  ERROR LOG
      console.log(
        "Salesforce API Error:",
        error.response?.data || error.message,
      );
      if (error.response?.status === 401) {
        console.log("Access token expired. Refreshing token...");
        const newToken = await refreshAccessToken();
        if (!newToken) {
          // 📝 Log 401 auth failure
          InsertNSyncLog({
            endpoint: url,
            requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
              ? payload
              : {},
            responseBody: {
              message: "Unauthorized: Invalid credentials or session expired.",
            },
            statusCode: 401,
            loggingType: "Error",
          }).catch(() => {});
          return {
            status: "error",
            message: "Unauthorized: Invalid credentials or session expired.",
          };
        }
        token = newToken;
        console.log("Retrying API request with new token...");
        const retryResponse = await makeRequest();
        // RETRY RESPONSE LOG
        console.log("Salesforce API Retry Response:", retryResponse.data);

        // 📝 Log retry response (captures body-level failures on HTTP 2xx too)
        logApiResponse({
          endpoint: url,
          requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
            ? payload
            : {},
          responseData: retryResponse.data,
          statusCode: retryResponse.status,
        }).catch(() => {});

        if (retryResponse.status === 201) {
          return {
            status: "success",
            message: "Record Created Successfully!",
            data: retryResponse?.data,
            headers: retryResponse.headers,
          };
        }
        return {
          status: "success",
          data: retryResponse.data,
          headers: retryResponse.headers,
        };
      }

      if (error.response) {
        const { status, data } = error.response;
        const detailedMsg = Array.isArray(data)
          ? data.map((e) => e.message).join(", ")
          : typeof data === "object"
          ? data?.message || JSON.stringify(data)
          : String(data);

        let errorMessage = data?.message || "Unknown error";

        switch (status) {
          case 400:
            errorMessage = `Bad Request: Check the input parameters. (${detailedMsg})`;
            break;
          case 403:
            errorMessage = `Forbidden: You do not have permission for this action. (${detailedMsg})`;
            break;
          case 404:
            errorMessage = `Not Found: Requested resource does not exist. (${detailedMsg})`;
            break;
          case 500:
            errorMessage = `Internal Server Error: Something went wrong on the server. (${detailedMsg})`;
            break;
        }

        // 📝 Log error response
        InsertNSyncLog({
          endpoint: url,
          requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
            ? payload
            : {},
          responseBody: data || { message: errorMessage },
          statusCode: status,
        }).catch(() => {});

        return { status: "error", message: errorMessage, details: data };
      }

      // 📝 Log network error
      InsertNSyncLog({
        endpoint: url,
        requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
          ? payload
          : {},
        responseBody: { message: "Network Error", error: error.message },
        statusCode: 0,
        loggingType: "Error",
      }).catch(() => {});

      return {
        status: "error",
        message: "Network Error: Please check your internet connection.",
      };
    }
  };

  // =========================================================
  // ===================== apiComposite =======================
  // =========================================================
  const apiComposite = async (
    method,
    objectName,
    payload = {},
    apiType = "composite",
    overrideAccessToken = null,
    overrideInstanceUrl = null,
  ) => {
    const ayncaccessToken = await AsyncStorage.getItem(
      "accessToken_for_datasyncer",
    );
    const ayncinstanceUrl = await AsyncStorage.getItem(
      "instanceUrl_for_datasyncer",
    );
    let token = overrideAccessToken || accessToken || ayncaccessToken;
    const baseURL = overrideInstanceUrl || instanceUrl || ayncinstanceUrl;
    const url = `/services/data/v61.0/composite`;

    const makeRequest = async () => {
      const requestConfig = {
        method: method.toUpperCase(),
        baseURL,
        url,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: ["POST", "PATCH"].includes(method.toUpperCase())
          ? payload
          : undefined,
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

      // 📝 Log composite response (captures sub-request failures on HTTP 2xx)
      logApiResponse({
        endpoint: url,
        requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
          ? payload
          : {},
        responseData: response.data,
        statusCode: response.status,
      }).catch(() => {});

      if (response.status === 201) {
        return {
          status: "success",
          message: "Composite request created successfully!",
          data: response?.data,
        };
      }

      return { status: "success", data: response.data };
    } catch (error) {
      //  ERROR LOG
      console.log(
        "Composite API Error:",
        error.response?.data || error.message,
      );

      if (error.response?.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          // 📝 Log composite 401 failure
          InsertNSyncLog({
            endpoint: url,
            requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
              ? payload
              : {},
            responseBody: {
              message: "Unauthorized: Invalid credentials or session expired.",
            },
            statusCode: 401,
            loggingType: "Error",
          }).catch(() => {});
          return {
            status: "error",
            message: "Unauthorized: Invalid credentials or session expired.",
          };
        }

        token = newToken;

        console.log("Retrying with new access token...");

        const retryResponse = await makeRequest();

        console.log("Composite Retry Response:", retryResponse.data);

        // 📝 Log composite retry response (captures sub-request failures on HTTP 2xx)
        logApiResponse({
          endpoint: url,
          requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
            ? payload
            : {},
          responseData: retryResponse.data,
          statusCode: retryResponse.status,
        }).catch(() => {});

        if (retryResponse.status === 201) {
          return {
            status: "success",
            message: "Composite request created successfully!",
            data: retryResponse?.data,
          };
        }

        return { status: "success", data: retryResponse.data };
      }

      if (error.response) {
        const { status, data } = error.response;
        const detailedMsg = Array.isArray(data)
          ? data.map((e) => e.message).join(", ")
          : typeof data === "object"
          ? data?.message || JSON.stringify(data)
          : String(data);

        let errorMessage = data?.message || "Unknown error";

        switch (status) {
          case 400:
            errorMessage = `Bad Request: Check the input parameters. (${detailedMsg})`;
            break;
          case 403:
            errorMessage = `Forbidden: You do not have permission for this action. (${detailedMsg})`;
            break;
          case 404:
            errorMessage = `Not Found: Requested resource does not exist. (${detailedMsg})`;
            break;
          case 500:
            errorMessage = `Internal Server Error: Something went wrong on the server. (${detailedMsg})`;
            break;
        }

        // 📝 Log composite error response
        InsertNSyncLog({
          endpoint: url,
          requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
            ? payload
            : {},
          responseBody: data || { message: errorMessage },
          statusCode: status,
        }).catch(() => {});

        return { status: "error", message: errorMessage, details: data };
      }

      // 📝 Log composite network error
      InsertNSyncLog({
        endpoint: url,
        requestBody: ["POST", "PATCH"].includes(method.toUpperCase())
          ? payload
          : {},
        responseBody: { message: "Network Error", error: error.message },
        statusCode: 0,
        loggingType: "Error",
      }).catch(() => {});

      return {
        status: "error",
        message: "Network Error: Please check your internet connection.",
      };
    }
  };

  // =========================================================
  // ===================== fetchRecords =======================
  // =========================================================
  const fetchRecords = async (
    ObjectName,
    soqlQuery = "",
    overrideAccessToken = null,
    overrideInstanceUrl = null,
  ) => {
    let token = overrideAccessToken || accessToken;
    const baseURL = overrideInstanceUrl || instanceUrl;

    if (!token || !baseURL) {
      return { status: "error", message: "Missing authentication details" };
    }

    const fetchUrl = `/services/data/v61.0/query/`;

    try {
      const encodedQuery = encodeURIComponent(soqlQuery);
      let nextUrl = `${baseURL}/services/data/v61.0/query/?q=${encodedQuery}`;

      let allRecords = [];

      while (nextUrl) {
        try {
          const response = await axios.get(nextUrl, {
            headers: {
              "Content-Type": "application/json",
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

          // 📝 Log fetchRecords error
          InsertNSyncLog({
            endpoint: fetchUrl,
            requestBody: { query: soqlQuery, ObjectName },
            responseBody: err.response?.data || { message: err.message },
            statusCode: err.response?.status || 0,
          }).catch(() => {});

          throw err;
        }
      }

      // 📝 Log fetchRecords success (log only once after all pages fetched)
      InsertNSyncLog({
        endpoint: fetchUrl,
        requestBody: { query: soqlQuery, ObjectName },
        responseBody: { totalRecords: allRecords.length },
        statusCode: 200,
      }).catch(() => {});

      return allRecords;
    } catch (error) {
      console.error(
        "Fetch Records Error:",
        error.response?.data || error.message,
      );

      // 📝 Log fetchRecords failure
      InsertNSyncLog({
        endpoint: fetchUrl,
        requestBody: { query: soqlQuery, ObjectName },
        responseBody: error.response?.data || { message: error.message },
        statusCode: error.response?.status || 0,
      }).catch(() => {});

      return { status: "error", message: "Failed to fetch records" };
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.setItem("hasLoggedOut", "true");
    dispatch(logout());
    setTimeout(async () => {
      await AsyncStorage.setItem("app_installed", "true");
    }, 1000);
    oauth.logout();
    console.log("Logged out and cleared auth state");
  };

  return { apiFetch, apiComposite, fetchRecords, handleLogout };
};
