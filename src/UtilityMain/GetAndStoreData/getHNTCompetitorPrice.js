// auth/GetAndStoreData/getHNTCompetitorPrice.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/* =====================================================
   1️⃣ SOQL QUERY
===================================================== */
const buildHNTCompetitorPriceQuery = () => `
  SELECT 
    Id,
    Name,
    Brand__c,
    Benchmark__c,
    Date__c,
    Depot__c,
    Grammage__c,
    NPTD__c,
    NPTR__c,
    Oil_Type__c,
    Others_To_Be_Field_By_HO__c,
    Pack_Type__c,
    Price_Zone__c,
    Product__c,
    PTD__c,
    PTR__c,
    Remarks__c,
    Scheme__c
  FROM HNT_Competitor_Price__c  WHERE Date__c >= LAST_N_MONTHS:2
`;

/* =====================================================
   2️⃣ FETCH FROM SALESFORCE
===================================================== */
const fetchHNTCompetitorPriceData = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  const query = buildHNTCompetitorPriceQuery();

  try {
    const records = await fetchRecords(
      'HNT_Competitor_Price__c',
      query,
      accessToken,
      instanceUrl
    );

    if (!Array.isArray(records)) {
      throw new Error('Invalid data type for HNT_Competitor_Price__c');
    }

    console.log(`Fetched ${records.length} HNT_Competitor_Price records`);
    return { success: true, data: records };
  } catch (err) {
    const msg = `Failed to fetch HNT_Competitor_Price: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/* =====================================================
   3️⃣ MAP TO LOCAL SCHEMA
===================================================== */
const mapHNTCompetitorPriceToLocalSchema = (records = []) =>
  records.map(item => ({
    Sf_Id: item.Id,
    Name: item.Name || '',
    Brand__c: item.Brand__c || '',
    Benchmark__c: item.Benchmark__c || '',
    Date__c: item.Date__c || '',
    Depot__c: item.Depot__c || '',
    Grammage__c: item.Grammage__c || '',
    NPTD__c: item.NPTD__c || '',
    NPTR__c: item.NPTR__c || '',
    Oil_Type__c: item.Oil_Type__c || '',
    Others_To_Be_Field_By_HO__c: item.Others_To_Be_Field_By_HO__c || '',
    Pack_Type__c: item.Pack_Type__c || '',
    Price_Zone__c: item.Price_Zone__c || '',
    Product__c: item.Product__c || '',
    PTD__c: item.PTD__c || '',
    PTR__c: item.PTR__c || '',
    Remarks__c: item.Remarks__c || '',
    Scheme__c: item.Scheme__c || '',

    // Sync flags
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/* =====================================================
   4️⃣ INSERT INTO LOCAL DB
===================================================== */
const insertHNTCompetitorPriceToDb = async cleanedPayload => {
  if (!cleanedPayload.length) {
    console.log('⚠️ No HNT_Competitor_Price records to insert');
    return { success: true };
  }

  const result = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'HNT_Competitor_Price__c',
        Type: 'insert',
        data: cleanedPayload,
      }),
    `Insert ${cleanedPayload.length} HNT_Competitor_Price records`
  );

  if (!result.success) {
    const msg =
      'Failed to insert HNT_Competitor_Price into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

/* =====================================================
   5️⃣ MAIN EXPORTED FUNCTION
===================================================== */
export const getHNTCompetitorPrice = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  try {
    const fetchResult = await fetchHNTCompetitorPriceData({
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedPayload =
      mapHNTCompetitorPriceToLocalSchema(fetchResult.data);

    const insertResult =
      await insertHNTCompetitorPriceToDb(cleanedPayload);

    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedPayload.length} HNT_Competitor_Price records`,
      data: { count: cleanedPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getHNTCompetitorPrice: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
