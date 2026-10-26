// utils/InsertNSyncLog.js
// Universal API Logging Utility — Insert log into local WatermelonDB & batch sync to Salesforce
import database from '../database/index';
import { Q } from '@nozbe/watermelondb';
import { store } from '../redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// ============================================================
// Constants
// ============================================================
const SYNC_BATCH_THRESHOLD = 10;
const SF_API_VERSION = 'v61.0';
const SF_COMPOSITE_SOBJECTS_URL = `/services/data/${SF_API_VERSION}/composite/sobjects/`;
// System_Log retry policy: a record Salesforce keeps rejecting is retried up
// to this many times, then marked 'Failed' (deleted on next app launch).
const MAX_SYNC_RETRIES = 3;

// ============================================================
// Helper: Determine Logging Type from HTTP Status Code
// ============================================================
const getLoggingTypeFromStatusCode = (statusCode) => {
  if (statusCode === null || statusCode === undefined) {
    return 'Info';
  }

  const code = Number(statusCode);

  switch (code) {
    // Success
    case 200: // OK
    case 201: // Created
    case 204: // No Content
      return 'Success';

    // Warnings (request completed but needs attention)
    case 300: // Multiple records found (Salesforce External ID)
    case 304: // Not Modified
    case 409: // Conflict
    case 410: // Gone
    case 412: // Precondition Failed
      return 'Warn';

    // Client Errors
    case 400: // Bad Request
    case 401: // Unauthorized
    case 403: // Forbidden
    case 404: // Not Found
    case 405: // Method Not Allowed
    case 414: // URI Too Long
    case 415: // Unsupported Media Type
    case 420: // Salesforce Edge Routing Error
    case 428: // Precondition Required
    case 431: // Request Header Fields Too Large

    // Server Errors
    case 500: // Internal Server Error
    case 502: // Bad Gateway
    case 503: // Service Unavailable
      return 'Error';

    default:
      // Other 2xx
      if (code >= 200 && code < 300) return 'Success';

      // Other 3xx
      if (code >= 300 && code < 400) return 'Warn';

      // Other 4xx/5xx
      if (code >= 400 && code < 600) return 'Error';

      return 'Info';
  }
};

// ============================================================
// Helper: Safely stringify objects for storage
// ============================================================
const safeStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
};

// ============================================================
// Helper: Detect embedded per-record errors in a Salesforce response body
// ------------------------------------------------------------
// Salesforce Standard (UI-API) and Composite endpoints frequently return
// HTTP 200/201 even when individual records/sub-requests FAILED — the failure
// only appears inside the response body. Transport-level (HTTP >= 400) errors
// are already logged by apiFetch/apiComposite catch blocks; this fills the gap
// for body-level failures so they are captured the same way Custom Apex REST
// failures are captured by logUploadOutcome.
//
// Returns { total, failCount, errors:[{ id, error }] }.
// ============================================================
export const extractEmbeddedSfErrors = (data) => {
  const errors = [];
  let total = 0;
  if (!data || typeof data !== 'object') {
    return { total: 0, failCount: 0, errors };
  }

  // Shape A: Composite sObjects collections → [{ id, success, errors:[{message,statusCode}] }]
  if (Array.isArray(data)) {
    for (const r of data) {
      if (!r || typeof r !== 'object') continue;
      total++;
      if (r.success === false) {
        const msg = Array.isArray(r.errors) && r.errors.length
          ? r.errors.map((e) => e.message || e.statusCode || e.errorCode).filter(Boolean).join('; ')
          : 'Unknown Salesforce error';
        errors.push({ id: r.id || null, error: msg });
      }
    }
    return { total, failCount: errors.length, errors };
  }

  // Shape B: Composite API → { compositeResponse: [{ httpStatusCode, referenceId, body }] }
  if (Array.isArray(data.compositeResponse)) {
    for (const sub of data.compositeResponse) {
      if (!sub || typeof sub !== 'object') continue;
      total++;
      const code = Number(sub.httpStatusCode);
      if (code >= 400) {
        const body = sub.body;
        const msg = Array.isArray(body)
          ? body.map((e) => e.message || e.errorCode).filter(Boolean).join('; ')
          : (body?.message || `HTTP ${code}`);
        errors.push({ id: sub.referenceId || null, error: msg || `HTTP ${code}` });
      }
    }
    return { total, failCount: errors.length, errors };
  }

  // Shape C: UI-API / single-record style body-level failure
  //   e.g. { hasErrors: true, results: [...] } or { errors: [...] } or { message, errorCode }
  const topErrors = Array.isArray(data.errors) ? data.errors : null;
  if (data.hasErrors === true || (topErrors && topErrors.length) || data.errorCode) {
    let msg = 'Unknown Salesforce error';
    if (topErrors && topErrors.length) {
      msg = topErrors.map((e) => (typeof e === 'string' ? e : (e.message || e.errorCode || e.statusCode))).filter(Boolean).join('; ');
    } else if (data.message) {
      msg = data.message;
    } else if (data.errorCode) {
      msg = data.errorCode;
    }
    return { total: 1, failCount: 1, errors: [{ id: data.id || null, error: msg }] };
  }

  return { total: 0, failCount: 0, errors };
};

// ============================================================
// Helper: Log an API response, auto-capturing body-level failures
// ------------------------------------------------------------
// Use from the SUCCESS branch of apiFetch / apiComposite (HTTP 2xx). If the
// body carries embedded failures, it is logged as Error (all failed) or Warn
// (partial), otherwise as the normal Success log. Fire-and-forget.
// ============================================================
export const logApiResponse = async ({ endpoint = '', requestBody = {}, responseData = {}, statusCode = '' }) => {
  let loggingType = null;
  let responseBody = responseData;
  try {
    const embedded = extractEmbeddedSfErrors(responseData);
    if (embedded.failCount > 0) {
      loggingType = embedded.failCount === embedded.total ? 'Error' : 'Warn';
      responseBody = {
        total: embedded.total,
        failed: embedded.failCount,
        errors: embedded.errors.slice(0, 50),
        raw: responseData,
      };
    }
  } catch (_) {
    // never let detection break logging — fall back to raw body
  }
  return InsertNSyncLog({ endpoint, requestBody, responseBody, statusCode, loggingType });
};

// ============================================================
// Helper: Get Auth Credentials
// ============================================================
const getAuthCredentials = async () => {
  try {
    // Try Redux store first
    const state = store.getState();
    let userId = state?.auth?.userId || '';
    let accessToken = state?.auth?.accessToken || '';
    let instanceUrl = state?.auth?.instanceUrl || '';

    // Fallback to AsyncStorage if Redux doesn't have them
    if (!accessToken) {
      accessToken = await AsyncStorage.getItem('accessToken_for_datasyncer') || '';
    }
    if (!instanceUrl) {
      instanceUrl = await AsyncStorage.getItem('instanceUrl_for_datasyncer') || '';
    }

    return { userId, accessToken, instanceUrl };
  } catch (e) {
    console.warn('[InsertNSyncLog] Failed to get auth credentials:', e.message);
    return { userId: '', accessToken: '', instanceUrl: '' };
  }
};

// ============================================================
// Helper: Get model field name from column name
// ============================================================
const getModelFieldFromColumnName = (modelInstance, columnName) => {
  const modelClass = modelInstance.constructor;
  const reverseMap = Object.entries(modelClass.columns || {}).reduce((acc, [prop, col]) => {
    acc[col] = prop;
    return acc;
  }, {});
  return reverseMap[columnName];
};

// ============================================================
// STEP 1: Insert Log Record into local WatermelonDB
// ============================================================
const insertLogToLocalDB = async (logData) => {
  try {
    const collection = database.get('System_Log__c');

    await database.write(async () => {
      await collection.create((rec) => {
        Object.entries(logData).forEach(([columnName, value]) => {
          if (value !== undefined && value !== null) {
            const modelKey = getModelFieldFromColumnName(rec, columnName);
            if (modelKey) {
              try {
                rec[modelKey] = value;
              } catch (err) {
                console.warn(`[InsertNSyncLog] Error setting ${modelKey}:`, err.message);
              }
            }
          }
        });
      });
    });

    console.log('📝 [InsertNSyncLog] Log record inserted locally');
    return true;
  } catch (err) {
    console.warn('[InsertNSyncLog] Failed to insert log locally:', err.message);
    return false;
  }
};

// ============================================================
// In-memory flag: disables sync if SF object doesn't exist
// Resets when app restarts
// ============================================================
let isSyncDisabled = false;

// ============================================================
// STEP 2: Check unsynced count & batch sync if threshold met
// ============================================================
const checkAndSyncLogs = async () => {
  try {
    // Skip sync if previously disabled (SF object doesn't exist)
    if (isSyncDisabled) {
      return;
    }

    const collection = database.get('System_Log__c');

    // Count unsynced records
    const unsyncedRecords = await collection.query(
      Q.where('SyncStatus', 'Unsynced')
    ).fetch();

    const unsyncedCount = unsyncedRecords.length;
    console.log(`📊 [InsertNSyncLog] Unsynced log count: ${unsyncedCount}`);

    if (unsyncedCount < SYNC_BATCH_THRESHOLD) {
      return; // Not enough records to sync yet
    }

    // Get auth credentials for Salesforce push
    const { accessToken, instanceUrl } = await getAuthCredentials();

    if (!accessToken || !instanceUrl) {
      console.warn('[InsertNSyncLog] Cannot sync logs — missing auth credentials');
      return;
    }

    // Take the first SYNC_BATCH_THRESHOLD records to sync
    const recordsToSync = unsyncedRecords.slice(0, SYNC_BATCH_THRESHOLD);

    // Build Salesforce composite sObjects request body
    const sfRecords = recordsToSync.map((record) => {
      const raw = record._raw;
      return {
        attributes: { type: 'System_Log__c' },
        Stacktrace__c: raw.Stacktrace__c || '',
        Log_Request__c: raw.Log_Request__c || '',
        Log_Response__c: raw.Log_Response__c || '',
        Log_Status_Code__c: raw.Log_Status_Code__c || '',
        Type__c: raw.Type__c || 'Mobile',
        UserId__c: raw.UserId__c || '',
        Source__c: raw.Source__c || 'Integration',
        Logging_Type__c: raw.Logging_Type__c || 'Info',
      };
    });

    const requestPayload = {
      allOrNone: false,
      records: sfRecords,
    };

    console.log(` [InsertNSyncLog] Pushing ${recordsToSync.length} logs to Salesforce...`);

    // Call Salesforce composite sObjects API
    const response = await axios.post(
      `${instanceUrl}${SF_COMPOSITE_SOBJECTS_URL}`,
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const results = response.data;

    // Process results & update SyncStatus for successful records
    if (Array.isArray(results)) {
      // Check if ALL records failed with "not supported" → SF object doesn't exist
      const allNotSupported = results.every(
        (r) => !r.success && r.errors?.some((e) => e.message?.includes('is not supported'))
      );

      if (allNotSupported) {
        console.warn('⚠️ [InsertNSyncLog] System_Log__c object does NOT exist on Salesforce org.');
        console.warn('⚠️ [InsertNSyncLog] Please create the System_Log__c custom object in Salesforce Setup first.');
        console.warn('⚠️ [InsertNSyncLog] Sync disabled for this session. Logs will continue to be stored locally.');
        isSyncDisabled = true;
        return;
      }

      await database.write(async () => {
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const localRecord = recordsToSync[i];

          if (result.success) {
            // Synced to Salesforce → delete from device immediately.
            await localRecord.destroyPermanently();
            console.log(`[InsertNSyncLog] Log synced & removed locally: ${result.id}`);
          } else {
            // Salesforce REJECTED this record. Retry up to MAX_SYNC_RETRIES,
            // then mark 'Failed' (deleted on next app launch). ErrorMsg/RetryCount
            // are LOCAL only (never sent to Salesforce).
            const errMsg = result.errors?.map(e => e.message).join('; ') || 'Unknown Salesforce error';
            const nextRetry = (localRecord._raw.RetryCount || 0) + 1;
            const exhausted = nextRetry >= MAX_SYNC_RETRIES;
            console.warn(` [InsertNSyncLog] Log sync rejected (attempt ${nextRetry}/${MAX_SYNC_RETRIES}) for record ${i}:`, errMsg);
            await localRecord.update((rec) => {
              rec.syncStatus = exhausted ? 'Failed' : 'Unsynced';
              rec.errorMsg = errMsg;
              rec.retryCount = nextRetry;
            });
          }
        }
      });
    }

    console.log('🎯 [InsertNSyncLog] Batch sync completed');
  } catch (err) {
    console.warn('[InsertNSyncLog] Batch sync failed:', err.message);
    // Silently fail — records remain Unsynced and will be retried
  }
};

// ============================================================
// MAIN EXPORT: InsertNSyncLog
// ============================================================
/**
 * Universal API logging function.
 * Inserts a log record into local WatermelonDB and auto-syncs
 * to Salesforce when unsynced count reaches the batch threshold (10).
 *
 * @param {Object} params
 * @param {string} params.endpoint       - API endpoint (e.g., "/services/apexrest/sendData")
 * @param {Object} params.requestBody    - Request payload object
 * @param {Object} params.responseBody   - Response payload object
 * @param {number|string} params.statusCode - HTTP status code (200, 201, 400, etc.)
 * @param {string} [params.loggingType]  - "Error" | "Warn" | "Success" | "Info" (auto-detected if omitted)
 * @param {string} [params.userId]       - Override user ID (auto-fetched from Redux if omitted)
 *
 * @example
 * // Basic usage (loggingType auto-detected from statusCode):
 * await InsertNSyncLog({
 *   endpoint: '/services/apexrest/sendData',
 *   requestBody: { name: 'Test' },
 *   responseBody: { id: '001...' },
 *   statusCode: 200,
 * });
 *
 * @example
 * // With explicit loggingType:
 * await InsertNSyncLog({
 *   endpoint: '/services/data/v61.0/composite',
 *   requestBody: compositePayload,
 *   responseBody: compositeResponse,
 *   statusCode: 400,
 *   loggingType: 'Error',
 * });
 */
export const InsertNSyncLog = async ({
  endpoint = '',
  requestBody = {},
  responseBody = {},
  statusCode = '',
  loggingType = null,
  userId = null,
}) => {
  try {
    // Get auth credentials
    const creds = await getAuthCredentials();
    const resolvedUserId = userId || creds.userId || '';

    // Auto-detect logging type if not provided
    const resolvedLoggingType = loggingType || getLoggingTypeFromStatusCode(statusCode);

    // Build log record data
    const logData = {
      Sf_Id: '',
      'Stacktrace__c': endpoint,
      'Log_Request__c': safeStringify(requestBody),
      'Log_Response__c': safeStringify(responseBody),
      'Log_Status_Code__c': String(statusCode),
      'Type__c': 'Mobile',
      'UserId__c': resolvedUserId,
      'Source__c': 'Integration',
      'Logging_Type__c': resolvedLoggingType,
      SyncStatus: 'Unsynced',
      CreatedDate: new Date().toISOString(),
      RetryCount: 0,
    };

    // STEP 1: Insert into local DB
    const inserted = await insertLogToLocalDB(logData);

    if (!inserted) {
      return; // If local insert failed, don't attempt sync
    }

    // STEP 2: Check unsynced count and sync if threshold met
    await checkAndSyncLogs();
  } catch (err) {
    // Fire-and-forget: never break the main app flow
    console.warn('[InsertNSyncLog] Unexpected error:', err.message);
  }
};

// ============================================================
// BONUS EXPORT: Force Sync All Unsynced Logs
// ============================================================
/**
 * Force-sync all unsynced log records to Salesforce, regardless of count.
 * Useful for manual triggers like "Sync Now" button or before logout.
 *
 * @example
 * import { forceSyncLogs } from '../utils/InsertNSyncLog';
 * await forceSyncLogs();
 */
export const forceSyncLogs = async () => {
  try {
    if (isSyncDisabled) {
      console.warn('⚠️ [InsertNSyncLog] Sync is disabled — System_Log__c object not found on Salesforce org.');
      return;
    }

    const collection = database.get('System_Log__c');
    const unsyncedRecords = await collection.query(
      Q.where('SyncStatus', 'Unsynced')
    ).fetch();

    if (unsyncedRecords.length === 0) {
      console.log('📊 [InsertNSyncLog] No unsynced logs to force sync');
      return;
    }

    const { accessToken, instanceUrl } = await getAuthCredentials();

    if (!accessToken || !instanceUrl) {
      console.warn('[InsertNSyncLog] Cannot force sync — missing auth credentials');
      return;
    }

    // Salesforce composite sObjects API supports max 200 records per call
    const MAX_PER_CALL = 200;
    const chunks = [];
    for (let i = 0; i < unsyncedRecords.length; i += MAX_PER_CALL) {
      chunks.push(unsyncedRecords.slice(i, i + MAX_PER_CALL));
    }

    for (const chunk of chunks) {
      const sfRecords = chunk.map((record) => {
        const raw = record._raw;
        return {
          attributes: { type: 'System_Log__c' },
          Stacktrace__c: raw.Stacktrace__c || '',
          Log_Request__c: raw.Log_Request__c || '',
          Log_Response__c: raw.Log_Response__c || '',
          Log_Status_Code__c: raw.Log_Status_Code__c || '',
          Type__c: raw.Type__c || 'Mobile',
          UserId__c: raw.UserId__c || '',
          Source__c: raw.Source__c || 'Integration',
          Logging_Type__c: raw.Logging_Type__c || 'Info',
        };
      });

      const requestPayload = {
        allOrNone: false,
        records: sfRecords,
      };

      const response = await axios.post(
        `${instanceUrl}${SF_COMPOSITE_SOBJECTS_URL}`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const results = response.data;

      if (Array.isArray(results)) {
        await database.write(async () => {
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const localRecord = chunk[i];

            if (result.success) {
              // Synced → delete from device immediately.
              await localRecord.destroyPermanently();
            } else {
              // Per-record rejection → retry up to MAX_SYNC_RETRIES, then 'Failed'
              const errMsg = result.errors?.map(e => e.message).join('; ') || 'Unknown Salesforce error';
              const nextRetry = (localRecord._raw.RetryCount || 0) + 1;
              const exhausted = nextRetry >= MAX_SYNC_RETRIES;
              await localRecord.update((rec) => {
                rec.syncStatus = exhausted ? 'Failed' : 'Unsynced';
                rec.errorMsg = errMsg;
                rec.retryCount = nextRetry;
              });
            }
          }
        });
      }
    }

    console.log(`🎯 [InsertNSyncLog] Force sync completed: ${unsyncedRecords.length} records processed`);
  } catch (err) {
    console.warn('[InsertNSyncLog] Force sync failed:', err.message);
  }
};

// ============================================================
// LOGIN SYNC: Push all unsynced logs to SF, delete old synced ones
// ============================================================
/**
 * Called once on every user login.
 *
 * Step 1 — Delete all records with SyncStatus = 'Synced' (cleanup from last session).
 * Step 2 — Push all remaining 'Unsynced' records to Salesforce in batches of 200.
 * Step 3 — Mark each successfully pushed record as 'Synced'.
 *
 * Fire-and-forget: never throws, never blocks the login flow.
 *
 * @example
 * // In loginHandler.js — after auth is stored:
 * syncSystemLogsOnLogin().catch(() => {});
 */
export const syncSystemLogsOnLogin = async () => {
  try {
    const collection = database.get('System_Log__c');

    // STEP 1: App-launch cleanup — remove any leftover 'Synced' records and
    // 'Failed' records (those that exhausted their 3 retries last session).
    const staleRecords = await collection.query(
      Q.where('SyncStatus', Q.oneOf(['Synced', 'Failed']))
    ).fetch();

    if (staleRecords.length > 0) {
      await database.write(async () => {
        for (const record of staleRecords) {
          await record.destroyPermanently();
        }
      });
      console.log(`🗑️ [syncSystemLogsOnLogin] Cleaned up ${staleRecords.length} synced/failed log(s)`);
    }

    // STEP 2: Fetch all unsynced records
    const unsyncedRecords = await collection.query(
      Q.where('SyncStatus', 'Unsynced')
    ).fetch();

    if (unsyncedRecords.length === 0) {
      console.log('📊 [syncSystemLogsOnLogin] No unsynced logs to push');
      return;
    }

    console.log(` [syncSystemLogsOnLogin] Pushing ${unsyncedRecords.length} unsynced log(s) to Salesforce...`);

    // STEP 3: Get auth credentials (freshly stored by login flow)
    const { accessToken, instanceUrl } = await getAuthCredentials();
    if (!accessToken || !instanceUrl) {
      console.warn('[syncSystemLogsOnLogin] Cannot sync — missing auth credentials');
      return;
    }

    // Composite sObjects API supports max 200 records per call
    const MAX_PER_CALL = 200;
    let totalSynced = 0;

    for (let i = 0; i < unsyncedRecords.length; i += MAX_PER_CALL) {
      const chunk = unsyncedRecords.slice(i, i + MAX_PER_CALL);

      const sfRecords = chunk.map((record) => {
        const raw = record._raw;
        return {
          attributes: { type: 'System_Log__c' },
          Stacktrace__c: raw.Stacktrace__c || '',
          Log_Request__c: raw.Log_Request__c || '',
          Log_Response__c: raw.Log_Response__c || '',
          Log_Status_Code__c: raw.Log_Status_Code__c || '',
          Type__c: raw.Type__c || 'Mobile',
          UserId__c: raw.UserId__c || '',
          Source__c: raw.Source__c || 'Integration',
          Logging_Type__c: raw.Logging_Type__c || 'Info',
        };
      });

      const response = await axios.post(
        `${instanceUrl}${SF_COMPOSITE_SOBJECTS_URL}`,
        { allOrNone: false, records: sfRecords },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const results = response.data;
      if (Array.isArray(results)) {
        await database.write(async () => {
          for (let j = 0; j < results.length; j++) {
            if (results[j].success) {
              // Synced → delete from device immediately.
              await chunk[j].destroyPermanently();
              totalSynced++;
            } else {
              // Per-record rejection → retry up to MAX_SYNC_RETRIES, then 'Failed'
              const errMsg = results[j].errors?.map(e => e.message).join('; ') || 'Unknown Salesforce error';
              const nextRetry = (chunk[j]._raw.RetryCount || 0) + 1;
              const exhausted = nextRetry >= MAX_SYNC_RETRIES;
              await chunk[j].update((rec) => {
                rec.syncStatus = exhausted ? 'Failed' : 'Unsynced';
                rec.errorMsg = errMsg;
                rec.retryCount = nextRetry;
              });
            }
          }
        });
      }
    }

    console.log(`[syncSystemLogsOnLogin] Done: ${totalSynced}/${unsyncedRecords.length} log(s) synced to Salesforce`);
  } catch (err) {
    console.warn('[syncSystemLogsOnLogin] Failed:', err.message);
  }
};

export default InsertNSyncLog;
