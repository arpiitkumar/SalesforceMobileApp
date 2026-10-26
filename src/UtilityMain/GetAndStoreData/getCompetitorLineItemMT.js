// auth/GetAndStoreData/getCompetitorLineItemMT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Competitor_LineItem__c query with all fields
 */
const buildCompetitorLineItemQuery = () => `
  SELECT Id, Activity__c, Competitor__c, Grammage__c, Grammage_Before_Promotion__c,
         MRP__c, OilType__c, Photo__c, Product_Name__c, Promotion__c, Remarks__c,
         Selling_Price__c, Type__c, Merchandiser__c, Customer__c, Category__c, Sub_Category__c,
         Name, Product__c, Price_MT__c, State__c, City__c, Vertical__c, Date__c, PTD__c, Grammage_Type__c
  FROM Competitor_LineItem__c WHERE CreatedDate = THIS_MONTH
`;

/**
 * Fetch Competitor_LineItem__c from Salesforce
 */
const fetchCompetitorLineItemData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const competitorLineItemQuery = buildCompetitorLineItemQuery();

  try {
    const CompetitorLineItemData = await fetchRecords(
      'Competitor_LineItem__c',
      competitorLineItemQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(CompetitorLineItemData)) {
      throw new Error('Invalid data type for Competitor Line Item');
    }
    console.log(`Fetched ${CompetitorLineItemData.length} Competitor Line Item records`);
    return { success: true, data: CompetitorLineItemData };
  } catch (err) {
    const msg = `Failed to fetch Competitor Line Item: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Competitor_LineItem__c to local schema (EXACT same mapping as your code)
 */
const mapCompetitorLineItemToLocalSchema = (CompetitorLineItemData = []) =>
  (CompetitorLineItemData || []).map(item => ({
    Sf_Id: item?.Id ?? '',
    Activity__c: item.Activity__c || '',
    Competitor__c: item.Competitor__c || '',
    Grammage__c: item.Grammage__c || '',
    Grammage_Before_Promotion__c: item.Grammage_Before_Promotion__c || '',
    MRP__c: item.MRP__c || '',
    OilType__c: item.OilType__c || '',
    Photo__c: item.Photo__c || '',
    Product_Name__c: item.Product_Name__c || '',
    Promotion__c: item.Promotion__c || '',
    Remarks__c: item.Remarks__c || '',
    Selling_Price__c: item.Selling_Price__c || 0,
    Type__c: item.Type__c || '',
    Merchandiser__c: item.Merchandiser__c || '',
    Customer__c: item.Customer__c || '',
    Category__c: item.Category__c || '',
    Name: item.Name || '',
    Sub_Category__c: item.Sub_Category__c || '',
    Product__c: item.Product__c || '',
    Price_MT__c: item.Price_MT__c || '',
    State__c: item.State__c || '',
    City__c: item.City__c || '',
    Vertical__c: item.Vertical__c || '',
    Date__c: item.Date__c || '',
    PTD__c: item.PTD__c || '',
    Grammage_Type__c: item.Grammage_Type__c || '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Insert Competitor_LineItem__c into local database
 */
const insertCompetitorLineItemToDb = async (cleanedCompetitorLineItemPayload) => {
  if (cleanedCompetitorLineItemPayload.length === 0) {
    console.log('⚠️ No Competitor Line Item records to insert');
    return { success: true };
  }

  const competitorLineItemInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Competitor_LineItem__c',
        Type: 'insert',
        data: cleanedCompetitorLineItemPayload,
      }),
    `Insert ${cleanedCompetitorLineItemPayload.length} Competitor Line Item records`
  );

  if (!competitorLineItemInsertResult.success) {
    const msg = 'Failed to insert Competitor Line Item into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getCompetitorLineItemMT = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Competitor_LineItem__c
    const fetchResult = await fetchCompetitorLineItemData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedCompetitorLineItemPayload = mapCompetitorLineItemToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertCompetitorLineItemToDb(cleanedCompetitorLineItemPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedCompetitorLineItemPayload.length} Competitor Line Item records`,
      data: { count: cleanedCompetitorLineItemPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getCompetitorLineItemMT: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
