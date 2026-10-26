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

  // helper: duration string H:M:S or if end is null, duration from start -> now
  // const formatDuration = (startIso, endIso) => {
  //   const start = moment(startIso);
  //   const end = endIso ? moment(endIso) : moment(); // if no end, use now for in-progress
  //   if (!start.isValid() || !end.isValid()) return '—';
  //   const diff = moment.duration(end.diff(start));
  //   const hours = Math.floor(diff.asHours());
  //   const minutes = diff.minutes();
  //   const seconds = diff.seconds();
  //   return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  // };
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


  // const fetchAttendanceData = async () => {
  //   setLoading(true);
  //   try {

  //     const loggedInUser = await UniversalUpdateInsert({
  //       ObjectName: "User",
  //       Type: "get"
  //     });

  //     console.log('logged in user', loggedInUser)


  //     //new part


  //     const accountData = await UniversalUpdateInsert({
  //       ObjectName: "Account",
  //       Type: "get",
  //     });


  //     const RoutePlans = await UniversalUpdateInsert({
  //       ObjectName: "Route_Plans__c",
  //       Type: "get",
  //       filters: [
  //         { field: 'Assigned_To__c', value: loggedInUser[0].Sf_Id },
  //       ],

  //     });

  //     const todayForRoutePlans = new Date();
  //     const firstDayOfMonth = new Date(
  //       todayForRoutePlans.getFullYear(),
  //       todayForRoutePlans.getMonth(),
  //       1
  //     );
  //     const lastDayOfMonth = new Date(
  //       todayForRoutePlans.getFullYear(),
  //       todayForRoutePlans.getMonth() + 1,
  //       0
  //     );

  //     // Filter the route plans that are active during the current month
  //     const currentMonthRoutePlans = RoutePlans.filter((plan) => {
  //       const startDate = new Date(plan.Start_Date__c);
  //       const endDate = new Date(plan.End_Date__c);
  //       return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
  //     });

  //     //console.log("currren month route plans.........................", currentMonthRoutePlans);


  //     if (currentMonthRoutePlans.length === 0) {
  //       dispatch(showToast({ message: 'There is no Route Plan for current month', type: 'error' }));
  //     }

  //     const activePlanId = currentMonthRoutePlans[0].Sf_Id;
  //     // Beat Day for that exact calendar day:

  //     const BeatDays = await UniversalUpdateInsert({
  //       ObjectName: "BeatDay__c",
  //       Type: "get",
  //     });



  //     const beatDayForDate = BeatDays.find(
  //       (b) =>
  //         b.Tour_Plan__c === activePlanId && // belongs to the route plan
  //         b.BeatDate__c === dateStore // is for the selected date
  //     );


  //     if (!beatDayForDate) {
  //       console.log('No Beat Day found for date', dateStore);

  //       return;
  //     }
  //     //console.log("BEAT DAYS FOR THE DATE |||||||||", beatDayForDate);

  //     const getBeatCode = await UniversalUpdateInsert({
  //       ObjectName: "Beat__c",
  //       Type: "get",
  //       filters: [
  //         {
  //           field: "Sf_Id",
  //           value: beatDayForDate?.Beat__c,
  //         },
  //       ],
  //     });

  //     const beatId = beatDayForDate?.Beat__c ?? null;
  //     const beatName = beatDayForDate?.Beat__Name ?? null;

  //     const Visit = await UniversalUpdateInsert({
  //       ObjectName: "Visit",
  //       Type: "get",
  //       filters: [
  //         {
  //           field: "SoftDelete",
  //           value: false,
  //         },
  //       ],
  //     });

  //     const filtered = Visit.filter(
  //       (v) => v.BeatDay__c === beatDayForDate.Sf_Id
  //     );


  //     const today = moment(dateStore).format("YYYY-MM-DD");


  //     const categorized = {
  //       Upcoming: [],
  //       Completed: [],
  //       "In Progress": [],
  //     };



  //     const today2 = moment().startOf('day');

  //     // const accountsWithOrderToday = new Set(
  //     //   Orders.filter(ord => {
  //     //     const dateStr =
  //     //       ord.OrderSubmissionTime__c ||
  //     //       ord.CreatedDate ||
  //     //       ord.EffectiveDate;

  //     //     if (!ord.AccountId || !dateStr) return false;

  //     //     // 🔑 Normalize Salesforce + ISO + Z dates
  //     //     const orderDate = moment(dateStr).local().startOf('day');

  //     //     return orderDate.isSame(today2, 'day');
  //     //   }).map(ord => ord.AccountId)
  //     // );

  //     // const getTodayOrderColor = (accountId) => {
  //     //   return accountsWithOrderToday.has(accountId) ? "green" : "red";
  //     // };

  //     filtered.forEach((v) => {
  //       if (!v.AccountId) return;

  //       const accountDetails = accountData.find(
  //         (a) => a.Sf_Id === v.AccountId
  //       );

  //       const base = {
  //         name: accountDetails?.Name || "",
  //         tier: accountDetails?.Class__c,
  //         target: accountDetails?.Channel__c,
  //         lastOrder: "5 days",
  //         ProductiveCall__c: v.ProductiveCall__c,
  //         propensity: "70%",
  //         AccountId: v.AccountId,
  //         sfId: v.Sf_Id,
  //         CheckInTime__c: v.CheckInTime__c,
  //         CheckOutTime__c: v.CheckOutTime__c,
  //         Phone: accountDetails?.Phone,
  //         BillingAddress: accountDetails?.BillingAddress,
  //         OTPVerified__c: accountDetails?.OTPVerified__c,
  //         CreditLimit__c: accountDetails?.CreditLimit__c,
  //         Add_New_Retailer_Visit__c: v?.Add_New_Retailer_Visit__c,
  //         VisitStatus__c: v.VisitStatus__c,
  //         CheckInLocation__Longitude: v.CheckInLocation__Longitude__s,
  //         CheckInLocation__Latitude: v.CheckInLocation__Latitude__s,
  //         CheckOutLocation__Longitude: v.CheckOutLocation__Longitude__s,
  //         CheckOutLocation__Latitude: v.CheckOutLocation__Latitude__s,
  //         BillingLatitude: accountDetails?.BillingLatitude,
  //         BillingLongitude: accountDetails?.BillingLongitude,
  //         BeatDay__c: v?.BeatDay__c,
  //         Beat__c: v?.Beat__c,
  //         transactionStatus: '',
  //         // nonBuyingIndicatorColor: getTodayOrderColor(v.AccountId),
  //         code: accountDetails.PartyCode__c,
  //         subchannel1: accountDetails.SubChannel1__c,
  //         subchannel2: accountDetails.SubChannel2__c,
  //       };

  //       if (v.CheckInTime__c && v.CheckOutTime__c) {
  //         categorized.Completed.push(base);
  //         base.transactionStatus = 'Completed'
  //       } else if (
  //         (v.CheckInTime__c && !v.CheckOutTime__c) ||
  //         v.VisitStatus__c === "In Progress"
  //       ) {
  //         base.transactionStatus = 'In Progress'
  //         categorized["In Progress"].push(base);
  //         // console.log('INPROGRESS VISIT>.....................', base)

  //       } else {
  //         base.transactionStatus = 'Upcoming'
  //         // base.nonBuyingIndicatorColor = 'black'
  //         // categorized.Upcoming.push(base);
  //       }
  //     });

  //     console.log('categorized;;;;;;;;;;;;', categorized)

  //     //new part



  //     const attendanceRecords = await UniversalUpdateInsert({
  //       ObjectName: 'Attendant__c',
  //       Type: 'get',
  //       filters: [
  //         {
  //           field: "User__c",
  //           value: loggedInUser[0].Sf_Id,
  //         },
  //       ],
  //     });

  //     let records = Array.isArray(attendanceRecords) ? attendanceRecords : [];

  //     // 🔹 Apply date filter if present
  //     if (filter.from || filter.to) {
  //       records = records.filter((item) => {
  //         const attendanceDate = moment(item.AttendanceDate__c, 'YYYY-MM-DD');
  //         if (filter.from && filter.to) {
  //           return attendanceDate.isBetween(filter.from, filter.to, 'day', '[]');
  //         }
  //         if (filter.from) {
  //           return attendanceDate.isSameOrAfter(filter.from, 'day');
  //         }
  //         if (filter.to) {
  //           return attendanceDate.isSameOrBefore(filter.to, 'day');
  //         }
  //         return true;
  //       });
  //     }

  //     // 🔹 Map to table rows
  //     const mapped = records.map((item) => ({
  //       id: item.id || item.Sf_Id,
  //       date: moment(item.AttendanceDate__c).format('DD MMM YYYY'),
  //       day: moment(item.AttendanceDate__c).format('dddd'),
  //       loginTime: item.StartTime__c
  //         ? moment(item.StartTime__c).format('hh:mm A')
  //         : '—',
  //       logoutTime: item.EndTime__c
  //         ? moment(item.EndTime__c).format('hh:mm A')
  //         : '—',
  //       status: item.AttendanceStatus__c
  //     }));

  //     setAttendanceData(mapped);
  //   } catch (e) {
  //     console.log('Attendance fetch error', e);
  //     setAttendanceData([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };


  // const formatTime = (date) => {
  //   if (!date) return '—';
  //   console.log(date)
  //   const m = moment(date, [
  //     moment.ISO_8601,             
  //     'YYYY-MM-DDTHH:mm:ss.SSSZ',  
  //     'YYYY-MM-DDTHH:mm:ss.SSSZZ',
  //     'YYYY-MM-DDTHH:mm:ssZZ'       
  //   ], true);
  //   return m.isValid() ? m.format('hh:mm A') : '—';
  // };
  const formatTime = (date) => {
    if (!date) return '—';
    // console.log(date);
    // 🔥 handle quoted string
    let cleanDate = typeof date === 'string'
      ? date.replace(/^"|"$/g, '') // remove starting & ending quotes
      : date;
    const m = moment.parseZone(cleanDate);
    return m.isValid() ? m.local().format('hh:mm A') : '—';
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
            // Determine transactionStatus similar to your logic:
            let transactionStatus = 'Upcoming';
            if (v.CheckInTime__c && v.CheckOutTime__c) transactionStatus = 'Check Out';
            else if ((v.CheckInTime__c && !v.CheckOutTime__c) || v.VisitStatus__c === 'Check In') transactionStatus = 'Check In';

            const checkIn = v.CheckInTime__c || null;
            const checkOut = v.CheckOutTime__c || null;


            let distanceMeters = null;
            // compute time spent (H:M:S)
            const timeSpent = (checkIn && checkOut) ? formatDuration(checkIn, checkOut) : (checkIn && !checkOut && transactionStatus === 'Check In' ? formatDuration(checkIn, null) : '—');

            if (transactionStatus === 'Check Out' || transactionStatus === 'Check In') {
              const lat = v.CheckInLocation__Latitude__s;
              const lng = v.CheckInLocation__Longitude__s;

              const billingLat = account.BillingLatitude;
              const billingLng = account.BillingLongitude;

              if (
                lat != null && lng != null &&
                billingLat != null && billingLng != null
              ) {
                const dist = calculateDistanceInMeters(
                  parseFloat(billingLat),
                  parseFloat(billingLng),
                  parseFloat(lat),
                  parseFloat(lng)
                );

                distanceMeters = Math.round(dist);

                if (dist <= 150) {
                  transactionStatus = 'In Store';
                } else {
                  transactionStatus = 'Remote';
                }
              }
            }

            // console.log(checkOut)
            rows.push({
              id: v.Sf_Id || v.id || `${v.AccountId__c || v.AccountId || ''}-${v.Sf_Id || ''}-${dateStr}`,
              date: dateStr,
              outletName: account.Name || account.name || 'Unknown Outlet',
              partyCode: account.Party_Code__c || account.name || 'Unknown Outlet',
              transactionStatus,
              startTime: formatTime(checkIn),
              endTime: formatTime(checkOut),
              timeSpent,
              distanceMeters,
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
          const aTime = a.rawVisit?.CheckInTime__c
            ? moment.parseZone(a.rawVisit.CheckInTime__c)
            : null;
          const bTime = b.rawVisit?.CheckInTime__c
            ? moment.parseZone(b.rawVisit.CheckInTime__c)
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
                <Text style={[styles.td, { flex: 0.25 }]}>
                  {item.transactionStatus}

                  {(item.transactionStatus === 'In Store' || item.transactionStatus === 'Remote')
                    && item.distanceMeters != null && (
                      <Text style={{ fontSize: 9, color: '#666' }}>
                        {"\n"}({item.distanceMeters.toLocaleString()} m)
                      </Text>
                    )}
                </Text>
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