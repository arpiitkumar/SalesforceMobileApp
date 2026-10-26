// auth/GetAndStoreData/getLineProductMappingHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

// 1. SOQL query
const buildLineProductQuery = () => `
  SELECT Id, Line__c, Category__c, Sub_Category__c
  FROM Line_Product_Mapping__c
`;

// 2. Fetch from Salesforce
const fetchLineProductData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const lineProductQuery = buildLineProductQuery();

  try {
    const LineProductData = await fetchRecords(
      'Line_Product_Mapping__c',
      lineProductQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(LineProductData)) {
      throw new Error('Invalid data type for Line Product Mapping');
    }
    console.log(`Fetched ${LineProductData.length} Line Product Mapping records`);
    return { success: true, data: LineProductData };
  } catch (err) {
    const msg = `Failed to fetch Line Product Mapping: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

// 3. Map to local schema (same mapping as your code)
const mapLineProductToLocalSchema = (LineProductData = []) =>
  (LineProductData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Line__c: item.Line__c ?? '',
    Category__c: item.Category__c ?? '',
    Sub_Category__c: item.Sub_Category__c ?? '',
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

// 4. Insert into local DB
const insertLineProductToDb = async cleanedLineProductPayload => {
  if (!cleanedLineProductPayload.length) {
    console.log('⚠️ No Line Product Mapping records to insert');
    return { success: true };
  }

  const lineProductInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Line_Product_Mapping__c',
        Type: 'insert',
        data: cleanedLineProductPayload,
      }),
    `Insert ${cleanedLineProductPayload.length} Line Product Mapping records`
  );

  if (!lineProductInsertResult.success) {
    const msg = 'Failed to insert Line Product Mapping into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

// 5. Main exported function
export const getLineProductMappingHNT = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  try {
    // Step 1: fetch
    const fetchResult = await fetchLineProductData({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: map
    const cleanedLineProductPayload = mapLineProductToLocalSchema(
      fetchResult.data
    );

    // Step 3: insert
    const insertResult = await insertLineProductToDb(cleanedLineProductPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedLineProductPayload.length} Line Product Mapping records`,
      data: { count: cleanedLineProductPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getLineProductMappingHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
