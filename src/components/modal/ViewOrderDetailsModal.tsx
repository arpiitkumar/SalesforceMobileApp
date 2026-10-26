import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import LinearGradient from "react-native-linear-gradient";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { formatUnitsWithCases, formatCasesWithUnits } from "../../utils/helper/caseUnits";

const ViewOrderDetailsModal = ({
  visible,
  onClose,
  products,
  isOrderSynced = true,
  orderErrorMsg = "",
  isNonDmsOrder = false,
}) => {
  const [unitModeMap, setUnitModeMap] = useState({});
  const [quantities, setQuantities] = useState({});

  console.log("PRODUCTS>>>>>", products);
  const toggleMode = (id, mode) => {
    setUnitModeMap((prev) => ({ ...prev, [id]: mode }));
  };

  useEffect(() => {
    const initialize = async () => {
      const orders = await UniversalUpdateInsert({
        ObjectName: "OrderItem",
        Type: "get",
      });

      const Getproducts = await UniversalUpdateInsert({
        ObjectName: "Product2",
        Type: "get",
      });

      // console.log("Fetched orders:................", orders);
      //    console.log("Fetched products:................", Getproducts);
    };

    initialize();
  }, []);

  const updateQuantity = (id, delta) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      return { ...prev, [id]: Math.max(0, current + delta) };
    });
  };

  const renderProductCard = ({ item }) => {
    const unitMode = unitModeMap[item.id] || "Case";
    const quantity = quantities[item.id] || 0;
    // console.log('ITEM>>>>', item)
    return (
      <View style={styles.productCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.productName}>{item.name}</Text>
          {(item.is_synced === false || item.is_synced === 0) && (
            <Text style={{ color: "#B3261E", fontSize: 10, fontWeight: "700" }}>
              Not Synced
            </Text>
          )}
        </View>

        <View style={styles.productTop}>
          <Image source={item.image} style={styles.productImage} />
          <View style={styles.infoGrid}>
            {!isNonDmsOrder && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>PTR</Text>
                  <Text style={styles.label}>Gross Amount</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.value}>
                    ₹{Number(item.ptr || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <Text style={styles.value}>
                    ₹{Number(item.gross || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </>
            )}
            <View style={[styles.infoRow, { marginTop: 10 }]}>
              <Text style={styles.label}>QTY</Text>
              {!isNonDmsOrder && (
                <Text style={styles.label}>
                  {item.returnReason === "" ? "Net Amount" : "Return Reason"}
                </Text>
              )}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.value}>
                {item.cases > 0 ? formatCasesWithUnits(item.cases, "Case", "Units") : formatUnitsWithCases(Number(item.units || item.qty || 0))}
              </Text>
              {!isNonDmsOrder && (
                <Text style={styles.value}>
                  {item.returnReason === ""
                    ? "₹" + Number(item.netAmount || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                    : item.returnReason}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          {/* <Text style={styles.caseInfo}>1 Case = 12 Units</Text>
          <Text style={styles.caseInfo}>Max case Limit 15</Text> */}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Spot Sales Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Order Sync Error Message */}
          {!isOrderSynced && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitleText}>Spot Sales Error:</Text>
              <Text style={styles.errorBodyText}>
                {orderErrorMsg || "Spot Sales have not been synced to Salesforce."}
              </Text>
            </View>
          )}

          {/* Product List */}
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            renderItem={renderProductCard}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.noDataText}>No spot sales items present...</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export default ViewOrderDetailsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    height: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#FBF8F1",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#000",
  },
  closeButton: {
    padding: 4,
  },
  productCard: {
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingTop: 17,
    //   paddingBottom : 4,
    marginBottom: 15,
  },
  productName: {
    fontWeight: "500",
    fontSize: 15,
    marginBottom: 5,
    color: "#1F1D1A",
    // padding: 2,
  },
  productTop: {
    flexDirection: "row",
    marginBottom: 0,
    marginTop: 4,
    // padding: 2,
  },
  productImage: {
    width: 70,
    height: 70,
    marginRight: 15,
    borderRadius: 6,
    resizeMode: "contain",
  },
  infoGrid: {
    flex: 1,
    justifyContent: "flex-start",
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  infoRow1: {
    flexDirection: "row",
    justifyContent: "flex-end",
    // marginBottom: 2,
    width: "65%",
  },
  label: {
    flex: 1,
    fontWeight: "400",
    color: "#7A7266",
    fontSize: 12,
  },
  value: {
    flex: 1,
    color: "#1F1D1A",
    fontSize: 14,
    fontWeight: "500",
  },
  caseInfo: {
    fontSize: 11,
    fontWeight: "400",
  },
  toggleContainer: {
    flexDirection: "row",
    alignSelf: "flex-start",
    // marginVertical: 8,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleBase: {
    paddingVertical: 5,
    paddingHorizontal: 25,
    justifyContent: "center",
  },
  inactive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  leftActive: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  rightActive: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  textActive: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 12,
  },
  textInactive: {
    color: "#A67C2E",
    fontWeight: "500",
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addBtn: {
    backgroundColor: "#F1EADB",
    padding: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: {
    color: "#004de7",
    fontWeight: "500",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
  },
  qtyBtn: {
    backgroundColor: "#F1EADB",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#A67C2E",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#A67C2E",
  },
  noDataText: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  errorTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B3261E",
    marginBottom: 2,
  },
  errorBodyText: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 16,
  },
});
