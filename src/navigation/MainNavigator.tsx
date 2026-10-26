// src/navigation/MainNavigator.js
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../redux/store"; // Make sure this path is correct
import StartupCoordinator from "../utils/helper/StartupCoordinator";
import DeviceConfirmModal from "../components/modal/DeviceConfirmModal";
import { useDeviceValidation } from "../hooks/useDeviceValidation";
import TabbedScreen from "../components/TabbedScreen";
import ToastModal from "../components/modal/ToastModal";
import SessionExpiredModal from "../components/modal/SessionExpiredModal";
import { hideToast, hideSessionExpired } from "../redux/slices/toastSlice";
import { resetSessionExpiredFlag } from "../utils/sessionManager";
import { handleLogoutService } from "../components/logoutHandler";
import AccountDetailContainer from "../components/AccountDetailContainer";
import EditAccount from "../screens/EditAccount";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OrderHistoryScreen from "../screens/OrderHistory";
import RetailerInventory from "../screens/RetailerInventory";
import RetailerInventoryVisit from "../screens/RetailerInventoryVisit";
import CoverageReport from "../screens/salesReports/CoverageReport";
import SpotSalesReport from "../screens/salesReports/SpotSalesReport";
import TargetReport from "../screens/salesReports/TargetReport";
import SkuReport from "../screens/salesReports/SkuReport";
import LeaderboardReport from "../screens/salesReports/LeaderboardReport";
import ReturnHistoryScreen from "../screens/ReturnHistory";
import CartScreen from "../screens/CartScreen";
import AddAccountForm from "../screens/AddAccountForm";
import NearbyRetailerSearch from "../screens/NearbyRetailerSearch";
import BeatReassignment from "../screens/BeatReassignment";
import OutletReassignment from "../screens/OutletReassignment";
import AddSubDbForm from "../screens/AddSubDbForm";
import CompetitorForm from "../screens/AddCompetitorForm";
import { setDataReady } from "../redux/slices/appNavigationSlice.js";
import SelectActivity from "../screens/SelectActivity";
import SelectionScreen from "../screens/SelectionScreen";
import BeatPlanning from "../screens/BeatPlanning";
import SROnboardingForm from "../screens/SROnboardingForm";
import SurveyFormList from "../screens/SurveyFormList";
import ObjectDetail from "../screens/ObjectDetail";
import EndDayScreen from "../screens/EndDayScreen";
import ASOStockCheck from "../screens/ASOStockCheck";
import ASOOrder from "../screens/ASOOrder";
import SubDBOrder from "../screens/SubDbOrder";
import SubDBOrderReport from "../screens/SubDBOrderReport";
import ASOOrderTwo from "../screens/ASOOrderTwo";
import CloseDay from "../screens/CloseDay";
import Exception from "../screens/Exception";
import ExceptionForTab from "../screens/ExceptionForTab";
import AssortmentScreen from "../screens/Assortment";
import CompetitorMt from "../screens/CompetitorMT";
import PricingMt from "../screens/PricingMT";
import MTStockCheck from "../screens/MTStockCheck";
import ObjectList from "../screens/ObjectList";
import FullMapScreen from "../screens/FullMapScreen";
import VideoScreen from "../screens/VideoScreen";
import MissedOutletsScreen from "../screens/MissedOutletsScreen";
import LeadList from "../screens/LeadList";
import EndDayScreenMT from "../screens/EndDayScreenMT";
import NotificationsScreen from "../screens/NotificationsScreen";
import { navigationRef } from "../navigationRef";
import AddSalaryAcknowledgement from "../screens/AddSalaryAcknowledgement";
import ReportsScreen from "../screens/ReportsScreen";
import SRAttendanceScreen from "../screens/reports/AttendanceReport";
import OrderDetailReport from "../screens/reports/OrderDetailReport";
import LocationReport from "../screens/reports/LocationReport";
import VisitReport from "../screens/reports/VisitReport";
import RedeemReward from "../components/RedeemReward";
import UnsyncedDataModal from "../components/UnsyncedDataModal";
import TrainingMaterialsScreen from "../components/TrainingMaterialsScreen";
import RoutePlanScreen from "../screens/RoutePlanScreen";
import ClaimTravelAllowance from "../screens/ClaimTravelAllowance";
import SignageRequest from "../screens/SignageRequest";
import PerfectStoreTemplatesScreen from "../screens/PerfectStoreTemplatesScreen";
import PerfectStoreScreen from "../screens/PerfectStoreScreen";
import CompetitionActivity from "../screens/CompetitionActivity";
import Merchandising from "../screens/Merchandising";
import VisitListScreen from "../screens/VisitListScreen";
import DailyDashboard from "../screens/dashboards/DailyDashboard";
import DailyDashboardDetail from "../screens/dashboards/DailyDashboardDetail";
import DateWiseSummary from "../screens/dashboards/DateWiseSummary";
import MTDSales from "../screens/dashboards/MTDSales";
import MTDHighlights from "../screens/dashboards/MTDHighlights";
import MTDHighlightsDetail from "../screens/dashboards/MTDHighlightsDetail";
import TeamCoverage from "../screens/dashboards/TeamCoverage";
import TeamCoverageDetail from "../screens/dashboards/TeamCoverageDetail";
import EngagementScreen from "../screens/dashboards/EngagementScreen";
import SurveySummary from "../screens/dashboards/SurveySummary";
import SurveyReportScreen from "../screens/dashboards/SurveyReportScreen";

import MapTest from "../screens/MapTest";

const Stack = createStackNavigator();

export default function MainNavigator() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  const toast = useSelector((state) => state.toast);

  const loginStatus = useSelector(
    (state: RootState) => state.device.loginStatus,
  );
  const dataReady = useSelector((state: RootState) => state.app.dataReady);

  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  //uncomment
  useEffect(() => {
    const checkInitialSync = async () => {
      const synced = await AsyncStorage.getItem("initialDataSynced");
      // console.log("IS SYNCEED_____", synced)
      if (synced === "true") dispatch(setDataReady(true));

      const loggedOut = await AsyncStorage.getItem("hasLoggedOut");
      console.log("HAS LOGGED OUT  :::", loggedOut);
      if (loggedOut === "true") setHasLoggedOut(true);
      setIsLoading(false);
    };

    checkInitialSync();
  }, []);

  if (isLoading) return null;

  const shouldShowStartup = !loginStatus || !accessToken || !dataReady;

  console.log(
    "loginStatus",
    loginStatus,
    "accessToken",
    accessToken,
    "dataReady",
    dataReady,
    "hasLoggedOut",
    hasLoggedOut,
  );
  const handleConfirmSessionExpired = async () => {
    dispatch(hideSessionExpired());
    resetSessionExpiredFlag();
    await handleLogoutService({
      setIsLoggingOut: null,
      dispatch,
      handleLogout: async () => {
        await AsyncStorage.setItem("hasLoggedOut", "true");
        setHasLoggedOut(true);
      },
    });
  };

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {(!loginStatus || !accessToken || !dataReady) && !hasLoggedOut ? (
            <Stack.Screen
              name="AuthStartupScreen"
              component={StartupCoordinator}
            />
          ) : (
            <>
              {/* <Stack.Screen name="ObjectList" component={ObjectList} /> */}

              <Stack.Screen name="TabbedScreen" component={TabbedScreen} />
              <Stack.Screen
                name="AccountDetailContainer"
                component={AccountDetailContainer}
              />

              <Stack.Screen name="AccountEdit" component={EditAccount} />
              <Stack.Screen
                name="OrderHistory"
                component={OrderHistoryScreen}
              />
              <Stack.Screen
                name="RetailerInventory"
                component={RetailerInventory}
              />
              <Stack.Screen
                name="RetailerInventoryVisit"
                component={RetailerInventoryVisit}
              />
              <Stack.Screen name="ReportCoverage" component={CoverageReport} />
              <Stack.Screen name="ReportSpotSales" component={SpotSalesReport} />
              <Stack.Screen name="ReportTarget" component={TargetReport} />
              <Stack.Screen name="ReportSku" component={SkuReport} />
              <Stack.Screen name="ReportLeaderboard" component={LeaderboardReport} />
              <Stack.Screen name="CartScreen" component={CartScreen} />
              <Stack.Screen name="AccountAddForm" component={AddAccountForm} />
              <Stack.Screen
                name="NearbyRetailerSearch"
                component={NearbyRetailerSearch}
              />
              <Stack.Screen
                name="BeatReassignment"
                component={BeatReassignment}
              />
              <Stack.Screen
                name="OutletReassignment"
                component={OutletReassignment}
              />
              <Stack.Screen
                name="CompetitorAddForm"
                component={CompetitorForm}
              />
              <Stack.Screen name="RedeemReward" component={RedeemReward} />
              <Stack.Screen
                name="SROnboardingForm"
                component={SROnboardingForm}
              />
              <Stack.Screen name="ObjectList" component={ObjectList} />
              <Stack.Screen name="AddSubDbForm" component={AddSubDbForm} />
              <Stack.Screen
                name="SelectionScreen"
                component={SelectionScreen}
              />
              <Stack.Screen name="SelectActivity" component={SelectActivity} />
              <Stack.Screen
                name="BeatPlanningForActivity"
                component={BeatPlanning}
              />
              <Stack.Screen name="ObjectDetail" component={ObjectDetail} />
              <Stack.Screen name="EndDayScreen" component={EndDayScreen} />
              <Stack.Screen name="EndDayScreenMT" component={EndDayScreenMT} />
              <Stack.Screen name="ASOStockCheck" component={ASOStockCheck} />
              <Stack.Screen name="ASOOrder" component={ASOOrder} />
              <Stack.Screen name="SubDBOrder" component={SubDBOrder} />
              <Stack.Screen
                name="SubDBOrderReport"
                component={SubDBOrderReport}
              />
              <Stack.Screen name="ASOOrderTwo" component={ASOOrderTwo} />
              <Stack.Screen name="CloseDay" component={CloseDay} />
              <Stack.Screen name="Exception" component={Exception} />
              <Stack.Screen
                name="ExceptionForTab"
                component={ExceptionForTab}
              />
              <Stack.Screen name="Assortment" component={AssortmentScreen} />
              <Stack.Screen name="CompetitorMt" component={CompetitorMt} />
              <Stack.Screen name="PricingMt" component={PricingMt} />
              <Stack.Screen name="MTStockCheck" component={MTStockCheck} />
              <Stack.Screen name="FullMap" component={FullMapScreen} />
              <Stack.Screen name="VideoScreen" component={VideoScreen} />
              <Stack.Screen
                name="ReturnHistory"
                component={ReturnHistoryScreen}
              />
              <Stack.Screen
                name="NotificationsScreen"
                component={NotificationsScreen}
              />
              <Stack.Screen
                name="AddSalaryAcknowledgement"
                component={AddSalaryAcknowledgement}
              />
              <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
              <Stack.Screen
                name="MissedOutletsScreen"
                component={MissedOutletsScreen}
              />
              <Stack.Screen
                name="SRAttendanceScreen"
                component={SRAttendanceScreen}
              />
              <Stack.Screen name="LocationReport" component={LocationReport} />
              <Stack.Screen name="VisitReport" component={VisitReport} />
              <Stack.Screen
                name="OutletDetailReport"
                component={OrderDetailReport}
              />
              <Stack.Screen name="SurveyFormList" component={SurveyFormList} />
              <Stack.Screen name="UnsyncedData" component={UnsyncedDataModal} />
              <Stack.Screen
                name="TrainingMaterials"
                component={TrainingMaterialsScreen}
              />
              <Stack.Screen
                name="RoutePlanScreen"
                component={RoutePlanScreen}
              />
              <Stack.Screen
                name="ClaimTravelAllowance"
                component={ClaimTravelAllowance}
              />
              <Stack.Screen name="SignageRequest" component={SignageRequest} />
              <Stack.Screen
                name="PerfectStoreTemplatesScreen"
                component={PerfectStoreTemplatesScreen}
              />
              <Stack.Screen
                name="PerfectStoreScreen"
                component={PerfectStoreScreen}
              />
              <Stack.Screen
                name="CompetitionActivity"
                component={CompetitionActivity}
              />
              <Stack.Screen name="Merchandising" component={Merchandising} />
              <Stack.Screen name="VisitList" component={VisitListScreen} />
              <Stack.Screen name="DailyDashboard" component={DailyDashboard} />
              <Stack.Screen
                name="DailyDashboardDetail"
                component={DailyDashboardDetail}
              />
              <Stack.Screen
                name="DateWiseSummary"
                component={DateWiseSummary}
              />
              <Stack.Screen
                name="MTDSales"
                component={MTDSales}
              />
              <Stack.Screen
                name="MTDHighlights"
                component={MTDHighlights}
              />
              <Stack.Screen
                name="MTDHighlightsDetail"
                component={MTDHighlightsDetail}
              />
              <Stack.Screen
                name="TeamCoverage"
                component={TeamCoverage}
              />
              <Stack.Screen
                name="TeamCoverageDetail"
                component={TeamCoverageDetail}
              />
              <Stack.Screen
                name="EngagementScreen"
                component={EngagementScreen}
              />
              <Stack.Screen
                name="SurveySummary"
                component={SurveySummary}
              />
              <Stack.Screen
                name="SurveyReportScreen"
                component={SurveyReportScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      <ToastModal
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => dispatch(hideToast())}
      />

      <SessionExpiredModal
        visible={Boolean(toast.sessionExpiredVisible)}
        onConfirm={handleConfirmSessionExpired}
      />
    </>
  );
}
