// auth/GetAndStoreData/getFormTemplateAssignment.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation, safeProgress } from '../syncUtils';

/**
 * Form Template query
 */
const buildFormTemplateAssignmentQuery = (loggedInUser) => `
 SELECT Id, Name, Form_Template__c, Assigned_To__c FROM Form_Template_Assignment__c where Active__c = true AND Assigned_To__c = '${loggedInUser?.Sf_Id}'
`;

/**
 * Fetch Form Templates from Salesforce
 */
const fetchFormTemplateAssignmentData = async ({ fetchRecords, accessToken, instanceUrl, onProgress, loggedInUser }) => {
  safeProgress && safeProgress('Step 14/15: Fetching Forms & Questions...', onProgress);

  const FormTemplateAssignmentQuery = buildFormTemplateAssignmentQuery(loggedInUser);
  // console.log('FormTemplateAssignmentQuery',FormTemplateAssignmentQuery)
  try {
    const FormTemplateAssignmentData = await fetchRecords('Form_Template_Assignment__c', FormTemplateAssignmentQuery, accessToken, instanceUrl);
    if (!Array.isArray(FormTemplateAssignmentData)) {
      throw new Error('Invalid data type for Form Templates');
    }
    console.log(`Fetched ${FormTemplateAssignmentData.length} Form Templates`);
    return { success: true, data: FormTemplateAssignmentData };
  } catch (err) {
    const msg = `Failed to fetch Form Templates: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Form Templates to local schema (EXACT same mapping as your code)
 */
const mapFormTemplatesToLocalSchema = (FormTemplateAssignmentData = []) =>
  (FormTemplateAssignmentData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Form_Template__c: item.Form_Template__c ?? '',
    Assigned_To__c: item.Assigned_To__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Form Templates into local database
 */
const insertFormTemplatesToDb = async (cleanedFormTemplatePayload) => {
  if (cleanedFormTemplatePayload.length === 0) {
    console.log('⚠️ No Form Templates to insert');
    return { success: true };
  }

  const formInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Form_Template_Assignment__c',
        Type: 'insert',
        data: cleanedFormTemplatePayload,
      }),
    `Insert ${cleanedFormTemplatePayload.length} Form Templates`
  );

  if (!formInsertResult.success) {
    const msg = 'Failed to insert Form Templates into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getFormTemplateAssignment = async ({ fetchRecords, accessToken, instanceUrl, onProgress, loggedInUser }) => {
  try {
    // Step 1: Fetch Form Templates
    const fetchResult = await fetchFormTemplateAssignmentData({ fetchRecords, accessToken, instanceUrl, onProgress, loggedInUser });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedFormTemplatePayload = mapFormTemplatesToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertFormTemplatesToDb(cleanedFormTemplatePayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedFormTemplatePayload.length} Form Templates`,
      data: { count: cleanedFormTemplatePayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getFormTemplate: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
