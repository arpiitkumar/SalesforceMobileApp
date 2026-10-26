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
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import moment from "moment";
import Ionicons from "../../components/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { isInternetAvailable } from "../../utils/networkUtils";

const { width } = Dimensions.get("window");

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
  onPress?: () => void;
}

const MetricCard: FC<MetricCardProps> = ({ title, value, icon, color, bgColor, onPress }) => {
  return (
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
        <Text style={styles.cardValue}>{value}</Text>
        <Text style={styles.cardLabel}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const hasRoleAccess = (userRole: string, allowedRoles: string[]): boolean => {
  if (!userRole) return true;
  const upperRole = userRole.toUpperCase();
  return allowedRoles.some((role) => upperRole.includes(role.toUpperCase()));
};

const DailyDashboard: FC = () => {
  const navigation = useNavigation<any>();
  const { fetchRecords } = useApiFetch();
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Card metric values
  const [tcCount, setTcCount] = useState(0);
  const [pcCount, setPcCount] = useState(0);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [regularUsersCount, setRegularUsersCount] = useState(0);
  const [leaveUsersCount, setLeaveUsersCount] = useState(0);
  const [rawNotLoggedInUsers, setRawNotLoggedInUsers] = useState<any[]>([]);
  const [notLoggedInUsersCount, setNotLoggedInUsersCount] = useState(0);

  // Role groups definition
  const allowedGroupA = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM"];
  const allowedGroupB = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM", "VP"];
  const allowedGroupC = ["ASM", "RSM", "AGM", "GM", "VP"];

  // Fetch current user details
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
            console.error("Salesforce User query failed in DailyDashboard:", apiErr);
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

  // Fetch today's data online
  const fetchData = async () => {
    if (!isInitialized || !userId) return;
    setLoading(true);
    try {
      const dateStr = moment().format("YYYY-MM-DD");
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
        const attendanceQuery = `SELECT Id, User__c, AttendanceStartTime__c, AttendanceEndTime__c, AttendanceStatus__c, AttendanceDate__c FROM Attendance__c WHERE AttendanceDate__c = ${dateStr} AND User__c IN (${allUserIdsStr})`;
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

      // 6. Fetch Not Logged-In Users online (using user specified SOQL)
      let notLoggedInList: any[] = [];
      try {
        const notLoggedInQuery = `SELECT Id, Name, User_Type__c, Title, Phone, Email, Manager.Name FROM User WHERE IsActive = true AND (ManagerId = '${userId}' OR Manager.ManagerId = '${userId}' OR Manager.Manager.ManagerId = '${userId}') AND Id NOT IN (SELECT User__c FROM Attendance__c WHERE AttendanceDate__c = TODAY AND AttendanceStartTime__c != null) ORDER BY Name ASC`;
        const notLoggedInResult = await fetchRecords("User", notLoggedInQuery);
        if (Array.isArray(notLoggedInResult)) {
          notLoggedInList = notLoggedInResult;
        }
      } catch (err) {
        console.error("Salesforce User Not Logged In query failed, attempting fallback:", err);
        try {
          const userQuery = `SELECT Id, Name, User_Type__c, Title, Phone, Email, Manager.Name FROM User WHERE IsActive = true AND (ManagerId = '${userId}' OR Manager.ManagerId = '${userId}' OR Manager.Manager.ManagerId = '${userId}') ORDER BY Name ASC`;
          const allHierarchyUsers = await fetchRecords("User", userQuery);
          if (Array.isArray(allHierarchyUsers)) {
            const todayAttQuery = `SELECT User__c FROM Attendance__c WHERE AttendanceDate__c = TODAY AND AttendanceStartTime__c != null`;
            const todayAtt = await fetchRecords("Attendance__c", todayAttQuery);
            const loggedInSet = new Set((todayAtt || []).map((a: any) => a.User__c));
            notLoggedInList = allHierarchyUsers.filter((u: any) => !loggedInSet.has(u.Id));
          }
        } catch (fbErr) {
          console.error("Fallback Not Logged In query failed:", fbErr);
        }
      }

      // Save raw datasets to state
      setRawBeatDays(beatDaysList);
      setRawAttendances(attendanceList);
      setRawVisits(visitsList);
      setRawTcVisits(tcVisitsList);
      setRawPcVisits(pcVisitsList);
      setRawNotLoggedInUsers(notLoggedInList);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isInitialized, userId, subordinates]);

  // Dynamically update Employee dropdown list based on Selected Persona (include self)
  useEffect(() => {
    let list = selectedPersona === "All"
      ? subordinates
      : subordinates.filter((s) => s.Role === selectedPersona);

    const selfObject = {
      Sf_Id: userId,
      Name: `${userName || "Self"} (Self)`,
      Role: userRole || "Manager",
      Phone: "",
    };
    if (selectedPersona === "All" || userRole === selectedPersona) {
      list = [selfObject, ...list];
    }

    setEmployeeList(list);
    if (selectedEmployee !== "All" && !list.some((e) => e.Sf_Id === selectedEmployee)) {
      setSelectedEmployee("All");
    }
  }, [selectedPersona, subordinates, userId, userName, userRole]);

  // Filtered datasets based on selected filters
  const filteredVisits = useMemo(() => {
    let list = rawVisits;
    if (selectedEmployee !== "All") {
      list = list.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === selectedEmployee;
      });
    } else if (selectedPersona !== "All") {
      const roleUsers = subordinates.filter((s) => s.Role === selectedPersona).map((s) => s.Sf_Id);
      if (userRole === selectedPersona) {
        roleUsers.push(userId);
      }
      list = list.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return roleUsers.includes(assignedTo);
      });
    }
    return list;
  }, [rawVisits, selectedPersona, selectedEmployee, subordinates, userId, userRole]);

  // Update card metrics
  useEffect(() => {
    if (!userId) return;

    // Total Users count
    const activeSubordinates = selectedPersona === "All" ? subordinates : subordinates.filter((s) => s.Role === selectedPersona);
    const showSelf = userRole === selectedPersona || selectedPersona === "All";
    const totalUsersVal = showSelf ? activeSubordinates.length + 1 : activeSubordinates.length;
    setTotalUsersCount(totalUsersVal);

    // Regular / Leave counts
    let regularCount = 0;
    let leaveCount = 0;
    if (selectedEmployee !== "All") {
      regularCount = rawAttendances.some((att) => att.User__c === selectedEmployee && att.AttendanceStatus__c === "Present") ? 1 : 0;
      leaveCount = rawAttendances.some((att) => att.User__c === selectedEmployee && att.AttendanceStatus__c === "Leave") ? 1 : 0;
    } else {
      const activeSubs = selectedPersona === "All" ? subordinates : subordinates.filter((s) => s.Role === selectedPersona);
      regularCount = activeSubs.filter((sub) => rawAttendances.some((att) => att.User__c === sub.Sf_Id && att.AttendanceStatus__c === "Present")).length;
      leaveCount = activeSubs.filter((sub) => rawAttendances.some((att) => att.User__c === sub.Sf_Id && att.AttendanceStatus__c === "Leave")).length;
      if (showSelf) {
        if (rawAttendances.some((att) => att.User__c === userId && att.AttendanceStatus__c === "Present")) regularCount += 1;
        if (rawAttendances.some((att) => att.User__c === userId && att.AttendanceStatus__c === "Leave")) leaveCount += 1;
      }
    }
    setRegularUsersCount(regularCount);
    setLeaveUsersCount(leaveCount);

    // TC Calculation
    let tcVal = 0;
    if (selectedEmployee !== "All") {
      const subTcVisits = rawTcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === selectedEmployee);
      tcVal = subTcVisits.length || filteredVisits.length;
    } else {
      if (selectedPersona === "All") {
        const selfTcVisits = rawTcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId);
        let sum = selfTcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId).length;
        subordinates.forEach((sub) => {
          const bd = rawBeatDays.find((x: any) => x.OwnerId === sub.Sf_Id);
          const subTcVisits = rawTcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id);
          sum += bd?.Total_Calls__c || subTcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id).length;
        });
        tcVal = sum;
      } else {
        let sum = 0;
        const roleUsers = subordinates.filter((s) => s.Role === selectedPersona);
        if (userRole === selectedPersona) {
          const selfTcVisits = rawTcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId);
          sum += selfTcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId).length;
        }
        roleUsers.forEach((sub) => {
          const bd = rawBeatDays.find((x: any) => x.OwnerId === sub.Sf_Id);
          const subTcVisits = rawTcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id);
          sum += bd?.Total_Calls__c || subTcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id).length;
        });
        tcVal = sum;
      }
    }
    setTcCount(tcVal);

    // PC Calculation
    let pcVal = 0;
    if (selectedEmployee !== "All") {
      const subPcVisits = rawPcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === selectedEmployee);
      pcVal = subPcVisits.length || filteredVisits.filter((v: any) => v.ProductiveCall__c === true || v.ProductiveCall__c === "true").length;
    } else {
      if (selectedPersona === "All") {
        const selfPcVisits = rawPcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId);
        let sum = selfPcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId && (v.ProductiveCall__c === true || v.ProductiveCall__c === "true")).length;
        subordinates.forEach((sub) => {
          const bd = rawBeatDays.find((x: any) => x.OwnerId === sub.Sf_Id);
          const subPcVisits = rawPcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id);
          sum += bd?.Productive_Calls__c || subPcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id && (v.ProductiveCall__c === true || v.ProductiveCall__c === "true")).length;
        });
        pcVal = sum;
      } else {
        let sum = 0;
        const roleUsers = subordinates.filter((s) => s.Role === selectedPersona);
        if (userRole === selectedPersona) {
          const selfPcVisits = rawPcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId);
          sum += selfPcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === userId && (v.ProductiveCall__c === true || v.ProductiveCall__c === "true")).length;
        }
        roleUsers.forEach((sub) => {
          const bd = rawBeatDays.find((x: any) => x.OwnerId === sub.Sf_Id);
          const subPcVisits = rawPcVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id);
          sum += bd?.Productive_Calls__c || subPcVisits.length || rawVisits.filter((v) => v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === sub.Sf_Id && (v.ProductiveCall__c === true || v.ProductiveCall__c === "true")).length;
        });
        pcVal = sum;
      }
    }
    setPcCount(pcVal);

    // Not Logged In Users count
    let notLoggedInVal = 0;
    if (selectedEmployee !== "All") {
      notLoggedInVal = rawNotLoggedInUsers.some((u) => u.Id === selectedEmployee) ? 1 : 0;
    } else if (selectedPersona !== "All") {
      notLoggedInVal = rawNotLoggedInUsers.filter((u) => {
        const uRole = u.User_Type__c || u.Title || "";
        return uRole.toLowerCase() === selectedPersona.toLowerCase() ||
               subordinates.some((s) => s.Role === selectedPersona && s.Sf_Id === u.Id);
      }).length;
    } else {
      notLoggedInVal = rawNotLoggedInUsers.length;
    }
    setNotLoggedInUsersCount(notLoggedInVal);

    // Outlet Coverage
    let totalCallsCount = 0;
    let visitedCallsCount = 0;
    if (selectedPersona === "All" && selectedEmployee === "All") {
      const selfVisits = rawVisits.filter((v) => {
        const assignedTo = v.BeatDay__r?.Route_Plans__r?.Assigned_To__c;
        return assignedTo === userId;
      });
      totalCallsCount = selfVisits.length;
      visitedCallsCount = selfVisits.filter(
        (v: any) => v.CheckOutTime__c !== null && v.CheckOutTime__c !== undefined && v.CheckOutTime__c !== ""
      ).length;
    } else {
      totalCallsCount = filteredVisits.length;
      visitedCallsCount = filteredVisits.filter(
        (v: any) => v.CheckOutTime__c !== null && v.CheckOutTime__c !== undefined && v.CheckOutTime__c !== ""
      ).length;
    }
    const coverage = totalCallsCount > 0 ? Math.round((visitedCallsCount / totalCallsCount) * 100) : 0;
    setCoveragePercent(coverage);
  }, [selectedPersona, selectedEmployee, rawBeatDays, rawVisits, rawTcVisits, rawPcVisits, rawNotLoggedInUsers, userId, userName, subordinates]);

  // Picker Modal Renderers
  const renderPersonaPicker = () => (
    <Modal visible={openPersonaPicker} transparent animationType="fade" onRequestClose={() => setOpenPersonaPicker(false)}>
      <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenPersonaPicker(false)}>
        <View style={modalStyles.modalContainer}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalHeaderTitle}>Select Persona</Text>
            <TouchableOpacity style={modalStyles.closeButton} onPress={() => setOpenPersonaPicker(false)}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <TouchableOpacity
              style={modalStyles.optionItem}
              onPress={() => {
                setSelectedPersona("All");
                setOpenPersonaPicker(false);
              }}
            >
              <Text style={[modalStyles.optionText, selectedPersona === "All" && modalStyles.optionTextSelected]}>All</Text>
            </TouchableOpacity>
            {personaList.map((persona, index) => (
              <TouchableOpacity
                key={index}
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
      </TouchableOpacity>
    </Modal>
  );

  const renderEmployeePicker = () => (
    <Modal visible={openEmployeePicker} transparent animationType="fade" onRequestClose={() => setOpenEmployeePicker(false)}>
      <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenEmployeePicker(false)}>
        <View style={modalStyles.modalContainer}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalHeaderTitle}>Select Employee</Text>
            <TouchableOpacity style={modalStyles.closeButton} onPress={() => setOpenEmployeePicker(false)}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView>
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
                <Text style={[modalStyles.optionText, selectedEmployee === emp.Sf_Id && modalStyles.optionTextSelected]}>{emp.Name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* Header */}
      <LinearGradient colors={["#C9A24D", "#A67C2E"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Dashboard</Text>
        <TouchableOpacity onPress={fetchData}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Welcome Card Banner (Reporting Manager) */}
      <View style={[styles.welcomeCard, { marginHorizontal: 16, marginTop: 12, marginBottom: 0 }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={styles.avatarIconWrapper}>
            <Ionicons name="person" size={18} color="#C9A24D" />
          </View>
          <View>
            <Text style={styles.welcomeLabel}>Reporting Manager</Text>
            <Text style={styles.welcomeName}>{userName || "Loading..."}</Text>
          </View>
        </View>
      </View>

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
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#C9A24D" />
          <Text style={styles.loaderText}>Loading dashboard metrics...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* Cards Grid */}
          <View style={styles.gridContainer}>
            {hasRoleAccess(userRole, allowedGroupC) && (
              <>
                <MetricCard
                  title="Total Users"
                  value={totalUsersCount}
                  icon="account-group"
                  color="#8E24AA"
                  bgColor="#F3E5F5"
                  onPress={() => navigation.navigate("DailyDashboardDetail", {
                    title: "Total Users Details",
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
                  })}
                />
                <MetricCard
                  title="Regular Users"
                  value={regularUsersCount}
                  icon="account"
                  color="#2E7D5B"
                  bgColor="#E3F1EA"
                  onPress={() => navigation.navigate("DailyDashboardDetail", {
                    title: "Regular Users Details",
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
                  })}
                />
                <MetricCard
                  title="Users on Leave"
                  value={leaveUsersCount}
                  icon="account-minus"
                  color="#C9A24D"
                  bgColor="#F1EADB"
                  onPress={() => navigation.navigate("DailyDashboardDetail", {
                    title: "Users on Leave Details",
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
                  })}
                />
                <MetricCard
                  title="Not Logged-In Users"
                  value={notLoggedInUsersCount}
                  icon="account-clock-outline"
                  color="#E65100"
                  bgColor="#FBEFD8"
                  onPress={() => navigation.navigate("DailyDashboardDetail", {
                    title: "Not Logged-In Users Details",
                    metricType: "not_logged_in",
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
                    rawNotLoggedInUsers,
                  })}
                />
              </>
            )}

            {hasRoleAccess(userRole, allowedGroupA) && (
              <>
                <MetricCard
                  title="Total Calls (TC)"
                  value={tcCount}
                  icon="phone-in-talk"
                  color="#3B5BB5"
                  bgColor="#EFF6FF"
                  onPress={() => navigation.navigate("DailyDashboardDetail", {
                    title: "Total Calls Details",
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
                  })}
                />
                <MetricCard
                  title="Productive Calls (PC)"
                  value={pcCount}
                  icon="checkbox-marked-circle-outline"
                  color="#D08C1F"
                  bgColor="#FBEFD8"
                  onPress={() => navigation.navigate("DailyDashboardDetail", {
                    title: "Productive Calls Details",
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
                  })}
                />
              </>
            )}

            {hasRoleAccess(userRole, allowedGroupB) && (
              <MetricCard
                title="Outlet Coverage"
                value={`${coveragePercent}%`}
                icon="map-marker-radius"
                color="#2E7D5B"
                bgColor="#E3F1EA"
                onPress={() => navigation.navigate("DailyDashboardDetail", {
                  title: "Outlet Coverage Details",
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
                })}
              />
            )}

            {hasRoleAccess(userRole, allowedGroupC) && (
              <MetricCard
                title="Spot Sales Summary"
                value={pcCount}
                icon="cash-multiple"
                color="#F57F17"
                bgColor="#FFF8E1"
                onPress={() => navigation.navigate("DailyDashboardDetail", {
                  title: "Spot Sales Details",
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
                })}
              />
            )}
          </View>
        </ScrollView>
      )}

      {renderPersonaPicker()}
      {renderEmployeePicker()}
    </SafeAreaProvider>
  );
};

export default DailyDashboard;

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
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
    paddingHorizontal: 12,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: "#7A7266",
    fontWeight: "500",
  },
  welcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1EADB",
    elevation: 1,
    shadowColor: "rgba(0, 0, 0, 0.02)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  avatarIconWrapper: {
    backgroundColor: "#F1EADB",
    borderRadius: 18,
    padding: 6,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeLabel: {
    fontSize: 10,
    color: "#7A7266",
    fontWeight: "500",
  },
  welcomeName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 1,
  },
  gridContainer: {
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
    width: (width - 44) / 2,
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
    fontSize: 15,
    fontWeight: "800",
    color: "#1F1D1A",
    lineHeight: 16,
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