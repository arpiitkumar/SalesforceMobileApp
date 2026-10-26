// auth/GetAndStoreData/getGeographyHTSO.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Geography__c query for District/State (HTSO)
 */
const buildGeographyQuery = () => `
  SELECT Id, Name, RecordType.DeveloperName, ParentGeography__c, ParentGeography__r.Name
  FROM Geography__c
  WHERE RecordType.DeveloperName = 'District' OR RecordType.DeveloperName = 'State'
  ORDER BY Name
`;

/**
 * Fetch Geography__c from Salesforce
 */
const fetchGeographyData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const geographyQuery = buildGeographyQuery();

  try {
    const GeographyData = await fetchRecords(
      'Geography__c',
      geographyQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(GeographyData)) {
      throw new Error('Invalid data type for Geography');
    }
    console.log(`🌍 Fetched ${GeographyData.length} Geography records`);
    return { success: true, data: GeographyData };
  } catch (err) {
    const msg = `Failed to fetch Geography data: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Geography__c to local schema (EXACT same mapping as your code)
 */
const mapGeographyToLocalSchema = (GeographyData = []) =>
  (GeographyData || []).map(item => ({
    Sf_Id: item.Id,
    Name: item.Name || '',
    DeveloperName: item.RecordType?.DeveloperName || '',
    ParentGeography__c: item.ParentGeography__c || '',
    ParentGeography_Name: item.ParentGeography__r?.Name || '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Geography__c into local database
 */
const insertGeographyToDb = async (cleanedGeographyPayload) => {
  if (cleanedGeographyPayload.length === 0) {
    console.log('⚠️ No Geography records to insert');
    return { success: true };
  }

  const geographyInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Geography__c',
        Type: 'insert',
        data: cleanedGeographyPayload,
      }),
    `Insert ${cleanedGeographyPayload.length} Geography records`
  );

  if (!geographyInsertResult.success) {
    const msg = 'Failed to insert Geography into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getGeographyHTSO = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Geography__c
    const fetchResult = await fetchGeographyData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedGeographyPayload = mapGeographyToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertGeographyToDb(cleanedGeographyPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedGeographyPayload.length} Geography records`,
      data: { count: cleanedGeographyPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getGeographyHTSO: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
