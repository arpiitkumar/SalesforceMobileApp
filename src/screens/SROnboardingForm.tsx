import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Image,
  Platform,
  PermissionsAndroid,
  Keyboard,
  Modal,
} from "react-native";
import DatePicker from "react-native-date-picker";
import { RFValue } from "react-native-responsive-fontsize";
import { Dropdown } from "react-native-element-dropdown";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import {
  buildSyncFields,
  extractApiErrorMessage,
} from "../utils/sync/syncStatus";
import HeaderMain from "../components/HeaderMain";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { showToast } from "../redux/slices/toastSlice.js";
import { useNavigation } from "@react-navigation/native";
import { isInternetAvailable } from "../utils/networkUtils";
import LinearGradient from "react-native-linear-gradient";
import LoaderOverlay from "../utils/helper/LoaderOverlay";
import Ionicons from "../components/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import { launchCamera } from "react-native-image-picker";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import Feather from "@react-native-vector-icons/feather";
import Icon from "@react-native-vector-icons/feather";
import { resizeAndConvertImage } from "../utils/helper/resizeAndConvertImage";
import { useFocusEffect } from "@react-navigation/native";
import { getCurrentLocation } from "../utils/getCurrentLocation";

const mapAnswerToItemFields = (qType, rawValue) => {
  const fields = {};

  const valStr = rawValue != null ? String(rawValue) : "";
  if (!valStr.trim()) return fields;

  const typeLower = String(qType || "").trim().toLowerCase();

  // Check if it's base64 image data or image type question
  const isBase64 = valStr.length > 500 || typeLower === "image" || typeLower === "attachment";

  if (isBase64) {
    fields.Answer_Base64__c = valStr;
  } else if (typeLower === "number" || typeLower === "integer" || typeLower === "rating") {
    fields.Answer_Number__c = parseInt(valStr, 10) || 0;
  } else if (typeLower === "decimal" || typeLower === "double" || typeLower === "currency") {
    fields.Answer_Decimal__c = parseFloat(valStr) || 0.0;
  } else if (typeLower === "percentage") {
    fields.Answer_percentage__c = parseFloat(valStr) || 0.0;
  } else if (typeLower === "date") {
    fields.Answer_Date__c = valStr;
  } else if (typeLower === "datetime" || typeLower === "date/time" || typeLower === "date time") {
    fields.Answer_DateTime__c = valStr;
  } else if (typeLower === "time") {
    fields.Answer_Time__c = valStr;
  } else if (
    typeLower === "boolean" ||
    typeLower === "checkbox" ||
    typeLower === "radio button" ||
    typeLower === "radio"
  ) {
    fields.Answer_Boolean__c =
      valStr.toLowerCase() === "true" ||
      valStr.toLowerCase() === "yes" ||
      valStr === "1";
  } else {
    fields.Answer_Text__c = valStr;
  }
  return fields;
};

const idMatches = (id1, id2) => {
  if (!id1 || !id2) return false;
  const str1 = String(id1).trim();
  const str2 = String(id2).trim();
  if (str1.length >= 15 && str2.length >= 15) {
    return str1.substring(0, 15) === str2.substring(0, 15);
  }
  return str1.toLowerCase() === str2.toLowerCase();
};

const SROnboardingForm = ({ route }) => {
  const { formType, title, surveyFormId = null } = route.params || {};
  const { apiFetch, apiComposite, fetchRecords } = useApiFetch();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const selectedVisit = useSelector((state) => state.selectedVisit);
  const auth = useSelector((state) => state.auth);
  const [startTime] = useState(new Date().toISOString());
  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [options, setOptions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // console.log('questions', questions)
  // Fixed Fields with required property
  const fixedFields = [
    { id: "firstName", label: "First Name", type: "Text", required: false },
    { id: "lastName", label: "Last Name", type: "Text", required: false },
    { id: "email", label: "Email", type: "Email", required: false },
    { id: "phone", label: "Phone", type: "Phone", required: false },
    { id: "company", label: "Company", type: "Text", required: false }, // optional
  ];

  const [openPicker, setOpenPicker] = useState(false);
  const [currentDateId, setCurrentDateId] = useState(null);
  const [tempDate, setTempDate] = useState(new Date());

  const [users, setUsers] = useState([]);
  const [images, setImages] = useState({}); // images by questionId

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // useEffect(() => {
  //   const initialize = async () => {
  //     try {
  //       const result = await UniversalUpdateInsert({
  //         ObjectName: "User",
  //         Type: "get",
  //       });
  //       setUsers(result);
  //     } catch (error) {
  //       console.error(" Get User Failed For the Header:", error);
  //     }
  //   };
  //   initialize();
  // }, []);

  const [mobileUniqueId, setMobileUniqueId] = useState("");
  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        try {
          const result = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",
          });
          setUsers(result);
          const uniqueId = `${result[0].Sf_Id}_${Date.now()}`;
          setMobileUniqueId(uniqueId);
          console.log("Generated Mobile Unique Id:", uniqueId);
        } catch (error) {
          console.error(" Get User Failed For the Header:", error);
        }
      };
      initialize();
    }, []),
  );

  // console.log('formType', formType)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // const forms = await UniversalUpdateInsert({
        //   ObjectName: "Form_Template__c",
        //   Type: "get",
        // });
        let srForm = null;

        if (surveyFormId) {
          const templatesQuery = `SELECT Id, Name, Status__c, Frequency__c, Effective_From__c, Effective_To__c FROM Survey_Template__c WHERE Id = '${surveyFormId}'`;
          const apiTemplates = await fetchRecords("Survey_Template__c", templatesQuery);
          srForm = apiTemplates?.[0] || null;
          if (srForm) {
            srForm = {
              ...srForm,
              Sf_Id: srForm.Id,
            };
          }
        } else {
          const templatesQuery = `SELECT Id, Name, Status__c, Frequency__c, Effective_From__c, Effective_To__c FROM Survey_Template__c WHERE Status__c = 'Published'`;
          const apiTemplates = await fetchRecords("Survey_Template__c", templatesQuery);
          srForm = apiTemplates?.[apiTemplates.length - 1] || null;
          if (srForm) {
            srForm = {
              ...srForm,
              Sf_Id: srForm.Id,
            };
          }
        }

        setForm(srForm);

        if (srForm) {
          console.log("Fetching survey questions directly from Salesforce API (no local storage)...");
          const qnsQuery = `SELECT Id, Name, Survey_Template__c, Question__c, Question_Order__c, Response_Type__c, Mandatory__c, Allow_Image__c FROM Survey_Question__c WHERE Survey_Template__c = '${srForm.Sf_Id}'`;
          const apiQns = await fetchRecords("Survey_Question__c", qnsQuery);
          const normalizedQns = (apiQns || []).map((q) => {
            let resType = q.Response_Type__c ?? q.response_Type__c;
            const normalizedType = String(resType || "").trim().toLowerCase();
            if (normalizedType === "dropdown") {
              resType = "Picklist";
            } else if (normalizedType === "radio button") {
              resType = "Radio Button";
            } else if (normalizedType === "currency") {
              resType = "Currency";
            } else if (normalizedType === "percentage") {
              resType = "Percentage";
            } else if (normalizedType === "decimal" || normalizedType === "double") {
              resType = "Decimal";
            } else if (normalizedType === "long text") {
              resType = "Text";
            } else if (
              normalizedType === "multi-select picklist" ||
              normalizedType === "multi select picklist" ||
              normalizedType === "multi select" ||
              normalizedType === "multi picklist"
            ) {
              resType = "Multi Select Picklist";
            }

            return {
              ...q,
              Sf_Id: q.Id,
              question__c: q.Question__c,
              question_Order__c: q.Question_Order__c,
              response_Type__c: resType,
              mandatory__c: q.Mandatory__c,
              allow_Image__c: q.Allow_Image__c,
              survey_Template__c: q.Survey_Template__c,
            };
          });

          const uniqueQnsMap = new Map();
          normalizedQns.forEach((q) => {
            if (q.Sf_Id && !uniqueQnsMap.has(q.Sf_Id)) {
              uniqueQnsMap.set(q.Sf_Id, q);
            }
          });
          const uniqueQnsList = Array.from(uniqueQnsMap.values());

          const relatedQns = uniqueQnsList.sort((a, b) => {
            const orderA = a.question_Order__c ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.question_Order__c ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
          });

          setQuestions(relatedQns);

          const questionIds = relatedQns.map((q) => q.Sf_Id);
          let normalizedOpts = [];

          if (questionIds.length > 0) {
            console.log("Fetching options directly from Salesforce API (no local storage)...");
            const qnsFilter = questionIds.map((id) => `'${id}'`).join(",");
            const optsQuery = `SELECT Id, Name, Survey_Question__c, Option__c, Sequence__c FROM Survey_Question_Option__c WHERE Survey_Question__c IN (${qnsFilter})`;
            const apiOpts = await fetchRecords("Survey_Question_Option__c", optsQuery);
            normalizedOpts = (apiOpts || []).map((o) => ({
              ...o,
              Sf_Id: o.Id,
              survey_Question__c: o.Survey_Question__c,
              option__c: o.Option__c,
              sequence__c: o.Sequence__c,
            }));
          }

          setOptions(normalizedOpts);
        }
      } catch (e) {
        console.error("Error loading form:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [users]);

  // const handleAnswerChange = (id, value) => {
  //   setAnswers((prev) => ({ ...prev, [id]: value }));
  // };

  // const handleAnswerChange = (id, value, sanitizecheck = false) => {
  //   console.log('value', value);
  //   const sanitized = sanitizecheck
  //     ? value.replace(/[^a-zA-Z0-9 -]/g, "")   // hyphen allowed
  //     : value.replace(/[^a-zA-Z0-9 ]/g, "");   // old logic
  //   setAnswers((prev) => ({
  //     ...prev,
  //     [id]: sanitized
  //   }));
  // };
  const handleAnswerChange = (id, value, type = null) => {
    setErrors((prev) => {
      if (prev[id]) {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      }
      return prev;
    });

    if (type === "Document") {
      setAnswers((prev) => ({
        ...prev,
        [id]: value,
      }));
      return;
    }
    if (type === "Picklist") {
      setAnswers((prev) => ({
        ...prev,
        [id]: value,
      }));
      return;
    }
    if (type === "MultiPicklist") {
      setAnswers((prev) => ({
        ...prev,
        [id]: value,
      }));
      return;
    }
    if (type === "Rating") {
      setAnswers((prev) => ({
        ...prev,
        [id]: value,
      }));
      return;
    }
    if (type === "Checkbox") {
      setAnswers((prev) => ({
        ...prev,
        [id]: !prev[id], // toggle true/false
      }));
      return;
    }
    if (type === "Date") {
      setAnswers((prev) => ({
        ...prev,
        [id]: value,
      }));
      return;
    }
    if (type === "Percentage") {
      let sanitized = typeof value === "string" ? value.replace(/[^0-9.]/g, "").slice(0, 5) : value;
      if (typeof sanitized === "string") {
        const parts = sanitized.split(".");
        sanitized = parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
      }
      if (sanitized && Number(sanitized) > 100) {
        sanitized = "100";
      }
      setAnswers((prev) => ({
        ...prev,
        [id]: sanitized,
      }));
      return;
    }
    if (type === "Number") {
      const sanitized = typeof value === "string" ? value.replace(/[^0-9]/g, "").slice(0, 10) : value;
      setAnswers((prev) => ({
        ...prev,
        [id]: sanitized,
      }));
      return;
    }
    if (type === "Decimal") {
      let sanitized = typeof value === "string" ? value.replace(/[^0-9.]/g, "").slice(0, 10) : value;
      if (typeof sanitized === "string") {
        const parts = sanitized.split(".");
        sanitized = parts[0] + (parts.length > 1 ? "." + parts.slice(1).join("") : "");
      }
      setAnswers((prev) => ({
        ...prev,
        [id]: sanitized,
      }));
      return;
    }
    if (type === "Email") {
      const sanitized = typeof value === "string" ? value.replace(/[^a-zA-Z0-9@._+-]/g, "") : value;
      setAnswers((prev) => ({
        ...prev,
        [id]: sanitized,
      }));
      return;
    }
    if (type === "Phone") {
      const sanitized = typeof value === "string" ? value.replace(/[^0-9+-]/g, "") : value;
      setAnswers((prev) => ({
        ...prev,
        [id]: sanitized,
      }));
      return;
    }
    const sanitized =
      typeof value === "string" ? value.replace(/[^a-zA-Z0-9 ]/g, "") : value;
    setAnswers((prev) => ({
      ...prev,
      [id]: sanitized,
    }));
  };

  const openImagePicker = async (questionId) => {
    try {
      const result = await launchImageLibrary({ mediaType: "photo" });
      if (!result || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const originalUri = asset.uri;
      const resized = await ImageResizer.createResizedImage(
        originalUri,
        800,
        800,
        "JPEG",
        80,
        0,
      );
      const resizedPath = resized.path || resized.uri;

      const pathForRead =
        Platform.OS === "ios" && resizedPath.startsWith("file://")
          ? resizedPath.replace("file://", "")
          : resizedPath;

      const base64Data = await RNFS.readFile(pathForRead, "base64");

      const imageObj = {
        uri: originalUri,
        resizedUri: resized.uri || resizedPath,
        base64: base64Data,
        fileName: asset.fileName || `img_${Date.now()}.jpg`,
        type: asset.type || "image/jpeg",
      };

      setImages((prev) => ({
        ...prev,
        [questionId]: [imageObj],
      }));

      handleAnswerChange(questionId, base64Data);
    } catch (err) {
      console.log("Image pick/resize error:", err);
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "App needs access to your camera to take a selfie.",
          buttonPositive: "OK",
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const cameraRef = useRef(null);
  const [cameraType, setCameraType] = useState("front");
  const device = useCameraDevice(cameraType);
  const fallbackDevice = useCameraDevice("back");
  const finalDevice = device ?? fallbackDevice;
  const [showCamera, setShowCamera] = useState(false);
  const [hasCamPermission, setHasCamPermission] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const openCamera = async (questionId) => {
    try {
      let permission;

      if (Platform.OS === "android") {
        permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera Permission",
            message: "App needs camera access to take photo",
            buttonPositive: "OK",
          },
        );

        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          showToastvisible("error", "Camera permission denied");
          return;
        }
      } else {
        const status = await Camera.requestCameraPermission();
        if (status !== "granted") {
          showToastvisible("error", "Camera permission denied");
          return;
        }
      }

      setActiveQuestionId(questionId); // 🔥 store questionId
      setHasCamPermission(true);
      setShowCamera(true);
    } catch (e) {
      console.log("Permission error:", e);
    }
  };
  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: "speed", // 🔥 memory safe
        flash: "off",
      });
      const filePath = "file://" + photo.path;
      // 🔥 SAME RESIZER FUNCTION USE
      const {
        base64,
        uri: resizedUri,
        sizeKB,
      } = await resizeAndConvertImage(photo.path);
      // 🔥 image object (same structure as before)
      const imageObj = {
        uri: filePath,
        resizedUri: resizedUri || filePath,
        base64: base64,
        fileName: `img_${Date.now()}.jpeg`,
        type: "image/jpeg",
        sizeKB: sizeKB,
      };
      // 🔥 set image per question
      setImages((prev) => ({
        ...prev,
        [activeQuestionId]: [imageObj],
      }));
      // 🔥 set answer (important for payload)
      // handleAnswerChange(activeQuestionId, base64);
      handleAnswerChange(activeQuestionId, base64, "Document");
      setShowCamera(false);
    } catch (e) {
      console.log(" Camera Error:", e);
    }
  };

  const removeImage = (questionId, idx) => {
    setImages((prev) => {
      const updated = [...(prev[questionId] || [])];
      updated.splice(idx, 1);
      return { ...prev, [questionId]: updated };
    });
    handleAnswerChange(questionId, null);
  };

  const getOptionText = (opt) => {
    if (!opt) return "";
    return opt.Option__c ?? opt.option__c ?? opt.option ?? opt.Option ?? opt.Name ?? opt.name ?? "";
  };

  const renderQuestion = (q) => {
    // console.log('q.Type__c', q.Type__c)
    // console.log('q.Name', q.Name)
    // console.log('q.Response_Type__c', q.Response_Type__c)
    // console.log('q.Quation__c', q.question__c)
    // console.log('q.Quation__c', String(q.Response_Type__c || "").trim().toLowerCase())

    const resolvedType = String(q.response_Type__c || q.Response_Type__c || "")
      .trim()
      .toLowerCase();

    switch (resolvedType) {
      case "radio button":
      case "boolean":
      case "radio": {
        const qOptions = options
          .filter((o) => idMatches(o.Survey_Question__c || o.survey_Question__c, q.Sf_Id))
          .map((opt) => getOptionText(opt))
          .filter(Boolean);

        const finalOptions = qOptions.length > 0 ? qOptions : ["Yes", "No"];
        const currentVal = answers[q.Sf_Id];

        return (
          <View style={{ flexDirection: "column", marginTop: 4 }}>
            {finalOptions.map((option) => {
              const selected = currentVal === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => handleAnswerChange(q.Sf_Id, option)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: selected ? "#C9A24D" : "#BEBEBE" },
                    ]}
                  >
                    {selected && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: "#C9A24D" },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: selected ? "#C9A24D" : "#6C7278" },
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      case "rating": {
        const currentRating = parseInt(answers[q.Sf_Id]) || 0;
        return (
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() =>
                  handleAnswerChange(q.Sf_Id, String(star), "Rating")
                }
                style={{ marginRight: 8 }}
              >
                <Ionicons
                  name={star <= currentRating ? "star" : "star-outline"}
                  size={30}
                  color={star <= currentRating ? "#FFB800" : "#BEBEBE"}
                />
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      case "checkbox": {
        const qOptions = options
          .filter((o) => idMatches(o.Survey_Question__c || o.survey_Question__c, q.Sf_Id))
          .map((opt) => getOptionText(opt))
          .filter(Boolean);

        const isMulti = qOptions.length > 0 ||
          (q.question__c && (
            q.question__c.toLowerCase().includes("items") ||
            q.question__c.toLowerCase().includes("which") ||
            q.question__c.toLowerCase().includes("select") ||
            q.question__c.toLowerCase().includes("what")
          ));

        const finalOptions = qOptions.length > 0 ? qOptions : isMulti ? ["Option 1", "Option 2", "Option 3"] : [];

        if (finalOptions.length > 0) {
          const rawValue = answers[q.Sf_Id];
          const selectedValues = Array.isArray(rawValue)
            ? rawValue
            : typeof rawValue === "string" && rawValue.trim()
              ? rawValue.split(",").map((s) => s.trim())
              : [];

          const toggleOption = (opt) => {
            let nextVal;
            if (selectedValues.includes(opt)) {
              nextVal = [];
            } else {
              nextVal = [opt];
            }
            handleAnswerChange(q.Sf_Id, nextVal, "MultiPicklist");
          };

          return (
            <View style={{ flexDirection: "column", marginTop: 4 }}>
              {finalOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => toggleOption(opt)}
                    style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        {
                          borderColor: isSelected ? "#C9A24D" : "#BEBEBE",
                          backgroundColor: isSelected ? "#C9A24D" : "#fff",
                        },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: isSelected ? "#C9A24D" : "#6C7278" },
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        } else {
          const isChecked = answers[q.Sf_Id] === true;
          return (
            <TouchableOpacity
              onPress={() => handleAnswerChange(q.Sf_Id, null, "Checkbox")}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <View
                style={[
                  styles.checkboxBox,
                  {
                    borderColor: isChecked ? "#C9A24D" : "#BEBEBE",
                    backgroundColor: isChecked ? "#C9A24D" : "#fff",
                  },
                ]}
              >
                {isChecked && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          );
        }
      }

      case "picklist":
      case "dropdown": {
        const qOptions = options
          .filter((o) => idMatches(o.Survey_Question__c || o.survey_Question__c, q.Sf_Id))
          .map((opt) => {
            const txt = getOptionText(opt);
            return { label: txt, value: txt };
          })
          .filter((o) => o.label);

        const finalOpts = qOptions.length > 0 ? qOptions : [
          { label: "Option 1", value: "Option 1" },
          { label: "Option 2", value: "Option 2" },
          { label: "Option 3", value: "Option 3" },
          { label: "Option 4", value: "Option 4" }
        ];

        return (
          <Dropdown
            data={finalOpts}
            labelField="label"
            valueField="value"
            style={styles.dropdown}
            containerStyle={styles.dropdownContainer}
            inputSearchStyle={styles.searchbox}
            placeholderStyle={styles.placeholderDropdown}
            selectedTextStyle={styles.valueDropdown}
            placeholder="Select option"
            search
            searchPlaceholder={"Search"}
            value={answers[q.Sf_Id] || null}
            onChange={(item) =>
              handleAnswerChange(q.Sf_Id, item.value, "Picklist")
            }
          />
        );
      }

      case "multi select picklist":
      case "multi select":
      case "multi-select":
      case "multi picklist": {
        const qOptions = options
          .filter((o) => idMatches(o.Survey_Question__c || o.survey_Question__c, q.Sf_Id))
          .map((opt) => getOptionText(opt))
          .filter(Boolean);

        const finalOpts = qOptions.length > 0 ? qOptions : ["Option 1", "Option 2", "Option 3", "Option 4"];

        const rawValue = answers[q.Sf_Id];
        const selectedValues = Array.isArray(rawValue)
          ? rawValue
          : typeof rawValue === "string" && rawValue.trim()
            ? rawValue.split(",").map((s) => s.trim())
            : [];

        const toggleOption = (opt) => {
          let nextVal;
          if (selectedValues.includes(opt)) {
            nextVal = selectedValues.filter((v) => v !== opt);
          } else {
            nextVal = [...selectedValues, opt];
          }
          handleAnswerChange(q.Sf_Id, nextVal, "MultiPicklist");
        };

        return (
          <View style={styles.multiSelectContainer}>
            {finalOpts.map((opt) => {
              const isSelected = selectedValues.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => toggleOption(opt)}
                  style={[
                    styles.multiSelectPill,
                    isSelected ? styles.multiSelectPillActive : styles.multiSelectPillInactive,
                  ]}
                >
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={16}
                    color={isSelected ? "#fff" : "#6C7278"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.multiSelectPillText,
                      { color: isSelected ? "#fff" : "#6C7278" },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      case "date":
        return (
          <TouchableOpacity
            onPress={() => {
              setCurrentDateId(q.Sf_Id);
              setTempDate(new Date());
              setOpenPicker(true);
            }}
            style={[styles.container, { padding: 8 }]}
          >
            <Text style={styles.menuItemText}>
              {answers[q.Sf_Id] || "Select Date"}
            </Text>
          </TouchableOpacity>
        );

      case "email":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val, "Email")}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Enter email"
          />
        );

      case "phone":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val, "Phone")}
            keyboardType="phone-pad"
            placeholder="Enter phone number"
          />
        );

      case "number":
      case "integer":
      case "currency":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val, "Number")}
            keyboardType="numeric"
            maxLength={10}
            placeholder="Enter number"
          />
        );

      case "percentage":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val, "Percentage")}
            keyboardType="decimal-pad"
            maxLength={5}
            placeholder="Enter percentage"
          />
        );

      case "decimal":
      case "double":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val, "Decimal")}
            keyboardType="decimal-pad"
            maxLength={10}
            placeholder="Enter decimal value"
          />
        );

      case "image":
      case "file":
      case "attachment":
      case "document":
        return (
          <View>
            {/* <Text style={styles.label}>
              Upload Image (JPG, PNG){" "}
              {q.Is_Required__c && <Text style={{ color: "red" }}>*</Text>}
            </Text> */}
            <View style={styles.imageRow}>
              <TouchableOpacity
                style={styles.uploadBox}
                // onPress={() => openImagePicker(q.Sf_Id)}
                onPress={() => openCamera(q.Sf_Id)}
              >
                <Ionicons name="camera" size={24} />
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(images[q.Sf_Id] || []).map((img, idx) => (
                  <View key={idx} style={styles.thumbWrap}>
                    <Image
                      source={{ uri: img.resizedUri || img.uri }}
                      style={styles.thumb}
                    />
                    <TouchableOpacity
                      style={styles.removeIcon}
                      onPress={() => removeImage(q.Sf_Id, idx)}
                    >
                      <Ionicons name="close" size={14} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        );

      case "gst":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) =>
              handleAnswerChange(q.Sf_Id, val.toUpperCase().slice(0, 15))
            }
            autoCapitalize="characters"
            placeholder="Enter GST Number"
            maxLength={15}
          />
        );

      case "pan":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) =>
              handleAnswerChange(q.Sf_Id, val.toUpperCase().slice(0, 10))
            }
            autoCapitalize="characters"
            placeholder="Enter PAN Number"
            maxLength={10}
          />
        );

      case "text":
      default:
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val)}
            placeholder="Enter text"
          />
        );
    }
  };

  // Function to fetch required RecordTypeId based on formType
  const getRequiredData = async () => {
    try {
      const AllPicklistData = await UniversalUpdateInsert({
        ObjectName: "AllDataPicklist",
        Type: "get",
      });

      let recordTypeId = null;

      if (formType === "Survey") {
        recordTypeId =
          AllPicklistData && AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).surveyRecordTypeId
            : null;
      } else if (formType === "Db Onboarding") {
        recordTypeId =
          AllPicklistData && AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).dbRecordTypeId
            : null;
      } else if (formType === "Sr Onboarding") {
        recordTypeId =
          AllPicklistData && AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).srRecordTypeId
            : null;
      } else {
        // Default fallback
        recordTypeId =
          AllPicklistData && AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).surveyRecordTypeId
            : null;
      }

      return recordTypeId;
    } catch (e) {
      console.log(" Could not get the data", e);
    }
  };

  const validators = {
    Phone: {
      regex: /^[6-9]\d{9}$/,
      error: "Invalid phone number",
    },
    Email: {
      regex: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
      error: "Invalid email address",
    },
    PAN: {
      regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
      error: "Invalid PAN number",
    },
    GST: {
      regex: /^(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/,
      error: "Invalid GST number",
    },
  };

  const handleSubmitAndApproval = async () => {
    handleSubmit(true);
  };

  const [buttondisbaled, setButtonDisbaled] = useState(false);

  // Function to handle form submission
  const handleSubmit = async (submitAndApproval = false) => {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      if (!questions || questions.length === 0) {
        showToastvisible("error", "At least one question is required");
        setLoading(false);
        return;
      }

      for (let field of fixedFields) {
        if (field.required && !answers[field.id]) {
          showToastvisible("error", `${field.label} is required`);
          setLoading(false);
          return;
        }
      }

      const newErrors = {};
      for (let q of questions) {
        const value = answers[q.Sf_Id];
        const typeLower = String(q.response_Type__c || "").trim().toLowerCase();

        // 🔴 Required validation
        if (q.mandatory__c && (value === undefined || value === null || String(value).trim() === "")) {
          // showToastvisible("error", `${q.question__c} is required`);
          newErrors[q.Sf_Id] = `This field is required`;
        } else if (typeLower === "percentage" && value) {
          // 🔴 Percentage range validation
          const num = parseFloat(value);
          if (isNaN(num) || num < 0 || num > 100) {
            newErrors[q.Sf_Id] = `Value must be between 0 and 100`;
          }
        } else {
          const rule = validators[q.response_Type__c];
          if (value && rule && typeof value === "string" && !rule.regex.test(value)) {
            newErrors[q.Sf_Id] = `${q.question__c}: ${rule.error}`;
          }
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setLoading(false);
        return;
      }
      setErrors({});

      // Prepare fixed fields payload
      const fixedPayload = fixedFields.reduce((acc, f) => {
        acc[f.id] = answers[f.id] || null;
        return acc;
      }, {});
      fixedPayload.status = "New";
      fixedPayload.source = "Mobile";

      // Prepare dynamic questions payload
      const dynamicPayload = questions.map((q) => ({
        QuestionId: q.Sf_Id,
        Question: q.question__c,
        Type: q.response_Type__c,
        Answer: Array.isArray(answers[q.Sf_Id])
          ? answers[q.Sf_Id].join(",")
          : answers[q.Sf_Id] || null,
      }));

      // Fetch RecordTypeId
      const recordTypeId = await getRequiredData();

      // Construct final payload
      const payload = {
        userId: auth?.userId,
        type: formType,
        recordTypeId: recordTypeId,
        status: "Draft",
        visit: selectedVisit?.sfId || null,
        form: form?.Sf_Id,
        approval: submitAndApproval,
        mobileUniqueId: mobileUniqueId,
        leadData: fixedPayload,
        questionData: dynamicPayload,
      };

      console.log("Final Payload:", JSON.stringify(payload));
      // setLoading(false); return;

      // Persist this response locally to FormJson with the given sync state so it
      // is never lost on API failure and can be retried by the batch syncer.
      const persistFormJsonLocally = async (syncFields) => {
        const newLocalId = () =>
          Math.floor(10000000 + Math.random() * 90000000).toString();
        const offlineData = {
          Sf_Id: newLocalId(),
          Unique_Id: newLocalId(),
          Json: JSON.stringify(payload),
          is_locally_changed: true,
          last_modified: Date.now(),
          operation_type: "insert",
          ...syncFields,
        };
        return await UniversalUpdateInsert({
          ObjectName: "FormJson",
          Type: "insert",
          data: offlineData,
        });
      };

      const insertSurveyResponseLocally = async (createdSfId = null) => {
        try {
          let lat = null;
          let lng = null;
          try {
            const loc = await getCurrentLocation();
            lat = loc.latitude;
            lng = loc.longitude;
          } catch (e) {
            console.warn("Failed to get geolocation for survey response:", e);
          }

          const newLocalId = () =>
            Math.floor(10000000 + Math.random() * 90000000).toString();
          const parentSfId = createdSfId || newLocalId();
          const surveyResponseData = {
            Sf_Id: parentSfId,
            Name: `SR-${newLocalId()}`,
            Survey_Template__c: form?.Sf_Id || null,
            Visit__c: selectedVisit?.sfId || null,
            Outlet__c: selectedVisit?.AccountId || null,
            Field_User__c: auth?.userId || null,
            Status__c: "Submitted",
            // Start_Time__c: startTime,
            Submit_Time__c: new Date().toISOString(),
            Geolocation__Latitude__s: lat,
            Geolocation__Longitude__s: lng,

            is_locally_changed: createdSfId ? false : true,
            is_synced: createdSfId ? true : false,
            last_modified: Date.now(),
            operation_type: "insert",
            SoftDelete: false,
          };

          await UniversalUpdateInsert({
            ObjectName: "Survey_Response__c",
            Type: "insert",
            data: surveyResponseData,
          });
          console.log("Successfully inserted Survey_Response__c locally");

          // Create local Survey_Response_Item__c records
          const surveyItemsData = dynamicPayload.map((item, idx) => {
            const itemFields = mapAnswerToItemFields(item.Type, item.Answer);
            return {
              Sf_Id: newLocalId(),
              Name: `SRI-${newLocalId()}`,
              Survey_Response__c: parentSfId,
              Survey_Question__c: item.QuestionId,
              ...itemFields,
              is_locally_changed: createdSfId ? false : true,
              is_synced: createdSfId ? true : false,
              last_modified: Date.now(),
              operation_type: "insert",
              SoftDelete: false,
            };
          });

          if (surveyItemsData.length > 0) {
            await UniversalUpdateInsert({
              ObjectName: "Survey_Response_Item__c",
              Type: "insert",
              data: surveyItemsData,
            });
            console.log(
              `Successfully inserted ${surveyItemsData.length} Survey_Response_Item__c records locally`,
            );
          }
          return true;
        } catch (err) {
          console.error("Error inserting Survey_Response__c/Items:", err);
          return false;
        }
      };

      const connected = await isInternetAvailable();
      setButtonDisbaled(true);

      if (formType === "Survey") {
        if (!connected) {
          showToastvisible("error", "Internet is required to access this feature.");
          setButtonDisbaled(false);
          setLoading(false);
          return;
        }

        // Online save via API - Standard Salesforce SObjects API for Survey
        try {
          let lat = null;
          let lng = null;
          try {
            const loc = await getCurrentLocation();
            lat = loc.latitude;
            lng = loc.longitude;
          } catch (e) {
            console.warn("Failed to get geolocation for survey response:", e);
          }

          const parentPayload = {
            Survey_Template__c: form?.Sf_Id || null,
            Visit__c: selectedVisit?.sfId || null,
            Outlet__c: selectedVisit?.AccountId || null,
            Field_User__c: auth?.userId || null,
            Status__c: "Submitted",
            Start_Time__c: startTime,
            Submit_Time__c: new Date().toISOString(),
            Geolocation__Latitude__s: lat,
            Geolocation__Longitude__s: lng,
          };

          const parentResponse = await apiFetch(
            "POST",
            "sobjects/Survey_Response__c",
            parentPayload,
            "SObjects",
          );
          console.log("Parent Response:", parentResponse);

          if (parentResponse.status === "success" && parentResponse.data?.id) {
            const createdParentId = parentResponse.data.id;

            if (dynamicPayload.length > 0) {
              let allItemsSynced = true;
              let itemErrorMsg = "";

              for (let idx = 0; idx < dynamicPayload.length; idx++) {
                const item = dynamicPayload[idx];
                const itemFields = mapAnswerToItemFields(item.Type, item.Answer);
                const itemPayload = {
                  Survey_Response__c: createdParentId,
                  Survey_Question__c: item.QuestionId,
                  ...itemFields,
                };

                console.log(
                  `Uploading survey response item ${idx + 1}/${dynamicPayload.length}:`,
                  JSON.stringify(itemPayload, null, 2),
                );
                const itemResponse = await apiFetch(
                  "POST",
                  "sobjects/Survey_Response_Item__c",
                  itemPayload,
                  "SObjects",
                );
                console.log(
                  `Survey Response Item ${idx + 1} Response:`,
                  JSON.stringify(itemResponse, null, 2),
                );

                if (itemResponse.status !== "success" || !itemResponse.data?.id) {
                  allItemsSynced = false;
                  itemErrorMsg =
                    itemResponse?.message || `Item ${idx + 1} failed`;
                }
              }

              if (allItemsSynced) {
                showToastvisible("success", `${title} Saved Successfully`);
                navigation.goBack();
              } else {
                showToastvisible(
                  "error",
                  `Survey submitted, but some answers failed to upload: ${itemErrorMsg}`,
                );
                navigation.goBack();
              }
            } else {
              showToastvisible("success", `${title} Saved Successfully`);
              navigation.goBack();
            }
          } else {
            const serverErrorMsg = parentResponse?.message || "Save failed";
            showToastvisible("error", `Failed to submit survey: ${serverErrorMsg}`);
            setButtonDisbaled(false);
          }
        } catch (error) {
          console.error("Error while saving survey to API:", error);
          showToastvisible("error", "Failed to submit survey. Please check your internet connection.");
          setButtonDisbaled(false);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (connected && !selectedVisit?.sfId.startsWith("local")) {
        // Online save via API - Standard Salesforce SObjects API for other form types
        try {
          let lat = null;
          let lng = null;
          try {
            const loc = await getCurrentLocation();
            lat = loc.latitude;
            lng = loc.longitude;
          } catch (e) {
            console.warn("Failed to get geolocation for survey response:", e);
          }

          const parentPayload = {
            Survey_Template__c: form?.Sf_Id || null,
            Visit__c: selectedVisit?.sfId || null,
            Outlet__c: selectedVisit?.AccountId || null,
            Field_User__c: auth?.userId || null,
            Status__c: "Submitted",
            Start_Time__c: startTime,
            Submit_Time__c: new Date().toISOString(),
            Geolocation__Latitude__s: lat,
            Geolocation__Longitude__s: lng,
          };

          const parentResponse = await apiFetch(
            "POST",
            "sobjects/Survey_Response__c",
            parentPayload,
            "SObjects",
          );
          console.log("Parent Response:", parentResponse);

          if (parentResponse.status === "success" && parentResponse.data?.id) {
            const createdParentId = parentResponse.data.id;

            if (dynamicPayload.length > 0) {
              let allItemsSynced = true;
              let itemErrorMsg = "";

              for (let idx = 0; idx < dynamicPayload.length; idx++) {
                const item = dynamicPayload[idx];
                const itemFields = mapAnswerToItemFields(item.Type, item.Answer);
                const itemPayload = {
                  Survey_Response__c: createdParentId,
                  Survey_Question__c: item.QuestionId,
                  ...itemFields,
                };

                console.log(
                  `Uploading survey response item ${idx + 1}/${dynamicPayload.length
                  }:`,
                  JSON.stringify(itemPayload, null, 2),
                );
                const itemResponse = await apiFetch(
                  "POST",
                  "sobjects/Survey_Response_Item__c",
                  itemPayload,
                  "SObjects",
                );
                console.log(
                  `Survey Response Item ${idx + 1} Response:`,
                  JSON.stringify(itemResponse, null, 2),
                );

                if (itemResponse.status !== "success" || !itemResponse.data?.id) {
                  allItemsSynced = false;
                  itemErrorMsg =
                    itemResponse?.message || `Item ${idx + 1} failed`;
                  console.error(
                    `❌ Survey Response Item ${idx + 1} failed:`,
                    itemResponse,
                  );
                }
              }

              if (allItemsSynced) {
                await insertSurveyResponseLocally(createdParentId);
                showToastvisible("success", `${title} Saved Successfully`);
                navigation.goBack();
              } else {
                await insertSurveyResponseLocally(createdParentId);
                showToastvisible(
                  "success",
                  `${title} Saved Offline (Items failed: ${itemErrorMsg || "Online Failed"
                  })`,
                );
                navigation.goBack();
              }
            } else {
              await insertSurveyResponseLocally(createdParentId);
              showToastvisible("success", `${title} Saved Successfully`);
              navigation.goBack();
            }
          } else {
            const serverErrorMsg =
              parentResponse?.message || "Parent Save Failed";
            await insertSurveyResponseLocally(null);
            showToastvisible(
              "success",
              `${title} Saved Offline (${serverErrorMsg})`,
            );
            navigation.goBack();
          }
        } catch (error) {
          console.error("Error while saving to API:", error);
          await insertSurveyResponseLocally(null);
          showToastvisible("success", `${title} Saved Offline Successfully`);
          navigation.goBack();
        } finally {
          setLoading(false);
        }
      } else {
        // Offline save to local DB for other form types
        const inserted = await insertSurveyResponseLocally(null);
        if (inserted) {
          showToastvisible("success", `${title} Created Offline Successfully`);
          navigation.goBack();
        }
        setLoading(false);
      }
    } catch (globalErr) {
      console.error("CRITICAL error in handleSubmit:", globalErr);
      showToastvisible("error", "An unexpected error occurred during submission.");
      setLoading(false);
      setButtonDisbaled(false);
    }
  };

  // Function to show toast messages
  const showToastvisible = (type, message) => {
    dispatch(
      showToast({
        message: message,
        type: type, // 'success' | 'error' | 'warning'
      }),
    );
  };

  return (
    <>
      <SafeAreaProvider style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
        <View style={styles.headerContainer}>
          <HeaderMain screenName={title} />
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: "white",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          {loading && (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <LoaderOverlay visible={loading} message="Saving form..." />
            </View>
          )}
          {!loading && (
            <>
              <ScrollView
                style={{ padding: 15 }}
                contentContainerStyle={{ paddingBottom: 160 }}
              >
                {/* Fixed Fields */}
                {/* {fixedFields.map((f) => (
                <View key={f.id} style={styles.qCard}>
                  <Text style={styles.label}>
                    {f.label} {f.required && <Text style={{ color: "red" }}>*</Text>}
                  </Text>
                  <TextInput
                    style={[styles.container, { padding: 8 }]}
                    value={answers[f.id] || ""}
                    onChangeText={(val) => handleAnswerChange(f.id, val)}
                    keyboardType={
                      f.type === "Email"
                        ? "email-address"
                        : f.type === "Phone"
                          ? "phone-pad"
                          : "default"
                    }
                    autoCapitalize={f.type === "Email" ? "none" : "sentences"}
                    placeholder={`Enter ${f.label}`}
                  />
                  {errors[f.id] && (
                    <Text style={{ color: "red", fontSize: 12, marginTop: 4 }}>
                      {errors[f.id]}
                    </Text>
                  )}
                </View>
              ))} */}

                {questions.length === 0 ? (
                  <View
                    style={{
                      alignItems: "center",
                      padding: 20,
                      flex: 1,
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: "#666",
                        textAlign: "center",
                        fontWeight: "500",
                      }}
                    >
                      No questions available for {formType}
                    </Text>
                  </View>
                ) : (
                  questions.map((q, index) => (
                    <View key={q.Sf_Id} style={styles.qCard}>
                      <Text style={styles.label}>
                        {index + 1}. {q.question__c}
                        {q.mandatory__c === true && (
                          <Text style={{ color: "red" }}> *</Text>
                        )}
                      </Text>
                      {renderQuestion(q)}
                      {errors[q.Sf_Id] && (
                        <Text
                          style={{ color: "red", fontSize: 12, marginTop: 0 }}
                        >
                          {errors[q.Sf_Id]}
                        </Text>
                      )}
                    </View>
                  ))
                )}

                <DatePicker
                  modal
                  open={openPicker}
                  date={tempDate}
                  mode="date"
                  // minimumDate={new Date()}
                  onConfirm={(date) => {
                    setOpenPicker(false);
                    if (currentDateId) {
                      handleAnswerChange(
                        currentDateId,
                        date.toISOString().split("T")[0],
                        "Date",
                      );
                    }
                  }}
                  onCancel={() => setOpenPicker(false)}
                />
              </ScrollView>
            </>
          )}
          {!keyboardVisible && (
            <View style={styles.footerRow}>
              {(formType === "Sr Onboarding" ||
                formType === "Db Onboarding") && (
                  <TouchableOpacity
                    style={[
                      styles.footerBtn,
                      !(
                        formType === "Sr Onboarding" ||
                        formType === "Db Onboarding"
                      ) && styles.footerBtnFull,
                    ]}
                    onPress={handleSubmitAndApproval}
                    disabled={buttondisbaled || loading}
                  >
                    <LinearGradient
                      colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.footerInner}
                    >
                      <Text style={styles.footerText}>
                        Save & Send to Approval
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                style={[styles.footerBtn]}
                onPress={() => handleSubmit(false)}
                disabled={buttondisbaled || loading}
              >
                <LinearGradient
                  colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.footerInner}
                >
                  <Text style={styles.footerText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          <Modal visible={showCamera} animationType="slide">
            {finalDevice && hasCamPermission ? (
              <View style={{ flex: 1, backgroundColor: "#000" }}>
                <Camera
                  ref={cameraRef}
                  style={{ flex: 1 }}
                  device={finalDevice}
                  isActive={showCamera} // 🔥 IMPORTANT
                  photo={true}
                />

                {/* CAPTURE */}
                <TouchableOpacity
                  onPress={capturePhoto}
                  style={{
                    position: "absolute",
                    bottom: 50,
                    alignSelf: "center",
                    backgroundColor: "#C9A24D",
                    padding: 20,
                    borderRadius: 50,
                  }}
                >
                  <Icon name="camera" size={30} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setCameraType((prev) =>
                      prev === "front" ? "back" : "front",
                    );
                  }}
                  style={{
                    position: "absolute",
                    top: 50,
                    left: 20,
                    backgroundColor: "#00000080",
                    padding: 10,
                    borderRadius: 30,
                  }}
                >
                  <Icon name="refresh-cw" size={22} color="#fff" />
                </TouchableOpacity>

                {/* CLOSE */}
                <TouchableOpacity
                  onPress={() => setShowCamera(false)}
                  style={{
                    position: "absolute",
                    top: 50,
                    right: 20,
                    backgroundColor: "#00000080",
                    padding: 10,
                    borderRadius: 10,
                  }}
                >
                  <Feather name="x" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#000" }}>Loading Camera...</Text>
              </View>
            )}
          </Modal>
        </View>
      </SafeAreaProvider>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#A67C2E" },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 12, color: "#000", marginBottom: 4, fontWeight: "500" },
  container: {
    width: "100%",
    alignSelf: "center",
    borderColor: "#BEBEBE",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
    height: 38,
    justifyContent: "center",
  },
  qCard: {
    backgroundColor: "#fff",
    marginBottom: 10,
    padding: 10,
    margin: 1,
    borderRadius: 8,

    // iOS Shadow
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,

    // Android Shadow
    elevation: 4,
  },
  menuItemText: {
    fontSize: RFValue(10),
    color: "#6C7278",
    fontWeight: "400",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  dropdown: {
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: "#FBF8F1",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: "#000",
  },
  headerContainer: { backgroundColor: "#A67C2E" },
  searchbox: {
    borderWidth: 0,
    backgroundColor: "transparent",
    fontSize: 14,
    paddingLeft: 4,
    borderBottomWidth: 0.2,
    borderColor: "gray",
    height: 40,
  },
  dropdownContainer: { borderRadius: 8, marginTop: -40, paddingVertical: 5 },
  placeholderDropdown: { color: "#7A7266", fontSize: 14 },
  valueDropdown: { color: "#1F1D1A", fontSize: 14 },
  footer: {
    position: "absolute",
    bottom: 30,
    marginHorizontal: 15,
    left: 0,
    right: 0,
    height: 50,
  },
  footerInner: {
    flex: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  imageRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  uploadBox: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  thumbWrap: { marginRight: 10, position: "relative" },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  removeIcon: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 2,
  },
  footerRow: {
    position: "absolute",
    bottom: 30,
    left: 15,
    right: 15,
    flexDirection: "row",
    gap: 10, // RN >= 0.71
  },

  footerBtn: {
    flex: 1, // 👈 50% when two buttons
    height: 50,
  },

  footerBtnFull: {
    flex: 0,
    width: "100%", // 👈 100% when single
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  multiSelectContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  multiSelectPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  multiSelectPillActive: {
    backgroundColor: "#C9A24D",
    borderColor: "#C9A24D",
  },
  multiSelectPillInactive: {
    backgroundColor: "#FBF8F1",
    borderColor: "#D9D2C3",
  },
  multiSelectPillText: {
    fontSize: RFValue(10),
  },
});

export default SROnboardingForm;
