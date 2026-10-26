import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  AppState,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import ImageResizer from "react-native-image-resizer";
import LoaderOverlay from "../../utils/helper/LoaderOverlay";
import LinearGradient from "react-native-linear-gradient";
import Icon from "@react-native-vector-icons/feather";
import moment from "moment";
import { getCurrentLocation } from "../../utils/getCurrentLocation";
import { Dropdown } from "react-native-element-dropdown";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import updateReferences from "../../database/dbService/updateReferences";
import {
  buildSyncFields,
  extractApiErrorMessage,
} from "../../utils/sync/syncStatus";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../../utils/networkUtils";
import { getAddressFromCoords } from "../../utils/reverseGeocode";
import { showToast, hideToast, showModalToast, hideModalToast } from "../../redux/slices/toastSlice.js";
import { useSelector, useDispatch } from "react-redux";
import ToastModal from "./ToastModal";
import CTextInput from "../customUtilityComponents/CTextInput";
import { launchCamera } from "react-native-image-picker";
import RNFS from "react-native-fs";
import crashlytics from "@react-native-firebase/crashlytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import Feather from "@react-native-vector-icons/feather";
import DatePicker from "react-native-date-picker";
import DeviceInfo from "react-native-device-info";
import {
  getEffectiveServerDate,
  getDateFromSalesforceResponse,
  getCachedServerDate,
} from "../../utils/sync/serverDateUtils";

const BASE_LEAVE_OPTIONS = [
  { label: "Full Day", value: "Full Day" },
  { label: "First Half", value: "First Half" },
  { label: "Second Half", value: "Second Half" },
];

const LEAVE_TYPE_OPTIONS = [
  { label: "Today", value: "Today" },
  // { label: "Multiple Day", value: "Next Days" },
];

// Kept in AllDataPicklist so a successful online metadata fetch is available
// the next time attendance is marked without internet access.
const ATTENDANCE_REASON_PICKLIST_CACHE_KEY = "AttendanceReasonPicklist";

const normalizePicklistOptions = (values) => {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values.reduce((options, value) => {
    const optionValue = typeof value === "string" ? value : value?.value;
    const label = typeof value === "string" ? value : value?.label || optionValue;

    if (!optionValue || seen.has(optionValue)) return options;
    seen.add(optionValue);
    options.push({ label, value: optionValue });
    return options;
  }, []);
};

if (!Text.defaultProps) Text.defaultProps = {};
if (!TextInput.defaultProps) TextInput.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps.allowFontScaling = false;

// ============================================================================
// UTILITY FUNCTIONS FOR TIME HANDLING
// ============================================================================

/**
 * Parses a 12-hour time string (e.g., "10:00 AM") to a moment object for today
 * @param {string} timeString - Time in format "HH:MM AM/PM"
 * @returns {moment.Moment} - Moment object representing today at the given time
 */
const parseTimeString = (timeString) => {
  if (!timeString || typeof timeString !== "string") {
    console.warn("Invalid time string:", timeString);
    return null;
  }
  return moment(timeString, "hh:mm A");
};

/**
 * Determines the attendance status based on current time and dynamic rules
 * @param {moment.Moment} currentTime - Current time
 * @param {object} attendanceRules - Rules object from backend
 * @returns {object} - { status: 'Present'|'Leave', statusLeave: 'Full Day'|'First Half'|'Second Half', message: string }
 */
const determineAttendanceStatus = (currentTime, attendanceRules) => {
  if (!attendanceRules) {
    return { status: "Present", statusLeave: "", message: "" };
  }

  try {
    // Parse all time boundaries from backend rules
    const startTime = parseTimeString(attendanceRules.Start_Time__c);
    const warningStartTime = parseTimeString(
      attendanceRules.Warning_Start_Time__c,
    );
    const warningEndTime = parseTimeString(attendanceRules.Warning_End_Time__c);
    const halfDayStartTime = parseTimeString(
      attendanceRules.Half_Day_Start_Time__c,
    );
    const halfDayEndTime = parseTimeString(
      attendanceRules.Half_Day_End_Time__c,
    );
    const fullDayStartTime = parseTimeString(
      attendanceRules.Full_Day_Start_Time__c,
    );

    console.log("⏱️  Time Boundaries:", {
      startTime: startTime?.format("hh:mm A"),
      warningStartTime: warningStartTime?.format("hh:mm A"),
      warningEndTime: warningEndTime?.format("hh:mm A"),
      halfDayStartTime: halfDayStartTime?.format("hh:mm A"),
      halfDayEndTime: halfDayEndTime?.format("hh:mm A"),
      fullDayStartTime: fullDayStartTime?.format("hh:mm A"),
      currentTime: currentTime.format("hh:mm A"),
    });

    // Priority 1: Check if current time is after Full Day Start Time
    if (currentTime.isSameOrAfter(fullDayStartTime)) {
      return {
        status: "Leave",
        statusLeave: "Full Day",
        message: "Attendance marked as Full Day leave due to late timing.",
      };
    }

    // Priority 2: Check if current time is between Half Day times
    if (currentTime.isBetween(halfDayStartTime, halfDayEndTime, null, "[]")) {
      return {
        status: "Leave",
        statusLeave: "First Half",
        message: "Attendance marked as Half Day leave due to late timing.",
      };
    }

    // Priority 3: Check if current time is in warning window
    if (currentTime.isBetween(warningStartTime, warningEndTime, null, "[]")) {
      return {
        status: "Present",
        statusLeave: "",
        message: "You are late to mark attendance.",
      };
    }

    // Default: Mark as Present (on time)
    return {
      status: "Present",
      statusLeave: "",
      message: "",
    };
  } catch (error) {
    console.error(" Error determining attendance status:", error);
    return { status: "Present", statusLeave: "", message: "" };
  }
};

/**
 * Validates if a reason is properly filled based on current status
 * @param {string} status - 'Present' or 'Leave'
 * @param {string} statusLeave - Leave duration if applicable
 * @param {string} reason - Selected reason
 * @param {string} otherReason - Custom reason text
 * @returns {object} - { isValid: boolean, message: string }
 */
const validateAttendanceSubmission = (
  status,
  leaveApplyFor,
  statusLeave,
  reason,
  otherReason,
  fromDate,
  toDate,
) => {
  if (status === "Leave") {
    if (leaveApplyFor === "Today") {
      if (!statusLeave || statusLeave.trim() === "") {
        return {
          isValid: false,
          message:
            "Please select leave type (Full Day, First Half, or Second Half).",
        };
      }
    } else {
      // Next Days
      if (!fromDate) {
        return { isValid: false, message: "Please select From Date." };
      }
      if (!toDate) {
        return { isValid: false, message: "Please select To Date." };
      }
      if (moment(toDate).isBefore(moment(fromDate), "day")) {
        return {
          isValid: false,
          message: "To Date cannot be before From Date.",
        };
      }
    }

    if (!reason || reason.trim() === "") {
      return { isValid: false, message: "Please select a leave reason." };
    }

    // If "Other" is selected, ensure custom text is provided
    if (reason === "Other" && (!otherReason || otherReason.trim() === "")) {
      return {
        isValid: false,
        message: "Please enter a custom reason for your leave.",
      };
    }
  }

  return { isValid: true, message: "" };
};

/**
 * Gets the effective reason (handles "Other" custom input)
 * @param {string} reason - Selected reason
 * @param {string} otherReason - Custom reason if "Other" selected
 * @returns {string} - Effective reason to submit
 */
const getEffectiveReason = (reason, otherReason) => {
  return reason === "Other"
    ? (otherReason || "").trim()
    : (reason || "").trim();
};

// A multi-day leave includes both the selected From and To dates. For example,
// 10–12 June is submitted as "3" rather than as one of today's half/full-day
// labels.
const getLeaveDuration = (
  status,
  leaveApplyFor,
  statusLeave,
  fromDate,
  toDate,
) => {
  if (status !== "Leave") return null;
  if (leaveApplyFor === "Today") return statusLeave || null;
  if (!fromDate || !toDate) return null;

  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).startOf("day");
  if (end.isBefore(start)) return null;

  return String(end.diff(start, "days") + 1);
};


const getDistanceInMeters = (
  firstLatitude,
  firstLongitude,
  secondLatitude,
  secondLongitude,
) => {
  const earthRadiusInMeters = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(firstLatitude)) *
      Math.cos(toRadians(secondLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusInMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const safeFont = {
  fontFamily: Platform.OS === "android" ? "sans-serif" : undefined,
};

const AttendanceModel = ({ visible, onClose, attendanceToReopen = null }) => {
  const dispatch = useDispatch();
  const toast = useSelector((state) => state.toast);
  const scrollRef = useRef(null);
  const isApplyingAutoSelectionRef = useRef(false);
  const userInteractedRef = useRef(false);
  const statusDropdownRef = useRef(null);
  const leaveDropdownRef = useRef(null);
  const reasonDropdownRef = useRef(null);
  const [selfieUri, setSelfieUri] = useState(null);
  // This is refreshed from Salesforce whenever the modal opens, so changing
  // the phone date cannot make an attendance entry use a future date.
  const [attendanceDate, setAttendanceDate] = useState(() =>
    moment().format("YYYY-MM-DD"),
  );
  const [isResolvingAttendanceDate, setIsResolvingAttendanceDate] =
    useState(false);
  const date = attendanceDate;
  const displayDate = moment(attendanceDate, "YYYY-MM-DD").format(
    "DD MMM YYYY",
  );
  const [location, setLocation] = useState("");
  const [users, setUsers] = useState([]);
  const userId = useSelector((state) => state.auth.userId);
  const { handleLogout, apiFetch } = useApiFetch();

  // Attendance state management
  const [status, setStatus] = useState("Present");
  const [statusLeave, setStatusLeave] = useState("");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [leaveApplyFor, setLeaveApplyFor] = useState("Today"); // 'Today' or 'Next Days'
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [openFromDatePicker, setOpenFromDatePicker] = useState(false);
  const [openToDatePicker, setOpenToDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPreparingAttendance, setIsPreparingAttendance] = useState(false);
  const [latitudeState, setLatitudeState] = useState("");
  const [longitudeState, setLongitudeState] = useState("");
  const [base64Image, setBase64Image] = useState("");
  // const hasImage = !!base64Image || !!selfieUri;
  const hasImage = !!selfieUri;
  const [leaveOptions, setLeaveOptions] = useState(BASE_LEAVE_OPTIONS);
  const [isStatusLockedAfterWarning, setIsStatusLockedAfterWarning] =
    useState(false);
  // Backend rules and options
  const [attendanceRules, setAttendanceRules] = useState(null);
  const [options, setOptions] = useState([
    { label: "Present", value: "Present" },
    { label: "Leave", value: "Leave" },
    { label: "Office", value: "Office" },
  ]);
  const [reasonOptions, setReasonOptions] = useState([]);
  const rejectedLeaveRecordId = attendanceToReopen?.Sf_Id || attendanceToReopen?.Id || null;
  const reopenedAttendanceStatus = String(
    attendanceToReopen?.AttendanceStatus__c || attendanceToReopen?.attendanceStatus__c || "",
  )
    .trim()
    .toLowerCase();
  const reopenedApprovalStatus = String(
    attendanceToReopen?.Approval_Status__c || attendanceToReopen?.approval_Status__c || "",
  )
    .trim()
    .toLowerCase();
  // An attendance id alone is not enough to update. PATCH is reserved for
  // the explicit Leave → Rejected recovery flow; all first attendance
  // submissions must remain CREATE operations.
  const isRejectedLeaveCorrection = Boolean(
    rejectedLeaveRecordId &&
      (reopenedAttendanceStatus === "leave rejected" ||
        reopenedAttendanceStatus.includes("reject") ||
        reopenedApprovalStatus === "rejected" ||
        (reopenedAttendanceStatus === "leave" &&
          reopenedApprovalStatus === "rejected")),
  );

  const availableStatusOptions = isRejectedLeaveCorrection
    ? [
        { label: "Present", value: "Present" },
        { label: "Office", value: "Office" },
      ]
    : options;

  // UI state
  const [userInteracted, setUserInteracted] = useState(false);
  const [trainingContentType, setTrainingContentType] = useState("");
  const [trainingContent, setTrainingContent] = useState("");

  useEffect(() => {
    if (visible && isRejectedLeaveCorrection) {
      setStatus("Present");
      setStatusLeave("");
      setReason("");
      setOtherReason("");
      setIsStatusLockedAfterWarning(false);
      userInteractedRef.current = false;
      setUserInteracted(false);
    }
  }, [visible, isRejectedLeaveCorrection, attendanceToReopen]);

  useEffect(() => {
    let isMounted = true;
    getCachedServerDate().then((cached) => {
      if (cached && isMounted) {
        setAttendanceDate(cached);
        const selectedDate = moment(cached, "YYYY-MM-DD").toDate();
        setFromDate(selectedDate);
        setToDate(selectedDate);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    const resolveAttendanceDate = async () => {
      setIsResolvingAttendanceDate(true);
      try {
        const serverDate = await getEffectiveServerDate({ apiFetch });

        if (serverDate && isMounted) {
          setAttendanceDate(serverDate);
          const selectedDate = moment(serverDate, "YYYY-MM-DD").toDate();
          setFromDate(selectedDate);
          setToDate(selectedDate);
        }
      } catch (error) {
        console.warn(
          "Could not resolve attendance date:",
          error,
        );
      } finally {
        if (isMounted) setIsResolvingAttendanceDate(false);
      }
    };

    resolveAttendanceDate();
    return () => {
      isMounted = false;
    };
    // apiFetch is recreated by the hook; run this only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const getLeaveOptionsByTime = (now, attendanceRules) => {
    if (!attendanceRules) return BASE_LEAVE_OPTIONS;

    const warningEndTime = parseTimeString(attendanceRules.Warning_End_Time__c);
    const halfDayStartTime = parseTimeString(
      attendanceRules.Half_Day_Start_Time__c,
    );
    const halfDayEndTime = parseTimeString(
      attendanceRules.Half_Day_End_Time__c,
    );
    const fullDayStartTime = parseTimeString(
      attendanceRules.Full_Day_Start_Time__c,
    );

    // 1️⃣ Warning not over → no restriction
    if (!warningEndTime || now.isSameOrBefore(warningEndTime)) {
      return BASE_LEAVE_OPTIONS;
    }

    // 2️⃣ After warning & during first-half window
    if (
      halfDayStartTime &&
      halfDayEndTime &&
      now.isBetween(halfDayStartTime, halfDayEndTime, null, "[]")
    ) {
      return [
        { label: "First Half", value: "First Half" },
        { label: "Full Day", value: "Full Day" },
      ];
    }

    // 3️⃣ After first-half → only full day
    if (fullDayStartTime && now.isSameOrAfter(fullDayStartTime)) {
      return [{ label: "Full Day", value: "Full Day" }];
    }

    return BASE_LEAVE_OPTIONS;
  };

  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: "speed", // 🔥 memory safe
        flash: "off",
      });
      const filePath = "file://" + photo.path;
      // set UI
      setSelfieUri(filePath);
      // base64
      const base64 = await RNFS.readFile(photo.path, "base64");
      setBase64Image(base64);
      // backup (optional)
      await AsyncStorage.setItem("TEMP_SELFIE", filePath);
      setShowCamera(false);
    } catch (e) {
      console.log(" Camera Error:", e);
      crashlytics().recordError(e);
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        const saved = await AsyncStorage.getItem("TEMP_SELFIE");
        if (saved) {
          setSelfieUri(saved);
        }
      }
    });
    return () => sub.remove();
  }, []);
  // ========================================================================
  // TOAST NOTIFICATIONS
  // ========================================================================

  const showToastvisible = (type, message, showInModal = true) => {
    // Commented out original toast message mapping:
    /*
    dispatch(
      showToast({
        message: message,
        type: type,
      }),
    );
    */
    
    // New localized toast message handler:
    let finalMessage = message;
    if (typeof message === "string") {
      const normalized = message.toLowerCase();
      // Commented out Hindi version:
      /*
      if (
        normalized.includes("attendance cannot be marked because your location is") ||
        normalized.includes("away from your assigned location") ||
        normalized.includes("assigned location")
      ) {
        finalMessage = "Aap assigned location se bahut door hain, isliye attendance mark nahi ho sakti.";
      }
      */
      if (
        normalized.includes("attendance cannot be marked because your location is") ||
        normalized.includes("away from your assigned location") ||
        normalized.includes("assigned location")
      ) {
        finalMessage = "Attendance cannot be marked because you are far from your assigned location.";
      } else if (
        normalized.includes("device is not assigned") ||
        normalized.includes("device is not assign") ||
        normalized.includes("divice is not assigned") ||
        normalized.includes("divice is not assign")
      ) {
        finalMessage = "This device is not assigned to your account. Please contact your system administrator.";
      }
    }
    
    if (showInModal) {
      dispatch(
        showModalToast({
          message: finalMessage,
          type: type,
        }),
      );
    } else {
      dispatch(
        showToast({
          message: finalMessage,
          type: type,
        }),
      );
    }
  };

  const closeAttendanceDropdowns = () => {
    statusDropdownRef.current?.close?.();
    leaveDropdownRef.current?.close?.();
    reasonDropdownRef.current?.close?.();
  };

  // ========================================================================
  // STATUS CHANGE HANDLER
  // ========================================================================

  const statusSetter = (value) => {
    setStatus(value);
    if (value === "Present" || value === "Office") {
      setStatusLeave("");
      setReason("");
      setOtherReason("");
      setLeaveApplyFor("Today");
      setFromDate(new Date());
      setToDate(new Date());
    }
  };

  // ========================================================================
  // API SUBMISSION
  // ========================================================================

  const submitToApi = async (
    effectiveReason,
    base64,
    uniqueId,
    currentLat = latitudeState,
    currentLon = longitudeState,
  ) => {
    const activeUserId = userId || users[0]?.Sf_Id || users[0]?.Id || "";
    const deviceIdVal = await DeviceInfo.getUniqueId();
    const leaveDuration = getLeaveDuration(
      status,
      leaveApplyFor,
      statusLeave,
      fromDate,
      toDate,
    );

    const isLeaveStatus = status === "Leave";
    const approvalStatusVal = isRejectedLeaveCorrection
      ? (isLeaveStatus ? "Pending" : null)
      : undefined;

    const payload = {
      User__c: activeUserId,
      AttendanceStatus__c: isLeaveStatus ? "Leave" : status,
      LeaveDuration__c: isLeaveStatus ? leaveDuration : null,
      AttendanceDate__c: date,
      // Reason__c is a Salesforce picklist, so always submit its configured
      // value. Free text for the configured "Other" option belongs in the
      // separate text field.
      Reason__c: isLeaveStatus ? reason : null,
      Other_Leave_Reason__c:
        isLeaveStatus && reason === "Other" ? effectiveReason : null,
      // A corrected leave must no longer be locally/server-side rejected,
      // otherwise the rejected-leave watcher reopens the modal again.
      Approval_Status__c: approvalStatusVal,
      AttendanceStartTime__c: new Date().toISOString(),
      GeoLocation__Latitude__s: Number(currentLat) || 0,
      GeoLocation__Longitude__s: Number(currentLon) || 0,
      Deviceid__c: deviceIdVal,
      Attendance_Image_URL__c: base64 || null,
      CapturedSelfie__c: Boolean(base64),
    };

    try {
      if (isRejectedLeaveCorrection && !rejectedLeaveRecordId) {
        return {
          success: false,
          publicUrl: null,
          attempted: false,
          errorMsg: "The rejected leave record is missing its Salesforce ID.",
        };
      }
      const isRealSfId = Boolean(
        rejectedLeaveRecordId && !rejectedLeaveRecordId.startsWith("LOCAL_")
      );
      const method = isRejectedLeaveCorrection && isRealSfId ? "PATCH" : "POST";
      const endpoint =
        isRejectedLeaveCorrection && isRealSfId
          ? `sobjects/Attendance__c/${rejectedLeaveRecordId}`
          : "sobjects/Attendance__c";
      console.log(
        `📤 ${method} Attendance Payload to Salesforce:`,
        JSON.stringify(payload),
      );
      const response = await apiFetch(method, endpoint, payload, "SObjects");
      console.log(
        "📥 Salesforce Attendance API Response:",
        JSON.stringify(response),
      );

      const responseData = response?.data;
      // Salesforce PATCH commonly returns 204 with no response body.
      const isSuccess =
        method === "PATCH"
          ? response?.status === "success"
          : response?.status === "success" &&
            (responseData?.id || responseData?.success === true);
      const errorMsg = extractApiErrorMessage(response, null);
      const isDuplicate = !!(
        errorMsg &&
        (errorMsg.includes("DUPLICATE_VALUE") ||
          errorMsg.includes("duplicate value found"))
      );

      if (isSuccess) {
        console.log(
          "Attendance marked successfully via Salesforce Standard SObject API. Record ID:",
          responseData?.id || rejectedLeaveRecordId,
        );
        return {
          success: true,
          publicUrl: null,
          attempted: true,
          errorMsg: null,
          newRecordId: responseData?.id || null,
        };
      } else {
        console.log(
          " Failed to mark attendance on Salesforce Standard API:",
          response,
        );
        return {
          success: false,
          publicUrl: null,
          attempted: true,
          errorMsg: errorMsg || "Standard API upload failed",
          duplicate: isDuplicate,
        };
      }
    } catch (error) {
      console.error(" API submission error:", error);
      const errorMsg = extractApiErrorMessage(null, error);
      const isDuplicate = !!(
        errorMsg &&
        (errorMsg.includes("DUPLICATE_VALUE") ||
          errorMsg.includes("duplicate value found"))
      );
      return {
        success: false,
        publicUrl: null,
        attempted: true,
        errorMsg,
        duplicate: isDuplicate,
      };
    }
  };

  const saveLocally = async (
    apiSuccess: boolean,
    publicUrl: string | null = null,
    effectiveReason: any,
    base64: any,
    attempted = true,
    errorMsg: string | null = null,
    uniqueId: string,
    currentLat = latitudeState,
    currentLon = longitudeState,
    newRecordId: string | null = null,
  ) => {
    console.log(
      "💾 Saving locally. apiSuccess:",
      apiSuccess,
      "publicUrl:",
      publicUrl,
    );
    const deviceIdVal = await DeviceInfo.getUniqueId();
    const leaveDuration = getLeaveDuration(
      status,
      leaveApplyFor,
      statusLeave,
      fromDate,
      toDate,
    );

    let targetSfId = isRejectedLeaveCorrection
      ? rejectedLeaveRecordId
      : `LOCAL_${Date.now()}`;

    if (isRejectedLeaveCorrection && rejectedLeaveRecordId?.startsWith("LOCAL_") && newRecordId) {
      try {
        await updateReferences(rejectedLeaveRecordId, newRecordId, ["Attendant__c"]);
        targetSfId = newRecordId;
      } catch (err) {
        console.warn("Failed to update reference from local ID to new Salesforce ID:", err);
      }
    } else if (newRecordId && !isRejectedLeaveCorrection) {
      targetSfId = newRecordId;
    }

    const isLeaveStatus = status === "Leave";
    const approvalStatusVal = isRejectedLeaveCorrection
      ? (isLeaveStatus ? "Pending" : null)
      : undefined;

    const payload = {
      // UniversalUpdateInsert upserts by Sf_Id, so this updates the
      // rejected leave locally rather than inserting a second row.
      Sf_Id: targetSfId,
      User__c: userId || users[0]?.Sf_Id || users[0]?.Id || "",
      AttendanceStatus__c: isLeaveStatus ? "Leave" : status,
      GeoLocation__c: `${currentLat},${currentLon}`,
      StartTime__c: moment().format("YYYY-MM-DD HH:mm:ss"),
      LeaveDuration__c: isLeaveStatus ? leaveDuration : null,
      SelfieURL__c: publicUrl || null,
      AttendanceDate__c: date,
      Reason__c: isLeaveStatus ? reason : null,
      AttendanceBase64: base64,
      CapturedSelfie__c: Boolean(base64),
      Other_Leave_Reason__c:
        isLeaveStatus && reason === "Other" ? effectiveReason : null,
      is_locally_changed: !apiSuccess,
      operation_type: isRejectedLeaveCorrection ? "update" : "insert",
      last_modified: Date.now(),
      Mobile_Unique_Id__c: uniqueId,
      Deviceid__c: deviceIdVal,
      Approval_Status__c: approvalStatusVal,
      ...buildSyncFields({ apiSuccess, attempted, errorMsg }),
    };

    try {
      const inserted = await UniversalUpdateInsert({
        ObjectName: "Attendant__c",
        Type: "insert",
        data: payload,
      });

      if (inserted) {
        console.log("Attendance saved locally");
        return true;
      } else {
        console.log(" Failed to save attendance locally");
        return false;
      }
    } catch (error) {
      console.error(" Local save error:", error);
      return false;
    }
  };

  const validateOfflineAttendance = async (
    currentLatitude,
    currentLongitude,
  ) => {
    const activeUserId = userId || users[0]?.Sf_Id || users[0]?.Id || "";
    const localUsers = await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "get",
      filters: activeUserId ? [{ field: "Sf_Id", value: activeUserId }] : [],
    });
    const localUser = localUsers?.[0];

    if (!localUser) {
      console.warn(
        "Offline attendance validation skipped: local user record is unavailable.",
      );
      return true;
    }

    const registeredDeviceId = String(localUser.DeviceId__c || "").trim();
    if (registeredDeviceId) {
      const currentDeviceId = await DeviceInfo.getUniqueId();
      if (currentDeviceId !== registeredDeviceId) {
        showToastvisible(
          "error",
          "This is not the registered device for attendance.",
        );
        return false;
      }
    }

    const assignedLatitudeValue = String(
      localUser.Assigned_Latitude__c || "",
    ).trim();
    const assignedLongitudeValue = String(
      localUser.Assigned_Longitude__c || "",
    ).trim();
    const assignedLatitude = Number(assignedLatitudeValue);
    const assignedLongitude = Number(assignedLongitudeValue);
    const deviceLatitude = Number(currentLatitude);
    const deviceLongitude = Number(currentLongitude);
    const hasAssignedLocation =
      Boolean(assignedLatitudeValue) &&
      Boolean(assignedLongitudeValue) &&
      Number.isFinite(assignedLatitude) &&
      Number.isFinite(assignedLongitude);
    const hasCurrentLocation =
      Number.isFinite(deviceLatitude) && Number.isFinite(deviceLongitude);

    if (hasAssignedLocation && hasCurrentLocation) {
      const distanceInMeters = getDistanceInMeters(
        assignedLatitude,
        assignedLongitude,
        deviceLatitude,
        deviceLongitude,
      );

      if (distanceInMeters > 100) {
        showToastvisible(
          "error",
          `You are ${Math.round(
            distanceInMeters,
          )} meters away from your assigned location. Attendance can only be marked within 100 meters.`,
        );
        return false;
      }
    }

    return true;
  };

  // ========================================================================
  // MAIN SUBMISSION HANDLER
  // ========================================================================

  const compressImageTo200KB = async (uri) => {
    try {
      let quality = 80; // start high
      let resizedImage;
      let fileSize = 999999;
      // Target max file size for 300KB limit
      while (fileSize > 300 * 1024 && quality > 10) {
        resizedImage = await ImageResizer.createResizedImage(
          uri,
          800, // width
          800, // height
          "JPEG",
          quality,
        );
        const stat = await RNFS.stat(resizedImage.uri);
        fileSize = stat.size;
        quality -= 10; // gradually compress
      }
      const base64 = await RNFS.readFile(resizedImage.uri, "base64");
      return {
        base64,
        size: fileSize,
      };
    } catch (error) {
      console.log("Compression error:", error);
    }
  };

  const handleAttendanceSubmit = async () => {
    let lat = latitudeState;
    let lon = longitudeState;

    if (!lat || !lon) {
      try {
        setLoading(true);
        const coords = await getCurrentLocation();
        lat = coords.latitude;
        lon = coords.longitude;
        setLatitudeState(lat);
        setLongitudeState(lon);

        const connected = await isInternetAvailable();
        if (connected) {
          const addr = await getAddressFromCoords(lat, lon);
          setLocation(addr || `Lat: ${lat}, Long: ${lon}`);
        } else {
          setLocation(`Lat: ${lat}, Long: ${lon}`);
        }
      } catch (error) {
        console.warn("Location fetch failed on submit:", error);
        showToastvisible(
          "warning",
          "Location is turned off. Turn it on to continue with your daily attendance.",
        );
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    try {
      // Validate: Image is required
      if (status !== "Leave" && !hasImage) {
        showToastvisible(
          "warning",
          "Please upload a selfie image before submitting attendance.",
        );
        return;
      }
      // Validate: Reason and leave type if Leave is selected
      const validation = validateAttendanceSubmission(
        status,
        leaveApplyFor,
        statusLeave,
        reason,
        otherReason,
        fromDate,
        toDate,
      );
      if (!validation.isValid) {
        showToastvisible("warning", validation.message);
        return;
      }

      const userIdVal = userId || users[0]?.Sf_Id || users[0]?.Id || "";
      const uniqueId = `${userIdVal}-${date}`;

      // Check if attendance already marked locally for today. A rejected
      // leave is the one allowed exception because it updates that record.
      const existing = await UniversalUpdateInsert({
        ObjectName: "Attendant__c",
        Type: "get",
        filters: [
          { field: "Mobile_Unique_Id__c", value: uniqueId },
          { field: "SoftDelete", value: false },
        ],
      });

      if (!isRejectedLeaveCorrection && existing && existing.length > 0) {
        showToastvisible("warning", "Attendance for today is already marked.");
        onClose();
        return;
      }

      const effectiveReason = getEffectiveReason(reason, otherReason);
      setLoading(true);
      // Check internet connectivity
      const connected = await isInternetAvailable();
      let apiResult: {
        success: boolean;
        publicUrl: string | null;
        attempted: boolean;
        errorMsg: string | null;
        duplicate?: boolean;
        newRecordId?: string | null;
      } = { success: false, publicUrl: null, attempted: false, errorMsg: null, newRecordId: null };
      if (!connected) {
        const isOfflineAttendanceValid = await validateOfflineAttendance(
          lat,
          lon,
        );
        if (!isOfflineAttendanceValid) {
          return;
        }
        console.log("📡 No internet. Saving locally only.");
      }

      const result =
        status === "Leave" ? null : await compressImageTo200KB(selfieUri);
      const base64 = result?.base64 || null;

      if (connected) {
        apiResult = await submitToApi(
          effectiveReason,
          base64,
          uniqueId,
          lat,
          lon,
        );
        if (apiResult.duplicate) {
          console.log(
            "⚠️ Attendance duplicate on server, skipping local save.",
          );
          showToastvisible(
            "warning",
            "Attendance is already marked on the server.",
          );
          onClose();
          return;
        }
        if (!apiResult.success) {
          console.log("⚠️ Salesforce attendance API failed:", apiResult.errorMsg);
          showToastvisible(
            "error",
            apiResult.errorMsg ||
            "Failed to mark attendance. Please try again.",
          );
          return;
        }
      }

      // Always attempt to save locally
      const localSuccess = await saveLocally(
        apiResult.success,
        apiResult.publicUrl,
        effectiveReason,
        base64,
        !!apiResult.attempted,
        apiResult.errorMsg,
        uniqueId,
        lat,
        lon,
        apiResult.newRecordId || null,
      );
      await AsyncStorage.removeItem("TEMP_SELFIE");
      if (localSuccess) {
        if (!connected) {
          showToastvisible(
            "success",
            "Attendance saved offline. It will sync when internet is available.",
            false,
          );
        } else if (apiResult.success) {
          showToastvisible("success", "Attendance marked successfully.", false);
        }
        if (status === "Leave") {
          showToastvisible(
            "info",
            `You have marked ${statusLeave || "leave"} for the day.`,
            false,
          );
          if (statusLeave === "Full Day") {
            // Optional: Logout after full day leave
            // handleLogout();
          }
        }

        console.log("Closing attendance modal...");
        onClose();
      } else {
        showToastvisible(
          "error",
          "Failed to save attendance. Please try again.",
        );
      }
    } catch (error) {
      console.error(" Attendance submission error:", error);
      showToastvisible("error", "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;

    let isActive = true;
    const fetchLocationForModal = async () => {
      setLocation("Fetching current location...");
      setLatitudeState("");
      setLongitudeState("");

      try {
        const { latitude, longitude } = await getCurrentLocation();
        if (!isActive) return;

        setLatitudeState(latitude);
        setLongitudeState(longitude);

        const connected = await isInternetAvailable();
        if (!isActive) return;

        if (connected) {
          const address = await getAddressFromCoords(latitude, longitude);
          if (!isActive) return;
          setLocation(address || `Lat: ${latitude}, Long: ${longitude}`);
        } else {
          setLocation(`Lat: ${latitude}, Long: ${longitude}`);
        }
      } catch (error) {
        if (!isActive) return;
        console.warn("Location refresh failed on modal open:", error);
        setLocation("Unable to fetch current location.");
      }
    };

    fetchLocationForModal();

    return () => {
      isActive = false;
    };
  }, [visible]);

  // ========================================================================
  // AUTO-SELECTION LOGIC ON MODAL OPEN
  // ========================================================================

  useEffect(() => {
    const applyAutoSelection = async () => {
      if (!visible || !attendanceRules || isApplyingAutoSelectionRef.current)
        return;

      let isMounted = true;
      isApplyingAutoSelectionRef.current = true;
      setIsPreparingAttendance(true);

      // Reset all fields when modal opens
      closeAttendanceDropdowns();
      // setSelfieUri(null);
      // setBase64Image('');
      setReason("");
      setOtherReason("");
      setLoading(false);
      setUserInteracted(false);
      userInteractedRef.current = false;

      const now = moment();

      // 🎯 Dynamically control Leave Duration options
      const dynamicLeaveOptions = getLeaveOptionsByTime(now, attendanceRules);
      if (!isMounted) return;
      setLeaveOptions(dynamicLeaveOptions);

      // Reset invalid selection if needed
      if (
        status === "Leave" &&
        statusLeave &&
        !dynamicLeaveOptions.some((o) => o.value === statusLeave)
      ) {
        setStatusLeave("");
      }

      // NEW: check if warning time is over (never lock for rejected leave correction)
      const warningEndTime = parseTimeString(
        attendanceRules.Warning_End_Time__c,
      );
      const isWarningOver = warningEndTime
        ? now.isAfter(warningEndTime)
        : false;
      setIsStatusLockedAfterWarning(isRejectedLeaveCorrection ? false : isWarningOver);

      // Determine attendance status based on current time and rules
      if (!userInteractedRef.current) {
        const now = moment();
        // A leave rejected by the manager is a correction flow: the
        // employee must be able to mark themselves present, even if
        // the normal late-attendance rule would auto-select Leave.
        const attendanceStatus = isRejectedLeaveCorrection
          ? { status: "Present", statusLeave: "", message: "" }
          : determineAttendanceStatus(now, attendanceRules);
        if (!isMounted) return;

        setStatus(attendanceStatus.status);
        setStatusLeave(attendanceStatus.statusLeave);
        closeAttendanceDropdowns();

        if (attendanceStatus.message && !isRejectedLeaveCorrection) {
          showToastvisible(
            attendanceStatus.status === "Leave" ? "info" : "warning",
            attendanceStatus.message,
          );
        }

        console.log("🎯 Auto-selected status:", attendanceStatus);
      }

      isApplyingAutoSelectionRef.current = false;
      if (isMounted) setIsPreparingAttendance(false);

      return () => {
        isMounted = false;
        isApplyingAutoSelectionRef.current = false;
        setIsPreparingAttendance(false);
      };
    };

    let cleanup;
    applyAutoSelection().then((result) => {
      cleanup = result;
    });

    return () => {
      closeAttendanceDropdowns();
      if (typeof cleanup === "function") cleanup();
      isApplyingAutoSelectionRef.current = false;
      setIsPreparingAttendance(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, attendanceRules]);

  // ========================================================================
  // INITIALIZATION: FETCH RULES, OPTIONS & USER DATA
  // ========================================================================

  useEffect(() => {
    const logDeviceId = async () => {
      try {
        const deviceId = await DeviceInfo.getUniqueId();
        console.log(
          "[Attendance] Device ID-------------------------------------=======+++:",
          deviceId,
        );
      } catch (error) {
        console.error("[Attendance] Failed to get device ID:", error);
      }
    };

    logDeviceId();
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        // Fetch Attendance Rules
        const AttendanceRuleDataRaw = await UniversalUpdateInsert({
          ObjectName: "AttendanceRule",
          Type: "get",
        });

        let AttendanceRuleDataTransformed = AttendanceRuleDataRaw?.[0]?.JSON;
        console.log(
          "AttendanceRuleDataTransformed",
          AttendanceRuleDataTransformed,
        );
        if (typeof AttendanceRuleDataTransformed === "string") {
          try {
            AttendanceRuleDataTransformed = JSON.parse(
              AttendanceRuleDataTransformed,
            );
          } catch (e) {
            console.error(" Failed to parse AttendanceRuleData:", e);
          }
        }

        setAttendanceRules(AttendanceRuleDataTransformed);
        console.log(
          "📋 Attendance Rules Loaded:",
          AttendanceRuleDataTransformed,
        );

        // Fetch Picklist Options
        const AllPicklistData = await UniversalUpdateInsert({
          ObjectName: "AllDataPicklist",
          Type: "get",
        });

        const parsedPicklistRecords = (AllPicklistData || []).map((record) => {
          let parsedOptions = record?.OptionsData;
          if (typeof parsedOptions === "string") {
            try {
              parsedOptions = JSON.parse(parsedOptions);
            } catch (e) {
              console.error("Failed to parse OptionsData:", e);
              parsedOptions = {};
            }
          }
          return { record, optionsData: parsedOptions || {} };
        });
        const cachedReasonRecord = parsedPicklistRecords.find(
          ({ optionsData }) => Array.isArray(optionsData?.[ATTENDANCE_REASON_PICKLIST_CACHE_KEY]),
        );
        const picklistRecord = cachedReasonRecord || parsedPicklistRecords[0];
        const optionsData = picklistRecord?.optionsData || {};

        // Display cached Salesforce metadata immediately. This is the offline
        // path and also avoids a blank picker while an online refresh runs.
        const cachedReasons = normalizePicklistOptions(
          optionsData[ATTENDANCE_REASON_PICKLIST_CACHE_KEY] ||
            optionsData.AttendanceLeaveReason,
        );
        console.log("[Attendance Reason] Offline cache loaded:", {
          recordCount: AllPicklistData?.length || 0,
          cachedReasons,
        });
        setReasonOptions(cachedReasons);

        // Reason__c is the source of truth. Refresh its active picklist values
        // whenever the device is online, then keep the same values locally for
        // future offline attendance entries.
        const isOnline = await isInternetAvailable();
        console.log("[Attendance Reason] Network available for Salesforce describe:", isOnline);

        if (isOnline) {
          try {
            const describeResponse = await apiFetch(
              "GET",
              "sobjects/Attendance__c/describe",
              {},
              "SObjects",
            );
            const describeData = describeResponse?.data?.fields
              ? describeResponse.data
              : describeResponse?.data?.data;
            console.log("[Attendance Reason] Salesforce describe response:", {
              status: describeResponse?.status,
              fieldCount: describeData?.fields?.length || 0,
              response: describeResponse,
            });

            const reasonField = describeData?.fields?.find(
              (field) => field.name === "Reason__c",
            );
            const salesforceReasons = normalizePicklistOptions(
              reasonField?.picklistValues?.filter((value) => value.active !== false),
            );
            console.log("[Attendance Reason] Salesforce Reason__c result:", {
              found: Boolean(reasonField),
              type: reasonField?.type,
              rawPicklistValues: reasonField?.picklistValues || [],
              dropdownOptions: salesforceReasons,
            });

            if (salesforceReasons.length > 0) {
              setReasonOptions(salesforceReasons);
              const recordToCache = picklistRecord?.record;
              await UniversalUpdateInsert({
                ObjectName: "AllDataPicklist",
                Type: "insert",
                data: {
                  Sf_Id: recordToCache?.Sf_Id || "ATTENDANCE_REASON_PICKLIST_CACHE",
                  OptionsData: JSON.stringify({
                    ...optionsData,
                    [ATTENDANCE_REASON_PICKLIST_CACHE_KEY]: salesforceReasons,
                  }),
                  DependentOptionsData: recordToCache?.DependentOptionsData || "",
                  is_locally_changed: false,
                  is_synced: true,
                  last_modified: Date.now(),
                  operation_type: "insert",
                },
              });
              console.log("[Attendance Reason] Cached Salesforce values for offline use.");
            } else {
              console.warn(
                "[Attendance Reason] Salesforce returned no active Reason__c picklist values.",
              );
            }
          } catch (error) {
            // Cached values remain available if Salesforce metadata cannot be
            // refreshed (for example, a transient connection/session failure).
            console.warn("Could not refresh Attendance Reason__c picklist:", error);
          }
        } else if (cachedReasons.length === 0) {
          console.warn(
            "[Attendance Reason] Device is offline and no cached Reason__c values exist yet. Open attendance once while online to cache them.",
          );
        }

        // Set training content
        setTrainingContent(optionsData?.traningVideo || "");
        setTrainingContentType(optionsData?.traningVideoType || "");

        // Fetch User Data
        const userResult = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });

        setUsers(userResult);
        console.log("👤 User Data:", userResult);

        // Update attendance status options based on user role
        setOptions((prevOptions) => {
          let newOptions = [...prevOptions];

          if (userResult?.[0]?.DeveloperName === "MT_Merchandiser") {
            if (!newOptions.some((o) => o.value === "Meeting")) {
              newOptions.push({ label: "Meeting", value: "Meeting" });
            }
          }

          if (userResult?.[0]?.DeveloperName === "MT_SO") {
            if (!newOptions.some((o) => o.value === "Admin")) {
              newOptions.push({ label: "Admin", value: "Admin" });
            }
          }

          return newOptions;
        });
      } catch (error) {
        console.error(" Initialization error:", error);
        showToastvisible("error", "Failed to load attendance configuration.");
      } finally {
        setLoading(false);
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll when Leave is selected
  useEffect(() => {
    if (status === "Leave") {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [status]);

  const removeSelfie = async () => {
    try {
      setSelfieUri(null);
      setBase64Image("");
      await AsyncStorage.removeItem("TEMP_SELFIE");
    } catch (e) {
      console.log("Remove selfie error:", e);
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  const isSubmitDisabled =
    (status !== "Leave" && !hasImage) ||
    loading ||
    (status === "Leave" &&
      ((leaveApplyFor === "Today" && !statusLeave) ||
        (leaveApplyFor === "Next Days" && (!fromDate || !toDate)) ||
        !reason.trim() ||
        (reason === "Other" && !otherReason.trim())));

  const cameraRef = useRef(null);
  const [cameraType, setCameraType] = useState("front");
  const device = useCameraDevice(cameraType);
  const fallbackDevice = useCameraDevice("back");
  const finalDevice = device ?? fallbackDevice;
  const [showCamera, setShowCamera] = useState(false);
  const [hasCamPermission, setHasCamPermission] = useState(false);

  const captureSelfieWithIosCamera = async () => {
    try {
      const result = await launchCamera({
        mediaType: "photo",
        cameraType: "front",
        includeBase64: true,
        saveToPhotos: false,
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
      });

      if (result.didCancel) return;

      if (result.errorCode || !result.assets?.[0]?.uri) {
        console.warn(
          "iOS selfie camera error:",
          result.errorMessage || result.errorCode,
        );
        const message =
          result.errorCode === "camera_unavailable"
            ? "Selfie capture requires a real iPhone or iPad. The iOS Simulator does not provide a camera."
            : result.errorMessage ||
              "Unable to open the camera. Please try again.";
        showToastvisible("error", message);
        return;
      }

      const asset = result.assets[0];
      const base64 =
        asset.base64 ||
        (await RNFS.readFile(asset.uri.replace("file://", ""), "base64"));

      setSelfieUri(asset.uri);
      setBase64Image(base64);
      await AsyncStorage.setItem("TEMP_SELFIE", asset.uri);
    } catch (error) {
      console.warn("iOS selfie camera error:", error);
      showToastvisible("error", "Unable to open the camera. Please try again.");
    }
  };

  const openCamera = async () => {
    try {
      if (Platform.OS === "ios") {
        await captureSelfieWithIosCamera();
        return;
      }

      let permission;

      permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "App needs camera access to take selfie",
          buttonPositive: "OK",
        },
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        showToastvisible("error", "Camera permission denied");
        return;
      }

      setHasCamPermission(true);
      setShowCamera(true);
    } catch (e) {
      console.log("Permission error:", e);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <View style={styles.modalContainer}>
            {/* HEADER ROW */}
            <View style={styles.headerRow}>
              <Text style={styles.header}>Confirm Attendance</Text>

              {(users?.[0]?.DeveloperName === "MT_SO" ||
                users?.[0]?.DeveloperName === "MT_Merchandiser") && (
                <TouchableOpacity
                  style={styles.trainingContainer}
                  onPress={() => {
                    showToastvisible(
                      "warning",
                      "Please mark attendance before leaving this screen.",
                    );
                  }}
                >
                  <Text style={styles.trainingText}>Training Video</Text>
                  <Icon
                    name="arrow-up"
                    size={20}
                    color="#C9A24D"
                    style={styles.tiltedArrow}
                  />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.subtext}>
              System will capture your geo-location.
            </Text>

            {/* SCROLL CONTENT */}
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* DATE ROW */}
              <View style={styles.row}>
                <Icon
                  name="calendar"
                  size={22}
                  color="#C9A24D"
                  style={styles.icon}
                />
                <View>
                  <Text style={styles.label}>Date</Text>
                  <Text style={styles.value}>{displayDate}</Text>
                </View>
              </View>

              {/* LOCATION ROW */}
              <View style={styles.row}>
                <Icon
                  name="map-pin"
                  size={22}
                  color="red"
                  style={styles.icon}
                />
                <View>
                  <Text style={styles.label}>Current Location</Text>
                  <Text style={[styles.value, { width: 300 }]}>{location}</Text>
                </View>
              </View>

              {/* STATUS DROPDOWN */}
              <Dropdown
                ref={statusDropdownRef}
                data={availableStatusOptions}
                labelField="label"
                valueField="value"
                disable={isStatusLockedAfterWarning || isPreparingAttendance}
                value={status}
                onChange={(item) => {
                  userInteractedRef.current = true;
                  setUserInteracted(true);
                  statusSetter(item.value);
                  closeAttendanceDropdowns();
                }}
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                search
                searchPlaceholder="Search"
                itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
              />

              {/* LEAVE SECTION (shown when status is Leave and not correcting rejected leave) */}
              {status === "Leave" && !isRejectedLeaveCorrection && (
                <>
                  {/* LEAVE APPLY FOR DROPDOWN */}
                  <Dropdown
                    data={LEAVE_TYPE_OPTIONS}
                    labelField="label"
                    valueField="value"
                    value={leaveApplyFor}
                    placeholder="Select leave type"
                    disable={isPreparingAttendance}
                    onChange={(item) => {
                      userInteractedRef.current = true;
                      setUserInteracted(true);
                      setLeaveApplyFor(item.value);
                      if (item.value === "Next Days") {
                        setStatusLeave(""); // Clear today's duration
                      } else {
                        setFromDate(new Date());
                        setToDate(new Date());
                      }
                    }}
                    style={styles.dropdown}
                    containerStyle={styles.dropdownContainer}
                    inputSearchStyle={styles.searchbox}
                    placeholderStyle={styles.placeholderDropdown}
                    selectedTextStyle={styles.valueDropdown}
                  />

                  {/* LEAVE DURATION DROPDOWN (Today only) */}
                  {leaveApplyFor === "Today" && (
                    <Dropdown
                      ref={leaveDropdownRef}
                      data={leaveOptions}
                      labelField="label"
                      valueField="value"
                      value={statusLeave}
                      placeholder="Select leave duration"
                      disable={isPreparingAttendance}
                      onChange={(item) => {
                        userInteractedRef.current = true;
                        setUserInteracted(true);
                        setStatusLeave(item.value);
                        closeAttendanceDropdowns();
                      }}
                      style={styles.dropdown}
                      containerStyle={styles.dropdownContainer}
                      inputSearchStyle={styles.searchbox}
                      placeholderStyle={styles.placeholderDropdown}
                      selectedTextStyle={styles.valueDropdown}
                      search
                      searchPlaceholder="Search"
                      itemContainerStyle={{
                        paddingVertical: 0,
                        marginVertical: -5,
                      }}
                    />
                  )}

                  {/* FROM DATE & TO DATE BUTTONS (Next Days only) */}
                  {leaveApplyFor === "Next Days" && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.label}>From Date</Text>
                        <TouchableOpacity
                          style={[
                            styles.dropdown,
                            { justifyContent: "center", backgroundColor: "#F1EADB", opacity: 0.8 },
                          ]}
                          disabled={true}
                        >
                          <Text style={{ color: "#7A7266" }}>
                            {fromDate
                              ? moment(fromDate).format("DD-MM-YYYY")
                              : "Select Date"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.label}>To Date</Text>
                        <TouchableOpacity
                          style={[
                            styles.dropdown,
                            { justifyContent: "center" },
                          ]}
                          onPress={() => setOpenToDatePicker(true)}
                        >
                          <Text style={{ color: "#000" }}>
                            {toDate
                              ? moment(toDate).format("DD-MM-YYYY")
                              : "Select Date"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* DATE PICKER MODALS */}
                  {leaveApplyFor === "Next Days" && (
                    <>
                      <DatePicker
                        modal
                        open={openToDatePicker}
                        date={toDate}
                        mode="date"
                        minimumDate={fromDate || new Date()}
                        onConfirm={(selectedDate) => {
                          setOpenToDatePicker(false);
                          setToDate(selectedDate);
                        }}
                        onCancel={() => setOpenToDatePicker(false)}
                      />
                    </>
                  )}

                  {/* LEAVE REASON DROPDOWN */}
                  <Dropdown
                    ref={reasonDropdownRef}
                    data={reasonOptions}
                    labelField="label"
                    valueField="value"
                    value={reason}
                    placeholder="Select reason for leave"
                    disable={isPreparingAttendance}
                    onChange={(item) => {
                      userInteractedRef.current = true;
                      setUserInteracted(true);
                      setReason(item.value);
                      // Clear custom text when not Other
                      if (item.value !== "Other") setOtherReason("");
                      closeAttendanceDropdowns();
                    }}
                    style={styles.dropdown}
                    containerStyle={styles.dropdownContainer}
                    placeholderStyle={styles.placeholderDropdown}
                    selectedTextStyle={styles.valueDropdown}
                    itemContainerStyle={{
                      paddingVertical: 0,
                      marginVertical: -5,
                    }}
                  />
                  {!reason.trim() && (
                    <Text style={{ color: "red", fontSize: 12 }}>
                      Please select reason for leave
                    </Text>
                  )}

                  {/* CUSTOM REASON INPUT (if "Other" selected) */}
                  {reason === "Other" && (
                    <CTextInput
                      style={styles.reasonInput}
                      value={otherReason}
                      placeholder="Enter other reason*"
                      placeholderTextColor="#999"
                      validationType="text"
                      minValue={1}
                      onChangeText={(t) => {
                        userInteractedRef.current = true;
                        setUserInteracted(true);
                        setOtherReason(t);
                      }}
                    />
                  )}
                  {reason === "Other" && !otherReason.trim() && (
                    <Text style={{ color: "red", fontSize: 12 }}>
                      Please enter other reason
                    </Text>
                  )}
                </>
              )}

              {/* IMAGE UPLOAD (required for Present and Office only) */}
              {status !== "Leave" && (
                <>
                  <View style={styles.uploadRow}>
                    <View>
                      <Text style={styles.uploadLabel}>
                        Upload Image <Text style={styles.requiredStar}>*</Text>
                      </Text>
                    </View>

                    <TouchableOpacity onPress={openCamera}>
                      <LinearGradient
                        colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                        style={styles.button}
                      >
                        <Icon name="camera" size={20} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {selfieUri && (
                    <View style={styles.selfieWrapper}>
                      <Image
                        source={{ uri: selfieUri }}
                        style={styles.selfieImage}
                      />
                      <TouchableOpacity
                        onPress={removeSelfie}
                        style={styles.removeSelfieButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Icon name="x" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <Modal visible={showCamera} animationType="slide">
              {finalDevice && hasCamPermission ? (
                <View style={{ flex: 1, backgroundColor: "#000" }}>
                  <Camera
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    device={finalDevice}
                    isActive={showCamera} // 🔥 IMPORTANT
                    photo={true}
                  />

                  {/* CAPTURE */}
                  <TouchableOpacity
                    onPress={capturePhoto}
                    style={{
                      position: "absolute",
                      bottom: 50,
                      alignSelf: "center",
                      backgroundColor: "#C9A24D",
                      padding: 20,
                      borderRadius: 50,
                    }}
                  >
                    <Icon name="camera" size={30} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setCameraType((prev) =>
                        prev === "front" ? "back" : "front",
                      );
                    }}
                    style={{
                      position: "absolute",
                      top: 50,
                      left: 20,
                      backgroundColor: "#00000080",
                      padding: 10,
                      borderRadius: 30,
                    }}
                  >
                    <Icon name="refresh-cw" size={22} color="#fff" />
                  </TouchableOpacity>

                  {/* CLOSE */}
                  <TouchableOpacity
                    onPress={() => setShowCamera(false)}
                    style={{
                      position: "absolute",
                      top: 50,
                      right: 20,
                      backgroundColor: "#00000080",
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <Feather name="x" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#000" }}>Loading Camera...</Text>
                </View>
              )}
            </Modal>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              onPress={handleAttendanceSubmit}
              // disabled={
              //     !hasImage ||
              //     loading ||
              //     (status === 'Leave' && (!statusLeave || !reason.trim()))
              // }
              disabled={isSubmitDisabled}
              activeOpacity={0.8}
              style={{ width: "100%", marginBottom: 10 }}
            >
              {!isSubmitDisabled ? (
                <LinearGradient
                  colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>
                    {loading
                      ? "Submitting..."
                      : status === "Present"
                      ? "Present"
                      : status === "Leave"
                      ? "Leave"
                      : "Attendance"}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={[styles.button, styles.buttonDisabled]}>
                  <Text style={[styles.buttonText, styles.buttonTextDisabled]}>
                    {loading
                      ? "Submitting..."
                      : status === "Present"
                      ? "Present"
                      : status === "Leave"
                      ? "Leave"
                      : "Attendance"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <LoaderOverlay
            visible={
              loading || isPreparingAttendance || isResolvingAttendanceDate
            }
            message="Preparing attendance..."
          />
          <ToastModal
            visible={toast.modalVisible}
            message={toast.modalMessage}
            type={toast.modalType}
            onClose={() => dispatch(hideModalToast())}
          />
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000080",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    maxHeight: "85%",
  },
  header: {
    fontSize: 18,
    // fontWeight: '600',
    color: "#A67C2E",
    marginBottom: 6,
    ...safeFont,
  },
  subtext: { fontSize: 12, color: "#666", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  icon: { marginRight: 10 },
  label: { fontSize: 12, color: "#888" },
  value: {
    fontSize: 14,
    //  fontWeight: '500',
    ...safeFont,
    color: "#000",
  },
  reasonInput: {
    height: 42,
    paddingHorizontal: 12,
    backgroundColor: "#FBF8F1",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: "#000",
  },
  button: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    //  fontWeight: 'bold'
    ...safeFont,
  },
  dropdown: {
    height: 42,
    paddingHorizontal: 12,
    backgroundColor: "#FBF8F1",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: "#000",
  },
  searchbox: {
    borderWidth: 0,
    backgroundColor: "transparent",
    fontSize: 14,
    paddingLeft: 4,
    borderBottomWidth: 0.2,
    borderColor: "gray",
    height: 42,
  },
  dropdownContainer: { borderRadius: 8, marginTop: -42, paddingVertical: 5 },
  placeholderDropdown: { color: "#7A7266", fontSize: 14 },
  valueDropdown: { color: "#1F1D1A", fontSize: 14 },
  selfieImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#C9A24D",
    marginTop: 20,
    resizeMode: "cover",
  },
  uploadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  uploadLabel: {
    fontSize: 16,
    color: "#000",
    // fontWeight: '500'
    ...safeFont,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    borderBottomColor: "#000",
    borderBottomWidth: 0.5,
  },
  trainingContainer: { flexDirection: "row", alignItems: "center" },
  trainingText: {
    fontSize: 14,
    color: "#A67C2E",
    // fontWeight: '500',
    ...safeFont,
    marginRight: 5,
  },
  tiltedArrow: { transform: [{ rotate: "45deg" }] },
  requiredStar: {
    color: "red",
    // fontWeight: '700',
    ...safeFont,
  },
  buttonDisabled: {
    backgroundColor: "#bfcbe9",
    opacity: 0.95,
  },
  buttonTextDisabled: {
    color: "#f1f5fb",
  },
  selfieWrapper: {
    position: "relative",
    marginTop: 20,
  },
  selfieImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#C9A24D",
    resizeMode: "cover",
    marginTop: 0,
  },
  removeSelfieButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#00000090",
    borderRadius: 16,
    padding: 6,
  },
});

export default AttendanceModel;
