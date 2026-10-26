// auth/GetAndStoreData/getInvoiceItemsHNT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Invoice_Item__c query with Product relationship
 */
// const buildInvoiceItemQuery = () => `
//   SELECT Id, Product__r.Name, Product__r.ProductCode, InvoiceQuantityPcs__c, Product__c,
//          RatePerPC__c, Gross_Amount__c, CGSTAmount__c, SGSTAmount__c, IGSTAmount__c, 
//          Invoice__c, NetAmount__c, Invoice_Quantity_In_Mt__c, Return_Quantity_in_Pcs__c,SchemeDiscount__c
//   FROM Invoice_Item__c WHERE Invoice__r.InvoiceDate__c >= LAST_N_MONTHS:1
// `;
const buildInvoiceItemQuery = () => `
  SELECT Id, Product__r.Name, Product__r.ProductCode, InvoiceQuantityPcs__c, Product__c,
         RatePerPC__c, Gross_Amount__c, CGSTAmount__c, SGSTAmount__c, IGSTAmount__c, 
         Invoice__c, NetAmount__c, Invoice_Quantity_In_Mt__c, Return_Quantity_in_Pcs__c,SchemeDiscount__c
  FROM Invoice_Item__c WHERE Invoice__r.InvoiceDate__c >= LAST_N_DAYS:20
`;

/**
 * Fetch Invoice Items from Salesforce
 */
const fetchInvoiceItemData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const invoiceItemQuery = buildInvoiceItemQuery();

  try {
    const InvoiceItemData = await fetchRecords('Invoice_Item__c', invoiceItemQuery, accessToken, instanceUrl);
    if (!Array.isArray(InvoiceItemData)) {
      throw new Error('Invalid data type for Invoice Items');
    }
    console.log(`Fetched ${InvoiceItemData.length} Invoice Items`);
    return { success: true, data: InvoiceItemData };
  } catch (err) {
    const msg = `Failed to fetch Invoice Items: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Clean and map Invoice Items to local schema (EXACT same logic as your code)
 */
const mapInvoiceItemsToLocalSchema = (InvoiceItemData = []) => {
  const cleanInvoiceItemArray = Array.isArray(InvoiceItemData) ? InvoiceItemData.filter(Boolean) : [];

  return cleanInvoiceItemArray.map(item => ({
    Sf_Id: item?.Id ?? '',
    Name: item?.Product__r?.Name ?? '',
    Invoice__c: item?.Invoice__c ?? '',
    Product__c: item?.Product__c ?? '',
    ProductCode: item?.Product__r?.ProductCode ?? '',
    InvoiceQuantityPcs__c: item?.InvoiceQuantityPcs__c ?? 0,
    RatePerPC__c: item?.RatePerPC__c ?? 0,
    Gross_Amount__c: item?.Gross_Amount__c ?? 0,
    NetAmount__c: item?.NetAmount__c ?? 0,
    CGSTAmount__c: item?.CGSTAmount__c ?? 0,
    SGSTAmount__c: item?.SGSTAmount__c ?? 0,
    IGSTAmount__c: item?.IGSTAmount__c ?? 0,
    Invoice_Quantity_In_Mt__c: item?.Invoice_Quantity_In_Mt__c ?? 0,
    Return_Quantity_in_Pcs__c: item?.Return_Quantity_in_Pcs__c ?? 0,
    SchemeDiscount__c: item?.SchemeDiscount__c ?? 0,

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));
};

/**
 * Insert Invoice Items into local database
 */
const insertInvoiceItemsToDb = async (cleanedInvoiceItemPayload) => {
  if (cleanedInvoiceItemPayload.length === 0) {
    console.log('⚠️ No Invoice Items to insert');
    return { success: true };
  }

  const invoiceItemInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Invoice_Item__c',
        Type: 'insert',
        data: cleanedInvoiceItemPayload,
      }),
    `Insert ${cleanedInvoiceItemPayload.length} Invoice Items`
  );

  if (!invoiceItemInsertResult.success) {
    const msg = 'Failed to insert Invoice Items into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getInvoiceItemsHNT = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Invoice Items
    const fetchResult = await fetchInvoiceItemData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Clean and map to local schema
    const cleanedInvoiceItemPayload = mapInvoiceItemsToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertInvoiceItemsToDb(cleanedInvoiceItemPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedInvoiceItemPayload.length} Invoice Items`,
      data: { count: cleanedInvoiceItemPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getInvoiceItemsHNT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
