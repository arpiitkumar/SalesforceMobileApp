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
import Spinner from 'react-native-spinkit';
import AntDesign from "../components/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import EndDayOrderDetails from '../components/EndDayOrderDetails';
import SubEndDay from '../components/SubEndDay';
import { syncAttendanceRecords, syncMTExceptionRecord, syncGrowthMappingEntryRecord, syncBeatDayRecord, syncVisitRecord, syncOrderRecord, syncOrderItemRecord, syncCollectionRecord, syncCollectionAllocationRecord, syncInvoiceRecord, syncInvoiceItemRecord, syncAccountRecord, syncFormJsonecord, syncCompetitorRecord, syncStockCheckRecord, syncSalaryAcknowledgementRecord, syncHNTCompetitorPriceRecord, syncGamificationTransactionRecord } from '../database/dbService/AllDataSync';
import { persistor } from '../redux/store';
import { logout } from "../redux/slices/authSlice";
import { CLEAR_TABLES } from '../../config';
import { getCurrentLocation } from '../utils/getCurrentLocation';
import { buildSyncFields, extractApiErrorMessage } from '../utils/sync/syncStatus';
import { setSelectedVisit } from '../redux/slices/selectedVisitSlice';
import { clearCheckInStatus } from '../redux/slices/checkInSlice';
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
  'Total Visits': { pack: 'AntDesign', name: 'profile', color: '#A67C2E' },
  'Spot Sales Placed': { pack: 'Feather', name: 'check-circle', color: '#A67C2E' },
  'Pending Spot Sales': { pack: 'Feather', name: 'clock', color: '#A67C2E' },
  'Cancelled Visits': { pack: 'AntDesign', name: 'closecircle', color: '#A67C2E' },
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
  const bg = type === 'Completed' || type === 'Check Out' ? '#CDF7DD' : type === 'Pending' ? '#FFECC2' : '#F1EADB';
  const color = type === 'Completed' || type === 'Check Out' ? '#0B8A3E' : type === 'Pending' ? '#C97F00' : '#C9A24D';
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
          <Text style={styles.orderCustomer}>{moment(order?.OrderSubmissionTime__c?.split('T')[0], 'YYYY-MM-DD').format('DD MMM YYYY')} </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.orderAmount}>₹{order?.TotalAmount?.toLocaleString() || 0}</Text>
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

      {open && (


        <View style={styles.visitBody}>
          <Text
            style={{
              fontSize: 11,
              color: '#13265C',
              backgroundColor: '#C9A24D',
              alignSelf: 'flex-start',
              paddingVertical: 2,
              paddingHorizontal: 6,
              fontWeight: 'bold',
              borderRadius: 4,
              marginBottom: 6,
            }}
          >
            {visit?.orders?.length > 0 ? 'Spot Sales' : 'No Spot Sales on this visit'}
          </Text>
          {visit?.orders?.map(ord => (
            <OrderAccordion key={ord.id} order={ord} />
          ))}
        </View>
      )}
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
  const [modalVisible, setModalVisible] = useState(false);
  const [isEndingDay, setIsEndingDay] = useState(false);

  const [latestVisitState, setLatestVisitState] = useState(null);
  const [latestBeatDayState, setLatestBeatDayState] = useState(null);
  const [unvisitedVisitsState, setUnvisitedVisitsState] = useState([]);

  const [categorizedData, setCategorizedData] = useState({ Upcoming: [], "Check In": [], "Check Out": [] });
  const [ordersPlacedCountTotal, setOrdersPlacedCountTotal] = useState(0);
  const [totalpscCount, setTotalpscCount] = useState(0);
  // const [dateStore, setDateStore] = useState(dateNow);
  const [stats, setStats] = useState([
    { key: 'Total Visits', value: 0 },
    { key: 'Spot Sales Placed', value: 0 },
    { key: 'Pending Spot Sales', value: 0 },
    { key: 'Collection', value: 0 },
  ]);
  const { apiFetch, apiComposite } = useApiFetch();

  const isVisitedCheck = (item) =>
    Boolean(
      (item?.CheckInTime__c && item?.CheckOutTime__c) ||
      item?.VisitStatus__c === "In Progress" ||
      item?.VisitStatus__c === "Completed" ||
      item?.VisitStatus__c === "Check Out" ||
      item?.VisitStatus__c === "Check In" ||
      item?.CheckInTime__c
    );

  const sameSalesforceId = (first, second) => {
    if (!first || !second) return false;
    const a = String(first).trim();
    const b = String(second).trim();
    return a === b || a.slice(0, 15) === b.slice(0, 15);
  };

  const isNonPjpCheck = (item) =>
    item?.NonPjpOutlet__c === true || item?.NonPjpOutlet__c === "true";

  const isProductiveCheck = (item) =>
    item?.ProductiveCall__c === true || item?.ProductiveCall__c === "true";

  const countPJPOutletTrue = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(item => !isNonPjpCheck(item) && isVisitedCheck(item)).length;
  };

  const calculateOrderPercentage = (orderCount, data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    if (allVisits.length === 0) return 0;
    const percentage = (orderCount / allVisits.length) * 100;
    return percentage.toFixed(2);
  };

  const calculateProductivityPercentage = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    const visited = allVisits.filter(item => isVisitedCheck(item));
    if (visited.length === 0) return 0;
    const productiveCalls = visited.filter(item => isProductiveCheck(item)).length;
    return Number(((productiveCalls / visited.length) * 100).toFixed(2));
  };

  const getCurrentDateTimeString = () => {
    return moment().format("YYYY-MM-DD HH:mm:ss");
  };

  const getVisitsList = (data) => {
    if (Array.isArray(data)) return data;
    return [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
  };

  const calculateTimeBetweenFirstCheckInAndLastCheckOut = (data, lastAttendanceStartTime) => {
    const allVisits = getVisitsList(data);
    const checkInTimes = allVisits
      .map(v => v?.CheckInTime__c?.replace(/"/g, ''))
      .filter(Boolean)
      .map(t => moment(t).isValid() ? moment(t) : null)
      .filter(Boolean);

    const checkOutTimes = allVisits
      .map(v => v?.CheckOutTime__c?.replace(/"/g, ''))
      .filter(Boolean)
      .map(t => moment(t).isValid() ? moment(t) : null)
      .filter(Boolean);

    let firstTime = checkInTimes.length > 0 ? moment.min(checkInTimes) : (lastAttendanceStartTime && moment(lastAttendanceStartTime).isValid() ? moment(lastAttendanceStartTime) : null);
    let lastTime = checkOutTimes.length > 0 ? moment.max(checkOutTimes) : moment();

    if (!firstTime) return 0;
    const diffMinutes = Math.max(0, lastTime.diff(firstTime, 'minutes', true));
    return Number(diffMinutes.toFixed(2));
  };

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
      const todayAttendanceRecords = (attendanceRecords || []).filter(
        (record) => record.AttendanceDate__c === today && record.User__c === userId
      );
      if (todayAttendanceRecords.length === 0) {
        return 0;
      } else {
        const startTime = todayAttendanceRecords[0]?.StartTime__c;
        const timeDifferenceInMinutes = moment().diff(moment(startTime), 'minutes', true);
        return Number(timeDifferenceInMinutes.toFixed(2));
      }
    } catch (err) {
      console.error("Error checking attendance:", err);
      return 0;
    }
  };

  const calculateTimeSpentonField = (data) => {
    let totalMinutes = 0;
    const allVisits = getVisitsList(data);
    allVisits.forEach(record => {
      const checkIn = record.CheckInTime__c?.replace(/"/g, '');
      const checkOut = record.CheckOutTime__c?.replace(/"/g, '');
      if (checkIn && checkOut && moment(checkIn).isValid() && moment(checkOut).isValid()) {
        const minutes = moment(checkOut).diff(moment(checkIn), 'minutes', true);
        if (minutes > 0) totalMinutes += minutes;
      } else if (checkIn && moment(checkIn).isValid()) {
        const minutes = moment().diff(moment(checkIn), 'minutes', true);
        if (minutes > 0) totalMinutes += minutes;
      }
    });
    return Number(totalMinutes.toFixed(2));
  };

  const calculateAverageTimeSpent = (data, totalVisitCount) => {
    let totalMinutes = 0;
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    allVisits.forEach(record => {
      const checkIn = record.CheckInTime__c?.replace(/"/g, '');
      const checkOut = record.CheckOutTime__c?.replace(/"/g, '');
      if (checkIn && checkOut && moment(checkIn).isValid() && moment(checkOut).isValid()) {
        const minutes = moment(checkOut).diff(moment(checkIn), 'minutes', true);
        if (minutes > 0) totalMinutes += minutes;
      }
    });
    const averageMinutes = totalVisitCount > 0 ? (totalMinutes / totalVisitCount) : 0;
    return `${averageMinutes.toFixed(2)} min`;
  };

  const calculateAverageProductiveCallTime = (data) => {
    let totalMinutes = 0;
    let productiveCallCount = 0;
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    allVisits.forEach(record => {
      if (isProductiveCheck(record)) {
        const checkIn = record.CheckInTime__c?.replace(/"/g, '');
        const checkOut = record.CheckOutTime__c?.replace(/"/g, '');
        if (checkIn && checkOut && moment(checkIn).isValid() && moment(checkOut).isValid()) {
          const minutes = moment(checkOut).diff(moment(checkIn), 'minutes', true);
          if (minutes > 0) totalMinutes += minutes;
          productiveCallCount += 1;
        }
      }
    });
    const averageMinutes = productiveCallCount > 0 ? (totalMinutes / productiveCallCount) : 0;
    return `${averageMinutes.toFixed(2)} min`;
  };

  const countNonPjpOutletRecords = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(record => isNonPjpCheck(record)).length;
  };

  const countNonPjpOutletRecordscheckin = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(record => isNonPjpCheck(record) && isVisitedCheck(record)).length;
  };

  const countNonPjpAndProductiveCalls = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(record => isNonPjpCheck(record) && isVisitedCheck(record) && isProductiveCheck(record)).length;
  };

  const getTotalDistanceTravelled = (data) => {
    let totalDistance = 0;
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    allVisits.forEach(record => {
      const distance = parseFloat(record.DistanceTravelledKm__c) || 0;
      totalDistance += distance;
    });
    return parseFloat(totalDistance.toFixed(2));
  };

  const countProductiveCalls = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(record => isVisitedCheck(record) && isProductiveCheck(record)).length;
  };

  const countNONProductiveCalls = (data) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(record => isVisitedCheck(record) && !isProductiveCheck(record)).length;
  };

  const countTrueByField = (data, fieldName) => {
    const allVisits = [...(data?.Upcoming || []), ...(data?.["Check In"] || []), ...(data?.["Check Out"] || [])];
    return allVisits.filter(record => record[fieldName] === true || record[fieldName] === "true").length;
  };

  const Planned_Outlets_Coverage_get = async (completedLength) => {
    const allVisits = [...(categorizedData?.Upcoming || []), ...(categorizedData?.["Check In"] || []), ...(categorizedData?.["Check Out"] || [])];
    const plannedCount = allVisits.length;
    if (plannedCount === 0) return "0%";
    const coverage = Math.round((completedLength / plannedCount) * 100);
    return `${coverage}%`;
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

  const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    // Convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);

    const R = 6371000; // Earth's radius in meters
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const getISCFromCompletedVisits = (completedVisits = []) => {
    try {
      if (!completedVisits.length) return 0;
      let visitsWithin100 = 0;
      let validCompletedCount = 0;
      for (const visit of completedVisits) {
        const billingLat = visit.BillingLatitude;
        const billingLng = visit.BillingLongitude;
        const checkInLat = visit.CheckInLocation__Latitude;
        const checkInLng = visit.CheckInLocation__Longitude;
        if (
          billingLat &&
          billingLng &&
          checkInLat &&
          checkInLng
        ) {
          validCompletedCount++;
          const distance = calculateDistanceInMeters(
            billingLat,
            billingLng,
            checkInLat,
            checkInLng
          );
          if (distance <= 100) {
            visitsWithin100++;
          }
        }
      }
      if (validCompletedCount === 0) return 0;
      return Math.round((visitsWithin100 / validCompletedCount) * 100);
    } catch (error) {
      console.log("ISC Calculation Error:", error);
      return 0;
    }
  };


  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(String(dateStr).replace(/"/g, ""));
  };

  const getLastCompletedVisit = (data) => {
    const completed = [...(data?.['Check Out'] || []), ...(data?.Completed || [])];
    return completed.reduce((latest, current) => {
      const currentDate = parseDate(current.CheckOutTime__c);
      const latestDate = latest
        ? parseDate(latest.CheckOutTime__c)
        : null;

      return !latestDate || currentDate > latestDate
        ? current
        : latest;
    }, null);
  };

  const getFirstCompletedVisit = (data) => {
    const completed = [...(data?.['Check Out'] || []), ...(data?.Completed || [])];
    return completed.reduce((earliest, current) => {
      const currentDate = parseDate(current.CheckInTime__c);
      const earliestDate = earliest
        ? parseDate(earliest.CheckInTime__c)
        : null;

      return !earliestDate || currentDate < earliestDate
        ? current
        : earliest;
    }, null);
  };

  const calculateTimeSpentOnFieldLAST = (attendanceStartTime, lastCheckoutTime) => {
    if (!attendanceStartTime || !lastCheckoutTime) return "";

    const parseDate = (value) => {
      if (!value) return null;

      // Convert to string & remove surrounding quotes
      let date = String(value).trim().replace(/^"|"$/g, "");

      // Handle: 2026-06-30 13:58:17
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
        return moment(date, "YYYY-MM-DD HH:mm:ss", true);
      }

      // Handle: +0000 -> +00:00
      date = date.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

      // Handle:
      // 2026-06-30T13:55:04.893+05:30
      // 2026-06-30T08:25:04.000+0000
      return moment.parseZone(date);
    };

    const start = parseDate(attendanceStartTime);
    const end = parseDate(lastCheckoutTime);

    if (!start?.isValid() || !end?.isValid()) {
      console.log("Invalid Dates:", attendanceStartTime, lastCheckoutTime);
      return "";
    }

    const minutes = end.diff(start, "minutes", true);

    return `${minutes.toFixed(2)} min`;
  };


  const getISTISOString = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC +5:30
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().replace('Z', '+05:30');
  };

  const checkCallTimingForVisit = async (sfId, fieldName) => {
    const visitData = await UniversalUpdateInsert({
      ObjectName: 'Visit',
      Type: 'get',
      filters: [{ field: 'Sf_Id', value: sfId }],
    });

    const checkInTime = visitData?.[0]?.CheckInTime__c;

    if (!checkInTime || !fieldName) return false;

    let time = checkInTime;

    if (typeof time === 'string') {
      time = time.replace(/^"+|"+$/g, '');
      time = time.replace(/(\+\d{2})(\d{2})$/, '$1:$2');
    }

    const checkInMs = new Date(time).getTime();

    if (isNaN(checkInMs)) return false;

    const diffMin = (Date.now() - checkInMs) / 60000;

    console.log('auto checkout diffMin =>', diffMin);

    if (fieldName === 'Postman_Call__c') {
      return diffMin <= 1;
    }

    if (fieldName === 'Inappropriate_Call__c') {
      return diffMin > 1 && diffMin <= 3;
    }

    if (fieldName === 'Appropriate_Call__c') {
      return diffMin > 3;
    }

    return false;
  };

  const checkHasOrderToday = async (accountId) => {
    const Orders1 = await UniversalUpdateInsert({
      ObjectName: "Order",
      Type: "get",
    });

    const Orders = Orders1.filter(ord => {
      const value = ord.TypeOfReturn__c;
      return value === '' || value == null;
    });

    if (!accountId || !Array.isArray(Orders)) return false;

    const today = moment().startOf('day');

    return Orders.some(ord => {
      if (ord.AccountId !== accountId) return false;

      const dateStr =
        ord.OrderSubmissionTime__c ||
        ord.CreatedDate ||
        ord.EffectiveDate;

      if (!dateStr) return false;

      const orderDate = moment(dateStr).local().startOf('day');
      return orderDate.isSame(today, 'day');
    });
  };

  const autoCheckoutVisits = async (visits) => {
    console.log("Starting auto checkout for", visits.length, "visits.");

    let lat = "";
    let lng = "";
    let loc = "Location unavailable";
    try {
      const coords = await getCurrentLocation();
      lat = coords.latitude;
      lng = coords.longitude;
      loc = `Lat: ${lat}, Long: ${lng}`;
    } catch (err) {
      console.warn("Auto checkout: Location error", err);
    }

    const checkOutTime = getISTISOString();

    for (const visit of visits) {
      try {
        const orderToday = await checkHasOrderToday(visit.AccountId__c);
        const reason = orderToday ? null : "Auto checkout from end day";

        const appCall = await checkCallTimingForVisit(visit.sfId, 'Appropriate_Call__c');
        const inappCall = await checkCallTimingForVisit(visit.sfId, 'Inappropriate_Call__c');
        const postCall = await checkCallTimingForVisit(visit.sfId, 'Postman_Call__c');

        const connected = await isInternetAvailable();
        let apiResult = { success: false, attempted: false, errorMsg: null };

        if (connected) {
          await syncVisitRecord(apiFetch, apiComposite)
          const apiPayload = {
            "requestWrapper": {
              "Id": visit.sfId,
              "CheckOutTime": checkOutTime,
              "CheckOutLocation": loc,
              "Status": 'Completed',
              "Type": "Check-Out",
              "CheckOutLocationLongitude": lng,
              "CheckOutLocationLatitude": lat,
              "NonProductiveCallReason": reason,
              "AppropriateCall": appCall,
              "InappropriateCall": inappCall,
              "PostmanCall": postCall,
            }
          };

          try {
            console.log('apiPayload', apiPayload)
            const response = await apiFetch('POST', 'visitCheckIn-update', apiPayload, 'Custom');
            if (response.status === 'success') {
              apiResult = { success: true, attempted: true, errorMsg: null };
            } else {
              apiResult = { success: false, attempted: true, errorMsg: extractApiErrorMessage(response, null) };
            }
          } catch (e) {
            console.error("Auto checkout API call failed for visit:", visit.sfId, e);
            apiResult = { success: false, attempted: true, errorMsg: e.message || String(e) };
          }
        }

        const apiSuccess = !!apiResult.success;
        const localPayload = {
          Sf_Id: visit.sfId,
          CheckOutTime__c: JSON.stringify(checkOutTime),
          CheckOutLocation__c: loc,
          VisitStatus__c: 'Check Out',
          CheckOutLocation__Latitude__s: lat,
          CheckOutLocation__Longitude__s: lng,
          NonProductiveCallReason__c: reason,
          Appropriate_Call__c: appCall,
          Inappropriate_Call__c: inappCall,
          Postman_Call__c: postCall,
          is_locally_changed: true,
          operation_type: "insert",
          last_modified: Date.now(),
          ...buildSyncFields({ apiSuccess, attempted: !!apiResult.attempted, errorMsg: apiResult.errorMsg }),
        };

        await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'insert',
          data: localPayload,
        });

        // If this visit was the currently selected visit in redux, clear it
        dispatch(clearCheckInStatus());

        console.log("Successfully checked out visit", visit.sfId);
      } catch (err) {
        console.error("Error checking out visit", visit.sfId, err);
      }
    }
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
      dispatch(showToast({
        message: "Please check out the in-progress visit before ending the day.",
        type: "warning",
      }));
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

    console.log("End Day validation check:", {
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
      currentRawVisits,
      completedVisitCount,
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
      currentRawVisits,
      activeLocalBeatDay,
      todayValidationVisits,
    } = validation;

    setIsEndingDay(true);

    try {
      if (currentCategorizedData["Check In"] && currentCategorizedData["Check In"].length > 0) {
        await autoCheckoutVisits(currentCategorizedData["Check In"]);
        const updated = await fetchData();
        if (updated) {
          currentLatestVisit = updated.latestVisit;
          currentLatestBeatDay = updated.latestBeatDay;
          currentCategorizedData = updated.prepared;
        }
      }

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
      const lastCompletedVisit = getLastCompletedVisit(currentCategorizedData) || currentLatestVisit;

      const lastCheckoutTime = lastCompletedVisit?.CheckOutTime__c || getCurrentDateTimeString();

      const timeSpentOnField = calculateTimeSpentOnFieldLAST(
        lastAttendance?.StartTime__c,
        lastCheckoutTime
      );

      const firstCompletedVisit = getFirstCompletedVisit(currentCategorizedData) || currentLatestVisit;
      const firstCheckinTime = firstCompletedVisit?.CheckInTime__c || lastCheckoutTime;

      const lastCheckoutTimeWithIST = moment
        .utc(lastCheckoutTime.replace(/"/g, ""))
        .format("HH:mm:ss.SSS") + "Z";

      const firstCheckinTimeWithIST = moment
        .utc(firstCheckinTime.replace(/"/g, ""))
        .format("HH:mm:ss.SSS") + "Z";

    const allVisits =
      (todayValidationVisits && todayValidationVisits.length > 0)
        ? todayValidationVisits
        : [
            ...currentRawVisits,
            ...(
              currentRawVisits.length > 0 ? [] : [
                ...(currentCategorizedData.Upcoming || []),
                ...(currentCategorizedData["Check In"] || []),
                ...(currentCategorizedData["Check Out"] || []),
              ]
            ),
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
      const timeSpentOnFieldStr = calculateTimeBetweenFirstCheckInAndLastCheckOut(allVisits, lastAttendance?.StartTime__c);
      const totalTimeInOutletStr = calculateTimeSpentonField(allVisits);
      // Salesforce DateTime fields require ISO-8601 values.
      const endOfDayTimeStr = moment().toISOString();
      // Salesforce Time fields require time-only values.
      const endTimeStr = `${moment().format("HH:mm:ss.SSS")}Z`;
      const attendanceEndTimeISO = moment().toISOString();

      const beatDayId =
        activeLocalBeatDay?.Sf_Id ||
        currentLatestBeatDay?.Sf_Id ||
        currentLatestVisit?.BeatDay__c ||
        beatDaysId;
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

      const beatDayFields = {
        EOD_Comment__c: comment,
        EodComment__c: comment,
        Missed_Outlet_Reasons__c: missedVisitReason,
        EndOfDayTime__c: endOfDayTimeStr,
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
      };
      console.log("FINAL BEAT DAY CALCULATED PAYLOAD:", JSON.stringify({
        beatDayId,
        ...beatDayFields,
      }));

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
            ...(currentLatestVisit?.Sf_Id ? [{
              method: "PATCH",
              url: `/services/data/v61.0/sobjects/Visit__c/${currentLatestVisit.Sf_Id}`,
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
        console.log("COMPOSITE PAYLOAD ========", JSON.stringify(compositePayload));
        const response = await apiComposite("POST", "composite", compositePayload);
        console.log('response', JSON.stringify(response));
        compositeResults = response?.data?.compositeResponse || response?.compositeResponse || [];
        const beatDayResult = compositeResults.find(item => item.referenceId === 'updateBeatDay');
        console.log("Beat Day Salesforce response:", JSON.stringify(beatDayResult));
        visitSuccess = compositeResults.find(item => item.referenceId === 'updateVisit' && item.httpStatusCode >= 200 && item.httpStatusCode < 300);
        beatDaySuccess = beatDayResult?.httpStatusCode >= 200 && beatDayResult?.httpStatusCode < 300;
        attendanceSuccess = compositeResults.find(item => item.referenceId === 'updateAttendance' && item.httpStatusCode >= 200 && item.httpStatusCode < 300);

        // Fallback for BeatDay if Beat_Day__c endpoint failed (e.g. read-only or invalid fields)
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

      if (currentLatestVisit?.Sf_Id) {
        const visitPayload = {
          Sf_Id: currentLatestVisit.Sf_Id,
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

      // Update local BeatDay__c record in both online and offline states
      if (beatDayId) {
        const beatdayPayload = {
          Sf_Id: beatDayId,
          ...beatDayFields,
          operation_type: "update",
          is_locally_changed: beatDaySuccess ? false : true,
          is_synced: beatDaySuccess ? true : false,
          last_modified: Date.now(),
        };
        console.log("SAVING LOCAL BEATDAY PAYLOAD ========", beatdayPayload);
        await UniversalUpdateInsert({
          ObjectName: 'BeatDay__c',
          Type: 'insert',
          data: beatdayPayload,
        });
      } else if (!connected) {
        throw new Error("Unable to identify today's Beat Day for offline sync.");
      }

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
        message: connected ? 'Day ended successfully in Salesforce!' : 'Day saved offline and will sync when internet returns.',
        type: 'success'
      }));
      setTimeout(async () => {
        navigation.navigate('TabbedScreen');
      }, 1000);

    } catch (e) {
      console.error("Error in handleEndDayClick:", e);
      dispatch(showToast({
        message: e?.message || 'Salesforce could not save End Day.',
        type: 'error'
      }));
    } finally {
      setIsEndingDay(false);
    }
  };


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
    // console.log('setting has Logged out true...............before logout')
    await AsyncStorage.setItem("hasLoggedOut", "true");
    let loggedoutValue = await AsyncStorage.getItem("hasLoggedOut")
    // console.log('has loggedout value................... in tabbed ', loggedoutValue)
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
      // console.log('USER FROM DB ::::', userFromDb);
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
      setTotalpscCount(grandTotalOrderQty);
      // setTotalpscCount(grandTotalOrderQty + grandTotalReturnQty);
      setFilteredVisits(visitsWithOrders);

      // console.log('Helllo gpt',JSON.stringify(visitsWithOrders))
      // 1️⃣0️⃣ Find completed visits safely
      // A locally checked-out visit may have VisitStatus__c set to Check Out
      // even when the checkout timestamp was not copied back to the local row.
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

      const completedCount = visitsWithOrders.filter(v => v.CheckInTime__c && v.CheckOutTime__c).length;

      const totalPaidAmount = Collection__c.reduce((sum, col) => sum + (Number(col.PaidAmount__c) || 0), 0);

      const visitAccountIds = Visits.map(v => v.AccountId__c || v.AccountId);
      const visitIds = Visits.map(v => v.Sf_Id);

      const relevantCompetitors = Competitor__c.filter(c => visitAccountIds.includes(c.Customer__c));

      const updatedStats = [
        { key: 'Total Visits', value: Visits.length },
        { key: 'Check In/Check Out', value: `${inProgressCount} / ${completedCount}` },
        { key: 'Spot Sales Placed', value: ordersPlacedCount },
      ];
      setOrdersPlacedCountTotal(ordersPlacedCount);

      if (userFromDb[0]?.DeveloperName === 'H_T_SR') {
        updatedStats.push({ key: 'Collection', value: `₹${totalPaidAmount}` });
      } else if (userFromDb[0]?.DeveloperName === 'H_T_SO') {
        updatedStats.push({ key: 'Competitors', value: relevantCompetitors.length });
      }

      setStats(updatedStats);


      const prepared = {
        Upcoming: [],
        "Check In": [],
        "Check Out": [],
      };

      // build orders-per-account map to compute propensity
      const ordersPerAccount = {};
      (Orders || []).forEach(o => {
        const acc = o.AccountId__c || o.AccountId || 'NO_ACC';
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
        const visitAccountId = v.AccountId__c || v.AccountId;
        const accountDetails =
          (accountData || []).find(acc => sameSalesforceId(acc.Sf_Id, visitAccountId));

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
        const ordersForAccount = (Orders || []).filter(o =>
          sameSalesforceId(o.AccountId__c || o.AccountId, accountDetails?.Sf_Id || visitAccountId)
        );
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
        const accountOrderCount = Object.entries(ordersPerAccount)
          .filter(([accountId]) => sameSalesforceId(accountId, accountDetails?.Sf_Id || visitAccountId))
          .reduce((sum, [, count]) => sum + count, 0);
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
          AccountId: visitAccountId || null,
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


      setCategorizedData(prepared);
      return {
        latestVisit,
        latestBeatDay: BeatDayRecordToday?.[0],
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
        colors={['#C9A24D', '#A67C2E']}
        style={styles.header}
      >
        <TouchableOpacity onPress={(() => { navigation.goBack() })}>
          <IonIcons name="chevron-back" size={24} color="#fff" style={{ marginLeft: 0 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>End Day Summary</Text>
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
          colors={['#C9A24D', '#A67C2E']}
          style={styles.profileCard}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userFromDbState[0]?.Name.trim()?.split(" ").slice(0, 2).map(word => word[0]).join("").toUpperCase()}</Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.userName}>{userFromDbState[0]?.Name}</Text>
            {/* <Text style={styles.userId}>Role: {userFromDbState[0]?.DeveloperName?.split('_')[1]}</Text> */}
            <Text style={styles.userDate}>{moment().format("DD MMM YYYY")}</Text>
          </View>
        </LinearGradient>
        {/* </View> */}

        {/* Stats grid */}
        {/* <View style={styles.statsGrid}>
          {stats.map(s => (
            <StatCard key={s.key} label={s.key} value={s.value} />
          ))}
        </View> */}

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 400 }}>

          <SubEndDay onUnvisitedOutletsLoaded={setUnvisitedVisitsState} />
          {/* <EndDayOrderDetails /> */}

          {/* Visits list */}
          {/* <View style={{ marginTop: 12, width: '100%', paddingBottom: 100 }}>
            <FlatList
              data={filteredVisits}
              keyExtractor={v => v.id}
              renderItem={({ item }) => <VisitAccordion visit={item} />}

            />
          </View> */}
        </ScrollView>
      </View>

      <RippleBackground
        rippleColor="#C9A24D"
        rippleCount={1}
        duration={3400}
        style={{ position: 'absolute', bottom: 40, right: 20 }}
      >
        <TouchableOpacity onPress={handleOpenEndDayModal} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}>
          <Text style={{ color: 'white', fontWeight: '500' }}>End Day</Text>
        </TouchableOpacity>
      </RippleBackground>



      {
        // userFromDbState[0]?.DeveloperName === 'H_T_ASO' && (
        //   <RippleBackground
        //     rippleColor="#1E3A8A"
        //     rippleCount={1}
        //     duration={3400}
        //     style={{ position: 'absolute', bottom: 40, left: 20 }}
        //   >
        //     <TouchableOpacity onPress={() => { navigation.navigate('ASOOrder') }} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}>
        //       {/* <TouchableOpacity onPress={() => { navigation.navigate('CloseDay') }} style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#C9A24D', borderRadius: 20 }}> */}
        //       <Text style={{ color: 'white', fontWeight: '500' }}>Suggested Spot Sales</Text>
        //     </TouchableOpacity>
        //   </RippleBackground>
        // )
      }

      <EndDayModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleEndDayClick}
        missedVisits={unvisitedVisitsState}
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
                  color="#C9A24D"
                />
                <Text style={styles.loaderText}>Logging out...</Text>
              </View>
            </View>
          </Modal>
        )
      }

      {
        isEndingDay && (
          <Modal visible={isEndingDay} transparent animationType="fade">
            <View style={styles.loaderOverlay}>
              <View style={styles.loaderContainer}>
                <Spinner
                  isVisible={isEndingDay}
                  size={29}
                  type="Wave"
                  color="#C9A24D"
                />
                <Text style={styles.loaderText}>Processing End Day...</Text>
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
    backgroundColor: '#C9A24D',
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
    backgroundColor: '#C9A24D',
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
  avatarText: { fontWeight: '700', color: '#A67C2E' },
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
