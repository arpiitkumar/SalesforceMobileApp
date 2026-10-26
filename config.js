/**
 * ⚠️  STUB — replace with the real file from your original project.
 *
 * In the source app this module lived at the PROJECT ROOT (a sibling of `src/`,
 * imported as `../config` / `../../config` / `../../../config`). It was NOT part
 * of the `src/` folder that was handed over, so this placeholder was generated
 * from the 7 symbols the code imports. Fill in the real Salesforce Ids / keys
 * and the CLEAR_TABLES lists, or paste your original `config.js` over this file.
 *
 * Consumers (see `grep -rn "\\.\\./config" src`):
 *   CLEAR_TABLES            – string[] of WatermelonDB tables wiped on logout
 *   CLEAR_TABLES_GET_DATA   – string[] of tables wiped before a full re-sync
 *   loadDynamicConfig()     – async; in the original this fetched org config and
 *                             refreshed the *_var values below
 *   PlaceId_var             – Google Places API key (AddAccountForm, maps search)
 *   PriceBookId_var         – Salesforce Pricebook2 Id used on new orders
 *   OrderRecordTypeId_var   – RecordTypeId for Order__c inserts
 *   ReturnRecordTypeId_var  – RecordTypeId for return orders
 */

// Populate with the exact table names from src/database/schema.js that must be
// cleared on logout / before a fresh sync.
export const CLEAR_TABLES = [];
export const CLEAR_TABLES_GET_DATA = [];

// 18-char Salesforce Ids / API keys for YOUR org. Left blank so the code's
// `|| ''` fallbacks kick in until you set them (or until loadDynamicConfig runs).
export let PlaceId_var = '';
export let PriceBookId_var = '';
export let OrderRecordTypeId_var = '';
export let ReturnRecordTypeId_var = '';

/**
 * Original behaviour: pull dynamic configuration from the backend / remote config
 * and update the *_var exports above. This stub is a safe no-op so startup and
 * picklist sync don't crash — implement the real fetch here.
 */
export async function loadDynamicConfig() {
  // no-op stub
  return {};
}
