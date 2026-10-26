import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Animated,
  Image,
  Easing,
  Linking,
  Alert,
} from "react-native";
import FontAwesome from "@react-native-vector-icons/fontawesome";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HeaderMain from "../components/HeaderMain";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { recalculateNotificationCount } from "../utils/notificationCounter";
import { syncNotificationsFromServer } from "../utils/notificationSync";
import { submitApprovalAction } from "../UtilityMain/notificationApproval";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  getApprovalResultMessage,
  formatFirstNotificationDateTime,
  getNotificationActionId,
  getNotificationIdentity,
  getNotificationStatusLabel,
  getNotificationTitleBodyKey,
  isRespondedNotificationStatus,
  isSoftDeletedNotification,
  normalizeNotificationStatus,
  notificationMatchesIdentity,
  parseNotificationData,
} from "../utils/notificationState";
import {
  addDismissedNotification,
  addDismissedNotifications,
  getDismissedNotificationRecords,
  isNotificationDismissed,
} from "../utils/notificationDismissStore";

import notificationEvents from "../utils/notificationEvents";

/* =======================
   ANIMATED CARD COMPONENT
   ======================= */
const AnimatedNotificationCard = ({
  item,
  onPress,
  styles,
  colors,
  onAction,
  onDelete,
}) => {
  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  const statusLower = normalizeNotificationStatus(item.Status);
  const isUnread = statusLower !== "seen" && !isRespondedNotificationStatus(statusLower);

  // Check if original body already contains status info or reason/comment, in which case we don't override it
  const bodyContainsStatus =
    (statusLower === "approved" && /approved/i.test(item.messageBody || "")) ||
    (statusLower === "rejected" && /rejected/i.test(item.messageBody || "")) ||
    /reason|comment/i.test(item.messageBody || "");

  const resultMessage = bodyContainsStatus
    ? null
    : getApprovalResultMessage(statusLower, item.approvalType || item.extra?.approvalType);

  const displayMessage = String(resultMessage || item.messageBody || "").replace(
    /approved reason/gi,
    "Approval Reason"
  );
  const notificationTimeLabel = `Received: ${formatFirstNotificationDateTime(
    item.requestedAt,
    item.extra?.requestedAt,
    item.sentAt,
    item.extra?.sentAt,
    item.ReceivedAt
  )}`;

  useEffect(() => {
    if (isUnread) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      animation.start();
      return () => animation.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [item.Status, isUnread]);

  return (
    <Animated.View
      style={[
        styles.notificationCard,
        isUnread && styles.unreadAnimatedCard,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={styles.notificationHeaderRow}>
          <View style={styles.notificationLeft}>
            <FontAwesome
              name="bell"
              size={20}
              color={isUnread ? colors.unreadDot : colors.readDot}
            />
            <Text style={styles.notificationTitle} numberOfLines={2}>
              {item.messageTitle}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={[
                styles.statusDot,
                isUnread ? styles.unreadDot : styles.readDot,
              ]}
            />
          </View>
        </View>

        <Text style={styles.notificationBody}>
          {displayMessage}
        </Text>
        <Text style={styles.notificationTime}>
          {notificationTimeLabel}
        </Text>

        {/* IMAGE TYPE */}
        {item.Type?.toLowerCase() === "image" && item.image && (
          <TouchableOpacity
            onPress={() => {
              Linking.openURL(item.image).catch((err) =>
                console.error("Failed to open URL:", err),
              );
            }}
          >
            <Image
              source={{ uri: item.image }}
              style={styles.notificationImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        {/* VIDEO TYPE */}
        {item.Type?.toLowerCase() === "video" && item.image && (
          <TouchableOpacity
            onPress={() => {
              Linking.openURL(item.image).catch((err) =>
                console.error("Failed to open URL:", err),
              );
            }}
          >
            <Text style={styles.videoLink}>
              {item.image}
            </Text>
          </TouchableOpacity>
        )}

        {console.log("item.image ", item.image, item.messageTitle)}
      </TouchableOpacity>
    </Animated.View>
  );
};

/* =======================
   MAIN SCREEN
   ======================= */

const NotificationsScreen = () => {
  const [notificationList, setNotificationList] = useState([]);
  const navigation = useNavigation();

  const { apiFetch } = useApiFetch();

  const deduplicateNotifications = (list) => {
    const getStatusWeight = (status) => {
      const s = normalizeNotificationStatus(status);
      if (isRespondedNotificationStatus(s)) return 3;
      if (s === "seen") return 2;
      return 1;
    };

    const sortedList = [...list].sort((a, b) => {
      const weightDiff = getStatusWeight(b.Status) - getStatusWeight(a.Status);
      if (weightDiff !== 0) return weightDiff;
      return (b.ReceivedAt || 0) - (a.ReceivedAt || 0);
    });

    const seen = new Set();
    const result = [];
    for (const item of sortedList) {
      const tbKey = getNotificationTitleBodyKey(item.messageTitle, item.messageBody);
      const actionId = getNotificationActionId(item);

      const key = actionId
        ? `action_${actionId}`
        : tbKey;

      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result.sort((a, b) => (b.ReceivedAt || 0) - (a.ReceivedAt || 0));
  };

  const loadLocalNotifications = async () => {
    try {
      const notifications = await UniversalUpdateInsert({
        ObjectName: "Notification__c",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      });
      const dismissedRecords = await getDismissedNotificationRecords();
      const formatted = notifications
        .filter((item) => {
          const hasContent = Boolean(
            String(item.Title || "").trim() || String(item.Message || "").trim()
          );
          return hasContent && !isSoftDeletedNotification(item) && !isNotificationDismissed(item, dismissedRecords);
        })
        .map((item) => {
          const extra = parseNotificationData(item.Data);
          return {
            Sf_Id: item.Sf_Id,
            messageTitle: item.Title,
            messageBody: item.Message,
            image: item?.Image,
            Type: item?.Type,
            Status: item.Status,
            ReceivedAt: Number(item.ReceivedAt),
            actionId: getNotificationActionId({ ...item, extra }),
            approvalType: extra?.approvalType || null,
            requestedBy: extra?.requestedBy || null,
            approvalStatus: extra?.approvalStatus || null,
            relatedRecordId: extra?.relatedRecordId || null,
            sentAt: extra?.sentAt || null,
            requestedAt: extra?.requestedAt || extra?.sentAt || Number(item.ReceivedAt),
            actionedAt: extra?.actionedAt || null,
            sfRecordId: item.Sf_Id,
            extra: extra,
          };
        })
        .sort((a, b) => b.ReceivedAt - a.ReceivedAt);

      const deduplicated = deduplicateNotifications(formatted);
      setNotificationList(deduplicated);
    } catch (error) {
      console.error("Failed to refresh notifications:", error);
    }
  };

  useEffect(() => {
    loadLocalNotifications();
    fetchInboxFromSalesforce();

    // 🔔 Real-time listener for new foreground notifications
    const unsubscribe = notificationEvents.subscribe(() => {
      loadLocalNotifications();
    });

    return unsubscribe;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadLocalNotifications();
      recalculateNotificationCount();
    }, [])
  );

  const fetchInboxFromSalesforce = async () => {
    try {
      await syncNotificationsFromServer(apiFetch);
      await loadLocalNotifications();
    } catch (error) {
      console.error("Failed to sync notifications from server:", error);
    }
  };

  const markReadOnSalesforce = async (sfRecordId) => {
    try {
      await apiFetch(
        "PATCH",
        `sobjects/App_Notification__c/${sfRecordId}`,
        { Is_Read__c: "true" },
        "SObjects",
      );
    } catch (error) {
      console.error("Mark read failed:", error);
    }
  };

  const colors = {
    background: "#ffffff",
    cardBackground: "#ffffff",
    text: "#1F1D1A",
    subText: "#555555",
    unreadDot: "#A67C2E",
    readDot: "#737373",
  };

  const handleNotificationPress = async (item) => {
    try {
      console.log("Updating Sf_Id:", item.Sf_Id);

      const statusLower = normalizeNotificationStatus(item.Status);
      const newStatus = statusLower === "new" ? "seen" : item.Status;

      const payload = {
        Sf_Id: item.Sf_Id, // used to match record
        Title: item.messageTitle,
        Message: item.messageBody,
        Image: item.image,
        Type: item.Type,
        Status: newStatus,
        ReceivedAt: item.ReceivedAt,
        last_modified: Date.now(),
        is_locally_changed: true,
        operation_type: "insert",
        Data: JSON.stringify({
          actionId: item.actionId || item.extra?.actionId || null,
          approvalType: item.approvalType || item.extra?.approvalType || null,
          requestedBy: item.requestedBy || item.extra?.requestedBy || null,
          relatedRecordId: item.relatedRecordId || item.extra?.relatedRecordId || null,
          approvalStatus: item.approvalStatus || item.extra?.approvalStatus || null,
          sentAt: item.sentAt || item.extra?.sentAt || null,
          requestedAt: item.requestedAt || item.extra?.requestedAt || item.sentAt || null,
          actionedAt: item.actionedAt || item.extra?.actionedAt || null,
        }),
      };

      console.log("{{{{ :: ", payload);

      if (statusLower === "new") {
        await UniversalUpdateInsert({
          ObjectName: "Notification__c",
          Type: "insert", // FIXED
          data: payload,
        });

        await recalculateNotificationCount();

        if (item.sfRecordId) {
          markReadOnSalesforce(item.sfRecordId);
        }

        // 🔥 Update UI immediately
        setNotificationList((prev) =>
          prev.map((n) =>
            n.Sf_Id === item.Sf_Id ? { ...n, Status: "seen" } : n,
          ),
        );
      }

      const textToSearch = `${item.messageTitle || ""} ${item.messageBody || ""} ${item.Type || ""} ${item.approvalType || ""}`.toLowerCase();

      // Lead Approval / Retailer Onboarding check (Redirect to Retailer Onboarding tab)
      if (textToSearch.includes("lead") || textToSearch.includes("retailer onboarding")) {
        navigation.navigate("TabbedScreen", { defaultTab: "Rocket" });
        return;
      }

      const isApproval =
        item.Type?.toLowerCase() === "approval" &&
        !!(item.actionId || item.extra?.actionId) &&
        !!(item.approvalType || item.extra?.approvalType);

      if (isApproval) {
        const currentStatus = getNotificationStatusLabel(statusLower);

        let reqBy =
          item.requestedBy ||
          item.extra?.requestedBy ||
          item.extra?.requestedByName ||
          item.extra?.createdByName ||
          item.extra?.senderName ||
          null;

        if (!reqBy && item.messageBody) {
          const match = item.messageBody.match(/^([A-Za-z0-9\s.]+?)\s+(?:has requested|requested|applied for|sent a request)/i);
          if (match && match[1]) {
            reqBy = match[1].trim();
          }
        }

        navigation.navigate("ObjectDetail", {
          objectName: "Notification",
          objectId: item.Sf_Id,
          item: {
            Title: item.messageTitle,
            Body: item.messageBody,
            Type: item.Type,
            ApprovalType: item.approvalType || item.extra?.approvalType || "Leave",
            RequestedBy: reqBy || item.requestedBy || item.extra?.requestedBy || "N/A",
            Status: currentStatus,
            RequestedAt: formatFirstNotificationDateTime(
              item.requestedAt,
              item.extra?.requestedAt,
              item.sentAt,
              item.extra?.sentAt,
              item.ReceivedAt
            ),
            actionId: item.actionId || item.extra?.actionId,
            Sf_Id: item.Sf_Id,
            ReceivedAt: item.ReceivedAt,
            image: item.image,
            extra: {
              ...(item.extra || {}),
              requestedBy: reqBy || item.requestedBy || item.extra?.requestedBy || null,
              sentAt: item.sentAt || item.extra?.sentAt || null,
              requestedAt: item.requestedAt || item.extra?.requestedAt || item.sentAt || null,
              actionedAt: item.actionedAt || item.extra?.actionedAt || null,
            },
            Data: JSON.stringify({
              actionId: item.actionId || item.extra?.actionId || null,
              approvalType: item.approvalType || item.extra?.approvalType || null,
              requestedBy: reqBy || item.requestedBy || item.extra?.requestedBy || null,
              sentAt: item.sentAt || item.extra?.sentAt || null,
              requestedAt: item.requestedAt || item.extra?.requestedAt || item.sentAt || null,
              actionedAt: item.actionedAt || item.extra?.actionedAt || null,
            }),
          },
        });
      } else {
        const textToSearch = `${item.messageTitle || ""} ${item.messageBody || ""} ${item.Type || ""} ${item.approvalType || ""}`.toLowerCase();

        if (textToSearch.includes("travel allowance") || textToSearch.includes("travel expense") || textToSearch.includes("travel claim")) {
          navigation.navigate("ClaimTravelAllowance", { allowanceType: "Travel Allowance" });
        } else if (textToSearch.includes("daily allowance") || textToSearch.includes("da allowance")) {
          navigation.navigate("ClaimTravelAllowance", { allowanceType: "Daily Allowance" });
        } else if (textToSearch.includes("signage")) {
          navigation.navigate("SignageRequest");
        } else if (textToSearch.includes("beat plan") || textToSearch.includes("route plan") || textToSearch.includes("journey plan")) {
          navigation.navigate("RoutePlanScreen");
        } else if (textToSearch.includes("attendance") || textToSearch.includes("leave")) {
          navigation.navigate("SRAttendanceScreen");
        } else if (textToSearch.includes("salary") || textToSearch.includes("wage") || textToSearch.includes("incentive")) {
          navigation.navigate("ObjectList", { title: "Salary Acknowledgement", objectName: "Salary_Acknowledgement__c" });
        } else if (textToSearch.includes("order") || textToSearch.includes("billing") || textToSearch.includes("invoice")) {
          navigation.navigate("OrderHistory");
        } else if (textToSearch.includes("sr onboarding")) {
          navigation.navigate("SROnboardingForm");
        } else if (textToSearch.includes("competitor") || textToSearch.includes("pricing")) {
          navigation.navigate("ObjectList", { title: "Competitors", objectName: "Competitor_LineItem__c" });
        } else if (textToSearch.includes("dashboard") || textToSearch.includes("sales performance")) {
          navigation.navigate("DailyDashboard");
        } else {
          navigation.navigate("ObjectDetail", {
            objectName: "Notification",
            objectId: item.Sf_Id,
            item: {
              Title: item.messageTitle,
              Body: item.messageBody,
              Type: item.Type,
              ApprovalType: item.approvalType || item.extra?.approvalType || "General",
              RequestedBy: item.requestedBy || item.extra?.requestedBy || "N/A",
              Status: getNotificationStatusLabel(statusLower),
              RequestedAt: formatFirstNotificationDateTime(
                item.requestedAt,
                item.extra?.requestedAt,
                item.sentAt,
                item.extra?.sentAt,
                item.ReceivedAt
              ),
              Sf_Id: item.Sf_Id,
              ReceivedAt: item.ReceivedAt,
              image: item.image,
              extra: item.extra,
            },
          });
        }
      }
    } catch (error) {
      console.error(" Failed to update notification:", error);
    }
  };

  const handleApprovalAction = async (item, decision) => {
    try {
      const comments =
        decision === "Approve"
          ? "Approved via Mobile APK"
          : "Rejected via Mobile APK";
      const res = await submitApprovalAction(decision, item.actionId, comments, apiFetch);
      if (res.status === "success") {
        const itemExtra = parseNotificationData(item.Data || item.extra);
        const notificationText = [
          item.messageTitle,
          item.messageBody,
          item.approvalType,
          item.Type,
        ].filter(Boolean).join(" ");
        const allowanceId =
          itemExtra.relatedRecordId || item.relatedRecordId || item.recordId || item.RelatedRecordId;
        if (decision === "Reject" && /travel\s+allowance/i.test(notificationText) && allowanceId) {
          const rejectionPayload = { Rejected_Reason__c: comments };
          console.log("----------------------------------");
          console.log("TRAVEL ALLOWANCE REJECTION PAYLOAD (NotificationsScreen)");
          console.log("Allowance ID:", allowanceId);
          console.log("Payload:", JSON.stringify(rejectionPayload, null, 2));
          console.log("----------------------------------");
          const patchRes = await apiFetch(
            "PATCH",
            `sobjects/Allowance_Claim__c/${allowanceId}`,
            rejectionPayload,
            "SObjects"
          );
          console.log("----------------------------------");
          console.log("REJECTION PATCH RESPONSE:", JSON.stringify(patchRes, null, 2));
          console.log("----------------------------------");
        }
        const statusInDb = decision === "Approve" ? "approved" : "rejected";
        const identity = getNotificationIdentity(item);
        const actionedAt = Date.now();
        await UniversalUpdateInsert({
          ObjectName: "Notification__c",
          Type: "insert",
          data: {
            Sf_Id: item.Sf_Id,
            Title: item.messageTitle,
            Message: item.messageBody,
            Image: item.image,
            Type: item.Type,
            Status: statusInDb,
            SoftDelete: false,
            ReceivedAt: item.ReceivedAt,
            last_modified: Date.now(),
            is_locally_changed: true,
            operation_type: "insert",
            Data: JSON.stringify({
              actionId: item.actionId,
              approvalType: item.approvalType,
              requestedBy: item.requestedBy || item.extra?.requestedBy || null,
              sentAt: item.sentAt || item.extra?.sentAt || null,
              requestedAt: item.requestedAt || item.extra?.requestedAt || item.sentAt || null,
              actionedAt,
              approvalStatus: statusInDb,
            }),
          },
        });
        await recalculateNotificationCount();
        setNotificationList((prev) =>
          prev.map((n) =>
            notificationMatchesIdentity(n, identity)
              ? {
                ...n,
                Status: statusInDb,
                actionedAt,
              }
              : n,
          ),
        );
      } else {
        Alert.alert("Approval failed", res.message || "Unable to submit approval action.");
      }
    } catch (error) {
      console.error("Approval action error:", error);
    }
  };

  const handleDeleteNotification = (item) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const identity = getNotificationIdentity(item);
              const deletedAt = Date.now();
              await addDismissedNotification(item);

              // 1. Immediately remove from UI state
              setNotificationList((prev) =>
                prev.filter((n) => !notificationMatchesIdentity(n, identity))
              );

              // 2. Soft delete ALL matching local records in SQLite
              const localRecords = await UniversalUpdateInsert({
                ObjectName: "Notification__c",
                Type: "get",
              });

              const recordsToUpdate = [];
              if (Array.isArray(localRecords)) {
                for (const loc of localRecords) {
                  if (notificationMatchesIdentity(loc, identity)) {
                    const locExtra = parseNotificationData(loc.Data);
                    recordsToUpdate.push({
                      Sf_Id: loc.Sf_Id,
                      Title: loc.Title || item.messageTitle || "",
                      Message: loc.Message || item.messageBody || "",
                      Image: loc.Image || item.image || null,
                      Type: loc.Type || item.Type || "Notification",
                      Status: loc.Status || item.Status || "seen",
                      ReceivedAt: loc.ReceivedAt || item.ReceivedAt || Date.now(),
                      Data: JSON.stringify({
                        ...(locExtra || {}),
                        ...(item.extra || {}),
                        actionId: identity.actionId || locExtra?.actionId || item.actionId || null,
                        deletedAt,
                        isDeletedLocally: true,
                      }),
                      SoftDelete: true,
                      last_modified: Date.now(),
                      is_locally_changed: true,
                    });
                  }
                }
              }

              if (recordsToUpdate.length === 0 && identity.sfId) {
                recordsToUpdate.push({
                  Sf_Id: identity.sfId,
                  Title: item.messageTitle || "",
                  Message: item.messageBody || "",
                  Image: item.image || null,
                  Type: item.Type || "Notification",
                  Status: item.Status || "seen",
                  ReceivedAt: item.ReceivedAt || Date.now(),
                  Data: JSON.stringify({
                    ...(item.extra || {}),
                    actionId: identity.actionId || item.actionId || null,
                    deletedAt,
                    isDeletedLocally: true,
                  }),
                  SoftDelete: true,
                  last_modified: Date.now(),
                  is_locally_changed: true,
                });
              }

              await UniversalUpdateInsert({
                ObjectName: "Notification__c",
                Type: "insert",
                data: recordsToUpdate,
              });

              // 3. Try server delete as best-effort only. Local dismiss store keeps it hidden
              // even when Salesforce denies DELETE access for App_Notification__c.
              const deleteId = item.sfRecordId || identity.sfId;
              if (deleteId) {
                apiFetch(
                  "DELETE",
                  `sobjects/App_Notification__c/${deleteId}`,
                  {},
                  "SObjects"
                ).catch((e) => console.log("Failed to delete notification on server:", e));
              }

              await recalculateNotificationCount();
              await loadLocalNotifications();
            } catch (e) {
              console.error("Failed to delete notification:", e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleClearAllNotifications = () => {
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to delete all notifications? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Immediately clear UI
              setNotificationList([]);

              // 2. Soft delete all locally
              const localRecords = await UniversalUpdateInsert({
                ObjectName: "Notification__c",
                Type: "get",
              });
              await addDismissedNotifications(localRecords);

              const updateData = localRecords.map((r) => ({
                Sf_Id: r.Sf_Id,
                SoftDelete: true,
                last_modified: Date.now(),
                is_locally_changed: true,
              }));

              await UniversalUpdateInsert({
                ObjectName: "Notification__c",
                Type: "insert",
                data: updateData,
              });

              // 3. Request deletion on server for all in background
              for (const r of localRecords) {
                if (r.Sf_Id) {
                  apiFetch(
                    "DELETE",
                    `sobjects/App_Notification__c/${r.Sf_Id}`,
                    {},
                    "SObjects"
                  ).catch((e) => console.log("Failed to delete notification on server:", e));
                }
              }

              await recalculateNotificationCount();
            } catch (e) {
              console.error("Failed to clear notifications:", e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const styles = useMemo(() => createStyles(colors), [colors]);
  const renderItem = ({ item }) => (
    <AnimatedNotificationCard
      item={item}
      styles={styles}
      colors={colors}
      onPress={() => handleNotificationPress(item)}
      onAction={(decision) => handleApprovalAction(item, decision)}
      onDelete={handleDeleteNotification}
    />
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName="Notification" />
      </View>

      <View style={styles.content}>
        {/* Remove clear all button as requested */}

        <FlatList
          data={notificationList}
          renderItem={renderItem}
          keyExtractor={(item) => {
            const identity = getNotificationIdentity(item);
            return identity.actionId || identity.sfId || identity.titleBodyKey || String(item.ReceivedAt);
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notifications available.</Text>
          }
        />
      </View>
    </SafeAreaProvider>
  );
};

export default NotificationsScreen;

/* =======================
   STYLES (UNCHANGED)
   ======================= */
const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#A67C2E",
    },
    content: {
      flex: 1,
      padding: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: "#ffffff",
    },
    clearAllButton: {
      flexDirection: 'row',
      alignSelf: 'flex-end',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 10,
      borderRadius: 8,
      backgroundColor: '#F1EADB',
    },
    clearAllText: {
      color: '#d32f2f',
      fontWeight: '600',
      fontSize: 13,
    },
    headerContainer: {
      backgroundColor: "transparent",
    },
    listContent: {
      padding: 8,
    },
    notificationCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 3,
      elevation: 3,
    },
    unreadAnimatedCard: {
      shadowColor: "#A67C2E",
      shadowOpacity: 0.45,
      marginHorizontal: 5,
      shadowRadius: 12,
      padding: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
      borderWidth: 1,
      borderColor: "#A67C2E",
    },
    notificationHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    notificationLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginLeft: 8,
      flexShrink: 1,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 10,
    },
    unreadDot: {
      backgroundColor: colors.unreadDot,
    },
    readDot: {
      backgroundColor: colors.readDot,
    },
    notificationBody: {
      fontSize: 14,
      color: colors.subText,
      marginTop: 4,
    },
    notificationTime: {
      fontSize: 12,
      color: "#7A7266",
      marginTop: 6,
      fontWeight: "600",
    },
    emptyText: {
      textAlign: "center",
      fontSize: 16,
      color: colors.subText,
      marginTop: 40,
    },
    notificationImage: {
      width: "100%",
      height: 100,
      borderRadius: 10,
      marginTop: 10,
    },
    videoLink: {
      color: "blue",
      textDecorationLine: "underline",
      marginTop: 10,
      fontSize: 14,
    },
    actionRow: {
      flexDirection: "row",
      marginTop: 12,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      marginHorizontal: 4,
    },
    approveBtn: {
      backgroundColor: "#2E7D5B",
    },
    rejectBtn: {
      backgroundColor: "#B3261E",
    },
    actionText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 14,
    },
  });
