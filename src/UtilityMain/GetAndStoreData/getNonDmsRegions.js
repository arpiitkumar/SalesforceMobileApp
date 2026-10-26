import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { safeDatabaseOperation, showErrorToast, safeProgress } from '../syncUtils';
import { cacheNonDmsRegions } from '../../utils/orderClassification/orderClassificationService';

/**
 * Fetch Non_DMS_Regions__mdt records from Salesforce and cache locally.
 */
export const getNonDmsRegions = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  onProgress,
}) => {
  safeProgress && safeProgress('Fetching Non-DMS Regions...', onProgress);
  try {
    const query = 'SELECT Id, Regions__c FROM Non_DMS_Regions__mdt';
    const records = await fetchRecords('Non_DMS_Regions__mdt', query, accessToken, instanceUrl);

    const safeList = Array.isArray(records) ? records : [];
    console.log(`📥 Fetched ${safeList.length} Non_DMS_Regions__mdt records`);

    // Cache locally in AsyncStorage for fast O(1) synchronous/offline lookup
    await cacheNonDmsRegions(safeList);

    safeProgress && safeProgress(`Synced ${safeList.length} Non-DMS Regions`, onProgress);
    return {
      success: true,
      status: 'ok',
      message: `Synced ${safeList.length} Non-DMS Regions`,
      data: safeList,
    };
  } catch (err) {
    const msg = `Error syncing Non_DMS_Regions__mdt: ${err.message}`;
    console.warn(msg);
    return { success: false, status: 'error', message: msg };
  }
};
