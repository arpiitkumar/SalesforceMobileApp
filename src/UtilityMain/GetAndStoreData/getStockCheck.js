// auth/GetAndStoreData/getStockCheck.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation, safeProgress } from '../syncUtils';

/**
 * Stock Check query with all fields
 */
// const buildStockCheckQuery = (loggedInUser) => `
//   SELECT
//     Id, Name, Visit__c, Account__c, SKU__c, Available__c, Not_Available__c,
//     Stock_Check_Date__c, CreatedDate, Checked_By__c, Persona__c, Visit_Date__c,
//     Opening_Stock_Qty__c, Opening_MT__c, Opening_Value__c,
//     Primary_Stock_Qty__c, Primary_MT__c, Primary_Value__c,
//     Secondary_Stock_Qty__c, Secondary_MT__c, Secondary_Value__c,
//     Current_Stock_Qty__c, Current_Stock_MT__c, Current_Stock_Value__c,
//     Today_Secondary_Sales_Qty__c, Today_Secondary_Sales_MT__c, Today_Secondary_Sales_Value__c,
//     Closing_Stock_Qty__c, Closing_MT__c, Beat_Day__c, Closing_Value__c,
//     ProductName__c, Expiration_Date__c, Facing__c, Photo__c, Quantity__c,
//     Oil_Type__c, Category__c
//   FROM Stock_Check__c Where Checked_By__c='${loggedInUser.Sf_Id}'  And CreatedDate >= LAST_N_MONTHS:1
// `;

const buildStockCheckQuery = (loggedInUser) => `
  SELECT
    Id, Name, Visit__c, Account__c, SKU__c, Available__c, Not_Available__c,
    Stock_Check_Date__c, CreatedDate, Checked_By__c, Persona__c, Visit_Date__c,
    Opening_Stock_Qty__c, Opening_MT__c, Opening_Value__c,
    Primary_Stock_Qty__c, Primary_MT__c, Primary_Value__c,
    Secondary_Stock_Qty__c, Secondary_MT__c, Secondary_Value__c,
    Current_Stock_Qty__c, Current_Stock_MT__c, Current_Stock_Value__c,
    Today_Secondary_Sales_Qty__c, Today_Secondary_Sales_MT__c, Today_Secondary_Sales_Value__c,
    Closing_Stock_Qty__c, Closing_MT__c, Beat_Day__c, Closing_Value__c,
    ProductName__c, Expiration_Date__c, Facing__c, Photo__c, Quantity__c,
    Oil_Type__c, Category__c
  FROM Stock_Check__c Where Checked_By__c='${loggedInUser.Sf_Id}'  And CreatedDate >= LAST_N_DAYS:20
`;

/**
 * Fetch Stock Check records from Salesforce
 */
const fetchStockCheckData = async ({ fetchRecords, accessToken, instanceUrl, onProgress, loggedInUser }) => {
  safeProgress && safeProgress('Fetching Stock Check...', onProgress);

  const Stock_CheckQuery = buildStockCheckQuery(loggedInUser);
  // console.log('Stock_CheckQuery',Stock_CheckQuery)
  try {
    const Stock_CheckData = await fetchRecords('Stock_Check__c', Stock_CheckQuery, accessToken, instanceUrl);
    if (!Array.isArray(Stock_CheckData)) {
      throw new Error('Invalid data type for Stock Check');
    }
    console.log(`Fetched ${Stock_CheckData.length} Stock Check records`);
    return { success: true, data: Stock_CheckData };
  } catch (err) {
    const msg = `Failed to fetch Stock Check: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Stock Check to local schema (EXACT same mapping as your code)
 */
const mapStockCheckToLocalSchema = (Stock_CheckData = []) =>
  (Stock_CheckData || []).map(item => ({
    Sf_Id: item.Id ?? '',
    Name: item.Name ?? '',
    Visit__c: item.Visit__c ?? '',
    Account__c: item.Account__c ?? '',
    SKU__c: item.SKU__c ?? '',
    Available__c: item.Available__c ?? '',
    Not_Available__c: item.Not_Available__c ?? '',
    Stock_Check_Date__c: item.Stock_Check_Date__c ?? '',
    CreatedDate: item.CreatedDate ?? '',
    Checked_By__c: item.Checked_By__c ?? '',
    Persona__c: item.Persona__c ?? '',
    Visit_Date__c: item.Visit_Date__c ?? '',
    Opening_Stock_Qty__c: item.Opening_Stock_Qty__c ?? 0,
    Opening_MT__c: item.Opening_MT__c ?? 0,
    Opening_Value__c: item.Opening_Value__c ?? 0,
    Primary_Stock_Qty__c: item.Primary_Stock_Qty__c ?? 0,
    Primary_MT__c: item.Primary_MT__c ?? 0,
    Primary_Value__c: item.Primary_Value__c ?? 0,
    Secondary_Stock_Qty__c: item.Secondary_Stock_Qty__c ?? 0,
    Secondary_MT__c: item.Secondary_MT__c ?? 0,
    Secondary_Value__c: item.Secondary_Value__c ?? 0,
    Current_Stock_Qty__c: item.Current_Stock_Qty__c ?? 0,
    Current_Stock_MT__c: item.Current_Stock_MT__c ?? 0,
    Current_Stock_Value__c: item.Current_Stock_Value__c ?? 0,
    Today_Secondary_Sales_Qty__c: item.Today_Secondary_Sales_Qty__c ?? 0,
    Today_Secondary_Sales_MT__c: item.Today_Secondary_Sales_MT__c ?? 0,
    Today_Secondary_Sales_Value__c: item.Today_Secondary_Sales_Value__c ?? 0,
    Closing_Stock_Qty__c: item.Closing_Stock_Qty__c ?? 0,
    Closing_MT__c: item.Closing_MT__c ?? 0,
    Closing_Value__c: item.Closing_Value__c ?? 0,
    Beat_Day__c: item.Beat_Day__c ?? 0,
    ProductName__c: item.ProductName__c ?? '',
    Expiration_Date__c: item.Expiration_Date__c ?? '',
    Facing__c: item.Facing__c ?? '',
    Photo__c: item.Photo__c ?? '',
    Quantity__c: item.Quantity__c ?? 0,
    Oil_Type__c: item.Oil_Type__c ?? '',
    Category__c: item.Category__c ?? '',
    UOM__c: item.UOM__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Stock Check into local database
 */
const insertStockCheckToDb = async (cleanedStock_CheckPayload) => {
  if (cleanedStock_CheckPayload.length === 0) {
    console.log('⚠️ No Stock Check records to insert');
    return { success: true };
  }

  const stockCheckInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Stock_Check__c',
        Type: 'insert',
        data: cleanedStock_CheckPayload,
      }),
    `Insert ${cleanedStock_CheckPayload.length} Stock Check records`
  );

  if (!stockCheckInsertResult.success) {
    const msg = 'Failed to insert Stock Check into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getStockCheck = async ({ fetchRecords, accessToken, instanceUrl, onProgress, loggedInUser }) => {
  try {
    // Step 1: Fetch Stock Check records
    const fetchResult = await fetchStockCheckData({ fetchRecords, accessToken, instanceUrl, onProgress, loggedInUser });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedStock_CheckPayload = mapStockCheckToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertStockCheckToDb(cleanedStock_CheckPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedStock_CheckPayload.length} Stock Check records`,
      data: { count: cleanedStock_CheckPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getStockCheck: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
