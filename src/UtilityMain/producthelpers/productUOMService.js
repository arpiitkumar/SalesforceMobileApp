import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { UNITS_PER_CASE } from "../../utils/helper/caseUnits";

/**
 * Fetch CGCloud UOM data
 */
export const getCGCloudUOMData = async () => {
  try {
    const uomData = await UniversalUpdateInsert({
      ObjectName: 'cgcloud__Unit_of_Measure__c',
      Type: 'get'
    });
    return Array.isArray(uomData) ? uomData : [];
  } catch (err) {
    console.error('Error fetching CGCloud UOM data:', err);
    return [];
  }
};

/**
 * Enrich product with UOM data from CGCloud
 */
export const enrichProductWithUOM = (product, uomDataMap) => {
  const uom = uomDataMap[product.Sf_Id];
  
  return {
    ...product,
    UnitperCase__c: UNITS_PER_CASE,
    Weight_Per_Unit_in_KG__c: uom?.Weight_Per_Unit_in_KG__c ?? product.Weight_Per_Unit_in_KG__c,
  };
};

/**
 * Create a map of product ID to UOM data for efficient lookup
 */
export const createUOMDataMap = (uomData) => {
  const map = {};
  uomData.forEach(uom => {
    if (uom.cgcloud__Product__c) {
      map[uom.cgcloud__Product__c] = uom;
    }
  });
  return map;
};
