import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  Linking,
  StyleSheet
} from "react-native";
import Feather from "@react-native-vector-icons/fontawesome5";
import Entypo from "@react-native-vector-icons/entypo";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { getBeatPlanningStyle } from "../assets/css/BeatPlanning";
import { Gradients } from "../assets/css/MasterCss";
import Tooltip from "react-native-walkthrough-tooltip";
import HeaderMain from '../components/HeaderMain';


const TABS = ["Upcoming", "In Progress", "Completed"];

// Static data - replace all the API calls and database fetches with this
const STATIC_DATA = {
  Upcoming: [
    {
      name: "Metro Cash & Carry",
      tier: "A+",
      target: "Retail",
      lastOrder: "3 days",
      ProductiveCall__c: false,
      propensity: "85%",
      AccountId: "001",
      sfId: "visit001",
      Phone: "+91-9876543210",
      BillingAddress: "Sector 18, Noida, Uttar Pradesh 201301",
      OTPVerified__c: "Yes",
      CreditLimit__c: "50000",
      BillingLatitude: 28.5672,
      BillingLongitude: 77.3220,
      CheckInTime__c: null,
      CheckOutTime__c: null,
    },
    {
      name: "Big Bazaar",
      tier: "A",
      target: "Wholesale",
      lastOrder: "7 days",
      ProductiveCall__c: false,
      propensity: "70%",
      AccountId: "002",
      sfId: "visit002",
      Phone: "+91-9876543211",
      BillingAddress: "Connaught Place, New Delhi 110001",
      OTPVerified__c: "No",
      CreditLimit__c: "75000",
      BillingLatitude: 28.6315,
      BillingLongitude: 77.2167,
      CheckInTime__c: null,
      CheckOutTime__c: null,
    },
    {
      name: "Spencer's Retail",
      tier: "B+",
      target: "Retail",
      lastOrder: "5 days",
      ProductiveCall__c: false,
      propensity: "60%",
      AccountId: "003",
      sfId: "visit003",
      Phone: "+91-9876543212",
      BillingAddress: "Gurgaon Sector 29, Haryana 122001",
      OTPVerified__c: "Yes",
      CreditLimit__c: "30000",
      BillingLatitude: 28.4595,
      BillingLongitude: 77.0266,
      CheckInTime__c: null,
      CheckOutTime__c: null,
    }
  ],
  "In Progress": [
    {
      name: "Reliance Fresh",
      tier: "A+",
      target: "Retail",
      lastOrder: "2 days",
      ProductiveCall__c: false,
      propensity: "90%",
      AccountId: "004",
      sfId: "visit004",
      Phone: "+91-9876543213",
      BillingAddress: "Vasant Kunj, New Delhi 110070",
      OTPVerified__c: "Yes",
      CreditLimit__c: "100000",
      BillingLatitude: 28.5244,
      BillingLongitude: 77.1579,
      CheckInTime__c: "2024-10-16T09:30:00",
      CheckOutTime__c: null,
    }
  ],
  Completed: [
    {
      name: "D-Mart",
      tier: "A",
      target: "Retail",
      lastOrder: "1 day",
      ProductiveCall__c: true,
      propensity: "95%",
      AccountId: "005",
      sfId: "visit005",
      Phone: "+91-9876543214",
      BillingAddress: "Dwarka Sector 10, New Delhi 110075",
      OTPVerified__c: "Yes",
      CreditLimit__c: "80000",
      BillingLatitude: 28.5921,
      BillingLongitude: 77.0460,
      CheckInTime__c: "2024-10-16T08:00:00",
      CheckOutTime__c: "2024-10-16T10:30:00",
    },
    {
      name: "More Megastore",
      tier: "B",
      target: "Wholesale",
      lastOrder: "4 days",
      ProductiveCall__c: false,
      propensity: "65%",
      AccountId: "006",
      sfId: "visit006",
      Phone: "+91-9876543215",
      BillingAddress: "Janakpuri, New Delhi 110058",
      OTPVerified__c: "No",
      CreditLimit__c: "45000",
      BillingLatitude: 28.6219,
      BillingLongitude: 77.0818,
      CheckInTime__c: "2024-10-16T11:00:00",
      CheckOutTime__c: "2024-10-16T13:15:00",
    }
  ]
};

// Static data - replace all the API calls and database fetches with this
const STATIC_DATA_ARRAY = [
  {
    name: "Metro Cash & Carry",
    tier: "A+",
    target: "Retail",
    lastOrder: "3 days",
    ProductiveCall__c: false,
    propensity: "85%",
    AccountId: "001",
    sfId: "visit001",
    Phone: "+91-9876543210",
    BillingAddress: "Sector 18, Noida, Uttar Pradesh 201301",
    OTPVerified__c: "Yes",
    CreditLimit__c: "50000",
    BillingLatitude: 28.5672,
    BillingLongitude: 77.3220,
    CheckInTime__c: null,
    CheckOutTime__c: null,
  },
  {
    name: "Big Bazaar",
    tier: "A",
    target: "Wholesale",
    lastOrder: "7 days",
    ProductiveCall__c: false,
    propensity: "70%",
    AccountId: "002",
    sfId: "visit002",
    Phone: "+91-9876543211",
    BillingAddress: "Connaught Place, New Delhi 110001",
    OTPVerified__c: "No",
    CreditLimit__c: "75000",
    BillingLatitude: 28.6315,
    BillingLongitude: 77.2167,
    CheckInTime__c: null,
    CheckOutTime__c: null,
  },
  {
    name: "Spencer's Retail",
    tier: "B+",
    target: "Retail",
    lastOrder: "5 days",
    ProductiveCall__c: false,
    propensity: "60%",
    AccountId: "003",
    sfId: "visit003",
    Phone: "+91-9876543212",
    BillingAddress: "Gurgaon Sector 29, Haryana 122001",
    OTPVerified__c: "Yes",
    CreditLimit__c: "30000",
    BillingLatitude: 28.4595,
    BillingLongitude: 77.0266,
    CheckInTime__c: null,
    CheckOutTime__c: null,
  },
  {
    name: "Reliance Fresh",
    tier: "A+",
    target: "Retail",
    lastOrder: "2 days",
    ProductiveCall__c: false,
    propensity: "90%",
    AccountId: "004",
    sfId: "visit004",
    Phone: "+91-9876543213",
    BillingAddress: "Vasant Kunj, New Delhi 110070",
    OTPVerified__c: "Yes",
    CreditLimit__c: "100000",
    BillingLatitude: 28.5244,
    BillingLongitude: 77.1579,
    CheckInTime__c: "2024-10-16T09:30:00",
    CheckOutTime__c: null,
  }, {
    name: "D-Mart",
    tier: "A",
    target: "Retail",
    lastOrder: "1 day",
    ProductiveCall__c: true,
    propensity: "95%",
    AccountId: "005",
    sfId: "visit005",
    Phone: "+91-9876543214",
    BillingAddress: "Dwarka Sector 10, New Delhi 110075",
    OTPVerified__c: "Yes",
    CreditLimit__c: "80000",
    BillingLatitude: 28.5921,
    BillingLongitude: 77.0460,
    CheckInTime__c: "2024-10-16T08:00:00",
    CheckOutTime__c: "2024-10-16T10:30:00",
  },
  {
    name: "More Megastore",
    tier: "B",
    target: "Wholesale",
    lastOrder: "4 days",
    ProductiveCall__c: false,
    propensity: "65%",
    AccountId: "006",
    sfId: "visit006",
    Phone: "+91-9876543215",
    BillingAddress: "Janakpuri, New Delhi 110058",
    OTPVerified__c: "No",
    CreditLimit__c: "45000",
    BillingLatitude: 28.6219,
    BillingLongitude: 77.0818,
    CheckInTime__c: "2024-10-16T11:00:00",
    CheckOutTime__c: "2024-10-16T13:15:00",
  }


];

const BeatPlanningListView = () => {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState("Upcoming");
  const [tooltipVisible, setTooltipVisible] = useState(null);
  const [searchParam, setSearchParam] = useState(""); // You can add search functionality if needed

  // Handle phone call
  const handleCallPress = (number) => {
    if (!number) {
      return;
    }
    Linking.openURL("tel:" + number);
  };

  // Handle navigation to details (you can customize this)
  const handleNavigateToDetails = (item) => {
    console.log("Navigate to details for:", item.name);
    // navigation.navigate("AccountDetailContainer", {
    //   accountDetailId: item.AccountId,
    //   visitDetail: item,
    // });
  };

  // Handle check-in (you can customize this)
  const openCheckinModal = (item) => {
    console.log("Open check-in modal for:", item.name);
    // Add your check-in logic here
  };

  // Handle check-out (you can customize this)
  const openCheckoutModal = (item) => {
    console.log("Open check-out modal for:", item.name);
    // Add your check-out logic here
  };

  // Get current tab data
  const outlets = STATIC_DATA[activeTab] || [];

  // Filter outlets based on search (if you want to add search functionality)
  const filteredOutlets = outlets.filter(
    outlet =>
      outlet.name &&
      outlet.name.toLowerCase().includes((searchParam || '').toLowerCase())
  );

  // Get stats for dashboard
  const allOutlets = [
    ...STATIC_DATA.Upcoming,
    ...STATIC_DATA["In Progress"],
    ...STATIC_DATA.Completed,
  ];

  const completedOutlets = STATIC_DATA.Completed || [];
  const billedOutletsCount = completedOutlets.filter(
    (item) => item.ProductiveCall__c === true
  ).length;

  const unbilledOutletsCount = completedOutlets.filter(
    (item) => item.ProductiveCall__c !== true
  ).length;

  // Today's date for comparison
  const todaysDate = new Date().toISOString().split('T')[0];
  const isToday = true; // Set to true for demo purposes

  return (
    <View style={styles.container}>
      {/* Dashboard Stats */}
      <HeaderMain
        screenName="Lead list view"
      />

    <View style={{backgroundColor:'white', padding: 20, paddingHorizontal: 16, borderRadius: 20}}>
      {/* Outlet List */}
      {outlets.length > 0 ? (
        <FlatList
          data={STATIC_DATA_ARRAY}
          keyExtractor={(item, index) => `${item.name}_${index}`}
          contentContainerStyle={{ paddingBottom: 50 }}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleNavigateToDetails(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={{ flex: 1, flexDirection: 'row', minWidth: 0 }}>
                      <Text
                        style={[styles.cardTitle, { maxWidth: 235 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.name}
                      </Text>

                    </View>
                  </View>

                  {/* Right-side icons */}
                  <View style={styles.iconRow}>
                   

                    <TouchableOpacity
                      onPress={() => {
                        handleCallPress(item?.Phone);
                      }}
                      style={[styles.iconCircle, { marginLeft: 8 }]}
                    >
                      <Feather name="phone-alt" size={18} color="#C9A24D" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 20, marginTop: 6 }}>
                  <View style={{ flexDirection: "column", alignItems: "center" }}>
                    <Text>Class</Text>
                    <Text style={styles.fieldText}>{item.tier}</Text>
                  </View>

                  <View style={{ flexDirection: "column", alignItems: "center" }}>
                    <Text>Channel</Text>
                    <Text style={styles.fieldText}>{item.target}</Text>
                  </View>

                  <View style={{ flexDirection: "column", alignItems: "center" }}>
                    <Text>Last Spot Sales</Text>
                    <Text style={styles.fieldText}>{item.lastOrder}</Text>
                  </View>
                </View>

                <View style={styles.propensityContainer}>
                  <Text style={{ marginRight: "30%", fontWeight: "bold" }}>
                    {item?.BillingAddress?.replace(/null/gi, "")
                      .split(",")
                      .map((part) => part.trim())
                      .filter((part) => part)
                      .join(", ")}
                  </Text>


                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <Text style={styles.noDataText}>No outlets in this category.</Text>
      )}

      </View>
    </View>
  );
};

export default BeatPlanningListView;


 
const styles = StyleSheet.create({
  container: { backgroundColor: "#A67C2E" },
  headerText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "600",
    marginVertical: 8,
    // backgroundColor:red
  },
  disabledButton: {
    opacity: 0.4,
  },
  mapcontainer: {
    // height: 245,
    width: "100%",
    alignItems: "center",
    backgroundColor: "white",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    // paddingBottom: 50,
    position: "relative",
  },
  map: { height: 150, width: "100%", padding: 12 },
  mapTypeToggle: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
  },
  mapTypeButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#ddd",
  },
  mapTypeText: { fontSize: 13, fontWeight:'400', color: "#333" },
  activeMapType: { backgroundColor: "#C9A24D" },
  activeMapTypeText: { color: "#13265C" },
  zoomButtonsContainer: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 5,
  },
  zoomButton: {
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  zoomText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#C4C4C4",
    textAlign: "center",
  },
  dashboardCard: {
    borderRadius: 8,
    padding: 10,
    width: "100%",
    // backgroundColor:'red',
    // marginTop: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
 
  },
  title: { fontWeight: "700", fontSize: 17, color: "#000" },
  liveBadge: {
    backgroundColor: "#FDBDBDE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 50,
  },
  liveText: { color: "#B3393F", fontWeight: "600", fontSize: 10 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    // backgroundColor:'red'
  },
  statItem: { alignItems: "flex-start", flex: 1 },
  statValueBlue: { color: "#A67C2E", fontWeight: "700", fontSize: 16 },
  statLabel: { fontSize: 13, color: "#7A7266", marginTop: 2 ,fontWeight:'400'},
  divider: { height: 1, backgroundColor: "#D9D2C3", marginVertical: 12 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  jtdText: { fontSize: 12, color: "#1F1D1A" },
  avgText: { fontSize: 12, color: "#1F1D1A" },
  boldText: { fontWeight: "bold", color: "#000" },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 12,
    marginTop: 10,
    gap: 5
  },
  tabWrapper: { borderRadius: 20 },
  tabButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
    maxWidth: 150,
    borderWidth: 1,
    borderColor: "#3B5BB5",
    backgroundColor: "#F1EADB",
  },
  activeTabButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 150,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  tabText: { color: "#1F1D1A", fontSize: 12, fontWeight: '400' },
  activeTabText: { color: "#fff", fontSize: 12, fontWeight: '400' },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,

    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
cardTitle: {
  fontSize: 17,
  fontWeight: "700",
  color: "#1F1D1A",
  // allow text to shrink inside flex container
  flexShrink: 1,
  // don't set width here
},

tooltipButton: {
  marginLeft: 2,
  marginTop: 0,
  marginBottom: 2,
  width: 24,
  height: 24,
  borderRadius: 12,
  justifyContent: "center",
  alignItems: "center",
},

verifiedDot: {
  width: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: "#8BE78B",
  justifyContent: "center",
  alignItems: "center",
},

unverifiedDot: {
  width: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: "#F77A7D",
  justifyContent: "center",
  alignItems: "center",
},

  iconRow: { flexDirection: "row" },
  iconCircle: {
    backgroundColor: "#F1EADB",
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 50,
  },
  mustOrder: {
    color: "#A67C2E",
    backgroundColor: "#F1EADB",
    width: 130,
    textAlign: "center",
    borderRadius: 50,
    fontSize: 13,
    marginVertical: 4,
  },
  fieldText: { color: "#000", marginVertical: 2, fontWeight: "500",fontSize:15 },
  propensityContainer: {
    marginTop: 10,
    flexDirection: "row",
    height: 50,
    borderTopColor: "#D9D2C3",
    borderTopWidth: 1,
    alignItems: "center",
    position: "relative",
    paddingTop: 8,
  },
  progressBackground: {
    flexDirection: "row",
    backgroundColor: "#ccc",
    height: 20,
    marginLeft: 12,
    width: "30%",
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
  },
  progressBarFlex: { backgroundColor: "#C9A24D", height: "100%" },
  progressText: {
    position: "absolute",
    top: 0,
    left: 8,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    lineHeight: 20,
  },
  checkInGradient: {
    width: "25%",
    height: 30,
    position: "absolute",
    right: 3,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  noDataText: { textAlign: "center", marginTop: 20, color: "#888" },
  
});
 