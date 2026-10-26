// auth/GetAndStoreData/getBeatMaster.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

// 1. Build query
const buildBeatQuery = () =>
  'SELECT Id, Name, BeatCode__c, Beat_Status__c FROM Beat__c';

// 2. Fetch Beat master from SF
const fetchBeatData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const fieldNamesBeat = buildBeatQuery();

  try {
    const beatRecords = await fetchRecords('Beat__c', fieldNamesBeat, accessToken, instanceUrl);
    if (!Array.isArray(beatRecords)) {
      throw new Error('fetchRecords returned invalid data type for Beat master');
    }
    console.log(`Fetched ${beatRecords.length} Beat records`);
    return { success: true, data: beatRecords };
  } catch (err) {
    const msg = `Failed to fetch Beat master data: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

// 3. Map to local schema (EXACT same mapping as your code)
const mapBeatToLocalSchema = (beatRecords = []) =>
  beatRecords.map(item => ({
    Sf_Id: item.Id,
    Name: item.Name || '',
    Beat_Status__c: item.Beat_Status__c || '',
    VisitFrequency__c: null,
    BeatCode__c: item?.BeatCode__c || '',
    DirectDBSubDB__c: null,
    SR_TSI_ASO_Name__c: null,
    is_locally_changed: false,
    operation_type: 'insert',
    last_modified: Date.now(),
    is_synced: true,
  }));

// 4. Insert into local DB
const insertBeatToDb = async (BeatcleanedData) => {
  const beatInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Beat__c',
        Type: 'insert',
        data: BeatcleanedData,
      }),
    `Insert ${BeatcleanedData.length} Beat records`
  );

  if (!beatInsertResult.success) {
    const msg = 'Failed to insert Beat master data into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

// 5. Main exported function
export const getBeatMaster = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: fetch
    const fetchResult = await fetchBeatData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: map
    const BeatcleanedData = mapBeatToLocalSchema(fetchResult.data);

    // Step 3: insert
    const insertResult = await insertBeatToDb(BeatcleanedData);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${BeatcleanedData.length} Beat records`,
      data: { count: BeatcleanedData.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getBeatMaster: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
