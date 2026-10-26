// auth/GetAndStoreData/getCompetitorProductHTSO.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * Competitor Product query (Product2 filtered for competitors)
 */
const buildCompetitorProductQuery = () => `
  SELECT Id, Name, Brand__c, Category__c, SubCategory__c, OilType__c,
         Vertical__c, IsBaseSKU__c, IsActive__c, ProductImageURL__c
  FROM Product2 
  WHERE IsActive = true AND IsBaseSKU__c = true AND Vertical__c = '40'
`;

/**
 * Fetch Competitor Products from Salesforce
 */
const fetchCompetitorProductData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const competitorProductQuery = buildCompetitorProductQuery();

  try {
    const CompetitorProductData = await fetchRecords(
      'Product2',
      competitorProductQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(CompetitorProductData)) {
      throw new Error('Invalid data type for Competitor Product');
    }
    console.log(`🔥 Fetched ${CompetitorProductData.length} Competitor Product records`);
    return { success: true, data: CompetitorProductData };
  } catch (err) {
    const msg = `Failed to fetch Competitor Product: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Map Competitor Product to local schema (EXACT same mapping as your code)
 */
const mapCompetitorProductToLocalSchema = (CompetitorProductData = []) =>
  (CompetitorProductData || []).map(item => ({
    Sf_Id: item.Id,
    Name: item.Name || '',
    Brand__c: item.Brand__c || '',
    Category__c: item.Category__c || '',
    SubCategory__c: item.SubCategory__c || '',
    OilType__c: item.OilType__c || '',
    Vertical__c: item.Vertical__c || '',
    IsBaseSKU__c: item.IsBaseSKU__c ?? false,
    IsActive: item.IsActive__c ?? false,
    ProductImageURL__c: item.ProductImageURL__c || '',

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
    SoftDelete: false,
  }));

/**
 * Insert Competitor Product into local database
 */
const insertCompetitorProductToDb = async (cleanedCompetitorProductPayload) => {
  if (cleanedCompetitorProductPayload.length === 0) {
    console.log('⚠️ No Competitor Product records to insert');
    return { success: true };
  }

  const competitorProductInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Competitor__Product',
        Type: 'insert',
        data: cleanedCompetitorProductPayload,
      }),
    `Insert ${cleanedCompetitorProductPayload.length} Competitor Product records`
  );

  if (!competitorProductInsertResult.success) {
    const msg = 'Failed to insert Competitor Product into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/**
 * Main exported function
 */
export const getCompetitorProductHTSO = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    // Step 1: Fetch Competitor Products
    const fetchResult = await fetchCompetitorProductData({ fetchRecords, accessToken, instanceUrl });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 2: Map to local schema
    const cleanedCompetitorProductPayload = mapCompetitorProductToLocalSchema(fetchResult.data);

    // Step 3: Insert into database (only if data exists)
    const insertResult = await insertCompetitorProductToDb(cleanedCompetitorProductPayload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedCompetitorProductPayload.length} Competitor Product records`,
      data: { count: cleanedCompetitorProductPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getCompetitorProductHTSO: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
