import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Survey Template query
 */
const buildSurveyTemplateQuery = () => `
  SELECT Id, Name, Status__c, Frequency__c, Effective_From__c, Effective_To__c
  FROM Survey_Template__c
  WHERE Status__c = 'Published'
`;

/**
 * Fetch Survey Templates from Salesforce
 */
const fetchSurveyTemplateData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const surveyTemplateQuery = buildSurveyTemplateQuery();

  try {
    const surveyTemplateData = await fetchRecords('Survey_Template__c', surveyTemplateQuery, accessToken, instanceUrl);
    if (!Array.isArray(surveyTemplateData)) {
      throw new Error('Invalid data type for Survey Templates');
    }
    console.log(`Fetched ${surveyTemplateData.length} Survey Templates`);
    return { success: true, data: surveyTemplateData };
  } catch (err) {
    const msg = `Failed to fetch Survey Templates: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Survey Templates to local schema
 */
const mapSurveyTemplatesToLocalSchema = (surveyTemplateData = []) =>
  (surveyTemplateData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Status__c: item.Status__c ?? '',
    Frequency__c: item.Frequency__c ?? '',
    Effective_From__c: item.Effective_From__c ?? '',
    Effective_To__c: item.Effective_To__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Survey Templates into local database
 */
const insertSurveyTemplatesToDb = async (cleanedSurveyTemplatePayload) => {
  if (cleanedSurveyTemplatePayload.length === 0) {
    console.log('⚠️ No Survey Templates to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Survey_Template__c',
        Type: 'insert',
        data: cleanedSurveyTemplatePayload,
      }),
    `Insert ${cleanedSurveyTemplatePayload.length} Survey Templates`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Survey Templates into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSurveyTemplate = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchSurveyTemplateData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload = mapSurveyTemplatesToLocalSchema(fetchResult.data);
    const insertResult = await insertSurveyTemplatesToDb(cleanedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Survey Templates`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSurveyTemplate: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
