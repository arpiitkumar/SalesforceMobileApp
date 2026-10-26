import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { getOrderType, ORDER_TYPES } from './orderClassifier';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NON_DMS_REGIONS_STORAGE_KEY = '@non_dms_regions_cache';
export const USER_BA_MAPPING_STORAGE_KEY = '@user_ba_mapping_cache';

/**
 * Retrieves the cached Non-DMS regions from local AsyncStorage cache.
 *
 * @returns {Promise<Array<string>>}
 */
export async function getCachedNonDmsRegions() {
  try {
    const cached = await AsyncStorage.getItem(NON_DMS_REGIONS_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('⚠️ Error fetching cached Non-DMS regions:', err);
  }
  return null;
}

/**
 * Stores Non-DMS regions into local storage/cache.
 *
 * @param {Array<Object>|Array<string>} regions
 */
export async function cacheNonDmsRegions(regions) {
  try {
    const stringList = (regions || []).map(r => (typeof r === 'string' ? r : r.Regions__c || r.regions__c || r.Name)).filter(Boolean);
    await AsyncStorage.setItem(NON_DMS_REGIONS_STORAGE_KEY, JSON.stringify(stringList));
  } catch (err) {
    console.warn('⚠️ Error caching Non-DMS regions:', err);
  }
}

/**
 * Retrieves the cached User BA Mapping for a given user ID from local AsyncStorage cache.
 *
 * @param {string} userId - Current Salesforce User ID
 * @returns {Promise<{ AccountId?: string, AccountName?: string, BillingState?: string }|null>}
 */
export async function getCachedUserBaMapping(userId) {
  if (!userId) return null;

  try {
    const key = `${USER_BA_MAPPING_STORAGE_KEY}_${userId}`;
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('⚠️ Error fetching cached User BA mapping:', err);
  }
  return null;
}

/**
 * Stores User BA mapping into local storage/cache.
 *
 * @param {string} userId
 * @param {Object} mappingData
 */
export async function cacheUserBaMapping(userId, mappingData) {
  if (!userId || !mappingData) return;
  try {
    const key = `${USER_BA_MAPPING_STORAGE_KEY}_${userId}`;
    await AsyncStorage.setItem(key, JSON.stringify(mappingData));
  } catch (err) {
    console.warn('⚠️ Error caching User BA mapping:', err);
  }
}

/**
 * Resolves order classification for the current user and context.
 *
 * @param {Object} options
 * @param {string} [options.userId] - Current User's Salesforce ID
 * @param {string} [options.baState] - Explicit BA State if already known
 * @param {Array<string>} [options.nonDmsRegions] - Explicit Non-DMS regions if already loaded
 * @returns {Promise<{
 *   orderType: 'DMS'|'NON_DMS'|'UNRESOLVED',
 *   isNonDmsOrder: boolean|null,
 *   baState: string|null,
 *   matchedRegion: string|null,
 *   error: string|null,
 *   configurationSource: 'LOCAL'|'SERVER'
 * }>}
 */
export async function resolveOrderClassification(options = {}) {
  let { userId, baState, nonDmsRegions } = options;

  // 1. If BA state is not provided directly, look up from User BA mapping
  if (!baState && userId) {
    const baMapping = await getCachedUserBaMapping(userId);
    if (baMapping && baMapping.BillingState) {
      baState = baMapping.BillingState;
    }
  }

  // 2. If Non-DMS regions are not provided, look up from cache
  if (!nonDmsRegions) {
    nonDmsRegions = await getCachedNonDmsRegions();
  }

  // 3. Classify using pure classification rules
  const result = getOrderType(baState, nonDmsRegions);

  const finalResult = {
    ...result,
    configurationSource: 'LOCAL',
  };

  console.log('📋 Order Classification Resolved:', {
    userId: userId || 'N/A',
    baState: finalResult.baState,
    orderType: finalResult.orderType,
    isNonDmsOrder: finalResult.isNonDmsOrder,
    matchedRegion: finalResult.matchedRegion,
  });

  return finalResult;
}

export { ORDER_TYPES };
