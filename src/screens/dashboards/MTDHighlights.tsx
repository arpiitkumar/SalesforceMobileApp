import React, { FC, useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Modal,
    Dimensions,
    StatusBar,
    SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import moment from "moment";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { showToast } from "../../redux/slices/toastSlice";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 42) / 2;

const uniqueOutletsVisitedRoles = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM"];
const uniqueProductiveOutletsRoles = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM"];
const noSalesOutletsRoles = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM"];
const unattendedOutletRoles = ["ASM", "RSM", "AGM", "GM"];
const brandWiseTargetsRoles = ["DSM", "ISR", "SO", "ASE", "ASM", "RSM", "AGM", "GM", "VP"];
const hierarchyWiseRoles = ["ASM", "RSM", "AGM", "GM", "VP"];
const productivityOutletsCoveredRoles = ["ASM", "RSM", "AGM", "GM"];
const percentageProductiveOutletsRoles = ["ASM", "RSM", "AGM", "GM"];

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    bgColor: string;
    valueStyle?: any;
    onPress?: () => void;
}

const MetricCard: FC<MetricCardProps> = ({ title, value, icon, color, bgColor, valueStyle, onPress }) => (
    <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
    >
        <View style={[styles.cardIconWrap, { backgroundColor: bgColor }]}>
            <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={styles.cardTextContent}>
            <Text style={[styles.cardValue, valueStyle]}>{value}</Text>
            <Text style={styles.cardLabel}>{title}</Text>
        </View>
    </TouchableOpacity>
);

const hasRoleAccess = (userRole: string, allowedRoles: string[]): boolean => {
    if (!userRole) return false;
    const upperRole = userRole.toUpperCase();
    return allowedRoles.some((role) => upperRole.includes(role.toUpperCase()));
};

const MTDHighlights: FC = () => {
    const navigation = useNavigation<any>();
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const { fetchRecords } = useApiFetch();

    // Selected Month State
    const [selectedMonth, setSelectedMonth] = useState<moment.Moment>(moment());
    const [openMonthPicker, setOpenMonthPicker] = useState(false);

    // Month options: current month + previous 11 months (12 months total)
    const monthOptions = useMemo(() => {
        const list = [];
        for (let i = 0; i < 12; i++) {
            list.push(moment().subtract(i, "months"));
        }
        return list;
    }, []);

    // User & Hierarchy States
    const [userId, setUserId] = useState("");
    const [userRole, setUserRole] = useState("");
    const [userName, setUserName] = useState("");
    const [loadingUserInfo, setLoadingUserInfo] = useState(true);
    const [subordinates, setSubordinates] = useState<any[]>([]);

    // Dropdown Selectors
    const [personaList, setPersonaList] = useState<string[]>([]);
    const [employeeList, setEmployeeList] = useState<any[]>([]);
    const [selectedPersona, setSelectedPersona] = useState("All");
    const [selectedEmployee, setSelectedEmployee] = useState("All");
    const [openPersonaPicker, setOpenPersonaPicker] = useState(false);
    const [openEmployeePicker, setOpenEmployeePicker] = useState(false);

    // Metric States
    const [uniqueVisited, setUniqueVisited] = useState<string | number>("--");
    const [uniqueProductive, setUniqueProductive] = useState<string | number>("--");
    const [noSales, setNoSales] = useState<string | number>("--");
    const [unattendedOutlets, setUnattendedOutlets] = useState<string | number>("--");
    const [hierarchyWiseCalls, setHierarchyWiseCalls] = useState<string | number>("--");
    const [percentageProductive, setPercentageProductive] = useState<string | number>("--");
    const [productivityCovered, setProductivityCovered] = useState<string | number>("--");
    const [loadingMetrics, setLoadingMetrics] = useState(false);

    // Load User & Hierarchy Info (identical to MTDSales.tsx)
    useEffect(() => {
        const loadUserInfo = async () => {
            try {
                const loggedInUser = await UniversalUpdateInsert({
                    ObjectName: "User",
                    Type: "get",
                });
                if (loggedInUser && loggedInUser.length > 0) {
                    const currentId = loggedInUser[0].Sf_Id;
                    setUserId(currentId);
                    setUserName(loggedInUser[0].Name || "");
                    let actualUserRole = loggedInUser[0].Role || "";
                    try {
                        const roleQuery = `SELECT UserRole.Name FROM User WHERE Id = '${currentId}'`;
                        const roleRes = await fetchRecords("User", roleQuery);
                        if (Array.isArray(roleRes) && roleRes.length > 0) {
                            actualUserRole = roleRes[0].UserRole?.Name || loggedInUser[0].Role || "";
                        }
                    } catch (roleErr) {
                        console.error("Failed to query user role:", roleErr);
                    }
                    setUserRole(actualUserRole);

                    // Fetch Subordinates (hierarchical - up to 4 levels)
                    try {
                        let allSubordinates: any[] = [];
                        let currentManagerIds = [currentId];

                        for (let depth = 0; depth < 4; depth++) {
                            if (currentManagerIds.length === 0) break;
                            const idsStr = currentManagerIds.map(id => `'${id}'`).join(",");
                            const query = `SELECT Id, Name, UserRole.Name, Phone FROM User WHERE ManagerId IN (${idsStr})`;
                            const records = await fetchRecords("User", query);
                            if (Array.isArray(records) && records.length > 0) {
                                allSubordinates = [...allSubordinates, ...records];
                                currentManagerIds = records.map((u: any) => u.Id);
                            } else {
                                break;
                            }
                        }

                        // Deduplicate subordinates
                        const uniqueSubsMap = new Map();

                        // Add logged-in user (self)
                        uniqueSubsMap.set(currentId, {
                            Sf_Id: currentId,
                            Name: loggedInUser[0].Name,
                            Role: actualUserRole || "Representative",
                            Phone: loggedInUser[0].Phone || "",
                        });

                        allSubordinates.forEach((u: any) => {
                            uniqueSubsMap.set(u.Id, {
                                Sf_Id: u.Id,
                                Name: u.Name,
                                Role: u.UserRole?.Name || "Representative",
                                Phone: u.Phone || "",
                            });
                        });
                        const mapped = Array.from(uniqueSubsMap.values());

                        setSubordinates(mapped);
                        const uniqueRoles = [...new Set(mapped.map((s: any) => s.Role))].filter(Boolean);
                        setPersonaList(uniqueRoles as string[]);
                    } catch (apiErr) {
                        console.error("Hierarchical query failed in MTDHighlights:", apiErr);
                    }
                }
            } catch (err) {
                console.error("Error loading user info in MTDHighlights:", err);
            } finally {
                setLoadingUserInfo(false);
            }
        };

        loadUserInfo();
    }, []);

    // Filter Employees dynamically based on selected Persona
    useEffect(() => {
        if (selectedPersona === "All") {
            setEmployeeList(subordinates);
        } else {
            const filtered = subordinates.filter((s) => s.Role === selectedPersona);
            setEmployeeList(filtered);
        }
        setSelectedEmployee("All");
    }, [selectedPersona, subordinates]);

    // Fetch Metric Highlights Data from Salesforce (Dynamic hierarchical filter)
    useEffect(() => {
        if (!userId) return;

        const fetchHighlights = async () => {
            setLoadingMetrics(true);
            try {
                const isCurrentMonth = selectedMonth.isSame(moment(), "month");
                const startOfMonth = selectedMonth.clone().startOf("month").format("YYYY-MM-DD");
                const endOfMonth = selectedMonth.clone().endOf("month").format("YYYY-MM-DD");
                const dateFilter = isCurrentMonth
                    ? "BeatDay__r.Beat_Date__c = THIS_MONTH"
                    : `BeatDay__r.Beat_Date__c >= ${startOfMonth} AND BeatDay__r.Beat_Date__c <= ${endOfMonth}`;

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

                const queryVisited = `SELECT CreatedBy.Name SalesRepName, COUNT_DISTINCT(AccountId__c) UniqueOutletsVisited, COUNT(Id) TotalVisitsLogged FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ${targetFilter} GROUP BY CreatedBy.Name ORDER BY CreatedBy.Name ASC`;

                const queryProductive = `SELECT CreatedBy.Manager.Name ManagerName, CreatedBy.Name SalesRepName, ProductiveCall__c IsProductive, COUNT_DISTINCT(AccountId__c) UniqueOutletsCount, COUNT(Id) TotalCallsCount FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ProductiveCall__c = true AND ${targetFilter} GROUP BY CreatedBy.Manager.Name, CreatedBy.Name, ProductiveCall__c ORDER BY CreatedBy.Manager.Name ASC, CreatedBy.Name ASC`;

                const queryNoSales = `SELECT AccountId__c FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND AccountId__c NOT IN (SELECT AccountId__c FROM Order__c WHERE EffectiveDate__c >= ${startOfMonth} AND EffectiveDate__c <= ${endOfMonth}) AND ${targetFilter} GROUP BY AccountId__c`;

                const queryUnattended = `SELECT Account__c, Account__r.Name, Account__r.Party_Code__c, Account__r.Phone, Account__r.Outlet_Type__c, Beat__r.Name, Beat__r.Distributor__r.Name FROM Beat_Mapping__c WHERE Is_Active__c = true AND Account__c NOT IN (SELECT AccountId__c FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ${targetFilter}) ORDER BY Beat__r.Name ASC, Account__r.Name ASC`;

                const beatDayDateFilter = isCurrentMonth
                    ? "Beat_Date__c = THIS_MONTH"
                    : `Beat_Date__c >= ${startOfMonth} AND Beat_Date__c <= ${endOfMonth}`;

                const queryHierarchy = `SELECT Owner.Name SalesRepName, SUM(Total_Calls__c) TotalCalls_TC, SUM(Productive_Calls__c) ProductiveCalls_PC, COUNT(Id) TotalWorkingDays FROM Beat_Day__c WHERE ${beatDayDateFilter} AND OwnerId IN (${userIds}) GROUP BY Owner.Name ORDER BY Owner.Name ASC`;

                const queryCovered = `SELECT CreatedBy.Name SalesRepName, ProductiveCall__c IsProductive, COUNT_DISTINCT(AccountId__c) UniqueOutletsCount, COUNT(Id) TotalCallsCount FROM Visit__c WHERE ${dateFilter} AND CheckInTime__c != null AND ${targetFilter} GROUP BY CreatedBy.Name, ProductiveCall__c ORDER BY CreatedBy.Name ASC`;

                console.log("MTDHighlights Unattended query:", queryUnattended);
                console.log("MTDHighlights Hierarchy query:", queryHierarchy);

                console.log("MTDHighlights SOQL Queries launched...");
                const [resVisited, resProductive, resNoSales, resUnattended, resHierarchy, resCovered] = await Promise.all([
                    fetchRecords("Visit__c", queryVisited),
                    fetchRecords("Visit__c", queryProductive),
                    fetchRecords("Visit__c", queryNoSales),
                    fetchRecords("Beat_Mapping__c", queryUnattended),
                    fetchRecords("Beat_Day__c", queryHierarchy),
                    fetchRecords("Visit__c", queryCovered),
                ]);

                let visitedCount = 0;
                if (Array.isArray(resVisited)) {
                    resVisited.forEach((r: any) => {
                        visitedCount += Number(r.UniqueOutletsVisited || r.expr0 || 0);
                    });
                }
                let productiveCount = 0;
                if (Array.isArray(resProductive)) {
                    resProductive.forEach((r: any) => {
                        productiveCount += Number(r.UniqueOutletsCount || r.expr0 || 0);
                    });
                }
                const noSalesCount = Array.isArray(resNoSales) ? resNoSales.length : 0;
                const unattendedCount = Array.isArray(resUnattended) ? resUnattended.length : 0;

                let hierarchyCallsCount = 0;
                let totalCallsAll = 0;
                let totalProductiveAll = 0;
                if (Array.isArray(resHierarchy)) {
                    resHierarchy.forEach((r: any) => {
                        const tc = Number(r.TotalCalls_TC || r.expr0 || 0);
                        const pc = Number(r.ProductiveCalls_PC || r.expr1 || 0);
                        hierarchyCallsCount += tc;
                        totalCallsAll += tc;
                        totalProductiveAll += pc;
                    });
                }
                const pctAll = totalCallsAll > 0 ? `${((totalProductiveAll / totalCallsAll) * 100).toFixed(1)}%` : "0%";

                let totalProdDistinctCovered = 0;
                let totalAllDistinctCovered = 0;
                if (Array.isArray(resCovered)) {
                    resCovered.forEach((r: any) => {
                        const isProd = r.IsProductive === true || r.IsProductive === "true" || r.ProductiveCall__c === true || r.ProductiveCall__c === "true";
                        const outlets = Number(r.UniqueOutletsCount || r.expr0 || 0);
                        totalAllDistinctCovered += outlets;
                        if (isProd) {
                            totalProdDistinctCovered += outlets;
                        }
                    });
                }
                const pctCovered = totalAllDistinctCovered > 0 ? `${((totalProdDistinctCovered / totalAllDistinctCovered) * 100).toFixed(1)}%` : "0%";

                setUniqueVisited(visitedCount);
                setUniqueProductive(productiveCount);
                setNoSales(noSalesCount);
                setUnattendedOutlets(unattendedCount);
                setHierarchyWiseCalls(hierarchyCallsCount);
                setPercentageProductive(pctAll);
                setProductivityCovered(pctCovered);
            } catch (err) {
                console.error("Failed to fetch MTD Highlights metrics:", err);
                setUniqueVisited("--");
                setUniqueProductive("--");
                setNoSales("--");
                setUnattendedOutlets("--");
                setHierarchyWiseCalls("--");
                setPercentageProductive("--");
                setProductivityCovered("--");
            } finally {
                setLoadingMetrics(false);
            }
        };

        fetchHighlights();
    }, [userId, selectedMonth, selectedPersona, selectedEmployee, subordinates.length]);

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
                    <Text style={styles.headerTitle}>MTD Highlights</Text>
                </View>
            </LinearGradient>

            {loadingUserInfo ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color="#C9A24D" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Month Selector Dropdown */}
                    <TouchableOpacity style={styles.monthDropdown} onPress={() => setOpenMonthPicker(true)}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <Ionicons name="calendar-outline" size={20} color="#C9A24D" style={{ marginRight: 10 }} />
                            <View style={styles.filterLabelContainer}>
                                <Text style={styles.filterLabel}>Select Month</Text>
                                <Text style={styles.filterValue}>{selectedMonth.format("MMMM YYYY")}</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-down" size={16} color="#7A7266" />
                    </TouchableOpacity>

                    {/* Dynamic Filters Row */}
                    <View style={styles.filterRow}>
                        <TouchableOpacity style={styles.filterDropdown} onPress={() => setOpenPersonaPicker(true)}>
                            <View style={styles.filterLabelContainer}>
                                <Text style={styles.filterLabel}>Persona</Text>
                                <Text style={styles.filterValue} numberOfLines={1}>{selectedPersona}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={16} color="#7A7266" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.filterDropdown} onPress={() => setOpenEmployeePicker(true)}>
                            <View style={styles.filterLabelContainer}>
                                <Text style={styles.filterLabel}>Employee</Text>
                                <Text style={styles.filterValue} numberOfLines={1}>
                                    {selectedEmployee === "All"
                                        ? "All"
                                        : employeeList.find((e) => e.Sf_Id === selectedEmployee)?.Name || "All"}
                                </Text>
                            </View>
                            <Ionicons name="chevron-down" size={16} color="#7A7266" />
                        </TouchableOpacity>
                    </View>

                    {/* Cards Grid */}
                    <View style={styles.grid}>

                        {/* 1. Unique outlets visited */}
                        {hasRoleAccess(userRole, uniqueOutletsVisitedRoles) && (
                            <MetricCard
                                title="Unique Outlets Visited"
                                value={loadingMetrics ? "..." : uniqueVisited}
                                icon="store-search"
                                color="#3B5BB5"
                                bgColor="#E3F2FD"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "Unique Outlets Visited Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "unique_visited",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                        {/* 2. Unique productive outlets */}
                        {hasRoleAccess(userRole, uniqueProductiveOutletsRoles) && (
                            <MetricCard
                                title="Unique Productive Outlets"
                                value={loadingMetrics ? "..." : uniqueProductive}
                                icon="checkbox-marked-circle-outline"
                                color="#4CAF50"
                                bgColor="#E3F1EA"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "Unique Productive Outlets Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "unique_productive",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                        {/* 3. No sales outlets */}
                        {hasRoleAccess(userRole, noSalesOutletsRoles) && (
                            <MetricCard
                                title="No Sales Outlets"
                                value={loadingMetrics ? "..." : noSales}
                                icon="store-remove"
                                color="#B3261E"
                                bgColor="#F9E5E3"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "No Sales Outlets Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "no_sales",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                        {/* 4. Unattended outlet */}
                        {hasRoleAccess(userRole, unattendedOutletRoles) && (
                            <MetricCard
                                title="Unattended Outlet"
                                value={loadingMetrics ? "..." : unattendedOutlets}
                                icon="clock-alert-outline"
                                color="#FB8C00"
                                bgColor="#FBEFD8"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "Unattended Outlet Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "unattended_outlets",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                        {/* 5. Brand wise targets v/s achievement */}
                        {hasRoleAccess(userRole, brandWiseTargetsRoles) && (
                            <MetricCard
                                title="Brand Wise Targets v/s Achievement"
                                value="Upcoming"
                                valueStyle={{ color: "#8E24AA", fontSize: 12, fontWeight: "700" }}
                                icon="tag-multiple-outline"
                                color="#8E24AA"
                                bgColor="#F3E5F5"
                                onPress={() => {
                                    dispatch(showToast({ message: "Feature coming soon!", type: "info" }));
                                }}
                            />
                        )}

                        {/* 6. hierarchy wise sales & visit data */}
                        {hasRoleAccess(userRole, hierarchyWiseRoles) && (
                            <MetricCard
                                title="Hierarchy Wise Sales & Visit Data"
                                value={loadingMetrics ? "..." : hierarchyWiseCalls}
                                icon="sitemap-outline"
                                color="#2E7D5B"
                                bgColor="#E3F1EA"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "Hierarchy Wise Sales & Visit Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "hierarchy_sales_visit",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                        {/* 7. Productivity w.r.t percentage of outlets covered */}
                        {hasRoleAccess(userRole, productivityOutletsCoveredRoles) && (
                            <MetricCard
                                title="Productivity w.r.t % Outlets Covered"
                                value={loadingMetrics ? "..." : productivityCovered}
                                icon="chart-arc"
                                color="#3949AB"
                                bgColor="#E8EAF6"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "Productivity w.r.t % Outlets Covered Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "productivity_covered_outlets",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                        {/* 8. percentage of productive outlets */}
                        {hasRoleAccess(userRole, percentageProductiveOutletsRoles) && (
                            <MetricCard
                                title="Percentage of Productive Outlets"
                                value={loadingMetrics ? "..." : percentageProductive}
                                icon="percent"
                                color="#D81B60"
                                bgColor="#FCE4EC"
                                onPress={() =>
                                    navigation.navigate("MTDHighlightsDetail", {
                                        title: "Percentage of Productive Outlets Details",
                                        selectedPersona,
                                        selectedEmployee,
                                        selectedMonth: selectedMonth.format("YYYY-MM"),
                                        metricType: "percentage_productive_outlets",
                                        userId,
                                        subordinates,
                                    })
                                }
                            />
                        )}

                    </View>
                </ScrollView>
            )}

            {/* Modals */}
            {/* 1. Month Picker Modal */}
            <Modal visible={openMonthPicker} transparent animationType="fade" onRequestClose={() => setOpenMonthPicker(false)}>
                <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenMonthPicker(false)}>
                    <View style={modalStyles.modalContainer}>
                        <View style={modalStyles.modalHeader}>
                            <Text style={modalStyles.modalHeaderText}>Select Month</Text>
                            <TouchableOpacity onPress={() => setOpenMonthPicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={modalStyles.modalScroll}>
                            {monthOptions.map((opt, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => {
                                        setSelectedMonth(opt);
                                        setOpenMonthPicker(false);
                                    }}
                                    style={[
                                        modalStyles.menuItem,
                                        selectedMonth.format("YYYY-MM") === opt.format("YYYY-MM") && modalStyles.menuItemActive,
                                    ]}
                                >
                                    <Text style={modalStyles.menuText}>{opt.format("MMMM YYYY")}</Text>
                                    {selectedMonth.format("YYYY-MM") === opt.format("YYYY-MM") && (
                                        <Ionicons name="checkmark" size={20} color="#C9A24D" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 2. Persona Selector Modal */}
            <Modal visible={openPersonaPicker} transparent animationType="fade" onRequestClose={() => setOpenPersonaPicker(false)}>
                <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenPersonaPicker(false)}>
                    <View style={modalStyles.modalContainer}>
                        <View style={modalStyles.modalHeader}>
                            <Text style={modalStyles.modalHeaderText}>Select Persona</Text>
                            <TouchableOpacity onPress={() => setOpenPersonaPicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={modalStyles.modalScroll}>
                            <TouchableOpacity
                                style={[modalStyles.menuItem, selectedPersona === "All" && modalStyles.menuItemActive]}
                                onPress={() => {
                                    setSelectedPersona("All");
                                    setOpenPersonaPicker(false);
                                }}
                            >
                                <Text style={modalStyles.menuText}>All</Text>
                                {selectedPersona === "All" && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
                            </TouchableOpacity>
                            {personaList.map((p, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[modalStyles.menuItem, selectedPersona === p && modalStyles.menuItemActive]}
                                    onPress={() => {
                                        setSelectedPersona(p);
                                        setOpenPersonaPicker(false);
                                    }}
                                >
                                    <Text style={modalStyles.menuText}>{p}</Text>
                                    {selectedPersona === p && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 3. Employee Selector Modal */}
            <Modal visible={openEmployeePicker} transparent animationType="fade" onRequestClose={() => setOpenEmployeePicker(false)}>
                <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPress={() => setOpenEmployeePicker(false)}>
                    <View style={modalStyles.modalContainer}>
                        <View style={modalStyles.modalHeader}>
                            <Text style={modalStyles.modalHeaderText}>Select Employee</Text>
                            <TouchableOpacity onPress={() => setOpenEmployeePicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={modalStyles.modalScroll}>
                            <TouchableOpacity
                                style={[modalStyles.menuItem, selectedEmployee === "All" && modalStyles.menuItemActive]}
                                onPress={() => {
                                    setSelectedEmployee("All");
                                    setOpenEmployeePicker(false);
                                }}
                            >
                                <Text style={modalStyles.menuText}>All</Text>
                                {selectedEmployee === "All" && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
                            </TouchableOpacity>
                            {employeeList.map((e, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[modalStyles.menuItem, selectedEmployee === e.Sf_Id && modalStyles.menuItemActive]}
                                    onPress={() => {
                                        setSelectedEmployee(e.Sf_Id);
                                        setOpenEmployeePicker(false);
                                    }}
                                >
                                    <Text style={modalStyles.menuText}>{e.Name}</Text>
                                    {selectedEmployee === e.Sf_Id && <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

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
    },
    centerLoader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    monthDropdown: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D9D2C3",
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
        shadowColor: "#1F1D1A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    filterRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    filterDropdown: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D9D2C3",
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginHorizontal: 4,
        shadowColor: "#1F1D1A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    filterLabelContainer: {
        flex: 1,
        marginRight: 6,
    },
    filterLabel: {
        fontSize: 9,
        fontWeight: "700",
        color: "#7A7266",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    filterValue: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1F1D1A",
        marginTop: 1,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F1EADB",
        paddingHorizontal: 10,
        paddingVertical: 12,
        width: CARD_WIDTH,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        minHeight: 70,
        shadowColor: "#1F1D1A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    cardIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    cardTextContent: {
        flex: 1,
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: "#7A7266",
        lineHeight: 13,
        marginTop: 1,
    },
    cardValue: {
        fontSize: 15,
        fontWeight: "900",
        color: "#1F1D1A",
        lineHeight: 16,
    },
});

const modalStyles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: {
        width: width - 32,
        maxHeight: "80%",
        backgroundColor: "#FBF8F1",
        borderRadius: 16,
        overflow: "hidden",
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    modalScroll: {
        maxHeight: 400,
    },
    modalHeader: {
        height: 56,
        backgroundColor: "#C9A24D",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
    },
    modalHeaderText: {
        color: "#13265C",
        fontSize: 16,
        fontWeight: "700",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#D9D2C3",
        backgroundColor: "#fff",
    },
    menuItemActive: {
        backgroundColor: "#F1EADB",
    },
    menuText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1F1D1A",
    },
});

export default MTDHighlights;
