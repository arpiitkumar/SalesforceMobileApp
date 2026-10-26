import React, { FC, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Linking,
  StatusBar,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "../../components/Ionicons";
import moment from "moment";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { formatUnitsWithCases, formatCasesWithUnits } from "../../utils/helper/caseUnits";

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


const idMatches = (id1?: string, id2?: string): boolean => {
  if (!id1 || !id2) return false;
  const clean1 = String(id1).trim();
  const clean2 = String(id2).trim();
  if (clean1 === clean2) return true;
  return clean1.slice(0, 15) === clean2.slice(0, 15);
};

const findBeatDay = (rawBeatDays: any[], userId?: string) => {
  if (!userId) return undefined;
  return rawBeatDays.find((x: any) =>
    idMatches(x.OwnerId, userId) ||
    idMatches(x.Route_Plans__r?.Assigned_To__c, userId)
  );
};

const DailyDashboardDetail: FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");

  const {
    title,
    metricType,
    selectedDate,
    selectedPersona,
    selectedEmployee,
    userId,
    userRole,
    userName,
    subordinates = [],
    rawBeatDays = [],
    rawAttendances = [],
    rawVisits = [],
    rawTcVisits = [],
    rawPcVisits = [],
    rawOrders = [],
    rawOrderItems = [],
    rawOrderPcsItems = [],
    rawNotLoggedInUsers = [],
    rawSurveyResponses = [],
    rawSurveyAssignments = [],
    rawSurveyTargets = [],
    rawSurveyTemplates = [],
    rawTcTeamSummary = [],
    rawOrderBookingSummary = [],
    selectedMonth,
    selectedMonthStart,
    selectedMonthEnd,
  } = route.params || {};

  const startOfMonth = selectedMonthStart || (selectedMonth ? moment(selectedMonth, "YYYY-MM").startOf("month").format("YYYY-MM-DD") : moment().startOf("month").format("YYYY-MM-DD"));
  const endOfMonth = selectedMonthEnd || (selectedMonth ? moment(selectedMonth, "YYYY-MM").endOf("month").format("YYYY-MM-DD") : moment().endOf("month").format("YYYY-MM-DD"));

  const [onlineVisits, setOnlineVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  const cleanVisits = useMemo(() => {
    const seen = new Set();
    const source = (onlineVisits && onlineVisits.length > 0) ? onlineVisits : (rawVisits || []);
    return source.filter((r: any) => {
      if (!r.Id) return false;
      if (seen.has(r.Id)) return false;
      seen.add(r.Id);
      return true;
    });
  }, [rawVisits, onlineVisits]);

  const cleanTcVisits = useMemo(() => {
    const seen = new Set();
    return (rawTcVisits || []).filter((r: any) => {
      if (!r.Id) return false;
      if (seen.has(r.Id)) return false;
      seen.add(r.Id);
      return true;
    });
  }, [rawTcVisits]);

  const cleanPcVisits = useMemo(() => {
    const seen = new Set();
    return (rawPcVisits || []).filter((r: any) => {
      if (!r.Id) return false;
      if (seen.has(r.Id)) return false;
      seen.add(r.Id);
      return true;
    });
  }, [rawPcVisits]);

  // 1. Initial State Machine Determination
  const getInitialViewState = () => {
    if (metricType === "tc" || metricType === "sales_box" || metricType === "sales_qty") {
      if (selectedEmployee !== "All") {
        return { level: "detail", filterPersona: selectedPersona, filterEmployee: selectedEmployee };
      }
      return { level: "employees", filterPersona: selectedPersona !== "All" ? selectedPersona : "All", filterEmployee: null };
    }
    if (subordinates.length === 0 && (rawNotLoggedInUsers || []).length === 0) {
      return { level: "detail", filterPersona: "All", filterEmployee: userId };
    }
    if (selectedEmployee !== "All") {
      return { level: "detail", filterPersona: selectedPersona, filterEmployee: selectedEmployee };
    }
    if (selectedPersona !== "All") {
      return { level: "employees", filterPersona: selectedPersona, filterEmployee: null };
    }
    return { level: "personas", filterPersona: null, filterEmployee: null };
  };

  const [viewState, setViewState] = useState(getInitialViewState());
  const { fetchRecords } = useApiFetch();
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [tcTeamSummary, setTcTeamSummary] = useState<any[]>(rawTcTeamSummary || []);
  const [loadingTcTeam, setLoadingTcTeam] = useState(false);
  const [orderBookingSummary, setOrderBookingSummary] = useState<any[]>(rawOrderBookingSummary || []);
  const [loadingOrderSummary, setLoadingOrderSummary] = useState(false);

  useEffect(() => {
    if ((metricType === "sales_box" || metricType === "sales_qty") && (!orderBookingSummary || orderBookingSummary.length === 0)) {
      const fetchOrderBookingSummary = async () => {
        const mgrId = selectedEmployee && selectedEmployee !== "All" ? selectedEmployee : (userId || "0059I00000AfB3OQAV");
        const startDateTime = `${startOfMonth}T00:00:00Z`;
        const endDateTime = `${endOfMonth}T23:59:59Z`;
        setLoadingOrderSummary(true);
        try {
          const query = `SELECT OrderId__r.Order_Placed_By__r.Name SalesRepName, OrderId__r.Order_Placed_By__c SalesRepId, OrderId__r.Order_Placed_By__r.User_Type__c Role, SUM(Quantity_In_Box__c) TotalQuantityBox, SUM(Quantity_In_Pcs__c) TotalQuantityPcs, SUM(TotalPrice__c) TotalSalesAmount, COUNT_DISTINCT(OrderId__c) TotalOrdersPlaced FROM Order_Item__c WHERE OrderId__r.Order_Source__c = 'SFA' AND CreatedDate >= ${startDateTime} AND CreatedDate <= ${endDateTime} AND OrderId__c IN (SELECT Id FROM Order__c WHERE (Order_Placed_By__c = '${mgrId}' OR Order_Placed_By__r.ManagerId = '${mgrId}' OR Order_Placed_By__r.Manager.ManagerId = '${mgrId}' OR Order_Placed_By__r.Manager.Manager.ManagerId = '${mgrId}')) GROUP BY OrderId__r.Order_Placed_By__r.Name, OrderId__r.Order_Placed_By__c, OrderId__r.Order_Placed_By__r.User_Type__c ORDER BY OrderId__r.Order_Placed_By__r.Name ASC`;
          const res = await fetchRecords("Order_Item__c", query);
          if (Array.isArray(res) && res.length > 0) {
            setOrderBookingSummary(res);
          }
        } catch (err) {
          console.warn("Could not query Order Booking summary online:", err);
          if (subordinates.length > 0) {
            try {
              const idsStr = subordinates.map((s: any) => `'${s.Sf_Id}'`).join(",");
              const fallback = `SELECT OrderId__r.Order_Placed_By__r.Name SalesRepName, OrderId__r.Order_Placed_By__c SalesRepId, OrderId__r.Order_Placed_By__r.User_Type__c Role, SUM(Quantity_In_Box__c) TotalQuantityBox, SUM(Quantity_In_Pcs__c) TotalQuantityPcs, SUM(TotalPrice__c) TotalSalesAmount, COUNT_DISTINCT(OrderId__c) TotalOrdersPlaced FROM Order_Item__c WHERE OrderId__r.Order_Source__c = 'SFA' AND CreatedDate >= ${startDateTime} AND CreatedDate <= ${endDateTime} AND (OrderId__r.Order_Placed_By__c IN (${idsStr}) OR CreatedById IN (${idsStr})) GROUP BY OrderId__r.Order_Placed_By__r.Name, OrderId__r.Order_Placed_By__c, OrderId__r.Order_Placed_By__r.User_Type__c ORDER BY OrderId__r.Order_Placed_By__r.Name ASC`;
              const res2 = await fetchRecords("Order_Item__c", fallback);
              if (Array.isArray(res2) && res2.length > 0) {
                setOrderBookingSummary(res2);
              }
            } catch (err2) {
              console.warn("Fallback order booking query failed:", err2);
            }
          }
        } finally {
          setLoadingOrderSummary(false);
        }
      };
      fetchOrderBookingSummary();
    }
  }, [metricType, selectedEmployee, userId, startOfMonth, endOfMonth]);

  useEffect(() => {
    if (metricType === "tc" && (!tcTeamSummary || tcTeamSummary.length === 0)) {
      const fetchTeamSummary = async () => {
        const mgrId = selectedEmployee && selectedEmployee !== "All" ? selectedEmployee : (userId || "0059I00000AfB3OQAV");
        const dateFilter = selectedDate
          ? `Beat_Date__c = ${selectedDate}`
          : `Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth}`;
        setLoadingTcTeam(true);
        try {
          const query = `SELECT Owner.Name SalesRepName, SUM(Total_Calls__c) MonthlyTotalCalls_TC, SUM(Productive_Calls__c) MonthlyProductiveCalls_PC, COUNT(Id) TotalWorkingDays FROM Beat_Day__c WHERE ${dateFilter} AND OwnerId IN (SELECT Id FROM User WHERE Id = '${mgrId}' OR ManagerId = '${mgrId}' OR Manager.ManagerId = '${mgrId}' OR Manager.Manager.ManagerId = '${mgrId}') GROUP BY Owner.Name ORDER BY Owner.Name ASC`;
          const res = await fetchRecords("BeatDay__c", query);
          if (Array.isArray(res) && res.length > 0) {
            setTcTeamSummary(res);
          }
        } catch (err) {
          console.warn("Could not query TC team summary online:", err);
        } finally {
          setLoadingTcTeam(false);
        }
      };
      fetchTeamSummary();
    }
  }, [metricType, selectedEmployee, userId, selectedDate, startOfMonth, endOfMonth]);

  useEffect(() => {
    if (metricType === "tc" || metricType === "pc" || metricType === "sales_box" || metricType === "sales_qty") {
      const fetchAllVisits = async () => {
        const empId = viewState.filterEmployee || selectedEmployee || userId;
        const userFilter = empId && empId !== "All"
          ? `(CreatedById = '${empId}' OR BeatDay__r.OwnerId = '${empId}' OR BeatDay__r.Route_Plans__r.Assigned_To__c = '${empId}')`
          : `(CreatedById IN (${(subordinates || []).map((s: any) => `'${s.Sf_Id}'`).join(",") || `'${userId}'`}) OR BeatDay__r.OwnerId IN (${(subordinates || []).map((s: any) => `'${s.Sf_Id}'`).join(",") || `'${userId}'`}))`;

        try {
          setLoadingVisits(true);
          const vQuery = `SELECT Id, CreatedById, CreatedBy.Name, CheckInTime__c, CheckOutTime__c, ProductiveCall__c, VisitStatus__c, AccountId__c, AccountId__r.Name, BeatDay__r.OwnerId, BeatDay__r.Route_Plans__r.Assigned_To__c, BeatDay__r.Route_Plans__r.Assigned_To__r.Name, BeatDay__r.Approval_Status__c, BeatDay__r.Beat_Date__c, Retailing_Duration_Minutes__c, BeatDay__c, IsOrderPlaced__c FROM Visit__c WHERE CreatedDate >= ${startOfMonth}T00:00:00Z AND CreatedDate <= ${endOfMonth}T23:59:59Z AND ${userFilter} ORDER BY CreatedDate DESC`;
          console.log("🔍 [DailyDashboardDetail] Fetching all visits online for TC in selected month:", vQuery);
          const res = await fetchRecords("Visit__c", vQuery);
          if (Array.isArray(res) && res.length > 0) {
            setOnlineVisits(res);
          }
        } catch (err) {
          console.warn("Failed to fetch visits online in DailyDashboardDetail:", err);
        } finally {
          setLoadingVisits(false);
        }
      };
      fetchAllVisits();
    }
  }, [metricType, viewState.filterEmployee, selectedEmployee, userId, startOfMonth, endOfMonth]);

  useEffect(() => {
    if (metricType === "working_duration") {
      const fetchMonthlyAttendance = async () => {
        const empId = viewState.filterEmployee || selectedEmployee || userId;
        if (!empId || empId === "All") return;
        setLoadingMonthly(true);
        try {
          const dateFilter = selectedDate ? `AttendanceDate__c = ${selectedDate}` : `AttendanceDate__c = THIS_MONTH`;
          const query = `SELECT AttendanceDate__c, AttendanceStartTime__c, AttendanceEndTime__c, Working_Hours__c, AttendanceStatus__c FROM Attendance__c WHERE ${dateFilter} AND User__c = '${empId}' ORDER BY AttendanceDate__c DESC`;
          console.log("Working Duration SOQL Query:", query);
          const res = await fetchRecords("Attendance__c", query);
          if (Array.isArray(res)) {
            setMonthlyAttendance(res);
          }
        } catch (err) {
          console.error("Failed to query attendance for working duration:", err);
        } finally {
          setLoadingMonthly(false);
        }
      };
      fetchMonthlyAttendance();
    }
  }, [metricType, viewState.filterEmployee, selectedEmployee, userId, selectedDate]);

  // 1.5 Dynamic Subordinates computation to include all active users in rawBeatDays
  const dynamicSubordinates = useMemo(() => {
    const usersMap = new Map();
    // 1. Add direct subordinates from query
    (subordinates || []).forEach((s: any) => {
      if (s.Sf_Id) {
        usersMap.set(s.Sf_Id.substring(0, 15), s);
      }
    });
    // 2. Add users from rawBeatDays
    (rawBeatDays || []).forEach((bd: any) => {
      const uId = bd.Route_Plans__r?.Assigned_To__c || bd.OwnerId;
      const uName = bd.Route_Plans__r?.Assigned_To__r?.Name || bd.Owner?.Name || "Representative";
      const uRole = bd.Route_Plans__r?.Assigned_To__r?.UserRole?.Name || bd.Owner?.UserRole?.Name || "Representative";

      if (uId) {
        const shortId = uId.substring(0, 15);
        if (!usersMap.has(shortId)) {
          usersMap.set(shortId, {
            Sf_Id: uId,
            Name: uName,
            Role: uRole,
            Phone: ""
          });
        }
      }
    });
    return Array.from(usersMap.values());
  }, [subordinates, rawBeatDays]);

  // 2. Persona level dataset computation
  const personasData = useMemo(() => {
    if (viewState.level !== "personas") return [];

    let uniqueRoles = [...new Set(dynamicSubordinates.map((s: any) => s.Role))].filter((r: any) => r && r !== "Representative");
    if (metricType === "not_logged_in") {
      const notLoggedRoles = (rawNotLoggedInUsers || []).map((u: any) => u.UserRole?.Name || u.User_Type__c || u.Title || "Representative").filter((r: any) => r && r !== "Representative");
      uniqueRoles = [...new Set([...uniqueRoles, ...notLoggedRoles])];
    }

    if (userRole && !uniqueRoles.includes(userRole) && metricType !== "not_logged_in") {
      uniqueRoles.push(userRole);
    }

    const list = uniqueRoles.map((role: any) => {
      const roleUsers = dynamicSubordinates.filter((s: any) => s.Role === role && !idMatches(s.Sf_Id, userId));
      if (userRole === role) {
        const selfObject = {
          Sf_Id: userId,
          Name: `${userName || "Self"} (Self)`,
          Role: userRole || "Manager",
          Phone: "",
        };
        roleUsers.push(selfObject);
      }

      let totalVal = 0;
      let displayInfo = "";

      if (metricType === "tc") {
        roleUsers.forEach((user: any) => {
          const userBeatDays = (rawBeatDays || []).filter((x: any) =>
            idMatches(x.OwnerId, user.Sf_Id) ||
            idMatches(x.Route_Plans__r?.Assigned_To__c, user.Sf_Id)
          );
          const bdTotalCalls = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.Total_Calls__c || 0), 0);
          const myVisits = cleanVisits.filter((v: any) =>
            idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
            idMatches(v.CreatedById, user.Sf_Id)
          );
          const subTcVisits = cleanTcVisits.filter((v: any) =>
            idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
            idMatches(v.CreatedById, user.Sf_Id)
          );

          const userVal = bdTotalCalls || subTcVisits.length || myVisits.length;
          totalVal += userVal;
        });
        displayInfo = `${totalVal} Calls`;
      } else if (metricType === "pc") {
        roleUsers.forEach((user: any) => {
          const userBeatDays = (rawBeatDays || []).filter((x: any) =>
            idMatches(x.OwnerId, user.Sf_Id) ||
            idMatches(x.Route_Plans__r?.Assigned_To__c, user.Sf_Id)
          );
          const bdProductiveCalls = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.Productive_Calls__c || 0), 0);
          const myVisits = cleanVisits.filter((v: any) => idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id));
          const empPcVisits = cleanPcVisits.filter((v: any) => idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id));

          const isSelf = idMatches(user.Sf_Id, userId);
          const userPc = isSelf
            ? (empPcVisits.length || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length)
            : (bdProductiveCalls || empPcVisits.length || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length);
          totalVal += userPc;
        });
        displayInfo = `${totalVal} Productive`;
      } else if (metricType === "sales_qty") {
        roleUsers.forEach((user: any) => {
          const userOrders = (rawOrders || []).filter((ord: any) => {
            const placedById = ord.Order_Placed_By__c || ord.CreatedById;
            const placedByName = ord.SalesRepName || ord.Name || ord.Order_Placed_By__r?.Name;
            const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
            const isNameMatch = (placedByName && user.Name) &&
              (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
            return isIdMatch || isNameMatch;
          });
          const qtyPcs = userOrders.reduce((sum: number, ord: any) => sum + Number(ord.SalesQuantityPcs ?? ord.OrderCount ?? ord.expr0 ?? ord.Quantity__c ?? 0), 0);

          const userOrderItems = (rawOrderPcsItems || []).filter((item: any) => {
            const placedById = item.OrderId__r?.Order_Placed_By__c;
            const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
            const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
            const isNameMatch = (placedByName && user.Name) &&
              (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
            return (isIdMatch || isNameMatch) && item.UOM_Selected__c === "20";
          });
          const myQty = userOrderItems.reduce((sum: number, item: any) => sum + (item.Quantity_In_Pcs__c || 0), 0);
          totalVal += (qtyPcs || myQty);
        });
        displayInfo = formatUnitsWithCases(Math.round(totalVal), "Pcs");
      } else if (metricType === "sales_box") {
        roleUsers.forEach((user: any) => {
          const userOrderItems = (rawOrderItems || []).filter((item: any) => {
            const placedById = item.OrderId__r?.Order_Placed_By__c;
            const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
            const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
            const isNameMatch = (placedByName && user.Name) &&
              (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
            return (isIdMatch || isNameMatch) && item.UOM_Selected__c === "10";
          });
          const myQty = userOrderItems.reduce((sum: number, item: any) => sum + (item.Quantity_In_Box__c || 0), 0);
          totalVal += myQty;
        });
        displayInfo = formatCasesWithUnits(Math.round(totalVal));
      } else if (metricType === "sales_value") {
        roleUsers.forEach((user: any) => {
          const userBeatDays = (rawBeatDays || []).filter((x: any) =>
            idMatches(x.OwnerId, user.Sf_Id) ||
            idMatches(x.Route_Plans__r?.Assigned_To__c, user.Sf_Id)
          );
          const bdOrderVal = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.SecOrderValue__c || x.Sec_Order_Value__c || 0), 0);
          const isSelf = idMatches(user.Sf_Id, userId);
          const myVal = isSelf ? 0 : bdOrderVal;
          totalVal += myVal;
        });
        displayInfo = `₹${totalVal.toLocaleString("en-IN")}`;
      } else if (metricType === "brand_wise") {
        roleUsers.forEach((user: any) => {
          const userOrderItems = (rawOrderItems || []).filter((item: any) => {
            const placedById = item.OrderId__r?.Order_Placed_By__c;
            const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
            const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
            const isNameMatch = (placedByName && user.Name) &&
              (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
            return isIdMatch || isNameMatch;
          });
          const myVal = userOrderItems.reduce((sum: number, item: any) => sum + Number(item.Net_Amount__c || 0), 0);
          totalVal += myVal;
        });
        displayInfo = `₹${totalVal.toLocaleString("en-IN")}`;
      } else if (metricType === "category_wise") {
        roleUsers.forEach((user: any) => {
          const userOrderItems = (rawOrderItems || []).filter((item: any) => {
            const placedById = item.OrderId__r?.Order_Placed_By__c;
            const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
            const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
            const isNameMatch = (placedByName && user.Name) &&
              (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
            return isIdMatch || isNameMatch;
          });
          const myVal = userOrderItems.reduce((sum: number, item: any) => sum + Number(item.Net_Amount__c || 0), 0);
          totalVal += myVal;
        });
        displayInfo = `₹${totalVal.toLocaleString("en-IN")}`;
      } else if (metricType === "auth") {
        roleUsers.forEach((user: any) => {
          const myVisits = cleanVisits.filter((v: any) =>
            idMatches(v.CreatedById, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id)
          );
          totalVal += myVisits.length;
        });
        displayInfo = `${totalVal} Visited`;
      } else if (metricType === "productivity") {
        let tcSum = 0;
        let pcSum = 0;
        roleUsers.forEach((user: any) => {
          const userBeatDays = (rawBeatDays || []).filter((x: any) =>
            idMatches(x.OwnerId, user.Sf_Id) ||
            idMatches(x.Route_Plans__r?.Assigned_To__c, user.Sf_Id)
          );
          const bdTotalCalls = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.Total_Calls__c || 0), 0);
          const bdProductiveCalls = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.Productive_Calls__c || 0), 0);
          const myVisits = cleanVisits.filter((v: any) =>
            idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
            idMatches(v.CreatedById, user.Sf_Id)
          );
          const subTcVisits = cleanTcVisits.filter((v: any) =>
            idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
            idMatches(v.CreatedById, user.Sf_Id)
          );
          const empPcVisits = cleanPcVisits.filter((v: any) =>
            idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
            idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
            idMatches(v.CreatedById, user.Sf_Id)
          );

          const isSelf = idMatches(user.Sf_Id, userId);
          const userTc = bdTotalCalls || subTcVisits.length || myVisits.length;
          const userPc = isSelf
            ? (empPcVisits.length || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length)
            : (bdProductiveCalls || empPcVisits.length || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length);

          tcSum += userTc;
          pcSum += userPc;
        });
        const pct = tcSum > 0 ? Math.round((pcSum / tcSum) * 100) : 0;
        displayInfo = `${pct}% Productivity`;
      } else if (metricType === "check_in" || metricType === "check_out" || metricType === "attendance") {
        const roleUserIds = roleUsers.map((u) => u.Sf_Id);
        const roleAtt = rawAttendances.filter((att: any) => roleUserIds.some((id) => idMatches(id, att.User__c)));
        const present = roleAtt.filter((a: any) => a.AttendanceStatus__c === "Present").length;
        displayInfo = `${present} / ${roleUsers.length} Present`;
      } else if (metricType === "avg_retailing") {
        let totalRetMin = 0;
        let retCount = 0;
        roleUsers.forEach((user: any) => {
          const userVisits = cleanVisits.filter((v: any) =>
            v.CheckInTime__c && v.CheckOutTime__c &&
            idMatches(v.CreatedById, user.Sf_Id)
          );
          userVisits.forEach((v: any) => {
            let retMin = Number(v.Retailing_Duration_Minutes__c || 0);
            if (retMin <= 0) {
              const diff = moment(v.CheckOutTime__c).diff(moment(v.CheckInTime__c), "minutes");
              if (diff > 0 && diff < 480) {
                retMin = diff;
              }
            }
            if (retMin > 0) {
              totalRetMin += retMin;
              retCount++;
            }
          });
        });
        const avg = retCount > 0 ? Math.round(totalRetMin / retCount) : 0;
        displayInfo = `${avg} mins Avg`;
      } else if (metricType === "avg_total") {
        let totalFieldMin = 0;
        let fieldDaysCount = 0;
        const fieldDaysSeen = new Set();
        roleUsers.forEach((user: any) => {
          const userVisits = cleanVisits.filter((v: any) =>
            v.CheckInTime__c && v.CheckOutTime__c &&
            idMatches(v.CreatedById, user.Sf_Id)
          );
          userVisits.forEach((v: any) => {
            const bdId = v.BeatDay__c || v.BeatDay__r?.Id;
            if (bdId && !fieldDaysSeen.has(bdId)) {
              fieldDaysSeen.add(bdId);
              const bdRecord = rawBeatDays.find((bd: any) => idMatches(bd.Id, bdId));
              let fieldMin = Number(v.BeatDay__r?.Field_Duration_Minutes__c || bdRecord?.Field_Duration_Minutes__c || 0);
              if (fieldMin <= 0) {
                const firstCall = v.BeatDay__r?.First_Call_Time__c || bdRecord?.First_Call_Time__c;
                const lastCall = v.BeatDay__r?.Last_Call_Time__c || bdRecord?.Last_Call_Time__c || v.BeatDay__r?.EndOfDayTime__c || bdRecord?.EndOfDayTime__c;
                if (firstCall && lastCall) {
                  const diff = moment(lastCall).diff(moment(firstCall), "minutes");
                  if (diff > 0 && diff < 720) {
                    fieldMin = diff;
                  }
                }
              }
              if (fieldMin > 0) {
                totalFieldMin += fieldMin;
                fieldDaysCount++;
              }
            }
          });
        });
        const avg = fieldDaysCount > 0 ? Math.round(totalFieldMin / fieldDaysCount) : 0;
        displayInfo = `${Math.floor(avg / 60)}h ${avg % 60}m Avg`;
      } else if (metricType === "not_logged_in") {
        const roleUsers = (rawNotLoggedInUsers || []).filter((u: any) => {
          const uRole = u.UserRole?.Name || u.User_Type__c || u.Title || "Representative";
          return uRole === role || dynamicSubordinates.some((s: any) => s.Role === role && idMatches(s.Sf_Id, u.Id));
        });
        totalVal = roleUsers.length;
        displayInfo = `${totalVal} Not Logged In`;
      } else if (metricType === "survey") {
        let roleComp = 0;
        roleUsers.forEach((user: any) => {
          const uResponses = (rawSurveyResponses || []).filter((sr: any) =>
            idMatches(sr.CreatedById, user.Sf_Id) ||
            (sr.userName && user.Name && user.Name.toLowerCase().includes(sr.userName.toLowerCase())) ||
            (sr.userName && user.Name && sr.userName.toLowerCase().includes(user.Name.toLowerCase()))
          );
          const comp = uResponses.reduce((sum: number, cur: any) => sum + Number(cur.Completed || cur.expr0 || 1), 0);
          roleComp += comp;
        });
        totalVal = roleComp;
        displayInfo = `${roleComp} Completed`;
      }

      const isSelfRole = userRole && role.toUpperCase() === userRole.toUpperCase();
      return {
        Role: isSelfRole ? `${role} (Self)` : role,
        rawRole: role,
        subtitle: isSelfRole ? "Self Data" : "Subordinates Group",
        count: totalVal,
        info: displayInfo,
      };
    });

    return list.filter((item) => metricType === "not_logged_in" ? item.count > 0 : (item.Role !== "Manager" || item.count > 0));
  }, [viewState.level, dynamicSubordinates, userRole, userId, metricType, rawBeatDays, cleanTcVisits, cleanPcVisits, cleanVisits, rawAttendances, rawOrders, rawOrderItems, rawOrderPcsItems, rawNotLoggedInUsers, rawSurveyResponses]);

  // 3. Employee level dataset computation
  const employeesData = useMemo(() => {
    if (viewState.level !== "employees") return [];

    if ((metricType === "sales_box" || metricType === "sales_qty") && (orderBookingSummary || []).length > 0) {
      let filteredSummary = orderBookingSummary;
      if (viewState.filterPersona && viewState.filterPersona !== "All") {
        filteredSummary = orderBookingSummary.filter((r: any) => {
          if (r.Role && r.Role === viewState.filterPersona) return true;
          const repName = (r.SalesRepName || "").trim().toLowerCase();
          const sub = (dynamicSubordinates || subordinates || []).find(
            (s: any) => s.Name && s.Name.trim().toLowerCase() === repName
          );
          return sub?.Role === viewState.filterPersona;
        });
      }

      return filteredSummary.map((r: any, idx: number) => {
        const repName = r.SalesRepName || `Sales Rep ${idx + 1}`;
        const totalBox = Number(r.TotalQuantityBox || r.expr0 || 0);
        const totalPcs = Number(r.TotalQuantityPcs || r.expr1 || 0);
        const totalAmount = Number(r.TotalSalesAmount || r.expr2 || 0);
        const ordersPlaced = Number(r.TotalOrdersPlaced || r.expr3 || 0);

        const matchedSub = (dynamicSubordinates || subordinates || []).find(
          (s: any) => (r.SalesRepId && idMatches(s.Sf_Id, r.SalesRepId)) ||
                      (s.Name && s.Name.trim().toLowerCase() === repName.trim().toLowerCase())
        );

        const isBox = metricType === "sales_box";
        return {
          Sf_Id: matchedSub?.Sf_Id || r.SalesRepId || `rep-${idx}`,
          Name: repName,
          Role: r.Role || matchedSub?.Role || "Sales Representative",
          info: isBox ? formatCasesWithUnits(Math.round(totalBox)) : formatUnitsWithCases(Math.round(totalPcs), "Pcs"),
          subtitle: `Spot Sales: ${ordersPlaced} • ₹${totalAmount.toLocaleString("en-IN")}`,
          totalBox,
          totalPcs,
          totalAmount,
          ordersPlaced,
        };
      });
    }

    if (metricType === "tc" && (tcTeamSummary || []).length > 0) {
      let filteredSummary = tcTeamSummary;
      if (viewState.filterPersona && viewState.filterPersona !== "All") {
        filteredSummary = tcTeamSummary.filter((r: any) => {
          const repName = (r.SalesRepName || "").trim().toLowerCase();
          const sub = (dynamicSubordinates || subordinates || []).find(
            (s: any) => s.Name && s.Name.trim().toLowerCase() === repName
          );
          return sub?.Role === viewState.filterPersona;
        });
      }

      return filteredSummary.map((r: any, idx: number) => {
        const repName = r.SalesRepName || `Sales Rep ${idx + 1}`;
        const totalCalls = Number(r.MonthlyTotalCalls_TC || r.expr0 || 0);
        const productiveCalls = Number(r.MonthlyProductiveCalls_PC || r.expr1 || 0);
        const workingDays = Number(r.TotalWorkingDays || r.expr2 || 0);
        const pct = totalCalls > 0 ? Math.round((productiveCalls / totalCalls) * 100) : 0;

        const matchedSub = (dynamicSubordinates || subordinates || []).find(
          (s: any) => s.Name && s.Name.trim().toLowerCase() === repName.trim().toLowerCase()
        );

        return {
          Sf_Id: matchedSub?.Sf_Id || `rep-${idx}`,
          Name: repName,
          Role: matchedSub?.Role || "Sales Representative",
          info: `${totalCalls} Calls`,
          subtitle: `Working Days: ${workingDays} • PC: ${productiveCalls} (${pct}%)`,
          totalCalls,
          productiveCalls,
          workingDays,
          productivityPct: pct,
        };
      });
    }

    if (metricType === "not_logged_in") {
      const filteredNotLogged = (rawNotLoggedInUsers || []).filter((u: any) => {
        if (viewState.filterPersona) {
          const uRole = u.UserRole?.Name || u.User_Type__c || u.Title || "Representative";
          return uRole === viewState.filterPersona || dynamicSubordinates.some((s: any) => s.Role === viewState.filterPersona && idMatches(s.Sf_Id, u.Id));
        }
        return true;
      });

      return filteredNotLogged.map((u: any) => ({
        Sf_Id: u.Id,
        Name: u.Name,
        Role: u.UserRole?.Name || u.User_Type__c || u.Title || "Representative",
        Phone: u.Phone || "",
        Email: u.Email || "",
        ManagerName: u.Manager?.Name || "",
        info: "Not Logged In",
      }));
    }

    const activeSubordinates = dynamicSubordinates.filter((s: any) =>
      s.Role === viewState.filterPersona && !idMatches(s.Sf_Id, userId)
    );

    const selfObject = {
      Sf_Id: userId,
      Name: `${userName || "Self"} (Self)`,
      Role: userRole || "Manager",
      Phone: "",
    };
    const showSelf = userRole === viewState.filterPersona;
    const finalUsers = showSelf ? [selfObject, ...activeSubordinates] : activeSubordinates;

    return finalUsers.map((user: any) => {
      const userBeatDays = (rawBeatDays || []).filter((x: any) =>
        idMatches(x.OwnerId, user.Sf_Id) ||
        idMatches(x.Route_Plans__r?.Assigned_To__c, user.Sf_Id)
      );
      const bd = userBeatDays[0];
      const bdTotalCalls = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.Total_Calls__c || 0), 0);
      const bdProductiveCalls = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.Productive_Calls__c || 0), 0);
      const bdOrderVal = userBeatDays.reduce((sum: number, x: any) => sum + Number(x.SecOrderValue__c || x.Sec_Order_Value__c || 0), 0);
      const att = rawAttendances.find((x: any) => idMatches(x.User__c, user.Sf_Id));

      const bdId = bd?.Id;
      const myVisits = cleanVisits.filter((v: any) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        const ownerId = v.BeatDay__r?.OwnerId;
        const createdById = v.CreatedById;
        return idMatches(assignedTo, user.Sf_Id) || idMatches(ownerId, user.Sf_Id) || idMatches(createdById, user.Sf_Id);
      });

      let userVal = 0;
      let displayInfo = "";
      const isSelf = idMatches(user.Sf_Id, userId);

      if (metricType === "tc") {
        let subTcVisits = cleanTcVisits.filter((v) =>
          idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
          idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
          idMatches(v.CreatedById, user.Sf_Id)
        );
        userVal = bdTotalCalls || subTcVisits.length || myVisits.length;
        displayInfo = `${userVal} Calls`;
      } else if (metricType === "pc") {
        const empPcVisits = cleanPcVisits.filter((v) =>
          idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id) ||
          idMatches(v.BeatDay__r?.OwnerId, user.Sf_Id) ||
          idMatches(v.CreatedById, user.Sf_Id)
        );
        userVal = isSelf
          ? (empPcVisits.length || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length)
          : (bdProductiveCalls || empPcVisits.length || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length);
        displayInfo = `${userVal} Productive`;
      } else if (metricType === "sales_qty") {
        const userOrders = (rawOrders || []).filter((ord: any) => {
          const placedById = ord.Order_Placed_By__c || ord.CreatedById;
          const placedByName = ord.SalesRepName || ord.Name || ord.Order_Placed_By__r?.Name;
          const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
          const isNameMatch = (placedByName && user.Name) &&
            (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
          return isIdMatch || isNameMatch;
        });
        const qtyPcs = userOrders.reduce((sum: number, ord: any) => sum + Number(ord.SalesQuantityPcs ?? ord.OrderCount ?? ord.expr0 ?? ord.Quantity__c ?? 0), 0);

        const userOrderItems = (rawOrderPcsItems || []).filter((item: any) => {
          const placedById = item.OrderId__r?.Order_Placed_By__c;
          const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
          const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
          const isNameMatch = (placedByName && user.Name) &&
            (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
          return (isIdMatch || isNameMatch) && item.UOM_Selected__c === "20";
        });
        const pcsQty = userOrderItems.reduce((sum: number, item: any) => sum + (item.Quantity_In_Pcs__c || 0), 0);
        userVal = qtyPcs || pcsQty;
        displayInfo = formatUnitsWithCases(Math.round(userVal), "Pcs");
      } else if (metricType === "sales_box") {
        const userOrderItems = (rawOrderItems || []).filter((item: any) => {
          const placedById = item.OrderId__r?.Order_Placed_By__c;
          const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
          const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
          const isNameMatch = (placedByName && user.Name) &&
            (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
          return (isIdMatch || isNameMatch) && item.UOM_Selected__c === "10";
        });
        userVal = userOrderItems.reduce((sum: number, item: any) => sum + (item.Quantity_In_Box__c || 0), 0);
        displayInfo = formatCasesWithUnits(Math.round(userVal));
      } else if (metricType === "sales_value") {
        userVal = isSelf ? 0 : bdOrderVal;
        displayInfo = `₹${userVal.toLocaleString("en-IN")}`;
      } else if (metricType === "brand_wise") {
        const userOrderItems = (rawOrderItems || []).filter((item: any) => {
          const placedById = item.OrderId__r?.Order_Placed_By__c;
          const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
          const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
          const isNameMatch = (placedByName && user.Name) &&
            (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
          return isIdMatch || isNameMatch;
        });
        userVal = userOrderItems.reduce((sum: number, item: any) => sum + Number(item.Net_Amount__c || 0), 0);
        displayInfo = `₹${userVal.toLocaleString("en-IN")}`;
      } else if (metricType === "category_wise") {
        const userOrderItems = (rawOrderItems || []).filter((item: any) => {
          const placedById = item.OrderId__r?.Order_Placed_By__c;
          const placedByName = item.OrderId__r?.Order_Placed_By__r?.Name;
          const isIdMatch = placedById && idMatches(placedById, user.Sf_Id);
          const isNameMatch = (placedByName && user.Name) &&
            (user.Name.replace(/\(self\)/gi, "").trim().toLowerCase() === placedByName.toLowerCase());
          return isIdMatch || isNameMatch;
        });
        userVal = userOrderItems.reduce((sum: number, item: any) => sum + Number(item.Net_Amount__c || 0), 0);
        displayInfo = `₹${userVal.toLocaleString("en-IN")}`;
      } else if (metricType === "auth") {
        displayInfo = `${myVisits.length} Visited`;
      } else if (metricType === "productivity") {
        const subTc = cleanTcVisits.filter((v) => idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id)).length;
        const subPc = cleanPcVisits.filter((v) => idMatches(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c, user.Sf_Id)).length;
        const finalTc = bdTotalCalls || subTc || myVisits.length;
        const finalPc = isSelf
          ? (subPc || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length)
          : (bdProductiveCalls || subPc || myVisits.filter((v) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length);
        userVal = finalTc > 0 ? Math.round((finalPc / finalTc) * 100) : 0;
        displayInfo = `${userVal}% Productivity`;
      } else if (metricType === "check_in") {
        const time = getMinCheckIn(myVisits);
        displayInfo = `Checked In: ${time}`;
      } else if (metricType === "check_out") {
        const time = getMaxCheckOut(myVisits);
        displayInfo = `Checked Out: ${time}`;
      } else if (metricType === "attendance") {
        displayInfo = `Status: ${att?.AttendanceStatus__c || "Not Marked"}`;
      } else if (metricType === "avg_retailing") {
        const validVisits = cleanVisits.filter(v =>
          v.CheckInTime__c && v.CheckOutTime__c &&
          idMatches(v.CreatedById, user.Sf_Id)
        );
        let totalMin = 0;
        let count = 0;
        validVisits.forEach((v: any) => {
          let retMin = Number(v.Retailing_Duration_Minutes__c || 0);
          if (retMin <= 0) {
            const diff = moment(v.CheckOutTime__c).diff(moment(v.CheckInTime__c), "minutes");
            if (diff > 0 && diff < 480) {
              retMin = diff;
            }
          }
          if (retMin > 0) {
            totalMin += retMin;
            count++;
          }
        });
        const avg = count > 0 ? Math.round(totalMin / count) : 0;
        displayInfo = `${avg} mins Avg`;
      } else if (metricType === "avg_total") {
        const validVisits = cleanVisits.filter(v =>
          v.CheckInTime__c && v.CheckOutTime__c &&
          idMatches(v.CreatedById, user.Sf_Id)
        );
        const fieldDaysSeen = new Set();
        let totalFieldMin = 0;
        validVisits.forEach((v: any) => {
          const bdId = v.BeatDay__c || v.BeatDay__r?.Id;
          if (bdId && !fieldDaysSeen.has(bdId)) {
            fieldDaysSeen.add(bdId);
            const bdRecord = rawBeatDays.find((bd: any) => idMatches(bd.Id, bdId));
            let fieldMin = Number(v.BeatDay__r?.Field_Duration_Minutes__c || bdRecord?.Field_Duration_Minutes__c || 0);
            if (fieldMin <= 0) {
              const firstCall = v.BeatDay__r?.First_Call_Time__c || bdRecord?.First_Call_Time__c;
              const lastCall = v.BeatDay__r?.Last_Call_Time__c || bdRecord?.Last_Call_Time__c || v.BeatDay__r?.EndOfDayTime__c || bdRecord?.EndOfDayTime__c;
              if (firstCall && lastCall) {
                const diff = moment(lastCall).diff(moment(firstCall), "minutes");
                if (diff > 0 && diff < 720) {
                  fieldMin = diff;
                }
              }
            }
            if (fieldMin > 0) {
              totalFieldMin += fieldMin;
            }
          }
        });
        const avg = fieldDaysSeen.size > 0 ? Math.round(totalFieldMin / fieldDaysSeen.size) : 0;
        displayInfo = `${Math.floor(avg / 60)}h ${avg % 60}m Avg`;
      } else if (metricType === "survey") {
        const uResponses = (rawSurveyResponses || []).filter((sr: any) =>
          idMatches(sr.CreatedById, user.Sf_Id) ||
          (sr.userName && user.Name && user.Name.toLowerCase().includes(sr.userName.toLowerCase())) ||
          (sr.userName && user.Name && sr.userName.toLowerCase().includes(user.Name.toLowerCase()))
        );
        const comp = uResponses.reduce((sum: number, cur: any) => sum + Number(cur.Completed || cur.expr0 || 1), 0);
        userVal = comp;
        displayInfo = `${comp} Completed`;
      }

      return {
        Sf_Id: user.Sf_Id,
        Name: user.Name,
        Role: user.Role,
        Phone: user.Phone,
        info: displayInfo,
      };
    });
  }, [viewState.level, viewState.filterPersona, dynamicSubordinates, userId, userName, userRole, metricType, rawBeatDays, rawAttendances, cleanVisits, cleanTcVisits, cleanPcVisits, rawOrders, rawOrderItems, rawOrderPcsItems, rawSurveyResponses, tcTeamSummary, orderBookingSummary]);

  // 4. Detail level dataset computation
  const detailData = useMemo(() => {
    if (viewState.level !== "detail") return null;

    const empId = viewState.filterEmployee;
    const empName = dynamicSubordinates.find((s: any) => idMatches(s.Sf_Id, empId))?.Name || (idMatches(empId, userId) ? `${userName} (Self)` : "Representative");

    const isVisitDetail = ["tc", "pc", "sales_qty", "sales_box", "sales_value", "auth", "productivity", "check_in", "check_out", "brand_wise", "category_wise", "avg_retailing"].includes(metricType);

    if (isVisitDetail) {
      const empTeamIds = new Set<string>([empId]);
      let added = true;
      while (added) {
        added = false;
        (dynamicSubordinates || subordinates || []).forEach((s: any) => {
          if (s.ManagerId && empTeamIds.has(s.ManagerId) && !empTeamIds.has(s.Sf_Id)) {
            empTeamIds.add(s.Sf_Id);
            added = true;
          }
        });
      }

      const isTeamMatch = (idToCheck: string | undefined): boolean => {
        if (!idToCheck) return false;
        for (const tId of empTeamIds) {
          if (idMatches(tId, idToCheck)) return true;
        }
        return false;
      };

      let myVisits = cleanVisits;
      if (empId && empId !== "All") {
        myVisits = cleanVisits.filter((v: any) => {
          const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
          const ownerId = v.BeatDay__r?.OwnerId;
          const createdById = v.CreatedById;
          return isTeamMatch(assignedTo) || isTeamMatch(ownerId) || isTeamMatch(createdById);
        });
      }

      // Filter by selected month bounds so ONLY visits in the selected month are shown
      myVisits = myVisits.filter((v: any) => {
        const vDateStr = v.BeatDay__r?.Beat_Date__c || v.VisitDate__c || (v.CreatedDate ? v.CreatedDate.substring(0, 10) : "");
        if (!vDateStr) return true;
        return vDateStr >= startOfMonth && vDateStr <= endOfMonth;
      });

      if (metricType === "tc" || metricType === "productivity") {
        const tcVisits = cleanTcVisits.filter((v: any) => {
          const isTeam = isTeamMatch(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c) ||
            isTeamMatch(v.BeatDay__r?.OwnerId) ||
            isTeamMatch(v.CreatedById);
          const vDateStr = v.BeatDay__r?.Beat_Date__c || v.VisitDate__c || (v.CreatedDate ? v.CreatedDate.substring(0, 10) : "");
          const isDate = !vDateStr || (vDateStr >= startOfMonth && vDateStr <= endOfMonth);
          return isTeam && isDate;
        });
        if (tcVisits.length > myVisits.length) {
          myVisits = tcVisits;
        }
      }

      if (metricType === "pc") {
        const pcVisits = cleanPcVisits.filter((v: any) =>
          isTeamMatch(v.BeatDay__r?.Route_Plans__r?.Assigned_To__c) ||
          isTeamMatch(v.BeatDay__r?.OwnerId) ||
          isTeamMatch(v.CreatedById)
        );
        if (pcVisits.length > 0) {
          myVisits = pcVisits;
        } else {
          myVisits = myVisits.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true");
        }
      }

      const effectiveOrderItems = (rawOrderItems && rawOrderItems.length > 0) ? rawOrderItems : (rawOrderPcsItems || []);

      const getVisitItems = (v: any) => {
        const vAccId = v.AccountId__c || v.AccountId;
        const vDate = v.BeatDay__r?.Beat_Date__c || v.VisitDate__c || (v.CreatedDate ? v.CreatedDate.substring(0, 10) : "");
        return (effectiveOrderItems || []).filter((item: any) => {
          const itemAccId = item.OrderId__r?.AccountId__c || item.AccountId__c;
          const isAcc = vAccId && itemAccId && idMatches(vAccId, itemAccId);
          const isEmp = !empId || empId === "All" || idMatches(item.OrderId__r?.Order_Placed_By__c, empId) || idMatches(item.CreatedById, empId);
          if (!isAcc || !isEmp) return false;

          const itemDate = item.OrderId__r?.EffectiveDate__c || (item.CreatedDate ? item.CreatedDate.substring(0, 10) : "");
          if (vDate && itemDate) {
            return itemDate === vDate;
          }
          return true;
        });
      };

      if (metricType === "sales_box") {
        myVisits = myVisits.filter((v: any) => {
          const vItems = getVisitItems(v);
          const totalBox = vItems
            .filter((it: any) => it.UOM_Selected__c === "10" || Number(it.Quantity_In_Box__c || 0) > 0)
            .reduce((sum: number, it: any) => sum + Number(it.Quantity_In_Box__c || 0), 0);
          return totalBox > 0;
        });
      } else if (metricType === "sales_qty") {
        myVisits = myVisits.filter((v: any) => {
          const vItems = getVisitItems(v);
          const totalPcs = vItems
            .filter((it: any) => it.UOM_Selected__c === "20" || Number(it.Quantity_In_Pcs__c || 0) > 0)
            .reduce((sum: number, it: any) => sum + Number(it.Quantity_In_Pcs__c || 0), 0);
          return totalPcs > 0;
        });
      } else if (metricType === "sales_value" || metricType === "brand_wise" || metricType === "category_wise") {
        myVisits = myVisits.filter((v: any) =>
          v.IsOrderPlaced__c === "true" ||
          v.IsOrderPlaced__c === true ||
          v.ProductiveCall__c === "true" ||
          v.ProductiveCall__c === true
        );
      }

      if (metricType === "check_in") {
        myVisits = [...myVisits].sort((a, b) => {
          const t1 = a.CheckInTime__c || "";
          const t2 = b.CheckInTime__c || "";
          return t1.localeCompare(t2);
        });
      }

      if (metricType === "check_out") {
        myVisits = [...myVisits].sort((a, b) => {
          const t1 = a.CheckOutTime__c || "";
          const t2 = b.CheckOutTime__c || "";
          return t2.localeCompare(t1);
        });
      }

      const list = myVisits.map((v: any) => {
        const visitDateStr = v.BeatDay__r?.Beat_Date__c || v.VisitDate__c;
        const formattedDate = visitDateStr ? ` (${moment(visitDateStr).format("DD MMM YYYY")})` : "";
        const outletName = (v.AccountId__r?.Name || "Unknown Outlet") + formattedDate;
        const checkIn = v.CheckInTime__c || "--:--";
        const checkOut = v.CheckOutTime__c || null;

        if (metricType === "auth") {
          const isVisited = checkOut !== null && checkOut !== undefined && checkOut !== "";
          const displayCheckIn = formatTimeDisplay(checkIn);
          const displayCheckOut = formatTimeDisplay(checkOut);
          return {
            id: v.Id,
            title: outletName,
            subtitle: `In: ${displayCheckIn} • Out: ${displayCheckOut || "--:--"}`,
            status: isVisited ? "Visited" : "Not Visited",
            statusColor: isVisited ? "#2E7D5B" : "#7A7266",
          };
        }

        if (metricType === "check_in") {
          const displayCheckIn = formatTimeDisplay(checkIn);
          return {
            id: v.Id,
            title: outletName,
            subtitle: `Check-in Time: ${displayCheckIn}`,
            status: "Checked In",
            statusColor: "#3B5BB5",
          };
        }

        if (metricType === "check_out") {
          const displayCheckOut = formatTimeDisplay(checkOut);
          return {
            id: v.Id,
            title: outletName,
            subtitle: `Check-out Time: ${displayCheckOut}`,
            status: checkOut ? "Checked Out" : "Not Checked Out",
            statusColor: checkOut ? "#B3261E" : "#7A7266",
          };
        }

        if (metricType === "avg_retailing") {
          let retMin = Number(v.Retailing_Duration_Minutes__c || 0);
          if (retMin <= 0 && v.CheckInTime__c && v.CheckOutTime__c) {
            const diff = moment(v.CheckOutTime__c).diff(moment(v.CheckInTime__c), "minutes");
            if (diff > 0 && diff < 480) {
              retMin = diff;
            }
          }
          const formattedRetailing = retMin >= 60
            ? `${Math.floor(retMin / 60)}h ${Math.round(retMin % 60)}m`
            : `${Math.round(retMin)} mins`;
          const displayCheckIn = formatTimeDisplay(checkIn);
          return {
            id: v.Id,
            title: outletName,
            subtitle: displayCheckIn && displayCheckIn !== "—" ? `Check-in: ${displayCheckIn}` : "",
            status: "Retailing Time",
            statusColor: "#FF5722",
            timeValue: formattedRetailing,
          };
        }



        if (metricType === "sales_box") {
          const vItems = getVisitItems(v);
          const boxItems = vItems.filter((it: any) => it.UOM_Selected__c === "10" || Number(it.Quantity_In_Box__c || 0) > 0);
          const totalBox = boxItems.reduce((sum: number, it: any) => sum + Number(it.Quantity_In_Box__c || 0), 0);
          const uniqueOrders = new Set(boxItems.map((it: any) => it.OrderId__c || it.OrderId__r?.Id).filter(Boolean));
          const orderCount = uniqueOrders.size > 0 ? uniqueOrders.size : 1;
          const totalVal = boxItems.reduce((sum: number, it: any) => sum + Number(it.Net_Amount__c || 0), 0);

          const groupedProducts = [{
            groupName: "Spot Sales Box Items",
            products: boxItems.map((item: any) => ({
              name: item.Product2Id__r?.Name || item.Name || "Product",
              qty: formatCasesWithUnits(Number(item.Quantity_In_Box__c || 0)),
              value: item.Net_Amount__c ? `₹${Number(item.Net_Amount__c).toLocaleString("en-IN")}` : "",
            })),
          }];

          return {
            id: v.Id,
            title: outletName,
            subtitle: `Spot Sales: ${orderCount} • Visited At: ${formatTimeDisplay(checkIn)}`,
            status: formatCasesWithUnits(Math.round(totalBox)),
            statusColor: "#FF9800",
            timeValue: totalVal > 0 ? `₹${Math.round(totalVal).toLocaleString("en-IN")}` : `Spot Sales: ${orderCount}`,
            groupedProducts: boxItems.length > 0 ? groupedProducts : [],
          };
        }

        if (metricType === "sales_qty") {
          const vItems = getVisitItems(v);
          const pcsItems = vItems.filter((it: any) => it.UOM_Selected__c === "20" || Number(it.Quantity_In_Pcs__c || 0) > 0);
          const totalPcs = pcsItems.reduce((sum: number, it: any) => sum + Number(it.Quantity_In_Pcs__c || 0), 0);
          const uniqueOrders = new Set(pcsItems.map((it: any) => it.OrderId__c || it.OrderId__r?.Id).filter(Boolean));
          const orderCount = uniqueOrders.size > 0 ? uniqueOrders.size : 1;
          const totalVal = pcsItems.reduce((sum: number, it: any) => sum + Number(it.Net_Amount__c || 0), 0);

          const groupedProducts = [{
            groupName: "Spot Sales Pcs Items",
            products: pcsItems.map((item: any) => ({
              name: item.Product2Id__r?.Name || item.Name || "Product",
              qty: formatUnitsWithCases(Number(item.Quantity_In_Pcs__c || 0), "Pcs"),
              value: item.Net_Amount__c ? `₹${Number(item.Net_Amount__c).toLocaleString("en-IN")}` : "",
            })),
          }];

          return {
            id: v.Id,
            title: outletName,
            subtitle: `Spot Sales: ${orderCount} • Visited At: ${formatTimeDisplay(checkIn)}`,
            status: formatUnitsWithCases(Math.round(totalPcs), "Pcs"),
            statusColor: "#4CAF50",
            timeValue: totalVal > 0 ? `₹${Math.round(totalVal).toLocaleString("en-IN")}` : `Spot Sales: ${orderCount}`,
            groupedProducts: pcsItems.length > 0 ? groupedProducts : [],
          };
        }

        const isOrder = v.IsOrderPlaced__c === "true" || v.IsOrderPlaced__c === true || v.ProductiveCall__c === "true" || v.ProductiveCall__c === true;

        let productsGrouped: any[] = [];
        if (metricType === "brand_wise" || metricType === "category_wise") {
          const matchItems = (rawOrderItems || []).filter((item: any) =>
            idMatches(item.OrderId__r?.AccountId__c, v.AccountId__c) &&
            idMatches(item.OrderId__r?.Order_Placed_By__c, empId)
          );

          // Group by Brand or Category dynamically
          const groups: { [key: string]: any[] } = {};
          matchItems.forEach((item: any) => {
            const groupKey = metricType === "brand_wise"
              ? (item.Product2Id__r?.Brand__c || item.Brand__c || "Other Brands")
              : (item.Product2Id__r?.Category__c || item.Category__c || "Other Categories");

            if (!groups[groupKey]) {
              groups[groupKey] = [];
            }
            const qtyBox = Number(item.Quantity_In_Box__c || 0);
            const qtyPcs = Number(item.Quantity_In_Pcs__c || 0);
            const qtyStr = qtyBox > 0 ? formatCasesWithUnits(qtyBox) : formatUnitsWithCases(qtyPcs, "Pcs");
            groups[groupKey].push({
              name: item.Product2Id__r?.Name || "Unknown Product",
              qty: qtyStr,
              value: `₹${Number(item.Net_Amount__c || 0).toLocaleString("en-IN")}`
            });
          });

          productsGrouped = Object.keys(groups).map(groupName => ({
            groupName,
            products: groups[groupName]
          }));
        }

        return {
          id: v.Id,
          title: outletName,
          subtitle: `Visited At: ${formatTimeDisplay(checkIn)}`,
          status: isOrder ? "Spot Sales Placed" : "No Spot Sales",
          statusColor: isOrder ? "#2E7D5B" : "#7A7266",
          groupedProducts: productsGrouped,
        };
      });

      return {
        type: "visits",
        userName: empName,
        records: list,
      };
    } else if (metricType === "avg_total") {
      // Find all subordinate IDs under empId (direct or indirect)
      const empTeamIds = new Set<string>([empId]);
      let added = true;
      while (added) {
        added = false;
        (dynamicSubordinates || subordinates || []).forEach((s: any) => {
          if (s.ManagerId && empTeamIds.has(s.ManagerId) && !empTeamIds.has(s.Sf_Id)) {
            empTeamIds.add(s.Sf_Id);
            added = true;
          }
        });
      }

      const isTeamMatch = (idToCheck: string | undefined): boolean => {
        if (!idToCheck) return false;
        for (const tId of empTeamIds) {
          if (idMatches(tId, idToCheck)) return true;
        }
        return false;
      };

      // Filter Beat Days for this employee (or team)
      const myBeatDays = (rawBeatDays || []).filter((bd: any) => {
        const ownerId = bd.OwnerId || bd.Owner?.Id;
        const assignedTo = bd.Route_Plans__r?.Assigned_To__c;
        return isTeamMatch(ownerId) || isTeamMatch(assignedTo);
      });

      // Sort by Beat_Date__c DESC
      myBeatDays.sort((a: any, b: any) => {
        return moment(b.Beat_Date__c || 0).diff(moment(a.Beat_Date__c || 0));
      });

      const records = myBeatDays.map((bd: any, idx: number) => {
        const mDate = bd.Beat_Date__c ? moment(bd.Beat_Date__c) : null;
        const dayNumber = mDate ? mDate.format("DD") : String(idx + 1).padStart(2, "0");
        const monthYear = mDate ? mDate.format("MMM YYYY") : "--";
        const dayOfWeek = mDate ? mDate.format("dddd") : "";
        const fullDateFormatted = mDate ? mDate.format("DD MMMM YYYY") : `Day ${idx + 1}`;

        let fieldMin = Number(bd.Field_Duration_Minutes__c || 0);
        const firstCall = bd.First_Call_Time__c;
        const lastCall = bd.Last_Call_Time__c || bd.EndOfDayTime__c;
        if (fieldMin <= 0 && firstCall && lastCall) {
          const diff = moment(lastCall).diff(moment(firstCall), "minutes");
          if (diff > 0 && diff < 720) {
            fieldMin = diff;
          }
        }

        const formattedFieldTime = `${Math.floor(fieldMin / 60)}h ${Math.round(fieldMin % 60)}m`;

        const ownerName = bd.Owner?.Name;
        const showOwner = empTeamIds.size > 1 && ownerName;

        const callsCount = Number(bd.Total_Calls__c || 0);
        const pcCount = Number(bd.Productive_Calls__c || 0);
        const productivityRate = callsCount > 0 ? `${Math.round((pcCount / callsCount) * 100)}%` : "0%";

        return {
          id: bd.Id || `bd-${idx}`,
          title: fullDateFormatted,
          dayNumber,
          monthYear,
          dayOfWeek,
          dateFormatted: fullDateFormatted,
          repName: showOwner ? ownerName : "",
          totalCalls: callsCount,
          productiveCalls: pcCount,
          productivityRate,
          status: "Total Time",
          statusColor: "#795548",
          timeValue: formattedFieldTime,
        };
      });

      return {
        type: "visits",
        userName: empName,
        records,
      };
    } else if (metricType === "working_duration") {
      const records = monthlyAttendance.map((item: any, idx: number) => {
        const dateStr = item.AttendanceDate__c ? moment(item.AttendanceDate__c).format("DD MMM YYYY") : "--";
        const startStr = formatTimeDisplay(item.AttendanceStartTime__c);
        const endStr = formatTimeDisplay(item.AttendanceEndTime__c);

        let durStr = "--";
        if (item.Working_Hours__c) {
          const wh = Number(item.Working_Hours__c);
          if (!isNaN(wh)) {
            const h = Math.floor(wh);
            const m = Math.round((wh - h) * 60);
            durStr = `${h}h ${m}m`;
          } else {
            durStr = String(item.Working_Hours__c);
          }
        } else if (item.AttendanceStartTime__c && item.AttendanceEndTime__c) {
          const diff = moment(item.AttendanceEndTime__c).diff(moment(item.AttendanceStartTime__c), "minutes");
          if (diff > 0 && diff < 1440) {
            durStr = `${Math.floor(diff / 60)}h ${diff % 60}m`;
          }
        }

        const isWorked = durStr !== "--" || item.AttendanceStatus__c === "Present";

        return {
          id: item.Id || String(idx),
          title: dateStr,
          subtitle: `In: ${startStr} • Out: ${endStr}`,
          status: durStr !== "--" ? `${durStr} Worked` : (item.AttendanceStatus__c || "Not Marked"),
          statusColor: isWorked ? "#2E7D5B" : "#7A7266",
        };
      });

      return {
        type: "visits",
        userName: empName,
        records: records,
      };
    } else if (metricType === "not_logged_in") {
      const userObj = (rawNotLoggedInUsers || []).find((u: any) => idMatches(u.Id, empId)) ||
        dynamicSubordinates.find((s: any) => idMatches(s.Sf_Id, empId));

      return {
        type: "not_logged_in",
        userName: empName || userObj?.Name || "User Details",
        name: userObj?.Name || empName,
        phone: userObj?.Phone || "",
        email: userObj?.Email || "",
        managerName: userObj?.Manager?.Name || "N/A",
        userType: userObj?.User_Type__c || userObj?.Title || userObj?.Role || "Representative",
        status: "Not Logged In Today",
      };
    } else if (metricType === "survey") {
      const uResponses = (rawSurveyResponses || []).filter((sr: any) =>
        idMatches(sr.CreatedById, empId) ||
        (sr.userName && empName && empName.toLowerCase().includes(sr.userName.toLowerCase())) ||
        (sr.userName && empName && sr.userName.toLowerCase().includes(empName.toLowerCase()))
      );

      const records = uResponses.map((item: any, idx: number) => ({
        id: item.Id || `completed-${idx}`,
        title: item.userName || empName || "Survey Response",
        subtitle: `Submitted Surveys: ${item.Completed || item.expr0 || 1}`,
        status: "Completed",
        statusColor: "#2E7D5B",
      }));

      if (records.length === 0) {
        records.push({
          id: "no-surveys",
          title: "No Completed Surveys",
          subtitle: "No survey responses recorded for this representative",
          status: "No Data",
          statusColor: "#7A7266",
        });
      }

      return {
        type: "visits",
        userName: empName,
        records,
      };
    } else {
      const bd = findBeatDay(rawBeatDays, empId);
      const att = rawAttendances.find((x: any) => idMatches(x.User__c, empId));
      const myVisits = cleanVisits.filter((v: any) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return idMatches(assignedTo, empId);
      });

      const displayCheckIn = getMinCheckIn(myVisits);
      const displayCheckOut = getMaxCheckOut(myVisits);
      const statusText = att?.AttendanceStatus__c || "Not Marked";
      const attendanceStartTime = att?.AttendanceStartTime__c || "--:--";
      const attendanceEndTime = att?.AttendanceEndTime__c || "--:--";

      let geoLocationStr = "";
      if (att?.GeoLocation__c) {
        if (
          typeof att.GeoLocation__c === "object" &&
          att.GeoLocation__c.latitude !== undefined &&
          att.GeoLocation__c.longitude !== undefined
        ) {
          geoLocationStr = `${att.GeoLocation__c.latitude},${att.GeoLocation__c.longitude}`;
        } else {
          geoLocationStr = String(att.GeoLocation__c);
        }
      }

      return {
        type: "attendance",
        userName: empName,
        checkIn: displayCheckIn,
        checkOut: displayCheckOut,
        status: statusText,
        attendanceStartTime,
        attendanceEndTime,
        attendanceDate: att?.AttendanceDate__c || "",
        leaveReason: att?.Attendance_Leave_Reason__c || "",
        capturedSelfie: att?.CapturedSelfie__c || "",
        geoLocation: geoLocationStr,
        reason: att?.Reason__c || "",
        selfieUrl: att?.Attendance_Image_URL__c || att?.SelfieURL__c || att?.CapturedSelfie__c || "",
        name: att?.Name || "",
      };
    }
  }, [viewState.level, viewState.filterEmployee, dynamicSubordinates, userId, userName, metricType, cleanVisits, cleanTcVisits, cleanPcVisits, rawBeatDays, rawAttendances, rawOrders, rawOrderItems, rawOrderPcsItems, rawNotLoggedInUsers, monthlyAttendance]);

  // 5. Back Button and Header Title Setup
  const handleBackPress = () => {
    if (viewState.level === "detail") {
      if (selectedEmployee !== "All" || dynamicSubordinates.length === 0) {
        navigation.goBack();
      } else {
        setViewState({
          level: "employees",
          filterPersona: viewState.filterPersona,
          filterEmployee: null,
        });
      }
    } else if (viewState.level === "employees") {
      if (selectedPersona !== "All") {
        navigation.goBack();
      } else {
        setViewState({
          level: "personas",
          filterPersona: null,
          filterEmployee: null,
        });
      }
    } else {
      navigation.goBack();
    }
  };

  const getHeaderTitle = () => {
    if (viewState.level === "personas") {
      return title;
    }
    if (viewState.level === "employees") {
      return `${viewState.filterPersona} List`;
    }
    const monthLabel = selectedMonth ? moment(selectedMonth, "YYYY-MM").format("MMM YYYY") : "";
    const baseName = detailData?.userName || "Details";
    return monthLabel ? `${baseName} (${monthLabel})` : baseName;
  };

  const filteredList = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (viewState.level === "personas") {
      if (!query) return personasData;
      return personasData.filter((p: any) => p.Role.toLowerCase().includes(query));
    }
    if (viewState.level === "employees") {
      if (!query) return employeesData;
      return employeesData.filter((e: any) => e.Name.toLowerCase().includes(query));
    }
    if (viewState.level === "detail" && detailData?.type === "visits") {
      if (!query) return detailData.records;
      return detailData.records.filter(
        (v: any) =>
          v.title?.toLowerCase().includes(query) ||
          v.subtitle?.toLowerCase().includes(query) ||
          v.date?.toLowerCase().includes(query) ||
          v.repName?.toLowerCase().includes(query) ||
          v.timeValue?.toLowerCase().includes(query)
      );
    }
    return [];
  }, [viewState.level, personasData, employeesData, detailData, searchQuery]);

  const handleCallPress = (number: string) => {
    if (!number) return;
    Linking.openURL(`tel:${number}`);
  };

  const getAvatarColor = (name: string) => {
    const colors = ["#EF5350", "#42A5F5", "#66BB6A", "#FFA726", "#AB47BC", "#26A69A", "#78909C"];
    if (!name) return colors[0];
    const code = name.charCodeAt(0);
    return colors[code % colors.length];
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* Header */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E"]}
        style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }]}
      >
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {/* Search Input (Disabled for final attendance status view) */}
      {!(viewState.level === "detail" && detailData?.type === "attendance") && (
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#7A7266" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#7A7266"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#7A7266" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Main List Scroller */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {viewState.level === "personas" && (
          filteredList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#D9D2C3" />
              <Text style={styles.emptyText}>No personas found</Text>
            </View>
          ) : (
            filteredList.map((item: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.dataCard}
                onPress={() => setViewState({ level: "employees", filterPersona: item.rawRole || item.Role, filterEmployee: null })}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: "#C8993015" }]}>
                    <Ionicons name="people" size={20} color="#C9A24D" />
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.nameText}>{item.Role}</Text>
                    <Text style={styles.roleText}>{item.subtitle || "Subordinates Group"}</Text>
                  </View>
                  <View style={styles.rightActionContainer}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.info}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        )}

        {viewState.level === "employees" && (
          (loadingTcTeam || loadingOrderSummary) ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#C9A24D" />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading Team Summary...</Text>
            </View>
          ) : filteredList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#D9D2C3" />
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          ) : (
            filteredList.map((item: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.dataCard}
                disabled={["check_in", "check_out"].includes(metricType)}
                onPress={() => setViewState({ level: "detail", filterPersona: viewState.filterPersona, filterEmployee: item.Sf_Id })}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.Name) + "15" }]}>
                    <Text style={[styles.avatarText, { color: getAvatarColor(item.Name) }]}>
                      {item.Name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.nameText}>{item.Name}</Text>
                    <Text style={styles.roleText}>
                      {metricType === "not_logged_in" && item.ManagerName
                        ? `${item.Role} • Mgr: ${item.ManagerName}`
                        : item.Role}
                    </Text>
                  </View>
                  <View style={styles.rightActionContainer}>
                    {metricType === "not_logged_in" && item.Phone ? (
                      <TouchableOpacity
                        style={[styles.phoneButton, { marginRight: 8 }]}
                        onPress={() => handleCallPress(item.Phone)}
                      >
                        <Ionicons name="call" size={15} color="#2E7D5B" />
                      </TouchableOpacity>
                    ) : null}
                    <View style={[
                      styles.badge,
                      metricType === "not_logged_in" && { backgroundColor: "#F9E5E3" }
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        metricType === "not_logged_in" && { color: "#B3261E" }
                      ]}>{item.info}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        )}

        {viewState.level === "detail" && detailData?.type === "visits" && (
          (loadingMonthly || loadingVisits) ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#C9A24D" />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading visits data...</Text>
            </View>
          ) : filteredList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name={metricType === "working_duration" ? "time-outline" : "phone-in-talk"} size={48} color="#D9D2C3" />
              <Text style={styles.emptyText}>
                {metricType === "working_duration" ? "No working duration records found for this month" : "No visits found for this date"}
              </Text>
            </View>
          ) : (
            filteredList.map((item: any, index: number) => {
              if (metricType === "avg_total") {
                return (
                  <View key={index} style={styles.beatDayCard}>
                    {/* Top Row: Mini Calendar Badge + Date Info + Total Time Pill */}
                    <View style={styles.beatDayHeaderRow}>
                      <View style={styles.calendarBlock}>
                        <Text style={styles.calendarDayNum}>{item.dayNumber}</Text>
                        <Text style={styles.calendarMonth}>
                          {item.monthYear ? item.monthYear.split(" ")[0].toUpperCase() : "DAY"}
                        </Text>
                      </View>

                      <View style={styles.beatDayTitleCol}>
                        <Text style={styles.beatDayTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.beatDayDayOfWeek}>{item.dayOfWeek}</Text>
                        {item.repName ? (
                          <View style={styles.repChip}>
                            <Ionicons name="person-outline" size={11} color="#7A7266" style={{ marginRight: 3 }} />
                            <Text style={styles.beatDayRepName}>{item.repName}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.totalTimePill}>
                        <View style={styles.totalTimeIconCircle}>
                          <Ionicons name="time" size={13} color="#795548" />
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.totalTimePillLabel}>FIELD TIME</Text>
                          <Text style={styles.totalTimePillValue}>{item.timeValue}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.beatDayDivider} />

                    {/* Bottom Stats Grid: 3 Clean Metric Chips */}
                    <View style={styles.beatDayStatsGrid}>
                      <View style={styles.statChipBoxTC}>
                        <View style={styles.statChipIconTC}>
                          <Ionicons name="call" size={12} color="#3B5BB5" />
                        </View>
                        <View>
                          <Text style={styles.statChipLabel}>Total Calls</Text>
                          <Text style={styles.statChipValTC}>{item.totalCalls}</Text>
                        </View>
                      </View>

                      <View style={styles.statChipBoxPC}>
                        <View style={styles.statChipIconPC}>
                          <Ionicons name="checkmark" size={12} color="#2E7D5B" />
                        </View>
                        <View>
                          <Text style={styles.statChipLabel}>Productive</Text>
                          <Text style={styles.statChipValPC}>{item.productiveCalls}</Text>
                        </View>
                      </View>

                      <View style={styles.statChipBoxRate}>
                        <View style={styles.statChipIconRate}>
                          <Ionicons name="trending-up" size={12} color="#D08C1F" />
                        </View>
                        <View>
                          <Text style={styles.statChipLabel}>Productivity</Text>
                          <Text style={styles.statChipValRate}>{item.productivityRate}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View key={index} style={styles.dataCard}>
                  <View style={styles.cardRow}>
                    <View style={[
                      styles.avatar,
                      {
                        backgroundColor:
                          metricType === "working_duration"
                            ? "#6A1B9A15"
                            : "#C8993015",
                      },
                    ]}>
                      <Ionicons
                        name={
                          metricType === "working_duration"
                            ? "calendar-outline"
                            : "storefront"
                        }
                        size={20}
                        color={
                          metricType === "working_duration"
                            ? "#6A1B9A"
                            : "#C9A24D"
                        }
                      />
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={styles.nameText}>{item.title}</Text>
                      <Text style={styles.roleText}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.rightActionContainer}>
                      <View style={{ alignItems: "flex-end" }}>
                        <View style={[styles.badge, { backgroundColor: item.statusColor + "15" }]}>
                          <Text style={[styles.badgeText, { color: item.statusColor }]}>{item.status}</Text>
                        </View>
                        {item.timeValue ? (
                          <Text style={styles.timeValueText}>{item.timeValue}</Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                {/* Render Products grouped by Brand or Category during this visit */}
                {item.groupedProducts && item.groupedProducts.length > 0 && (
                  <View style={styles.productsContainer}>
                    <View style={styles.productsHeader}>
                      <Ionicons name="basket-outline" size={16} color="#C9A24D" style={{ marginRight: 6 }} />
                      <Text style={styles.productsHeaderText}>Products Sold</Text>
                    </View>
                    {item.groupedProducts.map((group: any, gIdx: number) => (
                      <View key={gIdx} style={{ marginBottom: 10 }}>
                        {/* Group header badge */}
                        <View style={styles.brandGroupHeader}>
                          <Ionicons
                            name={metricType === "brand_wise" ? "pricetag-outline" : "grid-outline"}
                            size={12}
                            color="#7A7266"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.brandGroupHeaderText}>
                            {metricType === "brand_wise" ? "Brand: " : "Category: "}{group.groupName}
                          </Text>
                        </View>
                        <View style={styles.productTable}>
                          {group.products.map((prod: any, pIdx: number) => (
                            <View key={pIdx} style={[styles.productRow, pIdx === group.products.length - 1 && { borderBottomWidth: 0 }]}>
                              <View style={styles.productNameCol}>
                                <Text style={styles.productBullet}>•</Text>
                                <Text style={styles.productName} numberOfLines={2}>{prod.name}</Text>
                              </View>
                              <View style={styles.productQtyCol}>
                                <View style={styles.qtyBadge}>
                                  <Text style={styles.qtyBadgeText}>{prod.qty}</Text>
                                </View>
                              </View>
                              <View style={styles.productValCol}>
                                <Text style={styles.productValText}>{prod.value}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )
      )}

        {viewState.level === "detail" && detailData?.type === "attendance" && (
          <View style={styles.attendanceDetailCard}>
            {/* Header */}
            <View style={styles.attendanceHeader}>
              <Ionicons name="person-outline" size={22} color="#C9A24D" />
              <Text style={styles.attendanceHeaderTitle}>{detailData.userName}</Text>
            </View>

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <Text style={styles.infoLabel}>Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        detailData.status === "Present"
                          ? "#E3F1EA"
                          : detailData.status === "Leave"
                            ? "#FBEFD8"
                            : "#F9E5E3",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          detailData.status === "Present"
                            ? "#2E7D5B"
                            : detailData.status === "Leave"
                              ? "#EF6C00"
                              : "#B3261E",
                      },
                    ]}
                  >
                    {detailData.status}
                  </Text>
                </View>
              </View>

              <View style={styles.infoColRight}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValueText}>
                  {detailData.attendanceDate
                    ? moment(detailData.attendanceDate).format("DD MMM YYYY")
                    : "--"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Timings */}
            <Text style={styles.sectionSubTitle}>Attendance Timing</Text>
            <View style={styles.timeSection}>
              <View style={[styles.timeBox, { marginLeft: 0, marginRight: 6 }]}>
                <Ionicons name="time-outline" size={18} color="#5E35B1" />
                <Text style={styles.timeLabel}>Start Time</Text>
                <Text style={styles.timeValue}>
                  {detailData.attendanceStartTime && detailData.attendanceStartTime !== "--:--"
                    ? moment(detailData.attendanceStartTime, ["HH:mm:ss", "HH:mm", "hh:mm A", "YYYY-MM-DDTHH:mm:ss.SSSZ", "YYYY-MM-DDTHH:mm:ss.SSS", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ssZ"]).format("hh:mm A")
                    : "--:--"}
                </Text>
              </View>
              <View style={[styles.timeBox, { marginRight: 0, marginLeft: 6 }]}>
                <Ionicons name="time-outline" size={18} color="#C9A24D" />
                <Text style={styles.timeLabel}>End Day</Text>
                <Text style={styles.timeValue}>
                  {detailData.attendanceEndTime && detailData.attendanceEndTime !== "--:--"
                    ? moment(detailData.attendanceEndTime, ["HH:mm:ss", "HH:mm", "hh:mm A", "YYYY-MM-DDTHH:mm:ss.SSSZ", "YYYY-MM-DDTHH:mm:ss.SSS", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ssZ"]).format("hh:mm A")
                    : "--:--"}
                </Text>
              </View>
            </View>

            {/* Location & Map */}
            {detailData.geoLocation ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionSubTitle}>Check-in Location</Text>
                <TouchableOpacity
                  style={styles.locationContainer}
                  activeOpacity={0.7}
                  onPress={() => {
                    const url = `https://www.google.com/maps/search/?api=1&query=${detailData.geoLocation}`;
                    Linking.openURL(url).catch((err) =>
                      console.error("Failed to open maps:", err)
                    );
                  }}
                >
                  <View style={styles.locationLeft}>
                    <Ionicons name="location-outline" size={20} color="#B3261E" style={{ marginRight: 8 }} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {detailData.geoLocation}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color="#7A7266" />
                </TouchableOpacity>
              </>
            ) : null}

            {/* Reason & Leave Details */}
            {(detailData.reason || detailData.leaveReason) ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionSubTitle}>Reason / Remarks</Text>
                {detailData.reason ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>Reason</Text>
                    <Text style={styles.remarksText}>{detailData.reason}</Text>
                  </View>
                ) : null}
                {detailData.leaveReason ? (
                  <View style={[styles.remarksBox, { marginTop: detailData.reason ? 8 : 0 }]}>
                    <Text style={styles.remarksLabel}>Leave Reason</Text>
                    <Text style={styles.remarksText}>{detailData.leaveReason}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        )}

        {viewState.level === "detail" && detailData?.type === "not_logged_in" && (
          <View style={styles.attendanceDetailCard}>
            {/* Header */}
            <View style={styles.attendanceHeader}>
              <Ionicons name="person-outline" size={22} color="#C9A24D" />
              <Text style={styles.attendanceHeaderTitle}>{detailData.userName}</Text>
            </View>

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoColLeft}>
                <Text style={styles.infoLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: "#F9E5E3" }]}>
                  <Text style={[styles.statusBadgeText, { color: "#B3261E" }]}>
                    Not Logged In
                  </Text>
                </View>
              </View>

              <View style={styles.infoColRight}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValueText}>
                  {moment().format("DD MMM YYYY")}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* User Details */}
            <Text style={styles.sectionSubTitle}>User Details</Text>
            <View style={styles.remarksBox}>
              <Text style={styles.remarksLabel}>Designation / Role</Text>
              <Text style={styles.remarksText}>{detailData.userType}</Text>
            </View>

            {detailData.managerName ? (
              <View style={[styles.remarksBox, { marginTop: 8 }]}>
                <Text style={styles.remarksLabel}>Reporting Manager</Text>
                <Text style={styles.remarksText}>{detailData.managerName}</Text>
              </View>
            ) : null}

            {/* Contact Details */}
            {(detailData.phone || detailData.email) ? (
              <>
                <View style={[styles.divider, { marginTop: 16 }]} />
                <Text style={styles.sectionSubTitle}>Contact Details</Text>

                {detailData.phone ? (
                  <TouchableOpacity
                    style={styles.locationContainer}
                    activeOpacity={0.7}
                    onPress={() => handleCallPress(detailData.phone)}
                  >
                    <View style={styles.locationLeft}>
                      <Ionicons name="call-outline" size={20} color="#2E7D5B" style={{ marginRight: 8 }} />
                      <Text style={styles.locationText}>{detailData.phone}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#7A7266" />
                  </TouchableOpacity>
                ) : null}

                {detailData.email ? (
                  <TouchableOpacity
                    style={[styles.locationContainer, { marginTop: 8 }]}
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(`mailto:${detailData.email}`)}
                  >
                    <View style={styles.locationLeft}>
                      <Ionicons name="mail-outline" size={20} color="#3B5BB5" style={{ marginRight: 8 }} />
                      <Text style={styles.locationText}>{detailData.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#7A7266" />
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  searchSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#D9D2C3",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F1D1A",
    padding: 0,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7A7266",
    marginTop: 12,
  },
  dataCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    elevation: 1,
    shadowColor: "rgba(0, 0, 0, 0.02)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "700",
    fontSize: 16,
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  nameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  roleText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#7A7266",
    marginTop: 1,
  },
  rightActionContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    justifyContent: "center",
  },
  phoneButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E3F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: "#F1EADB",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A7266",
  },
  timeValueText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F1D1A",
    marginTop: 3,
    textAlign: "right",
  },
  attendanceDetailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    elevation: 2,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  attendanceHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1D1A",
    marginLeft: 10,
  },
  attendanceInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  attendanceInfoLabel: {
    fontSize: 14,
    color: "#7A7266",
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginBottom: 16,
  },
  timeSection: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#F1EADB",
  },
  timeLabel: {
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  sectionSubTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7A7266",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  infoColLeft: {
    flex: 1,
  },
  infoColRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  infoLabel: {
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  infoValueText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FBF8F1",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  locationText: {
    fontSize: 13,
    color: "#1F1D1A",
    fontWeight: "600",
  },
  remarksBox: {
    backgroundColor: "#FBF8F1",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7A7266",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  remarksText: {
    fontSize: 13.5,
    color: "#1F1D1A",
    lineHeight: 18,
    fontWeight: "500",
  },
  selfieCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    backgroundColor: "#FBF8F1",
    alignSelf: "flex-start",
  },
  selfiePress: {
    width: 140,
    height: 140,
    position: "relative",
  },
  selfieImage: {
    width: "100%",
    height: "100%",
  },
  selfieOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  selfieOverlayText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeImageBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 999,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "80%",
  },
  brandGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
  },
  brandGroupHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A7266",
    textTransform: "uppercase",
  },
  productsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D9D2C3",
    paddingTop: 10,
  },
  productsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  productsHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A67C2E",
    letterSpacing: 0.3,
  },
  productTable: {
    backgroundColor: "#FBF8F1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#D9D2C3",
  },
  productNameCol: {
    flex: 2.2,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  productBullet: {
    fontSize: 11,
    color: "#7A7266",
    marginRight: 4,
    marginTop: 1,
  },
  productName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1F1D1A",
    lineHeight: 14,
  },
  productQtyCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  qtyBadge: {
    backgroundColor: "#EEF2F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
  },
  qtyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A7266",
  },
  productValCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  productValText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  beatDayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    elevation: 2,
    shadowColor: "rgba(15, 23, 42, 0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  beatDayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  calendarBlock: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayNum: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F1D1A",
    lineHeight: 20,
  },
  calendarMonth: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A67C2E",
    letterSpacing: 0.5,
  },
  beatDayTitleCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  beatDayTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  beatDayDayOfWeek: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A7266",
    marginTop: 1,
  },
  repChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  beatDayRepName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A7266",
  },
  totalTimePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFEBE9",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D7CCC8",
  },
  totalTimeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  totalTimePillLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#8D6E63",
    letterSpacing: 0.5,
  },
  totalTimePillValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3E2723",
  },
  beatDayDivider: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginVertical: 12,
  },
  beatDayStatsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  statChipBoxTC: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  statChipIconTC: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#7A7266",
  },
  statChipValTC: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B5BB5",
  },
  statChipBoxPC: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  statChipIconPC: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E3F1EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  statChipValPC: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  statChipBoxRate: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  statChipIconRate: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FBEFD8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  statChipValRate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
});

export default DailyDashboardDetail;
