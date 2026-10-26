// auth/GetAndStoreData/getSalaryAcknowledgementSR.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Salary_Acknowledgement__c query
 */
const buildSalaryAcknowledgementQuery = (loggedInUser) => `
  SELECT Id, Submitted_Date__c, Month__c,Claim_Generated__c, Description__c, Year__c, Amount__c, DB_Name__c, Assigned_To__c
  FROM Salary_Acknowledgement__c WHERE Assigned_To__c='${loggedInUser?.Sf_Id}' AND CreatedDate >= LAST_N_MONTHS:2
`;

/**
 * Fetch Salary_Acknowledgement__c from Salesforce
 */
const fetchSalaryAcknowledgementData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  const salaryQuery = buildSalaryAcknowledgementQuery(loggedInUser);
  // console.log('🔍 Fetching Salary_Acknowledgement__c with query:', salaryQuery);

  try {
    const salaryData = await fetchRecords(
      'Salary_Acknowledgement__c',
      salaryQuery,
      accessToken,
      instanceUrl
    );

    if (!Array.isArray(salaryData)) {
      throw new Error('Invalid data type for Salary_Acknowledgement__c');
    }

    console.log(`Fetched ${salaryData.length} Salary_Acknowledgement__c records`);
    return { success: true, data: salaryData };
  } catch (err) {
    const msg = `Failed to fetch Salary_Acknowledgement__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Salary_Acknowledgement__c to local schema
 */
const mapSalaryAcknowledgementToLocalSchema = (salaryData = []) =>
  (salaryData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Submitted_Date__c: item.Submitted_Date__c ?? null,
    Month__c: item.Month__c ?? '',
    Description__c: item.Description__c ?? '',
    Claim_Generated__c: item.Claim_Generated__c ?? false,
    Year__c: item.Year__c ?? '',
    Amount__c: item.Amount__c ?? 0,
    DB_Name__c: item.DB_Name__c ?? '',
    Assigned_To__c: item.Assigned_To__c ?? '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Salary_Acknowledgement__c into local database
 */
const insertSalaryAcknowledgementToDb = async cleanedSalaryPayload => {
  if (!cleanedSalaryPayload.length) {
    console.log('⚠️ No Salary_Acknowledgement__c records to insert');
    return { success: true };
  }

  const salaryInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Salary_Acknowledgement__c',
        Type: 'insert',
        data: cleanedSalaryPayload,
      }),
    `Insert ${cleanedSalaryPayload.length} Salary_Acknowledgement__c records`
  );

  if (!salaryInsertResult.success) {
    const msg = 'Failed to insert Salary_Acknowledgement__c into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSalaryAcknowledgementSR = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: fetch from SF
    const fetchResult = await fetchSalaryAcknowledgementData({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: map to local schema
    const cleanedSalaryPayload = mapSalaryAcknowledgementToLocalSchema(fetchResult.data);

    // Step 3: insert into local DB
    const insertResult = await insertSalaryAcknowledgementToDb(cleanedSalaryPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedSalaryPayload.length} Salary_Acknowledgement__c records`,
      data: { count: cleanedSalaryPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSalaryAcknowledgementSR: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
