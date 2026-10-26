// auth/GetAndStoreData/getCompetitorMasterHTSO.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

// 1. SOQL query (active only)
const buildCompetitorMasterQuery = () => `
  SELECT Id, IsActive__c, Address__c, Name, Zone__c
  FROM CompetitorMaster__c
  WHERE IsActive__c = true
`;

// 2. Fetch from Salesforce
const fetchCompetitorMasterData = async ({ fetchRecords, accessToken, instanceUrl }) => {
  const competitorMasterQuery = buildCompetitorMasterQuery();

  try {
    const CompetitorMasterData = await fetchRecords(
      'CompetitorMaster__c',
      competitorMasterQuery,
      accessToken,
      instanceUrl
    );
    if (!Array.isArray(CompetitorMasterData)) {
      throw new Error('Invalid data type for Competitor Master');
    }
    console.log(`Fetched ${CompetitorMasterData.length} Competitor Master records (HTSO)`);
    return { success: true, data: CompetitorMasterData };
  } catch (err) {
    const msg = `Failed to fetch Competitor Master: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

// 3. Map to local schema
const mapCompetitorMasterToLocalSchema = (CompetitorMasterData = []) =>
  (CompetitorMasterData || []).map(item => ({
    Sf_Id: item.Id,
    IsActive__c: item.IsActive__c ?? false,
    Address__c: item.Address__c || '',
    Name: item.Name || '',
    Zone__c: item.Zone__c || '',
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

// 4. Insert into local DB
const insertCompetitorMasterToDb = async cleanedCompetitorMasterPayload => {
  if (!cleanedCompetitorMasterPayload.length) {
    console.log('⚠️ No Competitor Master records to insert (HTSO)');
    return { success: true };
  }

  const competitorMasterInsertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'CompetitorMaster__c',
        Type: 'insert',
        data: cleanedCompetitorMasterPayload,
      }),
    `Insert ${cleanedCompetitorMasterPayload.length} Competitor Master records (HTSO)`
  );

  if (!competitorMasterInsertResult.success) {
    const msg = 'Failed to insert Competitor Master into local database (HTSO)';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  return { success: true };
};

// 5. Main exported function
export const getCompetitorMasterHTSO = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const fetchResult = await fetchCompetitorMasterData({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const cleanedCompetitorMasterPayload = mapCompetitorMasterToLocalSchema(
      fetchResult.data
    );

    const insertResult = await insertCompetitorMasterToDb(
      cleanedCompetitorMasterPayload
    );
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${cleanedCompetitorMasterPayload.length} Competitor Master records (HTSO)`,
      data: { count: cleanedCompetitorMasterPayload.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getCompetitorMasterHTSO: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
