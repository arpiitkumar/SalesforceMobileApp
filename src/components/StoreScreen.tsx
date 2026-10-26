import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
} from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { useSelector } from "react-redux";
import Phone from "../assets/images/Phone.svg";
import Pen from "../assets/images/Pen.svg";
import StockCheck from "../assets/images/Stock_Check.svg";
import Returns from "../assets/images/Returns.svg";
import OutletPerformance from "../assets/images/Outlet Performance.svg";
import Survey from "../assets/images/Survey.svg";
import Order_History from "../assets/images/Order_History.svg";
import StoreDetails from "../assets/images/StoreDetails.svg";
import LastVisited from "../assets/images/LastVisited.svg";
import Address from "../assets/images/Address.svg";
import CreditLimit from "../assets/images/CreditLimit.svg";
import { useNavigation } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import Entypo from "@react-native-vector-icons/entypo";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import moment from "moment";
import SurveyModal from "./modal/SurveyModal";
import StoreDetailsModal from "./modal/StoreDetails";
import EditAccountModal from "./modal/EditAccountModal";
import OutletPerformanceModal from "./modal/OutletPerformance";
import SelfieCheckIn from "./modal/SelfieCheckIn";
import CheckOut from "./modal/CheckOut";
import SalesReturn from "../screens/SalesReturn";
import { RootState } from "../redux/store";
import SalesReturnMain from "../screens/SalesReturn/SalesReturnMain";
import { RFValue } from "react-native-responsive-fontsize";
import CompetitorModal from "./modal/CompetitorModal";
import CollectionModal from "./modal/CollectionModal";
import StockHistoryModal from "./modal/StockHistoryModal";
import MIcon from "@react-native-vector-icons/material-icons";
import IIcon from "./Ionicons";
import InstoreActivity from "./modal/InstoreActivity";
import { showToast } from "../redux/slices/toastSlice";
import { useDispatch } from "react-redux";
import { setDistributorId } from "../redux/slices/distributorSlice";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { getDistributorListForBeat, isDistributorAccount } from "../utils/distributorHelper";
import { isInternetAvailable } from "../utils/networkUtils";
import UpdateOutletLocationModal from "./UpdateOutletLocationModal";

const { width } = Dimensions.get("window");

const StoreScreen = ({
  accountDetailId = null,
  visitDetail = null,
  categorizedData = {},
}) => {
  const navigation = useNavigation();
  // console.log('categorizedData in store screen',categorizedData)
  const beatSelection = useSelector((state: RootState) => state.beatSelection);
  const [accountDetailsData, setAccountDetailsData] = useState([]);
  const [salesReturnVisible, setSalesReturnVisible] = useState(false);
  const [compModalVisible, setCompModalVisible] = useState(false);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);

  const [todaysDate, setTodaysDate] = useState("");
  const selectedAccount = useSelector(
    (state: RootState) => state.selectedAccount.selectedAccount,
  );
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const isDistributorVisit =
    isDistributorAccount(selectedVisit) ||
    isDistributorAccount(selectedAccount) ||
    isDistributorAccount(accountDetailsData);
  const soVisit = useSelector((state: RootState) => state.soVisit);
  // console.log('selectedVisit', selectedVisit)
  const dispatch = useDispatch();

  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat,
  );

  const alredyCheckIn = useSelector((state: RootState) => state.checkIn);

  const [surveyVisible, setSurveyVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [perfVisible, setPerfVisible] = useState(false);
  //console.log('visit detail ----', visitDetail)
  const [modalVisible, setModalVisible] = useState(false);
  const [performanceModalVisible, setPerformanceModalVisible] = useState(false);
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [stockHistoryVisible, setStockHistoryVisible] = useState(false);
  const [digitalContent, setDigitalContent] = useState(false);
  const [digitalContentType, setDigitalContentType] = useState(false);

  const handleCallPress = (number) => {
    if (!number) {
      return;
    }
    Linking.openURL("tel:" + number);
  };
  const { id: beatId } = useSelector((state) => state.beatSelection);
  const selectedBeatDay = useSelector(
    (state: RootState) => state.selectedBeatDay.selectedBeatDay,
  );
  const [EndOfDayTime, setEndOfDayTime] = useState(
    selectedBeatDay?.EndOfDayTime__c,
  );

  const handleUpdateSuccess = (updatedAccount) => {
    // e.g. refresh your list, update Redux, or navigate:
    console.log("Updated:", updatedAccount);
    // Optionally navigate back:
    // navigation.goBack();
  };

  const userState = useSelector(
    (state: RootState) => state.user?.userData || state.user?.user,
  );
  const [distiData, setDistiData] = useState(null);
  const getDistributorList = async () => {
    try {
      const currentBeatId =
        selectedVisit?.Beat__c || selectedBeatDay?.Beat__c || beatId;
      const accountId =
        selectedVisit?.AccountId ||
        selectedVisit?.AccountId__c ||
        accountDetailId;
      const userId =
        userState?.[0]?.Sf_Id || userState?.Sf_Id || userState?.[0]?.Id;

      const list = await getDistributorListForBeat({
        currentBeatId,
        accountId,
        userId,
        fetchRecords,
      });
      if (list && list.length > 0) {
        setDistiData(list[0]);
        const distId = list[0]?.value || list[0]?.Distributor__c;
        if (distId) {
          dispatch(setDistributorId(distId));
        }
      } else {
        setDistiData(null);
      }
    } catch (error) {
      console.log("Error fetching distributor list:", error);
    }
  };

  console.log("selectedVisit.AccountId", selectedVisit.AccountId);
  useFocusEffect(
    useCallback(() => {
      const getData = async () => {
        try {
          const result = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
          });
          const dateNow = moment().format("YYYY-MM-DD");
          setTodaysDate(dateNow);
          // console.log(dateNow);
          // console.log(dateStore)

          const account = result.find(
            (item) => item.Sf_Id === selectedVisit.AccountId,
          );
          setAccountDetailsData(account);

          // console.log("THIS USER IS  -------- THE HEADER", account);
        } catch (error) {
          console.error(" Get User Failed For the Header:", error);
        }
      };

      const fetchBeatDays = async () => {
        const BeatDays = await UniversalUpdateInsert({
          ObjectName: "BeatDay__c",
          Type: "get",
        });
      };

      //setSelectedBeatName(beatDayForDate?.Beat__Name)
      //setSelecteBeatId(beatDayForDate?.Beat__Id);  // Save selected Beat
      //setBeatDaysId(beatDayForDate?.Sf_Id)

      getData();
      getDistributorList();

      // Optional cleanup function (if needed)
      return () => {
        // Cleanup if necessary
      };
    }, [selectedVisit.AccountId, modalVisible]), // Add dependencies here
  );

  //console.log('this is visit detail in the store screen ', visitDetail)
  const renderIcon = (label) => {
    switch (label) {
      case "Returns":
        return <Returns width={30} height={30} />;
      case "Stock Check":
        return <MIcon name="inventory" size={20} color="#A67C2E" />;
      case "Inventory":
        return <MIcon name="inventory" size={20} color="#A67C2E" />;
      case "Survey":
        return <Survey width={25} height={25} />;
      case "Outlet Performance":
        return <OutletPerformance width={25} height={25} />;
      case "Order_History":
        return <Order_History width={25} height={25} />;
      case "Return History":
        return <MIcon name="assignment-return" size={20} color="#A67C2E" />;
      case "Competitor":
        return <Returns width={30} height={30} />;
      case "Stock Check":
        return <MIcon name="inventory" size={20} color="#A67C2E" />;
      case "Pricing":
        return <MIcon name="currency-rupee" size={20} color="#A67C2E" />;
      case "Exception":
        return <MIcon name="collections-bookmark" size={20} color="#A67C2E" />;
      case "Instore Activity":
        return <MIcon name="notes" size={20} color="#A67C2E" />;
      case "Digital Content":
        return <MIcon name="image" size={20} color="#A67C2E" />;
      case "Sauda Booking":
        return <IIcon name="ticket" size={20} color="#A67C2E" />;
      case "Growth Mapping":
        return <Feather name="trending-up" size={20} color="#A67C2E" />;
      case "Collection History":
        return <MIcon name="currency-rupee" size={20} color="#A67C2E" />;
      case "Program Outlet Enrolment":
        return <MIcon name="shopping-bag" size={20} color="#A67C2E" />;
      case "Stock History":
        return <MIcon name="shopping-bag" size={20} color="#A67C2E" />;
      case "Competition Activity":
        return <MIcon name="emoji-events" size={20} color="#A67C2E" />;
      case "Merchandise":
        return <MIcon name="storefront" size={20} color="#A67C2E" />;
      case "Perfect Store":
        return <MIcon name="verified" size={20} color="#A67C2E" />;

      default:
        return <Feather name="clock" size={20} color="#A67C2E" />;
    }
  };

  const [users, setUsers] = useState([]);
  // console.log('uses.......................', users[0])

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        // console.log(result)
        setUsers(result);

        const AllPicklistData = await UniversalUpdateInsert({
          ObjectName: "AllDataPicklist",
          Type: "get",
        });
        //console.log("THIS IS PICKList data................",AllPicklistData )

        let optionsData = AllPicklistData[0]?.OptionsData;

        if (typeof optionsData === "string") {
          try {
            optionsData = JSON.parse(optionsData);
          } catch (e) {
            console.error("Failed to parse OptionsData:", e);
          }
        }
        // console.log("Training Video URL::::::", optionsData);
        setDigitalContent(optionsData?.digitalContentVideo);
        setDigitalContentType(optionsData?.digitalContentVideoType);
      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };
    initialize();
  }, []);

  const [lastOrder, setLastOrder] = useState([]);
  useEffect(() => {
    const initialize = async () => {
      try {
        const resultorder = await UniversalUpdateInsert({
          ObjectName: "Order",
          Type: "get",
          filters: [{ field: "AccountId", value: selectedVisit.AccountId }],
        });

        // console.log('order', resultorder);

        if (resultorder.length > 0) {
          // Sort by OrderSubmissionTime__c descending
          const sortedOrders = resultorder.sort((a, b) => {
            return (
              new Date(b.OrderSubmissionTime__c) -
              new Date(a.OrderSubmissionTime__c)
            );
          });

          setLastOrder(sortedOrders[0]);
        } else {
          setLastOrder(null);
        }
      } catch (error) {
        console.error(" Get Last Order Failed:", error);
      }
    };
    initialize();
  }, []);

  const [lastVisit, setLastVisit] = useState([]);
  useEffect(() => {
    const initialize = async () => {
      try {
        const resultVisit = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
          filters: [{ field: "AccountId__c", value: selectedVisit.AccountId }],
        });

        // console.log('resultVisit:', resultVisit);

        // Filter records jaha CheckInTime__c empty na ho
        const filteredVisits = Array.isArray(resultVisit)
          ? resultVisit.filter(
              (item) =>
                item.CheckInTime__c && item.CheckInTime__c.trim() !== "",
            )
          : [];

        if (filteredVisits.length > 0) {
          // Sort descending by CheckInTime__c
          filteredVisits.sort(
            (a, b) => new Date(b.CheckInTime__c) - new Date(a.CheckInTime__c),
          );
          // console.log('filteredVisits:', filteredVisits[0]);
          // Take the first record (most recent)
          setLastVisit(filteredVisits[0]);
        } else {
          setLastVisit([]);
        }
      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };
    initialize();
  }, []);

  const formatDateTime = (dateString) => {
    if (
      !dateString ||
      typeof dateString !== "string" ||
      dateString.trim() === ""
    ) {
      return ""; // blank if empty
    }

    // Remove extra quotes if present
    let cleanString = dateString.replace(/"/g, "").trim();

    const date = new Date(cleanString);

    if (isNaN(date.getTime())) {
      console.log("Invalid date format:", cleanString);
      return ""; // return blank for invalid date
    }

    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  };

  const [modalVisibleInstoreActivity, setModalVisibleInstoreActivity] =
    useState(false);

  const stockCheck = async () => {
    try {
      const stockData = await UniversalUpdateInsert({
        ObjectName: "Stock_Check__c",
        Type: "get",
        filters: [{ field: "Beat_Day__c", value: selectedBeatDay?.Sf_Id }],
      });
      if (stockData && stockData.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const hasTodayDate = stockData.some((item) => {
          return item.Stock_Check_Date__c.startsWith(today);
        });

        return hasTodayDate;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Error in stockCheck:", e);
      return false;
    }
  };

  const [showLocationModal, setShowLocationModal] = useState(false);
  const { apiFetch, fetchRecords } = useApiFetch();
  const [showUpdateLocationBtn, setShowUpdateLocationBtn] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const updatebuttonvisiblity = async () => {
        try {
          setShowUpdateLocationBtn(false);
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          const connected = await isInternetAvailable();

          // User must be online
          if (!connected) {
            console.log(" User Offline");
            return;
          }

          const datematchdatauser = await fetchRecords(
            "User",
            `SELECT Id,
                  Outlet_Location_Update_Access_Start_Date__c,
                  Outlet_Location_Update_Access_End_Date__c
           FROM User
           WHERE Id='${result?.[0]?.Sf_Id}'`,
          );

          if (!datematchdatauser?.length) {
            console.log(" User data not found");
            return;
          }

          const userData = datematchdatauser[0];
          const startDate =
            userData?.Outlet_Location_Update_Access_Start_Date__c;
          const endDate = userData?.Outlet_Location_Update_Access_End_Date__c;

          console.log("Start Date:", startDate);
          console.log("End Date:", endDate);

          // Both dates mandatory
          if (!startDate || !endDate) {
            console.log(" Start/End Date missing");
            return;
          }

          // YYYY-MM-DD format safe parsing
          const start = new Date(`${startDate}T00:00:00`);
          const end = new Date(`${endDate}T00:00:00`);
          const today = new Date();

          today.setHours(0, 0, 0, 0);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);

          console.log("Today:", today);
          console.log("Start:", start);
          console.log("End:", end);

          // Invalid Range
          if (start > end) {
            console.log(" Invalid Date Range");
            return;
          }

          const isVisible =
            today.getTime() >= start.getTime() &&
            today.getTime() <= end.getTime();
          console.log("Button Visible:", isVisible);
          setShowUpdateLocationBtn(isVisible);
        } catch (error) {
          console.error(" Get User Failed For Header:", error);
          setShowUpdateLocationBtn(false);
        }
      };

      updatebuttonvisiblity();
    }, []),
  );

  return (
    <>
      {selectedOutlet && (
        <SelfieCheckIn
          visible={selfieModalVisible}
          onClose={() => {
            setSelfieModalVisible(false);
            setSelectedOutlet(null);
          }}
          outlet={selectedOutlet}
          selectedDate={dateStore}
          categorizedData={categorizedData}
        />
      )}
      {selectedOutlet && (
        <CheckOut
          visible={checkoutModalVisible}
          onClose={() => {
            setCheckoutModalVisible(false);
            setSelectedOutlet(null);
          }}
          outlet={selectedOutlet}
          selectedDate={dateStore}
          categorizedData={categorizedData}
        />
      )}
      <ScrollView style={styles.container}>
        {/* Store Details Card */}
        <View style={{ padding: 12 }}>
          {(() => {
            const isUnsynced =
              visitDetail?.is_synced === false ||
              visitDetail?.is_synced === 0 ||
              selectedVisit?.is_synced === false ||
              selectedVisit?.is_synced === 0;

            if (!isUnsynced) return null;

            const errorMsgText =
              visitDetail?.ErrorMsg || selectedVisit?.ErrorMsg;

            return (
              <Text
                style={{
                  color: "#B3261E",
                  fontSize: 10,
                  fontWeight: "700",
                  marginLeft: 6,
                  marginTop: 4,
                }}
              >
                {errorMsgText ? `Error: ${errorMsgText}` : "Not Synced"}
              </Text>
            );
          })()}

          <View style={styles.headerRow}>
            <View
              style={{
                flexDirection: "row",
                maxWidth: 200,
                justifyContent: "flex-start",
                alignItems: "flex-start",
              }}
            >
              <Text style={styles.title}>
                {accountDetailsData?.Name}
                <Text style={{ fontSize: 12 }}>
                  {accountDetailsData?.Party_Code__c
                    ? " (#" + accountDetailsData?.Party_Code__c + ")"
                    : ""}
                </Text>
              </Text>

              {/* {users[0]?.DeveloperName !== "MT_SO" &&
                users[0]?.DeveloperName !== "MT_Merchandiser" &&
                (accountDetailsData?.OTPVerified__c === "Yes" ? (
                  <View
                    style={{
                      marginLeft: 8,
                      marginTop: 5,
                      width: 16,
                      height: 16,
                      borderRadius: 10,
                      backgroundColor: "#8BE78B",
                      justifyContent: "center",
                      alignItems: "center",
                      alignSelf: "flex-start",
                    }}
                  >
                    <Feather name="check" size={10} color="#fff" />
                  </View>
                ) : (
                  <View
                    style={{
                      marginLeft: 8,
                      marginTop: 5,
                      width: 16,
                      height: 16,
                      borderRadius: 10,
                      backgroundColor: "#F77A7D",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Entypo name="cross" size={10} color="#fff" />
                  </View>
                ))} */}
            </View>

            <View style={styles.actionIcons}>
              {users[0]?.DeveloperName !== "MT_SO" &&
              users[0]?.DeveloperName !== "MT_Merchandiser" &&
              selectedVisit?.VisitStatus__c === "Check In" ? (
                <TouchableOpacity
                  onPress={() => setModalVisible(true)}
                  style={styles.iconCircle}
                >
                  <Pen width={16} height={16} />
                </TouchableOpacity>
              ) : (
                ""
              )}

              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => {
                  handleCallPress(accountDetailsData?.Phone);
                }}
              >
                <Phone width={16} height={16} fill="#A67C2E" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Badge Row */}
          <View style={styles.badgeRow}>
            {users[0]?.DeveloperName !== "MT_SO" &&
              users[0]?.DeveloperName !== "MT_Merchandiser" && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    Class:{" "}
                    <Text style={{ color: "black", fontWeight: "500" }}>
                      {accountDetailsData?.Class__c}
                    </Text>
                  </Text>
                </View>
              )}
            {/* <View style={styles.badge}>
            <Text style={styles.badgeText}>Daily Target: <Text style={{ color: 'black', fontWeight: '500' }}>₹1200</Text></Text>
          </View> */}
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeGreenText}>
                Status:{" "}
                <Text style={{ fontWeight: "500" }}>
                  {selectedVisit.VisitStatus__c}
                </Text>
              </Text>
            </View>

            {dateStore === todaysDate &&
              !EndOfDayTime &&
              selectedVisit.VisitStatus__c === "Check In" && (
                <TouchableOpacity
                  style={styles.checkInButton}
                  onPress={() => {
                    setSelectedOutlet(selectedVisit);
                    setCheckoutModalVisible(true);
                  }}
                >
                  <Text style={styles.checkInButtonText}>Check Out</Text>
                </TouchableOpacity>
              )}

            {dateStore === todaysDate &&
              !EndOfDayTime &&
              selectedVisit.MTP_Admin_Approval_Status__c !== "Pending" &&
              selectedVisit.MTP_Admin_Approval_Status__c !== "Rejected" &&
              selectedVisit.VisitStatus__c !== "Check Out" &&
              selectedVisit.VisitStatus__c !== "Check In" &&
              (() => {
                const isAlreadyCheckedIn =
                  alredyCheckIn?.VisitId && alredyCheckIn?.date === todaysDate;

                return (
                  <TouchableOpacity
                    style={[
                      styles.checkInButton,
                      {
                        backgroundColor: isAlreadyCheckedIn
                          ? "#aaaaaa"
                          : "#A67C2E",
                      },
                    ]}
                    onPress={
                      !isAlreadyCheckedIn
                        ? async () => {
                            if (users[0]?.DeveloperName === "H_T_ASO") {
                              const isStock = await stockCheck();
                              console.log("isStock", isStock);
                              if (isStock) {
                                setSelectedOutlet(selectedVisit);
                                setSelfieModalVisible(true);
                              } else {
                                dispatch(
                                  showToast({
                                    message:
                                      "Please complete Stock Entry before Check-In.",
                                    type: "warning",
                                  }),
                                );
                                // setTimeout(() => {
                                //   navigation.navigate('ASOStockCheck')
                                // }, 3000)
                              }
                            } else {
                              setSelectedOutlet(selectedVisit);
                              setSelfieModalVisible(true);
                            }
                            // setSelectedOutlet(selectedVisit);
                            // setSelfieModalVisible(true);
                          }
                        : null
                    }
                    disabled={isAlreadyCheckedIn}
                  >
                    <Text style={styles.checkInButtonText}>Check In</Text>
                  </TouchableOpacity>
                );
              })()}

            {users[0]?.DeveloperName === "H_T_SO" &&
              (selectedVisit.MTP_Admin_Approval_Status__c === "Pending" ||
                selectedVisit.MTP_Admin_Approval_Status__c === "Rejected") && (
                <View
                  style={[
                    styles.checkInButton,
                    { backgroundColor: "#f71e1eff" },
                  ]}
                >
                  <Text style={styles.checkInButtonText}>
                    Approval{" "}
                    {selectedVisit?.MTP_Admin_Approval_Status__c || "Pending"}
                  </Text>
                </View>
              )}
          </View>

          {showUpdateLocationBtn && (
            <TouchableOpacity
              style={[
                styles.checkInButton,
                { backgroundColor: "#C9A24D", margin: 12 },
              ]}
              onPress={() => setShowLocationModal(true)}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: "#FFFFFF",
                  padding: 7,
                }}
              >
                Update Location
              </Text>
            </TouchableOpacity>
          )}
          {showLocationModal && (
            <UpdateOutletLocationModal
              visible={showLocationModal}
              onClose={() => setShowLocationModal(false)}
              outlet={selectedVisit}
            />
          )}

          {/* Info Rows */}
          {/* {users[0]?.DeveloperName !== "MT_SO" &&
            users[0]?.DeveloperName !== "MT_Merchandiser" &&
            selectedVisit.Add_New_Retailer_Visit__c !== true && (
              <View style={styles.infoItem}>
                <CreditLimit width={18} height={20} style={styles.iconLeft} />
                <View style={styles.infoCol}>
                  <Text style={styles.label}>Credit Limit</Text>
                  <Text style={styles.value}>
                    ₹
                    {accountDetailsData?.CreditLimit__c?.toLocaleString(
                      "en-IN",
                    )}
                  </Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.label}>Credit Days</Text>
                  <Text style={styles.value}>
                    {accountDetailsData?.CreditDays__c} Days
                  </Text>
                </View>
              </View>
            )} */}

          {(users[0]?.DeveloperName === "MT_SO" ||
            users[0]?.DeveloperName === "MT_Merchandiser") &&
            selectedVisit.Add_New_Retailer_Visit__c !== true && (
              <View style={styles.infoItem}>
                <LastVisited width={18} height={20} style={styles.iconLeft} />
                <View style={styles.infoCol}>
                  <Text style={styles.label}>Last Visited</Text>
                  <Text style={styles.value}>
                    {lastVisit?.CheckInTime__c
                      ? formatDateTime(lastVisit?.CheckInTime__c)
                      : "-"}
                  </Text>
                </View>
              </View>
            )}
          {selectedVisit.Add_New_Retailer_Visit__c !== true && (
            <View style={styles.infoItem}>
              <Address width={18} height={20} style={styles.iconLeft} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>
                  {(accountDetailsData?.BillingAddress || "").replace(
                    /,\s*$/,
                    "",
                  )}
                </Text>
              </View>
              {/* <TouchableOpacity style={styles.iconCircle}>
              <Feather name="chevron-right" size={22} color="#A67C2E" />
            </TouchableOpacity> */}
            </View>
          )}
          {users[0]?.DeveloperName !== "MT_SO" &&
            users[0]?.DeveloperName !== "MT_Merchandiser" &&
            selectedVisit.Add_New_Retailer_Visit__c !== true && (
              <View style={styles.infoItem}>
                <LastVisited width={18} height={20} style={styles.iconLeft} />

                {/* <View style={styles.infoCol}>
                  <Text style={styles.label}>Last Spot Sales</Text>
                  <Text style={[styles.value, { fontSize: 12 }]}>
                    {lastOrder?.OrderSubmissionTime__c
                      ? formatDateTime(lastOrder?.OrderSubmissionTime__c)
                      : "-"}
                  </Text>
                </View> */}
                <View style={styles.infoCol}>
                  <Text style={styles.label}>
                    {users[0]?.DeveloperName === "H_T_ASO"
                      ? "Sub DB"
                      : "Distributor"}
                  </Text>
                  <Text style={[styles.value, { fontSize: 12 }]}>
                    {distiData?.label}
                  </Text>
                </View>
              </View>
            )}

          {users[0]?.DeveloperName !== "MT_SO" &&
            users[0]?.DeveloperName !== "MT_Merchandiser" &&
            selectedVisit.Add_New_Retailer_Visit__c !== true && (
              <TouchableOpacity
                onPress={() => {
                  setDetailsVisible(true);
                }}
                style={styles.infoItem}
              >
                <StoreDetails width={18} height={20} style={styles.iconLeft} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Store Details</Text>
                  <Text
                    style={[styles.value, { color: "black", fontSize: 13 }]}
                  >
                    Tap to see more details
                  </Text>
                </View>
                <View style={styles.iconCircle}>
                  <Feather name="chevron-right" size={22} color="#A67C2E" />
                </View>
              </TouchableOpacity>
            )}
        </View>

        {selectedVisit.Add_New_Retailer_Visit__c === true && (
          <View style={styles.actionsWrapper}>
            <TouchableOpacity
              onPress={() => {
                navigation.navigate("OrderHistory");
              }}
              style={[styles.actionCard, { opacity: 1 }]}
            >
              {renderIcon("Spot Sales History")}
              <Text style={styles.actionText}>Spot Sales History</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedVisit.Add_New_Retailer_Visit__c !== true && (
          <>
            {users[0]?.DeveloperName === "H_T_SO" ? (
              <View style={styles.actionsWrapper}>
                {[
                  soVisit.type === "Market and DB Visit"
                    ? "Stock History"
                    : "Spot Sales History",
                  // soVisit.type === 'Individual Market Work' ? 'Spot Sales History' : 'Stock History',
                  "Survey",
                  "Inventory",
                  "Program Outlet Enrolment",
                ]
                  .filter((label) => label !== "Spot Sales History" || !isDistributorVisit)
                  .map((label, idx) => {
                    // Performance
                    const isConditional =
                      label === "Survey" ||
                      label === "Program Outlet Enrolment";
                    const isEnabled =
                      !isConditional ||
                      selectedVisit.VisitStatus__c === "Check In";

                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={
                          isEnabled
                            ? () => {
                                if (label === "Survey") {
                                  // setSurveyVisible(true);
                                  const checkAndNavigate = async () => {
                                    const online = await isInternetAvailable();
                                    if (online) {
                                      navigation.navigate("SurveyFormList", {
                                        formType: "Survey",
                                        title: "Survey Form",
                                      });
                                    } else {
                                      dispatch(
                                        showToast({
                                          type: "error",
                                          message: "Internet is required to access this feature.",
                                        })
                                      );
                                    }
                                  };
                                  checkAndNavigate();
                                } else if (
                                  label === "Program Outlet Enrolment"
                                ) {
                                  navigation.navigate("SROnboardingForm", {
                                    formType: "Program Outlet Enrolment",
                                    title: "Program Outlet Enrolment Form",
                                  });
                                } else if (label === "Summary") {
                                  setDetailsVisible(true);
                                } else if (label === "Spot Sales History") {
                                  navigation.navigate("OrderHistory");
                                } else if (label === "Inventory") {
                                  navigation.navigate("RetailerInventory", {
                                    accountId: selectedVisit?.AccountId || selectedVisit?.AccountId__c,
                                    accountName: accountDetailsData?.Name || selectedVisit?.AccountName,
                                  });
                                } else if (label === "Performance") {
                                  setPerfVisible(true);
                                  setPerformanceModalVisible(true);
                                } else if (label === "Competitor") {
                                  // console.log('clicked inside this ....')
                                  setCompModalVisible(true);
                                } else if (label === "Stock History") {
                                  console.log(
                                    "clicked inside this stock history ....",
                                  );
                                  setStockHistoryVisible(true);
                                }
                              }
                            : null
                        }
                        disabled={!isEnabled}
                        style={[
                          styles.actionCard,
                          { opacity: isEnabled ? 1 : 0.5 },
                        ]}
                      >
                        {renderIcon(label)}
                        <Text style={styles.actionText}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            ) : users[0]?.DeveloperName === "H_T_ASO" ? (
              <View style={styles.actionsWrapper}>
                {["Spot Sales History", "Survey", "Inventory", "Program Outlet Enrolment"]
                  .filter((label) => label !== "Spot Sales History" || !isDistributorVisit)
                  .map(
                  (label, idx) => {
                    const isConditional =
                      label === "Returns" ||
                      label === "Program Outlet Enrolment";
                    const isEnabled =
                      !isConditional ||
                      selectedVisit.VisitStatus__c === "Check Out" ||
                      selectedVisit.VisitStatus__c === "Check In";

                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={
                          isEnabled
                            ? () => {
                                if (label === "Survey") {
                                  // setSurveyVisible(true);
                                  const checkAndNavigate = async () => {
                                    const online = await isInternetAvailable();
                                    if (online) {
                                      navigation.navigate("SurveyFormList", {
                                        formType: "Survey",
                                        title: "Survey Form",
                                      });
                                    } else {
                                      dispatch(
                                        showToast({
                                          type: "error",
                                          message: "Internet is required to access this feature.",
                                        })
                                      );
                                    }
                                  };
                                  checkAndNavigate();
                                } else if (
                                  label === "Program Outlet Enrolment"
                                ) {
                                  navigation.navigate("SROnboardingForm", {
                                    formType: "Program Outlet Enrolment",
                                    title: "Program Outlet Enrolment Form",
                                  });
                                } else if (label === "Summary") {
                                  setDetailsVisible(true);
                                } else if (label === "Returns") {
                                  setSalesReturnVisible(true);
                                } else if (label === "Spot Sales History") {
                                  navigation.navigate("OrderHistory");
                                } else if (label === "Inventory") {
                                  navigation.navigate("RetailerInventory", {
                                    accountId: selectedVisit?.AccountId || selectedVisit?.AccountId__c,
                                    accountName: accountDetailsData?.Name || selectedVisit?.AccountName,
                                  });
                                } else if (label === "Performance") {
                                  setPerfVisible(true);
                                  setPerformanceModalVisible(true);
                                }
                              }
                            : null
                        }
                        disabled={!isEnabled}
                        style={[
                          styles.actionCard,
                          { opacity: isEnabled ? 1 : 0.5 },
                        ]}
                      >
                        {renderIcon(label)}
                        <Text style={styles.actionText}>{label}</Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>
            ) : users[0]?.DeveloperName === "MT_Merchandiser" ? (
              <View style={styles.actionsWrapper}>
                {[
                  "Stock Check",
                  "Pricing",
                  "Competitor",
                  "Exception",
                  "Instore Activity",
                  "Digital Content",
                ].map((label, idx) => {
                  // Apply condition only to "Returns" and "Survey"
                  const isConditional =
                    label === "Stock Check" ||
                    label === "Pricing" ||
                    label === "Competitor" ||
                    label === "Exception" ||
                    label === "Instore Activity" ||
                    label === "Digital Content";
                  const isEnabled =
                    !isConditional ||
                    selectedVisit.VisitStatus__c === "Check In";

                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={
                        isEnabled
                          ? () => {
                              if (label === "Exception") {
                                navigation.navigate("Exception");
                              } else if (label === "Competitor") {
                                navigation.navigate("CompetitorMt");
                              } else if (label === "Pricing") {
                                navigation.navigate("PricingMt");
                              } else if (label === "Instore Activity") {
                                setModalVisibleInstoreActivity(true);
                              } else if (label === "Digital Content") {
                                navigation.navigate("VideoScreen", {
                                  type: digitalContentType,
                                  url: digitalContent,
                                  heading: "Digital Content",
                                });
                              } else if (label === "Growth Mapping") {
                                navigation.navigate("Assortment");
                              } else if (label === "Stock Check") {
                                navigation.navigate("MTStockCheck");
                              }
                            }
                          : null
                      }
                      disabled={!isEnabled}
                      style={[
                        styles.actionCard,
                        { opacity: isEnabled ? 1 : 0.5 },
                      ]}
                    >
                      {renderIcon(label)}
                      <Text style={styles.actionText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : users[0]?.DeveloperName === "MT_SO" ? (
              <View style={styles.actionsWrapper}>
                {[
                  "Stock Check",
                  "Pricing",
                  "Competitor",
                  "Exception",
                  "Instore Activity",
                  "Digital Content",
                  "Growth Mapping",
                ].map((label, idx) => {
                  // Apply condition only to "Returns" and "Survey"
                  const isConditional =
                    label === "Stock Check" ||
                    label === "Pricing" ||
                    label === "Competitor" ||
                    label === "Exception" ||
                    label === "Instore Activity" ||
                    label === "Digital Content" ||
                    label === "Sauda Booking" ||
                    label === "Growth Mapping";
                  const isEnabled =
                    !isConditional ||
                    selectedVisit.VisitStatus__c === "Check In";

                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={
                        isEnabled
                          ? () => {
                              if (label === "Exception") {
                                navigation.navigate("Exception");
                              } else if (label === "Growth Mapping") {
                                navigation.navigate("Assortment");
                              } else if (label === "Competitor") {
                                navigation.navigate("CompetitorMt");
                              } else if (label === "Instore Activity") {
                                setModalVisibleInstoreActivity(true);
                              } else if (label === "Pricing") {
                                navigation.navigate("PricingMt");
                              } else if (label === "Instore Activity") {
                                setModalVisibleInstoreActivity(true);
                              } else if (label === "Digital Content") {
                                navigation.navigate("VideoScreen", {
                                  type: digitalContentType,
                                  url: digitalContent,
                                  heading: "Digital Content",
                                });
                              } else if (label === "Stock Check") {
                                navigation.navigate("MTStockCheck");
                              }
                            }
                          : null
                      }
                      disabled={!isEnabled}
                      style={[
                        styles.actionCard,
                        { opacity: isEnabled ? 1 : 0.5 },
                      ]}
                    >
                      {renderIcon(label)}
                      <Text style={styles.actionText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.actionsWrapper}>
                {[
                  // "Returns",
                  "Spot Sales History",
                  // "Return History",
                  // "Collection History",
                  "Survey",
                  "Inventory",
                  // "Program Outlet Enrolment",
                  "Signage",
                  "Perfect Store",
                  "Merchandise",
                  "Competition Activity",
                ].filter(label => {
                  if (label === "Spot Sales History") {
                    return !isDistributorVisit;
                  }
                  return true;
                }).map((label, idx) => {
                  const isEnabled =
                    label === "Merchandise"
                      ? selectedVisit.VisitStatus__c === "Check In"
                      : true;

                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={
                        isEnabled
                          ? () => {
                              if (label === "Survey") {
                                // setSurveyVisible(true);
                                const checkAndNavigate = async () => {
                                  const online = await isInternetAvailable();
                                  if (online) {
                                    navigation.navigate("SurveyFormList", {
                                      formType: "Survey",
                                      title: "Survey Form",
                                    });
                                  } else {
                                    dispatch(
                                      showToast({
                                        type: "error",
                                        message: "Internet is required to access this feature.",
                                      })
                                    );
                                  }
                                };
                                checkAndNavigate();
                              } else if (label === "Program Outlet Enrolment") {
                                navigation.navigate("SROnboardingForm", {
                                  formType: "Program Outlet Enrolment",
                                  title: "Program Outlet Enrolment Form",
                                });
                              } else if (label === "Summary") {
                                setDetailsVisible(true);
                              } else if (label === "Returns") {
                                setSalesReturnVisible(true);
                              } else if (label === "Spot Sales History") {
                                navigation.navigate("OrderHistory");
                              } else if (label === "Inventory") {
                                navigation.navigate("RetailerInventory", {
                                  accountId: selectedVisit?.AccountId || selectedVisit?.AccountId__c,
                                  accountName: accountDetailsData?.Name || selectedVisit?.AccountName,
                                });
                              } else if (label === "Performance") {
                                setPerfVisible(true);
                                setPerformanceModalVisible(true);
                              } else if (label === "Collection History") {
                                setCollectionModalVisible(true);
                              } else if (label === "Return History") {
                                navigation.navigate("ReturnHistory");
                              } else if (label === "Signage") {
                                const checkAndNavigate = async () => {
                                  const online = await isInternetAvailable();
                                  if (online) {
                                    navigation.navigate("SignageRequest");
                                  } else {
                                    dispatch(
                                      showToast({
                                        type: "error",
                                        message: "Internet is required to access this feature.",
                                      })
                                    );
                                  }
                                };
                                checkAndNavigate();
                              } else if (label === "Perfect Store") {
                                const checkAndNavigate = async () => {
                                  const online = await isInternetAvailable();
                                  if (online) {
                                    navigation.navigate("PerfectStoreTemplatesScreen", {
                                      outletId:
                                        selectedVisit?.AccountId ||
                                        selectedVisit?.AccountId__c,
                                      outletName: selectedVisit?.AccountName,
                                    });
                                  } else {
                                    dispatch(
                                      showToast({
                                        type: "error",
                                        message: "Internet is required to access this feature.",
                                      })
                                    );
                                  }
                                };
                                checkAndNavigate();
                              } else if (label === "Merchandise") {
                                const checkAndNavigate = async () => {
                                  const online = await isInternetAvailable();
                                  if (online) {
                                    navigation.navigate("Merchandising");
                                  } else {
                                    dispatch(
                                      showToast({
                                        type: "error",
                                        message: "Internet is required to access this feature.",
                                      })
                                    );
                                  }
                                };
                                checkAndNavigate();
                              } else if (label === "Competition Activity") {
                                const checkAndNavigate = async () => {
                                  const online = await isInternetAvailable();
                                  if (online) {
                                    navigation.navigate("CompetitionActivity");
                                  } else {
                                    dispatch(
                                      showToast({
                                        type: "error",
                                        message: "Internet is required to access this feature.",
                                      })
                                    );
                                  }
                                };
                                checkAndNavigate();
                              }
                            }
                          : null
                      }
                      disabled={!isEnabled}
                      style={[
                        styles.actionCard,
                        { opacity: isEnabled ? 1 : 0.5 },
                      ]}
                    >
                      {renderIcon(label)}
                      <Text style={styles.actionText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Survey Modal */}
      <SurveyModal
        visible={surveyVisible}
        onClose={() => setSurveyVisible(false)}
        outlet={selectedVisit}
      />

      <StoreDetailsModal
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        data={{
          parentAccount: accountDetailsData?.Name,
          // subChannel: accountDetailsData?.SubChannel__c,
          // subChannel1: accountDetailsData?.SubChannel1__c,
          // subChannel2: accountDetailsData?.SubChannel2__c,
          beat: beatSelection.name,
          email: accountDetailsData?.Email__c,
          phone: accountDetailsData?.Phone,
          gstin: accountDetailsData?.GSTIN_Number__c,
          pan: accountDetailsData?.PAN_Number__c,
          otpVerified: accountDetailsData?.OTPVerified__c,
          kycUpdated: accountDetailsData?.KYC_Updated__c,
        }}
      />

      <EditAccountModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        accountData={accountDetailsData}
        onSuccess={handleUpdateSuccess}
      />

      <CompetitorModal
        visible={compModalVisible}
        onClose={() => setCompModalVisible(false)}
      />
      <StockHistoryModal
        visible={stockHistoryVisible}
        onClose={() => setStockHistoryVisible(false)}
      />

      <OutletPerformanceModal
        visible={performanceModalVisible}
        onClose={() => setPerformanceModalVisible(false)}
      />

      <CollectionModal
        visible={collectionModalVisible}
        onClose={() => setCollectionModalVisible(false)}
      />
      {/* <SalesReturn
        visible={salesReturnVisible}
        onClose={() => setSalesReturnVisible(false)}
        onSubmit={(data) => {
          console.log('Survey submitted:', data);
          setSalesReturnVisible(false);
        }}
      /> */}
      <SalesReturnMain
        visible={salesReturnVisible}
        onClose={() => setSalesReturnVisible(false)}
      />

      <InstoreActivity
        visible={modalVisibleInstoreActivity}
        onClose={() => setModalVisibleInstoreActivity(false)}
      />
    </>
  );
};

export default StoreScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#fff",
    padding: 15,
  },

  badgeRow: {
    flexDirection: "row",
    marginTop: 10,
    flexWrap: "wrap",
    height: 40,
    borderBottomWidth: 1,
    borderColor: "#b1aeaeff",
    gap: 8,
  },
  actionText: {
    marginTop: 6,
    fontSize: 11,
    textAlign: "center",
    color: "#333",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#000",
    //flex: 1,
    textAlign: "left",
    //backgroundColor: 'yellow'
  },

  actionIcons: {
    flexDirection: "row",
    gap: 8,
  },
  iconCircle: {
    backgroundColor: "#F1EADB",
    padding: 6,
    borderRadius: 20,
    marginLeft: 8,
  },

  badge: {
    backgroundColor: "#D9D2C3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    color: "#1F1D1A",
  },
  badgeGreen: {
    backgroundColor: "#D1FADF",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 13,
    color: "#067647",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
  },
  iconLeft: {
    marginRight: 10,
    marginTop: 2,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: "#7A7266",
  },
  value: {
    fontSize: 15,
    color: "#1F1D1A",
    fontWeight: "600",
  },
  actionsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",

    justifyContent: "center",
    marginBottom: 10,
    marginTop: 10,
    gap: 12,
    alignItems: "center",
    // backgroundColor:'red'
  },
  actionCard: {
    backgroundColor: "#fff",
    width: "29%",
    height: 70,
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    //elevation: 2,
    borderWidth: 0.5,
    borderColor: "#CCCCCC",
  },
  actionCard1: {
    backgroundColor: "#fff",
    width: "48%",
    height: 80,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  actionText: {
    marginTop: 6,
    fontSize: 11,
    textAlign: "center",
    color: "#333",
  },

  checkInButton: {
    backgroundColor: "#A67C2E",
    //padding: 2,
    paddingHorizontal: 10,
    textAlign: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    //marginTop: 16,
    alignItems: "center",
  },
  checkInButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
});
