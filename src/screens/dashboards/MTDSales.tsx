import React, { FC, useEffect, useState, useMemo } from "react";
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { showToast } from "../../redux/slices/toastSlice";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import moment from "moment";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { RFValue } from "react-native-responsive-fontsize";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { formatUnitsWithCases, formatCasesWithUnits } from "../../utils/helper/caseUnits";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;

// Allowed roles configurations
const group1Roles = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM", "VP"];
const group2Roles = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM"];
const group3Roles = ["ASM", "RSM", "AGM", "GM"];
const group4Roles = ["ASM", "RSM", "AGM", "GM", "VP"];

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
  onPress?: () => void;
  valueStyle?: any;
}

const MetricCard: FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  bgColor,
  onPress,
  valueStyle,
}) => (
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.7}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={[styles.cardIconWrap, { backgroundColor: bgColor }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
    </View>
    <View style={styles.cardTextContent}>
      <Text style={[styles.cardValue, valueStyle]}>{value}</Text>
      <Text style={styles.cardLabel}>{title}</Text>
    </View>
  </TouchableOpacity>
);

const hasRoleAccess = (userRole: string, allowedRoles: string[]): boolean => {
  if (!userRole) return true;
  const upperRole = userRole.toUpperCase();
  return allowedRoles.some((role) => upperRole.includes(role.toUpperCase()));
};

const MTDSales: FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { fetchRecords } = useApiFetch();

  // Selected Month State
  const [selectedMonth, setSelectedMonth] = useState<moment.Moment>(moment());
  const [openMonthPicker, setOpenMonthPicker] = useState(false);

  const startOfMonth = useMemo(() => selectedMonth.clone().startOf("month").format("YYYY-MM-DD"), [selectedMonth]);
  const endOfMonth = useMemo(() => selectedMonth.clone().endOf("month").format("YYYY-MM-DD"), [selectedMonth]);

  // Month options: current month + previous 11 months (12 months total)
  const monthOptions = useMemo(() => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      list.push(moment().subtract(i, "months"));
    }
    return list;
  }, []);

  // Filter States
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [selectedPersona, setSelectedPersona] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState("All");
  const [personaList, setPersonaList] = useState<string[]>([]);
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [openPersonaPicker, setOpenPersonaPicker] = useState(false);
  const [openEmployeePicker, setOpenEmployeePicker] = useState(false);

  const [loading, setLoading] = useState(true);

  // Raw metrics states
  const [boxSales, setBoxSales] = useState("0 Box");
  const [pcsSales, setPcsSales] = useState("0 Pcs");
  const [orderValue, setOrderValue] = useState("Upcoming");
  const [totalCalls, setTotalCalls] = useState("0");
  const [productiveCalls, setProductiveCalls] = useState("0");
  const [outletsVisited, setOutletsVisited] = useState("0");
  const [avgRetailingTime, setAvgRetailingTime] = useState("0 mins");
  const [avgTotalTime, setAvgTotalTime] = useState("0h 0m");

  // Raw datasets for online queries (passed to detail screens)
  const [rawBeatDays, setRawBeatDays] = useState<any[]>([]);
  const [rawVisits, setRawVisits] = useState<any[]>([]);
  const [rawAttendances, setRawAttendances] = useState<any[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [rawOrderItems, setRawOrderItems] = useState<any[]>([]);
  const [rawOrderPcsItems, setRawOrderPcsItems] = useState<any[]>([]);
  const [rawTcTeamSummary, setRawTcTeamSummary] = useState<any[]>([]);
  const [rawOrderBookingSummary, setRawOrderBookingSummary] = useState<any[]>([]);
  const [brandProductivity, setBrandProductivity] = useState<any[]>([]);
  const [categoryProductivity, setCategoryProductivity] = useState<any[]>([]);

  // Load Initial User & Subordinate Info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        if (loggedInUser && loggedInUser.length > 0) {
          setUserId(loggedInUser[0].Sf_Id);
          setUserName(loggedInUser[0].Name || "");
          let actualUserRole = loggedInUser[0].Role || "";
          try {
            const roleQuery = `SELECT UserRole.Name FROM User WHERE Id = '${loggedInUser[0].Sf_Id}'`;
            const roleRes = await fetchRecords("User", roleQuery);
            if (Array.isArray(roleRes) && roleRes.length > 0) {
              actualUserRole = roleRes[0].UserRole?.Name || loggedInUser[0].Role || "";
            }
          } catch (roleErr) {
            console.error("Failed to query logged-in user role online:", roleErr);
          }
          setUserRole(actualUserRole);

          // Fetch Subordinates (hierarchical - up to 4 levels)
          try {
            let allSubordinates: any[] = [];
            let currentManagerIds = [loggedInUser[0].Sf_Id];

            // Loop to fetch up to 4 levels of hierarchy
            for (let depth = 0; depth < 4; depth++) {
              if (currentManagerIds.length === 0) break;
              const idsStr = currentManagerIds.map(id => `'${id}'`).join(",");
              const query = `SELECT Id, Name, UserRole.Name, Phone FROM User WHERE ManagerId IN (${idsStr})`;
              const records = await fetchRecords("User", query);
              if (Array.isArray(records) && records.length > 0) {
                allSubordinates = [...allSubordinates, ...records];
                currentManagerIds = records.map((u: any) => u.Id);
              } else {
                break;
              }
            }

            // Deduplicate subordinates by Id
            const uniqueSubsMap = new Map();

            // Add logged-in user (self)
            uniqueSubsMap.set(loggedInUser[0].Sf_Id, {
              Sf_Id: loggedInUser[0].Sf_Id,
              Name: loggedInUser[0].Name,
              Role: actualUserRole || "Representative",
              Phone: loggedInUser[0].Phone || "",
            });

            allSubordinates.forEach((u: any) => {
              uniqueSubsMap.set(u.Id, {
                Sf_Id: u.Id,
                Name: u.Name,
                Role: u.UserRole?.Name || "Representative",
                Phone: u.Phone || "",
              });
            });
            const mapped = Array.from(uniqueSubsMap.values());

            setSubordinates(mapped);
            const uniqueRoles = [...new Set(mapped.map((s: any) => s.Role))].filter(Boolean);
            setPersonaList(uniqueRoles as string[]);
          } catch (apiErr) {
            console.error("Salesforce User hierarchical query failed in MTDSales:", apiErr);
          }
        }
      } catch (err) {
        console.error("Error loading user info in MTDSales:", err);
      }
    };
    loadUserInfo();
  }, []);

  // Filter Employees dynamically based on selected Persona
  useEffect(() => {
    if (selectedPersona === "All") {
      setEmployeeList(subordinates);
    } else {
      const filtered = subordinates.filter((s) => s.Role === selectedPersona);
      setEmployeeList(filtered);
    }
    setSelectedEmployee("All");
  }, [selectedPersona, subordinates]);

  // Main MTD sales query calculations
  useEffect(() => {
    const fetchMTDData = async () => {
      setLoading(true);

      // Determine date bounds of selected month
      const startOfMonth = selectedMonth.clone().startOf("month").format("YYYY-MM-DD");
      const endOfMonth = selectedMonth.clone().endOf("month").format("YYYY-MM-DD");

      // Filter target user IDs based on dropdown selects
      const targetUserIds: string[] = [];
      if (selectedEmployee === "All") {
        if (selectedPersona === "All") {
          targetUserIds.push(userId);
          subordinates.forEach((s) => targetUserIds.push(s.Sf_Id));
        } else {
          subordinates.forEach((s) => {
            if (s.Role === selectedPersona) {
              targetUserIds.push(s.Sf_Id);
            }
          });
        }
      } else {
        targetUserIds.push(selectedEmployee);
        // Also include subordinates if selectedEmployee is a manager
        const collectSubIds = (mgrId: string) => {
          subordinates.forEach((s) => {
            if (s.ManagerId && s.ManagerId === mgrId && !targetUserIds.includes(s.Sf_Id)) {
              targetUserIds.push(s.Sf_Id);
              collectSubIds(s.Sf_Id);
            }
          });
        };
        collectSubIds(selectedEmployee);
      }

      const allUserIdsStr = targetUserIds.map((id) => `'${id}'`).join(",");

      try {
        // 1. Query Beat_Day__c for sum calculations
        const beatDayQuery = `SELECT Id, Name, OwnerId, Owner.Name, Owner.UserRole.Name, Route_Plans__r.Name, Route_Plans__r.Assigned_To__c, Route_Plans__r.Assigned_To__r.Name, Route_Plans__r.Assigned_To__r.UserRole.Name, Beat_Date__c, Total_Calls__c, Productive_Calls__c, SecOrderQuantityPcs__c, SecOrderValue__c, First_Call_Time__c, Last_Call_Time__c, EndOfDayTime__c, Field_Duration_Minutes__c FROM Beat_Day__c WHERE Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth} AND (OwnerId IN (${allUserIdsStr}) OR Route_Plans__r.Assigned_To__c IN (${allUserIdsStr})) AND Approval_Status__c = 'Approved'`;
        const beatDays = await fetchRecords("BeatDay__c", beatDayQuery);
        let beatDaysList = Array.isArray(beatDays) ? beatDays : [];

        // 2. Query Visit__c for retailing metrics and TC/PC count
        const visitQuery = `SELECT Id, CreatedById, CreatedBy.Name, CreatedBy.User_Type__c, CheckInTime__c, CheckOutTime__c, ProductiveCall__c, VisitStatus__c, AccountId__c, AccountId__r.Name, BeatDay__r.OwnerId, BeatDay__r.Route_Plans__r.Assigned_To__c, BeatDay__r.Route_Plans__r.Assigned_To__r.Name, BeatDay__r.Approval_Status__c, BeatDay__r.Beat_Date__c, Retailing_Duration_Minutes__c, BeatDay__c, BeatDay__r.Field_Duration_Minutes__c, BeatDay__r.First_Call_Time__c, BeatDay__r.Last_Call_Time__c, BeatDay__r.EndOfDayTime__c, IsOrderPlaced__c FROM Visit__c WHERE CreatedDate >= ${startOfMonth}T00:00:00Z AND CreatedDate <= ${endOfMonth}T23:59:59Z AND (CreatedById IN (${allUserIdsStr}) OR BeatDay__r.OwnerId IN (${allUserIdsStr}) OR BeatDay__r.Route_Plans__r.Assigned_To__c IN (${allUserIdsStr})) ORDER BY CreatedDate DESC`;
        const visits = await fetchRecords("Visit__c", visitQuery);
        const visitsList = Array.isArray(visits) ? visits : [];

        // 3. Fetch Attendance__c online
        let attendanceList: any[] = [];
        try {
          const attendanceQuery = `SELECT Id, Name, User__c, AttendanceStatus__c, AttendanceDate__c, AttendanceStartTime__c, AttendanceEndTime__c, Attendance_Leave_Reason__c, CapturedSelfie__c, GeoLocation__c, Reason__c, SelfieURL__c, Attendance_Image_URL__c FROM Attendance__c WHERE AttendanceDate__c >= ${startOfMonth} AND AttendanceDate__c <= ${endOfMonth} AND User__c IN (${allUserIdsStr})`;
          const attendanceResult = await fetchRecords("Attendance__c", attendanceQuery);
          if (Array.isArray(attendanceResult)) {
            attendanceList = attendanceResult;
          }
        } catch (err) {
          console.error("Salesforce Attendance query failed in MTDSales:", err);
        }

        // 4. Fetch Order__c online
        let ordersList: any[] = [];
        try {
          const orderQuery = `SELECT Id, Order_Placed_By__c, Order_Placed_By__r.Name, CreatedById, CreatedDate FROM Order__c WHERE CreatedDate >= ${startOfMonth}T00:00:00Z AND CreatedDate <= ${endOfMonth}T23:59:59Z AND Order_Source__c = 'SFA' AND (Order_Placed_By__c IN (${allUserIdsStr}) OR CreatedById IN (${allUserIdsStr}))`;
          const ordersResult = await fetchRecords("Order__c", orderQuery);
          if (Array.isArray(ordersResult)) {
            ordersList = ordersResult;
          }
        } catch (err) {
          console.error("Salesforce Order__c query failed in MTDSales:", err);
        }

        // 5. Exact SOQL Query for Order Booking (Box & Pcs)
        let totalBoxQty = 0;
        let totalPcsQty = 0;
        let orderBookingSummary: any[] = [];
        let orderItemsResult: any[] = [];
        const managerIdForOrders = userId || "0059I00000AfB3OQAV";
        try {
          const startDateTime = `${startOfMonth}T00:00:00Z`;
          const endDateTime = `${endOfMonth}T23:59:59Z`;
          const orderSummaryQuery = `SELECT OrderId__r.Order_Placed_By__r.Name SalesRepName, OrderId__r.Order_Placed_By__c SalesRepId, OrderId__r.Order_Placed_By__r.User_Type__c Role, SUM(Quantity_In_Box__c) TotalQuantityBox, SUM(Quantity_In_Pcs__c) TotalQuantityPcs, SUM(TotalPrice__c) TotalSalesAmount, COUNT_DISTINCT(OrderId__c) TotalOrdersPlaced FROM Order_Item__c WHERE OrderId__r.Order_Source__c = 'SFA' AND CreatedDate >= ${startDateTime} AND CreatedDate <= ${endDateTime} AND OrderId__c IN (SELECT Id FROM Order__c WHERE (Order_Placed_By__c = '${managerIdForOrders}' OR Order_Placed_By__r.ManagerId = '${managerIdForOrders}' OR Order_Placed_By__r.Manager.ManagerId = '${managerIdForOrders}' OR Order_Placed_By__r.Manager.Manager.ManagerId = '${managerIdForOrders}')) GROUP BY OrderId__r.Order_Placed_By__r.Name, OrderId__r.Order_Placed_By__c, OrderId__r.Order_Placed_By__r.User_Type__c ORDER BY OrderId__r.Order_Placed_By__r.Name ASC`;
          console.log("🔍 [MTDSales] Executing exact Order Booking Box/Pcs query:", orderSummaryQuery);
          const summaryRes = await fetchRecords("Order_Item__c", orderSummaryQuery);
          if (Array.isArray(summaryRes) && summaryRes.length > 0) {
            orderBookingSummary = summaryRes;
          }
        } catch (sumErr) {
          console.warn("⚠️ Subquery failed for Order Booking Summary, trying fallback:", sumErr);
          if (allUserIdsStr) {
            try {
              const startDateTime = `${startOfMonth}T00:00:00Z`;
              const endDateTime = `${endOfMonth}T23:59:59Z`;
              const fallbackOrderQuery = `SELECT OrderId__r.Order_Placed_By__r.Name SalesRepName, OrderId__r.Order_Placed_By__c SalesRepId, OrderId__r.Order_Placed_By__r.User_Type__c Role, SUM(Quantity_In_Box__c) TotalQuantityBox, SUM(Quantity_In_Pcs__c) TotalQuantityPcs, SUM(TotalPrice__c) TotalSalesAmount, COUNT_DISTINCT(OrderId__c) TotalOrdersPlaced FROM Order_Item__c WHERE OrderId__r.Order_Source__c = 'SFA' AND CreatedDate >= ${startDateTime} AND CreatedDate <= ${endDateTime} AND (OrderId__r.Order_Placed_By__c IN (${allUserIdsStr}) OR CreatedById IN (${allUserIdsStr})) GROUP BY OrderId__r.Order_Placed_By__r.Name, OrderId__r.Order_Placed_By__c, OrderId__r.Order_Placed_By__r.User_Type__c ORDER BY OrderId__r.Order_Placed_By__r.Name ASC`;
              const fallbackRes = await fetchRecords("Order_Item__c", fallbackOrderQuery);
              if (Array.isArray(fallbackRes) && fallbackRes.length > 0) {
                orderBookingSummary = fallbackRes;
              }
            } catch (err2) {
              console.warn("⚠️ Fallback failed for Order Booking Summary:", err2);
            }
          }
        }

        setRawOrderBookingSummary(orderBookingSummary);

        // Filter-wise calculation for Box & Pcs strictly respecting selectedEmployee and selectedPersona
        const selectedEmpObjForOrders = subordinates.find((s) => s.Sf_Id === selectedEmployee);
        const selectedEmpNameForOrders = selectedEmpObjForOrders?.Name?.replace(/\(self\)/gi, "").trim().toLowerCase();

        if (selectedEmployee !== "All") {
          // Case 1: Specific employee selected
          const empRow = orderBookingSummary.find((r: any) => {
            const isIdMatch = r.SalesRepId && (r.SalesRepId === selectedEmployee || (r.SalesRepId.length >= 15 && selectedEmployee.startsWith(r.SalesRepId.substring(0, 15))));
            const rName = (r.SalesRepName || "").trim().toLowerCase();
            const isNameMatch = selectedEmpNameForOrders ? (rName === selectedEmpNameForOrders || selectedEmpNameForOrders.includes(rName) || rName.includes(selectedEmpNameForOrders)) : false;
            return isIdMatch || isNameMatch;
          });

          if (empRow) {
            totalBoxQty = Number(empRow.TotalQuantityBox || empRow.expr0 || 0);
            totalPcsQty = Number(empRow.TotalQuantityPcs || empRow.expr1 || 0);
          }
        } else if (selectedPersona !== "All") {
          // Case 2: Specific persona selected
          const personaSubs = subordinates.filter((s) => s.Role === selectedPersona);
          const personaIds = new Set(personaSubs.map((s) => s.Sf_Id));
          const personaEmpNames = new Set(
            personaSubs.map((s) => (s.Name || "").replace(/\(self\)/gi, "").trim().toLowerCase())
          );
          const personaRows = orderBookingSummary.filter((r: any) => {
            if (r.Role && r.Role === selectedPersona) return true;
            const isIdMatch = r.SalesRepId && (personaIds.has(r.SalesRepId) || Array.from(personaIds).some((pid: any) => pid && r.SalesRepId && (pid === r.SalesRepId || pid.startsWith(r.SalesRepId.substring(0, 15)))));
            const rName = (r.SalesRepName || "").trim().toLowerCase();
            const isNameMatch = personaEmpNames.has(rName);
            return isIdMatch || isNameMatch;
          });

          if (personaRows.length > 0) {
            totalBoxQty = personaRows.reduce((sum, r) => sum + Number(r.TotalQuantityBox || r.expr0 || 0), 0);
            totalPcsQty = personaRows.reduce((sum, r) => sum + Number(r.TotalQuantityPcs || r.expr1 || 0), 0);
          }
        } else {
          // Case 3: All selected -> sum all
          if (orderBookingSummary.length > 0) {
            totalBoxQty = orderBookingSummary.reduce((sum, r) => sum + Number(r.TotalQuantityBox || r.expr0 || 0), 0);
            totalPcsQty = orderBookingSummary.reduce((sum, r) => sum + Number(r.TotalQuantityPcs || r.expr1 || 0), 0);
          }
        }

        // Also fetch detailed Order_Item__c for product/brand breakdowns in detail screen
        try {
          const startDateTime = `${startOfMonth}T00:00:00Z`;
          const endDateTime = `${endOfMonth}T23:59:59Z`;
          const detailItemQuery = `SELECT Id, OrderId__c, OrderId__r.Order_Placed_By__c, OrderId__r.Order_Placed_By__r.Name, OrderId__r.AccountId__c, OrderId__r.AccountId__r.Name, OrderId__r.EffectiveDate__c, UOM_Selected__c, Quantity_In_Box__c, Quantity_In_Pcs__c, Product2Id__r.Brand__c, Product2Id__r.Category__c, Net_Amount__c, Product2Id__r.Name FROM Order_Item__c WHERE OrderId__r.Order_Source__c = 'SFA' AND CreatedDate >= ${startDateTime} AND CreatedDate <= ${endDateTime} AND (OrderId__r.Order_Placed_By__c IN (${allUserIdsStr}) OR CreatedById IN (${allUserIdsStr}))`;
          const res = await fetchRecords("Order_Item__c", detailItemQuery);
          if (Array.isArray(res)) {
            orderItemsResult = res;
          }
        } catch (detailErr) {
          console.warn("Detailed items query error:", detailErr);
        }

        // Save raw lists to states
        setRawBeatDays(beatDaysList);
        setRawVisits(visitsList);
        setRawAttendances(attendanceList);
        setRawOrders(ordersList);
        setRawOrderItems(orderItemsResult);
        setRawOrderPcsItems(orderItemsResult);

        // Perform MTD sales calculations
        let sumPcs = 0;
        let sumValue = 0;
        let totalDayMinutes = 0;
        let dayCount = 0;

        beatDaysList.forEach((bd: any) => {
          sumPcs += Number(bd.SecOrderQuantityPcs__c || 0);
          sumValue += Number(bd.SecOrderValue__c || 0);

          if (bd.First_Call_Time__c && bd.EndOfDayTime__c) {
            const diff = moment(bd.EndOfDayTime__c).diff(moment(bd.First_Call_Time__c), "minutes");
            if (diff > 0 && diff < 720) {
              totalDayMinutes += diff;
              dayCount++;
            }
          }
        });

        let uniqueAccounts = new Set();
        let totalRetailingMinutes = 0;
        let retailingCount = 0;

        visitsList.forEach((v: any) => {
          const accId = v.AccountId__c || v.AccountId;
          if (accId) {
            uniqueAccounts.add(accId);
          }
          if (v.CheckInTime__c && v.CheckOutTime__c) {
            const diff = moment(v.CheckOutTime__c).diff(moment(v.CheckInTime__c), "minutes");
            if (diff > 0 && diff < 480) {
              totalRetailingMinutes += diff;
              retailingCount++;
            }
          }
        });

        // Filter-wise calculation for TC & PC using exact Team Summary query
        let totalCallsVal = 0;
        let productiveCallsVal = 0;
        let teamSummaryList: any[] = [];

        const managerIdForTc = userId || "0059I00000AfB3OQAV";
        try {
          const teamTcQuery = `SELECT Owner.Name SalesRepName, OwnerId, SUM(Total_Calls__c) MonthlyTotalCalls_TC, SUM(Productive_Calls__c) MonthlyProductiveCalls_PC, COUNT(Id) TotalWorkingDays FROM Beat_Day__c WHERE Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth} AND OwnerId IN (SELECT Id FROM User WHERE Id = '${managerIdForTc}' OR ManagerId = '${managerIdForTc}' OR Manager.ManagerId = '${managerIdForTc}' OR Manager.Manager.ManagerId = '${managerIdForTc}') GROUP BY Owner.Name, OwnerId ORDER BY Owner.Name ASC`;
          console.log("🔍 [MTDSales] Executing exact Total Visits query:", teamTcQuery);
          const res = await fetchRecords("BeatDay__c", teamTcQuery);
          if (Array.isArray(res) && res.length > 0) {
            teamSummaryList = res;
          }
        } catch (err) {
          console.warn("⚠️ Subquery failed for Total Visits Team Summary, trying fallback:", err);
          if (allUserIdsStr) {
            try {
              const fallbackQuery = `SELECT Owner.Name SalesRepName, OwnerId, SUM(Total_Calls__c) MonthlyTotalCalls_TC, SUM(Productive_Calls__c) MonthlyProductiveCalls_PC, COUNT(Id) TotalWorkingDays FROM Beat_Day__c WHERE Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth} AND OwnerId IN (${allUserIdsStr}) GROUP BY Owner.Name, OwnerId ORDER BY Owner.Name ASC`;
              const fallbackRes = await fetchRecords("BeatDay__c", fallbackQuery);
              if (Array.isArray(fallbackRes) && fallbackRes.length > 0) {
                teamSummaryList = fallbackRes;
              }
            } catch (err2) {
              console.warn("⚠️ Fallback query failed for Total Visits:", err2);
            }
          }
        }

        // Strictly calculate totalCallsVal & productiveCallsVal according to selectedEmployee & selectedPersona
        const selectedEmpObj = subordinates.find((s) => s.Sf_Id === selectedEmployee);
        const selectedEmpName = selectedEmpObj?.Name?.replace(/\(self\)/gi, "").trim().toLowerCase();

        if (selectedEmployee !== "All") {
          // Case 1: Specific employee selected -> count ONLY this employee's calls
          const empRow = teamSummaryList.find((r: any) => {
            const isIdMatch = r.OwnerId && (r.OwnerId === selectedEmployee || (r.OwnerId.length >= 15 && selectedEmployee.startsWith(r.OwnerId.substring(0, 15))));
            const rName = (r.SalesRepName || "").trim().toLowerCase();
            const isNameMatch = selectedEmpName ? (rName === selectedEmpName || selectedEmpName.includes(rName) || rName.includes(selectedEmpName)) : false;
            return isIdMatch || isNameMatch;
          });

          if (empRow) {
            totalCallsVal = Number(empRow.MonthlyTotalCalls_TC || empRow.expr0 || 0);
            productiveCallsVal = Number(empRow.MonthlyProductiveCalls_PC || empRow.expr1 || 0);
          } else {
            // Calculate from beatDaysList for this specific employee
            beatDaysList.forEach((bd: any) => {
              if (bd.OwnerId === selectedEmployee || bd.Route_Plans__r?.Assigned_To__c === selectedEmployee) {
                totalCallsVal += Number(bd.Total_Calls__c || 0);
                productiveCallsVal += Number(bd.Productive_Calls__c || 0);
              }
            });
            if (totalCallsVal === 0 && visitsList.length > 0) {
              const empVisits = visitsList.filter((v: any) => v.CreatedById === selectedEmployee || v.BeatDay__r?.OwnerId === selectedEmployee || v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === selectedEmployee);
              totalCallsVal = empVisits.length;
              productiveCallsVal = empVisits.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length;
            }
          }
        } else if (selectedPersona !== "All") {
          // Case 2: Specific persona selected -> count ONLY employees belonging to this persona
          const personaSubs = subordinates.filter((s) => s.Role === selectedPersona);
          const personaIds = new Set(personaSubs.map((s) => s.Sf_Id));
          const personaEmpNames = new Set(
            personaSubs.map((s) => (s.Name || "").replace(/\(self\)/gi, "").trim().toLowerCase())
          );
          const personaRows = teamSummaryList.filter((r: any) => {
            const isIdMatch = r.OwnerId && (personaIds.has(r.OwnerId) || Array.from(personaIds).some((pid: any) => pid && r.OwnerId && (pid === r.OwnerId || pid.startsWith(r.OwnerId.substring(0, 15)))));
            const rName = (r.SalesRepName || "").trim().toLowerCase();
            const isNameMatch = personaEmpNames.has(rName);
            return isIdMatch || isNameMatch;
          });

          if (personaRows.length > 0) {
            totalCallsVal = personaRows.reduce((sum, r) => sum + Number(r.MonthlyTotalCalls_TC || r.expr0 || 0), 0);
            productiveCallsVal = personaRows.reduce((sum, r) => sum + Number(r.MonthlyProductiveCalls_PC || r.expr1 || 0), 0);
          } else {
            beatDaysList.forEach((bd: any) => {
              totalCallsVal += Number(bd.Total_Calls__c || 0);
              productiveCallsVal += Number(bd.Productive_Calls__c || 0);
            });
            if (totalCallsVal === 0 && visitsList.length > 0) {
              totalCallsVal = visitsList.length;
              productiveCallsVal = visitsList.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length;
            }
          }
        } else {
          // Case 3: "All" selected -> sum all team members
          if (teamSummaryList.length > 0) {
            totalCallsVal = teamSummaryList.reduce((sum, r) => sum + Number(r.MonthlyTotalCalls_TC || r.expr0 || 0), 0);
            productiveCallsVal = teamSummaryList.reduce((sum, r) => sum + Number(r.MonthlyProductiveCalls_PC || r.expr1 || 0), 0);
          } else {
            beatDaysList.forEach((bd: any) => {
              totalCallsVal += Number(bd.Total_Calls__c || 0);
              productiveCallsVal += Number(bd.Productive_Calls__c || 0);
            });
            if (totalCallsVal === 0 && visitsList.length > 0) {
              totalCallsVal = visitsList.length;
              productiveCallsVal = visitsList.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length;
            }
          }
        }

        setRawTcTeamSummary(teamSummaryList);

        // Fetch Online Duration aggregate calculations (only when specific employee selected)
        let onlineAvgRetailing = 0;
        let onlineAvgTotal = 0;
        if (selectedEmployee !== "All") {
          const managerId = selectedEmployee || userId;

          // 1. Retailing Duration (from Visit__c)
          try {
            const durationQuery = `SELECT AVG(Retailing_Duration_Minutes__c) avgRetailing FROM Visit__c WHERE BeatDay__r.Beat_Date__c >= ${startOfMonth} AND BeatDay__r.Beat_Date__c <= ${endOfMonth} AND CreatedById IN (${allUserIdsStr}) AND CheckInTime__c != null AND CheckOutTime__c != null`;
            const durationRes = await fetchRecords("Visit__c", durationQuery);
            if (Array.isArray(durationRes) && durationRes.length > 0) {
              onlineAvgRetailing = Math.round(Number(durationRes[0].avgRetailing || durationRes[0].expr0 || 0));
            }
          } catch (err) {
            console.error("Salesforce online retailing duration query failed:", err);
          }

          // 2. Exact Total Avg Time Query from Beat_Day__c (with First_Call_Time__c & Last_Call_Time__c)
          try {
            const dateFilter = moment().isSame(selectedMonth, "month")
              ? "Beat_Date__c = THIS_MONTH"
              : `Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth}`;

            let bdRecords: any[] = [];
            try {
              const totalTimeQuery = `SELECT Id, Name, Beat_Date__c, OwnerId, Owner.Name, Route_Plans__r.Name, First_Call_Time__c, Last_Call_Time__c, Field_Duration_Minutes__c, Total_Calls__c, Productive_Calls__c FROM Beat_Day__c WHERE ${dateFilter} AND First_Call_Time__c != null AND Last_Call_Time__c != null AND OwnerId IN (SELECT Id FROM User WHERE Id = '${managerId}' OR ManagerId = '${managerId}' OR Manager.ManagerId = '${managerId}' OR Manager.Manager.ManagerId = '${managerId}') ORDER BY Beat_Date__c DESC`;
              console.log("🔍 [MTDSales] Executing exact Avg Total Time query:", totalTimeQuery);
              const res = await fetchRecords("BeatDay__c", totalTimeQuery);
              if (Array.isArray(res) && res.length > 0) {
                bdRecords = res;
              }
            } catch (subErr) {
              console.warn("⚠️ Subquery failed for Avg Total Time, trying fallback:", subErr);
              const fallbackQuery = `SELECT Id, Name, Beat_Date__c, OwnerId, Owner.Name, Route_Plans__r.Name, First_Call_Time__c, Last_Call_Time__c, Field_Duration_Minutes__c, Total_Calls__c, Productive_Calls__c FROM Beat_Day__c WHERE ${dateFilter} AND First_Call_Time__c != null AND Last_Call_Time__c != null AND OwnerId IN (${allUserIdsStr}) ORDER BY Beat_Date__c DESC`;
              const fallbackRes = await fetchRecords("BeatDay__c", fallbackQuery);
              if (Array.isArray(fallbackRes) && fallbackRes.length > 0) {
                bdRecords = fallbackRes;
              }
            }

            if (bdRecords.length > 0) {
              // Merge into beatDaysList so DailyDashboardDetail has these records with Last_Call_Time__c
              const existingIds = new Set(beatDaysList.map((b: any) => b.Id));
              bdRecords.forEach((r: any) => {
                if (!existingIds.has(r.Id)) {
                  beatDaysList.push(r);
                } else {
                  const idx = beatDaysList.findIndex((b: any) => b.Id === r.Id);
                  if (idx >= 0) beatDaysList[idx] = { ...beatDaysList[idx], ...r };
                }
              });
              setRawBeatDays([...beatDaysList]);

              let totalFieldMin = 0;
              let validCount = 0;
              bdRecords.forEach((bd: any) => {
                let mins = Number(bd.Field_Duration_Minutes__c || 0);
                if (mins <= 0 && bd.First_Call_Time__c && bd.Last_Call_Time__c) {
                  const diff = moment(bd.Last_Call_Time__c).diff(moment(bd.First_Call_Time__c), "minutes");
                  if (diff > 0 && diff < 720) {
                    mins = diff;
                  }
                }
                if (mins > 0) {
                  totalFieldMin += mins;
                  validCount++;
                }
              });

              if (validCount > 0) {
                onlineAvgTotal = Math.round(totalFieldMin / validCount);
              }
            }
          } catch (err) {
            console.error("Salesforce online total duration query failed:", err);
          }
        }

        // Update Screen States
        setPcsSales(formatUnitsWithCases(Math.round(totalPcsQty), "Pcs"));
        setBoxSales(formatCasesWithUnits(Math.round(totalBoxQty)));
        setOrderValue("Upcoming");
        setTotalCalls(String(totalCallsVal));
        setProductiveCalls(String(productiveCallsVal));
        setOutletsVisited(String(visitsList.length));

        let finalAvgRetailing = onlineAvgRetailing;
        if (finalAvgRetailing <= 0) {
          finalAvgRetailing = retailingCount > 0 ? Math.round(totalRetailingMinutes / retailingCount) : 0;
        }
        setAvgRetailingTime(`${finalAvgRetailing} mins`);

        let finalAvgTotal = onlineAvgTotal;
        if (finalAvgTotal <= 0) {
          finalAvgTotal = dayCount > 0 ? Math.round(totalDayMinutes / dayCount) : 0;
        }
        setAvgTotalTime(`${Math.floor(finalAvgTotal / 60)}h ${finalAvgTotal % 60}m`);

        // 6. Fetch Brand-wise productivity
        try {
          const brandQuery = `SELECT Product2Id__r.Brand__c, COUNT_DISTINCT(OrderId__c) totalOrders, SUM(Quantity_In_Box__c) totalBoxes, SUM(Quantity_In_Pcs__c) totalPieces, SUM(Net_Amount__c) totalOrderValue FROM Order_Item__c WHERE OrderId__r.CreatedDate >= ${startOfMonth}T00:00:00Z AND OrderId__r.CreatedDate <= ${endOfMonth}T23:59:59Z AND OrderId__r.Order_Source__c = 'SFA' AND Product2Id__r.Brand__c != NULL AND (OrderId__r.Order_Placed_By__c IN (${allUserIdsStr}) OR CreatedById IN (${allUserIdsStr})) GROUP BY Product2Id__r.Brand__c ORDER BY SUM(Net_Amount__c) DESC`;
          const brandRes = await fetchRecords("Order_Item__c", brandQuery);
          if (Array.isArray(brandRes)) {
            setBrandProductivity(brandRes);
          }
        } catch (brandErr) {
          console.error("Failed to query brand productivity:", brandErr);
        }

        // 7. Fetch Category-wise productivity
        try {
          const categoryQuery = `SELECT Product2Id__r.Category__c, COUNT_DISTINCT(OrderId__c) totalOrders, SUM(Quantity_In_Box__c) totalBoxes, SUM(Quantity_In_Pcs__c) totalPieces, SUM(Net_Amount__c) totalOrderValue FROM Order_Item__c WHERE OrderId__r.CreatedDate >= ${startOfMonth}T00:00:00Z AND OrderId__r.CreatedDate <= ${endOfMonth}T23:59:59Z AND OrderId__r.Order_Source__c = 'SFA' AND Product2Id__r.Category__c != NULL AND (OrderId__r.Order_Placed_By__c IN (${allUserIdsStr}) OR CreatedById IN (${allUserIdsStr})) GROUP BY Product2Id__r.Category__c ORDER BY SUM(Net_Amount__c) DESC`;
          const categoryRes = await fetchRecords("Order_Item__c", categoryQuery);
          if (Array.isArray(categoryRes)) {
            setCategoryProductivity(categoryRes);
          }
        } catch (categoryErr) {
          console.error("Failed to query category productivity:", categoryErr);
        }

      } catch (err) {
        console.error("Salesforce online MTD fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchMTDData();
    }
  }, [selectedMonth, userId, selectedPersona, selectedEmployee, subordinates.length]);

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Premium Header */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E"]}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MTD Sales Dashboard</Text>
        </View>
      </LinearGradient>

      {/* Main Body */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Month Selector Dropdown */}
        <TouchableOpacity style={styles.monthDropdown} onPress={() => setOpenMonthPicker(true)}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Ionicons name="calendar-outline" size={20} color="#C9A24D" style={{ marginRight: 10 }} />
            <View style={styles.filterLabelContainer}>
              <Text style={styles.filterLabel}>Select Month</Text>
              <Text style={styles.filterValue}>{selectedMonth.format("MMMM YYYY")}</Text>
            </View>
          </View>
          <Ionicons name="chevron-down" size={16} color="#7A7266" />
        </TouchableOpacity>

        {/* Dynamic Filters Row */}
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
          <View>
            <View style={styles.grid}>
              {/* Group 1 Cards */}
              {hasRoleAccess(userRole, group1Roles) && (
                <>
                  <MetricCard
                    title="Spot Sales Booking (Box)"
                    value={boxSales}
                    icon="package-variant-closed"
                    color="#FF9800"
                    bgColor="#FBEFD8"
                    onPress={() =>
                      navigation.navigate("DailyDashboardDetail", {
                        title: "Sales Box Details",
                        metricType: "sales_box",
                        selectedPersona,
                        selectedEmployee,
                        userId,
                        userRole,
                        userName,
                        subordinates,
                        rawBeatDays,
                        rawAttendances,
                        rawVisits,
                        rawOrders,
                        rawOrderItems,
                        rawOrderBookingSummary,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                  <MetricCard
                    title="Spot Sales Booking (Pcs)"
                    value={pcsSales}
                    icon="box-cutter"
                    color="#4CAF50"
                    bgColor="#E3F1EA"
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
                        rawOrders,
                        rawOrderPcsItems,
                        rawOrderBookingSummary,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                  <MetricCard
                    title="Spot Sales Value"
                    value="Upcoming"
                    icon="currency-inr"
                    color="#B3261E"
                    bgColor="#F9E5E3"
                    valueStyle={styles.upcomingValue}
                    onPress={() => {
                      dispatch(
                        showToast({
                          message: "Spot Sales Value is an upcoming feature.",
                          type: "warning",
                        })
                      );
                    }}
                  />
                </>
              )}

              {/* Group 2 Cards */}
              {hasRoleAccess(userRole, group2Roles) && (
                <>
                  <MetricCard
                    title="Total Visits (TV)"
                    value={totalCalls}
                    icon="phone-in-talk"
                    color="#2196F3"
                    bgColor="#E3F2FD"
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
                        rawOrders,
                        rawTcTeamSummary,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                  <MetricCard
                    title="Productive Visits (PV)"
                    value={productiveCalls}
                    icon="checkbox-marked-circle-outline"
                    color="#9C27B0"
                    bgColor="#F3E5F5"
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
                        rawOrders,
                        rawTcTeamSummary,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                  <MetricCard
                    title="Total Outlets Visited"
                    value={outletsVisited}
                    icon="store-outline"
                    color="#009688"
                    bgColor="#E3F1EA"
                    onPress={() =>
                      navigation.navigate("DailyDashboardDetail", {
                        title: "Total Outlets Visited Details",
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
                        rawOrders,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                </>
              )}

              {/* Group 3 Cards (Visible only when specific employee is selected) */}
              {hasRoleAccess(userRole, group3Roles) && selectedEmployee !== "All" && (
                <>
                  <MetricCard
                    title="Avg Retailing Time"
                    value={avgRetailingTime}
                    icon="clock-outline"
                    color="#FF5722"
                    bgColor="#FBE9E7"
                    onPress={() =>
                      navigation.navigate("DailyDashboardDetail", {
                        title: "Avg Retailing Time Details",
                        metricType: "avg_retailing",
                        selectedPersona,
                        selectedEmployee,
                        userId,
                        userRole,
                        userName,
                        subordinates,
                        rawBeatDays,
                        rawAttendances,
                        rawVisits,
                        rawOrders,
                        rawOrderItems,
                        rawOrderPcsItems,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                  <MetricCard
                    title="Avg Total Time"
                    value={avgTotalTime}
                    icon="clock-fast"
                    color="#795548"
                    bgColor="#EFEBE9"
                    onPress={() =>
                      navigation.navigate("DailyDashboardDetail", {
                        title: "Avg Total Time Details",
                        metricType: "avg_total",
                        selectedPersona,
                        selectedEmployee,
                        userId,
                        userRole,
                        userName,
                        subordinates,
                        rawBeatDays,
                        rawAttendances,
                        rawVisits,
                        rawOrders,
                        rawOrderItems,
                        rawOrderPcsItems,
                        selectedMonth: selectedMonth.format("YYYY-MM"),
                        selectedMonthStart: startOfMonth,
                        selectedMonthEnd: endOfMonth,
                      })
                    }
                  />
                </>
              )}
            </View>

            {/* Group 4 Bifurcations */}
            {hasRoleAccess(userRole, group4Roles) && (
              <View style={styles.bifurcationSection}>

                {/* Brand wise stats */}
                <TouchableOpacity
                  style={styles.bifurcationCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Productivity Brand Wise",
                      metricType: "brand_wise",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawOrders,
                      rawOrderItems,
                    })
                  }
                >
                  <View style={styles.bifurcationHeader}>
                    <MaterialCommunityIcons name="tag-multiple-outline" size={20} color="#607D8B" />
                    <Text style={styles.bifurcationTitle}>Productivity Brand Wise</Text>
                  </View>
                  <View style={styles.divider} />
                  {brandProductivity.length === 0 ? (
                    <View style={{ padding: 20, alignItems: "center" }}>
                      <Text style={{ color: "#7A7266", fontSize: 13 }}>No brand data available</Text>
                    </View>
                  ) : (
                    brandProductivity.map((item, index) => {
                      const brandName = item.Product2Id__r?.Brand__c || item.Brand__c || "Unknown";
                      const val = Number(item.totalOrderValue || item.expr4 || item.expr3 || 0);
                      const grandTotal = brandProductivity.reduce((sum, b) => sum + Number(b.totalOrderValue || b.expr4 || b.expr3 || 0), 0);
                      const pct = grandTotal > 0 ? Math.round((val / grandTotal) * 100) : 0;

                      return (
                        <View key={index} style={styles.barContainer}>
                          <Text style={styles.barLabel}>{brandName}</Text>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: "#607D8B" }]} />
                          </View>
                          <Text style={styles.barPercent} numberOfLines={1}>
                            {pct}%
                          </Text>
                        </View>
                      );
                    })
                  )}
                </TouchableOpacity>

                {/* Primary Category wise stats */}
                <TouchableOpacity
                  style={styles.bifurcationCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate("DailyDashboardDetail", {
                      title: "Category bifurcation of spot sales",
                      metricType: "category_wise",
                      selectedPersona,
                      selectedEmployee,
                      userId,
                      userRole,
                      userName,
                      subordinates,
                      rawBeatDays,
                      rawAttendances,
                      rawVisits,
                      rawOrders,
                      rawOrderItems,
                    })
                  }
                >
                  <View style={styles.bifurcationHeader}>
                    <MaterialCommunityIcons name="chart-pie" size={20} color="#3F51B5" />
                    <Text style={styles.bifurcationTitle}>Category bifurcation of spot sales</Text>
                  </View>
                  <View style={styles.divider} />
                  {categoryProductivity.length === 0 ? (
                    <View style={{ padding: 20, alignItems: "center" }}>
                      <Text style={{ color: "#7A7266", fontSize: 13 }}>No category data available</Text>
                    </View>
                  ) : (
                    categoryProductivity.map((item, index) => {
                      const categoryName = item.Product2Id__r?.Category__c || item.Category__c || "Unknown";
                      const val = Number(item.totalOrderValue || item.expr4 || item.expr3 || 0);
                      const grandTotal = categoryProductivity.reduce((sum, b) => sum + Number(b.totalOrderValue || b.expr4 || b.expr3 || 0), 0);
                      const pct = grandTotal > 0 ? Math.round((val / grandTotal) * 100) : 0;

                      return (
                        <View key={index} style={styles.barContainer}>
                          <Text style={styles.barLabel}>{categoryName}</Text>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: "#3F51B5" }]} />
                          </View>
                          <Text style={styles.barPercent} numberOfLines={1}>
                            {pct}%
                          </Text>
                        </View>
                      );
                    })
                  )}
                </TouchableOpacity>

              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Picker Modals */}
      {/* 1. Month Picker Modal */}
      <Modal visible={openMonthPicker} transparent animationType="fade" onRequestClose={() => setOpenMonthPicker(false)}>
        <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenMonthPicker(false)}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalHeaderText}>Select Month</Text>
              <TouchableOpacity onPress={() => setOpenMonthPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.modalScroll}>
              {monthOptions.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    modalStyles.menuItem,
                    selectedMonth.isSame(opt, "month") && modalStyles.menuItemActive,
                  ]}
                  onPress={() => {
                    setSelectedMonth(opt);
                    setOpenMonthPicker(false);
                  }}
                >
                  <Text style={modalStyles.menuText}>{opt.format("MMMM YYYY")}</Text>
                  {selectedMonth.isSame(opt, "month") && (
                    <Ionicons name="checkmark" size={20} color="#C9A24D" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Persona Selector Modal */}
      <Modal visible={openPersonaPicker} transparent animationType="fade" onRequestClose={() => setOpenPersonaPicker(false)}>
        <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenPersonaPicker(false)}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalHeaderText}>Select Persona</Text>
              <TouchableOpacity onPress={() => setOpenPersonaPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.modalScroll}>
              <TouchableOpacity
                style={[modalStyles.menuItem, selectedPersona === "All" && modalStyles.menuItemActive]}
                onPress={() => {
                  setSelectedPersona("All");
                  setOpenPersonaPicker(false);
                }}
              >
                <Text style={modalStyles.menuText}>All</Text>
                {selectedPersona === "All" && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
              </TouchableOpacity>
              {personaList.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[modalStyles.menuItem, selectedPersona === p && modalStyles.menuItemActive]}
                  onPress={() => {
                    setSelectedPersona(p);
                    setOpenPersonaPicker(false);
                  }}
                >
                  <Text style={modalStyles.menuText}>{p}</Text>
                  {selectedPersona === p && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3. Employee Selector Modal */}
      <Modal visible={openEmployeePicker} transparent animationType="fade" onRequestClose={() => setOpenEmployeePicker(false)}>
        <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenEmployeePicker(false)}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalHeaderText}>Select Employee</Text>
              <TouchableOpacity onPress={() => setOpenEmployeePicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.modalScroll}>
              <TouchableOpacity
                style={[modalStyles.menuItem, selectedEmployee === "All" && modalStyles.menuItemActive]}
                onPress={() => {
                  setSelectedEmployee("All");
                  setOpenEmployeePicker(false);
                }}
              >
                <Text style={modalStyles.menuText}>All</Text>
                {selectedEmployee === "All" && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
              </TouchableOpacity>
              {employeeList.map((e, i) => (
                <TouchableOpacity
                  key={i}
                  style={[modalStyles.menuItem, selectedEmployee === e.Sf_Id && modalStyles.menuItemActive]}
                  onPress={() => {
                    setSelectedEmployee(e.Sf_Id);
                    setOpenEmployeePicker(false);
                  }}
                >
                  <Text style={modalStyles.menuText}>{e.Name}</Text>
                  {selectedEmployee === e.Sf_Id && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>



    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: RFValue(15),
    fontWeight: "700",
    flex: 1,
    marginLeft: 12,
  },
  monthTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  monthTriggerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  monthDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
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
  upcomingValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B3261E",
  },
  bifurcationSection: {
    marginTop: 10,
  },
  bifurcationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1EADB",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  bifurcationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  bifurcationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginBottom: 12,
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  barLabel: {
    width: 110,
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#F1EADB",
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  barPercent: {
    minWidth: 44,
    fontSize: 11,
    color: "#1F1D1A",
    fontWeight: "700",
    textAlign: "right",
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
    maxHeight: 400,
  },
  modalHeader: {
    height: 56,
    backgroundColor: "#C9A24D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  modalHeaderText: {
    color: "#13265C",
    fontSize: 16,
    fontWeight: "700",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#D9D2C3",
    backgroundColor: "#fff",
  },
  menuItemActive: {
    backgroundColor: "#F1EADB",
  },
  menuText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F1D1A",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: "#A67C2E",
    fontWeight: "600",
  },
});

export default MTDSales;
