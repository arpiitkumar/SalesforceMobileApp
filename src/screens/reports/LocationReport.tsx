// SRAttendanceScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TextInput
} from 'react-native';
import FilterComponent from '../../components/FilterComponent'; // adjust path if needed
import HeaderMain from "../../components/HeaderMain";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import moment from 'moment';
import { showToast } from '../../redux/slices/toastSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

const LocationReport = () => {
  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat
  );
  // filter will be { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }
  const [filter, setFilter] = useState({ from: null, to: null }); // default All
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const dispatch = useDispatch();


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

  const getTransactionStatus = (visit, account) => {
    let transactionStatus = 'Upcoming';
    if (visit.CheckInTime__c && visit.CheckOutTime__c) {
      transactionStatus = 'Check Out';
    } else if (
      (visit.CheckInTime__c && !visit.CheckOutTime__c) ||
      visit.VisitStatus__c === 'Check In'
    ) {
      transactionStatus = 'Check In';
    }
    // only checked-in visits
    if (
      transactionStatus === 'Check Out' ||
      transactionStatus === 'Check In'
    ) {
      // checkin location
      const checkInLat = Number(
        visit.CheckInLocation__Latitude__s
      );
      const checkInLng = Number(
        visit.CheckInLocation__Longitude__s
      );
      // SAME ACCOUNT billing location
      const outletLat = Number(account.BillingLatitude);
      const outletLng = Number(account.BillingLongitude);
      const isValid =
        Number.isFinite(checkInLat) &&
        Number.isFinite(checkInLng) &&
        Number.isFinite(outletLat) &&
        Number.isFinite(outletLng);

      //  invalid/null/undefined/NaN
      if (!isValid) {
        return 'In Store';
      }

      // prevent 0,0 fake locations
      if (
        outletLat === 0 ||
        outletLng === 0 ||
        checkInLat === 0 ||
        checkInLng === 0
      ) {
        return 'In Store';
      }

      const distanceMeters = calculateDistanceInMeters(
        outletLat,
        outletLng,
        checkInLat,
        checkInLng
      );

      transactionStatus =
        distanceMeters <= 150
          ? 'In Store'
          : 'Remote';
    }

    return transactionStatus;
  };

  // helper: list of YYYY-MM-DD strings inclusive
  const getDatesBetween = (fromIso, toIso) => {
    const start = moment(fromIso, 'YYYY-MM-DD');
    const end = moment(toIso, 'YYYY-MM-DD');
    const arr = [];
    let m = start.clone();
    while (m.isSameOrBefore(end, 'day')) {
      arr.push(m.format('YYYY-MM-DD'));
      m = m.add(1, 'day');
    }
    return arr;
  };
  const formatDuration = (startIso, endIso) => {
    if (!startIso) return '—';

    // 🔥 clean function (quotes remove)
    const clean = (val) =>
      typeof val === 'string' ? val.replace(/^"|"$/g, '') : val;

    const start = moment.parseZone(clean(startIso));
    const end = endIso
      ? moment.parseZone(clean(endIso))
      : moment(); // if no end, use now

    if (!start.isValid() || !end.isValid()) return '—';

    const diff = moment.duration(end.diff(start));

    const hours = Math.floor(diff.asHours());
    const minutes = diff.minutes();
    const seconds = diff.seconds();

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // const formatTime = (date) => {
  //   if (!date) return '—';
  //   console.log('formatTime input ->', date);
  //   let cleanDate = typeof date === 'string'
  //     ? date.replace(/^"|"$/g, '') // remove starting & ending quotes
  //     : date;
  //  
  //   const m = moment.parseZone(cleanDate);
  //   return m.isValid() ? m.local().format('hh:mm A') : '—';
  // };
  const formatTime = (date) => {
    if (!date) return '—';
    try {
      let cleanDate =
        typeof date === 'string'
          ? date.replace(/^"|"$/g, '').trim()
          : date;

      cleanDate = cleanDate.replace(
        /([+-]\d{2})(\d{2})$/,
        '$1:$2'
      );
      // parse with timezone support
      const m = moment.parseZone(cleanDate);
      // valid check
      if (!m.isValid()) return '—';

      return m.local().format('hh:mm A');
    } catch (e) {
      return '—';
    }
  };
  const normalizeDate = (date) => {
    if (!date) return null;
    let cleanDate =
      typeof date === 'string'
        ? date.replace(/^"|"$/g, '').trim()
        : date;
    // +0000 => +00:00
    cleanDate = cleanDate.replace(
      /([+-]\d{2})(\d{2})$/,
      '$1:$2'
    );
    return cleanDate;
  };
  // ---------- REPLACE EXISTING fetchAttendanceData WITH THIS ----------
  const buildLocationRowsForFilter = async (appliedFilter) => {
    setLoading(true);
    try {
      // 1) load required data (single network / DB calls)
      const loggedInUser = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
      if (!Array.isArray(loggedInUser) || loggedInUser.length === 0) {
        dispatch(showToast({ message: 'No logged in user found', type: 'error' }));
        setAttendanceData([]);
        setLoading(false);
        return;
      }
      const userSfId = loggedInUser[0].Sf_Id;

      const accountData = await UniversalUpdateInsert({ ObjectName: 'Account', Type: 'get' });
      const RoutePlans = await UniversalUpdateInsert({
        ObjectName: 'Route_Plans__c',
        Type: 'get',
        filters: [{ field: 'Assigned_To__c', value: userSfId }],
      });

      // find active plan(s) that overlap the month(s) we care about:
      // For simplicity, pick the first route plan that contains at least one of the dates we will process.
      // Build list of dates to check:
      let dateList = [];
      if (appliedFilter && appliedFilter.from && appliedFilter.to) {
        dateList = getDatesBetween(appliedFilter.from, appliedFilter.to); // YYYY-MM-DD strings
      } else if (dateStore) {
        // fallback to redux selected single date (existing behaviour)
        dateList = [dateStore];
      } else {
        dateList = [moment().format('YYYY-MM-DD')];
      }

      // If no routeplans, bail
      if (!Array.isArray(RoutePlans) || RoutePlans.length === 0) {
        dispatch(showToast({ message: 'No Route Plans found', type: 'error' }));
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      // Preload BeatDays and Visits
      const BeatDays = await UniversalUpdateInsert({ ObjectName: 'BeatDay__c', Type: 'get' });
      const Visit = await UniversalUpdateInsert({ ObjectName: 'Visit', Type: 'get' });

      // We'll construct rows here
      const rows = [];

      // For each date in dateList, find a route plan active on that date (if any) and then the beatDay(s)
      for (const dateStr of dateList) {
        // Find route plan(s) that include dateStr (compare inclusive)
        const dateObj = new Date(dateStr);
        const plansForDate = RoutePlans.filter((rp) => {
          if (!rp.Start_Date__c || !rp.End_Date__c) return false;
          const sd = new Date(rp.Start_Date__c);
          const ed = new Date(rp.End_Date__c);
          return sd <= dateObj && ed >= dateObj;
        });

        if (!plansForDate || plansForDate.length === 0) {
          // no plan for this date — skip
          continue;
        }

        // Use first matching plan (if you want multiple plan support, iterate plansForDate)
        const activePlan = plansForDate[0];

        // Find beat days for this plan + this date
        const beatDaysForDate = BeatDays.filter((b) => {
          // BeatDate__c should be YYYY-MM-DD in your dataset
          return b.Tour_Plan__c === activePlan.Sf_Id && b.BeatDate__c === dateStr;
        });

        if (!beatDaysForDate || beatDaysForDate.length === 0) {
          // no beat day for this date
          continue;
        }

        // For each beatDay, find visits whose BeatDay__c === beatDay.Sf_Id
        for (const bd of beatDaysForDate) {
          const visitsForBeatDay = Visit.filter((v) => v.BeatDay__c === bd.Sf_Id);

          // Map each visit to a row
          const uniqueVisitIds = new Set();
          for (const v of visitsForBeatDay) {
            if (!v.AccountId__c && !v.AccountId) continue; // skip if no account
            //  skip duplicate Sf_Id
            if (uniqueVisitIds.has(v.Sf_Id)) continue;
            // mark as seen
            uniqueVisitIds.add(v.Sf_Id);

            const account = accountData.find((a) => a.Sf_Id === (v.AccountId__c || v.AccountId)) || {};
            if (
              !account ||
              (
                account.Active__c === false &&
                !v?.Add_New_Retailer_Visit__c
              )
            ) {
              continue;
            }

            const transactionStatus = getTransactionStatus(
              v,
              account
            );

            const checkIn = v.CheckInTime__c || null;

            const checkOut = v.CheckOutTime__c || null;

             const timeSpent =
              (checkIn && checkOut)
                ? formatDuration(checkIn, checkOut)
                : (
                  checkIn &&
                  !checkOut &&
                  transactionStatus === 'Check In'
                )
                  ? formatDuration(checkIn, null)
                  : '—';


            // console.log(checkOut)
            rows.push({
              id: v.Sf_Id || v.id || `${v.AccountId}-${v.Sf_Id || ''}-${dateStr}`,
              date: dateStr,
              outletName: account.Name || account.name || 'Unknown Outlet',
              partyCode: account.Party_Code__c || account.name || 'Unknown Outlet',
              transactionStatus,
              startTime: formatTime(checkIn),
              endTime: formatTime(checkOut),
              timeSpent,
              rawVisit: v,
              account,
            });
          }
        }
      } // end for dates
      // Sort rows by date DESC then by startTime
      // rows.sort((a, b) => {
      //   if (a.date === b.date) {
      //     // put completed/in-progress first by start time
      //     const ta = a.startTime === '—' ? '00:00 AM' : a.startTime;
      //     const tb = b.startTime === '—' ? '00:00 AM' : b.startTime;
      //     const ma = moment(ta, 'hh:mm A');
      //     const mb = moment(tb, 'hh:mm A');
      //     return ma - mb;
      //   }
      //   return moment(b.date, 'YYYY-MM-DD') - moment(a.date, 'YYYY-MM-DD');
      // });
      rows.sort((a, b) => {
        // same date → sort by actual check-in time
        if (a.date === b.date) {
          // const aTime = a.rawVisit?.CheckInTime__c
          //   ? moment.parseZone(a.rawVisit.CheckInTime__c)
          //   : null;
          // const bTime = b.rawVisit?.CheckInTime__c
          //   ? moment.parseZone(b.rawVisit.CheckInTime__c)
          //   : null;
          const aTime = a.rawVisit?.CheckInTime__c
            ? moment.parseZone(normalizeDate(a.rawVisit.CheckInTime__c))
            : null;

          const bTime = b.rawVisit?.CheckInTime__c
            ? moment.parseZone(normalizeDate(b.rawVisit.CheckInTime__c))
            : null;

          if (!aTime && !bTime) return 0;
          if (!aTime) return 1;
          if (!bTime) return -1;

          return aTime - bTime; // 🔥 earliest first (top pe)
        }
        // different date → latest date first
        return moment(b.date, 'YYYY-MM-DD') - moment(a.date, 'YYYY-MM-DD');
      });

      setAttendanceData(rows);
      setFilteredData(rows); // reset search when filter changes
      setSearchText('');
    } catch (err) {
      console.warn('buildLocationRowsForFilter error', err);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  // ---------- end replacement ----------

  useEffect(() => {
    console.log('LocationReport: filter changed ->', filter, ' dateStore ->', dateStore);
    buildLocationRowsForFilter(filter);
  }, [filter, dateStore]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredData(attendanceData);
      return;
    }
    const query = searchText.toLowerCase();
    const result = attendanceData.filter((item) =>
      item.outletName?.toLowerCase().includes(query) ||
      item.transactionStatus?.toLowerCase().includes(query) ||
      item.startTime?.toLowerCase().includes(query) ||
      item.endTime?.toLowerCase().includes(query)
    );

    setFilteredData(result);
  }, [searchText, attendanceData]);




  const handleApply = (payload) => {
    // payload = { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }
    console.log('Filter applied in screen ->', payload);
    setFilter(payload);
  };

  const TableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.th, { flex: 0.25 }]}>Outlet Name</Text>
      <Text style={[styles.th, { flex: 0.25 }]}>Status</Text>
      <Text style={[styles.th, { flex: 0.25 }]}>Start Time</Text>
      <Text style={[styles.th, { flex: 0.25 }]}>End Time</Text>
      <Text style={[styles.th, { flex: 0.25 }]}>Time Spent</Text>
    </View>
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName="Location Report" />
      </View>
      {/* <Text style={styles.header}>SR Attendance</Text> */}

      <FilterComponent onApply={handleApply} initial={{ from: null, to: null }} visiblePresets={['today', 'last7', 'thisMonth', 'yesterday']} initialPreset='thisMonth' />


      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search outlet / status / time"
          placeholderTextColor="#9AA6B2"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.currentFilter}>
        <Text style={styles.currentFilterText}>
          Current Filter:
          {!filter.from && !filter.to ? ' All' : ` From: ${filter.from} • To: ${filter.to}`}
        </Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 24 }} />
        ) : (<>
          <TableHeader />

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item, index }) => (
              <View style={[styles.tableRow, index % 2 !== 0 && styles.tableRowAlt]}>
                <Text style={[styles.td, { flex: 0.3 }]}>{item.outletName} <Text style={{ fontSize: 9 }}>(#{item.partyCode})</Text></Text>
                <Text style={[styles.td, { flex: 0.25 }]}>{item.transactionStatus}</Text>
                <Text style={[styles.tdMono, { flex: 0.2 }]}>{item.startTime}</Text>
                <Text style={[styles.tdMono, { flex: 0.2 }]}>{item.endTime}</Text>
                <Text style={[styles.tdMono, { flex: 0.25 }]}>{item.timeSpent}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', marginTop: 20, color: '#7B8A99' }}>
                No Visit Records found
              </Text>
            }
          />
        </>

        )}
      </View>
    </SafeAreaProvider>
  );
};

export default LocationReport;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#A67C2E',
  },
  container: { flex: 1, backgroundColor: '#F6F8FB', padding: 16 },
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#ffffff",
  },
  headerContainer: {
    backgroundColor: "transparent",
  },
  header: { fontSize: 22, fontWeight: '700', color: '#1F1D1A', marginBottom: 12 },
  currentFilter: { marginHorizontal: 16, marginTop: 6, marginBottom: 12, backgroundColor: 'rgba(255,255,255,1)', padding: 6, paddingHorizontal: 10, borderRadius: 10 },
  currentFilterText: { fontSize: 12, color: '#1F1D1A', fontWeight: '600' },

  row: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  name: { fontSize: 16, fontWeight: '700', color: '#1F1D1A' },
  meta: { fontSize: 12, color: '#7B8A99', marginTop: 4 },
  status: { fontWeight: '700' },
  present: { color: '#1C8E3A' },
  absent: { color: '#B3261E' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
    borderRadius: 10,
    marginBottom: 6,
  },

  th: {
    // borderWidth:1,
    color: '#fff',
    fontSize: 12,
    textAlign: 'left',
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
    elevation: 1,
  },

  tableRowAlt: {
    backgroundColor: '#F5F8FF',
  },

  td: {
    // color: '#1F1D1A',
    color: '#333',
    fontWeight: '600',
    fontSize: 11,

  },

  tdMono: {
    // color: '#1F1D1A',
    // backgroundColor:'red',
    // borderWidth:1,
    // fontSize: 12,
    color: '#333',
    fontWeight: '600',
    fontSize: 11,
    // fontFamily: 'monospace',
  },
  searchBox: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 2,
  },

  searchIcon: {
    fontSize: 16,
    marginRight: 6,
  },

  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1F1D1A',
    fontWeight: '600',
  },

});