import React, { useEffect, useState } from "react";
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
  Keyboard
} from "react-native";
import DatePicker from "react-native-date-picker";
import { RFValue } from "react-native-responsive-fontsize";
import { Dropdown } from "react-native-element-dropdown";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
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

const SROnboardingForm = ({ route }) => {
  const { formType, title, surveyFormId = null } = route.params || {};
  const { apiFetch } = useApiFetch();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const selectedVisit = useSelector((state) => state.selectedVisit);
  const auth = useSelector((state) => state.auth);
  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [options, setOptions] = useState([]);
  const [answers, setAnswers] = useState({});
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
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",
        });
        setUsers(result);
      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      }
    };
    initialize();
  }, []);

  console.log('formType', formType)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let srForm = null;

        if (surveyFormId) {
          const templates = await UniversalUpdateInsert({
            ObjectName: "Survey_Template__c",
            Type: "get",
            filters: [{ field: "Sf_Id", value: surveyFormId }]
          });
          srForm = templates?.[0] || null;
        } else {
          const templates = await UniversalUpdateInsert({
            ObjectName: "Survey_Template__c",
            Type: "get",
            filters: [{ field: "Status__c", value: "Published" }]
          });
          srForm = templates?.[templates.length - 1] || null;
        }

        setForm(srForm);

        if (srForm) {
          const qns = await UniversalUpdateInsert({
            ObjectName: "Survey_Question__c",
            Type: "get",
            filters: [
              { field: "Survey_Template__c", value: srForm.Sf_Id }
            ]
          });
          const uniqueQnsMap = new Map();
          qns.forEach((q) => {
            if (q.Sf_Id && !uniqueQnsMap.has(q.Sf_Id)) {
              uniqueQnsMap.set(q.Sf_Id, q);
            }
          });
          const uniqueQnsList = Array.from(uniqueQnsMap.values());

          const relatedQns = uniqueQnsList
            .sort((a, b) => {
              const orderA = a.question_Order__c ?? a.Question_Order__c ?? Number.MAX_SAFE_INTEGER;
              const orderB = b.question_Order__c ?? b.Question_Order__c ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB;
            });

          setQuestions(relatedQns);

          const questionIds = relatedQns.map(q => q.Sf_Id);

          const opts = await UniversalUpdateInsert({
            ObjectName: "Survey_Question_Option__c",
            Type: "get",
            filters: [
              {
                field: "Survey_Question__c",
                value: questionIds,
                operator: "in"
              }
            ]
          });
          setOptions(opts);
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

  const handleAnswerChange = (id, value, sanitizecheck = false) => {
    console.log('value', value);

    const sanitized = sanitizecheck
      ? value.replace(/[^a-zA-Z0-9 -]/g, "")   // hyphen allowed
      : value.replace(/[^a-zA-Z0-9 ]/g, "");   // old logic

    setAnswers((prev) => ({
      ...prev,
      [id]: sanitized
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
        0
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
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera to take a selfie.',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const openCamera = async (questionId) => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      dispatch(showToast({ message: 'Camera permission denied', type: 'error' }));
      return;
    }
    try {
      const result = await launchCamera({
        mediaType: "photo",
        cameraType: "back",
        saveToPhotos: false,
        quality: 0.8,
      });

      if (!result || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const originalUri = asset.uri;

      const resized = await ImageResizer.createResizedImage(
        originalUri,
        800,
        800,
        "JPEG",
        80,
        0
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
      console.log("Camera capture error:", err);
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

  const renderQuestion = (q) => {
    // console.log('q.Type__c', q.Type__c)
    // console.log('q.Name', q.Name)
    switch (q.Response_Type__c) {
      case "Boolean":
        return (
          <View style={styles.row}>
            {["Yes", "No"].map((option) => {
              const selected = answers[q.Sf_Id] === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => handleAnswerChange(q.Sf_Id, option)}
                  style={{ flexDirection: "row", alignItems: "center", marginRight: 20 }}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: selected ? "#C9A24D" : "#BEBEBE" },
                    ]}
                  >
                    {selected && (
                      <View
                        style={[styles.radioInner, { backgroundColor: "#C9A24D" }]}
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

      case "Picklist":
        const qOptions = options
          .filter((o) => o.Survey_Question__c === q.Sf_Id)
          .map((opt) => ({ label: opt.Option__c, value: opt.Option__c }));

        return (
          <Dropdown
            data={qOptions}
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
            onChange={(item) => handleAnswerChange(q.Sf_Id, item.value, true)}
          />
        );

      case "Date":
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

      case "Email":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val)}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Enter email"
          />
        );

      case "Phone":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val)}
            keyboardType="phone-pad"
            placeholder="Enter phone number"
          />
        );

      case "Number":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) => handleAnswerChange(q.Sf_Id, val)}
            keyboardType="numeric"
            placeholder="Enter number"
          />
        );

      case "Document":
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

      case "GST":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) =>
              handleAnswerChange(
                q.Sf_Id,
                val.toUpperCase().slice(0, 15)
              )
            }
            autoCapitalize="characters"
            placeholder="Enter GST Number"
            maxLength={15}
          />
        );

      case "PAN":
        return (
          <TextInput
            style={[styles.container, { padding: 8 }]}
            value={answers[q.Sf_Id] || ""}
            onChangeText={(val) =>
              handleAnswerChange(
                q.Sf_Id,
                val.toUpperCase().slice(0, 10)
              )
            }
            autoCapitalize="characters"
            placeholder="Enter PAN Number"
            maxLength={10}
          />
        );

      case "Text":
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
        ObjectName: 'AllDataPicklist',
        Type: 'get',
      });

      let recordTypeId = null;

      if (formType === 'Survey') {
        recordTypeId =
          AllPicklistData &&
            AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).surveyRecordTypeId
            : null;
      } else if (formType === 'Db Onboarding') {
        recordTypeId =
          AllPicklistData &&
            AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).dbRecordTypeId
            : null;
      } else if (formType === 'Sr Onboarding') {
        recordTypeId =
          AllPicklistData &&
            AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).srRecordTypeId
            : null;
      } else {
        // Default fallback
        recordTypeId =
          AllPicklistData &&
            AllPicklistData[0]?.OptionsData
            ? JSON.parse(AllPicklistData[0].OptionsData).surveyRecordTypeId
            : null;
      }

      return recordTypeId;
    } catch (e) {
      console.log(' Could not get the data', e);
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
  }

  // Function to handle form submission
  const handleSubmit = async (submitAndApproval = false) => {

    if (!questions || questions.length === 0) {
      showToastvisible("error", "At least one question is required");
      return;
    }
    // Validate required fixed fields
    for (let field of fixedFields) {
      if (field.required && !answers[field.id]) {
        showToastvisible("error", `${field.label} is required`);
        return;
      }
    }

    // Validate required dynamic questions
    // for (let q of questions) {
    //   if (q.Is_Required__c && !answers[q.Sf_Id]) {
    //     showToastvisible("error", `${q.Name} is required`);
    //     return;
    //   }
    // }
    // REQUIRED + FORMAT VALIDATION (Dynamic Questions)
    for (let q of questions) {
      const value = answers[q.Sf_Id];
      // 🔴 Required validation
      if (q.Mandatory__c && (!value || value.trim() === "")) {
        showToastvisible("error", `${q.Question__c} is required`);
        return;
      }

      const rule = validators[q.Response_Type__c];
      if (value && rule && !rule.regex.test(value)) {
        showToastvisible("error", `${q.Question__c}: ${rule.error}`);
        return;
      }
    }



    setLoading(true);

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
      Question: q.Question__c,
      Type: q.Response_Type__c,
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
      leadData: fixedPayload,
      questionData: dynamicPayload,
    };

    console.log("Final Payload:", JSON.stringify(payload));
    // setLoading(false); return;

    const connected = await isInternetAvailable();

    if (connected && !selectedVisit?.sfId.startsWith('local')) {
      // Online save via API
      try {
        const response = await apiFetch('POST', 'response-update', payload, 'Custom');
        console.log('API Response:', response);

        if (response.data.status === 'success') {

          if (submitAndApproval === true) {
            showToastvisible('success', `${title} Saved and Approval sent successfully`)
          }
          else {
            showToastvisible('success', `${title} Saved Successfully`);
          }
          setTimeout(() => {
            navigation.goBack();
          }, 3000);
        } else {
          showToastvisible('error', `Something went wrong: ${response.data?.errorDetail}`);
          console.log('Failed to save to API');
        }
      } catch (error) {
        console.error('Error while saving to API:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // Offline save to local DB
      const generateUniqueId = () => {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
      };

      const offlineData = {
        Sf_Id: generateUniqueId(),
        Unique_Id: generateUniqueId(),
        Json: JSON.stringify(payload),
        is_locally_changed: true,
        is_synced: false,
        last_modified: Date.now(),
        operation_type: 'insert',
      };

      const inserted = await UniversalUpdateInsert({
        ObjectName: "FormJson",
        Type: "insert",
        data: offlineData,
      });

      if (inserted) {
        showToastvisible('success', `${title} Create Successfully`);
        setTimeout(() => {
          navigation.goBack();
        }, 3000);
      }

      setLoading(false);
    }
  };

  // Function to show toast messages
  const showToastvisible = (type, message) => {
    dispatch(
      showToast({
        message: message,
        type: type, // 'success' | 'error' | 'warning'
      })
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
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <LoaderOverlay visible={loading} />
            </View>
          )}
          {!loading && (
            <ScrollView style={{ padding: 15, }} contentContainerStyle={{ paddingBottom: 160 }}>
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
                </View>
              ))} */}



              {questions.length === 0 ? (
                <View style={{ alignItems: "center", padding: 20, flex: 1, justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, color: "#666", textAlign: "center", fontWeight: "500" }}>
                    No questions available for {formType}
                  </Text>
                </View>
              ) : (
                questions.map((q, index) => (
                  <View key={q.Sf_Id} style={styles.qCard}>
                    <Text style={styles.label}>
                      {index + 1}. {q.Question__c}
                      {q.Mandatory__c === true && (
                        <Text style={{ color: "red" }}> *</Text>
                      )}
                    </Text>
                    {renderQuestion(q)}
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
                      date.toISOString().split("T")[0]
                    );
                  }
                }}
                onCancel={() => setOpenPicker(false)}
              />
            </ScrollView>
          )}
          {!keyboardVisible && (
            <View style={styles.footerRow}>

              {(formType === 'Sr Onboarding' || formType === 'Db Onboarding') && (
                <TouchableOpacity
                  style={[
                    styles.footerBtn,
                    !(formType === 'Sr Onboarding' || formType === 'Db Onboarding') && styles.footerBtnFull
                  ]}
                  onPress={handleSubmitAndApproval}
                >
                  <LinearGradient
                    colors={["#C9A24D", "#A67C2E", "#C9A24D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.footerInner}
                  >
                    <Text style={styles.footerText}>Save & Send to Approval</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.footerBtn
                ]}
                onPress={() => handleSubmit(false)}
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
    flex: 1,          // 👈 50% when two buttons
    height: 50,
  },

  footerBtnFull: {
    flex: 0,
    width: "100%",    // 👈 100% when single
  },

});

export default SROnboardingForm;