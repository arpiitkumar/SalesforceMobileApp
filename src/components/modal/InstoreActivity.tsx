// AddCompetitorsModal.js
import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { launchImageLibrary } from "react-native-image-picker";
import { Dropdown } from "react-native-element-dropdown";
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../../utils/networkUtils';
import { showToast } from '../../redux/slices/toastSlice';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import ImagePickerModal from './ImagePickerModal';

const { height } = Dimensions.get("window");

export default function InstoreActivity({ visible, onClose }) {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [currentImageKey, setCurrentImageKey] = useState(null);
  const [fifoDone, setFifoDone] = useState("Yes");
  const [visibility, setVisibility] = useState("");
  const [selectedHiredTypes, setSelectedHiredTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  const { apiFetch } = useApiFetch()
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const dispatch = useDispatch()


  const [images, setImages] = useState({ visibility: null, promo1: null, promo2: null });

  const [visibilityOptions, setVisibilityOptions] = useState([]);
  const [HiredTypeOptions, setHiredTypeOptions] = useState([]);


  // add near your other helpers / image processing functions
  const handleImageSelectedFromModal = (imageObj) => {
    // imageObj should be in the shape your ImagePickerModal returns (resizedUri, base64, fileName, uri, type...)
    if (!currentImageKey) {
      console.warn('No currentImageKey set while receiving image from modal');
      setImageModalVisible(false);
      return;
    }

    if (imageObj) {
      const finalImage = {
        name: imageObj.fileName || 'image.jpg',
        uri: imageObj.resizedUri || imageObj.uri,
        base64: imageObj.base64 || null,
      };
      setImages((prev) => ({ ...prev, [currentImageKey]: finalImage }));
    }

    // cleanup
    setCurrentImageKey(null);
    setImageModalVisible(false);
  };

  // ---------- Picklist Data ----------
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
        if (optionsObj) {
          const visibilityOptionsget = Array.isArray(optionsObj.AccountVisibility)
            ? optionsObj.AccountVisibility.map(it => ({ label: it.label || it.value, value: it.value }))
            : [];
          const HiredTypeOptionsget = Array.isArray(optionsObj.AccountHiredType)
            ? optionsObj.AccountHiredType.map(it => ({ label: it.label || it.value, value: it.value }))
            : [];
          setVisibilityOptions(visibilityOptionsget.length ? visibilityOptionsget : []);
          setHiredTypeOptions(HiredTypeOptionsget.length ? HiredTypeOptionsget : []);
        }
      } catch (error) {
        console.error(" Get Picklist Failed:", error);
      }
    };

    initialize();
  }, []);

  // ---------- Account Data ----------
  useEffect(() => {
    if (!visible) return;

    const initialize = async () => {
      try {
        const accountData = await UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'get',
          filters: [{ field: "Sf_Id", value: selectedVisit.AccountId__c }],
        });

        if (Array.isArray(accountData) && accountData.length > 0) {
          const acc = accountData[0];

          const normalizeImage = (val, defaultName) => {
            if (!val) return null;
            if (val.startsWith("http")) {
              return { uri: val, base64: null, name: defaultName };
            }
            return {
              uri: `data:image/jpeg;base64,${val}`,
              base64: val,
              name: defaultName,
            };
          };

          setImages({
            visibility: normalizeImage(acc.VIsibility__c, "visibility.jpg"), // Note: it is VIsibility__c in database
            promo1: normalizeImage(acc.Other_Promotion_Activity__c, "promo1.jpg"),
            // promo2: normalizeImage(acc.Other_Promotion_Activity_2__c, "promo2.jpg"),
          });

          setFifoDone(acc.FIFO_Done__c ? "Yes" : "No");
          setVisibility(acc.VIsibility__c || "");
          // setSelectedHiredTypes(
          //   acc.Hired_Type__c ? acc.Hired_Type__c.split(",") : []
          // );
        }
      } catch (error) {
        console.error(" AccountData fetch failed:", error);
      }
    };

    initialize();
  }, [visible, selectedVisit.AccountId__c]);

  // ---------- Image Picker ----------
  const openImagePicker = (key) => {
    setCurrentImageKey(key);
    setImageModalVisible(true);
  };
  const removeImage = (key) => {
    setImages((prev) => ({ ...prev, [key]: null }));
  };

  const resetForm = () => {
    setFifoDone("Yes");
    setVisibility("");
    setSelectedHiredTypes([]);
    setImages({ visibility: null, promo1: null, promo2: null });
  };

  const toggleHiredType = (item) => {
    if (selectedHiredTypes.includes(item)) {
      setSelectedHiredTypes(selectedHiredTypes.filter((i) => i !== item));
    } else {
      setSelectedHiredTypes([...selectedHiredTypes, item]);
    }
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    // setLoading(true);

    const showError = (msg) => {
      dispatch(showToast({ message: msg, type: "warning" }));
      setLoading(false);
      return false;
    };

    if (!fifoDone) return showError("Please select FIFO Done");
    if (!visibility) return showError("Please select Visibility");
    if (visibility === "Hired" && selectedHiredTypes.length === 0)
      return showError("Please select at least one Hired Type");
    if (!images.visibility && visibility === "Hired") return showError("Please upload Visibility Image");
    // if (!images.promo1) return showError("Please upload Other Promotion Activity Image");
    // if (!images.promo2) return showError("Please upload Other Promotion Activity 2 Image");

    const connected = await isInternetAvailable();
    let is_synced = false;
    let image1 = null, image2 = null, image3 = null;

    if (connected) {
      const payload = {
        AccountId: selectedVisit.AccountId__c,
        FIFODone: fifoDone,
        HiredType: selectedHiredTypes.join(","),
        Visibility: visibility,
        VisibilityImage: images?.visibility?.base64,
        OtherPromotionActivity: images?.promo1?.base64 || null,
        OtherPromotionActivity2: images?.promo2?.base64 || null,
        fileNamePrefix1: images?.visibility?.name,
        fileNamePrefix2: images?.promo1?.name || null,
        fileNamePrefix3: images?.promo2?.name || null,
      };
      const response = await apiFetch('POST', 'updateAccount', payload, 'Custom');
      if (response?.data?.status === 'success') {
        is_synced = true;
        image1 = response.data?.responseBody?.publicUrl1 || null;
        image2 = response.data?.responseBody?.publicUrl2 || null;
        image3 = response.data?.responseBody?.publicUrl3 || null;
      }
    }

    // Local DB save
    const dbPayload = {
      Sf_Id: selectedVisit.AccountId__c,
      FIFO_Done__c: fifoDone === "Yes" ? true : false,
      // Hired_Type__c: selectedHiredTypes.join(","),
      VIsibility__c: visibility,
      Visibility_Image__c: image1 ? image1 : images?.visibility?.base64,
      Other_Promotion_Activity__c: image2 ? image2 : images?.promo1?.base64,
      // Other_Promotion_Activity_2__c: image3 ? image3 : images?.promo2?.base64,
      is_locally_changed: !is_synced,
      is_synced: is_synced,
    };

    const localsave = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "insert",
      data: dbPayload,
    });

    if (localsave) {
      dispatch(showToast({ message: 'Activity Save Successfully. !!!', type: "success" }));
      setLoading(false);
      resetForm();
      onClose?.();
    } else {
      dispatch(showToast({ message: 'Something went wrong. !!!', type: "warning" }));
      setLoading(false);
    }
  };

  // ---------- Render ----------
  const renderImageRow = (title, key, required = false) => (
    <>
      <Text style={styles.label}>
        {title} {required && <Text style={{ color: "red" }}>*</Text>}
      </Text>
      <View style={styles.imageRow}>
        {!images[key] ? (
          <TouchableOpacity style={styles.uploadBox} onPress={() => openImagePicker(key)}>
            <Ionicons name="camera" size={24} />
          </TouchableOpacity>
        ) : (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: images[key].uri }} style={styles.thumb} />
            <TouchableOpacity
              style={styles.removeIcon}
              onPress={() => removeImage(key)}
            >
              <Ionicons name="close" size={14} color="red" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
  // console.log('visibility.....', visibility)

  return (
    <Modal visible={visible} transparent statusBarTranslucent={false} animationType="slide">
      <LoaderOverlay visible={loading} />
      <ImagePickerModal
        visible={imageModalVisible}
        onClose={() => {
          setImageModalVisible(false);
          setCurrentImageKey(null);
        }}
        onImageSelected={(imageObj) => {
          handleImageSelectedFromModal(imageObj);
        }}
      />
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "100%",
              paddingVertical: 8,
              borderBottomWidth: 0.34,
              borderColor: "#313131",
            }}>
              <Text style={styles.headerText}>Instore Activity</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
            {/* FIFO Done */}
            <Text style={styles.label}>FIFO Done <Text style={{ color: "red" }}>*</Text></Text>
            <View style={styles.radioRow}>
              {["Yes", "No"].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.radioOption,
                    fifoDone === item && styles.selectedRadioOption
                  ]}
                  onPress={() => setFifoDone(item)}
                >
                  <Ionicons
                    name={fifoDone === item ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color="#1E3A8A"
                  />
                  <Text style={styles.radioText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Visibility */}
            <Text style={styles.label}>Visibility <Text style={{ color: "red" }}>*</Text></Text>
            <View style={styles.radioRow}>
              {visibilityOptions.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.radioOption,
                    visibility === item.value && styles.selectedRadioOption // highlight selected
                  ]}
                  onPress={() => setVisibility(item.value)}
                >
                  <Ionicons
                    name={visibility === item.value ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color="#1E3A8A"
                  />
                  <Text style={styles.radioText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hired Type */}
            {/* <Text style={styles.label}>Hired Type</Text>
            <View style={styles.radioRow}>
              {HiredTypeOptions.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.radioOption}
                  onPress={() => toggleHiredType(item.value)}
                >
                  <Ionicons
                    name={selectedHiredTypes.includes(item.value) ? "checkbox" : "square-outline"}
                    size={20}
                    color="#1E3A8A"
                  />
                  <Text style={styles.radioText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View> */}

            {/* Image Uploads */}
            {renderImageRow("Visibility Image (JPG, PNG)", "visibility", visibility === 'Hired')}
            {renderImageRow("Other Promotion Activity", "promo1")}
            {/* {renderImageRow("Other Promotion Activity 2", "promo2")} */}
          </ScrollView>

          {/* Submit */}
          <TouchableOpacity onPress={handleSubmit}>
            <LinearGradient colors={["#1E3A8A", "#1E3A8A"]} style={styles.submitBtn}>
              <Text style={styles.submitText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: height * 0.95,
  },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 8 },
  headerText: { fontSize: 16, fontWeight: "600", color: "#000" },

  label: {
    color: "#7A7266",
    fontWeight: "400",
    marginBottom: 4,
    marginTop: 12,
    fontSize: 13,
  },
  radioRow: { flexDirection: "row", alignItems: "center" },
  radioOption: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  radioText: { marginLeft: 6, color: "#000" },

  imageRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  uploadBox: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    marginRight: 8,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F1EADB",
  },
  thumb: { width: "100%", height: "100%" },
  removeIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  dropdown: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: .5,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  dropdownContainer: {
    borderRadius: 6,
    marginTop: -40,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  selectedTextStyle: { fontSize: 12, color: '#000' },
  placeholderStyle: { color: "#999", fontSize: 14 },

  submitBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 8, margin: 15 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
    paddingVertical: 8,  // better touch target
    paddingHorizontal: 7,
  },
  selectedRadioOption: {  // NEW: highlight selected
    backgroundColor: '#E3F2FD',
    borderRadius: 9,
  },
});