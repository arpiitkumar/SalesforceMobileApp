// auth/GetAndStoreData/getLineSRDistributorMappingHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';


const fetchLineSRData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    const isManagerRole = ['H_T_SO', 'MT_SO'].includes(loggedInUser?.DeveloperName);
    let srIds = [loggedInUser?.Sf_Id]; // default current user
    // 👉 If SO → fetch child users
    if (isManagerRole) {
      const soUserQuery = `
        SELECT Id FROM User
        WHERE ManagerId = '${loggedInUser?.Sf_Id}' AND IsActive = true
      `;
      const soUsers = await fetchRecords('User', soUserQuery, accessToken, instanceUrl);
      if (Array.isArray(soUsers) && soUsers.length > 0) {
        const childIds = soUsers.map(u => u.Id);
        srIds = [...new Set([loggedInUser?.Sf_Id, ...childIds])]; // include self + SRs
      }
    }
    // 👉 Build dynamic query
    const srFilter = srIds.map(id => `'${id}'`).join(',');
    const lineSRQuery = `
      SELECT Id, Line__c, SR__c, Distributor__c,
             Distributor__r.DBType__c,
             Distributor__r.Name,
             Distributor__r.PartyCode__c
      FROM Line_SR_Distributor_Mapping__c
      WHERE SR__c IN (${srFilter})
    `;
    console.log('lineSRQuery', lineSRQuery)
    const LineSRData = await fetchRecords(
      'Line_SR_Distributor_Mapping__c',
      lineSRQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(LineSRData)) {
      throw new Error('Invalid data type for Line SR Mapping');
    }

    console.log(`Fetched ${LineSRData.length} Line SR Distributor Mapping records`);
    return { success: true, data: LineSRData };

  } catch (err) {
    const msg = `Failed to fetch Line SR Distributor Mapping: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Line SR Distributor Mapping to local schema (EXACT same mapping as your code)
 */
const mapLineSRToLocalSchema = (LineSRData = []) =>
  (LineSRData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Line__c: item.Line__c ?? '',
    SR__c: item.SR__c ?? '',
    Distributor__c: item.Distributor__c ?? '',
    DBType__c: item?.Distributor__r?.DBType__c ?? '',
    Distributor__Name: item?.Distributor__r?.Name ?? '',
    Distributor__PartyCode__c: item?.Distributor__r?.PartyCode__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Line SR Distributor Mapping into local database
 */
const insertLineSRToDb = async (cleanedLineSRPayload) => {
  if (cleanedLineSRPayload.length === 0) {
    console.log('⚠️ No Line SR Distributor Mapping records to insert');
    return { success: true };
  }

  const lineSRInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Line_SR_Distributor_Mapping__c',
        Type: 'insert',
        data: cleanedLineSRPayload,
      }),
    `Insert ${cleanedLineSRPayload.length} Line SR Distributor Mapping records`
  );

  if (!lineSRInsertResult.success) {
    const msg = 'Failed to insert Line SR Distributor Mapping into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getLineSRDistributorMappingHNT = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: Fetch Line SR Distributor Mapping records
    const fetchResult = await fetchLineSRData({ fetchRecords, accessToken, instanceUrl, loggedInUser });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedLineSRPayload = mapLineSRToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertLineSRToDb(cleanedLineSRPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedLineSRPayload.length} Line SR Distributor Mapping records`,
      data: { count: cleanedLineSRPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getLineSRDistributorMappingHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
