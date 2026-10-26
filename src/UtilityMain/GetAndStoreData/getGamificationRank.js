// auth/GetAndStoreData/getGamificationRank.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Fetch GamificationRank via Custom API
 */
const generateRandomId = (length = 14) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomId = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomId += characters[randomIndex];
  }
  return randomId;
};


export const getGamificationRankFromAPI = async ({
  creds,
  apiFetch,
  loggedInUser,
}) => {
  try {
    /* ================= GET MASTER ================= */
    const mastersAll = await UniversalUpdateInsert({
      ObjectName: 'Gamification_Master__c',
      Type: 'get',
    });
    const masterId = mastersAll?.[0]?.Master_Id || null; // 🔹 null if not found

    if (!masterId) {
      console.log('No Gamification Master found, sending null to API');
    }

    /* ================= API CALL ================= */
    console.log('logged in user', loggedInUser);

    const payload = {
      CurrentUser: loggedInUser?.Sf_Id,
      GamificationMaster: masterId, // 🔹 will be null if no master
    };

    const response = await apiFetch(
      'POST',
      'gamification/summary',
      payload,
      'Custom',
      creds.accessToken,
      creds.instanceUrl
    );

    console.log('data from gamification API', JSON.stringify(response?.data));

    /* ================= RESPONSE PARSING ================= */
    const cleanedRankPayload = {
      Sf_Id: generateRandomId(),
      RankData: JSON.stringify(response?.data || {}),
      is_locally_changed: false,
      is_synced: true,
      last_modified: Date.now(),
      operation_type: 'insert',
    };

    console.log(`Prepared payload for local insert`);
    console.log(JSON.stringify(cleanedRankPayload));

    /* ================= DB INSERT ================= */
    const insertResult = await safeDatabaseOperation(
      () =>
        UniversalUpdateInsert({
          ObjectName: 'GamificationRank',
          Type: 'insert',
          data: [cleanedRankPayload], // 🔹 make it array
        }),
      `Insert GamificationRank record`
    );

    if (!insertResult.success) {
      throw new Error(
        'Failed to insert GamificationRank records into local database'
      );
    }

    /* ================= SUCCESS ================= */
    return {
      success: true,
      status: 'ok',
      message: `Synced Gamification rank record`,
      data: { count: 1 },
    };
  } catch (err) {
    const msg = `Error in getGamificationRankFromAPI: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
