import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * 🔹 Current user total points (MASTER specific)
 */
// const buildCurrentUserTotalQuery = (loggedInUser, masterId) => `
//   SELECT 
//     Id, Active__c, Reward_Type__c, Gamification_Master__c, 
//     Start_Date__c, End_Date__c, Required_Point__c 
//     FROM Gamification_Reward_Master__c WHERE 
//      Gamification_Master__c = '${masterId}' AND
//     Active__c = true
//     AND Start_Date__c <= TODAY
//     AND End_Date__c >= TODAY
// `;
const buildCurrentUserTotalQuery = (loggedInUser, masterId) => `
  SELECT 
    Id, Active__c, Reward_Type__c, Gamification_Master__c, 
    Start_Date__c, End_Date__c, Required_Point__c 
    FROM Gamification_Reward_Master__c WHERE 
     Gamification_Master__c = '${masterId}' AND
    Active__c = true
`;

/**
 * 🔹 Fetch helper
 */
const fetchSOQL = async ({ fetchRecords, query, accessToken, instanceUrl }) => {
  const data = await fetchRecords(
    'Gamification_Reward_Master__c',
    query,
    accessToken,
    instanceUrl
  );

  if (!Array.isArray(data)) {
    throw new Error('Invalid SOQL response');
  }

  return data;
};

/**
 * 🔹 Map to local DB schema (single user)
 */
const mapToLocalSchema = (record, masterId) => ({
  Sf_Id: record.Id,
  Active__c: record.Active__c ?? '',
  Reward_Type__c: record.Reward_Type__c,
  Gamification_Master__c: masterId,
  Start_Date__c: record.Start_Date__c ?? '',
  End_Date__c: record.End_Date__c ?? '',
  Required_Point__c: record.Required_Point__c ?? 0,

  is_locally_changed: false,
  is_synced: true,
  last_modified: Date.now(),
  operation_type: 'insert',
});

/**
 * 🔹 Insert into local DB
 */
const insertIntoDb = async payload =>
  safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Gamification_Reward_Master__c',
        Type: 'insert',
        data: [payload],
      }),
    `Insert current user reward total`
  );

/**
 * ===============================
 * 🔥 MAIN FUNCTION
 * ===============================
 */
export const getGamificationRewardHNT = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
}) => {
  try {
    /**
     * 1️⃣ Get Gamification Master
     */
    const mastersAll = await UniversalUpdateInsert({
      ObjectName: 'Gamification_Master__c',
      Type: 'get',
    });

    const masterId = mastersAll?.[0]?.Master_Id;

    if (!masterId) {
      console.log('No Gamification Master found, skipping user points sync');
      return {
        success: true,
        status: 'ok',
        message: 'No Gamification Master found, nothing to sync',
        data: { count: 0 },
      };
    }

    console.log('🏆 Using Master:', masterId);
    console.log('🏆 Using Master:', buildCurrentUserTotalQuery(loggedInUser, masterId),);

    /**
     * 2️⃣ Fetch current user TOTAL points for this master
     */
    const result = await fetchSOQL({
      fetchRecords,
      query: buildCurrentUserTotalQuery(loggedInUser, masterId),
      accessToken,
      instanceUrl,
    });

    if (!result.length) {
      return {
        success: true,
        status: 'ok',
        message: 'No gamification reward data for current user',
        data: { count: 0 },
      };
    }


    /**
     * 3️⃣ Map & insert
     */
    const payload = mapToLocalSchema(result[0], masterId);
    console.log('📦 Current User Payload:', payload);

    const insertResult = await insertIntoDb(payload);
    if (!insertResult.success) {
      throw new Error('Local DB insert failed');
    }

    return {
      success: true,
      status: 'ok',
      message: 'Current user Gamification_Reward_Master__c total synced',
      data: payload,
    };
  } catch (err) {
    const msg = `Gamification Gamification_Reward_Master__c sync failed: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
