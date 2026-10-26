// auth/GetAndStoreData/getOrder.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Orders query for current month
 */
// const buildOrderQuery = () => `
//   SELECT Id,
//          Secondary_Order_Supplier__c,
//          Fulfillment_Status__c,
//          Return_Category__c,
//          ReturnDate__c,
//          TypeOfReturn__c,
//          Pricebook2Id,
//          OrderNumber,
//          Total_Net_Amount__c,
//          CreatedDate,
//          Visit__c,
//          OrderSubmissionTime__c,
//          AccountId,
//          OrderPlacedBy__c,
//          Source__c,
//          TotalOrderQtyInPcs__c,
//          TotalReturnQuantity__c,
//          Status,
//          EffectiveDate,
//          Beat__c,
//          RecordTypeId,
//          Total_Return_Value__c,
//          Invoices__c
//   FROM Order
//   WHERE OrderSubmissionTime__c >= LAST_N_MONTHS:1
// `;

const buildOrderQuery = () => `
  SELECT Id, CreatedDate, AccountId__c, AccountId__r.Name, Status__c, Name
  FROM Order__c
  WHERE CreatedDate = LAST_N_DAYS:30
`;

/**
 * Fetch Orders from Salesforce
 */
const fetchOrderData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const query_order = buildOrderQuery();

  try {
    let data_order = await fetchRecords('Order__c', query_order, accessToken, instanceUrl);
    if (!Array.isArray(data_order)) data_order = [];
    if (!Array.isArray(data_order)) {
      data_order = [];
    }
    console.log(`Fetched ${data_order.length} Spot Sales`);
    return { success: true, data: data_order };
  } catch (err) {
    const msg = `Failed to fetch Spot Sales: ${err.message}`;
    console.error(msg);
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Orders to local schema (EXACT same mapping as your code)
 */
const mapOrdersToLocalSchema = (data_order = []) =>
  data_order.map(item => ({
    Sf_Id: item.Id ?? '',
    Type: item.Type ?? '',
    Total_Return_Value__c: item.Total_Return_Value__c ?? '',
    zRecordType: item.zRecordType ?? '',
    Secondary_Order_Supplier__c: item.Secondary_Order_Supplier__c ?? '',
    AccountId: item.AccountId__c ?? item.AccountId ?? '',
    AccountId__c: item.AccountId__c ?? item.AccountId ?? '',
    OrderPlacedBy__c: item.Order_Placed_By__c ?? item.OrderPlacedBy__c ?? '',
    Source__c: item.Order_Source__c ?? item.Source__c ?? 'SFA',
    OrderSubmissionTime__c: item.Order_Submission_DateTime__c || item.OrderSubmissionTime__c || item.CreatedDate || new Date().toISOString(),
    Status: item.Status__c || item.Status || '',
    Status__c: item.Status__c || item.Status || '',
    TotalAmount: item.Total_Net_Amount__c ?? item.TotalAmount ?? 0,
    TotalOrderQtyKg__c: item.TotalOrderQtyKg__c ?? 0,
    TotalReturnQuantity__c: item.TotalReturnQuantity__c ?? 0,
    TotalOrderQtyInPcs__c: item.TotalOrderQtyInPcs__c ?? 0,
    FulfilledQtyKg__c: item.FulfilledQtyKg__c ?? 0,
    TotalFulfilledValue__c: item.TotalFulfilledValue__c ?? 0,
    RejectedQtyKg__c: item.RejectedQtyKg__c ?? 0,
    RejectedValue__c: item.RejectedValue__c ?? 0,
    Visit__c: item.Visit__c ?? '',
    Invoices__c: item.Invoices__c ?? '',
    RecordTypeId: item.RecordTypeId ?? '',
    OrderNumber: item.Name || item.OrderNumber || item.Id,
    Fulfillment_Status__c: item.Fulfillment_Status__c ?? '',
    Mobile_Unique_Id__c: item.Mobile_Unique_Id__c ?? '',
    CreatedDate: item.CreatedDate ?? '',
    Pricebook2Id: item.Pricebook2Id ?? '',
    Return_Category__c: item.Return_Category__c ?? '',
    ReturnDate__c: item.ReturnDate__c ?? '',
    TypeOfReturn__c: item.TypeOfReturn__c ?? '',
    Beat__c: item.Beat__c ?? '',
    IsNonDmsOrder__c: item.IsNonDmsOrder__c === true || item.IsNonDmsOrder__c === 'true' || item.OrderType__c === 'NON_DMS' || item.IsNonDmsOrder__c || false,
    OrderType: item.OrderType__c || (item.IsNonDmsOrder__c ? 'NON_DMS' : 'DMS'),

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Orders into local database
 */
const insertOrdersToDb = async (cleanedOrderPayload) => {
  const orderInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Order',
        Type: 'insert',
        data: cleanedOrderPayload,
      }),
    `Insert ${cleanedOrderPayload.length} Spot Sales`
  );

  if (!orderInsertResult.success) {
    const msg = 'Failed to insert Spot Sales into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getOrder = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Orders
    const fetchResult = await fetchOrderData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedOrderPayload = mapOrdersToLocalSchema(fetchResult.data);

    // Step 3: Insert into database
    const insertResult = await insertOrdersToDb(cleanedOrderPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedOrderPayload.length} Spot Sales`,
      data: { count: cleanedOrderPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getOrder: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
