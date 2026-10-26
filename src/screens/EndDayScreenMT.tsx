import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ToastAndroid,
  Modal
} from 'react-native';
import AntDesign from "../components/AntDesign";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Spinner from 'react-native-spinkit';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Feather from '@react-native-vector-icons/feather';
import IonIcons from "../components/Ionicons";
import LinearGradient from 'react-native-linear-gradient';
import { Gradients } from "../assets/css/MasterCss";
import RippleBackground from '../components/RippleBackground';
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
// import { handleLogoutFun } from '../utils/apiFetchHooks/handleLogoutFun';
import { store } from '../redux/store';
import { isInternetAvailable } from '../utils/networkUtils';
import { showToast } from '../redux/slices/toastSlice';
import { useDispatch } from 'react-redux';
import EndDayModal from './EndDayModal';
import { syncAttendanceRecords, syncMTExceptionRecord, syncGrowthMappingEntryRecord, syncBeatDayRecord, syncVisitRecord, syncOrderRecord, syncOrderItemRecord, syncCollectionRecord, syncCollectionAllocationRecord, syncInvoiceRecord, syncInvoiceItemRecord, syncAccountRecord, syncFormJsonecord, syncCompetitorRecord, syncStockCheckRecord, syncSalaryAcknowledgementRecord, syncHNTCompetitorPriceRecord, syncGamificationTransactionRecord } from '../database/dbService/AllDataSync';
import { persistor } from '../redux/store';
import { logout } from "../redux/slices/authSlice";
import { CLEAR_TABLES } from '../../config'
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatUnitsWithCases, formatCasesWithUnits, unitsToCases } from "../utils/helper/caseUnits";

const formatDateAndTime = (rawValue) => {
  if (!rawValue) return '';

  // Remove any wrapping quotes or leading/trailing spaces
  const isoString = String(rawValue).trim().replace(/^"+|"+$/g, '');

  // Moment will parse both +0000 and Z formats
  const m = moment(isoString).local();   // convert to device’s local time

  return m.isValid() ? m.format('D MMM YY, h:mm A') : isoString;
}


const ICON_MAP = {
  'Total Visits': { pack: 'AntDesign', name: 'profile', color: '#1862D8' },
  'Spot Sales Placed': { pack: 'Feather', name: 'check-circle', color: '#2C69E5' },
  'Pending Spot Sales': { pack: 'Feather', name: 'clock', color: '#2C69E5' },
  'Cancelled Visits': { pack: 'AntDesign', name: 'closecircle', color: '#2C69E5' },
  // fallback key
  default: { pack: 'AntDesign', name: 'infocirlce', color: '#888' },
};

function renderIconForLabel(label, size = 16) {
  const cfg = ICON_MAP[label] || ICON_MAP.default;
  if (cfg.pack === 'AntDesign') return <AntDesign name={cfg.name} size={size} color={cfg.color} />;
  if (cfg.pack === 'MaterialIcons') return <MaterialIcons name={cfg.name} size={size} color={cfg.color} />;
  if (cfg.pack === 'Feather') return <Feather name={cfg.name} size={size} color={cfg.color} />;
  return <AntDesign name="infocirlce" size={size} color={cfg.color} />;
}

const StatCard = ({ label, value }) => (
  <View style={styles.statCard}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={styles.statLabel}>{label}</Text>
      {/* render appropriate icon */}
      {renderIconForLabel(label, 18)}
    </View>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);


const Badge = ({ text, type }) => {
  const bg = type === 'Completed' || type === 'Check Out' ? '#CDF7DD' : type === 'Pending' ? '#FFECC2' : '#E6F0FF';
  const color = type === 'Completed' || type === 'Check Out' ? '#0B8A3E' : type === 'Pending' ? '#C97F00' : '#1E3A8A';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
};

const OrderAccordion = ({ order }) => {
  const [open, setOpen] = useState(false);

  console.log("THISIS THE ORDERL:::::::::::::", order)
  return (
    <View style={styles.orderWrap}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.orderHeader} activeOpacity={0.8}>
        <View>
          <Text style={styles.orderTitle}>{order.OrderNumber}</Text>
          <Text style={styles.orderCustomer}>{moment(order?.CreatedDate?.split('T')[0], 'YYYY-MM-DD').format('DD MMM YYYY')} </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.orderAmount}>₹{order?.TotalAmount?.toLocaleString()}</Text>
          <Text style={styles.chev}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.orderItemsContainer}>
          {/* Heading row */}
          {/* <Text style={{ fontSize: 11, color: 'white', backgroundColor: '#5191E5', alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6, fontWeight: 'bold', borderRadius: 4 }}>Items</Text> */}
          <View style={[styles.row, styles.itemsHeader]}>
            <Text style={[styles.cell, { flex: 3, color: 'gray', fontWeight: 'bold', fontSize: 11 }]}>Name</Text>
            <Text style={[styles.cell, { flex: 2, color: 'gray', fontWeight: 'bold', fontSize: 11, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.cell, { flex: 2, color: 'gray', fontWeight: 'bold', fontSize: 11, textAlign: 'right' }]}>Rate</Text>
          </View>

          {order.items.map((it, idx) => (
            <View key={idx} style={[styles.row, idx % 2 === 0 ? styles.rowAlt : null]}>
              <Text style={[styles.cell, { flex: 3, fontWeight: '600' }]}>{it.productName}</Text>
              <Text style={[styles.cell, { flex: 2, textAlign: 'center', fontSize: 11 }]}>{String(it?.UOM__c || '').toLowerCase() === 'box' ? formatCasesWithUnits(it?.Quantity || 0, 'Box') : formatUnitsWithCases(it?.Quantity || 0, 'Pcs')}</Text>
              <Text style={[styles.cell, { flex: 2, textAlign: 'right' }]}>₹{it?.NetAmount__c?.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const VisitAccordion = ({ visit }) => {
  const [open, setOpen] = useState(false);


  let badgeType = '';
  if (visit.CheckInTime__c && visit.CheckOutTime__c) {
    badgeType = 'Check Out';
  } else if (
    (visit.CheckInTime__c && !visit.CheckOutTime__c) ||
    visit.VisitStatus__c === "Check In"
  ) {
    badgeType = 'Check In';
  }


  return (
    <View style={styles.visitWrap}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.visitHeader} activeOpacity={0.8}>
        <View>
          {/* {console.log('item.chekin time', visit.CheckInTime__c)} */}
          <Text style={styles.visitTitle}>{visit.title} <Text style={{ fontSize: 11 }}>{visit.code ? ' (#' + visit.code + ')' : ''}</Text></Text>
          <Text style={styles.visitTime}>{formatDateAndTime(visit.CheckInTime__c)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>


            {badgeType ? (
              <Badge text={badgeType} type={badgeType} />
            ) : null}

          </View>
          {/* <Text style={styles.chev}>{open ? '▲' : '▼'}</Text> */}
        </View>
      </TouchableOpacity>


    </View>
  );
};

export default function EndDaySummaryScreen() {

  const dispatch = useDispatch()
  const [userFromDbState, setUserFromDbState] = useState({});
  const dateNow = moment().format("YYYY-MM-DD");
  const navigation = useNavigation();
  const [selectedBeatName, setSelectedBeatName] = useState(null);
  const [selectedBeatId, setSelecteBeatId] = useState(null);
  const [beatDaysId, setBeatDaysId] = useState(null);
  const [filteredVisits, setFilteredVisits] = useState([]);
  const [unvisitedVisitsState, setUnvisitedVisitsState] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [latestVisitState, setLatestVisitState] = useState(null);
  const [latestBeatDayState, setLatestBeatDayState] = useState(null);
  const [categorizedData, setCategorizedData] = useState({ Upcoming: [], "Check In": [], "Check Out": [] });
  const [ordersPlacedCountTotal, setOrdersPlacedCountTotal] = useState(0);
  const [totalpscCount, setTotalpscCount] = useState(0);
  // const [dateStore, setDateStore] = useState(dateNow);
  const [stats, setStats] = useState([
    { key: 'Total Visits', value: 0 },

    { key: 'Pending Spot Sales', value: 0 },

  ]);
  const { apiFetch, apiComposite } = useApiFetch();

  const countPJPOutletTrue = (data) => {
    const completedCount = data["Check Out"].filter(item => item.PJPOutlet__c === true).length;
    const inProgressCount = data["Check In"].filter(item => item.PJPOutlet__c === true).length;
    return completedCount + inProgressCount;
  }
  const calculateOrderPercentage = (orderCount, data) => {
    const upcomingVisits = data.Upcoming.length;
    const inProgressVisits = data["Check In"].length;
    const completedVisits = data["Check Out"].length;
    const totalVisits = upcomingVisits + inProgressVisits + completedVisits;
    if (totalVisits === 0) return 0;
    const percentage = (orderCount / totalVisits) * 100;
    return percentage.toFixed(2);
  }
  const getCurrentDateTimeString = () => {
    const now = new Date();
    // Example format: "2025-09-15 13:45:30"
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  const getTimeSpentOnField = async () => {
    try {
      const result = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      const today = moment().format("YYYY-MM-DD");
      const userId = result[0]?.Sf_Id;
      const attendanceRecords = await UniversalUpdateInsert({
        ObjectName: "Attendant__c",
        Type: "get",
      });
      const todayAttendanceRecords = attendanceRecords.filter(
        (record) => record.AttendanceDate__c === today
      );
      const userTodayAttendance = todayAttendanceRecords.filter(
        (record) => record.User__c === userId
      );
      //  console.log("🙋‍♂️ User's attendance for today:", userTodayAttendance);
      if (userTodayAttendance.length === 0) {
        // No attendance → Show modal (true case)
      } else {
        // Attendance exists → Don't show modal (false case)
        const startTime = userTodayAttendance[0]?.StartTime__c;
        const timeDifferenceInMinutes = moment().diff(moment(startTime), 'minutes', true);
        return Number(timeDifferenceInMinutes.toFixed(2));
      }
    } catch (err) {
      console.error("Error checking attendance:", err);
      return 0;
    }
  }
  const calculateTimeSpentonField = (data) => {
    let totalMinutes = 0;
    data.Completed.forEach(record => {
      const checkIn = record.CheckInTime__c?.replace(/"/g, '');  // Remove extra quotes if any
      const checkOut = record.CheckOutTime__c?.replace(/"/g, '');
      if (checkIn && checkOut) {
        const minutes = moment(checkOut).diff(moment(checkIn), 'minutes', true);
        totalMinutes += minutes;
      }
    });
    // Process In Progress records
    data["In Progress"].forEach(record => {
      const checkIn = record.CheckInTime__c?.replace(/"/g, '');  // Remove extra quotes if any
      if (checkIn) {
        const minutes = moment().diff(moment(checkIn), 'minutes', true);
        totalMinutes += minutes;
      }
    });
    return Number(totalMinutes.toFixed(2));
  }
  const calculateAverageTimeSpent = (data, totalVisitCount) => {
    let totalMinutes = 0;
    // Process Completed records
    data.Completed.forEach(record => {
      const checkIn = record.CheckInTime__c?.replace(/"/g, '');
      const checkOut = record.CheckOutTime__c?.replace(/"/g, '');
      if (checkIn && checkOut) {
        const minutes = moment(checkOut).diff(moment(checkIn), 'minutes', true);
        totalMinutes += minutes;
      }
    });
    // Process In Progress records
    data["In Progress"].forEach(record => {
      const checkIn = record.CheckInTime__c?.replace(/"/g, '');
      if (checkIn) {
        const minutes = moment().diff(moment(checkIn), 'minutes', true);
        totalMinutes += minutes;
      }
    });
    const averageMinutes = totalVisitCount > 0 ? (totalMinutes / totalVisitCount) : 0;
    const avgTimeString = `${averageMinutes.toFixed(2)} min`;
    return avgTimeString;
  };
  const calculateAverageProductiveCallTime = (data) => {
    let totalMinutes = 0;
    let productiveCallCount = 0;
    // Process Completed records
    data.Completed.forEach(record => {
      if (record.ProductiveCall__c === true) {
        const checkIn = record.CheckInTime__c?.replace(/"/g, '');
        const checkOut = record.CheckOutTime__c?.replace(/"/g, '');
        if (checkIn && checkOut) {
          const minutes = moment(checkOut).diff(moment(checkIn), 'minutes', true);
          totalMinutes += minutes;
          productiveCallCount += 1;
        }
      }
    });
    // Process In Progress records
    data["In Progress"].forEach(record => {
      if (record.ProductiveCall__c === true) {
        const checkIn = record.CheckInTime__c?.replace(/"/g, '');
        if (checkIn) {
          const minutes = moment().diff(moment(checkIn), 'minutes', true);
          totalMinutes += minutes;
          productiveCallCount += 1;
        }
      }
    });
    // Calculate average (avoid division by zero)
    const averageMinutes = productiveCallCount > 0 ? (totalMinutes / productiveCallCount) : 0;
    const avgTimeString = `${averageMinutes.toFixed(2)} min`;
    return avgTimeString;
  };
  const countNonPjpOutletRecords = (data) => {
    let count = 0;
    // Count in Upcoming
    data.Upcoming.forEach(record => {
      if (record.NonPjpOutlet__c === true) {
        count += 1;
      }
    });
    // Count in Completed
    data.Completed.forEach(record => {
      if (record.NonPjpOutlet__c === true) {
        count += 1;
      }
    });
    // Count in In Progress
    data["In Progress"].forEach(record => {
      if (record.NonPjpOutlet__c === true) {
        count += 1;
      }
    });
    return count;
  };
  const countNonPjpOutletRecordscheckin = (data) => {
    let count = 0;
    // Count in Completed
    data.Completed.forEach(record => {
      if (record.NonPjpOutlet__c === true) {
        count += 1;
      }
    });
    // Count in In Progress
    data["In Progress"].forEach(record => {
      if (record.NonPjpOutlet__c === true) {
        count += 1;
      }
    });
    return count;
  };
  const countNonPjpAndProductiveCalls = (data) => {
    let count = 0;
    // Count in Completed
    data.Completed.forEach(record => {
      if (record.NonPjpOutlet__c === true && record.ProductiveCall__c === true) {
        count += 1;
      }
    });
    // Count in In Progress
    data["In Progress"].forEach(record => {
      if (record.NonPjpOutlet__c === true && record.ProductiveCall__c === true) {
        count += 1;
      }
    });
    return count;
  };
  const getTotalDistanceTravelled = (data) => {
    let totalDistance = 0;
    const sumDistances = (records) => {
      records.forEach(record => {
        const distance = parseFloat(record.DistanceTravelledKm__c) || 0;
        totalDistance += distance;
      });
    };
    sumDistances(data.Upcoming);
    sumDistances(data["In Progress"]);
    sumDistances(data.Completed);

    return parseFloat(totalDistance.toFixed(2));  // Number with 2 decimal places
  };
  const countProductiveCalls = (data) => {
    let count = 0;
    const countTrue = (records) => {
      records.forEach(record => {
        if (record.ProductiveCall__c === true) {
          count++;
        }
      });
    };
    countTrue(data.Upcoming);
    countTrue(data["In Progress"]);
    countTrue(data.Completed);
    return count;
  }
  const countNONProductiveCalls = (data) => {
    let count = 0;
    const countTrue = (records) => {
      records.forEach(record => {
        if (record.ProductiveCall__c === false) {
          count++;
        }
      });
    };
    countTrue(data.Upcoming);
    countTrue(data["In Progress"]);
    countTrue(data.Completed);
    return count;
  }
  const countTrueByField = (data, fieldName) => {
    let count = 0;
    const countField = (records) => {
      records.forEach(record => {
        if (record[fieldName] === true) {
          count++;
        }
      });
    };
    countField(data.Upcoming);
    countField(data["In Progress"]);
    countField(data.Completed);
    return count;
  }
  const Planned_Outlets_Coverage_get = async (completedLength) => {
    const BeatDaydata = await UniversalUpdateInsert({
      ObjectName: "BeatDay__c",
      Type: "get",
      filters: [
        { field: 'Sf_Id', value: latestVisitState?.BeatDay__c },
      ],
    });
    console.log(BeatDaydata[0].PlannedOutlets__c)
    const PlannedOutlets = BeatDaydata[0]?.PlannedOutlets__c ?? 0;
    if (PlannedOutlets === 0) return 0;
    const coverage = (completedLength / PlannedOutlets) * 100;
    return coverage;
  };
  const SecondaryOrderQuantityInValue_get = () => {
    let total = 0;
    filteredVisits.forEach(visit => {
      if (visit.orders && Array.isArray(visit.orders)) {
        visit.orders.forEach(order => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              total += Number(item.GrossAmount__c) || 0;
            });
          }
        });
      }
    });
    return total;
  };
  const SecondaryOrderQuantityInKG_get = () => {
    let total = 0;
    filteredVisits.forEach(visit => {
      if (visit.orders && Array.isArray(visit.orders)) {
        visit.orders.forEach(order => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              total += Number(item.Order_Quantity_In_Kg__c) || 0;
            });
          }
        });
      }
    });
    return total;
  };







  const validateCanEndDay = async () => {
    const today = moment().format("YYYY-MM-DD");
    const endDayMarkerKey = `end_day_completed_${today}`;
    if ((await AsyncStorage.getItem(endDayMarkerKey)) === "true") {
      dispatch(showToast({ message: "End Day has already been completed for today.", type: "warning" }));
      return { canEnd: false };
    }

    let currentLatestVisit = latestVisitState;
    let currentLatestBeatDay = latestBeatDayState;
    let currentCategorizedData = categorizedData;
    let currentRawVisits = [];
    let completedVisitCount = 0;
    const refreshed = await fetchData();
    if (refreshed) {
      currentLatestVisit = refreshed.latestVisit || currentLatestVisit;
      currentLatestBeatDay = refreshed.latestBeatDay || currentLatestBeatDay;
      currentCategorizedData = refreshed.prepared || currentCategorizedData;
      currentRawVisits = refreshed.rawVisits || [];
      completedVisitCount = refreshed.completedVisitCount || 0;
    }

    const locallyStoredVisits = (await UniversalUpdateInsert({ ObjectName: "Visit", Type: "get" })) || [];
    const locallyStoredBeatDays = (await UniversalUpdateInsert({ ObjectName: "BeatDay__c", Type: "get" })) || [];
    const beatDayDate = (b) => String(b?.Beat_Date__c || b?.BeatDate__c || "").slice(0, 10);
    const activeLocalBeatDay = currentLatestBeatDay || locallyStoredBeatDays.find((b) =>
      (beatDaysId && b?.Sf_Id === beatDaysId) ||
      (currentLatestVisit?.BeatDay__c && b?.Sf_Id === currentLatestVisit?.BeatDay__c) ||
      beatDayDate(b) === today
    );
    const activeBeatDayId = activeLocalBeatDay?.Sf_Id || beatDaysId || currentLatestVisit?.BeatDay__c;

    const isTodayVisit = (visit) => {
      if (!visit || visit?.SoftDelete === true || visit?.SoftDelete === "true") return false;
      if (activeBeatDayId && (visit?.BeatDay__c === activeBeatDayId || visit?.Beat_Day__c === activeBeatDayId)) {
        return true;
      }
      const visitDate = String(visit?.VisitDate__c || visit?.Visit_Date__c || visit?.Date__c || "").slice(0, 10);
      if (visitDate && visitDate === today) {
        return true;
      }
      const rawCheckIn = String(visit?.CheckInTime__c || "").replace(/"/g, "").trim();
      if (rawCheckIn && moment(rawCheckIn).isValid() && moment(rawCheckIn).format("YYYY-MM-DD") === today) {
        return true;
      }
      return false;
    };

    const todayValidationVisits = locallyStoredVisits.filter(isTodayVisit);

    // 1. Check for in-progress visits today
    const inProgressVisit = todayValidationVisits.find((visit) => {
      const rawCheckIn = String(visit?.CheckInTime__c ?? "").replace(/"/g, "").trim();
      const rawCheckOut = String(visit?.CheckOutTime__c ?? "").replace(/"/g, "").trim();
      const status = String(visit?.VisitStatus__c ?? "").trim().toLowerCase();

      const isCheckInValid = rawCheckIn && moment(rawCheckIn).isValid() && !rawCheckIn.startsWith("0001") && !rawCheckIn.startsWith("1970");
      const isCheckInToday = isCheckInValid && moment(rawCheckIn).format("YYYY-MM-DD") === today;

      const isCheckOutValid = rawCheckOut && moment(rawCheckOut).isValid() && !rawCheckOut.startsWith("0001") && !rawCheckOut.startsWith("1970");
      const isCompletedOrCheckedOut = isCheckOutValid || ["check out", "completed", "done", "cancel", "cancelled"].includes(status);

      return isCheckInToday && !isCompletedOrCheckedOut;
    });

    if (inProgressVisit) {
      dispatch(showToast({ message: "Please check out the in-progress visit before ending the day.", type: "warning" }));
      return { canEnd: false };
    }

    // 2. Check for at least ONE completed visit execution TODAY
    const completedVisitsToday = todayValidationVisits.filter((visit) => {
      const rawCheckIn = String(visit?.CheckInTime__c ?? "").replace(/"/g, "").trim();
      const rawCheckOut = String(visit?.CheckOutTime__c ?? "").replace(/"/g, "").trim();
      const status = String(visit?.VisitStatus__c ?? "").trim().toLowerCase();

      const isCheckInValid = rawCheckIn && moment(rawCheckIn).isValid() && !rawCheckIn.startsWith("0001") && !rawCheckIn.startsWith("1970");
      const isCheckInToday = isCheckInValid && moment(rawCheckIn).format("YYYY-MM-DD") === today;

      const isCheckOutValid = rawCheckOut && moment(rawCheckOut).isValid() && !rawCheckOut.startsWith("0001") && !rawCheckOut.startsWith("1970");
      const isCheckOutToday = isCheckOutValid && moment(rawCheckOut).format("YYYY-MM-DD") === today;
      const isCompletedStatus = ["check out", "completed", "done"].includes(status);

      return isCheckInToday && (isCheckOutToday || isCompletedStatus) && status !== "check in";
    });

    console.log("End Day validation check MT:", {
      todayVisitsCount: todayValidationVisits.length,
      completedVisitsTodayCount: completedVisitsToday.length,
    });

    if (completedVisitsToday.length === 0) {
      dispatch(showToast({
        message: "You need to complete at least one visit execution before ending the day.",
        type: "warning",
      }));
      return { canEnd: false };
    }

    currentLatestVisit = completedVisitsToday[completedVisitsToday.length - 1] || currentLatestVisit || (currentCategorizedData["Check Out"] || [])[0] || null;

    return {
      canEnd: true,
      currentLatestVisit,
      currentLatestBeatDay,
      currentCategorizedData,
      currentRawVisits: todayValidationVisits,
      completedVisitCount: completedVisitsToday.length,
      activeLocalBeatDay,
      todayValidationVisits,
    };
  };

  const handleOpenEndDayModal = async () => {
    const validation = await validateCanEndDay();
    if (validation.canEnd) {
      setModalVisible(true);
    }
  };

  const handleEndDayClick = async (arg) => {
    const comment = typeof arg === 'object' ? (arg?.comment || '') : (arg || '');
    const missedReasonsMap = (typeof arg === 'object' ? arg?.missedReasonsMap : null) || {};
    const missedVisitReason = typeof arg === 'object' ? (arg?.missedVisitReason || '') : '';
    const endDayMarkerKey = `end_day_completed_${moment().format("YYYY-MM-DD")}`;

    const validation = await validateCanEndDay();
    if (!validation.canEnd) {
      return;
    }

    let {
      currentLatestVisit,
      currentLatestBeatDay,
      currentCategorizedData,
      activeLocalBeatDay,
    } = validation;

    const todayDate = moment().format("YYYY-MM-DD");
    const attendanceRecords = await UniversalUpdateInsert({
      ObjectName: "Attendant__c",
      Type: "get",
      filters: [
        { field: "AttendanceDate__c", value: todayDate },
        { field: "User__c", value: userFromDbState[0]?.Sf_Id },
      ],
    });
    const lastAttendance = attendanceRecords?.length > 0 ? attendanceRecords[attendanceRecords.length - 1] : null;

    const allVisits = [
      ...(categorizedData.Upcoming || []),
      ...(categorizedData["Check In"] || []),
      ...(categorizedData["Check Out"] || []),
    ];

    const plannedOutletsCount = allVisits.length;
    const visitedVisits = allVisits.filter(v => isVisitedCheck(v));
    const visitedOutletsCount = visitedVisits.length;
    const notVisitedOutletsCount = Math.max(0, plannedOutletsCount - visitedOutletsCount);
    const pjpVisitedCount = visitedVisits.filter(v => !isNonPjpCheck(v)).length;
    const nonPjpVisitedCount = visitedVisits.filter(v => isNonPjpCheck(v)).length;
    const nonPjpProductiveCallsCount = visitedVisits.filter(v => isNonPjpCheck(v) && isProductiveCheck(v)).length;
    const productiveCallsCount = visitedVisits.filter(v => isProductiveCheck(v)).length;
    const nonProductiveCallsCount = Math.max(0, visitedOutletsCount - productiveCallsCount);
    const totalCallsCount = visitedOutletsCount;
    const productivityPercentageText = totalCallsCount > 0 ? `${Math.round((productiveCallsCount / totalCallsCount) * 100)}%` : "0%";
    const coveragePercentageText = plannedOutletsCount > 0 ? `${Math.round((totalCallsCount / plannedOutletsCount) * 100)}%` : "0%";
    const timeSpentOnFieldStr = await getTimeSpentOnField();
    const totalTimeInOutletStr = calculateTimeSpentonField(categorizedData);
    const endOfDayTimeStr = getCurrentDateTimeString();
    const formatMinutesToTimeField = (minutes) => {
      const totalSeconds = Math.max(0, Math.round((Number(minutes) || 0) * 60));
      const hours = Math.floor(totalSeconds / 3600) % 24;
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      const hh = String(hours).padStart(2, "0");
      const mm = String(mins).padStart(2, "0");
      const ss = String(secs).padStart(2, "0");
      return `${hh}:${mm}:${ss}.000Z`;
    };

    const endTimeStr = `${moment().format("HH:mm:ss.SSS")}Z`;
    const attendanceEndTimeISO = moment().toISOString();

    const beatDayFields = {
      EOD_Comment__c: comment,
      EodComment__c: comment,
      Missed_Outlet_Reasons__c: missedVisitReason,
      EndOfDayTime__c: attendanceEndTimeISO,
      End_Time__c: endTimeStr,
      NonProductiveCalls__c: nonProductiveCallsCount,
      NonPjpOutletVisited__c: nonPjpVisitedCount,
      NonPjpProductiveCalls__c: nonPjpProductiveCallsCount,
      Not_Visited_Outlets__c: notVisitedOutletsCount,
      NotVisitedOutlets__c: notVisitedOutletsCount,
      PjpOutletVisited__c: pjpVisitedCount,
      Planned_Outlets__c: plannedOutletsCount,
      Planned_Outlets_Coverage__c: coveragePercentageText,
      Productive_Calls__c: productiveCallsCount,
      Productivity__c: productivityPercentageText,
      TimeSpentOnField__c: Number(timeSpentOnFieldStr) || 0,
      Total_Calls__c: totalCallsCount,
      Total_Time_in_Outlet__c: formatMinutesToTimeField(totalTimeInOutletStr),
      Visited_Outlets__c: visitedOutletsCount,
      Last_Call_Time__c: endOfDayTimeStr,
      Attendance__c: lastAttendance?.Sf_Id,
      AvgTimeSpentinOlforCalls__c: calculateAverageTimeSpent(categorizedData, plannedOutletsCount),
      AvgTimeSpentinOlforPc__c: calculateAverageProductiveCallTime(categorizedData),
      NonPjpTc__c: countNonPjpOutletRecords(categorizedData),
      TotalDistanceTravelledKm__c: getTotalDistanceTravelled(categorizedData),
      TcTill12Noon__c: countTrueByField(categorizedData, 'Before12Noon__c'),
      TcTill3PM__c: countTrueByField(categorizedData, 'Before3PM__c'),
      TcTill6PM__c: countTrueByField(categorizedData, 'Before6PM__c'),
      TcAfter6PM__c: countTrueByField(categorizedData, 'After6PM__c'),
      SecOrderQuantityPcs__c: totalpscCount,
      SecondaryOrderQuantityInValue__c: await SecondaryOrderQuantityInValue_get(),
      SecondaryOrderQuantityInKG__c: await SecondaryOrderQuantityInKG_get(),
      Postman_Call_Less_than_1_min__c: await countTrueByField(categorizedData, 'Postman_Call__c'),
      Inappropriate_Call_Less_than_3_min__c: await countTrueByField(categorizedData, 'Inappropriate_Call__c'),
      Appropriate_Call_Greater_than_3_min__c: await countTrueByField(categorizedData, 'Appropriate_Call__c'),
    };

    const beatDayId =
      latestVisitState?.BeatDay__c ||
      latestBeatDayState?.Sf_Id ||
      activeLocalBeatDay?.Sf_Id ||
      beatDaysId;

    // Prepare individual missed visit requests for Salesforce
    const missedVisitEntries = Object.entries(missedReasonsMap).filter(([k, v]) => Boolean(k && String(v).trim()));
    const missedVisitRequests = missedVisitEntries.map(([visitSfId, reason], idx) => ({
      method: "PATCH",
      url: `/services/data/v61.0/sobjects/Visit__c/${visitSfId}`,
      referenceId: `updateMissedVisit_${idx}`,
      body: {
        Missing_Outlet_Reason__c: String(reason).trim(),
      },
    }));

    let visitSuccess = false;
    let beatDaySuccess = false;
    let attendanceSuccess = false;
    let compositeResults = [];

    const connected = await isInternetAvailable();
    if (connected) {
      const compositePayload = {
        compositeRequest: [
          ...(latestVisitState?.Sf_Id ? [{
            method: "PATCH",
            url: `/services/data/v61.0/sobjects/Visit__c/${latestVisitState.Sf_Id}`,
            referenceId: "updateVisit",
            body: {
              LastCallVisit__c: true,
            },
          }] : []),
          {
            method: "PATCH",
            url: `/services/data/v61.0/sobjects/Beat_Day__c/${beatDayId}`,
            referenceId: "updateBeatDay",
            body: beatDayFields,
          },
          ...(lastAttendance?.Sf_Id ? [{
            method: "PATCH",
            url: `/services/data/v61.0/sobjects/Attendance__c/${lastAttendance.Sf_Id}`,
            referenceId: "updateAttendance",
            body: {
              AttendanceEndTime__c: attendanceEndTimeISO,
            },
          }] : []),
          ...missedVisitRequests,
        ],
        allOrNone: false,
      };
      const response = await apiComposite("POST", "composite", compositePayload);
      compositeResults = response?.data?.compositeResponse || response?.compositeResponse || [];
      const beatDayResult = compositeResults.find(item => item.referenceId === 'updateBeatDay');
      visitSuccess = compositeResults.find(item => item.referenceId === 'updateVisit' && item.httpStatusCode >= 200 && item.httpStatusCode < 300);
      beatDaySuccess = beatDayResult?.httpStatusCode >= 200 && beatDayResult?.httpStatusCode < 300;
      attendanceSuccess = compositeResults.find(item => item.referenceId === 'updateAttendance' && item.httpStatusCode >= 200 && item.httpStatusCode < 300);

      // Multi-pass Fallback
      if (!beatDaySuccess && beatDayId) {
        try {
          let currentPayload = { ...beatDayFields };
          let fallbackRes = null;
          let lastErr = beatDayResult?.body;
          let retries = 0;

          while (retries < 3) {
            retries++;
            const errMsg = Array.isArray(lastErr)
              ? lastErr.map(e => e?.message || e?.errorCode).join("; ")
              : String(lastErr?.message || lastErr?.errorCode || "");
            
            const fieldsToRemove = new Set();
            const matchedFields = errMsg.match(/fields:\s*([^.]+)/i)?.[1];
            if (matchedFields) {
              matchedFields.split(",").forEach(f => f && fieldsToRemove.add(f.trim()));
            }
            const invalidColumns = errMsg.match(/No such column '([^']+)'/i)?.[1];
            if (invalidColumns) {
              fieldsToRemove.add(invalidColumns.trim());
            }
            const fieldPrefixMatch = errMsg.match(/^([A-Za-z0-9_]+__c):/);
            if (fieldPrefixMatch?.[1]) {
              fieldsToRemove.add(fieldPrefixMatch[1].trim());
            }

            if (fieldsToRemove.size === 0 && retries > 1) break;

            fieldsToRemove.forEach(f => {
              delete currentPayload[f];
            });

            fallbackRes = await apiFetch("PATCH", `sobjects/Beat_Day__c/${beatDayId}`, currentPayload, "SObjects");
            console.log(`Beat Day direct PATCH response [attempt ${retries}]:`, JSON.stringify(fallbackRes));
            if (fallbackRes?.status === "success" && !fallbackRes?.data?.errors) {
              beatDaySuccess = true;
              break;
            }
            lastErr = fallbackRes?.data || fallbackRes?.message || fallbackRes;
          }
        } catch (_) { }
      }

      if (!beatDaySuccess) {
        const result = beatDayResult?.body;
        const salesforceMessage = Array.isArray(result)
          ? result.map(error => error?.message || error?.errorCode).filter(Boolean).join("; ")
          : result?.message || result?.errorCode;
        throw new Error(salesforceMessage || "Salesforce could not update the Beat Day record.");
      }
    }

    // Update local Visit records with individual Missing_Outlet_Reason__c
    for (let i = 0; i < missedVisitEntries.length; i++) {
      const [visitSfId, reason] = missedVisitEntries[i];
      const isSynced = connected && Boolean(compositeResults.find(item => item.referenceId === `updateMissedVisit_${i}` && item.httpStatusCode >= 200 && item.httpStatusCode < 300));
      
      await UniversalUpdateInsert({
        ObjectName: 'Visit',
        Type: 'insert',
        data: {
          Sf_Id: visitSfId,
          Missing_Outlet_Reason__c: String(reason).trim(),
          operation_type: "update",
          is_locally_changed: !isSynced,
          is_synced: isSynced,
          last_modified: Date.now(),
        },
      });
    }

    if (latestVisitState?.Sf_Id) {
      const visitPayload = {
        Sf_Id: latestVisitState.Sf_Id,
        LastCallVisit__c: true,
        operation_type: "update",
        is_locally_changed: visitSuccess ? false : true,
        is_synced: visitSuccess ? true : false,
        last_modified: Date.now(),
      };
      await UniversalUpdateInsert({
        ObjectName: 'Visit',
        Type: 'insert',
        data: visitPayload,
      });
    }

    const beatdayPayload = {
      Sf_Id: beatDayId,
      ...beatDayFields,
      operation_type: "update",
      is_locally_changed: beatDaySuccess ? false : true,
      is_synced: beatDaySuccess ? true : false,
      last_modified: Date.now(),
    };
    await UniversalUpdateInsert({
      ObjectName: 'BeatDay__c',
      Type: 'insert',
      data: beatdayPayload,
    });

    if (lastAttendance?.Sf_Id) {
      await UniversalUpdateInsert({
        ObjectName: 'Attendant__c',
        Type: 'insert',
        data: {
          Sf_Id: lastAttendance.Sf_Id,
          EndTime__c: attendanceEndTimeISO,
          AttendanceEndTime__c: attendanceEndTimeISO,
          is_locally_changed: attendanceSuccess ? false : true,
          is_synced: attendanceSuccess ? true : false,
          last_modified: Date.now(),
        },
      });
    }

    setModalVisible(false);
    await AsyncStorage.setItem(endDayMarkerKey, "true");
    dispatch(showToast({
      message: 'Day ended successfully!',
      type: 'success'
    }));
    setTimeout(async () => {
      // const sync = await handleSyncData();
      // await handleLogoutFun();
      navigation.navigate('TabbedScreen');
    }, 1000);


  }



  const handleSyncData = async () => {
    await syncAttendanceRecords(apiFetch);
    await syncBeatDayRecord(apiFetch);
    await syncVisitRecord(apiFetch, apiComposite);
    await syncOrderRecord(apiFetch);
    await syncOrderItemRecord(apiFetch);
    await syncCollectionRecord(apiFetch);
    await syncCollectionAllocationRecord(apiFetch);
    await syncInvoiceRecord(apiFetch)
    await syncInvoiceItemRecord(apiFetch)
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



  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { handleLogout } = useApiFetch();
  const handleLogoutFun = async () => {
    setIsLoggingOut(true);
    console.log('setting has Logged out true...............before logout')
    await AsyncStorage.setItem("hasLoggedOut", "true");
    let loggedoutValue = await AsyncStorage.getItem("hasLoggedOut")
    console.log('has loggedout value................... in tabbed ', loggedoutValue)
    try {
      await AsyncStorage.setItem("hasLoggedOut", "true");
      const hasLoggedOut = (await AsyncStorage.getItem("hasLoggedOut")) === 'true';
      if (!hasLoggedOut) {
        return
        console.log('has logged out is true ............ set')
      }
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
        await UniversalUpdateInsert({ ObjectName: obj, Type: "delete_synced_only" });
      }
      setIsLoggingOut(false);
      dispatch(logout());
      await handleLogout(); // Final API logout (if needed)
    } catch (err) {
      console.error("Error during logout:", err);
      ToastAndroid.show("Logout failed. Try again.", ToastAndroid.SHORT);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const fetchData = async () => {
    try {
      // 1️⃣ Fetch user
      const userFromDb = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      console.log('USER FROM DB ::::', userFromDb);
      setUserFromDbState(userFromDb);

      // 2️⃣ Fetch accounts
      const accountData = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
      });

      // 3️⃣ Fetch route plans of logged in user
      const RoutePlans = await UniversalUpdateInsert({
        ObjectName: "Route_Plans__c",
        Type: "get",
        filters: [
          { field: 'Assigned_To__c', value: userFromDb[0]?.Sf_Id },
        ],
      });

      // 4️⃣ Current month route plans
      const todayForRoutePlans = new Date();
      const firstDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth(), 1);
      const lastDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth() + 1, 0);

      const currentMonthRoutePlans = RoutePlans.filter(plan => {
        const startDate = new Date(plan.Start_Date__c);
        const endDate = new Date(plan.End_Date__c);
        return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
      });

      const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;

      // 5️⃣ Fetch BeatDays
      const BeatDays = await UniversalUpdateInsert({
        ObjectName: "BeatDay__c",
        Type: "get",
      });

      const beatDayForDate =
        BeatDays.find(b =>
          (b.Beat_Date__c === dateNow || b.BeatDate__c === dateNow || String(b.Beat_Date__c || b.BeatDate__c || "").slice(0, 10) === dateNow) &&
          (activePlanId ? (b.Tour_Plan__c === activePlanId || b.Route_Plans__c === activePlanId) : true)
        ) ||
        BeatDays.find(b =>
          String(b.Beat_Date__c || b.BeatDate__c || "").slice(0, 10) === dateNow
        );

      if (!beatDayForDate) {
        console.log('No Beat Day found for date', dateNow);
        setSelectedBeatName(null);
        setSelecteBeatId(null);
        setBeatDaysId(null);
        setFilteredVisits([]);
        setCategorizedData({ Upcoming: [], "Check In": [], "Check Out": [] });
        return;
      }

      setSelectedBeatName(beatDayForDate?.Beat__Name);
      setSelecteBeatId(beatDayForDate?.Beat__c);
      setBeatDaysId(beatDayForDate?.Sf_Id);

      // 6️⃣ Fetch Visits
      const Visits = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [
          { field: "SoftDelete", value: false },
          { field: "BeatDay__c", value: beatDayForDate?.Sf_Id },
        ],
      });

      // 7️⃣ Fetch Orders, OrderItems, Products
      const Orders = await UniversalUpdateInsert({
        ObjectName: "Order",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      });

      const OrderItems = await UniversalUpdateInsert({
        ObjectName: "OrderItem",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      });

      const Products = await UniversalUpdateInsert({
        ObjectName: "Product2",
        Type: "get",
        filters: [{ field: "SoftDelete", value: false }],
      });

      // 8️⃣ Collections & Competitors
      const Collection__c = await UniversalUpdateInsert({
        ObjectName: 'Collection__c',
        Type: 'get',
        filters: [{ field: 'DateOfPayment__c', value: dateNow }]
      });

      const Competitor__c = await UniversalUpdateInsert({
        ObjectName: "Competitor_LineItem__c",
        Type: "get",
      });
      let grandTotalOrderQty = 0;
      let grandTotalReturnQty = 0;

      // 9️⃣ Process visits with orders - only relevant visits
      const visitsWithOrders = Visits
        .filter(v => v && ((v.CheckInTime__c && v.CheckOutTime__c) || v.VisitStatus__c === "Check In"))
        .map(visit => {
          const account = accountData.find(acc => acc.Sf_Id === visit.AccountId__c);
          const accountName = account ? account.Name : 'Unknown Account';

          const ordersForVisit = Orders.filter(order => order.Visit__c === visit.Sf_Id)
            .map(order => ({
              ...order,
              items: OrderItems.filter(item => item.OrderId === order.Sf_Id)
                .map(item => {
                  const product = Products.find(p => p.Sf_Id === item.Product2Id);
                  return {
                    ...item,
                    productName: product ? product.Name : item.Product2Id,
                  };
                }),
            }));

          const totalOrderQty = ordersForVisit.reduce((sum, order) => {
            return sum + (order.TotalOrderQtyInPcs__c || 0);
          }, 0);
          const totalReturnQty = ordersForVisit.reduce((sum, order) => {
            return sum + (order.TotalReturnQuantity__c || 0);
          }, 0);
          // console.log(`Visit ${accountName} TotalOrderQtyInPcs__c:`, totalOrderQty);
          // console.log(`Visit ${accountName} TotalReturnQuantity__c:`, totalReturnQty);
          grandTotalOrderQty += totalOrderQty;
          grandTotalReturnQty += totalReturnQty;

          return {
            ...visit,
            title: accountName,
            code: account.Party_Code__c,
            orders: ordersForVisit,
          };
        });
      setTotalpscCount(grandTotalOrderQty + grandTotalReturnQty);
      setFilteredVisits(visitsWithOrders);

      // console.log('Helllo gpt',JSON.stringify(visitsWithOrders))
      // 1️⃣0️⃣ Find completed visits safely
      const completedVisits = Visits.filter(v => v && (
        (v.CheckInTime__c && v.CheckOutTime__c) ||
        v.VisitStatus__c === 'Check Out' ||
        v.VisitStatus__c === 'Completed'
      ));

      const latestVisit = completedVisits.reduce((latest, current) => {
        const currentTime = current?.CheckOutTime__c ? new Date(current.CheckOutTime__c.replace(/"/g, '')).getTime() : 0;
        const latestTime = latest?.CheckOutTime__c ? new Date(latest.CheckOutTime__c.replace(/"/g, '')).getTime() : 0;
        return currentTime > latestTime ? current : latest;
      }, null);

      const BeatDayRecordToday = await UniversalUpdateInsert({
        ObjectName: "BeatDay__c",
        Type: "get",
        filters: [{ field: "Sf_Id", value: latestVisit?.BeatDay__c }],
      });
      setLatestBeatDayState(BeatDayRecordToday[0])

      setLatestVisitState(latestVisit);

      // 1️⃣1️⃣ Stats
      const ordersPlacedCount = visitsWithOrders.reduce(
        (sum, visit) => sum + (visit.orders ? visit.orders.length : 0),
        0
      );

      const inProgressCount = visitsWithOrders.filter(
        v => (v.CheckInTime__c && !v.CheckOutTime__c) || v.VisitStatus__c === "Check In"
      ).length;

      const completedCount = visitsWithOrders.filter(v => (v.CheckInTime__c && v.CheckOutTime__c) || v.VisitStatus__c === 'Check Out' || v.VisitStatus__c === 'Completed').length;

      const totalPaidAmount = Collection__c.reduce((sum, col) => sum + (Number(col.PaidAmount__c) || 0), 0);

      const visitAccountIds = Visits.map(v => v.AccountId);
      const visitIds = Visits.map(v => v.Sf_Id);

      const relevantCompetitors = Competitor__c.filter(c => visitAccountIds.includes(c.Customer__c));

      const updatedStats = [
        { key: 'Total Visits', value: Visits.length },
        { key: 'Check In/Check Out', value: `${inProgressCount} / ${completedCount}` },

      ];
      setOrdersPlacedCountTotal(ordersPlacedCount);



      setStats(updatedStats);


      const prepared = {
        Upcoming: [],
        "Check In": [],
        "Check Out": [],
      };

      // build orders-per-account map to compute propensity
      const ordersPerAccount = {};
      (Orders || []).forEach(o => {
        const acc = o.AccountId || 'NO_ACC';
        ordersPerAccount[acc] = (ordersPerAccount[acc] || 0) + 1;
      });
      const maxOrdersForAnyAccount = Math.max(1, ...Object.values(ordersPerAccount));

      // helper to safely get location fields (some records use __s suffix)
      const safeField = (obj, ...candidates) => {
        for (const c of candidates) {
          if (obj && typeof obj[c] !== 'undefined' && obj[c] !== null) return obj[c];
        }
        return null;
      };

      (Visits || []).forEach(v => {
        const accountDetails =
          (accountData || []).find(acc => acc.Sf_Id === v.AccountId);

        if (
          !accountDetails ||
          (
            accountDetails.IsActive__c === false &&
            !v?.Add_New_Retailer_Visit__c
          )
        ) {
          return;
        }

        // compute lastOrder (days since last order for this account)
        const ordersForAccount = (Orders || []).filter(o => (o.AccountId || '') === (accountDetails?.Sf_Id || v.AccountId));
        let lastOrder = "";
        if (ordersForAccount.length === 0) {
          lastOrder = "No Spot Sales";
        } else {
          const latest = ordersForAccount.reduce((a, b) => {
            const ta = a?.CreatedDate ? new Date(a.CreatedDate).getTime() : 0;
            const tb = b?.CreatedDate ? new Date(b.CreatedDate).getTime() : 0;
            return tb > ta ? b : a;
          }, ordersForAccount[0]);
          // use moment to get difference in days (safe check)
          if (latest?.CreatedDate && moment(latest.CreatedDate).isValid()) {
            const days = moment().diff(moment(latest.CreatedDate), 'days');
            lastOrder = `${days} days`;
          } else {
            lastOrder = "Unknown";
          }
        }

        // simple propensity heuristic based on number of orders for the account
        const accountOrderCount = ordersPerAccount[accountDetails?.Sf_Id || v.AccountId] || 0;
        const propensityPercent = Math.round((accountOrderCount / maxOrdersForAnyAccount) * 100);
        const propensity = `${propensityPercent}%`;
        //  console.log("ACCOUNT DETAILS FOR VISIT ========", v);
        // build the base object exactly as you specified
        const base = {
          name: accountDetails?.Name || "",
          tier: accountDetails?.Class__c || "",
          target: accountDetails?.Channel__c || "",
          lastOrder: "5 days",
          propensity: "70%",
          AccountId: v?.AccountId || null,
          sfId: v?.Sf_Id || null,
          CheckInTime__c: v?.CheckInTime__c || null,
          CheckOutTime__c: v?.CheckOutTime__c || null,
          Phone: accountDetails?.Phone || null,
          BillingAddress: accountDetails?.BillingAddress || null,
          OTPVerified__c: accountDetails?.OTPVerified__c ?? null,
          CreditLimit__c: accountDetails?.CreditLimit__c ?? null,
          VisitStatus__c: v?.VisitStatus__c || null,
          CheckInLocation__Longitude: safeField(v, 'CheckInLocation__Longitude__s', 'CheckInLocation__Longitude') || null,
          CheckInLocation__Latitude: safeField(v, 'CheckInLocation__Latitude__s', 'CheckInLocation__Latitude') || null,
          CheckOutLocation__Longitude: safeField(v, 'CheckOutLocation__Longitude__s', 'CheckOutLocation__Longitude') || null,
          CheckOutLocation__Latitude: safeField(v, 'CheckOutLocation__Latitude__s', 'CheckOutLocation__Latitude') || null,
          BillingLatitude: accountDetails?.BillingLatitude ?? null,
          BillingLongitude: accountDetails?.BillingLongitude ?? null,
          BeatDay__c: v?.BeatDay__c || null,
          PJPOutlet__c: v?.PJPOutlet__c,
          ProductiveCall__c: v?.ProductiveCall__c,
          NonPjpOutlet__c: v?.NonPjpOutlet__c,
          DistanceTravelledKm__c: v?.DistanceTravelledKm__c,
          Before12Noon__c: v?.Before12Noon__c,
          Before3PM__c: v?.Before3PM__c,
          Before6PM__c: v?.Before6PM__c,
          After6PM__c: v?.After6PM__c,
          Postman_Call__c: v?.Postman_Call__c,
          Inappropriate_Call__c: v?.Inappropriate_Call__c,
          Appropriate_Call__c: v?.Appropriate_Call__c,
        };

        // determine bucket (same logic as your component)
        let bucket = 'Upcoming';
        if (
          (v?.CheckInTime__c && v?.CheckOutTime__c) ||
          v?.VisitStatus__c === 'Check Out' ||
          v?.VisitStatus__c === 'Completed'
        ) {
          bucket = 'Check Out';
        } else if ((v?.CheckInTime__c && !v?.CheckOutTime__c) || v?.VisitStatus__c === 'Check In') {
          bucket = 'Check In';
        } else {
          bucket = 'Upcoming';
        }

        prepared[bucket].push(base);
      });


      // console.log("CATEGORIZED DATA PREPARED =======", JSON.stringify(prepared));
      // commit to state
      setCategorizedData(prepared);

      return {
        latestVisit,
        latestBeatDay: BeatDayRecordToday?.[0] || beatDayForDate,
        prepared,
        rawVisits: Visits,
        completedVisitCount: completedVisits.length,
      };
    } catch (error) {
      console.error('Failed to get data safely:', error);
    }
  };

  useEffect(() => {
    console.log("END DAY SUMMARY SCREEN MOUNTED");
    fetchData();
  }, []);

  return (
    <SafeAreaProvider style={styles.safe}>
      {/* <View style={styles.header}> */}
      <LinearGradient
        colors={['#A67C2E', '#1E3A8A']}
        style={styles.header}
      >
        <TouchableOpacity onPress={(() => { navigation.goBack() })}>
          <IonIcons name="chevron-back" size={24} color="#fff" style={{ marginLeft: 0 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>End Day Summary MT</Text>
        <View style={styles.headerRight}>
          <Text style={styles.iconPlaceholder}></Text>
        </View>
      </LinearGradient>
      {/* </View> */}
      <View style={styles.container}>
        {/* Header */}


        {/* Profile card */}
        {/* <View style={styles.profileCard}> */}
        <LinearGradient
          colors={['#2659b8ff', '#1E3A8A']}
          style={styles.profileCard}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userFromDbState[0]?.Name.trim()?.split(" ").slice(0, 2).map(word => word[0]).join("").toUpperCase()}</Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.userName}>{userFromDbState[0]?.Name}</Text>
            <Text style={styles.userId}>Role: {userFromDbState[0]?.Role}</Text>
            <Text style={styles.userDate}>{moment().format("DD MMM YYYY")}</Text>
          </View>
        </LinearGradient>
        {/* </View> */}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {stats.map(s => (
            <StatCard key={s.key} label={s.key} value={s.value} />
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 400 }}>

          {/* Visits list */}
          <View style={{ marginTop: 12, width: '100%', paddingBottom: 100 }}>
            <FlatList
              data={filteredVisits}
              keyExtractor={v => v.id}
              renderItem={({ item }) => <VisitAccordion visit={item} />}

            />
          </View>
        </ScrollView>
      </View>
      <RippleBackground
        rippleColor="#1E3A8A"
        rippleCount={1}
        duration={3400}
        style={{ position: 'absolute', bottom: 40, right: 20 }}
      >
        <TouchableOpacity onPress={handleOpenEndDayModal} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}>
          <Text style={{ color: 'white', fontWeight: '500' }}>End Day</Text>
        </TouchableOpacity>
      </RippleBackground>


      {
        userFromDbState[0]?.DeveloperName === 'H_T_ASO' && (
          <RippleBackground
            rippleColor="#1E3A8A"
            rippleCount={1}
            duration={3400}
            style={{ position: 'absolute', bottom: 40, left: 20 }}
          >
            <TouchableOpacity onPress={() => { navigation.navigate('ASOOrder') }} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}>
              {/* <TouchableOpacity onPress={() => { navigation.navigate('CloseDay') }} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}> */}
              <Text style={{ color: 'white', fontWeight: '500' }}>Suggested Spot Sales</Text>
            </TouchableOpacity>
          </RippleBackground>
        )
      }

      <EndDayModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleEndDayClick}
        missedVisits={filteredVisits.filter(v => v.type === 'Upcoming' || v.type === 'Not Visited').map(v => ({
          id: v.id || v.sfId || v.Sf_Id,
          sfId: v.Sf_Id || v.sfId || v.id,
          visitId: v.Sf_Id || v.sfId || v.id,
          accountName: v.title || v.accountName || "Outlet",
          accountCode: v.code || v.accountCode || "",
        }))}
      />


      {
        isLoggingOut && (
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
        )
      }

    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { marginTop: -70, alignItems: 'center', paddingBottom: 40, paddingTop: 8 },
  header: {
    width: '100%',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 80,
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  headerRight: {},
  iconPlaceholder: { fontSize: 16, paddingHorizontal: 10 },

  profileCard: {
    width: '92%',
    backgroundColor: '#1653B2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', color: '#0F6BDD' },
  userName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userId: { color: '#DDEEFF', marginTop: 4 },
  userDate: { color: '#DDEEFF', marginTop: 2 },

  statsGrid: { width: '92%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statLabel: { fontSize: 13, color: '#010101', fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#151416', marginTop: 8 },

  visitWrap: { width: '92%', alignSelf: 'center', marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: '#fff', alignItems: 'center', borderTopLeftRadius: 12, borderTopRightRadius: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  visitTitle: { fontWeight: '500', fontSize: 14, color: '#1C1C1B' },
  visitTime: { color: '#7A7266', fontSize: 10, marginTop: 4 },
  visitBody: { backgroundColor: '#fff', padding: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },

  badge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 20, minWidth: 78, alignItems: 'center' },
  badgeText: { fontWeight: '500', fontSize: 11 },
  chev: { marginTop: 6, color: '#9AA0A6' },

  orderWrap: { marginBottom: 10, elevation: 1, borderColor: '#b6b6b6ff', borderRadius: 10, overflow: 'hidden', backgroundColor: '#F9FAFB', paddingBottom: 10, },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8 },
  orderTitle: { fontWeight: '500', color: '#0C0B0D' },
  orderCustomer: { color: '#0C0B0D', marginTop: 4 },
  orderAmount: { fontWeight: '500', marginBottom: 4, color: '#1b1b1b' },

  orderItemsContainer: { marginLeft: 15, marginTop: 8, borderTopWidth: 1, borderTopColor: '#EEE', borderRadius: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  itemsHeader: { backgroundColor: '' },
  rowAlt: { backgroundColor: '#FBFBFD' },
  cell: { fontSize: 13, color: '#0C0B0D', fontWeight: '400' },

  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)', // dim the background a bit
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    minWidth: 160,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    // glass-like card
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    // elevation: 6,
  },
  loaderText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
