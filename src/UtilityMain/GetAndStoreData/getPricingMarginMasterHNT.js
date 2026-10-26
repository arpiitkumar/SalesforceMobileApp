// auth/GetAndStoreData/getPricingMarginMasterHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

const fetchPricingMarginFromApi = async ({ creds, apiFetch }) => {
  try {
    const userId = creds.userId;
    const payload = { userId };
    const response = await apiFetch(
      'POST',
      'recordType',
      payload,
      'Custom',
      creds.accessToken,
      creds.instanceUrl
    );

    const data_pricing = response.data?.responseBody?.marginList;
    if (!Array.isArray(data_pricing)) {
      throw new Error('Invalid data type for Pricing_Margin_Master__c');
    }
    console.log(
      `Fetched ${data_pricing.length} Pricing_Margin_Master__c records`
    );
    return { success: true, data: data_pricing };
  } catch (err) {
    const msg = `Failed to fetch Pricing_Margin_Master__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

const mapPricingMarginToLocalSchema = (data_pricing = []) =>
  data_pricing.map(item => ({
    Sf_Id: item.Id ?? '',
    Category__c: item.Category__c ?? '',
    Price_Group__c: item.Price_Group__c ?? '',
    Direct__c: item.Direct__c ?? '',
    Super__c: item.Super__c ?? '',
    Sub_DB__c: item.Sub_DB__c ?? '',
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

const insertPricingMarginToDb = async cleanedPricingPayload => {
  const pricingInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Pricing_Margin_Master__c',
        Type: 'insert',
        data: cleanedPricingPayload,
      }),
    `Insert ${cleanedPricingPayload.length} Pricing_Margin_Master__c records`
  );

  if (!pricingInsertResult.success) {
    const msg =
      'Failed to insert Pricing_Margin_Master__c records into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

export const getPricingMarginMasterHNT = async ({ creds, apiFetch }) => {
  try {
    const apiResult = await fetchPricingMarginFromApi({ creds, apiFetch });
    if (!apiResult.success) {
      return { success: false, status: 'error', message: apiResult.message };
    }

    const cleanedPricingPayload = mapPricingMarginToLocalSchema(apiResult.data);

    const insertResult = await insertPricingMarginToDb(cleanedPricingPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPricingPayload.length} Pricing_Margin_Master__c records`,
      data: { count: cleanedPricingPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getPricingMarginMasterHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
