// auth/GetAndStoreData/getAttendance.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';
import fetchAttendance from '../../utils/setDataApis/fetchAttendance.js';
import database from '../../database/index';


// 1. Fetch attendance records from server
const fetchAttendanceFromServer = async ({ fetchRecords, accessToken, instanceUrl }) => {
  try {
    const attendances = await fetchAttendance(fetchRecords, accessToken, instanceUrl);
    if (!Array.isArray(attendances)) {
      throw new Error('fetchAttendance returned invalid data type');
    }
    console.log(`Fetched ${attendances.length} Attendance records`);
    return { success: true, data: attendances };
  } catch (err) {
    const msg = `Failed to fetch Attendance: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

// 2. Map to local schema
const mapAttendanceToLocalSchema = (attendances = [], creds) =>
  attendances.map(item => ({
    Sf_Id: item?.Id ?? '',
    Name: item?.Name ?? '',
    User__c: item?.User__c || creds.userId,
    AttendanceDate__c: item?.AttendanceDate__c ?? '',
    StartTime__c: item?.AttendanceStartTime__c ?? '',
    EndTime__c: item?.AttendanceEndTime__c ?? '',
    GeoLocation__c: item?.GeoLocation__c
      ? `${item.GeoLocation__c.latitude},${item.GeoLocation__c.longitude}`
      : '',
    Reason__c: item?.Reason__c ?? '',
    AttendanceStatus__c: item?.AttendanceStatus__c ?? '',
    Approval_Status__c: item?.Approval_Status__c ?? '',
    LeaveDuration__c: item?.LeaveDuration__c ?? '',
    CapturedSelfie__c: item?.CapturedSelfie__c ?? '',
    SelfieURL__c: item?.SelfieURL__c ?? '',
    AttendanceBase64: item?.Attendance_Image_URL__c ?? '',
    Other_Leave_Reason__c: item?.Other_Leave_Reason__c ?? '',
    Mobile_Unique_Id__c: item?.Mobile_Unique_Id__c ?? '',
    From_Date__c: item?.From_Date__c ?? '',
    To_Date__c: item?.To_Date__c ?? '',

    // sync metadata
    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

// 3. Insert all attendance records in one go
const insertAttendanceToDb = async (payload) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    console.log('⚠️ No Attendance records to insert');
    return { success: true };
  }

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Attendant__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} Attendance records`
  );

  if (!insertResult.success) {
    const msg = 'Failed to insert Attendance records into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  console.log(`Attendance sync complete: ${payload.length} records inserted`);
  return { success: true };
};

// 4. Main exported function
export const getAttendance = async ({
  creds,
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  try {
    // Step 1: fetch
    const fetchResult = await fetchAttendanceFromServer({
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    if (!fetchResult.success) {
      return { success: false, status: 'error', message: fetchResult.message };
    }

    // Step 1.5: Reconcile and update any local 'LOCAL_...' record Sf_Id
    try {
      const localRecords = await UniversalUpdateInsert({
        ObjectName: 'Attendant__c',
        Type: 'get',
      });

      if (Array.isArray(localRecords) && localRecords.length > 0 && Array.isArray(fetchResult.data)) {
        const collection = database.get('Attendant__c');
        await database.write(async () => {
          for (const serverRec of fetchResult.data) {
            const sfId = serverRec.Id;
            const dateVal = serverRec.AttendanceDate__c;
            const userVal = serverRec.User__c;
            if (!sfId || !dateVal || !userVal) continue;

            const matchingLocal = localRecords.find(
              r =>
                r.AttendanceDate__c === dateVal &&
                r.User__c === userVal &&
                r.Sf_Id &&
                r.Sf_Id.startsWith('LOCAL_')
            );

            if (matchingLocal) {
              console.log(`[getAttendance] Merging local record ${matchingLocal.Sf_Id} -> Salesforce ID: ${sfId}`);
              try {
                const dbRecord = await collection.find(matchingLocal.id);
                await dbRecord.update(r => {
                  r.sfId = sfId;
                });
              } catch (updateErr) {
                console.error(`[getAttendance] Error updating local record Sf_Id:`, updateErr);
              }
            }
          }
        });
      }
    } catch (mergeErr) {
      console.error('[getAttendance] Error during local/server record merge:', mergeErr);
    }

    // Step 2: map
    const payload = mapAttendanceToLocalSchema(fetchResult.data, creds);

    // Step 3: insert
    const insertResult = await insertAttendanceToDb(payload);
    if (!insertResult.success) {
      return { success: false, status: 'error', message: insertResult.message };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${payload.length} Attendance records`,
    };
  } catch (err) {
    const msg = `Unexpected error in getAttendance: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
