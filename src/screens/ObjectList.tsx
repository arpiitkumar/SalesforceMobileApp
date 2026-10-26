import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList, // CHANGED FROM ScrollView
  TouchableOpacity,
  TextInput,
  Platform,
  Linking,
  StatusBar,
  RefreshControl,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { moderateScale } from "react-native-size-matters";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { RootState } from "../redux/store";
import { useSelector } from "react-redux";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HeaderMain from "../components/HeaderMain";
import moment from "moment";
import { isInternetAvailable } from "../utils/networkUtils";
import { useDispatch } from "react-redux";
import { showToast } from "../redux/slices/toastSlice";
import { dataSyncer } from "../UtilityMain/dataSyncer";

// MEMOIZED - Prevents re-renders when props haven't changed
const InfoRow = React.memo(({ label, value }) => {
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      <Text style={styles.inlineLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}: <Text style={styles.inlineValue}>{value}</Text>
      </Text>
    </View>
  );
});

// EXTRACTED - Memoized details renderer
const DetailSection = React.memo(({ objectName, item }) => {
  if (objectName === "Account") {
    return (
      <>
        <InfoRow label="Phone" value={item.Phone} />
        <InfoRow label="Email" value={item.Email__c} />
        <InfoRow
          label="Address"
          value={item.BillingAddress ? item.BillingAddress.replace(/^,|,$/g, "") : ""}
        />
      </>
    );
  }

  if (objectName === "Competitor_LineItem__c") {
    return (
      <View
        style={{
          paddingHorizontal: 0,
          flexDirection: "row",
          width: 200,
          justifyContent: "space-between",
        }}
      >
        <View>
          <InfoRow label="Oil Type" value={item.OilType__c} />
          <InfoRow
            label="Date"
            value={moment(item.Date__c, "YYYY-MM-DD").format("DD MMM YYYY")}
          />
        </View>
      </View>
    );
  }

  if (objectName === "Stock_Check__c") {
    return (
      <View
        style={{
          paddingHorizontal: 4,
          gap: 10,
          flexDirection: "row",
          width: 200,
          justifyContent: "space-between",
        }}
      >
        <View>
          <InfoRow label="Name" value={item.Name} />
        </View>
      </View>
    );
  }

  if (objectName === "Collection__c") {
    return (
      <View
        style={{
          paddingHorizontal: 4,
          gap: 10,
          flexDirection: "row",
          width: 200,
          justifyContent: "space-between",
        }}
      >
        <View>
          <InfoRow label="Paid Amount" value={item.PaidAmount__c} />
          <InfoRow
            label="Date"
            value={moment(item.DateOfPayment__c, "YYYY-MM-DD").format(
              "DD MMM YYYY"
            )}
          />
        </View>
      </View>
    );
  }

  if (objectName === "Salary_Acknowledgement__c") {
    return (
      <>
        <InfoRow label="Amount" value={item.Amount__c} />
        <InfoRow label="Submitted Date" value={item.Submitted_Date__c} />
      </>
    );
  }

  if (objectName === "HNT_Competitor_Price__c") {
    return (
      <>
        <InfoRow label="Brand" value={item.Brand__c} />
        <InfoRow
          label="Grammage"
          value={item.Grammage__c + " (" + item.Pack_Type__c + ")"}
        />
        {/* <InfoRow label="Pack Type" value={item.Pack_Type__c} /> */}
      </>
    );
  }

  return <Text style={{ color: "red" }}>Unsupported object type</Text>;
});

function generateRandomCode() {
  const prefix = "CL";
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${number}`;
}

// MEMOIZED LIST ITEM - Heavy component memoization
const ListItemCard = React.memo(
  ({ item, objectName, onPress, onCallPress }) => {
    const [dbName, setDbName] = useState("");
    useEffect(() => {
      let mounted = true;

      const fetchDbName = async () => {
        if (objectName !== "Salary_Acknowledgement__c" || !item?.DB_Name__c)
          return;

        try {
          const res = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [{ field: "Sf_Id", value: item.DB_Name__c }],
          });
          console.log("res[0]?.Name", res[0]?.Name);
          if (mounted && res?.length > 0) {
            setDbName(res[0]?.Name || "");
          }
        } catch (e) {
          console.error("DB name fetch failed", e);
        }
      };

      fetchDbName();

      return () => {
        mounted = false;
      };
    }, [objectName, item?.DB_Name__c]);

    const borderColor = useMemo(() => {
      if (objectName === "Stock_Check__c") {
        if (item?.Available__c === true) return "#28A745";
        if (item?.Not_Available__c === true) return "#B3261E";
      }
      return "#143A8C";
    }, [item, objectName]);

    const displayName = useMemo(() => {
      if (objectName === "Competitor_LineItem__c") {
        return item.Name || generateRandomCode();
      }
      if (objectName === "Salary_Acknowledgement__c") {
        return dbName || "—";
      }

      if (objectName === "Account") {
        if (!item?.Name) return "";
        return item.Party_Code__c
          ? `${item.Name} (#${item.Party_Code__c})`
          : item.Name;
      }

      return item.Name || "";
    }, [item, objectName, dbName]);

    return (
      <TouchableOpacity
        disabled={objectName === "Stock_Check__c"}
        style={[styles.card, { borderLeftColor: borderColor }]}
        onPress={() => onPress(item.isLead ? "Lead__c" : objectName, item.Sf_Id, item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
              marginRight: 8,
            }}
          >
            <Text
              style={styles.nameText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>
            {item.isLead && (
              <View style={[
                styles.badgeContainer,
                {
                  backgroundColor: item.Approval_Status__c === 'Approved' ? '#E3F1EA' :
                                   item.Approval_Status__c === 'Rejected' ? '#F9E5E3' : '#FBEFD8',
                  marginLeft: 8
                }
              ]}>
                <Text style={[
                  styles.badgeText,
                  {
                    color: item.Approval_Status__c === 'Approved' ? '#2E7D5B' :
                           item.Approval_Status__c === 'Rejected' ? '#B3261E' : '#EF6C00'
                  }
                ]}>
                  Approval Status: {item.Approval_Status__c || 'Pending'}
                </Text>
              </View>
            )}
            {(item.is_synced === false || item.is_synced === 0) && (
              <Text
                style={{
                  color: "#B3261E",
                  fontSize: 10,
                  fontWeight: "700",
                  marginLeft: 6,
                }}
              >
                Not Synced
              </Text>
            )}
          </View>

          {objectName === "Account" && (
            <TouchableOpacity
              style={styles.callCircle}
              onPress={() => onCallPress(item?.Phone)}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path 
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" 
                  stroke="#fff" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
              </Svg>
            </TouchableOpacity>
          )}
        </View>

        <DetailSection objectName={objectName} item={item} />
      </TouchableOpacity>
    );
  }
);

const ObjectList = ({
  title = "List",
  objectName,
  plus = true,
  onClose = null,
  subObject = null,
}) => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { fetchRecords, apiFetch, apiComposite } = useApiFetch();
  const params = route?.params || {};
  const finalTitle = params.title ?? title;
  const finalObjectName = params.objectName ?? objectName;
  const finalSubObject = params.subObject ?? subObject;

  const checkForInternet = async () => {
    const connected = await isInternetAvailable();
    if (!connected) return false;
    else return true;
  };

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cache key to prevent redundant fetches
  const cacheKeyRef = useRef(null);

  const searchParam = useSelector(
    (state: RootState) => state.search.searchParam
  );
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);

  const handleCallPress = useCallback((number) => {
    if (!number) return;
    Linking.openURL("tel:" + number);
  }, []);

  const goToDetails = useCallback(
    (objectName, objectId, item) => {
      console.log("Navigating to details with:", objectName, objectId);
      if (
        objectName === "Competitor_LineItem__c" ||
        objectName === "Collection__c" ||
        objectName === "Stock_Check__c"
      ) {
        handleClose();
      }
      navigation.navigate("ObjectDetail", {
        objectName: objectName,
        objectId: objectId,
        item: item,
      });
    },
    [navigation, handleClose]
  );

  const { accessToken, instanceUrl } = useSelector(
    (state: RootState) => state.auth
  );


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cacheKeyRef.current = null; // Bypass cache
    try {
      const connected = await isInternetAvailable();
      if (connected && accessToken && instanceUrl) {
        await dataSyncer(
          { accessToken, instanceUrl },
          fetchRecords,
          apiFetch,
          apiComposite
        );
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Refresh failed in ObjectList:", error);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, instanceUrl, fetchRecords, apiFetch, apiComposite]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const initialize = async () => {
        // Check cache to avoid redundant fetches
        const cacheKey = `${finalObjectName}-${finalSubObject}-${selectedVisit?.sfId}`;
        if (cacheKeyRef.current === cacheKey && accounts.length > 0) {
          console.log("Using cached data");
          return;
        }

        setLoading(true);
        try {
          let result = [];
          if (finalObjectName === "Account" && finalSubObject === "Retailer") {
            const users = await UniversalUpdateInsert({
              ObjectName: "User",
              Type: "get",
            });
            const userId = users && users[0]?.Sf_Id;
            console.log("Retailer Onboarding user ID:", userId);

            const connected = await isInternetAvailable();
            console.log("Retailer Onboarding network connected:", connected);

            if (connected && userId) {
              try {
                const queryStr = `SELECT Id, Name, MobileNumber__c, Email__c, Outlet_Address__c, Billing_Street__c, Billing_City__c, Billing_State__c, Billing_Postal_Code__c, Billing_Country__c, Approval_Status__c, RegisteredDate__c, FSSAINumber__c, GSTIN_Number__c, PANNumber__c, CreatedDate FROM Lead__c WHERE CreatedById = '${userId}'`;
                console.log("Retailer Onboarding Query:", queryStr);
                const serverLeads = await fetchRecords("Lead__c", queryStr);
                console.log("Retailer Onboarding fetched Leads:", JSON.stringify(serverLeads));
                if (Array.isArray(serverLeads)) {
                  result = serverLeads.map(lead => ({
                    Sf_Id: lead.Id,
                    Name: lead.Name,
                    Phone: lead.MobileNumber__c || "",
                    Email__c: lead.Email__c || "",
                    BillingAddress: lead.Outlet_Address__c || [
                      lead.Billing_Street__c,
                      lead.Billing_City__c,
                      lead.Billing_State__c,
                      lead.Billing_Postal_Code__c,
                      lead.Billing_Country__c
                    ].filter(Boolean).join(', '),
                    isLead: true,
                    Approval_Status__c: lead.Approval_Status__c || "Pending",
                    RegisteredDate__c: lead.RegisteredDate__c || "",
                    FSSAINumber__c: lead.FSSAINumber__c || "",
                    GSTIN_Number__c: lead.GSTIN_Number__c || "",
                    PANNumber__c: lead.PANNumber__c || "",
                    CreatedDate: lead.CreatedDate || ""
                  }));
                } else {
                  console.log("serverLeads is not an array:", serverLeads);
                }
              } catch (err) {
                console.error("Failed to query Lead__c on Salesforce:", err);
              }
            } else {
              console.log("No internet or no user ID, cannot load Leads");
            }
          } else {
            const params = {
              ObjectName: finalObjectName,
              Type: "get",
            };

            if (finalObjectName === "Stock_Check__c") {
              params.filters = [
                { field: "Visit__c", value: selectedVisit?.sfId },
              ];
            } else if (
              finalObjectName === "Account" &&
              finalSubObject === "Sub Distributor"
            ) {
              params.filters = [{ field: "Type", value: finalSubObject }];
            } else if (finalObjectName === "Competitor_LineItem__c") {
              params.filters = [
                { field: "Customer__c", value: selectedVisit?.AccountId },
              ];
            } else if (finalObjectName === "Salary_Acknowledgement__c") {
              params.filters = [{ field: "Claim_Generated__c", value: false }];
            } else if (finalObjectName === "Collection__c") {
              params.filters = [];
            }

            result = await UniversalUpdateInsert(params);
          }

          let finalResult = result;

          if (finalObjectName === "Account") {
            // Optimized sorting
            finalResult = [...result].sort((a, b) => {
              const dateA = new Date(a.last_modified || a.CreatedDate || 0);
              const dateB = new Date(b.last_modified || b.CreatedDate || 0);
              return dateB - dateA;
            });
          }

          if (finalObjectName === "HNT_Competitor_Price__c") {
            finalResult = [...result].sort((a, b) => {
              const dateA = new Date(a.Date__c || a.last_modified || 0);
              const dateB = new Date(b.Date__c || b.last_modified || 0);
              return dateB - dateA; // 🔥 latest first
            });
          }

          // if (finalObjectName === "Collection__c") {
          //     // Optimized sorting
          //     finalResult = [...result].sort((a, b) => {
          //         const dateA = new Date(a.DateOfPayment__c || a.last_modified || 0);
          //         const dateB = new Date(b.DateOfPayment__c || b.last_modified || 0);
          //         return dateB - dateA;
          //     });
          // }
          if (finalObjectName === "Collection__c") {
            finalResult = [...result].sort((a, b) => {
              const numA = parseInt((a.Name || "").replace(/\D/g, ""), 10) || 0;
              const numB = parseInt((b.Name || "").replace(/\D/g, ""), 10) || 0;

              return numB - numA; // Higher COL number on top
            });
          }

          if (isActive) {
            setAccounts(finalResult);
            cacheKeyRef.current = cacheKey; // Update cache key
          }
        } catch (error) {
          console.error(" Get Data Failed:", error);
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      initialize();

      return () => {
        isActive = false;
      };
    }, [finalObjectName, finalSubObject, selectedVisit, refreshTrigger])
  );

  // MEMOIZED FILTERING - Only re-computes when dependencies change
  const filteredAccounts = useMemo(() => {
    return accounts.filter((item) => {
      const label = item.Name || "";
      return label.toLowerCase().includes((searchParam || "").toLowerCase());
    });
  }, [accounts, searchParam]);

  // MEMOIZED KEY EXTRACTOR - Better FlatList performance
  // const keyExtractor = useCallback((item, index) => {
  //     return item.Sf_Id ? `${item.Sf_Id}-${index}` : `list-item-${index}`;
  // }, []);

  const keyExtractor = useCallback((item) => item.Sf_Id, []);
  // MEMOIZED RENDER ITEM
  const renderItem = useCallback(
    ({ item }) => (
      <ListItemCard
        item={item}
        objectName={finalObjectName}
        onPress={goToDetails}
        onCallPress={handleCallPress}
      />
    ),
    [finalObjectName, goToDetails, handleCallPress]
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <LoaderOverlay visible={loading} />
      </View>
    );
  }

  const backgroundColor =
    (finalObjectName === "Account" && finalSubObject === "Sub Distributor") ||
      finalObjectName === "Salary_Acknowledgement__c"
      ? "#A67C2E"
      : "#FBF8F1";

  return (
    <SafeAreaProvider style={[styles.safeArea]}>
      {/* {finalObjectName === 'Account' && finalSubObject === 'Sub Distributor' && (
                <>
                    <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
                    <View style={styles.headerContainer}>
                        <HeaderMain screenName={finalTitle} />
                    </View>
                </>
            )} */}
      {(finalObjectName === "Salary_Acknowledgement__c" ||
        finalObjectName === "HNT_Competitor_Price__c") && (
          <>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
              <HeaderMain screenName={finalTitle} />
            </View>
          </>
        )}

      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        <View style={styles.container}>
          {plus === true && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{finalTitle}</Text>
              <TouchableOpacity
                onPress={async () => {
                  const internetResult = await checkForInternet();
                  if (internetResult === false) {
                    dispatch(
                      showToast({
                        message:
                          "No internet connection! Cannot add a new record.",
                        type: "warning",
                      })
                    );
                    return;
                  }
                  let screen;

                  screen =
                    finalObjectName === "Salary_Acknowledgement__c"
                      ? "AddSalaryAcknowledgement"
                      : finalObjectName === "Competitor_LineItem__c"
                        ? "CompetitorAddForm"
                        : finalObjectName === "HNT_Competitor_Price__c"
                          ? "CompetitorAddForm"
                          : finalObjectName === "Account" &&
                            finalSubObject === "Sub Distributor"
                            ? "AddSubDbForm"
                            : "NearbyRetailerSearch";

                  // console.log('finalObjectName', finalObjectName);
                  // console.log('finalSubObject', finalSubObject);
                  console.log("screen", screen);

                  navigation.navigate(screen);
                }}
              >
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path 
                    d="M12 5v14M5 12h14" 
                    stroke="gray" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          )}

          {/* SWITCHED TO FlatList */}
          <FlatList
            data={filteredAccounts}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.cardContainer}
            ListEmptyComponent={
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No records found</Text>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            // FlatList optimization props
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
          />
        </View>
      </View>
    </SafeAreaProvider>
  );
};

export default ObjectList;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#A67C2E" },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 26,
    paddingBottom: 10,
    paddingHorizontal: moderateScale(16),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "black",
    fontSize: 18,
    marginLeft: 10,
    fontWeight: "600",
  },
  cardContainer: {
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: "#143A8C",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  nameText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    flex: 1,
  },
  callCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#C9A24D",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  infoRow: {
    marginBottom: 6,
  },
  inlineLabel: {
    fontSize: 12,
    color: "#444",
    fontWeight: "400",
  },
  inlineValue: {
    fontWeight: "300",
    color: "#222",
  },
  loaderContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
    flex: 1,
  },
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  noDataText: {
    fontSize: 16,
    color: "#888",
  },
  headerContainer: {
    backgroundColor: "#A67C2E",
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
