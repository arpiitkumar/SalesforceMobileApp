// auth/GetAndStoreData/getSoUsersHTSO.js
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert'; // adjust path if needed
import { safeDatabaseOperation, showErrorToast } from '../syncUtils';       // adjust path if needed

// Build SOQL query for SO users
const buildSoUserQuery = (sfManagerId) =>
  `SELECT Id, Name, ManagerId, UserRole.Name, User_Type__c,EmployeeCode__c
   FROM User
   WHERE ManagerId = '${sfManagerId}' AND IsActive=true`;

// Map Salesforce users to local schema
const mapUsersToLocalSchema = (users) =>
  users.map(user => ({
    Sf_Id: user.Id,
    Name: user.Name || '',
    ManagerId: user.ManagerId || '',
    Role: user.UserRole?.Name || '',
    DeveloperName: user?.User_Type__c || '',
    EmployeeCode__c: user?.EmployeeCode__c || '',
    is_locally_changed: false,
    operation_type: 'insert',
    last_modified: Date.now(),
    is_synced: true,
  }));

export const getSoUsersHTSO = async ({
  loggedInUser,        // loggedInUser[0] from your current code
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  try {
    if (!loggedInUser?.Sf_Id) {
      return { success: false, status: 'error', message: 'Missing logged in user Sf_Id' };
    }

    const queryGetSoUser = buildSoUserQuery(loggedInUser.Sf_Id);
    console.log(queryGetSoUser);

    let resSoUser;
    try {
      resSoUser = await fetchRecords('User__c', queryGetSoUser, accessToken, instanceUrl);
      if (!Array.isArray(resSoUser)) {
        throw new Error('fetchRecords returned invalid data type for SO Users');
      }
      console.log(`Fetched ${resSoUser.length} SO Users`);
    } catch (err) {
      const msg = `Failed to fetch Sales/Team users: ${err.message}`;
      showErrorToast(msg);
      return { success: false, status: 'error', message: msg };
    }

    const newSOUserPayload = mapUsersToLocalSchema(resSoUser);

    const soUserInsertResult = await safeDatabaseOperation(
      () =>
        UniversalUpdateInsert({
          ObjectName: 'so_users',
          Type: 'insert',
          data: newSOUserPayload,
        }),
      `Insert ${newSOUserPayload.length} SO Users`
    );

    if (!soUserInsertResult.success) {
      const msg = 'Failed to insert SO Users into local database';
      showErrorToast(msg);
      return { success: false, status: 'error', message: msg };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${newSOUserPayload.length} SO Users`,
    };
  } catch (err) {
    const msg = `Unexpected error in getSoUsersHTSO: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
