import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { UNITS_PER_CASE } from "../../utils/helper/caseUnits";
 
/**
* Fetch saved cart items for a visit
*/
export const getSavedCartItems = async (visitId) => {
  try {
    const cartResult = await UniversalUpdateInsert({
      ObjectName: "CartItems",
      Type: "get",
      filters: [
        { field: "VisitId", value: visitId }
      ]
    });
    return Array.isArray(cartResult) ? cartResult : [];
  } catch (err) {
    console.error('Error fetching cart items:', err);
    return [];
  }
};
 
/**
* Create a lookup map of product ID to cart entry
*/
export const createCartLookupMap = (cartItems) => {
  const map = {};
  (cartItems || []).forEach(cart => {
    const isFree =
      cart &&
      (cart.IsFree__c === true ||
        cart.IsFree__c === 'true' ||
        cart.IsFree__c === 1 ||
        cart.IsFree__c === '1');

    // Product editor should always restore the paid line only.
    if (cart.Product2Id && !isFree) {
      map[String(cart.Product2Id)] = cart;
    }
  });
  return map;
};
 
/**
* Extract quantity in units from cart entry (handles Case/Unit conversion)
*/
export const getUnitsFromCartEntry = (cartEntry, defaultPerCase = 1) => {
  if (!cartEntry) return { units: 0, mode: "Unit" };
 
  const savedQty = parseInt(String(cartEntry.Quantity || "0"), 10) || 0;
  const savedPerCase = UNITS_PER_CASE;
 
  const isCase = (cartEntry.UnitMode || "").toLowerCase() === "case";
  const units = isCase ? savedQty * (savedPerCase || defaultPerCase || 1) : savedQty;
 
  return {
    units,
    mode: isCase ? "Case" : "Unit"
  };
};
 
/**
* Save cart items to database with insert/update logic
*/
export const saveCartItemsToDb = async (cartItemsPayload) => {
  try {
    await UniversalUpdateInsert({
      ObjectName: "CartItems",
      Type: "insert",
      data: cartItemsPayload
    });
  } catch (err) {
    console.error('Error saving cart:', err);
    throw err;
  }
};
 
/**
* Build cart payload from products (for both insert and update)
*/
export const buildCartPayload = (productsFromDb, visitId, existingCartMap) => {
  return productsFromDb
    .filter((p) => (p.quantity || 0) > 0 && !p.isFree)
    .map((p, index) => {
      const isCase = p.unitMode === "Case";
      const perCase = UNITS_PER_CASE;
      const existing = existingCartMap[p.Sf_Id || p._id];
      const schemeDetails = Array.isArray(p.appliedSchemeDetails) ? p.appliedSchemeDetails : (p.appliedSchemeDetails ? [p.appliedSchemeDetails] : []);
      // Reuse Sf_Id for updates, create new for inserts
      const sfId = existing ? existing.Sf_Id : `CART_${Date.now()}_${index}`;
      // console.log("cart payload item ", JSON.stringify(p));
      return {
        Sf_Id: sfId,
        VisitId: visitId,
        PriceBookId: p.PriceBookId,
        Product2Id: p.Sf_Id || p._id,
        Name: p.Name || "",
        CGST__c: p.CGST__c,
        SGST__c: p.SGST__c,
        Weight_Per_Unit_in_KG__c: p.Weight_Per_Unit_in_KG__c,
        GSTPercentage__c: p.GSTPercentage__c,
        ProductImageURL__c: p.ProductImageURL__c || "",
        PTD__c: parseFloat(String(p.PTD__c || "0").replace(/,/g, "")) || 0,
        PTR__c: parseFloat(String(p.PTR__c || "0").replace(/,/g, "")) || 0,
        UnitperCase__c: perCase,
        Quantity: isCase ? Math.floor((p.quantity || 0) / perCase) : (p.quantity || 0),
        UnitMode: p.unitMode || "",
        CreatedAt: existing ? existing.CreatedAt || new Date().toISOString() : new Date().toISOString(),
        is_locally_changed: true,
        operation_type: existing ? "update" : "insert",
        last_modified: Date.now(),
        SoftDelete: false,
        AppliedDiscount__c: p.appliedSchemeDiscount,           // numeric discount applied on this product line
        SchemeSlabIds__c: (p.appliedSchemeDetails || [])
          .map(s => s.schemeSlabId)
          .filter(Boolean)
          .join(','),
        IsFree__c: !!p.isFree,
        Nudge: p.appliedSchemeDetails?.[0]?.schemeName,
        SectionHead: p.recommendationTag,
        FileName__c: p.fileName || p.fileName__c || "", // new file name field (passthrough)
        RewardType__c: p.appliedSchemeDetails?.[0]?.rewardType || "", // reward type from first applied scheme detail
        SchemeGenerated__c: JSON.stringify(schemeDetails || [])
      };
    });
};
