// auth/GetAndStoreData/getOrderItem.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation, safeProgress } from '../syncUtils';

/**
 * Nested Order query with OrderItems
 */
// const buildOrderItemQuery = () => `
//   SELECT ID, OrderNumber, OrderPlacedBy__c, Source__c, AccountId, EffectiveDate, 
//          OrderSubmissionTime__c, Status, OrderRejectionReason__c, TotalAmount, 
//          (SELECT Id, Product2Id, Quantity, AdditionalDiscount__c, NetAmount__c, 
//                  PricebookEntryId, OrderQtyInCase__c, GrossAmount__c, 
//                  Reason_Of_Return__c, Invoice_Item__c, Sales_Return_Value__c, Order_Quantity_In_Kg__c,
//                  CreatedDate, UnitPrice 
//           FROM OrderItems) 
//   FROM Order 
//   WHERE OrderSubmissionTime__c >= LAST_N_MONTHS:1
// `;
const buildOrderItemQuery = () => `
  SELECT Id, OrderId__c, Product2Id__c, Entered_Quantity__c,
         UOM_Selected__c, Net_Amount__c, Tax_Amount__c, UnitPrice__c,
         TotalPrice__c, CGST_Amount__c, SGST_Amount__c, IGST_Amount__c,
         CreatedDate
  FROM Order_Item__c
  WHERE CreatedDate = LAST_N_DAYS:30
`;

/**
 * Fetch Orders with nested OrderItems
 */
const fetchOrderItemData = async ({ fetchRecords, accessToken, instanceUrl, onProgress }) => {
  safeProgress && safeProgress(' Fetching Spot Sales Items...', onProgress);

  const fieldNamesOrderItem = buildOrderItemQuery();

  try {
    const resItem = await fetchRecords('Order_Item__c', fieldNamesOrderItem, accessToken, instanceUrl);
    if (!Array.isArray(resItem)) {
      throw new Error('Invalid data type for Spot Sales Items');
    }
    console.log(`Fetched ${resItem.length} Orders with items`);
    return { success: true, data: resItem };
  } catch (err) {
    const msg = `Failed to fetch Spot Sales Items: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Flatten nested OrderItems (EXACT same logic as your code)
 */
const flattenOrderItems = (resItem = []) =>
  resItem.map(item => ({
      Sf_Id: item.Id,
      OrderId: item.OrderId__c || '',
      Product2Id: item.Product2Id__c || '',
      Quantity: item.Entered_Quantity__c || 0,
      UOM__c: item.UOM_Selected__c || '',
      NetAmount__c: item.NetAmount__c || 0,
      TaxableAmount__c: item.Tax_Amount__c || 0,
      UnitPrice: item.UnitPrice__c || 0,
      GrossAmount__c: item.TotalPrice__c || 0,
      CGST_Amount__c: item.CGST_Amount__c || 0,
      SGST_Amount__c: item.SGST_Amount__c || 0,
      IGST_Amount__c: item.IGST_Amount__c || 0,
      CreatedDate: item.CreatedDate || 0,

      // sync metadata (added to match your other modules)
      last_modified: Date.now(),
      is_synced: true,
      is_locally_changed: false,
      operation_type: 'insert',
    }));

/**
 * Insert Order Items into local database
 */
const insertOrderItemsToDb = async (orderItemsFlattened) => {
  const orderItemInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'OrderItem',
        Type: 'insert',
        data: orderItemsFlattened,
      }),
    `Insert ${orderItemsFlattened.length} Spot Sales Items`
  );

  if (!orderItemInsertResult.success) {
    const msg = 'Failed to insert Spot Sales Items into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getOrderItem = async ({ fetchRecords, accessToken, instanceUrl, onProgress }) => {
  try {
    // Step 1: Fetch Orders with nested OrderItems
    const fetchResult = await fetchOrderItemData({ fetchRecords, accessToken, instanceUrl, onProgress });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Flatten nested OrderItems
    const orderItemsFlattened = flattenOrderItems(fetchResult.data);
    console.log(`📦 Flattened ${orderItemsFlattened.length} Spot Sales Items`);

    // Step 3: Insert into database
    const insertResult = await insertOrderItemsToDb(orderItemsFlattened);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${orderItemsFlattened.length} Spot Sales Items`,
      data: { count: orderItemsFlattened.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getOrderItem: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
