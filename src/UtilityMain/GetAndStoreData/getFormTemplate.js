// auth/GetAndStoreData/getFormTemplate.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation, safeProgress } from '../syncUtils';

/**
 * Form Template query
 */
const buildFormTemplateQuery = () => `
 SELECT Id, Name, Form_Type__c, Status__c, Applicable_Personas__c, Target_Entity__c FROM Form_Template__c where Status__c='Active'
`;

/**
 * Fetch Form Templates from Salesforce
 */
const fetchFormTemplateData = async ({ fetchRecords, accessToken, instanceUrl, onProgress }) => {
  safeProgress && safeProgress('Step 14/15: Fetching Forms & Questions...', onProgress);

  const Form_TemplateQuery = buildFormTemplateQuery();

  try {
    const FormTemplateData = await fetchRecords('Form_Template__c', Form_TemplateQuery, accessToken, instanceUrl);
    if (!Array.isArray(FormTemplateData)) {
      throw new Error('Invalid data type for Form Templates');
    }
    console.log(`Fetched ${FormTemplateData.length} Form Templates`);
    return { success: true, data: FormTemplateData };
  } catch (err) {
    const msg = `Failed to fetch Form Templates: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Form Templates to local schema (EXACT same mapping as your code)
 */
const mapFormTemplatesToLocalSchema = (FormTemplateData = []) =>
  (FormTemplateData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Form_Type__c: item.Form_Type__c ?? '',
    Status__c: item.Status__c ?? '',
    Activity__c: item.Activity__c ?? '',
    RecordTypeId: item.RecordTypeId ?? '',
    Applicable_Personas__c: item.Applicable_Personas__c ?? '',
    Target_Entity__c: item.Target_Entity__c ?? '',

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
        ObjectName: 'Form_Template__c',
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
export const getFormTemplate = async ({ fetchRecords, accessToken, instanceUrl, onProgress }) => {
  try {
    // Step 1: Fetch Form Templates
    const fetchResult = await fetchFormTemplateData({ fetchRecords, accessToken, instanceUrl, onProgress });
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
