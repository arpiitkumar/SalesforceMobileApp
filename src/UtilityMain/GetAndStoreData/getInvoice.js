// auth/GetAndStoreData/getInvoice.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Invoices query
 */
const buildInvoiceQuery = () => `
  SELECT Id, Name, SupplierName__c, InvoiceNo__c, Return_Submitted__c, Outstanding_Amount__c, InvoiceDate__c, Order__c, Customer__c, Status__c, Total_Net_Amount__c, Total_Sales_Return_Value__c, Return_Adjusted_Against_Outstanding__c FROM Invoice__c WHERE InvoiceDate__c >= LAST_N_MONTHS:1
`;
// const buildInvoiceQuery = () => `
//   SELECT Id, Name, SupplierName__c, InvoiceNo__c, Return_Submitted__c, Outstanding_Amount__c, InvoiceDate__c, Order__c, Customer__c, Status__c, Total_Net_Amount__c, Total_Sales_Return_Value__c, Return_Adjusted_Against_Outstanding__c FROM Invoice__c WHERE InvoiceDate__c >= LAST_N_DAYS:20
// `;

/**
 * Fetch Invoices from Salesforce
 */
const fetchInvoiceData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const invoice_query = buildInvoiceQuery();

  try {
    const data_invoice = await fetchRecords('Invoice__c', invoice_query, accessToken, instanceUrl);
    if (!Array.isArray(data_invoice)) {
      throw new Error('Invalid data type for Invoices');
    }
    console.log(`Fetched ${data_invoice.length} Invoices`);
    return { success: true, data: data_invoice };
  } catch (err) {
    const msg = `Failed to fetch Invoices: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Invoices to local schema (EXACT same mapping as your code)
 */
const mapInvoicesToLocalSchema = (data_invoice = []) =>
  data_invoice.map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    SupplierName__c: item.SupplierName__c ?? '',
    InvoiceNo__c: item.InvoiceNo__c ?? '',
    InvoiceDate__c: item.InvoiceDate__c ?? '',
    Order__c: item.Order__c ?? '',
    Customer__c: item.Customer__c ?? '',
    Return_Submitted__c: item.Return_Submitted__c ?? false,
    Status__c: item.Status__c ?? '',
    AdditionalDiscount__c: item.AdditionalDiscount__c ?? 0,
    TotalGSTAmt__c: item.TotalGSTAmt__c ?? 0,
    GSTRATE__c: item.GSTRATE__c ?? 0,
    Total_Net_Amount__c: item.Total_Net_Amount__c ?? 0,
    Return_Adjusted_Against_Outstanding__c: item.Return_Adjusted_Against_Outstanding__c ?? 0,
    Total_Sales_Return_Value__c: item.Total_Sales_Return_Value__c ?? 0,
    Outstanding_Amount__c: item.Outstanding_Amount__c ?? 0,

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Invoices into local database
 */
const insertInvoicesToDb = async (cleanedInvoicePayload) => {
  const invoiceInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Invoice__c',
        Type: 'insert',
        data: cleanedInvoicePayload,
      }),
    `Insert ${cleanedInvoicePayload.length} Invoices`
  );

  if (!invoiceInsertResult.success) {
    const msg = 'Failed to insert Invoices into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getInvoice = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Invoices
    const fetchResult = await fetchInvoiceData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedInvoicePayload = mapInvoicesToLocalSchema(fetchResult.data);

    // Step 3: Insert into database
    const insertResult = await insertInvoicesToDb(cleanedInvoicePayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedInvoicePayload.length} Invoices`,
      data: { count: cleanedInvoicePayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getInvoice: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
