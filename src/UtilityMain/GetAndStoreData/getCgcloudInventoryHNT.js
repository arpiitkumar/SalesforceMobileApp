import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
* Build cgcloud__Inventory__c query based on user role
*/
const buildCgcloudInventoryQuery = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
}) => {

  const userField =
    loggedInUser?.DeveloperName === 'H_T_SO'
      ? 'Sales_Person_ManagerId__c'
      : 'Assigned_To__c';


  const distributorField =
    loggedInUser?.DeveloperName === 'H_T_ASO'
      ? 'Distributor__r.ParentId'
      : 'Distributor__c';

  const beatSoql = `
    SELECT ${distributorField}
    FROM SR_Beat_Assignment__c
    WHERE ${userField}='${loggedInUser?.Sf_Id}'
  `;

  const beatResult = await fetchRecords(
    'SR_Beat_Assignment__c',
    beatSoql,
    accessToken,
    instanceUrl
  );

  // Extract correct field
  const distributorIds = [
    ...new Set(
      (beatResult || [])
        .map(r =>
          loggedInUser?.DeveloperName === 'H_T_ASO'
            ? r?.Distributor__r?.ParentId
            : r?.Distributor__c
        )
        .filter(Boolean)
    ),
  ];

  return distributorIds;
};

/**
* Map SF inventory to local DB schema
*/
const mapCgcloudInventoryToLocalSchema = (inventoryData = []) =>
  inventoryData.map(item => ({
    Sf_Id: item.Id ?? '',
    cgcloud__Account__c: item.cgcloud__Account__c ?? '',
    cgcloud__Product__c: item.cgcloud__Product__c ?? '',
    Saleable_Stock_Pcs__c: item.Saleable_Stock_Pcs__c ?? 0,
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
* Insert into local database
*/
const insertCgcloudInventoryToDb = async payload => {
  if (!payload.length) return { success: true };

  return safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'cgcloud__Inventory__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} cgcloud__Inventory__c records`
  );
};

/**
* Main function
*/
export const getCgcloudInventoryHNT = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
  creds,
  apiFetch
}) => {
  try {
    // const query = await buildCgcloudInventoryQuery({
    //   fetchRecords,
    //   accessToken,
    //   instanceUrl,
    //   loggedInUser,
    // });
    //   const inventoryData = await fetchRecords(
    //   'cgcloud__Inventory__c',
    //   query,
    //   accessToken,
    //   instanceUrl
    // );
    const distibuterID = await buildCgcloudInventoryQuery({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser,
    });
    const distibuterIDArray = Array.isArray(distibuterID)
      ? distibuterID.filter(id => id) // remove null/undefined
      : [];

    if (!distibuterIDArray.length) {
      console.log('⚠️ No Distributor IDs found');
    }

    const payloadforapi = {
      AccountIds: distibuterIDArray
    };
    // console.log('payloadforapi',payloadforapi)
    const response = await apiFetch('POST', 'returnProductStock', payloadforapi, 'Custom', creds.accessToken, creds.instanceUrl);
    // console.log(response?.data?.responseBody?.inventoryList)
    const inventoryData = response?.data?.responseBody?.inventoryList;

    if (!Array.isArray(inventoryData)) {
      throw new Error('Invalid inventory response');
    }

    const payload = mapCgcloudInventoryToLocalSchema(inventoryData);
    const insertResult = await insertCgcloudInventoryToDb(payload);

    if (!insertResult.success) {
      throw new Error('Local DB insert failed');
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${payload.length} cgcloud__Inventory__c records`,
      data: { count: payload.length },
    };
  } catch (err) {
    showErrorToast(err.message);
    return { success: false, status: 'error', message: err.message };
  }
};