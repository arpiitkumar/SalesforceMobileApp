// auth/GetAndStoreData/getTemplateResponse.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Template_Response__c query
 */
const buildTemplateResponseQuery = (loggedInUser) => `
  SELECT Id, Visit__c, Visit__r.AccountId, CreatedById, Form_Template__c 
  FROM Template_Response__c 
  WHERE CreatedById = '${loggedInUser?.Sf_Id}' AND CreatedDate  >= LAST_N_MONTHS:1
`;

/**
 * Fetch Template_Response__c from Salesforce
 */
const fetchTemplateResponseData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  const query = buildTemplateResponseQuery(loggedInUser);
  try {
    const data = await fetchRecords('Template_Response__c', query, accessToken, instanceUrl);
    if (!Array.isArray(data)) {
      throw new Error('Invalid data type for Template_Response__c');
    }
    console.log(`Fetched ${data.length} Template_Response__c records`);
    return { success: true, data };
  } catch (err) {
    const msg = `Failed to fetch Template_Response__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Template_Response__c to local schema
 */
const mapTemplateResponseToLocalSchema = (data = []) =>
  (data || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Visit__c: item.Visit__c ?? '',
    AccountId: item.Visit__r?.AccountId ?? '',
    Form_Template__c: item.Form_Template__c ?? '',
    CreatedById: item.CreatedById ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Template_Response__c into local database
 */
const insertTemplateResponseToDb = async (payload) => {
  if (payload.length === 0) {
    console.log('⚠️ No Template_Response__c records to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Template_Response__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} Template_Response__c records`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Template_Response__c into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getTemplateResponse = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    const fetchResult = await fetchTemplateResponseData({ fetchRecords, accessToken, instanceUrl, loggedInUser });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const payload = mapTemplateResponseToLocalSchema(fetchResult.data);

    const insertResult = await insertTemplateResponseToDb(payload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${payload.length} Template Responses`,
      data: { count: payload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getTemplateResponse: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
