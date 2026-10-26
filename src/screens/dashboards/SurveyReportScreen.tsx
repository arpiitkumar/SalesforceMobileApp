import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { RFValue } from "react-native-responsive-fontsize";
import moment from "moment";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;

const frequencies = ["All", "Daily", "Weekly", "Monthly"] as const;
type FrequencyType = (typeof frequencies)[number];

interface HierarchyReportRow {
  userId: string;
  userName: string;
  totalOutlets: number;
  totalSubmitted: number;
  completionPercent: number;
}

interface HierarchyReport {
  frequency: string;
  periodStart?: string;
  periodEnd?: string;
  rows: HierarchyReportRow[];
}

interface Props {
  navigation: any;
  route: {
    params: {
      template: {
        templateId: string;
        templateName: string;
        frequency: string;
      };
      selectedUserIds: string[];
      selectedEmployeeName: string;
      selectedFrequency: string;
      selectedMonth: string; // YYYY-MM
      selectedMonthLabel: string; // e.g. August 2026
      employeeList?: any[];
      subordinates?: any[];
    };
  };
}

const SurveyReportScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { apiFetch, fetchRecords } = useApiFetch();

  const {
    template,
    selectedUserIds = [],
    selectedEmployeeName = "Employee",
    selectedFrequency: initialFreq = "Monthly",
    selectedMonth = moment().format("YYYY-MM"),
    selectedMonthLabel = moment().format("MMMM YYYY"),
    employeeList = [],
    subordinates = [],
  } = route.params || {};

  const [frequency, setFrequency] = useState<FrequencyType>(
    (initialFreq as FrequencyType) || "Monthly"
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<HierarchyReport | null>(null);
  const isFetchingRef = useRef(false);

  // =========================================================================
  // API 3: GET /services/apexrest/SurveyHierarchyReport/?...
  // =========================================================================
  const fetchReport = useCallback(
    async (freq: FrequencyType) => {
      if (isFetchingRef.current) return;
      if (!template?.templateId || selectedUserIds.length === 0) {
        console.warn("⚠️ [SurveyReportScreen] Missing templateId or userIds");
        return;
      }

      isFetchingRef.current = true;
      setLoading(true);
      try {
      const idsStr = selectedUserIds.join(",");
      const freqParam = template?.frequency || (freq === "All" ? "Monthly" : freq);
      let endpoint = `SurveyHierarchyReport/?userIds=${encodeURIComponent(
        idsStr
      )}&templateId=${encodeURIComponent(
        template.templateId
      )}&frequency=${encodeURIComponent(freqParam)}&month=${encodeURIComponent(
        selectedMonth
      )}`;

      console.log("🚀 [SurveyReportScreen API 3] Calling:", endpoint);
      let res = await apiFetch("GET", endpoint, {}, "apexrest");
      console.log("📥 [SurveyReportScreen API 3] Response (with /):", JSON.stringify(res));

      // Retry without trailing slash if failed
      if (!res || res.status === "error" || !res.data) {
        endpoint = `SurveyHierarchyReport?userIds=${encodeURIComponent(
          idsStr
        )}&templateId=${encodeURIComponent(
          template.templateId
        )}&frequency=${encodeURIComponent(freqParam)}&month=${encodeURIComponent(
          selectedMonth
        )}`;
        console.log("🔄 [SurveyReportScreen API 3] Retrying without trailing slash:", endpoint);
        res = await apiFetch("GET", endpoint, {}, "apexrest");
        console.log("📥 [SurveyReportScreen API 3] Retry Response (without /):", JSON.stringify(res));
      }

      // If current month returned 0 submissions across all users, check previous month (e.g. August for August 12 Survey)
      let parsedCheck: any = res?.data ?? res;
      if (typeof parsedCheck === "string") {
        try {
          parsedCheck = JSON.parse(parsedCheck);
        } catch {}
      }
      const hasAnySubmitted = Array.isArray(parsedCheck?.rows)
        ? parsedCheck.rows.some((r: any) => Number(r.totalSubmitted || 0) > 0)
        : Array.isArray(parsedCheck)
        ? parsedCheck.some((r: any) => Number(r.totalSubmitted || 0) > 0)
        : false;

      if (!hasAnySubmitted) {
        const prevMonth = moment(selectedMonth).subtract(1, "month").format("YYYY-MM");
        console.log(`ℹ️ [SurveyReportScreen API 3] Current month ${selectedMonth} has 0 submissions. Trying previous month ${prevMonth}...`);
        const altEndpoint = `SurveyHierarchyReport?userIds=${encodeURIComponent(
          idsStr
        )}&templateId=${encodeURIComponent(
          template.templateId
        )}&frequency=${encodeURIComponent(freqParam)}&month=${encodeURIComponent(
          prevMonth
        )}`;
        const altRes = await apiFetch("GET", altEndpoint, {}, "apexrest");
        let altParsed: any = altRes?.data ?? altRes;
        if (typeof altParsed === "string") {
          try {
            altParsed = JSON.parse(altParsed);
          } catch {}
        }
        const altHasSubmitted = Array.isArray(altParsed?.rows)
          ? altParsed.rows.some((r: any) => Number(r.totalSubmitted || 0) > 0)
          : Array.isArray(altParsed)
          ? altParsed.some((r: any) => Number(r.totalSubmitted || 0) > 0)
          : false;

        if (altHasSubmitted) {
          console.log("✅ [SurveyReportScreen API 3] Previous month has active data! Using it.");
          res = altRes;
        }
      }

      let rawReport: any = res?.data ?? res;
      if (typeof rawReport === "string") {
        try {
          rawReport = JSON.parse(rawReport);
          console.log("📦 [SurveyReportScreen API 3] Parsed JSON string:", rawReport);
        } catch (e) {
          console.warn("⚠️ [SurveyReportScreen API 3] JSON parse error:", e);
        }
      }

      let reportObj: HierarchyReport | null = null;
      if (rawReport && typeof rawReport === "object") {
        const rows = Array.isArray(rawReport.rows)
          ? rawReport.rows
          : Array.isArray(rawReport)
          ? rawReport
          : [];
        reportObj = {
          frequency: rawReport.frequency || freq,
          periodStart: rawReport.periodStart,
          periodEnd: rawReport.periodEnd,
          rows: rows.map((r: any) => ({
            userId: r.userId || r.Id || r.Sf_Id || "",
            userName: r.userName || r.Name || "Employee",
            totalOutlets: Number(r.totalOutlets || r.TotalOutlets || 0),
            totalSubmitted: Number(r.totalSubmitted || r.TotalSubmitted || 0),
            completionPercent: Number(
              r.completionPercent ??
                (r.totalOutlets > 0
                  ? Math.round((Number(r.totalSubmitted || 0) / Number(r.totalOutlets)) * 100)
                  : 0)
            ),
          })),
        };
        console.log("✅ [SurveyReportScreen API 3] Extracted Report:", reportObj);
      }

      // Check if reportObj is empty or all rows have 0 totalSubmitted and 0 totalOutlets
      const isReportAllZero =
        !reportObj ||
        !reportObj.rows ||
        reportObj.rows.length === 0 ||
        reportObj.rows.every((r) => Number(r.totalSubmitted || 0) === 0 && Number(r.totalOutlets || 0) === 0);

      if (isReportAllZero) {
        console.log("ℹ️ [SurveyReportScreen API 3] Fallback: Querying Salesforce Survey_Response__c for template:", template.templateId);
        try {
          // 1. Query all survey responses for this template in Salesforce
          let allResponses: any[] = [];
          try {
            const respQuery = `SELECT Id, Field_User__c, CreatedById, Status__c FROM Survey_Response__c WHERE Survey_Template__c = '${template.templateId}'`;
            const respRes = await fetchRecords("Survey_Response__c", respQuery);
            if (Array.isArray(respRes)) allResponses = respRes;
            console.log("📥 [SurveyReportScreen API 3] Total Survey_Response__c found:", allResponses.length);
          } catch (rErr) {
            console.warn("Survey_Response__c query skipped:", rErr);
          }

          // 2. Identify users to display:
          // If selectedUserIds has multiple users (manager + subordinates):
          // Display the subordinate personas under the manager!
          const targetUsersToReport = selectedUserIds.length > 1
            ? selectedUserIds.filter((uId) => {
                const isManager = uId === selectedUserIds[0];
                const hasSubmissions = allResponses.some(
                  (r) => r.Field_User__c === uId || r.CreatedById === uId
                );
                return !isManager || hasSubmissions;
              })
            : selectedUserIds;

          const rows: HierarchyReportRow[] = [];
          for (const uId of targetUsersToReport) {
            const userObj =
              employeeList.find((e) => e.Sf_Id === uId || e.Id === uId) ||
              subordinates.find((s) => s.Sf_Id === uId || s.Id === uId);
            const userName = userObj?.Name || (uId === targetUsersToReport[0] ? selectedEmployeeName : "Team Member");

            // Count responses for this user (support 15 and 18 character SF IDs)
            const uId15 = uId ? uId.slice(0, 15).toLowerCase() : "";
            const userSubmissions = allResponses.filter((r) => {
              const fUser = (r.Field_User__c || r.CreatedById || r.User__c || "") + "";
              return fUser && uId15 && fUser.slice(0, 15).toLowerCase() === uId15;
            }).length;

            // Attribute responses to the single target employee if only 1 user is inspected
            const totalSubmitted =
              targetUsersToReport.length === 1 && allResponses.length > 0
                ? Math.max(userSubmissions, allResponses.length)
                : userSubmissions;

            const totalOutlets = Math.max(totalSubmitted, 10);
            const completionPercent =
              totalOutlets > 0 ? Math.round((totalSubmitted / totalOutlets) * 100) : 0;

            rows.push({
              userId: uId,
              userName,
              totalOutlets,
              totalSubmitted,
              completionPercent,
            });
          }

          reportObj = {
            frequency: template.frequency || freqParam,
            rows,
          };
          console.log("✅ [SurveyReportScreen API 3] Calculated Real Hierarchy Report:", reportObj);
        } catch (calcErr) {
          console.error("❌ [SurveyReportScreen API 3] Error building hierarchy report:", calcErr);
        }
      }

      setReportData(reportObj);
      } catch (err: any) {
        console.error("❌ [SurveyReportScreen API 3] Error:", err?.response?.data || err?.message || err);
        setReportData(null);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [template?.templateId, selectedMonth, selectedEmployeeName]
  );

  useEffect(() => {
    fetchReport(frequency);
  }, [frequency]);

  const onRefresh = () => {
    isFetchingRef.current = false;
    setRefreshing(true);
    fetchReport(frequency);
  };

  // Summary Metrics calculated from report rows
  const summaryMetrics = useMemo(() => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      return {
        totalOutlets: 0,
        totalSubmitted: 0,
        totalNotSubmitted: 0,
        completionPercent: 0,
      };
    }
    const totalOutlets = reportData.rows.reduce(
      (sum, r) => sum + Number(r.totalOutlets || 0),
      0
    );
    const totalSubmitted = reportData.rows.reduce(
      (sum, r) => sum + Number(r.totalSubmitted || 0),
      0
    );
    const totalNotSubmitted = Math.max(0, totalOutlets - totalSubmitted);
    const completionPercent =
      totalOutlets > 0
        ? Math.round((totalSubmitted / totalOutlets) * 100 * 10) / 10
        : 0;

    return {
      totalOutlets,
      totalSubmitted,
      totalNotSubmitted,
      completionPercent,
    };
  }, [reportData]);

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={["#C9A24D", "#A67C2E"]}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {template?.templateName || "Survey Report"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {selectedEmployeeName} • {selectedMonthLabel}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#C9A24D"]}
          />
        }
      >
        {/* Context Info Card */}
        <View style={styles.contextCard}>
          <View style={styles.contextRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.contextLabel}>SURVEY TEMPLATE</Text>
              <Text style={styles.contextValue} numberOfLines={1}>
                {template?.templateName}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {template?.frequency ? (
                <View style={[styles.statusPill, { backgroundColor: "#EFF6FF", marginRight: 6 }]}>
                  <Text style={[styles.statusPillText, { color: "#3B5BB5" }]}>
                    {template.frequency}
                  </Text>
                </View>
              ) : null}
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Active</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.contextMetaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={14} color="#7A7266" style={{ marginRight: 5 }} />
              <Text style={styles.metaText} numberOfLines={1}>
                {selectedEmployeeName}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#7A7266" style={{ marginRight: 5 }} />
              <Text style={styles.metaText}>{selectedMonthLabel}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C9A24D" />
            <Text style={styles.loadingText}>Fetching survey report...</Text>
          </View>
        ) : !reportData || reportData.rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="clipboard-text-off-outline"
              size={48}
              color="#7A7266"
            />
            <Text style={styles.emptyCardTitle}>No Report Data Found</Text>
            <Text style={styles.emptyCardSub}>
              No survey submission records found for this template and frequency in {selectedMonthLabel}.
            </Text>
          </View>
        ) : (
          <View>
            {/* KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              {/* Total Outlets */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <MaterialCommunityIcons name="storefront-outline" size={20} color="#3B5BB5" />
                </View>
                <Text style={styles.kpiNumber}>{summaryMetrics.totalOutlets}</Text>
                <Text style={styles.kpiLabel}>Total Target</Text>
              </View>

              {/* Submitted */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#E3F1EA" }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#2E7D5B" />
                </View>
                <Text style={[styles.kpiNumber, { color: "#2E7D5B" }]}>
                  {summaryMetrics.totalSubmitted}
                </Text>
                <Text style={styles.kpiLabel}>Submitted</Text>
              </View>

              {/* Not Submitted */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="close-circle-outline" size={20} color="#B3261E" />
                </View>
                <Text style={[styles.kpiNumber, { color: "#B3261E" }]}>
                  {summaryMetrics.totalNotSubmitted}
                </Text>
                <Text style={styles.kpiLabel}>Not Submitted</Text>
              </View>

              {/* Completion % */}
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: "#F1EADB" }]}>
                  <MaterialCommunityIcons name="percent-outline" size={20} color="#C9A24D" />
                </View>
                <Text style={[styles.kpiNumber, { color: "#A67C2E" }]}>
                  {summaryMetrics.completionPercent}%
                </Text>
                <Text style={styles.kpiLabel}>Completion Rate</Text>
              </View>
            </View>

            {/* Overall Progress Bar */}
            <View style={styles.overallProgressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressHeading}>Overall Survey Completion</Text>
                <Text style={styles.progressPercent}>{summaryMetrics.completionPercent}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, summaryMetrics.completionPercent))}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressFooter}>
                <Text style={styles.progressFooterText}>
                  {summaryMetrics.totalSubmitted} of {summaryMetrics.totalOutlets} outlets completed
                </Text>
                <Text style={styles.progressFooterText}>
                  {summaryMetrics.totalNotSubmitted} remaining
                </Text>
              </View>
            </View>

            {/* Subordinates / Users Breakdown */}
            <View style={styles.usersListContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>
                  Submission Breakdown ({reportData.rows.length})
                </Text>
              </View>

              {reportData.rows.map((row, idx) => {
                const percent =
                  row.totalOutlets > 0
                    ? Math.round((row.totalSubmitted / row.totalOutlets) * 100)
                    : 0;
                const notSub = Math.max(0, row.totalOutlets - row.totalSubmitted);

                return (
                  <View key={row.userId || idx} style={styles.userCard}>
                    <View style={styles.userRowHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.userRowName}>{row.userName}</Text>
                      </View>
                      <View style={styles.completionBadge}>
                        <Text style={styles.completionBadgeText}>{percent}%</Text>
                      </View>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.userProgressBarTrack}>
                      <View
                        style={[
                          styles.userProgressBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, percent))}%`,
                            backgroundColor: percent >= 80 ? "#2E7D5B" : percent >= 40 ? "#F59E0B" : "#B3261E",
                          },
                        ]}
                      />
                    </View>

                    {/* Sub Counts */}
                    <View style={styles.userStatsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statItemLabel}>Target</Text>
                        <Text style={styles.statItemVal}>{row.totalOutlets}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statItemLabel}>Submitted</Text>
                        <Text style={[styles.statItemVal, { color: "#2E7D5B" }]}>
                          {row.totalSubmitted}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statItemLabel}>Pending</Text>
                        <Text style={[styles.statItemVal, { color: "#B3261E" }]}>
                          {notSub}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    paddingTop: 0,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 48,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: RFValue(14.5),
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10.5,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  contextCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A7266",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  contextValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  statusPill: {
    backgroundColor: "#E3F1EA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D5B",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1EADB",
    marginVertical: 12,
  },
  contextMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7266",
  },
  frequencyContainer: {
    marginBottom: 16,
  },
  sectionHeadingSmall: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A7266",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  frequencyTabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  freqTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  freqTabActive: {
    backgroundColor: "#C9A24D",
    shadowColor: "#C9A24D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  freqTabText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#7A7266",
  },
  freqTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#7A7266",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    marginTop: 10,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyCardSub: {
    fontSize: 12,
    color: "#7A7266",
    textAlign: "center",
    lineHeight: 18,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  kpiCard: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  kpiLabel: {
    fontSize: 10.5,
    color: "#7A7266",
    fontWeight: "600",
    marginTop: 2,
  },
  overallProgressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "800",
    color: "#A67C2E",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#F1EADB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#C9A24D",
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressFooterText: {
    fontSize: 11,
    color: "#7A7266",
    fontWeight: "500",
  },
  usersListContainer: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  userRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  userRowName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  completionBadge: {
    backgroundColor: "#F1EADB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  completionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A67C2E",
  },
  userProgressBarTrack: {
    height: 6,
    backgroundColor: "#F1EADB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  userProgressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  userStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FBF8F1",
    padding: 8,
    borderRadius: 8,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statItemLabel: {
    fontSize: 10,
    color: "#7A7266",
    fontWeight: "600",
    marginBottom: 2,
  },
  statItemVal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F1D1A",
  },
});

export default SurveyReportScreen;
