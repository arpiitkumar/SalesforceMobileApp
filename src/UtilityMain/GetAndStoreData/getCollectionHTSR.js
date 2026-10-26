// auth/GetAndStoreData/getCollectionHTSR.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

// 1. Build query
const buildCollectionQuery = () => `
  SELECT Id, Name, Comment__c, DateOfPayment__c, PaidAmount__c, BankName__c,
         ChequeApproveDate__c, ChequeNEFTDate__c, Visit__c, ChequeNumber__c,
         Customer__c, PaymentMode__c, CollectionType__c
  FROM Collection__c WHERE CreatedDate >= LAST_N_MONTHS:2
`;

// 2. Map SF records → local schema
const mapCollectionToLocalSchema = (records = []) =>
  records.map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Comment__c: item.Comment__c ?? '',
    DateOfPayment__c: item.DateOfPayment__c ?? '',
    PaidAmount__c: item.PaidAmount__c ?? 0,
    BankName__c: item.BankName__c ?? '',
    ChequeApproveDate__c: item.ChequeApproveDate__c ?? '',
    ChequeNEFTDate__c: item.ChequeNEFTDate__c ?? '',
    Visit__c: item.Visit__c ?? '',
    ChequeNumber__c: item.ChequeNumber__c ?? '',
    Customer__c: item.Customer__c ?? '',
    PaymentMode__c: item.PaymentMode__c ?? '',
    CollectionType__c: item.CollectionType__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

// 3. Fetch from Salesforce
const fetchCollectionFromSalesforce = async (accessToken, instanceUrl, fetchRecords) => {
  const query_collection = buildCollectionQuery();
  console.log(query_collection);

  try {
    const data_collection = await fetchRecords('Collection__c', query_collection, accessToken, instanceUrl);
    if (!Array.isArray(data_collection)) {
      throw new Error('Invalid data type for Collection__c');
    }
    console.log(`Fetched ${data_collection.length} Collection__c records`);
    return { success: true, data: data_collection };
  } catch (err) {
    const msg = `Failed to fetch Collection__c: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

// 4. Insert into local DB
const insertCollectionToDb = async (payload) => {
  const collectionInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Collection__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} Collection__c records`
  );

  if (!collectionInsertResult.success) {
    const msg = 'Failed to insert Collection__c records into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

// 5. Main exported function
export const getCollectionHTSR = async ({
  accessToken,
  instanceUrl,
  fetchRecords,
}) => {
  try {
    // Step 1: fetch from Salesforce
    const fetchResult = await fetchCollectionFromSalesforce(accessToken, instanceUrl, fetchRecords);
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: map to local schema
    const cleanedCollectionPayload = mapCollectionToLocalSchema(fetchResult.data);

    // Step 3: insert into local DB
    const insertResult = await insertCollectionToDb(cleanedCollectionPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    console.log(`Collection__c sync completed: ${cleanedCollectionPayload.length} records`);
    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedCollectionPayload.length} Collection__c records`,
    };
  } catch (err) {
    const msg = `Unexpected error in getCollectionHTSR: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
