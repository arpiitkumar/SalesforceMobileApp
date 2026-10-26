import React, { FC, useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import moment from "moment";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";

interface DetailItem {
    id: string;
    name: string;
    date: string;
    repName: string;
    status: string;
}

const MTDHighlightsDetail: FC = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const { fetchRecords } = useApiFetch();

    // Route params
    const title = route.params?.title || "Details";
    const metricType = route.params?.metricType || "unique_visited";
    const selectedMonthStr = route.params?.selectedMonth || moment().format("YYYY-MM");
    const selectedPersona = route.params?.selectedPersona || "All";
    const selectedEmployee = route.params?.selectedEmployee || "All";
    const userId = route.params?.userId || "";
    const subordinates = route.params?.subordinates || [];

    // Screen states
    const [loading, setLoading] = useState(true);
    const [listData, setListData] = useState<DetailItem[]>([]);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            try {
                const parsedMonth = moment(selectedMonthStr, "YYYY-MM");
                const startOfMonth = parsedMonth.clone().startOf("month").format("YYYY-MM-DD");
                const endOfMonth = parsedMonth.clone().endOf("month").format("YYYY-MM-DD");

                // 1. Fetch user IDs based on selected filter (All hierarchy / Persona / Employee)
                let userIds = `'${userId}'`;
                if (selectedEmployee === "All") {
                    if (selectedPersona === "All") {
                        try {
                            const userQuery = `SELECT Id FROM User WHERE Id = '${userId}' OR ManagerId = '${userId}' OR Manager.ManagerId = '${userId}' OR Manager.Manager.ManagerId = '${userId}'`;
                            const userResponse = await fetchRecords("User", userQuery);
                            if (Array.isArray(userResponse) && userResponse.length > 0) {
                                userIds = userResponse.map((item: any) => `'${item.Id}'`).join(",");
                            } else if (subordinates.length > 0) {
                                userIds = subordinates.map((s: any) => `'${s.Sf_Id}'`).join(",");
                            }
                        } catch (e) {
                            if (subordinates.length > 0) {
                                userIds = subordinates.map((s: any) => `'${s.Sf_Id}'`).join(",");
                            }
                        }
                    } else {
                        const targetUserIds = subordinates
                            .filter((s: any) => (s.Role || "").trim().toLowerCase() === selectedPersona.trim().toLowerCase())
                            .map((s: any) => `'${s.Sf_Id}'`);
                        if (targetUserIds.length > 0) {
                            userIds = targetUserIds.join(",");
                        }
                    }
                } else {
                    userIds = `'${selectedEmployee}'`;
                }

                const targetFilter = `CreatedById IN (${userIds})`;

                const isDetailedView = selectedEmployee !== "All";
                const isCurrentMonth = parsedMonth.isSame(moment(), "month");
                const dateFilter = isCurrentMonth
                    ? "BeatDay__r.Beat_Date__c = THIS_MONTH"
                    : `BeatDay__r.Beat_Date__c >= ${startOfMonth} AND BeatDay__r.Beat_Date__c <= ${endOfMonth}`;
                const beatDayDateFilter = isCurrentMonth
                    ? "Beat_Date__c = THIS_MONTH"
                    : `Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth}`;

                let query = "";
                let objectApiName = "Visit__c";

                if (metricType === "hierarchy_sales_visit") {
                    objectApiName = "Beat_Day__c";
                    query = `SELECT Owner.Name SalesRepName, SUM(Total_Calls__c) TotalCalls_TC, SUM(Productive_Calls__c) ProductiveCalls_PC, COUNT(Id) TotalWorkingDays FROM Beat_Day__c WHERE ${beatDayDateFilter} AND OwnerId IN (${userIds}) GROUP BY Owner.Name ORDER BY Owner.Name ASC`;
                } else if (metricType === "percentage_productive_outlets") {
                    objectApiName = "Beat_Day__c";
                    query = `SELECT Owner.Name SalesRepName, SUM(Total_Calls__c) TotalCalls_TC, SUM(Productive_Calls__c) ProductiveCalls_PC FROM Beat_Day__c WHERE ${beatDayDateFilter} AND OwnerId IN (${userIds}) GROUP BY Owner.Name ORDER BY Owner.Name ASC`;
                } else if (metricType === "productivity_covered_outlets") {
                    objectApiName = "Visit__c";
                    query = `SELECT CreatedBy.Name SalesRepName, ProductiveCall__c IsProductive, COUNT_DISTINCT(AccountId__c) UniqueOutletsCount, COUNT(Id) TotalCallsCount FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ${targetFilter} GROUP BY CreatedBy.Name, ProductiveCall__c ORDER BY CreatedBy.Name ASC`;
                } else if (metricType === "unattended_outlets") {
                    objectApiName = "Beat_Mapping__c";
                    query = `SELECT Account__c, Account__r.Name, Account__r.Party_Code__c, Account__r.Phone, Account__r.Outlet_Type__c, Beat__r.Name, Beat__r.Distributor__r.Name FROM Beat_Mapping__c WHERE Is_Active__c = true AND Account__c NOT IN (SELECT AccountId__c FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ${targetFilter}) ORDER BY Beat__r.Name ASC, Account__r.Name ASC`;
                } else if (metricType === "no_sales") {
                    // Query No Sales Outlets directly, grouped only by AccountId__c to guarantee exactly the same count as the main card!
                    query = `SELECT AccountId__c OutletId, MIN(AccountId__r.Name) OutletName, MIN(AccountId__r.Party_Code__c) PartyCode, MIN(AccountId__r.Phone) OutletPhone, MIN(AccountId__r.Outlet_Type__c) OutletType, MIN(BeatDay__r.Beat__r.Name) BeatName, MIN(CreatedBy.Name) SalesRepresentative, MIN(CreatedBy.Manager.Name) ReportingManager, COUNT(Id) TotalVisitsWithNoSales, MAX(VisitDate__c) LastVisitedDate FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND AccountId__c NOT IN (SELECT AccountId__c FROM Order__c WHERE EffectiveDate__c >= ${startOfMonth} AND EffectiveDate__c <= ${endOfMonth}) AND ${targetFilter} GROUP BY AccountId__c ORDER BY COUNT(Id) DESC`;
                } else if (isDetailedView) {
                    if (metricType === "unique_productive") {
                        // Query detailed productive outlets for a single Sales Rep
                        query = `SELECT AccountId__c, AccountId__r.Name, BeatDay__r.Beat_Date__c, CreatedBy.Name, CreatedById, ProductiveCall__c FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ProductiveCall__c = true AND CreatedById = '${selectedEmployee}'`;
                    } else {
                        // Query detailed visits (outlets) for a single Sales Rep
                        query = `SELECT AccountId__c, AccountId__r.Name, BeatDay__r.Beat_Date__c, CreatedBy.Name, CreatedById, IsOrderPlaced__c FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND CreatedById = '${selectedEmployee}'`;
                    }
                } else if (metricType === "unique_visited") {
                    // Query salesman aggregates for visited (exactly as requested by user)
                    query = `SELECT CreatedById, CreatedBy.Name SalesRepName, COUNT_DISTINCT(AccountId__c) UniqueOutletsVisited, COUNT(Id) TotalVisitsLogged FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ${targetFilter} GROUP BY CreatedById, CreatedBy.Name ORDER BY CreatedBy.Name ASC`;
                } else {
                    // Query salesman aggregates for productive using the new aggregate query structure!
                    query = `SELECT CreatedById, CreatedBy.Manager.Name ManagerName, CreatedBy.Name SalesRepName, ProductiveCall__c IsProductive, COUNT_DISTINCT(AccountId__c) UniqueOutletsCount, COUNT(Id) TotalCallsCount FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ProductiveCall__c = true AND ${targetFilter} GROUP BY CreatedById, CreatedBy.Manager.Name, CreatedBy.Name, ProductiveCall__c ORDER BY CreatedBy.Manager.Name ASC, CreatedBy.Name ASC`;
                }

                console.log("MTDHighlightsDetail SOQL Query:", query);
                const res = await fetchRecords(objectApiName, query);

                if (Array.isArray(res)) {
                    if (metricType === "productivity_covered_outlets") {
                        const repMap = new Map<string, { productiveOutlets: number; nonProductiveOutlets: number; totalCalls: number; productiveCalls: number }>();

                        res.forEach((item: any) => {
                            const salesRep = item.SalesRepName || item.CreatedBy?.Name || "Sales Rep";
                            const isProd = item.IsProductive === true || item.IsProductive === "true" || item.ProductiveCall__c === true || item.ProductiveCall__c === "true";
                            const outlets = Number(item.UniqueOutletsCount || item.expr0 || 0);
                            const calls = Number(item.TotalCallsCount || item.expr1 || 0);

                            if (!repMap.has(salesRep)) {
                                repMap.set(salesRep, { productiveOutlets: 0, nonProductiveOutlets: 0, totalCalls: 0, productiveCalls: 0 });
                            }

                            const data = repMap.get(salesRep)!;
                            data.totalCalls += calls;
                            if (isProd) {
                                data.productiveOutlets += outlets;
                                data.productiveCalls += calls;
                            } else {
                                data.nonProductiveOutlets += outlets;
                            }
                        });

                        const list: DetailItem[] = [];
                        repMap.forEach((val, salesRep) => {
                            const totalOutletsCovered = val.productiveOutlets + val.nonProductiveOutlets;
                            const pct = totalOutletsCovered > 0 ? `${((val.productiveOutlets / totalOutletsCovered) * 100).toFixed(1)}%` : "0%";

                            list.push({
                                id: salesRep,
                                name: salesRep,
                                repName: `Outlets: ${val.productiveOutlets}/${totalOutletsCovered} | Total Calls: ${val.totalCalls}`,
                                date: `Productivity: ${pct}`,
                                status: pct,
                            });
                        });

                        setListData(list);
                    } else if (metricType === "percentage_productive_outlets") {
                        const list: DetailItem[] = [];
                        res.forEach((item: any) => {
                            const salesRep = item.SalesRepName || item.Owner?.Name || "Sales Rep";
                            const tc = Number(item.TotalCalls_TC || item.expr0 || 0);
                            const pc = Number(item.ProductiveCalls_PC || item.expr1 || 0);
                            const pct = tc > 0 ? `${((pc / tc) * 100).toFixed(1)}%` : "0%";

                            list.push({
                                id: salesRep,
                                name: salesRep,
                                repName: `Total Calls: ${tc} | Productive Calls: ${pc}`,
                                date: `TC: ${tc} | PC: ${pc}`,
                                status: pct,
                            });
                        });
                        setListData(list);
                    } else if (metricType === "hierarchy_sales_visit") {
                        const list: DetailItem[] = [];
                        res.forEach((item: any) => {
                            const salesRep = item.SalesRepName || item.Owner?.Name || "Sales Rep";
                            const tc = Number(item.TotalCalls_TC || item.expr0 || 0);
                            const pc = Number(item.ProductiveCalls_PC || item.expr1 || 0);
                            const workingDays = Number(item.TotalWorkingDays || item.expr2 || 0);

                            const matchedSub = subordinates.find(
                                (s: any) => (s.Name || "").trim().toLowerCase() === salesRep.trim().toLowerCase()
                            );
                            const sfId = item.OwnerId || matchedSub?.Sf_Id || salesRep;

                            list.push({
                                id: sfId,
                                name: salesRep,
                                repName: `Working Days: ${workingDays} | Total Calls: ${tc}`,
                                date: `TC: ${tc} | PC: ${pc}`,
                                status: `PC: ${pc}`,
                            });
                        });
                        setListData(list);
                    } else if (metricType === "unattended_outlets") {
                        const list: DetailItem[] = [];
                        res.forEach((item: any) => {
                            const accId = item.Account__c || item.Id;
                            const outletName = item.Account__r?.Name || "Unknown Outlet";
                            const partyCode = item.Account__r?.Party_Code__c || "";
                            const phone = item.Account__r?.Phone || "";
                            const outletType = item.Account__r?.Outlet_Type__c || "";
                            const beatName = item.Beat__r?.Name || "N/A";
                            const distName = item.Beat__r?.Distributor__r?.Name || "";

                            let subtitleParts: string[] = [];
                            if (beatName && beatName !== "N/A") subtitleParts.push(`Beat: ${beatName}`);
                            if (distName) subtitleParts.push(`Distributor: ${distName}`);
                            if (partyCode) subtitleParts.push(`Party Code: ${partyCode}`);
                            if (phone) subtitleParts.push(`Phone: ${phone}`);

                            list.push({
                                id: accId,
                                name: outletName,
                                repName: subtitleParts.join(" | ") || "Beat: N/A",
                                date: outletType || "Unattended",
                                status: "Unattended",
                            });
                        });
                        setListData(list);
                    } else if (metricType === "no_sales") {
                        const list: DetailItem[] = [];
                        res.forEach((visit: any) => {
                            const accId = visit.OutletId || visit.AccountId__c || visit.Id;
                            const outletName = visit.OutletName || visit.AccountId__r?.Name || "Unknown Outlet";
                            const beatName = visit.BeatName || visit.BeatDay__r?.Beat__r?.Name || "N/A";
                            const repName = visit.SalesRepresentative || visit.CreatedBy?.Name || "Representative";
                            const totalVisits = Number(visit.TotalVisitsWithNoSales || visit.expr0 || 0);
                            const lastVisited = visit.LastVisitedDate || visit.expr1;

                            list.push({
                                id: accId,
                                name: outletName,
                                repName: `SalesRep: ${repName} | Beat: ${beatName}`,
                                date: lastVisited ? moment(lastVisited).format("DD MMM YYYY") : "N/A",
                                status: `No Sales (${totalVisits} Visits)`,
                            });
                        });
                        setListData(list);
                    } else if (isDetailedView) {
                        const uniqueMap = new Map<string, DetailItem>();

                        res.forEach((visit: any) => {
                            const accId = visit.AccountId__c || visit.AccountId__r?.Id || visit.Id;
                            if (!accId) return;

                            const isProductive = metricType === "unique_productive"
                                ? true
                                : (visit.IsOrderPlaced__c === "true" || visit.IsOrderPlaced__c === true);

                            // Add to unique outlets (deduplicate)
                            if (!uniqueMap.has(accId)) {
                                uniqueMap.set(accId, {
                                    id: accId,
                                    name: visit.AccountId__r?.Name || "Unknown Outlet",
                                    date: visit.BeatDay__r?.Beat_Date__c
                                        ? moment(visit.BeatDay__r.Beat_Date__c).format("DD MMM YYYY")
                                        : "N/A",
                                    repName: visit.CreatedBy?.Name || "Representative",
                                    status: isProductive ? "Productive" : "No Sales",
                                });
                            }
                        });

                        setListData(Array.from(uniqueMap.values()));
                    } else if (metricType === "unique_visited") {
                        const list: DetailItem[] = [];
                        res.forEach((record: any) => {
                            const salesmanId = record.CreatedById || "UnknownId";
                            const name = record.SalesRepName || (record.CreatedBy ? record.CreatedBy.Name : null) || "Unknown";
                            const distinctOutlets = Number(record.UniqueOutletsVisited || record.expr0 || record.expr1 || 0);
                            const totalCalls = Number(record.TotalVisitsLogged || record.expr1 || record.expr2 || 0);

                            list.push({
                                id: salesmanId,
                                name: name,
                                repName: `Total Visits: ${totalCalls}`,
                                date: `${distinctOutlets} Outlets`,
                                status: "Total Visited",
                            });
                        });
                        setListData(list);
                    } else {
                        const list: DetailItem[] = [];
                        res.forEach((record: any) => {
                            const salesmanId = record.CreatedById || "UnknownId";
                            const name = record.SalesRepName || (record.CreatedBy ? record.CreatedBy.Name : null) || "Unknown";
                            const distinctOutlets = Number(record.UniqueOutletsCount || record.expr0 || 0);
                            const totalCalls = Number(record.TotalCallsCount || record.expr1 || 0);

                            list.push({
                                id: salesmanId,
                                name: name,
                                repName: `Total Visits: ${totalCalls}`,
                                date: `${distinctOutlets} Outlets`,
                                status: "Productive",
                            });
                        });
                        setListData(list);
                    }
                } else {
                    setListData([]);
                }
            } catch (err) {
                console.error("Error fetching detail highlights list:", err);
                setListData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [userId, selectedMonthStr, selectedPersona, selectedEmployee]);

    const renderItem = ({ item }: { item: DetailItem }) => {
        const isProductive = item.status === "Productive";
        const isUnattended = item.status === "Unattended";
        const isHierarchy = metricType === "hierarchy_sales_visit";
        const isPercentProductive = metricType === "percentage_productive_outlets";
        const isProductivityCovered = metricType === "productivity_covered_outlets";
        const isSalesmanRow = selectedEmployee === "All" && metricType !== "no_sales" && metricType !== "unattended_outlets" && metricType !== "hierarchy_sales_visit" && metricType !== "percentage_productive_outlets" && metricType !== "productivity_covered_outlets";

        const handlePress = () => {
            if (isSalesmanRow) {
                navigation.navigate("MTDHighlightsDetail" as never, {
                    title: `${item.name}'s Visited Outlets`,
                    selectedPersona,
                    selectedEmployee: item.id, // Pass salesman's SF ID!
                    selectedMonth: selectedMonthStr,
                    metricType,
                    userId,
                    subordinates,
                } as never);
            }
        };

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={handlePress}
                disabled={!isSalesmanRow}
                activeOpacity={0.7}
            >
                <View style={styles.leftRow}>
                    <View
                        style={[
                            styles.statusIconWrap,
                            {
                                backgroundColor: isProductive
                                    ? "#E3F1EA"
                                    : isUnattended
                                    ? "#FBEFD8"
                                    : isHierarchy
                                    ? "#E3F1EA"
                                    : isPercentProductive
                                    ? "#FCE4EC"
                                    : isProductivityCovered
                                    ? "#E8EAF6"
                                    : "#E3F1EA",
                            },
                        ]}
                    >
                        <Ionicons
                            name={
                                isProductive
                                    ? "checkmark-circle"
                                    : isUnattended
                                    ? "alert-circle-outline"
                                    : isHierarchy
                                    ? "people-outline"
                                    : isPercentProductive
                                    ? "pie-chart-outline"
                                    : isProductivityCovered
                                    ? "analytics-outline"
                                    : "storefront"
                            }
                            size={20}
                            color={
                                isProductive
                                    ? "#4CAF50"
                                    : isUnattended
                                    ? "#FB8C00"
                                    : isHierarchy
                                    ? "#2E7D5B"
                                    : isPercentProductive
                                    ? "#D81B60"
                                    : isProductivityCovered
                                    ? "#3949AB"
                                    : "#2E7D5B"
                            }
                        />
                    </View>
                    <View style={styles.textWrap}>
                        <Text style={styles.outletName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.repName} numberOfLines={1}>{item.repName}</Text>
                    </View>
                </View>
                <View style={styles.rightRow}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    {isProductive && (
                        <Text
                            style={[
                                styles.statusBadge,
                                {
                                    color: "#2E7D5B",
                                    backgroundColor: "#E3F1EA",
                                },
                            ]}
                        >
                            Productive
                        </Text>
                    )}
                    {isUnattended && (
                        <Text
                            style={[
                                styles.statusBadge,
                                {
                                    color: "#E65100",
                                    backgroundColor: "#FBEFD8",
                                },
                            ]}
                        >
                            Unattended
                        </Text>
                    )}
                    {isHierarchy && (
                        <Text
                            style={[
                                styles.statusBadge,
                                {
                                    color: "#00796B",
                                    backgroundColor: "#E3F1EA",
                                },
                            ]}
                        >
                            {item.status}
                        </Text>
                    )}
                    {isPercentProductive && (
                        <Text
                            style={[
                                styles.statusBadge,
                                {
                                    color: "#C2185B",
                                    backgroundColor: "#FCE4EC",
                                    fontWeight: "700",
                                },
                            ]}
                        >
                            {item.status}
                        </Text>
                    )}
                    {isProductivityCovered && (
                        <Text
                            style={[
                                styles.statusBadge,
                                {
                                    color: "#283593",
                                    backgroundColor: "#E8EAF6",
                                    fontWeight: "700",
                                },
                            ]}
                        >
                            {item.status}
                        </Text>
                    )}
                    {isSalesmanRow && (
                        <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#7A7266"
                            style={{ marginLeft: 6, marginTop: 4 }}
                        />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

            {/* Premium Header */}
            <LinearGradient
                colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.header, { paddingTop: insets.top || 16 }]}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color="#C9A24D" />
                    <Text style={styles.loadingText}>Fetching details...</Text>
                </View>
            ) : (
                <FlatList
                    data={listData}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-open-outline" size={48} color="#7A7266" />
                            <Text style={styles.emptyText}>No records found</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FBF8F1",
    },
    header: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#FFFFFF",
        letterSpacing: 0.5,
        flex: 1,
    },
    centerLoader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: "#7A7266",
        fontWeight: "600",
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D9D2C3",
        padding: 12,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#1F1D1A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
    },
    leftRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 0.72,
    },
    statusIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
    textWrap: {
        flex: 1,
    },
    outletName: {
        fontSize: 13,
        fontWeight: "800",
        color: "#1F1D1A",
    },
    repName: {
        fontSize: 10,
        fontWeight: "600",
        color: "#7A7266",
        marginTop: 2,
    },
    rightRow: {
        alignItems: "flex-end",
        flex: 0.28,
    },
    dateText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#7A7266",
    },
    statusBadge: {
        fontSize: 9,
        fontWeight: "700",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
        overflow: "hidden",
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 120,
    },
    emptyText: {
        fontSize: 14,
        color: "#7A7266",
        fontWeight: "600",
        marginTop: 12,
    },
});

export default MTDHighlightsDetail;
