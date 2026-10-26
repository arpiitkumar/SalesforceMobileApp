// auth/GetAndStoreData/getPriorityHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Priority__c query using logged-in user
 */
const buildPriorityQuery = (loggedInUser) => `
  SELECT Id, Ranking__c, Category__c 
  FROM Priority__c 
  WHERE Priority_Configuration__r.User__c = '${loggedInUser.Sf_Id}'
`;

/**
 * Fetch Priority__c from Salesforce
 */
const fetchPriorityData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  const query_priority = buildPriorityQuery(loggedInUser);
  console.log('Priority Query:', query_priority);

  try {
    const data_priority = await fetchRecords('Priority__c', query_priority, accessToken, instanceUrl);
    if (!Array.isArray(data_priority)) {
      throw new Error('Invalid data type for Priority__c');
    }
    console.log(`Fetched ${data_priority.length} Priority__c records`);
    return { success: true, data: data_priority };
  } catch (err) {
    const msg = `Failed to fetch Priority__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Priority__c to local schema (EXACT same mapping as your code)
 */
const mapPriorityToLocalSchema = (data_priority = []) =>
  data_priority.map(item => ({
    Sf_Id: item.Id ?? '',
    Ranking__c: item.Ranking__c ?? '',
    Category__c: item.Category__c ?? '',

    // sync markers
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Priority__c into local database
 */
const insertPriorityToDb = async (cleanedPriorityPayload) => {
  const priorityInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Priority__c',
        Type: 'insert',
        data: cleanedPriorityPayload,
      }),
    `Insert ${cleanedPriorityPayload.length} Priority__c records`
  );

  if (!priorityInsertResult.success) {
    const msg = 'Failed to insert Priority__c records';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getPriorityHNT = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: Fetch Priority__c
    const fetchResult = await fetchPriorityData({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedPriorityPayload = mapPriorityToLocalSchema(fetchResult.data);

    // Step 3: Insert into database
    const insertResult = await insertPriorityToDb(cleanedPriorityPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPriorityPayload.length} Priority__c records`,
      data: { count: cleanedPriorityPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getPriorityHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
