// Centralised helper for persisting sync state on records that are pushed
// to Salesforce inline (i.e. from UI handlers, outside the batch AllDataSync
// layer). Keeps is_synced / sync_status / ErrorMsg consistent everywhere.
//
//   apiSuccess === true             -> synced   (clears any previous error)
//   apiSuccess === false, attempted  -> failed   (stores the error message)
//   apiSuccess === false, !attempted -> unsynced (offline / never attempted)
//
// `attempted` defaults to true because most call sites only invoke this after
// an API call has actually been made; pass attempted:false for the offline
// (no network) branch so the record is labelled unsynced, not failed.

export const SYNC_STATUS = {
  UNSYNCED: "unsynced",
  SYNCED: "synced",
  FAILED: "failed",
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

export interface SyncFields {
  is_synced: boolean;
  sync_status: SyncStatus;
  ErrorMsg: string | null;
}

export interface BuildSyncFieldsArgs {
  apiSuccess: boolean;
  attempted?: boolean;
  errorMsg?: string | null;
}

/**
 * Returns the { is_synced, sync_status, ErrorMsg } fields to merge into a
 * record payload before passing it to UniversalUpdateInsert.
 */
export const buildSyncFields = ({
  apiSuccess,
  attempted = true,
  errorMsg = null,
}: BuildSyncFieldsArgs): SyncFields => {
  if (apiSuccess) {
    return { is_synced: true, sync_status: SYNC_STATUS.SYNCED, ErrorMsg: null };
  }
  if (attempted) {
    return {
      is_synced: false,
      sync_status: SYNC_STATUS.FAILED,
      ErrorMsg: errorMsg ? String(errorMsg).slice(0, 1000) : "Sync failed",
    };
  }
  return { is_synced: false, sync_status: SYNC_STATUS.UNSYNCED, ErrorMsg: null };
};

/**
 * Best-effort extraction of a human-readable error message from a failed
 * apiFetch response or a thrown error. Tolerant of the various response
 * envelopes used across the app.
 */
export const extractApiErrorMessage = (
  response: any,
  error?: any
): string | null => {
  if (error) return error?.message || String(error);
  if (!response) return null;

  const rb =
    response?.data?.data?.responseBody ||
    response?.data?.responseBody ||
    response?.responseBody ||
    response?.data ||
    response;

  // Salesforce composite/custom APIs sometimes nest the failure in results[]
  const firstResult = Array.isArray(rb?.results)
    ? rb.results.find((r: any) => r?.status === "fail" || r?.errorMessage)
    : null;
  const firstArrayError = Array.isArray(rb) ? rb[0] : null;

  return (
    firstResult?.errorMessage ||
    firstArrayError?.message ||
    firstArrayError?.errorMessage ||
    rb?.errorMessage ||
    rb?.message ||
    rb?.error ||
    rb?.errorForStackTrack ||
    rb?.errorForStackTrace ||
    response?.data?.message ||
    response?.data?.errorForStackTrack ||
    response?.message ||
    (typeof rb === "string" ? rb : null) ||
    null
  );
};
