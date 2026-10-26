// auth/GetAndStoreData/getRecommendedProductsHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Recommended_Product__c query using logged-in user SR
 */
const buildRecommendedQuery = (loggedInUser) => `
  SELECT Id, Customer__c, Type__c, Must_Sell_Products__c, OverDue_Products__c,New_Launch_Product__c,
         Top_Sell_Products__c, Scheme_Pitch__c 
  FROM Recommended_Product__c 
  WHERE SR__c = '${loggedInUser.Sf_Id}'
`;

/**
 * Fetch Recommended_Product__c from Salesforce
 */
const fetchRecommendedData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  const query_recommended = buildRecommendedQuery(loggedInUser);

  try {
    const data_recommended = await fetchRecords('Recommended_Product__c', query_recommended, accessToken, instanceUrl);
    if (!Array.isArray(data_recommended)) {
      throw new Error('Invalid data type for Recommended_Product__c');
    }
    console.log(`Fetched ${data_recommended.length} Recommended_Product__c records`);
    return { success: true, data: data_recommended };
  } catch (err) {
    const msg = `Failed to fetch Recommended_Product__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Recommended_Product__c to local schema (EXACT same mapping as your code)
 */
const mapRecommendedToLocalSchema = (data_recommended = []) =>
  data_recommended.map(item => ({
    Sf_Id: item.Id ?? '',
    Customer__c: item.Customer__c ?? '',
    Type__c: item.Type__c ?? '',
    Must_Sell_Products__c: item.Must_Sell_Products__c ?? '',
    OverDue_Products__c: item.OverDue_Products__c ?? '',
    Top_Sell_Products__c: item.Top_Sell_Products__c ?? '',
    Scheme_Pitch__c: item.Scheme_Pitch__c ?? '',
    New_Launch_Product__c: item.New_Launch_Product__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Recommended_Product__c into local database
 */
const insertRecommendedToDb = async (cleanedRecommendedPayload) => {
  const recommendedInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Recommended_Product__c',
        Type: 'insert',
        data: cleanedRecommendedPayload,
      }),
    `Insert ${cleanedRecommendedPayload.length} Recommended_Product__c records`
  );

  if (!recommendedInsertResult.success) {
    const msg = 'Failed to insert Recommended_Product__c records';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getRecommendedProductsHNT = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: Fetch Recommended_Product__c
    const fetchResult = await fetchRecommendedData({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedRecommendedPayload = mapRecommendedToLocalSchema(fetchResult.data);

    // Step 3: Insert into database
    const insertResult = await insertRecommendedToDb(cleanedRecommendedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedRecommendedPayload.length} Recommended_Product__c records`,
      data: { count: cleanedRecommendedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getRecommendedProductsHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
