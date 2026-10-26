import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Survey Assignment query
 */
const buildSurveyAssignmentQuery = () => `
  SELECT Id, Name, Survey_Template__c, Active__c, Assignment_Type__c
  FROM Survey_Assignment__c
  WHERE Active__c = true
`;

/**
 * Fetch Survey Assignments from Salesforce
 */
const fetchSurveyAssignmentData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const surveyAssignmentQuery = buildSurveyAssignmentQuery();

  try {
    const surveyAssignmentData = await fetchRecords('Survey_Assignment__c', surveyAssignmentQuery, accessToken, instanceUrl);
    if (!Array.isArray(surveyAssignmentData)) {
      throw new Error('Invalid data type for Survey Assignments');
    }
    console.log(`Fetched ${surveyAssignmentData.length} Survey Assignments`);
    return { success: true, data: surveyAssignmentData };
  } catch (err) {
    const msg = `Failed to fetch Survey Assignments: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Survey Assignments to local schema
 */
const mapSurveyAssignmentsToLocalSchema = (surveyAssignmentData = []) =>
  (surveyAssignmentData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Survey_Template__c: item.Survey_Template__c ?? '',
    Active__c: item.Active__c ?? false,
    Assignment_Type__c: item.Assignment_Type__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Survey Assignments into local database
 */
const insertSurveyAssignmentsToDb = async (cleanedSurveyAssignmentPayload) => {
  if (cleanedSurveyAssignmentPayload.length === 0) {
    console.log('⚠️ No Survey Assignments to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Survey_Assignment__c',
        Type: 'insert',
        data: cleanedSurveyAssignmentPayload,
      }),
    `Insert ${cleanedSurveyAssignmentPayload.length} Survey Assignments`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Survey Assignments into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSurveyAssignment = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchSurveyAssignmentData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload = mapSurveyAssignmentsToLocalSchema(fetchResult.data);
    const insertResult = await insertSurveyAssignmentsToDb(cleanedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Survey Assignments`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSurveyAssignment: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
