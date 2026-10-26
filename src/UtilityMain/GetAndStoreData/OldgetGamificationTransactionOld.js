import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * 🔹 Top users (MASTER specific)
 */
const buildTopUsersQuery = (masterId, limit) => `
  SELECT User__c, User__r.Name Name, SUM(Points_Earned__c) totalPoints
  FROM Gamification_Transaction__c
  WHERE Gamification_Master__c = '${masterId}'
  GROUP BY User__c, User__r.Name
  ORDER BY SUM(Points_Earned__c) DESC
  LIMIT ${limit}
`;

/**
 * 🔹 Current user total points (MASTER specific)
 */
const buildCurrentUserTotalQuery = (loggedInUser, masterId) => `
  SELECT User__c, User__r.Name Name, SUM(Points_Earned__c) totalPoints
  FROM Gamification_Transaction__c
  WHERE User__c = '${loggedInUser.Sf_Id}'
    AND Gamification_Master__c = '${masterId}'
  GROUP BY User__c, User__r.Name
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
 * 🔹 Map leaderboard data to local DB schema
 */
const mapToLocalSchema = (records = [], masterId) =>
  records.map(item => ({
    Sf_Id: item.User__c, // one row per user
    User_Name__c: item.Name ?? '',
    User__c: item.User__c,
    Gamification_Master__c: masterId,
    Points_Earned__c: item.totalPoints ?? 0,
    Category__c: '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * 🔹 Insert into local DB
 */
const insertIntoDb = async payload =>
  safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Gamification_Transaction__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} leaderboard records`
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
     * 1️⃣ Get Gamification Master from local DB
     */
    const mastersAll = await UniversalUpdateInsert({
      ObjectName: 'Gamification_Master__c',
      Type: 'get',
    });

    const master = mastersAll?.[0];
    const masterId = master?.Master_Id;

    const rawTop = master?.Number_of_Badges_to_Show__c;
    const topLimit = Number(rawTop) > 0 ? Number(rawTop) : 5;

    if (!masterId) {
      throw new Error('Gamification Master Id not found');
    }

    console.log('🏆 Gamification Master:', masterId);
    console.log('🏅 Top Limit:', topLimit);

    /**
     * 2️⃣ Fetch TOP users (MASTER based)
     */
    const topUsers = await fetchSOQL({
      fetchRecords,
      query: buildTopUsersQuery(masterId, topLimit),
      accessToken,
      instanceUrl,
    });

    /**
     * 3️⃣ Check if current user already in top
     */
    const isCurrentInTop = topUsers.some(
      u => u.User__c === loggedInUser.Sf_Id
    );

    /**
     * 4️⃣ Fetch current user if not in top
     */
    let currentUser = [];
    if (!isCurrentInTop) {
      currentUser = await fetchSOQL({
        fetchRecords,
        query: buildCurrentUserTotalQuery(loggedInUser, masterId),
        accessToken,
        instanceUrl,
      });
    }

    /**
     * 5️⃣ Combine users
     */
    const users = [...topUsers, ...currentUser];

    if (!users.length) {
      return {
        success: true,
        status: 'ok',
        message: 'No leaderboard data',
      };
    }

    /**
     * 6️⃣ Map & insert into local DB
     */
    const finalPayload = mapToLocalSchema(users, masterId);
    console.log('📦 Leaderboard Payload:', finalPayload);

    const insertResult = await insertIntoDb(finalPayload);
    if (!insertResult.success) {
      throw new Error('Local DB insert failed');
    }

    return {
      success: true,
      status: 'ok',
      message: `Leaderboard synced (${finalPayload.length} users)`,
      data: finalPayload,
    };
  } catch (err) {
    const msg = `Gamification leaderboard sync failed: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
