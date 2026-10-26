import React, { FC, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform,
  Modal,
  ToastAndroid,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import moment from "moment";
import Ionicons from "../../components/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { RFValue } from "react-native-responsive-fontsize";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../../utils/networkUtils";
import { useDispatch } from "react-redux";
import { showToast } from "../../redux/slices/toastSlice";
import { formatUnitsWithCases, formatCasesWithUnits } from "../../utils/helper/caseUnits";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;
const CONTAINER_PADDING = 12;
const CARD_MARGIN = 2;
const DAY_CARD_WIDTH = (width - (CONTAINER_PADDING * 2) - (CARD_MARGIN * 2 * 7)) / 7;
const DAY_CARD_STEP = DAY_CARD_WIDTH + (CARD_MARGIN * 2);

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  onPress?: () => void;
}

const MetricCard: FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  bgColor,
  badgeText,
  badgeBg = "#FBEFD8",
  badgeColor = "#D08C1F",
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
    >
      {badgeText && (
        <View style={[styles.cardBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.cardBadgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      )}
      <View style={[styles.cardIconWrap, { backgroundColor: bgColor }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <View style={styles.cardTextContent}>
        <Text style={styles.cardValue}>{value}</Text>
        <Text style={styles.cardLabel}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const parseMomentTime = (timeStr: any): moment.Moment | null => {
  if (!timeStr || timeStr === "--:--" || timeStr === "--" || timeStr === "null") return null;
  const str = String(timeStr).trim();
  if (str.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const isoM = moment(str);
    if (isoM.isValid()) return isoM;
  }
  const m = moment(str, ["HH:mm:ss", "HH:mm", "hh:mm A", "hh:mm:ss A"], true);
  if (m.isValid()) return m;
  const fallback = moment(str);
  return fallback.isValid() ? fallback : null;
};

const formatTimeDisplay = (timeStr: any): string => {
  const m = parseMomentTime(timeStr);
  return m ? m.format("hh:mm A") : "--:--";
};

const getMinCheckIn = (visits: any[]): string => {
  const times = visits
    .map((v) => parseMomentTime(v.CheckInTime__c))
    .filter((t): t is moment.Moment => t !== null && t.isValid());
  if (times.length === 0) return "--:--";
  const minTime = moment.min(times);
  return minTime.format("hh:mm A");
};

const getMaxCheckOut = (visits: any[]): string => {
  const times = visits
    .map((v) => parseMomentTime(v.CheckOutTime__c))
    .filter((t): t is moment.Moment => t !== null && t.isValid());
  if (times.length === 0) return "--:--";
  const maxTime = moment.max(times);
  return maxTime.format("hh:mm A");
};

const hasRoleAccess = (userRole: string, allowedRoles: string[]): boolean => {
  if (!userRole) return true; // Default fallback to show if no role is loaded yet
  const upperRole = userRole.toUpperCase();
  return allowedRoles.some((role) => upperRole.includes(role.toUpperCase()));
};

const idMatches = (id1?: string, id2?: string): boolean => {
  if (!id1 || !id2) return false;
  const clean1 = String(id1).trim();
  const clean2 = String(id2).trim();
  if (clean1 === clean2) return true;
  return clean1.slice(0, 15) === clean2.slice(0, 15);
};

const DateWiseSummary: FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarReferenceDate, setCalendarReferenceDate] = useState<Date>(new Date());
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto scroll horizontal calendar to center selected date when reference date changes
  useEffect(() => {
    const offset = 30 * DAY_CARD_STEP - (width / 2) + (DAY_CARD_STEP / 2);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ x: offset, animated: true });
    }, 150);
  }, [calendarReferenceDate]);

  const { fetchRecords } = useApiFetch();
  const dispatch = useDispatch();

  // User details
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  // Subordinates list
  const [subordinates, setSubordinates] = useState<any[]>([]);

  // Filter states
  const [selectedPersona, setSelectedPersona] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState("All");
  const [personaList, setPersonaList] = useState<string[]>([]);
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [openPersonaPicker, setOpenPersonaPicker] = useState(false);
  const [openEmployeePicker, setOpenEmployeePicker] = useState(false);

  // Raw datasets for online queries
  const [rawBeatDays, setRawBeatDays] = useState<any[]>([]);
  const [rawAttendances, setRawAttendances] = useState<any[]>([]);
  const [rawVisits, setRawVisits] = useState<any[]>([]);
  const [rawTcVisits, setRawTcVisits] = useState<any[]>([]);
  const [rawPcVisits, setRawPcVisits] = useState<any[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [rawSurveyResponses, setRawSurveyResponses] = useState<any[]>([]);
  const [rawSurveyAssignments, setRawSurveyAssignments] = useState<any[]>([]);
  const [rawSurveyTargets, setRawSurveyTargets] = useState<any[]>([]);
  const [rawSurveyTemplates, setRawSurveyTemplates] = useState<any[]>([]);

  // Drilldown detail lists
  const [visitAuthDetail, setVisitAuthDetail] = useState<any[]>([]);
  const [dayInDetail, setDayInDetail] = useState<any[]>([]);
  const [dayOutDetail, setDayOutDetail] = useState<any[]>([]);
  const [tcDetail, setTcDetail] = useState<any[]>([]);
  const [pcDetail, setPcDetail] = useState<any[]>([]);
  const [salesQtyDetail, setSalesQtyDetail] = useState<any[]>([]);
  const [productivityDetail, setProductivityDetail] = useState<any[]>([]);
  const [salesOrderValDetail, setSalesOrderValDetail] = useState<any[]>([]);
  const [attendanceDetail, setAttendanceDetail] = useState<any[]>([]);

  // Metrics states
  const [visitAuth, setVisitAuth] = useState("0 / 0");
  const [dayInTime, setDayInTime] = useState("--:--");
  const [dayOutTime, setDayOutTime] = useState("--:--");
  const [workingDuration, setWorkingDuration] = useState("--:--");
  const [tc, setTc] = useState("0");
  const [pc, setPc] = useState("0");
  const [salesQty, setSalesQty] = useState("0 Pcs");
  const [productivity, setProductivity] = useState("0%");
  const [salesOrderVal, setSalesOrderVal] = useState("₹ 0");
  const [attendanceReport, setAttendanceReport] = useState("Not Marked");
  const [surveySummaryVal, setSurveySummaryVal] = useState("0 Comp / 0 Pend");

  // Dates with activity for calendar dot rendering
  const [activeDates, setActiveDates] = useState<string[]>([]);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);

  // Modal Month state
  const [currentMonth, setCurrentMonth] = useState<moment.Moment>(moment());

  // Roles list
  const allowedGroupA = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM"];
  const allowedGroupB = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM", "VP"];
  const allowedGroupC = ["ASM", "RSM", "AGM", "GM", "VP"];

  // Fetch current user and dates with activity
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        if (loggedInUser && loggedInUser.length > 0) {
          setUserId(loggedInUser[0].Sf_Id);
          setUserRole(loggedInUser[0].Role || "");
          setUserName(loggedInUser[0].Name || "");

          // Get active dates (dates where user has BeatDay__c or Attendant__c entries)
          const bDays = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
            filters: [{ field: "OwnerId", value: loggedInUser[0].Sf_Id }],
          });
          const dates = bDays.map((bd: any) => bd.Beat_Date__c).filter(Boolean);
          setActiveDates([...new Set(dates)]);

          // Fetch all Attendance records for the user
          const attn = await UniversalUpdateInsert({
            ObjectName: "Attendant__c",
            Type: "get",
            filters: [{ field: "User__c", value: loggedInUser[0].Sf_Id }],
          });
          setAllAttendance(Array.isArray(attn) ? attn : []);

          // Fetch subordinates from Salesforce User table
          try {
            const query = `SELECT Id, Name, UserRole.Name, Phone FROM User WHERE ManagerId = '${loggedInUser[0].Sf_Id}'`;
            const records = await fetchRecords("User", query);
            if (Array.isArray(records)) {
              const mapped = records.map((u: any) => ({
                Sf_Id: u.Id,
                Name: u.Name,
                Role: u.UserRole?.Name || "Representative",
                Phone: u.Phone || "",
              }));
              setSubordinates(mapped);
              const uniqueRoles = [...new Set(mapped.map((s: any) => s.Role))].filter(Boolean);
              setPersonaList(uniqueRoles as string[]);
            }
          } catch (apiErr) {
            console.error("Salesforce User query failed in DateWiseSummary:", apiErr);
          }
        }
      } catch (err) {
        console.error("Error loading user info:", err);
      } finally {
        setIsInitialized(true);
      }
    };
    initializeUser();
  }, []);

  // Dynamically update Employee dropdown list based on Selected Persona (include self)
  useEffect(() => {
    if (!userId) return;
    const selfObject = {
      Sf_Id: userId,
      Name: `${userName || "Self"} (Self)`,
      Role: userRole || "Manager",
      Phone: "",
    };

    let baseList = [selfObject, ...subordinates];
    if (selectedPersona === "All") {
      setEmployeeList(baseList);
    } else {
      const filtered = baseList.filter((sub) => sub.Role === selectedPersona);
      setEmployeeList(filtered);
    }
    setSelectedEmployee("All"); // Reset employee selection when persona changes
  }, [selectedPersona, subordinates, userId, userName, userRole]);

  // Fetch raw metrics data online from Salesforce for all relevant users (logged-in user + subordinates)
  useEffect(() => {
    if (!isInitialized || !userId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const dateStr = moment(selectedDate).format("YYYY-MM-DD");
        const allUserIds = [userId, ...subordinates.map((s) => s.Sf_Id)];
        const allUserIdsStr = allUserIds.map((id) => `'${id}'`).join(",");

        // 1. Fetch Beat_Day__c online
        let beatDaysList: any[] = [];
        try {
          const beatDayQuery = `SELECT Id, OwnerId, First_Call_Time__c, EndOfDayTime__c, Total_Calls__c, Productive_Calls__c, SecOrderQuantityPcs__c, SecOrderValue__c, Productivity__c, Attendance__c, Approval_Status__c FROM Beat_Day__c WHERE Beat_Date__c = ${dateStr} AND OwnerId IN (${allUserIdsStr}) AND Approval_Status__c = 'Approved'`;
          const beatDaysResult = await fetchRecords("Beat_Day__c", beatDayQuery);
          if (Array.isArray(beatDaysResult)) {
            beatDaysList = beatDaysResult;
          }
        } catch (err) {
          console.error("Salesforce Beat_Day__c query failed:", err);
        }

        // 2. Fetch Attendance__c online
        let attendanceList: any[] = [];
        try {
          const attendanceQuery = `SELECT User__c, AttendanceStatus__c, AttendanceDate__c, AttendanceStartTime__c, AttendanceEndTime__c, Working_Hours__c, Attendance_Leave_Reason__c, CapturedSelfie__c, GeoLocation__c, Reason__c, SelfieURL__c, Attendance_Image_URL__c FROM Attendance__c WHERE AttendanceDate__c = ${dateStr}`;
          const attendanceResult = await fetchRecords("Attendance__c", attendanceQuery);
          if (Array.isArray(attendanceResult)) {
            attendanceList = attendanceResult;
          }
        } catch (err) {
          console.error("Salesforce Attendance__c query failed:", err);
        }

        // 3. Fetch Visit__c online (for Auth, PC, details)
        let visitsList: any[] = [];
        try {
          const visitsQuery = `SELECT Id, Joint_Visit_User_Validated__c, ProductiveCall__c, BeatDay__c, CreatedById, AccountId__c, AccountId__r.Name, CheckInTime__c, CheckOutTime__c, VisitDate__c, IsOrderPlaced__c, BeatDay__r.Route_Plans__r.Assigned_To__c FROM Visit__c WHERE BeatDay__r.Beat_Date__c = ${dateStr} AND BeatDay__r.Route_Plans__r.Assigned_To__c IN (${allUserIdsStr}) AND BeatDay__r.Approval_Status__c = 'Approved'`;
          const visitsResult = await fetchRecords("Visit__c", visitsQuery);
          if (Array.isArray(visitsResult)) {
            visitsList = visitsResult;
          }
        } catch (err) {
          console.error("Salesforce Visit__c query failed:", err);
        }

        // 4. Fetch Visit__c online (for TC - total calls)
        let tcVisitsList: any[] = [];
        try {
          const connected = await isInternetAvailable();
          if (connected) {
            const tcQuery = `SELECT Id, BeatDay__r.Route_Plans__r.Assigned_To__c, BeatDay__r.Approval_Status__c, BeatDay__r.Beat_Date__c, AccountId__c, AccountId__r.Name, CheckInTime__c, VisitDate__c, IsOrderPlaced__c FROM Visit__c WHERE VisitDate__c = TODAY AND BeatDay__r.Route_Plans__r.Assigned_To__c IN (${allUserIdsStr}) AND BeatDay__r.Approval_Status__c = 'Approved' AND BeatDay__r.Beat_Date__c = ${dateStr}`;
            const tcResult = await fetchRecords("Visit__c", tcQuery);
            if (Array.isArray(tcResult)) {
              tcVisitsList = tcResult;
            }
          }
        } catch (err) {
          console.error("Salesforce Visit__c TC query failed:", err);
        }

        // 5. Fetch Visit__c online (for PC - productive calls)
        let pcVisitsList: any[] = [];
        try {
          const connected = await isInternetAvailable();
          if (connected) {
            const pcQuery = `SELECT Id, BeatDay__r.Route_Plans__r.Assigned_To__c, BeatDay__r.Approval_Status__c, BeatDay__r.Beat_Date__c, ProductiveCall__c, AccountId__c, AccountId__r.Name, CheckInTime__c, VisitDate__c, IsOrderPlaced__c FROM Visit__c WHERE VisitDate__c = TODAY AND BeatDay__r.Route_Plans__r.Assigned_To__c IN (${allUserIdsStr}) AND BeatDay__r.Approval_Status__c = 'Approved' AND BeatDay__r.Beat_Date__c = ${dateStr} AND ProductiveCall__c = true`;
            const pcResult = await fetchRecords("Visit__c", pcQuery);
            if (Array.isArray(pcResult)) {
              pcVisitsList = pcResult;
            }
          }
        } catch (err) {
          console.error("Salesforce Visit__c PC query failed:", err);
        }

        // 6. Fetch Order_Item__c aggregate (for Sales Quantity / Orders)
        let ordersList: any[] = [];
        try {
          const orderQuery = `SELECT OrderId__r.Order_Placed_By__r.Name SalesRepName, OrderId__r.Order_Placed_By__r.User_Type__c Role, OrderId__r.Order_Placed_By__r.Manager.Name ManagerName, OrderId__r.EffectiveDate__c OrderDate, SUM(Quantity_In_Pcs__c) SalesQuantityPcs, SUM(Quantity__c) SalesQuantityKG, SUM(TotalPrice__c) SalesOrderValue, COUNT_DISTINCT(OrderId__c) TotalOrdersPlaced FROM Order_Item__c WHERE OrderId__c IN (SELECT Id FROM Order__c WHERE EffectiveDate__c = ${dateStr} AND (Order_Placed_By__c = '${userId}' OR Order_Placed_By__r.ManagerId = '${userId}' OR Order_Placed_By__r.Manager.ManagerId = '${userId}' OR Order_Placed_By__r.Manager.Manager.ManagerId = '${userId}')) GROUP BY OrderId__r.Order_Placed_By__r.Name, OrderId__r.Order_Placed_By__r.User_Type__c, OrderId__r.Order_Placed_By__r.Manager.Name, OrderId__r.EffectiveDate__c ORDER BY OrderId__r.Order_Placed_By__r.Name ASC`;
          console.log("DEBUG Order Query Str:", orderQuery);
          const ordersResult = await fetchRecords("Order_Item__c", orderQuery);
          console.log("DEBUG Order Query Result:", JSON.stringify(ordersResult));
          if (Array.isArray(ordersResult)) {
            ordersList = ordersResult.map((item: any) => ({
              ...item,
              SalesRepName: item.SalesRepName || item.Name || item.OrderId__r?.Order_Placed_By__r?.Name || "",
              Role: item.Role || item.User_Type__c || item.OrderId__r?.Order_Placed_By__r?.User_Type__c || "",
              SalesQuantityPcs: Number(item.SalesQuantityPcs ?? item.expr0 ?? item.Quantity_In_Pcs__c ?? 0),
              SalesQuantityKG: Number(item.SalesQuantityKG ?? item.expr1 ?? item.Quantity__c ?? 0),
              SalesOrderValue: Number(item.SalesOrderValue ?? item.expr2 ?? item.TotalPrice__c ?? 0),
              TotalOrdersPlaced: Number(item.TotalOrdersPlaced ?? item.expr3 ?? item.OrderCount ?? 0),
            }));
          }
        } catch (err) {
          console.error("Salesforce Order_Item__c query failed:", err);
        }

        // 7. Fetch Survey_Response__c (Completed surveys query)
        let surveyResponsesList: any[] = [];
        try {
          const surveyQuery = `SELECT CreatedById, CreatedBy.Name userName, COUNT(Id) Completed FROM Survey_Response__c WHERE Status__c = 'Submitted' GROUP BY CreatedById, CreatedBy.Name`;
          const surveyRes = await fetchRecords("Survey_Response__c", surveyQuery);
          if (Array.isArray(surveyRes)) {
            surveyResponsesList = surveyRes;
          }
        } catch (err) {
          console.error("Salesforce Survey_Response__c query failed:", err);
        }

        // 8. Fetch Survey Assignments, Targets, & Templates (Pending survey queries from visit details)
        let surveyAssignmentsList: any[] = [];
        let surveyTargetsList: any[] = [];
        let surveyTemplatesList: any[] = [];
        try {
          const assignmentsQuery = `SELECT Id, Name, Active__c, Survey_Template__c, Assignment_Type__c FROM Survey_Assignment__c WHERE Active__c = true`;
          const apiAssignments = await fetchRecords("Survey_Assignment__c", assignmentsQuery);
          if (Array.isArray(apiAssignments)) surveyAssignmentsList = apiAssignments;

          const targetsQuery = `SELECT Id, Name, Survey_Assignment__c, Distributor__c, User__c, Geography__c, Outlet__c FROM Survey_Assignment_Target__c`;
          const apiTargets = await fetchRecords("Survey_Assignment_Target__c", targetsQuery);
          if (Array.isArray(apiTargets)) surveyTargetsList = apiTargets;

          const templatesQuery = `SELECT Id, Name, Status__c, Frequency__c, Effective_From__c, Effective_To__c FROM Survey_Template__c WHERE Status__c = 'Published'`;
          const apiTemplates = await fetchRecords("Survey_Template__c", templatesQuery);
          if (Array.isArray(apiTemplates)) surveyTemplatesList = apiTemplates;
        } catch (err) {
          console.error("Salesforce Survey assignments/targets query failed:", err);
        }

        // Save raw datasets to state
        setRawBeatDays(beatDaysList);
        setRawAttendances(attendanceList);
        setRawVisits(visitsList);
        setRawTcVisits(tcVisitsList);
        setRawPcVisits(pcVisitsList);
        setRawOrders(ordersList);
        setRawSurveyResponses(surveyResponsesList);
        setRawSurveyAssignments(surveyAssignmentsList);
        setRawSurveyTargets(surveyTargetsList);
        setRawSurveyTemplates(surveyTemplatesList);

      } catch (err) {
        console.error("Error loading metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDate, isInitialized, userId, subordinates]);

  // Compute aggregated or individual metrics based on filter selections
  useEffect(() => {
    if (!userId) return;

    // 1. Identify targeted users
    let targetUserIds: string[] = [];
    const subordinateIds = subordinates.map((s) => s.Sf_Id);

    if (selectedEmployee !== "All") {
      targetUserIds = [selectedEmployee];
    } else if (selectedPersona !== "All") {
      const filteredSubs = subordinates.filter((s) => s.Role === selectedPersona);
      targetUserIds = filteredSubs.map((s) => s.Sf_Id);
      if (userRole === selectedPersona) {
        targetUserIds.push(userId);
      }
    } else {
      // Default: self + subordinates
      targetUserIds = [userId, ...subordinateIds];
    }

    // 2. Filter raw datasets
    const filteredBeatDays = rawBeatDays.filter((bd) => targetUserIds.includes(bd.OwnerId));
    const filteredAttendances = rawAttendances.filter((att) => targetUserIds.includes(att.User__c));
    const filteredVisits = rawVisits.filter((v) => {
      const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
      return targetUserIds.includes(assignedTo);
    });
    const filteredTcVisits = rawTcVisits.filter((v) => {
      const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
      return targetUserIds.includes(assignedTo);
    });

    // 3. Compute metrics values
    // TC (Total Visits)
    let totalCallsVal = 0;
    if (selectedEmployee !== "All") {
      const empBd = filteredBeatDays[0];
      totalCallsVal = empBd?.Total_Calls__c || filteredVisits.length;
    } else {
      const summedBdTc = filteredBeatDays.reduce((sum, bd) => sum + (bd.Total_Calls__c || 0), 0);
      totalCallsVal = summedBdTc || filteredTcVisits.length || filteredVisits.length;
    }
    setTc(String(totalCallsVal));

    // PC (Productive Visits)
    let productiveCallsVal = 0;
    if (selectedEmployee !== "All") {
      const empBd = filteredBeatDays[0];
      const empPcVisits = rawPcVisits.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === selectedEmployee;
      });
      productiveCallsVal = empBd?.Productive_Calls__c || empPcVisits.length || filteredVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length;
    } else {
      const targetPcVisits = rawPcVisits.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return targetUserIds.includes(assignedTo);
      });
      const summedBdPc = filteredBeatDays.reduce((sum, bd) => sum + (bd.Productive_Calls__c || 0), 0);
      productiveCallsVal = summedBdPc || targetPcVisits.length || filteredVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length;
    }
    setPc(String(productiveCallsVal));

    // Productivity
    let calculatedProductivity = "0%";
    if (totalCallsVal > 0) {
      calculatedProductivity = `${Math.round((productiveCallsVal / totalCallsVal) * 100)}%`;
    }
    setProductivity(calculatedProductivity);

    // Sales Quantity
    const targetNames: string[] = [];
    if (targetUserIds.includes(userId)) {
      targetNames.push(userName);
    }
    subordinates.forEach((s) => {
      if (targetUserIds.includes(s.Sf_Id)) {
        targetNames.push(s.Name);
      }
    });

    console.log("DEBUG targetNames:", JSON.stringify(targetNames));
    console.log("DEBUG rawOrders before filter:", JSON.stringify(rawOrders));
    const filteredOrders = rawOrders.filter((ord) =>
      targetNames.some((name) => {
        const orderName = ord.SalesRepName || ord.Name || ord.Order_Placed_By__r?.Name;
        if (!name || !orderName) return false;
        const cleanName = name.replace(/\(self\)/gi, "").trim().toLowerCase();
        const cleanOrderName = orderName.toLowerCase();
        const matches = cleanName === cleanOrderName;
        console.log(`DEBUG matching appName="${cleanName}" with sfName="${cleanOrderName}": ${matches}`);
        return matches;
      })
    );
    console.log("DEBUG filteredOrders:", JSON.stringify(filteredOrders));
    const totalQty = filteredOrders.reduce((sum, ord) => sum + (ord.SalesQuantityPcs ?? ord.OrderCount ?? ord.expr0 ?? 0), 0);
    setSalesQty(formatUnitsWithCases(totalQty, "Pcs"));

    // Spot Sales Value
    const totalValue = filteredBeatDays.reduce((sum, bd) => sum + (bd.SecOrderValue__c || 0), 0);
    setSalesOrderVal(`₹${Number(totalValue).toLocaleString("en-IN")}`);

    // Visit Authentication
    const totalCallsCount = filteredVisits.length;
    const visitedCallsCount = filteredVisits.filter(
      (v: any) => v.CheckOutTime__c !== null && v.CheckOutTime__c !== undefined && v.CheckOutTime__c !== ""
    ).length;
    setVisitAuth(`${visitedCallsCount} / ${totalCallsCount}`);

    // Attendance Status
    let attendanceStatusText = "Not Marked";
    if (selectedEmployee !== "All") {
      const empAtt = filteredAttendances[0];
      attendanceStatusText = empAtt?.AttendanceStatus__c || "Not Marked";
    } else {
      const myAtt = rawAttendances.find((att) => att.User__c === userId);
      attendanceStatusText = myAtt?.AttendanceStatus__c || "Not Marked";
    }
    setAttendanceReport(attendanceStatusText);

    // Day-In Time / Day-Out Time (MIN of CheckInTime__c and MAX of CheckOutTime__c)
    let timeVisits = filteredVisits;
    if (selectedPersona === "All" && selectedEmployee === "All") {
      timeVisits = rawVisits.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === userId;
      });
    }
    const checkIn = getMinCheckIn(timeVisits);
    const checkOut = getMaxCheckOut(timeVisits);
    setDayInTime(checkIn);
    setDayOutTime(checkOut);

    // Working Duration Calculation for selected employee
    let workingDur = "--:--";
    if (selectedEmployee !== "All") {
      const empAtt = filteredAttendances.find((a) => (a.User__c && a.User__c.substring(0, 15) === selectedEmployee.substring(0, 15)));
      if (empAtt) {
        if (empAtt.Working_Hours__c) {
          const wh = Number(empAtt.Working_Hours__c);
          if (!isNaN(wh)) {
            const h = Math.floor(wh);
            const m = Math.round((wh - h) * 60);
            workingDur = `${h}h ${m}m`;
          } else {
            workingDur = String(empAtt.Working_Hours__c);
          }
        } else if (empAtt.AttendanceStartTime__c && empAtt.AttendanceEndTime__c) {
          const diff = moment(empAtt.AttendanceEndTime__c).diff(moment(empAtt.AttendanceStartTime__c), "minutes");
          if (diff > 0 && diff < 1440) {
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            workingDur = `${h}h ${m}m`;
          }
        }
      }
    }
    setWorkingDuration(workingDur);

    // Survey Summary computation (Completed only for current team)
    const allTeamUsers = [
      { Sf_Id: userId, Name: userName, Role: userRole },
      ...subordinates,
    ];

    const filterUsers = selectedEmployee !== "All"
      ? allTeamUsers.filter((u) => idMatches(u.Sf_Id, selectedEmployee))
      : selectedPersona !== "All"
      ? allTeamUsers.filter((u) => u.Role === selectedPersona)
      : allTeamUsers;

    let completedSurveys = 0;
    filterUsers.forEach((u) => {
      const uRes = (rawSurveyResponses || []).filter((sr: any) =>
        idMatches(sr.CreatedById, u.Sf_Id) ||
        (sr.userName && u.Name && u.Name.toLowerCase().includes(sr.userName.toLowerCase())) ||
        (sr.userName && u.Name && sr.userName.toLowerCase().includes(u.Name.toLowerCase()))
      );
      completedSurveys += uRes.reduce((sum: number, cur: any) => sum + Number(cur.Completed || cur.expr0 || 1), 0);
    });

    setSurveySummaryVal(String(completedSurveys));

    // 4. Update subordinate detail lists
    const activeSubordinates = selectedPersona === "All"
      ? subordinates
      : subordinates.filter((s) => s.Role === selectedPersona);

    const selfObject = {
      Sf_Id: userId,
      Name: `${userName || "Self"} (Self)`,
      Role: userRole || "Manager",
      Phone: "",
    };

    const selfMatchesPersona = selectedPersona === "All" || userRole === selectedPersona;
    const displayList = selfMatchesPersona ? [selfObject, ...activeSubordinates] : activeSubordinates;

    const vAuthList: any[] = [];
    const dInList: any[] = [];
    const dOutList: any[] = [];
    const tcList: any[] = [];
    const pcList: any[] = [];
    const qtyList: any[] = [];
    const prodList: any[] = [];
    const valList: any[] = [];
    const attList: any[] = [];

    displayList.forEach((sub) => {
      const bd = rawBeatDays.find((x: any) => x.OwnerId === sub.Sf_Id);
      const att = rawAttendances.find((x: any) => x.User__c === sub.Sf_Id);

      const bdId = bd?.Id;
      const myVisits = rawVisits.filter((v: any) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === sub.Sf_Id;
      });

      const isSelf = sub.Sf_Id === userId;
      const subTcVisits = rawTcVisits.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === sub.Sf_Id;
      });
      let myTc = isSelf ? (subTcVisits.length || myVisits.length) : (bd?.Total_Calls__c || myVisits.length);
      if (subTcVisits.length > 0 && !isSelf) {
        myTc = subTcVisits.length;
      }

      const displayCheckIn = getMinCheckIn(myVisits);
      const displayCheckOut = getMaxCheckOut(myVisits);

      const subAuthCount = myVisits.filter(
        (v: any) => v.CheckOutTime__c !== null && v.CheckOutTime__c !== undefined && v.CheckOutTime__c !== ""
      ).length;

      const subPcVisits = rawPcVisits.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === sub.Sf_Id;
      });
      const myPc = isSelf
        ? (subPcVisits.length || myVisits.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length)
        : (bd?.Productive_Calls__c || subPcVisits.length || myVisits.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length);

      const myProd = myTc > 0 ? Math.round((myPc / myTc) * 100) : 0;

      const userOrders = rawOrders.filter((ord) => {
        const orderName = ord.SalesRepName || ord.Name || ord.Order_Placed_By__r?.Name;
        if (!sub.Name || !orderName) return false;
        const cleanName = sub.Name.replace(/\(self\)/gi, "").trim().toLowerCase();
        const cleanOrderName = orderName.toLowerCase();
        return cleanName === cleanOrderName;
      });
      const myQty = userOrders.reduce((sum, ord) => sum + (ord.SalesQuantityPcs ?? ord.OrderCount ?? ord.expr0 ?? 0), 0);
      const myVal = isSelf ? 0 : (bd?.SecOrderValue__c || bd?.Sec_Order_Value__c || 0);
      const myStatus = att?.AttendanceStatus__c || "Not Marked";

      vAuthList.push({
        userName: sub.Name,
        role: `${sub.Role} • ${subAuthCount} Auth / ${myVisits.length} Visits`,
        count: subAuthCount,
      });

      dInList.push({
        userName: sub.Name,
        role: `${sub.Role} • Checked In: ${displayCheckIn}`,
        Phone: sub.Phone,
      });

      dOutList.push({
        userName: sub.Name,
        role: `${sub.Role} • Checked Out: ${displayCheckOut}`,
        Phone: sub.Phone,
      });

      tcList.push({
        userName: sub.Name,
        role: sub.Role,
        count: myTc,
      });

      pcList.push({
        userName: sub.Name,
        role: sub.Role,
        count: myPc,
      });

      qtyList.push({
        userName: sub.Name,
        role: `${sub.Role} • Quantity: ${formatUnitsWithCases(myQty, "Pcs")}`,
        Phone: sub.Phone,
      });

      prodList.push({
        userName: sub.Name,
        role: sub.Role,
        percent: myProd,
        visited: myPc,
        planned: myTc,
      });

      valList.push({
        userName: sub.Name,
        role: sub.Role,
        amount: myVal,
      });

      attList.push({
        userName: sub.Name,
        role: `${sub.Role} • Status: ${myStatus}`,
        Phone: sub.Phone,
      });
    });

    setVisitAuthDetail(vAuthList);
    setDayInDetail(dInList);
    setDayOutDetail(dOutList);
    setTcDetail(tcList);
    setPcDetail(pcList);
    setSalesQtyDetail(qtyList);
    setProductivityDetail(prodList);
    setSalesOrderValDetail(valList);
    setAttendanceDetail(attList);

  }, [selectedPersona, selectedEmployee, rawBeatDays, rawAttendances, rawVisits, rawTcVisits, rawOrders, rawSurveyResponses, subordinates, userId]);

  // Rolling 61 days calendar window centered around calendarReferenceDate (30 days before & 30 days after)
  const getWeekDays = (centerDate: Date) => {
    const list = [];
    for (let i = -30; i <= 30; i++) {
      list.push(moment(centerDate).add(i, "days"));
    }
    return list;
  };

  const calendarDays = getWeekDays(calendarReferenceDate);

  // Month grid dates builder for custom monthly picker modal
  const getDaysInMonth = (monthMoment: moment.Moment) => {
    const startDay = moment(monthMoment).startOf("month");
    const endDay = moment(monthMoment).endOf("month");
    const days = [];

    const startDayOfWeek = startDay.day(); // 0 represents Sunday
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    const totalDays = endDay.date();
    for (let d = 1; d <= totalDays; d++) {
      days.push(moment(startDay).date(d));
    }
    return days;
  };

  // Helper to determine logged-in hours for a specific day
  const getAttendanceStatusForDate = (dateMoment: moment.Moment) => {
    const dateStr = dateMoment.format("YYYY-MM-DD");
    const record = allAttendance.find((a) => a.AttendanceDate__c === dateStr);

    if (!record) return { status: "no_entry", hours: 0 };
    if (record.AttendanceStatus__c === "Leave") return { status: "leave", hours: 0 };

    const start = moment(record.StartTime__c, ["HH:mm:ss", "HH:mm", "hh:mm A"]);
    const end = moment(record.EndTime__c, ["HH:mm:ss", "HH:mm", "hh:mm A"]);
    const durationHours = moment.duration(end.diff(start)).asHours();

    if (record.StartTime__c && record.EndTime__c) {
      return {
        status: durationHours >= 8 ? "green" : "orange",
        hours: durationHours,
      };
    }
    return { status: "green", hours: 0 }; // Default present if checked in but not out
  };

  // Render Month Summary Metrics
  const getMonthSummary = () => {
    const startStr = moment(currentMonth).startOf("month").format("YYYY-MM-DD");
    const endStr = moment(currentMonth).endOf("month").format("YYYY-MM-DD");
    const currentMonthRecords = allAttendance.filter(
      (a) => a.AttendanceDate__c >= startStr && a.AttendanceDate__c <= endStr
    );

    const presentCount = currentMonthRecords.filter((a) => a.AttendanceStatus__c === "Present").length;
    const absentCount = currentMonthRecords.filter((a) => a.AttendanceStatus__c === "Absent").length;
    const totalWorking = presentCount + absentCount;
    const attendancePct = totalWorking > 0 ? Math.round((presentCount / totalWorking) * 100) : 100;

    return { presentCount, absentCount, attendancePct };
  };

  const monthSummary = getMonthSummary();
  const monthDaysGrid = getDaysInMonth(currentMonth);

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* Header Container containing header top row and calendar row */}
      <LinearGradient
        colors={["#A67C2E", "#C9A24D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}
      >
        {/* Top Header Row */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Date Wise Summary</Text>
          <TouchableOpacity style={styles.monthlyButton} onPress={() => {
            setCurrentMonth(moment(selectedDate));
            setOpenDatePicker(true);
          }}>
            <Ionicons name="calendar-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.monthlyButtonText}>Monthly</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Calendar list */}
        <View style={styles.calendarContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarScroll}
          >
            {calendarDays.map((day, idx) => {
              const isSelected = moment(day).isSame(selectedDate, "day");
              const dayStr = day.format("YYYY-MM-DD");
              const hasActivity = activeDates.includes(dayStr);

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedDate(day.toDate());
                    const offset = idx * DAY_CARD_STEP - (width / 2) + (DAY_CARD_STEP / 2);
                    scrollViewRef.current?.scrollTo({ x: offset, animated: true });
                  }}
                  style={[
                    styles.dayCard,
                    isSelected ? styles.dayCardSelected : styles.dayCardInactive,
                  ]}
                >
                  <Text style={[styles.dayName, isSelected ? styles.dayTextSelected : styles.dayTextInactive]}>
                    {day.format("ddd")}
                  </Text>
                  <Text style={[styles.dayDate, isSelected ? styles.dayTextSelected : styles.dayTextInactive]}>
                    {day.format("D")}
                  </Text>
                  {hasActivity && (
                    <View style={[styles.activityDot, isSelected ? styles.activityDotSelected : styles.activityDotInactive]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </LinearGradient>

      {/* Metrics Content */}
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Filters Row */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterDropdown} onPress={() => setOpenPersonaPicker(true)}>
            <View style={styles.filterLabelContainer}>
              <Text style={styles.filterLabel}>Persona</Text>
              <Text style={styles.filterValue} numberOfLines={1}>{selectedPersona}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#7A7266" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterDropdown} onPress={() => setOpenEmployeePicker(true)}>
            <View style={styles.filterLabelContainer}>
              <Text style={styles.filterLabel}>Employee</Text>
              <Text style={styles.filterValue} numberOfLines={1}>
                {selectedEmployee === "All"
                  ? "All"
                  : employeeList.find((e) => e.Sf_Id === selectedEmployee)?.Name || "All"}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#7A7266" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderWrapper}>
            <ActivityIndicator size="large" color="#C9A24D" />
          </View>
        ) : (
          <View style={styles.grid}>
            {/* Group A Containers */}
            {hasRoleAccess(userRole, allowedGroupA) && (
              <>
                <MetricCard
                  title="Visit Authentication"
                  value={visitAuth}
                  icon="shield-check-outline"
                  color="#4CAF50"
                  bgColor="#E3F1EA"
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Visit Authentication Details",
                      metricType: "auth",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawTcVisits,
                      rawPcVisits,
                    })
                  }
                />
                {selectedEmployee !== "All" && (
                  <>
                    <MetricCard
                      title="Day-in Time"
                      value={dayInTime}
                      icon="login"
                      color="#3B5BB5"
                      bgColor="#E3F2FD"
                      onPress={() =>
                        navigation.navigate("DailyDashboardDetail", {
                          title: "Day-in Time Details",
                          metricType: "check_in",
                          selectedPersona,
                          selectedEmployee,
                          userId,
                          userRole,
                          userName,
                          subordinates,
                          rawBeatDays,
                          rawAttendances,
                          rawVisits,
                          rawTcVisits,
                          rawPcVisits,
                        })
                      }
                    />
                    <MetricCard
                      title="Day-out Time"
                      value={dayOutTime}
                      icon="logout"
                      color="#B3261E"
                      bgColor="#F9E5E3"
                      onPress={() =>
                        navigation.navigate("DailyDashboardDetail", {
                          title: "Day-out Time Details",
                          metricType: "check_out",
                          selectedPersona,
                          selectedEmployee,
                          userId,
                          userRole,
                          userName,
                          subordinates,
                          rawBeatDays,
                          rawAttendances,
                          rawVisits,
                          rawTcVisits,
                          rawPcVisits,
                        })
                      }
                    />
                    <MetricCard
                      title="Working Duration"
                      value={workingDuration}
                      icon="timer-outline"
                      color="#6A1B9A"
                      bgColor="#F3E5F5"
                      onPress={() =>
                        navigation.navigate("DailyDashboardDetail", {
                          title: "Working Duration Details",
                          metricType: "working_duration",
                          selectedDate: moment(selectedDate).format("YYYY-MM-DD"),
                          selectedPersona,
                          selectedEmployee,
                          userId,
                          userRole,
                          userName,
                          subordinates,
                          rawBeatDays,
                          rawAttendances,
                          rawVisits,
                          rawTcVisits,
                          rawPcVisits,
                        })
                      }
                    />
                  </>
                )}
                <MetricCard
                  title="Total Visits(TV)"
                  value={tc}
                  icon="phone-in-talk"
                  color="#FFB300"
                  bgColor="#FFF8E1"
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Total Visits Details",
                      metricType: "tc",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawTcVisits,
                      rawPcVisits,
                    })
                  }
                />
                <MetricCard
                  title="Productive Visits(PV)"
                  value={pc}
                  icon="checkbox-marked-circle-outline"
                  color="#2E7D5B"
                  bgColor="#E3F1EA"
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Productive Visits Details",
                      metricType: "pc",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawTcVisits,
                      rawPcVisits,
                    })
                  }
                />
                <MetricCard
                  title="Productivity"
                  value={productivity}
                  icon="trending-up"
                  color="#2E7D5B"
                  bgColor="#E3F1EA"
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Productivity Details",
                      metricType: "productivity",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawTcVisits,
                      rawPcVisits,
                    })
                  }
                />
              </>
            )}

            {/* Attendance Report Container */}
            {hasRoleAccess(userRole, allowedGroupC) && (
              <>
                <MetricCard
                  title="Attendance Report"
                  value={attendanceReport}
                  icon="file-document-outline"
                  color="#5E35B1"
                  bgColor="#EDE7F6"
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Attendance Details",
                      metricType: "attendance",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawTcVisits,
                      rawPcVisits,
                    })
                  }
                />
              </>
            )}

            {/* Group B Containers */}
            {hasRoleAccess(userRole, allowedGroupB) && (
              <>
                <MetricCard
                  title="Sales Quantity"
                  value={salesQty}
                  icon="package-variant-closed"
                  color="#8E24AA"
                  bgColor="#F3E5F5"
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Sales Quantity Details",
                      metricType: "sales_qty",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawTcVisits,
                      rawPcVisits,
                      rawOrders,
                    })
                  }
                />
                <MetricCard
                  title="Spot Sales Value"
                  value={salesOrderVal}
                  icon="cash-multiple"
                  color="#D81B60"
                  bgColor="#FCE4EC"
                  badgeText="Upcoming"
                  badgeBg="#FBEFD8"
                  badgeColor="#D08C1F"
                  onPress={() => {
                    if (Platform.OS === "android") {
                      ToastAndroid.show("This feature is coming soon!", ToastAndroid.SHORT);
                    }
                    dispatch(showToast({ message: "This feature is coming soon!", type: "info" }));
                  }}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Custom Monthly Calendar Modal (Centered Dialog Popup) */}
      <Modal visible={openDatePicker} animationType="fade" transparent={true}>
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContainer}>
            {/* Modal Header */}
            <View style={modalStyles.modalHeader}>
              <View style={{ width: 40 }} />
              <Text style={modalStyles.modalHeaderTitle}>Monthly Calendar</Text>
              <TouchableOpacity onPress={() => setOpenDatePicker(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={modalStyles.modalScroll} contentContainerStyle={modalStyles.modalContentContainer}>
              {/* Month Selector */}
              <View style={modalStyles.monthNavigator}>
                <TouchableOpacity
                  onPress={() => setCurrentMonth(moment(currentMonth).subtract(1, "month"))}
                  style={modalStyles.navBtn}
                >
                  <Ionicons name="chevron-back" size={20} color="#1F1D1A" />
                </TouchableOpacity>
                <Text style={modalStyles.monthLabelText}>{currentMonth.format("MMMM YYYY")}</Text>
                <TouchableOpacity
                  onPress={() => setCurrentMonth(moment(currentMonth).add(1, "month"))}
                  style={modalStyles.navBtn}
                >
                  <Ionicons name="chevron-forward" size={20} color="#1F1D1A" />
                </TouchableOpacity>
              </View>

              {/* Week Labels Row */}
              <View style={modalStyles.weekHeader}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
                  <Text key={dayName} style={modalStyles.weekLabelText}>
                    {dayName}
                  </Text>
                ))}
              </View>

              {/* Date Grid */}
              <View style={modalStyles.dateGrid}>
                {monthDaysGrid.map((day, idx) => {
                  if (!day) return <View key={`empty-${idx}`} style={modalStyles.dateCellEmpty} />;

                  const dateStr = day.format("YYYY-MM-DD");
                  const isSelected = moment(day).isSame(selectedDate, "day");

                  let cellBg = "#FBF8F1";
                  let textColor = "#1F1D1A";

                  if (isSelected) {
                    cellBg = "#C9A24D";
                    textColor = "#fff";
                  }

                  return (
                    <TouchableOpacity
                      key={dateStr}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedDate(day.toDate());
                        setCalendarReferenceDate(day.toDate());
                        setOpenDatePicker(false);
                      }}
                      style={[
                        modalStyles.dateCell,
                        { backgroundColor: cellBg },
                        isSelected && modalStyles.dateCellSelected,
                      ]}
                    >
                      <Text style={[modalStyles.dateCellText, { color: textColor }]}>
                        {day.date()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Persona Picker Modal */}
      <Modal visible={openPersonaPicker} animationType="fade" transparent={true}>
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <View style={{ width: 40 }} />
              <Text style={modalStyles.modalHeaderTitle}>Select Persona</Text>
              <TouchableOpacity onPress={() => setOpenPersonaPicker(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.modalScroll}>
              <TouchableOpacity
                style={modalStyles.optionItem}
                onPress={() => {
                  setSelectedPersona("All");
                  setOpenPersonaPicker(false);
                }}
              >
                <Text style={[modalStyles.optionText, selectedPersona === "All" && modalStyles.optionTextSelected]}>All</Text>
              </TouchableOpacity>
              {personaList.map((persona) => (
                <TouchableOpacity
                  key={persona}
                  style={modalStyles.optionItem}
                  onPress={() => {
                    setSelectedPersona(persona);
                    setOpenPersonaPicker(false);
                  }}
                >
                  <Text style={[modalStyles.optionText, selectedPersona === persona && modalStyles.optionTextSelected]}>{persona}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Employee Picker Modal */}
      <Modal visible={openEmployeePicker} animationType="fade" transparent={true}>
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <View style={{ width: 40 }} />
              <Text style={modalStyles.modalHeaderTitle}>Select Employee</Text>
              <TouchableOpacity onPress={() => setOpenEmployeePicker(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.modalScroll}>
              <TouchableOpacity
                style={modalStyles.optionItem}
                onPress={() => {
                  setSelectedEmployee("All");
                  setOpenEmployeePicker(false);
                }}
              >
                <Text style={[modalStyles.optionText, selectedEmployee === "All" && modalStyles.optionTextSelected]}>All</Text>
              </TouchableOpacity>
              {employeeList.map((emp) => (
                <TouchableOpacity
                  key={emp.Sf_Id}
                  style={modalStyles.optionItem}
                  onPress={() => {
                    setSelectedEmployee(emp.Sf_Id);
                    setOpenEmployeePicker(false);
                  }}
                >
                  <Text style={[modalStyles.optionText, selectedEmployee === emp.Sf_Id && modalStyles.optionTextSelected]}>{emp.Name} ({emp.Role})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  headerContainer: {
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: RFValue(15),
    fontWeight: "700",
  },
  monthlyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  monthlyButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  calendarContainer: {
    marginTop: 10,
  },
  calendarScroll: {
    paddingHorizontal: 12,
    alignItems: "center",
  },
  dayCard: {
    width: DAY_CARD_WIDTH,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: CARD_MARGIN,
  },
  dayCardSelected: {
    backgroundColor: "#fff",
  },
  dayCardInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  dayName: {
    fontSize: 8,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 12,
    fontWeight: "700",
  },
  dayTextSelected: {
    color: "#A67C2E",
  },
  dayTextInactive: {
    color: "#fff",
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  activityDotSelected: {
    backgroundColor: "#C9A24D",
  },
  activityDotInactive: {
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  filterDropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  filterLabelContainer: {
    flex: 1,
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7A7266",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 1,
  },
  loaderWrapper: {
    marginTop: 80,
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1EADB",
    paddingHorizontal: 10,
    paddingVertical: 12,
    width: CARD_WIDTH,
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
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  cardTextContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A7266",
    lineHeight: 14,
    marginTop: 1,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F1D1A",
    lineHeight: 14,
  },
  cardBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width - 32,
    maxHeight: "80%",
    backgroundColor: "#FBF8F1",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalScroll: {
    maxHeight: 480,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  modalHeader: {
    height: 56,
    backgroundColor: "#C9A24D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  modalHeaderTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContentContainer: {
    padding: 16,
  },
  monthNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  monthLabelText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F224E",
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  weekLabelText: {
    width: (width - 64) / 7,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7266",
  },
  dateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dateCell: {
    width: (width - 64) / 7,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
    position: "relative",
  },
  dateCellEmpty: {
    width: (width - 64) / 7,
    height: 40,
    marginVertical: 4,
  },
  dateCellSelected: {
    borderWidth: 1.5,
    borderColor: "#C9A24D",
  },
  dateCellText: {
    fontSize: 13,
    fontWeight: "700",
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: "#F1EADB",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F1D1A",
  },
  optionTextSelected: {
    color: "#A67C2E",
    fontWeight: "700",
  },
});

export default DateWiseSummary;
