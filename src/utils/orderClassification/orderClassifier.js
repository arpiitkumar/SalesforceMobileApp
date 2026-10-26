import { normalizeRegionName, parseRegionsList } from './regionNormalization';

export const ORDER_TYPES = {
  DMS: 'DMS',
  NON_DMS: 'NON_DMS',
  UNRESOLVED: 'UNRESOLVED',
};

/**
 * Determines the order classification based on the user's mapped BA state
 * and the Non-DMS metadata regions.
 *
 * @param {string|null|undefined} baState - The BA's BillingState
 * @param {Array<Object>|Array<string>|string|null|undefined} nonDmsRegions - Raw or parsed Non-DMS regions metadata
 * @returns {{
 *   orderType: 'DMS'|'NON_DMS'|'UNRESOLVED',
 *   isNonDmsOrder: boolean|null,
 *   matchedRegion: string|null,
 *   baState: string|null,
 *   error: string|null
 * }}
 */
export function getOrderType(baState, nonDmsRegions) {
  const normalizedBaState = normalizeRegionName(baState);

  // Safety check 1: BA State must be provided
  if (!normalizedBaState) {
    return {
      orderType: ORDER_TYPES.UNRESOLVED,
      isNonDmsOrder: null,
      matchedRegion: null,
      baState: baState || null,
      error: 'Unable to determine BA state. Please ensure your account has a valid state mapped.',
    };
  }

  // Safety check 2: Non-DMS regions configuration must not be null/undefined
  if (nonDmsRegions === null || nonDmsRegions === undefined) {
    return {
      orderType: ORDER_TYPES.UNRESOLVED,
      isNonDmsOrder: null,
      matchedRegion: null,
      baState: String(baState).trim(),
      error: 'Non-DMS regions configuration is unavailable. Please synchronize your data.',
    };
  }

  const normalizedRegions = parseRegionsList(nonDmsRegions);

  // Find if normalized BA state matches any configured non-DMS region
  const isMatch = normalizedRegions.includes(normalizedBaState);

  if (isMatch) {
    return {
      orderType: ORDER_TYPES.NON_DMS,
      isNonDmsOrder: true,
      matchedRegion: String(baState).trim(),
      baState: String(baState).trim(),
      error: null,
    };
  }

  return {
    orderType: ORDER_TYPES.DMS,
    isNonDmsOrder: false,
    matchedRegion: null,
    baState: String(baState).trim(),
    error: null,
  };
}
