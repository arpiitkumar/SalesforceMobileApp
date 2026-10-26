import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
} from "react-native";
import Ionicons from "../components/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import MarketWorkModal from "../components/modal/MarketWorkModal";
import DBVisitModal from "../components/modal/DBVisitModal";
import ProspectingModal from "../components/modal/ProspectingModal";
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import HeaderMain from "../components/HeaderMain";
import moment from "moment";
import { RootState } from '../redux/store';
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { setSelectedBeatDay } from '../redux/slices/selectedBeatDaySlice';
import { isInternetAvailable } from '../utils/networkUtils';
import { saveToApi } from '../utils/dataPost/apiService';
import { saveLocally } from '../utils/dataPost/localService';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { PlaceId_var } from '../../config'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSoVisitStatus } from '../redux/slices/soVisitSlice'
import { Alert, Platform, ToastAndroid } from "react-native";
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import { syncAttendanceRecords } from '../database/dbService/AllDataSync';



import { showToast } from '../redux/slices/toastSlice';
// Only these gradient colors
export const Gradients = {
  primary: ['#C9A24D', '#A67C2E', '#C9A24D'],
};

const distributors = [
  {
    id: 1,
    name: "Maa Ambey Trading Co.Pvt. Ltd.",
    beats: [
      { name: "A K Mukherjee Road", retailers: 8 },
      { name: "Ahallanager", retailers: 4 },
      { name: "Amtala", retailers: 5 },
      { name: "Anandapur", retailers: 5 },
    ],
    srNames: ["SR Amit", "SR Rakesh", "SR Neha"],
  },
  {
    id: 2,
    name: "Suman Trading Company",
    beats: [
      { name: "Ashok Nagar-2", retailers: 13 },
      { name: "Garia", retailers: 7 },
      { name: "Howrah", retailers: 12 },
    ],
    srNames: ["SR Manoj", "SR Kiran"],
  },
];

const ACTIVITY_LIST = [
  { label: "Admin", icon: "settings-outline" },
  { label: "Individual Market Work", icon: "walk-outline" },
  { label: "Market and DB Visit", icon: "business-outline" },
  { label: "Meetings", icon: "people-outline" },
  { label: "Prospecting/Vacant SR DB-Visit", icon: "search-outline" },
  { label: "Weekly-Off/Holiday", icon: "cafe-outline" },
];

const today = new Date().toLocaleDateString();

const SelectActivity = () => {
  const { apiFetch } = useApiFetch()
  const navigation = useNavigation();
  const [showAddNewModal, setShowAddNewModal] = useState(false);
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [showDBVisitModal, setShowDBVisitModal] = useState(false);
  const [showProspectingModal, setShowProspectingModal] = useState(false)
  const [showAddNewButton, setShowAddNewButton] = useState(true);

  const [selectedBeat, setSelectedBeat] = useState(null);
  const [selectedSR, setSelectedSR] = useState(null);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([])

  const [todaysDate, setTodaysDate] = useState("");
  const [selectedBeatName, setSelectedBeatName] = useState(null);
  const [beatDaysId, setBeatDaysId] = useState(null);
  const [selecteBeatId, setSelecteBeatId] = useState(null);
  const [accountDataList, setAccountDataList] = useState([]);
  const [categorizedData, setCategorizedData] = useState([]);
  const [showdataMap, setShowdataMap] = useState([]);
  const [loading, setLoading] = useState(false)
  const [isTodayDateSelected, setIsTodayDateSelected] = useState('')

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const searchParam = useSelector((state: RootState) => state.search.searchParam);


  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat
  );
  const auth = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();


  const generateRandomOrderNumber = () => {
    const timestamp = Date.now(); // current time in ms
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
    return `ORD-${timestamp}-${randomSuffix}`;
  };

  const VISIT_TEMPLATES = {
    Admin: {
      VisitType__c: "Admin",
      RevisedMTPType__c: "Admin",
      VisitStatus__c: "Planned",
      AdHocVisit__c: true,
      PJPOutlet__c: false,
      NonPjpOutlet__c: true,
    },
    Meetings: {
      VisitType__c: "Meetings",
      RevisedMTPType__c: "Meetings",
      VisitStatus__c: "Planned",
      AdHocVisit__c: true,
      PJPOutlet__c: false,
      NonPjpOutlet__c: true,
    },
    "Prospecting/Vacant SR DB-Visit": {
      VisitType__c: "Prospecting/Vacant SR DB-Visit",
      RevisedMTPType__c: "Prospecting/Vacant SR DB-Visit",
      VisitStatus__c: "Planned",
      AdHocVisit__c: true,
      PJPOutlet__c: false,
      NonPjpOutlet__c: true,
    },
    "Weekly-Off/Holiday": {
      VisitType__c: "Weekly-off/Holiday",
      RevisedMTPType__c: "Weekly-off/Holiday",
      VisitStatus__c: "Planned",
      AdHocVisit__c: true,
      PJPOutlet__c: false,
      NonPjpOutlet__c: true,
    },
    // any others…
  };



  const handleSubmit = async (visitType) => {

    try {
      setLoading(true);
      console.log("into handle submit", visitType)
      // 1. Grab the template for this type
      const template = VISIT_TEMPLATES[visitType];
      if (!template) {
        console.warn(`No VISIT_TEMPLATES entry for "${visitType}"`);
        return;
      }

      // 2. Build the full payload
      const userIdVal = users[0]?.Sf_Id || users[0]?.Id || '';
      const uniqueId = `${userIdVal}-${template.VisitType__c}-${dateStore}`;

      // Check if this combination already exists in local DB
      const existing = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [
          { field: "Mobile_Unique_Id__c", value: uniqueId },
          { field: "SoftDelete", value: false }
        ],
      });
      // console.log('existing', existing)
      if (existing && existing.length > 0) {
        setLoading(false);
        dispatch(showToast({
          message: `This activity is already registered for today!`,
          type: 'warning'
        }));
        return; // skip creation entirely
      }

      const visitPayload = {
        ...template,
        BeatDay__c: beatDaysId,
        VisitDate__c: dateStore,
        PlaceId__c: PlaceId_var,             // if common
        PlannedVisitStartTime: new Date().toISOString(),    // if common
        Mobile_Unique_Id__c: uniqueId,
      };

      console.log("THIS IS VISIT PAYLOAD::::", visitPayload)
      // 3. Sync to API / local as before
      let sfId, isSynced = false;
      const connected = await isInternetAvailable();
      if (connected) {
        try {
          console.log("INTO THE CONNECTED")

          const { sfId: gen } = await saveToApi(apiFetch, "Visit", visitPayload);
          sfId = gen; isSynced = true;
          console.log('saved to api-------------------------')
          console.log('VISIT SAVED ONLINE...')
          // dispatch(showToast({
          //   message: `Visit synced ONLINE for ${sfId}`,
          //   type: 'success'
          // }));
        } catch (err) {
          const errMsg = err.message || '';
          if (errMsg.includes('DUPLICATE_VALUE') || errMsg.includes('duplicate value found')) {
            console.log(`⚠️ Skip local save for selectactivity because it is duplicate on server:`, errMsg);
            setLoading(false);
            dispatch(showToast({
              message: `This activity is already registered on the server!`,
              type: 'warning'
            }));
            return; // 🚀 skip entirely
          }
          console.log('VISIT DID NOT SAVE ONLINE...', err)
          sfId = `local-${Date.now()}`; isSynced = false;
        }
      } else {
        sfId = `local-${Date.now()}`; isSynced = false;
      }

      console.log('this is the SF ID THAT IS STOERD-----', sfId)
      await saveLocally("Visit", visitPayload, sfId, isSynced);

      // 4. UI update
      handleAddActivity(visitType);
      console.log("Visit stored:", { visitType, sfId, isSynced, visitPayload });

      dispatch(showToast({
        message: `Activity added successfully!`,
        type: 'success'
      }));
      setRefreshTrigger(prev => prev + 1);


    } catch (err) {
      dispatch(showToast({
        message: `Activity submit failed...`,
        type: 'success'
      }));
      console.error(" Unexpected error in handleSubmit:", err);
    } finally {
      setLoading(false);
    }
  };


  useFocusEffect(
    useCallback(() => {
      const dateNow = moment().format("YYYY-MM-DD");
      const isTodayOrTomorrow =
        moment(dateStore).isSame(dateNow, 'day') ||
        moment(dateStore).isSame(moment(dateNow).add(1, 'day'), 'day');
      setTodaysDate(dateNow);
      setIsTodayDateSelected(isTodayOrTomorrow);


      const fetchVisits = async () => {
        try {
          // 1) Users
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });


          if (!result || !Array.isArray(result)) {
            // showToast("Users fetch failed", "Unable to load users.");
            dispatch(showToast({ message: 'Users fetch failed', type: 'error' }));
            setUsers([]); // avoid undefined
          } else setUsers(result);


          // console.log("------------------reached here----------------------------f---")

          // 2) Accounts
          const accountData = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
          });
          if (!accountData || !Array.isArray(accountData)) {
            // showToast("Accounts fetch failed", "Unable to load accounts.");
            dispatch(showToast({ message: 'Accounts fetch failed', type: 'error' }));
            setAccountDataList([]);
          } else setAccountDataList(accountData);

          // 3) Route plans
          const RoutePlans = await UniversalUpdateInsert({
            ObjectName: "Route_Plans__c",
            Type: "get",
            filters: [
              { field: 'Assigned_To__c', value: result[0].Sf_Id },
            ],

          });

          if (!RoutePlans || !Array.isArray(RoutePlans) || RoutePlans.length === 0) {
            // no route plans at all
            // showToast(
            //   "No route plans",
            //   "There are no route plans. Please create a route plan."
            // );
            dispatch(showToast({ message: 'There are no route plans. Please create a route plan.', type: 'error' }));
            console.log('There are no route plans. Please create a route plan.')
            setShowAddNewButton(false)
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }

          // compute selected month boundaries 
          const todayForRoutePlans = dateStore ? new Date(dateStore) : new Date();
          const firstDayOfMonth = new Date(
            todayForRoutePlans.getFullYear(),
            todayForRoutePlans.getMonth(),
            1
          );
          const lastDayOfMonth = new Date(
            todayForRoutePlans.getFullYear(),
            todayForRoutePlans.getMonth() + 1,
            0
          );

          // Filter the route plans that are active during the selected month
          const currentMonthRoutePlans = RoutePlans.filter((plan) => {
            // protect against bad/missing dates
            if (!plan?.Start_Date__c || !plan?.End_Date__c) return false;
            const startDate = new Date(plan.Start_Date__c);
            const endDate = new Date(plan.End_Date__c);
            return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
          });

          if (!currentMonthRoutePlans || currentMonthRoutePlans.length === 0) {

            dispatch(showToast({
              message: `No route plans active between ${firstDayOfMonth
                .toISOString()
                .slice(0, 10)} and ${lastDayOfMonth.toISOString().slice(0, 10)}.`, type: 'error'
            }));
            setShowAddNewButton(false)
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }

          // safe access
          const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;
          if (!activePlanId) {

            dispatch(showToast({ message: 'Active route plan missing Sf_Id — please check route plan records.', type: 'error' }));
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }

          // 4) BeatDays
          const BeatDays = await UniversalUpdateInsert({
            ObjectName: "BeatDay__c",
            Type: "get",
          });

          if (!BeatDays || !Array.isArray(BeatDays)) {
            // showToast("BeatDays fetch failed", "Unable to load BeatDays.");
            dispatch(showToast({ message: 'Unable to load BeatDays.', type: 'error' }));
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }

          const beatDayForDate = BeatDays.find(
            (b) =>
              b.Tour_Plan__c === activePlanId && // belongs to the route plan
              b.BeatDate__c === dateStore // is for the selected date
          );

          if (!beatDayForDate) {

            setShowAddNewButton(false)
            dispatch(showToast({ message: `No Beat Day found for date ${dateStore} in the selected route plan.`, type: 'error' }));
            // dispatch empty/clear selected beat day explicitly
            dispatch(setSelectedBeatDay(null));
            setSelectedBeatName(null);
            setSelecteBeatId(null);
            setBeatDaysId(null);
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }


          dispatch(setSelectedBeatDay(beatDayForDate));
          setSelectedBeatName(beatDayForDate?.Beat__Name);
          setSelecteBeatId(beatDayForDate?.Beat__c);
          setBeatDaysId(beatDayForDate?.Sf_Id);

          // 5) Visits
          const Visit = await UniversalUpdateInsert({
            ObjectName: "Visit",
            Type: "get",
            filters: [
              {
                field: "SoftDelete",
                value: false,
              },
            ],
          });

          if (!Visit || !Array.isArray(Visit)) {
            // showToast("Visits fetch failed", "Unable to load visits.");
            dispatch(showToast({ message: 'Unable to load visits.', type: 'error' }));
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }

          const filtered = Visit.filter((v) => v.BeatDay__c === beatDayForDate.Sf_Id);
          if (!filtered || filtered.length === 0) {
            setCategorizedData([]);
            setShowdataMap(new Map());
            return;
          }

          const dataFroShow = filtered.map((v) => {
            const accountDetails = accountData.find((a) => a.Sf_Id === v.AccountId);

            return {
              name: accountDetails?.Name || "",
              tier: accountDetails?.Class__c,
              target: accountDetails?.Channel__c,
              type: v?.VisitType__c || "",
              lastOrder: "5 days",
              propensity: "70%",
              AccountId: v.AccountId,
              sfId: v.Sf_Id,
              CheckInTime__c: v.CheckInTime__c,
              CheckOutTime__c: v.CheckOutTime__c,
              Phone: accountDetails?.Phone,
              BillingAddress: accountDetails?.BillingAddress,
              OTPVerified__c: accountDetails?.OTPVerified__c,
              CreditLimit__c: accountDetails?.CreditLimit__c,
              Status__c: v.Status__c,
              BillingLatitude__c: accountDetails?.BillingLatitude__c,
              BillingLongitude__c: accountDetails?.BillingLongitude__c,
              BeatDay__c: v?.BeatDay__c,
            };
          });

          setCategorizedData(dataFroShow);
          const maindata = groupByType(dataFroShow);
          setShowdataMap(maindata);
        } catch (e) {
          console.error(" Error fetching Visit data:", e);
          dispatch(showToast({ message: 'Error fetching data', type: 'error' }));
        }
      };

      fetchVisits();

      return () => {
        // Cleanup (if necessary)
      };
    }, [dateStore, showMarketModal, showAddNewModal, refreshTrigger, showDBVisitModal])
  );

  const groupByType = (data) => {
    const map = new Map();
    data.forEach((item) => {
      if (map.has(item.type)) {
        map.get(item.type).count += 1;
      } else {
        map.set(item.type, {
          ...item,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  };


  const handleAddActivity = (title, extra = null) => {
    const iconData = ACTIVITY_LIST.find((a) => a.label === title);
    const newActivity = {
      id: `${Date.now()}`,
      title,
      icon: iconData ? iconData.icon : "document-outline",
      subtitle:
        title === "Individual Market Work"
          ? `Beat: ${extra} | Date: ${today}`
          : title === "Market and DB Visit"
            ? `SR: ${extra} | Date: ${today}`
            : `Date: ${today}`,
    };
    setActivities((prev) => [newActivity, ...prev]);
  };


  useFocusEffect(
    useCallback(() => {
      const getRoutesData = async () => {
        try {
          const RouteData = await UniversalUpdateInsert({
            ObjectName: 'Route_Plans__c',
            Type: 'get',
          });

        } catch (error) {
          console.error('Error fetching route data:', error);
        }
      };
      getRoutesData();

    }, [])
  );

  const normalize = (str = '') =>
    str.trim().toLowerCase();

  const isActivityAlreadyDone = (label) => {
    // console.log('Checking if activity already done for label:...................', label);
    // console.log('Filtered activity:...................', JSON.stringify(filteredActivities));
    return filteredActivities?.some(item =>
      normalize(item.type) === normalize(label) &&
      Number(item.count) > 0
    );
  };

  const clickHandle = (item) => {
    console.log(item.type)
    const filteredData = categorizedData.filter(dataItem => dataItem.type === item.type);
    dispatch(setSoVisitStatus({
      type: item.type,
    }));
    // navigation.navigate('BeatPlanningForActivity')
    if (item.type === 'Individual Market Work') {
      navigation.navigate('BeatPlanningForActivity')
    } else if (item.type === 'Market and DB Visit') {
      navigation.navigate('BeatPlanningForActivity')
    } else if (item.type === 'Prospecting/Vacant SR DB-Visit') {
      setShowProspectingModal(true)
    } else {

    }
  }
  const renderCard = ({ item }) => {
    if (!item?.type) return null;   // ⬅️ skip if type missing

    return (
      <TouchableOpacity style={styles.card} onPress={() => clickHandle(item)}>
        <View style={styles.cardIcon}>
          <Ionicons
            name={item.icon || "document-outline"}
            size={28}
            color={Gradients.primary[2]}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.titleText}>
            {item.type}
          </Text>
          <Text style={styles.subtitleText}>
            Count: {item.count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };


  const filteredActivities = Array.isArray(showdataMap)
    ? showdataMap.filter(item =>
      item?.type?.toLowerCase().includes(searchParam?.toLowerCase() || "")
    )
    : [];




  useEffect(() => {
    const checkAndSync = async () => {
      try {
        const connected = await isInternetAvailable();
        if (connected) {
          setTimeout(() => {
            syncAttendanceRecords(apiFetch)
              .then(() => console.log("Sync done"))
              .catch(err => console.error(" Sync error:", err));
          }, 0);
        }
      } catch (err) {
        console.error(" Network check error:", err);
      }
    };
    checkAndSync();
  }, []);
  return (
    <>
      <View style={styles.body}>
        {isTodayDateSelected && showAddNewButton &&
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setShowAddNewModal(true)}
              style={{
                backgroundColor: Gradients.primary[1],
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add New</Text>
            </TouchableOpacity>
          </View>
        }

        {categorizedData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={36} color={'gray'} style={{ marginBottom: 14 }} />
            <Text style={styles.emptyText}>No activities yet.</Text>
            <Text style={styles.emptySubText}>Please add a new activity!</Text>
          </View>
        ) : (
          <FlatList
            data={filteredActivities}
            keyExtractor={(item) => item.type}
            renderItem={renderCard}
            contentContainerStyle={{ paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      {/* {console.log('filteredActivities', filteredActivities)} */}
      {/* Add New Activity Modal */}
      <Modal visible={showAddNewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={[styles.modalTitle, { color: '#0B0B0B' }]}>Add New Activity</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ACTIVITY_LIST.map((activity, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.75}
                  style={styles.activityCard}
                  onPress={() => {
                    setShowAddNewModal(false);

                    setTimeout(() => {
                      // if (isActivityAlreadyDone(activity.label)) {
                      //   dispatch(showToast({
                      //     message: 'Activity already done!.',
                      //     type: 'warning'
                      //   }));
                      //   return;
                      // }

                      // 🟢 If not done already, proceed
                      if (activity.label === "Individual Market Work") {
                        setShowMarketModal(true);
                      }
                      else if (activity.label === "Market and DB Visit") {
                        setShowDBVisitModal(true);
                      }
                      else if (activity.label === "Admin") {
                        handleSubmit(activity.label);
                      }
                      else if (activity.label === "Prospecting/Vacant SR DB-Visit") {
                        handleSubmit(activity.label);
                      }
                      else if (normalize(activity.label) === normalize("Weekly-off/Holiday")) {
                        handleSubmit(activity.label);
                      }
                      else if (activity.label === "Meetings") {
                        handleSubmit(activity.label);
                      }
                      else {
                        handleAddActivity(activity.label);
                      }

                    }, 150);
                  }}
                >
                  <Ionicons
                    name={activity.icon}
                    size={22}
                    color={'gray'}
                    style={styles.activityIcon}
                  />
                  <Text style={[styles.activityText, { color: '#0B0B0B' }]}>{activity.label}</Text>
                  <Ionicons name="chevron-forward" size={19} color={'gray'} style={{ marginLeft: "auto" }} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Gradient Close Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={{ marginTop: 10 }}
              onPress={() => setShowAddNewModal(false)}
            >
              <LinearGradient
                colors={Gradients.primary}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.gradientButtonText}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Market / DB Visist */}
      <MarketWorkModal
        visible={showMarketModal}
        onClose={() => {
          setShowMarketModal(false);
          setSelectedBeat(null);
        }}
        selectedBeat={selectedBeat}
        setSelectedBeat={setSelectedBeat}
        onSave={() => {
          if (selectedBeat) {
            handleAddActivity("Individual Market Work", selectedBeat);
            setSelectedBeat(null);
          }
          setShowMarketModal(false);
        }}
      />

      <DBVisitModal
        visible={showDBVisitModal}
        onClose={() => {
          setShowDBVisitModal(false);
          setSelectedSR(null);
        }}
        onSave={() => {
          if (selectedSR) {
            handleAddActivity("Market and DB Visit", selectedSR);
            setSelectedSR(null);
          }
          setShowDBVisitModal(false);
        }}
      />

      <ProspectingModal
        visible={showProspectingModal}
        onClose={() => {
          setShowProspectingModal(false);
          setSelectedSR(null);
        }}
        onSave={() => {
          handleSubmit('Prospecting/Vacant SR DB-Visit')
          setShowProspectingModal(false)

        }}
      />
      <LoaderOverlay visible={loading} message="Saving activity..." />

    </>
  );
};
export default SelectActivity;
const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: "transparent",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  body: {
    flex: 1,
    padding: 14,
    backgroundColor: "#f6f9fd",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: Gradients.primary[0],
    shadowOpacity: Platform.OS === "android" ? 0.1 : 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    borderLeftWidth: 4,
    borderLeftColor: Gradients.primary[1],
  },
  cardIcon: {
    marginRight: 14,
    width: 38,
    height: 38,
    backgroundColor: "#f3f6fb",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "700",
    color: '#0B0B0B',
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 13,
    color: 'gray',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(33, 91, 204, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "88%",
    maxHeight: "60%",
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 18,
    elevation: 13,
    ...Platform.select({
      ios: {
        shadowColor: Gradients.primary[1],
        shadowRadius: 12,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 7 },
      },
    }),
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 17,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Gradients.primary[1] + "20",
  },
  activityIcon: {
    marginRight: 8,

    backgroundColor: "#f3f8fb",
    borderRadius: 8,
    padding: 4,
  },
  activityText: {
    fontSize: 14,
    fontWeight: "500",
  },
  gradientButton: {
    paddingVertical: 11,
    borderRadius: 8,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  gradientButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 100,

  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: 'gray',
    marginBottom: 5,
  },
  emptySubText: {
    fontSize: 13,
    color: 'gray',
  },
});