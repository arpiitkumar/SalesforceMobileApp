import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import Icon from "../components/AntDesign";
import FIcon from "@react-native-vector-icons/feather";
import HeaderMain from "../components/HeaderMain";
import { useFocusEffect } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import { KeyboardAvoidingView, Platform } from "react-native";
import { OrderRecordTypeId_var } from "../../config";
import { formatUnitsWithCases, formatCasesWithUnits, unitsToCases } from "../utils/helper/caseUnits";


const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const day = String(d.getDate()).padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
};

const SubDBOrderReport = () => {

    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [orders, setOrders] = useState([]);
    const [accountMap, setAccountMap] = useState({});

    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [orderItemsMap, setOrderItemsMap] = useState({});

    const handleViewDetails = async (orderId) => {
        try {
            // Toggle collapse
            if (expandedOrderId === orderId) {
                setExpandedOrderId(null);
                return;
            }
            setExpandedOrderId(orderId);

            if (orderItemsMap[orderId]) return;
            const orderItems = await UniversalUpdateInsert({
                ObjectName: "OrderItem",
                Type: "get",
                filters: [{ field: "OrderId", value: orderId }],
            });
            const allProducts = await UniversalUpdateInsert({
                ObjectName: "Product2",
                Type: "get",
            });
            const productMap = {};
            allProducts.forEach(p => productMap[p.Sf_Id] = p);
            const enrichedItems = orderItems.map(item => {
                const product = productMap[item.Product2Id];
                if (!product) return null;
                return {
                    id: item.Product2Id,
                    name: product.Name,
                    ptr: item?.SRChangedPrice__c || item?.UnitPrice || product.PTR__c || 0,
                    qty: item.Quantity ?? 0,
                    gross: item.Reason_Of_Return__c === ""
                        ? item.GrossAmount__c
                        : item.Sales_Return_Value__c,
                    netAmount: item.NetAmount__c,
                    returnReason: item.Reason_Of_Return__c || ""
                };
            }).filter(Boolean);
            setOrderItemsMap(prev => ({
                ...prev,
                [orderId]: enrichedItems
            }));
        } catch (error) {
            console.log(error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const initialize = async () => {
                try {
                    setLoading(true);
                    const AllPicklistData = await UniversalUpdateInsert({
                        ObjectName: "AllDataPicklist",
                        Type: "get",
                    });
                    let optionsData = AllPicklistData[0]?.OptionsData;
                    if (typeof optionsData === "string") {
                        optionsData = JSON.parse(optionsData);
                    }
                    const loggedInUser = await UniversalUpdateInsert({
                        ObjectName: "User",
                        Type: "get",
                    });
                    const disData = await UniversalUpdateInsert({
                        ObjectName: "SR_Beat_Assignment__c",
                        Type: "get",
                        filters: [
                            {
                                field: "Assigned_To__c",
                                value: loggedInUser[0]?.Sf_Id,
                            },
                        ],
                    });
                    const uniqueDistributors = new Set(
                        disData.map((s) => s.Distributor__c)
                    );
                    const accountsData = await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "get",
                        filters: [
                            {
                                field: "Sf_Id",
                                value: [...uniqueDistributors],
                                operator: "in",
                            },
                            {
                                field: "RecordTypeId",
                                value: optionsData.subDbRecordTypeId,
                            },
                        ],
                    });
                    const map = {};
                    accountsData.forEach((acc) => {
                        map[acc.Sf_Id] = acc.Name;
                    });
                    const uniqueAccountID = new Set(
                        accountsData.map((s) => s.Sf_Id)
                    );
                    const getOrderedData = await UniversalUpdateInsert({
                        ObjectName: "Order",
                        Type: "get",
                        filters: [
                            { field: "RecordTypeId", value: OrderRecordTypeId_var },
                            {
                                field: "AccountId",
                                value: [...uniqueAccountID],
                                operator: "in",
                            },
                        ],
                    });
                    const sortedOrders = [...getOrderedData].sort((a, b) => {
                        const numA = parseInt(
                            a.OrderNumber?.replace(/\D/g, "") ?? "0",
                            10
                        );
                        const numB = parseInt(
                            b.OrderNumber?.replace(/\D/g, "") ?? "0",
                            10
                        );
                        return numB - numA;
                    });
                    if (isActive) {
                        setOrders(sortedOrders);
                        setAccountMap(map);
                    }
                } catch (error) {
                    console.log(error);
                } finally {
                    setLoading(false);
                }

            };
            initialize();
            return () => {
                isActive = false;
            };

        }, [])
    );

    const filteredOrders = orders.filter((order) => {
        const q = search.toLowerCase();
        const accountName = (accountMap[order.AccountId] ?? "").toLowerCase();
        return (
            order.OrderNumber?.toLowerCase().includes(q) ||
            accountName.includes(q) ||
            order.Status?.toLowerCase().includes(q)
        );
    });

    const renderItem = ({ item }) => {
        const accountName = accountMap[item.AccountId] ?? item.AccountId;
        return (
            <TouchableOpacity activeOpacity={0.9} onPress={() => handleViewDetails(item.Sf_Id)}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.orderNumRow}>
                            <FIcon name="hash" size={12} color="#A67C2E" />
                            <Text style={styles.orderNumber}>{item.OrderNumber}</Text>
                        </View>
                        <View style={styles.statusContainer}>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusText}>{item.Status}</Text>
                            </View>
                            <Icon
                                name={expandedOrderId === item.Sf_Id ? "up" : "down"}
                                size={16}
                                color="#A67C2E"
                                style={{ marginLeft: 6 }}
                            />
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <FIcon name="user" size={12} color="#666" />
                        <Text style={styles.infoLabel}>Account</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                            {accountName}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <FIcon name="calendar" size={12} color="#666" />
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>
                            {formatDate(item.OrderSubmissionTime__c)}
                        </Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Amount</Text>
                            <Text style={styles.statValue}>
                                Rs {(item.TotalAmount ?? 0).toFixed(2)}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Pcs</Text>
                            <Text style={styles.statValue}>
                                {formatUnitsWithCases(item.TotalOrderQtyInPcs__c ?? 0, "Pcs")}
                            </Text>
                        </View>
                    </View>

                    {expandedOrderId === item.Sf_Id && (
                        <View style={styles.expandContainer}>

                            {(orderItemsMap[item.Sf_Id] || []).map((prod, index) => (
                                <View key={index} style={styles.productTable}>

                                    {/* Product Name */}
                                    <Text style={styles.productName}>{prod.name}</Text>

                                    {/* Header Row */}
                                    <View style={styles.tableHeader}>
                                        <Text style={styles.tableHeaderText}>PTR</Text>
                                        <Text style={styles.tableHeaderText}>Gross</Text>
                                        <Text style={styles.tableHeaderText}>Qty</Text>
                                        <Text style={styles.tableHeaderText}>
                                            {prod.returnReason === "" ? "Net Amt" : "Reason"}
                                        </Text>
                                    </View>

                                    {/* Value Row */}
                                    <View style={styles.tableRow}>
                                        <Text style={styles.tableValue}>
                                            ₹{Number(prod.ptr).toFixed(2)}
                                        </Text>

                                        <Text style={styles.tableValue}>
                                            ₹{Number(prod.gross).toFixed(2)}
                                        </Text>

                                        <Text style={styles.tableValue}>
                                            {formatUnitsWithCases(prod.qty ?? 0, "Pcs")}
                                        </Text>

                                        <Text style={styles.tableValue}>
                                            {prod.returnReason || `₹${Number(prod.netAmount).toFixed(2)}`}
                                        </Text>
                                    </View>

                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (

        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Sub DB Spot Sales Report" />
            </View>
            <KeyboardAvoidingView
                style={styles.bodyContainer}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <View style={styles.searchWrapper}>
                    <View style={styles.searchContainer}>
                        <Icon name="search1" size={14} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search Spot Sales / Account"
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch("")}>
                                <Icon name="closecircle" size={14} color="#aaa" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <FlatList
                    data={filteredOrders}
                    keyExtractor={(item) => item.Sf_Id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
            </KeyboardAvoidingView>
            <LoaderOverlay visible={loading} />
        </SafeAreaProvider>
    );
};
export default SubDBOrderReport;
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#A67C2E"
    },
    headerContainer: {
        backgroundColor: "#A67C2E"
    },
    bodyContainer: {
        flex: 1,
        backgroundColor: "#F4F6FB",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20
    },
    searchWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 2,
        elevation: 2
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 10,
        elevation: 2
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6
    },
    orderNumRow: {
        flexDirection: "row",
        alignItems: "center"
    },
    orderNumber: {
        fontSize: 14,
        fontWeight: "700",
        color: "#A67C2E",
        marginLeft: 4
    },
    statusBadge: {
        backgroundColor: "#EEF2FF",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5
    },
    statusText: {
        fontSize: 11,
        color: "#A67C2E",
        fontWeight: "600"
    },
    divider: {
        height: 1,
        backgroundColor: "#eee",
        marginBottom: 6
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 3
    },
    infoLabel: {
        fontSize: 11,
        color: "#888",
        marginLeft: 5,
        width: 50
    },
    infoValue: {
        flex: 1,
        fontSize: 12,
        color: "#333"
    },
    statsRow: {
        flexDirection: "row",
        marginTop: 6,
        backgroundColor: "#F7F9FF",
        borderRadius: 6
    },
    statBox: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 6
    },
    statDivider: {
        width: 1,
        backgroundColor: "#E8EEFF"
    },
    statLabel: {
        fontSize: 10,
        color: "#888"
    },
    statValue: {
        fontSize: 13,
        fontWeight: "700"
    },
    productTable: {
        backgroundColor: "#F9FAFF",
        borderRadius: 8,
        padding: 8,
        marginBottom: 8
    },

    tableHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderColor: "#E5E9FF",
        paddingBottom: 4,
        marginBottom: 4
    },

    tableHeaderText: {
        flex: 1,
        fontSize: 10,
        fontWeight: "600",
        color: "#666",
        textAlign: "center"
    },

    tableRow: {
        flexDirection: "row",
        justifyContent: "space-between"
    },

    tableValue: {
        flex: 1,
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center"
    },
    expandContainer: {
        marginTop: 10,
        borderTopWidth: 1,
        borderColor: "#eee",
        paddingTop: 8
    },
    productName: {
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 4,
        color: '#000'
    },
    statusContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 10,
    },
});