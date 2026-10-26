import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  Platform,
  PermissionsAndroid,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Feather from "@react-native-vector-icons/feather";
import MIcon from "@react-native-vector-icons/material-icons";
import Ionicons from "../components/Ionicons";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import moment from "moment";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../redux/store";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { showToast } from "../redux/slices/toastSlice";
import { getCurrentLocation } from "../utils/getCurrentLocation";
import { isInternetAvailable } from "../utils/networkUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import getDistanceInKm from "../utils/helper/GetDistance";
import { getCachedCheckinDistanceLimit } from "../UtilityMain/GetAndStoreData/getCheckinDistanceSetting";

export const getDraftStorageKey = (oId: string, tId: string, dateStr?: string) =>
  `PS_DRAFT_AUDIT_${oId}_${tId}_${dateStr || moment().format("YYYY-MM-DD")}`;

export const getDraftAnswersStorageKey = (oId: string, tId: string) =>
  `PS_DRAFT_ANSWERS_${oId}_${tId}`;

export type NormalizedResponseType =
  | "Yes/No"
  | "Rating 1-5"
  | "Percentage"
  | "Number"
  | "Text";

// Fields from PS_Template__c
export interface PSTemplateRecord {
  Id: string;
  OwnerId?: string;
  IsDeleted?: boolean;
  Name?: string;
  CreatedDate?: string;
  CreatedById?: string;
  LastModifiedDate?: string;
  LastModifiedById?: string;
  SystemModstamp?: string;
  LastViewedDate?: string;
  LastReferencedDate?: string;
  Active__c?: boolean;
  Description__c?: string;
  Frequency__c?: string;
  Perfect_Score_Threshold__c?: number;
  Applicability_Rules_JSON__c?: string | object;
  Template_Config_JSON__c?: string | object;
  [key: string]: any;
}

export interface QuestionItem {
  attributes?: { type: string };
  Audit__c?: string;
  Template__c?: string;
  Template_Id__c?: string;
  Question_Id__c: string;
  Question__c: string;
  Section_Name__c?: string;
  Weightage__c?: number;
  Response_Type__c?: string;
  Response_Value__c?: any;
  Response_Text__c?: string;
  Requires_Image__c?: boolean;
  Has_Image__c?: boolean;
  [key: string]: any;
}

export interface AnswerState {
  responseValue: number | null; // Stored Field: Response_Value__c (for Yes/No, Rating 1-5, Percentage, Number)
  responseText: string;         // Stored Field: Response_Text__c (for Text)
  imageUri?: string;
  imageBase64?: string;
  imageFileName?: string;
  hasImage?: boolean;
  responseRecordId?: string;
}

/**
 * Maps incoming Response_Type__c string to our 5 supported types
 */
const getNormalizedResponseType = (rawType?: string): NormalizedResponseType => {
  const type = (rawType || "").trim().toLowerCase();
  if (
    type.includes("yes") ||
    type.includes("no") ||
    type.includes("bool") ||
    type.includes("toggle") ||
    type.includes("segmented")
  ) {
    return "Yes/No";
  }
  if (
    type.includes("rate") ||
    type.includes("rating") ||
    type.includes("star") ||
    type.includes("1-5")
  ) {
    return "Rating 1-5";
  }
  if (type.includes("percent") || type.includes("%")) {
    return "Percentage";
  }
  if (
    type.includes("num") ||
    type.includes("decimal") ||
    type.includes("integer") ||
    type.includes("int") ||
    type.includes("qty")
  ) {
    return "Number";
  }
  if (
    type.includes("text") ||
    type.includes("string") ||
    type.includes("note") ||
    type.includes("desc") ||
    type.includes("comment")
  ) {
    return "Text";
  }
  return "Yes/No"; // Default fallback
};

const PerfectStoreScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { apiFetch, apiComposite, fetchRecords } = useApiFetch();

  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const selectedAccount = useSelector(
    (state: RootState) => state.selectedAccount?.selectedAccount
  );

  // Outlet ID resolution
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

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Checking Device Location...");
  const [loadingSubText, setLoadingSubText] = useState("Verifying current store GPS coordinates...");
  const [submitting, setSubmitting] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [templateRecord, setTemplateRecord] = useState<PSTemplateRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [auditId, setAuditId] = useState("");
  const [answers, setAnswers] = useState<{ [qId: string]: AnswerState }>({});
  const [remarks, setRemarks] = useState("");

  const activeAuditIdRef = useRef<string>("");
  const draftCallingRef = useRef<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  /**
   * User-friendly error message when device location (GPS) is turned off or unavailable
   */
  const getLocationErrorMessage = (err: any): string => {
    const msg = (err?.message || String(err || "")).toLowerCase();
    if (msg.includes("permission")) {
      return "Location permission is required. Please enable location permission in settings.";
    }
    return "Location is turned off. Turn it on to continue with Perfect Store audit.";
  };

  /**
   * Determine if a checklist question has been answered
   */
  const isQuestionAnswered = (q: QuestionItem, ans?: AnswerState): boolean => {
    if (!ans) return false;
    const nType = getNormalizedResponseType(q.Response_Type__c);
    if (nType === "Yes/No") {
      return ans.responseValue === 1 || ans.responseValue === 0;
    }
    if (nType === "Rating 1-5" || nType === "Percentage" || nType === "Number") {
      return ans.responseValue !== null && ans.responseValue !== undefined;
    }
    if (nType === "Text") {
      return Boolean(ans.responseText && ans.responseText.trim().length > 0);
    }
    return ans.responseValue !== null && ans.responseValue !== undefined;
  };

  /**
   * Convert technical Salesforce validation / API errors into professional, user-friendly English messages
   */
  const formatSubmitErrorMessage = (rawError: any): string => {
    let msg =
      typeof rawError === "string"
        ? rawError
        : rawError?.message ||
        rawError?.details?.message ||
        "An unexpected error occurred while saving.";

    // 1. Geofence / Location Radius Error
    const isLocationRadiusError =
      msg.includes("outside the permitted") ||
      (msg.includes("permitted") && msg.includes("radius")) ||
      msg.includes("Move closer to the outlet") ||
      (msg.includes("captured") && msg.includes("from the outlet"));

    if (isLocationRadiusError) {
      // Attempt to extract captured distance and permitted radius (e.g. 1592808 m and 50000 m)
      const distanceMatch = msg.match(
        /captured\s+([\d.,]+)\s*m\s+from.*?permitted\s+([\d.,]+)\s*m/i
      );

      if (distanceMatch) {
        const capturedMeters = parseFloat(distanceMatch[1].replace(/,/g, ""));
        const permittedMeters = parseFloat(distanceMatch[2].replace(/,/g, ""));

        const formatDist = (m: number) => {
          if (m >= 1000) {
            const km = m / 1000;
            return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
          }
          return `${Math.round(m)} m`;
        };

        return `Location Out of Range: You are currently ${formatDist(
          capturedMeters
        )} away from the store (permitted radius: ${formatDist(
          permittedMeters
        )}). Please be at the store premises to submit this audit.`;
      }

      return "Location Out of Range: You are outside the permitted radius for this store. Please move closer to the outlet premises and try again.";
    }

    // 2. FLS (Field-Level Security) Error on Account
    if (msg.includes("fields being inaccessible on Sobject Account")) {
      return "Salesforce Security Error: The current user lacks permission to update score fields on Account. Please contact your Salesforce Administrator.";
    }

    // 3. Incomplete Checklist / Unanswered Questions Error
    if (
      msg.includes("All checklist questions must be answered") ||
      msg.includes("checklist questions must be answered") ||
      (msg.includes("checklist") && msg.includes("remaining")) ||
      msg.includes("question(s) remaining")
    ) {
      const countMatch = msg.match(/(\d+)\s*question(?:\(s\))?\s*remaining/i);
      if (countMatch && countMatch[1]) {
        const count = parseInt(countMatch[1], 10);
        return count === 1
          ? "Checklist Incomplete: Please answer all questions before submitting (1 question remaining)."
          : `Checklist Incomplete: Please answer all questions before submitting (${count} questions remaining).`;
      }
      return "Checklist Incomplete: Please answer all checklist questions before submitting the audit.";
    }

    // 4. Clean generic "Bad Request: Check the input parameters. (...)" wrapper
    const badReqMatch = msg.match(/Bad Request:\s*Check the input parameters\.\s*\((.*?)\)/i);
    if (badReqMatch && badReqMatch[1]) {
      msg = badReqMatch[1].trim();

      // Check unwrapped message for unanswered questions error
      if (
        msg.includes("All checklist questions must be answered") ||
        msg.includes("checklist questions must be answered") ||
        (msg.includes("checklist") && msg.includes("remaining")) ||
        msg.includes("question(s) remaining")
      ) {
        const countMatch = msg.match(/(\d+)\s*question(?:\(s\))?\s*remaining/i);
        if (countMatch && countMatch[1]) {
          const count = parseInt(countMatch[1], 10);
          return count === 1
            ? "Checklist Incomplete: Please answer all questions before submitting (1 question remaining)."
            : `Checklist Incomplete: Please answer all questions before submitting (${count} questions remaining).`;
        }
        return "Checklist Incomplete: Please answer all checklist questions before submitting the audit.";
      }
    }

    // 5. Strip JSON boilerplate if present
    try {
      if (msg.startsWith("[") || msg.startsWith("{")) {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed[0].message;
        } else if (parsed?.message) {
          msg = parsed.message;
        }
      }
    } catch (_) { }

    return msg;
  };

  // Helper to capture real device GPS coordinates of current location (STRICT: NO fallback to outlet coords)
  const captureDeviceLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    console.log("📍 Capturing real device GPS coordinates for Perfect Store audit...");
    const coords: any = await getCurrentLocation();
    if (coords && coords.latitude !== undefined && coords.longitude !== undefined) {
      const lat = Number(Number(coords.latitude).toFixed(6));
      const lng = Number(Number(coords.longitude).toFixed(6));
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        console.log(`✅ Current device GPS captured: Lat: ${lat}, Long: ${lng}`);
        return { latitude: lat, longitude: lng };
      }
    }
    throw new Error("Unable to retrieve valid GPS coordinates from device.");
  };

  // Helper to get outlet coordinates (from Redux, route params, local DB, or online Account fetch)
  const getOutletCoordinates = async (): Promise<{ lat: number; lng: number } | null> => {
    const parseCoord = (val: any): number | null => {
      if (val === undefined || val === null || val === "" || val === "null") return null;
      const num = Number(val);
      return !isNaN(num) && Number.isFinite(num) ? num : null;
    };

    const extractCoords = (obj: any): { lat: number; lng: number } | null => {
      if (!obj || typeof obj !== "object") return null;

      const latCandidates = [
        obj.BillingLatitude,
        obj.billingLatitude,
        obj.BillingLatitude__c,
        obj.Account_Location_Latitude_Longitude__Latitude__s,
        obj.Geolocation__Latitude__s,
        obj.CheckInLocation__Latitude__s,
        obj.outletLatitude,
        obj.latitude,
        obj.lat,
        obj.BillingAddress?.latitude,
      ];

      const lngCandidates = [
        obj.BillingLongitude,
        obj.billingLongitude,
        obj.BillingLongitude__c,
        obj.Account_Location_Latitude_Longitude__Longitude__s,
        obj.Geolocation__Longitude__s,
        obj.CheckInLocation__Longitude__s,
        obj.outletLongitude,
        obj.longitude,
        obj.lng,
        obj.BillingAddress?.longitude,
      ];

      let foundLat: number | null = null;
      let foundLng: number | null = null;

      for (const val of latCandidates) {
        const parsed = parseCoord(val);
        if (parsed !== null && parsed !== 0) {
          foundLat = parsed;
          break;
        }
      }

      for (const val of lngCandidates) {
        const parsed = parseCoord(val);
        if (parsed !== null && parsed !== 0) {
          foundLng = parsed;
          break;
        }
      }

      if (foundLat !== null && foundLng !== null) {
        return { lat: foundLat, lng: foundLng };
      }
      return null;
    };

    // 1. Check route params
    let coords = extractCoords(route?.params);
    if (coords) {
      console.log("📍 Outlet coordinates resolved from route params:", coords);
      return coords;
    }
    if (route?.params?.outletLatitude && route?.params?.outletLongitude) {
      coords = extractCoords({
        lat: route.params.outletLatitude,
        lng: route.params.outletLongitude,
      });
      if (coords) {
        console.log("📍 Outlet coordinates resolved from outletLatitude/outletLongitude params:", coords);
        return coords;
      }
    }

    // 2. Check Redux states (selectedAccount, selectedVisit)
    coords = extractCoords(selectedAccount);
    if (coords) {
      console.log("📍 Outlet coordinates resolved from selectedAccount:", coords);
      return coords;
    }

    coords = extractCoords(selectedVisit);
    if (coords) {
      console.log("📍 Outlet coordinates resolved from selectedVisit:", coords);
      return coords;
    }

    // 3. Query local database for Account
    if (outletId) {
      try {
        const accounts = await UniversalUpdateInsert({
          ObjectName: "Account",
          Type: "get",
        });
        if (Array.isArray(accounts)) {
          const found = accounts.find(
            (a: any) =>
              String(a.Sf_Id || a.Id || a.id || "") === String(outletId)
          );
          if (found) {
            coords = extractCoords(found);
            if (coords) {
              console.log("📍 Outlet coordinates resolved from local Account DB:", coords);
              return coords;
            }
          }
        }
      } catch (e) {
        console.warn("⚠️ Local account fetch failed:", e);
      }

      // Also check local Visit table for this account's visit record / check-in location
      try {
        const visits = await UniversalUpdateInsert({
          ObjectName: "Visit",
          Type: "get",
        });
        if (Array.isArray(visits)) {
          const foundVisit = visits.find(
            (v: any) =>
              String(v.AccountId__c || v.AccountId || v.Sf_Id || v.Id || "") === String(outletId)
          );
          if (foundVisit) {
            coords = extractCoords(foundVisit);
            if (coords) {
              console.log("📍 Outlet coordinates resolved from local Visit DB:", coords);
              return coords;
            }
          }
        }
      } catch (vErr) {
        console.warn("⚠️ Local visit fetch failed:", vErr);
      }
    }

    // 4. Online SOQL fallback: query Salesforce for Account geolocation
    if (outletId) {
      try {
        const online = await isInternetAvailable();
        if (online) {
          const soqlQuery = `SELECT Id, Name, Latitude__c, Longitude__c, BillingLatitude, BillingLongitude, BillingAddress FROM Account WHERE Id = '${outletId}' LIMIT 1`;
          const accRes = await apiFetch(
            "GET",
            `query?q=${encodeURIComponent(soqlQuery)}`,
            {},
            "SObjects"
          );
          const records = accRes?.records || accRes?.data?.records || [];
          if (records.length > 0) {
            coords = extractCoords(records[0]);
            if (coords) {
              console.log("📍 Outlet coordinates resolved from Salesforce SOQL:", coords);
              return coords;
            }
          }
        }
      } catch (apiErr) {
        console.warn("⚠️ Salesforce account SOQL fetch failed:", apiErr);
      }
    }

    console.warn("⚠️ Outlet coordinates could not be resolved from any source for outletId:", outletId);
    return null;
  };

  // Step 2: Initialize or update draft audit: ONLY creates once (POST), then updates existing record (PATCH)
  const autoCreateDraftAudit = async (
    tId: string,
    oId: string,
    latitude: number,
    longitude: number
  ): Promise<string> => {
    if (!tId || !oId) {
      console.warn("⚠️ autoCreateDraftAudit called with missing params:", { tId, oId });
      throw new Error("Missing template or outlet ID for draft audit initialization.");
    }

    if (draftCallingRef.current) {
      console.log("⏳ Draft API call is already in progress, returning existing audit ID...");
      if (activeAuditIdRef.current) return activeAuditIdRef.current;
    }
    draftCallingRef.current = true;

    const currentDate = moment().format("YYYY-MM-DD");
    const storageKey = getDraftStorageKey(oId, tId, currentDate);

    try {
      // 1. Check if a draft audit ID is already active in memory or in route params or cached for today
      let existingDraftId = auditId || activeAuditIdRef.current || route?.params?.auditId || "";
      if (!existingDraftId) {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached && typeof cached === "string" && (cached.startsWith("a0") || cached.length >= 15)) {
          existingDraftId = cached;
        }
      }

      if (existingDraftId) {
        // ========== RE-OPENING: UPDATE EXISTING DRAFT (PATCH) ==========
        console.log(`♻️ Found active Draft Audit ID: ${existingDraftId}. Updating existing record via PATCH with current GPS: ${latitude}, ${longitude}...`);
        setAuditId(existingDraftId);
        activeAuditIdRef.current = existingDraftId;

        const updatePayload: any = {
          Status__c: "Draft",
          Audit_Date__c: currentDate,
          Remarks__c: remarks.trim() || "",
          Latitude__c: latitude,
          Longitude__c: longitude,
        };

        console.log("📤 PATCH /services/data/v67.0/sobjects/PS_Audit__c Payload:", updatePayload);
        const patchRes = await apiFetch(
          "PATCH",
          `sobjects/PS_Audit__c/${existingDraftId}`,
          updatePayload,
          "SObjects"
        );
        console.log("📥 PATCH /services/data/v67.0/sobjects/PS_Audit__c Response:", patchRes);

        if (patchRes && patchRes.status === "error") {
          throw new Error(patchRes.message || "Failed to update draft audit record with current location.");
        }

        return existingDraftId;
      }

      // ========== FIRST TIME: CREATE DRAFT (POST) ==========
      console.log(`🚀 [Step 2] Initializing Draft Audit Record (Current GPS: ${latitude}, ${longitude}) for Outlet: ${oId}, Template: ${tId}`);

      const draftPayload: any = {
        Outlet__c: oId,
        Template__c: tId,
        Status__c: "Draft",
        Audit_Date__c: currentDate,
        Remarks__c: remarks.trim() || "",
        Latitude__c: latitude,
        Longitude__c: longitude,
      };

      console.log("📤 POST /services/data/v67.0/sobjects/PS_Audit__c Payload:", JSON.stringify(draftPayload, null, 2));
      const endpoint = "sobjects/PS_Audit__c";
      const res = await apiFetch("POST", endpoint, draftPayload, "SObjects");
      console.log("📥 POST /services/data/v67.0/sobjects/PS_Audit__c Response:", res);

      if (res && res.status === "error") {
        throw new Error(res.message || "Failed to initialize draft audit record.");
      }

      const createdId = res?.data?.id || res?.data?.Id || res?.id || res?.Id;
      if (createdId) {
        setAuditId(createdId);
        activeAuditIdRef.current = createdId;
        await AsyncStorage.setItem(storageKey, createdId);
        console.log("✅ First-time Auto Draft created with Audit ID:", createdId);
        return createdId;
      } else {
        throw new Error("Draft audit creation did not return a valid record ID.");
      }
    } finally {
      draftCallingRef.current = false;
    }
  };

  // Request Camera Permission for Android
  const requestCameraPermission = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "App needs camera access to capture audit photos.",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn("Camera permission error:", err);
        return false;
      }
    }
    return true;
  };

  // Fetch Questions & Template Config from Salesforce Apex API
  const fetchTemplate = async () => {
    if (!outletId) {
      dispatch(
        showToast({
          type: "error",
          message: "Outlet Account ID not found.",
        })
      );
      if (navigation?.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      }
      return;
    }

    try {
      setLoading(true);
      setLoadingText("Checking Device Location...");
      setLoadingSubText("Verifying current store GPS coordinates...");

      // 1. CAPTURE REAL DEVICE GPS LOCATION FIRST!
      // If location is OFF or permission denied, stop immediately, toast, and go back
      let currentCoords: { latitude: number; longitude: number };
      try {
        currentCoords = await captureDeviceLocation();
      } catch (locErr: any) {
        console.warn("⚠️ Device location is off or GPS capture failed:", locErr);
        dispatch(
          showToast({
            type: "warning",
            message: getLocationErrorMessage(locErr),
          })
        );
        if (navigation?.canGoBack && navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }

      const online = await isInternetAvailable();
      if (!online) {
        dispatch(
          showToast({
            type: "error",
            message: "Internet is required to fetch Perfect Store template.",
          })
        );
        if (navigation?.canGoBack && navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }

      console.log(`📡 Fetching Perfect Store template for Outlet: ${outletId}`);
      setLoadingText("Fetching Perfect Store Template...");
      setLoadingSubText("Loading checklist for store...");
      const endpoint = `PerfectStore/templates/${outletId}`;
      const response = await apiFetch("GET", endpoint, {}, "apexrest");

      console.log("📥 Perfect Store Template Response:", response);

      if (
        response &&
        (response.status === "success" ||
          Array.isArray(response.data) ||
          response.data)
      ) {
        let rawData = response.data !== undefined ? response.data : response;

        let templateObj: PSTemplateRecord | null = null;
        let resolvedTemplateId = "";
        let qList: QuestionItem[] = [];
        let parsedConfig: any = null;

        // 1. Identify PS_Template__c Record
        console.log("🔍 Parsing template rawData:", JSON.stringify(rawData));

        let candidateList: any[] = [];
        if (Array.isArray(rawData)) {
          candidateList = rawData;
        } else if (rawData && typeof rawData === "object") {
          if (Array.isArray(rawData.templates)) candidateList = rawData.templates;
          else if (Array.isArray(rawData.template)) candidateList = rawData.template;
          else if (Array.isArray(rawData.records)) candidateList = rawData.records;
          else if (Array.isArray(rawData.data)) {
            if (Array.isArray(rawData.data)) candidateList = rawData.data;
            else if (Array.isArray(rawData.data.templates)) candidateList = rawData.data.templates;
            else candidateList = [rawData.data];
          } else {
            candidateList = [rawData];
          }
        }

        const targetParamTemplateId = route?.params?.templateId || "";
        if (route?.params?.selectedTemplate) {
          templateObj = route.params.selectedTemplate;
        } else if (targetParamTemplateId && candidateList.length > 0) {
          templateObj =
            candidateList.find(
              (t) => (t.Id || t.id || t.templateId) === targetParamTemplateId
            ) || candidateList[0];
        } else if (candidateList.length > 0) {
          templateObj = candidateList[0];
        }

        console.log("🎯 Selected Template Record:", templateObj);

        // 2. Normalize and Parse Template Record
        if (templateObj) {
          resolvedTemplateId =
            templateObj.id ||
            templateObj.Id ||
            templateObj.templateId ||
            "";
          const normalizedTemplate: PSTemplateRecord = {
            ...templateObj,
            Id: resolvedTemplateId,
            Name: templateObj.name || templateObj.Name || "Perfect Store Audit",
            Description__c: templateObj.description || templateObj.Description__c || "",
            Frequency__c: templateObj.frequency || templateObj.Frequency__c || "",
            Perfect_Score_Threshold__c:
              templateObj.perfectScoreThreshold !== undefined
                ? Number(templateObj.perfectScoreThreshold)
                : templateObj.Perfect_Score_Threshold__c !== undefined
                  ? Number(templateObj.Perfect_Score_Threshold__c)
                  : 80,
            Template_Config_JSON__c:
              templateObj.Template_Config_JSON__c || templateObj.config || templateObj.templateConfig || null,
            Applicability_Rules_JSON__c:
              templateObj.Applicability_Rules_JSON__c || templateObj.applicabilityRules || null,
          };

          // Safely parse Applicability_Rules_JSON__c if string
          const rawRules = normalizedTemplate.Applicability_Rules_JSON__c;
          if (typeof rawRules === "string") {
            try {
              let parsedRules = JSON.parse(rawRules);
              if (typeof parsedRules === "string") {
                parsedRules = JSON.parse(parsedRules);
              }
              normalizedTemplate.Applicability_Rules_JSON__c = parsedRules;
            } catch (e) {
              console.warn("Could not parse Applicability_Rules_JSON__c:", e);
            }
          }

          setTemplateRecord(normalizedTemplate);
          setTemplateId(normalizedTemplate.Id || "");

          const rawConfig = normalizedTemplate.Template_Config_JSON__c;
          if (typeof rawConfig === "string") {
            try {
              parsedConfig = JSON.parse(rawConfig);
              if (typeof parsedConfig === "string") {
                try {
                  parsedConfig = JSON.parse(parsedConfig);
                } catch (_) { }
              }
            } catch (e) {
              console.warn("Could not parse Template_Config_JSON__c:", e);
            }
          } else if (rawConfig && typeof rawConfig === "object") {
            parsedConfig = rawConfig;
          }
        }

        // 3. Extract Questions from templateObj.sections OR templateObj.questions OR parsedConfig
        const sourceSections =
          templateObj?.sections ||
          (parsedConfig && Array.isArray(parsedConfig.sections) ? parsedConfig.sections : null);

        if (Array.isArray(sourceSections)) {
          console.log(`📋 Found ${sourceSections.length} section(s) in template:`, sourceSections);
          sourceSections.forEach((sec: any, sIdx: number) => {
            const secName =
              sec.name ||
              sec.sectionName ||
              sec.Section_Name__c ||
              sec.title ||
              sec.label ||
              `Section ${sIdx + 1}`;
            const secWeight =
              sec.weightage !== undefined
                ? Number(sec.weightage)
                : sec.Weightage__c !== undefined
                  ? Number(sec.Weightage__c)
                  : undefined;

            // Notice: API returns 'checklistItems' array inside each section
            const qArray =
              sec.checklistItems ||
              sec.checkListItems ||
              sec.checklist_items ||
              sec.check_list_items ||
              sec.questions ||
              sec.items ||
              sec.records ||
              sec.questionList ||
              sec.Questions__r ||
              sec.data;

            if (Array.isArray(qArray) && qArray.length > 0) {
              qArray.forEach((item: any, qIdx: number) => {
                qList.push({
                  ...item,
                  Question_Id__c:
                    item.Question_Id__c ||
                    item.questionId ||
                    item.id ||
                    item.Id ||
                    `q_${sIdx + 1}_${qIdx + 1}`,
                  Question__c:
                    item.Question__c ||
                    item.question ||
                    item.text ||
                    item.label ||
                    item.title ||
                    `Question ${qIdx + 1}`,
                  Section_Name__c:
                    item.Section_Name__c ||
                    item.sectionName ||
                    item.section ||
                    secName,
                  Weightage__c:
                    item.Weightage__c !== undefined
                      ? Number(item.Weightage__c)
                      : item.weightage !== undefined
                        ? Number(item.weightage)
                        : secWeight,
                  Response_Type__c:
                    item.Response_Type__c ||
                    item.responseType ||
                    item.type ||
                    "Yes/No",
                  Requires_Image__c:
                    item.Requires_Image__c !== undefined
                      ? Boolean(item.Requires_Image__c)
                      : item.requiresImage !== undefined
                        ? Boolean(item.requiresImage)
                        : false,
                  Response_Value__c:
                    item.Response_Value__c !== undefined
                      ? item.Response_Value__c
                      : item.responseValue !== undefined
                        ? item.responseValue
                        : item.defaultValue,
                  Response_Text__c:
                    item.Response_Text__c ||
                    item.responseText ||
                    item.defaultText ||
                    "",
                });
              });
            } else if (
              sec.Question__c ||
              sec.question ||
              sec.Question_Id__c ||
              sec.questionId ||
              sec.id
            ) {
              // The section object itself is a single question
              qList.push({
                ...sec,
                Question_Id__c:
                  sec.Question_Id__c ||
                  sec.questionId ||
                  sec.id ||
                  sec.Id ||
                  `q_${sIdx + 1}`,
                Question__c:
                  sec.Question__c ||
                  sec.question ||
                  sec.text ||
                  sec.label ||
                  sec.title ||
                  `Question ${sIdx + 1}`,
                Section_Name__c: secName,
                Weightage__c: secWeight,
                Response_Type__c:
                  sec.Response_Type__c ||
                  sec.responseType ||
                  sec.type ||
                  "Yes/No",
                Requires_Image__c:
                  sec.Requires_Image__c !== undefined
                    ? Boolean(sec.Requires_Image__c)
                    : sec.requiresImage !== undefined
                      ? Boolean(sec.requiresImage)
                      : false,
                Response_Value__c:
                  sec.Response_Value__c !== undefined
                    ? sec.Response_Value__c
                    : sec.responseValue !== undefined
                      ? sec.responseValue
                      : sec.defaultValue,
                Response_Text__c:
                  sec.Response_Text__c ||
                  sec.responseText ||
                  sec.defaultText ||
                  "",
              });
            }
          });
        }

        // Direct questions array fallback
        if (qList.length === 0) {
          const directQuestions =
            templateObj?.checklistItems ||
            templateObj?.checkListItems ||
            templateObj?.questions ||
            (parsedConfig && Array.isArray(parsedConfig.checklistItems)
              ? parsedConfig.checklistItems
              : null) ||
            (parsedConfig && Array.isArray(parsedConfig.questions)
              ? parsedConfig.questions
              : null) ||
            (parsedConfig && Array.isArray(parsedConfig) ? parsedConfig : null) ||
            (Array.isArray(rawData) ? rawData : null);

          if (Array.isArray(directQuestions)) {
            directQuestions.forEach((item: any, idx: number) => {
              qList.push({
                ...item,
                Question_Id__c:
                  item.Question_Id__c ||
                  item.questionId ||
                  item.id ||
                  item.Id ||
                  `q_${idx + 1}`,
                Question__c:
                  item.Question__c ||
                  item.question ||
                  item.text ||
                  item.label ||
                  item.title ||
                  `Question ${idx + 1}`,
                Section_Name__c:
                  item.Section_Name__c ||
                  item.sectionName ||
                  item.section ||
                  "General",
                Weightage__c:
                  item.Weightage__c !== undefined
                    ? Number(item.Weightage__c)
                    : item.weightage !== undefined
                      ? Number(item.weightage)
                      : undefined,
                Response_Type__c:
                  item.Response_Type__c ||
                  item.responseType ||
                  item.type ||
                  "Yes/No",
                Requires_Image__c:
                  item.Requires_Image__c !== undefined
                    ? Boolean(item.Requires_Image__c)
                    : item.requiresImage !== undefined
                      ? Boolean(item.requiresImage)
                      : false,
                Response_Value__c:
                  item.Response_Value__c !== undefined
                    ? item.Response_Value__c
                    : item.responseValue !== undefined
                      ? item.responseValue
                      : item.defaultValue,
                Response_Text__c:
                  item.Response_Text__c ||
                  item.responseText ||
                  item.defaultText ||
                  "",
              });
            });
          }
        }

        // 4. Final normalization
        qList = qList.map((q: any, idx: number) => ({
          ...q,
          Question_Id__c:
            q.Question_Id__c || q.questionId || q.id || q.Id || `q_${idx + 1}`,
          Question__c:
            q.Question__c ||
            q.question ||
            q.text ||
            q.label ||
            q.title ||
            `Question ${idx + 1}`,
          Section_Name__c:
            q.Section_Name__c ||
            q.sectionName ||
            q.section ||
            q.category ||
            "General",
          Weightage__c:
            q.Weightage__c !== undefined
              ? Number(q.Weightage__c)
              : q.weightage !== undefined
                ? Number(q.weightage)
                : undefined,
          Response_Type__c:
            q.Response_Type__c || q.responseType || q.type || "Yes/No",
          Requires_Image__c:
            q.Requires_Image__c !== undefined
              ? Boolean(q.Requires_Image__c)
              : q.requiresImage !== undefined
                ? Boolean(q.requiresImage)
                : false,
          Response_Value__c:
            q.Response_Value__c !== undefined
              ? q.Response_Value__c
              : q.responseValue !== undefined
                ? q.responseValue
                : q.defaultValue,
          Response_Text__c:
            q.Response_Text__c || q.responseText || q.defaultText || "",
        }));

        console.log(`✅ Loaded ${qList.length} questions for template:`, templateObj?.name || templateObj?.Name);

        if (qList.length === 0) {
          dispatch(
            showToast({
              type: "warning",
              message: "No checklist questions configured for this template.",
            })
          );
          if (navigation?.canGoBack && navigation.canGoBack()) {
            navigation.goBack();
          }
          return;
        }

        // Initialize answers (no default values - user must explicitly select/enter answers)
        const initialAnswers: { [qId: string]: AnswerState } = {};
        qList.forEach((q) => {
          const qKey = q.Question_Id__c;
          if (!qKey) return;

          const nType = getNormalizedResponseType(q.Response_Type__c);
          let initialNumVal: number | null = null;
          let initialTextVal = "";

          if (nType === "Text") {
            initialTextVal =
              q.Response_Text__c ||
              (typeof q.Response_Value__c === "string" ? q.Response_Value__c : "");
          } else if (nType === "Yes/No") {
            if (
              q.Response_Value__c !== undefined &&
              q.Response_Value__c !== null &&
              q.Response_Value__c !== ""
            ) {
              initialNumVal =
                Number(q.Response_Value__c) === 1 ||
                  q.Response_Value__c === true ||
                  q.Response_Value__c === "Yes"
                  ? 1
                  : 0;
            } else {
              initialNumVal = null;
            }
          } else if (nType === "Rating 1-5") {
            if (
              q.Response_Value__c !== undefined &&
              q.Response_Value__c !== null &&
              q.Response_Value__c !== ""
            ) {
              const rawVal = Number(q.Response_Value__c);
              initialNumVal =
                Number.isFinite(rawVal) && rawVal >= 1 && rawVal <= 5 ? rawVal : null;
            } else {
              initialNumVal = null;
            }
          } else if (nType === "Percentage") {
            if (
              q.Response_Value__c !== undefined &&
              q.Response_Value__c !== null &&
              q.Response_Value__c !== ""
            ) {
              const rawVal = Number(q.Response_Value__c);
              initialNumVal =
                Number.isFinite(rawVal) && rawVal >= 0 && rawVal <= 100 ? rawVal : null;
            } else {
              initialNumVal = null;
            }
          } else if (nType === "Number") {
            if (
              q.Response_Value__c !== undefined &&
              q.Response_Value__c !== null &&
              q.Response_Value__c !== ""
            ) {
              const rawVal = Number(q.Response_Value__c);
              initialNumVal = Number.isFinite(rawVal) ? rawVal : null;
            } else {
              initialNumVal = null;
            }
          }

          initialAnswers[qKey] = {
            responseValue: initialNumVal,
            responseText: initialTextVal,
          };
        });

        // Step 2: Initialize or update Draft Audit API with current GPS coordinates!
        // The form MUST NOT be displayed until GPS coordinates are sent and draft API call succeeds.
        const targetTemplateId =
          resolvedTemplateId ||
          templateObj?.id ||
          templateObj?.Id ||
          templateObj?.templateId ||
          templateId ||
          templateRecord?.Id ||
          "";

        console.log(`🎯 targetTemplateId for draft audit: ${targetTemplateId}, outletId: ${outletId}`);
        if (!targetTemplateId) {
          throw new Error("Missing template ID for draft audit initialization.");
        }

        setLoadingText("Initializing Draft Audit...");
        setLoadingSubText("Setting up audit draft with current store location...");
        const confirmedAuditId = await autoCreateDraftAudit(
          targetTemplateId,
          outletId,
          currentCoords.latitude,
          currentCoords.longitude
        );

        console.log(`✅ Draft audit confirmed with ID: ${confirmedAuditId}`);

        // Step 2.1: Load existing draft answers from local cache and/or server PS_Audit_Response__c
        let serverRespMap: { [qKey: string]: any } = {};
        let serverRemarks = "";
        try {
          if (confirmedAuditId) {
            const respQuery = `SELECT Id, Question_Id__c, Question__c, Response_Value__c, Response_Text__c, Has_Image__c, Response_Type__c FROM PS_Audit_Response__c WHERE Audit__c='${confirmedAuditId}' LIMIT 200`;
            const serverResp = await fetchRecords("PS_Audit_Response__c", respQuery);
            if (Array.isArray(serverResp) && serverResp.length > 0) {
              serverResp.forEach((r: any) => {
                if (r.Question_Id__c) {
                  serverRespMap[r.Question_Id__c] = r;
                }
              });
              console.log(`📥 [Draft AutoFill] Found ${serverResp.length} existing PS_Audit_Response__c records for audit: ${confirmedAuditId}`);
            }

            const auditQuery = `SELECT Id, Remarks__c FROM PS_Audit__c WHERE Id='${confirmedAuditId}' LIMIT 1`;
            const auditRec = await fetchRecords("PS_Audit__c", auditQuery);
            if (Array.isArray(auditRec) && auditRec[0]?.Remarks__c) {
              serverRemarks = auditRec[0].Remarks__c;
            }
          }
        } catch (err) {
          console.warn("⚠️ Error fetching server draft responses for autofill:", err);
        }

        // Check local storage draft answers cache
        let localDraftAnswers: { [qId: string]: AnswerState } = {};
        let localDraftRemarks = "";
        try {
          const draftAnswersKey = getDraftAnswersStorageKey(outletId, targetTemplateId);
          const cachedAnswersStr = await AsyncStorage.getItem(draftAnswersKey);
          if (cachedAnswersStr) {
            const parsedDraft = JSON.parse(cachedAnswersStr);
            if (parsedDraft && typeof parsedDraft === "object") {
              if (parsedDraft.answers && typeof parsedDraft.answers === "object") {
                localDraftAnswers = parsedDraft.answers;
              } else {
                localDraftAnswers = parsedDraft;
              }
              if (parsedDraft.remarks && typeof parsedDraft.remarks === "string") {
                localDraftRemarks = parsedDraft.remarks;
              }
            }
            console.log(`📥 [Draft AutoFill] Found local cached answers for template: ${targetTemplateId}`);
          }
        } catch (localErr) {
          console.warn("⚠️ Error fetching local draft answers:", localErr);
        }

        // Merge server and local draft into initialAnswers
        const finalAnswers: { [qId: string]: AnswerState } = {};
        qList.forEach((q) => {
          const qKey = q.Question_Id__c;
          const nType = getNormalizedResponseType(q.Response_Type__c);
          let currentAns: AnswerState = { ...initialAnswers[qKey] };

          // 1. Populate from Server PS_Audit_Response__c if available
          const serverRec = serverRespMap[qKey];
          if (serverRec) {
            if (nType === "Text") {
              currentAns.responseText = serverRec.Response_Text__c || "";
            } else if (serverRec.Response_Value__c !== null && serverRec.Response_Value__c !== undefined) {
              currentAns.responseValue = Number(serverRec.Response_Value__c);
            }
            if (serverRec.Has_Image__c) {
              currentAns.hasImage = true;
            }
            currentAns.responseRecordId = serverRec.Id;
          }

          // 2. Populate from Local Draft (overrides with most recent local changes / images)
          const localAns = localDraftAnswers[qKey];
          if (localAns) {
            if (localAns.responseValue !== undefined && localAns.responseValue !== null) {
              currentAns.responseValue = localAns.responseValue;
            }
            if (localAns.responseText !== undefined && localAns.responseText !== null) {
              currentAns.responseText = localAns.responseText;
            }
            if (localAns.imageUri) {
              currentAns.imageUri = localAns.imageUri;
            }
            if (localAns.imageBase64) {
              currentAns.imageBase64 = localAns.imageBase64;
            }
            if (localAns.imageFileName) {
              currentAns.imageFileName = localAns.imageFileName;
            }
            if (localAns.hasImage) {
              currentAns.hasImage = true;
            }
          }

          finalAnswers[qKey] = currentAns;
        });

        if (localDraftRemarks) {
          setRemarks(localDraftRemarks);
        } else if (serverRemarks) {
          setRemarks(serverRemarks);
        }

        // ONLY AFTER BOTH LOCATION AND DRAFT API SUCCEED:
        // Populate state and turn off loading to show the form!
        setQuestions(qList);
        setAnswers(finalAnswers);
        setAuditId(confirmedAuditId);
        setLoading(false);
      } else {
        dispatch(
          showToast({
            type: "warning",
            message: response?.message || "No template found for this outlet.",
          })
        );
        if (navigation?.canGoBack && navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    } catch (error: any) {
      console.error("❌ Error initializing Perfect Store template / draft:", error);
      const friendlyMsg = formatSubmitErrorMessage(error);
      dispatch(
        showToast({
          type: "error",
          message: friendlyMsg || "Failed to initialize Perfect Store audit.",
        })
      );
      if (navigation?.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  };

  useEffect(() => {
    fetchTemplate();
  }, [outletId]);

  // Group questions by Section_Name__c
  const sections = useMemo(() => {
    const map = new Map<string, QuestionItem[]>();
    questions.forEach((q) => {
      const section = (q.Section_Name__c || "General Audit").trim();
      if (!map.has(section)) {
        map.set(section, []);
      }
      map.get(section)!.push(q);
    });

    return Array.from(map.entries()).map(([sectionName, items]) => ({
      sectionName,
      items,
    }));
  }, [questions]);

  // Calculate live compliance score
  const scoreSummary = useMemo(() => {
    let totalWeight = 0;
    let achievedWeight = 0;
    let answeredCount = 0;

    questions.forEach((q) => {
      const weight = Number(q.Weightage__c) || 0;
      totalWeight += weight;

      const qKey = q.Question_Id__c;
      const ans = answers[qKey];
      const nType = getNormalizedResponseType(q.Response_Type__c);

      if (ans) {
        if (nType === "Yes/No") {
          if (ans.responseValue === 1 || ans.responseValue === 0) answeredCount++;
          if (ans.responseValue === 1) achievedWeight += weight;
        } else if (nType === "Rating 1-5") {
          if (ans.responseValue !== null && ans.responseValue !== undefined) answeredCount++;
          const r = ans.responseValue || 0;
          achievedWeight += (r / 5) * weight;
        } else if (nType === "Percentage") {
          if (ans.responseValue !== null && ans.responseValue !== undefined) answeredCount++;
          const p = ans.responseValue || 0;
          achievedWeight += (p / 100) * weight;
        } else if (nType === "Number") {
          if (ans.responseValue !== null && ans.responseValue !== undefined) answeredCount++;
          if ((ans.responseValue ?? 0) > 0) achievedWeight += weight;
        } else if (nType === "Text") {
          if (ans.responseText?.trim()) {
            answeredCount++;
            achievedWeight += weight;
          }
        }
      }
    });

    const scorePercent = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;
    const threshold = Number(templateRecord?.Perfect_Score_Threshold__c) || 80;
    const isPassing = totalWeight > 0 && scorePercent >= threshold;

    return {
      totalWeight,
      achievedWeight: Math.round(achievedWeight * 10) / 10,
      scorePercent,
      threshold,
      isPassing,
      answeredCount,
    };
  }, [questions, answers, templateRecord]);

  // Handle Response_Value__c change (Yes/No, Rating, Percentage, Number)
  const handleNumericValueChange = (qKey: string, val: number | null) => {
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...(prev[qKey] || { responseText: "" }),
        responseValue: val,
      },
    }));
  };

  // Handle Response_Text__c change (Text)
  const handleTextValueChange = (qKey: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...(prev[qKey] || { responseValue: null }),
        responseText: text,
      },
    }));
  };

  // Open camera to capture image
  const handleCaptureImage = async (qKey: string) => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      dispatch(
        showToast({
          type: "error",
          message: "Camera Access Required: Please enable camera permissions in your device settings to capture audit photos.",
        })
      );
      return;
    }

    launchCamera(
      {
        mediaType: "photo",
        includeBase64: true,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      },
      (res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
          dispatch(
            showToast({
              type: "error",
              message: res.errorMessage || "Unable to capture photo. Please try again.",
            })
          );
          return;
        }

        const asset = res.assets?.[0];
        if (asset?.uri) {
          setAnswers((prev) => ({
            ...prev,
            [qKey]: {
              ...(prev[qKey] || { responseValue: null, responseText: "" }),
              imageUri: asset.uri,
              imageBase64: asset.base64,
              imageFileName: asset.fileName || `audit_${Date.now()}.jpg`,
            },
          }));
        }
      }
    );
  };

  // Remove captured image
  const handleRemoveImage = (qKey: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...(prev[qKey] || { responseValue: null, responseText: "" }),
        imageUri: undefined,
        imageBase64: undefined,
        imageFileName: undefined,
      },
    }));
  };

  // Submit or Save as Draft Audit Form
  const handleSubmit = async (isDraft: boolean = false) => {
    if (!outletId) {
      dispatch(showToast({ type: "error", message: "Outlet Account ID is missing." }));
      return;
    }

    if (!isDraft) {
      // Check mandatory image validation with professional, clear feedback
      const missingPhotoItems = questions
        .map((q, idx) => ({ q, num: idx + 1 }))
        .filter(({ q }) => {
          const qKey = q.Question_Id__c;
          const ans = answers[qKey];
          return q.Requires_Image__c && !ans?.imageUri && !ans?.hasImage;
        });

      if (missingPhotoItems.length > 0) {
        let toastMsg = "";
        if (missingPhotoItems.length === 1) {
          toastMsg = `Photo Required: Please capture the mandatory photo for Question #${missingPhotoItems[0].num} before submitting.`;
        } else if (missingPhotoItems.length <= 3) {
          const qListStr = missingPhotoItems.map((m) => `#${m.num}`).join(", ");
          toastMsg = `Photos Required: Please capture mandatory photos for Questions ${qListStr} before submitting.`;
        } else {
          toastMsg = `Photos Required: Please capture mandatory photos for ${missingPhotoItems.length} questions before submitting.`;
        }

        dispatch(
          showToast({
            type: "warning",
            message: toastMsg,
          })
        );
        return;
      }

      // Check unanswered questions validation before submitting to backend
      const unansweredQuestions = questions
        .map((q, idx) => ({ q, num: idx + 1 }))
        .filter(({ q }) => !isQuestionAnswered(q, answers[q.Question_Id__c]));

      if (unansweredQuestions.length > 0) {
        const remainingCount = unansweredQuestions.length;
        let toastMsg = "";
        if (remainingCount === 1) {
          toastMsg = `Checklist Incomplete: Please answer Question #${unansweredQuestions[0].num} before submitting (1 question remaining).`;
        } else if (remainingCount <= 3) {
          const qListStr = unansweredQuestions.map((u) => `#${u.num}`).join(", ");
          toastMsg = `Checklist Incomplete: Please answer Questions ${qListStr} before submitting (${remainingCount} questions remaining).`;
        } else {
          toastMsg = `Checklist Incomplete: Please answer all checklist questions before submitting (${remainingCount} questions remaining).`;
        }

        dispatch(
          showToast({
            type: "warning",
            message: toastMsg,
          })
        );
        return;
      }
    }

    try {
      if (isDraft) {
        setIsDraftSaving(true);
      } else {
        setSubmitting(true);
      }

      const online = await isInternetAvailable();
      if (!online) {
        dispatch(
          showToast({
            type: "error",
            message: isDraft
              ? "Internet is required to save the audit draft."
              : "Internet is required to submit the audit.",
          })
        );
        setIsDraftSaving(false);
        setSubmitting(false);
        return;
      }

      // 1. Get GPS coordinates
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const coords: any = await getCurrentLocation();
        if (coords && coords.latitude !== undefined && coords.longitude !== undefined) {
          latitude = Number(Number(coords.latitude).toFixed(6));
          longitude = Number(Number(coords.longitude).toFixed(6));
        } else if (!isDraft) {
          throw new Error("Unable to retrieve valid GPS coordinates");
        }
      } catch (locErr: any) {
        console.warn("⚠️ Could not fetch GPS coordinates on submit:", locErr);
        if (!isDraft) {
          dispatch(
            showToast({
              type: "warning",
              message: getLocationErrorMessage(locErr),
            })
          );
          setSubmitting(false);
          return;
        }
      }

      // 1.1 Verify distance between current device location and outlet location based on Checkin_Distance_Setting__mdt (default 100m)
      if (!isDraft && latitude && longitude) {
        const outletCoords = await getOutletCoordinates();
        if (outletCoords && outletCoords.lat && outletCoords.lng) {
          const distanceInKm = getDistanceInKm(
            latitude,
            longitude,
            outletCoords.lat,
            outletCoords.lng
          );
          const distanceInMeters = distanceInKm * 1000;
          console.log(
            `📍 Distance to outlet (${outletCoords.lat}, ${outletCoords.lng}): ${distanceInMeters.toFixed(1)}m`
          );

          const { allowedMeters } = await getCachedCheckinDistanceLimit(fetchRecords);
          const limitMeters = !isNaN(allowedMeters) && allowedMeters > 0 ? allowedMeters : 100;

          if (distanceInMeters > limitMeters) {
            dispatch(
              showToast({
                type: "warning",
                message: `You are ${Math.round(distanceInMeters)}m away from the outlet. Submission is allowed only within ${Math.round(limitMeters)} meters of the outlet location.`,
              })
            );
            setSubmitting(false);
            return;
          }
        }
      }

      const currentDate = moment().format("YYYY-MM-DD");
      const currentDateTime = moment().format("YYYY-MM-DD HH:mm:ss");

      const currentTemplateId = templateId || templateRecord?.Id || "";
      const storageKey = getDraftStorageKey(outletId, currentTemplateId, currentDate);
      const draftAnswersKey = getDraftAnswersStorageKey(outletId, currentTemplateId);

      // Wait briefly if draft creation is currently in-flight
      if (draftCallingRef.current && !activeAuditIdRef.current) {
        let retries = 0;
        while (draftCallingRef.current && retries < 15) {
          await new Promise((res) => setTimeout(res, 200));
          retries++;
        }
      }

      // 2. Ensure we have the parent Draft Audit ID (targetAuditId)
      let targetAuditId = auditId || activeAuditIdRef.current || route?.params?.auditId || "";
      if (!targetAuditId) {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached && typeof cached === "string" && (cached.startsWith("a0") || cached.length >= 15)) {
          targetAuditId = cached;
        }
      }

      // If no Draft Audit exists yet, create one in "Draft" status first
      if (!targetAuditId) {
        console.log("=================================================================");
        console.log("🚀 [DRAFT PS_Audit__c PAYLOAD] POST /services/data/v67.0/sobjects/PS_Audit__c:");
        const draftPayload: any = {
          Outlet__c: outletId,
          Template__c: currentTemplateId,
          Status__c: "Draft",
          Audit_Date__c: currentDate,
          Remarks__c: remarks?.trim() || "",
        };
        if (latitude && longitude) {
          draftPayload.Latitude__c = latitude;
          draftPayload.Longitude__c = longitude;
        }
        console.log(JSON.stringify(draftPayload, null, 2));

        const draftRes = await apiFetch("POST", "sobjects/PS_Audit__c", draftPayload, "SObjects");
        console.log("📥 [DRAFT PS_Audit__c RESPONSE]:", JSON.stringify(draftRes, null, 2));
        console.log("=================================================================");
        if (draftRes && draftRes.status === "error") {
          throw new Error(draftRes.message || "Failed to initialize audit record.");
        }
        targetAuditId = draftRes?.data?.id || draftRes?.data?.Id || draftRes?.id || draftRes?.Id;
        if (targetAuditId) {
          setAuditId(targetAuditId);
          activeAuditIdRef.current = targetAuditId;
          await AsyncStorage.setItem(storageKey, targetAuditId).catch(() => { });
        }
      }

      if (!targetAuditId) {
        dispatch(
          showToast({
            type: "error",
            message: "Failed to initialize audit record. Please try again.",
          })
        );
        setIsDraftSaving(false);
        setSubmitting(false);
        return;
      }

      // =========================================================================
      // STEP 1: Query existing PS_Audit_Response__c to decide UPDATE (PATCH) vs INSERT (POST)
      // =========================================================================
      let existingResponsesMap: { [qKey: string]: any } = {};
      try {
        const respQuery = `SELECT Id, Question_Id__c, Question__c, Response_Value__c, Response_Text__c, Has_Image__c FROM PS_Audit_Response__c WHERE Audit__c='${targetAuditId}' LIMIT 500`;
        const serverResp = await fetchRecords("PS_Audit_Response__c", respQuery);
        if (Array.isArray(serverResp)) {
          serverResp.forEach((r: any) => {
            if (r.Question_Id__c) {
              existingResponsesMap[r.Question_Id__c] = r;
            }
          });
        }
      } catch (e) {
        console.warn("Could not query existing responses before saving:", e);
      }

      const recordsToInsert: any[] = [];
      const recordsToUpdate: any[] = [];
      const questionIndexMap: { [qKey: string]: { isUpdate: boolean; index: number } } = {};

      questions.forEach((q) => {
        const qKey = q.Question_Id__c;
        const ans = answers[qKey] || { responseValue: null, responseText: "" };
        const nType = getNormalizedResponseType(q.Response_Type__c);
        const existingRec = existingResponsesMap[qKey];

        const respVal =
          nType === "Text"
            ? null
            : ans.responseValue !== null && ans.responseValue !== undefined
              ? Number(ans.responseValue)
              : 0;

        const respText = nType === "Text" ? (ans.responseText || "") : null;

        if (existingRec && existingRec.Id) {
          const updateObj: any = {
            attributes: { type: "PS_Audit_Response__c" },
            id: existingRec.Id,
            Response_Type__c: q.Response_Type__c || nType,
            Response_Value__c: respVal,
            Requires_Image__c: Boolean(q.Requires_Image__c),
            Has_Image__c: ans.hasImage || !!ans.imageUri || Boolean(existingRec.Has_Image__c),
          };
          if (nType === "Text") {
            updateObj.Response_Text__c = respText;
          }
          questionIndexMap[qKey] = { isUpdate: true, index: recordsToUpdate.length };
          recordsToUpdate.push(updateObj);
        } else {
          const insertObj: any = {
            attributes: { type: "PS_Audit_Response__c" },
            Audit__c: targetAuditId,
            Question_Id__c: q.Question_Id__c,
            Question__c: q.Question__c,
            Section_Name__c: q.Section_Name__c || "General Audit",
            Weightage__c: q.Weightage__c ? Number(q.Weightage__c) : 0,
            Response_Type__c: q.Response_Type__c || nType,
            Response_Value__c: respVal,
            Requires_Image__c: Boolean(q.Requires_Image__c),
            Has_Image__c: ans.hasImage || !!ans.imageUri || false,
          };
          if (nType === "Text") {
            insertObj.Response_Text__c = respText;
          }
          questionIndexMap[qKey] = { isUpdate: false, index: recordsToInsert.length };
          recordsToInsert.push(insertObj);
        }
      });

      const saveResultsMap: { [qKey: string]: string } = {};

      // 1.1 Execute Composite PATCH for recordsToUpdate
      if (recordsToUpdate.length > 0) {
        console.log(`📤 [STEP 1: COMPOSITE PATCH] Updating ${recordsToUpdate.length} existing PS_Audit_Response__c records`);
        const CHUNK_SIZE = 200;
        for (let c = 0; c < recordsToUpdate.length; c += CHUNK_SIZE) {
          const chunk = recordsToUpdate.slice(c, c + CHUNK_SIZE);
          const compRes = await apiFetch(
            "PATCH",
            "composite/sobjects",
            { allOrNone: true, records: chunk },
            "SObjects"
          );
          if (compRes && compRes.status === "error") {
            console.error("❌ [STEP 1 ERROR] Composite PATCH failed:", compRes);
            throw new Error(compRes.message || "Failed to update audit responses via composite API.");
          }
        }
      }

      // 1.2 Execute Composite POST for recordsToInsert
      if (recordsToInsert.length > 0) {
        console.log(`📤 [STEP 1: COMPOSITE POST] Creating ${recordsToInsert.length} new PS_Audit_Response__c records`);
        const CHUNK_SIZE = 200;
        for (let c = 0; c < recordsToInsert.length; c += CHUNK_SIZE) {
          const chunk = recordsToInsert.slice(c, c + CHUNK_SIZE);
          const compRes = await apiFetch(
            "POST",
            "composite/sobjects",
            { allOrNone: true, records: chunk },
            "SObjects"
          );
          if (compRes && compRes.status === "error") {
            console.error("❌ [STEP 1 ERROR] Composite POST failed:", compRes);
            throw new Error(compRes.message || "Failed to create audit responses via composite API.");
          }

          const chunkResults = Array.isArray(compRes?.data)
            ? compRes.data
            : Array.isArray(compRes?.data?.records)
              ? compRes.data.records
              : Array.isArray(compRes)
                ? compRes
                : [];

          questions.forEach((q) => {
            const qKey = q.Question_Id__c;
            const mapping = questionIndexMap[qKey];
            if (mapping && !mapping.isUpdate) {
              const resObj = chunkResults[mapping.index];
              const createdId = resObj?.id || resObj?.Id;
              if (createdId) {
                saveResultsMap[qKey] = createdId;
              }
            }
          });
        }
      }

      // =========================================================================
      // STEP 2: Upload Photos & Link to Response Record (ContentDocumentLink)
      // =========================================================================
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qKey = q.Question_Id__c;
        const ans = answers[qKey];
        const responseRecordId =
          existingResponsesMap[qKey]?.Id ||
          saveResultsMap[qKey] ||
          ans?.responseRecordId;

        if ((ans?.imageUri || ans?.imageBase64) && responseRecordId) {
          try {
            console.log(
              `📸 [Photo Upload] Processing photo for Question ${qKey}, Response Record: ${responseRecordId}`
            );

            let base64Data = ans.imageBase64;
            if (!base64Data && ans.imageUri) {
              const cleanPath =
                Platform.OS === "ios"
                  ? ans.imageUri.replace("file://", "")
                  : ans.imageUri;
              base64Data = await RNFS.readFile(cleanPath, "base64");
            }

            if (!base64Data) {
              console.warn(`⚠️ [Photo Upload] No base64 data for Question: ${qKey}`);
              continue;
            }

            if (base64Data.includes(",")) {
              base64Data = base64Data.split(",")[1];
            }

            const cleanQId = (q.Question_Id__c || `q_${i + 1}`).replace(
              /[^a-zA-Z0-9_-]/g,
              "_"
            );
            const imageFileName = `PS_Audit_Planogram_${cleanQId}.jpg`;

            // Upload ContentVersion
            const cvPayload = {
              Title: imageFileName,
              PathOnClient: imageFileName,
              VersionData: base64Data,
            };
            const cvRes = await apiFetch(
              "POST",
              "sobjects/ContentVersion",
              cvPayload,
              "SObjects"
            );

            const contentVersionId =
              cvRes?.data?.id || cvRes?.data?.Id || cvRes?.id || cvRes?.Id;
            if (!contentVersionId) {
              console.warn(`❌ [Photo Upload] Failed ContentVersion for ${qKey}:`, cvRes);
              continue;
            }

            // Query ContentDocumentId
            const queryEndpoint = `query?q=SELECT+ContentDocumentId+FROM+ContentVersion+WHERE+Id='${contentVersionId}'`;
            const queryRes = await apiFetch("GET", queryEndpoint, {}, "SObjects");
            const contentDocId = queryRes?.data?.records?.[0]?.ContentDocumentId;
            if (!contentDocId) {
              console.warn(`❌ [Photo Upload] No ContentDocumentId for ${contentVersionId}`);
              continue;
            }

            // Link to PS_Audit_Response__c
            const cdlPayload = {
              ContentDocumentId: contentDocId,
              LinkedEntityId: responseRecordId,
              ShareType: "V",
              Visibility: "AllUsers",
            };
            await apiFetch("POST", "sobjects/ContentDocumentLink", cdlPayload, "SObjects");

            // Update Has_Image__c on PS_Audit_Response__c
            await apiFetch(
              "PATCH",
              `sobjects/PS_Audit_Response__c/${responseRecordId}`,
              { Has_Image__c: true },
              "SObjects"
            );
          } catch (photoErr) {
            console.error(`❌ [Photo Upload] Error for ${qKey}:`, photoErr);
          }
        }
      }

      // =========================================================================
      // STEP 3: Call PATCH on PS_Audit__c
      // =========================================================================
      const patchEndpoint = `sobjects/PS_Audit__c/${targetAuditId}`;
      const patchPayload: any = {
        Status__c: isDraft ? "Draft" : "Submitted",
        Remarks__c: remarks?.trim() || "",
      };
      if (latitude && longitude) {
        patchPayload.Latitude__c = latitude;
        patchPayload.Longitude__c = longitude;
      }

      console.log("=================================================================");
      console.log(`📤 [STEP 3 PAYLOAD] PATCH /services/data/v67.0/sobjects/PS_Audit__c/${targetAuditId}:`);
      console.log("🎯 Endpoint:", patchEndpoint);
      console.log("📦 Payload:", JSON.stringify(patchPayload, null, 2));

      const patchRes = await apiFetch("PATCH", patchEndpoint, patchPayload, "SObjects");

      console.log("📥 [STEP 3 RESPONSE] PATCH /services/data/v67.0/sobjects/PS_Audit__c:", patchRes);
      console.log("=================================================================");

      if (patchRes && patchRes.status === "error") {
        console.error("❌❌❌ ERROR DETECTED IN STEP 3: PATCH PS_Audit__c ❌❌❌", patchRes);
        let errorDetail = patchRes.message || "Failed to update audit status.";
        throw new Error(errorDetail);
      }

      if (isDraft) {
        // ========== DRAFT SAVED SUCCESSFULLY ==========
        // Persist local draft answers and remarks
        await AsyncStorage.setItem(
          draftAnswersKey,
          JSON.stringify({ answers, remarks: remarks?.trim() || "" })
        ).catch(() => { });
        await AsyncStorage.setItem(storageKey, targetAuditId).catch(() => { });
        activeAuditIdRef.current = targetAuditId;

        dispatch(
          showToast({
            type: "success",
            message: "Perfect Store audit saved as draft!",
          })
        );
        navigation.navigate("PerfectStoreTemplatesScreen", {
          outletId,
          outletName,
          justDraftedTemplateId: currentTemplateId,
          refreshTimestamp: Date.now(),
        });
      } else {
        // ========== FINAL SUBMITTED SUCCESSFULLY ==========
        // Step 7: Display Final Scorecard & Summary
        let scData: any = null;
        try {
          console.log(`📤 [Step 7 Scorecard] Fetching updated audit record for ${targetAuditId}...`);
          const scorecardEndpoint = `sobjects/PS_Audit__c/${targetAuditId}?fields=Name,Total_Score__c,Max_Score__c,Compliance_Percentage__c,Is_Perfect__c,Submitted_On__c`;
          const scorecardRes = await apiFetch("GET", scorecardEndpoint, {}, "SObjects");
          console.log("📥 [Step 7 Scorecard] Response:", scorecardRes);

          scData = scorecardRes?.data?.Id ? scorecardRes.data : scorecardRes?.data || null;
          if (scData) {
            await AsyncStorage.setItem(`@PS_CACHED_SCORECARD_${outletId}`, JSON.stringify(scData)).catch(() => { });
          }
        } catch (scErr) {
          console.warn("⚠️ Scorecard fetch warning:", scErr);
        }
        await AsyncStorage.setItem(`@PS_LATEST_SUBMITTED_AUDIT_ID_${outletId}`, targetAuditId).catch(() => { });

        // Clear cached draft ID and draft answers after successful submission
        await AsyncStorage.removeItem(storageKey).catch(() => { });
        await AsyncStorage.removeItem(draftAnswersKey).catch(() => { });
        await AsyncStorage.removeItem(`PS_DRAFT_AUDIT_${outletId}_${currentTemplateId}`).catch(() => { });
        activeAuditIdRef.current = "";

        // Record submission locally in AsyncStorage so templates list updates instantly
        try {
          const submittedKey = `@PS_SUBMITTED_AUDITS_${outletId}`;
          const existingSubmitted = await AsyncStorage.getItem(submittedKey);
          let subList = existingSubmitted ? JSON.parse(existingSubmitted) : [];
          if (!Array.isArray(subList)) subList = [];
          subList = subList.filter((s: any) => s.templateId !== currentTemplateId);
          subList.push({
            id: targetAuditId,
            auditName: scData?.Name || "Audit Record",
            templateId: currentTemplateId,
            status: "Submitted",
            auditDate: currentDate,
            createdDate: currentDateTime,
            score:
              scData?.Score__c !== undefined && scData?.Score__c !== null
                ? Number(scData.Score__c)
                : undefined,
            totalScore:
              scData?.Total_Score__c !== undefined && scData?.Total_Score__c !== null
                ? Number(scData.Total_Score__c)
                : null,
            maxScore:
              scData?.Max_Score__c !== undefined && scData?.Max_Score__c !== null
                ? Number(scData.Max_Score__c)
                : null,
            compliancePercentage:
              scData?.Compliance_Percentage__c !== undefined &&
                scData?.Compliance_Percentage__c !== null
                ? Number(scData.Compliance_Percentage__c)
                : null,
            isPerfect: Boolean(scData?.Is_Perfect__c),
            submittedOn: scData?.Submitted_On__c || currentDateTime,
          });
          await AsyncStorage.setItem(submittedKey, JSON.stringify(subList));
        } catch (subErr) {
          console.warn("Could not save audit submission locally:", subErr);
        }

        dispatch(
          showToast({
            type: "success",
            message: "Perfect Store audit submitted successfully!",
          })
        );
        navigation.navigate("PerfectStoreTemplatesScreen", {
          outletId,
          outletName,
          latestAuditId: targetAuditId,
          justSubmittedTemplateId: currentTemplateId,
          refreshTimestamp: Date.now(),
        });
      }
    } catch (error: any) {
      console.error("❌ Audit submission error:", error);
      const friendlyMsg = formatSubmitErrorMessage(error?.message || error);
      dispatch(
        showToast({
          type: "error",
          message: friendlyMsg,
        })
      );
    } finally {
      setIsDraftSaving(false);
      setSubmitting(false);
    }
  };

  /**
   * Render Question Mobile Widget according to exact Response Type (Compact & User-Friendly)
   */
  const renderResponseWidget = (q: QuestionItem, qKey: string) => {
    const nType = getNormalizedResponseType(q.Response_Type__c);
    const ans = answers[qKey] || { responseValue: null, responseText: "" };

    switch (nType) {
      // 1. YES / NO (Compact Segmented Control)
      case "Yes/No": {
        const isYes = ans.responseValue === 1;
        const isNo = ans.responseValue === 0;

        return (
          <View style={styles.yesNoContainer}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentedBtn,
                  isYes && styles.segmentedBtnYesActive,
                ]}
                onPress={() => handleNumericValueChange(qKey, isYes ? null : 1)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={isYes ? "#FFFFFF" : "#2E7D5B"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.segmentedBtnText,
                    isYes && styles.segmentedBtnTextActive,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentedBtn,
                  isNo && styles.segmentedBtnNoActive,
                ]}
                onPress={() => handleNumericValueChange(qKey, isNo ? null : 0)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="close-circle"
                  size={13}
                  color={isNo ? "#FFFFFF" : "#B3261E"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.segmentedBtnText,
                    isNo && styles.segmentedBtnTextActive,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // 2. RATING 1-5 (Compact 5-Star Row + Score Badge)
      case "Rating 1-5": {
        const currentRating =
          ans.responseValue !== null && ans.responseValue !== undefined
            ? Number(ans.responseValue)
            : null;

        return (
          <View style={styles.ratingWidgetContainer}>
            <View
              style={[
                styles.starsBar,
                currentRating === null && styles.starsBarUnselected,
              ]}
            >
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = currentRating !== null && star <= currentRating;
                  return (
                    <TouchableOpacity
                      key={`star_${star}`}
                      onPress={() => {
                        // If tapping the current selected star, remove 1 star (decrement by 1)
                        if (currentRating === star) {
                          handleNumericValueChange(qKey, star > 1 ? star - 1 : null);
                        } else {
                          handleNumericValueChange(qKey, star);
                        }
                      }}
                      style={styles.starTouchArea}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons
                        name={filled ? "star" : "star-outline"}
                        size={26}
                        color={filled ? "#F59E0B" : "#7A7266"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[
                  styles.ratingScorePill,
                  currentRating === null && styles.ratingScorePillUnselected,
                ]}
                onPress={() => {
                  if (currentRating !== null) {
                    handleNumericValueChange(qKey, null);
                  }
                }}
                activeOpacity={currentRating !== null ? 0.7 : 1}
              >
                <Text
                  style={[
                    styles.ratingScoreText,
                    currentRating === null && styles.ratingScoreTextUnselected,
                  ]}
                >
                  {currentRating !== null ? `${currentRating} / 5` : "Tap to rate"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // 3. PERCENTAGE (Compact Stepper & Quick Presets)
      case "Percentage": {
        const currentPct =
          ans.responseValue !== null && ans.responseValue !== undefined
            ? Number(ans.responseValue)
            : 0;

        return (
          <View style={styles.percentageWidgetContainer}>
            <View style={styles.pctStepperRow}>
              <TouchableOpacity
                style={styles.pctStepButton}
                onPress={() => {
                  const nextVal = Math.max(0, currentPct - 5);
                  handleNumericValueChange(qKey, nextVal);
                }}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={12} color="#3B5BB5" />
                <Text style={styles.pctStepButtonLabel}>5%</Text>
              </TouchableOpacity>

              <View style={styles.pctDisplayWrap}>
                <TextInput
                  style={styles.pctTextInput}
                  keyboardType="numeric"
                  maxLength={3}
                  value={
                    ans.responseValue !== null && ans.responseValue !== undefined
                      ? String(ans.responseValue)
                      : ""
                  }
                  placeholder="0"
                  placeholderTextColor="#7A7266"
                  onChangeText={(txt) => {
                    const clean = txt.replace(/[^0-9]/g, "");
                    if (clean === "") {
                      handleNumericValueChange(qKey, null);
                    } else {
                      const num = Math.min(
                        100,
                        Math.max(0, parseInt(clean, 10))
                      );
                      handleNumericValueChange(qKey, num);
                    }
                  }}
                />
                <Text style={styles.pctSymbolText}>%</Text>
              </View>

              <TouchableOpacity
                style={styles.pctStepButton}
                onPress={() => {
                  const nextVal = Math.min(100, currentPct + 5);
                  handleNumericValueChange(qKey, nextVal);
                }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={12} color="#3B5BB5" />
                <Text style={styles.pctStepButtonLabel}>5%</Text>
              </TouchableOpacity>
            </View>

            {/* Slim Progress Fill Bar */}
            <View style={styles.pctBarTrack}>
              <View
                style={[
                  styles.pctBarFill,
                  {
                    width: `${Math.min(100, Math.max(0, currentPct))}%`,
                    backgroundColor:
                      currentPct >= 75
                        ? "#2E7D5B"
                        : currentPct >= 40
                          ? "#3B5BB5"
                          : "#F59E0B",
                  },
                ]}
              />
            </View>

            <View style={styles.pctPresetsRow}>
              {[0, 25, 50, 75, 100].map((preset) => {
                const isActive = ans.responseValue === preset;
                return (
                  <TouchableOpacity
                    key={`pct_${preset}`}
                    style={[
                      styles.pctPresetBtn,
                      isActive && styles.pctPresetBtnActive,
                    ]}
                    onPress={() => handleNumericValueChange(qKey, isActive ? null : preset)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pctPresetBtnText,
                        isActive && styles.pctPresetBtnTextActive,
                      ]}
                    >
                      {preset}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      }

      // 4. NUMBER / QUANTITY (Compact Stepper & Small Presets)
      case "Number": {
        const currentVal =
          ans.responseValue !== null && ans.responseValue !== undefined
            ? Number(ans.responseValue)
            : 0;

        return (
          <View style={styles.numberWidgetContainer}>
            <View style={styles.quantityCounterCard}>
              <TouchableOpacity
                style={[
                  styles.qtyRoundBtn,
                  currentVal <= 0 && styles.qtyRoundBtnDisabled,
                ]}
                onPress={() => {
                  handleNumericValueChange(qKey, Math.max(0, currentVal - 1));
                }}
                disabled={currentVal <= 0}
                activeOpacity={0.7}
              >
                <Feather
                  name="minus"
                  size={13}
                  color={currentVal <= 0 ? "#7A7266" : "#1F1D1A"}
                />
              </TouchableOpacity>

              <View style={styles.qtyDisplayWrap}>
                <TextInput
                  style={styles.qtyTextInput}
                  keyboardType={
                    Platform.OS === "ios" ? "decimal-pad" : "numeric"
                  }
                  placeholder="0"
                  placeholderTextColor="#7A7266"
                  value={
                    ans.responseValue !== null && ans.responseValue !== undefined
                      ? String(ans.responseValue)
                      : ""
                  }
                  onChangeText={(txt) => {
                    if (txt.trim() === "" || txt === "-") {
                      handleNumericValueChange(qKey, null);
                    } else {
                      const parsed = parseFloat(txt);
                      handleNumericValueChange(
                        qKey,
                        isNaN(parsed) ? 0 : parsed
                      );
                    }
                  }}
                />
              </View>

              <TouchableOpacity
                style={styles.qtyRoundBtnPlus}
                onPress={() => {
                  handleNumericValueChange(qKey, currentVal + 1);
                }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.qtyQuickRow}>
              {[1, 5, 10].map((inc) => (
                <TouchableOpacity
                  key={`inc_${inc}`}
                  style={styles.qtyQuickPill}
                  onPress={() => handleNumericValueChange(qKey, currentVal + inc)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qtyQuickPillText}>+{inc}</Text>
                </TouchableOpacity>
              ))}

              {currentVal > 0 && (
                <TouchableOpacity
                  style={styles.qtyResetPill}
                  onPress={() => handleNumericValueChange(qKey, 0)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="rotate-ccw"
                    size={9.5}
                    color="#EF4444"
                    style={{ marginRight: 2 }}
                  />
                  <Text style={styles.qtyResetPillText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      }

      // 5. TEXT (Compact Text Field)
      case "Text": {
        return (
          <View style={styles.textWidgetContainer}>
            <TextInput
              style={styles.multiLineTextInput}
              placeholder="Enter observations / comments..."
              placeholderTextColor="#7A7266"
              multiline
              numberOfLines={2}
              value={ans.responseText || ""}
              onChangeText={(txt) => handleTextValueChange(qKey, txt)}
            />
            <View style={styles.textCharCountRow}>
              <Text style={styles.charCountText}>
                {(ans.responseText || "").length} chars
              </Text>
            </View>
          </View>
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />
      {/* Attractive & User-Friendly Gradient Header */}
      <LinearGradient
        colors={["#1E3A8A", "#13265C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          { paddingTop: Platform.OS === "ios" ? 72 : 52 },
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={19} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerMainTitle} numberOfLines={1}>
              {templateRecord?.Name || "Perfect Store Audit"}
            </Text>
            <View style={styles.outletSubtitleRow}>
              <MIcon
                name="storefront"
                size={12}
                color="rgba(255, 255, 255, 0.85)"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.outletSubtitle} numberOfLines={1}>
                {outletName}
              </Text>
            </View>
          </View>

          {/* Attractive Live Score Badge */}
          <View
            style={[
              styles.headerScorePill,
              scoreSummary.isPassing
                ? styles.scorePillPassing
                : styles.scorePillPending,
            ]}
          >
            <Feather
              name={scoreSummary.isPassing ? "check-circle" : "activity"}
              size={12}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.headerScoreText}>
              {scoreSummary.scorePercent}%
            </Text>
          </View>
        </View>

        {/* Attractive Glassmorphic Meta Info Strip */}
        <View style={styles.metaStripCard}>
          <View style={styles.metaStripItem}>
            <Feather
              name="calendar"
              size={11}
              color="rgba(255, 255, 255, 0.85)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.metaChipText}>
              {moment().format("DD MMM YYYY")}
            </Text>
          </View>

          {Boolean(templateRecord?.Frequency__c) && (
            <View style={styles.metaFreqPill}>
              <Text style={styles.metaFreqText}>
                {templateRecord?.Frequency__c}
              </Text>
            </View>
          )}

          <View style={styles.metaStripItem}>
            <Text style={styles.metaChipText}>
              {scoreSummary.answeredCount}/{questions.length} Ans
            </Text>
          </View>

          <View
            style={[
              styles.statusDotPill,
              {
                backgroundColor: scoreSummary.isPassing
                  ? "rgba(34, 197, 94, 0.25)"
                  : "rgba(245, 158, 11, 0.25)",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: scoreSummary.isPassing
                    ? "#4ADE80"
                    : "#FBBF24",
                },
              ]}
            />
            <Text
              style={[
                styles.statusDotText,
                { color: scoreSummary.isPassing ? "#86EFAC" : "#FDE047" },
              ]}
            >
              {scoreSummary.isPassing ? "Passing" : "Under Target"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#1E3A8A" />
          <Text style={styles.loadingText}>{loadingText}</Text>
          <Text style={styles.loadingSubText}>{loadingSubText}</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <MIcon name="assignment" size={28} color="#7A7266" />
          </View>
          <Text style={styles.emptyTitle}>No Questions Found</Text>
          <Text style={styles.emptySubText}>
            No checklist questions configured for this template.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchTemplate}
            activeOpacity={0.8}
          >
            <Feather
              name="refresh-cw"
              size={12}
              color="#fff"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 80 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >

            {/* Sections & Questions */}
            {sections.map(({ sectionName, items }, sIdx) => (
              <View key={`sec-${sIdx}`} style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{sIdx + 1}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{sectionName}</Text>
                  <Text style={styles.sectionCountText}>{items.length} Qs</Text>
                </View>

                {items.map((q, qIdx) => {
                  const qKey = q.Question_Id__c;
                  const currentAnswer = answers[qKey] || {
                    responseValue: null,
                    responseText: "",
                  };

                  const isAnswered = isQuestionAnswered(q, currentAnswer);

                  return (
                    <View
                      key={qKey}
                      style={[
                        styles.questionCard,
                        isAnswered && styles.questionCardAnswered,
                      ]}
                    >
                      {/* Top Row: Q Number + Question Text */}
                      <View style={styles.questionTopRow}>
                        <View
                          style={[
                            styles.qNumBadge,
                            isAnswered && styles.qNumBadgeAnswered,
                          ]}
                        >
                          {isAnswered ? (
                            <Feather name="check" size={9} color="#2E7D5B" />
                          ) : (
                            <Text style={styles.qNumText}>{qIdx + 1}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.questionText}>
                            {q.Question__c?.replace(/\s*\*$/, "")}
                            <Text style={styles.requiredStar}> *</Text>
                          </Text>
                        </View>
                      </View>

                      {/* Meta Badges: Weightage, Photo Requirement */}
                      {Boolean(q.Weightage__c) || q.Requires_Image__c ? (
                        <View style={styles.qMetaRow}>
                          {Boolean(q.Weightage__c) && (
                            <View style={styles.weightBadge}>
                              <Text style={styles.weightBadgeText}>
                                Weightage: {q.Weightage__c}%
                              </Text>
                            </View>
                          )}

                          {q.Requires_Image__c && (
                            <View style={styles.photoRequiredBadge}>
                              <Feather
                                name="camera"
                                size={10}
                                color="#C2410C"
                                style={{ marginRight: 3 }}
                              />
                              <Text style={styles.photoRequiredText}>
                                Photo Required
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : null}

                      {/* Compact Response Widget */}
                      <View style={styles.responseContainer}>
                        {renderResponseWidget(q, qKey)}
                      </View>

                      {/* Photo Capture Section */}
                      {(q.Requires_Image__c || currentAnswer.imageUri) && (
                        <View style={styles.imageSection}>
                          {currentAnswer.imageUri ? (
                            <View style={styles.imagePreviewWrap}>
                              <Image
                                source={{ uri: currentAnswer.imageUri }}
                                style={styles.imageThumbnail}
                              />
                              <View style={styles.imageInfoWrap}>
                                <Text
                                  style={styles.imageSuccessText}
                                  numberOfLines={1}
                                >
                                  ✓ Photo Attached
                                </Text>
                                <View style={styles.imageActionButtons}>
                                  <TouchableOpacity
                                    style={styles.retakeBtn}
                                    onPress={() => handleCaptureImage(qKey)}
                                  >
                                    <Feather
                                      name="refresh-cw"
                                      size={10.5}
                                      color="#3B5BB5"
                                    />
                                    <Text style={styles.retakeBtnText}>
                                      Retake
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemoveImage(qKey)}
                                  >
                                    <Feather
                                      name="trash-2"
                                      size={10.5}
                                      color="#B3261E"
                                    />
                                    <Text style={styles.removeBtnText}>
                                      Remove
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.captureBtn}
                              onPress={() => handleCaptureImage(qKey)}
                              activeOpacity={0.8}
                            >
                              <Feather
                                name="camera"
                                size={11}
                                color="#1E3A8A"
                                style={{ marginRight: 5 }}
                              />
                              <Text style={styles.captureBtnText}>
                                {q.Requires_Image__c
                                  ? "Capture Photo *"
                                  : "Add Photo"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Audit Remarks Section at Bottom */}
            <View style={styles.remarksContainer}>
              <View style={styles.remarksLabelRow}>
                <Feather
                  name="file-text"
                  size={12}
                  color="#7A7266"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.remarksLabel}>Remarks</Text>
                <Text style={styles.remarksOptionalTag}>(Optional)</Text>
              </View>
              <View style={styles.remarksRow}>
                <Feather
                  name="edit-3"
                  size={12}
                  color="#7A7266"
                  style={{ marginRight: 6 }}
                />
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Enter audit remarks / notes here..."
                  placeholderTextColor="#7A7266"
                  value={remarks}
                  onChangeText={setRemarks}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 250);
                  }}
                />
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: insets.bottom > 0 ? Math.min(insets.bottom, 8) : 5 },
            ]}
          >
            {/* Upper Status & Score Summary Row */}
            <View style={styles.summaryRow}>
              <View style={styles.answeredBadge}>
                <Feather
                  name={scoreSummary.answeredCount === questions.length ? "check-circle" : "edit-3"}
                  size={11}
                  color={scoreSummary.answeredCount === questions.length ? "#2E7D5B" : "#7A7266"}
                  style={{ marginRight: 3.5 }}
                />
                <Text style={styles.answeredBadgeText}>
                  {scoreSummary.answeredCount} of {questions.length} Answered
                </Text>
              </View>

              <View style={styles.scoreBadgeWrap}>
                <Text style={styles.scoreText}>
                  Score:{" "}
                  <Text
                    style={[
                      styles.scoreBold,
                      { color: scoreSummary.scorePercent >= scoreSummary.threshold ? "#2E7D5B" : "#D08C1F" },
                    ]}
                  >
                    {scoreSummary.scorePercent}%
                  </Text>
                </Text>
                <Text style={styles.targetText}> • Target: {scoreSummary.threshold}%</Text>
              </View>
            </View>

            {/* Main Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.draftButton,
                  (submitting || isDraftSaving) && { opacity: 0.6 },
                ]}
                onPress={() => handleSubmit(true)}
                disabled={submitting || isDraftSaving}
                activeOpacity={0.7}
              >
                {isDraftSaving ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#1E3A8A"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.draftButtonText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <MIcon
                      name="bookmark-border"
                      size={15}
                      color="#1E3A8A"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.draftButtonText}>Save Draft</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (submitting || isDraftSaving) && { opacity: 0.6 },
                ]}
                onPress={() => handleSubmit(false)}
                disabled={submitting || isDraftSaving}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.submitButtonText}>Submitting...</Text>
                  </>
                ) : (
                  <>
                    <MIcon
                      name="check-circle"
                      size={15}
                      color="#fff"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.submitButtonText}>Submit Audit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF8F1",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerMainTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  outletSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  outletSubtitle: {
    fontSize: 11.5,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },
  headerScorePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  scorePillPassing: {
    backgroundColor: "#15803D",
  },
  scorePillPending: {
    backgroundColor: "#B45309",
  },
  headerScoreText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },
  metaStripCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    marginTop: 7,
  },
  metaStripItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaChipText: {
    fontSize: 10.5,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  metaFreqPill: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  metaFreqText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusDotPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusDotText: {
    fontSize: 10,
    fontWeight: "700",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1F1D1A",
    marginTop: 8,
  },
  loadingSubText: {
    fontSize: 11.5,
    color: "#7A7266",
    marginTop: 2,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1EADB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  emptySubText: {
    fontSize: 11.5,
    color: "#7A7266",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3A8A",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  remarksContainer: {
    marginTop: 6,
    marginBottom: 10,
  },
  remarksLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  remarksLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1F1D1A",
  },
  remarksOptionalTag: {
    fontSize: 10,
    color: "#7A7266",
    marginLeft: 4,
    fontWeight: "500",
  },
  remarksRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    paddingHorizontal: 9,
    height: 36,
  },
  remarksInput: {
    flex: 1,
    fontSize: 11.5,
    color: "#1F1D1A",
    paddingVertical: 0,
  },
  sectionContainer: {
    marginBottom: 7,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    marginTop: 4,
    gap: 5,
  },
  sectionBadge: {
    width: 17,
    height: 17,
    borderRadius: 4,
    backgroundColor: "#1E3A8A",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#FFF",
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1F1D1A",
    flex: 1,
  },
  sectionCountText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#7A7266",
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderLeftWidth: 3.5,
    borderLeftColor: "#D9D2C3",
  },
  questionCardAnswered: {
    borderColor: "#D9D2C3",
    borderLeftColor: "#2E7D5B",
  },
  questionTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  qNumBadge: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#F1EADB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 7,
    marginTop: 1,
  },
  qNumBadgeAnswered: {
    backgroundColor: "#E3F1EA",
  },
  qNumText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#7A7266",
  },
  questionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1F1D1A",
    lineHeight: 17,
  },
  requiredStar: {
    color: "#B3261E",
    fontSize: 12.5,
    fontWeight: "700",
  },
  qMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 5,
  },
  weightBadge: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "#BAE6FD",
  },
  weightBadgeText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#3B5BB5",
  },
  photoRequiredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "#FFEDD5",
  },
  photoRequiredText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#C2410C",
  },
  responseContainer: {
    marginTop: 6,
  },
  // Yes / No Widget
  yesNoContainer: {
    alignSelf: "flex-start",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F1EADB",
    borderRadius: 5,
    padding: 2,
    gap: 3,
    minWidth: 110,
    height: 27,
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  segmentedBtnYesActive: {
    backgroundColor: "#2E7D5B",
  },
  segmentedBtnNoActive: {
    backgroundColor: "#B3261E",
  },
  segmentedBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A7266",
  },
  segmentedBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  // Rating 1-5 Widget
  ratingWidgetContainer: {
    width: "100%",
  },
  starsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  starsBarUnselected: {
    backgroundColor: "#FBF8F1",
    borderColor: "#D9D2C3",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  starTouchArea: {
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingScorePill: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingScorePillUnselected: {
    backgroundColor: "#D9D2C3",
  },
  ratingScoreText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "700",
  },
  ratingScoreTextUnselected: {
    color: "#7A7266",
    fontSize: 11,
    fontWeight: "600",
  },
  // Percentage Widget
  percentageWidgetContainer: {
    width: "100%",
  },
  pctStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  pctStepButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 0.5,
    borderColor: "#BAE6FD",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    gap: 2,
    height: 25,
  },
  pctStepButtonLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#3B5BB5",
  },
  pctDisplayWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 4,
    height: 25,
    paddingHorizontal: 6,
  },
  pctTextInput: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1F1D1A",
    textAlign: "center",
    minWidth: 28,
    paddingVertical: 0,
  },
  pctSymbolText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#7A7266",
    marginLeft: 1,
  },
  pctBarTrack: {
    width: "100%",
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#D9D2C3",
    overflow: "hidden",
    marginBottom: 4,
  },
  pctBarFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  pctPresetsRow: {
    flexDirection: "row",
    gap: 3,
  },
  pctPresetBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#F1EADB",
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
    height: 21,
  },
  pctPresetBtnActive: {
    backgroundColor: "#3B5BB5",
    borderColor: "#3B5BB5",
  },
  pctPresetBtnText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#7A7266",
  },
  pctPresetBtnTextActive: {
    color: "#FFFFFF",
  },
  // Number Widget
  numberWidgetContainer: {
    width: "100%",
  },
  quantityCounterCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FBF8F1",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#D9D2C3",
    padding: 2,
  },
  qtyRoundBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyRoundBtnDisabled: {
    backgroundColor: "#F1EADB",
    opacity: 0.5,
  },
  qtyDisplayWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTextInput: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F1D1A",
    textAlign: "center",
    paddingVertical: 0,
    minWidth: 32,
    height: 26,
  },
  qtyRoundBtnPlus: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: "#3B5BB5",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyQuickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  qtyQuickPill: {
    paddingVertical: 1.5,
    paddingHorizontal: 7,
    borderRadius: 4,
    backgroundColor: "#F1EADB",
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
    height: 20,
    justifyContent: "center",
  },
  qtyQuickPillText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#1F1D1A",
  },
  qtyResetPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: "#FEF2F2",
    borderWidth: 0.5,
    borderColor: "#FECACA",
    marginLeft: "auto",
    height: 20,
  },
  qtyResetPillText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#EF4444",
  },
  // Text Widget
  textWidgetContainer: {
    width: "100%",
  },
  multiLineTextInput: {
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: "#D9D2C3",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11.5,
    color: "#1F1D1A",
    minHeight: 36,
    textAlignVertical: "top",
  },
  textCharCountRow: {
    alignItems: "flex-end",
    marginTop: 2,
  },
  charCountText: {
    fontSize: 9.5,
    color: "#7A7266",
  },
  // Photo Attachment
  imageSection: {
    marginTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: "#F1EADB",
    paddingTop: 4,
  },
  captureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderStyle: "dashed",
    borderRadius: 5,
    paddingVertical: 5,
  },
  captureBtnText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#1E3A8A",
  },
  imagePreviewWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF8F1",
    borderRadius: 5,
    padding: 4,
    borderWidth: 0.5,
    borderColor: "#D9D2C3",
  },
  imageThumbnail: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#D9D2C3",
    marginRight: 7,
  },
  imageInfoWrap: {
    flex: 1,
  },
  imageSuccessText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#2E7D5B",
  },
  imageActionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
  },
  retakeBtnText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#3B5BB5",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
  },
  removeBtnText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#B3261E",
  },
  // Bottom Sticky Bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#D9D2C3",
    paddingHorizontal: 12,
    paddingTop: 5,
    elevation: 6,
    shadowColor: "#1F1D1A",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  answeredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EADB",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  answeredBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1F1D1A",
  },
  scoreBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreText: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#7A7266",
  },
  scoreBold: {
    fontWeight: "700",
  },
  targetText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#7A7266",
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  draftButton: {
    flex: 1,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#1E3A8A",
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  draftButtonText: {
    color: "#1E3A8A",
    fontSize: 12,
    fontWeight: "700",
  },
  submitButton: {
    flex: 1.2,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E3A8A",
    borderRadius: 6,
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default PerfectStoreScreen;
