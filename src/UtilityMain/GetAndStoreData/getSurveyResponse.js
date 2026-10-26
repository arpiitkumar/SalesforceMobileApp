import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Survey Response query
 */
const buildSurveyResponseQuery = () => `
  SELECT Id, Name, Survey_Template__c, Visit__c, Outlet__c, Field_User__c, Status__c, Start_Time__c, Submit_Time__c, Geolocation__Latitude__s, Geolocation__Longitude__s
  FROM Survey_Response__c
  LIMIT 200
`;

/**
 * Fetch Survey Responses from Salesforce
 */
const fetchSurveyResponseData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const query = buildSurveyResponseQuery();

  try {
    const data = await fetchRecords('Survey_Response__c', query, accessToken, instanceUrl);
    if (!Array.isArray(data)) {
      throw new Error('Invalid data type for Survey Responses');
    }
    console.log(`Fetched ${data.length} Survey Responses`);
    return { success: true, data: data };
  } catch (err) {
    const msg = `Failed to fetch Survey Responses: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Survey Responses to local schema
 */
const mapSurveyResponsesToLocalSchema = (data = []) =>
  (data || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Survey_Template__c: item.Survey_Template__c ?? '',
    Visit__c: item.Visit__c ?? '',
    Outlet__c: item.Outlet__c ?? '',
    Field_User__c: item.Field_User__c ?? '',
    Status__c: item.Status__c ?? '',
    Start_Time__c: item.Start_Time__c ?? '',
    Submit_Time__c: item.Submit_Time__c ?? '',
    Geolocation__Latitude__s: item.Geolocation__Latitude__s ?? null,
    Geolocation__Longitude__s: item.Geolocation__Longitude__s ?? null,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Survey Responses into local database
 */
const insertSurveyResponsesToDb = async (payload) => {
  if (payload.length === 0) {
    console.log('⚠️ No Survey Responses to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Survey_Response__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} Survey Responses`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Survey Responses into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getSurveyResponse = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchSurveyResponseData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload = mapSurveyResponsesToLocalSchema(fetchResult.data);
    const insertResult = await insertSurveyResponsesToDb(cleanedPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} Survey Responses`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getSurveyResponse: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
