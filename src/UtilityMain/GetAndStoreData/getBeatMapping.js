import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation, safeProgress } from '../syncUtils';

/**
 * Fetch all Beat Mappings from Salesforce for all beats available locally
 */
export const getBeatMapping = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
  onProgress,
}) => {
  safeProgress && safeProgress('Fetching Beat Mappings...', onProgress);
  try {
    // 1. Gather all Beat IDs from local Beat__c, BeatDay__c, and SR_Beat_Assignment__c
    const beatIdsSet = new Set();

    const localBeats = await UniversalUpdateInsert({
      ObjectName: 'Beat__c',
      Type: 'get',
    });
    (Array.isArray(localBeats) ? localBeats : []).forEach(b => {
      const id = b.Sf_Id || b.Id;
      if (id) beatIdsSet.add(id);
    });

    const localBeatDays = await UniversalUpdateInsert({
      ObjectName: 'BeatDay__c',
      Type: 'get',
    });
    (Array.isArray(localBeatDays) ? localBeatDays : []).forEach(bd => {
      if (bd.Beat__c) beatIdsSet.add(bd.Beat__c);
      if (bd.Beat__Id) beatIdsSet.add(bd.Beat__Id);
    });

    const localAssignments = await UniversalUpdateInsert({
      ObjectName: 'SR_Beat_Assignment__c',
      Type: 'get',
    });
    (Array.isArray(localAssignments) ? localAssignments : []).forEach(a => {
      if (a.Beat__c) beatIdsSet.add(a.Beat__c);
    });

    // Also check User_BA_Mapping__c if loggedInUser is available
    const userId = loggedInUser?.Sf_Id;
    if (userId) {
      try {
        const userBaQuery = `SELECT Id, Account__c FROM User_BA_Mapping__c WHERE User__c = '${userId}' AND Is_Active__c = true AND Status__c = 'Active'
 `;
        const userBaMappings = await fetchRecords('User_BA_Mapping__c', userBaQuery, accessToken, instanceUrl);
        const accountIds = (Array.isArray(userBaMappings) ? userBaMappings : [])
          .map(item => item?.Account__c)
          .filter(Boolean);
        if (accountIds.length > 0) {
          const accountFilter = accountIds.map(id => `'${id}'`).join(',');
          const beatQuery = `SELECT Id FROM Beat__c WHERE Distributor__c IN (${accountFilter})`;
          const beats = await fetchRecords('Beat__c', beatQuery, accessToken, instanceUrl);
          (Array.isArray(beats) ? beats : []).forEach(b => {
            if (b?.Id) beatIdsSet.add(b.Id);
          });
        }
      } catch (baErr) {
        console.warn('⚠️ Could not fetch User_BA_Mapping__c beats:', baErr.message);
      }
    }

    const allBeatIds = Array.from(beatIdsSet).filter(Boolean);
    if (!allBeatIds.length) {
      console.log('No Beat IDs found to fetch Beat Mappings');
      return { success: true, data: [] };
    }

    console.log(`Found ${allBeatIds.length} beats to fetch mappings for`);

    // 2. Fetch Beat_Mapping__c from Salesforce in chunks of 50 to avoid SOQL length limits
    const CHUNK_SIZE = 50;
    const allMappings = [];

    for (let i = 0; i < allBeatIds.length; i += CHUNK_SIZE) {
      const chunk = allBeatIds.slice(i, i + CHUNK_SIZE);
      const formattedIds = chunk.map(id => `'${id}'`).join(',');
      const mappingQuery = `
        SELECT Id, Beat__c, Account__c, Account__r.Name, Account__r.Party_Code__c, Account__r.Active__c, Beat__r.Distributor__c 
        FROM Beat_Mapping__c 
        WHERE Beat__c IN (${formattedIds}) AND Is_Active__c = true AND Status__c = 'Active'
 
      `;

      try {
        const records = await fetchRecords('Beat_Mapping__c', mappingQuery, accessToken, instanceUrl);
        if (Array.isArray(records)) {
          allMappings.push(...records);
        }
      } catch (chunkErr) {
        console.warn(`⚠️ Error fetching Beat_Mapping__c chunk ${i}:`, chunkErr.message);
      }
    }

    // 3. Map to local schema
    const mappingsToInsert = allMappings.map(item => ({
      Sf_Id: item.Id,
      Beat__c: item.Beat__c || '',
      Account__c: item.Account__c || '',
      Name: item.Account__r?.Name || '',
      PartyCode__c: item.Account__r?.Party_Code__c || '',
      Active__c: item.Account__r?.Active__c !== false,
      is_synced: true,
      last_modified: Date.now(),
      SoftDelete: false,
      operation_type: 'insert',
    }));

    // 4. Also map Accounts to ensure local Account table has all mapped retailers
    const accountsToInsert = allMappings
      .filter(m => m.Account__c)
      .map(m => ({
        Sf_Id: m.Account__c,
        Name: m.Account__r?.Name || 'Unnamed Retailer',
        Party_Code__c: m.Account__r?.Party_Code__c || '',
        Active__c: m.Account__r?.Active__c !== false,
        Beat__c: m.Beat__c || '',
        is_synced: true,
        last_modified: Date.now(),
        operation_type: 'insert',
      }));

    // 5. Insert into local database
    if (mappingsToInsert.length > 0) {
      const insertResult = await safeDatabaseOperation(
        () => UniversalUpdateInsert({
          ObjectName: 'Beat_Mapping__c',
          Type: 'insert',
          data: mappingsToInsert,
        }),
        `Insert ${mappingsToInsert.length} Beat_Mapping__c records`
      );
      if (!insertResult.success) {
        console.warn('Failed to insert Beat_Mapping__c records into local DB');
      }
    }

    if (accountsToInsert.length > 0) {
      const insertAccResult = await safeDatabaseOperation(
        () => UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'insert',
          data: accountsToInsert,
        }),
        `Insert ${accountsToInsert.length} Account records from Beat Mappings`
      );
      if (!insertAccResult.success) {
        console.warn('Failed to insert Account records from Beat Mappings into local DB');
      }
    }

    safeProgress && safeProgress(`Synced ${mappingsToInsert.length} Beat Mapping records`, onProgress);
    return {
      success: true,
      status: 'ok',
      message: `Synced ${mappingsToInsert.length} Beat Mapping records`,
    };
  } catch (err) {
    const msg = `Unexpected error in getBeatMapping: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
