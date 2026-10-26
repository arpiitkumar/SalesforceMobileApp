// src/database/migration/SchemaMigrationManager.js
// ============================================================
// Enterprise Offline DB Schema Migration (Remote Config controlled)
// ------------------------------------------------------------
// Strategy: "nuke & re-pave", gated by a single Remote Config
// integer version (offline_db_schema_version).
//
//   remoteVersion > localVersion  → migration required:
//      1. Best-effort push of unsynced offline records (reuse sync layer)
//      2. Force-reset the local WatermelonDB (drop all tables, recreate
//         from latest schema — handles new/removed tables & columns)
//      3. Clear the 'initialDataSynced' flag so the existing
//         StartupCoordinator pipeline performs the full master re-sync
//      4. (commit) StartupCoordinator stamps the new version locally
//         ONLY after that full sync succeeds — this is the atomic
//         commit point that makes the whole flow crash-safe & run-once.
//
//   remoteVersion <= localVersion → no-op (normal flow continues)
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetLocalDatabase } from '../dbResetService';
import { getRemoteSchemaVersion } from '../../components/updateService';

// Reuse the existing sync layer (same push functions used by dataSyncer)
import {
  syncCompetitorRecord,
  syncAttendanceRecords,
  syncBeatDayRecord,
  syncVisitRecord,
  syncOrderRecord,
  syncOrderItemRecord,
  syncCollectionRecord,
  syncCollectionAllocationRecord,
  syncInvoiceRecord,
  syncInvoiceItemRecord,
  syncAccountRecord,
  syncFormJsonecord,
  syncStockCheckRecord,
  syncSalaryAcknowledgementRecord,
  syncGamificationTransactionRecord,
  syncMTExceptionRecord,
  syncGrowthMappingEntryRecord,
  syncHNTCompetitorPriceRecord,
} from '../dbService/AllDataSync';

// ============================================================
// Constants
// ============================================================
export const SCHEMA_VERSION_KEY = 'offline_db_schema_version';
const INITIAL_SYNC_KEY = 'initialDataSynced';

// ============================================================
// Local version helpers
// ============================================================
/**
 * Reads the locally persisted schema version.
 * Returns 0 when absent — i.e. legacy production users (who predate this
 * feature) and brand-new installs are both treated as "version 0" and
 * will migrate up to the current Remote Config version exactly once.
 */
export const getLocalSchemaVersion = async () => {
  try {
    const raw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (e) {
    console.warn('[SchemaMigration] Failed to read local version:', e?.message);
    return 0;
  }
};

/**
 * Persists the schema version. MUST be called only after a successful
 * full master re-sync — this write is the migration "commit".
 */
export const commitSchemaVersion = async (version) => {
  try {
    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(version));
    console.log(`🧬 [SchemaMigration] Committed local schema version → v${version}`);
    return true;
  } catch (e) {
    console.warn('[SchemaMigration] Failed to commit version:', e?.message);
    return false;
  }
};

// ============================================================
// Best-effort push of unsynced offline records before wipe
// ============================================================
/**
 * Tries ONCE to push all is_synced=false records to Salesforce using the
 * existing sync layer, so offline-created data is preserved before the
 * destructive reset. Per product decision: if the push fails, we still
 * proceed with a forced reset (we never block the migration), but we
 * always attempt the push first to minimise data loss.
 */
const pushUnsyncedBeforeWipe = async (apiFetch, apiComposite, onProgress) => {
  if (typeof apiFetch !== 'function') {
    console.warn('[SchemaMigration] No apiFetch — skipping pre-wipe push');
    return;
  }
  onProgress?.('Securing offline data before update...');

  // Same order as dataSyncer.handleSyncData — each function is internally
  // try/caught and returns false on failure, so one bad object cannot
  // abort the whole push.
  const steps = [
    syncCompetitorRecord,
    syncAttendanceRecords,
    syncBeatDayRecord,
    syncVisitRecord,
    syncOrderRecord,
    syncOrderItemRecord,
    syncCollectionRecord,
    syncCollectionAllocationRecord,
    syncInvoiceRecord,
    syncInvoiceItemRecord,
    syncAccountRecord,
    syncFormJsonecord,
    syncStockCheckRecord,
    syncSalaryAcknowledgementRecord,
    syncGamificationTransactionRecord,
    syncMTExceptionRecord,
    syncGrowthMappingEntryRecord,
    syncHNTCompetitorPriceRecord,
  ];

  for (const step of steps) {
    try {
      if (step === syncVisitRecord) {
        await step(apiFetch, apiComposite);
      } else {
        await step(apiFetch);
      }
    } catch (e) {
      // never throw — best-effort
      console.warn(`[SchemaMigration] Pre-wipe push step failed (${step.name}):`, e?.message);
    }
  }
};

// ============================================================
// MAIN: run migration if Remote Config version is ahead
// ============================================================
/**
 * Decides whether an offline-DB migration is required and, if so, performs
 * the destructive part (push → reset → clear initial-sync flag).
 *
 * It does NOT commit the new version — that happens in StartupCoordinator
 * AFTER the full master re-sync succeeds, guaranteeing crash-safety.
 *
 * @param {Object}   params
 * @param {Function} params.apiFetch          - from useApiFetch (for pre-wipe push)
 * @param {Function} [params.onProgress]      - UI progress callback (message)
 * @param {Function} [params.onMigrationStart] - fired once, the instant a
 *        migration is confirmed necessary (before any slow work) so the UI
 *        can present the blocking migration popup immediately.
 * @returns {Promise<{checked:boolean, migrated:boolean, targetVersion:number|null}>}
 */
export const runSchemaMigrationIfNeeded = async ({ apiFetch, apiComposite, onProgress, onMigrationStart } = {}) => {
  // 1. Remote version (returns null when offline / RC unreachable)
  const remoteVersion = await getRemoteSchemaVersion();
  if (remoteVersion == null) {
    console.log('[SchemaMigration] Remote version unavailable (offline?) — deferring check');
    return { checked: false, migrated: false, targetVersion: null };
  }

  // 2. Local version (0 for legacy/fresh)
  const localVersion = await getLocalSchemaVersion();
  console.log(`[SchemaMigration] remote=v${remoteVersion} local=v${localVersion}`);

  // 3. Up to date → nothing to do
  if (remoteVersion <= localVersion) {
    return { checked: true, migrated: false, targetVersion: remoteVersion };
  }

  // 4. MIGRATION REQUIRED
  console.log(`🧬 [SchemaMigration] Migration required: v${localVersion} → v${remoteVersion}`);
  // Signal the UI to show the blocking migration popup BEFORE any slow work.
  try { onMigrationStart?.(); } catch (_) {}
  onProgress?.('Preparing database update...');

  // 4a. Best-effort: push unsynced offline records first.
  //     Wrapped so a push failure can never throw a redbox at the user —
  //     per product decision we still proceed to a forced reset.
  try {
    await pushUnsyncedBeforeWipe(apiFetch, apiComposite, onProgress);
  } catch (pushErr) {
    console.warn('[SchemaMigration] Pre-wipe push failed (continuing to reset):', pushErr?.message);
  }

  // 4b. Force reset (drop & recreate from latest schema)
  onProgress?.('Updating local database...');
  await resetLocalDatabase();

  // 4c. Force the existing pipeline to perform a full master re-sync
  await AsyncStorage.removeItem(INITIAL_SYNC_KEY);

  console.log('🧬 [SchemaMigration] Local DB reset complete — full re-sync will follow');
  return { checked: true, migrated: true, targetVersion: remoteVersion };
};

export default runSchemaMigrationIfNeeded;
