// auth/GetAndStoreData/getMTExceptionMT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * MT_Exception__c query
 */
const buildMTExceptionQuery = () => `
  SELECT Id, Name, Category__c, ExceptionDate__c, IssueType__c, Location__c,
         Retailer__c, Merchandiser__c, Product__c, Remarks__c, Status__c, Image__c
  FROM MT_Exception__c WHERE CreatedDate >= LAST_N_MONTHS:2
`;

/**
 * Fetch MT_Exception__c from Salesforce
 */
const fetchMTExceptionData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const mtExceptionQuery = buildMTExceptionQuery();

  try {
    const MTExceptionData = await fetchRecords('MT_Exception__c', mtExceptionQuery, accessToken, instanceUrl);
    if (!Array.isArray(MTExceptionData)) {
      throw new Error('Invalid data type for MT Exception');
    }
    console.log(`Fetched ${MTExceptionData.length} MT Exception records`);
    return { success: true, data: MTExceptionData };
  } catch (err) {
    const msg = `Failed to fetch MT Exception: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map MT_Exception__c to local schema (EXACT same mapping as your code)
 */
const mapMTExceptionToLocalSchema = (MTExceptionData = []) =>
  (MTExceptionData || []).map(item => ({
    Sf_Id: item?.Id ?? '',
    Name: item?.Name ?? '',
    Category__c: item?.Category__c ?? '',
    ExceptionDate__c: item?.ExceptionDate__c ?? '',
    IssueType__c: item?.IssueType__c ?? '',
    Location__c: item?.Location__c ?? '',
    Retailer__c: item?.Retailer__c ?? '',
    Merchandiser__c: item?.Merchandiser__c ?? '',
    Product__c: item?.Product__c ?? '',
    Remarks__c: item?.Remarks__c ?? '',
    Status__c: item?.Status__c ?? '',
    Image__c: item?.Image__c ?? '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert MT_Exception__c into local database
 */
const insertMTExceptionToDb = async (cleanedMTExceptionPayload) => {
  if (cleanedMTExceptionPayload.length === 0) {
    console.log('⚠️ No MT Exception records to insert');
    return { success: true };
  }

  const mtExceptionInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'MT_Exception__c',
        Type: 'insert',
        data: cleanedMTExceptionPayload,
      }),
    `Insert ${cleanedMTExceptionPayload.length} MT Exception records`
  );

  if (!mtExceptionInsertResult.success) {
    const msg = 'Failed to insert MT Exception into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getMTExceptionMT = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch MT_Exception__c
    const fetchResult = await fetchMTExceptionData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedMTExceptionPayload = mapMTExceptionToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertMTExceptionToDb(cleanedMTExceptionPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedMTExceptionPayload.length} MT Exception records`,
      data: { count: cleanedMTExceptionPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getMTExceptionMT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
