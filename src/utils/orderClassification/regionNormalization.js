/**
 * Normalizes a region/state name for deterministic comparison.
 * - Trims leading and trailing whitespace
 * - Collapses multiple internal whitespace characters to a single space
 * - Converts to lowercase
 * - Returns null for null, undefined, empty, or whitespace-only inputs
 *
 * @param {string|null|undefined} region
 * @returns {string|null}
 */
export function normalizeRegionName(region) {
  if (region === null || region === undefined) {
    return null;
  }
  const str = String(region).trim().toLowerCase().replace(/\s+/g, ' ');
  return str.length > 0 ? str : null;
}

/**
 * Checks if two region names are equal after normalization.
 *
 * @param {string|null|undefined} regionA
 * @param {string|null|undefined} regionB
 * @returns {boolean}
 */
export function areRegionsEqual(regionA, regionB) {
  const normA = normalizeRegionName(regionA);
  const normB = normalizeRegionName(regionB);
  if (!normA || !normB) {
    return false;
  }
  return normA === normB;
}

/**
 * Parses raw metadata (which could be an array of records, comma-separated string,
 * newline-separated string, or array of strings) into a normalized array of region strings.
 *
 * @param {Array<Object>|Array<string>|string|null|undefined} input
 * @returns {Array<string>}
 */
export function parseRegionsList(input) {
  if (!input) {
    return [];
  }

  const result = new Set();

  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && typeof item === 'object') {
        const rawRegion = item.Regions__c || item.regions__c || item.region || item.Name || item.name;
        if (typeof rawRegion === 'string') {
          // It might be a comma or newline separated string inside the field
          parseCommaOrNewlineString(rawRegion).forEach(r => result.add(r));
        }
      } else if (typeof item === 'string') {
        parseCommaOrNewlineString(item).forEach(r => result.add(r));
      }
    }
  } else if (typeof input === 'string') {
    parseCommaOrNewlineString(input).forEach(r => result.add(r));
  }

  return Array.from(result);
}

function parseCommaOrNewlineString(str) {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(/[\n\r,]+/)
    .map(normalizeRegionName)
    .filter(Boolean);
}
