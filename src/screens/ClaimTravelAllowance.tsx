import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Image,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  RefreshControl,
  PermissionsAndroid,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { useDispatch, useSelector } from "react-redux";
import { showToast } from "../redux/slices/toastSlice";
import { isInternetAvailable } from "../utils/networkUtils";
import { triggerSessionExpired } from "../utils/sessionManager";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import LinearGradient from "react-native-linear-gradient";
import HeaderMain from "../components/HeaderMain";
import Feather from "@react-native-vector-icons/feather";
import MIcon from "@react-native-vector-icons/material-icons";
import DatePickerModal from "../components/modal/DatePickerModal";
import { Dropdown } from "react-native-element-dropdown";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import moment from "moment";
import { dataSyncer } from "../UtilityMain/dataSyncer";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STATUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Draft", value: "Draft" },
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
];

const ClaimTravelAllowance = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { fetchRecords, apiFetch, apiComposite } = useApiFetch();
  const dispatch = useDispatch();
  const { accessToken, instanceUrl } = useSelector((state) => state.auth);
  const allowanceType = route?.params?.allowanceType || "Travel Allowance";
  const isDailyAllowance = allowanceType === "Daily Allowance";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allowances, setAllowances] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempStatus, setTempStatus] = useState("All");

  const [formData, setFormData] = useState({
    expenseType: "",
    totalAmount: "",
    timePeriod: "",
    comment: "",
    base64Image: "",
  });
  const [errors, setErrors] = useState({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [loggedInUserData, setLoggedInUserData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState(null);
  const [expandedImageClaims, setExpandedImageClaims] = useState({});
  const [assignedTA, setAssignedTA] = useState(null);
  const [regionId, setRegionId] = useState(null);
  const [taConfigError, setTaConfigError] = useState("");

  const parseImages = (value) => {
    if (!value) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [value]; }
    catch (_) { return [value]; }
  };
  const serializeImages = (images) => images.length > 1 ? JSON.stringify(images) : (images[0] || "");
  const imageRequired = !isDailyAllowance && assignedTA != null && Number(formData.totalAmount) > assignedTA;

  const removeImage = (index) => {
    const images = parseImages(formData.base64Image);
    images.splice(index, 1);
    handleChange("base64Image", serializeImages(images));
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

  const filteredAllowances = useMemo(() => {
    let result = allowances;
    if (selectedStatus !== "All") {
      result = result.filter((a) => a.Status__c === selectedStatus);
    }
    if (searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      result = result.filter((a) =>
        (a.User__r?.Name || "").toLowerCase().includes(term) ||
        (a.Name || "").toLowerCase().includes(term)
      );
    }
    return result;
  }, [allowances, selectedStatus, searchText]);

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
      await fetchAllowances();
    } catch (error) {
      console.error("Refresh failed in ClaimTravelAllowance:", error);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, instanceUrl, fetchRecords, apiFetch, apiComposite]);

  const checkInternet = async () => {
    const connected = await isInternetAvailable();
    if (!connected) {
      Alert.alert(
        "No Internet",
        "Please check your internet connection and try again.",
      );
      return false;
    }
    if (!accessToken) {
      triggerSessionExpired();
      return false;
    }
    return true;
  };

  const initScreen = async () => {
    const connected = await isInternetAvailable();
    setLoading(true);
    try {
      const userData = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      setLoggedInUserData(userData);
      if (!isDailyAllowance) await fetchTravelAllowanceRule(userData, connected);
      await fetchAllowances(userData);
    } catch (e) {
      console.error("Init error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTravelAllowanceRule = async (userData, connected) => {
    let failedQuery = "";
    try {
      if (!connected) {
        const cached = JSON.parse((await AsyncStorage.getItem("travel_allowance_rule")) || "null");
        if (cached?.Amount != null) { setAssignedTA(Number(cached.Amount)); setRegionId(cached.RegionId); return; }
        throw new Error("Travel Allowance configuration is unavailable offline.");
      }
      const userName = userData?.[0]?.Name;
      if (!userName) throw new Error("Current Salesforce user name is unavailable.");
      const safeName = String(userName).replace(/'/g, "\\'");
      const mappingQuery = `SELECT Id, Name,
        Account__r.Geography__r.Type__c,
        Account__r.Geography__r.Id,
        Account__r.Geography__r.Parent__r.Id,
        Account__r.Geography__r.Parent__r.Type__c,
        Account__r.Geography__r.Parent__r.Parent__r.Id,
        Account__r.Geography__r.Parent__r.Parent__r.Type__c
        FROM User_BA_Mapping__c
        WHERE User__r.Name = '${safeName}' 
        AND Account__r.Geography__c != null
        LIMIT 1`;
      failedQuery = mappingQuery;
      const mapping = (await fetchRecords("User_BA_Mapping__c", mappingQuery))?.[0];
      if (!mapping) throw new Error("User region mapping was not found.");
      const geography = mapping.Account__r?.Geography__r;
      const geographyType = String(geography?.Type__c || "").trim().toLowerCase();
      let geographyId = null;
      if (geographyType === "cluster") {
        geographyId = geography?.Parent__r?.Parent__r?.Id;
      } else if (geographyType === "zone") {
        geographyId = geography?.Parent__r?.Id;
      } else if (geographyType === "region") {
        geographyId = geography?.Id;
      }
      if (!geographyId) throw new Error("A geography could not be determined from the user mapping.");
      let userType = userData?.[0]?.User_Type__c;
      if (!userType && userData?.[0]?.Sf_Id) {
        const userQuery = `SELECT User_Type__c FROM User WHERE Id = '${userData[0].Sf_Id}' LIMIT 1`;
        failedQuery = userQuery;
        const userRecords = await fetchRecords("User", userQuery);
        userType = userRecords?.[0]?.User_Type__c;
      }
      if (!userType) throw new Error("Current user's User Type is unavailable.");
      const safeUserType = String(userType).replace(/'/g, "\\'");
      console.log("Travel Allowance geography resolved:", { userName, geographyType, geographyId, userType });
      const ruleQuery = `SELECT Id, Amount__c, Rule_Type__c FROM Daily_Allowance_Rule__c WHERE Rule_Type__c = 'Travel Allowance' AND Role__c = '${safeUserType}' AND Geography__c = '${geographyId}'`;
      failedQuery = ruleQuery;
      const rules = await fetchRecords("Daily_Allowance_Rule__c", ruleQuery);
      if (rules?.length !== 1 || rules[0]?.Amount__c == null) throw new Error(rules?.length > 1 ? "Multiple Travel Allowance rules are configured for this region." : "No Travel Allowance rule was found for this geography.");
      setAssignedTA(Number(rules[0].Amount__c)); setRegionId(geographyId); setTaConfigError("");
      await AsyncStorage.setItem("travel_allowance_rule", JSON.stringify({ Amount: Number(rules[0].Amount__c), RegionId: geographyId }));
    } catch (error) {
      const salesforceError = error?.response?.data || error?.data || error;
      console.error("Travel Allowance Salesforce fetch failed", {
        query: failedQuery,
        status: error?.response?.status,
        code: salesforceError?.errorCode || salesforceError?.code,
        message: salesforceError?.message || error?.message,
        rawResponse: salesforceError,
      });
      setAssignedTA(null);
      setTaConfigError(salesforceError?.message || error?.message || "Travel Allowance lookup failed.");
    }
  };

  const fetchAllowances = async (userDataParam = loggedInUserData) => {
    const connected = await isInternetAvailable();
    if (!connected) {
      setAllowances([]);
      return;
    }
    try {
      setLoading(true);
      let userId = userDataParam?.[0]?.Sf_Id;
      if (!userId) {
        try {
          const userData = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          userId = userData?.[0]?.Sf_Id;
        } catch (e) {
          console.error("Error fetching user in fetchAllowances:", e);
        }
      }
      const userCondition = userId ? `AND User__c = '${userId}'` : "";
      const query = `SELECT Id, Name, User__c, User__r.Name, Allowance_Type__c, Base64_Image__c, Comment__c, Cost_Center__c, Expense_Type__c, Rejected_Reason__c, Status__c, Total_Amount__c, Time_Period__c FROM Allowance_Claim__c WHERE Allowance_Type__c = '${allowanceType}' ${userCondition} ORDER BY CreatedDate DESC`;
      const records = await fetchRecords("Allowance_Claim__c", query);
      console.log(
        "Query response:",
        records.map(({ Base64_Image__c, ...rest }) => rest),
      );
      setAllowances(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error("Error fetching allowances:", error);
      setAllowances([]);
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.expenseType.trim())
      newErrors.expenseType = "Expense Type is required";
    if (!formData.totalAmount.trim()) {
      newErrors.totalAmount = "Total Amount is required";
    } else if (!/^\d+(\.\d{1,2})?$/.test(formData.totalAmount)) {
      newErrors.totalAmount = "Enter a valid amount";
    }
    if (!formData.timePeriod.trim())
      newErrors.timePeriod = "Time Period is required";
    if (!formData.comment.trim()) newErrors.comment = "Comment is required";
    const images = parseImages(formData.base64Image);
    if (!isDailyAllowance && assignedTA == null) newErrors.totalAmount = taConfigError || "Assigned Travel Allowance is unavailable";
    if (!isDailyAllowance && assignedTA != null && Number(formData.totalAmount) > assignedTA && images.length === 0)
      newErrors.base64Image = "Image proof is required when the claimed amount exceeds the assigned Travel Allowance.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = (status) => {
    const payload = {
      User__c: loggedInUserData?.[0]?.Sf_Id || "",
      Allowance_Type__c: allowanceType,
      Status__c: status,
    };
    const optionalFields = {
      Expense_Type__c: formData.expenseType,
      Total_Amount__c: formData.totalAmount
        ? Number(formData.totalAmount)
        : undefined,
      Time_Period__c: formData.timePeriod,
      Comment__c: formData.comment,
      Base64_Image__c: formData.base64Image,
    };
    Object.entries(optionalFields).forEach(([key, value]) => {
      if (value !== undefined && value !== "") payload[key] = value;
    });
    return payload;
  };

  const saveAllowance = async (status) => {
    if (status === "Pending" && !validate()) return;
    const ok = await checkInternet();
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = buildPayload(status);
      const response = editingAllowance?.Id
        ? await apiFetch("PATCH", `sobjects/Allowance_Claim__c/${editingAllowance.Id}`, payload, "SObjects")
        : await apiFetch("POST", "sobjects/Allowance_Claim__c", payload, "SObjects");
      console.log("Allowance save response:", response);
      if (response.status === "success") {
        dispatch(showToast({
          message: editingAllowance?.Id
            ? `${allowanceType} ${status === "Draft" ? "draft saved" : "submitted"} successfully!`
            : `${allowanceType} ${status === "Draft" ? "saved as draft" : "submitted"} successfully!`,
          type: "success",
        }));
        setShowForm(false);
        setEditingAllowance(null);
        resetForm();
        fetchAllowances();
      } else {
        dispatch(showToast({
          message: response.message || `Failed to save ${allowanceType.toLowerCase()}`,
          type: "error",
        }));
      }
    } catch (err) {
      console.error("Allowance save error:", err);
      dispatch(showToast({
        message: err?.response?.data?.message || err?.message || `Failed to save ${allowanceType.toLowerCase()}`,
        type: "error",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    await saveAllowance("Pending");
  };

  const handleSaveDraft = async () => saveAllowance("Draft");

  const editDraft = (item) => {
    setEditingAllowance(item);
    setFormData({
      expenseType: item.Expense_Type__c || "",
      totalAmount: item.Total_Amount__c != null ? String(item.Total_Amount__c) : "",
      timePeriod: item.Time_Period__c || "",
      comment: item.Comment__c || "",
      base64Image: item.Base64_Image__c || "",
    });
    setErrors({});
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      expenseType: "",
      totalAmount: "",
      timePeriod: "",
      comment: "",
      base64Image: "",
    });
    setErrors({});
  };

  const handleChange = (field, value) => {
    let sanitized = value;
    if (field === "totalAmount") {
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

  const handlePickImage = () => {
    setShowImagePickerModal(true);
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
        console.warn("Camera permission request error:", err);
        return false;
      }
    }
    return true;
  };

  const handleCameraPress = async () => {
    setShowImagePickerModal(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setTimeout(() => {
        Alert.alert(
          "Camera Permission Denied",
          "Camera permission is required to take photos. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            ...(Platform.OS === "android"
              ? []
              : [{ text: "Open Settings", onPress: () => {} }]),
          ],
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
          selectionLimit: 0,
          cameraType: "back",
        },
        handleImageResponse,
      );
    }, 300);
  };

  const handleGalleryPress = () => {
    setShowImagePickerModal(false);
    setTimeout(() => {
      launchImageLibrary(
        {
          mediaType: "photo",
          includeBase64: true,
          quality: 0.3,
          maxWidth: 800,
          maxHeight: 800,
          selectionLimit: 0,
        },
        handleImageResponse,
      );
    }, 300);
  };

  const handleImageResponse = (response) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert("Error", response.errorMessage || "Failed to pick image");
      return;
    }
    if (response.assets && response.assets.length > 0) {
      const assets = response.assets;
      if (assets.some((asset) => asset.base64 && asset.base64.length > 131000)) {
        Alert.alert(
          "Image Too Large",
          "Please choose a smaller image or reduce quality.",
        );
        return;
      }
      const images = [...parseImages(formData.base64Image), ...assets.map((asset) => asset.base64).filter(Boolean)];
      handleChange("base64Image", serializeImages(images));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "#2E7D5B";
      case "Rejected":
        return "#C8102E";
      case "Pending":
        return "#D08C1F";
      default:
        return "#7A7266";
    }
  };

  const renderSearchAndFilter = () => (
    <View style={styles.searchFilterRow}>
      <View style={styles.searchBox}>
        <Feather
          name="search"
          size={18}
          color="#7A7266"
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by user name..."
          placeholderTextColor="#7A7266"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Feather name="x-circle" size={18} color="#7A7266" />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.filterIconBtn,
          selectedStatus !== "All" && styles.filterIconActive,
        ]}
        onPress={() => {
          setTempStatus(selectedStatus);
          setShowFilterModal(true);
        }}
      >
        <Feather
          name="filter"
          size={20}
          color={selectedStatus !== "All" ? "#fff" : "#C9A24D"}
        />
      </TouchableOpacity>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                { paddingBottom: 20 + insets.bottom },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Feather name="x" size={22} color="#1F1D1A" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Status</Text>
                  <Dropdown
                    data={STATUS_OPTIONS}
                    labelField="label"
                    valueField="value"
                    search
                    searchPlaceholder="Search..."
                    style={styles.modalDropdown}
                    containerStyle={styles.modalDropdownContainer}
                    placeholderStyle={styles.modalPlaceholder}
                    selectedTextStyle={styles.modalSelectedText}
                    placeholder="Select Status"
                    value={tempStatus}
                    onChange={(item) => setTempStatus(item.value)}
                    dropdownPosition="top"
                  />
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  setSelectedStatus(tempStatus);
                  setShowFilterModal(false);
                }}
              >
                <LinearGradient
                  colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
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
          <Text style={styles.cardTitle}>{item.Allowance_Type__c || "-"}</Text>
          <Text style={styles.cardUserName}>{item.User__r?.Name || "-"}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.Status__c) + "20" },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(item.Status__c) },
            ]}
          >
            {item.Status__c || "Pending"}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        {item.Name ? (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Claim Number</Text>
            <Text
              style={[styles.cardValue, { fontWeight: "700", color: "#1F1D1A" }]}
            >
              {item.Name}
            </Text>
          </View>
        ) : null}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Amount</Text>
          <Text
            style={[styles.cardValue, { fontWeight: "700", color: "#A67C2E" }]}
          >
            {item.Total_Amount__c
              ? `₹${Number(item.Total_Amount__c).toLocaleString("en-IN")}`
              : "-"}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Time Period</Text>
          <Text style={styles.cardValue}>{item.Time_Period__c || "-"}</Text>
        </View>
        {item.Comment__c ? (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Comment</Text>
            <Text style={styles.cardValue}>{item.Comment__c}</Text>
          </View>
        ) : null}
        {item.Rejected_Reason__c ? (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Rejected Reason</Text>
            <Text style={[styles.cardValue, { color: "#C8102E" }]}>
              {item.Rejected_Reason__c}
            </Text>
          </View>
        ) : null}
        {parseImages(item.Base64_Image__c).length > 0 ? (
          <View style={[styles.cardRow, { alignItems: "center" }]}>
            <Text style={styles.cardLabel}>Attached Image</Text>
            <View style={styles.cardImages}>
              {parseImages(item.Base64_Image__c).slice(0, expandedImageClaims[item.Id] ? undefined : 1).map((image, index) => (
                <TouchableOpacity key={index} onPress={() => setFullscreenImage(image)}>
                  <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.cardImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
              {parseImages(item.Base64_Image__c).length > 1 && (
                <TouchableOpacity
                  style={styles.seeAllImagesButton}
                  onPress={() => setExpandedImageClaims((previous) => ({ ...previous, [item.Id]: !previous[item.Id] }))}
                >
                  <Text style={styles.seeAllImagesText}>
                    {expandedImageClaims[item.Id] ? "Hide images" : `See all ${parseImages(item.Base64_Image__c).length} images`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
        {item.Status__c === "Draft" && (
          <TouchableOpacity style={styles.editDraftBtn} onPress={() => editDraft(item)}>
            <Feather name="edit-2" size={15} color="#C9A24D" />
            <Text style={styles.editDraftText}>Edit Draft</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderForm = () => {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 50 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Allowance Type - Fixed */}
          <View style={styles.formCard}>
            {!isDailyAllowance && <Text style={styles.formHint}>Assigned Travel Allowance: {assignedTA != null ? `₹${assignedTA}` : (taConfigError || "Loading...")}</Text>}
            <Text style={styles.formLabel}>
              Allowance Type <Text style={{ color: "red" }}>*</Text>
            </Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{allowanceType}</Text>
            </View>
          </View>

          {/* Expense Type - Text Input */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>
              Expense Type <Text style={{ color: "red" }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.expenseType}
              onChangeText={(val) => handleChange("expenseType", val)}
              placeholder="Enter Expense Type"
              placeholderTextColor="#999"
            />
            {errors.expenseType && (
              <Text style={styles.error}>{errors.expenseType}</Text>
            )}
          </View>

          {/* Total Amount - Number with decimal */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>
              Total Amount <Text style={{ color: "red" }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.totalAmount}
              onChangeText={(val) => handleChange("totalAmount", val)}
              placeholder="Enter Amount"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            {errors.totalAmount && (
              <Text style={styles.error}>{errors.totalAmount}</Text>
            )}
          </View>

          {/* Time Period - Date Picker */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>
              Time Period <Text style={{ color: "red" }}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text
                style={[
                  styles.dateText,
                  !formData.timePeriod && { color: "#999" },
                ]}
              >
                {formData.timePeriod
                  ? moment(formData.timePeriod, "YYYY-MM-DD").format(
                      "DD/MM/YYYY",
                    )
                  : "DD/MM/YYYY"}
              </Text>
              <Feather name="calendar" size={18} color="#7A7266" />
            </TouchableOpacity>
            {errors.timePeriod && (
              <Text style={styles.error}>{errors.timePeriod}</Text>
            )}
          </View>

          {/* Comment - Text Area */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>
              Comment <Text style={{ color: "red" }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={formData.comment}
              onChangeText={(val) => handleChange("comment", val)}
              placeholder="Enter Comment"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />
            {errors.comment && (
              <Text style={styles.error}>{errors.comment}</Text>
            )}
          </View>

          {/* Base64 Image - Bill Upload */}
          <View style={styles.formCard}>
            <View style={styles.imageLabelRow}>
              <Text style={styles.formLabel}>
                Bill Image {imageRequired && <Text style={{ color: "red" }}>*</Text>}
              </Text>
              {imageRequired && <Text style={styles.requiredHint}>Required</Text>}
            </View>
            <Text style={styles.imageRequirementText}>
              {imageRequired
                ? "Claimed amount exceeds assigned allowance. Add at least one image."
                : "Optional unless the claimed amount exceeds the assigned allowance."}
            </Text>
            <TouchableOpacity
              style={styles.imagePickerBtn}
              onPress={handlePickImage}
            >
              {parseImages(formData.base64Image).length > 0 ? (
                <View style={styles.imageGrid}>
                  {parseImages(formData.base64Image).map((image, index) => (
                    <View key={index} style={styles.imageTile}>
                      <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.imagePreview} resizeMode="cover" />
                      <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                        <MIcon name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.addImageTile}>
                    <Feather name="plus" size={24} color="#A67C2E" />
                    <Text style={styles.addImageText}>Add image</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Feather name="camera" size={32} color="#7A7266" />
                  <Text style={styles.imagePlaceholderText}>
                    Tap to upload bill
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {errors.base64Image && (
              <Text style={styles.error}>{errors.base64Image}</Text>
            )}
          </View>
        </ScrollView>

        {!keyboardVisible && (
          <View
            style={[
              styles.submitBtnWrapper,
              { paddingBottom: insets.bottom + 14 },
            ]}
          >
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
                  {submitting ? "Submitting..." : "Submit"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.draftBtn}
              onPress={handleSaveDraft}
              disabled={submitting}
            >
              <Text style={styles.draftBtnText}>{submitting ? "Saving..." : "Save as Draft"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Custom calendar-grid date picker */}
        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelectDate={(date) => handleChange("timePeriod", date)}
          selectedDate={formData.timePeriod}
          maxDate={null}
          title="Select Date"
        />
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        <HeaderMain screenName={`${allowanceType}`} />
      </View>

      <View style={styles.contentContainer}>
        {!showForm ? (
          <>
            {renderSearchAndFilter()}
            {renderFilterModal()}
            <FlatList
              data={filteredAllowances}
              keyExtractor={(item, index) => item.Id || index.toString()}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 100 + insets.bottom },
                filteredAllowances.length === 0 && { flex: 1 },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="file-text" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>
                      No {allowanceType.toLowerCase()}s found
                    </Text>
                  </View>
                ) : null
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
            {!isDailyAllowance && (
              <TouchableOpacity
                style={[styles.fab, { bottom: insets.bottom + 30 }]}
                onPress={() => {
                  resetForm();
                  if (!isDailyAllowance && assignedTA != null) setFormData((prev) => ({ ...prev, totalAmount: String(assignedTA) }));
                  setEditingAllowance(null);
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
            )}
          </>
        ) : (
          renderForm()
        )}
      </View>

      <LoaderOverlay
        visible={loading || submitting}
        message={submitting ? "Submitting..." : "Loading..."}
      />

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
          <View style={styles.imagePickerOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.imagePickerSheet,
                  { paddingBottom: 20 + insets.bottom },
                ]}
              >
                <View style={styles.imagePickerHandle} />
                <View style={styles.imagePickerHeaderRow}>
                  <View style={styles.imagePickerHeaderCenter}>
                    <Text style={styles.imagePickerTitle}>Upload Bill</Text>
                    <Text style={styles.imagePickerSubtitle}>
                      Choose an option
                    </Text>
                  </View>
                </View>
                <View style={styles.imagePickerHeaderBorder} />

                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={handleCameraPress}
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

                <View style={styles.imagePickerDivider} />

                <TouchableOpacity
                  style={styles.imagePickerOption}
                  onPress={handleGalleryPress}
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

      <Modal
        visible={!!fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={[styles.fullscreenClose, { top: insets.top + 20 }]}
            onPress={() => setFullscreenImage(null)}
          >
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: `data:image/jpeg;base64,${fullscreenImage}` }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
};

const ClaimTravelAllowanceScreen = (props) => (
  <SafeAreaProvider>
    <ClaimTravelAllowance {...props} />
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#A67C2E",
  },
  headerContainer: {
    backgroundColor: "#A67C2E",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#FBF8F1",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "#F1EADB",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1F1D1A",
    padding: 0,
  },
  filterIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F1EADB",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  filterIconActive: {
    backgroundColor: "#C9A24D",
    borderColor: "#C9A24D",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: Dimensions.get("window").height * 0.5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  modalField: {
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F1D1A",
    marginBottom: 8,
  },
  modalDropdown: {
    height: 46,
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1EADB",
    paddingHorizontal: 12,
  },
  modalDropdownContainer: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1EADB",
  },
  modalPlaceholder: {
    fontSize: 13,
    color: "#7A7266",
  },
  modalSelectedText: {
    fontSize: 13,
    color: "#1F1D1A",
    fontWeight: "500",
  },
  applyBtn: {
    marginTop: 10,
    height: 48,
  },
  applyBtnInner: {
    flex: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
    flex: 1,
  },
  cardClaimNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A67C2E",
    marginTop: 2,
  },
  cardUserName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#7A7266",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardBody: {
    padding: 14,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 12,
    color: "#7A7266",
    fontWeight: "500",
  },
  cardValue: {
    fontSize: 12,
    color: "#1F1D1A",
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 12,
  },
  imageContainer: {
    marginTop: 8,
  },
  cardImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#F1EADB",
  },
  cardImages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
    marginLeft: 8,
  },
  seeAllImagesButton: {
    minHeight: 50,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#F1C4CB",
    backgroundColor: "#FFF7F8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  seeAllImagesText: {
    color: "#A67C2E",
    fontSize: 11,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    shadowColor: "#C9A24D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  formScroll: {
    padding: 16,
  },
  formCard: {
    backgroundColor: "#fff",
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  formLabel: {
    fontSize: 12,
    color: "#1F1D1A",
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F1EADB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 13,
    color: "#1F1D1A",
  },
  readOnlyInput: {
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#F1EADB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  readOnlyText: {
    fontSize: 13,
    color: "#1F1D1A",
    fontWeight: "500",
  },
  dateInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F1EADB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  dateText: {
    fontSize: 13,
    color: "#1F1D1A",
  },
  imageLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  formHint: {
    color: "#7A7266",
    fontSize: 12,
    marginBottom: 8,
  },
  requiredHint: {
    color: "#C8102E",
    fontSize: 11,
    fontWeight: "600",
  },
  imageRequirementText: {
    color: "#7A7266",
    fontSize: 11,
    marginBottom: 8,
  },
  imagePickerBtn: {
    borderWidth: 1,
    borderColor: "#F1EADB",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  imagePlaceholder: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: "#7A7266",
    marginTop: 8,
  },
  imagePreview: {
    width: 92,
    height: 92,
    borderRadius: 8,
  },
  imageTile: {
    position: "relative",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  addImageTile: {
    width: 92,
    height: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#A67C2E",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7F8",
  },
  addImageText: {
    color: "#A67C2E",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  error: {
    color: "#C8102E",
    fontSize: 11,
    marginTop: 4,
  },
  submitBtnWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FBF8F1",
    borderTopWidth: 1,
    borderTopColor: "#F1EADB",
  },
  submitBtn: {
    height: 50,
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
  draftBtn: {
    height: 46,
    marginTop: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#C9A24D",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  draftBtnText: {
    color: "#A67C2E",
    fontSize: 15,
    fontWeight: "600",
  },
  editDraftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#F0F1F5",
  },
  editDraftText: {
    color: "#A67C2E",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  calendarSheet: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    width: "100%",
    maxHeight: "80%",
  },
  calendarSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  calendarSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  calendarNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F5",
  },
  calendarWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7266",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  calendarDayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarDaySelected: {
    backgroundColor: "#C9A24D",
    shadowColor: "#C9A24D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  calendarDayToday: {
    backgroundColor: "#F1EADB",
    borderWidth: 1.5,
    borderColor: "#C9A24D",
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F1D1A",
  },
  calendarDayTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  calendarDayTextToday: {
    color: "#A67C2E",
    fontWeight: "700",
  },
  calendarDayTextDisabled: {
    color: "#D9D2C3",
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
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
    marginBottom: 16,
  },
  imagePickerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  imagePickerHeaderCenter: {
    flex: 1,
    alignItems: "center",
  },
  imagePickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F1F5",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerHeaderBorder: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginBottom: 16,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F1D1A",
    textAlign: "center",
  },
  imagePickerSubtitle: {
    fontSize: 13,
    color: "#7A7266",
    textAlign: "center",
    marginTop: 2,
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
  imagePickerDivider: {
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
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenClose: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.8,
  },
});

export default ClaimTravelAllowanceScreen;
