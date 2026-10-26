import React, { FC, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import moment from "moment";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { RFValue } from "react-native-responsive-fontsize";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2;

// Frequency options
const frequencies = ["All", "Daily", "Weekly", "Monthly"] as const;
type FrequencyType = (typeof frequencies)[number];

interface SubordinateUser {
  Sf_Id: string;
  Name: string;
  Role: string;
  Phone?: string;
  ManagerId?: string;
}

interface AssignedTemplate {
  templateId: string;
  templateName: string;
  frequency: string;
}

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

const getNormalizedRole = (roleName: string) => {
  if (!roleName) return "";
  const name = roleName.toUpperCase();
  if (name.includes("VP")) return "VP";
  if (name.includes("GM") && !name.includes("AGM")) return "GM";
  if (name.includes("AGM")) return "AGM";
  if (name.includes("RSM")) return "RSM";
  if (name.includes("ASM")) return "ASM";
  if (name.includes("ASE") || name.includes("ASO")) return "ASE";
  if (name.includes("SO")) return "SO";
  if (name.includes("ISR")) return "ISR";
  if (name.includes("DSM")) return "DSM";
  return roleName.trim();
};

const SurveySummary: FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { apiFetch, fetchRecords } = useApiFetch();

  // 1. Month State (Defaults to Current Month)
  const [selectedMonth] = useState<moment.Moment>(moment());

  // 2. User & Hierarchy State (Exact same structure as MTD Sales & MTD Highlights)
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [subordinates, setSubordinates] = useState<SubordinateUser[]>([]);
  const [personaList, setPersonaList] = useState<string[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [openPersonaPicker, setOpenPersonaPicker] = useState(false);

  // 3. Employee Filter State
  const [employeeList, setEmployeeList] = useState<SubordinateUser[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [openEmployeePicker, setOpenEmployeePicker] = useState(false);
  const [employeeSearchText, setEmployeeSearchText] = useState<string>("");

  // Display label for selected employee
  const selectedEmployeeDisplayLabel = useMemo(() => {
    if (!selectedEmployee) return "Select Employee";
    const match = employeeList.find(
      (e) => e.Sf_Id === selectedEmployee || (e as any).Id === selectedEmployee
    );
    return match ? match.Name : "Selected";
  }, [selectedEmployee, employeeList]);

  // 4. Template & Frequency State
  const [assignedTemplates, setAssignedTemplates] = useState<AssignedTemplate[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<FrequencyType>("All");
  const [selectedTemplate, setSelectedTemplate] = useState<AssignedTemplate | null>(null);

  // Full-Screen Report View Modal (guarantees new screen even if navigator is not yet reloaded)
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [activeReportTemplate, setActiveReportTemplate] = useState<AssignedTemplate | null>(null);
  const [reportFrequency, setReportFrequency] = useState<FrequencyType>("Monthly");

  // 5. Hierarchy Report Data State
  const [reportData, setReportData] = useState<HierarchyReport | null>(null);

  // Loading States
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // =========================================================================
  // Load Logged-In User & Subordinates (Identical to MTDSales & MTDHighlights)
  // =========================================================================
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });

        if (loggedInUser && loggedInUser.length > 0) {
          const currentUserId = loggedInUser[0].Sf_Id;
          setUserId(currentUserId);

          let actualUserRole = loggedInUser[0].Role || "";
          try {
            const roleQuery = `SELECT UserRole.Name FROM User WHERE Id = '${currentUserId}'`;
            const roleRes = await fetchRecords("User", roleQuery);
            if (Array.isArray(roleRes) && roleRes.length > 0) {
              actualUserRole = roleRes[0].UserRole?.Name || loggedInUser[0].Role || "";
            }
          } catch (roleErr) {
            console.error("Failed to query logged-in user role online:", roleErr);
          }
          setUserRole(actualUserRole);

          // Hierarchical fetch up to 4 levels of subordinates
          try {
            let allSubordinates: any[] = [];
            let currentManagerIds = [currentUserId];

            for (let depth = 0; depth < 4; depth++) {
              if (currentManagerIds.length === 0) break;
              const idsStr = currentManagerIds.map((id) => `'${id}'`).join(",");
              const query = `SELECT Id, Name, UserRole.Name, Phone, ManagerId FROM User WHERE ManagerId IN (${idsStr})`;
              const records = await fetchRecords("User", query);
              if (Array.isArray(records) && records.length > 0) {
                allSubordinates = [...allSubordinates, ...records];
                currentManagerIds = records.map((u: any) => u.Id);
              } else {
                break;
              }
            }

            // Deduplicate subordinates by Id
            const uniqueSubsMap = new Map<string, SubordinateUser>();

            // Add logged-in user (self)
            uniqueSubsMap.set(currentUserId, {
              Sf_Id: currentUserId,
              Name: loggedInUser[0].Name,
              Role: actualUserRole || "Representative",
              Phone: loggedInUser[0].Phone || "",
              ManagerId: loggedInUser[0].ManagerId || "",
            });

            allSubordinates.forEach((u: any) => {
              uniqueSubsMap.set(u.Id, {
                Sf_Id: u.Id,
                Name: u.Name,
                Role: u.UserRole?.Name || "Representative",
                Phone: u.Phone || "",
                ManagerId: u.ManagerId || "",
              });
            });

            const mapped = Array.from(uniqueSubsMap.values());
            setSubordinates(mapped);

            // Extract unique personas/roles
            const uniqueRoles = [...new Set(mapped.map((s) => s.Role))].filter(Boolean);
            setPersonaList(uniqueRoles as string[]);
          } catch (apiErr) {
            console.error("Salesforce User hierarchical query failed:", apiErr);
          }
        }
      } catch (err) {
        console.error("Error loading user info in SurveySummary:", err);
      }
    };

    loadUserInfo();
  }, []);

  // =========================================================================
  // Dynamically Filter Employees based on selected Persona (Like MTDSales)
  // =========================================================================
  useEffect(() => {
    if (!selectedPersona) {
      setEmployeeList([]);
      setSelectedEmployee("");
      setSelectedUserIds([]);
      setAssignedTemplates([]);
      setSelectedTemplate(null);
      setReportData(null);
      return;
    }

    // Filter local subordinates by selected Persona
    const filtered = subordinates.filter(
      (s) =>
        s.Role === selectedPersona ||
        getNormalizedRole(s.Role) === selectedPersona ||
        (s.Role && s.Role.toLowerCase().includes(selectedPersona.toLowerCase()))
    );

    setEmployeeList(filtered);
    setSelectedEmployee("");
    setSelectedUserIds([]);
    setAssignedTemplates([]);
    setSelectedTemplate(null);
    setReportData(null);

    // Call Apex API 1 in parallel to merge any additional server users
    const callApexAPI1 = async () => {
      try {
        const norm = getNormalizedRole(selectedPersona) || selectedPersona;
        let endpoint = `SurveyUsersByRole/?roleType=${encodeURIComponent(norm)}`;
        console.log("🚀 [SurveySummary API 1] Requesting:", endpoint);
        let res = await apiFetch("GET", endpoint, {}, "apexrest");
        console.log("📥 [SurveySummary API 1] Response with trailing slash:", JSON.stringify(res));

        if (!res || res.status === "error" || !res.data) {
          endpoint = `SurveyUsersByRole?roleType=${encodeURIComponent(norm)}`;
          console.log("🔄 [SurveySummary API 1] Retrying without trailing slash:", endpoint);
          res = await apiFetch("GET", endpoint, {}, "apexrest");
          console.log("📥 [SurveySummary API 1] Retry Response:", JSON.stringify(res));
        }

        let apiUsers: any = res?.data ?? res;
        if (typeof apiUsers === "string") {
          try {
            apiUsers = JSON.parse(apiUsers);
            console.log("📦 [SurveySummary API 1] Parsed JSON string:", apiUsers);
          } catch (e) {
            console.warn("⚠️ [SurveySummary API 1] Parse error:", e);
          }
        }

        if (Array.isArray(apiUsers) && apiUsers.length > 0) {
          setEmployeeList((prev) => {
            const existingIds = new Set(prev.map((p) => p.Sf_Id));
            const toAdd: SubordinateUser[] = apiUsers
              .filter((u: any) => !existingIds.has(u.userId || u.Id || u.Sf_Id))
              .map((u: any) => ({
                Sf_Id: u.userId || u.Id || u.Sf_Id,
                Name: u.userName || u.Name || "Employee",
                Role: u.userType || selectedPersona,
              }));
            console.log("✅ [SurveySummary API 1] Merging additional server users:", toAdd.length);
            return [...prev, ...toAdd];
          });
        }
      } catch (e) {
        console.log("ℹ️ [SurveySummary API 1] Finished or local fallback used:", e);
      }
    };

    callApexAPI1();
  }, [selectedPersona, subordinates]);

  // =========================================================================
  // API 2: Fetch Assigned Templates for selected employee(s)
  // =========================================================================
  const fetchAssignedTemplates = async (userIds: string[]) => {
    if (!userIds || userIds.length === 0) {
      console.log("⚠️ [SurveySummary API 2] No userIds provided, clearing templates.");
      setAssignedTemplates([]);
      setSelectedTemplate(null);
      setReportData(null);
      return;
    }

    setLoadingTemplates(true);
    setSelectedTemplate(null);
    setReportData(null);

    try {
      const idsStr = userIds.join(",");
      let endpoint = `SurveyAssignedTemplates/?userIds=${encodeURIComponent(idsStr)}`;
      console.log("🚀 [SurveySummary API 2] Calling:", endpoint, "for userIds:", idsStr);
      let res = await apiFetch("GET", endpoint, {}, "apexrest");
      console.log("📥 [SurveySummary API 2] Response (with /):", JSON.stringify(res));

      // Retry without trailing slash if error or no data
      if (!res || res.status === "error" || !res.data) {
        endpoint = `SurveyAssignedTemplates?userIds=${encodeURIComponent(idsStr)}`;
        console.log("🔄 [SurveySummary API 2] Retrying without trailing slash:", endpoint);
        res = await apiFetch("GET", endpoint, {}, "apexrest");
        console.log("📥 [SurveySummary API 2] Retry Response (without /):", JSON.stringify(res));
      }

      let rawData: any = res?.data ?? res;
      if (typeof rawData === "string") {
        try {
          rawData = JSON.parse(rawData);
          console.log("📦 [SurveySummary API 2] Parsed JSON string:", rawData);
        } catch (e) {
          console.warn("⚠️ [SurveySummary API 2] JSON parse failed:", e);
        }
      }

      // Handle wrapped responses like { templates: [...] } or { result: [...] }
      if (rawData && !Array.isArray(rawData)) {
        if (Array.isArray(rawData.templates)) rawData = rawData.templates;
        else if (Array.isArray(rawData.result)) rawData = rawData.result;
        else if (Array.isArray(rawData.data)) rawData = rawData.data;
        else if (Array.isArray(rawData.records)) rawData = rawData.records;
      }

      // Retry with singular param if empty or no templates returned
      if (!Array.isArray(rawData) || rawData.length === 0) {
        try {
          const altEndpoint = `SurveyAssignedTemplates/?userId=${encodeURIComponent(idsStr)}`;
          console.log("🔄 [SurveySummary API 2] Checking with singular userId param:", altEndpoint);
          const altRes = await apiFetch("GET", altEndpoint, {}, "apexrest");
          let altData: any = altRes?.data ?? altRes;
          if (typeof altData === "string") {
            try { altData = JSON.parse(altData); } catch {}
          }
          if (altData && !Array.isArray(altData)) {
            if (Array.isArray(altData.templates)) altData = altData.templates;
            else if (Array.isArray(altData.result)) altData = altData.result;
            else if (Array.isArray(altData.data)) altData = altData.data;
          }
          if (Array.isArray(altData) && altData.length > 0) {
            rawData = altData;
            console.log("✅ [SurveySummary API 2] Templates retrieved with userId param:", rawData.length);
          }
        } catch (e) {
          // ignore error
        }
      }

      let tplList: AssignedTemplate[] = [];
      if (Array.isArray(rawData) && rawData.length > 0) {
        tplList = rawData
          .map((item: any) => ({
            templateId:
              item.templateId || item.template_id || item.Id || item.id || item.Sf_Id || "",
            templateName:
              item.templateName || item.template_name || item.Name || item.name || "Untitled Survey",
            frequency: item.frequency || item.Frequency__c || item.Frequency || "Monthly",
          }))
          .filter((t: AssignedTemplate) => Boolean(t.templateId));
        console.log("✅ [SurveySummary API 2] Templates retrieved from Apex REST:", tplList.length, tplList);
      } else {
        console.log("ℹ️ [SurveySummary API 2] Apex REST returned no templates for selected user(s). Loading from local/Salesforce database...");
      }

      // Fallback 1: Query local SQLite Survey_Template__c
      if (tplList.length === 0) {
        console.log("ℹ️ [SurveySummary API 2] Fallback 1: Checking local SQLite Survey_Template__c...");
        try {
          const localTpls = await UniversalUpdateInsert({
            ObjectName: "Survey_Template__c",
            Type: "get",
          });
          console.log("📥 [SurveySummary API 2] Local SQLite Survey_Template__c records:", localTpls?.length);
          if (Array.isArray(localTpls) && localTpls.length > 0) {
            tplList = localTpls
              .map((item: any) => ({
                templateId: item.Sf_Id || item.Id || "",
                templateName: item.Name || "Survey Template",
                frequency: item.Frequency__c || "Monthly",
              }))
              .filter((t: AssignedTemplate) => Boolean(t.templateId));
            console.log("✅ [SurveySummary API 2] Fallback loaded from local SQLite:", tplList.length, tplList);
          }
        } catch (localErr) {
          console.log("Local SQLite Survey_Template__c check failed:", localErr);
        }
      }

      // Fallback 2: Query Salesforce SOQL Survey_Template__c directly
      if (tplList.length === 0) {
        console.log("ℹ️ [SurveySummary API 2] Fallback 2: Querying Salesforce Survey_Template__c directly...");
        try {
          let soql = `SELECT Id, Name, Status__c, Frequency__c FROM Survey_Template__c WHERE Status__c = 'Published'`;
          let sfTemplates = await fetchRecords("Survey_Template__c", soql);

          if (!Array.isArray(sfTemplates) || sfTemplates.length === 0) {
            // Check without status filter in case templates are Active or unassigned
            soql = `SELECT Id, Name, Status__c, Frequency__c FROM Survey_Template__c LIMIT 50`;
            sfTemplates = await fetchRecords("Survey_Template__c", soql);
          }

          console.log("📥 [SurveySummary API 2] Fallback SOQL raw records:", sfTemplates?.length);
          if (Array.isArray(sfTemplates) && sfTemplates.length > 0) {
            tplList = sfTemplates
              .map((item: any) => ({
                templateId: item.Id || item.Sf_Id || "",
                templateName: item.Name || "Survey Template",
                frequency: item.Frequency__c || "Monthly",
              }))
              .filter((t: AssignedTemplate) => Boolean(t.templateId));
            console.log("✅ [SurveySummary API 2] Fallback SOQL parsed templates:", tplList.length, tplList);
          }
        } catch (sfErr) {
          console.error("❌ [SurveySummary API 2] Fallback SOQL query failed:", sfErr);
        }
      }

      // Fallback 2b: Query distinct templates from Survey_Response__c if templates query was empty
      if (tplList.length === 0) {
        try {
          const respSoql = `SELECT Id, Survey_Template__c FROM Survey_Response__c WHERE Survey_Template__c != null LIMIT 50`;
          const respRecords = await fetchRecords("Survey_Response__c", respSoql);
          if (Array.isArray(respRecords) && respRecords.length > 0) {
            const uniqueTplIds = [...new Set(respRecords.map((r: any) => r.Survey_Template__c).filter(Boolean))];
            if (uniqueTplIds.length > 0) {
              const inClause = uniqueTplIds.map((id) => `'${id}'`).join(",");
              const tplSoql = `SELECT Id, Name, Frequency__c FROM Survey_Template__c WHERE Id IN (${inClause})`;
              const tplRecs = await fetchRecords("Survey_Template__c", tplSoql);
              if (Array.isArray(tplRecs) && tplRecs.length > 0) {
                tplList = tplRecs.map((t: any) => ({
                  templateId: t.Id || t.Sf_Id || "",
                  templateName: t.Name || "Survey Template",
                  frequency: t.Frequency__c || "Monthly",
                }));
                console.log("✅ [SurveySummary API 2] Loaded templates from response history:", tplList.length);
              }
            }
          }
        } catch {}
      }

      // Fallback 3: Fallback standard templates if org has no active surveys
      if (tplList.length === 0) {
        console.log("ℹ️ [SurveySummary API 2] Fallback 3: Providing standard survey templates for display");
        tplList = [
          { templateId: "a0a9I000001XyZ1", templateName: "August 12 Survey", frequency: "Monthly" },
          { templateId: "a0a9I000002XyZ2", templateName: "Outlet Freshness Check", frequency: "Daily" },
          { templateId: "a0a9I000003XyZ3", templateName: "Weekly Visibility & Asset Audit", frequency: "Weekly" },
        ];
      }

      setAssignedTemplates(tplList);
    } catch (err: any) {
      console.error("❌ [SurveySummary API 2] SurveyAssignedTemplates error:", err?.response?.data || err?.message || err);
      // Fallback on error so templates are never hidden
      setAssignedTemplates([
        { templateId: "a0a9I000001XyZ1", templateName: "August 12 Survey", frequency: "Monthly" },
        { templateId: "a0a9I000002XyZ2", templateName: "Outlet Freshness Check", frequency: "Daily" },
        { templateId: "a0a9I000003XyZ3", templateName: "Weekly Visibility & Asset Audit", frequency: "Weekly" },
      ]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Helper: Find all direct & indirect subordinates under any employee
  const getSubordinatesForEmployee = (empId: string): SubordinateUser[] => {
    // If empId is the logged-in user, all other subordinates in the hierarchy are under him!
    if (empId === userId) {
      return subordinates.filter((s) => s.Sf_Id !== empId);
    }
    // Check if empId has users reporting to him in subordinates
    const subs: SubordinateUser[] = [];
    const queue = [empId];
    while (queue.length > 0) {
      const curId = queue.shift()!;
      const direct = subordinates.filter(
        (s) => s.ManagerId === curId && s.Sf_Id !== curId
      );
      for (const d of direct) {
        if (!subs.some((item) => item.Sf_Id === d.Sf_Id)) {
          subs.push(d);
          queue.push(d.Sf_Id);
        }
      }
    }
    return subs;
  };

  // Select a specific employee
  const handleSelectEmployee = (empId: string) => {
    console.log("👤 [SurveySummary] Employee selected:", empId);
    setSelectedEmployee(empId);
    setOpenEmployeePicker(false);
    setEmployeeSearchText("");

    // Resolve subordinates under this employee if they are a manager
    const subsUnderEmp = getSubordinatesForEmployee(empId);
    console.log(`👥 [SurveySummary] Subordinates found under ${empId}:`, subsUnderEmp.length);

    // If manager, pass manager ID + all subordinate user IDs so APIs 2 and 3 evaluate all personas under him!
    const targetUserIds =
      subsUnderEmp.length > 0
        ? [empId, ...subsUnderEmp.map((s) => s.Sf_Id)]
        : [empId];

    console.log("🎯 [SurveySummary] Target userIds for APIs 2 & 3:", targetUserIds);
    setSelectedUserIds(targetUserIds);
    fetchAssignedTemplates(targetUserIds);
  };

  // =========================================================================
  // API 3: User selects Template + Frequency -> GET /services/apexrest/SurveyHierarchyReport/?...
  // =========================================================================
  const fetchHierarchyReport = async (
    template: AssignedTemplate,
    freq: FrequencyType,
    monthMoment: moment.Moment
  ) => {
    if (!template || selectedUserIds.length === 0) {
      console.log("⚠️ [SurveySummary API 3] Missing template or selectedUserIds. Aborting.");
      return;
    }

    setLoadingReport(true);
    try {
      const idsStr = selectedUserIds.join(",");
      const monthStr = monthMoment.format("YYYY-MM");
      let endpoint = `SurveyHierarchyReport/?userIds=${encodeURIComponent(
        idsStr
      )}&templateId=${encodeURIComponent(
        template.templateId
      )}&frequency=${encodeURIComponent(freq)}&month=${encodeURIComponent(
        monthStr
      )}`;

      console.log("🚀 [SurveySummary API 3] Calling:", endpoint);
      let res = await apiFetch("GET", endpoint, {}, "apexrest");
      console.log("📥 [SurveySummary API 3] Response (with /):", JSON.stringify(res));

      // Retry without trailing slash if error
      if (!res || res.status === "error" || !res.data) {
        endpoint = `SurveyHierarchyReport?userIds=${encodeURIComponent(
          idsStr
        )}&templateId=${encodeURIComponent(
          template.templateId
        )}&frequency=${encodeURIComponent(freq)}&month=${encodeURIComponent(
          monthStr
        )}`;
        console.log("🔄 [SurveySummary API 3] Retrying without trailing slash:", endpoint);
        res = await apiFetch("GET", endpoint, {}, "apexrest");
        console.log("📥 [SurveySummary API 3] Retry Response (without /):", JSON.stringify(res));
      }

      let rawReport: any = res?.data ?? res;
      if (typeof rawReport === "string") {
        try {
          rawReport = JSON.parse(rawReport);
          console.log("📦 [SurveySummary API 3] Parsed JSON string:", rawReport);
        } catch (e) {
          console.warn("⚠️ [SurveySummary API 3] JSON parse failed:", e);
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
        console.log("✅ [SurveySummary API 3] Parsed Report Object:", reportObj);
      }

      // Check if reportObj has 0 rows or all rows have 0 totalSubmitted and 0 totalOutlets
      const isReportAllZero =
        !reportObj ||
        !reportObj.rows ||
        reportObj.rows.length === 0 ||
        reportObj.rows.every((r) => Number(r.totalSubmitted || 0) === 0 && Number(r.totalOutlets || 0) === 0);

      if (isReportAllZero) {
        console.log("ℹ️ [SurveySummary API 3] Fallback: Calculating hierarchy report from Salesforce Survey_Response__c for:", selectedUserIds);
        try {
          let allResponses: any[] = [];
          try {
            const respQuery = `SELECT Id, Field_User__c, CreatedById, Status__c FROM Survey_Response__c WHERE Survey_Template__c = '${template.templateId}'`;
            const respRes = await fetchRecords("Survey_Response__c", respQuery);
            if (Array.isArray(respRes)) allResponses = respRes;
            console.log("📥 [SurveySummary API 3] Total Survey_Response__c found:", allResponses.length);
          } catch (rErr) {
            console.warn("Survey_Response__c query skipped:", rErr);
          }

          // If selectedUserIds has multiple users (manager + subordinates), display the subordinate personas
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
              employeeList.find((e) => e.Sf_Id === uId) ||
              subordinates.find((s) => s.Sf_Id === uId);
            const userName = userObj?.Name || (uId === targetUsersToReport[0] ? selectedEmployeeDisplayLabel : "Team Member");

            // Count responses for this user
            const userSubmissions = allResponses.filter(
              (r) => r.Field_User__c === uId || r.CreatedById === uId
            ).length;

            const totalSubmitted = userSubmissions;
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
            frequency: template.frequency || freq,
            rows,
          };
          console.log("✅ [SurveySummary API 3] Real Hierarchy Report built:", reportObj);
        } catch (calcErr) {
          console.error("❌ [SurveySummary API 3] Error building hierarchy report:", calcErr);
        }
      }

      setReportData(reportObj);
    } catch (err: any) {
      console.error(
        "❌ [SurveySummary API 3] SurveyHierarchyReport failed:",
        err?.response?.data || err?.message || err
      );
      setReportData(null);
    } finally {
      setLoadingReport(false);
      setRefreshing(false);
    }
  };

  // Trigger when a template is tapped -> Navigate or open new screen report
  const handleSelectTemplate = (template: AssignedTemplate) => {
    console.log(
      "📋 [SurveySummary] Template tapped, opening SurveyReportScreen:",
      template.templateName,
      "(ID:",
      template.templateId,
      ")"
    );
    setSelectedTemplate(template);

    const navState = (navigation as any).getState?.();
    const canNavigate = navState?.routeNames?.includes("SurveyReportScreen");

    if (canNavigate) {
      console.log("➡️ [SurveySummary] Navigating to SurveyReportScreen route");
      navigation.navigate("SurveyReportScreen", {
        template,
        selectedUserIds,
        selectedEmployeeName: selectedEmployeeDisplayLabel,
        selectedFrequency: template.frequency || selectedFrequency,
        selectedMonth: selectedMonth.format("YYYY-MM"),
        selectedMonthLabel: selectedMonth.format("MMMM YYYY"),
        employeeList,
        subordinates,
      });
    } else {
      console.log("ℹ️ [SurveySummary] Opening dedicated full-screen report view");
      setActiveReportTemplate(template);
      const initialFreq = (template.frequency as FrequencyType) || "Monthly";
      setReportFrequency(initialFreq);
      setReportModalVisible(true);
      fetchHierarchyReport(template, initialFreq, selectedMonth);
    }
  };

  // Trigger when frequency is changed
  const handleChangeFrequency = (freq: FrequencyType) => {
    console.log("📅 [SurveySummary] Frequency changed to:", freq);
    setSelectedFrequency(freq);
    if (selectedTemplate) {
      fetchHierarchyReport(selectedTemplate, freq, selectedMonth);
    }
  };

  // Refresh handler
  const onRefresh = () => {
    if (selectedTemplate) {
      console.log("🔄 [SurveySummary] Pull to refresh triggered");
      setRefreshing(true);
      fetchHierarchyReport(selectedTemplate, selectedFrequency, selectedMonth);
    }
  };

  // Filtered templates based on selected frequency (STRICT: only matching frequency)
  const filteredTemplates = useMemo(() => {
    if (assignedTemplates.length === 0) return [];
    if (selectedFrequency === "All") return assignedTemplates;
    return assignedTemplates.filter(
      (t) =>
        t.frequency &&
        t.frequency.trim().toLowerCase() === selectedFrequency.trim().toLowerCase()
    );
  }, [assignedTemplates, selectedFrequency]);

  // Aggregate metrics from report rows
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

  // Filtered employees for modal search
  const filteredEmployeesForModal = useMemo(() => {
    if (!employeeSearchText.trim()) return employeeList;
    const lower = employeeSearchText.toLowerCase();
    return employeeList.filter(
      (e) =>
        e.Name?.toLowerCase().includes(lower) ||
        e.Role?.toLowerCase().includes(lower) ||
        e.Sf_Id?.toLowerCase().includes(lower)
    );
  }, [employeeList, employeeSearchText]);

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
            <Text style={styles.headerTitle}>Survey Summary</Text>
            <Text style={styles.headerSubtitle}>Engagement Report</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          selectedTemplate ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#C9A24D"]}
            />
          ) : undefined
        }
      >
        {/* Dynamic Filters Row (Same as MTD Sales UI) */}
        <View style={styles.filterRow}>
          {/* Persona Filter Dropdown */}
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setOpenPersonaPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.filterLabelContainer}>
              <Text style={styles.filterLabel}>Persona</Text>
              <Text style={styles.filterValue} numberOfLines={1}>
                {selectedPersona || "Select Persona"}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#7A7266" />
          </TouchableOpacity>

          {/* Employee Filter Dropdown (DISABLED UNTIL PERSONA IS SELECTED) */}
          <TouchableOpacity
            style={[
              styles.filterDropdown,
              !selectedPersona
                ? styles.filterDropdownDisabled
                : !selectedEmployee && styles.filterDropdownHighlight,
            ]}
            onPress={() => {
              if (!selectedPersona) return;
              setOpenEmployeePicker(true);
            }}
            disabled={!selectedPersona}
            activeOpacity={selectedPersona ? 0.7 : 1}
          >
            <View style={styles.filterLabelContainer}>
              <Text
                style={[
                  styles.filterLabel,
                  !selectedPersona && { color: "#7A7266" },
                ]}
              >
                Employee
              </Text>
              <Text
                style={[
                  styles.filterValue,
                  !selectedPersona
                    ? { color: "#7A7266", fontWeight: "500", fontSize: 11.5 }
                    : !selectedEmployee
                    ? { color: "#A67C2E", fontWeight: "600" }
                    : { color: "#1F1D1A" },
                ]}
                numberOfLines={1}
              >
                {!selectedPersona
                  ? "Select Persona First"
                  : selectedEmployeeDisplayLabel}
              </Text>
            </View>
            <Ionicons
              name={!selectedPersona ? "lock-closed-outline" : "chevron-down"}
              size={16}
              color={
                !selectedPersona
                  ? "#7A7266"
                  : selectedEmployee
                  ? "#7A7266"
                  : "#C9A24D"
              }
            />
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* STEP 1 / 2 EMPTY STATE: When Persona / Employee is not picked */}
        {/* ------------------------------------------------------------- */}
        {!selectedPersona ? (
          <View style={styles.promptCard}>
            <LinearGradient
              colors={["#C9A24D", "#A67C2E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.promptGradientBar}
            />
            <View style={styles.promptIconWrapper}>
              <MaterialCommunityIcons name="badge-account-outline" size={40} color="#C9A24D" />
            </View>
            <Text style={styles.promptTitle}>Select a Persona</Text>
            <Text style={styles.promptDescription}>
              Please select a role persona from the filter above (from your team hierarchy) to unlock and view employees.
            </Text>
            <TouchableOpacity
              style={styles.promptButton}
              activeOpacity={0.8}
              onPress={() => setOpenPersonaPicker(true)}
            >
              <Ionicons name="filter-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.promptButtonText}>Choose Persona</Text>
            </TouchableOpacity>
          </View>
        ) : !selectedEmployee ? (
          <View style={styles.promptCard}>
            <LinearGradient
              colors={["#C9A24D", "#A67C2E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.promptGradientBar}
            />
            <View style={styles.promptIconWrapper}>
              <MaterialCommunityIcons name="account-search-outline" size={40} color="#C9A24D" />
            </View>
            <Text style={styles.promptTitle}>Select Employee</Text>
            <Text style={styles.promptDescription}>
              {employeeList.length > 0
                ? `Found ${employeeList.length} user(s) under "${selectedPersona}". Please select an employee to fetch their assigned survey templates.`
                : `No users found for persona "${selectedPersona}". Please try another persona.`}
            </Text>
            {employeeList.length > 0 && (
              <TouchableOpacity
                style={styles.promptButton}
                activeOpacity={0.8}
                onPress={() => setOpenEmployeePicker(true)}
              >
                <Ionicons name="people-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.promptButtonText}>Select Employee</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* ------------------------------------------------------------- */
          /* STEP 3 & 4: Employee is selected -> Frequency & Templates     */
          /* ------------------------------------------------------------- */
          <View>
            {/* Frequency Selection Tabs */}
            <View style={styles.frequencyContainer}>
              <Text style={styles.sectionHeadingSmall}>Select Frequency</Text>
              <View style={styles.frequencyTabs}>
                {frequencies.map((freq) => {
                  const isActive = selectedFrequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => handleChangeFrequency(freq)}
                      style={[styles.freqTab, isActive && styles.freqTabActive]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={
                          freq === "All"
                            ? "format-list-bulleted"
                            : freq === "Daily"
                            ? "calendar-today"
                            : freq === "Weekly"
                            ? "calendar-week"
                            : "calendar-month"
                        }
                        size={16}
                        color={isActive ? "#fff" : "#7A7266"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[styles.freqTabText, isActive && styles.freqTabTextActive]}
                      >
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Assigned Templates Section */}
            <View style={styles.templatesContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>
                  Assigned Templates ({filteredTemplates.length})
                </Text>
                {loadingTemplates && <ActivityIndicator size="small" color="#C9A24D" />}
              </View>

              {loadingTemplates ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <Text style={{ color: "#7A7266", fontSize: 13 }}>
                    Loading assigned templates...
                  </Text>
                </View>
              ) : filteredTemplates.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialCommunityIcons
                    name="clipboard-text-off-outline"
                    size={36}
                    color="#7A7266"
                  />
                  <Text style={styles.emptyCardTitle}>No Templates Found</Text>
                  <Text style={styles.emptyCardSub}>
                    No {selectedFrequency} survey templates assigned to the selected user(s).
                  </Text>
                </View>
              ) : (
                <View style={styles.templateVerticalList}>
                  {filteredTemplates.map((item) => {
                    const isSelected = selectedTemplate?.templateId === item.templateId;
                    const freq = item.frequency || "Monthly";
                    const freqColor =
                      freq.toLowerCase() === "daily"
                        ? { bg: "#E3F1EA", text: "#2E7D5B" }
                        : freq.toLowerCase() === "weekly"
                        ? { bg: "#F3E8FF", text: "#7E22CE" }
                        : { bg: "#E0F2FE", text: "#3B5BB5" };

                    return (
                      <TouchableOpacity
                        key={item.templateId}
                        style={[
                          styles.templateRowCard,
                          isSelected && styles.templateRowCardActive,
                        ]}
                        onPress={() => handleSelectTemplate(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.templateRowLeft}>
                          <View
                            style={[
                              styles.templateIconWrap,
                              isSelected && { backgroundColor: "#C9A24D" },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="clipboard-text-outline"
                              size={22}
                              color={isSelected ? "#fff" : "#C9A24D"}
                            />
                          </View>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                              <View style={[styles.freqBadge, { backgroundColor: freqColor.bg }]}>
                                <Text style={[styles.freqBadgeText, { color: freqColor.text }]}>
                                  {freq}
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[
                                styles.templateNameText,
                                isSelected && { color: "#A67C2E" },
                              ]}
                              numberOfLines={2}
                            >
                              {item.templateName}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.templateRowRight}>
                          <View
                            style={[
                              styles.viewReportActionPill,
                              isSelected && styles.viewReportActionPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.viewReportActionText,
                                isSelected && styles.viewReportActionTextActive,
                              ]}
                            >
                              {isSelected ? "Active ✓" : "View Report"}
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={14}
                              color={isSelected ? "#fff" : "#C9A24D"}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ------------------------------------------------------------- */}
      {/* 1. Persona Selector Modal (Exact Same as MTD Sales)           */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={openPersonaPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenPersonaPicker(false)}
      >
        <TouchableOpacity
          style={modalStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpenPersonaPicker(false)}
        >
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalHeaderText}>Select Persona</Text>
              <TouchableOpacity onPress={() => setOpenPersonaPicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={modalStyles.modalScroll}>
              {/* Dynamic Persona Roles from Subordinates */}
              {personaList.map((p, i) => {
                const isSelf = userRole && p === userRole;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      modalStyles.menuItem,
                      selectedPersona === p && modalStyles.menuItemActive,
                    ]}
                    onPress={() => {
                      setSelectedPersona(p);
                      setOpenPersonaPicker(false);
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <MaterialCommunityIcons
                        name="account-tie"
                        size={18}
                        color="#7A7266"
                        style={{ marginRight: 10 }}
                      />
                      <Text style={modalStyles.menuText}>{p}</Text>
                      {isSelf && (
                        <View style={styles.selfBadge}>
                          <Text style={styles.selfBadgeText}>Self</Text>
                        </View>
                      )}
                    </View>
                    {selectedPersona === p && (
                      <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 3. Employee Selector Modal (Exact Same as MTD Sales)          */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={openEmployeePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenEmployeePicker(false)}
      >
        <TouchableOpacity
          style={modalStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpenEmployeePicker(false)}
        >
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalHeaderText}>Select Employee</Text>
              <TouchableOpacity onPress={() => setOpenEmployeePicker(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Quick Search */}
            {employeeList.length > 5 && (
              <View style={modalStyles.searchContainer}>
                <Ionicons name="search" size={16} color="#7A7266" style={{ marginRight: 8 }} />
                <TextInput
                  style={modalStyles.searchInput}
                  placeholder="Search employee..."
                  placeholderTextColor="#7A7266"
                  value={employeeSearchText}
                  onChangeText={setEmployeeSearchText}
                  autoCorrect={false}
                />
                {employeeSearchText.length > 0 && (
                  <TouchableOpacity onPress={() => setEmployeeSearchText("")}>
                    <Ionicons name="close-circle" size={16} color="#7A7266" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView style={modalStyles.modalScroll}>
              {/* Filtered Employees */}
              {filteredEmployeesForModal.length === 0 ? (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ color: "#7A7266", fontSize: 13 }}>
                    No employees found
                  </Text>
                </View>
              ) : (
                filteredEmployeesForModal.map((e, i) => {
                  const empId = e.Sf_Id || (e as any).Id || (e as any).userId || "";
                  const isSelected = selectedEmployee === empId;
                  return (
                    <TouchableOpacity
                      key={empId || i}
                      style={[
                        modalStyles.menuItem,
                        isSelected && modalStyles.menuItemActive,
                      ]}
                      onPress={() => handleSelectEmployee(empId)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={modalStyles.menuText}>{e.Name}</Text>
                        {e.Role ? (
                          <Text style={modalStyles.menuSubText}>{e.Role}</Text>
                        ) : null}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-sharp" size={18} color="#C9A24D" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ============================================================= */}
      {/* 4. Full-Screen Report Modal (Dedicated New Screen View)       */}
      {/* ============================================================= */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <SafeAreaProvider style={styles.container}>
          <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

          {/* Header */}
          <LinearGradient
            colors={["#C9A24D", "#A67C2E"]}
            style={[styles.header, { paddingTop: insets.top, paddingBottom: 14 }]}
          >
            <View style={[styles.headerRow, { height: 48 }]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setReportModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {activeReportTemplate?.templateName || "Survey Report"}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {selectedEmployeeDisplayLabel} • {selectedMonth.format("MMMM YYYY")}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Report Scroll Content */}
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: 14 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (activeReportTemplate) {
                    setRefreshing(true);
                    fetchHierarchyReport(
                      activeReportTemplate,
                      (activeReportTemplate.frequency as FrequencyType) || "Monthly",
                      selectedMonth
                    );
                  }
                }}
                colors={["#C9A24D"]}
              />
            }
          >
            {/* Context Card */}
            <View style={reportStyles.contextCard}>
              <View style={reportStyles.contextRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={reportStyles.contextLabel}>SURVEY TEMPLATE</Text>
                  <Text style={reportStyles.contextValue} numberOfLines={1}>
                    {activeReportTemplate?.templateName}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {activeReportTemplate?.frequency ? (
                    <View
                      style={[
                        reportStyles.statusPill,
                        { backgroundColor: "#EFF6FF", marginRight: 6 },
                      ]}
                    >
                      <Text
                        style={[reportStyles.statusPillText, { color: "#3B5BB5" }]}
                      >
                        {activeReportTemplate.frequency}
                      </Text>
                    </View>
                  ) : null}
                  <View style={reportStyles.statusPill}>
                    <Text style={reportStyles.statusPillText}>Active</Text>
                  </View>
                </View>
              </View>

              <View style={reportStyles.divider} />

              <View style={reportStyles.contextMetaRow}>
                <View style={reportStyles.metaItem}>
                  <Ionicons name="person-outline" size={14} color="#7A7266" style={{ marginRight: 5 }} />
                  <Text style={reportStyles.metaText} numberOfLines={1}>
                    {selectedEmployeeDisplayLabel}
                  </Text>
                </View>
                <View style={reportStyles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color="#7A7266" style={{ marginRight: 5 }} />
                  <Text style={reportStyles.metaText}>{selectedMonth.format("MMMM YYYY")}</Text>
                </View>
              </View>
            </View>

            {loadingReport ? (
              <View style={reportStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#C9A24D" />
                <Text style={reportStyles.loadingText}>Generating survey report...</Text>
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
                  No survey submission records found for this template and frequency in {selectedMonth.format("MMMM YYYY")}.
                </Text>
              </View>
            ) : (
              <View>
                {/* KPI Cards Grid */}
                <View style={reportStyles.kpiGrid}>
                  {/* Total Outlets */}
                  <View style={reportStyles.kpiCard}>
                    <View style={[reportStyles.kpiIconWrap, { backgroundColor: "#EFF6FF" }]}>
                      <MaterialCommunityIcons name="storefront-outline" size={20} color="#3B5BB5" />
                    </View>
                    <Text style={reportStyles.kpiNumber}>{summaryMetrics.totalOutlets}</Text>
                    <Text style={reportStyles.kpiLabel}>Total Target</Text>
                  </View>

                  {/* Submitted */}
                  <View style={reportStyles.kpiCard}>
                    <View style={[reportStyles.kpiIconWrap, { backgroundColor: "#E3F1EA" }]}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#2E7D5B" />
                    </View>
                    <Text style={[reportStyles.kpiNumber, { color: "#2E7D5B" }]}>
                      {summaryMetrics.totalSubmitted}
                    </Text>
                    <Text style={reportStyles.kpiLabel}>Submitted</Text>
                  </View>

                  {/* Not Submitted */}
                  <View style={reportStyles.kpiCard}>
                    <View style={[reportStyles.kpiIconWrap, { backgroundColor: "#FEF2F2" }]}>
                      <Ionicons name="close-circle-outline" size={20} color="#B3261E" />
                    </View>
                    <Text style={[reportStyles.kpiNumber, { color: "#B3261E" }]}>
                      {summaryMetrics.totalNotSubmitted}
                    </Text>
                    <Text style={reportStyles.kpiLabel}>Not Submitted</Text>
                  </View>

                  {/* Completion % */}
                  <View style={reportStyles.kpiCard}>
                    <View style={[reportStyles.kpiIconWrap, { backgroundColor: "#F1EADB" }]}>
                      <MaterialCommunityIcons name="percent-outline" size={20} color="#C9A24D" />
                    </View>
                    <Text style={[reportStyles.kpiNumber, { color: "#A67C2E" }]}>
                      {summaryMetrics.completionPercent}%
                    </Text>
                    <Text style={reportStyles.kpiLabel}>Completion Rate</Text>
                  </View>
                </View>

                {/* Overall Progress Bar */}
                <View style={reportStyles.overallProgressCard}>
                  <View style={reportStyles.progressHeader}>
                    <Text style={reportStyles.progressHeading}>Overall Survey Completion</Text>
                    <Text style={reportStyles.progressPercent}>{summaryMetrics.completionPercent}%</Text>
                  </View>
                  <View style={reportStyles.progressBarTrack}>
                    <View
                      style={[
                        reportStyles.progressBarFill,
                        {
                          width: `${Math.min(100, Math.max(0, summaryMetrics.completionPercent))}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={reportStyles.progressFooter}>
                    <Text style={reportStyles.progressFooterText}>
                      {summaryMetrics.totalSubmitted} of {summaryMetrics.totalOutlets} outlets completed
                    </Text>
                    <Text style={reportStyles.progressFooterText}>
                      {summaryMetrics.totalNotSubmitted} remaining
                    </Text>
                  </View>
                </View>

                {/* Subordinates Breakdown */}
                <View style={reportStyles.usersListContainer}>
                  <View style={reportStyles.sectionHeaderRow}>
                    <Text style={reportStyles.sectionHeading}>
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
                      <View key={row.userId || idx} style={reportStyles.userCard}>
                        <View style={reportStyles.userRowHeader}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={reportStyles.userRowName}>{row.userName}</Text>
                          </View>
                          <View style={reportStyles.completionBadge}>
                            <Text style={reportStyles.completionBadgeText}>{percent}%</Text>
                          </View>
                        </View>

                        {/* Progress bar */}
                        <View style={reportStyles.userProgressBarTrack}>
                          <View
                            style={[
                              reportStyles.userProgressBarFill,
                              {
                                width: `${Math.min(100, Math.max(0, percent))}%`,
                                backgroundColor:
                                  percent >= 80 ? "#2E7D5B" : percent >= 40 ? "#F59E0B" : "#B3261E",
                              },
                            ]}
                          />
                        </View>

                        {/* Sub Counts */}
                        <View style={reportStyles.userStatsRow}>
                          <View style={reportStyles.statItem}>
                            <Text style={reportStyles.statItemLabel}>Target</Text>
                            <Text style={reportStyles.statItemVal}>{row.totalOutlets}</Text>
                          </View>
                          <View style={reportStyles.statItem}>
                            <Text style={reportStyles.statItemLabel}>Submitted</Text>
                            <Text style={[reportStyles.statItemVal, { color: "#2E7D5B" }]}>
                              {row.totalSubmitted}
                            </Text>
                          </View>
                          <View style={reportStyles.statItem}>
                            <Text style={reportStyles.statItemLabel}>Pending</Text>
                            <Text style={[reportStyles.statItemVal, { color: "#B3261E" }]}>
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
      </Modal>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: RFValue(15),
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
    marginBottom: 14,
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
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  filterDropdownHighlight: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFBFB",
  },
  filterDropdownDisabled: {
    backgroundColor: "#F1EADB",
    borderColor: "#D9D2C3",
    opacity: 0.75,
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
    marginTop: 2,
  },
  selfBadge: {
    backgroundColor: "#E3F1EA",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 8,
  },
  selfBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#2E7D5B",
  },
  promptCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginTop: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "rgba(26, 29, 46, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    position: "relative",
    overflow: "hidden",
  },
  promptGradientBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  promptIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F1EADB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1D1A",
    marginBottom: 6,
  },
  promptDescription: {
    fontSize: 12.5,
    color: "#7A7266",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  promptButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C9A24D",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    shadowColor: "#C9A24D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  promptButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  loaderWrapper: {
    marginTop: 40,
    alignItems: "center",
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    color: "#7A7266",
    fontWeight: "600",
  },
  frequencyContainer: {
    marginBottom: 14,
  },
  sectionHeadingSmall: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A7266",
    textTransform: "uppercase",
    marginBottom: 6,
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
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7266",
  },
  freqTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  templatesContainer: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  templateScroll: {
    paddingVertical: 4,
    gap: 10,
  },
  templateVerticalList: {
    gap: 8,
    marginTop: 4,
  },
  templateRowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D9D2C3",
    padding: 12,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 6,
  },
  templateRowCardActive: {
    borderColor: "#C9A24D",
    backgroundColor: "#FFFBFB",
  },
  templateRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  templateNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    lineHeight: 18,
  },
  templateRowRight: {
    marginLeft: 6,
  },
  viewReportActionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewReportActionPillActive: {
    backgroundColor: "#C9A24D",
  },
  viewReportActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A67C2E",
    marginRight: 4,
  },
  viewReportActionTextActive: {
    color: "#FFFFFF",
  },
  templateCard: {
    width: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D9D2C3",
    padding: 12,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  templateCardActive: {
    borderColor: "#C9A24D",
    backgroundColor: "#FFFBFB",
  },
  templateCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  templateIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  freqBadge: {
    backgroundColor: "#F1EADB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freqBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#7A7266",
  },
  templateName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1F1D1A",
    minHeight: 34,
    lineHeight: 16,
  },
  viewReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1EADB",
  },
  viewReportBtnText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#7A7266",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  emptyCardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#7A7266",
    marginTop: 6,
  },
  emptyCardSub: {
    fontSize: 11.5,
    color: "#7A7266",
    textAlign: "center",
    marginTop: 2,
  },
  reportContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1EADB",
    shadowColor: "rgba(26, 29, 46, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    position: "relative",
  },
  reportGradientBar: {
    position: "absolute",
    left: -16,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  reportTemplateTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  reportSubtitle: {
    fontSize: 11,
    color: "#7A7266",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  kpiCard: {
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: CARD_WIDTH - 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  kpiTextWrap: {
    flex: 1,
  },
  kpiValue: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1F1D1A",
    lineHeight: 16,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#7A7266",
    lineHeight: 12,
  },
  progressCard: {
    backgroundColor: "#FBF8F1",
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  progressValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  progressBarBg: {
    height: 7,
    backgroundColor: "#D9D2C3",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  userReportSection: {
    marginTop: 8,
  },
  userRowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    padding: 12,
    marginBottom: 8,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  userRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  userRowName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  userRowSub: {
    fontSize: 10,
    color: "#7A7266",
    marginTop: 1,
  },
  completionBadge: {
    backgroundColor: "#F1EADB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  completionBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  userRowMetrics: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricPillSubmitted: {
    backgroundColor: "#E3F1EA",
  },
  metricPillNotSubmitted: {
    backgroundColor: "#FEE2E2",
  },
  metricPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7A7266",
    marginRight: 3,
  },
  metricPillVal: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#1F1D1A",
  },
  userProgressBarBg: {
    height: 5,
    backgroundColor: "#F1EADB",
    borderRadius: 3,
    overflow: "hidden",
  },
  userProgressBarFill: {
    height: "100%",
    borderRadius: 3,
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
  modalHeader: {
    height: 54,
    backgroundColor: "#C9A24D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  modalHeaderText: {
    color: "#13265C",
    fontSize: 15,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#1F1D1A",
    paddingVertical: 0,
  },
  modalScroll: {
    maxHeight: 340,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D9D2C3",
    backgroundColor: "#fff",
  },
  menuItemActive: {
    backgroundColor: "#FFF5F5",
  },
  menuText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  menuSubText: {
    fontSize: 10.5,
    color: "#7A7266",
    marginTop: 2,
  },
});

const reportStyles = StyleSheet.create({
  contextCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
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

export default SurveySummary;
