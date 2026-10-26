// auth/GetAndStoreData/getCompetitorMasterMT.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';

/**
 * CompetitorMaster__c query
 */
const buildCompetitorMasterQuery = () => `
  SELECT Id, IsActive__c, Address__c, Name, Zone__c
  FROM CompetitorMaster__c Where Active_For_MT_SO__c = true
`;

/**
 * Fetch CompetitorMaster__c from Salesforce
 */
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
        console.log(`Fetched ${CompetitorMasterData.length} Competitor Master records`);
        return { success: true, data: CompetitorMasterData };
    } catch (err) {
        const msg = `Failed to fetch Competitor Master: ${err.message}`;
        showErrorToast(msg);
        return { success: false, message: msg };
    }
};

/**
 * Map CompetitorMaster__c to local schema (EXACT same mapping as your code)
 */
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

/**
 * Insert CompetitorMaster__c into local database
 */
const insertCompetitorMasterToDb = async (cleanedCompetitorMasterPayload) => {
    if (cleanedCompetitorMasterPayload.length === 0) {
        console.log('⚠️ No Competitor Master records to insert');
        return { success: true };
    }

    const competitorMasterInsertResult = await safeDatabaseOperation(
        () =>
            UniversalUpdateInsert({
                ObjectName: 'CompetitorMaster__c',
                Type: 'insert',
                data: cleanedCompetitorMasterPayload,
            }),
        `Insert ${cleanedCompetitorMasterPayload.length} Competitor Master records`
    );

    if (!competitorMasterInsertResult.success) {
        const msg = 'Failed to insert Competitor Master into local database';
        showErrorToast(msg);
        return { success: false, message: msg };
    }

    return { success: true };
};

/**
 * Main exported function
 */
export const getCompetitorMasterMT = async ({ fetchRecords, accessToken, instanceUrl }) => {
    try {
        // Step 1: Fetch CompetitorMaster__c
        const fetchResult = await fetchCompetitorMasterData({ fetchRecords, accessToken, instanceUrl });
        if (!fetchResult.success) {
            return { success: false, status: 'error', message: fetchResult.message };
        }

        // Step 2: Map to local schema
        const cleanedCompetitorMasterPayload = mapCompetitorMasterToLocalSchema(fetchResult.data);

        // Step 3: Insert into database (only if data exists)
        const insertResult = await insertCompetitorMasterToDb(cleanedCompetitorMasterPayload);
        if (!insertResult.success) {
            return { success: false, status: 'error', message: insertResult.message };
        }

        return {
            success: true,
            status: 'ok',
            message: `Synced ${cleanedCompetitorMasterPayload.length} Competitor Master records`,
            data: { count: cleanedCompetitorMasterPayload.length },
        };
    } catch (err) {
        const msg = `Unexpected error in getCompetitorMasterMT: ${err.message}`;
        showErrorToast(msg);
        return { success: false, status: 'error', message: msg };
    }
};
