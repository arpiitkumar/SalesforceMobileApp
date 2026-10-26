// auth/GetAndStoreData/getGrowthMappingEntryMT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Growth_Mapping_Entry__c query
 */
const buildGrowthMappingEntryQuery = () => `
  SELECT Id, CapturePhoto__c, Name, LocationIssue__c, ObservedPrice__c,
         Outlet_Name__c, PotentialVolume__c, Priority__c, Product__c,
         Remarks__c, SKU__c, Type__c, Units__c, CreatedDate
  FROM Growth_Mapping_Entry__c WHERE CreatedDate = THIS_MONTH
`;

/**
 * Fetch Growth_Mapping_Entry__c from Salesforce
 */
const fetchGrowthMappingEntryData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const growthMappingEntryQuery = buildGrowthMappingEntryQuery();

  try {
    const GrowthMappingEntryData = await fetchRecords(
      'Growth_Mapping_Entry__c',
      growthMappingEntryQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(GrowthMappingEntryData)) {
      throw new Error('Invalid data type for Growth Mapping Entry');
    }
    console.log(`Fetched ${GrowthMappingEntryData.length} Growth Mapping Entry records`);
    return { success: true, data: GrowthMappingEntryData };
  } catch (err) {
    const msg = `Failed to fetch Growth Mapping Entry: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Growth_Mapping_Entry__c to local schema (EXACT same mapping as your code)
 */
const mapGrowthMappingEntryToLocalSchema = (GrowthMappingEntryData = []) =>
  (GrowthMappingEntryData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    CapturePhoto__c: item.CapturePhoto__c ?? '',
    Name: item.Name ?? '',
    LocationIssue__c: item.LocationIssue__c ?? '',
    ObservedPrice__c: item.ObservedPrice__c ?? 0,
    Outlet_Name__c: item.Outlet_Name__c ?? '',
    PotentialVolume__c: item.PotentialVolume__c ?? 0,
    Priority__c: item.Priority__c ?? '',
    Product__c: item.Product__c ?? '',
    Remarks__c: item.Remarks__c ?? '',
    SKU__c: item.SKU__c ?? '',
    Type__c: item.Type__c ?? '',
    Units__c: item.Units__c ?? '',
    // CreatedDate: item.CreatedDate ?? '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Growth_Mapping_Entry__c into local database
 */
const insertGrowthMappingEntryToDb = async (cleanedGrowthMappingEntryPayload) => {
  if (cleanedGrowthMappingEntryPayload.length === 0) {
    console.log('⚠️ No Growth Mapping Entry records to insert');
    return { success: true };
  }

  const growthMappingInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Growth_Mapping_Entry__c',
        Type: 'insert',
        data: cleanedGrowthMappingEntryPayload,
      }),
    `Insert ${cleanedGrowthMappingEntryPayload.length} Growth Mapping Entry records`
  );

  if (!growthMappingInsertResult.success) {
    const msg = 'Failed to insert Growth Mapping Entry into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getGrowthMappingEntryMT = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Growth_Mapping_Entry__c
    const fetchResult = await fetchGrowthMappingEntryData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedGrowthMappingEntryPayload = mapGrowthMappingEntryToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertGrowthMappingEntryToDb(cleanedGrowthMappingEntryPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedGrowthMappingEntryPayload.length} Growth Mapping Entry records`,
      data: { count: cleanedGrowthMappingEntryPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getGrowthMappingEntryMT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
