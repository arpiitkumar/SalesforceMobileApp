import moment from "moment";
import AsyncStorage from "@react-native-async-storage/async-storage";
// @ts-ignore
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

export const CACHED_SERVER_DATE_KEY = "CACHED_SERVER_DATE";

/**
 * Extracts and formats the authoritative date from Salesforce HTTP response headers
 * @param {object} headers - HTTP response headers
 * @returns {string|null} - Date string in "YYYY-MM-DD" format, or null if invalid
 */
export const getDateFromSalesforceResponse = (headers: any): string | null => {
  const serverDateHeader = headers?.date || headers?.Date;
  if (!serverDateHeader) return null;
  const serverDate = moment(serverDateHeader);
  return serverDate.isValid() ? serverDate.format("YYYY-MM-DD") : null;
};

/**
 * Caches the latest known authoritative server date into AsyncStorage
 * @param {string} dateStr - Date string in "YYYY-MM-DD" format
 */
export const cacheServerDate = async (dateStr: string): Promise<void> => {
  if (!dateStr || typeof dateStr !== "string") return;
  try {
    await AsyncStorage.setItem(CACHED_SERVER_DATE_KEY, dateStr);
  } catch (err) {
    console.warn("Failed to cache server date in AsyncStorage:", err);
  }
};

/**
 * Retrieves the cached server date from AsyncStorage or LastSync local database
 * @returns {Promise<string|null>} - Cached date string in "YYYY-MM-DD" format, or null
 */
export const getCachedServerDate = async (): Promise<string | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHED_SERVER_DATE_KEY);
    if (cached && moment(cached, "YYYY-MM-DD", true).isValid()) {
      return cached;
    }
  } catch (err) {
    console.warn("Failed to read CACHED_SERVER_DATE from AsyncStorage:", err);
  }

  // Fallback to LastSync table date if available
  try {
    const lastSync = await UniversalUpdateInsert({
      ObjectName: "LastSync",
      Type: "get",
    });
    const lastSyncDate = lastSync?.[0]?.DateTime;
    if (lastSyncDate && moment(lastSyncDate, "YYYY-MM-DD", true).isValid()) {
      return lastSyncDate;
    }
  } catch (err) {
    console.warn("Failed to read date from LastSync table:", err);
  }

  return null;
};

/**
 * Resolves the effective date:
 * 1. Tries to fetch live Salesforce server date via apiFetch
 * 2. If successful, caches it and returns it
 * 3. If offline/failed, returns the cached server/sync date
 * 4. As a last resort, returns the device date
 *
 * @param {object} options
 * @param {Function} [options.apiFetch] - API fetch function from useApiFetch
 * @returns {Promise<string>} - Date string in "YYYY-MM-DD" format
 */
export const getEffectiveServerDate = async (options?: {
  apiFetch?: (method: string, endpoint: string, payload?: any, apiType?: string) => Promise<any>;
}): Promise<string> => {
  if (options?.apiFetch) {
    try {
      const response = await options.apiFetch("GET", "limits", {}, "SObjects");
      const serverDate = getDateFromSalesforceResponse(response?.headers);
      if (serverDate) {
        await cacheServerDate(serverDate);
        return serverDate;
      }
    } catch (error) {
      console.warn("Could not fetch server date from Salesforce, falling back to cache:", error);
    }
  }

  const cachedDate = await getCachedServerDate();
  if (cachedDate) {
    return cachedDate;
  }

  return moment().format("YYYY-MM-DD");
};
