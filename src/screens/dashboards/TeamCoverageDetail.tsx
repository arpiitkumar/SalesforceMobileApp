import React, { FC, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  StatusBar,
  SafeAreaView,
  FlatList,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import moment from "moment";
import Ionicons from "../../components/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

// Helper to normalize category strictly to "Distributor" or "Retailer"
export const normalizeCategoryBadge = (typeOrChannel?: string, name?: string): "Distributor" | "Retailer" => {
  const str = `${typeOrChannel || ""} ${name || ""}`.toUpperCase();
  if (
    str.includes("WHOLESALE") ||
    str.includes("DISTRIBUT") ||
    str.includes("DIST.") ||
    str.includes("STOCKIST") ||
    str.includes("DB") ||
    str.includes("AGENC") ||
    str.includes("HUB") ||
    str.includes("SUPER STOCKIST")
  ) {
    return "Distributor";
  }
  return "Retailer";
};

// Helper to format ISO or raw dates cleanly
const formatVisitDate = (dateVal?: string): string => {
  if (!dateVal) return "--";
  const m = moment(dateVal);
  return m.isValid() ? m.format("DD-MM-YYYY") : String(dateVal);
};

// Helper to format timestamps to readable time (e.g. 11:35 AM)
const formatCheckInTime = (timeVal?: string): string => {
  if (!timeVal) return "--:--";
  // If ISO string containing 'T' or standard date-time format
  if (timeVal.includes("T") || timeVal.includes("-")) {
    const m = moment(timeVal);
    if (m.isValid()) {
      return m.format("hh:mm A");
    }
  }
  // If already like "11:35:50" or similar
  if (timeVal.includes(":")) {
    const parts = timeVal.trim().split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parts[1];
      if (!isNaN(h)) {
        const ampm = h >= 12 ? "PM" : "AM";
        const formattedHour = h % 12 || 12;
        return `${formattedHour < 10 ? "0" : ""}${formattedHour}:${m} ${ampm}`;
      }
    }
  }
  return timeVal;
};

const TeamCoverageDetail: FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const {
    mode = "employee_wise",
    title = "Coverage Details",
    selectedPersona = "All",
    selectedEmployee = "All",
    selectedMonth = moment().format("YYYY-MM"),
    employeePerformanceData = [],
    beatPerformanceData = [],
    shopOutletPerformanceData = [],
    salesmanAssignedOutletsData = [],
    uniquePcPerformanceData = [],
    uniqueTcPerformanceData = [],
    rawEmployees = [],
    rawDistributors = [],
    rawOutlets = [],
    rawVisits = [],
    rawOrders = [],
  } = route.params || {};

  const [searchQuery, setSearchQuery] = useState("");

  // Direct Phone Call handler
  const handleCall = (phoneNumber?: string, name?: string) => {
    if (!phoneNumber || String(phoneNumber).trim().length < 5) {
      Alert.alert("No Phone Number", `Phone number is not available for ${name || "this outlet"}.`);
      return;
    }
    const cleanNumber = String(phoneNumber).replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanNumber}`).catch((err) => {
      console.error("Failed to make phone call:", err);
      Alert.alert("Call Failed", "Unable to open phone dialer on this device.");
    });
  };

  // 1. Employee-wise Data (Using Salesforce SOQL Employee Performance Query results)
  const employeeDataList = useMemo(() => {
    if (employeePerformanceData && employeePerformanceData.length > 0) {
      return employeePerformanceData.map((emp: any, index: number) => {
        const planned = Number(emp.PlannedOutlets || 0);
        const uniqueVisited = Number(emp.UniqueOutletsVisited_TC || 0);
        const tc = Number(emp.TotalCalls_TC || 0);
        const pc = Number(emp.ProductiveCalls_PC || 0);
        const nonProd = Number(emp.NonProductiveCalls || (tc - pc));
        const totalWorkingDays = Number(emp.TotalWorkingDays || 1);
        const coveragePercent = planned > 0 ? Math.min(100, Math.round((uniqueVisited / planned) * 100)) : 0;
        const strikeRate = tc > 0 ? Math.min(100, Math.round((pc / tc) * 100)) : 0;

        const matchedEmp = (rawEmployees || []).find((r: any) => r.Name === emp.SalesRepName);
        return {
          id: `emp_soql_${emp.SalesRepName || index}_${index}`,
          name: emp.SalesRepName || "--",
          role: matchedEmp?.Role || "--",
          phone: matchedEmp?.Phone || "",
          plannedOutlets: planned,
          uniqueVisited,
          tc,
          pc,
          nonProd,
          totalWorkingDays,
          coveragePercent,
          strikeRate,
        };
      });
    }

    if (rawEmployees && rawEmployees.length > 0) {
      return rawEmployees.map((emp: any, index: number) => {
        const planned = (rawOutlets || []).filter((o: any) => o.OwnerId === emp.Sf_Id).length;
        const empVisits = (rawVisits || []).filter(
          (v: any) => v.CreatedById === emp.Sf_Id || v.BeatDay__r?.Route_Plans__r?.Assigned_To__c === emp.Sf_Id
        );
        const uniqueVisited = empVisits.length;
        const pc = empVisits.filter((v: any) => v.ProductiveCall__c).length;
        const tc = uniqueVisited;
        const nonProd = Math.max(0, tc - pc);
        const coveragePercent = planned > 0 ? Math.min(100, Math.round((uniqueVisited / planned) * 100)) : 0;
        const strikeRate = tc > 0 ? Math.min(100, Math.round((pc / tc) * 100)) : 0;

        return {
          id: `emp_local_${emp.Sf_Id || index}_${index}`,
          name: emp.Name || "--",
          role: emp.Role || "--",
          phone: emp.Phone || "",
          plannedOutlets: planned,
          uniqueVisited,
          tc,
          pc,
          nonProd,
          totalWorkingDays: 0,
          coveragePercent,
          strikeRate,
        };
      });
    }

    return [];
  }, [employeePerformanceData, rawEmployees, rawOutlets, rawVisits]);

  // 2. Beat-wise Data (Using Salesforce SOQL Beat Performance Query results)
  const beatDataList = useMemo(() => {
    if (beatPerformanceData && beatPerformanceData.length > 0) {
      return beatPerformanceData.map((b: any, index: number) => {
        const planned = Number(b.PlannedOutlets || 0);
        const visited = Number(b.VisitedOutlets_UniqueTC || 0);
        const tc = Number(b.TotalCalls_TC || 0);
        const pc = Number(b.ProductiveCalls_PC || 0);
        const coveragePercent = planned > 0 ? Math.min(100, Math.round((visited / planned) * 100)) : 0;
        const strikeRate = tc > 0 ? Math.min(100, Math.round((pc / tc) * 100)) : 0;

        return {
          id: `beat_soql_${b.BeatName || "unassigned"}_${b.DistributorName || "none"}_${index}`,
          name: b.BeatName || "--",
          distributor: b.DistributorName || "--",
          salesman: b.SalesRepName || "--",
          plannedOutlets: planned,
          visited,
          tc,
          pc,
          coveragePercent,
          strikeRate,
        };
      });
    }

    return [];
  }, [beatPerformanceData]);

  // 3. Shop/Outlet-wise Performance Data (Using Salesforce SOQL Shop-wise Query results)
  const shopPerformanceList = useMemo(() => {
    if (shopOutletPerformanceData && shopOutletPerformanceData.length > 0) {
      return shopOutletPerformanceData.map((shop: any, index: number) => {
        const outletId = shop.OutletId || `shop_${index}`;
        const category = normalizeCategoryBadge(shop.OutletType || shop.Channel, shop.OutletName);
        return {
          id: `shop_${outletId}_${index}`,
          name: shop.OutletName || "--",
          code: shop.PartyCode || "--",
          phone: shop.OutletPhone || "",
          outletType: category,
          channel: category,
          category: category,
          beat: shop.BeatName || "--",
          salesman: shop.SalesRepName || "--",
          totalVisits: Number(shop.TotalVisits || 0),
          lastVisitDate: formatVisitDate(shop.LastVisitDate),
          lastCheckInTime: formatCheckInTime(shop.LastCheckInTime),
        };
      });
    }

    if (rawOutlets && rawOutlets.length > 0) {
      return rawOutlets.map((o: any, index: number) => {
        const category = normalizeCategoryBadge(o.Class__c || o.Channel__c || o.Type, o.Name);
        const matchedEmp = (rawEmployees || []).find((r: any) => r.Sf_Id === o.OwnerId);
        return {
          id: `shop_local_${o.Sf_Id || index}_${index}`,
          name: o.Name || "--",
          code: o.Party_Code__c || "--",
          phone: o.Phone || "",
          outletType: category,
          channel: category,
          category: category,
          beat: "--",
          salesman: matchedEmp?.Name || "--",
          totalVisits: 0,
          lastVisitDate: "--",
          lastCheckInTime: "--",
        };
      });
    }

    return [];
  }, [shopOutletPerformanceData, rawOutlets, rawEmployees]);

  // 4. Salesman-wise Assigned Outlets (Using Salesforce SOQL Assigned Outlets Query)
  const salesmanAssignedList = useMemo(() => {
    if (salesmanAssignedOutletsData && salesmanAssignedOutletsData.length > 0) {
      return salesmanAssignedOutletsData.map((item: any, index: number) => {
        const category = normalizeCategoryBadge(item.OutletType || item.Channel, item.OutletName);
        return {
          id: `assigned_soql_${item.OutletId || index}_${index}`,
          name: item.OutletName || "--",
          code: item.PartyCode || "--",
          phone: item.OutletPhone || "",
          category,
          beat: item.BeatName || "--",
          distributor: item.DistributorName || "--",
          salesman: item.SalesRepresentative || "--",
          role: item.SalesRepRole || "--",
          manager: item.ReportingManager || "--",
          totalVisits: Number(item.TotalVisitsCount || 0),
          lastVisitDate: formatVisitDate(item.LastVisitDate),
          lastCheckInTime: formatCheckInTime(item.LastCheckInTime),
          avgDuration: item.AvgTimeSpentMins ? `${Math.round(Number(item.AvgTimeSpentMins))} mins` : "--",
        };
      });
    }

    if (employeeDataList && employeeDataList.length > 0) {
      return employeeDataList.map((emp: any, index: number) => {
        const visited = emp.uniqueVisited;
        const pending = Math.max(0, emp.plannedOutlets - visited);
        return {
          id: `assigned_${emp.id}_${index}`,
          name: emp.name,
          role: emp.role,
          assigned: emp.plannedOutlets,
          visited,
          pending,
          coveragePercent: emp.coveragePercent,
          workingDays: emp.totalWorkingDays,
        };
      });
    }

    return [];
  }, [salesmanAssignedOutletsData, employeeDataList]);

  // 5. Unique TC Data List (Salesman-wise from SOQL Unique TC Query)
  const uniqueTcList = useMemo(() => {
    if (uniqueTcPerformanceData && uniqueTcPerformanceData.length > 0) {
      return uniqueTcPerformanceData.map((tc: any, i: number) => {
        const empName = tc.SalesmanName || "--";
        const matchedEmp = (rawEmployees || []).find(
          (r: any) =>
            r.Name?.toLowerCase() === empName?.toLowerCase() ||
            (tc.CreatedById && r.Sf_Id === tc.CreatedById)
        );
        let role = tc.UserType || tc.Role || matchedEmp?.Role || matchedEmp?.User_Type__c;
        if (!role || role === "--" || role === "Field Representative" || role === "Sales Rep") {
          const parts = empName.trim().split(" ");
          const lastPart = parts[parts.length - 1]?.toUpperCase();
          if (["ISR", "DSM", "SO", "ASE", "ASM", "RSM", "AGM", "GM", "VP"].includes(lastPart)) {
            role = lastPart;
          } else {
            role = "ISR";
          }
        }

        return {
          id: `tc_salesman_${empName}_${i}`,
          name: empName,
          salesman: empName,
          uniqueVisited: Number(tc.UniqueOutletsVisited_TC || 0),
          totalVisits: Number(tc.TotalVisitsCount || 0),
          role: role,
        };
      });
    }

    if (shopOutletPerformanceData && shopOutletPerformanceData.length > 0) {
      return shopOutletPerformanceData.map((shop: any, i: number) => {
        const category = normalizeCategoryBadge(shop.OutletType || shop.Channel, shop.OutletName);
        return {
          id: `tc_soql_${shop.OutletId || i}_${i}`,
          name: shop.OutletName || "--",
          channel: category,
          category: category,
          ownerName: "--",
          phone: shop.OutletPhone || "",
          address: shop.BeatName || "--",
          checkInTime: formatCheckInTime(shop.LastCheckInTime),
          salesman: shop.SalesRepName || "--",
          status: "Visited",
        };
      });
    }

    if (rawOutlets && rawOutlets.length > 0) {
      return rawOutlets.map((o: any, i: number) => {
        const category = normalizeCategoryBadge(o.Channel__c || o.Class__c || o.Type, o.Name);
        const matchedEmp = (rawEmployees || []).find((r: any) => r.Sf_Id === o.OwnerId);
        return {
          id: `tc_local_${o.Sf_Id || i}_${i}`,
          name: o.Name || "--",
          channel: category,
          category: category,
          ownerName: o.Outlet_Owner_Name__c || "--",
          phone: o.Phone || "",
          address: o.BillingAddress || o.BillingCity || "--",
          checkInTime: "--",
          salesman: matchedEmp?.Name || "--",
          status: "Visited",
        };
      });
    }

    return [];
  }, [uniqueTcPerformanceData, shopOutletPerformanceData, rawOutlets, rawEmployees]);

  // 6. Unique PC Data List (Using SOQL Unique PC Query)
  const uniquePcList = useMemo(() => {
    if (uniquePcPerformanceData && uniquePcPerformanceData.length > 0) {
      return uniquePcPerformanceData.map((pc: any, i: number) => {
        const empName = pc.SalesmanName || pc.SalesRepName || pc.Name || "--";
        const matchedEmp = (rawEmployees || []).find((r: any) => r.Name?.toLowerCase() === empName?.toLowerCase());
        const managerName = pc.ManagerName || matchedEmp?.ManagerName || (matchedEmp?.ManagerId ? (rawEmployees || []).find((r: any) => r.Sf_Id === matchedEmp.ManagerId)?.Name : "--") || "--";
        let role = pc.UserType || pc.Role || matchedEmp?.Role || matchedEmp?.User_Type__c;
        if (!role || role === "--" || role === "Field Representative" || role === "Sales Rep") {
          const parts = empName.trim().split(" ");
          const lastPart = parts[parts.length - 1]?.toUpperCase();
          if (["ISR", "DSM", "SO", "ASE", "ASM", "RSM", "AGM", "GM", "VP"].includes(lastPart)) {
            role = lastPart;
          } else {
            role = "ISR";
          }
        }

        return {
          id: `pc_rep_${empName}_${i}`,
          name: empName,
          salesman: empName,
          role: role,
          manager: managerName,
          isProductive: pc.IsProductive,
          uniqueOutlets: Number(pc.UniqueOutlets_PC || pc.UniqueOutletsCount || 0),
          totalCalls: Number(pc.TotalCalls_PC || pc.TotalCallsCount || 0),
        };
      });
    }

    return [];
  }, [uniquePcPerformanceData, rawEmployees]);

  // 7. Direct Outlet Calling Directory (Using Salesforce SOQL Shop-wise Query results)
  const outletCallingList = useMemo(() => {
    if (shopOutletPerformanceData && shopOutletPerformanceData.length > 0) {
      return shopOutletPerformanceData.map((shop: any, i: number) => {
        const category = normalizeCategoryBadge(shop.OutletType || shop.Channel, shop.OutletName);
        return {
          id: `call_soql_${shop.OutletId || i}_${i}`,
          name: shop.OutletName || "--",
          channel: category,
          category: category,
          ownerName: shop.SalesRepName || "--",
          phone: shop.OutletPhone || "",
          address: shop.BeatName || "--",
          partyCode: shop.PartyCode || "--",
          lastVisited: formatVisitDate(shop.LastVisitDate),
          lastCheckIn: formatCheckInTime(shop.LastCheckInTime),
        };
      });
    }

    if (rawOutlets && rawOutlets.length > 0) {
      return rawOutlets.map((o: any, i: number) => {
        const category = normalizeCategoryBadge(o.Channel__c || o.Class__c || o.Type, o.Name);
        return {
          id: `call_local_${o.Sf_Id || i}_${i}`,
          name: o.Name || "--",
          channel: category,
          category: category,
          ownerName: o.Outlet_Owner_Name__c || "--",
          phone: o.Phone || "",
          address: o.BillingAddress || o.BillingStreet || o.BillingCity || "--",
          partyCode: o.Party_Code__c || "--",
          lastVisited: "--",
          lastCheckIn: "--",
        };
      });
    }

    return [];
  }, [shopOutletPerformanceData, rawOutlets]);

  // Render Card Item based on active mode
  const renderItem = ({ item }: { item: any }) => {
    switch (mode) {
      case "employee_wise":
        return (
          <View style={styles.detailCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.avatarWrap}>
                <MaterialCommunityIcons name="account-tie" size={24} color="#3B5BB5" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <View style={styles.roleBadgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{item.totalWorkingDays} Working Days</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Stats Breakdown Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxVal}>{item.plannedOutlets}</Text>
                <Text style={styles.statBoxLbl}>Planned</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#2E7D5B" }]}>{item.uniqueVisited}</Text>
                <Text style={styles.statBoxLbl}>Unique TC</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#3B5BB5" }]}>{item.tc}</Text>
                <Text style={styles.statBoxLbl}>Total Visits</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#43A047" }]}>{item.pc}</Text>
                <Text style={styles.statBoxLbl}>Productive</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#B3261E" }]}>{item.nonProd}</Text>
                <Text style={styles.statBoxLbl}>Non-Prod</Text>
              </View>
            </View>
          </View>
        );

      case "beat_wise":
        return (
          <View style={styles.detailCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatarWrap, { backgroundColor: "#E3F1EA" }]}>
                <MaterialCommunityIcons name="map-marker-path" size={24} color="#43A047" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSubText}>Distributor: {item.distributor}</Text>
                <Text style={styles.salesmanText}>Sales Rep: {item.salesman}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxVal}>{item.plannedOutlets}</Text>
                <Text style={styles.statBoxLbl}>Planned OL</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#2E7D5B" }]}>{item.visited}</Text>
                <Text style={styles.statBoxLbl}>Unique TC</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#3B5BB5" }]}>{item.tc}</Text>
                <Text style={styles.statBoxLbl}>Total Visit</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#43A047" }]}>{item.pc}</Text>
                <Text style={styles.statBoxLbl}>Productive Visits</Text>
              </View>
            </View>
          </View>
        );

      case "shop_distributor_review":
        return (
          <View style={styles.detailCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatarWrap, { backgroundColor: "#FBEFD8" }]}>
                <MaterialCommunityIcons name="storefront-outline" size={24} color="#FB8C00" />
              </View>
              <View style={{ flex: 1, marginLeft: 10, paddingRight: 4 }}>
                <View style={styles.outletHeaderRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.visitsBadge}>
                    <Text style={styles.visitsBadgeText}>{item.totalVisits} Visits</Text>
                  </View>
                </View>
                <Text style={styles.itemSubText} numberOfLines={1}>
                  Code: {item.code} • {item.category}
                </Text>
                <Text style={styles.salesmanText} numberOfLines={1}>
                  Beat: {item.beat} • Rep: {item.salesman}
                </Text>
              </View>
              {item.phone ? (
                <TouchableOpacity
                  style={[styles.callButtonSmall, { backgroundColor: "#FB8C00" }]}
                  onPress={() => handleCall(item.phone, item.name)}
                >
                  <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Clean Footer Strip with Date & Formatted Time */}
            <View style={styles.cardFooterStrip}>
              <View style={styles.footerInfoItem}>
                <MaterialCommunityIcons name="calendar-check" size={15} color="#7A7266" />
                <Text style={styles.footerInfoText}>Last Visited: {item.lastVisitDate}</Text>
              </View>
              <View style={styles.footerInfoItem}>
                <MaterialCommunityIcons name="clock-time-four-outline" size={15} color="#7A7266" />
                <Text style={styles.footerInfoText}>Check-in: {item.lastCheckInTime}</Text>
              </View>
            </View>
          </View>
        );

      case "salesman_assigned_outlets":
        if (item.salesman) {
          return (
            <View style={styles.detailCard}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarWrap, { backgroundColor: "#F3E5F5" }]}>
                  <MaterialCommunityIcons name="card-account-details-outline" size={24} color="#8E24AA" />
                </View>
                <View style={{ flex: 1, marginLeft: 10, paddingRight: 4 }}>
                  <View style={styles.outletHeaderRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.categoryBadge,
                        item.category === "Distributor" ? styles.distributorBadge : styles.retailerBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          item.category === "Distributor" ? styles.distributorBadgeText : styles.retailerBadgeText,
                        ]}
                      >
                        {item.category}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.itemSubText} numberOfLines={1}>
                    Code: {item.code} • Beat: {item.beat}
                  </Text>
                  <Text style={styles.salesmanText} numberOfLines={1}>
                    Distributor: {item.distributor}
                  </Text>
                </View>
                {item.phone ? (
                  <TouchableOpacity
                    style={[styles.callButtonSmall, { backgroundColor: "#8E24AA" }]}
                    onPress={() => handleCall(item.phone, item.name)}
                  >
                    <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Rep & Manager Strip */}
              <View style={styles.roleBadgeRow}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>Representative: {item.salesman} ({item.role})</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: "#F3E5F5" }]}>
                  <Text style={[styles.statusPillText, { color: "#8E24AA" }]}>
                    Manager: {item.manager}
                  </Text>
                </View>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#8E24AA" }]}>{item.totalVisits}</Text>
                  <Text style={styles.statBoxLbl}>Total Visits</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#2E7D5B" }]}>{item.lastVisitDate}</Text>
                  <Text style={styles.statBoxLbl}>Last Visited</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#3B5BB5" }]}>{item.avgDuration}</Text>
                  <Text style={styles.statBoxLbl}>Avg Time</Text>
                </View>
              </View>
            </View>
          );
        }

        return (
          <View style={styles.detailCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatarWrap, { backgroundColor: "#F3E5F5" }]}>
                <MaterialCommunityIcons name="card-account-details-outline" size={24} color="#8E24AA" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSubText}>
                  {item.workingDays} Working Days Recorded
                </Text>
              </View>
              <View style={[styles.percentPill, { backgroundColor: "#F3E5F5" }]}>
                <Text style={[styles.percentPillText, { color: "#8E24AA" }]}>{item.coveragePercent}%</Text>
              </View>
            </View>

            <View style={styles.cardProgressBarBg}>
              <View style={[styles.cardProgressBarFill, { width: `${item.coveragePercent}%`, backgroundColor: "#8E24AA" }]} />
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxVal}>{item.assigned}</Text>
                <Text style={styles.statBoxLbl}>Total Assigned</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#2E7D5B" }]}>{item.visited}</Text>
                <Text style={styles.statBoxLbl}>Completed</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxVal, { color: "#D32F2F" }]}>{item.pending}</Text>
                <Text style={styles.statBoxLbl}>Pending</Text>
              </View>
            </View>
          </View>
        );

      case "unique_tc":
        // Check if item is from Salesman-wise Unique TC Query
        if (item.uniqueVisited !== undefined) {
          return (
            <View style={styles.detailCard}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarWrap, { backgroundColor: "#E3F1EA" }]}>
                  <MaterialCommunityIcons name="account-tie" size={24} color="#2E7D5B" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemSubText}>Role: {item.role || "Sales Rep"}</Text>
                </View>
                <View style={[styles.percentPill, { backgroundColor: "#E3F1EA" }]}>
                  <Text style={[styles.percentPillText, { color: "#2E7D5B" }]}>
                    {item.uniqueVisited} Outlets
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#2E7D5B" }]}>{item.uniqueVisited}</Text>
                  <Text style={styles.statBoxLbl}>Unique Total Visit</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#3B5BB5" }]}>{item.totalVisits}</Text>
                  <Text style={styles.statBoxLbl}>Total Visits</Text>
                </View>
              </View>
            </View>
          );
        }

        return (
          <View style={styles.detailCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatarWrap, { backgroundColor: "#E3F1EA" }]}>
                <MaterialCommunityIcons name="store-check-outline" size={24} color="#2E7D5B" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSubText}>{item.category} • Owner: {item.ownerName}</Text>
                <Text style={styles.locationText}>{item.address}</Text>
              </View>
              <TouchableOpacity
                style={[styles.callButtonSmall, { backgroundColor: "#2E7D5B" }]}
                onPress={() => handleCall(item.phone, item.name)}
              >
                <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.cardFooterStrip}>
              <View style={styles.footerInfoItem}>
                <MaterialCommunityIcons name="clock-outline" size={15} color="#7A7266" />
                <Text style={styles.footerInfoText}>Visited: {item.checkInTime}</Text>
              </View>
              <View style={styles.footerInfoItem}>
                <MaterialCommunityIcons name="account-outline" size={15} color="#7A7266" />
                <Text style={styles.footerInfoText}>{item.salesman}</Text>
              </View>
            </View>
          </View>
        );

      case "unique_pc":
        // Check if item is from Unique PC Query
        if (item.uniqueOutlets !== undefined) {
          return (
            <View style={styles.detailCard}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarWrap, { backgroundColor: "#E3F1EA" }]}>
                  <MaterialCommunityIcons
                    name="cart-check"
                    size={24}
                    color="#43A047"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                </View>
                <View style={[styles.percentPill, { backgroundColor: "#E3F1EA" }]}>
                  <Text style={[styles.percentPillText, { color: "#43A047" }]}>
                    {item.uniqueOutlets} Outlets
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#43A047" }]}>
                    {item.uniqueOutlets}
                  </Text>
                  <Text style={styles.statBoxLbl}>Unique Productive Visit</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxVal, { color: "#3B5BB5" }]}>{item.totalCalls}</Text>
                  <Text style={styles.statBoxLbl}>Productive Visits</Text>
                </View>
              </View>
            </View>
          );
        }

        return (
          <View style={styles.detailCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatarWrap, { backgroundColor: "#F9E5E3" }]}>
                <MaterialCommunityIcons name="cart-check" size={24} color="#B3261E" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemSubText}>{item.category} • Owner: {item.ownerName}</Text>
                <Text style={styles.locationText}>{item.address}</Text>
              </View>
              <TouchableOpacity
                style={[styles.callButtonSmall, { backgroundColor: "#B3261E" }]}
                onPress={() => handleCall(item.phone, item.name)}
              >
                <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={[styles.cardFooterStrip, { backgroundColor: "#FFF5F5" }]}>
              <View style={styles.footerInfoItem}>
                <MaterialCommunityIcons name="cash" size={15} color="#B3261E" />
                <Text style={[styles.footerInfoText, { fontWeight: "800", color: "#B71C1C" }]}>
                  ₹{item.orderAmount} ({item.itemsCount} Items)
                </Text>
              </View>
              <View style={styles.footerInfoItem}>
                <MaterialCommunityIcons name="account-outline" size={15} color="#7A7266" />
                <Text style={styles.footerInfoText}>{item.salesman}</Text>
              </View>
            </View>
          </View>
        );

      case "direct_outlet_calling":
      default:
        return (
          <View style={styles.callingCard}>
            <View style={styles.cardTopRow}>
              <View style={[styles.avatarWrap, { backgroundColor: "#E8EAF6" }]}>
                <MaterialCommunityIcons name="storefront-outline" size={24} color="#3949AB" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={styles.outletHeaderRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View
                    style={[
                      styles.categoryBadge,
                      item.category === "Distributor" ? styles.distributorBadge : styles.retailerBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        item.category === "Distributor" ? styles.distributorBadgeText : styles.retailerBadgeText,
                      ]}
                    >
                      {item.category}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemSubText}>
                  Code: {item.partyCode} • Beat: {item.address}
                </Text>
                <Text style={styles.salesmanText}>
                  Rep: {item.ownerName} • Last Visited: {item.lastVisited} ({item.lastCheckIn})
                </Text>
              </View>
            </View>

            <View style={styles.callingActionRow}>
              <View style={styles.phoneDisplay}>
                <MaterialCommunityIcons name="phone-classic" size={16} color="#7A7266" />
                <Text style={styles.phoneText}>{item.phone || "No Phone Contact"}</Text>
              </View>
              <TouchableOpacity
                style={styles.directCallBtn}
                activeOpacity={0.8}
                onPress={() => handleCall(item.phone, item.name)}
              >
                <MaterialCommunityIcons name="phone" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.directCallBtnText}>Call Outlet</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  // Get active dataset
  const activeDataset = useMemo(() => {
    let list: any[] = [];
    switch (mode) {
      case "employee_wise":
        list = employeeDataList;
        break;
      case "beat_wise":
        list = beatDataList;
        break;
      case "shop_distributor_review":
        list = shopPerformanceList;
        break;
      case "salesman_assigned_outlets":
        list = salesmanAssignedList;
        break;
      case "unique_tc":
        list = uniqueTcList;
        break;
      case "unique_pc":
        list = uniquePcList;
        break;
      case "direct_outlet_calling":
      default:
        list = outletCallingList;
        break;
    }

    if (selectedEmployee && selectedEmployee !== "All") {
      const selectedEmpObj = rawEmployees.find((e: any) => e.Sf_Id === selectedEmployee);
      const empName = selectedEmpObj?.Name?.toLowerCase();
      if (empName) {
        list = list.filter((item: any) => {
          const iName = (item.name || "").toLowerCase();
          const iSalesman = (item.salesman || "").toLowerCase();
          return iName.includes(empName) || iSalesman.includes(empName) || item.id.includes(selectedEmployee);
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((item: any) => {
        return (
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.phone && item.phone.toLowerCase().includes(q)) ||
          (item.code && item.code.toLowerCase().includes(q)) ||
          (item.distributor && item.distributor.toLowerCase().includes(q)) ||
          (item.salesman && item.salesman.toLowerCase().includes(q)) ||
          (item.address && item.address.toLowerCase().includes(q)) ||
          (item.beat && item.beat.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [
    mode,
    employeeDataList,
    beatDataList,
    shopPerformanceList,
    salesmanAssignedList,
    uniqueTcList,
    uniquePcList,
    outletCallingList,
    selectedEmployee,
    rawEmployees,
    searchQuery,
  ]);

  const searchPlaceholder = useMemo(() => {
    switch (mode) {
      case "employee_wise":
      case "beat_wise":
        return "Search by Name";
      case "shop_distributor_review":
        return "Search by Name, Code";
      case "salesman_assigned_outlets":
        return "Search by outlet, beat";
      case "unique_tc":
      case "unique_pc":
        return "Search by Name";
      case "direct_outlet_calling":
      case "outlet_calling":
        return "Search by Name, phone";
      default:
        return "Search by Name";
    }
  }, [mode]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />

      {/* Header */}
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
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle}>
              {activeDataset.length} Records • {selectedMonth}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#7A7266" style={{ marginRight: 8 }} />
          <TextInput
            placeholder={searchPlaceholder}
            placeholderTextColor="#7A7266"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close" size={18} color="#7A7266" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content List */}
      <FlatList
        data={activeDataset}
        renderItem={renderItem}
        keyExtractor={(item, index) => (item.id ? String(item.id) : `row_${index}`)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="folder-open-outline" size={54} color="#D9D2C3" />
            <Text style={styles.emptyTitle}>No Records Available</Text>
            <Text style={styles.emptySubText}>
              Try adjusting your search query or role filter.
            </Text>
          </View>
        }
      />
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
    padding: 6,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#FFCDD2",
    fontWeight: "600",
    marginTop: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1F1D1A",
    padding: 0,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  callingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  itemSubText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A7266",
    marginTop: 2,
  },
  locationText: {
    fontSize: 10,
    color: "#7A7266",
    fontWeight: "500",
    marginTop: 2,
  },
  salesmanText: {
    fontSize: 10,
    color: "#7A7266",
    fontWeight: "600",
    marginTop: 2,
  },
  roleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: "#F1EADB",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  callButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2E7D5B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  percentPill: {
    backgroundColor: "#E3F1EA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2E7D5B",
  },
  visitsBadge: {
    backgroundColor: "#FBEFD8",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  visitsBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#E65100",
  },
  cardProgressBarBg: {
    height: 6,
    backgroundColor: "#F1EADB",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 12,
    marginBottom: 6,
  },
  cardProgressBarFill: {
    height: "100%",
    backgroundColor: "#43A047",
    borderRadius: 3,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statBoxVal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1F1D1A",
  },
  statBoxLbl: {
    fontSize: 8,
    fontWeight: "700",
    color: "#7A7266",
    marginTop: 2,
    textTransform: "uppercase",
  },
  cardFooterStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  footerInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerInfoText: {
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "600",
    marginLeft: 6,
  },
  outletHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  retailerBadge: {
    backgroundColor: "#EEF2FF",
  },
  retailerBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#4338CA",
  },
  distributorBadge: {
    backgroundColor: "#FBEFD8",
  },
  distributorBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#D08C1F",
  },
  callingActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1EADB",
  },
  phoneDisplay: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F1D1A",
    marginLeft: 6,
  },
  directCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D5B",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: "#2E7D5B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  directCallBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F1D1A",
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 12,
    color: "#7A7266",
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
});

export default TeamCoverageDetail;
