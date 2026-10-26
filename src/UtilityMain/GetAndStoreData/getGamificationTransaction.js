import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * 🔹 Current user total points (MASTER specific)
 */
const buildCurrentUserTotalQuery = (loggedInUser, masterId) => `
  SELECT Id, User__c, User__r.Name,Gamification_Transaction_Master__c,Points_Redeem__c,Gamification_Reward_Master__c,Transaction_Type__c,Category__c,Gamification_Master__c,Points_Earned__c
  FROM Gamification_Transaction__c
  WHERE User__c = '${loggedInUser.Sf_Id}'
    AND Gamification_Master__c = '${masterId}'
`;

/**
 * 🔹 Fetch helper
 */
const fetchSOQL = async ({ fetchRecords, query, accessToken, instanceUrl }) => {
  const data = await fetchRecords(
    'Gamification_Transaction__c',
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
  User_Name__c: record.User__r.Name ?? '',
  User__c: record.User__c,
  Gamification_Master__c: masterId,
  Points_Earned__c: record.Points_Earned__c ?? 0,
  Category__c: record.Category__c,
  Transaction_Type__c: record.Transaction_Type__c,
  Gamification_Reward_Master__c: record.Gamification_Reward_Master__c,
  Points_Redeem__c: record.Points_Redeem__c ?? 0,
  Gamification_Transaction_Master__c: record.Gamification_Transaction_Master__c,

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
        ObjectName: 'Gamification_Transaction__c',
        Type: 'insert',
        data: payload, // array of records
      }),
    `Insert current user gamification transactions`
  );


/**
 * ===============================
 * 🔥 MAIN FUNCTION
 * ===============================
 */
export const getGamificationTransactionHNT = async ({
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

    // console.log('🏆 Using Master:', masterId);
    console.log('🏆 Using Master trans:', buildCurrentUserTotalQuery(loggedInUser, masterId),);

    /**
     * 2️⃣ Fetch current user TOTAL points for this master
     */
    const result = await fetchSOQL({
      fetchRecords,
      query: buildCurrentUserTotalQuery(loggedInUser, masterId),
      accessToken,
      instanceUrl,
    });
    // console.log('result',JSON.stringify(result))
    if (!result.length) {
      return {
        success: true,
        status: 'ok',
        message: 'No gamification data for current user',
        data: { count: 0 },
      };
    }


    /**
     * 3️⃣ Map & insert
     */
    const payload = result.map(record => mapToLocalSchema(record, masterId));
    // console.log('📦 All User Payload:', JSON.stringify(payload));


    const insertResult = await insertIntoDb(payload);
    if (!insertResult.success) {
      throw new Error('Local DB insert failed');
    }

    return {
      success: true,
      status: 'ok',
      message: 'Current user gamification total synced',
      data: payload,
    };
  } catch (err) {
    const msg = `Gamification sync failed: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
