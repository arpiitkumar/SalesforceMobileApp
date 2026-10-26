// auth/GetAndStoreData/getQuestion.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Questions query
 */
const buildQuestionQuery = () => `
  SELECT Id, Name, Active__c, Is_Required__c, Form__c, Type__c ,Question_Order__c
  FROM Question__c
`;

/**
 * Fetch Questions from Salesforce
 */
const fetchQuestionData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const Question__cQuery = buildQuestionQuery();

  try {
    const Question__cData = await fetchRecords('Question__c', Question__cQuery, accessToken, instanceUrl);
    if (!Array.isArray(Question__cData)) {
      throw new Error('Invalid data type for Questions');
    }
    console.log(`Fetched ${Question__cData.length} Questions`);
    return { success: true, data: Question__cData };
  } catch (err) {
    const msg = `Failed to fetch Questions: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Clean and map Questions to local schema (EXACT same logic as your code)
 */
const mapQuestionsToLocalSchema = (Question__cData = []) => {
  const cleanArray = Array.isArray(Question__cData) ? Question__cData.filter(Boolean) : [];

  return cleanArray.map(item => ({
    Sf_Id: item?.Id ?? '',
    Name: item?.Name ?? '',
    Active__c: item?.Active__c ?? false,
    Is_Required__c: item?.Is_Required__c ?? false,
    Form__c: item?.Form__c ?? '',
    Type__c: item?.Type__c ?? '',
    Question_Order__c: item?.Question_Order__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));
};

/**
 * Insert Questions into local database
 */
const insertQuestionsToDb = async (cleanedQuestionPayload) => {
  if (!cleanedQuestionPayload.length) {
    console.log('⚠️ No Questions to insert');
    return { success: true };
  }

  const questionInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Question__c',
        Type: 'insert',
        data: cleanedQuestionPayload,
      }),
    `Insert ${cleanedQuestionPayload.length} Questions`
  );

  if (!questionInsertResult.success) {
    const msg = 'Failed to insert Questions into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getQuestion = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Questions
    const fetchResult = await fetchQuestionData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Clean and map to local schema
    const cleanedQuestionPayload = mapQuestionsToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertQuestionsToDb(cleanedQuestionPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedQuestionPayload.length} Questions`,
      data: { count: cleanedQuestionPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getQuestion: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
