// auth/GetAndStoreData/getGamificationMasterFromAPI.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Fetch Gamification_Master__c via Custom API
 */
export const getGamificationMasterFromAPI = async ({
  creds,
  apiFetch,
  loggedInUser,
}) => {
  try {
    /* ================= API CALL ================= */
    console.log('logged in user', loggedInUser);

    const payload = {
      userId: loggedInUser?.Sf_Id,
    };

    const response = await apiFetch(
      'POST',
      'gamification/master',
      payload,
      'Custom',
      creds.accessToken,
      creds.instanceUrl
    );

    console.log('data from gamification API', JSON.stringify(response?.data));
    /* ================= RESPONSE PARSING ================= */
    const masterRecord = Array.isArray(response?.data?.data)
      ? response.data.data[0]
      : null;

    const gameProducts = Array.isArray(response?.data?.gameProduct)
      ? response.data.gameProduct
      : [];

    const transactionMasterId =
      response?.data?.gamificationTransationMaster ?? '';


    if (!masterRecord) {
      console.log('No Gamification Master record found, skipping insert');
      return {
        success: true,
        status: 'ok',
        message: 'No Gamification Master record found, nothing to sync',
        data: { count: 0 },
      };
    }


    /* ================= DATA MAPPING ================= */

    const cleanedPayload = gameProducts?.map(product => ({
      /* ---------- Salesforce Id (Child) ---------- */
      Sf_Id: product?.Id ?? '',
      /* ---------- Master Reference ---------- */
      Master_Id: masterRecord?.Id,
      /* ---------- Master Fields ---------- */
      /* NEW: Transaction Master Reference ---------- */
      Transaction_Master_Id: transactionMasterId,
      Active__c: masterRecord.Active__c ?? false,
      Description__c: masterRecord.Description__c ?? '',
      StartDate__c: masterRecord.StartDate__c ?? '',
      EndDate__c: masterRecord.EndDate__c ?? '',
      Region__c: masterRecord.Region__c ?? '',
      Number_of_Badges_to_Show__c: masterRecord.Number_of_Badges_to_Show__c ?? '',
      Gamification_Label__c: masterRecord.Gamification_Label__c ?? '',
      /* ---------- Child Fields ---------- */
      Gamification_Category__c: product.Gamification_Category__c ?? '',
      RewardPoint__c: product.Reward_Points__c ?? 0,
      /* ---------- Sync Markers ---------- */
      is_locally_changed: false,
      is_synced: true,
      last_modified: Date.now(),
      operation_type: 'insert',
      SoftDelete: false,
    }));

    console.log(
      `Prepared ${cleanedPayload.length} records for local insert`
    );
    console.log(JSON.stringify(cleanedPayload))
    /* ================= DB INSERT ================= */

    const insertResult = await safeDatabaseOperation(
      () =>
        UniversalUpdateInsert({
          ObjectName: 'Gamification_Master__c',
          Type: 'insert',
          data: cleanedPayload,
        }),
      `Insert ${cleanedPayload.length} Gamification_Master__c records`
    );

    if (!insertResult.success) {
      throw new Error(
        'Failed to insert Gamification_Master__c records into local database'
      );
    }

    /* ================= SUCCESS ================= */

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Gamification records`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Error in getGamificationMasterFromAPI: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
