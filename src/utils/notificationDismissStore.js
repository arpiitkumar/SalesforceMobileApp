import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getNotificationIdentity,
  getNotificationTitleBodyKey,
} from "./notificationState";

const STORAGE_KEY = "dismissed_app_notifications_v1";
const MAX_DISMISSED = 500;

const readDismissed = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const writeDismissed = async (records) => {
  const sorted = [...records]
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
    .slice(0, MAX_DISMISSED);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
};

export const getDismissedNotificationRecords = readDismissed;

export const addDismissedNotification = async (notification = {}) => {
  const identity = getNotificationIdentity(notification);
  const dismissed = await readDismissed();
  const nextRecord = {
    sfId: identity.sfId || null,
    actionId: identity.actionId || null,
    titleBodyKey: identity.titleBodyKey || null,
    deletedAt: Date.now(),
  };

  const next = [
    nextRecord,
    ...dismissed.filter((record) => !isNotificationDismissedByIdentity(identity, [record])),
  ];
  await writeDismissed(next);
  return nextRecord;
};

export const addDismissedNotifications = async (notifications = []) => {
  const dismissed = await readDismissed();
  const nextRecords = notifications.map((notification) => {
    const identity = getNotificationIdentity(notification);
    return {
      sfId: identity.sfId || null,
      actionId: identity.actionId || null,
      titleBodyKey: identity.titleBodyKey || null,
      deletedAt: Date.now(),
    };
  });

  const next = [
    ...nextRecords,
    ...dismissed.filter((record) =>
      !nextRecords.some((nextRecord) => isNotificationDismissedByIdentity(nextRecord, [record]))
    ),
  ];
  await writeDismissed(next);
  return nextRecords;
};

export const isNotificationDismissedByIdentity = (identity = {}, dismissedRecords = []) => {
  return dismissedRecords.some((record) => {
    if (identity.sfId && record.sfId) return record.sfId === identity.sfId;
    if (identity.actionId && record.actionId) return record.actionId === identity.actionId;
    return !!identity.titleBodyKey && !!record.titleBodyKey && record.titleBodyKey === identity.titleBodyKey;
  });
};

export const isNotificationDismissed = (notification = {}, dismissedRecords = []) => {
  return isNotificationDismissedByIdentity(getNotificationIdentity(notification), dismissedRecords);
};

export const getServerNotificationIdentity = (notification = {}) => ({
  sfId: notification.id || notification.Sf_Id || notification.Id || null,
  actionId: notification.actionId || notification.workItemId || null,
  titleBodyKey: getNotificationTitleBodyKey(notification.title, notification.body),
});
