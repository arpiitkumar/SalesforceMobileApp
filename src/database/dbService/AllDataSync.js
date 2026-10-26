import UniversalUpdateInsert from "./UniversalUpdateInsert";
import updateReferences from "./updateReferences";
import { InsertNSyncLog } from "../../utils/InsertNSyncLog";
import moment from "moment";
import { extractApiErrorMessage } from "../../utils/sync/syncStatus";
import { buildOrderItemPayload } from "../../utils/orderClassification/orderPayloadBuilder";
import { OrderRecordTypeId_var } from "../../../config";

// ============================================================
// Logs the BUSINESS outcome of an upload call (success / partial / failure)
// based on the per-record results[] returned inside the HTTP 200 body.
// useApiFetch already logs the transport-level HTTP result, so:
//   - skip when the call was a transport error (already logged)
//   - all records success → 'Success'
//   - some records failed  → 'Warn'  (partial success)
//   - all records failed   → 'Error'
// This is separate from the existing catch-block (JS exception) logs.
// ============================================================
const logUploadOutcome = ({ endpoint = "/services/apexrest/upload-records", objectApiName, response, results }) => {
    try {
        // apiFetch already logged transport-level errors — don't double-log.
        if (!response || response.status === "error") return;

        const list = Array.isArray(results) ? results : [];
        const total = list.length;
        const failed = list.filter((r) => r.status !== "success");
        const failCount = failed.length;

        let loggingType = "Success";
        if (total === 0) loggingType = "Info";          // API responded but no results array
        else if (failCount === total) loggingType = "Error";   // all rejected
        else if (failCount > 0) loggingType = "Warn";          // partial success

        InsertNSyncLog({
            endpoint,
            requestBody: { objectApiName, recordCount: total },
            responseBody: {
                objectApiName,
                total,
                success: total - failCount,
                failed: failCount,
                errors: failed.map((f) => ({ id: f.duplicateId, error: f.errorMessage })).slice(0, 50),
            },
            statusCode: 200,
            loggingType,
        }).catch(() => { });
    } catch (_) { }
};

const normalizeDateTime = (value) => {
    if (!value) return null;
    try {
        value = value.replace(/^"|"$/g, "");
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString();
        }
        return null;
    } catch (e) {
        return null;
    }
};

const normalizeDateTimeIST = (value) => {
    if (!value) return null;

    try {
        let cleanVal = typeof value === "string" ? value.replace(/^"|"$/g, "").trim() : value;
        if (!cleanVal) return null;
        const dateObj = new Date(cleanVal);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString();
        }
        return null;
    } catch (e) {
        return null;
    }
};

let IMAGE_BATCH_SIZE = 2;
let WITHOUT_IMAGE_BATCH_SIZE = 20;

const loadBatchSizes = async () => {
    try {
        const AllPicklistData = await UniversalUpdateInsert({
            ObjectName: "AllDataPicklist",
            Type: "get",
        });
        let optionsData = AllPicklistData[0]?.OptionsData;
        if (typeof optionsData === "string") {
            try {
                optionsData = JSON.parse(optionsData);
            } catch (e) {
                console.error("Failed to parse OptionsData:", e);
            }
        }
        const metadataList = optionsData?.sdkMetadataList || [];

        const withImageItem = metadataList.find(item => item.DeveloperName === "withImage_rec_sync");
        if (withImageItem && typeof withImageItem.Value__c === "number") {
            IMAGE_BATCH_SIZE = withImageItem.Value__c;
        } else {
            IMAGE_BATCH_SIZE = 2;
        }

        const withoutImageItem = metadataList.find(item => item.DeveloperName === "withoutImage_rec_sync");
        if (withoutImageItem && typeof withoutImageItem.Value__c === "number") {
            WITHOUT_IMAGE_BATCH_SIZE = withoutImageItem.Value__c;
        } else {
            WITHOUT_IMAGE_BATCH_SIZE = 20;
        }
    } catch (err) {
        console.error("Error loading batch sizes:", err);
    }
};

let isAttendanceSyncInProgress = false;

export const syncAttendanceRecords = async (apiFetch) => {
    if (isAttendanceSyncInProgress) {
        console.log("⚠️ syncAttendanceRecords is already in progress. Skipping duplicate execution.");
        return false;
    }
    isAttendanceSyncInProgress = true;
    try {
        if (typeof apiFetch !== 'function') {
            console.error("❌ Attendance sync skipped: apiFetch is unavailable.");
            return false;
        }
        await loadBatchSizes();
        // 1️⃣ Get all unsynced records
        const attendanceFalseRecord = await UniversalUpdateInsert({
            ObjectName: "Attendant__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!attendanceFalseRecord || attendanceFalseRecord.length === 0) {
            console.log("No unsynced attendance records found to sync.");
            return false;
        }

        console.log(`📤 Found ${attendanceFalseRecord.length} unsynced attendance record(s) to process.`);

        // Sort unsynced records by latest created/modified (newest first)
        attendanceFalseRecord.sort((a, b) => {
            const timeA = new Date(a.StartTime__c || a.CreatedDate || a.last_modified || 0).getTime();
            const timeB = new Date(b.StartTime__c || b.CreatedDate || b.last_modified || 0).getTime();
            return timeB - timeA;
        });

        // Deduplicate local unsynced records by User + AttendanceDate (only 1 post per user per date)
        const seenUserDates = new Set();
        const recordsToUpload = [];

        for (const item of attendanceFalseRecord) {
            const rawDate = item.AttendanceDate__c || (item.StartTime__c ? item.StartTime__c.split(' ')[0] : moment().format('YYYY-MM-DD'));
            const cleanDate = rawDate ? String(rawDate).trim().substring(0, 10) : moment().format('YYYY-MM-DD');
            const dateKey = `${item.User__c}_${cleanDate}`;

            if (seenUserDates.has(dateKey)) {
                console.log(`⚠️ Local duplicate attendance entry for ${dateKey} (${item.Sf_Id}). Marking synced locally without posting.`);
                await UniversalUpdateInsert({
                    ObjectName: "Attendant__c",
                    Type: "insert",
                    data: {
                        Sf_Id: item.Sf_Id,
                        is_synced: true,
                        sync_status: 'synced',
                        ErrorMsg: "Duplicate local entry resolved",
                    },
                });
            } else {
                seenUserDates.add(dateKey);
                item.cleanAttendanceDate = cleanDate;
                recordsToUpload.push(item);
            }
        }

        console.log(`Uploading ${recordsToUpload.length} deduplicated attendance record(s) to Salesforce.`);

        for (const item of recordsToUpload) {
            const oldId = item.Sf_Id;
            try {
                // Fix: Convert StartTime__c to proper ISO without treating IST as UTC
                // StartTime__c is stored as "YYYY-MM-DD HH:mm:ss" in local IST time
                let attendanceStartTimeISO;
                if (item.StartTime__c) {
                    // Parse as local time (not UTC) by NOT appending "Z"
                    const localDate = new Date(item.StartTime__c.replace(" ", "T"));
                    if (!isNaN(localDate.getTime())) {
                        attendanceStartTimeISO = localDate.toISOString();
                    } else {
                        console.warn(`⚠️ Invalid StartTime__c for record ${oldId}: "${item.StartTime__c}", using current time`);
                        attendanceStartTimeISO = new Date().toISOString();
                    }
                } else {
                    attendanceStartTimeISO = new Date().toISOString();
                }

                // Fix: Use effective reason (Other_Leave_Reason__c) when Reason__c is "Other"
                let effectiveReason = item.Reason__c || null;
                if (effectiveReason === 'Other' && item.Other_Leave_Reason__c) {
                    effectiveReason = item.Other_Leave_Reason__c;
                }

                const imageVal = item.AttendanceBase64 || item.base64 || item.base64Image || null;
                const capturedSelfieVal = !!(
                    item.CapturedSelfie__c === true ||
                    item.CapturedSelfie__c === 1 ||
                    item.CapturedSelfie__c === 'true' ||
                    (imageVal && imageVal !== 'false' && imageVal !== 'null' && imageVal !== '')
                );

                console.log(`[Attendance Sync DEBUG] Record ID: ${oldId}`, {
                    raw_CapturedSelfie__c: item.CapturedSelfie__c,
                    raw_AttendanceBase64_len: item.AttendanceBase64 ? item.AttendanceBase64.length : 0,
                    raw_base64_len: item.base64 ? item.base64.length : 0,
                    raw_base64Image_len: item.base64Image ? item.base64Image.length : 0,
                    resolved_imageVal_len: imageVal ? imageVal.length : 0,
                    resolved_capturedSelfieVal: capturedSelfieVal,
                });

                const isLeaveStatus = item.AttendanceStatus__c === 'Leave';
                const payload = {
                    User__c: item.User__c,
                    AttendanceStatus__c: item.AttendanceStatus__c,
                    LeaveDuration__c: isLeaveStatus ? (item.LeaveDuration__c || null) : null,
                    AttendanceDate__c: item.cleanAttendanceDate,
                    Reason__c: isLeaveStatus ? effectiveReason : null,
                    Other_Leave_Reason__c: isLeaveStatus && item.Other_Leave_Reason__c ? item.Other_Leave_Reason__c : null,
                    // Mirror the online correction path. The updated record
                    // must not retain its former rejected approval value.
                    Approval_Status__c: item.operation_type === 'update'
                        ? (isLeaveStatus ? 'Pending' : null)
                        : undefined,
                    AttendanceStartTime__c: attendanceStartTimeISO,
                    AttendanceEndTime__c: item.AttendanceEndTime__c || item.EndTime__c || null,
                    From_Date__c: item.From_Date__c || null,
                    To_Date__c: item.To_Date__c || null,
                    Deviceid__c: item.Deviceid__c || null,
                    Attendance_Image_URL__c: imageVal,
                    CapturedSelfie__c: capturedSelfieVal,
                    // Fix: Include Mobile_Unique_Id__c for Salesforce duplicate detection
                    Mobile_Unique_Id__c: item.Mobile_Unique_Id__c || null,
                };

                if (item.GeoLocation__c && item.GeoLocation__c.includes(",")) {
                    const [lat, lng] = item.GeoLocation__c.split(",").map((v) => v.trim());
                    if (!isNaN(Number(lat)) && !isNaN(Number(lng))) {
                        payload.GeoLocation__Latitude__s = Number(lat);
                        payload.GeoLocation__Longitude__s = Number(lng);
                    }
                }

                // A Salesforce ID is PATCHed only for an explicitly queued
                // update (for example a rejected leave correction). A local
                // first attendance always stays a POST until Salesforce
                // assigns its real Id.
                const isExistingSalesforceAttendance = Boolean(
                    item.operation_type === 'update' &&
                    oldId &&
                    !oldId.startsWith('LOCAL_')
                );
                const method = isExistingSalesforceAttendance ? 'PATCH' : 'POST';
                const endpoint = isExistingSalesforceAttendance ? `sobjects/Attendance__c/${oldId}` : 'sobjects/Attendance__c';

                console.log(`📤 Syncing offline attendance record ${oldId} via ${method} ${endpoint}...`);
                console.log(`📤 Attendance sync payload:`, JSON.stringify(payload));
                const response = await apiFetch(method, endpoint, payload, 'SObjects');
                console.log(`📥 Response for attendance ${oldId}:`, JSON.stringify(response));

                const responseData = response?.data;
                const isSuccess = method === 'PATCH'
                    ? (response?.status === 'success')
                    : (response?.status === 'success' && (responseData?.id || responseData?.success === true));
                const errorMsg = extractApiErrorMessage(response, null) || '';
                const isDuplicate = !!(errorMsg && (errorMsg.includes('DUPLICATE_VALUE') || errorMsg.includes('duplicate value found')));

                if (isSuccess || isDuplicate) {
                    const newId = responseData?.id || oldId;
                    console.log("✅ Updating attendance record locally to synced:", oldId, "→", newId);

                    if (oldId !== newId) {
                        await updateReferences(oldId, newId, ["Attendant__c"]);
                    }
                    await UniversalUpdateInsert({
                        ObjectName: "Attendant__c",
                        Type: "insert",
                        data: {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            operation_type: 'insert',
                            ErrorMsg: "",
                        },
                    });
                } else {
                    console.log("❌ Record sync failed for", oldId, ":", errorMsg);
                    await UniversalUpdateInsert({
                        ObjectName: "Attendant__c",
                        Type: "insert",
                        data: {
                            Sf_Id: oldId,
                            is_synced: false,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        },
                    });
                }
            } catch (recordErr) {
                console.error(`❌ Exception syncing attendance record ${oldId}:`, recordErr?.message || recordErr);
                // Mark this record as failed but continue processing remaining records
                try {
                    await UniversalUpdateInsert({
                        ObjectName: "Attendant__c",
                        Type: "insert",
                        data: {
                            Sf_Id: oldId,
                            is_synced: false,
                            ErrorMsg: `Sync exception: ${recordErr?.message || 'Unknown error'}`,
                            sync_status: 'failed',
                        },
                    });
                } catch (_) { }
            }
        }

        return true;
    } catch (err) {
        console.log("Error in syncAttendanceRecords:", err);
        return false;
    } finally {
        isAttendanceSyncInProgress = false;
    }
};

export const syncBeatDayRecord = async (apiFetch, apiComposite) => {
    try {
        if (typeof apiFetch !== 'function' && typeof apiComposite !== 'function') {
            console.error("❌ BeatDay sync skipped: API functions unavailable.");
            return false;
        }

        // 1️⃣ Get all unsynced records
        let FalseRecord = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            FalseRecord = await UniversalUpdateInsert({
                ObjectName: "BeatDay__c",
                Type: "get",
                filters: [{ field: "is_locally_changed", value: true }],
            });
        }

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No BeatDay__c records found to sync.");
            return false;
        }

        console.log(`📤 BeatDay__c records to sync: ${FalseRecord.length}`);

        for (const item of FalseRecord) {
            const oldId = item.Sf_Id;
            if (!oldId || oldId.startsWith("local-") || oldId.startsWith("LOCAL_")) {
                console.log(`⚠️ Skipping BeatDay record with invalid/local Sf_Id: ${oldId}`);
                continue;
            }

            // Build clean payload for Salesforce standard Beat_Day__c sObject
            let payload = {};

            const commentVal = item.EOD_Comment__c || item.EodComment__c;
            if (commentVal !== undefined && commentVal !== null && commentVal !== "") {
                payload.EOD_Comment__c = String(commentVal);
                payload.EodComment__c = String(commentVal);
            }
            if (item.Missed_Outlet_Reasons__c !== undefined && item.Missed_Outlet_Reasons__c !== null && item.Missed_Outlet_Reasons__c !== "") {
                payload.Missed_Outlet_Reasons__c = String(item.Missed_Outlet_Reasons__c);
            }
            if (item.EndOfDayTime__c) {
                payload.EndOfDayTime__c = new Date(item.EndOfDayTime__c).toISOString();
            }
            if (item.End_Time__c) {
                payload.End_Time__c = item.End_Time__c;
            } else if (item.EndOfDayTime__c) {
                payload.End_Time__c = `${moment(item.EndOfDayTime__c).format("HH:mm:ss.SSS")}Z`;
            }
            if (item.NonProductiveCalls__c !== undefined && item.NonProductiveCalls__c !== null && item.NonProductiveCalls__c !== "") {
                payload.NonProductiveCalls__c = Number(item.NonProductiveCalls__c) || 0;
            }
            if (item.NonPjpOutletVisited__c !== undefined && item.NonPjpOutletVisited__c !== null && item.NonPjpOutletVisited__c !== "") {
                payload.NonPjpOutletVisited__c = Number(item.NonPjpOutletVisited__c) || 0;
            }
            if (item.NonPjpProductiveCalls__c !== undefined && item.NonPjpProductiveCalls__c !== null && item.NonPjpProductiveCalls__c !== "") {
                payload.NonPjpProductiveCalls__c = Number(item.NonPjpProductiveCalls__c) || 0;
            }
            const notVisitedCount = item.Not_Visited_Outlets__c ?? item.NotVisitedOutlets__c;
            if (notVisitedCount !== undefined && notVisitedCount !== null && notVisitedCount !== "") {
                payload.Not_Visited_Outlets__c = Number(notVisitedCount) || 0;
                payload.NotVisitedOutlets__c = Number(notVisitedCount) || 0;
            }
            if (item.PjpOutletVisited__c !== undefined && item.PjpOutletVisited__c !== null && item.PjpOutletVisited__c !== "") {
                payload.PjpOutletVisited__c = Number(item.PjpOutletVisited__c) || 0;
            }
            if (item.Planned_Outlets__c !== undefined && item.Planned_Outlets__c !== null && item.Planned_Outlets__c !== "") {
                payload.Planned_Outlets__c = Number(item.Planned_Outlets__c) || 0;
            }
            if (item.Planned_Outlets_Coverage__c !== undefined && item.Planned_Outlets_Coverage__c !== null && item.Planned_Outlets_Coverage__c !== "") {
                payload.Planned_Outlets_Coverage__c = String(item.Planned_Outlets_Coverage__c);
            }
            if (item.Productive_Calls__c !== undefined && item.Productive_Calls__c !== null && item.Productive_Calls__c !== "") {
                payload.Productive_Calls__c = Number(item.Productive_Calls__c) || 0;
            }
            if (item.Productivity__c !== undefined && item.Productivity__c !== null && item.Productivity__c !== "") {
                payload.Productivity__c = String(item.Productivity__c);
            }
            if (item.TimeSpentOnField__c !== undefined && item.TimeSpentOnField__c !== null && item.TimeSpentOnField__c !== "") {
                payload.TimeSpentOnField__c = Number(item.TimeSpentOnField__c) || 0;
            }
            if (item.Total_Calls__c !== undefined && item.Total_Calls__c !== null && item.Total_Calls__c !== "") {
                payload.Total_Calls__c = Number(item.Total_Calls__c) || 0;
            }
            if (item.Total_Time_in_Outlet__c !== undefined && item.Total_Time_in_Outlet__c !== null && item.Total_Time_in_Outlet__c !== "") {
                payload.Total_Time_in_Outlet__c = item.Total_Time_in_Outlet__c;
            }
            if (item.Visited_Outlets__c !== undefined && item.Visited_Outlets__c !== null && item.Visited_Outlets__c !== "") {
                payload.Visited_Outlets__c = Number(item.Visited_Outlets__c) || 0;
            }

            console.log(`📤 Syncing offline Beat_Day__c (${oldId})... Payload:`, JSON.stringify(payload));

            let isSuccess = false;
            let lastErrorMsg = '';

            // 1. Try Composite API first (mirrors the exact online flow)
            if (typeof apiComposite === 'function') {
                try {
                    const compositePayload = {
                        compositeRequest: [
                            {
                                method: "PATCH",
                                url: `/services/data/v61.0/sobjects/Beat_Day__c/${oldId}`,
                                referenceId: "updateBeatDay",
                                body: payload,
                            }
                        ],
                        allOrNone: false,
                    };
                    const compRes = await apiComposite("POST", "composite", compositePayload);
                    const compList = compRes?.data?.compositeResponse || compRes?.compositeResponse || [];
                    const bdSub = compList.find(r => r.referenceId === 'updateBeatDay');
                    if (bdSub?.httpStatusCode >= 200 && bdSub?.httpStatusCode < 300) {
                        isSuccess = true;
                    } else if (bdSub?.body) {
                        lastErrorMsg = Array.isArray(bdSub.body)
                            ? bdSub.body.map(e => e?.message || e?.errorCode).join("; ")
                            : String(bdSub.body?.message || bdSub.body?.errorCode || "");
                    }
                } catch (cErr) {
                    console.log("Composite BeatDay sync failed, falling back to direct PATCH:", cErr);
                }
            }

            // 2. Try Direct SObjects API with multi-pass retry if composite wasn't successful
            if (!isSuccess && typeof apiFetch === 'function') {
                let currentPayload = { ...payload };
                let retries = 0;

                while (!isSuccess && retries < 4) {
                    retries++;
                    if (lastErrorMsg) {
                        const fieldsToRemove = new Set();
                        const matchedFields = lastErrorMsg.match(/fields:\s*([^.]+)/i)?.[1];
                        if (matchedFields) {
                            matchedFields.split(",").forEach(f => f && fieldsToRemove.add(f.trim()));
                        }
                        const invalidColumns = lastErrorMsg.match(/No such column '([^']+)'/i)?.[1];
                        if (invalidColumns) {
                            fieldsToRemove.add(invalidColumns.trim());
                        }
                        const fieldPrefixMatch = lastErrorMsg.match(/^([A-Za-z0-9_]+__c):/);
                        if (fieldPrefixMatch?.[1]) {
                            fieldsToRemove.add(fieldPrefixMatch[1].trim());
                        }

                        if (fieldsToRemove.size > 0) {
                            fieldsToRemove.forEach(f => delete currentPayload[f]);
                            console.log(`🔄 Retrying Beat_Day__c (${oldId}) [attempt ${retries}] after removing invalid fields:`, Array.from(fieldsToRemove));
                        } else if (retries > 1) {
                            break;
                        }
                    }

                    const response = await apiFetch('PATCH', `sobjects/Beat_Day__c/${oldId}`, currentPayload, 'SObjects');
                    console.log(`📥 Direct PATCH response for Beat_Day__c ${oldId}:`, JSON.stringify(response));

                    isSuccess = response?.status === 'success' && !response?.data?.errors;
                    if (!isSuccess) {
                        lastErrorMsg = extractApiErrorMessage(response, null) || response?.message || '';
                    }
                }
            }

            if (isSuccess) {
                console.log(`✅ Updating BeatDay__c record locally to synced: ${oldId}`);
                await UniversalUpdateInsert({
                    ObjectName: "BeatDay__c",
                    Type: "insert",
                    data: {
                        Sf_Id: oldId,
                        is_synced: true,
                        is_locally_changed: false,
                        sync_status: 'synced',
                        ErrorMsg: "",
                    },
                });
            } else {
                console.log(`❌ BeatDay__c sync failed for ${oldId}:`, lastErrorMsg);
                await UniversalUpdateInsert({
                    ObjectName: "BeatDay__c",
                    Type: "insert",
                    data: {
                        Sf_Id: oldId,
                        is_synced: false,
                        is_locally_changed: true,
                        sync_status: 'failed',
                        ErrorMsg: lastErrorMsg,
                    },
                });
            }
        }

        return true;
    } catch (err) {
        console.log("Error in syncBeatDayRecord:", err);
        InsertNSyncLog({
            endpoint: "/services/data/v61.0/sobjects/Beat_Day__c",
            requestBody: { objectApiName: "Beat_Day__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });

        return false;
    }
};

export const syncOfflineDeletedVisits = async (apiComposite) => {
    try {
        await loadBatchSizes();
        const deletedVisits = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [{ field: "SoftDelete", value: true }],
        });

        if (!deletedVisits || deletedVisits.length === 0) {
            console.log("No soft-deleted visits found to sync.");
            return;
        }

        console.log(`Found ${deletedVisits.length} soft-deleted visits to sync.`);

        const localOnlyVisitIds = [];
        const serverVisits = [];

        for (const visit of deletedVisits) {
            if (!visit.Sf_Id || visit.Sf_Id.startsWith("local-")) {
                localOnlyVisitIds.push(visit.id || visit.Sf_Id);
            } else {
                serverVisits.push(visit);
            }
        }

        if (localOnlyVisitIds.length > 0) {
            console.log("Hard deleting local-only visits from local DB:", localOnlyVisitIds);
            await UniversalUpdateInsert({
                ObjectName: "Visit",
                Type: "delete_bulk",
                data: localOnlyVisitIds,
            });
        }

        if (serverVisits.length > 0) {
            console.log(`Deleting ${serverVisits.length} visits from Salesforce...`);
            const BATCH_SIZE = 25;
            const chunkArray = (arr, size) => {
                const chunks = [];
                for (let i = 0; i < arr.length; i += size) {
                    chunks.push(arr.slice(i, i + size));
                }
                return chunks;
            };

            const visitChunks = chunkArray(serverVisits, BATCH_SIZE);

            for (const [chunkIndex, chunk] of visitChunks.entries()) {
                const refToVisit = {};
                const compositeRequest = chunk.map((visit, index) => {
                    const refId = `DeleteOfflineVisit_${chunkIndex}_${index}`;
                    refToVisit[refId] = visit;
                    return {
                        method: "DELETE",
                        url: `/services/data/v61.0/sobjects/Visit/${visit.Sf_Id}`,
                        referenceId: refId,
                    };
                });

                const payload = {
                    allOrNone: false,
                    compositeRequest,
                };

                try {
                    const response = await apiComposite(
                        "POST",
                        "",
                        payload,
                        "composite"
                    );
                    console.log(
                        `Composite Delete Offline Visits Response (batch ${chunkIndex + 1}):`,
                        JSON.stringify(response)
                    );

                    const compositeResponses = response?.compositeResponse || [];
                    const successSfIds = [];

                    for (const subResp of compositeResponses) {
                        const refId = subResp.referenceId;
                        const visit = refToVisit[refId];
                        if (!visit) continue;

                        const status = subResp.httpStatusCode || 0;
                        if (status >= 200 && status < 300) {
                            successSfIds.push(visit.Sf_Id);
                        } else {
                            console.warn(`Salesforce delete failed for visit ${visit.Sf_Id} with status ${status}`);
                        }
                    }

                    if (successSfIds.length > 0) {
                        console.log(`Batch ${chunkIndex + 1}: Deleting successfully synced deleted visits locally:`, successSfIds);
                        await UniversalUpdateInsert({
                            ObjectName: "Visit",
                            Type: "delete_bulk",
                            data: successSfIds,
                        });
                    }
                } catch (apiErr) {
                    console.error(`Composite API call failed for offline delete batch ${chunkIndex + 1}:`, apiErr);
                }
            }
        }
    } catch (err) {
        console.error("Error syncing offline deleted visits:", err);
    }
};

let isVisitSyncInProgress = false;

export const syncVisitRecord = async (apiFetch, apiComposite) => {
    if (isVisitSyncInProgress) {
        console.log("⚠️ syncVisitRecord is already in progress. Skipping duplicate execution.");
        return false;
    }
    isVisitSyncInProgress = true;
    try {
        if (typeof apiFetch !== 'function') {
            console.error("❌ Visit sync skipped: apiFetch is unavailable.");
            return false;
        }
        await loadBatchSizes();
        if (typeof apiComposite === 'function') {
            await syncOfflineDeletedVisits(apiComposite);
        }

        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [
                { field: "is_synced", value: false },
                { field: "SoftDelete", value: false },
            ],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Visit records found to sync.");
            return false;
        }

        console.log(`📤 Found ${FalseRecord.length} unsynced Visit record(s) to process.`);

        // Fields to remove / exclude from SObject payload
        const excludeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "CheckInBase64",
            "CheckInLocation__c",
            "CheckOutLocation__c",
            "name",
            "Name",
            "CreatedDate",
            "LastModifiedDate",
            "SystemModstamp",
            "duplicateId",
            "cleanItem",
            "AccountId",
            "sfId",
            "Sf_Id",
            "visitBase64",
            // Local-only Visit fields. They are retained in WatermelonDB for
            // duplicate prevention/UI state, but are not Visit__c fields to
            // send through the Salesforce standard SObject API.
            "Mobile_Unique_Id__c",
            "PlannedVisitStartTime",
            "PlannedVisitStartTime__c",
            "StartCheckInTime__c",
        ];

        for (const item of FalseRecord) {
            const oldId = item.Sf_Id;
            // Older offline Check In records were incorrectly marked as
            // "insert" even though Sf_Id is an existing Salesforce Visit.
            // Treat them as updates too, so already queued check-ins recover
            // Existing Salesforce visit check: valid Salesforce ID
            const isRealSalesforceId = Boolean(
                oldId &&
                !oldId.startsWith("local-") &&
                !oldId.startsWith("LOCAL_") &&
                !oldId.startsWith("ORD-") &&
                !oldId.startsWith("temp-")
            );
            const isInsert = !isRealSalesforceId;
            const isExistingVisitCheckIn = isRealSalesforceId && (!!item.CheckInTime__c || !!item.CheckOutTime__c);

            try {
                // Build clean payload for standard SObject API
                let payload = {};
                for (const [key, value] of Object.entries(item)) {
                    // WatermelonDB initializes optional string fields to an
                    // empty string. Sending those values on a Salesforce
                    // INSERT makes Date/DateTime fields fail to deserialize.
                    // Keep empty strings for PATCH requests, where they may
                    // intentionally clear an existing Salesforce value.
                    const isEmptyInsertValue = isInsert && typeof value === "string" && value.trim() === "";
                    if (!excludeKeys.includes(key) && value !== undefined && value !== null && !isEmptyInsertValue) {
                        payload[key] = value;
                    }
                }

                // Ensure AccountId__c is present if AccountId was stored
                if (!payload.AccountId__c && item.AccountId) {
                    payload.AccountId__c = item.AccountId;
                }

                // Standardize dates
                if (payload.CheckInTime__c) {
                    payload.CheckInTime__c = normalizeDateTimeIST(payload.CheckInTime__c);
                }
                if (payload.CheckOutTime__c) {
                    payload.CheckOutTime__c = normalizeDateTimeIST(payload.CheckOutTime__c);
                }
                if (payload.PlannedVisitStartTime__c) {
                    payload.PlannedVisitStartTime__c = normalizeDateTimeIST(payload.PlannedVisitStartTime__c);
                }
                if (payload.PlannedVisitEndTime__c) {
                    payload.PlannedVisitEndTime__c = normalizeDateTimeIST(payload.PlannedVisitEndTime__c);
                }

                if (isInsert && item.CheckInBase64) {
                    payload.Base64_Image__c = item.CheckInBase64;
                }

                // Offline Check In / Check Out / Missed Visit is an update to an existing Visit.
                const isValidationOnly = !isInsert &&
                    (item.Joint_Visit_User_Validated__c === true || item.Joint_Visit_User_Validated__c === 1 || item.Joint_Visit_User_Validated__c === "true") &&
                    !item.CheckInTime__c &&
                    !item.CheckOutTime__c;

                const isMissedVisitUpdate = !isInsert &&
                    !item.CheckInTime__c &&
                    !item.CheckOutTime__c &&
                    !isValidationOnly &&
                    Boolean(item.Missing_Outlet_Reason__c || item.LastCallVisit__c);

                if (isValidationOnly) {
                    payload = {
                        Joint_Visit_User_Validated__c: true,
                    };
                } else if (isMissedVisitUpdate) {
                    payload = {};
                    if (item.Missing_Outlet_Reason__c) {
                        payload.Missing_Outlet_Reason__c = String(item.Missing_Outlet_Reason__c).trim();
                    }
                    if (item.LastCallVisit__c) {
                        payload.LastCallVisit__c = true;
                    }
                } else if (isExistingVisitCheckIn || !isInsert) {
                    payload = {
                        CheckInTime__c: payload.CheckInTime__c,
                        PlannedVisitStartTime__c: payload.PlannedVisitStartTime__c,
                        CheckOutTime__c: payload.CheckOutTime__c,
                        PlannedVisitEndTime__c: payload.PlannedVisitEndTime__c,
                        VisitStatus__c: item.VisitStatus__c || (item.CheckOutTime__c ? "Check Out" : "Check In"),
                        Before12Noon__c: !!item.Before12Noon__c,
                        Before3PM__c: !!item.Before3PM__c,
                        Before6PM__c: !!item.Before6PM__c,
                        After6PM__c: !!item.After6PM__c,
                        FirstCallVisit__c: !!item.FirstCallVisit__c,
                        LastCallVisit__c: !!item.LastCallVisit__c,
                        CheckInComment__c: item.CheckInComment__c || null,
                        WorkingWith__c: item.WorkingWith__c || null,
                        Device_Id__c: item.Device_Id__c || null,
                        CheckInPhotoCaptured__c: item.CheckInBase64 ? 1 : (item.CheckInPhotoCaptured__c ? Number(item.CheckInPhotoCaptured__c) : 0),
                        Appropriate_Call__c: item.Appropriate_Call__c === true || item.Appropriate_Call__c === "true",
                        Inappropriate_Call__c: item.Inappropriate_Call__c === true || item.Inappropriate_Call__c === "true",
                        Postman_Call__c: item.Postman_Call__c === true || item.Postman_Call__c === "true",
                        Joint_Visit_User_Validated__c: item.Joint_Visit_User_Validated__c === true || item.Joint_Visit_User_Validated__c === 1 || item.Joint_Visit_User_Validated__c === "true",
                        Base64_Image__c: item.CheckInBase64 || null,
                    };

                    if (item.CheckInLocation__Longitude__s !== undefined && item.CheckInLocation__Longitude__s !== null && item.CheckInLocation__Longitude__s !== "") {
                        payload.CheckInLocation__Longitude__s = Number(item.CheckInLocation__Longitude__s) || 0;
                    }
                    if (item.CheckInLocation__Latitude__s !== undefined && item.CheckInLocation__Latitude__s !== null && item.CheckInLocation__Latitude__s !== "") {
                        payload.CheckInLocation__Latitude__s = Number(item.CheckInLocation__Latitude__s) || 0;
                    }
                    if (item.CheckOutLocation__Longitude__s !== undefined && item.CheckOutLocation__Longitude__s !== null && item.CheckOutLocation__Longitude__s !== "") {
                        payload.CheckOutLocation__Longitude__s = Number(item.CheckOutLocation__Longitude__s) || 0;
                    }
                    if (item.CheckOutLocation__Latitude__s !== undefined && item.CheckOutLocation__Latitude__s !== null && item.CheckOutLocation__Latitude__s !== "") {
                        payload.CheckOutLocation__Latitude__s = Number(item.CheckOutLocation__Latitude__s) || 0;
                    }
                    if (item.DistanceTravelledKm__c !== undefined && item.DistanceTravelledKm__c !== null && item.DistanceTravelledKm__c !== "") {
                        payload.DistanceTravelledKm__c = Number(item.DistanceTravelledKm__c) || 0;
                    }
                    if (item.LocationVarianceOLtoSCA__c !== undefined && item.LocationVarianceOLtoSCA__c !== null && item.LocationVarianceOLtoSCA__c !== "") {
                        payload.LocationVarianceOLtoSCA__c = Number(item.LocationVarianceOLtoSCA__c) || 0;
                    }
                    if (item.NonProductiveCallReason__c) {
                        payload.NonProductiveCallReason__c = item.NonProductiveCallReason__c;
                    }
                    if (item.Missing_Outlet_Reason__c) {
                        payload.Missing_Outlet_Reason__c = item.Missing_Outlet_Reason__c;
                    }

                    // Salesforce accepts null, but omit unavailable numeric
                    // values instead of overwriting valid server data.
                    Object.keys(payload).forEach((key) => {
                        if (payload[key] === undefined || payload[key] === "") {
                            delete payload[key];
                        }
                    });
                }

                let response;
                if (isInsert) {
                    delete payload.Id;
                    delete payload.Sf_Id;
                    console.log(`📤 Uploading offline NEW Visit record (${oldId}) to Salesforce Standard API (sobjects/Visit__c)...`);
                    response = await apiFetch('POST', 'sobjects/Visit__c', payload, 'SObjects');
                } else {
                    console.log(`📤 Updating offline Visit record (${oldId}) via Salesforce Standard API (sobjects/Visit__c/${oldId})...`);
                    response = await apiFetch('PATCH', `sobjects/Visit__c/${oldId}`, payload, 'SObjects');
                }

                console.log(`📥 Response for Visit ${oldId}:`, JSON.stringify(response));

                const responseData = response?.data;
                const isSuccess = response?.status === 'success' && (responseData?.id || responseData?.success === true || !isInsert);
                const errorMsg = extractApiErrorMessage(response, null) || '';
                const isDuplicate = !!(errorMsg && (errorMsg.includes('DUPLICATE_VALUE') || errorMsg.includes('duplicate value found')));

                if (isSuccess) {
                    const newId = responseData?.id || oldId;
                    console.log("✅ Updating Visit record locally to synced:", oldId, "→", newId);
                    if (isInsert && newId !== oldId) {
                        const allObjects = [
                            "Visit",
                            "Order",
                            "Collection__c",
                            "FormJson",
                            "Competitor__c",
                            "Stock_Check__c",
                        ];
                        await updateReferences(oldId, newId, allObjects);
                    }

                    await UniversalUpdateInsert({
                        ObjectName: "Visit",
                        Type: "insert",
                        data: {
                            Sf_Id: newId,
                            is_synced: true,
                            is_locally_changed: false,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        },
                    });
                } else if (isDuplicate) {
                    let duplicateId = null;
                    const match = errorMsg.match(/id:\s*([a-zA-Z0-9]{15,18})/);
                    if (match) {
                        duplicateId = match[1];
                    }

                    if (duplicateId && isInsert) {
                        console.log(`Duplicate Visit detected: ${oldId}. Deleting local duplicate, updating references to ${duplicateId}.`);
                        await UniversalUpdateInsert({
                            ObjectName: "Visit",
                            Type: "delete_bulk",
                            data: [oldId],
                        });
                        const allObjects = [
                            "Visit",
                            "Order",
                            "Collection__c",
                            "FormJson",
                            "Competitor__c",
                            "Stock_Check__c",
                        ];
                        await updateReferences(oldId, duplicateId, allObjects);
                    } else {
                        console.log("❌ Visit sync duplicate/failed for", oldId, ":", errorMsg);
                        await UniversalUpdateInsert({
                            ObjectName: "Visit",
                            Type: "insert",
                            data: {
                                Sf_Id: oldId,
                                is_synced: false,
                                ErrorMsg: errorMsg,
                                sync_status: 'failed',
                            },
                        });
                    }
                } else {
                    console.log("❌ Visit sync failed for", oldId, ":", errorMsg);
                    await UniversalUpdateInsert({
                        ObjectName: "Visit",
                        Type: "insert",
                        data: {
                            Sf_Id: oldId,
                            is_synced: false,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        },
                    });
                }
            } catch (recordErr) {
                console.error(`❌ Exception syncing Visit record ${oldId}:`, recordErr?.message || recordErr);
                try {
                    await UniversalUpdateInsert({
                        ObjectName: "Visit",
                        Type: "insert",
                        data: {
                            Sf_Id: oldId,
                            is_synced: false,
                            ErrorMsg: `Sync exception: ${recordErr?.message || 'Unknown error'}`,
                            sync_status: 'failed',
                        },
                    });
                } catch (_) { }
            }
        }

        return true;
    } catch (err) {
        console.log("Error in syncVisitRecord:", err);
        return false;
    } finally {
        isVisitSyncInProgress = false;
    }
};

let isOrderSyncInProgress = false;

export const syncOrderRecord = async (apiFetch) => {
    if (isOrderSyncInProgress) {
        console.log("⚠️ syncOrderRecord is already in progress. Skipping duplicate execution.");
        return false;
    }
    isOrderSyncInProgress = true;
    try {
        await loadBatchSizes();

        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Order records found to sync.");
            return false;
        }

        console.log(`📤 Syncing ${FalseRecord.length} unsynced Order record(s)...`);

        const isValidSfId = (id) => typeof id === "string" && (id.length === 15 || id.length === 18) && !id.startsWith("local-") && !id.startsWith("ORD-");
        const syncedOrders = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
            filters: [{ field: "is_synced", value: true }],
        });

        for (const item of FalseRecord) {
            const oldId = item.Sf_Id;
            const isLocalTempId = !oldId || oldId.startsWith("local-") || oldId.startsWith("ORD-") || (!isNaN(Number(oldId)) && oldId.length !== 15 && oldId.length !== 18);
            const alreadySyncedOrder = Array.isArray(syncedOrders)
                ? syncedOrders.find((order) => {
                    if (oldId && order.Sf_Id === oldId) return true;
                    return item.Mobile_Unique_Id__c
                        && order.Mobile_Unique_Id__c === item.Mobile_Unique_Id__c
                        && order.Sf_Id !== oldId;
                })
                : null;

            if (alreadySyncedOrder) {
                console.log(`⚠️ Order ${oldId} already synced as ${alreadySyncedOrder.Sf_Id}. Skipping Salesforce sync.`);
                await UniversalUpdateInsert({
                    ObjectName: "Order",
                    Type: "insert",
                    data: {
                        Sf_Id: oldId,
                        is_synced: true,
                        is_locally_changed: false,
                        sync_status: 'synced',
                        operation_type: null,
                        ErrorMsg: "",
                    },
                });
                continue;
            }

            try {
                const effectiveDateStr = item.EffectiveDate ? item.EffectiveDate.split("T")[0] : new Date().toISOString().split("T")[0];
                const accountIdVal = item.AccountId__c || item.AccountId;

                if (!accountIdVal) {
                    const missingAccountMsg = "Order sync skipped: missing AccountId__c/AccountId";
                    console.error(`❌ ${missingAccountMsg} for ${oldId}`);
                    await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "insert",
                        data: {
                            Sf_Id: oldId,
                            is_synced: false,
                            ErrorMsg: missingAccountMsg,
                            sync_status: 'failed',
                        },
                    });
                    continue;
                }

                // Determine IsNonDmsOrder__c from the frozen immutable order snapshot
                const isNonDms = !!(
                    item.IsNonDmsOrder__c === true ||
                    item.IsNonDmsOrder__c === 'true' ||
                    item.isNonDmsOrder === true ||
                    item.OrderType === 'NON_DMS' ||
                    item.OrderType__c === 'NON_DMS'
                );

                // Exact payload structure matching online mode in CartScreen.tsx
                const orderPayload = {
                    AccountId__c: accountIdVal,
                    Secondary_Order_Supplier__c: item.Secondary_Order_Supplier__c || null,
                    Order_Placed_By__c: item.OrderPlacedBy__c || item.Order_Placed_By__c || null,
                    Order_Source__c: 'SFA',
                    Status__c: item.Status || item.Status__c || 'Draft',
                    EffectiveDate__c: effectiveDateStr,
                    Order_Submission_DateTime__c: item.OrderSubmissionTime__c || item.Order_Submission_DateTime__c || new Date().toISOString(),
                    IsNonDmsOrder__c: isNonDms,
                    RecordTypeId: item.RecordTypeId || item.recordTypeId || OrderRecordTypeId_var || null,
                };

                let newId = null;
                let isSuccess = false;
                let errorMsg = "";

                if (isLocalTempId) {
                    // Create new Order__c via standard SObjects API (identical to online order placement in CartScreen.tsx)
                    console.log(`📤 Uploading offline Order ${oldId} to Salesforce (sobjects/Order__c)...`, JSON.stringify(orderPayload));
                    const orderResponse = await apiFetch("POST", "sobjects/Order__c", orderPayload, "SObjects");
                    console.log(`📥 Response for Order ${oldId}:`, JSON.stringify(orderResponse));

                    const responseData = orderResponse?.data;
                    if (orderResponse?.status === "success" && (responseData?.id || responseData?.Id)) {
                        newId = responseData.id || responseData.Id;
                        isSuccess = true;
                    } else {
                        errorMsg = extractApiErrorMessage(orderResponse, null) || orderResponse?.message || "Failed to create Order__c";
                        console.error(`❌ Order sync failed for ${oldId}:`, errorMsg);
                    }
                } else {
                    // Updating existing Order__c
                    console.log(`📤 Updating existing Order ${oldId} in Salesforce (sobjects/Order__c/${oldId})...`);
                    const orderResponse = await apiFetch("PATCH", `sobjects/Order__c/${oldId}`, orderPayload, "SObjects");
                    console.log(`📥 Response for Order ${oldId}:`, JSON.stringify(orderResponse));

                    if (orderResponse?.status === "success") {
                        newId = oldId;
                        isSuccess = true;
                    } else {
                        errorMsg = extractApiErrorMessage(orderResponse, null) || orderResponse?.message || "Failed to patch Order__c";
                    }
                }

                if (isSuccess && newId) {
                    console.log(`✅ Order synced successfully: ${oldId} → ${newId}`);
                    const allObjects = ["Order", "OrderItem"];
                    await updateReferences(oldId, newId, allObjects);

                    // Fetch created Order__c Auto-number (Name) via GET, matching CartScreen.tsx line 936
                    let orderNo = item.OrderNumber;
                    try {
                        const fetchResponse = await apiFetch("GET", `sobjects/Order__c/${newId}`, {}, "SObjects");
                        if (fetchResponse?.status === "success" && fetchResponse?.data?.Name) {
                            orderNo = fetchResponse.data.Name;
                        }
                    } catch (_) { }

                    await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "insert",
                        data: {
                            Sf_Id: newId,
                            OrderNumber: orderNo,
                            is_synced: true,
                            is_locally_changed: false,
                            sync_status: 'synced',
                            operation_type: null,
                            ErrorMsg: "",
                        },
                    });
                } else {
                    await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "insert",
                        data: {
                            Sf_Id: oldId,
                            is_synced: false,
                            ErrorMsg: String(errorMsg),
                            sync_status: 'failed',
                        },
                    });
                }
            } catch (recordErr) {
                console.error(`❌ Exception syncing Order ${oldId}:`, recordErr);
                await UniversalUpdateInsert({
                    ObjectName: "Order",
                    Type: "insert",
                    data: {
                        Sf_Id: oldId,
                        is_synced: false,
                        ErrorMsg: recordErr?.message || "Sync exception",
                        sync_status: 'failed',
                    },
                });
            }
        }

        return true;
    } catch (err) {
        console.log("Error in syncOrderRecord:", err);
        return false;
    } finally {
        isOrderSyncInProgress = false;
    }
};

export const syncOrderItemRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();

        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "OrderItem",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No OrderItem records found to sync.");
            return false;
        }

        const parentOrders = await UniversalUpdateInsert({ ObjectName: 'Order', Type: 'get' });
        const orderMap = {};
        if (Array.isArray(parentOrders)) {
            for (const order of parentOrders) {
                if (order.Sf_Id) {
                    orderMap[order.Sf_Id] = order;
                }
            }
        }

        for (const item of FalseRecord) {
            // Check if parent Order is synced to Salesforce
            const parentOrder = item.OrderId ? orderMap[item.OrderId] : null;
            const isLocalParentId = !item.OrderId || item.OrderId.startsWith("local-") || item.OrderId.startsWith("ORD-") || (!isNaN(Number(item.OrderId)) && item.OrderId.length !== 15 && item.OrderId.length !== 18);

            if (isLocalParentId && (!parentOrder || !parentOrder.is_synced)) {
                console.log(`⏳ OrderItem ${item.Sf_Id} parent Order (${item.OrderId}) is still unsynced. Waiting for Order sync.`);
                continue;
            }

            const targetOrderId = parentOrder?.Sf_Id || item.OrderId;
            const isNonDms = !!(
                parentOrder?.IsNonDmsOrder__c === true ||
                parentOrder?.IsNonDmsOrder__c === 'true' ||
                parentOrder?.isNonDmsOrder === true ||
                parentOrder?.OrderType === 'NON_DMS' ||
                parentOrder?.OrderType__c === 'NON_DMS'
            );

            const itemPayload = buildOrderItemPayload(item, { isNonDmsOrder: isNonDms }, targetOrderId);

            try {
                console.log(`📤 Uploading OrderItem ${item.Sf_Id} to Salesforce (sobjects/Order_Item__c)...`, JSON.stringify(itemPayload));
                const itemResponse = await apiFetch("POST", "sobjects/Order_Item__c", itemPayload, "SObjects");
                console.log(`📥 Response for OrderItem ${item.Sf_Id}:`, JSON.stringify(itemResponse));

                if (itemResponse?.status === "success" && (itemResponse?.data?.id || itemResponse?.data?.Id)) {
                    const newId = itemResponse.data.id || itemResponse.data.Id;
                    await updateReferences(item.Sf_Id, newId, ["OrderItem"]);
                    await UniversalUpdateInsert({
                        ObjectName: "OrderItem",
                        Type: "insert",
                        data: {
                            Sf_Id: newId,
                            is_synced: true,
                            is_locally_changed: false,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        },
                    });
                } else {
                    const errorMsg = extractApiErrorMessage(itemResponse, null) || itemResponse?.message || "Failed to create Order_Item__c";
                    console.error(`❌ OrderItem sync failed for ${item.Sf_Id}:`, errorMsg);
                    await UniversalUpdateInsert({
                        ObjectName: "OrderItem",
                        Type: "insert",
                        data: {
                            Sf_Id: item.Sf_Id,
                            is_synced: false,
                            ErrorMsg: String(errorMsg),
                            sync_status: 'failed',
                        },
                    });
                }
            } catch (itemErr) {
                console.error(`❌ Exception syncing OrderItem ${item.Sf_Id}:`, itemErr);
                await UniversalUpdateInsert({
                    ObjectName: "OrderItem",
                    Type: "insert",
                    data: {
                        Sf_Id: item.Sf_Id,
                        is_synced: false,
                        ErrorMsg: itemErr?.message || "Sync exception",
                        sync_status: 'failed',
                    },
                });
            }
        }

        return true;
    } catch (err) {
        console.log("Error in OrderItem:", err);
        return false;
    }
};

export const syncCollectionRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Collection__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });

        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Collection__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "ChequeImage__c",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Collection__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Collection__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Collection__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Collection__c", "Collection_Allocation__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Collection__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Collection__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Collection__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Collection__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Collection__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Collection__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncCollectionAllocationRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Collection_Allocation__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Collection_Allocation__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Collection_Allocation__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Collection_Allocation__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Collection_Allocation__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Collection_Allocation__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Collection_Allocation__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Collection_Allocation__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Collection_Allocation__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Collection_Allocation__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Collection_Allocation__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Collection_Allocation__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncInvoiceRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Invoice__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Invoice__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",

            // ----- Your Invoice Fields -----
            "AdditionalDiscount__c",
            "Customer__c",
            "GSTRATE__c",
            "InvoiceDate__c",
            "InvoiceNo__c",
            "Name",
            "Order__c",
            "Outstanding_Amount__c",
            "Return_Adjusted_Against_Outstanding__c",
            "Status__c",
            "SupplierName__c",
            "TotalGSTAmt__c",
            "Total_Net_Amount__c",
            "Total_Sales_Return_Value__c",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Invoice__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Invoice__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log("Response from Invoice__c upload:", JSON.stringify(response));
            // 5️⃣ Process response
            responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Invoice__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Invoice__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Invoice__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Invoice__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Invoice__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Invoice__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Invoice__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncInvoiceItemRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Invoice_Item__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Invoice_Item__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",

            // ------- Your Product Invoice Line Fields -------
            "CGSTAmount__c",
            "Gross_Amount__c",
            "IGSTAmount__c",
            "InvoiceQuantityPcs__c",
            "Invoice_Quantity_In_Mt__c",
            "Invoice__c",
            "Name",
            "NetAmount__c",
            "ProductCode",
            "Product__c",
            "RatePerPC__c",
            "SGSTAmount__c",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Invoice_Item__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Invoice_Item__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Invoice_Item__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Invoice_Item__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Invoice_Item__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Invoice_Item__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Invoice_Item__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Invoice_Item__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Invoice_Item__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Invoice_Item__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncAccountRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Account records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",

            // Your additional fields
            // "Beat__c",
            "BillingAddress",
            // "BillingLatitude",
            // "BillingLongitude",
            "CensusCode__c",
            "Channel__c",
            "Class__c",
            "CreditDays__c",
            "CreditLimit__c",
            "DBType__c",
            "FSSAI_No__c",
            // "GSTIN_Number__c",
            "Active__c",
            "KYC_Updated__c",
            // "Name",
            "OTPVerifiedDate__c",
            "OTPVerified__c",
            "Outlet_Visit_Day__c",
            "OwnerId",
            // "PAN_Number__c",
            "ParentId",
            "Party_Code__c",
            // "RecordTypeId",
            // "SubChannel1__c",
            // "SubChannel2__c",
            // "SubChannel__c",
            // "Type",
            // "Email__c",
            "ManagerId",
            "Region__c",
            "State__c",
            "isPerfect__c", // server-owned flag, never pushed from the device
        ];

        // Split records into with-image (batch size 2) and without-image (batch size 20)
        const recordsWithImage = FalseRecord.filter(
            (item) =>
                item.Visibility_Image__c ||
                item.Other_Promotion_Activity__c
            // item.Other_Promotion_Activity_2__c
        );
        const recordsWithoutImage = FalseRecord.filter(
            (item) =>
                !(
                    item.Visibility_Image__c ||
                    item.Other_Promotion_Activity__c ||
                    item.Other_Promotion_Activity_2__c
                )
        );

        const batches = [];

        for (let i = 0; i < recordsWithImage.length; i += IMAGE_BATCH_SIZE) {
            batches.push(recordsWithImage.slice(i, i + IMAGE_BATCH_SIZE));
        }

        for (let i = 0; i < recordsWithoutImage.length; i += WITHOUT_IMAGE_BATCH_SIZE) {
            batches.push(recordsWithoutImage.slice(i, i + WITHOUT_IMAGE_BATCH_SIZE));
        }

        for (const currentBatch of batches) {
            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                // cleanItem.Hired_Type__c = item.Hired_Type__c?.replace(/,/g, ";");

                cleanItem.Account_Location_Latitude_Longitude__Latitude__s = item.BillingLatitude;
                cleanItem.Account_Location_Latitude_Longitude__Longitude__s =
                    item.BillingLongitude;

                delete cleanItem.BillingLatitude;
                delete cleanItem.BillingLongitude;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            console.log("Account records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Account",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            response = await apiFetch(
                "POST",
                "account-upload",
                Payload,
                "Custom"
            );
            console.log("Response from Account upload:", JSON.stringify(response));
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody;

            if (responseBody?.results?.length) {
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;

                        console.log("Updating references for:", oldId, "→", newId);

                        const payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };

                        const allObjects = ["Account"];

                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        await UniversalUpdateInsert({
                            ObjectName: "Account",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });

                        await UniversalUpdateInsert({
                            ObjectName: "Account",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Account",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }

        logUploadOutcome({ endpoint: "/services/apexrest/account-upload", objectApiName: "Account", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Account:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/account-upload",
            requestBody: { objectApiName: "Account" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncFormJsonecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "FormJson",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No FormJson records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "Unique_Id",
        ];

        const batchSize = IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.duplicateId = item.Sf_Id;
                const jsonData = JSON.parse(item.Json);
                Object.assign(cleanItem, jsonData);
                delete cleanItem.Sf_Id;
                delete cleanItem.Json;
                return cleanItem;
            });
            console.log(
                "FormJson records to sync:",
                JSON.stringify(FalseRecordFiltered)
            );
            // return;

            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Template_Response__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // console.log("FormJson Payload:", JSON.stringify(Payload));
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "account-upload",
                Payload,
                "Custom"
            );
            // console.log("Response from FormJson upload:", JSON.stringify(response));
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody;
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["FormJson"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "FormJson",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "FormJson",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "FormJson",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/account-upload", objectApiName: "Template_Response__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in FormJson:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/account-upload",
            requestBody: { objectApiName: "Template_Response__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncCompetitorRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Competitor_LineItem__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Competitor_LineItem__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "Vertical__c",
            "Name",
        ];

        // Split records into with-image (batch size 3) and without-image (batch size 20)
        const recordsWithImage = FalseRecord.filter((item) => item.Photo__c);
        const recordsWithoutImage = FalseRecord.filter((item) => !item.Photo__c);

        const batches = [];

        for (let i = 0; i < recordsWithImage.length; i += IMAGE_BATCH_SIZE) {
            batches.push(recordsWithImage.slice(i, i + IMAGE_BATCH_SIZE));
        }

        for (let i = 0; i < recordsWithoutImage.length; i += WITHOUT_IMAGE_BATCH_SIZE) {
            batches.push(recordsWithoutImage.slice(i, i + WITHOUT_IMAGE_BATCH_SIZE));
        }

        for (const currentBatch of batches) {
            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Competitor_LineItem__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Competitor_LineItem__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Competitor_LineItem__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Competitor_LineItem__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Competitor_LineItem__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Competitor_LineItem__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Competitor_LineItem__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Competitor_LineItem__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Competitor_LineItem__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Competitor_LineItem__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncStockCheckRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Stock_Check__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Stock_Check__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "CreatedDate",
            "SoftDelete",
        ];

        // Split records into with-image (batch size 3) and without-image (batch size 20)
        const recordsWithImage = FalseRecord.filter((item) => item.Photo__c);
        const recordsWithoutImage = FalseRecord.filter((item) => !item.Photo__c);

        const batches = [];

        for (let i = 0; i < recordsWithImage.length; i += IMAGE_BATCH_SIZE) {
            batches.push(recordsWithImage.slice(i, i + IMAGE_BATCH_SIZE));
        }

        for (let i = 0; i < recordsWithoutImage.length; i += WITHOUT_IMAGE_BATCH_SIZE) {
            batches.push(recordsWithoutImage.slice(i, i + WITHOUT_IMAGE_BATCH_SIZE));
        }

        for (const currentBatch of batches) {
            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Stock_Check__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Stock_Check__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Stock_Check__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Stock_Check__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Stock_Check__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Stock_Check__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Stock_Check__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Stock_Check__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Stock_Check__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Stock_Check__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncMTExceptionRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "MT_Exception__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No MT_Exception__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "Name",
        ];

        // Split records into with-image (batch size 3) and without-image (batch size 20)
        const recordsWithImage = FalseRecord.filter((item) => item.Image__c);
        const recordsWithoutImage = FalseRecord.filter((item) => !item.Image__c);

        const batches = [];

        for (let i = 0; i < recordsWithImage.length; i += IMAGE_BATCH_SIZE) {
            batches.push(recordsWithImage.slice(i, i + IMAGE_BATCH_SIZE));
        }

        for (let i = 0; i < recordsWithoutImage.length; i += WITHOUT_IMAGE_BATCH_SIZE) {
            batches.push(recordsWithoutImage.slice(i, i + WITHOUT_IMAGE_BATCH_SIZE));
        }

        for (const currentBatch of batches) {
            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("MT_Exception__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "MT_Exception__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            console.log(JSON.stringify(Payload));
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from MT_Exception__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["MT_Exception__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "MT_Exception__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "MT_Exception__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "MT_Exception__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "MT_Exception__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in MT_Exception__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "MT_Exception__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncGrowthMappingEntryRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Growth_Mapping_Entry__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Growth_Mapping_Entry__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "Name",
        ];

        // Split records into with-image (batch size 3) and without-image (batch size 20)
        const recordsWithImage = FalseRecord.filter((item) => item.CapturePhoto__c);
        const recordsWithoutImage = FalseRecord.filter(
            (item) => !item.CapturePhoto__c
        );

        const batches = [];

        for (let i = 0; i < recordsWithImage.length; i += IMAGE_BATCH_SIZE) {
            batches.push(recordsWithImage.slice(i, i + IMAGE_BATCH_SIZE));
        }

        for (let i = 0; i < recordsWithoutImage.length; i += WITHOUT_IMAGE_BATCH_SIZE) {
            batches.push(recordsWithoutImage.slice(i, i + WITHOUT_IMAGE_BATCH_SIZE));
        }

        for (const currentBatch of batches) {
            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Growth_Mapping_Entry__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Growth_Mapping_Entry__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // console.log(JSON.stringify(Payload))
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Growth_Mapping_Entry__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Growth_Mapping_Entry__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Growth_Mapping_Entry__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Growth_Mapping_Entry__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Growth_Mapping_Entry__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Growth_Mapping_Entry__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Growth_Mapping_Entry__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Growth_Mapping_Entry__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncSalaryAcknowledgementRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Salary_Acknowledgement__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Salary_Acknowledgement__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Salary_Acknowledgement__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Salary_Acknowledgement__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            console.log(JSON.stringify(Payload));
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Salary_Acknowledgement__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Salary_Acknowledgement__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Salary_Acknowledgement__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Salary_Acknowledgement__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Salary_Acknowledgement__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Salary_Acknowledgement__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in Salary_Acknowledgement__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Salary_Acknowledgement__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncGamificationTransactionRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "Gamification_Transaction__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No Gamification_Transaction__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("Gamification_Transaction__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "Gamification_Transaction__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            console.log(JSON.stringify(Payload));
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from Gamification_Transaction__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["Gamification_Transaction__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Gamification_Transaction__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "Gamification_Transaction__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "Gamification_Transaction__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "Gamification_Transaction__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in syncGamificationTransactionRecord:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "Gamification_Transaction__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncHNTCompetitorPriceRecord = async (apiFetch) => {
    try {
        await loadBatchSizes();
        let response;
        let responseBody;
        // 1️⃣ Get all unsynced records
        const FalseRecord = await UniversalUpdateInsert({
            ObjectName: "HNT_Competitor_Price__c",
            Type: "get",
            filters: [{ field: "is_synced", value: false }],
        });
        if (!FalseRecord || FalseRecord.length === 0) {
            console.log("No HNT_Competitor_Price__c records found to sync.");
            return false;
        }
        // Fields to remove
        const removeKeys = [
            "_changed",
            "_status",
            "operation_type",
            "ErrorMsg",
            "errorMsg",
            "last_modified",
            "is_locally_changed",
            "is_synced",
            "sync_status",
            "id",
            "SoftDelete",
            "Name",
        ];

        const batchSize = WITHOUT_IMAGE_BATCH_SIZE;

        for (let i = 0; i < FalseRecord.length; i += batchSize) {
            const currentBatch = FalseRecord.slice(i, i + batchSize);

            // 2️⃣ Filter & clean records
            const FalseRecordFiltered = currentBatch.map((item) => {
                const cleanItem = Object.fromEntries(
                    Object.entries(item).filter(([key]) => !removeKeys.includes(key))
                );
                cleanItem.Id = item.Sf_Id;
                cleanItem.duplicateId = item.Sf_Id;
                delete cleanItem.Sf_Id;
                return cleanItem;
            });
            // console.log("HNT_Competitor_Price__c records to sync:", FalseRecordFiltered);
            // return;
            // 3️⃣ Prepare payload
            const Payload = [
                {
                    objectApiName: "HNT_Competitor_Price__c",
                    allOrNone: false,
                    records: FalseRecordFiltered,
                },
            ];
            // 4️⃣ API upload call
            const response = await apiFetch(
                "POST",
                "upload-records",
                Payload,
                "Custom"
            );
            console.log(
                "Response from HNT_Competitor_Price__c upload:",
                JSON.stringify(response)
            );
            // 5️⃣ Process response
            const responseBody = response?.data?.responseBody?.[0];
            if (responseBody?.results) {
                let payloadForOfflineSynceDone = {};
                for (const res of responseBody.results) {
                    if (res.status === "success") {
                        const oldId = res.duplicateId;
                        const newId = res.id;
                        console.log("Updating references for:", oldId, "→", newId);
                        payloadForOfflineSynceDone = {
                            Sf_Id: newId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        };
                        const allObjects = ["HNT_Competitor_Price__c"];
                        // Update local DB references
                        await updateReferences(oldId, newId, allObjects);

                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "HNT_Competitor_Price__c",
                            Type: "insert",
                            data: payloadForOfflineSynceDone,
                        });
                        const BeatDayFalseRecordafter = await UniversalUpdateInsert({
                            ObjectName: "HNT_Competitor_Price__c",
                            Type: "get",
                            filters: [{ field: "is_synced", value: false }],
                        });
                    } else {
                        const oldId = res.duplicateId;
                        const errorMsg = res.errorMessage;
                        console.log("Updating Error Msg:", oldId, "→", errorMsg);
                        payloadUpdateErorr = {
                            Sf_Id: oldId,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        };
                        const responseForOfflineSynceDone = await UniversalUpdateInsert({
                            ObjectName: "HNT_Competitor_Price__c",
                            Type: "insert",
                            data: payloadUpdateErorr,
                        });
                    }
                }
            }
        }
        logUploadOutcome({ endpoint: "/services/apexrest/upload-records", objectApiName: "HNT_Competitor_Price__c", response, results: responseBody?.results });
        return true; // success output
    } catch (err) {
        console.log("Error in HNT_Competitor_Price__c:", err);
        InsertNSyncLog({
            endpoint: "/services/apexrest/upload-records",
            requestBody: { objectApiName: "HNT_Competitor_Price__c" },
            responseBody: { message: err.message },
            statusCode: 0,
            loggingType: "Error",
        }).catch(() => { });
        return false;
    }
};

export const syncSurveyResponseRecord = async (apiFetch, apiComposite) => {
    try {
        if (!apiFetch || !apiComposite) {
            console.log("syncSurveyResponseRecord: Missing apiFetch or apiComposite.");
            return false;
        }

        // 1️⃣ Get all unsynced Survey_Response__c records
        const unsyncedResponses = await UniversalUpdateInsert({
            ObjectName: "Survey_Response__c",
            Type: "get",
            filters: [
                { field: "is_synced", value: false },
                { field: "SoftDelete", value: false },
            ],
        });

        if (!unsyncedResponses || unsyncedResponses.length === 0) {
            console.log("No unsynced Survey_Response__c records found to sync.");
            return false;
        }

        console.log(`Found ${unsyncedResponses.length} unsynced Survey_Response__c records. Syncing...`);

        for (const parent of unsyncedResponses) {
            try {
                // 2️⃣ Get the local children (items) for this response
                const items = await UniversalUpdateInsert({
                    ObjectName: "Survey_Response_Item__c",
                    Type: "get",
                    filters: [
                        { field: "Survey_Response__c", value: parent.Sf_Id },
                        { field: "SoftDelete", value: false },
                    ],
                });

                // 3️⃣ First Call: Upload parent Survey_Response__c
                const parentPayload = {
                    Survey_Template__c: parent.Survey_Template__c || null,
                    Visit__c: parent.Visit__c || null,
                    Outlet__c: parent.Outlet__c || null,
                    Field_User__c: parent.Field_User__c || null,
                    Status__c: parent.Status__c || "Submitted",
                    Start_Time__c: parent.Start_Time__c || null,
                    Submit_Time__c: parent.Submit_Time__c || null,
                    Geolocation__Latitude__s: parent.Geolocation__Latitude__s || null,
                    Geolocation__Longitude__s: parent.Geolocation__Longitude__s || null,
                };

                const parentResponse = await apiFetch('POST', 'sobjects/Survey_Response__c', parentPayload, 'SObjects');

                if (parentResponse.status === 'success' && parentResponse.data?.id) {
                    const newParentId = parentResponse.data.id;
                    console.log(`Successfully synced parent survey response. Old ID: ${parent.Sf_Id} -> New ID: ${newParentId}`);

                    // Update references locally (updates parent Sf_Id and child foreign keys)
                    const oldParentId = parent.Sf_Id;
                    await updateReferences(oldParentId, newParentId, ["Survey_Response__c", "Survey_Response_Item__c"]);

                    // Update parent Survey_Response__c locally to synced
                    await UniversalUpdateInsert({
                        ObjectName: "Survey_Response__c",
                        Type: "insert",
                        data: {
                            Sf_Id: newParentId,
                            is_synced: true,
                            sync_status: 'synced',
                            ErrorMsg: "",
                        }
                    });

                    // 4️⃣ Second Call: Upload child items one by one
                    if (items.length > 0) {
                        let allItemsSynced = true;
                        let itemErrorMsg = "";

                        for (let idx = 0; idx < items.length; idx++) {
                            const item = items[idx];
                            const itemPayload = {
                                Survey_Response__c: newParentId,
                                Survey_Question__c: item.Survey_Question__c,
                                Answer_Text__c: item.Answer_Text__c || null,
                                Answer_Number__c: item.Answer_Number__c != null ? Number(item.Answer_Number__c) : null,
                                Answer_Decimal__c: item.Answer_Decimal__c != null ? Number(item.Answer_Decimal__c) : null,
                                Answer_Date__c: item.Answer_Date__c || null,
                                Answer_Time__c: item.Answer_Time__c || null,
                                Answer_Boolean__c: item.Answer_Boolean__c != null ? Boolean(item.Answer_Boolean__c) : null,
                                Rating__c: item.Rating__c != null ? Number(item.Rating__c) : null,
                                Answer_DateTime__c: item.Answer_DateTime__c || null,
                                Answer_percentage__c: item.Answer_percentage__c != null ? Number(item.Answer_percentage__c) : null,
                                Answer_Base64__c: item.Answer_Base64__c || null,
                            };

                            console.log(`Syncing survey response item ${idx + 1}/${items.length} to parent: ${newParentId}`);
                            const itemResponse = await apiFetch('POST', 'sobjects/Survey_Response_Item__c', itemPayload, 'SObjects');

                            if (itemResponse.status === 'success' && itemResponse.data?.id) {
                                const newItemId = itemResponse.data.id;
                                const oldItemId = item.Sf_Id;
                                await updateReferences(oldItemId, newItemId, ["Survey_Response_Item__c"]);

                                await UniversalUpdateInsert({
                                    ObjectName: "Survey_Response_Item__c",
                                    Type: "insert",
                                    data: {
                                        Sf_Id: newItemId,
                                        is_synced: true,
                                        sync_status: 'synced',
                                        ErrorMsg: "",
                                    }
                                });
                            } else {
                                allItemsSynced = false;
                                itemErrorMsg = itemResponse?.message || `Item ${idx + 1} upload failed`;
                                console.error(`❌ Sync item ${idx + 1} failed for parent ${newParentId}:`, itemResponse);
                            }
                        }

                        if (!allItemsSynced) {
                            await UniversalUpdateInsert({
                                ObjectName: "Survey_Response__c",
                                Type: "insert",
                                data: {
                                    Sf_Id: newParentId,
                                    ErrorMsg: itemErrorMsg,
                                    sync_status: 'failed',
                                }
                            });
                        }
                    }
                } else {
                    const errorMsg = parentResponse?.message || "Failed to upload parent via Standard API";
                    console.log(`Failed to sync survey response ${parent.Sf_Id}: ${errorMsg}`);
                    await UniversalUpdateInsert({
                        ObjectName: "Survey_Response__c",
                        Type: "insert",
                        data: {
                            Sf_Id: parent.Sf_Id,
                            ErrorMsg: errorMsg,
                            sync_status: 'failed',
                        }
                    });
                }
            } catch (itemErr) {
                console.error(`Error syncing individual Survey_Response__c parent: ${parent.Sf_Id}:`, itemErr);
            }
        }

        return true;
    } catch (err) {
        console.error("Error in syncSurveyResponseRecord:", err);
        return false;
    }
};
