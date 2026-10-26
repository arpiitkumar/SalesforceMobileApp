import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Feather from "@react-native-vector-icons/feather";
import MIcon from "@react-native-vector-icons/material-icons";
import moment from "moment";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../redux/store";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { showToast } from "../redux/slices/toastSlice";
import { isInternetAvailable } from "../utils/networkUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { PSTemplateRecord, getDraftAnswersStorageKey, getDraftStorageKey } from "./PerfectStoreScreen";

export interface AuditSubmissionRecord {
  id?: string;
  auditName?: string;
  templateId: string;
  status: string;
  auditDate: string;
  createdDate?: string;
  score?: number;
  totalScore?: number | null;
  maxScore?: number | null;
  compliancePercentage?: number | null;
  isPerfect?: boolean;
  submittedOn?: string | null;
}

export interface PSAuditScorecard {
  Id?: string;
  Name?: string;
  Score__c?: number | null;
  Total_Score__c?: number | null;
  Max_Score__c?: number | null;
  Compliance_Percentage__c?: number | null;
  Is_Perfect__c?: boolean;
  Submitted_On__c?: string | null;
}

export interface EnrichedTemplateItem extends PSTemplateRecord {
  calculatedStatus: "Submitted" | "Draft" | "Pending";
  latestAuditDate?: string | null;
  statusMessage: string;
  nextAvailableText: string;
  isLockedForPeriod: boolean;
  frequencyType: "Daily" | "Weekly" | "Monthly" | "General";
  scorecard?: PSAuditScorecard | null;
}

type TabKey = "All" | "Pending" | "Draft" | "Submitted";

const PerfectStoreTemplatesScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { apiFetch, fetchRecords } = useApiFetch();

  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const selectedAccount = useSelector(
    (state: RootState) => state.selectedAccount?.selectedAccount
  );

  const outletId =
    route?.params?.outletId ||
    selectedVisit?.AccountId ||
    selectedVisit?.AccountId__c ||
    selectedAccount?.Sf_Id ||
    selectedAccount?.Id ||
    "";

  const outletName =
    route?.params?.outletName ||
    selectedVisit?.AccountName ||
    selectedAccount?.Name ||
    "Store Audit";

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabKey>("Pending");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [templates, setTemplates] = useState<PSTemplateRecord[]>([]);
  const [submissions, setSubmissions] = useState<AuditSubmissionRecord[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, boolean>>({});

  // Frequency evaluation logic
  const evaluateTemplate = useCallback(
    (
      template: PSTemplateRecord,
      allSubmissions: AuditSubmissionRecord[],
      drafts: Record<string, boolean>
    ): EnrichedTemplateItem => {
      const tId = template.Id || template.id || "";
      const rawFreq = (template.Frequency__c || template.frequency || "")
        .trim()
        .toLowerCase();

      let freqType: "Daily" | "Weekly" | "Monthly" | "General" = "General";
      if (rawFreq.includes("month")) {
        freqType = "Monthly";
      } else if (rawFreq.includes("week")) {
        freqType = "Weekly";
      } else if (rawFreq.includes("day") || rawFreq.includes("daily")) {
        freqType = "Daily";
      }

      const matched = allSubmissions.filter((s) => {
        if (!s.templateId || !tId) return false;
        const sTId = String(s.templateId).trim();
        const targetId = String(tId).trim();
        const idMatches =
          sTId === targetId ||
          (sTId.length >= 15 &&
            targetId.length >= 15 &&
            sTId.substring(0, 15) === targetId.substring(0, 15));
        return (
          idMatches &&
          (s.status === "Submitted" ||
            s.status === "Completed" ||
            s.status === "Approved")
        );
      });

      matched.sort(
        (a, b) =>
          new Date(b.auditDate || b.createdDate || 0).getTime() -
          new Date(a.auditDate || a.createdDate || 0).getTime()
      );

      const latest = matched[0];
      const now = moment();

      let isSubmittedForPeriod = false;
      let latestDateStr = "";
      let templateScorecard: PSAuditScorecard | null = null;

      if (latest) {
        latestDateStr = latest.auditDate || latest.createdDate || "";
        const latestMoment = moment(latestDateStr);

        const maxScoreVal =
          latest.maxScore !== undefined && latest.maxScore !== null
            ? Number(latest.maxScore)
            : 100;
        const totalScoreVal =
          latest.totalScore !== undefined && latest.totalScore !== null
            ? Number(latest.totalScore)
            : latest.score !== undefined && latest.score !== null && maxScoreVal > 0
              ? Math.round((Number(latest.score) / 100) * maxScoreVal * 10) / 10
              : null;
        const scorePercentageVal =
          latest.score !== undefined && latest.score !== null
            ? Number(latest.score)
            : null;
        const compVal =
          latest.compliancePercentage !== undefined &&
            latest.compliancePercentage !== null
            ? Number(latest.compliancePercentage)
            : scorePercentageVal !== null
              ? Math.round(scorePercentageVal)
              : totalScoreVal !== null && maxScoreVal > 0
                ? Math.round((totalScoreVal / maxScoreVal) * 100)
                : null;

        templateScorecard = {
          Id: latest.id,
          Name:
            latest.auditName ||
            (latest.id ? `Audit ${latest.id.substring(0, 8)}` : "Audit Record"),
          Score__c: scorePercentageVal,
          Total_Score__c: totalScoreVal,
          Max_Score__c: maxScoreVal,
          Compliance_Percentage__c: compVal,
          Is_Perfect__c: Boolean(latest.isPerfect),
          Submitted_On__c:
            latest.submittedOn || latest.createdDate || latest.auditDate,
        };

        if (freqType === "Monthly") {
          isSubmittedForPeriod =
            latestMoment.isValid() &&
            latestMoment.isSame(now, "month") &&
            latestMoment.isSame(now, "year");
        } else if (freqType === "Weekly") {
          isSubmittedForPeriod =
            latestMoment.isValid() &&
            latestMoment.isSame(now, "isoWeek") &&
            latestMoment.isSame(now, "year");
        } else if (freqType === "Daily") {
          isSubmittedForPeriod =
            latestMoment.isValid() && latestMoment.isSame(now, "day");
        }
      }

      if (isSubmittedForPeriod) {
        if (freqType === "Monthly") {
          const nextMonth = moment().add(1, "month").startOf("month");
          return {
            ...template,
            calculatedStatus: "Submitted",
            latestAuditDate: latestDateStr,
            statusMessage: `Submitted for ${now.format("MMM YYYY")}`,
            nextAvailableText: `Next month (${nextMonth.format("01 MMM")})`,
            isLockedForPeriod: true,
            frequencyType: freqType,
            scorecard: templateScorecard,
          };
        } else if (freqType === "Weekly") {
          const nextWeek = moment().add(1, "week").startOf("isoWeek");
          return {
            ...template,
            calculatedStatus: "Submitted",
            latestAuditDate: latestDateStr,
            statusMessage: `Submitted for Wk ${now.isoWeek()}`,
            nextAvailableText: `Next Mon (${nextWeek.format("DD MMM")})`,
            isLockedForPeriod: true,
            frequencyType: freqType,
            scorecard: templateScorecard,
          };
        } else {
          const latestMoment = moment(latestDateStr);
          return {
            ...template,
            calculatedStatus: "Submitted",
            latestAuditDate: latestDateStr,
            statusMessage: `Submitted today (${latestMoment.format("DD MMM")})`,
            nextAvailableText: "Tomorrow",
            isLockedForPeriod: true,
            frequencyType: freqType,
            scorecard: templateScorecard,
          };
        }
      }

      // Check if template has a saved draft
      const isDraft = Boolean(
        drafts[tId] ||
        (tId.length >= 15 && drafts[tId.substring(0, 15)])
      );

      if (isDraft) {
        return {
          ...template,
          calculatedStatus: "Draft",
          latestAuditDate: null,
          statusMessage: "Draft in Progress",
          nextAvailableText: "Resume draft",
          isLockedForPeriod: false,
          frequencyType: freqType,
          scorecard: null,
        };
      }

      return {
        ...template,
        calculatedStatus: "Pending",
        latestAuditDate: latestDateStr || null,
        statusMessage: getPendingDueText(freqType),
        nextAvailableText: "Available now",
        isLockedForPeriod: false,
        frequencyType: freqType,
        scorecard: null,
      };
    },
    []
  );

  const getPendingDueText = (freqType: string) => {
    const now = moment();
    if (freqType === "Monthly") return `Due for ${now.format("MMM YYYY")}`;
    if (freqType === "Weekly") return `Due for Wk ${now.isoWeek()}`;
    if (freqType === "Daily") return `Due today (${now.format("DD MMM")})`;
    return "Pending Audit";
  };

  const loadTemplatesAndAudits = async (isPullToRefresh = false) => {
    if (!outletId) {
      dispatch(
        showToast({
          type: "error",
          message: "Outlet ID is required.",
        })
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const isOnline = await isInternetAvailable();
      if (!isOnline) {
        dispatch(
          showToast({
            type: "warning",
            message: "Internet is required to access Perfect Store.",
          })
        );
        if (navigation?.canGoBack && navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }

      const newDraftMap: Record<string, boolean> = {};

      // Step A: Local submissions
      const localSubmissionsKey = `@PS_SUBMITTED_AUDITS_${outletId}`;
      let allSubmissionsList: AuditSubmissionRecord[] = [];

      try {
        const localData = await AsyncStorage.getItem(localSubmissionsKey);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            allSubmissionsList = parsed;
          }
        }
      } catch (e) {
        console.warn("Local sub read error:", e);
      }

      // Step B: Server submissions query & child response verification
      if (isOnline) {
        try {
          const query = `SELECT Id, Name, Template__c, Outlet__c, Status__c, Audit_Date__c, Total_Score__c, Max_Score__c, Compliance_Percentage__c, Is_Perfect__c, Submitted_On__c, CreatedDate FROM PS_Audit__c WHERE Outlet__c='${outletId}' AND Status__c IN ('Submitted', 'Completed', 'Approved', 'Draft') ORDER BY Audit_Date__c DESC, CreatedDate DESC LIMIT 50`;
          console.log(`📤 [Audit Query] Checking PS_Audit__c for outlet: ${outletId}`);
          const serverAudits = await fetchRecords("PS_Audit__c", query);
          console.log(`📥 [Audit Query] Found ${serverAudits?.length || 0} parent PS_Audit__c records`);

          let validServerAudits: any[] = [];
          if (Array.isArray(serverAudits) && serverAudits.length > 0) {
            const allAuditIds = serverAudits.map((a: any) => a.Id).filter(Boolean);

            const submittedAudits = serverAudits.filter(
              (rec: any) =>
                rec.Status__c === "Submitted" ||
                rec.Status__c === "Completed" ||
                rec.Status__c === "Approved"
            );

            const draftAudits = serverAudits.filter(
              (rec: any) => rec.Status__c === "Draft"
            );

            // Verify if child PS_Audit_Response__c records actually exist for these audits
            if (allAuditIds.length > 0) {
              try {
                const respQuery = `SELECT Id, Audit__c FROM PS_Audit_Response__c WHERE Audit__c IN ('${allAuditIds.join("','")}') LIMIT 500`;
                console.log("📤 [Response Verification] Checking child PS_Audit_Response__c records...");
                const existingResponses = await fetchRecords("PS_Audit_Response__c", respQuery);
                console.log(`📥 [Response Verification] Found ${Array.isArray(existingResponses) ? existingResponses.length : 0} child responses`);

                if (Array.isArray(existingResponses)) {
                  const auditsWithResponsesSet = new Set<string>();
                  existingResponses.forEach((r: any) => {
                    if (r.Audit__c) {
                      const aId = String(r.Audit__c).trim();
                      auditsWithResponsesSet.add(aId);
                      if (aId.length >= 15) {
                        auditsWithResponsesSet.add(aId.substring(0, 15));
                      }
                    }
                  });

                  // Only consider draft audits that actually have child PS_Audit_Response__c records
                  draftAudits.forEach((rec: any) => {
                    if (rec.Id && rec.Template__c) {
                      const recId = String(rec.Id).trim();
                      const recId15 = recId.length >= 15 ? recId.substring(0, 15) : recId;
                      if (auditsWithResponsesSet.has(recId) || auditsWithResponsesSet.has(recId15)) {
                        const tKey = String(rec.Template__c).trim();
                        newDraftMap[tKey] = true;
                        if (tKey.length >= 15) {
                          newDraftMap[tKey.substring(0, 15)] = true;
                        }
                      }
                    }
                  });

                  // Only consider submitted audits that actually have child PS_Audit_Response__c records
                  validServerAudits = submittedAudits.filter((rec: any) => {
                    if (!rec.Id) return false;
                    const recId = String(rec.Id).trim();
                    const recId15 = recId.length >= 15 ? recId.substring(0, 15) : recId;
                    return auditsWithResponsesSet.has(recId) || auditsWithResponsesSet.has(recId15);
                  });
                  console.log(`✅ Valid submitted audits with responses: ${validServerAudits.length} out of ${submittedAudits.length}`);
                } else {
                  validServerAudits = submittedAudits;
                }
              } catch (respErr) {
                console.warn("⚠️ Could not verify child responses, using submittedAudits:", respErr);
                validServerAudits = submittedAudits;
              }
            }
          }

          const mapped: AuditSubmissionRecord[] = validServerAudits.map(
            (rec: any) => ({
              id: rec.Id,
              auditName: rec.Name,
              templateId: rec.Template__c,
              status: rec.Status__c || "Submitted",
              auditDate:
                rec.Audit_Date__c ||
                (rec.CreatedDate
                  ? moment(rec.CreatedDate).format("YYYY-MM-DD")
                  : ""),
              createdDate: rec.CreatedDate,
              score:
                rec.Score__c !== undefined && rec.Score__c !== null
                  ? Number(rec.Score__c)
                  : undefined,
              totalScore:
                rec.Total_Score__c !== undefined && rec.Total_Score__c !== null
                  ? Number(rec.Total_Score__c)
                  : null,
              maxScore:
                rec.Max_Score__c !== undefined && rec.Max_Score__c !== null
                  ? Number(rec.Max_Score__c)
                  : null,
              compliancePercentage:
                rec.Compliance_Percentage__c !== undefined &&
                  rec.Compliance_Percentage__c !== null
                  ? Number(rec.Compliance_Percentage__c)
                  : null,
              isPerfect: Boolean(rec.Is_Perfect__c),
              submittedOn: rec.Submitted_On__c || rec.CreatedDate || null,
            })
          );

          // Server is the single source of truth when online. Overwrite local cache with valid server audits.
          allSubmissionsList = mapped;
          if (mapped.length > 0) {
            await AsyncStorage.setItem(localSubmissionsKey, JSON.stringify(mapped)).catch(() => { });
          } else {
            console.log("🧹 No valid submitted audits on server. Clearing local cache...");
            await AsyncStorage.removeItem(localSubmissionsKey).catch(() => { });
            await AsyncStorage.removeItem(`@PS_LATEST_SUBMITTED_AUDIT_ID_${outletId}`).catch(() => { });
            await AsyncStorage.removeItem(`@PS_CACHED_SCORECARD_${outletId}`).catch(() => { });
            setActiveTab((prev) => (prev === "Submitted" ? "All" : prev));
          }
        } catch (queryErr) {
          console.log("PS_Audit__c query fallback:", queryErr);
        }
      }

      setSubmissions(allSubmissionsList);

      // Step C: Fetch Templates
      const cachedTemplatesKey = `@PS_CACHED_TEMPLATES_${outletId}`;
      let finalTemplates: PSTemplateRecord[] = [];

      if (!isOnline) {
        const cached = await AsyncStorage.getItem(cachedTemplatesKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              finalTemplates = parsed;
              setTemplates(parsed);
            }
          } catch (_) { }
        }
      } else {
        const endpoint = `PerfectStore/templates/${outletId}`;
        const response = await apiFetch("GET", endpoint, {}, "apexrest");

        if (
          response &&
          (response.status === "success" ||
            Array.isArray(response.data) ||
            response.data)
        ) {
          const rawData =
            response.data !== undefined ? response.data : response;

          let parsedTemplates: PSTemplateRecord[] = [];

          if (Array.isArray(rawData)) {
            parsedTemplates = rawData;
          } else if (rawData && typeof rawData === "object") {
            if (Array.isArray(rawData.templates)) parsedTemplates = rawData.templates;
            else if (Array.isArray(rawData.template)) parsedTemplates = rawData.template;
            else if (Array.isArray(rawData.records)) parsedTemplates = rawData.records;
            else if (Array.isArray(rawData.data)) {
              if (Array.isArray(rawData.data)) parsedTemplates = rawData.data;
              else if (Array.isArray(rawData.data.templates))
                parsedTemplates = rawData.data.templates;
              else parsedTemplates = [rawData.data];
            } else if (rawData.Id || rawData.id || rawData.Name || rawData.name) {
              parsedTemplates = [rawData];
            }
          }

          const normalized: PSTemplateRecord[] = parsedTemplates.map(
            (t: any, idx: number) => ({
              ...t,
              Id: t.Id || t.id || t.templateId || `template_${idx}`,
              Name: t.Name || t.name || "Perfect Store Audit",
              Description__c: t.Description__c || t.description || "",
              Frequency__c: t.Frequency__c || t.frequency || "Daily",
              Perfect_Score_Threshold__c:
                t.Perfect_Score_Threshold__c !== undefined
                  ? Number(t.Perfect_Score_Threshold__c)
                  : t.perfectScoreThreshold !== undefined
                    ? Number(t.perfectScoreThreshold)
                    : 80,
            })
          );

          // Always preserve existing/cached templates so submitted templates don't vanish
          const templateMap = new Map<string, PSTemplateRecord>();

          // Pre-fill with previously cached templates
          try {
            const cached = await AsyncStorage.getItem(cachedTemplatesKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed)) {
                parsed.forEach((t: PSTemplateRecord) => {
                  const k = t.Id || t.id || "";
                  if (k) templateMap.set(k, t);
                });
              }
            }
          } catch (_) { }

          // Add / update with freshly fetched templates
          normalized.forEach((t: PSTemplateRecord) => {
            const k = t.Id || t.id || "";
            if (k) templateMap.set(k, t);
          });

          finalTemplates = Array.from(templateMap.values());
          setTemplates(finalTemplates);
          await AsyncStorage.setItem(
            cachedTemplatesKey,
            JSON.stringify(finalTemplates)
          ).catch(() => { });
        } else {
          // If API returned empty, restore from cache
          try {
            const cached = await AsyncStorage.getItem(cachedTemplatesKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                finalTemplates = parsed;
                setTemplates(parsed);
              }
            }
          } catch (_) { }
        }
      }

      // Step D: Scan local storage for draft answers for each template
      if (route?.params?.justDraftedTemplateId) {
        const jId = String(route.params.justDraftedTemplateId).trim();
        newDraftMap[jId] = true;
        if (jId.length >= 15) {
          newDraftMap[jId.substring(0, 15)] = true;
        }
      }

      const templatesToScan =
        finalTemplates && finalTemplates.length > 0
          ? finalTemplates
          : templates;

      for (const t of templatesToScan) {
        const tId = t.Id || t.id;
        if (tId) {
          try {
            const dKey = getDraftAnswersStorageKey(outletId, tId);
            const dVal = await AsyncStorage.getItem(dKey);
            if (dVal) {
              const parsed = JSON.parse(dVal);
              if (parsed?.answers && Object.keys(parsed.answers).length > 0) {
                newDraftMap[tId] = true;
                if (tId.length >= 15) {
                  newDraftMap[tId.substring(0, 15)] = true;
                }
              }
            }
          } catch (_) { }
        }
      }

      setDraftMap(newDraftMap);
    } catch (error: any) {
      console.error("Template load error:", error);
      dispatch(
        showToast({
          type: "error",
          message: error?.message || "Failed to load templates.",
        })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Auto-switch tabs if redirected after submitting or drafting
      if (
        route?.params?.justSubmittedTemplateId ||
        route?.params?.latestAuditId
      ) {
        setActiveTab("Submitted");
      } else if (route?.params?.justDraftedTemplateId) {
        setActiveTab("Draft");
      }
      loadTemplatesAndAudits();
    }, [
      outletId,
      route?.params?.latestAuditId,
      route?.params?.auditId,
      route?.params?.justSubmittedTemplateId,
      route?.params?.justDraftedTemplateId,
      route?.params?.refreshTimestamp,
    ])
  );

  const enrichedTemplates: EnrichedTemplateItem[] = useMemo(() => {
    return templates.map((t) => evaluateTemplate(t, submissions, draftMap));
  }, [templates, submissions, draftMap, evaluateTemplate]);

  const allCount = enrichedTemplates.length;
  const pendingCount = enrichedTemplates.filter(
    (t) => t.calculatedStatus === "Pending"
  ).length;
  const draftCount = enrichedTemplates.filter(
    (t) => t.calculatedStatus === "Draft"
  ).length;
  const submittedCount = enrichedTemplates.filter(
    (t) => t.calculatedStatus === "Submitted"
  ).length;

  const filteredTemplates = useMemo(() => {
    return enrichedTemplates.filter((item) => {
      if (activeTab === "Submitted" && item.calculatedStatus !== "Submitted") {
        return false;
      }
      if (activeTab === "Draft" && item.calculatedStatus !== "Draft") {
        return false;
      }
      if (activeTab === "Pending" && item.calculatedStatus !== "Pending") {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return Boolean(item.Name && item.Name.toLowerCase().includes(q));
      }

      return true;
    });
  }, [enrichedTemplates, activeTab, searchQuery]);

  const handleTemplatePress = (item: EnrichedTemplateItem) => {
    if (item.calculatedStatus === "Submitted" && item.isLockedForPeriod) {
      const formattedDate = item.latestAuditDate
        ? moment(item.latestAuditDate).format("DD MMM YYYY")
        : "";

      const msg = formattedDate
        ? `"${item.Name}" already submitted on ${formattedDate}. Next available: ${item.nextAvailableText}.`
        : `"${item.Name}" already submitted. Next available: ${item.nextAvailableText}.`;

      dispatch(
        showToast({
          type: "warning",
          message: msg,
        })
      );
      return;
    }

    navigation.navigate("PerfectStoreScreen", {
      outletId,
      outletName,
      outletLatitude: route?.params?.outletLatitude,
      outletLongitude: route?.params?.outletLongitude,
      templateId: item.Id,
      selectedTemplate: item,
    });
  };

  const renderCardScorecard = (
    sc: PSAuditScorecard,
    fallbackDate?: string | null
  ) => {
    const auditName = sc.Name || "Audit Record";
    const maxScoreVal =
      sc.Max_Score__c !== undefined && sc.Max_Score__c !== null
        ? Number(sc.Max_Score__c)
        : 100;
    const totalScoreVal =
      sc.Total_Score__c !== undefined && sc.Total_Score__c !== null
        ? Number(sc.Total_Score__c)
        : sc.Score__c !== undefined && sc.Score__c !== null && maxScoreVal > 0
          ? Math.round((Number(sc.Score__c) / 100) * maxScoreVal * 10) / 10
          : null;
    const compVal =
      sc.Compliance_Percentage__c !== undefined &&
        sc.Compliance_Percentage__c !== null
        ? Number(sc.Compliance_Percentage__c)
        : sc.Score__c !== undefined && sc.Score__c !== null
          ? Math.round(Number(sc.Score__c))
          : totalScoreVal !== null && maxScoreVal > 0
            ? Math.round((totalScoreVal / maxScoreVal) * 100)
            : null;

    const isPerfect = Boolean(sc.Is_Perfect__c);
    const dateSource = sc.Submitted_On__c || fallbackDate;
    const submittedOnStr = dateSource
      ? moment(dateSource).format("DD MMM YYYY • hh:mm A")
      : null;

    const compColor =
      compVal === null
        ? "#7A7266"
        : compVal >= 80
          ? "#2E7D5B"
          : compVal >= 60
            ? "#D08C1F"
            : "#B3261E";

    const compBg =
      compVal === null
        ? "#F1EADB"
        : compVal >= 80
          ? "#ECFDF5"
          : compVal >= 60
            ? "#FFFBEB"
            : "#FEF2F2";

    return (
      <View style={styles.cardScorecardWrap}>
        {/* Scorecard Mini Header: Audit ID & Perfect Badge */}
        <View style={styles.cardScorecardHeader}>
          <View style={styles.cardScorecardAuditIdRow}>
            <MIcon
              name={isPerfect ? "stars" : "verified"}
              size={13}
              color={isPerfect ? "#2E7D5B" : "#3B5BB5"}
            />
            <Text style={styles.cardScorecardAuditIdText}>{auditName}</Text>
          </View>

          <View
            style={[
              styles.cardPerfectBadge,
              {
                backgroundColor: isPerfect ? "#ECFDF5" : "#F1EADB",
                borderColor: isPerfect ? "#A7F3D0" : "#D9D2C3",
              },
            ]}
          >
            <MIcon
              name={isPerfect ? "check-circle" : "info-outline"}
              size={10}
              color={isPerfect ? "#2E7D5B" : "#7A7266"}
              style={{ marginRight: 2.5 }}
            />
            <Text
              style={[
                styles.cardPerfectBadgeText,
                { color: isPerfect ? "#2E7D5B" : "#7A7266" },
              ]}
            >
              {isPerfect ? "Perfect Store" : "Standard"}
            </Text>
          </View>
        </View>

        {/* 3 Metrics Row */}
        <View style={styles.cardMetricsRow}>
          {/* Compliance */}
          <View style={[styles.cardMetricTile, { backgroundColor: compBg }]}>
            <Text style={[styles.cardMetricValLarge, { color: compColor }]}>
              {compVal !== null ? `${Math.round(compVal)}%` : "--"}
            </Text>
            <Text style={styles.cardMetricLabel}>Compliance</Text>
          </View>

          {/* Total Score */}
          <View style={styles.cardMetricTile}>
            <Text style={styles.cardMetricVal}>
              {totalScoreVal !== null ? totalScoreVal : "--"}
              <Text style={styles.cardMetricValSub}> / {maxScoreVal}</Text>
            </Text>
            <Text style={styles.cardMetricLabel}>Total Score</Text>
          </View>

          {/* Submitted Date & Time */}
          <View style={[styles.cardMetricTile, { flex: 1.25 }]}>
            <Text style={styles.cardMetricValSmall} numberOfLines={1}>
              {submittedOnStr
                ? submittedOnStr.split("•")[0]?.trim()
                : "Submitted"}
            </Text>
            <Text style={styles.cardMetricLabel} numberOfLines={1}>
              {submittedOnStr && submittedOnStr.includes("•")
                ? submittedOnStr.split("•")[1]?.trim()
                : "Audit Date"}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        {compVal !== null && (
          <View style={styles.cardProgressTrack}>
            <View
              style={[
                styles.cardProgressBar,
                {
                  width: `${Math.min(Math.max(compVal, 0), 100)}%`,
                  backgroundColor: compColor,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  };

  const getFreqStyle = (type: string) => {
    switch (type) {
      case "Daily":
        return { backgroundColor: "#FBEFD8", borderColor: "#FDE68A", color: "#B45309" };
      case "Weekly":
        return { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD", color: "#3B5BB5" };
      case "Monthly":
        return { backgroundColor: "#F3E8FF", borderColor: "#DDD6FE", color: "#7E22CE" };
      default:
        return { backgroundColor: "#F1EADB", borderColor: "#D9D2C3", color: "#7A7266" };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />

      {/* Clean, Compact Header */}
      <LinearGradient
        colors={["#1E3A8A", "#13265C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          { paddingTop: Platform.OS === "ios" ? 72 : 52 },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Perfect Store Audits
          </Text>
          {outletName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {outletName}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => loadTemplatesAndAudits(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" size={16} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Sleek Segmented 4-Tab Bar */}
      <View style={styles.tabsRow}>
        {(["All", "Pending", "Draft", "Submitted"] as TabKey[]).map((tab) => {
          const isSelected = activeTab === tab;
          const count =
            tab === "All"
              ? allCount
              : tab === "Pending"
                ? pendingCount
                : tab === "Draft"
                  ? draftCount
                  : submittedCount;

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, isSelected && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.tabLabel, isSelected && styles.tabLabelActive]}
              >
                {tab}
              </Text>
              <View
                style={[
                  styles.countPill,
                  isSelected && styles.countPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isSelected && styles.countTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>


      {/* Compact Search Bar */}
      {allCount > 0 && (
        <View style={styles.searchBar}>
          <Feather name="search" size={13} color="#7A7266" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by template name..."
            placeholderTextColor="#7A7266"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={13} color="#7A7266" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Body List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#1E3A8A" />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTemplatesAndAudits(true)}
              colors={["#1E3A8A"]}
              tintColor="#1E3A8A"
            />
          }
        >
          {filteredTemplates.length === 0 ? (
            <View style={styles.emptyBox}>
              <MIcon
                name={
                  activeTab === "Submitted"
                    ? "assignment-turned-in"
                    : activeTab === "Draft"
                      ? "bookmark"
                      : activeTab === "Pending"
                        ? "fact-check"
                        : "playlist-add-check"
                }
                size={36}
                color="#D9D2C3"
              />
              <Text style={styles.emptyTitle}>
                {activeTab === "Submitted"
                  ? "No Submitted Audits"
                  : activeTab === "Draft"
                    ? "No Draft Audits"
                    : activeTab === "Pending"
                      ? "No Pending Audits"
                      : "No Templates Found"}
              </Text>
              <Text style={styles.emptySubTitle}>
                {activeTab === "Submitted"
                  ? "No completed audits found for this outlet."
                  : activeTab === "Draft"
                    ? "No saved draft audits for this outlet."
                    : activeTab === "Pending"
                      ? "All audits are completed for the current period!"
                      : "No audit templates assigned."}
              </Text>
            </View>
          ) : (
            filteredTemplates.map((item, index) => {
              const isSubmitted = item.calculatedStatus === "Submitted";
              const isDraft = item.calculatedStatus === "Draft";
              const fStyle = getFreqStyle(item.frequencyType);

              return (
                <TouchableOpacity
                  key={item.Id || index}
                  style={[
                    styles.card,
                    isSubmitted && styles.cardSubmitted,
                    isDraft && styles.cardDraft,
                  ]}
                  onPress={() => handleTemplatePress(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardMain}>
                    {/* Left Mini Icon */}
                    <View
                      style={[
                        styles.cardIconBox,
                        isSubmitted
                          ? styles.cardIconBoxSubmitted
                          : isDraft
                            ? styles.cardIconBoxDraft
                            : styles.cardIconBoxPending,
                      ]}
                    >
                      <MIcon
                        name={
                          isSubmitted
                            ? "check-circle"
                            : isDraft
                              ? "edit-note"
                              : "assignment"
                        }
                        size={isDraft ? 19 : 17}
                        color={
                          isSubmitted
                            ? "#2E7D5B"
                            : isDraft
                              ? "#D08C1F"
                              : "#1E3A8A"
                        }
                      />
                    </View>

                    {/* Middle Info */}
                    <View style={styles.cardInfo}>
                      {/* Name & Status */}
                      <View style={styles.nameRow}>
                        <Text style={styles.templateName} numberOfLines={1}>
                          {item.Name}
                        </Text>
                        <View
                          style={[
                            styles.statusPill,
                            isSubmitted
                              ? styles.statusPillSubmitted
                              : isDraft
                                ? styles.statusPillDraft
                                : styles.statusPillPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isSubmitted
                                ? styles.statusPillTextSubmitted
                                : isDraft
                                  ? styles.statusPillTextDraft
                                  : styles.statusPillTextPending,
                            ]}
                          >
                            {isSubmitted ? "Submitted" : isDraft ? "Draft" : "Pending"}
                          </Text>
                        </View>
                      </View>

                      {/* Meta Pills: Frequency, Target, Status msg */}
                      <View style={styles.metaRow}>
                        <View
                          style={[
                            styles.freqPill,
                            {
                              backgroundColor: fStyle.backgroundColor,
                              borderColor: fStyle.borderColor,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.freqPillText, { color: fStyle.color }]}
                          >
                            {item.frequencyType}
                          </Text>
                        </View>

                        {item.Perfect_Score_Threshold__c !== undefined && (
                          <Text style={styles.targetText}>
                            Min {item.Perfect_Score_Threshold__c}%
                          </Text>
                        )}

                        <Text
                          style={[
                            styles.dueText,
                            isSubmitted
                              ? styles.dueTextSubmitted
                              : isDraft
                                ? styles.dueTextDraft
                                : styles.dueTextPending,
                          ]}
                          numberOfLines={1}
                        >
                          • {item.statusMessage}
                        </Text>
                      </View>

                      {/* Next Available Notice for Submitted */}
                      {isSubmitted && (
                        <View style={styles.nextFillRow}>
                          <Feather
                            name="clock"
                            size={9}
                            color="#2E7D5B"
                            style={{ marginRight: 3 }}
                          />
                          <Text style={styles.nextFillText}>
                            Next fill: {item.nextAvailableText}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Right Chevron / Action */}
                    {!isSubmitted && (
                      <View style={styles.chevronBox}>
                        <Feather
                          name="chevron-right"
                          size={15}
                          color={isDraft ? "#D08C1F" : "#7A7266"}
                        />
                      </View>
                    )}
                  </View>

                  {/* Individual Scorecard & Summary for Submitted Template */}
                  {isSubmitted &&
                    item.scorecard &&
                    renderCardScorecard(item.scorecard, item.latestAuditDate)}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default PerfectStoreTemplatesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    backgroundColor: "#1E3A8A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  headerTitles: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.82)",
    marginTop: 1,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
  },
  tabItemActive: {
    backgroundColor: "#1E3A8A",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7266",
  },
  tabLabelActive: {
    color: "#FFF",
  },
  countPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: "#F1EADB",
  },
  countPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A7266",
  },
  countTextActive: {
    color: "#FFF",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 7,
    paddingHorizontal: 9,
    height: 34,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  cardScorecardWrap: {
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#D9D2C3",
  },
  cardScorecardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardScorecardAuditIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardScorecardAuditIdText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  cardPerfectBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  cardPerfectBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  cardMetricsRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "stretch",
  },
  cardMetricTile: {
    flex: 1,
    backgroundColor: "#FBF8F1",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 4.5,
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
    justifyContent: "center",
  },
  cardMetricValLarge: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 15,
  },
  cardMetricVal: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1F1D1A",
    lineHeight: 14,
  },
  cardMetricValSub: {
    fontSize: 9,
    fontWeight: "500",
    color: "#7A7266",
  },
  cardMetricValSmall: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1F1D1A",
    lineHeight: 13,
  },
  cardMetricLabel: {
    fontSize: 8,
    color: "#7A7266",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginTop: 1,
  },
  cardProgressTrack: {
    height: 3,
    backgroundColor: "#D9D2C3",
    borderRadius: 1.5,
    marginTop: 6,
    overflow: "hidden",
  },
  cardProgressBar: {
    height: "100%",
    borderRadius: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#1F1D1A",
    paddingVertical: 0,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 12,
    color: "#7A7266",
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    marginTop: 8,
  },
  emptySubTitle: {
    fontSize: 11,
    color: "#7A7266",
    textAlign: "center",
    marginTop: 3,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSubmitted: {
    borderColor: "#A7F3D0",
    backgroundColor: "#FAFCFA",
  },
  cardDraft: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFDF5",
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  cardIconBoxPending: {
    backgroundColor: "#FFF1F2",
  },
  cardIconBoxDraft: {
    backgroundColor: "#FBEFD8",
  },
  cardIconBoxSubmitted: {
    backgroundColor: "#ECFDF5",
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  templateName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    flex: 1,
    marginRight: 6,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  statusPillPending: {
    backgroundColor: "#FEF9C3",
    borderColor: "#FDE047",
  },
  statusPillDraft: {
    backgroundColor: "#FBEFD8",
    borderColor: "#FDE68A",
  },
  statusPillSubmitted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  statusPillTextPending: {
    color: "#854D0E",
  },
  statusPillTextDraft: {
    color: "#D08C1F",
  },
  statusPillTextSubmitted: {
    color: "#2E7D5B",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
    flexWrap: "wrap",
  },
  freqPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  freqPillText: {
    fontSize: 9.5,
    fontWeight: "600",
  },
  targetText: {
    fontSize: 10,
    color: "#3B5BB5",
    fontWeight: "500",
  },
  dueText: {
    fontSize: 10,
    fontWeight: "500",
    flexShrink: 1,
  },
  dueTextPending: {
    color: "#92400E",
  },
  dueTextDraft: {
    color: "#D08C1F",
  },
  dueTextSubmitted: {
    color: "#2E7D5B",
  },
  nextFillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  nextFillText: {
    fontSize: 9.5,
    color: "#2E7D5B",
    fontWeight: "500",
  },
  chevronBox: {
    paddingLeft: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
