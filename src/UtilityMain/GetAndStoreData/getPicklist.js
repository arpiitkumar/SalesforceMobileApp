import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';
import { loadDynamicConfig } from '../../../config';

/**
 * Generate random ID for picklist record
 */
const generateRandomId = (length = 14) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomId = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomId += characters[randomIndex];
  }
  return randomId;
};

/**
 * Fetch picklist options from API
 */
const fetchPicklistFromApi = async ({ creds, apiFetch, accessToken, instanceUrl }) => {
  const payload = { userId: creds?.userId };
  const token = creds?.accessToken || accessToken;
  const url = creds?.instanceUrl || instanceUrl;

  try {
    const response = await apiFetch('POST', 'recordType', payload, 'Custom', token, url);
    return { success: true, data: response };
  } catch (err) {
    const msg = `Failed to fetch picklist options: ${err.message}`;
    console.warn(msg);
    return { success: false, message: msg };
  }
};

/**
 * Fetch Secondary Order RecordTypeId from Salesforce
 */
const fetchSecondaryOrderRecordTypeId = async ({ creds, apiFetch, fetchRecords, accessToken, instanceUrl }) => {
  const token = creds?.accessToken || accessToken;
  const url = creds?.instanceUrl || instanceUrl;
  const soql = "SELECT Id, Name, SobjectType FROM RecordType WHERE Name = 'Secondary' AND SobjectType = 'Order__c' LIMIT 1";

  try {
    if (typeof fetchRecords === 'function') {
      const records = await fetchRecords('RecordType', soql, token, url);
      if (Array.isArray(records) && records.length > 0 && records[0]?.Id) {
        console.log("✅ [getPicklist] Fetched Secondary Order RecordTypeId via fetchRecords:", records[0].Id);
        return records[0].Id;
      }
    }
  } catch (e) {
    console.warn("⚠️ [getPicklist] fetchRecords for RecordType failed, falling back to apiFetch:", e);
  }

  try {
    if (typeof apiFetch === 'function') {
      const queryUrl = `query/?q=${encodeURIComponent(soql)}`;
      const queryResponse = await apiFetch('GET', queryUrl, {}, 'SObjects', token, url);
      if (queryResponse?.status === 'success' && queryResponse.data?.records?.length > 0) {
        const id = queryResponse.data.records[0].Id;
        console.log("✅ [getPicklist] Fetched Secondary Order RecordTypeId via apiFetch:", id);
        return id;
      }
    }
  } catch (e) {
    console.warn("⚠️ [getPicklist] apiFetch for RecordType query failed:", e);
  }

  return null;
};

/**
 * Transform API response to local schema
 */
const transformPicklistData = (response, secondaryOrderRecordTypeId) => {
  let recordTypeData = response?.data?.responseBody?.recordTypeData;
  if (!recordTypeData || typeof recordTypeData !== 'object') {
    recordTypeData = {};
  }
  if (secondaryOrderRecordTypeId) {
    recordTypeData.orderRecordTypeId = secondaryOrderRecordTypeId;
    console.log("ℹ️ [getPicklist] Set orderRecordTypeId in recordTypeData:", secondaryOrderRecordTypeId);
  }

  const cleanedPicklistPayload = {
    Sf_Id: generateRandomId(),
    OptionsData: JSON.stringify(recordTypeData),
    DependentOptionsData: JSON.stringify(response?.data?.responseBody?.dependentPicklists || {}) || "",
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  };
  return cleanedPicklistPayload;
};

/**
 * Insert picklist data into local database
 */
const insertPicklistToDb = async (cleanedPicklistPayload) => {
  const picklistInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'AllDataPicklist',
        Type: 'insert',
        data: cleanedPicklistPayload,
      }),
    'Insert picklist options'
  );

  if (!picklistInsertResult.success) {
    const msg = 'Failed to insert picklist options into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getPicklist = async ({ creds, apiFetch, fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch picklist from custom endpoint (if available)
    let response = null;
    if (typeof apiFetch === 'function') {
      const apiResult = await fetchPicklistFromApi({ creds, apiFetch, accessToken, instanceUrl });
      if (apiResult?.success && apiResult?.data?.status === 'success') {
        response = apiResult.data;
      }
    }

    // Step 2: Fetch Secondary Order RecordTypeId from Salesforce
    const secondaryOrderRecordTypeId = await fetchSecondaryOrderRecordTypeId({
      creds,
      apiFetch,
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    // Step 3: Transform payload
    const cleanedPicklistPayload = transformPicklistData(response, secondaryOrderRecordTypeId);

    // Step 4: Insert into local database
    const insertResult = await insertPicklistToDb(cleanedPicklistPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    // Step 5: Refresh in-memory dynamic config
    try {
      await loadDynamicConfig();
    } catch (e) {
      console.warn("⚠️ [getPicklist] Failed to reload dynamic config:", e);
    }

    return {
      success: true,
      status: 'ok',
      message: 'Synced picklist and RecordType options successfully',
      data: { count: 1, secondaryOrderRecordTypeId },
    };
  } catch (err) {
    const msg = `Error syncing picklist options: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};

