// src/screens/TabbedScreen.js
import React, { useState, useEffect, useCallback, act } from "react";
//import { getAttendanceForDate } from '../db/actions/beatActions';
import moment from "moment";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import ScreenSwitcher from "./ScreenSwitcher";
import CustomTabBar from "../navigation/CustomTabBar";
import { oauth } from "react-native-force";
import {
  AppState,
  StyleSheet,
  ToastAndroid,
  Modal,
  View,
  ActivityIndicator,
  Text,
} from "react-native";
import Header from "./Header";
import RightDrawerModal from "../navigation/RightDrawerModal";
import AddAttendance from "./modal/AttendanceModal";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { useDispatch } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import { showToast } from "../redux/slices/toastSlice";
import { persistor } from "../redux/store";
import LinearGradient from "react-native-linear-gradient";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import updateReferences from "../database/dbService/updateReferences";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSelectedBeatDay } from "../redux/slices/selectedBeatDaySlice";
import {
  setBeatSelection,
  clearBeatSelection,
} from "../redux/slices/beatSelectionSlice";
import { useFocusEffect } from "@react-navigation/native";
import { loadDynamicConfig } from "../../config";
import { setSearchParam } from "../redux/slices/searchSlice";
import { setRoutePlans } from "../redux/slices/routePlanSlice";
import Spinner from "react-native-spinkit";
import { CLEAR_TABLES } from "../../config";
import StartDayModal from "./StartDayModal";
import { getEffectiveServerDate } from "../utils/sync/serverDateUtils";
import {
  syncAttendanceRecords,
  syncMTExceptionRecord,
  syncGrowthMappingEntryRecord,
  syncBeatDayRecord,
  syncVisitRecord,
  syncOrderRecord,
  syncOrderItemRecord,
  syncCollectionRecord,
  syncCollectionAllocationRecord,
  syncInvoiceRecord,
  syncInvoiceItemRecord,
  syncAccountRecord,
  syncFormJsonecord,
  syncCompetitorRecord,
  syncStockCheckRecord,
  syncSalaryAcknowledgementRecord,
  syncHNTCompetitorPriceRecord,
  syncGamificationTransactionRecord,
} from "../database/dbService/AllDataSync";

import NetInfo from "@react-native-community/netinfo";
import { checkForUpdate, compareVersion } from "./updateService";
import UpdateModal from "./UpdateModal";
import { useRoute } from "@react-navigation/native";
import { handleLogoutService } from "./logoutHandler";
import { syncNotificationsFromServer } from "../utils/notificationSync";

const TabbedScreen = () => {
  const [activeTab, setActiveTab] = useState("Home");
  const reloadKey = useSelector((state) => state.appReload.reloadKey);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [showBeatPlan, setShowBeatPlan] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLeaveAttendance, setIsLeaveAttendance] = useState(false);
  const [isEndDayCompleted, setIsEndDayCompleted] = useState(false);
  const { accessToken, userId, instanceUrl } = useSelector(
    (state: RootState) => state.auth,
  );
  const dispatch = useDispatch();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isAttendanceModalVisible, setAttendanceModalVisible] = useState(false);
  // Kept only for a rejected leave.  Passing this record to the modal makes
  // the next attendance submission update it instead of creating another one.
  const [rejectedLeaveAttendance, setRejectedLeaveAttendance] = useState(null);

  const { handleLogout, fetchRecords, apiFetch, apiComposite } = useApiFetch();

  useEffect(() => {
    const fetchRoutePlan = async () => {
      if (!userId || !accessToken || !instanceUrl) {
        console.log("Missing credentials or user ID for route plan fetch.");
        return;
      }
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const startOfMonth = `${year}-${month}-01`;

        const query = `SELECT Id, Name, Start_Date__c, End_Date__c, Assigned_To__c, Month__c FROM Route_Plans__c WHERE Assigned_To__c = '${userId}' AND Start_Date__c >= ${startOfMonth}`;
        console.log("Fetching Route Plan for user:", userId, "Query:", query);

        const records = await fetchRecords("Route_Plans__c", query);
        console.log("Fetched Route Plan Records:", records);

        if (records && !records.status) {
          dispatch(setRoutePlans(records));
          console.log("SUCCESSFULLY STORED ROUTE PLANS IN REDUX:", records);
        } else {
          console.log("NO ROUTE PLAN RECORDS OR ERROR FETCHING:", records);
        }
      } catch (error) {
        console.error("Error fetching route plans:", error);
      }
    };

    fetchRoutePlan();
  }, [userId, accessToken, instanceUrl]);

  const [showStartDayModal, setShowStartDayModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [updateType, setUpdateType] = useState(null);
  const [storeUrl, setStoreUrl] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");

  const checkUpdate = async () => {
    const data = await checkForUpdate();
    if (!data) return;
    const {
      currentVersion,
      minVersion,
      latestVersion,
      forceUpdate,
      message,
      storeUrl,
    } = data;
    console.log("🔥 Update data:", data);
    // 🔴 RULE 2: MIN VERSION HARD UPDATE (highest priority)
    if (compareVersion(currentVersion, minVersion) < 0) {
      setUpdateType("hard");
      setUpdateMessage(message);
      setStoreUrl(storeUrl);
      return true;
    }
    // 🔴 RULE 1: FORCE UPDATE HARD (only if version not same)
    if (
      forceUpdate === true &&
      compareVersion(currentVersion, latestVersion) < 0
    ) {
      setUpdateType("hard");
      setUpdateMessage(message);
      setStoreUrl(storeUrl);
      return true;
    }
    // 🟡 RULE 3: SOFT UPDATE
    if (compareVersion(currentVersion, latestVersion) < 0) {
      setUpdateType("soft");
      setUpdateMessage(message);
      setStoreUrl(storeUrl);
      return false;
    }
    return false;
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const checkAttendance = async () => {
        try {
          const today = moment().format("YYYY-MM-DD");
          if (!isActive) return;

          const lastSync = await UniversalUpdateInsert({
            ObjectName: "LastSync",
            Type: "get",
          });
          const lastSyncDate = lastSync[0]?.DateTime;
          if (lastSyncDate !== today) {
            setShowStartDayModal(true);
            return;
          }
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });

          if (!isActive) return;

          setUsers(result);
          const userId = result[0]?.Sf_Id;

          const attendanceRecords = await UniversalUpdateInsert({
            ObjectName: "Attendant__c",
            Type: "get",
          });
          if (!isActive) return;

          const todayAttendanceRecords = (attendanceRecords || []).filter(
            (record) => record.AttendanceDate__c === today,
          );
          const userTodayAttendance = todayAttendanceRecords.filter(
            (record) => record.User__c === userId,
          );
          const rejectedLeaveRecord = userTodayAttendance.find(
            (record) =>
              (record.AttendanceStatus__c === "Leave" &&
                String(record.Approval_Status__c || "")
                  .trim()
                  .toLowerCase() === "rejected") ||
              record.AttendanceStatus__c === "Leave Rejected",
          );

          if (rejectedLeaveRecord) {
            setRejectedLeaveAttendance(rejectedLeaveRecord);
            setAttendanceModalVisible(true);
          } else if (userTodayAttendance.length === 0) {
            setRejectedLeaveAttendance(null);
            setAttendanceModalVisible(true);
          } else {
            setRejectedLeaveAttendance(null);
            setAttendanceModalVisible(false);
          }

          const hasLeaveAttendance = userTodayAttendance.some(
            (record) =>
              record.AttendanceStatus__c === "Leave" ||
              record.AttendanceStatus__c === "Pending",
          );
          setIsLeaveAttendance(hasLeaveAttendance && !rejectedLeaveRecord);
          if (hasLeaveAttendance) {
            setSelectedDate(today);
            setShowAttendanceStatusModal(true);
          }

          // Check if End Day has been completed for today
          const endDayMarkerKey = `end_day_completed_${today}`;
          const endDayMarker = await AsyncStorage.getItem(endDayMarkerKey);
          const endDayDone = endDayMarker === "true";
          if (isActive) {
            setIsEndDayCompleted(endDayDone);
            if (endDayDone) {
              setActiveTab("Home");
            }
          }

          loadDynamicConfig();
        } catch (err) {
          console.error("Error checking attendance:", err);
        }
      };
      const init = async () => {
        const isUpdateAvailable = await checkUpdate();
        if (!isUpdateAvailable) {
          checkAttendance();
        }
      };

      init();

      return () => {
        // cleanup when screen loses focus
        isActive = false;
      };
    }, [refreshTrigger]),
  );

  const handleStartDay = async () => {
    setShowStartDayModal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {}, []);

  const handleLogoutFun = async () => {
    setDrawerVisible(false);
    setIsLoggingOut(true);
    console.log("setting has Logged out true...............before logout");
    await AsyncStorage.setItem("hasLoggedOut", "true");
    let loggedoutValue = await AsyncStorage.getItem("hasLoggedOut");
    console.log(
      "has loggedout value................... in tabbed ",
      loggedoutValue,
    );
    try {
      await AsyncStorage.setItem("hasLoggedOut", "true");
      const hasLoggedOut =
        (await AsyncStorage.getItem("hasLoggedOut")) === "true";
      if (!hasLoggedOut) {
        return;
        console.log("has logged out is true ............ set");
      }
      //return
      // 1️⃣ Logout from SDK first
      try {
        // await oauth.logout(); // Clear Salesforce SDK token FIRST
        console.log("Salesforce SDK logout done");
      } catch (e) {
        console.warn("⚠️ SDK logout failed (maybe already logged out):", e);
      }

      await persistor.purge(); // Redux-persist storage
      await AsyncStorage.removeItem("initialDataSynced");
      await AsyncStorage.setItem("hasLoggedOut", "true");
      const objects = CLEAR_TABLES;

      for (const obj of objects) {
        await UniversalUpdateInsert({ ObjectName: obj, Type: "delete_all" });
      }
      dispatch(logout());
      await handleLogout(); // Final API logout (if needed)
    } catch (err) {
      console.error("Error during logout:", err);
      ToastAndroid.show("Logout failed. Try again.", ToastAndroid.SHORT);
      alert(JSON.stringify(err));
    } finally {
      // ALWAYS hide loader (even on error)
      setIsLoggingOut(false);
    }
  };

  const handleLogoutFunSync = async () => {
    await handleLogoutService({
      setIsLoggingOut,
      dispatch,
      handleLogout,
    });
  };

  const handleSyncData = async () => {
    await syncAttendanceRecords(apiFetch);
    await syncBeatDayRecord(apiFetch, apiComposite);
    await syncVisitRecord(apiFetch, apiComposite);
    await syncOrderRecord(apiFetch);
    await syncOrderItemRecord(apiFetch);
    await syncCollectionRecord(apiFetch);
    await syncCollectionAllocationRecord(apiFetch);
    await syncInvoiceRecord(apiFetch);
    await syncInvoiceItemRecord(apiFetch);
    await syncAccountRecord(apiFetch);
    await syncFormJsonecord(apiFetch);
    await syncCompetitorRecord(apiFetch);
    await syncStockCheckRecord(apiFetch);
    await syncSalaryAcknowledgementRecord(apiFetch);
    await syncGamificationTransactionRecord(apiFetch);
    await syncMTExceptionRecord(apiFetch);
    await syncGrowthMappingEntryRecord(apiFetch);
    await syncHNTCompetitorPriceRecord(apiFetch);
  };

  // Automatic Background Attendance & Notification Sync
  useEffect(() => {
    let wasOffline = false;
    let isActive = true;

    const syncAttendanceWhenOnline = async () => {
      const state = await NetInfo.fetch();
      const isOnline = !!(
        state.isConnected && state.isInternetReachable !== false
      );
      if (isOnline) {
        console.log(
          "📡 Internet available. Checking for offline attendance to sync...",
        );
        await syncAttendanceRecords(apiFetch);
      }
    };

    const syncOfflineOrdersWhenOnline = async () => {
      const state = await NetInfo.fetch();
      const isOnline = !!(
        state.isConnected && state.isInternetReachable !== false
      );
      if (!isOnline) {
        return;
      }

      await syncVisitRecord(apiFetch, apiComposite);
      await syncOrderRecord(apiFetch);
      await syncOrderItemRecord(apiFetch);
    };

    const syncNotifications = () => {
      if (isActive) {
        syncNotificationsFromServer(apiFetch).catch((error: any) => {
          console.error("❌ Background notification sync failed:", error);
        });
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!(
        state.isConnected && state.isInternetReachable !== false
      );
      if (isOnline) {
        if (wasOffline) {
          console.log("📡 Internet reconnected! Auto-syncing offline visits, orders, accounts, attendance & notifications...");
          syncNotifications();
        }
        syncAttendanceRecords(apiFetch).catch((error: any) => {
          console.error("❌ Offline attendance sync failed:", error);
        });
        syncAccountRecord(apiFetch).catch((error: any) => {
          console.error("❌ Offline account sync failed:", error);
        });
        syncOfflineOrdersWhenOnline().catch((error: any) => {
          console.error("❌ Offline order sync failed:", error);
        });
        wasOffline = false;
      } else {
        wasOffline = true;
      }
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active" && isActive) {
          syncAttendanceWhenOnline().catch((error: any) => {
            console.error("❌ Foreground attendance sync failed:", error);
          });
          syncOfflineOrdersWhenOnline().catch((error: any) => {
            console.error("❌ Foreground order sync failed:", error);
          });
          syncNotifications();
        }
      },
    );

    syncAttendanceWhenOnline().catch((error: any) => {
      console.error("❌ Initial attendance sync failed:", error);
    });
    syncOfflineOrdersWhenOnline().catch((error: any) => {
      console.error("❌ Initial order sync failed:", error);
    });
    syncNotifications();

    return () => {
      isActive = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [apiFetch]);

  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat,
  );
  const [selectedBeatName, setSelectedBeatName] = useState(null);
  const [beatDaysId, setBeatDaysId] = useState(null);
  const [selecteBeatId, setSelecteBeatId] = useState(null);
  const [todaysDate, setTodaysDate] = useState("");
  const [accountDataList, setAccountDataList] = useState([]);
  const [userState, setUserState] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    dispatch(setSearchParam(""));
  }, [activeTab, refreshTrigger]);

  useFocusEffect(
    useCallback(() => {
      const dateNow = moment().format("YYYY-MM-DD");
      // console.log("Helloooooooooooo", dateStore);
      setTodaysDate(dateNow);
      const fetchVisits = async () => {
        try {
          const accountData = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
          });
          setAccountDataList(accountData);
          const users = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          setUserState(users);
          const RoutePlans = await UniversalUpdateInsert({
            ObjectName: "Route_Plans__c",
            Type: "get",
            filters: [
              { field: "Assigned_To__c", value: users[0].Sf_Id },
            ],
          });

          // console.log('crm@2031crm@2031crm@2031crm@2031crm@2031crm@2031crm@2031crm@2031crm@2031crm@2031-----------------Harsh')
          const todayForRoutePlans = new Date();
          const firstDayOfMonth = new Date(
            todayForRoutePlans.getFullYear(),
            todayForRoutePlans.getMonth(),
            1,
          );
          const lastDayOfMonth = new Date(
            todayForRoutePlans.getFullYear(),
            todayForRoutePlans.getMonth() + 1,
            0,
          );
          const currentMonthRoutePlans = RoutePlans.filter((plan) => {
            const startDate = new Date(plan.Start_Date__c);
            const endDate = new Date(plan.End_Date__c);
            return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
          });

          if (!currentMonthRoutePlans || currentMonthRoutePlans.length === 0) {
            console.log("⚠️ No Route Plans found for this month");
            dispatch(setSelectedBeatDay(null));
            setSelectedBeatName(null);
            setSelecteBeatId(null);
            setBeatDaysId(null);
            return;
          }

          const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;
          const BeatDays = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
          });
          const beatDayForDate = BeatDays.find(
            (b) =>
              b.Tour_Plan__c === activePlanId && // belongs to the route plan
              b.BeatDate__c === dateStore, // is for the selected date
          );
          if (!beatDayForDate) {
            console.log("No Beat Day found for date", dateStore);
            dispatch(setSelectedBeatDay(null));
            setSelectedBeatName(null);
            setSelecteBeatId(null);
            setBeatDaysId(null);
            return;
          }
          // console.log("BEAT DAYS FOR THE DATE |||||||||", beatDayForDate);
          dispatch(setSelectedBeatDay(beatDayForDate));
          setSelectedBeatName(beatDayForDate?.Beat__Name);
          setSelecteBeatId(beatDayForDate?.Beat__c); // Save selected Beat
          setBeatDaysId(beatDayForDate?.Sf_Id);
          const beatIdget = beatDayForDate?.Beat__c ?? null;
          const beatName = beatDayForDate?.Beat__Name ?? null;
          dispatch(setBeatSelection({ id: beatIdget, name: beatName }));
        } catch (e) {
          console.error(" Error fetching Visit data:", e);
        }
      };

      fetchVisits();
      return () => {};
    }, [dateStore, refreshTrigger]),
  );

  // console.log("THIS IS THE USER FROM CURRENT TABBED SCREEN--------------", activeTab, userState[0]?.DeveloperName)
  const route = useRoute();
  useEffect(() => {
    if (route.params?.defaultTab && !isLeaveAttendance) {
      setActiveTab(route.params.defaultTab);
    }
  }, [route.params, isLeaveAttendance]);

  const handleTabPress = (tabName) => {
    if (isLeaveAttendance && tabName !== "Home") {
      dispatch(
        showToast({
          type: "warning",
          message: "You are on leave and cannot access this feature.",
        }),
      );
      return;
    }
    if (isEndDayCompleted && tabName !== "Home") {
      dispatch(
        showToast({
          type: "warning",
          message: "End Day has been completed. You cannot access this feature.",
        }),
      );
      return;
    }
    setActiveTab(tabName);
  };

  const handleProfilePress = () => {
    setDrawerVisible(true);
  };

  return (
    <LinearGradient
      colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      {activeTab !== "stock" && <Header activeTab={activeTab} />}

      {/* Main content */}

      <ScreenSwitcher
        activeTab={activeTab}
        refreshKey={refreshKey}
        key={String(reloadKey)}
      />

      {/* Bottom tabs */}
      <CustomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        onProfilePress={handleProfilePress}
      />

      {/* Modals */}
      <AddAttendance
        visible={isAttendanceModalVisible}
        attendanceToReopen={rejectedLeaveAttendance}
        onClose={() => {
          setAttendanceModalVisible(false);
          users[0]?.DeveloperName === "H_T_SO"
            ? setActiveTab("Activity")
            : setActiveTab("Home");
          setRefreshKey((prev) => prev + 1);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      <RightDrawerModal
        visible={drawerVisible}
        isLeaveAttendance={isLeaveAttendance}
        isEndDayCompleted={isEndDayCompleted}
        onClose={() => setDrawerVisible(false)}
        onSyncComplete={() => setRefreshTrigger((prev) => prev + 1)}
        handleLogoutFromParent={async () => {
          setDrawerVisible(false);
          await handleSyncData();
          handleLogoutFun();
        }}
      />

      <StartDayModal
        visible={showStartDayModal}
        onStartDay={handleStartDay}
        handleLogoutFromParent={async () => {
          setDrawerVisible(false);
          setShowStartDayModal(false);
          // await handleSyncData();
          handleLogoutFunSync();
        }}
      />

      <UpdateModal
        visible={!!updateType}
        type={updateType}
        message={updateMessage}
        storeUrl={storeUrl}
        onClose={() => setUpdateType(null)}
      />

      {/* NEW: Transparent glass loader modal while logging out */}
      <Modal visible={isLoggingOut} transparent animationType="fade">
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContainer}>
            <Spinner
              isVisible={isLoggingOut}
              size={29}
              type="Wave"
              color="#3B5BB5"
            />
            <Text style={styles.loaderText}>Logging out...</Text>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)", // dim the background a bit
    justifyContent: "center",
    alignItems: "center",
  },
  loaderContainer: {
    minWidth: 160,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    // glass-like card
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    // elevation: 6,
  },
  loaderText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default TabbedScreen;
