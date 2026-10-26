// auth/GetAndStoreData/getPlantDepotRakeHTSO.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

// 1. SOQL query (active only)
const buildPlantDepotRakeQuery = () => `
  Select Id,name From PlantDepotRake__c Where (Type__c ='Depot' OR Type__c ='Plant') AND IsActive__c =true
`;

// 2. Fetch from Salesforce
const fetchPlantDepotRakeData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const PlantDepotRakeQuery = buildPlantDepotRakeQuery();

  try {
    const PlantDepotRakeData = await fetchRecords(
      'PlantDepotRake__c',
      PlantDepotRakeQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(PlantDepotRakeData)) {
      throw new Error('Invalid data type for PlantDepotRakeData');
    }
    console.log(`Fetched ${PlantDepotRakeData.length} PlantDepotRakeData records (HTSO)`);
    return { success: true, data: PlantDepotRakeData };
  } catch (err) {
    const msg = `Failed to fetch PlantDepotRakeData: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

// 3. Map to local schema
const mapPlantDepotRakeToLocalSchema = (PlantDepotRakeData = []) =>
  (PlantDepotRakeData || []).map(item => ({
    Sf_Id: item.Id,
    Name: item.Name || '',
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

// 4. Insert into local DB
const insertPlantDepotRakeToDb = async cleanedPlantDepotRakePayload => {
  if (!cleanedPlantDepotRakePayload.length) {
    console.log('⚠️ No PlantDepotRake records to insert (HTSO)');
    return { success: true };
  }

  const PlantDepotRakeResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'PlantDepotRake__c',
        Type: 'insert',
        data: cleanedPlantDepotRakePayload,
      }),
    `Insert ${cleanedPlantDepotRakePayload.length} PlantDepotRake   records (HTSO)`
  );

  if (!PlantDepotRakeResult.success) {
    const msg = 'Failed to insert PlantDepotRake into local database (HTSO)';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

// 5. Main exported function
export const getPlantDepotRakeHTSO = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchPlantDepotRakeData({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPlantDepotRakePayload = mapPlantDepotRakeToLocalSchema(
      fetchResult.data
    );

    const insertResult = await insertPlantDepotRakeToDb(
      cleanedPlantDepotRakePayload
    );
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPlantDepotRakePayload.length} PlantDepotRake records (HTSO)`,
      data: { count: cleanedPlantDepotRakePayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getPlantDepotRakeHTSO: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
