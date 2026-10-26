import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import moment from "moment";
import LinearGradient from "react-native-linear-gradient";
import { submitApprovalAction } from "../UtilityMain/notificationApproval";
import { recalculateNotificationCount } from "../utils/notificationCounter";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import {
  formatFirstNotificationDateTime,
  getNotificationActionId,
  getNotificationIdentity,
  getNotificationStatusLabel,
  isRespondedNotificationStatus,
  isSoftDeletedNotification,
  normalizeNotificationStatus,
  notificationMatchesIdentity,
  parseNotificationData,
} from "../utils/notificationState";

const { height } = Dimensions.get("window");

export default function ObjectDetail({ route }) {
  const { objectName, objectId, item } = route.params;
  const navigation = useNavigation();
  const currentUserId = useSelector((state) => state.auth?.userId);
  const { apiFetch } = useApiFetch();

  const anim = useRef(new Animated.Value(0)).current;
  const [record, setRecord] = useState(item || null);
  const [visibleDetails, setVisibleDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonError, setReasonError] = useState("");

  /* ---------------- CONFIG (UNCHANGED) ---------------- */

  const VISIBLE_FIELDS = {
    Account: [
      "Name",
      "Party_Code__c",
      "Phone",
      "Email__c",
      "GSTIN_Number__c",
      // "SubChannel__c",
      "PAN_Number__c",
    ],
     Lead__c: [
      "Name",
      "Phone",
      "Email__c",
      "RegisteredDate__c",
      "PANNumber__c",
      "GSTIN_Number__c",
      "FSSAINumber__c",
      "BillingAddress",
      "Approval_Status__c",
    ],
    Competitor_LineItem__c: [
      "Competitor__c",
      "Date__c",
      "OilType__c",
      "Product__c",
      "State__c",
      "City__c",
      "Price_MT__c",
      "PTD__c",
      "Remarks__c",
    ],
    Collection__c: [
      "Name",
      "PaymentMode__c",
      "DateOfPayment__c",
      "PaidAmount__c",
      "BankName__c",
      "ChequeNumber__c",
    ],
    Salary_Acknowledgement__c: [
      "DB_Name__c",
      "Submitted_Date__c",
      "Month__c",
      "Description__c",
      "Year__c",
      "Amount__c",
    ],
    HNT_Competitor_Price__c: [
      "Name",
      "Price_Zone__c",
      "Oil_Type__c",
      "Brand__c",
      "Pack_Type__c",
      "Grammage__c",
      "Others_To_Be_Field_By_HO__c",
      "Scheme__c",
      "PTD__c",
      "NPTD__c",
      "PTR__c",
      "NPTR__c",
      "Remarks__c",
    ],
    Notification: [
      "Title",
      "Body",
      // "Type",
      "ApprovalType",
      "RequestedBy",
      "RequestedAt",
      "Status",
    ],
  };

  const FIELD_LABELS = {
     Lead__c: {
      Name: "Retailer Name",
      Phone: "Mobile number",
      Email__c: "Email",
      RegisteredDate__c: "Registered Date",
      PANNumber__c: "PAN Number",
      GSTIN_Number__c: "GST Number",
      FSSAINumber__c: "FSSAI Number",
      BillingAddress: "Address",
      Approval_Status__c: "Approval Status",
    },
    HNT_Competitor_Price__c: {
      Name: "Name",
      Price_Zone__c: "Price Zone",
      Oil_Type__c: "Oil Type",
      Brand__c: "Brand",
      Pack_Type__c: "Pack Type",
      Grammage__c: "Grammage",
      Others_To_Be_Field_By_HO__c: "Others To Be Field By HO",
      Scheme__c: "Scheme",
      PTD__c: "PTD",
      NPTD__c: "NPTD",
      PTR__c: "PTR",
      NPTR__c: "NPTR",
      Remarks__c: "Remarks",
    },
    Account: {
      Name: "Full Name",
      Party_Code__c: "Party Code",
      Phone: "Phone",
      Email__c: "Email",
      GSTIN_Number__c: "GST Number",
      // SubChannel__c: "Sub Channel",
      PAN_Number__c: "PAN Number",
    },
    Competitor_LineItem__c: {
      Competitor__c: "Brand",
      Date__c: "Date",
      OilType__c: "Oil Type",
      Product__c: "SKU",
      State__c: "State",
      City__c: "City",
      Price_MT__c: "MOP",
      PTD__c: "PTD",
      Remarks__c: "Remarks",
    },
    Collection__c: {
      Name: "Name",
      PaymentMode__c: "Payment Mode",
      DateOfPayment__c: "Date Of Payment",
      PaidAmount__c: "Paid Amount",
      BankName__c: "Bank Name",
      ChequeNumber__c: "Cheque Number",
    },
    Salary_Acknowledgement__c: {
      DB_Name__c: "Name",
      Amount__c: "Amount",
      Year__c: "Year",
      Description__c: "Description",
      Month__c: "Month",
      Submitted_Date__c: "Submitted Date",
    },
    Notification: {
      Title: "Title",
      Body: "Message",
      // Type: "Notification Type",
      ApprovalType: "Approval Type",
      RequestedBy: "Requested By",
      RequestedAt: "Received At",
      Status: "Status",
    },
  };

  /* ---------------- ANIMATION ---------------- */

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  /* ---------------- DATA LOGIC (UNCHANGED) ---------------- */

  const fetchRecordById = async () => {
    try {
      const result = await UniversalUpdateInsert({
        ObjectName: objectName,
        Type: "get",
        filters: [{ field: "Sf_Id", value: objectId }],
      });
      return result?.[0] || {};
    } catch {
      return {};
    }
  };

  const sortCollectionsByName = (records = []) => {
    return [...records].sort((a, b) => {
      const numA = parseInt((a.Name || "").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt((b.Name || "").replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
  };

  useEffect(() => {
    const load = async () => {
      let rec = record;

      if (objectName === "Notification") {
        let dbRecord = {};
        if (objectId || item?.Sf_Id) {
          try {
            const fetched = await UniversalUpdateInsert({
              ObjectName: "Notification__c",
              Type: "get",
              filters: [{ field: "Sf_Id", value: objectId || item?.Sf_Id }],
            });
            if (fetched && fetched.length > 0) {
              dbRecord = fetched[0];
            }
          } catch (e) {
            console.error("Error fetching notification record:", e);
          }
        }

        if (isSoftDeletedNotification(dbRecord)) {
          setRecord({ ...(item || {}), ...(dbRecord || {}), Status: "Deleted" });
          setVisibleDetails([]);
          return;
        }

        const mergedRecord = {
          ...(item || {}),
          ...(dbRecord || {}),
        };

        const extra = parseNotificationData(mergedRecord.Data || mergedRecord.extra);

        const dbStatus = normalizeNotificationStatus(dbRecord.Status);
        const itemStatus = normalizeNotificationStatus(item?.Status);
        const extraStatus = normalizeNotificationStatus(extra.approvalStatus);

        let rawStatus = "Pending";
        if (
          isRespondedNotificationStatus(dbStatus) ||
          isRespondedNotificationStatus(extraStatus)
        ) {
          rawStatus = isRespondedNotificationStatus(dbStatus) ? dbStatus : extraStatus;
        } else if (isRespondedNotificationStatus(itemStatus)) {
          rawStatus = itemStatus;
        } else {
          rawStatus = mergedRecord.Status || dbRecord.Status || item?.Status || "Pending";
        }

        const formattedStatus = getNotificationStatusLabel(rawStatus);

        const isRespondedStatus = formattedStatus === "Approved" || formattedStatus === "Rejected";

        const extraToSave = {
          ...extra,
          actionId: getNotificationActionId({ ...mergedRecord, extra }) || item?.actionId || item?.extra?.actionId || null,
          approvalType: mergedRecord.approvalType || extra.approvalType || item?.approvalType || item?.extra?.approvalType || null,
          requestedBy: extra.requestedBy || item?.requestedBy || item?.extra?.requestedBy || null,
          sentAt: extra.sentAt || item?.sentAt || item?.extra?.sentAt || null,
          requestedAt: extra.requestedAt || item?.requestedAt || item?.extra?.requestedAt || extra.sentAt || item?.sentAt || null,
          actionedAt: extra.actionedAt || item?.actionedAt || item?.extra?.actionedAt || null,
        };

        if (!isRespondedStatus && (dbRecord.Status === "new" || mergedRecord.Status === "new") && (objectId || item?.Sf_Id)) {
          try {
            await UniversalUpdateInsert({
              ObjectName: "Notification__c",
              Type: "insert",
              data: {
                Sf_Id: objectId || item?.Sf_Id,
                Title: mergedRecord.Title || mergedRecord.messageTitle || dbRecord.Title || "",
                Message: mergedRecord.Body || mergedRecord.messageBody || dbRecord.Message || "",
                Image: mergedRecord.image || dbRecord.Image || null,
                Type: mergedRecord.Type || dbRecord.Type || "Notification",
                Status: "seen",
                ReceivedAt: mergedRecord.ReceivedAt || dbRecord.ReceivedAt || Date.now(),
                last_modified: Date.now(),
                is_locally_changed: true,
                operation_type: "insert",
                Data: JSON.stringify(extraToSave),
              },
            });
            await recalculateNotificationCount();
          } catch (e) {
            console.error("Error auto-marking notification seen in ObjectDetail:", e);
          }
        }

        const bodyMsg = mergedRecord.Body || mergedRecord.messageBody || mergedRecord.Message || mergedRecord.message || mergedRecord.body || "";
        const titleMsg = mergedRecord.Title || mergedRecord.messageTitle || mergedRecord.title || "";

        let reqBy =
          mergedRecord.RequestedBy ||
          mergedRecord.requestedBy ||
          mergedRecord.requestedByName ||
          mergedRecord.createdByName ||
          mergedRecord.senderName ||
          mergedRecord.submittedBy ||
          extra.requestedBy ||
          extra.requestedByName ||
          extra.createdByName ||
          extra.senderName ||
          extra.submittedBy ||
          dbRecord.RequestedBy ||
          dbRecord.requestedBy;

        if (!reqBy || reqBy === "N/A" || reqBy === "null") {
          const match = bodyMsg.match(/^([A-Za-z0-9\s.]+?)\s+(?:has requested|requested|applied for|sent a request)/i);
          if (match && match[1]) {
            reqBy = match[1].trim();
          }
        }

        if (!reqBy || reqBy === "N/A" || reqBy === "null") {
          const titleMatch = titleMsg.match(/(?:from|by|-)\s+([A-Za-z0-9\s.]+)/i);
          if (titleMatch && titleMatch[1]) {
            reqBy = titleMatch[1].trim();
          }
        }

        let durationVal =
          mergedRecord.Duration ||
          mergedRecord.duration ||
          mergedRecord.leaveDuration ||
          mergedRecord.LeaveDuration ||
          extra.duration ||
          extra.leaveDuration ||
          extra.Duration ||
          extra.LeaveDuration ||
          extra.leave_duration ||
          null;

        const relId = mergedRecord.relatedRecordId || extra.relatedRecordId;
        if (!durationVal && relId) {
          try {
            const attRecs = await UniversalUpdateInsert({
              ObjectName: "Attendant__c",
              Type: "get",
              filters: [{ field: "Sf_Id", value: relId }],
            });
            if (attRecs && attRecs.length > 0 && attRecs[0].LeaveDuration__c) {
              durationVal = attRecs[0].LeaveDuration__c;
            }
          } catch (e) {
            console.log("Error fetching duration from Attendant__c:", e);
          }
        }

        if (!durationVal && bodyMsg) {
          const durMatch = bodyMsg.match(/(?:duration|for)\s*:?\s*(\d+\s*days?|first half|second half|full day|half day)/i);
          if (durMatch && durMatch[1]) {
            durationVal = durMatch[1].trim();
          }
        }

        if (!durationVal) {
          durationVal = mergedRecord.Type || mergedRecord.type || "N/A";
        }

        rec = {
          ...mergedRecord,
          Title: titleMsg,
          Body: bodyMsg,
          Duration: durationVal,
          Type: mergedRecord.Type || mergedRecord.type || "Notification",
          ApprovalType: mergedRecord.ApprovalType || mergedRecord.approvalType || extraToSave.approvalType || "General",
          RequestedBy: reqBy || "N/A",
          RequestedAt: formatFirstNotificationDateTime(
            mergedRecord.RequestedAt,
            extra.requestedAt,
            extra.sentAt,
            extraToSave.requestedAt,
            extraToSave.sentAt,
            mergedRecord.ReceivedAt,
            item?.ReceivedAt,
            dbRecord.ReceivedAt
          ),
          Status: formattedStatus,
          actionId: extraToSave.actionId || mergedRecord.actionId || extra.actionId || item?.actionId,
          Sf_Id: mergedRecord.Sf_Id || mergedRecord.sfRecordId || objectId,
          extra: extraToSave,
        };
        setRecord(rec);
      } else if (!rec && objectId) {
        rec = await fetchRecordById();
        setRecord(rec);
      }

      if (!rec) {
        setVisibleDetails([]);
        return;
      }

      const fieldsToShow =
        VISIBLE_FIELDS[objectName] || Object.keys(rec).slice(0, 6);

      const mapped = await Promise.all(
        fieldsToShow.map(async (f) => {
          let value =
            rec[f] ?? rec[f.toLowerCase()] ?? rec[f.toUpperCase()] ?? "";
          const label = FIELD_LABELS[objectName]?.[f] || f;
          if (label === "Brand") {
            const fetched = await UniversalUpdateInsert({
              ObjectName: "CompetitorMaster__c",
              Type: "get",
              filters: [{ field: "Sf_Id", value }],
            });
            if (fetched?.length > 0)
              value = fetched[0].Name || fetched[0].name || value;
          } else if (label === "SKU") {
            const fetched = await UniversalUpdateInsert({
              ObjectName: "Competitor__Product",
              Type: "get",
              filters: [{ field: "Sf_Id", value }],
            });
            if (fetched?.length > 0)
              value = fetched[0].Name || fetched[0].name || value;
          } else if (label === "State") {
            const fetched = await UniversalUpdateInsert({
              ObjectName: "Geography__c",
              Type: "get",
              filters: [{ field: "Sf_Id", value }],
            });

            if (fetched?.length > 0)
              value = fetched[0].Name || fetched[0].name || value;
          } else if (label === "City") {
            const fetched = await UniversalUpdateInsert({
              ObjectName: "Geography__c",
              Type: "get",
              filters: [{ field: "Sf_Id", value }],
            });

            if (fetched?.length > 0)
              value = fetched[0].Name || fetched[0].name || value;
          } else if (
            label === "Date" ||
            label === "Date Of Payment" ||
            label === "Cheque Approve Date"
          ) {
            value = moment(value).format("DD MMM YYYY");
          } else if (
            label === "Name" &&
            objectName === "Salary_Acknowledgement__c"
          ) {
            const fetched = await UniversalUpdateInsert({
              ObjectName: "Account",
              Type: "get",
              filters: [{ field: "Sf_Id", value: value }],
            });

            if (fetched?.length > 0)
              value = fetched[0].Name || fetched[0].name || value;
          }

          return { label, value: String(value) };
        })
      );

      setVisibleDetails(mapped);
    };

    load();
  }, [objectId, objectName]);

  const openReasonModal = (decision) => {
    setPendingAction(decision);
    setReasonText("");
    setReasonError("");
    setReasonModalVisible(true);
  };

  const handleConfirmAction = async () => {
    const trimmed = reasonText.trim();
    if (!trimmed) {
      setReasonError("Please enter a reason/comment. This field is required.");
      return;
    }
    setReasonModalVisible(false);
    await executeApprovalAction(pendingAction, trimmed);
  };

  const executeApprovalAction = async (decision, comments) => {
    try {
      setLoading(true);
      const newStatus = decision === "Approve" ? "Approved" : "Rejected";
      const statusInDb = decision === "Approve" ? "approved" : "rejected";

      const actId = record?.actionId || record?.extra?.actionId || item?.actionId || item?.extra?.actionId;
      const res = await submitApprovalAction(decision, actId, comments, apiFetch);
      console.log("Approval action result:", res);
      if (res.status !== "success") {
        setLoading(false);
        Alert.alert("Approval failed", res.message || "Unable to submit approval action.");
        return;
      }

      // Only Travel Allowance rejections write the entered reason to the
      // allowance record. Other approval payloads remain unchanged.
      const notificationExtra = parseNotificationData(record?.Data || record?.extra);
      const notificationText = [
        record?.Title,
        record?.Body,
        record?.Message,
        record?.ApprovalType,
        record?.approvalType,
      ].filter(Boolean).join(" ");
      const isTravelAllowance = /travel\s+allowance/i.test(notificationText);
      const allowanceId =
        notificationExtra.relatedRecordId ||
        record?.relatedRecordId ||
        record?.recordId ||
        record?.RelatedRecordId;

      if (decision === "Reject" && isTravelAllowance && allowanceId) {
        const rejectionPayload = { Rejected_Reason__c: comments };
        console.log("----------------------------------");
        console.log("TRAVEL ALLOWANCE REJECTION PAYLOAD");
        console.log("Allowance ID:", allowanceId);
        console.log("Payload:", JSON.stringify(rejectionPayload, null, 2));
        console.log("----------------------------------");
        const allowanceUpdate = await apiFetch(
          "PATCH",
          `sobjects/Allowance_Claim__c/${allowanceId}`,
          rejectionPayload,
          "SObjects"
        );
        console.log("----------------------------------");
        console.log("REJECTION PATCH RESPONSE:", JSON.stringify(allowanceUpdate, null, 2));
        console.log("----------------------------------");
        if (allowanceUpdate?.status !== "success") {
          console.warn("Travel Allowance rejection reason update failed:", allowanceUpdate);
        }
      }

      const actionedAt = Date.now();
      setRecord((prev) => ({
        ...prev,
        Status: newStatus,
      }));

      setVisibleDetails((prev) =>
        prev.map((d) =>
          d.label === "Status"
            ? { ...d, value: newStatus }
            : d
        )
      );

      const identity = getNotificationIdentity({ ...(record || {}), Sf_Id: record?.Sf_Id || objectId });

      const allLocal = await UniversalUpdateInsert({
        ObjectName: "Notification__c",
        Type: "get",
      });

      const recordsToUpdate = [];
      if (Array.isArray(allLocal)) {
        for (const loc of allLocal) {
          const locExtra = parseNotificationData(loc.Data);
          const locActId = getNotificationActionId({ ...loc, extra: locExtra });

          if (notificationMatchesIdentity(loc, identity)) {
            recordsToUpdate.push({
              Sf_Id: loc.Sf_Id,
              Title: loc.Title || record?.Title || record?.messageTitle || "",
              Message: loc.Message || record?.Body || record?.messageBody || "",
              Image: loc.Image || record?.image || null,
              Type: loc.Type || record?.Type || "Approval",
              Status: statusInDb,
              SoftDelete: false,
              ReceivedAt: loc.ReceivedAt || record?.ReceivedAt || Date.now(),
              last_modified: Date.now(),
              is_locally_changed: true,
              operation_type: "insert",
              Data: JSON.stringify({
                ...locExtra,
                actionId: actId || locActId,
                approvalType: record?.ApprovalType || record?.approvalType || locExtra?.approvalType,
                requestedBy: record?.RequestedBy || record?.requestedBy || locExtra?.requestedBy,
                sentAt: locExtra?.sentAt || record?.extra?.sentAt || null,
                requestedAt: locExtra?.requestedAt || record?.extra?.requestedAt || locExtra?.sentAt || null,
                actionedAt,
                approvalStatus: statusInDb,
              }),
            });
          }
        }
      }

      if (recordsToUpdate.length === 0 && identity.sfId) {
        recordsToUpdate.push({
          Sf_Id: identity.sfId,
          Title: record?.Title || record?.messageTitle || "",
          Message: record?.Body || record?.messageBody || record?.Message || "",
          Image: record?.image || null,
          Type: record?.Type || "Approval",
          Status: statusInDb,
          SoftDelete: false,
          ReceivedAt: record?.ReceivedAt || Date.now(),
          last_modified: Date.now(),
          is_locally_changed: true,
          operation_type: "insert",
          Data: JSON.stringify({
            ...(record?.extra || {}),
            actionId: actId,
            approvalType: record?.ApprovalType || record?.approvalType,
            requestedBy: record?.RequestedBy || record?.requestedBy,
            sentAt: record?.extra?.sentAt || null,
            requestedAt: record?.extra?.requestedAt || record?.extra?.sentAt || null,
            actionedAt,
            approvalStatus: statusInDb,
          }),
        });
      }

      await UniversalUpdateInsert({
        ObjectName: "Notification__c",
        Type: "insert",
        data: recordsToUpdate,
      });

      await recalculateNotificationCount();
      setLoading(false);
      navigation.goBack();
    } catch (error) {
      console.error("Approval action error:", error);
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path 
                d="M15 19l-7-7 7-7" 
                stroke="#fff" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </Svg>
          </TouchableOpacity>

          <View>
             <Text style={styles.headerTitle} numberOfLines={1}>
              {objectName === "Competitor_LineItem__c"
                ? "Competitor"
                : objectName === "Collection__c"
                  ? "Collection"
                  : objectName === "Salary_Acknowledgement__c"
                    ? "Salary Acknowledgement"
                    : objectName === "HNT_Competitor_Price__c"
                      ? "Competitor Pricing"
                      : objectName === "Lead__c"
                        ? "Retailer Details"
                        : objectName}
            </Text>
            <Text style={styles.headerSubtitle}>Detail Page</Text>
          </View>
        </View>
      </LinearGradient>

      {/* CARD */}
      <Animated.View
        style={[styles.card, { transform: [{ translateY }], opacity: anim }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>DETAILS</Text>

          {(() => {
            const isUnsynced =
              record?.is_synced === false || record?.is_synced === 0;

            if (!isUnsynced) return null;

            const errorMsgText = record?.ErrorMsg;

            return (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitleText}>Sync Error:</Text>
                <Text style={styles.errorBodyText}>
                  {errorMsgText || "Record has not been synced to Salesforce."}
                </Text>
              </View>
            );
          })()}

          {visibleDetails.map((item, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>
                {item.value.replace(/,\s*$/, "")}
              </Text>

              <LinearGradient
                colors={["#D9D2C3", "#D9D2C3", "#D9D2C3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.divider}
              />
            </View>
          ))}

          {(() => {
            const isRequester =
              record?.requestedBy === currentUserId ||
              record?.RequestedById === currentUserId ||
              record?.RequestedBy === currentUserId;

            const isResponded = isRespondedNotificationStatus(record?.Status);

            if (
              objectName === "Notification" &&
              (record?.Type?.toLowerCase() === "approval" || !!record?.actionId) &&
              !isResponded &&
              !isRequester
            ) {
              return (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => openReasonModal("Reject")}
                  >
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => openReasonModal("Approve")}
                  >
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return null;
          })()}
        </ScrollView>
      </Animated.View>

      <Modal
        visible={reasonModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalContainer}
            >
              <View style={styles.modalContent}>
                <View
                  style={[
                    styles.modalHeaderBadge,
                    pendingAction === "Approve"
                      ? styles.approveBadge
                      : styles.rejectBadge,
                  ]}
                >
                  <Text style={styles.modalHeaderBadgeText}>
                    {pendingAction === "Approve"
                      ? "Approve Request"
                      : "Reject Request"}
                  </Text>
                </View>

                <Text style={styles.modalTitle}>
                  {pendingAction === "Approve"
                    ? "Enter Approval Comments"
                    : "Enter Rejection Reason"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Please provide a reason or comments for this request (mandatory).
                </Text>

                <TextInput
                  style={[
                    styles.reasonInput,
                    reasonError ? styles.inputErrorBorder : null,
                  ]}
                  placeholder={
                    pendingAction === "Approve"
                      ? "e.g. Approved for field visit"
                      : "e.g. Out of beat territory and invalid check-in distance"
                  }
                  placeholderTextColor="#7A7266"
                  multiline
                  numberOfLines={4}
                  value={reasonText}
                  onChangeText={(text) => {
                    setReasonText(text);
                    if (reasonError) setReasonError("");
                  }}
                />

                {reasonError ? (
                  <Text style={styles.errorHelperText}>{reasonError}</Text>
                ) : null}

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setReasonModalVisible(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalConfirmBtn,
                      pendingAction === "Approve"
                        ? styles.modalApproveBtn
                        : styles.modalRejectBtn,
                    ]}
                    onPress={handleConfirmAction}
                  >
                    <Text style={styles.modalConfirmBtnText}>
                      {pendingAction === "Approve" ? "Approve" : "Reject"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <LoaderOverlay visible={loading} message="Processing..." />
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF2FF",
  },

  header: {
    height: height * 0.26,
    paddingTop: "20%",
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  headerSubtitle: {
    fontSize: 13,
    color: "#E0E7FF",
    marginTop: 2,
  },

  card: {
    flex: 1,
    marginTop: "-17%",
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    shadowColor: "#C9A24D",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#A67C2E",
    letterSpacing: 1.3,
    marginBottom: 9,
  },

  row: {
    paddingVertical: 10,
  },

  label: {
    fontSize: 13,
    color: "#7A7266",
    fontWeight: "600",
    marginBottom: 2,
  },

  value: {
    fontSize: 16,
    color: "#020617",
    fontWeight: "700",
    lineHeight: 24,
  },

  divider: {
    height: 1,
    marginTop: 10,
    borderRadius: 2,
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  errorTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B3261E",
    marginBottom: 2,
  },
  errorBodyText: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 20,
    marginBottom: 20,
    justifyContent: "space-between",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
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
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  approveBadge: {
    backgroundColor: "#E3F1EA",
  },
  rejectBadge: {
    backgroundColor: "#FEE2E2",
  },
  modalHeaderBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F1D1A",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#7A7266",
    marginBottom: 16,
    lineHeight: 18,
  },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: "#D9D2C3",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#1F1D1A",
    backgroundColor: "#FBF8F1",
    minHeight: 100,
    textAlignVertical: "top",
  },
  inputErrorBorder: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  errorHelperText: {
    color: "#B3261E",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    color: "#7A7266",
    fontWeight: "700",
    fontSize: 15,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalApproveBtn: {
    backgroundColor: "#2E7D5B",
  },
  modalRejectBtn: {
    backgroundColor: "#B3261E",
  },
  modalConfirmBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
