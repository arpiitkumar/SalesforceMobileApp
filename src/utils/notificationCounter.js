import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import notificationEvents from './notificationEvents';

export const recalculateNotificationCount = async () => {
  try {
    const notifications = await UniversalUpdateInsert({
      ObjectName: 'Notification__c',
      Type: 'get',
      filters: [{ field: 'SoftDelete', value: false }],
    });

    if (!Array.isArray(notifications) || notifications.length === 0) {
      notificationEvents.emit(0);
      return 0;
    }

    // Deduplicate notifications first (same logic as NotificationsScreen)
    const seen = new Set();
    const unreadItems = [];

    const getStatusWeight = (status) => {
      const s = (status || "").toLowerCase();
      if (s === "approved" || s === "rejected") return 3;
      if (s === "seen") return 2;
      return 1;
    };

    // Sort by status weight (approved/rejected/seen first) then ReceivedAt descending
    const sorted = [...notifications].sort((a, b) => {
      const weightDiff = getStatusWeight(b.Status) - getStatusWeight(a.Status);
      if (weightDiff !== 0) return weightDiff;
      return (Number(b.ReceivedAt) || 0) - (Number(a.ReceivedAt) || 0);
    });

    for (const item of sorted) {
      let extra = {};
      try {
        extra =
          typeof item.Data === 'string'
            ? JSON.parse(item.Data || '{}')
            : item.Data || {};
      } catch (e) {
        extra = {};
      }

      const actionId = extra?.actionId || item.actionId;
      const title = item.Title || item.title || item.messageTitle || '';
      const body = item.Message || item.message || item.messageBody || '';
      const titleClean = (title || "").trim().toLowerCase();
      const bodyClean = (body || "").trim().toLowerCase();
      const tbKey = `${titleClean}|||${bodyClean}`;

      const key = actionId
        ? `action_${actionId}`
        : tbKey;

      if (!seen.has(key)) {
        seen.add(key);

        const isReadFlag =
          item.isRead === true ||
          item.isRead === 'true' ||
          item.is_read === true ||
          item.Is_Read__c === 'true' ||
          item.Is_Read__c === true;

        const statusLower = (item.Status || '').toLowerCase();
        const isStatusRead =
          statusLower === 'seen' ||
          statusLower === 'approved' ||
          statusLower === 'rejected';

        if (!isReadFlag && !isStatusRead) {
          unreadItems.push(item);
        }
      }
    }

    const newCount = unreadItems.length;

    // emit to all listeners (Header etc.)
    notificationEvents.emit(newCount);

    return newCount;
  } catch (err) {
    console.error(' Notification count calc failed:', err);
    notificationEvents.emit(0);
    return 0;
  }
};


