import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  StatusBar,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  RefreshControl,
  PermissionsAndroid,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { useDispatch, useSelector } from "react-redux";
import { showToast, showModalToast, hideModalToast } from "../redux/slices/toastSlice";
import ToastModal from "../components/modal/ToastModal";
import { isInternetAvailable } from "../utils/networkUtils";
import LinearGradient from "react-native-linear-gradient";
import HeaderMain from "../components/HeaderMain";
import Feather from "@react-native-vector-icons/feather";
import MIcon from "@react-native-vector-icons/material-icons";
import DatePickerModal from "../components/modal/DatePickerModal";
import { dataSyncer } from "../UtilityMain/dataSyncer";
import { Dropdown } from "react-native-element-dropdown";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import moment from "moment";
import { extractApiErrorMessage } from "../utils/sync/syncStatus";

const REQUEST_TYPE_OPTIONS = [
  { label: "New Installation", value: "New Installation" },
  { label: "Replacement", value: "Replacement" },
];

const PRIORITY_OPTIONS = [
  { label: "Low", value: "Low" },
  { label: "Medium", value: "Medium" },
  { label: "High", value: "High" },
 
];

const STATUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Pending", value: "Pending" },
  { label: "Verification Pending", value: "Verification Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

const VERIFICATION_STATUS_OPTIONS = [
  { label: "Verified", value: "Verified" },
  { label: "Rejected", value: "Rejected" },
];

const getStatusColor = (status) => {
  switch (status) {
    case "Approved":
      return "#28a745";
    case "Rejected":
      return "#B3261E";
    case "Pending":
      return "#f0ad4e";
    case "Verification Pending":
      return "#17a2b8";
    default:
      return "#6c757d";
  }
};

const canEditVerification = (record) =>
  String(record?.Status__c || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase() === "verification pending";

const SignageRequest = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { fetchRecords, apiFetch, apiComposite } = useApiFetch();
  const dispatch = useDispatch();
  const { accessToken, instanceUrl } = useSelector((state) => state.auth);
  const selectedVisit = useSelector((state: any) => state.selectedVisit);
  const toast = useSelector((state: any) => state.toast);

  const visitId = selectedVisit?.sfId || "";
  const outletId = selectedVisit?.AccountId || "";
  //   const outletId = '001Bg00000XpZ0kIAF';

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempStatus, setTempStatus] = useState("All");

  const [signageList, setSignageList] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState({
    recordId: "",
    status: "",
    base64Image: "",
    reason: "",
  });
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<"verification" | "form" | null>(null);

  const [formData, setFormData] = useState({
    requestType: "New Installation",
    signageId: "",
    signageName: "",
    quantity: "",
    reason: "",
    priority: "Medium",
    installationLocation: "",
    installationLocationImage: "",
    expectedDate: "",
    estimatedCost: "",
    remarks: "",
    existingSignageId: "",
    existingSignageName: "",
  });
  const [errors, setErrors] = useState({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const formScrollRef = useRef<ScrollView>(null);

  const keepFormFieldVisible = () => {
    setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 180);
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    initScreen();
  }, []);

  const filteredRequests = useMemo(() => {
    let result = requests;
    if (selectedStatus !== "All") {
      result = result.filter((a) => a.Status__c === selectedStatus);
    }
    if (searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      result = result.filter(
        (a) =>
          (a.Name || "").toLowerCase().includes(term) ||
          (a.Outlet__r?.Name || "").toLowerCase().includes(term) ||
          (a.Signage_Type__c || "").toLowerCase().includes(term),
      );
    }
    return result;
  }, [requests, selectedStatus, searchText]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const connected = await isInternetAvailable();
      if (connected && accessToken && instanceUrl) {
        await dataSyncer(
          { accessToken, instanceUrl },
          fetchRecords,
          apiFetch,
          apiComposite,
        );
      }
      await Promise.all([fetchRequests(), fetchSignageList()]);
    } catch (error) {
      console.error("Refresh failed in SignageRequest:", error);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, instanceUrl, fetchRecords, apiFetch, apiComposite]);

  const checkInternet = async () => {
    const connected = await isInternetAvailable();
    if (!connected) {
      dispatch(
        showToast({
          message: "Please check your internet connection and try again.",
          type: "error",
        }),
      );
      return false;
    }
    if (!accessToken) {
      dispatch(
        showToast({
          message: "Session expired. Please login again to continue.",
          type: "error",
        }),
      );
      return false;
    }
    return true;
  };

  const initScreen = async () => {
    const connected = await isInternetAvailable();
    if (!connected) {
      dispatch(
        showToast({
          message: "Signage Request requires an internet connection.",
          type: "error",
        }),
      );
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchRequests(), fetchSignageList()]);
    } catch (e) {
      console.error("Init error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const query = `SELECT Id, Name, Outlet__c, Outlet__r.Name, Signage_Type__c, Status__c, Priority__c, Quantity__c, Vendor__c, Request_Type__c, Signage__c, Signage__r.Name, Reason__c, Installation_Location__c, Expected_Installation_Date__c, Estimated_Cost__c, Remarks__c, Existing_Signage__c, Verification_Status__c, Verification_Image__c, Verification_Remarks__c FROM Signage_Request__c WHERE Outlet__c = '${outletId}' ORDER BY CreatedDate DESC`;
      console.log("Fetching signage requests with query:", query);
      console.log("Outlet ID:======================================", outletId);
      const records = await fetchRecords("Signage_Request__c", query);
      setRequests(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error("Error fetching signage requests:", error);
      setRequests([]);
    }
  };

  const fetchSignageList = async () => {
    try {
      const query = `SELECT Id, Name, Signage_Type__c, Brand__c, Default_Size_Dimensions__c, 
      Estimated_Cost__c FROM Signage__c 
      WHERE Active__c = true ORDER BY Name ASC`;
      const records = await fetchRecords("Signage__c", query);
      console.log("Fetched signage list:", records);
      setSignageList(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error("Error fetching signage list:", error);
      setSignageList([]);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.requestType)
      newErrors.requestType = "Request Type is required";
    if (!formData.signageId) newErrors.signageId = "Signage Item is required";
    if (!formData.quantity.trim()) {
      newErrors.quantity = "Quantity is required";
    } else if (Number(formData.quantity) <= 0) {
      newErrors.quantity = "Quantity must be greater than 0";
    } else if (formData.quantity.length > 5) {
      newErrors.quantity = "Quantity cannot exceed 5 digits";
    }
    if (formData.requestType === "Replacement" && !formData.existingSignageId) {
      newErrors.existingSignageId =
        "Existing Signage is required for Replacement";
    }
    if (!formData.installationLocationImage || !String(formData.installationLocationImage).trim()) {
      newErrors.installationLocationImage = "Image capture is mandatory";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const ok = await checkInternet();
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = {
        Outlet__c: outletId,
        Request_Type__c: formData.requestType,
        Signage__c: formData.signageId,
        Quantity__c: Number(formData.quantity),
        Priority__c: formData.priority,
        Replacement_Requested__c:
          formData.requestType === "Replacement" ? true : false,
      };
      if (formData.reason.trim()) payload.Reason__c = formData.reason;
      if (formData.installationLocation.trim())
        payload.Installation_Location__c = formData.installationLocation;
      if (formData.installationLocationImage)
        payload.Installation_Location_Image__c = formData.installationLocationImage;
      if (formData.expectedDate)
        payload.Expected_Installation_Date__c = formData.expectedDate;
      if (formData.estimatedCost.trim())
        payload.Estimated_Cost__c = Number(formData.estimatedCost);
      if (formData.remarks.trim()) payload.Remarks__c = formData.remarks;
      if (
        formData.requestType === "Replacement" &&
        formData.existingSignageId
      ) {
        payload.Existing_Signage__c = formData.existingSignageId;
      }

      console.log("Submitting signage request with payload:", payload);
      const response = await apiFetch(
        "POST",
        "sobjects/Signage_Request__c",
        payload,
        "SObjects",
      );
      if (response.status === "success") {
        dispatch(
          showToast({
            message: "Signage Request submitted successfully!",
            type: "success",
          }),
        );
        setShowForm(false);
        resetForm();
        fetchRequests();
      } else {
        dispatch(
          showToast({
            message: "Failed to submit signage request",
            type: "error",
          }),
        );
      }
    } catch (err) {
      console.error("Submit error:", err);
      dispatch(
        showToast({
          message: "Failed to submit signage request",
          type: "error",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      requestType: "New Installation",
      signageId: "",
      signageName: "",
      quantity: "",
      reason: "",
      priority: "Medium",
      installationLocation: "",
      installationLocationImage: "",
      expectedDate: "",
      estimatedCost: "",
      remarks: "",
      existingSignageId: "",
      existingSignageName: "",
    });
    setErrors({});
  };

  const handleChange = (field, value) => {
    let sanitized = value;
    if (field === "quantity") {
      sanitized = value.replace(/[^0-9]/g, "").slice(0, 5);
    } else if (field === "estimatedCost") {
      sanitized = value.replace(/[^0-9.]/g, "");
      const parts = sanitized.split(".");
      if (parts.length > 2)
        sanitized = parts[0] + "." + parts.slice(1).join("");
    }
    setFormData((prev) => ({ ...prev, [field]: sanitized }));
    setErrors((prev) => {
      if (prev[field]) {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }
      return prev;
    });
  };

  const handleApplyFilter = () => {
    setSelectedStatus(tempStatus);
    setShowFilterModal(false);
  };

  const openVerificationModal = (record) => {
    setImagePickerTarget("verification");
    setVerificationData({
      recordId: record.Id,
      status: record.Verification_Status__c || '',
      base64Image: record.Verification_Image__c || '',
      reason: record.Verification_Remarks__c || '',
    });
    setShowVerificationModal(true);
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "This app needs access to your camera to take photos.",
            buttonPositive: "OK",
            buttonNegative: "Cancel",
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn("Camera permission error:", err);
        return false;
      }
    }
    return true;
  };

  const handleVerificationImagePick = () => {
    setImagePickerTarget("verification");
    setShowImagePickerModal(true);
  };

  const handleVerificationCameraPress = async () => {
    setShowImagePickerModal(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setTimeout(() => {
        dispatch(
          showToast({
            message: "Camera permission denied. Please enable it in Settings.",
            type: "error",
          }),
        );
      }, 400);
      return;
    }
    setTimeout(() => {
      launchCamera(
        {
          mediaType: "photo",
          includeBase64: true,
          quality: 0.3,
          maxWidth: 800,
          maxHeight: 800,
          selectionLimit: 1,
          cameraType: "back",
        },
        handleVerificationImageResponse,
      );
    }, 300);
  };

  const handleVerificationGalleryPress = () => {
    setShowImagePickerModal(false);
    setTimeout(() => {
      launchImageLibrary(
        {
          mediaType: "photo",
          includeBase64: true,
          quality: 0.3,
          maxWidth: 800,
          maxHeight: 800,
          selectionLimit: 1,
        },
        handleVerificationImageResponse,
      );
    }, 300);
  };

  const handleVerificationImageResponse = (response) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      dispatch(
        showToast({
          message: response.errorMessage || "Failed to pick image",
          type: "error",
        }),
      );
      return;
    }
    if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      if (asset.base64 && asset.base64.length > 131000) {
        dispatch(
          showModalToast({
            message:
              "Image too large. Please choose a smaller image or reduce quality.",
            type: "error",
          }),
        );
        dispatch(
          showToast({
            message:
              "Image too large. Please choose a smaller image or reduce quality.",
            type: "error",
          }),
        );
        return;
      }
      if (asset.base64) {
        if (imagePickerTarget === "form") {
          setFormData((prev) => ({ ...prev, installationLocationImage: asset.base64 }));
          setErrors((prev) => {
            const updated = { ...prev };
            delete updated.installationLocationImage;
            return updated;
          });
        } else {
          setVerificationData((prev) => ({ ...prev, base64Image: asset.base64 }));
        }
      }
    }
  };

  const handleVerificationSubmit = async () => {
    if (!verificationData.base64Image) {
      dispatch(
        showModalToast({
          message: "Please capture or upload a verification image.",
          type: "error",
        }),
      );
      dispatch(
        showToast({
          message: "Please capture or upload a verification image.",
          type: "error",
        }),
      );
      return;
    }
    if (!verificationData.status) {
      dispatch(
        showModalToast({
          message: "Please select a verification status.",
          type: "error",
        }),
      );
      dispatch(
        showToast({
          message: "Please select a verification status.",
          type: "error",
        }),
      );
      return;
    }
    if (!verificationData.reason.trim()) {
      dispatch(showModalToast({ message: "Comment / Reason is required.", type: "error" }));
      dispatch(showToast({ message: "Comment / Reason is required.", type: "error" }));
      return;
    }
    const ok = await checkInternet();
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = {
        Verification_Status__c: verificationData.status,
        Verification_Image__c: verificationData.base64Image,
        Verification_Remarks__c: verificationData.reason.trim(),
      };
      const response = await apiFetch(
        "PATCH",
        `sobjects/Signage_Request__c/${verificationData.recordId}`,
        payload,
        "SObjects",
      );
      if (response.status === "success") {
        dispatch(
          showToast({
            message: "Verification submitted successfully!",
            type: "success",
          }),
        );
        setShowVerificationModal(false);
        fetchRequests();
      } else {
        const errorMessage =
          extractApiErrorMessage(response) || "Failed to submit verification";
        dispatch(
          showModalToast({
            message: errorMessage,
            type: "error",
          }),
        );
        dispatch(
          showToast({
            message: errorMessage,
            type: "error",
          }),
        );
      }
    } catch (err) {
      console.error("Verification submit error:", err);
      const errorMessage =
        extractApiErrorMessage(null, err) || "Failed to submit verification";
      dispatch(
        showModalToast({ message: errorMessage, type: "error" }),
      );
      dispatch(
        showToast({ message: errorMessage, type: "error" }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isVerificationSubmitEnabled = Boolean(
    verificationData.base64Image &&
    verificationData.status &&
    verificationData.reason.trim() &&
    !submitting,
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.filterContainer}>
              <Text style={styles.filterTitle}>Filter by Status</Text>
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    tempStatus === option.value && styles.filterOptionActive,
                  ]}
                  onPress={() => setTempStatus(option.value)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      tempStatus === option.value &&
                        styles.filterOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {tempStatus === option.value && (
                    <Feather name="check" size={18} color="#C9A24D" />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleApplyFilter}
              >
                <LinearGradient
                  colors={["#C9A24D", "#A67C2E"]}
                  style={styles.applyBtnInner}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.Name || "-"}</Text>
          <Text style={styles.cardUserName}>{item.Outlet__r?.Name || "-"}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          
          {canEditVerification(item) && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => openVerificationModal(item)}
            >
              <Feather name="edit-2" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Signage Type</Text>
          <Text style={styles.cardValue}>{item.Signage_Type__c || "-"}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Priority</Text>
          <Text style={styles.cardValue}>{item.Priority__c || "-"}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Quantity</Text>
          <Text
            style={[styles.cardValue, { fontWeight: "700", color: "#A67C2E" }]}
          >
            {item.Quantity__c ?? "-"}
          </Text>
        </View>
        {/* <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Vendor</Text>
          <Text style={styles.cardValue}>{item.Vendor__c || "-"}</Text>
        </View> */}
        {item.Reason__c ? (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Reason</Text>
            <Text style={styles.cardValue}>{item.Reason__c}</Text>
          </View>
        ) : null}
        {item.Status__c ? (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Status</Text>
            <Text
              style={[
                styles.cardValue,
                {
                  color:
                    item.Status__c === "Active"
                      ? "#28a745"
                      : "#B3261E",
                  fontWeight: "600",
                },
              ]}
            >
                 {item.Status__c || "Pending"}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderForm = () => {
    const signageDropdownData = signageList.map((s) => ({
      label: s.Name || "-",
      value: s.Id,
      cost: s.Estimated_Cost__c,
    }));
    const activeExistingSignageOptions = requests
      .filter(
        (r) =>
          String(r.Status__c || "")
            .trim()
            .toLowerCase() === "active",
      )
      .map((r) => ({
        label: r.Name || "-",
        value: r.Id,
      }));

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 50 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={formScrollRef}
          style={styles.formScroll}
          contentContainerStyle={{ paddingBottom: 150, marginTop: 10 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Request Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Request Type <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Dropdown
              style={styles.dropdown}
              data={REQUEST_TYPE_OPTIONS}
              labelField="label"
              valueField="value"
              value={formData.requestType}
              onChange={(item) => {
                handleChange("requestType", item.value);
                if (item.value !== "Replacement") {
                  setFormData((prev) => ({
                    ...prev,
                    requestType: item.value,
                    existingSignageId: "",
                    existingSignageName: "",
                  }));
                } else {
                  setFormData((prev) => ({ ...prev, requestType: item.value }));
                }
              }}
              placeholder="Select Request Type"
            />
            {errors.requestType && (
              <Text style={styles.errorText}>{errors.requestType}</Text>
            )}
          </View>

          {/* Signage Item Lookup */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Signage Item <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Dropdown
              style={styles.dropdown}
              data={signageDropdownData}
              labelField="label"
              valueField="value"
              value={formData.signageId}
              placeholder="Select Signage Item"
              onChange={(item) => {
                const selected = signageList.find((s) => s.Id === item.value);
                setFormData((prev) => ({
                  ...prev,
                  signageId: item.value,
                  signageName: item.label,
                  estimatedCost: selected?.Estimated_Cost__c
                    ? String(selected.Estimated_Cost__c)
                    : prev.estimatedCost,
                }));
                setErrors((prev) => {
                  const updated = { ...prev };
                  delete updated.signageId;
                  return updated;
                });
              }}
            />
            {errors.signageId && (
              <Text style={styles.errorText}>{errors.signageId}</Text>
            )}
          </View>

          {/* Existing Signage - only for Replacement */}
          {formData.requestType === "Replacement" && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Existing Signage <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                data={activeExistingSignageOptions}
                labelField="label"
                valueField="value"
                value={formData.existingSignageId}
                placeholder="Select Existing Signage"
                onFocus={() => {
                  if (activeExistingSignageOptions.length === 0) {
                    dispatch(
                      showToast({
                        message: "No active signage is available for replacement.",
                        type: "warning",
                      }),
                    );
                  }
                }}
                onChange={(item) => {
                  setFormData((prev) => ({
                    ...prev,
                    existingSignageId: item.value,
                    existingSignageName: item.label,
                  }));
                  setErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.existingSignageId;
                    return updated;
                  });
                }}
              />
              {errors.existingSignageId && (
                <Text style={styles.errorText}>{errors.existingSignageId}</Text>
              )}
            </View>
          )}

          {/* Quantity */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Quantity <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter quantity"
              keyboardType="number-pad"
              maxLength={5}
              value={formData.quantity}
              onChangeText={(val) => handleChange("quantity", val)}
            />
            {errors.quantity && (
              <Text style={styles.errorText}>{errors.quantity}</Text>
            )}
          </View>

          {/* Priority */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Priority</Text>
            <Dropdown
              style={styles.dropdown}
              data={PRIORITY_OPTIONS}
              labelField="label"
              valueField="value"
              value={formData.priority}
              onChange={(item) => handleChange("priority", item.value)}
              placeholder="Select Priority"
            />
          </View>

          {/* Reason */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              style={[
                styles.textInput,
                { height: 70, textAlignVertical: "top" },
              ]}
              placeholder="Enter reason"
              multiline
              value={formData.reason}
              onChangeText={(val) => handleChange("reason", val)}
            />
          </View>

          {/* Installation Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Installation Location</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Front Gate, Main Display Board"
              value={formData.installationLocation}
              onChangeText={(val) => handleChange("installationLocation", val)}
            />
          </View>

          {/* Reference Image / Image Capture */}
          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={styles.fieldLabel}>
                Image Capture <Text style={styles.requiredStar}>*</Text>
              </Text>
              {formData.installationLocationImage ? (
                <TouchableOpacity
                  onPress={() =>
                    setFormData((prev) => ({
                      ...prev,
                      installationLocationImage: "",
                    }))
                  }
                >
                  <MIcon name="delete" size={18} color="#B3261E" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                styles.imageSelectorBtn,
                errors.installationLocationImage ? styles.imageSelectorBtnError : null,
              ]}
              onPress={() => {
                setImagePickerTarget("form");
                setShowImagePickerModal(true);
              }}
            >
              {formData.installationLocationImage ? (
                <Image
                  source={{
                    uri: `data:image/jpeg;base64,${formData.installationLocationImage}`,
                  }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Feather name="camera" size={24} color={errors.installationLocationImage ? "#B3261E" : "#999"} style={{ marginBottom: 4 }} />
                  <Text style={[styles.imagePlaceholderText, errors.installationLocationImage ? { color: "#B3261E" } : null]}>
                    Tap to upload or capture image
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {errors.installationLocationImage && (
              <Text style={styles.errorText}>{errors.installationLocationImage}</Text>
            )}
          </View>

          {/* Expected Installation Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Expected Installation Date</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text
                style={
                  formData.expectedDate
                    ? styles.dateText
                    : styles.datePlaceholder
                }
              >
                {formData.expectedDate || "Select date"}
              </Text>
              <Feather name="calendar" size={18} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Estimated Cost */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Estimated Cost</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter estimated cost"
              keyboardType="decimal-pad"
              value={formData.estimatedCost}
              onChangeText={(val) => handleChange("estimatedCost", val)}
              onFocus={keepFormFieldVisible}
            />
          </View>

          {/* Remarks */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Remarks</Text>
            <TextInput
              style={[
                styles.textInput,
                { height: 70, textAlignVertical: "top" },
              ]}
              placeholder="Additional notes"
              multiline
              value={formData.remarks}
              onChangeText={(val) => handleChange("remarks", val)}
              onFocus={keepFormFieldVisible}
            />
          </View>
        </ScrollView>

        <View style={styles.submitBtnWrapper}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <LinearGradient
              colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtnInner}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelectDate={(date) => {
            handleChange("expectedDate", date);
            setShowDatePicker(false);
          }}
          selectedDate={formData.expectedDate}
          minDate={moment().format("YYYY-MM-DD")}
          maxDate={null}
        />
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        {showForm ? (
          <View style={styles.customHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.customHeaderText}>New Signage Request</Text>
            <View style={{ width: 24 }} />
          </View>
        ) : (
          <HeaderMain screenName="Signage Request" />
        )}
      </View>

      {showForm ? (
        renderForm()
      ) : (
        <>
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Feather
                name="search"
                size={18}
                color="#999"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search requests, outlets, or signage"
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor="#999"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Feather name="x" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => {
                setTempStatus(selectedStatus);
                setShowFilterModal(true);
              }}
            >
              <Feather name="filter" size={20} color="#C9A24D" />
            </TouchableOpacity>
          </View>

          {selectedStatus !== "All" && (
            <View style={styles.activeFilterRow}>
              <Text style={styles.activeFilterText}>
                Status: {selectedStatus}
              </Text>
              <TouchableOpacity onPress={() => setSelectedStatus("All")}>
                <Feather name="x-circle" size={16} color="#C9A24D" />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={filteredRequests}
            keyExtractor={(item, index) => item.Id || String(index)}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 100,
            }}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <Feather name="file-text" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    No signage requests found
                  </Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />

          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 30 }]}
            onPress={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <LinearGradient
              colors={["#C9A24D", "#A67C2E"]}
              style={styles.fabInner}
            >
              <Feather name="plus" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {renderFilterModal()}

      {/* Verification Modal */}
      <Modal
        visible={showVerificationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerificationModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowVerificationModal(false)}
        >
          <View style={styles.verifyOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[
                  styles.verifySheet,
                  { paddingBottom: 20 + insets.bottom },
                ]}
              >
                <View style={styles.verifyHandle} />
                <View style={styles.verifyHeader}>
                  <Text style={styles.verifyTitle}>Verify Signage</Text>
                  <TouchableOpacity
                    onPress={() => setShowVerificationModal(false)}
                  >
                    <Feather name="x" size={22} color="#7A7266" />
                  </TouchableOpacity>
                </View>
                <View style={styles.verifyBorder} />

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Image Capture */}
                  <View style={styles.verifyField}>
                    <View style={styles.verifyLabelRow}>
                      <Text style={styles.verifyLabel}>
                        Verification Image{" "}
                        <Text style={{ color: "#B3261E" }}>*</Text>
                      </Text>
                      {verificationData.base64Image ? (
                        <TouchableOpacity
                          onPress={() =>
                            setVerificationData((prev) => ({
                              ...prev,
                              base64Image: '',
                            }))
                          }
                        >
                          <MIcon name="delete" size={18} color="#B3261E" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={styles.verifyImageBtn}
                      onPress={handleVerificationImagePick}
                    >
                      {verificationData.base64Image ? (
                        <Image
                          source={{
                            uri: `data:image/jpeg;base64,${verificationData.base64Image}`,
                          }}
                          style={styles.verifyImagePreview}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.verifyImagePlaceholder}>
                          <Feather name="camera" size={28} color="#7A7266" />
                          <Text style={styles.verifyImagePlaceholderText}>
                            Tap to capture image
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* Status Dropdown */}
                  <View style={styles.verifyField}>
                    <Text style={styles.verifyLabel}>
                      Verification Status <Text style={{ color: "#B3261E" }}>*</Text>
                    </Text>
                    <Dropdown
                      style={styles.verifyDropdown}
                      data={VERIFICATION_STATUS_OPTIONS}
                      labelField="label"
                      valueField="value"
                      value={verificationData.status}
                      onChange={(item) =>
                        setVerificationData((prev) => ({
                          ...prev,
                          status: item.value,
                        }))
                      }
                      placeholder="Select Status"
                      placeholderStyle={{ color: "#999", fontSize: 14 }}
                    />
                  </View>
                  {/* Verification Reason / Comment */}
                  <View style={styles.verifyField}>
                    <Text style={styles.verifyLabel}>
                      Comment / Reason <Text style={{ color: "#B3261E" }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.verifyReasonInput}
                      value={verificationData.reason}
                      onChangeText={(value) =>
                        setVerificationData((prev) => ({ ...prev, reason: value }))
                      }
                      placeholder="Enter comment / reason"
                      placeholderTextColor="#999"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[
                    styles.verifySubmitBtn,
                    !isVerificationSubmitEnabled && styles.verifySubmitBtnDisabled,
                  ]}
                  onPress={handleVerificationSubmit}
                  disabled={!isVerificationSubmitEnabled}
                >
                  <LinearGradient
                    colors={
                      isVerificationSubmitEnabled
                        ? ["#C9A24D", "#A67C2E", "#C9A24D"]
                        : ["#d1d5db", "#7A7266", "#d1d5db"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.verifySubmitInner}
                  >
                    <Text style={styles.verifySubmitText}>
                      {submitting ? "Submitting..." : "Submit"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
        <ToastModal
          visible={toast.modalVisible}
          message={toast.modalMessage}
          type={toast.modalType}
          onClose={() => dispatch(hideModalToast())}
        />
      </Modal>

      {/* Image Picker Bottom Sheet */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowImagePickerModal(false)}
        >
          <View style={styles.verifyOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.imagePickerSheet,
                  { paddingBottom: 20 + insets.bottom },
                ]}
              >
                <View style={styles.imagePickerHandle} />
                <View style={styles.imagePickerHeader}>
                  <Text style={styles.imagePickerTitle}>Upload Image</Text>
                </View>
                <View style={styles.imagePickerBorder} />

                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={handleVerificationCameraPress}
                >
                  <View
                    style={[
                      styles.imagePickerIconBg,
                      { backgroundColor: "#FBEFD8" },
                    ]}
                  >
                    <Feather name="camera" size={22} color="#D08C1F" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.imagePickerOptionTitle}>Camera</Text>
                    <Text style={styles.imagePickerOptionDesc}>
                      Take a photo with your camera
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#7A7266" />
                </TouchableOpacity>

                <View style={styles.imagePickerOptionDivider} />

                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={handleVerificationGalleryPress}
                >
                  <View
                    style={[
                      styles.imagePickerIconBg,
                      { backgroundColor: "#DBEAFE" },
                    ]}
                  >
                    <Feather name="image" size={22} color="#3B5BB5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.imagePickerOptionTitle}>Gallery</Text>
                    <Text style={styles.imagePickerOptionDesc}>
                      Pick from your photo library
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#7A7266" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imagePickerCancelBtn}
                  onPress={() => setShowImagePickerModal(false)}
                >
                  <Text style={styles.imagePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {(loading || submitting) && (
        <View style={styles.loaderOverlay}>
          <Text style={styles.loaderText}>
            {submitting ? "Submitting..." : "Loading..."}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1EADB" },
  headerContainer: { backgroundColor: "#A67C2E" },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  customHeaderText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: "#333" },
  filterBtn: {
    marginLeft: 10,
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff3cd",
    marginHorizontal: 16,
    marginTop: -2,
    borderRadius: 8,
  },
  activeFilterText: { fontSize: 13, color: "#856404", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  cardUserName: { fontSize: 13, color: "#666", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "600" },
  cardBody: { borderTopWidth: 1, borderTopColor: "#F1EADB", paddingTop: 10 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  cardLabel: { fontSize: 13, color: "#888", flex: 1 },
  cardValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  emptyContainer: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 15, color: "#aaa", marginTop: 12 },
  fab: {
    position: "absolute",
    right: 20,
    shadowColor: "#C9A24D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  formScroll: { flex: 1, backgroundColor: "#F1EADB", paddingHorizontal: 16 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
  },
  requiredStar: { color: "#B3261E" },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: { fontSize: 14, color: "#333" },
  datePlaceholder: { fontSize: 14, color: "#999" },
  errorText: { fontSize: 12, color: "#B3261E", marginTop: 4 },
  submitBtnWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FBF8F1",
    borderTopWidth: 1,
    borderTopColor: "#F1EADB",
  },
  submitBtn: {
    height: 50,
    marginBottom: 30
  },
  submitBtnInner: {
    flex: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "80%",
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  filterOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  filterOptionActive: { backgroundColor: "#fef2f2" },
  filterOptionText: { fontSize: 15, color: "#333" },
  filterOptionTextActive: { color: "#A67C2E", fontWeight: "600" },
  applyBtn: { marginTop: 12, borderRadius: 12, overflow: "hidden" },
  applyBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
  },
  applyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: { fontSize: 16, color: "#333", marginTop: 10 },
  editBtn: {
    backgroundColor: "#C9A24D",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  verifySheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: Dimensions.get("window").height * 0.85,
  },
  verifyHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D9D2C3",
    alignSelf: "center",
    marginBottom: 14,
  },
  verifyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  verifyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  verifyBorder: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginBottom: 16,
  },
  verifyField: {
    marginBottom: 16,
  },
  verifyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1D1A',
    marginBottom: 8,
  },
  verifyLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifyDropdown: {
    height: 46,
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1EADB",
    paddingHorizontal: 12,
  },
  verifyReasonInput: {
    minHeight: 80,
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1EADB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F1D1A",
  },
  verifyImageBtn: {
    borderWidth: 1,
    borderColor: "#F1EADB",
    borderRadius: 10,
    overflow: "hidden",
  },
  verifyImagePreview: {
    width: "100%",
    height: 150,
    borderRadius: 10,
  },
  verifyImagePlaceholder: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
  },
  verifyImagePlaceholderText: {
    fontSize: 13,
    color: '#7A7266',
    marginTop: 8,
  },
  verifySubmitBtn: {
    height: 50,
    marginTop: 8,
  },
  verifySubmitBtnDisabled: {
    opacity: 0.45,
  },
  verifySubmitInner: {
    flex: 1,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  verifySubmitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  imagePickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  imagePickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D9D2C3",
    alignSelf: "center",
    marginBottom: 14,
  },
  imagePickerHeader: {
    alignItems: "center",
    marginBottom: 14,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
    textAlign: "center",
  },
  imagePickerBorder: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginBottom: 16,
  },
  imagePickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 12,
  },
  imagePickerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  imagePickerOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F1D1A",
    marginBottom: 2,
  },
  imagePickerOptionDesc: {
    fontSize: 12,
    color: "#7A7266",
  },
  imagePickerOptionDivider: {
    height: 0,
  },
  imagePickerCancelBtn: {
    marginTop: 4,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#C9A24D",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  imageSelectorBtn: {
    borderWidth: 1,
    borderColor: "#F1EADB",
    borderRadius: 10,
    overflow: "hidden",
  },
  imageSelectorBtnError: {
    borderColor: "#B3261E",
    borderWidth: 1.5,
  },
  imagePreview: {
    width: "100%",
    height: 150,
    borderRadius: 10,
  },
  imagePlaceholder: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: '#7A7266',
    marginTop: 8,
  },
});

export default SignageRequest;
