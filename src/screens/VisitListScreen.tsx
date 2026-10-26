import React, { FC, useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import moment from "moment";
import AsyncStorage from "@react-native-async-storage/async-storage";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../assets/css/MasterCss.js";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface VisitItem {
  id: string;
  sfId: string;
  accountName: string;
  accountClass: string;
  visitStatus: string;
  productive: boolean;
  type: "Productive" | "Non-Productive" | "Pending" | "Not Visited";
  recordType: string;
  checkInTime?: string;
  checkOutTime?: string;
  isTelephoneOrder?: boolean;
}

const getAccountTypeLabel = (recordType: string) => {
  const norm = (recordType || "").toLowerCase().trim();
  if (
    norm.includes("distributor") ||
    norm.includes("db") ||
    norm === "ba" ||
    norm === "bas" ||
    norm.includes("business associate")
  ) {
    return "Distributor";
  }
  return "Retailer";
};

const VisitListScreen: FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "All" | "Productive" | "Non-Productive" | "Pending" | "Not Visited"
  >("All");
  const [isEndDayCompleted, setIsEndDayCompleted] = useState<boolean>(false);

  const dateStore = useSelector(
    (state: RootState) => state.beat.selectedDateBeat,
  );

  const fetchVisitListData = async () => {
    try {
      setLoading(true);
      const today = dateStore || moment().format("YYYY-MM-DD");

      // 1. Fetch current logged-in user
      const users = await UniversalUpdateInsert({
        ObjectName: "User",
        Type: "get",
      });
      if (!users || users.length === 0) {
        setVisits([]);
        setLoading(false);
        return;
      }
      const userId = users[0].Sf_Id;

      // 2. Fetch active Route Plans
      const RoutePlans = await UniversalUpdateInsert({
        ObjectName: "Route_Plans__c",
        Type: "get",
        filters: [{ field: "Assigned_To__c", value: userId }],
      });

      const firstDayOfMonth = moment(today).startOf("month").toDate();
      const lastDayOfMonth = moment(today).endOf("month").toDate();

      const currentMonthRoutePlans = RoutePlans.filter((plan) => {
        const startDate = new Date(plan.Start_Date__c);
        const endDate = new Date(plan.End_Date__c);
        return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
      });

      if (currentMonthRoutePlans.length === 0) {
        setVisits([]);
        setLoading(false);
        return;
      }
      const activePlanId = currentMonthRoutePlans[0].Sf_Id;

      // 3. Fetch BeatDays
      const BeatDays = await UniversalUpdateInsert({
        ObjectName: "BeatDay__c",
        Type: "get",
      });

      const beatDayForDate = BeatDays.find(
        (b) =>
          b.Tour_Plan__c === activePlanId && b.Beat_Date__c === today,
      );

      if (!beatDayForDate) {
        setVisits([]);
        setLoading(false);
        return;
      }

      // Check if End Day has been completed for this date
      const endDayMarkerKey = `end_day_completed_${today}`;
      const endDayMarker = await AsyncStorage.getItem(endDayMarkerKey);
      const isEndDaySaved =
        endDayMarker === "true" ||
        !!beatDayForDate?.EndOfDayTime__c ||
        !!beatDayForDate?.End_Time__c ||
        !!beatDayForDate?.End_Of_Day_Time__c ||
        (moment(today).isBefore(moment().format("YYYY-MM-DD"), "day") &&
          moment(today).isValid());
      setIsEndDayCompleted(Boolean(isEndDaySaved));

      // 4. Fetch Visits and Accounts
      const rawVisits = await UniversalUpdateInsert({
        ObjectName: "Visit",
        Type: "get",
        filters: [
          { field: "SoftDelete", value: false },
          { field: "BeatDay__c", value: beatDayForDate.Sf_Id },
        ],
      });

      const accounts = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
      });

      const accountMap = new Map();
      accounts.forEach((acc) => {
        accountMap.set(acc.Sf_Id, acc);
      });

      // Fetch Orders to detect if any order was placed for this specific visit
      const orderVisitIds = new Set();
      try {
        const localOrders = await UniversalUpdateInsert({
          ObjectName: "Order",
          Type: "get",
        });
        if (Array.isArray(localOrders)) {
          localOrders.forEach((o: any) => {
            const vId = o.Visit__c || o.VisitId || o.Visit_Id || o.VisitId__c;
            if (vId) orderVisitIds.add(String(vId));
          });
        }
      } catch (errOrders) {
        console.log("Could not load local orders for visit list:", errOrders);
      }

      const processedVisits: VisitItem[] = rawVisits.map((v) => {
        const accId = v.AccountId__c || v.AccountId;
        const account = accountMap.get(accId);
        const accountName = account?.Name || "Unknown Retailer";
        const accountClass = account?.Class__c || "--";

        // Determine visit type/status
        const isCompleted =
          v.VisitStatus__c === "Check Out" ||
          v.VisitStatus__c === "Check In" ||
          v.VisitStatus__c === "Completed" ||
          !!v.CheckInTime__c;

        const isOrderPlaced =
          v.ProductiveCall__c === true ||
          v.ProductiveCall__c === "true" ||
          v.IsOrderPlaced__c === true ||
          v.IsOrderPlaced__c === "true" ||
          (v.Sf_Id && orderVisitIds.has(String(v.Sf_Id))) ||
          (v.id && orderVisitIds.has(String(v.id)));

        const isTelephoneOrder = !isCompleted && isOrderPlaced;

        let type: "Productive" | "Non-Productive" | "Pending" | "Not Visited" =
          isEndDaySaved ? "Pending" : "Not Visited";

        if (isCompleted) {
          if (v.ProductiveCall__c === true || v.ProductiveCall__c === "true" || isOrderPlaced) {
            type = "Productive";
          } else {
            type = "Non-Productive";
          }
        } else {
          type = isEndDaySaved ? "Pending" : "Not Visited";
        }

        return {
          id: v.id,
          sfId: v.Sf_Id,
          accountName,
          accountClass,
          visitStatus: v.VisitStatus__c || "Planned",
          productive: v.ProductiveCall__c === true || isOrderPlaced,
          type,
          recordType: v.RecordType || v.recordType || "",
          checkInTime: v.CheckInTime__c,
          checkOutTime: v.CheckOutTime__c,
          isTelephoneOrder,
        };
      });

      setVisits(processedVisits);
    } catch (error) {
      console.error("Error fetching visit list:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVisitListData();
    }, [dateStore]),
  );

  // Computed Metrics for Visit Summary
  const summaryMetrics = useMemo(() => {
    const totalVisitsCount = visits.length;
    const productiveCount = visits.filter((v) => v.type === "Productive" || v.isTelephoneOrder || v.productive).length;
    const nonProductiveCount = visits.filter((v) => v.type === "Non-Productive").length;
    const missedCount = isEndDayCompleted
      ? visits.filter((v) => v.type === "Pending").length
      : 0;
    const notVisitedCount = visits.filter((v) => v.type === "Not Visited").length;

    // Filter visits with valid checkInTime and sort chronologically for First Visit
    const visitsWithCheckIn = visits.filter((v) => !!v.checkInTime);
    const sortedByCheckIn = [...visitsWithCheckIn].sort((a, b) => {
      const tA = moment(a.checkInTime?.replace(/^"+|"+$/g, "")).valueOf();
      const tB = moment(b.checkInTime?.replace(/^"+|"+$/g, "")).valueOf();
      return tA - tB;
    });

    const firstVisitTime =
      sortedByCheckIn.length > 0 && sortedByCheckIn[0].checkInTime
        ? moment(sortedByCheckIn[0].checkInTime.replace(/^"+|"+$/g, "")).format("hh:mm A")
        : "--";

    // Filter visits with valid checkOutTime and sort chronologically for Last Visit
    const visitsWithCheckOut = visits.filter((v) => !!v.checkOutTime);
    const sortedByCheckOut = [...visitsWithCheckOut].sort((a, b) => {
      const tA = moment(a.checkOutTime?.replace(/^"+|"+$/g, "")).valueOf();
      const tB = moment(b.checkOutTime?.replace(/^"+|"+$/g, "")).valueOf();
      return tA - tB;
    });

    const lastVisitWithCheckOut =
      sortedByCheckOut.length > 0
        ? sortedByCheckOut[sortedByCheckOut.length - 1]
        : null;

    const lastVisitTime =
      lastVisitWithCheckOut && lastVisitWithCheckOut.checkOutTime
        ? moment(lastVisitWithCheckOut.checkOutTime.replace(/^"+|"+$/g, "")).format("hh:mm A")
        : "--";

    // Total Time Spent in visits: time difference between first check-in and last check-out
    let totalTimeSpentInVisits = "--";
    if (
      sortedByCheckIn.length > 0 &&
      sortedByCheckIn[0].checkInTime &&
      lastVisitWithCheckOut &&
      lastVisitWithCheckOut.checkOutTime
    ) {
      const firstInMoment = moment(sortedByCheckIn[0].checkInTime.replace(/^"+|"+$/g, ""));
      const lastOutMoment = moment(lastVisitWithCheckOut.checkOutTime.replace(/^"+|"+$/g, ""));

      if (firstInMoment.isValid() && lastOutMoment.isValid()) {
        const diffMinutes = Math.max(0, lastOutMoment.diff(firstInMoment, "minutes"));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        if (hours > 0) {
          totalTimeSpentInVisits = `${hours}h ${mins}m`;
        } else {
          totalTimeSpentInVisits = `${mins}m`;
        }
      }
    }

    const totalRetailerVisitsCount = visits.filter(
      (v) => getAccountTypeLabel(v.recordType) === "Retailer"
    ).length;
    const productiveRetailerCount = visits.filter(
      (v) =>
        getAccountTypeLabel(v.recordType) === "Retailer" &&
        (v.type === "Productive" || v.isTelephoneOrder || v.productive)
    ).length;
    const nonProductiveRetailerCount = visits.filter(
      (v) =>
        getAccountTypeLabel(v.recordType) === "Retailer" &&
        v.type === "Non-Productive"
    ).length;
    const totalRetailerCallsCount = visits.filter(
      (v) =>
        getAccountTypeLabel(v.recordType) === "Retailer" &&
        (v.type === "Productive" || v.type === "Non-Productive" || v.isTelephoneOrder || v.productive)
    ).length;

    return {
      totalVisitsCount,
      productiveCount,
      nonProductiveCount,
      missedCount,
      notVisitedCount,
      firstVisitTime,
      lastVisitTime,
      totalTimeSpentInVisits,
      totalRetailerVisitsCount,
      productiveRetailerCount,
      nonProductiveRetailerCount,
      totalRetailerCallsCount,
    };
  }, [visits, isEndDayCompleted]);

  const getFilteredVisits = () => {
    if (activeFilter === "All") return visits;
    if (activeFilter === "Productive") {
      return visits.filter((v) => v.type === "Productive" || v.isTelephoneOrder || v.productive);
    }
    return visits.filter((v) => v.type === activeFilter);
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "Productive":
        return styles.badgeProductive;
      case "Non-Productive":
        return styles.badgeNonProductive;
      case "Pending":
        return styles.badgeMissed;
      case "Not Visited":
      default:
        return styles.badgeNotVisited;
    }
  };

  const getBadgeTextStyle = (type: string) => {
    switch (type) {
      case "Productive":
        return styles.badgeTextProductive;
      case "Non-Productive":
        return styles.badgeTextNonProductive;
      case "Pending":
        return styles.badgeTextMissed;
      case "Not Visited":
      default:
        return styles.badgeTextNotVisited;
    }
  };



  const renderVisitCard = ({ item }: { item: VisitItem }) => {
    const formattedCheckIn = item.checkInTime
      ? moment(item.checkInTime.replace(/^"+|"+$/g, "")).format("hh:mm A")
      : null;
    const formattedCheckOut = item.checkOutTime
      ? moment(item.checkOutTime.replace(/^"+|"+$/g, "")).format("hh:mm A")
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {/* Left Column: Name & Metadata */}
          <View style={styles.cardLeftCol}>
            <Text style={styles.accountName} numberOfLines={2}>
              {item.accountName}
            </Text>
            
            <View style={styles.metaRow}>
              {/* Type Badge */}
              <View style={[
                styles.typeHighlight,
                getAccountTypeLabel(item.recordType) === "Distributor"
                  ? styles.typeDistributor
                  : styles.typeRetailer
              ]}>
                <Text style={[
                  styles.typeText,
                  getAccountTypeLabel(item.recordType) === "Distributor"
                    ? styles.typeTextDistributor
                    : styles.typeTextRetailer
                ]}>
                  {getAccountTypeLabel(item.recordType)}
                </Text>
              </View>

              {/* Class Badge */}
              {item.accountClass ? (
                <View style={styles.classHighlight}>
                  <Text style={styles.classText}>Class {item.accountClass}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Right Column: Status & Timings */}
          <View style={styles.cardRightCol}>
            <View style={[styles.badge, getBadgeStyle(item.type), { alignSelf: 'flex-end' }]}>
              <Text style={[styles.badgeText, getBadgeTextStyle(item.type)]}>{item.type}</Text>
            </View>

            {/* Check-In / Check-Out details (only when times exist) */}
            {(formattedCheckIn || formattedCheckOut) ? (
              <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                {formattedCheckIn && (
                  <Text style={styles.timeText}>In: {formattedCheckIn}</Text>
                )}
                {formattedCheckOut && (
                  <Text style={styles.timeText}>Out: {formattedCheckOut}</Text>
                )}
              </View>
            ) : null}
          </View>
        </View>

        {/* Telephone Order Placed Banner */}
        {item.isTelephoneOrder ? (
          <View style={styles.telephonyOrderBanner}>
            <View style={styles.telephonyOrderLeft}>
              <View style={styles.telephonyOrderIconWrap}>
                <Ionicons name="call" size={12} color="#15803D" />
              </View>
              <Text style={styles.telephonyOrderText}>Telephone Spot Sales Placed</Text>
            </View>
            <View style={styles.telephonyOrderPill}>
              <Ionicons name="checkmark-circle" size={11} color="#2E7D5B" />
              <Text style={styles.telephonyOrderPillText}>Spot Sales Placed</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderHeader = () => {
    return (
      <View style={styles.summarySectionWrapper}>
        {/* SUMMARY DASHBOARD CARD */}
        <View style={styles.summaryContainer}>
          {/* Top 4 KPI Metrics */}
          <View style={styles.kpiGrid}>
            {/* Total Visits */}
            <TouchableOpacity
              style={[
                styles.kpiCard,
                activeFilter === "All" && styles.kpiCardActiveAll,
              ]}
              onPress={() => setActiveFilter("All")}
              activeOpacity={0.7}
            >
              <Text style={[styles.kpiValue, { color: "#1F1D1A" }]} numberOfLines={1} adjustsFontSizeToFit>
                {summaryMetrics.totalVisitsCount}
              </Text>
              <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>Today's Visits</Text>
            </TouchableOpacity>

            {/* Productive */}
            <TouchableOpacity
              style={[
                styles.kpiCard,
                activeFilter === "Productive" && styles.kpiCardActiveProductive,
              ]}
              onPress={() =>
                setActiveFilter(
                  activeFilter === "Productive" ? "All" : "Productive",
                )
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.kpiValue, { color: "#2E7D5B" }]} numberOfLines={1} adjustsFontSizeToFit>
                {summaryMetrics.productiveRetailerCount}/{summaryMetrics.totalRetailerCallsCount}
              </Text>
              <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>Productive</Text>
            </TouchableOpacity>
 
            {/* Non-Productive */}
            <TouchableOpacity
              style={[
                styles.kpiCard,
                activeFilter === "Non-Productive" &&
                  styles.kpiCardActiveNonProductive,
              ]}
              onPress={() =>
                setActiveFilter(
                  activeFilter === "Non-Productive"
                    ? "All"
                    : "Non-Productive",
                )
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.kpiValue, { color: "#D08C1F" }]} numberOfLines={1} adjustsFontSizeToFit>
                {summaryMetrics.nonProductiveRetailerCount}/{summaryMetrics.totalRetailerCallsCount}
              </Text>
              <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>Non-Productive</Text>
            </TouchableOpacity>
 
            {/* Missed */}
            <TouchableOpacity
              style={[
                styles.kpiCard,
                activeFilter === "Pending" && styles.kpiCardActiveMissed,
              ]}
              onPress={() =>
                setActiveFilter(activeFilter === "Pending" ? "All" : "Pending")
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.kpiValue, { color: "#B3261E" }]} numberOfLines={1} adjustsFontSizeToFit>
                {summaryMetrics.missedCount}
              </Text>
              <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>Pending Visits</Text>
            </TouchableOpacity>
          </View>

          {/* Timings & Duration Row */}
          <View style={styles.timingsCard}>
            <View style={styles.timingItem}>
              <View style={[styles.timingIconWrap, { backgroundColor: "#E3F1EA" }]}>
                <Ionicons name="log-in-outline" size={16} color="#2E7D5B" />
              </View>
              <View>
                <Text style={styles.timingLabel}>First Visit</Text>
                <Text style={styles.timingValue}>{summaryMetrics.firstVisitTime}</Text>
              </View>
            </View>

            <View style={styles.timingDivider} />

            <View style={styles.timingItem}>
              <View style={[styles.timingIconWrap, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="log-out-outline" size={16} color="#3B5BB5" />
              </View>
              <View>
                <Text style={styles.timingLabel}>Last Visit</Text>
                <Text style={styles.timingValue}>{summaryMetrics.lastVisitTime}</Text>
              </View>
            </View>

            <View style={styles.timingDivider} />

            <View style={styles.timingItem}>
              <View style={[styles.timingIconWrap, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="time-outline" size={16} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.timingLabel}>Total Time</Text>
                <Text style={[styles.timingValue, { color: "#EA580C", fontWeight: "800" }]}>
                  {summaryMetrics.totalTimeSpentInVisits}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filter Chips Bar */}
        <View style={styles.filterWrapper}>
          <Text style={styles.filterTitle}>Filter:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            {[
              { key: "All", label: `All (${summaryMetrics.totalVisitsCount})` },
              {
                key: "Productive",
                label: `Productive (${summaryMetrics.productiveCount})`,
              },
              {
                key: "Non-Productive",
                label: `Non-Productive (${summaryMetrics.nonProductiveCount})`,
              },
              {
                key: "Pending",
                label: `Pending (${summaryMetrics.missedCount})`,
              },
              ...(!isEndDayCompleted && summaryMetrics.notVisitedCount > 0
                ? [
                    {
                      key: "Not Visited",
                      label: `Not Visited (${summaryMetrics.notVisitedCount})`,
                    },
                  ]
                : []),
            ].map((chip) => {
              const isActive = activeFilter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}
                  onPress={() => setActiveFilter(chip.key as any)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#C9A24D" />

      {/* Header */}
      <LinearGradient
        colors={Gradients.primary || ["#C9A24D", "#A67C2E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 14), paddingBottom: 14 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.replace("TabbedScreen")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visit Summary</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C9A24D" />
          <Text style={styles.loadingText}>Fetching Visit Summary...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredVisits()}
          keyExtractor={(item) => item.id}
          renderItem={renderVisitCard}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={54} color="#ccc" />
              <Text style={styles.emptyText}>
                {activeFilter === "All"
                  ? "No visits found for today."
                  : `No ${activeFilter} visits found.`}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default VisitListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  summarySectionWrapper: {
    marginBottom: 8,
  },
  summaryContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginVertical: 12,
    shadowColor: "rgba(0, 0, 0, 0.05)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  kpiGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FBF8F1",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  kpiCardActiveAll: {
    borderColor: "#1F1D1A",
    backgroundColor: "#F1EADB",
  },
  kpiCardActiveProductive: {
    borderColor: "#2E7D5B",
    backgroundColor: "#E3F1EA",
  },
  kpiCardActiveNonProductive: {
    borderColor: "#D08C1F",
    backgroundColor: "#FBEFD8",
  },
  kpiCardActiveMissed: {
    borderColor: "#B3261E",
    backgroundColor: "#FEE2E2",
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#7A7266",
    textAlign: "center",
  },
  timingsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FBF8F1",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  timingItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timingIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  timingLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#7A7266",
  },
  timingValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 1,
  },
  timingDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#D9D2C3",
    marginHorizontal: 4,
  },
  filterWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: "rgba(0, 0, 0, 0.04)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    marginRight: 8,
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  filterChip: {
    backgroundColor: "#F1EADB",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  filterChipActive: {
    backgroundColor: "#C9A24D",
    borderColor: "#C9A24D",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A7266",
  },
  filterChipTextActive: {
    color: "#FFF",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "rgba(0, 0, 0, 0.03)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  accountName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1F1D1A",
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeProductive: {
    backgroundColor: "#E3F1EA",
  },
  badgeNonProductive: {
    backgroundColor: "#FBEFD8",
  },
  badgeMissed: {
    backgroundColor: "#FEE2E2",
  },
  badgeNotVisited: {
    backgroundColor: "#F1EADB",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  badgeTextProductive: {
    color: "#166534",
  },
  badgeTextNonProductive: {
    color: "#92400E",
  },
  badgeTextMissed: {
    color: "#B3261E",
  },
  badgeTextNotVisited: {
    color: "#7A7266",
  },
  centerContainer: {
    flex: 0.7,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: "#7A7266",
    fontWeight: "500",
  },
  typeHighlight: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  typeDistributor: {
    backgroundColor: "#EFF6FF",
  },
  typeRetailer: {
    backgroundColor: "#F1EADB",
  },
  typeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  typeTextDistributor: {
    color: "#1E3A8A",
  },
  typeTextRetailer: {
    color: "#1F1D1A",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeftCol: {
    flex: 1.3,
    paddingRight: 8,
  },
  cardRightCol: {
    flex: 0.7,
    alignItems: "flex-end",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  classHighlight: {
    backgroundColor: "#F1EADB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  classText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A7266",
  },
  timeText: {
    fontSize: 12,
    color: "#7A7266",
    fontWeight: "500",
    marginTop: 2,
  },
  notVisitedText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
  },
  telephonyOrderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderColor: "#E3F1EA",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  telephonyOrderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  telephonyOrderIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E3F1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  telephonyOrderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  telephonyOrderPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#86EFAC",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 3,
  },
  telephonyOrderPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D",
  },
});
