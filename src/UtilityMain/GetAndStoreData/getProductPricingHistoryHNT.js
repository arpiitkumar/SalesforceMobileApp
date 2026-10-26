// auth/GetAndStoreData/getProductPricingHistoryHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Fetch Product Pricing History from API
 */
const fetchProductPricingHistoryFromApi = async ({ creds, apiFetch }) => {
  try {
    const userId = creds.userId;
    const payload = { userId };
    const response = await apiFetch('POST', 'recordType', payload, 'Custom', creds.accessToken, creds.instanceUrl);

    const ProductPricingHistoryData = response.data.responseBody.productPricingList;
    if (!Array.isArray(ProductPricingHistoryData)) {
      throw new Error('Invalid data type for Product Pricing History');
    }
    console.log(`Fetched ${ProductPricingHistoryData.length} Product Pricing History records`);
    return { success: true, data: ProductPricingHistoryData };
  } catch (err) {
    const msg = `Failed to fetch Product Pricing History: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Product Pricing History to local schema (EXACT same mapping as your code)
 */
const mapProductPricingHistoryToLocalSchema = (ProductPricingHistoryData = []) =>
  (ProductPricingHistoryData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    PTD_PTSS__c: item.PTD_PTSS__c ?? 0,
    PTR__c: item.PTR__c ?? 0,
    Condition_type__c: item.Condition_type__c ?? '',
    Division__c: item.Division__c ?? '',
    Distribution_Channel__c: item.Distribution_Channel__c ?? '',
    Customer_Group__c: item.Customer_Group__c ?? '',
    Customer_Price_Group__c: item.Customer_Price_Group__c ?? '',
    IsActive__c: item.IsActive__c ?? false,
    Valid_From__c: item.Valid_From__c ?? '',
    Valid_To__c: item.Valid_To__c ?? '',
    Fraction__c: item.Product__r?.Fraction__r?.Id ?? '',
    Amount__c: item.Amount__c ?? 0,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Product Pricing History into local database
 */
const insertProductPricingHistoryToDb = async (cleanedProductPricingHistoryPayload) => {
  if (cleanedProductPricingHistoryPayload.length === 0) {
    console.log('⚠️ No Product Pricing History records to insert');
    return { success: true };
  }

  const pricingHistoryInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Product_Pricing_History__c',
        Type: 'insert',
        data: cleanedProductPricingHistoryPayload,
      }),
    `Insert ${cleanedProductPricingHistoryPayload.length} Product Pricing History records`
  );

  if (!pricingHistoryInsertResult.success) {
    const msg = 'Failed to insert Product Pricing History into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getProductPricingHistoryHNT = async ({ creds, apiFetch }) => {
  try {
    // Step 1: Fetch from API
    const apiResult = await fetchProductPricingHistoryFromApi({ creds, apiFetch });
    if (!apiResult.success) {
      return { success: false, status: 'error', message: apiResult.message };
    }

    // Step 2: Map to local schema
    const cleanedProductPricingHistoryPayload = mapProductPricingHistoryToLocalSchema(apiResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertProductPricingHistoryToDb(cleanedProductPricingHistoryPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedProductPricingHistoryPayload.length} Product Pricing History records`,
      data: { count: cleanedProductPricingHistoryPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getProductPricingHistoryHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
