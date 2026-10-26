import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from './networkUtils';

const idMatches = (id1, id2) => {
  if (!id1 || !id2) return false;
  const clean1 = String(id1).trim();
  const clean2 = String(id2).trim();
  if (clean1 === clean2) return true;
  return clean1.slice(0, 15) === clean2.slice(0, 15);
};

const formatDistributorItem = (accId, accRecord, fallbackName = "Distributor", fallbackPartyCode = "") => {
  if (!accId) return null;
  const name = accRecord?.Name || accRecord?.name || fallbackName;
  const partyCode = accRecord?.Party_Code__c || accRecord?.PartyCode__c || accRecord?.partyCode || fallbackPartyCode || "";
  return {
    label: name + (partyCode ? " (#" + partyCode + ")" : ""),
    value: accId,
    Distributor__c: accId,
    Name: name,
    Party_Code__c: partyCode,
  };
};

/**
 * Resolves the distributor list for a given beat or visit/account.
 * Works both Online and Offline with extensive multi-tier fallback:
 * 1) Online SOQL fetch for Beat__c and local database cache update
 * 2) Local Beat__c lookup (checks Distributor__c, DirectDBSubDB__c)
 * 3) Local Account lookup (if account itself is a Distributor/BA or has ParentId/Distributor link)
 * 4) Local SR_Beat_Assignment__c lookup (for the beat and/or current user)
 * 5) Local Account table fallback (all active distributors in local DB)
 * 
 * @param {Object} params
 * @param {string} [params.currentBeatId] - The beat ID
 * @param {string} [params.accountId] - Optional account/outlet ID
 * @param {string} [params.userId] - Optional logged-in user ID
 * @param {Function} [params.fetchRecords] - The online query function
 * @returns {Promise<Array<{label: string, value: string, Distributor__c: string}>>} Mapped distributor list
 */
export const getDistributorListForBeat = async ({ currentBeatId, accountId, userId, fetchRecords }) => {
  // 1) Online check: Query Beat__c directly from Salesforce using SOQL and write to local DB
  if (currentBeatId) {
    try {
      const connected = await isInternetAvailable();
      if (connected && fetchRecords) {
        console.log("[distributorHelper] Fetching distributor online for beat:", currentBeatId);
        const beatQuery = `SELECT Id, Name, Beat_Status__c, Distributor__c, Distributor__r.Name, Distributor__r.Party_Code__c FROM Beat__c WHERE Id = '${currentBeatId}'`;
        const beats = await fetchRecords("Beat__c", beatQuery);

        if (Array.isArray(beats) && beats.length > 0) {
          const beatRec = beats[0];
          const distId = beatRec.Distributor__c;
          if (distId) {
            console.log("[distributorHelper] Storing beat and distributor details in local DB:", beatRec);
            
            // Store in local Beat__c table
            await UniversalUpdateInsert({
              ObjectName: "Beat__c",
              Type: "insert",
              data: [{
                Sf_Id: currentBeatId,
                Distributor__c: distId,
                DirectDBSubDB__c: distId,
              }],
            });

            // Store in local Account table (Distributor)
            await UniversalUpdateInsert({
              ObjectName: "Account",
              Type: "insert",
              data: [{
                Sf_Id: distId,
                Name: beatRec.Distributor__r?.Name || "Unknown Distributor",
                Party_Code__c: beatRec.Distributor__r?.Party_Code__c || "",
              }],
            });
          }
        }
      }
    } catch (onlineErr) {
      console.log("[distributorHelper] Online fetch/store failed (running offline):", onlineErr);
    }
  }

  // Load local Accounts once for reference mapping
  let allAccounts = [];
  try {
    allAccounts = (await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
    })) || [];
  } catch (err) {
    console.log("[distributorHelper] Failed to load local accounts:", err);
  }

  const findAccount = (id) => (allAccounts || []).find((a) => idMatches(a.Sf_Id || a.Id, id));

  // 2) Tier 1: Local Beat__c lookup
  if (currentBeatId) {
    try {
      const allBeats = (await UniversalUpdateInsert({
        ObjectName: "Beat__c",
        Type: "get",
      })) || [];

      const beatRecord = allBeats.find((b) => idMatches(b.Sf_Id || b.Id, currentBeatId));
      const distributorId =
        beatRecord?.Distributor__c ||
        beatRecord?.distributor ||
        beatRecord?.DirectDBSubDB__c ||
        beatRecord?.directDbSubDb;

      if (distributorId) {
        const accountRecord = findAccount(distributorId);
        const item = formatDistributorItem(
          distributorId,
          accountRecord,
          beatRecord?.DistributorName || "Cached Distributor"
        );
        if (item) {
          console.log("[distributorHelper] Loaded Distributor from local Beat__c:", item);
          return [item];
        }
      }
    } catch (localDbErr) {
      console.log("[distributorHelper] Local Beat__c query failed:", localDbErr);
    }
  }

  // 3) Tier 2: Local Account lookup (if account itself is a distributor or has linked distributor)
  if (accountId) {
    const outletAccount = findAccount(accountId);
    if (outletAccount) {
      const isDistributorAccount =
        outletAccount.RecordType === "BAs" ||
        outletAccount.RecordTypeId === "BAs" ||
        outletAccount.Type === "Distributor" ||
        outletAccount.DBType__c === "Direct DB";

      if (isDistributorAccount) {
        const item = formatDistributorItem(outletAccount.Sf_Id || outletAccount.Id || accountId, outletAccount);
        if (item) {
          console.log("[distributorHelper] Outlet itself is a Distributor:", item);
          return [item];
        }
      }

      const linkedDistributorId =
        outletAccount.ParentId ||
        outletAccount.Distributor__c ||
        outletAccount.Replace_SubDb__c ||
        outletAccount.DirectDBSubDB__c;

      if (linkedDistributorId) {
        const distAccount = findAccount(linkedDistributorId);
        const item = formatDistributorItem(linkedDistributorId, distAccount);
        if (item) {
          console.log("[distributorHelper] Loaded linked distributor from outlet account:", item);
          return [item];
        }
      }
    }
  }

  // 4) Tier 3: Local SR_Beat_Assignment__c lookup
  try {
    const allAssignments = (await UniversalUpdateInsert({
      ObjectName: "SR_Beat_Assignment__c",
      Type: "get",
    })) || [];

    const beatAssignments = allAssignments.filter((a) => {
      if (a?.SoftDelete === true || a?.isActive === false || a?.isActive__c === false) return false;
      if (currentBeatId && idMatches(a.Beat__c, currentBeatId)) return true;
      if (userId && (idMatches(a.Assigned_To__c, userId) || idMatches(a.Sales_Person_ManagerId__c, userId))) return true;
      return false;
    });

    const uniqueDistributorIds = new Set();
    const assignmentResults = [];

    beatAssignments.forEach((assignment) => {
      const distId = assignment.Distributor__c || assignment.distributor__c;
      if (distId && !uniqueDistributorIds.has(String(distId).slice(0, 15))) {
        uniqueDistributorIds.add(String(distId).slice(0, 15));
        const distAcc = findAccount(distId);
        const item = formatDistributorItem(
          distId,
          distAcc,
          assignment.Name || assignment.name || "Assigned Distributor",
          assignment.PartyCode__c || assignment.partyCode__c || ""
        );
        if (item) {
          assignmentResults.push(item);
        }
      }
    });

    if (assignmentResults.length > 0) {
      console.log("[distributorHelper] Loaded distributors from SR_Beat_Assignment__c:", assignmentResults);
      return assignmentResults;
    }
  } catch (assignmentErr) {
    console.log("[distributorHelper] SR_Beat_Assignment__c query failed:", assignmentErr);
  }

  // 5) Tier 4: All active distributors in local Account table
  try {
    const distributorAccounts = allAccounts.filter((acc) => {
      if (acc.Active__c === false || acc.IsActive__c === false || acc.SoftDelete === true) return false;
      return (
        acc.RecordType === "BAs" ||
        acc.RecordTypeId === "BAs" ||
        acc.Type === "Distributor" ||
        Boolean(acc.Party_Code__c && !acc.Class__c)
      );
    });

    const results = distributorAccounts
      .map((acc) => formatDistributorItem(acc.Sf_Id || acc.Id, acc))
      .filter(Boolean);

    if (results.length > 0) {
      console.log("[distributorHelper] Fallback to all local distributor accounts:", results.length);
      return results;
    }
  } catch (allDistErr) {
    console.log("[distributorHelper] All distributors fallback failed:", allDistErr);
  }

  return [];
};

/**
 * Checks whether an account or visit represents a Distributor/BA rather than a Retailer.
 * @param {Object} item - Account or Visit object
 * @returns {boolean}
 */
export const isDistributorAccount = (item) => {
  if (!item) return false;

  const recordType = String(
    item?.RecordType ||
    item?.RecordType__c ||
    item?.recordType ||
    item?.recordTypeName ||
    item?.RecordType_Name ||
    item?.RecordType?.Name ||
    item?.AccountId__r?.RecordType?.Name ||
    ""
  ).toLowerCase().trim();

  const type = String(item?.Type || item?.type || "").toLowerCase().trim();
  const dbType = String(item?.DBType__c || item?.dbType || "").toLowerCase().trim();
  const channel = String(item?.Channel__c || item?.channel || "").toLowerCase().trim();
  const partyCode = String(item?.Party_Code__c || item?.partyCode || item?.code || "").toLowerCase().trim();
  const name = String(item?.Name || item?.name || item?.AccountName || item?.accountName || "").toLowerCase().trim();

  if (
    recordType === "bas" ||
    recordType === "ba" ||
    recordType.includes("distributor") ||
    recordType.includes("sub db") ||
    recordType.includes("sub-db") ||
    recordType.includes("subdb") ||
    recordType.includes("stockist") ||
    recordType.includes("business associate") ||
    recordType.includes("dealer") ||
    type.includes("distributor") ||
    type.includes("ba") ||
    type.includes("stockist") ||
    type.includes("dealer") ||
    dbType.includes("direct db") ||
    dbType.includes("sub db") ||
    dbType.includes("db") ||
    channel.includes("distributor") ||
    partyCode.startsWith("ba") ||
    partyCode.startsWith("db") ||
    partyCode.startsWith("dis") ||
    name.startsWith("ba ") ||
    name.startsWith("db ")
  ) {
    return true;
  }

  return false;
};

