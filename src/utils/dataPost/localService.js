// utils/localService.js
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';

/**
 * Persists a record locally with sync flags.
 * @param {string} objectName  e.g. 'Account' or 'OrderItem'
 * @param {Object} fields      original payload
 * @param {string} sfId        the SFDC ID (real or local fallback)
 * @param {boolean} isSynced   true if this record was saved online
 * @returns {Promise<void>}
 */
export async function saveLocally(objectName, fields, sfId, isSynced) {
  await UniversalUpdateInsert({
    ObjectName: objectName,
    Type: 'insert',
    data: {
      ...fields,
      Sf_Id:           sfId,
      is_synced:       isSynced,
      operation_type:  isSynced ? null : 'insert',
      last_modified:   Date.now(),
    }
  });
}
