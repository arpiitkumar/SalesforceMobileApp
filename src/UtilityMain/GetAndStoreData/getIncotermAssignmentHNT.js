// auth/GetAndStoreData/getIncotermAssignmentHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Incoterm Assignment query for Vertical 40, Customer Groups 04/05
 */
const buildIncotermAssignmentQuery = () => `
  SELECT Id, Vertical__c, DistributorChannel__c, Customer_Group__c, Zone__c, Account__c
  FROM IncotermAssignment__c
  WHERE Vertical__c INCLUDES ('40') 
    AND (Customer_Group__c = '04' OR Customer_Group__c = '05') 
    AND Zone__c != NULL
`;

/**
 * Fetch Incoterm Assignment records from Salesforce
 */
const fetchIncotermAssignmentData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const IncotermAssignmentQuery = buildIncotermAssignmentQuery();

  try {
    const IncotermAssignmentData = await fetchRecords('IncotermAssignment__c', IncotermAssignmentQuery, accessToken, instanceUrl);
    if (!Array.isArray(IncotermAssignmentData)) {
      throw new Error('Invalid data type for Incoterm Assignment');
    }
    console.log(`Fetched ${IncotermAssignmentData.length} Incoterm Assignment records`);
    return { success: true, data: IncotermAssignmentData };
  } catch (err) {
    const msg = `Failed to fetch Incoterm Assignment: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Incoterm Assignment to local schema (EXACT same mapping as your code)
 */
const mapIncotermAssignmentToLocalSchema = (IncotermAssignmentData = []) =>
  (IncotermAssignmentData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Vertical__c: item.Vertical__c ?? '',
    DistributorChannel__c: item.DistributorChannel__c ?? '',
    Customer_Group__c: item.Customer_Group__c ?? '',
    Zone__c: item.Zone__c ?? '',
    Account__c: item.Account__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Incoterm Assignment into local database
 */
const insertIncotermAssignmentToDb = async (cleanedIncotermAssignmentPayload) => {
  if (cleanedIncotermAssignmentPayload.length === 0) {
    console.log('⚠️ No Incoterm Assignment records to insert');
    return { success: true };
  }

  const incotermInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'IncotermAssignment__c',
        Type: 'insert',
        data: cleanedIncotermAssignmentPayload,
      }),
    `Insert ${cleanedIncotermAssignmentPayload.length} Incoterm Assignment records`
  );

  if (!incotermInsertResult.success) {
    const msg = 'Failed to insert Incoterm Assignment into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getIncotermAssignmentHNT = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Incoterm Assignment records
    const fetchResult = await fetchIncotermAssignmentData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedIncotermAssignmentPayload = mapIncotermAssignmentToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertIncotermAssignmentToDb(cleanedIncotermAssignmentPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedIncotermAssignmentPayload.length} Incoterm Assignment records`,
      data: { count: cleanedIncotermAssignmentPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getIncotermAssignmentHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
