import React, { FC, useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Pressable,
  Image,
  ImageSourcePropType,
  Modal,
  TouchableWithoutFeedback,
  UIManager,
  findNodeHandle,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import Entypo from "@react-native-vector-icons/entypo";
import Ionicons from "../../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import { dataSyncer } from "../../UtilityMain/dataSyncer";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import moment from "moment";
// import { fetchSchemeData } from '../../utils/helper/getSchemes';
import TopPerformingOLCard from "./TopPerformingOLCard";
// SVG imports
import DownArrow from "../../assets/images/arrowDown.svg";
import UpArrow from "../../assets/images/arrowUp.svg";
import Clock from "../../assets/images/Clock.svg";
import Camera from "../../assets/images/Camera.svg";
import { Gradients } from "../../assets/css/MasterCss.js";
// Import CSS styles
import { getDashboardSRStyle } from "../../assets/css/DashboardSR.js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native-gesture-handler";
import getOrderedCategories from "../../UtilityMain/producthelpers/categoryPriorityService";
import { getUserAccessibleCategories } from "../../UtilityMain/producthelpers/userLineServiceForEndDay";
import DashboardSRCategory from "../../components/DashboardSRCategory";
import SalesReportsSection from "../salesReports/SalesReportsSection";
import Leaderboard from "../../components/LeaderBoard";
import { getGamificationMasterFromAPI } from "../../UtilityMain/GetAndStoreData/getGamificationMaster.js";
import { getGamificationTransactionHNT } from "../../UtilityMain/GetAndStoreData/getGamificationTransaction.js";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { syncGamificationTransactionRecord } from "../../database/dbService/AllDataSync";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { showToast } from "../../redux/slices/toastSlice";

import { Icon } from "react-native-paper";
const styles = getDashboardSRStyle();

const dashboardStyles = StyleSheet.create({
  leaveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "rgba(26, 29, 46, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
    position: "relative",
  },
  leaveGradientBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  leaveCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingLeft: 4,
  },
  leaveTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgePending: {
    backgroundColor: "#FBEFD8",
  },
  badgeApproved: {
    backgroundColor: "#E3F1EA",
  },
  badgeRejected: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  textPending: {
    color: "#D08C1F",
  },
  textApproved: {
    color: "#2E7D5B",
  },
  textRejected: {
    color: "#B3261E",
  },
  rejectedLeaveCard: {
    backgroundColor: "#FFF5F5",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    shadowColor: "rgba(198, 40, 40, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
    position: "relative",
  },
  rejectedLeaveGradientBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: "#B3261E",
  },
  rejectedLeaveCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingLeft: 4,
  },
  rejectedLeaveTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#991B1B",
  },
  rejectedLeaveMessage: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#7F1D1D",
    lineHeight: 20,
    paddingLeft: 4,
  },
  leaveInfoRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 4,
  },
  leaveLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7A7266",
    width: 80,
  },
  leaveValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F1D1A",
    flex: 1,
  },
  callSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
    shadowColor: "rgba(0, 0, 0, 0.04)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  callSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  callSummaryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callSummaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1EADB",
    alignItems: "center",
    justifyContent: "center",
  },
  callSummaryTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold",
    fontWeight: "normal",
    color: "#1F1D1A",
  },
  callSummaryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callSummaryViewAll: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A67C2E",
  },
  callSummaryDivider: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginBottom: 12,
  },
  callSummaryMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  callSummaryMetricItem: {
    flex: 1,
    alignItems: "center",
  },
  callSummaryMetricValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F1D1A",
    marginBottom: 2,
  },
  callSummaryMetricLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#7A7266",
    textAlign: "center",
  },
  callSummaryMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#D9D2C3",
  },
  pocketMisContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "rgba(26, 29, 46, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },
  pocketMisHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingLeft: 4,
    position: "relative",
  },
  pocketMisGradientBar: {
    position: "absolute",
    left: -16,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  pocketMisTitle: {
    fontSize: 17,
    fontFamily: "PlayfairDisplay_700Bold",
    fontWeight: "normal",
    color: "#1F1D1A",
    paddingLeft: 8,
  },
  pocketMisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  pocketMisCard: {
    width: (Dimensions.get("window").width - 76) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  pocketMisIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  pocketMisCardText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F1D1A",
    textAlign: "left",
    lineHeight: 14,
  },
});

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PADDING = 16;
const GAP = 8;
const NUM_COLUMNS = 3;

interface User {
  label: string;
  value: string;
  color?: string;
}

const users: User[] = [
  { label: "Ram Kumar (SR)", value: "ram", color: "#A67C2E" },
  { label: "Sita Devi (SR)", value: "sita", color: "#FF5722" },
];

interface LiveMetric {
  key: string;
  title: string | JSX.Element;
  subtitle?: string;
  titleColor?: string;
}

interface Metric {
  key: string;
  title: string;
  value: string;
  suffix?: string;
  subtitle?: string;
  labels?: string;
  icon?: ImageSourcePropType;
  trend?: number;
  large?: boolean;
  customWidth?: string;
}

const metrics: Metric[] = [
  {
    key: "1",
    title: "Food",
    value: "35.2K",
    suffix: "/54.6K",
    labels: "Food",
    subtitle: "(In Thousand)",
    icon: require("../../assets/images/food.png"),
    large: true,
  },
  {
    key: "2",
    title: "Oil",
    value: "112L",
    suffix: "/220L",
    labels: "Oil",
    subtitle: "(In Liters)",
    icon: require("../../assets/images/oil.png"),
    large: true,
  },
  {
    key: "3",
    title: "TLS",
    value: "22",
    trend: -1,
    subtitle: "TLS (Total Lines Sold)",
    customWidth: "49%",
  },
  {
    key: "4",
    title: "UTLS",
    value: "22",
    trend: 1,
    subtitle: "UTLS (Unique Total Lines Sold)",
    customWidth: "49%",
  },
  { key: "5", title: "MBO", value: "11", subtitle: "Days Worked" },
  { key: "6", title: "2 Cat MBO", value: "44", subtitle: "Outlet Visited" },
  { key: "7", title: "3 Cat MBO", value: "92", subtitle: "Total Outlet" },
  {
    key: "8",
    title: "Bill Cuts",
    value: "11/19",
    trend: -1,
    customWidth: "49%",
    subtitle: "MBO",
  },

  {
    key: "10",
    title: "Wholesale",
    value: "4",
    trend: 1,
    customWidth: "49%",
    subtitle: "Bill Cuts",
  },
];

const MetricCard: React.FC<Metric> = ({
  value,
  suffix = "",
  subtitle,
  labels,
  icon,
  trend,
  large,
  customWidth,
}) => {
  const isUp = (trend ?? 0) > 0;
  const hasTrend = typeof trend === "number";
  const dispatch = useDispatch();

  return (
    <View
      style={[
        styles.metricCard,
        large && styles.cardLarge,
        customWidth ? { width: customWidth } : {},
      ]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.valueRow}>
            <Text style={styles.valueMain}>{value}</Text>
            {suffix ? <Text style={styles.valueSuffix}>{suffix}</Text> : null}
          </Text>
          {(labels || subtitle) && (
            <Text style={styles.subtitle}>
              {labels && <Text style={styles.labelText}>{labels} </Text>}
              {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
            </Text>
          )}
        </View>
        {icon && (
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        )}
      </View>
      {hasTrend && (
        <View style={styles.trendContainer}>
          {isUp ? (
            <UpArrow width={16} height={16} />
          ) : (
            <DownArrow width={16} height={16} />
          )}
        </View>
      )}
    </View>
  );
};

interface PocketMisItem {
  id: string;
  title: string;
  icon: string;
  color: string;
  iconColor: string;
}

const pocketMisItems: PocketMisItem[] = [
  { id: "daily_dashboard", title: "Daily Dashboard", icon: "chart-timeline-variant", color: "#E3F2FD", iconColor: "#3B5BB5" },
  { id: "date_wise_summary", title: "Date Wise Summary", icon: "calendar-month", color: "#E3F1EA", iconColor: "#43A047" },
  { id: "mtd_sales", title: "MTD Sales", icon: "trending-up", color: "#FBEFD8", iconColor: "#FB8C00" },
  { id: "mtd_highlights", title: "MTD Highlights", icon: "star-circle-outline", color: "#E3F1EA", iconColor: "#2E7D5B" },
  { id: "team_coverage", title: "Team Coverage", icon: "account-group", color: "#E3F1EA", iconColor: "#2E7D5B" },
  { id: "engagement", title: "Engagement", icon: "account-multiple-check", color: "#E0F2FE", iconColor: "#3B5BB5" },
  { id: "targets", title: "Primary/Secondary Targets", icon: "target", color: "#F3E5F5", iconColor: "#8E24AA" },
  // { id: "smart_alerts", title: "Smart Alerts (Engage)", icon: "bell-ring", color: "#F9E5E3", iconColor: "#B3261E" },
  { id: "gamification", title: "Gamification/ KRA Monitoring", icon: "trophy", color: "#FFFDE7", iconColor: "#FDD835" },
  { id: "ai_guidance", title: "AI-Based Field Guidance", icon: "robot-outline", color: "#EDE7F6", iconColor: "#5E35B1" },
];

const DashboardSR: FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { accessToken, instanceUrl } = useSelector((state: RootState) => state.auth);
  const { fetchRecords, apiFetch, apiComposite } = useApiFetch();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const onRefresh = useCallback(async () => {
    const netState = await NetInfo.fetch();
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    if (!isOnline) {
      dispatch(
        showToast({
          type: "warning",
          message: "You are offline. Connect to internet to sync",
        })
      );
      return;
    }
    setRefreshing(true);
    try {
      if (accessToken && instanceUrl) {
        await dataSyncer({ accessToken, instanceUrl }, fetchRecords, apiFetch, apiComposite);
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, instanceUrl, fetchRecords, apiFetch, apiComposite, dispatch]);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Live Status" | "Performance">(
    "Live Status",
  );
  const [users, setUsers] = useState([]);
  const [userRole, setUserRole] = useState("");

  // Engagement container visible strictly to ASM, RSM, AGM, GM, VP
  const allowedEngagementRoles = ["ASM", "RSM", "AGM", "GM", "VP"];
  const isEngagementAllowed = useMemo(() => {
    const currentRole =
      userRole ||
      (users?.[0] as any)?.Role ||
      (users?.[0] as any)?.DeveloperName ||
      "";
    const upperRole = String(currentRole).toUpperCase();
    return allowedEngagementRoles.some((role) => upperRole.includes(role));
  }, [userRole, users]);

  const [latestAttendance, setLatestAttendance] = useState({});
  // console.log('latestAttendance',latestAttendance)
  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat,
  );
  const alredyCheckIn = useSelector((state: RootState) => state.checkIn);
  // console.log(alredyCheckIn,'alredyCheckIn')
  const [outletLength, setOutletLength] = useState(0);
  const [planned, setPlanned] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const [billedOutlets, setBilledOutlets] = useState(0);
  const [outletVisited, setOutletVisited] = useState(0);

  // target derived states
  const [tlsTarget, setTlsTarget] = useState<number | null>(null);
  const [utlsTarget, setUtlsTarget] = useState<number | null>(null);
  const [mboTarget, setMboTarget] = useState<number | null>(null);
  const [mboTargetTwo, setMboTargetTwo] = useState<number | null>(null);
  const [mboTargetThree, setMboTargetThree] = useState<number | null>(null);
  const [achivemboTarget, setAchiveMboTarget] = useState<number | null>(null);
  const [achivemboTargetTwo, setAchiveMboTargetTwo] = useState<number | null>(
    null,
  );
  const [achivemboTargetThree, setAchiveMboTargetThree] = useState<
    number | null
  >(null);
  const [cateValue, setcateValue] = useState<number | null>(null);
  const [cateValueAchive, setcateValueAchive] = useState<number | null>(null);
  const [iscPercentage, setIscPercentage] = useState(0);
  const [daysWorked, setDaysWorked] = useState(0);
  const [allOutletsData, setAllOutletsData] = useState(0);
  const [currentMonthBillCuts, setCurrentMonthBillCuts] = useState(0);
  const [nonBuyingAccounts, setNonBuyingAccounts] = useState(0);
  const [categorizedData, setCategorizedData] = useState({
    Upcoming: [],
    Completed: [],
    "In Progress": [], // 👈 add this
  });

  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [selected, setSelected] = useState("Oils");
  const filterRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const DROPDOWN_WIDTH = 140;
  const openDropdown = () => {
    const handle = findNodeHandle(filterRef.current);

    if (handle) {
      UIManager.measure(handle, (x, y, width, height, pageX, pageY) => {
        setDropdownPos({
          top: pageY + height + 6, // button ke niche
          left: pageX + width - DROPDOWN_WIDTH, // RIGHT aligned
        });
        setVisible(true);
      });
    }
  };
  // dynamic metrics using the calculated target states
  const metricsDynamic: Metric[] = [
    {
      key: "1",
      title: "Food",
      value: `${cateValueAchive !== null ? cateValueAchive : "0"}`,
      suffix: `/${cateValue !== null ? cateValue : "0"}`,
      labels:
        selected === "Oils" || selected === "Flour"
          ? `${selected} (in MT)`
          : `${selected} (in Value)`,

      subtitle: "",
      // subtitle: '(In Thousand)',
      icon:
        selected === "Oil"
          ? require("../../assets/images/oil.png")
          : require("../../assets/images/food.png"),
      large: true,
    },
    // {
    //   key: '1',
    //   title: 'Food',
    //   value: `${cateValueAchive !== null ? cateValueAchive : '--'}`,
    //   suffix: `/${cateValue !== null ? cateValue : '--'}`,
    //   labels: 'Food',
    //   // subtitle: '(In Thousand)',
    //   subtitle: '',
    //   icon: require('../../assets/images/oil.png'),
    //   large: true,
    // },
    // {
    //   key: '2',
    //   title: 'Oil',
    //   value: `${cateValueAchive !== null ? cateValueAchive : '--'}`,
    //   suffix: `/${cateValue !== null ? cateValue : '--'}`,
    //   labels: 'Oil',
    //   // subtitle: '(In Liters)',
    //   subtitle: '',
    //   icon: require('../../assets/images/oil.png'),
    //   large: true,
    // },
    {
      key: "3",
      title: "TLS",
      value: tlsTarget !== null ? String(tlsTarget) : "0",
      trend: -1,
      subtitle: "TLS (Total Lines Sold)",
      customWidth: "49%",
    },
    {
      key: "4",
      title: "UTLS",
      value: utlsTarget !== null ? String(utlsTarget) : "0",
      trend: 1,
      subtitle: "UTLS (Unique Total Lines Sold)",
      customWidth: "49%",
    },
    {
      key: "5",
      title: "MBO",
      value: String(daysWorked),
      subtitle: "Days Worked",
    },
    {
      key: "6",
      title: "2 Cat MBO",
      value: `${outletVisited}`,
      subtitle: "Outlet Visited",
    },
    {
      key: "7",
      title: "3 Cat MBO",
      value: `${allOutletsData}`,
      subtitle: "Total Available  Outlets",
    },
    {
      key: "8",
      title: "Bill Cuts",
      value: `${achivemboTarget !== null ? achivemboTarget : "0"}/${mboTarget !== null ? mboTarget : "0"
        }`,
      trend: -1,
      // customWidth: '49%',
      subtitle: "MBO",
    },
    {
      key: "10",
      title: "Wholesale",
      value: `${currentMonthBillCuts}`,
      trend: 1,
      // customWidth: '49%',
      subtitle: "Bill Cuts",
    },
    {
      key: "13",
      title: "Non Buying",
      value: `${nonBuyingAccounts}`,
      // trend: -1,
      // customWidth: '49%',
      subtitle: "Non Buying",
    },
  ];
  if (selected === "Oils") {
    metricsDynamic.push(
      {
        key: "11",
        title: "Bill Cuts",
        value: `${achivemboTargetTwo !== null ? achivemboTargetTwo : "0"}/${mboTargetTwo !== null ? mboTargetTwo : "0"
          }`,
        customWidth: "49%",
        subtitle: "2 Cat MBO",
      },
      {
        key: "12",
        title: "Bill Cuts",
        value: `${achivemboTargetThree !== null ? achivemboTargetThree : "0"}/${mboTargetThree !== null ? mboTargetThree : "0"
          }`,
        customWidth: "49%",
        subtitle: "3 Cat MBO",
      },
    );
  }

  // helpers
  const safeParseNumber = (raw: any, preferAfterSlash = false) => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === "number") return raw;
    const s = String(raw).trim();
    if (!s) return 0;
    // if has slash "12/24", optionally pick the after-slash part
    if (s.includes("/")) {
      const parts = s.split("/").map((p) => p.trim());
      const pick = preferAfterSlash ? parts[1] ?? parts[0] : parts[0];
      const n = Number(String(pick).replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    // remove any non numeric except dot and minus
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const toMonthly = (value: number, frequency: string | undefined) => {
    if (!frequency) return value;
    const f = String(frequency).toLowerCase();
    if (f.includes("year")) return value / 12;
    if (f.includes("quarter")) return value / 3;
    // default: monthly / weekly etc -> assume already monthly
    return value;
  };

  const overlapsMonth = (
    start?: string | Date | null,
    end?: string | Date | null,
    monthDate?: string,
  ) => {
    // monthDate is dateStore (YYYY-MM-DD) or undefined -> pick today
    const base = monthDate ? new Date(monthDate) : new Date();
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;

    // if both missing -> treat as global target (include)
    if (!s && !e) return true;

    const startOk = s ? s <= lastDay : true;
    const endOk = e ? e >= firstDay : true;
    return startOk && endOk;
  };

  const onLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setMaxHeight((prev) => Math.max(prev, height));
  };

  // console.log(latestAttendance)

  const clearAttendance = async () => {
    await UniversalUpdateInsert({
      ObjectName: "Attendant__c",
      Type: "delete_all",
    });
  };

  const isValidUrl = (url) => {
    if (!url) return false;
    const cleanUrl = String(url).trim().toLowerCase();
    return (
      cleanUrl !== "" &&
      cleanUrl !== "null" &&
      cleanUrl !== "undefined" &&
      (cleanUrl.startsWith("http://") ||
        cleanUrl.startsWith("https://") ||
        cleanUrl.startsWith("file://"))
    );
  };

  const isValidBase64 = (base64Str) => {
    if (!base64Str) return false;
    const cleanStr = String(base64Str).trim();
    return (
      cleanStr !== "" &&
      cleanStr !== "null" &&
      cleanStr !== "undefined" &&
      cleanStr.length > 50
    );
  };

  const getBase64Uri = (base64Str) => {
    const cleanStr = String(base64Str).trim();
    if (cleanStr.startsWith("data:image")) {
      return cleanStr;
    }
    return `data:image/jpeg;base64,${cleanStr}`;
  };

  const isMTUser =
    users[0]?.DeveloperName === "MT_SO" ||
    users[0]?.DeveloperName === "MT_Merchandiser";

  const isRejectedLeave =
    (latestAttendance?.AttendanceStatus__c === "Leave" &&
      String(latestAttendance?.Approval_Status__c || "")
        .trim()
        .toLowerCase() === "rejected") ||
    latestAttendance?.AttendanceStatus__c === "Leave Rejected";

  const attendanceStatusLabel =
    latestAttendance?.AttendanceStatus__c === "Leave"
      ? ["approved", "accepted"].includes(
        String(latestAttendance?.Approval_Status__c || "")
          .trim()
          .toLowerCase(),
      )
        ? "Leave Approved"
        : String(latestAttendance?.Approval_Status__c || "").trim().toLowerCase() === "rejected"
          ? "Leave Rejected"
          : latestAttendance?.Approval_Status__c
            ? `Leave ${latestAttendance.Approval_Status__c}`
            : "Leave"
      : latestAttendance?.AttendanceStatus__c === "Leave Rejected"
        ? "Leave Rejected"
        : latestAttendance?.AttendanceStatus__c === "Halfday"
          ? "Half Day"
          : latestAttendance?.AttendanceStatus__c;

  const liveStatusMetrics: LiveMetric[] = [
    {
      key: "time",
      title: (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "black",
              marginRight: 4,
            }}
          >
            {/* {new Date(latestAttendance?.StartTime__c).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} */}
            {latestAttendance?.StartTime__c
              ? new Date(latestAttendance?.StartTime__c)
                .toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
                .replace("am", "AM")
                .replace("pm", "PM")
              : "--"}
          </Text>
          <Camera width={19} height={19} />
        </View>
      ),
      subtitle: "Attendance Time",
    },
    {
      key: "status",
      title: (
        <View style={{ justifyContent: "center" }}>
          <Text
            style={{
              color: isRejectedLeave ? "#B3261E" : "#4CAF50",
              fontWeight: "bold",
              fontSize: 13,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {attendanceStatusLabel}
          </Text>
        </View>
      ),
      subtitle: "Attendance Status",
      titleColor: isRejectedLeave ? "#B3261E" : "#4CAF50",
    },
    {
      key: "image",
      title:
        // Prefer selfie URL if present, otherwise fallback to base64, otherwise show the Clock SVG
        (isValidBase64(latestAttendance?.AttendanceBase64) ||
          isValidBase64(latestAttendance?.base64Image) ||
          isValidBase64(latestAttendance?.base64)) ? (
          <Image
            source={{
              uri: getBase64Uri(
                latestAttendance.AttendanceBase64 ||
                latestAttendance.base64Image ||
                latestAttendance.base64,
              ),
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              backgroundColor: "#F1EADB",
            }}
            resizeMode="cover"
          />
        ) : isValidUrl(latestAttendance?.SelfieURL__c) ? (
          <Image
            source={{ uri: String(latestAttendance.SelfieURL__c).trim() }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              backgroundColor: "#F1EADB",
            }}
            resizeMode="cover"
          />
        ) : (
          <Clock width={40} height={40} />
        ),
      subtitle: "Attendance Image",
    },
  ];

  const [accountName, setAccountName] = useState("");
  const [foodOrderAmount, setFoodOrderAmount] = useState<number>(0);
  const [accountCode, setAccountCode] = useState("");

  const [oilOrderAmount, setOilOrderAmount] = useState<number>(0);

  const formatAmountShort = (value: number) => {
    if (!isFinite(value) || value === 0) return "0";
    // show K for thousands, M for millions (rounded to one decimal)
    if (Math.abs(value) >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(Math.round(value));
  };

  const parseGeoLocation = (latlonglocation) => {
    console.log(
      "this is lat long locationh..................",
      latlonglocation,
    );

    if (!latlonglocation || typeof latlonglocation !== "string") {
      console.warn("Invalid or missing location data");
      return null;
    }

    const parts = latlonglocation.split(",");
    if (parts.length !== 2) {
      console.warn("Location string does not have exactly 2 parts (lat,lng)");
      return null;
    }

    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Unable to parse latitude or longitude as numbers");
      return null;
    }

    // console.log(`Parsed location: lat=${lat}, lng=${lng}`);
    return { lat, lng };
  };
  // ADD THIS FUNCTION HERE:
  const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    // Convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);

    const R = 6371000; // Earth's radius in meters
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Calculate days worked in current month
  const calculateDaysWorked = async (userId) => {
    try {
      // Get current month boundaries
      const monthBase = dateStore ? new Date(dateStore) : new Date();
      const currentYear = monthBase.getFullYear();
      const currentMonth = monthBase.getMonth(); // 0-indexed
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

      // Fetch all attendance records for the user in current month
      const attendanceRecords = await UniversalUpdateInsert({
        ObjectName: "Attendant__c",
        Type: "get",
        filters: [{ field: "User__c", value: userId }],
      });

      // console.log('All attendance records:', attendanceRecords);

      // Filter records for current month
      const currentMonthAttendance = attendanceRecords.filter((record) => {
        if (!record.AttendanceDate__c) return false;
        const recordDate = new Date(record.AttendanceDate__c);
        return recordDate >= firstDayOfMonth && recordDate <= lastDayOfMonth;
      });

      // console.log('Current month attendance records:', currentMonthAttendance);

      // Group by date and get latest record for each day
      const attendanceByDate = {};

      currentMonthAttendance.forEach((record) => {
        const dateKey = record.AttendanceDate__c;

        if (!attendanceByDate[dateKey]) {
          attendanceByDate[dateKey] = [];
        }
        attendanceByDate[dateKey].push(record);
      });

      // Count valid working days (Present, Halfday, but not full Leave days)
      let validDaysCount = 0;

      Object.keys(attendanceByDate).forEach((date) => {
        const dayRecords = attendanceByDate[date];

        // Sort by StartTime__c to get the latest record for that day
        const latestRecord = dayRecords
          .filter((rec) => rec.StartTime__c)
          .sort(
            (a, b) =>
              new Date(b.StartTime__c).getTime() -
              new Date(a.StartTime__c).getTime(),
          )[0];

        if (latestRecord) {
          const status = latestRecord.AttendanceStatus__c;
          const leaveDuration = latestRecord.LeaveDuration__c;

          // console.log(`Date: ${date}, Status: ${status}, Leave Duration: ${leaveDuration}`);

          if (status === "Present" || status === "Halfday") {
            validDaysCount++;
          } else if (
            status === "Leave" &&
            (leaveDuration === "First Half" || leaveDuration === "Second Half")
          ) {
            validDaysCount++;
          }
        }
      });

      // console.log(`Days worked calculation: ${validDaysCount} valid working days found`);
      return validDaysCount;
    } catch (error) {
      console.error("Error calculating days worked:", error);
      return 0;
    }
  };

  const fetchVisits = async () => {
    try {
      const accountData = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
      });

      const users = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });

      const RoutePlans = await UniversalUpdateInsert({
        ObjectName: "Route_Plans__c",
        Type: "get",
        filters: [{ field: "Assigned_To__c", value: users[0].Sf_Id }],
      });

      const todayForRoutePlans = new Date();
      const firstDayOfMonth = new Date(
        todayForRoutePlans.getFullYear(),
        todayForRoutePlans.getMonth(),
        1,
      );
      const currentDate = new Date();

      // Filter route plans active in current month
      const currentMonthRoutePlans = RoutePlans.filter((plan) => {
        const startDate = new Date(plan.Start_Date__c);
        const endDate = new Date(plan.End_Date__c);
        return startDate <= currentDate && endDate >= firstDayOfMonth;
      });

      if (currentMonthRoutePlans.length === 0) {
        console.log("⚠️ No Route Plans found for this month.");
        return;
      }

      const activePlanId = currentMonthRoutePlans[0].Sf_Id;

      // Get BeatDays
      const BeatDays = await UniversalUpdateInsert({
        ObjectName: "BeatDay__c",
        Type: "get",
      });

      // Get Visits
      const Visit = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      });

      // Categorized data for whole month
      const categorized = {
        Upcoming: [],
        "Check Out": [],
        "Check In": [],
      };

      // Loop from 1st of month to today
      for (
        let d = new Date(firstDayOfMonth);
        d <= currentDate;
        d.setDate(d.getDate() + 1)
      ) {
        const loopDate = moment(d).format("YYYY-MM-DD");

        // Find BeatDay for that date
        const beatDayForDate = BeatDays.find(
          (b) => b.Tour_Plan__c === activePlanId && (b.Beat_Date__c || b.BeatDate__c) === loopDate,
        );

        if (!beatDayForDate) continue;

        const filteredVisits = Visit.filter(
          (v) => v.BeatDay__c === beatDayForDate.Sf_Id,
        );

        filteredVisits.forEach((v) => {
          const accId = v.AccountId__c || v.AccountId;
          if (!accId) return;

          const accountDetails = accountData.find(
            (a) => a.Sf_Id === accId,
          );

          const base = {
            name: accountDetails?.Name || "",
            tier: accountDetails?.Class__c,
            target: accountDetails?.Channel__c,
            lastOrder: "5 days",
            ProductiveCall__c: v.ProductiveCall__c,
            propensity: "70%",
            AccountId: v.AccountId,
            sfId: v.Sf_Id,
            CheckInTime__c: v.CheckInTime__c,
            CheckOutTime__c: v.CheckOutTime__c,
            Phone: accountDetails?.Phone,
            BillingAddress: accountDetails?.BillingAddress,
            OTPVerified__c: accountDetails?.OTPVerified__c,
            CreditLimit__c: accountDetails?.CreditLimit__c,
            VisitStatus__c: v.VisitStatus__c,
            CheckInLocation__Longitude: v.CheckInLocation__Longitude__s,
            CheckInLocation__Latitude: v.CheckInLocation__Latitude__s,
            CheckOutLocation__Longitude: v.CheckOutLocation__Longitude__s,
            CheckOutLocation__Latitude: v.CheckOutLocation__Latitude__s,
            BillingLatitude: accountDetails?.BillingLatitude,
            BillingLongitude: accountDetails?.BillingLongitude,
            BeatDay__c: v?.BeatDay__c,
            BeatDate__c: loopDate, // add date info for clarity
          };

          if (v.CheckInTime__c && v.CheckOutTime__c) {
            categorized["Check Out"].push(base);
          } else if (
            (v.CheckInTime__c && !v.CheckOutTime__c) ||
            v.VisitStatus__c === "Check In"
          ) {
            categorized["Check In"].push(base);
          } else {
            categorized.Upcoming.push(base);
          }
        });
      }

      setCategorizedData(categorized);
      //console.log("LENTH OF CATEGORY COMPLETE>>>>>>>>>>>>>>>>",categorized.Completed.length)
      setOutletVisited(categorized?.Completed?.length);
    } catch (e) {
      console.error(" Error fetching Visit data:", e);
    }
  };

  const calculateBillCust = async () => {
    const InvoiceData = await UniversalUpdateInsert({
      ObjectName: "Invoice__c",
      Type: "get",
    });

    const currentMonth = moment().month(); // 0-indexed: Jan = 0
    const currentYear = moment().year();

    // Filter InvoiceData
    const filteredInvoices = InvoiceData.filter((invoice) => {
      const invoiceDate = moment(invoice.InvoiceDate__c, "YYYY-MM-DD");
      return (
        invoiceDate.month() === currentMonth &&
        invoiceDate.year() === currentYear
      );
    });
    setCurrentMonthBillCuts(filteredInvoices?.length);
    //console.log("YHIDS IS FILTERED INVOICEESS>>>>>>>>>>>>>>>",filteredInvoices)
  };

  // useEffect(() => {
  //   const loadData = async () => {
  //     const result = await fetchSchemeData();
  //     console.log('Function returned::::::::::::::::::::::::::', result);
  //   };
  //   loadData();
  // }, []);

  const [top10All, setTop10All] = useState(null);
  const [top10Retail, setTop10Retail] = useState(null);
  const [top10Wholesale, setTop10Wholesale] = useState(null);

  const getTop10CustomerSales = async (selectedCategory, subChannel = null) => {
    // 1️⃣ Get all invoices
    const InvoiceData = await UniversalUpdateInsert({
      ObjectName: "Invoice__c",
      Type: "get",
    });

    const currentMonth = moment().month();
    const currentYear = moment().year();

    // 2️⃣ Current month invoices
    const currentMonthInvoices = InvoiceData.filter((inv) => {
      if (!inv.InvoiceDate__c) return false;

      const date = moment(inv.InvoiceDate__c, "YYYY-MM-DD");
      return date.month() === currentMonth && date.year() === currentYear;
    });

    if (!currentMonthInvoices.length) return [];

    // 3️⃣ Get Accounts (for name + subchannel filter)
    const AccountData = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
      filters: [{ field: "Active__c", value: true }],
    });

    const accountMap = {};
    AccountData.forEach((acc) => {
      // 🔥 SubChannel filter logic (SubChannel__c is removed, so we ignore filter)
      if (
        subChannel === null || // overall
        true // Retail / Wholesale mapping is removed
      ) {
        accountMap[acc.Sf_Id] = acc;
      }
    });

    // 4️⃣ Filter invoices based on accountMap
    const filteredInvoices = currentMonthInvoices.filter(
      (inv) => accountMap[inv.Customer__c],
    );

    if (!filteredInvoices.length) return [];

    // 5️⃣ Invoice Items
    const invoiceIds = filteredInvoices.map((i) => i.Sf_Id);

    const InvoiceItemData = await UniversalUpdateInsert({
      ObjectName: "Invoice_Item__c",
      Type: "get",
      filters: [{ field: "Invoice__c", operator: "in", value: invoiceIds }],
    });

    if (!InvoiceItemData.length) return [];

    // 6️⃣ Products
    const productIds = [...new Set(InvoiceItemData.map((i) => i.Product__c))];

    const ProductData = await UniversalUpdateInsert({
      ObjectName: "Product2",
      Type: "get",
      filters: [{ field: "Sf_Id", operator: "in", value: productIds }],
    });

    const productMap = {};
    ProductData.forEach((p) => {
      productMap[p.Sf_Id] = p;
    });

    // 7️⃣ Customer-wise NetAmount calculation
    const customerSaleMap = {};

    InvoiceItemData.forEach((item) => {
      const product = productMap[item.Product__c];
      if (!product) return;

      // 🔥 Category filter
      if (product.Category__c !== selectedCategory) return;

      const invoice = filteredInvoices.find(
        (inv) => inv.Sf_Id === item.Invoice__c,
      );
      if (!invoice) return;

      const customerId = invoice.Customer__c;
      const netAmount = Number(item.NetAmount__c || 0);

      if (!customerSaleMap[customerId]) {
        customerSaleMap[customerId] = {
          customerId,
          customerName: accountMap[customerId]?.Name || "Unknown",
          subChannel: accountMap[customerId]?.SubChannel__c || null,
          totalNetAmount: 0,
        };
      }

      customerSaleMap[customerId].totalNetAmount += netAmount;
    });

    // 8️⃣ Top 10 customers
    return Object.values(customerSaleMap)
      .sort((a, b) => b.totalNetAmount - a.totalNetAmount)
      .slice(0, 10);
  };

  useFocusEffect(
    useCallback(() => {
      console.log(selected);

      const today = new Date().toISOString().split("T")[0];
      console.log("today", today);
      const initialize = async () => {
        /* ================= TOP 10 CUSTOMERS ================= */
        try {
          const top10Allget = await getTop10CustomerSales(selected, null);
          const top10Retailget = await getTop10CustomerSales(
            selected,
            "Retail",
          );
          const top10Wholesaleget = await getTop10CustomerSales(
            selected,
            "Wholesale",
          );

          setTop10All(top10Allget);
          setTop10Retail(top10Retailget);
          setTop10Wholesale(top10Wholesaleget);
        } catch (e) {
          console.error(" Top 10 error:", e);
        }

        let usersResult = [];
        let latestAttendanceRecord = null;

        /* ================= USERS + ATTENDANCE ================= */
        try {
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });

          setUsers(result);
          usersResult = result;

          if (!result?.[0]) return;

          let actualUserRole = result[0].Role || "";
          try {
            const roleQuery = `SELECT UserRole.Name FROM User WHERE Id = '${result[0].Sf_Id}'`;
            const roleRes = await fetchRecords("User", roleQuery);
            if (Array.isArray(roleRes) && roleRes.length > 0) {
              actualUserRole = roleRes[0].UserRole?.Name || result[0].Role || "";
            }
          } catch (roleErr) {
            console.error("Failed to query logged-in user role online in DashboardSR:", roleErr);
          }
          setUserRole(actualUserRole);

          const attendanceRecords = await UniversalUpdateInsert({
            ObjectName: "Attendant__c",
            Type: "get",
            filters: [
              { field: "User__c", value: result[0].Sf_Id },
              { field: "AttendanceDate__c", value: today },
            ],
          });

          latestAttendanceRecord = attendanceRecords
            .filter((rec) => rec.StartTime__c)
            .sort(
              (a, b) => new Date(b.StartTime__c) - new Date(a.StartTime__c),
            )[0];

          setLatestAttendance(latestAttendanceRecord);
        } catch (e) {
          console.error(" User / Attendance error:", e);
        }

        if (!usersResult?.[0]) return;

        /* ================= ROUTE + BEAT ================= */
        let filtered = [];
        let uniqueAccountIds = new Set();

        try {
          const loggedInUser = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          const beatdata = await UniversalUpdateInsert({
            ObjectName: "SR_Beat_Assignment__c",
            Type: "get",
            filters: [
              { field: "Assigned_To__c", value: loggedInUser[0]?.Sf_Id },
              { field: "isActive__c", value: true },
            ],
          });
          console.log("this is beat data for logged in user", beatdata);
          const uniqueBeatIds = [
            ...new Set(beatdata.map((item) => item.Beat__c).filter(Boolean)),
          ];
          // console.log("Unique Beat IDs:", uniqueBeatIds);
          const accountdata = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [
              // { field: "Beat__c", operator: 'in', value: uniqueBeatIds },
              { field: "Active__c", value: true },
            ],
          });
          // console.log("Accounts in user's beats:", accountdata?.length);
          setAllOutletsData(accountdata?.length || 0);
          uniqueAccountIds = new Set(
            accountdata.map((v) => v.Sf_Id).filter(Boolean),
          );
        } catch (e) {
          console.error(" Days worked error:", e);
        }

        try {
          const RoutePlans = await UniversalUpdateInsert({
            ObjectName: "Route_Plans__c",
            Type: "get",
            filters: [{ field: "Assigned_To__c", value: usersResult[0].Sf_Id }],
          });

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

          const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;

          const BeatDays = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
          });

          const routePlanIds = new Set(
            currentMonthRoutePlans.map((p) => p.Sf_Id),
          );

          const currentMonthBeatDayIds = new Set(
            BeatDays.filter((b) => {
              if (!routePlanIds.has(b.Tour_Plan__c)) return false;
              const d = new Date(b.BeatDate__c);
              return d >= firstDayOfMonth && d <= lastDayOfMonth;
            }).map((b) => b.Sf_Id),
          );

          const visitsForMonth = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [
              { field: "SoftDelete", value: false },
              {
                field: "BeatDay__c",
                operator: "in",
                value: [...currentMonthBeatDayIds],
              },
              {
                field: "AccountId__c",
                operator: "in",
                value: [...uniqueAccountIds],
              },
            ],
          });
          const uniqueCompletedAccounts = new Set(
            visitsForMonth
              .filter((item) => item.VisitStatus__c === "Check Out")
              .map((item) => item.AccountId__c || item.AccountId),
          );

          // console.log(
          //   "UNIQUE COMPLETED ACCOUNT COUNT >>>>>>>>>>>>",
          //   uniqueCompletedAccounts.size
          // );
          setOutletVisited(uniqueCompletedAccounts?.size || 0);

          // const visitsForMonth = await UniversalUpdateInsert({
          //   ObjectName: "Visit",
          //   Type: "get",
          //   filters: [
          //     { field: "SoftDelete", value: false },
          //     { field: "BeatDay__c", operator: 'in', value: [...currentMonthBeatDayIds] },
          //   ],
          // });
          // uniqueAccountIds = new Set(visitsForMonth.map(v => v.AccountId).filter(Boolean));
          // setAllOutletsData([...uniqueAccountIds].length);

          // console.log("Active Plan ID:", activePlanId);
          // console.log("Beat Days for current month:", BeatDays.length);
          // console.log("Visits for current month:", BeatDays);
          const beatDayForDate = BeatDays.find(
            (b) =>
              b.Tour_Plan__c === activePlanId && b.Beat_Date__c === dateStore,
          );
          console.log("Beat Day for date:", beatDayForDate);
          const Visit = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [{ field: "SoftDelete", value: false }],
          });
          const accountData = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
          });

          filtered = beatDayForDate
            ? Visit.filter(
              (v) => v.BeatDay__c === beatDayForDate.Sf_Id && (v.AccountId__c || v.AccountId),
            )
            : [];
          console.log("Filtered visits for date:", filtered.length);
          // Step 2: remove duplicates by Sf_Id + inactive account logic
          filtered = filtered.filter((v) => {
            if (!v.AccountId__c) return;
            return true;
          });

          // console.log(
          //   filtered.map(v => ({
          //     Sf_Id: v.Sf_Id,
          //     Status: v.VisitStatus__c,
          //     Productive: v.ProductiveCall__c,
          //     AddNewRetailer: v.Add_New_Retailer_Visit__c,
          //     AccountId: v.AccountId
          //   }))
          // );
          setOutletLength(filtered.length);
        } catch (e) {
          console.error(" Route / Beat error:", e);
        }

        /* ================= NON BUYING ================= */
        try {
          const InvoiceData = await UniversalUpdateInsert({
            ObjectName: "Invoice__c",
            Type: "get",
          });

          const currentMonth = moment().month();
          const currentYear = moment().year();

          const currentMonthInvoices = InvoiceData.filter((inv) => {
            if (!inv.InvoiceDate__c) return false;
            const d = moment(inv.InvoiceDate__c, "YYYY-MM-DD");
            return d.month() === currentMonth && d.year() === currentYear;
          });

          const buyingCustomerIds = new Set(
            currentMonthInvoices.map((i) => i.Customer__c).filter(Boolean),
          );

          const nonBuyingAccountIds = new Set(
            [...uniqueAccountIds].filter((id) => !buyingCustomerIds.has(id)),
          );

          setNonBuyingAccounts(nonBuyingAccountIds.size);
        } catch (e) {
          console.error(" Non buying error:", e);
        }

        /* ================= VISIT COUNTS + ISC ================= */
        try {
          let completedCount = 0;
          let billed = 0;

          for (const visit of filtered) {
            // Billed Count
            if (visit.ProductiveCall__c === true) {
              billed++;
            }

            // Completed Count (Completed + In Progress)
            if (
              visit.VisitStatus__c === "Check Out" ||
              visit.VisitStatus__c === "Check In"
            ) {
              completedCount++;
            }
          }

          const localVisits = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [{ field: "SoftDelete", value: false }],
          });

          const targetDate = dateStore || today;
          const todayPlannedVisits = localVisits.filter(
            (v) =>
              v.VisitDate__c === targetDate &&
              (v.VisitStatus__c === "Planned" || v.Status === "") &&
              (v.AccountId__c || v.AccountId)
          );
          const planned = todayPlannedVisits.length;

          setPlanned(planned);
          setCompleted(completedCount);
          setBilledOutlets(billed);

          const calculateISC = async () => {
            let visitsWithin100 = 0;

            for (const visit of filtered) {
              if (
                visit.VisitStatus__c === "Check Out" ||
                visit.VisitStatus__c === "Check In"
              ) {
                const lat = visit.CheckInLocation__Latitude__s;
                const lng = visit.CheckInLocation__Longitude__s;
                const targetAccountId = visit?.AccountId || visit?.AccountId__c || visit?.accountId;
                if (!targetAccountId) {
                  continue;
                }
                const accountForlatlong = await UniversalUpdateInsert({
                  ObjectName: "Account",
                  Type: "get",
                  filters: [{ field: "Sf_Id", value: targetAccountId }],
                });

                // if (lat && lng && accountForlatlong) {
                //   const dist = calculateDistanceInMeters(
                //     accountForlatlong[0]?.BillingLatitude,
                //     accountForlatlong[0]?.BillingLongitude,
                //     lat,
                //     lng
                //   );
                //   if (dist <= 150) visitsWithin100++;
                // }
                const outletLat = Number(
                  accountForlatlong?.[0]?.BillingLatitude,
                );
                const outletLng = Number(
                  accountForlatlong?.[0]?.BillingLongitude,
                );
                const checkInLat = Number(lat);
                const checkInLng = Number(lng);
                const isValid =
                  Number.isFinite(outletLat) &&
                  Number.isFinite(outletLng) &&
                  Number.isFinite(checkInLat) &&
                  Number.isFinite(checkInLng);
                // invalid/null/undefined/NaN
                if (!isValid) {
                  visitsWithin100++;
                  continue;
                }
                // 0,0 locations
                if (
                  outletLat === 0 ||
                  outletLng === 0 ||
                  checkInLat === 0 ||
                  checkInLng === 0
                ) {
                  visitsWithin100++;
                  continue;
                }
                const dist = calculateDistanceInMeters(
                  outletLat,
                  outletLng,
                  checkInLat,
                  checkInLng,
                );
                if (dist <= 150) {
                  visitsWithin100++;
                }
              }
            }
            return Math.round(
              completedCount > 0 ? (visitsWithin100 / completedCount) * 100 : 0,
            );
          };
          setIscPercentage(await calculateISC());
          setDaysWorked(await calculateDaysWorked(usersResult[0].Sf_Id));
        } catch (e) {
          console.error(" Visit / ISC error:", e);
        }

        /* ================= TARGET ================= */
        try {
          const TargetData = await UniversalUpdateInsert({
            ObjectName: "Target__c",
            Type: "get",
            filters: [
              { field: "TargetSetFor__c", value: usersResult[0].Sf_Id },
              { field: "Category__c", value: selected },
            ],
          });

          let tlsSum = 0,
            utlsSum = 0,
            mboSum = 0,
            mboSum2 = 0,
            mboSum3 = 0;
          let valueTargetSum = 0,
            valueTargetAchievedSum = 0;
          let mboTargetAchievedSum = 0,
            mboTargetAchievedSum2 = 0,
            mboTargetAchievedSum3 = 0;

          for (const t of TargetData || []) {
            const startRaw =
              t.StartDate__c ??
              t.EffectiveDate ??
              t.Effective_Date__c ??
              t.Start_Date__c ??
              null;

            const endRaw = t.EndDate__c ?? t.End_Date__c ?? t.EndDate ?? null;
            const freq = t.Frequency__c ?? t.Frequency ?? "Monthly";

            if (!overlapsMonth(startRaw, endRaw, dateStore)) continue;

            const rawTls = safeParseNumber(t.TLSTarget__c);
            const rawUtls = safeParseNumber(t.UTLSTarget__c);

            const rawMbo =
              (t.MBO_Type__c === null ||
                t.MBO_Type__c === undefined ||
                t.MBO_Type__c === "") &&
                (selected !== "Oils" || t.SubCategory__c === "")
                ? safeParseNumber(t.MBO_Target__c, true)
                : 0;

            const rawMbo2 =
              t.MBO_Type__c === "2 Oil MBO"
                ? safeParseNumber(t.MBO_Target__c, true)
                : 0;
            const rawMbo3 =
              t.MBO_Type__c === "3 Oil MBO"
                ? safeParseNumber(t.MBO_Target__c, true)
                : 0;

            const rawValueTarget =
              selected === "Oils" || selected === "Flour"
                ? safeParseNumber(t.VolumeTarget__c)
                : safeParseNumber(t.ValueTarget__c);

            const rawValueTargetAchieved =
              selected === "Oils" || selected === "Flour"
                ? safeParseNumber(t.VolumeTargetAchieved__c)
                : safeParseNumber(t.ValueTargetAchieved__c);

            const rawMboTargetAchieved =
              (t.MBO_Type__c === null ||
                t.MBO_Type__c === undefined ||
                t.MBO_Type__c === "") &&
                (selected !== "Oils" || t.SubCategory__c === "")
                ? safeParseNumber(t.MBO_Target_Achieved__c)
                : 0;

            const rawMboTargetAchieved2 =
              t.MBO_Type__c === "2 Oil MBO"
                ? safeParseNumber(t.MBO_Target_Achieved__c)
                : 0;
            const rawMboTargetAchieved3 =
              t.MBO_Type__c === "3 Oil MBO"
                ? safeParseNumber(t.MBO_Target_Achieved__c)
                : 0;

            tlsSum += toMonthly(rawTls, freq);
            utlsSum += toMonthly(rawUtls, freq);
            mboSum += toMonthly(rawMbo, freq);
            mboSum2 += toMonthly(rawMbo2, freq);
            mboSum3 += toMonthly(rawMbo3, freq);
            valueTargetSum += toMonthly(rawValueTarget, freq);
            valueTargetAchievedSum += toMonthly(rawValueTargetAchieved, freq);
            mboTargetAchievedSum += toMonthly(rawMboTargetAchieved, freq);
            mboTargetAchievedSum2 += toMonthly(rawMboTargetAchieved2, freq);
            mboTargetAchievedSum3 += toMonthly(rawMboTargetAchieved3, freq);
          }

          setTlsTarget(Math.round(tlsSum) || 0);
          setUtlsTarget(Math.round(utlsSum) || 0);
          setMboTarget(Math.round(mboSum) || 0);
          setMboTargetTwo(Math.round(mboSum2) || 0);
          setMboTargetThree(Math.round(mboSum3) || 0);
          setcateValue(Math.round(valueTargetSum) || 0);
          setcateValueAchive(Math.round(valueTargetAchievedSum) || 0);
          setAchiveMboTarget(Math.round(mboTargetAchievedSum) || 0);
          setAchiveMboTargetTwo(Math.round(mboTargetAchievedSum2) || 0);
          setAchiveMboTargetThree(Math.round(mboTargetAchievedSum3) || 0);
        } catch (e) {
          console.error(" Target error:", e);
        }

        /* ================= ORDER ITEMS ================= */
        try {
          const loggedInUser = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          const accessibleCategories = await getUserAccessibleCategories(
            loggedInUser,
          );
          // console.log('accessibleCategories', accessibleCategories)
          const orderedUniqueCategories = await getOrderedCategories(
            accessibleCategories,
          );
          // console.log('unique sub categories 1 ordered ', orderedUniqueCategories)
          setUniqueCategories(orderedUniqueCategories);

          const OrderItems = await UniversalUpdateInsert({
            ObjectName: "OrderItem",
            Type: "get",
          });

          const monthBase = dateStore ? new Date(dateStore) : new Date();
          const filterYear = monthBase.getFullYear();
          const filterMonth = monthBase.getMonth();
          const orderItemsThisMonth = (OrderItems || []).filter((oi) => {
            if (!oi?.CreatedDate) return false;
            const d = new Date(oi.CreatedDate);
            return (
              d.getFullYear() === filterYear && d.getMonth() === filterMonth
            );
          });

          if (!orderItemsThisMonth.length) {
            setOilOrderAmount(0);
            setFoodOrderAmount(0);
            return;
          }
          const allProducts = await UniversalUpdateInsert({
            ObjectName: "Product2",
            Type: "get",
          });

          const productMap = {};
          for (const p of allProducts) {
            if (p?.Sf_Id) productMap[p.Sf_Id] = p;
          }

          let oilSum = 0;
          let foodSum = 0;

          for (const oi of orderItemsThisMonth) {
            const netVal = safeParseNumber(oi.NetAmount__c);
            const product = productMap[oi.Product2Id];
            const category = String(product?.Category__c ?? "").toLowerCase();

            if (category === "oils") oilSum += netVal;
            else foodSum += netVal;
          }

          setOilOrderAmount(Math.round(oilSum));
          setFoodOrderAmount(Math.round(foodSum));

          // fetchVisits();
          calculateBillCust();
        } catch (e) {
          console.error(" Order items error:", e);
          setOilOrderAmount(0);
          setFoodOrderAmount(0);
        }
      };

      initialize();
      /* Original useFocusEffect dependency:
      }, [selected]),
      */
    }, [selected, refreshTrigger]),
  );

  return (
    <SafeAreaProvider style={styles.container}>
      {/* <View style={styles.dropdownWrapper}>
        <Ionicons name="person-sharp" size={20} color="#C9A24D" style={styles.userIcon} />
        <Dropdown
          data={users}
          labelField="Name"
          valueField="id"
          placeholder="Select user"
          value={selectedUser}
          onChange={(item) => setSelectedUser(item.value)}
          renderItem={renderUserItem}
          style={styles.dropdown}
          containerStyle={styles.dropdownContainer}
        />
      </View> */}

      {users[0]?.DeveloperName !== "MT_SO" &&
        users[0]?.DeveloperName !== "MT_Merchandiser" && (
          <>
            <View style={styles.tabRow}>
              {["Live Status", "Performance"].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveTab(tab as any)}
                    style={styles.tab}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={Gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.checkInGradient,
                          tab === "Live Status"
                            ? {
                              borderTopLeftRadius: 25,
                              borderBottomLeftRadius: 25,
                            }
                            : {
                              borderTopRightRadius: 25,
                              borderBottomRightRadius: 25,
                            },
                        ]}
                      >
                        <Text style={styles.tabTextActive}>{tab}</Text>
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          styles.tabInactive,
                          tab === "Live Status"
                            ? {
                              borderTopLeftRadius: 25,
                              borderBottomLeftRadius: 25,
                            }
                            : {
                              borderTopRightRadius: 25,
                              borderBottomRightRadius: 25,
                            },
                        ]}
                      >
                        <Text style={styles.tabTextInactive}>{tab}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "Live Status" ? (
          <>
            {latestAttendance?.AttendanceStatus__c === "Leave" &&
              String(latestAttendance?.Approval_Status__c || "")
                .trim()
                .toLowerCase() !== "rejected" && (
                <View style={dashboardStyles.leaveCard}>
                  <LinearGradient
                    colors={["#C9A24D", "#A67C2E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={dashboardStyles.leaveGradientBar}
                  />
                  <View style={dashboardStyles.leaveCardHeader}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#C9A24D"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={dashboardStyles.leaveTitle}>
                        Leave Details
                      </Text>
                    </View>
                    <View
                      style={[
                        dashboardStyles.statusBadge,
                        String(
                          latestAttendance?.Approval_Status__c || "pending",
                        )
                          .trim()
                          .toLowerCase() === "approved" ||
                          String(latestAttendance?.Approval_Status__c || "")
                            .trim()
                            .toLowerCase() === "accepted"
                          ? dashboardStyles.badgeApproved
                          : dashboardStyles.badgePending,
                      ]}
                    >
                      <Text
                        style={[
                          dashboardStyles.statusText,
                          String(
                            latestAttendance?.Approval_Status__c || "pending",
                          )
                            .trim()
                            .toLowerCase() === "approved" ||
                            String(latestAttendance?.Approval_Status__c || "")
                              .trim()
                              .toLowerCase() === "accepted"
                            ? dashboardStyles.textApproved
                            : dashboardStyles.textPending,
                        ]}
                      >
                        {latestAttendance?.Approval_Status__c || "Pending"}
                      </Text>
                    </View>
                  </View>

                  <View style={dashboardStyles.leaveInfoRow}>
                    <Text style={dashboardStyles.leaveLabel}>Status:</Text>
                    <Text style={dashboardStyles.leaveValue}>
                      {String(latestAttendance?.Approval_Status__c || "")
                        .trim()
                        .toLowerCase() === "approved" ||
                        String(latestAttendance?.Approval_Status__c || "")
                          .trim()
                          .toLowerCase() === "accepted"
                        ? latestAttendance?.LeaveDuration__c || "Full Day"
                        : "Pending"}
                    </Text>
                  </View>

                  {latestAttendance?.Reason__c ||
                    latestAttendance?.Other_Leave_Reason__c ||
                    latestAttendance?.CheckInComment__c ? (
                    <View style={dashboardStyles.leaveInfoRow}>
                      <Text style={dashboardStyles.leaveLabel}>Reason:</Text>
                      <Text
                        style={dashboardStyles.leaveValue}
                        numberOfLines={2}
                      >
                        {latestAttendance?.Other_Leave_Reason__c ||
                          latestAttendance?.Reason__c ||
                          latestAttendance?.CheckInComment__c}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

            {isRejectedLeave && (
              <View style={dashboardStyles.rejectedLeaveCard}>
                <View style={dashboardStyles.rejectedLeaveGradientBar} />
                <View style={dashboardStyles.rejectedLeaveCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color="#B3261E"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={dashboardStyles.rejectedLeaveTitle}>
                      Leave Rejected
                    </Text>
                  </View>
                  <View style={dashboardStyles.badgeRejected}>
                    <Text style={dashboardStyles.textRejected}>
                      Rejected
                    </Text>
                  </View>
                </View>

                <Text style={dashboardStyles.rejectedLeaveMessage}>
                  Your leave was rejected. Please click on <Text style={{ fontWeight: "700" }}>Get Data</Text> and re-mark your attendance.
                </Text>
              </View>
            )}

            <View style={styles.beatRow}>
              {/* <Pressable style={[styles.beatCard, { flex: 0.9 }]}>
                <Entypo name="plus" size={24} color="#C9A24D" />
                <Text style={styles.beatText}>Schedule Beat</Text>
              </Pressable> */}
              {/* {
                alredyCheckIn?.VisitId &&
                <View style={[styles.beatCard, styles.currentBeat, { flex: 2 }]}>
                  <View>
                    <Text style={styles.currentTitle}>{accountName} <Text style={{ fontSize: 12 }}>{accountCode ? '(#' + accountCode + ')' : ''}</Text> </Text>
                    <Text style={styles.currentSubtitle}>Current Beat</Text>
                  </View>
                </View>
              } */}
            </View>

            <View style={styles.grid}>
              {liveStatusMetrics.map((item, index) => {
                const cardWidth = (SCREEN_WIDTH - H_PADDING * 2 - GAP * 2) / 3;
                const marginRight = (index + 1) % 3 === 0 ? 0 : GAP;

                return (
                  <View
                    key={item.key}
                    style={[
                      styles.card,
                      {
                        width: cardWidth,
                        minWidth: cardWidth,
                        marginBottom: GAP,
                        marginRight: marginRight,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.metricValueWrapper,
                        maxHeight > 0 && { height: maxHeight },
                      ]}
                      onLayout={onLayout}
                    >
                      {typeof item.title === "string" ? (
                        <Text
                          style={
                            item?.titleColor
                              ? styles.activeText
                              : styles.metricValue
                          }
                        >
                          {item.title}
                        </Text>
                      ) : (
                        item.title
                      )}
                    </View>
                    {item.subtitle && (
                      <Text style={styles.metricSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* CALL SUMMARY CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("VisitList")}
              style={dashboardStyles.callSummaryCard}
            >
              <View style={dashboardStyles.callSummaryHeader}>
                <View style={dashboardStyles.callSummaryHeaderLeft}>
                  <View style={dashboardStyles.callSummaryIconWrap}>
                    <Ionicons name="stats-chart" size={17} color="#C9A24D" />
                  </View>
                  <Text style={dashboardStyles.callSummaryTitle}>Visit Summary</Text>
                </View>
                <View style={dashboardStyles.callSummaryHeaderRight}>
                  <Text style={dashboardStyles.callSummaryViewAll}>View Details</Text>
                  <Ionicons name="chevron-forward" size={15} color="#C9A24D" />
                </View>
              </View>

              <View style={dashboardStyles.callSummaryDivider} />

              <View style={dashboardStyles.callSummaryMetricsRow}>
                {/* Total Visits */}
                <View style={dashboardStyles.callSummaryMetricItem}>
                  <Text style={dashboardStyles.callSummaryMetricValue} numberOfLines={1} adjustsFontSizeToFit>{outletLength}</Text>
                  <Text style={dashboardStyles.callSummaryMetricLabel} numberOfLines={1} adjustsFontSizeToFit>Total Visits</Text>
                </View>

                <View style={dashboardStyles.callSummaryMetricDivider} />

                {/* Productive */}
                <View style={dashboardStyles.callSummaryMetricItem}>
                  <Text style={[dashboardStyles.callSummaryMetricValue, { color: "#2E7D5B" }]} numberOfLines={1} adjustsFontSizeToFit>
                    {billedOutlets}
                  </Text>
                  <Text style={dashboardStyles.callSummaryMetricLabel} numberOfLines={1} adjustsFontSizeToFit>Productive</Text>
                </View>

                <View style={dashboardStyles.callSummaryMetricDivider} />

                {/* Non-Productive */}
                <View style={dashboardStyles.callSummaryMetricItem}>
                  <Text style={[dashboardStyles.callSummaryMetricValue, { color: "#ea580c" }]} numberOfLines={1} adjustsFontSizeToFit>
                    {Math.max(0, completed - billedOutlets)}
                  </Text>
                  <Text style={dashboardStyles.callSummaryMetricLabel} numberOfLines={1} adjustsFontSizeToFit>Non-Productive</Text>
                </View>

                <View style={dashboardStyles.callSummaryMetricDivider} />

                {/* Visited */}
                <View style={dashboardStyles.callSummaryMetricItem}>
                  <Text style={[dashboardStyles.callSummaryMetricValue, { color: "#1F1D1A" }]} numberOfLines={1} adjustsFontSizeToFit>
                    {completed}
                  </Text>
                  <Text style={dashboardStyles.callSummaryMetricLabel} numberOfLines={1} adjustsFontSizeToFit>Visited</Text>
                </View>
              </View>
            </TouchableOpacity>

            <SalesReportsSection />

            <DashboardSRCategory />

            {users[0]?.DeveloperName === "H_T_SR" && (
              <>
                <Leaderboard />
              </>
            )}

            {/* <View style={styles.orderSummary}> */}
            {/* <View style={styles.orderCard}>
                <View style={styles.colAlign}>
                  <Text style={styles.orderValue}>{formatAmountShort(oilOrderAmount)}</Text>
                  <Text style={styles.orderLabel}>
                    Oil Spot Sales <Text style={{ fontWeight: '400', fontSize: 12 }}>(Net Amount)</Text>
                  </Text>
                </View>
                <Image source={require('../../assets/images/oil.png')} resizeMode="contain" />
              </View>
              <View style={styles.orderCard}>
                <View style={styles.colAlign}>
                  <Text style={styles.orderValue}>{formatAmountShort(foodOrderAmount)}</Text>
                  <Text style={styles.orderLabel}>
                    Food Spot Sales <Text style={{ fontWeight: '400', fontSize: 12 }}>(Net Amount)</Text>
                  </Text>
                </View>
                <Image source={require('../../assets/images/food.png')} resizeMode="contain" />
              </View> */}

            {/* </View> */}
          </>
        ) : (
          <>
            {/* <View style={{ padding: 10, paddingTop: 0 }}>
              <View style={styles.filterWrapper}>
                <TouchableOpacity
                  ref={filterRef}
                  onPress={openDropdown}
                  style={styles.filterButton}
                >
                  <Ionicons name="filter-outline" size={20} color="#A67C2E" />
                  <Text style={styles.filterText}>
                    {selected?.toLowerCase() === "flour" ? "Staples" : selected}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#A67C2E" />
                </TouchableOpacity>

                <Modal
                  transparent
                  visible={visible}
                  animationType="fade"
                  onRequestClose={() => setVisible(false)}
                >
                  <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setVisible(false)}
                  >
                    <Pressable
                      style={[
                        styles.filterMenu,
                        { top: dropdownPos.top, left: dropdownPos.left },
                      ]}
                      onPress={(e) => e.stopPropagation()}
                    >
                      {uniqueCategories.map((item, i) => (
                        <Pressable
                          key={i}
                          onPress={() => {
                            setSelected(item); // now works on Android
                            setVisible(false);
                          }}
                          style={[
                            styles.menuItem,
                            selected === item && styles.menuItemActive,
                          ]}
                        >
                          <Text style={styles.menuText}>
                            {item?.toLowerCase() === "flour" ? "Staples" : item}
                          </Text>
                        </Pressable>
                      ))}
                    </Pressable>
                  </Pressable>
                </Modal>
              </View>
            </View> */}

            {/* <View style={styles.performance}>
              {metricsDynamic.map((m) => (
                <MetricCard key={m.key} {...m} />
              ))}
            </View> */}

            {/* POCKET MIS Section */}
            <View style={dashboardStyles.pocketMisContainer}>
              <View style={dashboardStyles.pocketMisHeaderContainer}>
                <LinearGradient
                  colors={["#C9A24D", "#A67C2E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={dashboardStyles.pocketMisGradientBar}
                />
                <Text style={dashboardStyles.pocketMisTitle}>POCKET MIS</Text>
              </View>

              <View style={dashboardStyles.pocketMisGrid}>
                {pocketMisItems
                  .filter((item) => item.id !== "engagement" || isEngagementAllowed)
                  .map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.id === "daily_dashboard") {
                        navigation.navigate("DailyDashboard");
                      } else if (item.id === "date_wise_summary") {
                        navigation.navigate("DateWiseSummary");
                      } else if (item.id === "mtd_sales") {
                        navigation.navigate("MTDSales");
                      } else if (item.id === "mtd_highlights") {
                        navigation.navigate("MTDHighlights");
                      } else if (item.id === "team_coverage") {
                        navigation.navigate("TeamCoverage");
                      } else if (item.id === "engagement") {
                        navigation.navigate("EngagementScreen");
                      } else {
                        dispatch(
                          showToast({
                            message: `${item.title} feature coming soon!`,
                            type: "info",
                          })
                        );
                      }
                    }}
                    style={dashboardStyles.pocketMisCard}
                  >
                    <View style={[dashboardStyles.pocketMisIconWrapper, { backgroundColor: item.color }]}>
                      <MaterialCommunityIcons name={item.icon} size={20} color={item.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={dashboardStyles.pocketMisCardText} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* <View>
              <TopPerformingOLCard
                title="Top Performing OL"
                top10Account={top10All}
              />
              <TopPerformingOLCard
                title="Top Performing Retail"
                top10Account={top10Retail}
              />
              <TopPerformingOLCard
                title="Top Performing Wholesale"
                top10Account={top10Wholesale}
              />
            </View> */}
          </>
        )}
      </ScrollView>
    </SafeAreaProvider>
  );
};

export default DashboardSR;
