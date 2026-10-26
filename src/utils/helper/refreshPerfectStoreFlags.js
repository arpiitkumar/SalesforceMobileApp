import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

const isTrue = (v) =>
  v === true || v === 1 || String(v).toLowerCase() === "true" || String(v) === "1";

/**
 * Lightweight refresh of Account.isPerfect__c.
 *
 * Fetches only the accounts flagged as Perfect Store from Salesforce and
 * updates the local Account rows whose flag differs, so the Beat Plan badge and
 * filter work without waiting for a full account sync.
 *
 * Returns { success, changed } where `changed` is the number of rows updated.
 */
export const refreshPerfectStoreFlags = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  try {
    if (!fetchRecords || !accessToken || !instanceUrl) {
      return { success: false, changed: 0 };
    }

    const rows = await fetchRecords(
      "Account",
      "SELECT Id FROM Account WHERE isPerfect__c = true",
      accessToken,
      instanceUrl,
    );

    // fetchRecords returns { status: 'error' } / [] on failure
    if (!Array.isArray(rows)) {
      return { success: false, changed: 0 };
    }

    const perfectIds = new Set(rows.map((r) => r.Id));

    const local = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
    });

    const updates = (local || [])
      .filter((a) => a.Sf_Id && isTrue(a.isPerfect__c) !== perfectIds.has(a.Sf_Id))
      .map((a) => ({ Sf_Id: a.Sf_Id, isPerfect__c: perfectIds.has(a.Sf_Id) }));

    if (updates.length > 0) {
      await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "insert",
        data: updates,
      });
    }

    return { success: true, changed: updates.length };
  } catch (e) {
    console.log("refreshPerfectStoreFlags failed:", e?.message || e);
    return { success: false, changed: 0 };
  }
};
