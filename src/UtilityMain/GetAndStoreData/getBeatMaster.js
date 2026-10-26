// auth/GetAndStoreData/getBeatMaster.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

// 1. Build query
// const buildBeatQuery = () =>
//   'SELECT Id, Name, BeatCode__c, Beat_Status__c FROM Beat__c';
const getSRIds = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  const isManagerRole = ['H_T_SO', 'MT_SO'].includes(loggedInUser?.DeveloperName);
  let srIds = [loggedInUser?.Sf_Id];
  if (isManagerRole) {
    const soUserQuery = `
      SELECT Id FROM User
      WHERE ManagerId = '${loggedInUser?.Sf_Id}' AND IsActive = true
    `;
    const soUsers = await fetchRecords('User', soUserQuery, accessToken, instanceUrl);
    if (Array.isArray(soUsers) && soUsers.length > 0) {
      const childIds = soUsers.map(u => u.Id);
      srIds = [...new Set([loggedInUser?.Sf_Id, ...childIds])];
    }
  }
  return srIds;
};

const fetchMappedDistributors = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser
}) => {

  const srIds = await getSRIds({
    fetchRecords,
    accessToken,
    instanceUrl,
    loggedInUser
  });
  const srFilter = srIds.map(id => `'${id}'`).join(',');
  const query = `
    SELECT Distributor__c 
    FROM Line_SR_Distributor_Mapping__c 
    WHERE SR__c IN (${srFilter})
  `;
  // console.log('🔥 Distributor Query:', query);
  const distributors = await fetchRecords(
    'Line_SR_Distributor_Mapping__c',
    query,
    accessToken,
    instanceUrl
  );
  if (!Array.isArray(distributors)) return [];
  return [...new Set(distributors.map(d => d.Distributor__c).filter(Boolean))];
};


// A Beat owns its distributor through Beat__c.Distributor__c.  Do not use
// SR_Beat_Assignment__c to discover these records: that object is not
// available for every user/profile and a failed assignment query leaves the
// local Beat cache without its distributor.
const getBeatIdsForUser = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser
}) => {
  const userId = loggedInUser?.Sf_Id;
  if (!userId) return [];

  const userBaQuery = `
    SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name
    FROM User_BA_Mapping__c
    WHERE User__c = '${userId}' AND Is_Active__c = true AND Status__c = 'Active'
 
  `;
  const userBaMappings = await fetchRecords(
    'User_BA_Mapping__c',
    userBaQuery,
    accessToken,
    instanceUrl
  );
  const accountIds = [...new Set(
    (Array.isArray(userBaMappings) ? userBaMappings : [])
      .map(item => item?.Account__c)
      .filter(Boolean)
  )];
  if (!accountIds.length) return [];

  const accountFilter = accountIds.map(id => `'${id}'`).join(',');
  const beatQuery = `
    SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c,
           Distributor__c, Distributor__r.Name
    FROM Beat__c
    WHERE Distributor__c IN (${accountFilter})
  `;
  const beats = await fetchRecords('Beat__c', beatQuery, accessToken, instanceUrl);
  return [...new Set(
    (Array.isArray(beats) ? beats : []).map(beat => beat?.Id).filter(Boolean)
  )];
};

const buildBeatQuery = (beatIds = []) => {
  if (!beatIds.length) return '';
  const formattedIds = beatIds.map(id => `'${id}'`).join(',');
  return `
    SELECT Id, Name, Beat_Status__c, Distributor__c FROM Beat__c
    WHERE Id IN (${formattedIds})
  `;
};

// 2. Fetch Beat master from SF
const fetchBeatData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {

  const beatIds = await getBeatIdsForUser({
    fetchRecords,
    accessToken,
    instanceUrl,
    loggedInUser
  });

  if (!beatIds.length) {
    console.log(' No Beat IDs found');
    return { success: true, data: [] };
  }

  const fieldNamesBeat = buildBeatQuery(beatIds);

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
    Distributor__c: item.Distributor__c || null,
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
export const getBeatMaster = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: fetch
    const fetchResult = await fetchBeatData({ fetchRecords, accessToken, instanceUrl, loggedInUser });
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
