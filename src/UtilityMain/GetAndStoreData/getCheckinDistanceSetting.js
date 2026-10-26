import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "@CHECKIN_DISTANCE_LIMIT";
const DEFAULT_METERS = 100;

const parseMeters = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

/**
 * Returns the allowed check-in distance (meters) from Checkin_Distance_Setting__mdt.
 * Uses the cached value when the org query fails, and falls back to 100 m.
 */
export const getCachedCheckinDistanceLimit = async (fetchRecords) => {
  try {
    const records = await fetchRecords(
      "Checkin_Distance_Setting__mdt",
      "SELECT Id, Distance__c FROM Checkin_Distance_Setting__mdt LIMIT 1",
    );
    const meters = Array.isArray(records)
      ? parseMeters(records[0]?.Distance__c)
      : null;
    if (meters) {
      await AsyncStorage.setItem(CACHE_KEY, String(meters)).catch(() => {});
      return { allowedMeters: meters };
    }
  } catch (e) {
    console.warn("Checkin distance setting fetch failed:", e);
  }

  try {
    const cached = parseMeters(await AsyncStorage.getItem(CACHE_KEY));
    if (cached) return { allowedMeters: cached };
  } catch (_) {}

  return { allowedMeters: DEFAULT_METERS };
};
