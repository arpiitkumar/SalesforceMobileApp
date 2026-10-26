import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { recalculateNotificationCount } from './notificationCounter';
import {
  getNotificationActionId,
  getNotificationTitleBodyKey,
  getNotificationTimestamp,
  isRespondedNotificationStatus,
  isSoftDeletedNotification,
  normalizeNotificationStatus,
  parseNotificationData,
} from './notificationState';
import {
  getDismissedNotificationRecords,
  getServerNotificationIdentity,
  isNotificationDismissedByIdentity,
} from './notificationDismissStore';

const isBeatPlanNotification = (notification) =>
  /beat\s*plan/i.test(
    `${notification?.title || ''} ${notification?.body || ''} ${notification?.type || ''} ${notification?.approvalType || ''}`,
  );

const normalizeSalesforceId = (id) => String(id || '').slice(0, 15);

// Beat Plan approval notifications are generated server-side before their body
// includes the selected distributor. The submitted visits are already in the
// local route-plan cache, so preserve the missing distributor section when the
// notification is saved for display offline as well.
const appendBeatPlanDistributors = async (body, notification) => {
  const relatedRecordId =
    notification?.beatDayId ||
    notification?.beatDayRecordId ||
    notification?.relatedRecordId ||
    notification?.recordId ||
    notification?.relatedId;

  if (!isBeatPlanNotification(notification) || !relatedRecordId || /\bDistributors?\s*\(/i.test(body || '')) {
    return body || '';
  }

  try {
    const visits = await UniversalUpdateInsert({
      ObjectName: 'Visit',
      Type: 'get',
      filters: [
        { field: 'BeatDay__c', value: relatedRecordId },
        { field: 'SoftDelete', value: false },
      ],
    });

    if (!Array.isArray(visits) || !visits.length) return body || '';

    const accountIds = [...new Set(visits.map((visit) => visit.AccountId__c).filter(Boolean))];
    const accounts = accountIds.length
      ? await UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'get',
          filters: [{ field: 'Sf_Id', value: accountIds, operator: 'in' }],
        })
      : [];
    const accountsById = new Map(
      (accounts || []).map((account) => [normalizeSalesforceId(account.Sf_Id), account]),
    );

    const distributors = visits.reduce((result, visit) => {
      const account = accountsById.get(normalizeSalesforceId(visit.AccountId__c));
      const accountType = `${visit.RecordType || ''} ${account?.RecordType || ''} ${account?.Type || ''}`;
      if (!/distributor/i.test(accountType)) return result;

      const id = normalizeSalesforceId(visit.AccountId__c);
      if (id && !result.some((distributor) => distributor.id === id)) {
        result.push({ id, name: account?.Name || visit.AccountName || visit.Name || 'Unnamed Distributor' });
      }
      return result;
    }, []);

    if (!distributors.length) return body || '';

    const distributorSection = `Distributors (${distributors.length}):\n${distributors
      .map((distributor, index) => `${index + 1}. ${distributor.name}\n(Planned Distributor)`)
      .join('\n')}`;
    const updatedVisitCount = visits.length;
    const bodyWithCorrectCount = String(body || '').replace(
      /(Outlets\s*\/\s*Visits\s*\()\d+(\s*\):)/i,
      `$1${updatedVisitCount}$2`,
    );

    // Keep the distributor details with the existing visit section, before the
    // remaining notification metadata when it is present.
    if (/\n\s*Approval Type\s*:/i.test(bodyWithCorrectCount)) {
      return bodyWithCorrectCount.replace(
        /\n(\s*Approval Type\s*:)/i,
        `\n${distributorSection}\n$1`,
      );
    }
    return `${bodyWithCorrectCount}\n${distributorSection}`;
  } catch (error) {
    console.warn('[Notifications] Unable to enrich Beat Plan distributor details:', error);
    return body || '';
  }
};

export const syncNotificationsFromServer = async (apiFetch) => {
  try {
    const response = await apiFetch("GET", "v1/notifications", {}, "Custom");
    const responseData = response?.data || response;
    if (
      !responseData ||
      response?.status === "error" ||
      !responseData?.success ||
      !Array.isArray(responseData?.notifications)
    ) {
      return false;
    }

    const records = responseData.notifications.filter((notification) => {
      const title = String(notification?.title || "").trim();
      const body = String(notification?.body || "").trim();
      if (!title && !body) {
        console.warn("[Notifications] Ignoring blank notification returned by the server:", notification);
        return false;
      }
      return true;
    });
    if (!records.length) {
      await recalculateNotificationCount();
      return true;
    }
    const dismissedRecords = await getDismissedNotificationRecords();

    // Fetch existing local records to preserve user actions (seen/approved/rejected)
    const localRecords = await UniversalUpdateInsert({
      ObjectName: "Notification__c",
      Type: "get",
    });

    const localStatusMapBySfId = new Map();
    const localStatusMapByActionId = new Map();
    const localStatusMapByTitleBody = new Map();
    const softDeletedSfIds = new Set();
    const softDeletedActionIds = new Set();
    const softDeletedTitleBody = new Set();

    for (const loc of localRecords) {
      const title = loc.Title || loc.title || "";
      const body = loc.Message || loc.message || "";
      const tbKey = getNotificationTitleBodyKey(title, body);
      const extra = parseNotificationData(loc.Data);
      const actId = getNotificationActionId({ ...loc, extra });

      if (isSoftDeletedNotification(loc) || extra?.isDeletedLocally === true) {
        if (loc.Sf_Id) softDeletedSfIds.add(loc.Sf_Id);
        if (actId) softDeletedActionIds.add(actId);
        if (tbKey) softDeletedTitleBody.add(tbKey);
      } else {
        const status = normalizeNotificationStatus(extra.approvalStatus || loc.Status);

        if (loc.Sf_Id) {
          const existing = localStatusMapBySfId.get(loc.Sf_Id);
          if (!isRespondedNotificationStatus(existing)) {
            localStatusMapBySfId.set(loc.Sf_Id, status);
          }
        }
        if (actId) {
          const existing = localStatusMapByActionId.get(actId);
          if (!isRespondedNotificationStatus(existing)) {
            localStatusMapByActionId.set(actId, status);
          }
        }
        if (tbKey) {
          const existing = localStatusMapByTitleBody.get(tbKey);
          if (!isRespondedNotificationStatus(existing)) {
            localStatusMapByTitleBody.set(tbKey, status);
          }
        }
      }
    }

    const dbRecords = await Promise.all(records.map(async (r) => {
      const actId = r.actionId || r.workItemId || null;
      const tbKey = getNotificationTitleBodyKey(r.title, r.body);
      const serverSfId = r.id || r.Sf_Id || r.Id;
      const sentAtTimestamp = getNotificationTimestamp(r.sentAt) || Date.now();
      const notificationText = `${r.title || ""} ${r.body || ""} ${r.type || ""} ${r.approvalType || ""}`;
      const isSignageNotification = /signage/i.test(notificationText);
      const relatedRecordId = r.relatedRecordId || r.recordId || r.relatedId || null;
      let signageRequestNumber =
        r.signageRequestNumber ||
        r.requestNumber ||
        r.relatedRecordName ||
        r.recordName ||
        r.requestName ||
        r.relatedRecord?.Name ||
        "";

      // The Signage Request Name is the Salesforce-generated serial number.
      // Resolve it when the notification provides only the related record Id.
      if (isSignageNotification && !signageRequestNumber && relatedRecordId) {
        try {
          const signageResponse = await apiFetch(
            "GET",
            `sobjects/Signage_Request__c/${relatedRecordId}`,
            {},
            "SObjects",
          );
          if (signageResponse?.status === "success") {
            signageRequestNumber = signageResponse?.data?.Name || "";
          }
        } catch (error) {
          console.warn("[Notifications] Unable to load Signage Request serial number:", error);
        }
      }

      const displayTitle = signageRequestNumber && !String(r.title || "").includes(signageRequestNumber)
        ? `${r.title} - ${signageRequestNumber}`
        : r.title;
      const displayBody = signageRequestNumber && !String(r.body || "").includes(signageRequestNumber)
        ? `${r.body} (Request: ${signageRequestNumber})`
        : r.body;
      const enrichedDisplayBody = await appendBeatPlanDistributors(displayBody, r);

      const isSoftDeleted =
        softDeletedSfIds.has(serverSfId) ||
        softDeletedSfIds.has(r.Sf_Id) ||
        (actId && softDeletedActionIds.has(actId)) ||
        (tbKey && softDeletedTitleBody.has(tbKey)) ||
        isNotificationDismissedByIdentity(getServerNotificationIdentity(r), dismissedRecords);

      if (isSoftDeleted) {
        return {
          Sf_Id: serverSfId,
          Title: displayTitle || "",
          Message: enrichedDisplayBody || "",
          Image: r.image || r.imageUrl || null,
          Type: r.type || "Notification",
          Status: "seen",
          ReceivedAt: sentAtTimestamp,
          Data: JSON.stringify({
            actionId: actId,
          approvalType: r.approvalType || null,
          relatedRecordId,
          requestedBy: r.requestedBy || null,
          sentAt: r.sentAt || null,
          requestedAt: r.sentAt || null,
          actionedAt: r.actionedAt || r.approvedAt || r.rejectedAt || r.respondedAt || null,
          approvalStatus: r.status || r.approvalStatus || null,
        }),
        SoftDelete: true,
          last_modified: Date.now(),
        };
      }
      let reqBy =
        r.requestedBy ||
        r.requestedByName ||
        r.createdByName ||
        r.senderName ||
        r.requested_by ||
        r.RequestedBy ||
        r.submittedBy ||
        r.SubmittedBy ||
        r.CreatedBy ||
        r.CreatedByName ||
        r.User ||
        r.UserName ||
        null;

      if (!reqBy && r.body) {
        const match = r.body.match(/^([A-Za-z0-9\s.]+?)\s+(?:has requested|requested|applied for|sent a request)/i);
        if (match && match[1]) {
          reqBy = match[1].trim();
        }
      }

      const extraData = {
        actionId: r.actionId || null,
        approvalType: r.approvalType || null,
        relatedRecordId,
        signageRequestNumber: signageRequestNumber || null,
        requestedBy: reqBy,
        sentAt: r.sentAt || null,
        requestedAt: r.sentAt || null,
        actionedAt: r.actionedAt || r.approvedAt || r.rejectedAt || r.respondedAt || null,
        approvalStatus: r.status || r.approvalStatus || null,
      };

      const serverStatus = normalizeNotificationStatus(r.status || r.approvalStatus);
      const isServerRead =
        r.isRead === true ||
        r.isRead === "true" ||
        r.isRead === 1 ||
        r.Is_Read__c === "true" ||
        r.Is_Read__c === true;

      const localStatus =
        (actId ? localStatusMapByActionId.get(actId) : null) ||
        localStatusMapBySfId.get(serverSfId) ||
        localStatusMapBySfId.get(r.Sf_Id) ||
        (tbKey ? localStatusMapByTitleBody.get(tbKey) : null) ||
        "";

      let finalStatus = "new";
      if (isRespondedNotificationStatus(serverStatus)) {
        finalStatus = serverStatus;
      } else if (isRespondedNotificationStatus(localStatus)) {
        finalStatus = localStatus;
      } else if (localStatus === "seen" || isServerRead) {
        finalStatus = "seen";
      } else {
        finalStatus = "new";
      }

      return {
        Sf_Id: serverSfId,
        Title: displayTitle,
        Message: enrichedDisplayBody,
        Image: r.image || r.imageUrl || null,
        Type: r.type,
        Status: finalStatus,
        SoftDelete: false,
        ReceivedAt: sentAtTimestamp,
        Data: JSON.stringify(extraData),
      };
    }));

    // Insert/update in database
    await UniversalUpdateInsert({
      ObjectName: "Notification__c",
      Type: "insert",
      data: dbRecords,
    });

    // Recalculate badge count
    await recalculateNotificationCount();
    return true;
  } catch (err) {
    console.error("❌ Failed to sync notifications from server:", err);
    return false;
  }
};
