// auth/GetAndStoreData/getUnitOfMeasure.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Unit of Measure query for CP products (Vertical 40)
 */
// const buildUnitOfMeasureQuery = () => `
//   SELECT Id, Name, cgcloud__Product__c, cgcloud__Pieces_per_parent_unit__c, 
//          Weight_Per_Unit_in_KG__c
//   FROM cgcloud__Unit_of_Measure__c
//   WHERE cgcloud__Is_Order_Unit__c = TRUE 
//     AND cgcloud__Product__c != NULL 
//     AND cgcloud__Product__r.IsActive = TRUE 
//     AND cgcloud__Product__r.Active_in_SFA__c = TRUE 
//     AND (cgcloud__Product__r.PackGroup__c = 'CP' OR cgcloud__Product__r.PackGroup__c = 'BP')
//      AND cgcloud__Product__r.PackType__c !='TIN' 
//     AND cgcloud__Product__r.Vertical__c = '40' 
//     AND cgcloud__Product__r.Fraction__c = NULL 
//     AND cgcloud__Product__r.SKUCodeinDMS__c = NULL
// `;

const buildUnitOfMeasureQuery = () => `
  SELECT Id, Name, cgcloud__Product__c, cgcloud__Pieces_per_parent_unit__c, 
         Weight_Per_Unit_in_KG__c
  FROM cgcloud__Unit_of_Measure__c
  WHERE cgcloud__Is_Order_Unit__c = TRUE 
    AND cgcloud__Product__c != NULL 
    AND cgcloud__Product__r.IsActive = TRUE 
    AND cgcloud__Product__r.Active_in_SFA__c = TRUE 
    AND (cgcloud__Product__r.PackGroup__c = 'CP' OR cgcloud__Product__r.PackGroup__c = 'BP')
    AND cgcloud__Product__r.Vertical__c = '40' 
    AND cgcloud__Product__r.Fraction__c = NULL 
    AND cgcloud__Product__r.SKUCodeinDMS__c = NULL
`;

/**
 * Fetch Unit of Measure records from Salesforce
 */
const fetchUnitOfMeasureData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const unitOfMeasureQuery = buildUnitOfMeasureQuery();

  try {
    const UomData = await fetchRecords('cgcloud__Unit_of_Measure__c', unitOfMeasureQuery, accessToken, instanceUrl);
    if (!Array.isArray(UomData)) {
      throw new Error('Invalid data type for Unit of Measure');
    }
    console.log(`Fetched ${UomData.length} Unit of Measure records`);
    return { success: true, data: UomData };
  } catch (err) {
    const msg = `Failed to fetch Unit of Measure: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Clean and map Unit of Measure to local schema (EXACT same logic as your code)
 */
const mapUnitOfMeasureToLocalSchema = (UomData = []) => {
  const cleanUomArray = Array.isArray(UomData) ? UomData.filter(Boolean) : [];

  return cleanUomArray.map(item => ({
    Sf_Id: item?.Id ?? '',
    Name: item?.Name ?? '',
    cgcloud__Product__c: item?.cgcloud__Product__c ?? '',
    cgcloud__Pieces_per_parent_unit__c: item?.cgcloud__Pieces_per_parent_unit__c ?? 0,
    Weight_Per_Unit_in_KG__c: item?.Weight_Per_Unit_in_KG__c ?? 0,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));
};

/**
 * Insert Unit of Measure into local database
 */
const insertUnitOfMeasureToDb = async (cleanedUomPayload) => {
  if (cleanedUomPayload.length === 0) {
    console.log('⚠️ No Unit of Measure records to insert');
    return { success: true };
  }

  const uomInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'cgcloud__Unit_of_Measure__c',
        Type: 'insert',
        data: cleanedUomPayload,
      }),
    `Insert ${cleanedUomPayload.length} Unit of Measure records`
  );

  if (!uomInsertResult.success) {
    const msg = 'Failed to insert Unit of Measure into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getUnitOfMeasure = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Unit of Measure records
    const fetchResult = await fetchUnitOfMeasureData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Clean and map to local schema
    const cleanedUomPayload = mapUnitOfMeasureToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertUnitOfMeasureToDb(cleanedUomPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedUomPayload.length} Unit of Measure records`,
      data: { count: cleanedUomPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getUnitOfMeasure: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
