import { UNITS_PER_CASE } from "../../utils/helper/caseUnits";
/* productHelpers.js

  Helpers to extract & normalise product data for TakeOrder_RemoveAccessory.js

  Exports:
    - computeAllowedSubCategories(loggedInUser, UniversalUpdateInsert)
        -> returns Array<string> of allowed SubCategory__c values for the current user

    - mapCgCloudUOM(products, cgCloudUOMData)
        -> returns products array where UnitperCase__c and Weight_Per_Unit_in_KG__c are populated

    - normalizeProductsWithPricingAndCart({ products, pricingHistoryRecords, savedCart, selectedVisit })
        -> returns array of normalized product objects (id/_id, quantityUnits, quantity, unitMode, PTR__c, PTD__c, UnitperCase__c, MaxCaseLimit, etc.)

  Design goals:
    - keep DB helper (UniversalUpdateInsert) usage outside of the normalization functions where possible
    - make functions pure where it makes sense (mapCgCloudUOM, normalizeProductsWithPricingAndCart)
    - surface the minimal inputs required so TakeOrder can call these helpers in sequence
*/

/**
 * Part 1 — Line / SR -> allowed subcategories
 *
 * This encapsulates the logic that loads so_users (for SO role), Line_SR_Distributor_Mapping__c and
 * Line_Product_Mapping__c to compute the unique sub-categories allowed for the user.
 *
 * @param {Object} loggedInUser  The user object from DB (first element of "User" query)
 * @param {Function} UniversalUpdateInsert  DB helper used throughout the repo
 * @returns {Promise<string[]>} unique sub-category names (trimmed)
 */
export async function computeAllowedSubCategories(loggedInUser, UniversalUpdateInsert) {
  if (!loggedInUser || !loggedInUser.Sf_Id) return [];

  try {
    let lineSrMappings = [];

    if (loggedInUser.DeveloperName === 'H_T_SO') {
      // SO users: fetch the list of relevant SR Sf_Id values
      const soUsers = await UniversalUpdateInsert({ ObjectName: 'so_users', Type: 'get' });
      const allSfIds = Array.isArray(soUsers) ? soUsers.map(u => u.Sf_Id) : [];

      lineSrMappings = await UniversalUpdateInsert({
        ObjectName: 'Line_SR_Distributor_Mapping__c',
        Type: 'get',
        filters: [
          { field: 'SR__c', operator: 'in', value: [...allSfIds, loggedInUser.Sf_Id] }
        ]
      });
    } else {
      lineSrMappings = await UniversalUpdateInsert({
        ObjectName: 'Line_SR_Distributor_Mapping__c',
        Type: 'get',
        filters: [{ field: 'SR__c', value: loggedInUser.Sf_Id }]
      });
    }

    const mappings = Array.isArray(lineSrMappings) ? lineSrMappings : [];
    const linesSet = new Set(
      mappings
        .map(m => (m.Line__c || '').toString().trim())
        .filter(Boolean)
    );

    if (linesSet.size === 0) return [];

    const allLineProducts = await UniversalUpdateInsert({ ObjectName: 'Line_Product_Mapping__c', Type: 'get' });
    const lpArray = Array.isArray(allLineProducts) ? allLineProducts : [];

    const allowedLineProducts = lpArray.filter(lp => linesSet.has((lp.Line__c || '').toString().trim()));

    const uniqueSubCategories = [...new Set(
      allowedLineProducts
        .map(item => (item.Sub_Category__c || '').toString().trim())
        .filter(Boolean)
    )];

    return uniqueSubCategories;
  } catch (err) {
    // swallow and return empty list — caller should handle empty result
    console.warn('computeAllowedSubCategories error', err);
    return [];
  }
}

/**
 * Part 3 — merge cgCloud unit-of-measure data into products
 *
 * @param {Array<Object>} products  Product2 records
 * @param {Array<Object>} cgCloudUOMData  cgcloud__Unit_of_Measure__c records
 * @returns {Array<Object>} mapped products
 */
export function mapCgCloudUOM(products = [], cgCloudUOMData = []) {
  if (!Array.isArray(products)) return [];
  const uomIndex = (cgCloudUOMData || []).reduce((acc, u) => {
    if (u && u.cgcloud__Product__c) acc[u.cgcloud__Product__c] = u;
    return acc;
  }, {});

  return products.map(product => {
    const uom = uomIndex[product.Sf_Id];
    return {
      ...product,
      UnitperCase__c: UNITS_PER_CASE,
      Weight_Per_Unit_in_KG__c: uom ? uom.Weight_Per_Unit_in_KG__c : product.Weight_Per_Unit_in_KG__c,
    };
  });
}

/**
 * Part 2 — Normalise products with pricing records and saved cart
 *
 * Inputs expected:
 *   products: Product2[] (already filtered to allowed sub-categories if needed)
 *   pricingHistoryRecords: Product_Pricing_History__c[] (should be pre-filtered by channel/group/zone & verticals)
 *   savedCart: CartItems[] (previously saved cart rows)
 *   options.selectedVisit: object containing .sfId etc. (optional, but used for VisitId mapping)
 *
 * Behavior mirrors the logic inside TakeOrder's initialize() for constructing `normalized` array.
 */
export function normalizeProductsWithPricingAndCart({ products = [], pricingHistoryRecords = [], savedCart = [], options = {} }) {
  const cartByProduct = {};
  (Array.isArray(savedCart) ? savedCart : []).forEach(c => {
    if (c.Product2Id) cartByProduct[String(c.Product2Id)] = c;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // build a quick lookup for pricing records where today is between validFrom-validTo
  const pricingByFraction = {};
  (Array.isArray(pricingHistoryRecords) ? pricingHistoryRecords : []).forEach(item => {
    try {
      if (!item.Valid_From__c || !item.Valid_To__c) return;
      const from = new Date(item.Valid_From__c);
      const to = new Date(item.Valid_To__c);
      from.setHours(0,0,0,0);
      to.setHours(0,0,0,0);
      if (today >= from && today <= to) {
        // Fraction__c in your earlier code was used as product id link
        if (item.Fraction__c) pricingByFraction[String(item.Fraction__c)] = item;
      }
    } catch (e) {
      // malformed dates — ignore
    }
  });

  const normalized = (Array.isArray(products) ? products : []).map(p => {
    const basePerCase = UNITS_PER_CASE;
    const prodId = p.Sf_Id || p.id || String(Math.random());
    const cartEntry = cartByProduct[prodId];

    let unitsFromCart = 0;
    let unitModeFromCart = p.unitMode || 'Unit';

    if (cartEntry) {
      const savedQty = parseInt(String(cartEntry.Quantity || '0'), 10) || 0;
      const savedPerCase = UNITS_PER_CASE;

      if ((cartEntry.UnitMode || '').toLowerCase() === 'case') {
        unitsFromCart = savedQty * (savedPerCase || basePerCase || 1);
        unitModeFromCart = 'Case';
      } else {
        unitsFromCart = savedQty;
        unitModeFromCart = 'Unit';
      }
    }

    const matchedPricing = pricingByFraction[prodId] || null;
    const PTRValue = matchedPricing ? matchedPricing.PTR__c : 0;
    const PTDValue = matchedPricing ? matchedPricing.PTD_PTSS__c : 0;

    return {
      id: prodId,
      _id: prodId,
      ...p,
      quantityUnits: unitsFromCart,
      quantity: unitsFromCart,
      unitMode: cartEntry ? unitModeFromCart : (p.unitMode || 'Unit'),
      PTR__c: PTRValue != null ? String(PTRValue) : '',
      PTD__c: PTDValue != null ? String(PTDValue) : '',
      UnitperCase__c: basePerCase,
      MaxCaseLimit: p.MaxCaseLimit != null ? p.MaxCaseLimit : 99,
      Weight_Per_Unit_in_KG__c: p.Weight_Per_Unit_in_KG__c,
      SGST__c: p.SGST__c,
      CGST__c: p.SGST__c,
      GSTPercentage__c: p.GSTPercentage__c,
    };
  });

  return normalized;
}

// -----------------------
// Example usage (call from your TakeOrder component):
// -----------------------
// import { computeAllowedSubCategories, mapCgCloudUOM, normalizeProductsWithPricingAndCart } from './productHelpers';
//
// // 1) get allowed sub categories
// const uniquesSubCatMain = await computeAllowedSubCategories(loggedInUser[0], UniversalUpdateInsert);
//
// // 2) fetch Product2 and cgcloud UOM then merge
// const allProducts = await UniversalUpdateInsert({ ObjectName: 'Product2', Type: 'get' });
// const cgCloudUOMData = await UniversalUpdateInsert({ ObjectName: 'cgcloud__Unit_of_Measure__c', Type: 'get' });
// const mappedProducts = mapCgCloudUOM(allProducts, cgCloudUOMData);
//
// // 3) filter by allowed subcategories
// const result = mappedProducts.filter(prod => {
//   if (uniquesSubCatMain.length === 0) return false;
//   return uniquesSubCatMain.includes((prod.SubCategory__c || '').trim());
// });
//
// // 4) fetch pricing history and saved cart, then normalize
// const pricingHistory = await UniversalUpdateInsert({ ObjectName: 'Product_Pricing_History__c', Type: 'get', /* filters as needed */ });
// const savedCart = await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'get', filters: [{ field: 'VisitId', value: selectedVisit.sfId }] });
// const normalizedProducts = normalizeProductsWithPricingAndCart({ products: result, pricingHistoryRecords: pricingHistory, savedCart });
//
// // setProductsFromDb(normalizedProducts)


/* End of productHelpers.js */
