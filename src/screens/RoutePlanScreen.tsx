import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Modal,
  RefreshControl,
} from "react-native";
import { dataSyncer } from "../UtilityMain/dataSyncer";
import Ionicons from "react-native-vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import { Colors } from "../theme";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../redux/store";
import { showToast } from "../redux/slices/toastSlice";
import Spinner from "react-native-spinkit";
import ReviewPlanModal from "../components/ReviewPlanModal";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

const { width } = Dimensions.get("window");

// Dynamic Month List Generator (Current Month + 11 Future Months)
const generateMonths = () => {
  const list = [];
  const currentDate = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + i,
      1,
    );
    const monthName = d.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
    list.push(monthName);
  }
  return list;
};

const months = generateMonths();

interface CalendarDay {
  dayName: string;
  dayNum: number | null;
}

const parseMonthYear = (monthYearStr: string) => {
  const today = new Date();
  let year = today.getFullYear();
  let monthIndex = today.getMonth();

  if (monthYearStr) {
    const parts = monthYearStr.split(" ");
    if (parts.length === 2) {
      const y = parseInt(parts[1], 10);
      if (!isNaN(y)) year = y;

      const monthName = parts[0].toLowerCase();
      const monthNames = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];
      const foundIdx = monthNames.indexOf(monthName);
      if (foundIdx !== -1) {
        monthIndex = foundIdx;
      }
    }
  }

  return { monthIndex, year };
};

const getNumberOfWeeksInMonth = (monthYearStr: string): number => {
  const { monthIndex, year } = parseMonthYear(monthYearStr);
  const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // Sunday=0, Monday=1, ...
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalSlots = firstDayIndex + daysInMonth;
  return Math.ceil(totalSlots / 7);
};

// Helper to determine the week name of a given date number
const getWeekNameForDay = (dayNum: number, monthYearStr: string): string => {
  const { monthIndex, year } = parseMonthYear(monthYearStr);
  const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // Sunday=0, Monday=1, ...

  // Find which week (1 to 6) dayNum belongs to
  const numWeeks = getNumberOfWeeksInMonth(monthYearStr);
  for (let w = 1; w <= numWeeks; w++) {
    const startDayNum = (w - 1) * 7 - firstDayIndex + 1;
    const endDayNum = startDayNum + 6;
    if (dayNum >= startDayNum && dayNum <= endDayNum) {
      return `Week ${w}`;
    }
  }
  return "Week 1";
};

// Full month days generator with padding slots
const getFullMonthDays = (monthYearStr: string): CalendarDay[] => {
  if (!monthYearStr) return [];
  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  const { monthIndex, year } = parseMonthYear(monthYearStr);

  const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // Sunday=0, Monday=1, ...
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const days: CalendarDay[] = [];

  // Add leading empty slots
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({ dayName: dayNames[i], dayNum: null });
  }

  // Add actual date days
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = (firstDayIndex + d - 1) % 7;
    days.push({ dayName: dayNames[dayOfWeek], dayNum: d });
  }

  // Add trailing empty slots to complete last week row
  const totalSlots = days.length;
  const remaining = totalSlots % 7;
  if (remaining > 0) {
    const slotsNeeded = 7 - remaining;
    for (let i = 0; i < slotsNeeded; i++) {
      const dayOfWeek = (firstDayIndex + daysInMonth + i) % 7;
      days.push({ dayName: dayNames[dayOfWeek], dayNum: null });
    }
  }

  return days;
};

// Week-based calendar date mapping helper (Sunday to Saturday sequence)
const getCalendarDaysForWeek = (
  weekName: string,
  monthYearStr: string,
): CalendarDay[] => {
  if (!weekName || !monthYearStr) return [];
  const match = weekName.match(/\d+/);
  const weekNum = match ? parseInt(match[0], 10) : 1; // 1 to 5

  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  const { monthIndex, year } = parseMonthYear(monthYearStr);

  const firstDayIndex = new Date(year, monthIndex, 1).getDay(); // Sunday=0, Monday=1, ...
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const days: CalendarDay[] = [];
  for (let s = 0; s < 7; s++) {
    const dayNum = (weekNum - 1) * 7 + s - firstDayIndex + 1;
    if (dayNum <= 0 || dayNum > daysInMonth) {
      days.push({ dayName: dayNames[s], dayNum: null });
    } else {
      days.push({ dayName: dayNames[s], dayNum });
    }
  }
  return days;
};

interface BeatMapping {
  Id: string;
  Name: string;
  Beat__c: string;
  Beat__r?: {
    Name?: string;
    Distributor__c?: string;
    Distributor__r?: {
      Name?: string;
    };
  };
  Account__c: string;
  Account__r?: {
    Name?: string;
    RecordType?: {
      Name?: string;
    };
  };
}

interface VisitItem {
  id: string;
  name: string;
  checked: boolean;
  type: "Beat" | "Distributor" | "Retailer";
}

export default function RoutePlanScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { apiComposite, fetchRecords, apiFetch } = useApiFetch();
  const auth = useSelector((state: RootState) => state.auth);
  const { accessToken, instanceUrl } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- Role, WorkType, and Joint Working States ---
  const [userRole, setUserRole] = useState<string>(""); // "RSM" | "ASM" | "ASE" | "SO" | "ISR" | "DSM"
  const [actualUserRoleName, setActualUserRoleName] = useState<string>("");
  const [workType, setWorkType] = useState<"CREATE_ROUTE_PLAN" | "JOINT_WORKING" | "JOURNEY_MODIFICATION" | "BEAT_REASSIGNMENT" | null>("CREATE_ROUTE_PLAN");
  const [selectedUserRole, setSelectedUserRole] = useState<"ASM" | "ASE" | "SO" | "ISR" | "DSM" | null>(null);
  const [selectedManagerUser, setSelectedManagerUser] = useState<any>(null); // intermediate manager (for RSM)
  const [selectedWorkingUser, setSelectedWorkingUser] = useState<any>(null); // target ISR/DSM user
  const [allUsers, setAllUsers] = useState<any[]>([]); // active users from Salesforce
  const [userSearchQuery, setUserSearchQuery] = useState<string>(""); // search filter for dropdown lists
  const [targetRoutePlanId, setTargetRoutePlanId] = useState<string | null>(null); // route plan id of selected working user

  // Dropdown visibility states
  const [showWorkTypeDropdown, setShowWorkTypeDropdown] = useState(false);
  const [showUserRoleDropdown, setShowUserRoleDropdown] = useState(false);
  const [showManagerUserDropdown, setShowManagerUserDropdown] = useState(false);
  const [showWorkingUserDropdown, setShowWorkingUserDropdown] = useState(false);

  // Joint Working Reason Modal states
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [jointWorkingReason, setJointWorkingReason] = useState("");
  const [activeBeatDayForReason, setActiveBeatDayForReason] = useState<any>(null);
  const [isBulkJointWorking, setIsBulkJointWorking] = useState(false);
  const [isReasonSubmitting, setIsReasonSubmitting] = useState(false);

  // Beat Reassignment Modal states
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [reassignDateStr, setReassignDateStr] = useState("");
  const [reassignBeatName, setReassignBeatName] = useState("");
  const [reassignDistributorName, setReassignDistributorName] = useState("");
  const [reassignRetailers, setReassignRetailers] = useState<string[]>([]);
  const [reassignBeatId, setReassignBeatId] = useState<string | null>(null);
  const [isReassignSubmitting, setIsReassignSubmitting] = useState(false);

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

  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState("User");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected state variables (Month defaults to current month, Week defaults to week containing today)
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [selectedWeek, setSelectedWeek] = useState(
    getWeekNameForDay(new Date().getDate(), months[0]),
  );

  useEffect(() => {
    if (selectedMonth && selectedWeek) {
      const match = selectedWeek.match(/\d+/);
      const weekNum = match ? parseInt(match[0], 10) : 1;
      const numWeeks = getNumberOfWeeksInMonth(selectedMonth);
      if (weekNum > numWeeks) {
        setSelectedWeek("Week 1");
      }
    }
  }, [selectedMonth, selectedWeek]);
  const getTomorrowDateString = () => {
    const today = new Date();
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );
    return `${tomorrow.getFullYear()}-${String(
      tomorrow.getMonth() + 1,
    ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  };

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(today.getDate()).padStart(2, "0")}`;
  };

  const normalizeId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return id.substring(0, 15);
  };

  const [selectedDates, setSelectedDates] = useState<string[]>([
    getTomorrowDateString(),
  ]);
  const [datePlans, setDatePlans] = useState<
    Record<
      string,
      {
        checkedBeats: Record<string, boolean>;
        checkedItems: Record<string, boolean>;
        selectedBeatId: string | null;
      }
    >
  >({});

  const [selectedTab, setSelectedTab] = useState<
    "Beats" | "Distributor" | "Retailer"
  >("Beats");
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown visibility states
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);

  const [mappings, setMappings] = useState<BeatMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetchingVisits, setIsFetchingVisits] = useState(false);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [checkedBeats, setCheckedBeats] = useState<Record<string, boolean>>({});

  // Plan Beat dropdown state (None, Daily, Weekly, Monthly) - Defaults to 'None'
  const [planBeat, setPlanBeat] = useState<
    "None" | "Daily" | "Weekly" | "Monthly"
  >("None");
  const [showBeatDropdown, setShowBeatDropdown] = useState(false);

  const [existingBeatDays, setExistingBeatDays] = useState<
    Record<string, { sfId: string; beatId: string | null; jointWorkingUser?: string | null; jointWorkingUserName?: string | null; jointWorkingReason?: string | null; approvalStatus?: string | null }>
  >({});
  const [managerJointWorkings, setManagerJointWorkings] = useState<
    Record<string, { sfId: string; ownerId: string; ownerName: string; jointWorkingReason?: string | null }>
  >({});
  const [existingVisits, setExistingVisits] = useState<
    Record<string, Record<string, string>>
  >({});
  const [existingVisitsStatus, setExistingVisitsStatus] = useState<
    Record<string, Record<string, string>>
  >({});
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewSelectedWeek, setReviewSelectedWeek] = useState<
    "All" | "Week 1" | "Week 2" | "Week 3" | "Week 4" | "Week 5" | "Week 6"
  >("All");

  // Select Route Plans from Redux store
  const routePlans = useSelector(
    (state: RootState) => state.routePlan.routePlans,
  );

  // Find the route plan for the currently selected month
  const currentMonthRoutePlan = routePlans?.find((plan) => {
    // 1. Try checking by Month__c if it is present
    if (plan.Month__c) {
      const monthFieldClean = plan.Month__c.trim().toLowerCase();
      const selectedMonthClean = selectedMonth.trim().toLowerCase();
      const monthNameOnly = selectedMonth.split(" ")[0].toLowerCase();
      if (
        monthFieldClean === selectedMonthClean ||
        monthFieldClean === selectedMonthClean.replace(" ", "-") ||
        monthFieldClean === monthNameOnly
      ) {
        return true;
      }
    }

    // 2. Fallback to matching by Start_Date__c
    if (!plan.Start_Date__c) return false;
    const planDate = new Date(plan.Start_Date__c);
    const { monthIndex, year } = parseMonthYear(selectedMonth);
    return (
      planDate.getFullYear() === year && planDate.getMonth() === monthIndex
    );
  });

  const routePlanId = ((workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT") && selectedWorkingUser)
    ? targetRoutePlanId
    : (currentMonthRoutePlan ? currentMonthRoutePlan.Id || currentMonthRoutePlan.id : null);
  const routePlanName = currentMonthRoutePlan
    ? currentMonthRoutePlan.Name || currentMonthRoutePlan.name
    : null;

  useEffect(() => {
    console.log("--- RoutePlanScreen Selected Month Details ---");
    console.log("Selected Month:", selectedMonth);
    console.log("Found Route Plan ID:", routePlanId);
    console.log("Found Route Plan Name:", routePlanName);
  }, [selectedMonth, routePlanId, routePlanName]);

  const fetchExistingBeatDaysAndVisits = async () => {
    const activeUserId = ((workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT") && selectedWorkingUser)
      ? selectedWorkingUser.Id || selectedWorkingUser.id
      : auth?.userId;

    const shouldBypassMappingsCheck = isManager && isViewingOwnPlan;

    if (!activeUserId || (mappings.length === 0 && !shouldBypassMappingsCheck)) return;
    setIsFetchingVisits(true);
    try {
      // Fetch manager's existing joint workings to check for conflicts
      const loggedInUserId = auth?.userId;
      if (loggedInUserId) {
        try {
          console.log("Fetching manager's existing joint workings. Manager ID:", loggedInUserId);
          const mgrJwQuery = `SELECT Id, Beat_Date__c, OwnerId, Owner.Name, Joint_Working_Reason__c FROM Beat_Day__c WHERE Joint_Working_User__c = '${loggedInUserId}'`;
          const mgrJwRecords = await fetchRecords("Beat_Day__c", mgrJwQuery);
          console.log("Fetched manager's joint workings:", mgrJwRecords);

          const mappedManagerJw: Record<
            string,
            { sfId: string; ownerId: string; ownerName: string; jointWorkingReason?: string | null }
          > = {};
          if (mgrJwRecords && !mgrJwRecords.status) {
            mgrJwRecords.forEach((rec: any) => {
              const dateStr = rec.Beat_Date__c;
              if (dateStr) {
                mappedManagerJw[dateStr] = {
                  sfId: rec.Id,
                  ownerId: rec.OwnerId,
                  ownerName: rec.Owner?.Name || "Another User",
                  jointWorkingReason: rec.Joint_Working_Reason__c || null,
                };
              }
            });
          }
          setManagerJointWorkings(mappedManagerJw);
        } catch (mgrError) {
          console.error("Error fetching manager joint workings:", mgrError);
        }
      }

      const shouldQueryByOwnerId = !routePlanId || (isManager && isViewingOwnPlan);

      console.log(
        "Fetching existing Beat_Day__c records. Route Plan:",
        routePlanId,
        "Active User:",
        activeUserId,
        "shouldQueryByOwnerId:",
        shouldQueryByOwnerId
      );
      const beatDaysQuery = shouldQueryByOwnerId
        ? `SELECT Id, Beat_Date__c, Route_Plans__c, Beat__c, Beat__r.Name, Joint_Working_User__c, Joint_Working_User__r.Name, Joint_Working_Reason__c, Approval_Status__c FROM Beat_Day__c WHERE OwnerId = '${activeUserId}'`
        : `SELECT Id, Beat_Date__c, Route_Plans__c, Beat__c, Beat__r.Name, Joint_Working_User__c, Joint_Working_User__r.Name, Joint_Working_Reason__c, Approval_Status__c FROM Beat_Day__c WHERE Route_Plans__c = '${routePlanId}'`;
      const beatDayRecords = await fetchRecords("Beat_Day__c", beatDaysQuery);
      console.log("Fetched existing Beat_Day__c records:", beatDayRecords);

      if (beatDayRecords && !beatDayRecords.status) {
        const mappedBeatDays: Record<
          string,
          { sfId: string; beatId: string | null; beatName?: string | null; jointWorkingUser?: string | null; jointWorkingUserName?: string | null; jointWorkingReason?: string | null; approvalStatus?: string | null }
        > = {};
        const initialDatePlans: typeof datePlans = {};

        beatDayRecords.forEach((rec: any) => {
          const dateStr = rec.Beat_Date__c;
          if (dateStr) {
            mappedBeatDays[dateStr] = {
              sfId: rec.Id,
              beatId: rec.Beat__c || null,
              beatName: rec.Beat__r?.Name || null,
              jointWorkingUser: rec.Joint_Working_User__c || null,
              jointWorkingUserName: rec.Joint_Working_User__r?.Name || null,
              jointWorkingReason: rec.Joint_Working_Reason__c || null,
              approvalStatus: rec.Approval_Status__c || null,
            };
            initialDatePlans[dateStr] = {
              checkedBeats: rec.Beat__c ? { [rec.Beat__c]: true } : {},
              checkedItems: {},
              selectedBeatId: rec.Beat__c || null,
            };
          }
        });

        // Fetch associated visits
        console.log(
          "Fetching existing Visit__c records. Route Plan:",
          routePlanId,
          "Active User:",
          activeUserId,
          "shouldQueryByOwnerId:",
          shouldQueryByOwnerId
        );
        const visitsQuery = shouldQueryByOwnerId
          ? `SELECT Id, AccountId__c, BeatDay__c, VisitDate__c, VisitStatus__c FROM Visit__c WHERE BeatDay__r.OwnerId = '${activeUserId}' AND Is_Deleted__c != true`
          : `SELECT Id, AccountId__c, BeatDay__c, VisitDate__c, VisitStatus__c FROM Visit__c WHERE BeatDay__r.Route_Plans__c = '${routePlanId}' AND Is_Deleted__c != true`;
        const visitRecords = await fetchRecords("Visit__c", visitsQuery);
        console.log("Fetched existing Visit__c records:", visitRecords);

        const mappedVisits: Record<string, Record<string, string>> = {};
        const mappedVisitsStatus: Record<string, Record<string, string>> = {};

        if (visitRecords && !visitRecords.status) {
          visitRecords.forEach((visit: any) => {
            const dateStr = visit.VisitDate__c;
            const accountId = visit.AccountId__c;
            const visitStatus = visit.VisitStatus__c;
            if (dateStr && accountId) {
              // Store in existingVisits and existingVisitsStatus maps
              if (!mappedVisits[dateStr]) {
                mappedVisits[dateStr] = {};
                mappedVisitsStatus[dateStr] = {};
              }
              mappedVisits[dateStr][accountId] = visit.Id;
              mappedVisitsStatus[dateStr][accountId] = visitStatus;

              // Ensure date plan exists
              if (!initialDatePlans[dateStr]) {
                initialDatePlans[dateStr] = {
                  checkedBeats: {},
                  checkedItems: {},
                  selectedBeatId: null,
                };
              }

              // Only pre-check items if the status is NOT "Cancel"
              if (visitStatus !== "Cancel") {
                initialDatePlans[dateStr].checkedItems[accountId] = true;

                // Resolve Beat ID from mappings only if selectedBeatId is not already set from Beat_Day__c
                if (!initialDatePlans[dateStr].selectedBeatId) {
                  const mapping = mappings.find(
                    (m) =>
                      m.Account__c === accountId ||
                      m.Beat__r?.Distributor__c === accountId,
                  );
                  if (mapping && mapping.Beat__c) {
                    initialDatePlans[dateStr].selectedBeatId = mapping.Beat__c;
                    initialDatePlans[dateStr].checkedBeats[mapping.Beat__c] =
                      true;
                  }
                }
              }
            }
          });
        }

        setExistingBeatDays(mappedBeatDays);
        setExistingVisits(mappedVisits);
        setExistingVisitsStatus(mappedVisitsStatus);
        setDatePlans((prev) => ({ ...prev, ...initialDatePlans }));
      }
    } catch (err) {
      console.error(
        "Error fetching existing Beat_Day__c and Visit__c records:",
        err,
      );
    } finally {
      setIsFetchingVisits(false);
    }
  };

  useEffect(() => {
    fetchExistingBeatDaysAndVisits();
  }, [routePlanId, mappings.length, workType, selectedWorkingUser, refreshTrigger]);

  // Synchronize checklist states when currently selected date or datePlans changes
  useEffect(() => {
    const focusedDate = selectedDates[0];
    if (!focusedDate) {
      setCheckedBeats({});
      setCheckedItems({});
      setSelectedBeatId(null);
      return;
    }
    const activePlan = datePlans[focusedDate] || {
      checkedBeats: {},
      checkedItems: {},
      selectedBeatId: null,
    };
    setCheckedBeats(activePlan.checkedBeats || {});
    setCheckedItems(activePlan.checkedItems || {});
    setSelectedBeatId(activePlan.selectedBeatId || null);
  }, [selectedDates[0], datePlans]);

  const prevWeekRef = React.useRef(selectedWeek);
  const prevMonthRef = React.useRef(selectedMonth);

  useEffect(() => {
    if (planBeat === "Weekly") {
      const prevWeek = prevWeekRef.current;
      const prevMonth = prevMonthRef.current;

      if (
        (prevWeek && prevWeek !== selectedWeek) ||
        (prevMonth && prevMonth !== selectedMonth)
      ) {
        const monthToClear = prevMonth || selectedMonth;
        const weekToClear = prevWeek;

        console.log(
          `Clearing unsaved weekly plans for ${weekToClear} in ${monthToClear}`,
        );

        const { monthIndex, year } = parseMonthYear(monthToClear);
        const days = getFullMonthDays(monthToClear);

        setDatePlans((prevPlans) => {
          const newPlans = { ...prevPlans };
          days.forEach((day) => {
            if (day.dayNum) {
              const inWeek = isDayInSelectedWeek(
                day.dayNum,
                weekToClear,
                monthToClear,
              );
              if (inWeek) {
                const dateStr = `${year}-${String(monthIndex + 1).padStart(
                  2,
                  "0",
                )}-${String(day.dayNum).padStart(2, "0")}`;
                delete newPlans[dateStr];
              }
            }
          });
          return newPlans;
        });

        const focusedDate = selectedDates[0];
        if (focusedDate) {
          const parts = focusedDate.split("-");
          if (parts.length === 3) {
            const dayNum = parseInt(parts[2], 10);
            const inWeek = isDayInSelectedWeek(
              dayNum,
              weekToClear,
              monthToClear,
            );
            if (inWeek) {
              setCheckedBeats({});
              setCheckedItems({});
              setSelectedBeatId(null);
            }
          }
        }
      }
    }
    prevWeekRef.current = selectedWeek;
    prevMonthRef.current = selectedMonth;
  }, [selectedWeek, selectedMonth, planBeat]);

  // Helper: recursive lookup of all sub-users reporting to a manager ID
  const getSubUsers = (mgrId: string, usersList: any[]): any[] => {
    if (!mgrId || !usersList) return [];
    let result: any[] = [];
    const targetMgrId15 = mgrId.substring(0, 15);
    const directReports = usersList.filter((u) => {
      return u.ManagerId && u.ManagerId.substring(0, 15) === targetMgrId15;
    });
    result = [...result, ...directReports];
    for (const report of directReports) {
      result = [...result, ...getSubUsers(report.Id, usersList)];
    }
    return result;
  };

  const getNormalizedRole = (roleName: string) => {
    if (!roleName) return "";
    const name = roleName.toUpperCase();
    if (name.includes("RSM")) return "RSM";
    if (name.includes("ASM")) return "ASM";
    if (name.includes("ASE")) return "ASE";
    if (name.includes("SO")) return "SO";
    if (name.includes("ISR")) return "ISR";
    if (name.includes("DSM")) return "DSM";
    return "";
  };

  const loadSalesforceUsers = async () => {
    try {
      const loggedInUserId = auth?.userId;
      if (!loggedInUserId) return;
      console.log("Fetching active sub-hierarchy users from Salesforce...");
      const query = `
        SELECT Id, Name, Email, Title, Phone, ManagerId, Manager.Name, UserRole.Name, EmployeeCode__c, Username
        FROM User 
        WHERE IsActive = true 
          AND (
               ManagerId = '${loggedInUserId}' 
            OR Manager.ManagerId = '${loggedInUserId}' 
            OR Manager.Manager.ManagerId = '${loggedInUserId}' 
            OR Manager.Manager.Manager.ManagerId = '${loggedInUserId}' 
            OR Manager.Manager.Manager.Manager.ManagerId = '${loggedInUserId}'
          )
        ORDER BY Name ASC
      `;
      const records = await fetchRecords("User", query);
      if (Array.isArray(records)) {
        console.log(`Fetched ${records.length} active hierarchy users.`);
        setAllUsers(records);
      } else {
        console.warn("Failed to fetch active users from Salesforce, response:", records);
      }
    } catch (error) {
      console.error("Error loading Salesforce users:", error);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        if (result && result.length > 0) {
          console.log("Fetched user name:", result);
          setUserName(result[0]?.Name || "User");

          const rawRole = result[0]?.Role || "";
          const devName = result[0]?.DeveloperName || "";
          setActualUserRoleName(rawRole || devName);

          const checkString = (rawRole + " " + devName).toUpperCase();
          if (checkString.includes("RSM")) {
            setUserRole("RSM");
          } else if (checkString.includes("ASM")) {
            setUserRole("ASM");
          } else if (checkString.includes("ASE") || checkString.includes("ASO")) {
            setUserRole("ASE");
          } else if (checkString.includes("SO")) {
            setUserRole("SO");
          } else if (checkString.includes("ISR")) {
            setUserRole("ISR");
          } else if (checkString.includes("DSM")) {
            setUserRole("DSM");
          } else {
            setUserRole("");
          }
        }
      } catch (error) {
        console.error("Failed to get user name:", error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (["RSM", "ASM", "ASE", "SO"].includes(userRole)) {
      loadSalesforceUsers();
    }
  }, [userRole]);

  const loadTargetUserRoutePlanData = async () => {
    if ((workType !== "JOINT_WORKING" && workType !== "JOURNEY_MODIFICATION" && workType !== "BEAT_REASSIGNMENT") || !selectedWorkingUser) return;
    setLoading(true);
    try {
      console.log("Loading target user route plan data...", selectedWorkingUser.Name);
      const routePlanQuery = `SELECT Id, Name, Start_Date__c, End_Date__c, Assigned_To__c, Month__c FROM Route_Plans__c WHERE Assigned_To__c = '${selectedWorkingUser.Id}'`;
      const routePlans = await fetchRecords("Route_Plans__c", routePlanQuery);

      if (!Array.isArray(routePlans) || routePlans.length === 0) {
        dispatch(
          showToast({
            type: "error",
            message: "No Route Plan found for this user.",
          })
        );
        setExistingBeatDays({});
        setExistingVisits({});
        setExistingVisitsStatus({});
        setDatePlans({});
        setTargetRoutePlanId(null);
        setLoading(false);
        return;
      }

      const targetMonthRoutePlan = routePlans.find((plan) => {
        if (plan.Month__c) {
          const monthFieldClean = plan.Month__c.trim().toLowerCase();
          const selectedMonthClean = selectedMonth.trim().toLowerCase();
          const monthNameOnly = selectedMonth.split(" ")[0].toLowerCase();
          if (
            monthFieldClean === selectedMonthClean ||
            monthFieldClean === selectedMonthClean.replace(" ", "-") ||
            monthFieldClean === monthNameOnly
          ) {
            return true;
          }
        }
        if (!plan.Start_Date__c) return false;
        const planDate = new Date(plan.Start_Date__c);
        const { monthIndex, year } = parseMonthYear(selectedMonth);
        return (
          planDate.getFullYear() === year && planDate.getMonth() === monthIndex
        );
      });

      if (!targetMonthRoutePlan) {
        dispatch(
          showToast({
            type: "error",
            message: "No Route Plan found for this user in the selected month.",
          })
        );
        setExistingBeatDays({});
        setExistingVisits({});
        setExistingVisitsStatus({});
        setDatePlans({});
        setTargetRoutePlanId(null);
        setLoading(false);
        return;
      }

      const targetRpId = targetMonthRoutePlan.Id || targetMonthRoutePlan.id;
      setTargetRoutePlanId(targetRpId);
    } catch (error) {
      console.error("Failed to load target user route plan data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT") && selectedWorkingUser && selectedMonth) {
      loadTargetUserRoutePlanData();
    }
  }, [selectedWorkingUser, selectedMonth, workType]);

  useEffect(() => {
    if ((workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT") && selectedWorkingUser) {
      if (workType === "JOURNEY_MODIFICATION") {
        const tomorrowStr = getTomorrowDateString();
        // Find dates starting from tomorrow onwards that have an approved beat day
        const validDates = Object.keys(existingBeatDays).filter(d => {
          const rec = existingBeatDays[d];
          return d >= tomorrowStr && rec && rec.approvalStatus?.toLowerCase() === "approved";
        }).sort();

        if (validDates.length > 0) {
          setSelectedDates([validDates[0]]);
        } else {
          setSelectedDates([tomorrowStr]);
        }
      } else {
        const datesWithBeatDay = Object.keys(existingBeatDays).filter(d => existingBeatDays[d]);
        if (datesWithBeatDay.length > 0) {
          const todayStr = getTodayDateString();
          // Find dates starting from today onwards
          const validDates = datesWithBeatDay.filter(d => d >= todayStr).sort();
          if (validDates.length > 0) {
            setSelectedDates([validDates[0]]);
          } else {
            // Fallback to sorting all available dates
            datesWithBeatDay.sort();
            setSelectedDates([datesWithBeatDay[datesWithBeatDay.length - 1]]); // latest past date
          }
        } else {
          setSelectedDates([]);
        }
      }
    }
  }, [existingBeatDays, selectedWorkingUser, workType]);

  useEffect(() => {
    const fetchBeatMappings = async () => {
      setLoading(true);
      try {
        const userIdVal = ((workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT") && selectedWorkingUser)
          ? selectedWorkingUser.Id || selectedWorkingUser.id
          : auth?.userId;
        if (!userIdVal) {
          console.warn("User ID is not available in Redux auth state yet");
          setLoading(false);
          return;
        }

        // 2. Query User_BA_Mapping__c to get mapped accounts for this user ID
        const userBaQuery = `
          SELECT Id, Name, Account__c, Account__r.Name, User__c, User__r.Name
          FROM User_BA_Mapping__c 
          WHERE User__c = '${userIdVal}' AND Is_Active__c = true AND Status__c = 'Active'
        `;
        console.log("Fetching User BA Mappings:", userBaQuery);
        const userBaMappings = await fetchRecords("User_BA_Mapping__c", userBaQuery);
        if (!Array.isArray(userBaMappings) || userBaMappings.length === 0) {
          console.warn("No User_BA_Mapping__c records found for user:", userIdVal);
          setMappings([]);
          setLoading(false);
          return;
        }

        // Extract unique Account IDs (distributors)
        const accountIds = [
          ...new Set(
            userBaMappings.map((item) => item.Account__c).filter(Boolean)
          )
        ];
        if (accountIds.length === 0) {
          console.warn("No Account__c found in User_BA_Mapping__c records");
          setMappings([]);
          setLoading(false);
          return;
        }

        // 3. Query Beat__c to get Beats based on those Account IDs
        const accountFilter = accountIds.map((id) => `'${id}'`).join(",");
        const beatQuery = `
          SELECT Id, Name, Beat_Status__c, Beat_Visit_Frequency__c, 
                 Distributor__c, Distributor__r.Name
          FROM Beat__c
          WHERE Distributor__c IN (${accountFilter})
        `;
        console.log("Fetching Beats:", beatQuery);
        const beats = await fetchRecords("Beat__c", beatQuery);
        if (!Array.isArray(beats) || beats.length === 0) {
          console.warn("No Beat__c records found for accounts:", accountIds);
          setMappings([]);
          setLoading(false);
          return;
        }

        // Extract unique Beat IDs
        const beatIds = [
          ...new Set(beats.map((item) => item.Id).filter(Boolean)),
        ];
        if (beatIds.length === 0) {
          console.warn("No Beat IDs found in beats query");
          setMappings([]);
          setLoading(false);
          return;
        }

        // 4. Query Beat_Mapping__c to get mapped retailers based on Beat IDs
        const beatFilter = beatIds.map((id) => `'${id}'`).join(",");
        const mappingQuery = `
          SELECT
              Id,
              Name,
              Beat__c,
              Beat__r.Name,
              Beat__r.Distributor__c,
              Beat__r.Distributor__r.Name,
              Account__c,
              Account__r.Name,
              Account__r.RecordType.Name
          FROM Beat_Mapping__c
          WHERE Beat__c IN (${beatFilter}) AND Is_Active__c = true AND Status__c = 'Active'
        `;
        console.log("Fetching Beat Mappings:", mappingQuery);
        const result = await fetchRecords("Beat_Mapping__c", mappingQuery);
        if (Array.isArray(result)) {
          setMappings(result);
          setCheckedItems({});
          setCheckedBeats({});
          setSelectedBeatId(null);
        } else {
          console.error(
            "fetchRecords did not return an array for Beat_Mapping__c",
            result,
          );
        }
      } catch (error) {
        console.error("Failed to fetch Beat Mappings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBeatMappings();
  }, [auth?.userId, selectedWorkingUser, workType, refreshTrigger]);

  // Reset all selections when planBeat changes
  useEffect(() => {
    setSelectedBeatId(null);
    setCheckedBeats({});
    setCheckedItems({});
    setSelectedTab("Beats");
  }, [planBeat]);

  const avatarLetter = userName.charAt(0).toUpperCase() || "U";

  // 1. Get unique Beats
  const uniqueBeatsMap = new Map<string, string>();
  mappings.forEach((m) => {
    if (m.Beat__c) {
      const name = m.Beat__r?.Name || m.Name || "Unnamed Beat";
      uniqueBeatsMap.set(m.Beat__c, name);
    }
  });
  const beatsList = Array.from(uniqueBeatsMap.entries()).map(([id, name]) => ({
    id,
    name,
    checked: !!checkedBeats[id],
    type: "Beat" as const,
  }));

  // 2. Get unique Distributors for the selected Beat
  const uniqueDistributorsMap = new Map<string, string>();
  if (selectedBeatId) {
    mappings.forEach((m) => {
      if (m.Beat__c === selectedBeatId && m.Beat__r?.Distributor__c) {
        const name = m.Beat__r.Distributor__r?.Name || "Unnamed Distributor";
        uniqueDistributorsMap.set(m.Beat__r.Distributor__c, name);
      }
    });
  }
  const distributorsList = Array.from(uniqueDistributorsMap.entries()).map(
    ([id, name]) => ({
      id,
      name,
      checked: !!checkedItems[id],
      type: "Distributor" as const,
    }),
  );

  // 3. Get unique Retailers (Accounts) for the selected Beat
  const uniqueRetailersMap = new Map<
    string,
    { name: string; recordTypeName: string }
  >();
  if (selectedBeatId) {
    mappings.forEach((m) => {
      if (m.Beat__c === selectedBeatId && m.Account__c) {
        const name = m.Account__r?.Name || "Unnamed Retailer";
        const recordTypeName = m.Account__r?.RecordType?.Name || "Dealer";
        uniqueRetailersMap.set(m.Account__c, { name, recordTypeName });
      }
    });
  }
  const retailersList = Array.from(uniqueRetailersMap.entries()).map(
    ([id, data]) => ({
      id,
      name: data.name,
      recordTypeName: data.recordTypeName,
      checked: !!checkedItems[id],
      type: "Retailer" as const,
    }),
  );

  // Get current active list based on selectedTab
  let activeList: VisitItem[] = [];
  if (selectedTab === "Beats") {
    activeList = beatsList;
  } else if (selectedTab === "Distributor") {
    activeList = distributorsList;
  } else if (selectedTab === "Retailer") {
    activeList = retailersList;
  }

  const toggleCheckbox = (id: string) => {
    const focusedDate = selectedDates[0];
    if (!focusedDate) return;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (focusedDate === todayStr && planBeat !== "Daily" && !(isManager && isViewingOwnPlan)) return;

    if (
      existingBeatDays[focusedDate] &&
      !["draft", "rejected"].includes(existingBeatDays[focusedDate].approvalStatus?.toLowerCase() || "") &&
      workType !== "JOURNEY_MODIFICATION"
    )
      return;

    if (selectedTab === "Beats") {
      const isCurrentlyChecked = !!checkedBeats[id];
      const newCheckedBeats = !isCurrentlyChecked ? { [id]: true } : {};
      const newSelectedBeatId = !isCurrentlyChecked ? id : null;
      const newCheckedItems = !isCurrentlyChecked ? { [id]: true } : {};

      setCheckedBeats(newCheckedBeats);
      setSelectedBeatId(newSelectedBeatId);
      setCheckedItems(newCheckedItems);

      setDatePlans((prev) => ({
        ...prev,
        [focusedDate]: {
          checkedBeats: newCheckedBeats,
          checkedItems: newCheckedItems,
          selectedBeatId: newSelectedBeatId,
        },
      }));
    } else if (selectedTab === "Distributor" || selectedTab === "Retailer") {
      const newCheckedItems = {
        ...checkedItems,
        [id]: !checkedItems[id],
      };
      setCheckedItems(newCheckedItems);

      setDatePlans((prev) => ({
        ...prev,
        [focusedDate]: {
          checkedBeats,
          checkedItems: newCheckedItems,
          selectedBeatId,
        },
      }));
    }
  };

  // Filter list by selected tab and search query
  const filteredItems = activeList.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const weeks = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];
  const fullMonthDays = getFullMonthDays(selectedMonth || months[0]);

  // Dynamic visits counting
  const plannedBeatsCount = Object.values(checkedBeats).filter(Boolean).length;
  const checkedVisitsCount =
    distributorsList.filter((item) => item.checked).length +
    retailersList.filter((item) => item.checked).length;
  const totalVisitsCount = distributorsList.length + retailersList.length;

  // Dynamic missed out counts across ALL beats (Remaining = Total - Selected)
  const missedBeatsCount = beatsList.length - plannedBeatsCount;

  const allUniqueDistributorIds = Array.from(
    new Set(mappings.map((m) => m.Beat__r?.Distributor__c).filter(Boolean)),
  );
  const checkedDistributorsCount = allUniqueDistributorIds.filter(
    (id) => checkedItems[id],
  ).length;
  const missedDistributorsCount =
    allUniqueDistributorIds.length - checkedDistributorsCount;

  const allUniqueRetailerIds = Array.from(
    new Set(mappings.map((m) => m.Account__c).filter(Boolean)),
  );
  const checkedRetailersCount = allUniqueRetailerIds.filter(
    (id) => checkedItems[id],
  ).length;
  const missedRetailersCount =
    allUniqueRetailerIds.length - checkedRetailersCount;

  const beatOptions = ["None", "Daily", "Weekly", "Monthly"] as const;

  // Check if dayNum belongs to the selected week
  const isDayInSelectedWeek = (
    dayNum: number,
    weekName: string,
    monthYearStr: string,
  ): boolean => {
    const weekDays = getCalendarDaysForWeek(weekName, monthYearStr);
    return weekDays.some((w) => w.dayNum === dayNum);
  };

  // Initialize selectedDates based on planBeat or workType
  useEffect(() => {
    if (workType === "JOURNEY_MODIFICATION") {
      setSelectedDates([getTomorrowDateString()]);
      return;
    }
    if (planBeat === "None" && !(isManager && isViewingOwnPlan)) {
      setSelectedDates([]);
    } else if (planBeat === "Daily") {
      setSelectedDates([getTodayDateString()]);
    } else {
      setSelectedDates([getTomorrowDateString()]);
    }
  }, [planBeat, selectedMonth, selectedWeek, workType]);

  const handleDatePress = (dayNum: number) => {
    if (planBeat === "None" && workType !== "JOURNEY_MODIFICATION" && !(isManager && isViewingOwnPlan)) return;

    const { monthIndex, year } = parseMonthYear(selectedMonth);
    const dateStr = `${year}-${String(monthIndex + 1).padStart(
      2,
      "0",
    )}-${String(dayNum).padStart(2, "0")}`;

    if (workType === "JOURNEY_MODIFICATION") {
      const today = new Date();
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const targetDate = new Date(year, monthIndex, dayNum);
      const isPastOrToday = targetDate <= todayZero;

      const existingRecord = existingBeatDays[dateStr];
      const isApproved = !!(
        existingRecord &&
        existingRecord.approvalStatus?.toLowerCase() === "approved"
      );

      if (isPastOrToday || !isApproved) {
        return;
      }
    }

    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        return [];
      } else {
        // Automatically default/switch to the Beats tab when a new date is selected
        setSelectedTab("Beats");
        return [dateStr];
      }
    });
  };

  // Determine enabled/highlight status for monthly calendar grid cells (read-only visualization)
  const getDayStatus = (dayNum: number, monthYearStr: string) => {
    // If beat selection is 'None', disable the entire calendar
    if (planBeat === "None" && !(isManager && isViewingOwnPlan)) {
      return { highlighted: false };
    }

    const today = new Date();
    const { monthIndex, year } = parseMonthYear(monthYearStr);

    const targetDate = new Date(year, monthIndex, dayNum);
    const todayZero = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const tomorrowZero = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    const isToday = targetDate.getTime() === todayZero.getTime();
    const isTomorrow = targetDate.getTime() === tomorrowZero.getTime();
    const isFuture = targetDate >= tomorrowZero;

    if (planBeat === "Daily") {
      // In Daily mode: Only today is highlighted
      return { highlighted: isToday };
    } else if (planBeat === "Weekly") {
      // In Weekly mode: Highlighted if in selected week AND starting from tomorrow
      const inWeek = isDayInSelectedWeek(dayNum, selectedWeek, monthYearStr);
      return { highlighted: isFuture && inWeek };
    } else {
      // In Monthly mode: Highlighted for tomorrow and all future dates
      return { highlighted: isFuture };
    }
  };

  const isManager = ["RSM", "ASM", "ASE", "SO"].includes(userRole);
  const isViewingOwnPlan = !selectedWorkingUser || (selectedWorkingUser?.Id || selectedWorkingUser?.id || "").substring(0, 15) === (auth?.userId || "").substring(0, 15);
  const workTypeOptions = [
    { label: "Create Route Plan", value: "CREATE_ROUTE_PLAN" as const },
    { label: "Joint Working", value: "JOINT_WORKING" as const },
    { label: "Journey Modification", value: "JOURNEY_MODIFICATION" as const },
  ];

  const isFetchingData = loading || isFetchingVisits;
  const isTargetUserSelected =
    (workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT")
      ? !!selectedWorkingUser
      : true;

  const focusedDate = selectedDates[0];
  const isChecklistEnabled = isTargetUserSelected && (
    workType === "JOURNEY_MODIFICATION"
      ? !!(focusedDate && existingBeatDays[focusedDate] && existingBeatDays[focusedDate].approvalStatus?.toLowerCase() === "approved")
      : (planBeat !== "None" || (isManager && isViewingOwnPlan))
  ) && selectedDates.length > 0 && !!selectedDates[0];

  const isCurrentTabEnabled = isTargetUserSelected && (
    workType === "JOURNEY_MODIFICATION"
      ? !!(focusedDate && existingBeatDays[focusedDate] && existingBeatDays[focusedDate].approvalStatus?.toLowerCase() === "approved")
      : (planBeat !== "None" || (isManager && isViewingOwnPlan))
  ) && selectedDates.length > 0 && !!selectedDates[0];
  const hasJourneyModifications = () => {
    const dateStr = selectedDates[0];
    if (!dateStr) return false;

    const plan = datePlans[dateStr];
    if (!plan) return false;

    const currentBeatId = plan.selectedBeatId;
    const hasBeat = currentBeatId !== null;

    const planCheckedItems = plan.checkedItems || {};
    const existingVisitsForDate = existingVisits[dateStr] || {};

    // Normalize planCheckedItems keys to 15 chars
    const planChecked15: Record<string, boolean> = {};
    Object.keys(planCheckedItems).forEach((k) => {
      if (planCheckedItems[k]) {
        const norm = normalizeId(k);
        if (norm) planChecked15[norm] = true;
      }
    });

    // Normalize existingVisitsForDate keys to 15 chars
    const existingVisits15: Record<string, boolean> = {};
    Object.keys(existingVisitsForDate).forEach((k) => {
      const norm = normalizeId(k);
      if (norm) {
        const existingStatus = existingVisitsStatus[dateStr]?.[k];
        if (existingStatus !== "Cancel") {
          existingVisits15[norm] = true;
        }
      }
    });

    if (workType === "JOURNEY_MODIFICATION") {
      const hasNewVisits = Object.keys(planCheckedItems).some((key) => {
        if (!key.startsWith("001") || !planCheckedItems[key]) return false;
        const normKey = normalizeId(key);
        if (!normKey) return false;
        const wasPlanned = !!existingVisits15[normKey];
        return !wasPlanned;
      });
      return !!(hasBeat && hasNewVisits);
    }

    // Default comparison for other workTypes
    const existingBeatId = normalizeId(existingBeatDays[dateStr]?.beatId);
    console.log("DEBUG [hasJourneyModifications] default check:", {
      dateStr,
      existingBeatId,
      currentBeatId: normalizeId(currentBeatId),
      planChecked15,
      existingVisits15,
    });
    if (normalizeId(currentBeatId) !== existingBeatId) {
      return true;
    }

    const allAccounts = new Set([...Object.keys(planChecked15), ...Object.keys(existingVisits15)]);
    for (const accountId of allAccounts) {
      const isCurrentlyChecked = !!planChecked15[accountId];
      const wasPlanned = !!existingVisits15[accountId];

      if (isCurrentlyChecked !== wasPlanned) {
        return true;
      }
    }
    return false;
  };

  const isEveryExistingPlanValid = () => {
    const allDates = new Set([...Object.keys(datePlans), ...Object.keys(existingBeatDays)]);
    for (const dateStr of allDates) {
      const plan = datePlans[dateStr];
      if (!plan) continue;

      // Check if this date was actually modified
      const existingBeatId = normalizeId(existingBeatDays[dateStr]?.beatId);
      const currentBeatId = normalizeId(plan.selectedBeatId);

      const planCheckedItems = plan.checkedItems || {};
      const existingVisitsForDate = existingVisits[dateStr] || {};

      // Normalize planCheckedItems keys to 15 chars
      const planChecked15: Record<string, boolean> = {};
      Object.keys(planCheckedItems).forEach((k) => {
        if (planCheckedItems[k]) {
          const norm = normalizeId(k);
          if (norm) planChecked15[norm] = true;
        }
      });

      // Normalize existingVisitsForDate keys to 15 chars
      const existingVisits15: Record<string, boolean> = {};
      Object.keys(existingVisitsForDate).forEach((k) => {
        const norm = normalizeId(k);
        if (norm) {
          const existingStatus = existingVisitsStatus[dateStr]?.[k];
          if (existingStatus !== "Cancel") {
            existingVisits15[norm] = true;
          }
        }
      });

      let isVisitsChanged = false;
      const allAccounts = new Set([...Object.keys(planChecked15), ...Object.keys(existingVisits15)]);
      for (const accountId of allAccounts) {
        const isCurrentlyChecked = !!planChecked15[accountId];
        const wasPlanned = !!existingVisits15[accountId];
        if (isCurrentlyChecked !== wasPlanned) {
          isVisitsChanged = true;
          break;
        }
      }

      const isModified = (currentBeatId !== existingBeatId) || isVisitsChanged;
      if (!isModified) continue; // Skip validation if not modified

      const hasBeat = currentBeatId !== null;
      // In normalized planChecked15, check if there are any visit accounts starting with "001"
      const hasVisits = Object.keys(planChecked15).some((key) => key.startsWith("001"));

      // In JOURNEY_MODIFICATION, we relax "beat must have visits" validation
      if (workType !== "JOURNEY_MODIFICATION" && hasBeat && !hasVisits) {
        return false;
      }
      // If visits are checked, a beat must be selected (applies to both)
      if (!hasBeat && hasVisits) {
        return false;
      }
    }
    return true;
  };

  const isSubmitDisabled = (() => {
    const disabled = workType === "JOURNEY_MODIFICATION"
      ? !selectedWorkingUser || selectedDates.length === 0 || !hasJourneyModifications() || !isEveryExistingPlanValid()
      : (!isChecklistEnabled ||
        checkedVisitsCount === 0 ||
        (focusedDate &&
          !!existingBeatDays[focusedDate] &&
          !["draft", "rejected"].includes(existingBeatDays[focusedDate].approvalStatus?.toLowerCase() || "")));
    console.log("DEBUG [RoutePlan] isSubmitDisabled:", disabled, "details:", {
      workType,
      selectedWorkingUser: !!selectedWorkingUser,
      selectedDatesCount: selectedDates.length,
      hasJourneyModifications: hasJourneyModifications(),
      isEveryExistingPlanValid: isEveryExistingPlanValid(),
    });
    return disabled;
  })();

  const isPreviouslyDraft = !!(
    focusedDate &&
    existingBeatDays[focusedDate] &&
    existingBeatDays[focusedDate].approvalStatus?.toLowerCase() === "draft"
  );

  const isSaveDraftDisabled =
    isSubmitDisabled ||
    workType !== "CREATE_ROUTE_PLAN" ||
    (isPreviouslyDraft && !hasJourneyModifications());

  console.log("DEBUG [RoutePlan] isSaveDraftDisabled:", isSaveDraftDisabled, "details:", {
    isSubmitDisabled,
    workType,
    isPreviouslyDraft,
    hasJourneyModifications: hasJourneyModifications(),
  });

  const todayDateNum = new Date().getDate();

  const validateRoutePlanSubmit = () => {
    if (workType === "JOURNEY_MODIFICATION") return true;
    if (isManager && isViewingOwnPlan) return true;
    if (planBeat === "None") return false;

    // Daily mode only has today, which is validated by checkedVisitsCount
    if (planBeat === "Daily") {
      return true;
    }

    const today = new Date();
    const tomorrowZero = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );
    const { monthIndex, year } = parseMonthYear(selectedMonth || months[0]);

    // Weeks to validate
    const weeksToValidate = planBeat === "Weekly" ? [selectedWeek] : weeks;
    let missingDays = [];

    for (const wk of weeksToValidate) {
      const weekDays = getCalendarDaysForWeek(wk, selectedMonth || months[0]);
      for (const day of weekDays) {
        if (day.dayNum === null) continue;
        if (day.dayName === "SU") continue; // Sunday is optional

        const targetDate = new Date(year, monthIndex, day.dayNum);
        const isPastOrToday = targetDate < tomorrowZero;
        if (isPastOrToday) continue; // Skip past and today disabled dates

        const dateStr = `${year}-${String(monthIndex + 1).padStart(
          2,
          "0",
        )}-${String(day.dayNum).padStart(2, "0")}`;
        const plan = datePlans[dateStr];

        let hasVisits = false;
        if (plan && plan.selectedBeatId) {
          // Gather valid distributor & retailer account IDs for this beat
          const validIds = new Set<string>();
          mappings.forEach((m) => {
            if (m.Beat__c === plan.selectedBeatId) {
              if (m.Beat__r?.Distributor__c) {
                validIds.add(m.Beat__r.Distributor__c);
              }
              if (m.Account__c) {
                validIds.add(m.Account__c);
              }
            }
          });
          // Check if at least one distributor or retailer ID is checked
          hasVisits = Object.keys(plan.checkedItems).some(
            (id) => validIds.has(id) && plan.checkedItems[id] === true,
          );
        }

        if (!hasVisits) {
          missingDays.push({
            week: wk,
            dayName: day.dayName,
            dayNum: day.dayNum,
          });
        }
      }
    }

    if (missingDays.length > 0) {
      const firstMissing = missingDays[0];
      const errorMsg =
        planBeat === "Weekly"
          ? `Please select a distributor or retailer for Day ${firstMissing.dayNum} (${firstMissing.dayName}).`
          : `Please select a distributor or retailer for Day ${firstMissing.dayNum} in ${firstMissing.week}.`;

      dispatch(
        showToast({
          type: "error",
          message: errorMsg,
        }),
      );
      return false;
    }

    return true;
  };

  const sendCompositeRequestInChunks = async (chunks: any[][]) => {
    let successCount = 0;
    let failCount = 0;
    const allResponses: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const payload = {
        compositeRequest: chunk,
        allOrNone: true,
      };

      console.log(
        `Sending composite chunk ${i + 1} with ${chunk.length} requests...`,
      );
      try {
        const response = await apiComposite("POST", "composite", payload);
        console.log(`Composite Chunk Response:`, JSON.stringify(response));
        if (
          response.status === "success" ||
          (response.data && response.data.compositeResponse)
        ) {
          const subresponses = response.data?.compositeResponse || [];
          allResponses.push(...subresponses);
          const hasFailedSubrequest = subresponses.some(
            (r: any) => r.httpStatusCode < 200 || r.httpStatusCode >= 300,
          );
          if (hasFailedSubrequest) {
            console.error(
              "Composite Subrequest failure details:",
              JSON.stringify(subresponses),
            );
            subresponses.forEach((r: any) => {
              if (r.httpStatusCode < 200 || r.httpStatusCode >= 300) {
                const failedPayload = chunk.find((c: any) => c.referenceId === r.referenceId);
                console.error(
                  `[COMPOSITE SUBREQUEST ERROR DETAILED LOG]\n` +
                  `Reference ID: ${r.referenceId}\n` +
                  `Failed Request Object: ${JSON.stringify(failedPayload, null, 2)}\n` +
                  `Response Error Body: ${JSON.stringify(r.body, null, 2)}`
                );
              }
            });
            failCount += chunk.length;
          } else {
            successCount += chunk.length;
          }
        } else {
          failCount += chunk.length;
        }
      } catch (err) {
        console.error("Composite chunk execution failed:", err);
        failCount += chunk.length;
      }
    }

    return { successCount, failCount, responses: allResponses };
  };

  const closeAllDropdowns = () => {
    setShowBeatDropdown(false);
    setShowMonthDropdown(false);
    setShowWeekDropdown(false);
    setShowWorkTypeDropdown(false);
    setShowUserRoleDropdown(false);
    setShowManagerUserDropdown(false);
    setShowWorkingUserDropdown(false);
  };

  const handleBeatReassignPress = (dateStr: string, beatName: string, visits: any[]) => {
    let beatId = existingBeatDays[dateStr]?.beatId || null;
    if (!beatId) {
      const match = mappings.find(m => m.Beat__r?.Name === beatName || m.Name === beatName);
      beatId = match?.Beat__c || null;
    }

    const beatMapping = mappings.find(m => m.Beat__c === beatId);
    const distributorName = beatMapping?.Beat__r?.Distributor__r?.Name || "N/A";

    setReassignDateStr(dateStr);
    setReassignBeatName(beatName);
    setReassignDistributorName(distributorName);
    setReassignRetailers(visits.filter(v => v.type === "Retailer").map(v => v.name));
    setReassignBeatId(beatId);
    setReassignModalVisible(true);
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (validateRoutePlanSubmit()) {
      if (!routePlanId) {
        dispatch(
          showToast({
            type: "error",
            message: "No route plan ID found for this month.",
          }),
        );
        return;
      }

      // 1. Gather all Beat_Day__c POST and PATCH subrequests first
      const dateKeys = Object.keys(datePlans);
      const beatDayRequests: any[] = [];
      const statusValue = isDraft ? undefined : "Pending Approval";

      for (const dateStr of dateKeys) {
        const plan = datePlans[dateStr];
        const hasPlan =
          plan &&
          (plan.selectedBeatId ||
            Object.values(plan.checkedItems).some(Boolean));
        const existingRecord = existingBeatDays[dateStr];

        // Skip locked records to prevent changing their status (e.g. from Approved/Pending back to Draft)
        const isLocked = existingRecord && ["pending approval", "pending", "submitted", "approved"].includes(existingRecord.approvalStatus?.toLowerCase() || "");
        if (isLocked && workType !== "JOURNEY_MODIFICATION") {
          continue;
        }

        const beatDayRef = existingRecord
          ? `ref_update_BeatDay_${dateStr.replace(/-/g, "_")}`
          : `ref_create_BeatDay_${dateStr.replace(/-/g, "_")}`;

        if (hasPlan) {
          // If Beat Day doesn't exist, we must create (POST) it
          if (!existingRecord) {
            const reqBody: any = {
              Beat_Date__c: dateStr,
              Route_Plans__c: routePlanId,
              Beat__c: plan.selectedBeatId || null,
            };
            if (statusValue) {
              reqBody.Approval_Status__c = statusValue;
            }
            beatDayRequests.push({
              method: "POST",
              url: "/services/data/v61.0/sobjects/Beat_Day__c",
              referenceId: beatDayRef,
              body: reqBody,
            });
          } else {
            // If Beat Day exists, we update (PATCH) it (for both CREATE_ROUTE_PLAN and JOURNEY_MODIFICATION)
            const reqBody: any = {
              Beat__c: plan.selectedBeatId || null,
            };
            if (statusValue && workType !== "JOURNEY_MODIFICATION") {
              reqBody.Approval_Status__c = statusValue;
            }
            beatDayRequests.push({
              method: "PATCH",
              url: `/services/data/v61.0/sobjects/Beat_Day__c/${existingRecord.sfId}`,
              referenceId: beatDayRef,
              body: reqBody,
            });
          }
        } else {
          if (existingRecord && existingRecord.beatId !== null && workType !== "JOURNEY_MODIFICATION") {
            const reqBody: any = {
              Beat__c: null,
            };
            if (statusValue) {
              reqBody.Approval_Status__c = statusValue;
            }
            beatDayRequests.push({
              method: "PATCH",
              url: `/services/data/v61.0/sobjects/Beat_Day__c/${existingRecord.sfId}`,
              referenceId: beatDayRef,
              body: reqBody,
            });
          }
        }
      }

      // Precheck if there are any visit changes to make
      let hasVisitChanges = false;
      for (const dateStr of dateKeys) {
        const plan = datePlans[dateStr];
        const hasPlan =
          plan &&
          (plan.selectedBeatId ||
            Object.values(plan.checkedItems).some(Boolean));
        if (hasPlan) {
          const checkedItemKeys = Object.keys(plan.checkedItems).filter(
            (key) => plan.checkedItems[key] && key.startsWith("001"),
          );
          for (const itemId of checkedItemKeys) {
            const existingVisitId = existingVisits[dateStr]?.[itemId];
            const existingStatus =
              existingVisitsStatus[dateStr]?.[itemId];
            if (!existingVisitId || existingStatus === "Cancel") {
              hasVisitChanges = true;
              break;
            }
          }
        }
        if (hasVisitChanges) break;
      }

      // Check if statusValue has changed for any existing beat day
      let hasStatusChanges = false;
      if (statusValue) {
        for (const dateStr of dateKeys) {
          const plan = datePlans[dateStr];
          const hasPlan =
            plan &&
            (plan.selectedBeatId ||
              Object.values(plan.checkedItems).some(Boolean));
          const existingRecord = existingBeatDays[dateStr];
          if (hasPlan && existingRecord && existingRecord.approvalStatus !== statusValue) {
            hasStatusChanges = true;
            break;
          }
        }
      }

      const changesToSubmit =
        workType === "JOURNEY_MODIFICATION"
          ? hasJourneyModifications()
          : (beatDayRequests.length > 0 || hasVisitChanges || hasStatusChanges);

      if (!changesToSubmit) {
        dispatch(
          showToast({
            type: isDraft ? "info" : "success",
            message: isDraft ? "No changes to save as draft." : "No changes to submit.",
          }),
        );
        return;
      }

      setIsSubmitting(true);
      try {
        // Initialize resolved Beat Day IDs with pre-existing records
        const resolvedBeatDayIds: Record<string, string> = {};
        for (const dateStr of dateKeys) {
          const existingRecord = existingBeatDays[dateStr];
          if (existingRecord) {
            resolvedBeatDayIds[dateStr] = existingRecord.sfId;
          }
        }

        // Step 1: Submit Beat_Day__c requests first
        if (beatDayRequests.length > 0) {
          console.log("Beat Day Requests Payload to Submit:", JSON.stringify(beatDayRequests, null, 2));
          const beatDayChunks: any[][] = [];
          for (let i = 0; i < beatDayRequests.length; i += 25) {
            beatDayChunks.push(beatDayRequests.slice(i, i + 25));
          }

          const beatDayResult = await sendCompositeRequestInChunks(
            beatDayChunks,
          );

          if (beatDayResult.failCount > 0) {
            dispatch(
              showToast({
                type: "error",
                message:
                  "Beat Day submission failed. Skipping visits updates.",
              }),
            );
            setIsSubmitting(false);
            return;
          }

          // Map newly created Beat Day IDs from responses
          for (const dateStr of dateKeys) {
            if (!existingBeatDays[dateStr]) {
              const refId = `ref_create_BeatDay_${dateStr.replace(
                /-/g,
                "_",
              )}`;
              const match = beatDayResult.responses.find(
                (r) => r.referenceId === refId,
              );
              if (match && match.body && match.body.id) {
                resolvedBeatDayIds[dateStr] = match.body.id;
              }
            }
          }
        }

        // Step 2: Now construct Visit__c requests using actual resolved Beat Day IDs
        const visitRequests: any[] = [];
        for (const dateStr of dateKeys) {
          const plan = datePlans[dateStr];
          const hasPlan =
            plan &&
            (plan.selectedBeatId ||
              Object.values(plan.checkedItems).some(Boolean));
          const beatDayId = resolvedBeatDayIds[dateStr];

          // Skip locked records to prevent changing their visits
          const existingRecord = existingBeatDays[dateStr];
          const isLocked = existingRecord && ["pending approval", "pending", "submitted", "approved"].includes(existingRecord.approvalStatus?.toLowerCase() || "");
          if (isLocked && workType !== "JOURNEY_MODIFICATION") {
            continue;
          }

          if (hasPlan && beatDayId) {
            const checkedItemKeys = Object.keys(
              plan.checkedItems,
            ).filter(
              (key) => plan.checkedItems[key] && key.startsWith("001"),
            );
            checkedItemKeys.forEach((itemId) => {
              const existingVisitId = existingVisits[dateStr]?.[itemId];
              const existingStatus =
                existingVisitsStatus[dateStr]?.[itemId];

              if (!existingVisitId) {
                // Create (POST) Visit using the actual Beat Day ID
                visitRequests.push({
                  method: "POST",
                  url: "/services/data/v61.0/sobjects/Visit__c",
                  referenceId: `ref_create_Visit_${dateStr.replace(
                    /-/g,
                    "_",
                  )}_${itemId}`,
                  body: {
                    AccountId__c: itemId,
                    VisitDate__c: dateStr,
                    Visit_Mode__c: "In person",
                    VisitStatus__c: "Planned",
                    PJPOutlet__c: true,
                    BeatDay__c: beatDayId,
                    Beat__c: plan.selectedBeatId || null,
                  },
                });
              } else if (existingStatus === "Cancel") {
                // Re-plan (PATCH) Visit
                visitRequests.push({
                  method: "PATCH",
                  url: `/services/data/v61.0/sobjects/Visit__c/${existingVisitId}`,
                  referenceId: `ref_replan_Visit_${dateStr.replace(
                    /-/g,
                    "_",
                  )}_${existingVisitId}`,
                  body: {
                    VisitStatus__c: "Planned",
                    Cancel_Reason__c: null,
                  },
                });
              }
            });
          }

          // Process unchecked/removed visits (cancel/delete them)
          const existingVisitKeys = Object.keys(existingVisits[dateStr] || {});
          existingVisitKeys.forEach((itemId) => {
            const existingVisitId = existingVisits[dateStr]?.[itemId];
            const existingStatus = existingVisitsStatus[dateStr]?.[itemId];
            const isCurrentlyChecked = plan && plan.checkedItems[itemId];
            if (existingVisitId && !isCurrentlyChecked) {
              const isDraftOrPreviouslyDraft = isDraft || (existingRecord && existingRecord.approvalStatus?.toLowerCase() === "draft");
              if (workType === "JOURNEY_MODIFICATION" || isDraftOrPreviouslyDraft) {
                visitRequests.push({
                  method: "PATCH",
                  url: `/services/data/v61.0/sobjects/Visit__c/${existingVisitId}`,
                  referenceId: `ref_delete_Visit_${dateStr.replace(
                    /-/g,
                    "_",
                  )}_${existingVisitId}`,
                  body: {
                    Is_Deleted__c: true,
                  },
                });
              } else if (existingStatus !== "Cancel") {
                visitRequests.push({
                  method: "PATCH",
                  url: `/services/data/v61.0/sobjects/Visit__c/${existingVisitId}`,
                  referenceId: `ref_cancel_Visit_${dateStr.replace(
                    /-/g,
                    "_",
                  )}_${existingVisitId}`,
                  body: {
                    VisitStatus__c: "Cancel",
                    Cancel_Reason__c: "Journey Modification",
                  },
                });
              }
            }
          });
        }

        // Step 3: Submit Visit__c operations
        if (visitRequests.length > 0) {
          console.log("Visit Requests Payload to Submit:", JSON.stringify(visitRequests, null, 2));
          const visitChunks: any[][] = [];
          for (let i = 0; i < visitRequests.length; i += 25) {
            visitChunks.push(visitRequests.slice(i, i + 25));
          }

          const visitResult = await sendCompositeRequestInChunks(
            visitChunks,
          );

          if (visitResult.failCount === 0) {
            dispatch(
              showToast({
                type: isDraft ? "info" : "success",
                message: isDraft ? "Route plan saved as draft successfully!" : "Route plan and visits updated successfully!",
              }),
            );
            await fetchExistingBeatDaysAndVisits(); // Synchronize local state with Salesforce
          } else {
            dispatch(
              showToast({
                type: "error",
                message: `Beat Days updated, but visits synchronization failed. Sent: ${visitResult.successCount}, Failed: ${visitResult.failCount}.`,
              }),
            );
          }
        } else {
          dispatch(
            showToast({
              type: isDraft ? "info" : "success",
              message: isDraft ? "Route plan saved as draft successfully!" : "Route plan updated successfully!",
            }),
          );
          await fetchExistingBeatDaysAndVisits(); // Synchronize local state with Salesforce
        }
      } catch (err) {
        console.error("Submission failed:", err);
        dispatch(
          showToast({
            type: "error",
            message: "An unexpected error occurred during submission.",
          }),
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Dynamic Header & Planned Visit Section styled with Home Screen's Gradient */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={userName ? styles.userName : styles.userName}>
            {userName}
          </Text>
        </View>

        {/* Planned Visits Top Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{plannedBeatsCount}</Text>
            <Text style={styles.statLabel}>Planned</Text>
            <Text style={styles.statLabel}>Beat</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{checkedVisitsCount}</Text>
            <Text style={styles.statLabel}>Planned</Text>
            <Text style={styles.statLabel}>Visit</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Missed Stats Bar */}
      <View style={styles.missedStatsContainer}>
        {/* Left Column */}
        <View style={styles.missedColumnLeft}>
          <View style={styles.missedRowInline}>
            <Text style={styles.missedTextInlineLabel}>
              Missed Out Distributors
            </Text>
            <Text style={styles.missedTextInlineValue}>
              {missedDistributorsCount}
            </Text>
          </View>
          <View style={styles.missedRowInline}>
            <Text style={styles.missedTextInlineLabel}>
              Missed Out Retailer
            </Text>
            <Text style={styles.missedTextInlineValue}>
              {missedRetailersCount}
            </Text>
          </View>
        </View>

        {/* Right Column */}
        <View style={styles.missedColumnRight}>
          <View style={styles.missedRowInline}>
            <Text style={styles.missedTextInlineLabel}>Missed Out Beat</Text>
            <Text style={styles.missedTextInlineValue}>{missedBeatsCount}</Text>
          </View>
        </View>
      </View>

      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={100}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <View style={{ flex: 1 }}>
            {/* Manager Dropdowns */}
            {isManager && (
              <View style={[styles.dropdownSection, { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 16, marginBottom: 16 }]}>
                {/* SELECT WORK Dropdown */}
                <Text style={styles.dropdownLabel}>SELECT WORK</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    setShowWorkTypeDropdown(!showWorkTypeDropdown);
                    setShowUserRoleDropdown(false);
                    setShowManagerUserDropdown(false);
                    setShowWorkingUserDropdown(false);
                    setShowBeatDropdown(false);
                    setShowMonthDropdown(false);
                    setShowWeekDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownButtonText}>
                    {workType === "CREATE_ROUTE_PLAN"
                      ? "Create Route Plan"
                      : workType === "JOINT_WORKING"
                        ? "Joint Working"
                        : workType === "JOURNEY_MODIFICATION"
                          ? "Journey Modification"
                          : workType === "BEAT_REASSIGNMENT"
                            ? "Beat Reassignment"
                            : "Select Work"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
                {showWorkTypeDropdown && (
                  <View style={styles.dropdownList}>
                    {workTypeOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setWorkType(opt.value);
                          setShowWorkTypeDropdown(false);
                          setSelectedUserRole(null);
                          setSelectedManagerUser(null);
                          setSelectedWorkingUser(null);
                          setTargetRoutePlanId(null);
                          setExistingBeatDays({});
                          setExistingVisits({});
                          setExistingVisitsStatus({});
                          setDatePlans({});

                          if (opt.value === "JOINT_WORKING" || opt.value === "BEAT_REASSIGNMENT") {
                            setPlanBeat("Monthly");
                          } else {
                            setPlanBeat("None");
                          }
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* If Joint Working, Beat Reassignment, or Journey Modification is selected */}
                {(workType === "JOINT_WORKING" || workType === "JOURNEY_MODIFICATION" || workType === "BEAT_REASSIGNMENT") && (
                  <>
                    {/* RSM user needs "Select User Role" first */}
                    {userRole === "RSM" && (
                      <>
                        <Text style={[styles.dropdownLabel, { marginTop: 12 }]}>SELECT USER ROLE</Text>
                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => {
                            setShowUserRoleDropdown(!showUserRoleDropdown);
                            setShowWorkTypeDropdown(false);
                            setShowManagerUserDropdown(false);
                            setShowWorkingUserDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownButtonText}>
                            {selectedUserRole || "Select User Role"}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        {showUserRoleDropdown && (
                          <View style={styles.dropdownList}>
                            {(["ASM", "ASE", "SO", "ISR", "DSM"] as const).map((role) => (
                              <TouchableOpacity
                                key={role}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setSelectedUserRole(role);
                                  setShowUserRoleDropdown(false);
                                  setSelectedManagerUser(null);
                                  setSelectedWorkingUser(null);
                                  setTargetRoutePlanId(null);
                                  setExistingBeatDays({});
                                  setExistingVisits({});
                                  setExistingVisitsStatus({});
                                  setDatePlans({});
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{role}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </>
                    )}

                    {/* RSM: Intermediate manager list if ASM, ASE, or SO is selected */}
                    {userRole === "RSM" && ["ASM", "ASE", "SO"].includes(selectedUserRole || "") && (
                      <>
                        <Text style={[styles.dropdownLabel, { marginTop: 12 }]}>
                          SELECT {selectedUserRole}
                        </Text>
                        <TouchableOpacity
                          style={styles.dropdownButton}
                          onPress={() => {
                            setShowManagerUserDropdown(!showManagerUserDropdown);
                            setShowWorkTypeDropdown(false);
                            setShowUserRoleDropdown(false);
                            setShowWorkingUserDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownButtonText}>
                            {selectedManagerUser ? selectedManagerUser.Name : `Select ${selectedUserRole}`}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        {showManagerUserDropdown && (
                          <View style={[styles.dropdownList, { maxHeight: 200 }]}>
                            <ScrollView nestedScrollEnabled={true}>
                              {getSubUsers(auth?.userId || "", allUsers)
                                .filter((u) => getNormalizedRole(u.UserRole?.Name) === selectedUserRole)
                                .map((usr) => (
                                  <TouchableOpacity
                                    key={usr.Id}
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                      setSelectedManagerUser(usr);
                                      setShowManagerUserDropdown(false);
                                      setSelectedWorkingUser(usr); // Set directly as target user for manager roles
                                      setTargetRoutePlanId(null);
                                      setExistingBeatDays({});
                                      setExistingVisits({});
                                      setExistingVisitsStatus({});
                                      setDatePlans({});
                                    }}
                                  >
                                    <Text style={styles.dropdownItemText}>{usr.Name}</Text>
                                  </TouchableOpacity>
                                ))}
                            </ScrollView>
                          </View>
                        )}
                      </>
                    )}

                    {/* Target User dropdown (ISR / DSM) */}
                    {((userRole === "RSM" && (selectedUserRole === "ISR" || selectedUserRole === "DSM")) ||
                      (["ASM", "ASE", "SO"].includes(userRole))) && (
                        <>
                          <Text style={[styles.dropdownLabel, { marginTop: 12 }]}>
                            SELECT {userRole === "RSM" ? (["ISR", "DSM"].includes(selectedUserRole || "") ? selectedUserRole : "ISR / DSM") : "ISR / DSM"}
                          </Text>
                          <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => {
                              setShowWorkingUserDropdown(!showWorkingUserDropdown);
                              setShowWorkTypeDropdown(false);
                              setShowUserRoleDropdown(false);
                              setShowManagerUserDropdown(false);
                              setUserSearchQuery("");
                            }}
                          >
                            <Text style={styles.dropdownButtonText}>
                              {selectedWorkingUser ? selectedWorkingUser.Name : "Select Target User"}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                          </TouchableOpacity>
                          {showWorkingUserDropdown && (
                            <View style={[styles.dropdownList, { maxHeight: 250 }]}>
                              {/* Search bar inside user dropdown */}
                              <TextInput
                                style={styles.managerSearchInput}
                                placeholder="Search user..."
                                placeholderTextColor={Colors.textDisabled}
                                value={userSearchQuery}
                                onChangeText={setUserSearchQuery}
                              />
                              <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                {(() => {
                                  let list: any[] = [];
                                  if (userRole === "RSM") {
                                    if (selectedUserRole === "ISR" || selectedUserRole === "DSM") {
                                      // RSM selecting direct ISR/DSM under their entire sub-hierarchy
                                      const directReports = getSubUsers(auth?.userId || "", allUsers);
                                      list = directReports.filter((u) => getNormalizedRole(u.UserRole?.Name) === selectedUserRole);
                                    } else if (selectedManagerUser) {
                                      // RSM selecting ISR/DSM reporting under the selected ASM/ASE/SO manager
                                      const reports = getSubUsers(selectedManagerUser.Id, allUsers);
                                      list = reports.filter((u) => ["ISR", "DSM"].includes(getNormalizedRole(u.UserRole?.Name)));
                                    }
                                  } else {
                                    // ASM / ASE / SO directly selecting target users under their own hierarchy
                                    const reports = getSubUsers(auth?.userId || "", allUsers);
                                    list = reports.filter((u) => ["ISR", "DSM"].includes(getNormalizedRole(u.UserRole?.Name)));
                                  }

                                  const filtered = list.filter((u) => {
                                    const s = userSearchQuery.toLowerCase();
                                    return u.Name?.toLowerCase().includes(s);
                                  });

                                  if (filtered.length === 0) {
                                    return (
                                      <View style={{ padding: 12, alignItems: "center" }}>
                                        <Text style={{ color: Colors.textDisabled, fontSize: 13 }}>No ISR/DSM users found.</Text>
                                      </View>
                                    );
                                  }

                                  return filtered.map((usr) => (
                                    <TouchableOpacity
                                      key={usr.Id}
                                      style={styles.dropdownItem}
                                      onPress={() => {
                                        setSelectedWorkingUser(usr);
                                        setShowWorkingUserDropdown(false);
                                      }}
                                    >
                                      <Text style={styles.dropdownItemText}>
                                        {usr.Name} {usr.EmployeeCode__c ? `(${usr.EmployeeCode__c})` : ""}
                                      </Text>
                                    </TouchableOpacity>
                                  ));
                                })()}
                              </ScrollView>
                            </View>
                          )}
                        </>
                      )}
                  </>
                )}
              </View>
            )}

            {/* Dropdowns */}
            {(!isManager || workType === "CREATE_ROUTE_PLAN") && (
              <View style={styles.dropdownSection}>
                <Text style={styles.dropdownLabel}>PLAN BEAT</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    setShowBeatDropdown(!showBeatDropdown);
                    setShowMonthDropdown(false);
                    setShowWeekDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownButtonText}>{planBeat}</Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>

                {showBeatDropdown && (
                  <View style={styles.dropdownList}>
                    {beatOptions.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setPlanBeat(option);
                          setShowBeatDropdown(false);
                          if (option === "Daily") {
                            setSelectedMonth(months[0]);
                            setSelectedWeek(
                              getWeekNameForDay(new Date().getDate(), months[0]),
                            );
                          } else if (option === "Weekly") {
                            setSelectedMonth(months[0]);
                            setSelectedWeek(
                              getWeekNameForDay(new Date().getDate(), months[0]),
                            );
                          } else if (option === "Monthly") {
                            setSelectedMonth(months[0]);
                          }
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Conditional Month Dropdown (Visible for 'Monthly' and 'Weekly') */}
                {(planBeat === "Monthly" || planBeat === "Weekly") && (
                  <>
                    <Text style={[styles.dropdownLabel, { marginTop: 12 }]}>
                      SELECT MONTH
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => {
                        setShowMonthDropdown(!showMonthDropdown);
                        setShowWeekDropdown(false);
                        setShowBeatDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownButtonText}>
                        {selectedMonth || "Select Month"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>

                    {showMonthDropdown && (
                      <View style={[styles.dropdownList, { maxHeight: 150 }]}>
                        <ScrollView nestedScrollEnabled={true}>
                          {months.map((m, idx) => {
                            const isDisabled =
                              (planBeat === "Weekly" && idx !== 0) ||
                              (planBeat === "Monthly" && idx !== 0 && idx !== 1);

                            return (
                              <TouchableOpacity
                                key={m}
                                disabled={isDisabled}
                                style={[
                                  styles.dropdownItem,
                                  isDisabled && { opacity: 0.4 },
                                ]}
                                onPress={() => {
                                  setSelectedMonth(m);
                                  setShowMonthDropdown(false);
                                  const { monthIndex, year } = parseMonthYear(m);
                                  const daysInMonth = new Date(
                                    year,
                                    monthIndex + 1,
                                    0,
                                  ).getDate();
                                  const cappedDay = Math.min(
                                    new Date().getDate(),
                                    daysInMonth,
                                  );
                                  setSelectedWeek(getWeekNameForDay(cappedDay, m));
                                }}
                              >
                                <Text
                                  style={[
                                    styles.dropdownItemText,
                                    isDisabled && { color: "#aaa" },
                                  ]}
                                >
                                  {m}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}

                {/* Conditional Week Dropdown (Visible only for 'Weekly') */}
                {planBeat === "Weekly" && (
                  <>
                    <Text style={[styles.dropdownLabel, { marginTop: 12 }]}>
                      SELECT WEEK
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.dropdownButton,
                        !selectedMonth && styles.dropdownDisabled,
                      ]}
                      disabled={!selectedMonth}
                      onPress={() => {
                        setShowWeekDropdown(!showWeekDropdown);
                        setShowMonthDropdown(false);
                        setShowBeatDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownButtonText}>
                        {selectedWeek || "Select Week"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>

                    {showWeekDropdown && (
                      <View style={styles.dropdownList}>
                        {weeks.map((w) => {
                          const match = w.match(/\d+/);
                          const weekNum = match ? parseInt(match[0], 10) : 1;
                          const numWeeks = getNumberOfWeeksInMonth(
                            selectedMonth || months[0],
                          );
                          const isDisabled = weekNum > numWeeks;
                          return (
                            <TouchableOpacity
                              key={w}
                              style={[
                                styles.dropdownItem,
                                isDisabled && {
                                  opacity: 0.4,
                                  backgroundColor: "#F1EADB",
                                },
                              ]}
                              disabled={isDisabled}
                              onPress={() => {
                                setSelectedWeek(w);
                                setShowWeekDropdown(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{w}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Route Status Description - Commented Out
        <View style={styles.statusDescriptionContainer}>
          <Text style={styles.approvedTitle}>Route Plan Approved</Text>
          <Text style={styles.approvedSubtitle}>
            Approved visit dates are mapped on the calendar below.
          </Text>
        </View>
        */}

            {/* Calendar Section - Read Only Highlight Grid */}
            <View style={styles.calendarContainer}>
              <Text style={styles.calendarMonthHeader}>
                {selectedMonth || months[0]}
              </Text>

              <View style={styles.weekdayHeaderRow}>
                {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((d) => (
                  <Text key={d} style={styles.weekdayHeaderText}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Always display the full monthly calendar grid */}
              <View style={styles.gridContainer}>
                {fullMonthDays.map((item, index) => {
                  if (item.dayNum === null) {
                    return (
                      <View
                        key={`empty-grid-${index}`}
                        style={styles.gridDayBox}
                      >
                        <View
                          style={[
                            styles.dayNumContainer,
                            { backgroundColor: "transparent" },
                          ]}
                        />
                      </View>
                    );
                  }

                  const { monthIndex, year } = parseMonthYear(
                    selectedMonth || months[0],
                  );
                  const dateStr = `${year}-${String(monthIndex + 1).padStart(
                    2,
                    "0",
                  )}-${String(item.dayNum).padStart(2, "0")}`;
                  const isSelected = selectedDates.includes(dateStr);

                  const today = new Date();
                  const targetDate = new Date(year, monthIndex, item.dayNum);
                  const todayZero = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                  );
                  const tomorrowZero = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate() + 1,
                  );
                  const isPastOrToday = targetDate < tomorrowZero;
                  const isToday = targetDate.getTime() === todayZero.getTime();
                  const isTomorrow =
                    targetDate.getTime() === tomorrowZero.getTime();

                  const inWeek = isDayInSelectedWeek(
                    item.dayNum,
                    selectedWeek,
                    selectedMonth || months[0],
                  );

                  const isPast = targetDate < todayZero;

                  // Determine if disabled based on planBeat mode
                  let isCellDisabled = false;
                  if (workType === "JOURNEY_MODIFICATION") {
                    const existingRecord = existingBeatDays[dateStr];
                    const isApproved = !!(
                      existingRecord &&
                      existingRecord.approvalStatus?.toLowerCase() === "approved"
                    );
                    isCellDisabled = !selectedWorkingUser || isPast || isToday || !isApproved;
                  } else if (workType === "JOINT_WORKING" || workType === "BEAT_REASSIGNMENT") {
                    isCellDisabled = !selectedWorkingUser || isPast || !existingBeatDays[dateStr];
                  } else if (planBeat === "None") {
                    isCellDisabled = !(isManager && isViewingOwnPlan);
                  } else if (planBeat === "Daily") {
                    isCellDisabled = !isToday;
                  } else if (planBeat === "Weekly") {
                    isCellDisabled = isPastOrToday || !inWeek;
                  } else if (planBeat === "Monthly") {
                    isCellDisabled = isPastOrToday;
                  }

                  // Check if highlighted guide based on planBeat
                  let isHighlightedGuide = false;
                  if (workType === "JOURNEY_MODIFICATION") {
                    isHighlightedGuide = !isCellDisabled;
                  } else if (workType === "JOINT_WORKING" || workType === "BEAT_REASSIGNMENT") {
                    isHighlightedGuide = !isCellDisabled;
                  } else if (planBeat === "Weekly") {
                    isHighlightedGuide = !isCellDisabled;
                  } else if (planBeat === "Monthly") {
                    isHighlightedGuide = !isCellDisabled;
                  }

                  const existingRecord = existingBeatDays[dateStr];
                  const hasValidExistingBeat = !!(
                    existingRecord &&
                    existingRecord.beatId &&
                    mappings.some((m) => m.Beat__c === existingRecord.beatId)
                  );

                  const isPlanned =
                    (datePlans[dateStr] &&
                      (datePlans[dateStr].selectedBeatId ||
                        Object.values(datePlans[dateStr].checkedItems).some(
                          Boolean,
                        ))) ||
                    hasValidExistingBeat;

                  // Compute cell classes dynamically based on highlighted/selected status
                  let cellContainerStyle: any = [styles.dayNumContainer];
                  let cellTextStyle: any = [styles.dayNumText];

                  if (isSelected) {
                    cellContainerStyle.push(styles.selectedDayNumBg);
                    cellTextStyle.push(styles.selectedDayNumText);
                  } else if (
                    (isPlanned && !isCellDisabled) ||
                    !!existingBeatDays[dateStr]
                  ) {
                    cellContainerStyle.push(styles.selectedDateGreenBg);
                    cellTextStyle.push(styles.selectedDateGreenText);
                  } else if (isHighlightedGuide) {
                    cellContainerStyle.push(styles.highlightedDayNumBg);
                    cellTextStyle.push(styles.highlightedDayNumText);
                  } else if (isCellDisabled) {
                    cellTextStyle.push(styles.disabledDayNumText);
                  } else {
                    cellTextStyle.push(styles.dayNumText);
                  }

                  // Draw focus border outline around active selected date if it has visits
                  if (
                    isSelected &&
                    isPlanned &&
                    (!isCellDisabled || !!existingBeatDays[dateStr])
                  ) {
                    cellContainerStyle.push(styles.focusedDayBorder);
                  }

                  return (
                    <TouchableOpacity
                      key={`grid-day-${item.dayNum}`}
                      style={styles.gridDayBox}
                      onPress={() =>
                        item.dayNum && handleDatePress(item.dayNum)
                      }
                      disabled={isCellDisabled}
                      activeOpacity={0.7}
                    >
                      <View style={cellContainerStyle}>
                        <Text style={cellTextStyle}>{item.dayNum}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {focusedDate && existingBeatDays[focusedDate]?.approvalStatus && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: Colors.white,
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: 12,
                justifyContent: "space-between"
              }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textPrimary }}>Approval Status:</Text>
                {(() => {
                  const status = existingBeatDays[focusedDate].approvalStatus;
                  let bg = "#F5F5F7";
                  let border = "#D9D2C3";
                  let text = "#7A7266";
                  if (status === "Approved") {
                    bg = "#E3F1EA";
                    border = "#A5D6A7";
                    text = "#2E7D5B";
                  } else if (status === "Pending Approval" || status === "Pending") {
                    bg = "#FBEFD8";
                    border = "#FFB74D";
                    text = "#E65100";
                  } else if (status === "Rejected") {
                    bg = "#F9E5E3";
                    border = "#EF9A9A";
                    text = "#B3261E";
                  }
                  return (
                    <View style={{
                      backgroundColor: bg,
                      borderColor: border,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6
                    }}>
                      <Text style={{ color: text, fontWeight: "700", fontSize: 11 }}>{status}</Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Tabs Bar */}
            <View style={styles.tabsContainer}>
              {(["Beats", "Distributor", "Retailer"] as const).map((tab) => {
                const isActive = selectedTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.tabItem,
                      isActive && styles.activeTabItem,
                      !isCurrentTabEnabled && { opacity: 0.5 }
                    ]}
                    disabled={!isCurrentTabEnabled}
                    onPress={() => setSelectedTab(tab)}
                  >
                    <Text
                      style={[
                        styles.tabItemText,
                        isActive && styles.activeTabItemText,
                        !isCurrentTabEnabled && { color: Colors.textDisabled }
                      ]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, !isCurrentTabEnabled && { opacity: 0.6 }]}>
              <TextInput
                style={styles.searchInput}
                editable={isCurrentTabEnabled}
                placeholder={
                  selectedTab === "Beats"
                    ? "Search by Beat Name..."
                    : selectedTab === "Distributor"
                      ? "Search by Distributor Name..."
                      : "Search by Retailer Name..."
                }
                placeholderTextColor={Colors.textDisabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <Ionicons
                name="search"
                size={16}
                color={Colors.textDisabled}
                style={styles.searchIcon}
              />
            </View>

            {/* Existing Joint Working info if any */}
            {workType === "JOINT_WORKING" && focusedDate && existingBeatDays[focusedDate] && (
              (() => {
                const jwUser = existingBeatDays[focusedDate].jointWorkingUser;
                const jwReason = existingBeatDays[focusedDate].jointWorkingReason;
                if (jwUser) {
                  // Find the user's name
                  const isCurrentUser = jwUser === auth?.userId;
                  const mappedUser = allUsers.find(u => u.Id === jwUser || u.Sf_Id === jwUser);
                  const jwUserName = existingBeatDays[focusedDate].jointWorkingUserName || (isCurrentUser ? userName : (mappedUser ? mappedUser.Name : jwUser));
                  return (
                    <View style={[styles.jworkBadge, { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#E3F1EA", borderColor: "#A5D6A7" }]}>
                      <Text style={[styles.jworkBadgeText, { color: "#2E7D5B" }]}>✓ Joint Working Mapped</Text>
                      <Text style={styles.jworkReasonText}>Working Manager/User: {jwUserName}</Text>
                      {jwReason ? <Text style={styles.jworkReasonText}>Reason: {jwReason}</Text> : null}
                    </View>
                  );
                }
                return null;
              })()
            )}

            {workType === "JOINT_WORKING" && focusedDate && !existingBeatDays[focusedDate]?.jointWorkingUser && managerJointWorkings[focusedDate] && (
              <View style={[styles.jworkBadge, { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#F9E5E3", borderColor: "#EF9A9A", borderWidth: 1 }]}>
                <Text style={[styles.jworkBadgeText, { color: "#B3261E" }]}>⚠ Joint Work Conflict</Text>
                <Text style={styles.jworkReasonText}>You already have a joint working mapped on this date with: {managerJointWorkings[focusedDate].ownerName}.</Text>
                <Text style={styles.jworkReasonText}>You cannot map joint working with multiple users on the same date.</Text>
              </View>
            )}

            {/* List Section - Always visible but disabled/non-selectable when isCurrentTabEnabled is false */}
            <View
              style={[
                styles.listContainer,
                !isCurrentTabEnabled && { opacity: 0.6 },
              ]}
            >
              {loading ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text
                    style={{
                      marginTop: 10,
                      color: Colors.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    Fetching Beat Mappings...
                  </Text>
                </View>
              ) : (planBeat === "None" && workType !== "JOURNEY_MODIFICATION" && !(isManager && isViewingOwnPlan)) ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Please select a Plan Beat mode first
                  </Text>
                </View>
              ) : !focusedDate ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Please select a date from the calendar first
                  </Text>
                </View>
              ) : (focusedDate && existingBeatDays[focusedDate] && (
                ["pending approval", "pending", "submitted", "rejected"].includes(existingBeatDays[focusedDate].approvalStatus?.toLowerCase() || "")
              )) ? (
                <View style={{
                  padding: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: Colors.white,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginTop: 10
                }}>
                  <Ionicons name="lock-closed-outline" size={48} color={Colors.textDisabled} />
                  <Text style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.textPrimary,
                    marginTop: 12,
                    textAlign: "center"
                  }}>
                    Route Plan Locked
                  </Text>
                  <Text style={{
                    fontSize: 13,
                    color: Colors.textSecondary,
                    marginTop: 6,
                    textAlign: "center",
                    lineHeight: 18
                  }}>
                    {selectedWorkingUser ? `${selectedWorkingUser.Name}'s route plan status` : "Your route plan status"} for this date is{" "}
                    <Text style={{
                      fontWeight: "700",
                      color: existingBeatDays[focusedDate].approvalStatus === "Rejected" ? "#B3261E" : "#E65100"
                    }}>
                      {existingBeatDays[focusedDate].approvalStatus || "Pending Approval"}
                    </Text>
                    .
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: Colors.textDisabled,
                    marginTop: 4,
                    textAlign: "center"
                  }}>
                    It will be visible and active once approved by your manager.
                  </Text>
                </View>
              ) : selectedTab !== "Beats" && !selectedBeatId ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Please select a Beat first under the Beats tab
                  </Text>
                </View>
              ) : filteredItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No items found</Text>
                </View>
              ) : (
                (() => {
                  const displayItems = (workType === "JOINT_WORKING" || workType === "BEAT_REASSIGNMENT")
                    ? filteredItems.filter(item => item.checked)
                    : filteredItems;

                  if (displayItems.length === 0) {
                    return (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No planned items for this date</Text>
                      </View>
                    );
                  }

                  return displayItems.map((item) => {
                    const focusedDate = selectedDates[0];
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    const isFocusedDateToday = focusedDate === todayStr && planBeat !== "Daily";

                    const isItemDisabled =
                      workType === "JOINT_WORKING" ||
                      workType === "BEAT_REASSIGNMENT" ||
                      !isCurrentTabEnabled ||
                      (focusedDate && isFocusedDateToday) ||
                      (focusedDate &&
                        !!existingBeatDays[focusedDate] &&
                        !["draft", "rejected"].includes(existingBeatDays[focusedDate].approvalStatus?.toLowerCase() || "") &&
                        workType !== "JOURNEY_MODIFICATION") ||
                      (selectedTab === "Beats" && selectedBeatId !== null && selectedBeatId !== item.id && workType !== "JOURNEY_MODIFICATION");

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.listItemCard,
                          item.checked
                            ? styles.cardChecked
                            : styles.cardUnchecked,
                          isItemDisabled && {
                            borderColor: Colors.border,
                            opacity: (workType === "JOINT_WORKING" || workType === "BEAT_REASSIGNMENT") ? 1.0 : 0.6,
                          },
                        ]}
                        onPress={() => {
                          if (!isItemDisabled) {
                            toggleCheckbox(item.id);
                          }
                        }}
                        disabled={isItemDisabled}
                        activeOpacity={0.9}
                      >
                        {(workType !== "JOINT_WORKING" && workType !== "BEAT_REASSIGNMENT") && (
                          <View
                            style={[
                              styles.checkbox,
                              item.checked
                                ? styles.checkboxChecked
                                : styles.checkboxUnchecked,
                              isItemDisabled && { opacity: 0.5 },
                            ]}
                          >
                            {item.checked && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color={Colors.white}
                              />
                            )}
                          </View>
                        )}
                        <Text
                          style={[
                            styles.listItemText,
                            (isItemDisabled && workType !== "JOINT_WORKING" && workType !== "BEAT_REASSIGNMENT") && { color: Colors.textDisabled },
                          ]}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAwareScrollView>

      {/* Sticky Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.reviewBtn}
          activeOpacity={0.8}
          onPress={() => {
            if (planBeat === "Weekly") {
              setReviewSelectedWeek(selectedWeek as any);
            } else {
              setReviewSelectedWeek("All");
            }
            setReviewModalVisible(true);
          }}
        >
          <Ionicons
            name="eye-outline"
            size={16}
            color={Colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.reviewBtnText}>Review</Text>
        </TouchableOpacity>

        {(workType !== "JOINT_WORKING" && workType !== "BEAT_REASSIGNMENT") && (
          <>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                isSaveDraftDisabled && styles.disabledOpacity,
                !isSaveDraftDisabled && { borderColor: Colors.primary }
              ]}
              disabled={isSaveDraftDisabled}
              activeOpacity={0.8}
              onPress={async () => {
                await handleSubmit(true); // Save as Draft
              }}
            >
              <Ionicons
                name="save-outline"
                size={16}
                color={isSaveDraftDisabled ? Colors.textDisabled : Colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.saveBtnText, !isSaveDraftDisabled && { color: Colors.primary }]}>Save as Draft</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitDisabled && styles.disabledOpacity]}
              disabled={isSubmitDisabled}
              activeOpacity={0.8}
              onPress={async () => {
                await handleSubmit(false); // Save (Submit)
              }}
            >
              <Ionicons
                name="paper-plane"
                size={16}
                color={Colors.white}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.submitBtnText}>
                {workType === "JOURNEY_MODIFICATION" ? "Update" : "Submit"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {workType === "JOINT_WORKING" && (() => {
          const hasExistingJointWork = !!(focusedDate && existingBeatDays[focusedDate]?.jointWorkingUser);
          const hasConflictJointWork = !!(
            focusedDate &&
            managerJointWorkings[focusedDate] &&
            selectedWorkingUser &&
            (managerJointWorkings[focusedDate].ownerId || "").substring(0, 15) !== (selectedWorkingUser.Id || selectedWorkingUser.id || "").substring(0, 15)
          );
          const hasBeatDayCreated = !!(focusedDate && existingBeatDays[focusedDate]);
          const approvalStatus = focusedDate && existingBeatDays[focusedDate]?.approvalStatus?.toLowerCase();
          const isPlanLocked = ["pending approval", "pending", "submitted"].includes(approvalStatus || "");
          const isDisabled = !focusedDate || !selectedWorkingUser || !hasBeatDayCreated || isPlanLocked || hasExistingJointWork || hasConflictJointWork;
          return (
            <TouchableOpacity
              style={[styles.submitBtn, isDisabled && styles.disabledOpacity]}
              disabled={isDisabled}
              activeOpacity={0.8}
              onPress={() => {
                if (focusedDate && selectedWorkingUser && hasBeatDayCreated && !isPlanLocked && !hasExistingJointWork && !hasConflictJointWork) {
                  setActiveBeatDayForReason(focusedDate);
                  setIsBulkJointWorking(false);
                  setJointWorkingReason(existingBeatDays[focusedDate]?.jointWorkingReason || "");
                  setReasonModalVisible(true);
                }
              }}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={Colors.white}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.submitBtnText}>Joint Work</Text>
            </TouchableOpacity>
          );
        })()}

      </View>

      {isSubmitting && (
        <View style={styles.loaderOverlay}>
          <Spinner
            size={50}
            type="Wave"
            color="#C9A24D"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.loaderText}>Please wait...</Text>
        </View>
      )}

      {isFetchingData && (
        <View style={styles.loaderOverlay}>
          <Spinner
            size={50}
            type="Wave"
            color="#C9A24D"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.loaderText}>Please wait, data fetching...</Text>
        </View>
      )}

      <ReviewPlanModal
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        planBeat={planBeat}
        months={months}
        selectedMonth={selectedMonth}
        selectedWeek={selectedWeek}
        datePlans={datePlans}
        existingBeatDays={existingBeatDays}
        mappings={mappings}
        workType={workType}
        allUsers={allUsers}
        loggedInUserId={auth?.userId}
        userName={userName}
        managerJointWorkings={managerJointWorkings}
        selectedWorkingUserId={selectedWorkingUser?.Id || selectedWorkingUser?.id}
        onJointWorkPress={(dateStr) => {
          setActiveBeatDayForReason(dateStr);
          setIsBulkJointWorking(false);
          setJointWorkingReason(existingBeatDays[dateStr]?.jointWorkingReason || "");
          setReasonModalVisible(true);
        }}
        onBulkJointWorkPress={() => {
          setIsBulkJointWorking(true);
          setJointWorkingReason("");
          setReasonModalVisible(true);
        }}
      />

      {/* Joint Working Reason Collection Modal */}
      <Modal
        visible={reasonModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isBulkJointWorking ? "Joint Work for Entire Month" : `Joint Work for ${activeBeatDayForReason}`}
            </Text>
            <Text style={styles.modalSubtitle}>
              Please enter the reason for Joint Working.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason..."
              placeholderTextColor={Colors.textDisabled}
              value={jointWorkingReason}
              onChangeText={setJointWorkingReason}
              multiline={true}
              numberOfLines={4}
            />

            {isReasonSubmitting ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setReasonModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={async () => {
                    if (!jointWorkingReason.trim()) {
                      dispatch(
                        showToast({
                          type: "error",
                          message: "Reason is required.",
                        })
                      );
                      return;
                    }
                    setIsReasonSubmitting(true);
                    try {
                      const loggedInUserId = auth?.userId;
                      if (!loggedInUserId) return;

                      if (isBulkJointWorking) {
                        const today = new Date();
                        const todayZero = new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          today.getDate()
                        );

                        // Filter dateKeys to only include today/future dates and exclude days that already have joint working set
                        const dateKeys = Object.keys(existingBeatDays).filter((dateStr) => {
                          const parts = dateStr.split("-");
                          if (parts.length !== 3) return false;

                          const rec = existingBeatDays[dateStr];
                          if (rec && rec.jointWorkingUser) return false;

                          const targetDate = new Date(
                            parseInt(parts[0], 10),
                            parseInt(parts[1], 10) - 1,
                            parseInt(parts[2], 10)
                          );
                          return targetDate >= todayZero;
                        });

                        const finalDateKeys = dateKeys.filter((dateStr) => {
                          const jwOwner = managerJointWorkings?.[dateStr]?.ownerId;
                          const targetUser = selectedWorkingUser?.Id || selectedWorkingUser?.id;
                          if (jwOwner && targetUser && jwOwner.substring(0, 15) !== targetUser.substring(0, 15)) {
                            return false;
                          }
                          return true;
                        });

                        if (finalDateKeys.length === 0) {
                          dispatch(
                            showToast({
                              type: "error",
                              message: "No new future planned days to joint work.",
                            })
                          );
                          setIsReasonSubmitting(false);
                          return;
                        }

                        const requests = finalDateKeys.map((dateStr) => {
                          const rec = existingBeatDays[dateStr];
                          return {
                            method: "PATCH",
                            url: `/services/data/v61.0/sobjects/Beat_Day__c/${rec.sfId}`,
                            referenceId: `ref_jw_${dateStr.replace(/-/g, "_")}`,
                            body: {
                              Joint_Working_User__c: loggedInUserId,
                              Joint_Working_Reason__c: jointWorkingReason,
                            },
                          };
                        });

                        const chunks: any[][] = [];
                        for (let i = 0; i < requests.length; i += 25) {
                          chunks.push(requests.slice(i, i + 25));
                        }

                        const result = await sendCompositeRequestInChunks(chunks);
                        if (result.failCount === 0) {
                          dispatch(
                            showToast({
                              type: "success",
                              message: "Joint working marked successfully for all days.",
                            })
                          );
                          setReasonModalVisible(false);
                          setReviewModalVisible(false);
                          setJointWorkingReason("");
                          await fetchExistingBeatDaysAndVisits();
                        } else {
                          dispatch(
                            showToast({
                              type: "error",
                              message: `Some updates failed. Success: ${result.successCount}, Fail: ${result.failCount}`,
                            })
                          );
                        }
                      } else {
                        const beatDayRec = existingBeatDays[activeBeatDayForReason];
                        if (!beatDayRec) return;

                        const jwOwner = managerJointWorkings?.[activeBeatDayForReason]?.ownerId;
                        const targetUser = selectedWorkingUser?.Id || selectedWorkingUser?.id;
                        if (jwOwner && targetUser && jwOwner.substring(0, 15) !== targetUser.substring(0, 15)) {
                          dispatch(
                            showToast({
                              type: "error",
                              message: `You already have joint working mapped on this date with: ${managerJointWorkings[activeBeatDayForReason].ownerName}`,
                            })
                          );
                          setIsReasonSubmitting(false);
                          return;
                        }

                        const response = await apiFetch(
                          "PATCH",
                          `sobjects/Beat_Day__c/${beatDayRec.sfId}`,
                          {
                            Joint_Working_User__c: loggedInUserId,
                            Joint_Working_Reason__c: jointWorkingReason,
                          },
                          "SObjects"
                        );

                        if (response && response.status === "success") {
                          dispatch(
                            showToast({
                              type: "success",
                              message: "Joint working marked successfully.",
                            })
                          );
                          setReasonModalVisible(false);
                          setJointWorkingReason("");
                          await fetchExistingBeatDaysAndVisits();
                        } else {
                          console.error("PATCH failed:", response);
                          dispatch(
                            showToast({
                              type: "error",
                              message: "Failed to mark Joint Working.",
                            })
                          );
                        }
                      }
                    } catch (error) {
                      console.error("Error submitting joint working:", error);
                      dispatch(
                        showToast({
                          type: "error",
                          message: "An error occurred.",
                        })
                      );
                    } finally {
                      setIsReasonSubmitting(false);
                    }
                  }}
                >
                  <Text style={styles.modalConfirmBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Beat Reassignment Request Modal */}
      <Modal
        visible={reassignModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReassignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Beat Reassignment Request</Text>
            <Text style={styles.modalSubtitle}>Please review the details below before submitting to the admin.</Text>

            <View style={{ marginVertical: 12, width: '100%' }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: Colors.textSecondary }}>USER NAME:</Text>
                <Text style={{ fontSize: 14, color: Colors.textPrimary }}>{selectedWorkingUser?.Name || 'N/A'}</Text>
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: Colors.textSecondary }}>BEAT NAME:</Text>
                <Text style={{ fontSize: 14, color: Colors.textPrimary }}>{reassignBeatName || 'N/A'}</Text>
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: Colors.textSecondary }}>DISTRIBUTOR:</Text>
                <Text style={{ fontSize: 14, color: Colors.textPrimary }}>{reassignDistributorName || 'N/A'}</Text>
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: Colors.textSecondary }}>RETAILERS:</Text>
                {reassignRetailers && reassignRetailers.length > 0 ? (
                  reassignRetailers.map((retName, idx) => (
                    <Text key={idx} style={{ fontSize: 14, color: Colors.textPrimary }}>• {retName}</Text>
                  ))
                ) : (
                  <Text style={{ fontSize: 14, color: Colors.textPrimary }}>No Retailers</Text>
                )}
              </View>
            </View>

            {isReassignSubmitting ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setReassignModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={async () => {
                    setIsReassignSubmitting(true);
                    try {
                      const payload = {
                        User__c: selectedWorkingUser?.Id || selectedWorkingUser?.Sf_Id || "",
                        Beat_Name__c: reassignBeatName || "",
                        Distributor_Name__c: reassignDistributorName || "",
                        Retailers__c: reassignRetailers ? reassignRetailers.join(", ") : "",
                        Requested_By__c: auth?.userId || "",
                        Date__c: reassignDateStr || "",
                        Status__c: "Pending"
                      };
                      console.log("Submitting Beat Reassignment with payload:", payload);
                      const response = await apiFetch(
                        "POST",
                        "sobjects/Beat_Reassignment_Request__c",
                        payload,
                        "SObjects"
                      );
                      if (response && response.status === "success") {
                        dispatch(
                          showToast({
                            message: "Beat Reassignment request submitted successfully!",
                            type: "success",
                          })
                        );
                        setReassignModalVisible(false);
                        setReviewModalVisible(false);
                      } else {
                        console.error("Post failed:", response);
                        dispatch(
                          showToast({
                            message: "Failed to submit Beat Reassignment request.",
                            type: "error",
                          })
                        );
                      }
                    } catch (error) {
                      console.error("Error submitting reassignment request:", error);
                      dispatch(
                        showToast({
                          message: "An error occurred.",
                          type: "error",
                        })
                      );
                    } finally {
                      setIsReassignSubmitting(false);
                    }
                  }}
                >
                  <Text style={styles.modalConfirmBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 245, 245, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loaderText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    color: Colors.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  userName: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "transparent",
    paddingBottom: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: -10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.primaryLight,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  missedStatsContainer: {
    flexDirection: "row",
    backgroundColor: Colors.primaryUltraLight, // Keeping original warm light red/pink background color
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  missedColumnLeft: {
    flex: 1.2,
    marginRight: 16,
  },
  missedColumnRight: {
    flex: 1,
  },
  missedRowInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  missedTextInlineLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "500",
  },
  missedTextInlineValue: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  dropdownSection: {
    marginBottom: 16,
    position: "relative",
    zIndex: 99,
  },
  dropdownLabel: {
    color: "black",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.white,
  },
  dropdownButtonText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  dropdownDisabled: {
    opacity: 0.5,
    backgroundColor: "#F1EADB",
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: Colors.white,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dropdownItemText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  placeholderCalendar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placeholderCalendarText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  calendarContainer: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginBottom: 16,
  },
  calendarMonthHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 10,
  },
  weekdayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  weekdayHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridDayBox: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  dayBox: {
    alignItems: "center",
    width: width / 8.5,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  selectedDayNameText: {
    color: Colors.primary,
  },
  dayNumContainer: {
    width: 28,
    height: 28,
    borderRadius: 14, // 50% of height and width in px
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
  },
  selectedDayNumBg: {
    backgroundColor: Colors.primary,
  },
  selectedDateGreenBg: {
    backgroundColor: "#a5d6a7",
  },
  selectedDateGreenText: {
    color: "#1b5e20",
    fontWeight: "700",
  },
  highlightedDayNumBg: {
    backgroundColor: Colors.primaryUltraLight,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  dayNumText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  selectedDayNumText: {
    color: Colors.white,
  },
  highlightedDayNumText: {
    color: Colors.primary,
  },
  disabledDayNumText: {
    color: Colors.textDisabled,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryUltraLight,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  infoBannerText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  visitsHighlightBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primaryUltraLight,
    borderColor: Colors.primaryLight,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  highlightBoxDisabled: {
    backgroundColor: "#F1EADB",
    borderColor: Colors.border,
  },
  visitsHighlightDate: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  visitsHighlightCount: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "700",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#F1EADB", // Darker background for the tabs bar
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTabItem: {
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabItemText: {
    fontSize: 13,
    color: "#7A7266", // Darker text for inactive tab items
    fontWeight: "600",
  },
  activeTabItemText: {
    color: Colors.primary, // Red primary color for active tab text
    fontWeight: "700",
  },
  disabledOpacity: {
    opacity: 0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
    backgroundColor: Colors.white,
  },
  searchInput: {
    flex: 1,
    height: 32,
    fontSize: 12,
    color: Colors.textPrimary,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  searchIcon: {
    marginLeft: 6,
  },
  infoContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  listContainer: {
    marginBottom: 16,
  },
  listItemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: Colors.white,
  },
  cardChecked: {
    borderColor: Colors.primary,
  },
  cardUnchecked: {
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkboxUnchecked: {
    borderWidth: 1,
    borderColor: Colors.textDisabled,
    backgroundColor: Colors.white,
  },
  listItemText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: {
    color: Colors.textDisabled,
    fontSize: 13,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  reviewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: Colors.primaryUltraLight,
  },
  reviewBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  saveBtnText: {
    color: Colors.textDisabled,
    fontSize: 12,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: "100%",
    maxHeight: "80%",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: "center",
  },
  picklistContainer: {
    marginBottom: 20,
  },
  picklistOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    backgroundColor: Colors.background,
  },
  picklistOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryUltraLight,
  },
  picklistOptionText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  picklistOptionTextSelected: {
    fontWeight: "600",
    color: Colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    backgroundColor: Colors.white,
  },
  modalCancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: Colors.primary,
  },
  modalConfirmBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  managerDropdownContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: Colors.white,
  },
  managerSearchInput: {
    height: 36,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  reasonInput: {
    height: 80,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    marginVertical: 12,
    color: Colors.textPrimary,
    fontSize: 13,
    textAlignVertical: "top",
  },
  jworkBadge: {
    backgroundColor: "#E3F1EA",
    borderColor: "#4CAF50",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 6,
  },
  jworkBadgeText: {
    color: "#2E7D5B",
    fontSize: 13,
    fontWeight: "700",
  },
  jworkReasonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  focusedDayBorder: {
    borderWidth: 2,
    borderColor: "#C9A24D",
  },
});
