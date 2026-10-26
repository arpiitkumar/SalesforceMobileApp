import React, { useState, useEffect } from "react";
import {
  Modal,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "@react-native-vector-icons/feather";
import moment from "moment";
import { useSelector } from "react-redux";
import ToastModal from "./ToastModal";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import {
  buildSyncFields,
  extractApiErrorMessage,
} from "../../utils/sync/syncStatus";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../../utils/networkUtils";
import { getCurrentLocation } from "../../utils/getCurrentLocation";
import { getAddressFromCoords } from "../../utils/reverseGeocode";
import { useDispatch } from "react-redux";
import { setSelectedVisit } from "../../redux/slices/selectedVisitSlice";
import { clearCheckInStatus } from "../../redux/slices/checkInSlice";
import { showToast } from "../../redux/slices/toastSlice.js";
import LoaderOverlay from "../../utils/helper/LoaderOverlay";
import { useNavigation } from "@react-navigation/native";
import { Dropdown } from "react-native-element-dropdown";
import getDistanceInKm from "../../utils/helper/GetDistance";
import { syncVisitRecord } from "../../database/dbService/AllDataSync";
import { isDistributorAccount } from "../../utils/distributorHelper";

const MIN_VISIT_DURATION_MINUTES = 2;

const DEFAULT_NON_PRODUCTIVE_REASONS = [
  { label: "Stock Available", value: "Stock Available" },
  { label: "Shop Closed", value: "Shop Closed" },
  { label: "Owner Not Available", value: "Owner Not Available" },
  { label: "Payment Issue / Overdue", value: "Payment Issue / Overdue" },
  { label: "Price / Margin Issue", value: "Price / Margin Issue" },
  { label: "Competitor Schemes", value: "Competitor Schemes" },
  { label: "Spot Sales Already Placed with Distributor", value: "Order Already Placed with Distributor" },
  { label: "Delivery Pending", value: "Delivery Pending" },
  { label: "Others", value: "Others" },
];

const CheckOut = ({
  visible,
  onClose,
  outlet,
  selectedDate,
  categorizedData = {},
}) => {
  const date = moment().format("YYYY-MM-DD");
  const displayDate = moment().format("DD MMMM YYYY");
  const [location, setLocation] = useState("");
  // console.log("SELECTED OUTLET===========================", outlet)
  const navigation = useNavigation();

  const dispatch = useDispatch();
  const selectedVisit = useSelector((state) => state.selectedVisit); // Redux se
  const userId = useSelector((state) => state.auth.userId);
  const { handleLogout, apiFetch, apiComposite } = useApiFetch();
  const [reasonModalVisible, setReasonModalVisible] = useState(false);

  const isDistributor = isDistributorAccount(outlet) || isDistributorAccount(selectedVisit);

  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [options, setOptions] = useState(DEFAULT_NON_PRODUCTIVE_REASONS);
  const [selectedReasonForNoOrder, setSelectedReasonForNoOrder] = useState("");

  const [latitudeState, setLatitudeState] = useState("");
  const [longitudeState, setLongitudeState] = useState("");

  const [users, setUsers] = useState([]);
  const [hasTodayOrder, sethasTodayOrder] = useState(false);

  // At checkout the current visit is in "Check In". It is the last call of
  // the day only when there are no remaining planned visits in "Upcoming".
  // This works from the locally stored daily visit list, so it is available
  // even without internet access.
  const isLastCallOfToday = () =>
    (categorizedData?.Upcoming || []).length === 0;

  const checkHasOrderForVisit = async () => {
    try {
      const ordersRaw = await UniversalUpdateInsert({
        ObjectName: "Order",
        Type: "get",
      });

      if (!Array.isArray(ordersRaw) || ordersRaw.length === 0) {
        sethasTodayOrder(false);
        return false;
      }

      const visitSfId =
        outlet?.sfId ||
        outlet?.Sf_Id ||
        outlet?.Id ||
        selectedVisit?.sfId ||
        selectedVisit?.Sf_Id;
      const accountId =
        outlet?.AccountId ||
        outlet?.accountId ||
        selectedVisit?.AccountId ||
        selectedVisit?.accountId;
      const today = moment().startOf("day");

      // Filter out sales return orders
      const validOrders = ordersRaw.filter((ord) => {
        const value = ord.TypeOfReturn__c || ord.typeOfReturn__c;
        return value === "" || value == null;
      });

      const hasOrder = validOrders.some((ord) => {
        const ordVisitId = ord.Visit__c || ord.visit;
        const ordAccountId = ord.AccountId || ord.accountId;

        // 1. Direct Visit match
        if (
          visitSfId &&
          ordVisitId &&
          String(ordVisitId).toLowerCase() === String(visitSfId).toLowerCase()
        ) {
          return true;
        }

        // 2. Account + Today match
        if (
          accountId &&
          ordAccountId &&
          String(ordAccountId).toLowerCase() === String(accountId).toLowerCase()
        ) {
          const dateStr =
            ord.OrderSubmissionTime__c ||
            ord.orderSubmissionTime ||
            ord.CreatedDate ||
            ord.effectiveDate ||
            ord.EffectiveDate;
          if (dateStr) {
            const orderDate = moment(dateStr).local().startOf("day");
            if (orderDate.isSame(today, "day")) {
              return true;
            }
          }
        }
        return false;
      });

      sethasTodayOrder(hasOrder);
      return hasOrder;
    } catch (err) {
      console.error("Error checking orders for visit:", err);
      sethasTodayOrder(false);
      return false;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        await checkHasOrderForVisit();

        const usersResult = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        setUsers(usersResult || []);

        const picklistResult = await UniversalUpdateInsert({
          ObjectName: "AllDataPicklist",
          Type: "get",
        });

        if (picklistResult?.length) {
          try {
            const parsedOptions = JSON.parse(picklistResult[0].OptionsData);
            if (
              Array.isArray(parsedOptions?.NonProductiveCallReason) &&
              parsedOptions.NonProductiveCallReason.length > 0
            ) {
              setOptions(parsedOptions.NonProductiveCallReason);
            } else {
              setOptions(DEFAULT_NON_PRODUCTIVE_REASONS);
            }
          } catch (pe) {
            setOptions(DEFAULT_NON_PRODUCTIVE_REASONS);
          }
        } else {
          setOptions(DEFAULT_NON_PRODUCTIVE_REASONS);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    initialize();
  }, []);

  const getTimeSpentOnOutlet = async (sfId) => {
    try {
      const visitData = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [{ field: "Sf_Id", value: sfId }],
      });

      const checkInTime = visitData?.[0]?.CheckInTime__c;
      if (!checkInTime) return "0";

      let time = checkInTime;
      if (typeof time === "string") {
        time = time.replace(/^"+|"+$/g, "");
        time = time.replace(/(\+\d{2})(\d{2})$/, "$1:$2");
      }

      const checkInMs = new Date(time).getTime();
      if (isNaN(checkInMs)) return "0";

      const diffMin = (Date.now() - checkInMs) / 60000;
      return String(Math.round(diffMin));
    } catch (e) {
      console.error("Error calculating time spent on outlet:", e);
      return "0";
    }
  };

  const parseVisitDateTime = (value) => {
    if (!value) return null;

    let time = value;
    if (typeof time === "string") {
      time = time.replace(/^"+|"+$/g, "");
      time = time.replace(/(\+\d{2})(\d{2})$/, "$1:$2");
    }

    const parsedTime = new Date(time).getTime();
    return isNaN(parsedTime) ? null : parsedTime;
  };

  const getVisitElapsedMinutes = async (sfId) => {
    const visitData = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "get",
      filters: [{ field: "Sf_Id", value: sfId }],
    });

    const checkInMs = parseVisitDateTime(visitData?.[0]?.CheckInTime__c);
    if (!checkInMs) return null;

    return (Date.now() - checkInMs) / 60000;
  };

  // Seconds left before check-out is allowed (counts down from check-in time).
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!visible || !outlet?.sfId) return;

    let timer = null;
    let cancelled = false;

    const startCountdown = async () => {
      try {
        const visitData = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [{ field: "Sf_Id", value: outlet.sfId }],
        });
        const checkInMs = parseVisitDateTime(visitData?.[0]?.CheckInTime__c);
        // No check-in time available: do not block check-out.
        if (cancelled || !checkInMs) return;

        const tick = () => {
          const left = Math.ceil(
            (checkInMs + MIN_VISIT_DURATION_MINUTES * 60000 - Date.now()) / 1000,
          );
          setRemainingSeconds(left > 0 ? left : 0);
          if (left <= 0 && timer) {
            clearInterval(timer);
            timer = null;
          }
        };
        tick();
        timer = setInterval(tick, 1000);
      } catch (e) {
        console.error("Error starting check-out countdown:", e);
      }
    };

    startCountdown();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [visible, outlet?.sfId]);

  const formatRemaining = (secs) =>
    `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const validateMinimumVisitDuration = async () => {
    const elapsedMinutes = await getVisitElapsedMinutes(outlet?.sfId);

    if (elapsedMinutes === null) {
      showToastvisible(
        "error",
        "Check-in time not found. Please sync or check in again before check-out.",
      );
      return false;
    }

    if (elapsedMinutes < MIN_VISIT_DURATION_MINUTES) {
      const remainingMinutes = Math.ceil(
        MIN_VISIT_DURATION_MINUTES - elapsedMinutes,
      );
      showToastvisible(
        "error",
        `You must spend at least ${MIN_VISIT_DURATION_MINUTES} minutes on this visit before check-out. Please wait ${remainingMinutes} more minute${
          remainingMinutes > 1 ? "s" : ""
        }.`,
      );
      return false;
    }

    return true;
  };

  const submitToApi = async (
    currentLat = latitudeState,
    currentLon = longitudeState,
  ) => {
    try {
      const visitPayload = {
        CheckOutTime__c: getISTISOString(),
        PlannedVisitEndTime__c: getISTISOString(),
        // CheckOutLocation__c: location, // Note: Geolocation compound field CheckOutLocation__c is read-only in REST API. Write to constituent components CheckOutLocation__Latitude__s and CheckOutLocation__Longitude__s instead.
        VisitStatus__c: "Check Out",
        LastCallVisit__c: isLastCallOfToday(),
        CheckOutLocation__Longitude__s: Number(currentLon) || 0,
        CheckOutLocation__Latitude__s: Number(currentLat) || 0,
        NonProductiveCallReason__c: !isDistributor && !hasTodayOrder ? selectedReasonForNoOrder || null : null,
        Appropriate_Call__c: await checkCallTiming(
          outlet?.sfId,
          "Appropriate_Call__c",
        ),
        Inappropriate_Call__c: await checkCallTiming(
          outlet?.sfId,
          "Inappropriate_Call__c",
        ),
        Postman_Call__c: await checkCallTiming(outlet?.sfId, "Postman_Call__c"),
      };

      console.log(
        "📤 Standard API: Patching Visit__c for Check-Out:",
        outlet.sfId,
        visitPayload,
      );
      const response = await apiFetch(
        "PATCH",
        `sobjects/Visit__c/${outlet.sfId}`,
        visitPayload,
        "SObjects",
      );
      console.log("📥 Visit Check-Out Response:", response);

      if (response && response.status === "success") {
        console.log("Visit Check-Out API success");
        return { success: true, attempted: true, errorMsg: null };
      } else {
        const errorMsg =
          extractApiErrorMessage(response, null) ||
          "Failed to check out via Standard API";
        console.error(
          "❌ Visit Check-Out Failed details:",
          JSON.stringify(response),
        );
        alert("Check Out Failed:\n" + errorMsg);
        return { success: false, attempted: true, errorMsg };
      }
    } catch (err) {
      console.error("Error in Standard API check-out:", err);
      alert("Error during check-out: " + (err?.message || err));
      return {
        success: false,
        attempted: true,
        errorMsg: err?.message || "Standard API check-out error",
      };
    }
  };

  const saveLocally = async (
    apiResult: {
      success: boolean;
      attempted?: boolean;
      errorMsg?: string | null;
    } = { success: false },
    currentLat = latitudeState,
    currentLon = longitudeState,
  ) => {
    // const { latitude, longitude } = await getCurrentLocation();
    const apiSuccess = !!apiResult.success;
    const timeSpent = await getTimeSpentOnOutlet(outlet?.sfId);
    const payload = {
      Sf_Id: outlet.sfId,
      CheckOutTime__c: getISTISOString(),
      PlannedVisitEndTime__c: getISTISOString(),
      TimeSpentOnOutlet__c: timeSpent,
      CheckOutLocation__c: location,
      VisitStatus__c: "Check Out",
      LastCallVisit__c: isLastCallOfToday(),
      CheckOutLocation__Latitude__s: currentLat,
      CheckOutLocation__Longitude__s: currentLon,
      NonProductiveCallReason__c: !isDistributor && !hasTodayOrder ? selectedReasonForNoOrder || null : null,
      Appropriate_Call__c: await checkCallTiming(
        outlet?.sfId,
        "Appropriate_Call__c",
      ),
      Inappropriate_Call__c: await checkCallTiming(
        outlet?.sfId,
        "Inappropriate_Call__c",
      ),
      Postman_Call__c: await checkCallTiming(outlet?.sfId, "Postman_Call__c"),
      is_locally_changed: true,
      operation_type: "insert",
      last_modified: Date.now(),
      ...buildSyncFields({
        apiSuccess,
        attempted: !!apiResult.attempted,
        errorMsg: apiResult.errorMsg,
      }),
    };

    const inserted = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "insert",
      data: payload,
    });

    if (inserted) {
      console.log("local successful...");
      showToastvisible("success", "CheckOut Successfully");
      return true;
    } else {
      console.log("local save failed...");
      showToastvisible("error", "Failed to save CheckOut.");
      return false;
    }
  };

  const distanceCounterAccount = async () => {
    const { latitude, longitude } = await getCurrentLocation();
    // console.log("latitude current", latitude);
    // console.log("longitude current", longitude);
    if (outlet?.BillingLatitude && outlet?.BillingLongitude) {
      const distance = getDistanceInKm(
        latitude,
        longitude,
        outlet?.BillingLatitude,
        outlet?.BillingLongitude,
      );
      // console.log(
      //     "Distance from Account location:",
      //     distance.toFixed(2),
      //     "km"
      // );
      return distance;
    }
    return 0;
  };
  const isValidCoordinate = (val) => {
    if (val === null || val === undefined || val === "") return false;
    const num = Number(val);
    if (isNaN(num)) return false;
    return num !== 0;
  };

  const checkCallTiming = async (sfId, fieldName) => {
    const visitData = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "get",
      filters: [{ field: "Sf_Id", value: sfId }],
    });

    const checkInTime = visitData?.[0]?.CheckInTime__c;

    if (!checkInTime || !fieldName) return false;

    let time = checkInTime;

    if (typeof time === "string") {
      time = time.replace(/^"+|"+$/g, "");
      time = time.replace(/(\+\d{2})(\d{2})$/, "$1:$2");
    }

    const checkInMs = new Date(time).getTime();

    if (isNaN(checkInMs)) return false;

    const diffMin = (Date.now() - checkInMs) / 60000;

    console.log("diffMin =>", diffMin);

    if (fieldName === "Postman_Call__c") {
      return diffMin <= 1;
    }

    if (fieldName === "Inappropriate_Call__c") {
      return diffMin > 1 && diffMin <= 3;
    }

    if (fieldName === "Appropriate_Call__c") {
      return diffMin > 3;
    }

    return false;
  };

  const getISTISOString = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC +5:30
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().replace("Z", "+05:30");
  };

  const handleCheckoutSubmit = async () => {
    if (remainingSeconds > 0) return;
    setLoading(true);
    let lat = latitudeState;
    let lon = longitudeState;

    // const minimumVisitDurationValid = await validateMinimumVisitDuration();
    // if (!minimumVisitDurationValid) {
    //   setLoading(false);
    //   return;
    // }

    if (!lat || !lon) {
      try {
        const coords = await getCurrentLocation();
        lat = coords.latitude;
        lon = coords.longitude;
        setLatitudeState(lat);
        setLongitudeState(lon);
        setLocation(`Lat: ${lat}, Long: ${lon}`);
      } catch (error) {
        console.warn("Location fetch failed on submit:", error);
        showToastvisible(
          "warning",
          "Location is turned off. Turn it on to continue with check-out.",
        );
        setLoading(false);
        return;
      }
    }

    // if (outlet.Add_New_Retailer_Visit__c === false) {
    //     if (!isValidCoordinate(outlet.BillingLatitude) || !isValidCoordinate(outlet.BillingLongitude)) {
    //         showToastvisible(
    //             'warning',
    //             'Outlet does not have valid lat long. You cannot check out.'
    //         );
    //         return;
    //     }
    // }

    const distanceInKm = await distanceCounterAccount();
    const distanceInMeter = distanceInKm * 1000;

    // if ((users[0]?.DeveloperName === 'MT_Merchandiser' || users[0]?.DeveloperName === 'MT_SO') && distanceInMeter > 200) {
    //     showToastvisible(
    //         'warning',
    //         'Your check-out location is more than 200 meters away from the outlet location. You cannot check out.'
    //     );
    //     return;
    // }

    if (!isDistributor && !hasTodayOrder && !selectedReasonForNoOrder) {
      showToastvisible("warning", "Please select a reason for not taking spot sales.");
      setLoading(false);
      return;
    }

    try {
      const connected = await isInternetAvailable();

      let apiResult: {
        success: boolean;
        attempted: boolean;
        errorMsg: string | null;
      } = { success: false, attempted: false, errorMsg: null };
      if (connected) {
        await syncVisitRecord(apiFetch, apiComposite);
        apiResult = await submitToApi(lat, lon);
        if (!apiResult.success) {
          console.log("API failed...");
        }
      }
      //   return;
      const localSuccess = await saveLocally(apiResult, lat, lon);
      if (localSuccess) {
        const updatedVisit = {
          ...(selectedVisit || {}),
          VisitStatus__c: "Check Out",
        };
        dispatch(setSelectedVisit(updatedVisit));
        dispatch(clearCheckInStatus());
        const GETDATA = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
        });
        const targetDate = "2025-07-10";
        const filteredVisits = GETDATA.filter(
          (item) => item.VisitDate__c === targetDate,
        );

        onClose();
      }
      showToastvisible("success", "Checkout Successful.");
      users[0]?.DeveloperName === "H_T_SO"
        ? navigation.navigate("BeatPlanningForActivity")
        : navigation.navigate("TabbedScreen", { defaultTab: "Beat Plan" });
      // users[0]?.DeveloperName === 'H_T_SO' ? navigation.navigate('BeatPlanningForActivity') : navigation.navigate('TabbedScreen')
    } catch (error) {
      setLoading(false);
      console.error(" Attendance error:", error);
      showToastvisible("error", "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const showToastvisible = (type, message) => {
    dispatch(
      showToast({
        message: message,
        type: type, // 'success' | 'error' | 'warning'
      }),
    );
  };

  useEffect(() => {
    if (!visible) return;
    const getLocation = async () => {
      try {
        // console.log('heloooooocd')
        const { latitude, longitude } = await getCurrentLocation();
        setLatitudeState(latitude);
        setLongitudeState(longitude);
        setLocation(`Lat: ${latitude}, Long: ${longitude}`);
      } catch (err) {
        console.warn("Error getting location/address:", err);
        setLocation("Location unavailable");
      }
    };

    getLocation();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setSelectedReasonForNoOrder("");
      setReasonModalVisible(false);
      if (!isDistributor) {
        checkHasOrderForVisit();
      } else {
        sethasTodayOrder(true);
      }
    }
  }, [visible, isDistributor, outlet?.sfId, outlet?.AccountId]);

  return (
    <>
      <Modal
        visible={visible}
        statusBarTranslucent={false}
        transparent
        animationType="slide"
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text style={styles.header}>Check-Out</Text>
              <TouchableOpacity onPress={() => onClose()}>
                <Text style={{ fontSize: 28 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtext}>
              System will capture your geo-location.
            </Text>

            <View style={styles.row}>
              <Icon
                name="calendar"
                size={22}
                color="#C9A24D"
                style={styles.icon}
              />
              <View>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.value}>
                  {selectedDate
                    ? moment(selectedDate, "YYYY-MM-DD").format("DD MMM YYYY")
                    : ""}
                </Text>
              </View>
            </View>

            <View style={styles.row}>
              <Icon name="map-pin" size={22} color="red" style={styles.icon} />
              <View>
                <Text style={styles.label}>Current Location</Text>
                <Text style={[styles.value, { width: 260 }]}>{location}</Text>
              </View>
            </View>
            {!isDistributor && !hasTodayOrder && (
              <View style={styles.row}>
                <Icon
                  name="message-circle"
                  size={25}
                  color="#C9A24D"
                  style={styles.icon}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>
                    Reason For No Spot Sales <Text style={{ color: "red" }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.inputField}
                    onPress={() => setReasonModalVisible(true)}
                  >
                    <Text
                      style={{
                        color: selectedReasonForNoOrder ? "#000" : "#999",
                      }}
                    >
                      {selectedReasonForNoOrder || "Select reason"}
                    </Text>

                    <Icon name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <>
              {(() => {
                const isReasonRequired = !isDistributor && !hasTodayOrder;
                const isCheckoutDisabled =
                  loading ||
                  remainingSeconds > 0 ||
                  (isReasonRequired && !selectedReasonForNoOrder);

                return (
                  <TouchableOpacity
                    onPress={handleCheckoutSubmit}
                    disabled={isCheckoutDisabled}
                    style={{ marginTop: 16, opacity: isCheckoutDisabled && !loading ? 0.6 : 1 }}
                  >
                    <LinearGradient
                      colors={
                        isCheckoutDisabled && !loading
                          ? ["#b5b5b5", "#7A7266", "#8e8e8e"]
                          : ["#C9A24D", "#A67C2E", "#C9A24D"]
                      }
                      style={styles.buttonCheckIn}
                    >
                      <Text style={styles.buttonText}>
                        {loading
                          ? "Submitting..."
                          : remainingSeconds > 0
                            ? `Check Out in ${formatRemaining(remainingSeconds)}`
                            : "Check Out"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })()}
            </>
          </View>
        </View>
        <LoaderOverlay visible={loading} message="Submitting check-out..." />

        <Modal visible={reasonModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              {/* HEADER */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Select Reason</Text>
                <TouchableOpacity onPress={() => setReasonModalVisible(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* OPTIONS */}
              <ScrollView showsVerticalScrollIndicator={false}>
                {options.map((item, index) => {
                  const isSelected = selectedReasonForNoOrder === item.value;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => {
                        setSelectedReasonForNoOrder(item.value);
                        setReasonModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>

                      {/* RADIO */}
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected && styles.radioOuterActive,
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Modal>
    </>
  );
};

export default CheckOut;
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 10,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: "#A67C2E",
    marginBottom: 4,
    textAlign: "center",
  },
  subtext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    // textAlign: 'center',
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  icon: {
    marginRight: 14,
  },
  label: {
    fontSize: 13,
    color: "#888",
  },
  value: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginTop: 2,
  },
  button: {
    marginTop: 12,
    borderRadius: 50,
    paddingVertical: 10,
    alignItems: "center",
    width: 50,
    height: 50,
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#C9A24D",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  buttonCheckIn: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    backgroundColor: "#C9A24D",
    justifyContent: "center",
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
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
    fontWeight: "500",
  },
  dropdown: {
    height: 42,
    width: "100%",
    // width: '100%',
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },

  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: "65%",
    paddingBottom: 30,
  },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#A67C2E",
  },

  closeText: {
    fontSize: 22,
    color: "#999",
  },

  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#FBF8F1",
  },

  optionCardSelected: {
    backgroundColor: "#E8F0FF",
    borderWidth: 1,
    borderColor: "#C9A24D",
  },

  optionText: {
    fontSize: 15,
    color: "#333",
  },

  optionTextSelected: {
    color: "#A67C2E",
    fontWeight: "600",
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },

  radioOuterActive: {
    borderColor: "#C9A24D",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#C9A24D",
  },

  inputField: {
    height: 45,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    marginTop: 6,
  },
});
