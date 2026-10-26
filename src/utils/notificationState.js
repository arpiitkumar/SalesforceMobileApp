export const parseNotificationData = (data) => {
  try {
    if (!data) return {};
    return typeof data === "string" ? JSON.parse(data || "{}") : data || {};
  } catch (e) {
    return {};
  }
};

export const normalizeNotificationStatus = (status) =>
  String(status || "").trim().toLowerCase();

export const isRespondedNotificationStatus = (status) => {
  const normalized = normalizeNotificationStatus(status);
  return normalized === "approved" || normalized === "rejected";
};

export const isSoftDeletedNotification = (notification = {}) =>
  notification.SoftDelete === true ||
  notification.SoftDelete === 1 ||
  notification.SoftDelete === "true" ||
  notification.softDelete === true ||
  notification.softDelete === 1 ||
  notification.softDelete === "true";

export const getNotificationStatusLabel = (status, fallback = "Pending") => {
  const normalized = normalizeNotificationStatus(status);
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "seen" || normalized === "new" || normalized === "pending") {
    return "Pending";
  }
  return status || fallback;
};

export const getNotificationActionId = (notification = {}) => {
  const extra = parseNotificationData(notification.Data || notification.extra);
  return (
    notification.actionId ||
    notification.ActionId ||
    extra.actionId ||
    extra.workItemId ||
    null
  );
};

export const getNotificationTitleBodyKey = (title, body) => {
  const cleanTitle = String(title || "").trim().toLowerCase();
  const cleanBody = String(body || "").trim().toLowerCase();
  return cleanTitle || cleanBody ? `${cleanTitle}|||${cleanBody}` : "";
};

export const getNotificationIdentity = (notification = {}) => {
  const extra = parseNotificationData(notification.Data || notification.extra);
  const title =
    notification.Title ||
    notification.messageTitle ||
    notification.title ||
    "";
  const body =
    notification.Message ||
    notification.Body ||
    notification.messageBody ||
    notification.body ||
    "";

  return {
    sfId: notification.Sf_Id || notification.sfRecordId || notification.id || null,
    actionId: getNotificationActionId({ ...notification, extra }),
    titleBodyKey: getNotificationTitleBodyKey(title, body),
  };
};

export const notificationMatchesIdentity = (notification = {}, identity = {}) => {
  const current = getNotificationIdentity(notification);
  if (identity.sfId && current.sfId) return current.sfId === identity.sfId;
  if (identity.actionId && current.actionId) return current.actionId === identity.actionId;
  return !!identity.titleBodyKey && !!current.titleBodyKey && current.titleBodyKey === identity.titleBodyKey;
};

export const getApprovalResultMessage = (status, approvalType = "Request") => {
  const normalized = normalizeNotificationStatus(status);
  const requestType = approvalType || "Request";
  if (normalized === "approved") return `${requestType} request has been approved.`;
  if (normalized === "rejected") return `${requestType} request has been rejected.`;
  return null;
};

export const getNotificationTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && value.trim().toLowerCase() === "n/a") {
    return null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const numericValue = Number(value.trim());
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
};

export const formatNotificationDateTime = (value) => {
  const timestamp = getNotificationTimestamp(value);
  if (!timestamp) return "N/A";

  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
};

export const formatFirstNotificationDateTime = (...values) => {
  for (const value of values) {
    const timestamp = getNotificationTimestamp(value);
    if (timestamp) {
      return formatNotificationDateTime(timestamp);
    }
  }
  return "N/A";
};
