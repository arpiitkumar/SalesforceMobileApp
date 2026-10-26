import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Truck from "../assets/images/truck.svg";
import CheckCircle from "../assets/images/check-circle.svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gradients } from "../assets/css/MasterCss.js";
import { useFocusEffect } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import ViewOrderDetailsModal from "../components/modal/ViewOrderDetailsModal";
import HeaderMain from "../components/HeaderMain";
import Icon from "../components/Ionicons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { orderInvice } from "./getJobCardInvoiceTemplate";
import RNPrint from "react-native-print";
import { RootState } from "../redux/store"; // Make sure your RootState is properly defined
import moment from "moment";
import { showToast } from "../redux/slices/toastSlice";
import { useDispatch } from "react-redux";
import { OrderRecordTypeId_var } from "../../config";
import { getRoutePlanFromVisit } from "../utils/getRoutePlanFromVisit";
import {
  resolveOrderClassification,
  ORDER_TYPES,
} from "../utils/orderClassification/orderClassificationService";
import { formatUnitsWithCases, formatCasesWithUnits, unitsToCases } from "../utils/helper/caseUnits";

const { width } = Dimensions.get("window");

const getBorderColor = (order) => {
  if (order?.sync_status === "failed") return "#B3261E";
  if (order?.is_synced === false || order?.is_synced === 0) return "#f59e0b";
  if (order?.Status === "Completed") return "#28a745";
  return "#f7a536";
};

const OrderHistoryScreen = () => {
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount.selectedAccount);

  console.log("OrderRecordTypeId_var", OrderRecordTypeId_var);
  // console.log('ReturnRecordTypeId_var', ReturnRecordTypeId_var)
  //const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const [selectedTab, setSelectedTab] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalProducts, setModalProducts] = useState([]);
  const [isOrderSynced, setIsOrderSynced] = useState(true);
  const [orderErrorMsg, setOrderErrorMsg] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isSelectedOrderNonDms, setIsSelectedOrderNonDms] = useState(false);
  const [accountDataFromVisit, setAccountDataFromVisit] = useState(null);
  const [users, setUsers] = useState([]);
  const [orderClassification, setOrderClassification] = useState({
    orderType: ORDER_TYPES.DMS,
    isNonDmsOrder: false,
    baState: null,
    error: null,
  });
  const dispatch = useDispatch();

  const isNonDmsOrder = (order) => {
    if (orderClassification?.isNonDmsOrder) return true;
    return Boolean(
      order?.IsNonDmsOrder__c === true ||
      order?.IsNonDmsOrder__c === "true" ||
      order?.IsNonDmsOrder__c === 1 ||
      order?.IsNonDmsOrder__c === "1" ||
      order?.isNonDmsOrder === true ||
      order?.OrderType === "NON_DMS" ||
      order?.OrderType__c === "NON_DMS"
    );
  };

  const selectedVisit = useSelector((state) => state.selectedVisit);

  const sameSalesforceId = (first, second) => {
    if (!first || !second) return false;
    const a = String(first).trim();
    const b = String(second).trim();
    return a === b || a.slice(0, 15) === b.slice(0, 15);
  };

  //console.log('log log ----', data);

  const statusMap = {
    All: null,
    Draft: "Draft",
    Completed: "Completed",
    Rejected: "Rejected",
  };
  
  const getOrderStatusLabel = (order) => {
    const isOfflineUnsynced = order.is_synced === false || order.is_synced === 0;
    const isSyncFailed = order.sync_status === "failed";

    if (isSyncFailed) {
      return "Sync Failed";
    }

    if (isOfflineUnsynced) {
      return "Pending Sync (Offline)";
    }

    if (order.Status === "Completed") {
      return users[0]?.DeveloperName === "H_T_ASO"
        ? "Fulfilled"
        : `Fulfilled${order.Fulfillment_Status__c ? ` (${order.Fulfillment_Status__c})` : ""}`;
    }

    return order.Status || "Placed";
  };

  const filteredData = (data || []).filter((o) => {
    if (!o) return false;
    const search = (searchText || "").toLowerCase().trim();
    const matchesStatus = !statusMap[selectedTab] || o.Status === statusMap[selectedTab];
    const matchesSearch =
      !search ||
      String(o.Sf_Id || "").toLowerCase().includes(search) ||
      String(o.OrderNumber || "").toLowerCase().includes(search) ||
      String(o.Mobile_Unique_Id__c || "").toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
  });

  useFocusEffect(
    useCallback(() => {
      const getUserData = async () => {
        try {
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          setUsers(result || []);
          const userId = result?.[0]?.Sf_Id || result?.[0]?.Id;
          const classification = await resolveOrderClassification({ userId });
          setOrderClassification(classification);
        } catch (error) {
          console.error("Get User Failed For the Header:", error);
        }
      };
      getUserData();

      const getOrderData = async () => {
        try {
          // Fetch ALL local orders stored in WatermelonDB to work seamlessly offline
          const getOrderedData = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
          });

          let allOrderItems = [];
          try {
            allOrderItems = await UniversalUpdateInsert({
              ObjectName: "OrderItem",
              Type: "get",
            });
          } catch (_) {
            allOrderItems = [];
          }

          const orderItemsByOrderId = (allOrderItems || []).reduce((acc, item) => {
            if (item?.OrderId) {
              if (!acc[item.OrderId]) acc[item.OrderId] = [];
              acc[item.OrderId].push(item);
            }
            return acc;
          }, {});

          const selectedAccountId =
            selectedVisit?.AccountId__c ||
            selectedVisit?.AccountId ||
            selectedAccount?.Sf_Id ||
            selectedAccount?.sfId ||
            selectedAccount?.Id;

          const orderByDuplicateKey = new Map();
          (getOrderedData || []).forEach((order) => {
            const orderAccountId = order.AccountId__c || order.AccountId;
            // Skip orders that don't belong to the selected outlet
            if (selectedAccountId) {
              if (!orderAccountId || !sameSalesforceId(orderAccountId, selectedAccountId)) {
                return;
              }
            }

            const uniqueKey =
              order.Sf_Id ||
              order.Mobile_Unique_Id__c ||
              order.OrderNumber ||
              order.id ||
              `${orderAccountId}_${order.OrderSubmissionTime__c}_${order.TotalAmount}`;

            const items =
              orderItemsByOrderId[order.Sf_Id] ||
              orderItemsByOrderId[order.id] ||
              (order.Mobile_Unique_Id__c ? orderItemsByOrderId[order.Mobile_Unique_Id__c] : []) ||
              [];

            const computedTotalAmount = items.reduce(
              (sum, it) => sum + Number(it.GrossAmount__c || it.NetAmount__c || 0),
              0
            );
            const computedTotalQty = items.reduce(
              (sum, it) => sum + Number(it.Quantity || 0),
              0
            );
            const quantitySummary = items.reduce((summary, it) => {
              const boxQty = Number(it.Quantity_In_Box__c);
              const pcsQty = Number(it.Quantity_In_Pcs__c);
              if (Number.isFinite(boxQty) && boxQty > 0) summary.cases += boxQty;
              else if (Number.isFinite(pcsQty) && pcsQty > 0) summary.units += pcsQty;
              else if (String(it.UOM__c || "").toLowerCase() === "box") summary.cases += Number(it.OrderQtyInCase__c || it.Quantity || 0);
              else summary.units += Number(it.Quantity || 0);
              return summary;
            }, { cases: 0, units: 0 });

            const enrichedOrder = {
              ...order,
              TotalAmount: order.TotalAmount || computedTotalAmount || 0,
              TotalOrderQtyInPcs__c: order.TotalOrderQtyInPcs__c || computedTotalQty || 0,
              totalCases: quantitySummary.cases,
              totalUnits: quantitySummary.units,
            };

            const existing = orderByDuplicateKey.get(uniqueKey);
            if (existing) {
              const existingSynced = existing.is_synced !== false && existing.is_synced !== 0;
              const currentSynced = enrichedOrder.is_synced !== false && enrichedOrder.is_synced !== 0;
              if (currentSynced && !existingSynced) {
                orderByDuplicateKey.set(uniqueKey, enrichedOrder);
              }
            } else {
              orderByDuplicateKey.set(uniqueKey, enrichedOrder);
            }
          });

          const sortedOrders = Array.from(orderByDuplicateKey.values()).sort((a, b) => {
            const dateA = new Date(a.OrderSubmissionTime__c || a.CreatedDate || a.EffectiveDate || a.last_modified || 0).getTime();
            const dateB = new Date(b.OrderSubmissionTime__c || b.CreatedDate || b.EffectiveDate || b.last_modified || 0).getTime();
            if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
              return dateB - dateA;
            }
            const numA = parseInt(a.OrderNumber?.replace(/\D/g, ""), 10);
            const numB = parseInt(b.OrderNumber?.replace(/\D/g, ""), 10);
            return (isNaN(numB) ? 0 : numB) - (isNaN(numA) ? 0 : numA);
          });

          console.log("Fetched orders count for history:", sortedOrders.length);
          setData(sortedOrders);
        } catch (error) {
          console.error("Error fetching order data:", error);
        }
      };

      getOrderData();
    }, [selectedVisit, selectedAccount])
  );

  const handleViewDetails = async (orderId) => {
    try {
      setSelectedOrderId(orderId);

      const parentOrders = await UniversalUpdateInsert({
        ObjectName: "Order",
        Type: "get",
        filters: [{ field: "Sf_Id", value: orderId }],
      });
      let parentOrder = parentOrders?.[0];
      if (!parentOrder) {
        const allOrders = await UniversalUpdateInsert({ ObjectName: "Order", Type: "get" });
        parentOrder = allOrders?.find((o) => o.Sf_Id === orderId || o.id === orderId);
      }

      if (parentOrder) {
        setIsSelectedOrderNonDms(isNonDmsOrder(parentOrder));
        setIsOrderSynced(
          parentOrder.is_synced !== false && parentOrder.is_synced !== 0
        );
        setOrderErrorMsg(parentOrder.ErrorMsg || "");
      } else {
        setIsSelectedOrderNonDms(false);
        setIsOrderSynced(true);
        setOrderErrorMsg("");
      }

      const allOrderItems = await UniversalUpdateInsert({
        ObjectName: "OrderItem",
        Type: "get",
      });

      const orderItems = (allOrderItems || []).filter(
        (item) =>
          item.OrderId === orderId ||
          (parentOrder && (item.OrderId === parentOrder.Sf_Id || item.OrderId === parentOrder.id))
      );

      const allProducts = await UniversalUpdateInsert({
        ObjectName: "Product2",
        Type: "get",
      });

      const productMap = (allProducts || []).reduce((acc, product) => {
        if (product.Sf_Id) acc[product.Sf_Id] = product;
        if (product.id) acc[product.id] = product;
        if (product.ProductCode) acc[product.ProductCode] = product;
        return acc;
      }, {});

      const enrichedItems = orderItems
        .map((item) => {
          const product = productMap[item.Product2Id] || productMap[item.product2Id] || {};

          const imageSource = product.ProductImageURL__c
            ? { uri: product.ProductImageURL__c }
            : require("../assets/images/food.png");

          return {
            id: item.Product2Id || item.id,
            name: product.Name || item.Product2Id || "Product",
            ptd: product.PTD__c ?? 0,
            ptr:
              item?.SRChangedPrice__c || item?.UnitPrice || product.PTR__c || 0,
            margin: product.Margin__c ? `${product.Margin__c}%` : "0%",
            stock: product.Stock__c ?? "NA",
            qty: item.Quantity ?? "-",
            cases: Number(item.Quantity_In_Box__c) || 0,
            units: Number(item.Quantity_In_Pcs__c) || 0,
            gross:
              item.Reason_Of_Return__c === ""
                ? item.GrossAmount__c
                : item.Sales_Return_Value__c,
            uom: item.UOM__c ?? "-",
            image: imageSource,
            netAmount: item.NetAmount__c,
            returnReason: item.Reason_Of_Return__c || "",
            is_synced: item.is_synced,
            isNonDmsOrder: isNonDmsOrder(parentOrder),
          };
        })
        .filter(Boolean);

      setModalProducts(enrichedItems);
      setShowModal(true);
    } catch (error) {
      console.error("Error loading order details:", error);
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      // fetch invoice(s) related to the order
      const InvoiceFromOrder = await UniversalUpdateInsert({
        ObjectName: "Invoice__c",
        Type: "get",
        filters: [{ field: "Order__c", value: orderId }],
      });

      if (!InvoiceFromOrder || InvoiceFromOrder.length === 0) {
        console.warn("No invoice found for order:", orderId);
        return;
      }

      const invoice = InvoiceFromOrder[0];

      // fetch invoice items
      const InvoiceItemFromInvoice = await UniversalUpdateInsert({
        ObjectName: "Invoice_Item__c",
        Type: "get",
        filters: [{ field: "Invoice__c", value: invoice.Sf_Id }],
      });
      console.log("InvoiceFromOrder", InvoiceFromOrder);
      console.log("InvoiceItemFromInvoice", InvoiceItemFromInvoice);

      // fetch customer (Account) record if Customer__c exists
      let customerRecord = {};
      if (invoice.Customer__c) {
        try {
          const customerRes = await UniversalUpdateInsert({
            ObjectName: "Account", // or the correct object for Customer in your DB
            Type: "get",
            filters: [{ field: "Sf_Id", value: invoice.Customer__c }],
          });
          customerRecord = (customerRes && customerRes[0]) || {};
        } catch (err) {
          console.warn(
            "Failed to fetch customer record, continuing with defaults.",
            err
          );
        }
      }

      // fetch customer (Account) record if SupplierName__c exists
      let ParentcustomerRecord = {};
      console.log("invoice.SupplierName__c", invoice.SupplierName__c);
      if (invoice.SupplierName__c) {
        try {
          const ParentcustomerRes = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [{ field: "Sf_Id", value: invoice.SupplierName__c }],
          });
          console.log(
            "ParentcustomerRes------------------------------",
            ParentcustomerRes
          );
          ParentcustomerRecord =
            (ParentcustomerRes && ParentcustomerRes[0]) || {};
        } catch (err) {
          console.warn(
            "Failed to fetch customer record, continuing with defaults.",
            err
          );
        }
      }

      // console.log('selecte INCVOIDE', InvoiceFromOrder)
      // console.log('selecte INCVOIDE ITEM', InvoiceItemFromInvoice)
      // console.log('selectedAccount in order history', selectedVisit.AccountId)
      // console.log('selectedVisit in order history', selectedVisit.AccountId)

      const visitAccId = selectedVisit?.AccountId__c || selectedVisit?.AccountId;
      const getAccountData = visitAccId
        ? await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [{ field: "Sf_Id", value: visitAccId }],
          })
        : [];

      setAccountDataFromVisit(getAccountData);

      const { routePlanName } = await getRoutePlanFromVisit(selectedVisit);
      console.log(routePlanName);

      const htmlContentInvoice = orderInvice({
        invoice,
        items: InvoiceItemFromInvoice || [],
        customer: customerRecord || {},
        meta: { salesman: "Sandeep Sharma", route: "Vaishali Nager" },
        selectedAccount: getAccountData,
        ParentcustomerRecord: ParentcustomerRecord || {},
        RouteName: routePlanName,
      });

      // Print once, inside try/catch
      try {
        await RNPrint.print({ html: htmlContentInvoice });
      } catch (error) {
        console.error("Failed to open print dialog:", error);
      }
    } catch (error) {
      console.error("Error in handleDownloadInvoice:", error);
    }
  };

  const renderOrderCard = (item) => (
    <View style={styles.card}>
      {/* <Text style={styles.statusText}>
        {item.Status === 'Completed'
          ? `Fulfilled${item.Fulfillment_Status__c ? ` (${item.Fulfillment_Status__c})` : ''}`
          : item.Status} on {moment(item.OrderSubmissionTime__c).format('DD MMM YYYY')}
      </Text> */}
      <Text style={styles.statusText}>
        {getOrderStatusLabel(item)}{" "}
        on {moment(item.OrderSubmissionTime__c).format("DD MMM YYYY")}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 5 }}
      >
        <View
          style={[
            styles.iconContainer,
            { borderColor: getBorderColor(item) },
          ]}
        >
          {item.Status === "Completed" ? (
            <CheckCircle width={30} height={30} />
          ) : (
            <Truck width={30} height={30} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={[styles.row, { flexDirection: "row", marginBottom: 5 }]}>
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Spot Sales No.</Text>
              <Text style={styles.value}>{item.OrderNumber || item.Sf_Id}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Spot Sales Date</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.value}>
                  {moment(item.OrderSubmissionTime__c).format("DD MMM YYYY")}
                </Text>
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
            </View>
          </View>

          <View style={[styles.row, { flexDirection: "row" }]}>
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Cases</Text>
              <Text style={styles.value}>{unitsToCases(item.totalUnits || 0)}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Units</Text>
              <Text style={styles.value}>{item.totalUnits || 0}</Text>
            </View>
            {!isNonDmsOrder(item) && (
              <View style={styles.infoBlock}>
                <Text style={styles.label}>Total Net Amount</Text>
                <Text style={styles.value}>
                  {" "}
                  ₹{" "}
                  {Number(
                    item.TotalAmount || item.Total_Return_Value__c || 0
                  ).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => handleViewDetails(item.Sf_Id)}
        >
          <Text style={styles.detailButtonText}>View Details</Text>
        </TouchableOpacity>

        {users[0]?.DeveloperName !== "H_T_ASO" && !isNonDmsOrder(item) && (
          <TouchableOpacity
            style={[
              styles.detailButton,
              {
                borderColor: item.Status === "Completed" ? "#C9A24D" : "#aaa",
              },
            ]}
            // disabled={item.Status !== "Completed"}
            onPress={() => {
              if (item.Status === "Completed") {
                handleDownloadInvoice(item.Sf_Id);
              } else {
                dispatch(
                  showToast({
                    message:
                      "You can download the invoice only on fulfilled spot sales",
                    type: "warning",
                  })
                );
                console.log("Order not completed. Cannot download invoice.");
              }
            }}
          // onPress={() => {
          //   handleDownloadInvoice(item.Sf_Id);
          // }}
          >
            <Text
              style={[
                styles.detailButtonText,
                {
                  color: item.Status === "Completed" ? "#C9A24D" : "#666",
                },
              ]}
            >
              Download Invoice
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      <View style={styles.headerContainer}>
        <HeaderMain screenName="Spot Sales History" />
      </View>

      <View style={styles.content}>
        <View style={styles.searchSection}>
          <TextInput
            placeholder="Search"
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            placeholderTextColor="#979797"
          />
          <Icon
            name="search"
            size={18}
            color="#979797"
            style={styles.searchIcon}
          />
        </View>

        <Text style={styles.subText}>Spot Sales from last 1 months.</Text>
        {users[0]?.DeveloperName !== "H_T_ASO" && (
          <View style={styles.tabContainer}>
            {["All", "Draft", "Completed", "Rejected"].map((tab) => {
              const isActive = tab === selectedTab;
              const count = data.filter(
                (o) => !statusMap[tab] || o.Status === statusMap[tab]
              ).length;

              return (
                <TouchableOpacity key={tab} onPress={() => setSelectedTab(tab)}>
                  {isActive ? (
                    <LinearGradient
                      colors={Gradients.primary}
                      style={[styles.tab, styles.activeTab]}
                    >
                      <Text style={[styles.tabText, styles.activeTabText]}>
                        {tab === "Completed" ? "Fulfilled" : tab} ({count})
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tab}>
                      <Text style={styles.tabText}>
                        {tab === "Completed" ? "Fulfilled" : tab} ({count})
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <FlatList
          data={filteredData}
          renderItem={({ item }) => renderOrderCard(item)}
          keyExtractor={(item, index) =>
            item.Sf_Id || item.Id || item.OrderNumber || `idx-${index}`
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              No spot sales found.
            </Text>
          }
        />
      </View>

      <ViewOrderDetailsModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        products={modalProducts}
        isOrderSynced={isOrderSynced}
        orderErrorMsg={orderErrorMsg}
        isNonDmsOrder={isSelectedOrderNonDms}
      />
    </SafeAreaProvider>
  );
};

export default OrderHistoryScreen;

const styles = StyleSheet.create({
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
  searchSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#000",
    fontSize: 14,
    padding: 0,
  },
  subText: {
    color: "#7A7266",
    fontWeight: "400",
    marginVertical: 10,
    fontSize: 12,
  },
  tabContainer: { flexDirection: "row", marginBottom: 16 },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#F1EADB",
    borderWidth: 1,
    borderColor: "#C9A24D",
    marginRight: 7,
  },
  activeTab: { borderColor: "transparent" },
  tabText: { fontSize: 12, color: "#1F1D1A" },
  activeTabText: { color: "#fff", fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    color: "#1F1D1A",
  },
  row: {
    justifyContent: "space-between",
    marginTop: 6,
  },
  iconContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 12,
  },
  infoBlock: { flex: 1, paddingHorizontal: 4 },
  label: { fontSize: 10, color: "#7A7266", fontWeight: "400" },
  value: { fontSize: 12, fontWeight: "500", color: "#1F1D1A" },
  buttonRow: {
    gap: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  detailButton: {
    flex: 1,
    backgroundColor: "#F1EADB",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  detailButtonText: { color: "#A67C2E", fontWeight: "400", fontSize: 12 },
  safeArea: {
    flex: 1,
    backgroundColor: "#A67C2E",
  },
});
