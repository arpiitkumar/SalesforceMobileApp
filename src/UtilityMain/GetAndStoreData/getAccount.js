// auth/GetAndStoreData/getAccount.js

import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import {
  safeDatabaseOperation,
  safeProgress,
  showErrorToast,
} from "../syncUtils";

const fieldNamesAccount =
  "Id,RecordTypeId, ParentId,Account_Approve__c,Replace_SubDb__c, CreatedDate, FSSAI_No__c,RecordType.Name,Party_Code__c,Name,Active__c," +
  "GSTIN_Number__c,Type,Outlet_Visit_Day__c,Channel__c,Class__c," +
  "BillingAddress,Phone,Email__c,PAN_Number__c,OTPVerified__c,OTPVerifiedDate__c," +
  "KYC_Updated__c,CreditLimit__c,CreditDays__c,CensusCode__c,DBType__c,OwnerId,Account_Location_Latitude_Longitude__Longitude__s," +
  "Account_Location_Latitude_Longitude__Latitude__s,FIFO_Done__c,VIsibility__c,Visibility_Image__c,Other_Promotion_Activity__c, Outlet_Owner_Name__c," +
  "BillingStreet, BillingState, BillingPostalCode, BillingCity,BillingCountry,isPerfect__c";
// const fieldNamesAccount =
//   "Id,Name," +
//   // "BillingLatitude,BillingLongitude" +
//   "BillingAddress,Phone," +
//   "BillingStreet, BillingState, BillingPostalCode, BillingCity,BillingCountry";

// 2. Fetch Accounts via GetObjectData
const fetchAccountsFromSalesforce = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
  GetObjectData,
  onProgress,
}) => {
  safeProgress && safeProgress("Fetching Accounts...", onProgress);

  try {
    const alldataAccount = await GetObjectData(
      fieldNamesAccount,
      "Account",
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser,
    );

    if (!Array.isArray(alldataAccount)) {
      // keep your old behavior: just log/continue, no hard error
      console.log(
        "⚠️ GetObjectData returned non-array for Accounts, continuing anyway",
      );
    }

    console.log(`Fetched ${alldataAccount?.length || 0} Accounts`);
    return { success: true, data: Array.isArray(alldataAccount) ? alldataAccount : [] };
  } catch (err) {
    const msg = `Failed to fetch Accounts: ${err.message}`;
    // previously you did NOT toast here, just returned error
    return { success: false, message: msg };
  }
};

// 3. Clean / map account data
const mapAccountsToLocalSchema = (alldataAccount) => {
  const accounts = Array.isArray(alldataAccount) ? alldataAccount : [];
  return accounts.map((item) => {
    const {
      attributes,
      Id,
      BillingAddress,
      RecordType,
      ...rest
    } = item;
// console.log("Mapping Account:", Id, "RecordType:", RecordType?.Name, "BillingAddress:", BillingAddress?.latitude, BillingAddress?.longitude);
    const rawAddress = BillingAddress
      ? `${BillingAddress.street ?? ""}, ${BillingAddress.city ?? ""}, ${
          BillingAddress.state ?? ""
        }, ${BillingAddress.postalCode ?? ""}, ${BillingAddress.country ?? ""}`
      : "";

      const BillingLatitude = BillingAddress?.latitude ?? null;
      const BillingLongitude = BillingAddress?.longitude ?? null;

    const cleanedAddress = rawAddress
      .replace(/null/gi, "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/(,\s*){2,}/g, ", ")
      .replace(/^,|,$/g, "")
      .trim();

    return {
      // new fields
      Sf_Id: Id,
      RecordType: RecordType?.Name || "",
      BillingAddress: cleanedAddress,
     BillingLatitude: BillingLatitude || null,
      BillingLongitude: BillingLongitude || null,

      // rest of the Salesforce fields flattened as-is
      CreatedDate: item.CreatedDate,
      ...rest,
      // Perfect Store flag (Salesforce may return any casing of the API name)
      isPerfect__c:
        item.isPerfect__c ?? item.IsPerfect__c ?? item.ISPERFECT__c ?? false,

      // sync metadata
      is_locally_changed: false,
      is_synced: true,
      last_modified: Date.now(),
      operation_type: "insert",
    };
  });
};

// 4. Insert accounts into local DB (UniversalUpdateInsert will handle batching internally)
const insertAccountsToDb = async (payload, onProgress) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    safeProgress && safeProgress("No Accounts to insert.", onProgress);
    return { success: true };
  }

  const total = payload.length;
  safeProgress && safeProgress(`Starting Accounts sync`, onProgress);

  const insertResult = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "insert",
        data: payload,
      }),
    `Insert ${payload.length} Account records`,
  );

  if (!insertResult.success) {
    const msg = "Failed to insert Account records into local database";
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  safeProgress && safeProgress(`Accounts sync complete`, onProgress);

  return { success: true };
};

// 5. Main exported function
export const getAccount = async ({
  fetchRecords,
  accessToken,
  instanceUrl,
  loggedInUser,
  GetObjectData,
  onProgress, // optional
}) => {
  try {
    // Step 1: fetch
    const fetchResult = await fetchAccountsFromSalesforce({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser,
      GetObjectData,
      onProgress,
    });

    if (!fetchResult.success) {
      return { success: false, status: "error", message: fetchResult.message };
    }

    // Step 2: map
    const AccountcleanedData = mapAccountsToLocalSchema(fetchResult.data);

    // Step 3: insert (no manual batches, UniversalUpdateInsert handles that)
    const insertResult = await insertAccountsToDb(
      AccountcleanedData,
      onProgress,
    );
    if (!insertResult.success) {
      return { success: false, status: "error", message: insertResult.message };
    }

    return {
      success: true,
      status: "ok",
      message: `Synced ${AccountcleanedData.length} Account records`,
    };
  } catch (err) {
    const msg = `Accounts sync failed: ${
      err && err.message ? err.message : String(err)
    }`;
    safeProgress && safeProgress(msg, onProgress);
    showErrorToast && showErrorToast(msg);
    return { success: false, status: "error", message: msg };
  }
};
