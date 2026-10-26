// auth/GetAndStoreData/getAttendanceRules.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Fetch attendance rules from API
 */
const fetchAttendanceRulesFromApi = async ({ creds, apiFetch, loggedInUser }) => {
  const payload = { userId: creds.userId };

  try {
    const response = await apiFetch(
      'POST',
      'recordType',
      payload,
      'Custom',
      creds.accessToken,
      creds.instanceUrl
    );

    console.log('Fetched attendance rules from API', loggedInUser);
    console.log(
      'Attendance rules API response:::::::::::::::::::::::',
      JSON.stringify(response?.data?.responseBody?.attendanceRuleList)
    );




    return { success: true, data: response };
  } catch (err) {
    const msg = `Failed to fetch attendance rules: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Transform API response (attendanceRuleList array) to local schema
 * Example local schema fields:
 *  Sf_Id (Salesforce Id)
 *  DeveloperName, Label, Start_Time__c, Full_Day_Threshold__c, Half_Day_Threshold__c, Warning_Threshold__c
 *  plus sync metadata
 */
const transformAttendanceRules = (response, loggedInUser) => {
  const list =
    response?.data?.responseBody?.attendanceRuleList || [];

  if (!Array.isArray(list) || !list.length) {
    console.warn('⚠️ attendanceRuleList is empty');
    return [];
  }

  // 1️⃣ Determine ruleFor
  let ruleFor = null;

  if (["H_T_SO", "H_T_SR", "H_T_ASO"].includes(loggedInUser.DeveloperName)) {
    ruleFor = "H&T";
  } else if (loggedInUser.DeveloperName.startsWith("MT")) {
    ruleFor = "MT";
  } else if (loggedInUser.DeveloperName.startsWith("HoReCa")) {
    ruleFor = "HoReCa";
  }

  if (!ruleFor) {
    console.warn('⚠️ No ruleFor resolved for user:', loggedInUser.DeveloperName);
    return [];
  }

  // 2️⃣ Pick matching rule
  const selectedRule = list.find(
    rule => rule.Attendance_Rule_For__c === ruleFor
  );

  if (!selectedRule) {
    console.warn(`⚠️ No attendance rule found for ${ruleFor}`);
    return [];
  }

  console.log('Selected Attendance Rule:', selectedRule);

  // 3️⃣ Return array of RULES (not wrapped object)
  return [
    {
      Sf_Id: selectedRule.Id,
      JSON: JSON.stringify(selectedRule),
      is_synced: true,
    },
  ];
};


/**
 * Insert attendance rules into local database
 */
const insertAttendanceRulesToDb = async cleanedRulesPayload => {
  if (!cleanedRulesPayload.length) {
    console.log('⚠️ No attendance rules to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        // Use your local table name here
        ObjectName: 'AttendanceRule', // or 'Attendance_Rule__mdt' if that’s your Watermelon table name
        Type: 'insert',
        data: cleanedRulesPayload,
      }),
    `Insert ${cleanedRulesPayload.length} attendance rules`
  );

  console.log('Attendance rules insert result:::::::::::::::::::::::', insertResult);

  if (!insertResult.success) {
    const msg = 'Failed to insert attendance rules into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getAttendanceRules = async ({ creds, apiFetch, loggedInUser }) => {
  try {
    // Step 1: Fetch from API
    const apiResult = await fetchAttendanceRulesFromApi({ creds, apiFetch, loggedInUser });
    if (!apiResult.success) {
      return { success: false, status: 'error', message: apiResult.message };
    }

    const response = apiResult.data;

    // Step 2: Validate response & transform
    if (response.status !== 'success' || !response.data?.responseBody) {
      throw new Error('Failed to get attendance rules data from API');
    }

    const cleanedRulesPayload = transformAttendanceRules(response, loggedInUser);

    // Step 3: Insert into local DB
    const insertResult = await insertAttendanceRulesToDb(cleanedRulesPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedRulesPayload.length} attendance rules`,
      data: { count: cleanedRulesPayload.length },
    };
  } catch (err) {
    const msg = `Error syncing attendance rules: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
