import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Survey Assignment Target query
 */
const buildSurveyAssignmentTargetQuery = () => `
  SELECT Id, Name, Survey_Assignment__c, User__c, Distributor__c, Outlet__c
  FROM Survey_Assignment_Target__c
`;

/**
 * Fetch Survey Assignment Targets from Salesforce
 */
const fetchSurveyAssignmentTargetData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const surveyAssignmentTargetQuery = buildSurveyAssignmentTargetQuery();

  try {
    const surveyAssignmentTargetData = await fetchRecords('Survey_Assignment_Target__c', surveyAssignmentTargetQuery, accessToken, instanceUrl);
    if (!Array.isArray(surveyAssignmentTargetData)) {
      throw new Error('Invalid data type for Survey Assignment Targets');
    }
    console.log(`Fetched ${surveyAssignmentTargetData.length} Survey Assignment Targets`);
    return { success: true, data: surveyAssignmentTargetData };
  } catch (err) {
    const msg = `Failed to fetch Survey Assignment Targets: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Survey Assignment Targets to local schema
 */
const mapSurveyAssignmentTargetsToLocalSchema = (surveyAssignmentTargetData = []) =>
  (surveyAssignmentTargetData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Survey_Assignment__c: item.Survey_Assignment__c ?? '',
    Geography__c: '',
    User__c: item.User__c ?? '',
    Distributor__c: item.Distributor__c ?? '',
    Outlet__c: item.Outlet__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Survey Assignment Targets into local database
 */
const insertSurveyAssignmentTargetsToDb = async (cleanedSurveyAssignmentTargetPayload) => {
  if (cleanedSurveyAssignmentTargetPayload.length === 0) {
    console.log('⚠️ No Survey Assignment Targets to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Survey_Assignment_Target__c',
        Type: 'insert',
        data: cleanedSurveyAssignmentTargetPayload,
      }),
    `Insert ${cleanedSurveyAssignmentTargetPayload.length} Survey Assignment Targets`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Survey Assignment Targets into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSurveyAssignmentTarget = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchSurveyAssignmentTargetData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload = mapSurveyAssignmentTargetsToLocalSchema(fetchResult.data);
    const insertResult = await insertSurveyAssignmentTargetsToDb(cleanedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Survey Assignment Targets`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSurveyAssignmentTarget: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
