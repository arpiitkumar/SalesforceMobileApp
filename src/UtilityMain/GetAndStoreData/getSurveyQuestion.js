import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Survey Question query
 */
const buildSurveyQuestionQuery = () => `
  SELECT Id, Name, Survey_Template__c, Question__c, Question_Order__c, Response_Type__c, Mandatory__c, Allow_Image__c
  FROM Survey_Question__c
  LIMIT 200
`;

/**
 * Fetch Survey Questions from Salesforce
 */
const fetchSurveyQuestionData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const surveyQuestionQuery = buildSurveyQuestionQuery();

  try {
    const surveyQuestionData = await fetchRecords('Survey_Question__c', surveyQuestionQuery, accessToken, instanceUrl);
    if (!Array.isArray(surveyQuestionData)) {
      throw new Error('Invalid data type for Survey Questions');
    }
    console.log(`Fetched ${surveyQuestionData.length} Survey Questions`);
    return { success: true, data: surveyQuestionData };
  } catch (err) {
    const msg = `Failed to fetch Survey Questions: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Survey Questions to local schema
 */
const mapSurveyQuestionsToLocalSchema = (surveyQuestionData = []) =>
  (surveyQuestionData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Survey_Template__c: item.Survey_Template__c ?? '',
    Question__c: item.Question__c ?? '',
    Question_Order__c: item.Question_Order__c ?? 0,
    Response_Type__c: item.Response_Type__c ?? '',
    Mandatory__c: item.Mandatory__c ?? false,
    Allow_Image__c: item.Allow_Image__c ?? false,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Survey Questions into local database
 */
const insertSurveyQuestionsToDb = async (cleanedSurveyQuestionPayload) => {
  if (cleanedSurveyQuestionPayload.length === 0) {
    console.log('⚠️ No Survey Questions to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Survey_Question__c',
        Type: 'insert',
        data: cleanedSurveyQuestionPayload,
      }),
    `Insert ${cleanedSurveyQuestionPayload.length} Survey Questions`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Survey Questions into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSurveyQuestion = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchSurveyQuestionData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload = mapSurveyQuestionsToLocalSchema(fetchResult.data);
    const insertResult = await insertSurveyQuestionsToDb(cleanedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Survey Questions`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSurveyQuestion: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
