// auth/GetAndStoreData/getTarget.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
* Target query with all fields
*/
const buildTargetQuery = (loggedInUser) => {
  const whereCondition =
    loggedInUser.DeveloperName === "H_T_SO"
      ? `TargetSetBy__c = '${loggedInUser.Sf_Id}' AND Target_Type__c = 'SR Target'`
      : `TargetSetFor__c = '${loggedInUser.Sf_Id}'`;

  return `
    SELECT Id, Category__c,SubCategory__c, StartDate__c, EndDate__c, Frequency__c, TotalTarget__c,
           ValueTargetAchieved__c, NCatMBOTargetAchieved__c, NSubCatMBOTargetAchieved__c,
           FocusBrandTargetAchieved__c, ValueTarget__c, VolumeTarget__c, CoverageTarget__c,
           ProductivityTarget__c, TLSTarget__c, UTLSTarget__c, NCatMBOTarget__c,
           NSubCatMBOTarget__c, SelectedCategories__c, SelectedSubCategories__c,
           FocusBrandTarget__c, Selected_Focus_Brand__c, TargetSetFor__c,
           VolumeTargetAchieved__c, MBO_Target_Achieved__c, MBO_Target__c, MBO_Type__c
    FROM Target__c
    WHERE ${whereCondition}
  `;
};


/**
* Fetch Target records from Salesforce
*/
const fetchTargetData = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  // console.log('logged in user in target.....', loggedInUser)
  const targetQuery = buildTargetQuery(loggedInUser);

  try {
    const TargetData = await fetchRecords('Target__c', targetQuery, accessToken, instanceUrl);
    if (!Array.isArray(TargetData)) {
      throw new Error('Invalid data type for Targets');
    }
    console.log(`Fetched ${TargetData.length} Target records`);
    return { success: true, data: TargetData };
  } catch (err) {
    const msg = `Failed to fetch Targets: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
* Map Targets to local schema (EXACT same mapping as your code)
*/
const mapTargetsToLocalSchema = (TargetData = []) =>
  (TargetData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Category__c: item.Category__c ?? '',
    SubCategory__c: item.SubCategory__c ?? '',
    StartDate__c: item.StartDate__c ?? '',
    EndDate__c: item.EndDate__c ?? '',
    Frequency__c: item.Frequency__c ?? '',
    TotalTarget__c: item.TotalTarget__c ?? 0,
    ValueTarget__c: item.ValueTarget__c ?? 0,
    VolumeTarget__c: item.VolumeTarget__c ?? 0,
    CoverageTarget__c: item.CoverageTarget__c ?? 0,
    ProductivityTarget__c: item.ProductivityTarget__c ?? 0,
    TLSTarget__c: item.TLSTarget__c ?? 0,
    UTLSTarget__c: item.UTLSTarget__c ?? 0,
    NCatMBOTarget__c: item.NCatMBOTarget__c ?? 0,
    NSubCatMBOTarget__c: item.NSubCatMBOTarget__c ?? 0,
    FocusBrandTarget__c: item.FocusBrandTarget__c ?? 0,
    NSubCatMBOTargetAchieved__c: item.NSubCatMBOTargetAchieved__c ?? 0,
    FocusBrandTargetAchieved__c: item.FocusBrandTargetAchieved__c ?? 0,
    NCatMBOTargetAchieved__c: item.NCatMBOTargetAchieved__c ?? 0,
    ValueTargetAchieved__c: item.ValueTargetAchieved__c ?? 0,
    TargetSetFor__c: item.TargetSetFor__c ?? 0,
    SelectedCategories__c: item.SelectedCategories__c ?? '',
    SelectedSubCategories__c: item.SelectedSubCategories__c ?? '',
    Selected_Focus_Brand__c: item.Selected_Focus_Brand__c ?? '',
    VolumeTargetAchieved__c: item.VolumeTargetAchieved__c ?? 0,
    MBO_Target_Achieved__c: item.MBO_Target_Achieved__c ?? 0,
    MBO_Target__c: item.MBO_Target__c ?? 0,
    MBO_Type__c: item.MBO_Type__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
* Insert Targets into local database
*/
const insertTargetsToDb = async (cleanedTargetPayload) => {
  if (cleanedTargetPayload.length === 0) {
    console.log('⚠️ No Target records to insert');
    return { success: true };
  }

  const targetInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Target__c',
        Type: 'insert',
        data: cleanedTargetPayload,
      }),
    `Insert ${cleanedTargetPayload.length} Target records`
  );

  if (!targetInsertResult.success) {
    const msg = 'Failed to insert Targets into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
* Main exported function
*/
export const getTarget = async ({ fetchRecords, accessToken, instanceUrl, loggedInUser }) => {
  try {
    // Step 1: Fetch Target records
    const fetchResult = await fetchTargetData({ fetchRecords, accessToken, instanceUrl, loggedInUser });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedTargetPayload = mapTargetsToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertTargetsToDb(cleanedTargetPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedTargetPayload.length} Target records`,
      data: { count: cleanedTargetPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getTarget: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};