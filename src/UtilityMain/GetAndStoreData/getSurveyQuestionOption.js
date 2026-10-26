import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Survey Question Option query
 */
const buildSurveyQuestionOptionQuery = () => `
  SELECT Id, Name, Survey_Question__c, Option__c, Sequence__c
  FROM Survey_Question_Option__c
  LIMIT 200
`;

/**
 * Fetch Survey Question Options from Salesforce
 */
const fetchSurveyQuestionOptionData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const surveyQuestionOptionQuery = buildSurveyQuestionOptionQuery();

  try {
    const surveyQuestionOptionData = await fetchRecords('Survey_Question_Option__c', surveyQuestionOptionQuery, accessToken, instanceUrl);
    if (!Array.isArray(surveyQuestionOptionData)) {
      throw new Error('Invalid data type for Survey Question Options');
    }
    console.log(`Fetched ${surveyQuestionOptionData.length} Survey Question Options`);
    return { success: true, data: surveyQuestionOptionData };
  } catch (err) {
    const msg = `Failed to fetch Survey Question Options: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Survey Question Options to local schema
 */
const mapSurveyQuestionOptionsToLocalSchema = (surveyQuestionOptionData = []) =>
  (surveyQuestionOptionData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Survey_Question__c: item.Survey_Question__c ?? '',
    Option__c: item.Option__c ?? '',
    Sequence__c: item.Sequence__c ?? 0,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Survey Question Options into local database
 */
const insertSurveyQuestionOptionsToDb = async (cleanedSurveyQuestionOptionPayload) => {
  if (cleanedSurveyQuestionOptionPayload.length === 0) {
    console.log('⚠️ No Survey Question Options to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Survey_Question_Option__c',
        Type: 'insert',
        data: cleanedSurveyQuestionOptionPayload,
      }),
    `Insert ${cleanedSurveyQuestionOptionPayload.length} Survey Question Options`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Survey Question Options into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSurveyQuestionOption = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchSurveyQuestionOptionData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload = mapSurveyQuestionOptionsToLocalSchema(fetchResult.data);
    const insertResult = await insertSurveyQuestionOptionsToDb(cleanedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Survey Question Options`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSurveyQuestionOption: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
