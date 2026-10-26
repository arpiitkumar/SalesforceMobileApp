// auth/GetAndStoreData/getQuestionOption.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Question Options query
 */
const buildQuestionOptionQuery = () => `
  SELECT Id, Name, Question__c, Active__c 
  FROM Question_Option__c
`;

/**
 * Fetch Question Options from Salesforce
 */
const fetchQuestionOptionData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const Question_Option__cQuery = buildQuestionOptionQuery();

  try {
    const Question_Option__cData = await fetchRecords('Question_Option__c', Question_Option__cQuery, accessToken, instanceUrl);
    if (!Array.isArray(Question_Option__cData)) {
      throw new Error('Invalid data type for Question Options');
    }
    console.log(`Fetched ${Question_Option__cData.length} Question Options`);
    return { success: true, data: Question_Option__cData };
  } catch (err) {
    const msg = `Failed to fetch Question Options: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Clean and map Question Options to local schema (EXACT same logic as your code)
 */
const mapQuestionOptionsToLocalSchema = (Question_Option__cData = []) => {
  const cleanOptionArray = Array.isArray(Question_Option__cData) ? Question_Option__cData.filter(Boolean) : [];

  return cleanOptionArray.map(item => ({
    Sf_Id: item?.Id ?? '',
    Name: item?.Name ?? '',
    Question__c: item?.Question__c ?? '',
    Active__c: item?.Active__c ?? false,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));
};

/**
 * Insert Question Options into local database
 */
const insertQuestionOptionsToDb = async (cleanedQuestionOptionPayload) => {
  if (!cleanedQuestionOptionPayload.length) {
    console.log('⚠️ No Question Options to insert');
    return { success: true };
  }

  const questionOptionInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Question_Option__c',
        Type: 'insert',
        data: cleanedQuestionOptionPayload,
      }),
    `Insert ${cleanedQuestionOptionPayload.length} Question Options`
  );

  if (!questionOptionInsertResult.success) {
    const msg = 'Failed to insert Question Options into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getQuestionOption = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Question Options
    const fetchResult = await fetchQuestionOptionData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Clean and map to local schema
    const cleanedQuestionOptionPayload = mapQuestionOptionsToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertQuestionOptionsToDb(cleanedQuestionOptionPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedQuestionOptionPayload.length} Question Options`,
      data: { count: cleanedQuestionOptionPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getQuestionOption: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
