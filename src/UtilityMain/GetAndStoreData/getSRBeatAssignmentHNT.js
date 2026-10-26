// auth/GetAndStoreData/getSRBeatAssignmentHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
* SR_Beat_Assignment__c query with relationship fields
*/
// const buildBeatAssignmentQuery = (loggedInUser) => `
//   SELECT Id, Beat__c, Distributor__c, Distributor__r.Name, Distributor__r.PartyCode__c, Assigned_To__c,
//          Sales_Person_ManagerId__c, isActive__c, Sales_Representative__r.Name,
//          Beat__r.Name, Sales_Representative__r.User_Type__c
//   FROM SR_Beat_Assignment__c
// `;

const fetchMappedDistributors = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
}) => {
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
  // 👉 Step 2: dynamic filter banao
  const srFilter = srIds.map(id => `'${id}'`).join(',');
  const query = `
    SELECT Distributor__c 
    FROM Line_SR_Distributor_Mapping__c 
    WHERE SR__c IN (${srFilter})
  `;
  console.log('Distributor Mapping Query:', query);
  const distributors = await fetchRecords(
    'Line_SR_Distributor_Mapping__c',
    query,
    accessToken,
    instanceUrl
  );
  if (!Array.isArray(distributors)) return [];
  return [...new Set(distributors.map(d => d.Distributor__c).filter(Boolean))];
};

const buildBeatAssignmentQuery = async ({
  loggedInUser,
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  const isManagerRole = ['H_T_SO', 'MT_SO'].includes(loggedInUser?.DeveloperName);
  // 👉 SR case (same as before)
  if (!isManagerRole) {
    return `
      SELECT Id, Beat__c, Distributor__c, Distributor__r.Name, Distributor__r.PartyCode__c,
             Assigned_To__c, Sales_Person_ManagerId__c, isActive__c,
             Sales_Representative__r.Name, Beat__r.Name, Sales_Representative__r.User_Type__c
      FROM SR_Beat_Assignment__c
      WHERE Assigned_To__c = '${loggedInUser?.Sf_Id}'
    `;
  }
  // 👉 SO case
  const distributorIds = await fetchMappedDistributors({
    fetchRecords,
    accessToken,
    instanceUrl,
    loggedInUser,
  });
  let distributorCondition = '';
  if (distributorIds.length > 0) {
    const distributorList = distributorIds.map(id => `'${id}'`).join(',');
    distributorCondition = `OR Distributor__c IN (${distributorList})`;
  }
  return `
    SELECT Id, Beat__c, Distributor__c, Distributor__r.Name, Distributor__r.PartyCode__c,
           Assigned_To__c, Sales_Person_ManagerId__c, isActive__c,
           Sales_Representative__r.Name, Beat__r.Name, Sales_Representative__r.User_Type__c
    FROM SR_Beat_Assignment__c
    WHERE 
    (
      Sales_Person_ManagerId__c = '${loggedInUser?.Sf_Id}'
      ${distributorCondition}
    )
  `;
};

/**
* Fetch SR_Beat_Assignment__c from Salesforce
*/
const fetchBeatAssignmentData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  const beatAssignmentQuery = await buildBeatAssignmentQuery({
    loggedInUser,
    fetchRecords,
    accessToken,
    instanceUrl
  });
  console.log('beatAssignmentQuery', beatAssignmentQuery)
  try {
    const data_beatAssignments = await fetchRecords(
      'SR_Beat_Assignment__c',
      beatAssignmentQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(data_beatAssignments)) {
      throw new Error('Invalid data type for SR_Beat_Assignment__c');
    }
    console.log(`Fetched ${data_beatAssignments.length} SR_Beat_Assignment__c records`);

    // console.log('Sample SR_Beat_Assignment__c Record:', JSON.stringify(data_beatAssignments));

    // Debug logs (EXACT same as your code)
    // data_beatAssignments.forEach(i => {
    //   if (!i.Distributor__r) console.log("Distributor__r missing for:", i.Id);
    //   if (!i.Beat__r) console.log("Beat__r missing for:", i.Id);
    //   if (!i.Sales_Representative__r) console.log("SR__r missing for:", i.Id);
    // });

    return { success: true, data: data_beatAssignments };
  } catch (err) {
    const msg = `Failed to fetch SR_Beat_Assignment__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
* Map SR_Beat_Assignment__c to local schema (EXACT same mapping as your code)
*/
const mapBeatAssignmentsToLocalSchema = (data_beatAssignments = []) =>
  data_beatAssignments.map(item => ({
    Sf_Id: item?.Id ?? '',
    Beat__c: item?.Beat__c ?? '',
    Distributor__c: item?.Distributor__c ?? '',
    Name: item?.Distributor__r?.Name ?? '',
    PartyCode__c: item?.Distributor__r?.PartyCode__c ?? '',
    Assigned_To__c: item?.Assigned_To__c ?? '',
    isActive__c: item?.isActive__c ?? '',
    BeatName: item?.Beat__r?.Name ?? '',
    SalesRepresentativeName: item?.Sales_Representative__r?.Name ?? '',
    Sales_Person_ManagerId__c: item?.Sales_Person_ManagerId__c ?? '',
    SRDeveloperRole: item?.Sales_Representative__r?.User_Type__c ?? '',

    // local flags
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
    SoftDelete: false,
  }));

/**
* Insert SR_Beat_Assignment__c into local database
*/
const insertBeatAssignmentsToDb = async (cleanedBeatAssignmentPayload) => {
  const beatAssignmentInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'SR_Beat_Assignment__c',
        Type: 'insert',
        data: cleanedBeatAssignmentPayload,
      }),
    `Insert ${cleanedBeatAssignmentPayload.length} SR_Beat_Assignment__c records`
  );

  if (!beatAssignmentInsertResult.success) {
    const msg = 'Failed to insert SR_Beat_Assignment__c into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  // optionally log or progress
  console.log('SR_Beat_Assignment__c sync finished');
  return { success: true };
};

/**
* Main exported function
*/
export const getSRBeatAssignmentHNT = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: fetch
    const fetchResult = await fetchBeatAssignmentData({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: map
    const cleanedBeatAssignmentPayload = mapBeatAssignmentsToLocalSchema(fetchResult.data);

    // Step 3: insert
    const insertResult = await insertBeatAssignmentsToDb(cleanedBeatAssignmentPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedBeatAssignmentPayload.length} SR_Beat_Assignment__c records`,
      data: { count: cleanedBeatAssignmentPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSRBeatAssignmentHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};