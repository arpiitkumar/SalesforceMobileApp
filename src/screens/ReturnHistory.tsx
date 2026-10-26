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
import { ReturnRecordTypeId_var } from "../../config";
import { formatUnitsWithCases, formatCasesWithUnits, unitsToCases } from "../utils/helper/caseUnits";

const { width } = Dimensions.get("window");

const getBorderColor = (icon) => (icon === "Completed" ? "#28a745" : "#f7a536");

const ReturnHistoryScreen = () => {
  //const selectedAccount = useSelector((state: RootState) => state.selectedAccount.selectedAccount);

  //const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const [selectedTab, setSelectedTab] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalProducts, setModalProducts] = useState([]);
  const [isOrderSynced, setIsOrderSynced] = useState(true);
  const [orderErrorMsg, setOrderErrorMsg] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [accountDataFromVisit, setAccountDataFromVisit] = useState(null);
  const [users, setUsers] = useState([]);
  const dispatch = useDispatch();

  const selectedVisit = useSelector((state) => state.selectedVisit);

  //console.log('log log ----', data);

  const statusMap = {
    All: null,
    Draft: "Draft",
    Completed: "Completed",
    Rejected: "Rejected",
  };
  // Fulfilled
  const filteredData = data?.filter(
    (o) =>
      (!statusMap[selectedTab] || o.Status === statusMap[selectedTab]) &&
      (o.Sf_Id?.toLowerCase().includes(searchText.toLowerCase()) ||
        o.OrderNumber?.toLowerCase().includes(searchText.toLowerCase()))
  );

  useFocusEffect(
    useCallback(() => {
      const getUserData = async () => {
        try {
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          console.log(result);
          setUsers(result);
        } catch (error) {
          console.error(" Get User Failed For the Header:", error);
        }
      };
      getUserData();

      const getOrderData = async () => {
        try {
          const getOrderedData = await UniversalUpdateInsert({
            ObjectName: "Order",
            Type: "get",
            filters: [{ field: "RecordTypeId", value: ReturnRecordTypeId_var }],
          });
          // console.log('oRDER')

          // const filteredOrders = (getOrderedData || []).filter(
          //   (order) => order.AccountId === selectedVisit.AccountId
          // );
          const seen = new Set();
          const filteredOrders = (getOrderedData || []).filter((order) => {
            if (order.AccountId !== selectedVisit.AccountId__c) {
              return false;
            }
            if (order.is_synced === false && order.Mobile_Unique_Id__c) {
              const key = `${order.TotalReturnQuantity__c}_${order.Total_Return_Value__c}_${order.Mobile_Unique_Id__c}`;
              if (seen.has(key)) {
                return false; // duplicate skip
              }
              seen.add(key);
            }
            return true;
          });
          console.log("filteredOrders...", filteredOrders);
          const sortedOrders = filteredOrders.sort((a, b) => {
            const numA = parseInt(a.OrderNumber?.replace(/\D/g, ""), 10);
            const numB = parseInt(b.OrderNumber?.replace(/\D/g, ""), 10);
            return numB - numA;
          });

          console.log("sortedOrders...", sortedOrders);
          setData(sortedOrders);
        } catch (error) {
          console.error("Error fetching order data:", error);
        }
      };

      getOrderData();
    }, [])
  );

  // const handleViewDetails = async (orderId) => {
  //   try {
  //     setSelectedOrderId(orderId);

  //     const orderItems = await UniversalUpdateInsert({
  //       ObjectName: "OrderItem",
  //       Type: "get",
  //       whereClause: `OrderId = '${orderId}'`,
  //     });

  //     const allProducts = await UniversalUpdateInsert({
  //       ObjectName: "Product2",
  //       Type: "get",
  //     });

  //     const enrichedItems = orderItems
  //       .map((item) => {
  //         const product = allProducts.find((p) => p.Sf_Id === item.Product2Id);
  //         if (!product || !product.Name || product.MRP === 0) return null;

  //         const imageSource = product?.ProductImageURL__c
  //           ? { uri: product.ProductImageURL__c }
  //           : require("../assets/images/product1.png");

  //         return {
  //           id: item.Product2Id,
  //           name: product?.Name ?? "Unknown Product",
  //           ptd: product?.PTD__c ?? 0,
  //           ptr: product?.PTR__c ?? 0,
  //           margin: product?.Margin__c ? `${product.Margin__c}%` : "0%",
  //           stock: product?.Stock__c ?? "NA",
  //           image: imageSource,
  //         };
  //       })
  //       .filter(Boolean);

  //     setModalProducts(enrichedItems);
  //     setShowModal(true);
  //   } catch (error) {
  //     console.error("Error loading order details:", error);
  //   }
  // };

  const handleViewDetails = async (orderId) => {
    try {
      setSelectedOrderId(orderId);

      console.log("THIS IS THE ORDER ID ID", orderId);

      // Fetch parent order details to get its is_synced status and ErrorMsg
      const parentOrders = await UniversalUpdateInsert({
        ObjectName: "Order",
        Type: "get",
        filters: [{ field: "Sf_Id", value: orderId }],
      });
      if (parentOrders && parentOrders.length > 0) {
        const parentOrder = parentOrders[0];
        setIsOrderSynced(
          parentOrder.is_synced !== false && parentOrder.is_synced !== 0
        );
        setOrderErrorMsg(parentOrder.ErrorMsg || "");
      } else {
        setIsOrderSynced(true);
        setOrderErrorMsg("");
      }

      // Fetch order items
      const orderItems = await UniversalUpdateInsert({
        ObjectName: "OrderItem",
        Type: "get",
        filters: [{ field: "OrderId", value: orderId }],
      });

      // console.log('THIS IS THE ORDER ITEMs sOF THAT ORDER ID ID', orderItems)
      // Fetch all products
      const allProducts = await UniversalUpdateInsert({
        ObjectName: "Product2",
        Type: "get",
      });

      // Create a map for quick lookup: { Sf_Id: product }
      const productMap = allProducts.reduce((acc, product) => {
        acc[product.Sf_Id] = product;
        return acc;
      }, {});

      // Use map for quick lookup instead of find
      const enrichedItems = orderItems
        .map((item) => {
          const product = productMap[item.Product2Id];
          if (!product || !product.Name || product.MRP === 0) return null;

          const imageSource = product.ProductImageURL__c
            ? { uri: product.ProductImageURL__c }
            : require("../assets/images/food.png");

          console.log("item:::::::::::::", item);
          return {
            id: item.Product2Id,
            name: product.Name,
            ptd: product.PTD__c ?? 0,
            ptr:
              item?.SRChangedPrice__c || item?.UnitPrice || product.PTR__c || 0,
            margin: product.Margin__c ? `${product.Margin__c}%` : "0%",
            stock: product.Stock__c ?? "NA",
            qty: item.Quantity ?? "-",
            gross:
              item.Reason_Of_Return__c === ""
                ? item.GrossAmount__c
                : item.Sales_Return_Value__c,
            uom: item.UOM__c ?? "-",
            image: imageSource,
            netAmount: item.NetAmount__c,
            returnReason: item.Reason_Of_Return__c || "",
            is_synced: item.is_synced,
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

      const getAccountData = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
        filters: [{ field: "Sf_Id", value: selectedVisit.AccountId__c }],
      });

      setAccountDataFromVisit(getAccountData);

      const htmlContentInvoice = orderInvice({
        invoice,
        items: InvoiceItemFromInvoice || [],
        customer: customerRecord || {},
        meta: { salesman: "Sandeep Sharma", route: "Vaishali Nager" },
        selectedAccount: getAccountData,
        ParentcustomerRecord: ParentcustomerRecord || {},
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
      <Text style={styles.statusText}>
        {item.Status === "Completed"
          ? `Fulfilled${item.Fulfillment_Status__c
            ? ` (${item.Fulfillment_Status__c})`
            : ""
          }`
          : item.Status}{" "}
        on {moment(item.OrderSubmissionTime__c).format("DD MMM YYYY")}
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 5 }}
      >
        <View
          style={[
            styles.iconContainer,
            { borderColor: getBorderColor(item.Status) },
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
              <Text style={styles.value}>{item.OrderNumber}</Text>
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
              <Text style={styles.label}>Total Spot Sales Qty. Pcs.</Text>
              <Text style={styles.value}>
                {formatUnitsWithCases(item.TotalOrderQtyInPcs__c || item.TotalReturnQuantity__c || 0, "Pcs")}
              </Text>
            </View>
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

        {users[0]?.DeveloperName !== "H_T_ASO" && (
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
        <HeaderMain screenName="Return History" />
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

        <Text style={styles.subText}>Returns from last 1 months.</Text>
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
      />
    </SafeAreaProvider>
  );
};

export default ReturnHistoryScreen;

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
