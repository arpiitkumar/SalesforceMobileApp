import React, { useRef, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  ScrollView,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import { showToast } from '../../redux/slices/toastSlice';
import { useDispatch } from "react-redux";
import { getSanitizedPhotoUrl } from '../../utils/getSanitizedPhotoUrl';



const { height } = Dimensions.get("window");

const Field = ({ label, value }) => (
  <View style={styles.fieldBox}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value || "-"}</Text>
  </View>
);

const ExceptionDetailsModal = ({ visible, onClose, exception }) => {
  const { apiFetch, apiComposite } = useApiFetch();
  const slideAnim = useRef(new Animated.Value(height)).current;
  const [status, setStatus] = useState(exception?.Status__c);
  const [loading, setLoading] = useState(false)
  const dispatch = useDispatch()
  const [statusOptions, setStatusOptions] = useState([])


  useEffect(() => {
    const initialize = async () => {
      try {



        const AllPicklistData = await UniversalUpdateInsert({ ObjectName: 'AllDataPicklist', Type: 'get' });
        let optionsObj = null;

        if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
          const raw = AllPicklistData[0]?.OptionsData;
          if (raw) {
            try {
              optionsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) {
              console.warn('Failed to parse AllDataPicklist.OptionsData, falling back to defaults', e);
              optionsObj = null;
            }
          }
        }

        // Defensive defaults if optionsObj missing
        // optionsObj.ExceptionIssueType  -> array of { value, label }
        // optionsObj.ExceptionStatus     -> array of { value, label }
        // optionsObj.ExceptionCategories -> array of { value, label }

        if (optionsObj) {
          // map arrays into { label, value }


          const statusFromServer = Array.isArray(optionsObj.ExceptionStatus)
            ? optionsObj.ExceptionStatus.map(it => ({ label: it.label || it.value, value: it.value }))
            : [];



          setStatusOptions(statusFromServer.length ? statusFromServer : status);


          // also pull other useful values like record type ids if present
          // e.g. optionsObj.orderRecordTypeId, optionsObj.accountRecordTypeId
          const orderRecordTypeId = optionsObj.orderRecordTypeId || null;
          const accountRecordTypeId = optionsObj.accountRecordTypeId || null;
          // you can set them to state if you need them elsewhere, e.g.
          // setRecordTypeId(orderRecordTypeId);
          console.log('Picklist loaded: ', {
            orderRecordTypeId,
            accountRecordTypeId,
            statusCount: statusFromServer.length,
          });
        } else {
          // No server picklist — leave your existing defaults (already in state).
          console.log('AllDataPicklist not found or invalid, using local defaults.');
        }
      } catch (error) {
        console.error(" Get User / Picklist Failed For the Header:", error);
      }
    };

    initialize();
  }, []);



  console.log("THISIS EXCEPTION0", exception)
  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (exception?.Status__c) {
      setStatus(exception.Status__c);
    }
  }, [exception]);

  // const statusOptions = [
  //   { label: "Open", value: "Open" },
  //   { label: "Escalated", value: "Escalated" },
  //   { label: "Resolved", value: "Resolved" },
  // ];

  const resolveImageUri = (rec) => {
    const raw =
      rec?.Image__c ?? rec?.ImageUrl__c ?? rec?.ImageBase64__c ?? rec?.ImageUri__c ?? null;
    if (!raw) return null;
    if (typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://"))) {
      return getSanitizedPhotoUrl(raw);
    }
    if (typeof raw === "string" && raw.startsWith("data:")) {
      return raw;
    }
    if (typeof raw === "string" && raw.length > 100) {
      return `data:image/jpeg;base64,${raw}`;
    }
    if (typeof raw === "string" && (raw.startsWith("file://") || raw.startsWith("content://"))) {
      return raw;
    }
    return null;
  };



  // const submitExceptionUpdate = async () => {


  //   const compositePayload = {
  //     compositeRequest: [

  //       {
  //         method: "PATCH",
  //         url: `/services/data/v61.0/sobjects/MT_Exception__c/${exception.Sf_Id}`,
  //         referenceId: "updateException",
  //         body: {
  //           Status__c: status,
  //         },
  //       },

  //     ],
  //     allOrNone: true,
  //   };
  //   console.log("COMPOSITE PAYLOAD ========", JSON.stringify(compositePayload));
  //   const response = await apiComposite("POST", "composite", compositePayload);
  //   console.log("COMPOSITE RESPONSE ========", JSON.stringify(response));

  //   if (response.status === "success") {

  //     console.log('respnse from api', JSON.stringify(response))
  //   } else {
  //     console.log("COMPOSITE REQUEST FAILED ====", response.message);
  //     return false;
  //   }
  // };



  // REPLACE submitExceptionUpdate with this version
  const submitExceptionUpdate = async () => {
    try {
      const compositePayload = {
        compositeRequest: [
          {
            method: "PATCH",
            url: `/services/data/v61.0/sobjects/MT_Exception__c/${exception.Sf_Id}`,
            referenceId: "updateException",
            body: {
              Status__c: status,
            },
          },
        ],
        allOrNone: true,
      };

      console.log("COMPOSITE PAYLOAD ========", JSON.stringify(compositePayload));
      const response = await apiComposite("POST", "composite", compositePayload);
      console.log("COMPOSITE RESPONSE ========", JSON.stringify(response));

      // success if response.status === "success" and compositeResponse shows 204 for our ref
      const compositeResponses = response?.data?.compositeResponse || response?.compositeResponse || [];
      const updateResp = compositeResponses.find(r => r.referenceId === "updateException");

      const success = response?.status === "success" && updateResp && (updateResp.httpStatusCode === 204 || updateResp.httpStatusCode === 200);

      return { success: !!success, apiResponse: response, compositeResponses };
    } catch (err) {
      console.error("submitExceptionUpdate error:", err);
      return { success: false, error: err };
    }
  };



  // ADD this helper function
  const saveExceptionLocally = async (apiResult = { success: false }, additionalFields = {}) => {
    try {
      const apiSuccess = !!apiResult.success;

      // Use the real Sf_Id from exception (must exist)
      const Sf_Id = exception?.Sf_Id || exception?.id || null;
      if (!Sf_Id) {
        //console.warn("No Sf_Id available on exception; cannot save local update.");
        return { success: false, reason: "no_sf_id" };
      }

      // Build payload to upsert / update local table entry
      const localPayload = {
        Sf_Id: Sf_Id,
        // updated business fields
        Status__c: status,
        // preserve/overwrite relevant fields if needed via additionalFields
        ...additionalFields,
        // sync metadata
        is_locally_changed: true,
        operation_type: apiSuccess ? null : "update", // flagging as local update if api failed
        last_modified: Date.now(),
        is_synced: apiSuccess ? true : false,
      };

      console.log("Saving exception locally (MT_Exception__c):", localPayload);

      // UniversalUpdateInsert expects ObjectName, Type, data
      // Use "insert" because the utility upserts by Sf_Id in your codebase
      const inserted = await UniversalUpdateInsert({
        ObjectName: "MT_Exception__c",
        Type: "insert",
        data: localPayload,
      });

      return { success: !!inserted, inserted };
    } catch (err) {
      console.error("saveExceptionLocally failed:", err);
      return { success: false, error: err };
    }
  };




  // REPLACE your handleSubmit with this version (or update inside to match)
  const handleSubmit = async () => {
    try {
      console.log("Submitting status:", status);
      setLoading?.(true); // if you have setLoading state in this component (you had earlier)

      // 1) Try to update online (if network available — apiComposite will fail otherwise)
      const apiResult = await submitExceptionUpdate(); // returns { success: boolean, ... }

      // 2) Always save locally; pass apiResult so we can set is_synced true/false
      const saveResult = await saveExceptionLocally(apiResult);

      if (!saveResult.success) {
        console.warn("Local save failed:", saveResult);
      } else {
        console.log("Local save OK", saveResult);
      }

      // 3) Update local UI state to reflect new status right away
      setStatus(status);

      // optional: if parent list needs refresh, you might call a callback here.
      // if (onUpdated) onUpdated({ Sf_Id: exception?.Sf_Id, Status__c: status, is_synced: !!apiResult.success });
      dispatch(showToast({ message: 'Record updated successfully!', type: 'success' }));
    } catch (err) {
      dispatch(showToast({ message: 'Error updating record!', type: 'error' }));
      console.error("handleSubmit error:", err);
    } finally {
      setLoading?.(false);
      if (onClose) onClose(); // close modal after all operations
    }
  };

  const imgUri = resolveImageUri(exception);

  return (
    <Modal statusBarTranslucent={false} transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.background} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerText}>Exception Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View style={styles.topRow}>
              {imgUri ? (
                <Image source={{ uri: imgUri }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.noImage]}>
                  <Ionicons name="image-outline" size={30} color="#999" />
                </View>
              )}
              <View style={styles.topRight}>
                <Text style={styles.exceptionTitle}>
                  {exception?.Name || "Unknown Exception"}
                </Text>
                <Text style={styles.exceptionDate}>
                  {exception?.ExceptionDate__c
                    ? new Date(exception.ExceptionDate__c).toLocaleDateString()
                    : "-"}
                </Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Field
                label="Product"
                value={exception?.ProductLabel || exception?.Product__c}
              />
              <Field label="Category" value={exception?.Category__c} />
            </View>

            <View style={styles.fieldRow}>
              <Field label="Issue Type" value={exception?.IssueType__c} />
              <Field label="Remark" value={exception?.Remarks__c} />
            </View>

            <View style={{ width: "100%", marginTop: 10 }}>
              <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Status</Text>
              {/* <Dropdown
                data={statusOptions}
                labelField="label"
                valueField="value"
                value={status}
                onChange={(item) => setStatus(item.value)}
                placeholder="Select status"
                style={styles.dropdown}
              /> */}


              <Dropdown
                data={statusOptions}
                search
                searchPlaceholder="Search"
                dropdownPosition="top"
                inputSearchStyle={{ fontSize: 10, borderRadius: 10, height: 40 }}
                labelField="label"
                itemTextStyle={{ fontSize: 12 }}
                valueField="value"
                placeholder="Select Status"
                value={status}
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                selectedTextStyle={styles.selectedTextStyle}
                itemContainerStyle={{ marginVertical: -2 }}
                placeholderStyle={styles.placeholderStyle}
                onChange={(item) => setStatus(item.value)}
              />
            </View>
          </ScrollView>


          <LinearGradient
            colors={['#1E3A8A', '#1E3A8A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.submitBtn]}
          >
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>Update Status</Text>

            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
      <LoaderOverlay visible={loading} />
    </Modal>
  );
};

export default ExceptionDetailsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  background: { flex: 1 },
  modalContainer: {
    maxHeight: height * 0.7,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 15,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  image: {
    height: 90,
    width: 90,
    borderRadius: 12,
    backgroundColor: "#ddd",
  },
  noImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  topRight: {
    flex: 1,
    marginLeft: 16,
  },
  exceptionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },
  exceptionDate: {
    fontSize: 14,
    color: "#666",
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fieldBox: {
    width: "48%",
    backgroundColor: "#f7f9fc",
    padding: 12,
    borderRadius: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
  },

  submitBtn: {
    // backgroundColor: "#2979FF",
    borderRadius: 10,
    padding: 7,
    alignItems: "center",
    // marginTop: 10,
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D9D2C3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  dropdownContainer: {
    borderRadius: 6,
    marginTop: -40,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  selectedTextStyle: {
    fontSize: 12,
    color: '#000',
  },
  dropdownText: { color: '#111', fontSize: 14 },
});
