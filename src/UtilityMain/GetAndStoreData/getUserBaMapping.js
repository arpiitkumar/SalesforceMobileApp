import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { safeDatabaseOperation, safeProgress } from '../syncUtils';
import { cacheUserBaMapping } from '../../utils/orderClassification/orderClassificationService';

/**
 * Fetch User_BA_Mapping__c records for current user from Salesforce and cache locally.
 */
export const getUserBaMapping = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
  onProgress,
}) => {
  safeProgress && safeProgress('Fetching User BA Mapping...', onProgress);
  try {
    const userId = loggedInUser?.Sf_Id || loggedInUser?.Id;
    if (!userId) {
      console.warn('⚠️ No loggedInUser.Sf_Id found to fetch User_BA_Mapping__c');
      return { success: true, data: [] };
    }

    const query = `
      SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name, Account__r.BillingState 
      FROM User_BA_Mapping__c 
      WHERE User__c = '${userId}' AND Is_Active__c = true AND Status__c = 'Active'
 
    `;

    const records = await fetchRecords('User_BA_Mapping__c', query, accessToken, instanceUrl);
    const safeList = Array.isArray(records) ? records : [];
    console.log(`📥 Fetched ${safeList.length} User_BA_Mapping__c records for user ${userId}`);

    if (safeList.length > 0) {
      const firstMapping = safeList[0];
      const mappingData = {
        Id: firstMapping.Id,
        Name: firstMapping.Name,
        AccountId: firstMapping.Account__c,
        AccountName: firstMapping.Account__r?.Name || '',
        BillingState: firstMapping.Account__r?.BillingState || '',
      };
      await cacheUserBaMapping(userId, mappingData);
    }

    safeProgress && safeProgress(`Synced ${safeList.length} User BA Mapping records`, onProgress);
    return {
      success: true,
      status: 'ok',
      message: `Synced ${safeList.length} User BA Mapping records`,
      data: safeList,
    };
  } catch (err) {
    const msg = `Error syncing User_BA_Mapping__c: ${err.message}`;
    console.warn(msg);
    return { success: false, status: 'error', message: msg };
  }
};
