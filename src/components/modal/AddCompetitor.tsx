import React, { useEffect, useState } from "react";
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
import { Platform } from "react-native";
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { buildSyncFields, extractApiErrorMessage } from "../../utils/sync/syncStatus";
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { useSelector } from "react-redux";
import { RootState } from '../../redux/store';
import { resizeAndConvertImage } from '../../utils/helper/resizeAndConvertImage';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/slices/toastSlice';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import ImagePickerModal from "./ImagePickerModal";
import CTextInput from "../customUtilityComponents/CTextInput";

const { height } = Dimensions.get("window");

const BLANK_COMPETITOR = {
  id: null,
  brand: "",
  sku: "",
  price: "",
  grammage: "",
  activity: "",
  remarks: "",
  images: [],
  isExpanded: true, // Default to expanded for new competitors
};

export default function AddCompetitorsModal({ visible, onClose, brandIdFromPricing = null, skuNameFromPricing = null }) {
  // ARRAY state for multiple competitors
  const [competitors, setCompetitors] = useState([]);
  const [activeImagePickerIndex, setActiveImagePickerIndex] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [grammageType, setGrammageType] = useState('')

  const [activityTypes, setActivityTypes] = useState([]);
  const [competitorMasterState, setCompetitorMasterState] = useState([]);
  const [users, setUsers] = useState([]);

  const { apiFetch } = useApiFetch();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);

  let productTitle = 'new title';

  const createPreFilledCompetitor = () => {
    if (brandIdFromPricing || skuNameFromPricing) {
      return {
        id: `prefilled_${Date.now()}`,
        brand: brandIdFromPricing || "",
        sku: skuNameFromPricing || "",
        price: "",
        grammage: "",
        activity: "",
        remarks: "",
        images: [],
        isExpanded: true,
      };
    }
    return null;
  };

  useEffect(() => {
    const initialize = async () => {
      // Fetch competitor master
      const competitorMaster = await UniversalUpdateInsert({
        ObjectName: 'CompetitorMaster__c',
        Type: 'get',
      });
      const optionMappingCompetitorMaster = competitorMaster.map((item) => ({
        label: item.Name,
        value: item.Sf_Id,
      }));
      setCompetitorMasterState(optionMappingCompetitorMaster);

      // Fetch users
      const usersData = await UniversalUpdateInsert({
        ObjectName: 'User',
        Type: 'get',
      });
      setUsers(usersData);

      // Fetch activity types
      const AllPicklistData = await UniversalUpdateInsert({
        ObjectName: 'AllDataPicklist',
        Type: 'get',
      });

      let optionsObj = null;
      if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
        const raw = AllPicklistData[0]?.OptionsData;
        if (raw) {
          try {
            optionsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch (e) {
            console.warn('Failed to parse AllDataPicklist.OptionsData', e);
            optionsObj = null;
          }
        }
      }

      if (optionsObj && Array.isArray(optionsObj.ActivityType)) {
        const activityTypesFromServer = optionsObj.ActivityType.map(it => ({
          label: it.label || it.value,
          value: it.value,
        }));
        setActivityTypes(activityTypesFromServer);
      }

      // Initialize competitors array with pre-filled if applicable
      const preFilledCompetitor = createPreFilledCompetitor();
      if (preFilledCompetitor) {
        setCompetitors([preFilledCompetitor]);
      }
    };

    if (visible) {
      initialize();
    }
  }, [visible]);

  // Generate unique ID for competitor
  const generateCompetitorId = () => {
    return `comp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  };

  // Add new blank competitor
  const addNewCompetitor = () => {
    const newCompetitor = {
      ...BLANK_COMPETITOR,
      id: generateCompetitorId(),
    };
    setCompetitors([...competitors, newCompetitor]);
  };

  // Remove competitor by index
  const removeCompetitor = (index) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
    // dispatch(showToast({ message: 'Competitor removed', type: 'info' }));
  };

  // Toggle accordion expansion
  const toggleCompetitorExpanded = (index) => {
    const updated = [...competitors];
    updated[index].isExpanded = !updated[index].isExpanded;
    setCompetitors(updated);
  };

  // Update competitor field
  const updateCompetitorField = (index, field, value) => {
    const updated = [...competitors];
    updated[index][field] = value;
    setCompetitors(updated);
  };

  // Add image to specific competitor
  const addImageToCompetitor = (index, imageObj) => {
    if (!imageObj) return;
    const updated = [...competitors];
    updated[index].images = [imageObj]; // Single image per competitor
    setCompetitors(updated);
    setImageModalVisible(false);
  };

  // Remove image from competitor
  const removeImageFromCompetitor = (index, imageIndex) => {
    const updated = [...competitors];
    updated[index].images = updated[index].images.filter((_, i) => i !== imageIndex);
    setCompetitors(updated);
  };

  const validateCompetitor = (competitor) => {
    if (!competitor.brand && !brandIdFromPricing) {
      return 'Please select a brand';
    }
    if (!competitor.sku || competitor.sku.trim() === '') {
      return 'Please enter SKU';
    }
    if (!competitor.price) {
      return 'Please enter price';
    }
    if (!competitor.grammage) {
      return 'Please enter grammage';
    }
    if (!competitor.activity) {
      return 'Please select activity';
    }
    if (competitor.images.length === 0) {
      return 'Please upload at least one image';
    }
    return null;
  };

  const prepareImagesForRequest = async (imagesArr = [], fileNamePrefix = `img_${Date.now()}`) => {
    if (!imagesArr || !imagesArr.length) return [];

    const outputs = [];
    for (let i = 0; i < imagesArr.length; i++) {
      const img = imagesArr[i];
      try {
        const processed = await resizeAndConvertImage(img.uri || img);
        const extFromMime = processed?.mimeType?.split("/")[1];
        const extFromName = (img.fileName && img.fileName.split(".").pop()) || null;
        const ext = extFromMime || extFromName || "jpg";
        const indexedFileName = `${fileNamePrefix}_${i + 1}.${ext}`;

        if (processed && processed.base64) {
          outputs.push({
            fileName: indexedFileName,
            mimeType: processed.mimeType || `image/${ext}`,
            base64: processed.base64,
          });
        } else {
          let path = img.uri || "";
          if (path.startsWith("file://")) path = path.replace("file://", "");
          try {
            const base64 = await RNFS.readFile(path, "base64");
            outputs.push({
              fileName: indexedFileName,
              mimeType: img.type || `image/${ext}`,
              base64,
            });
          } catch (err) {
            console.warn("prepareImagesForRequest fallback failed", err);
            outputs.push({
              fileName: indexedFileName,
              mimeType: img.type || `image/${ext}`,
              base64: null,
            });
          }
        }
      } catch (err) {
        console.warn("prepareImagesForRequest error:", err);
        const ext = (img.fileName && img.fileName.split(".").pop()) || "jpg";
        outputs.push({
          fileName: `${fileNamePrefix}_${i + 1}.${ext}`,
          mimeType: img.type || `image/${ext}`,
          base64: null,
        });
      }
    }
    return outputs;
  };

  const generateLocalSfId = () => {
    return `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  };

  const buildRequestWrapper = (competitor, preparedImages = [], fileNamePrefix) => {
    const firstImageBase64 = preparedImages.length ? preparedImages[0].base64 : null;

    return {
      recordId: null,
      Activity: competitor.activity,
      Competitor: competitor.brand || brandIdFromPricing,
      subCategory: null,
      category: null,
      fileNamePrefix: fileNamePrefix,
      Customer: selectedVisit?.AccountId || "",
      Merchandiser: users?.[0]?.Sf_Id || "",
      Type: 'Competitor Initiative',
      SellingPrice: competitor.price,
      Remarks: competitor.remarks,
      Promotion: null,
      ProductName: competitor.sku,
      Product: null,
      Photo: firstImageBase64,
      MRP: null,
      GrammageBeforePromotion: null,
      Grammage: competitor.grammage,
      GrammageType: grammageType,
    };
  };

  const submitRequestOnline = async (requestWrapper) => {
    try {
      console.log("COMPETITOR PAYLOAD ->", requestWrapper);
      const response = await apiFetch('POST', 'createCompetitorLineItem', requestWrapper, 'Custom');
      console.log('RAW API RESPONSE ->', JSON.stringify(response));

      const responseBody =
        response?.data?.data?.responseBody ||
        response?.data?.responseBody ||
        response?.responseBody ||
        response?.data ||
        null;

      const recordId = responseBody?.recordId || null;
      const publicUrl = responseBody?.publicUrl || null;
      const successFlag =
        (response?.status === 'success') ||
        (response?.data?.status === 'success') ||
        Boolean(recordId) ||
        Boolean(publicUrl);

      return {
        success: !!successFlag,
        recordId,
        publicUrl,
        raw: response,
        Name: responseBody?.Name,
        attempted: true,
        errorMsg: successFlag ? null : extractApiErrorMessage(response, null),
      };
    } catch (err) {
      console.error("submitRequestOnline failed:", err);
      return { success: false, error: err, attempted: true, errorMsg: extractApiErrorMessage(null, err) };
    }
  };

  const saveCompetitorLocally = async (competitor, apiResult = { success: false }, preparedImages = [], fileNamePrefix) => {
    try {
      const apiSuccess = !!apiResult.success;
      const onlineRecordId = apiSuccess ? apiResult.recordId : null;
      const Sf_Id = apiSuccess ? onlineRecordId : generateLocalSfId();
      const publicUrl = apiResult.publicUrl || null;
      const firstBase64 = (preparedImages && preparedImages.length && preparedImages[0].base64) ? preparedImages[0].base64 : null;
      const firstUri = (competitor.images && competitor.images.length && competitor.images[0].uri) ? competitor.images[0].uri : null;

      const localPayload = {
        Sf_Id,
        Activity__c: competitor.activity,
        Competitor__c: competitor.brand || brandIdFromPricing,
        Sub_Category__c: null,
        Category__c: null,
        fileNamePrefix: fileNamePrefix,
        Customer__c: selectedVisit?.AccountId || "",
        Merchandiser__c: users?.[0]?.Sf_Id || "",
        Type__c: 'Competitor Initiative',
        Selling_Price__c: Number(competitor.price),
        Remarks__c: competitor.remarks,
        Promotion__c: null,
        Product_Name__c: competitor.sku,
        Photo__c: publicUrl || firstBase64 || firstUri,
        MRP__c: null,
        Grammage_Before_Promotion__c: null,
        Grammage__c: competitor.grammage,
        Grammage_Type__c: grammageType,
        is_locally_changed: true,
        operation_type: "insert",
        last_modified: Date.now(),
        ...buildSyncFields({
          apiSuccess,
          attempted: !!apiResult.attempted,
          errorMsg: apiResult.errorMsg,
        }),
      };

      console.log("Saving localPayload:", localPayload);

      const inserted = await UniversalUpdateInsert({
        ObjectName: "Competitor_LineItem__c",
        Type: "insert",
        data: localPayload,
      });

      console.log("Saved competitor locally:", inserted, "Sf_Id:", Sf_Id);
      return { success: !!inserted, Sf_Id, apiSuccess };
    } catch (err) {
      console.error("saveCompetitorLocally failed:", err);
      return { success: false };
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate all competitors
      const validationErrors = [];
      competitors.forEach((competitor, index) => {
        const error = validateCompetitor(competitor);
        if (error) {
          validationErrors.push(`Competitor ${index + 1}: ${error}`);
        }
      });

      if (validationErrors.length > 0) {
        dispatch(showToast({
          message: validationErrors[0],
          type: 'error',
        }));
        return;
      }

      setLoading(true);
      const connected = await isInternetAvailable();
      const fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`;

      // Submit each competitor
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < competitors.length; i++) {
        const competitor = competitors[i];

        try {
          // Prepare images for this competitor
          const preparedImages = await prepareImagesForRequest(competitor.images, `${fileNamePrefix}_comp${i + 1}`);

          // Build request wrapper
          const requestWrapper = buildRequestWrapper(competitor, preparedImages, `${fileNamePrefix}_comp${i + 1}`);

          // Try API if connected
          let apiResult = { success: false };
          if (connected) {
            apiResult = await submitRequestOnline(requestWrapper);
            if (!apiResult.success) {
              console.warn(`Competitor ${i + 1}: API submit failed. Will save locally.`);
            }
          } else {
            console.log(`Competitor ${i + 1}: No connection — will save locally.`);
          }

          // Save locally
          const saveResult = await saveCompetitorLocally(competitor, apiResult, preparedImages, `${fileNamePrefix}_comp${i + 1}`);

          if (saveResult.success) {
            successCount++;
            console.log(`Competitor ${i + 1} saved. apiSuccess=${apiResult.success}`);
          } else {
            failureCount++;
            console.warn(` Competitor ${i + 1} failed to save locally.`);
          }
        } catch (err) {
          failureCount++;
          console.error(`Competitor ${i + 1} error:`, err);
        }
      }

      setLoading(false);

      // Show result message
      if (failureCount === 0) {
        dispatch(showToast({
          message: `All ${successCount} competitor(s) added successfully!`,
          type: 'success',
        }));
      } else {
        dispatch(showToast({
          message: `${successCount} added, ${failureCount} failed`,
          type: 'warning',
        }));
      }

      // Reset and close
      setCompetitors([]);
      onClose?.();
    } catch (err) {
      console.error("submit error:", err);
      setLoading(false);
      dispatch(showToast({
        message: 'Error submitting competitors',
        type: 'error',
      }));
    }
  };


  const renderCompetitorCard = (competitor, index) => {
    const isExpanded = competitor.isExpanded;

    return (
      <View key={competitor.id} style={styles.competitorCard}>
        {/* Accordion Header */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleCompetitorExpanded(index)}
        >
          <View style={styles.headerLeft}>
            <Ionicons
              name={isExpanded ? "chevron-down" : "chevron-forward"}
              size={20}
              color="#333"
            />
            <Text style={styles.competitorTitle}>
              Competitor {index + 1}
              {/* {competitor.brand || brandIdFromPricing ? ` - ${competitor.brand || brandIdFromPricing}` : ''} */}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => removeCompetitor(index)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash" size={18} color="red" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Accordion Body */}
        {isExpanded && (
          <View style={styles.accordionBody}>
            {/* Brand */}
            <Text style={styles.label}>
              Brand <Text style={{ color: "red" }}>*</Text>
            </Text>
            <Dropdown
              data={competitorMasterState}
              labelField="label"
              valueField="value"
              disable={brandIdFromPricing && index === 0 ? true : false}
              value={competitor.brand || brandIdFromPricing}
              onChange={(item) => updateCompetitorField(index, 'brand', item.value)}
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              inputSearchStyle={styles.searchbox}
              placeholderStyle={styles.placeholderDropdown}
              selectedTextStyle={styles.valueDropdown}
              search
              searchPlaceholder="Search"
              itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
              placeholder="Select brand"
            />

            {/* SKU */}
            <Text style={styles.label}>
              SKU <Text style={{ color: "red" }}>*</Text>
            </Text>
            <CTextInput
              style={styles.input}
              value={competitor.sku}
              placeholder="SKU"
              editable={true}
              // editable={skuNameFromPricing && index === 0 ? false : true}
              validationType="text"
              minValue={1}
              onChangeText={(text) => updateCompetitorField(index, 'sku', text)}
            />

            {/* Price & Grammage Row */}
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>
                  Selling Price <Text style={{ color: "red" }}>*</Text>
                </Text>
                <CTextInput
                  style={styles.input}
                  value={competitor.price}
                  placeholder="₹ 0"
                  keyboardType="numeric"
                  validationType="price"
                  maxLengthAllowed={5}
                  minValue={1}
                  onChangeText={(text) => updateCompetitorField(index, 'price', text)}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Grammage <Text style={{ color: "red" }}>*</Text>
                </Text>
                <CTextInput
                  style={styles.input}
                  value={competitor.grammage}
                  placeholder="₹ 0"
                  keyboardType="numeric"
                  validationType="price"
                  maxLengthAllowed={5}
                  minValue={1}
                  onChangeText={(text) => updateCompetitorField(index, 'grammage', text)}
                />
              </View>
            </View>

            <View style={styles.row}>
              {/* Activity */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>
                  Activity <Text style={{ color: "red" }}>*</Text>
                </Text>
                <Dropdown
                  data={activityTypes}
                  labelField="label"
                  valueField="value"
                  value={competitor.activity}
                  onChange={(item) => updateCompetitorField(index, 'activity', item.value)}
                  style={styles.dropdown}
                  containerStyle={styles.dropdownContainer}
                  inputSearchStyle={styles.searchbox}
                  placeholderStyle={styles.placeholderDropdown}
                  selectedTextStyle={styles.valueDropdown}
                  search
                  searchPlaceholder="Search"
                  itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                  placeholder="Select activity"
                />
              </View>
              <View style={{ flex: 1, marginRight: 0 }}>
                <Text style={styles.label}>
                  Grammage Type <Text style={{ color: "red" }}>*</Text>
                </Text>
                <Dropdown
                  data={
                    [
                      { label: 'KG', value: 'KG' },
                      { label: 'LTR', value: 'LTR' },
                      { label: 'ML', value: 'ML' },


                      { label: 'GM', value: 'GM' }]

                  }
                  labelField="label"
                  valueField="value"
                  value={grammageType}
                  onChange={(item) => setGrammageType(item.value)}
                  style={styles.dropdown}
                  containerStyle={styles.dropdownContainer}
                  inputSearchStyle={styles.searchbox}
                  placeholderStyle={styles.placeholderDropdown}
                  selectedTextStyle={styles.valueDropdown}
                  search
                  searchPlaceholder="Search"
                  itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                  placeholder="Select activity"
                />
              </View>
            </View>
            {/* Remarks */}
            <Text style={styles.label}>
              Remarks <Text style={{ color: "red" }}>*</Text>
            </Text>
            <CTextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={competitor.remarks}
              placeholder="Type here"
              validationType="text"
              maxLengthAllowed={500}
              minValue={1}
              onChangeText={(text) => updateCompetitorField(index, 'remarks', text)}
            />

            {/* Images */}
            <Text style={styles.label}>
              Upload Image (JPG, PNG) <Text style={{ color: "red" }}>*</Text>
            </Text>
            <View style={styles.imageRow}>
              <TouchableOpacity
                style={styles.uploadBox}
                onPress={() => {
                  setActiveImagePickerIndex(index);
                  setImageModalVisible(true);
                }}
              >
                <Ionicons name="camera" size={24} />
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {competitor.images.map((img, imgIdx) => (
                  <View key={imgIdx} style={styles.thumbWrap}>
                    <Image
                      source={{ uri: img.resizedUri || img.uri }}
                      style={styles.thumb}
                    />
                    <TouchableOpacity
                      style={styles.removeIcon}
                      onPress={() => removeImageFromCompetitor(index, imgIdx)}
                    >
                      <Ionicons name="close" size={14} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} statusBarTranslucent={false} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Add Competitors</Text>
            <TouchableOpacity
              onPress={() => {
                setCompetitors([]);
                onClose?.();
              }}
            >
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Competitors List */}
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <TouchableOpacity
              onPress={addNewCompetitor}
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 4,
                paddingHorizontal: 15,
                // borderWidth: 1.5,
                // borderStyle: 'dotted',
                // borderColor: '#1E3A8A',
                borderRadius: 12,
                // backgroundColor: '#EAF2FF',
              }}
            >
              <Ionicons name="add-circle" size={40} color="#1E3A8A" />
            </TouchableOpacity>

            {competitors.map((competitor, index) => renderCompetitorCard(competitor, index))}


            {/* <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={addNewCompetitor}
            >
              <Ionicons name="add-circle" size={20} color="#1E3A8A" />
              <Text style={styles.addMoreText}>Add Another Competitor</Text>
            </TouchableOpacity> */}
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footerBtn}>
            <TouchableOpacity onPress={handleSubmit} disabled={loading || competitors.length === 0}>
              <LinearGradient
                colors={loading || competitors.length === 0 ? ["#ccc", "#bbb"] : ["#1E3A8A", "#1E3A8A"]}
                style={styles.submitBtn}
              >
                <Text style={styles.submitText}>
                  Add Competitor
                  {/* Add {competitors.length} Competitor{competitors.length !== 1 ? 's' : ''} */}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={imageModalVisible}
        onClose={() => {
          setImageModalVisible(false);
          setActiveImagePickerIndex(null);
        }}
        onImageSelected={(imageObj) => {
          if (activeImagePickerIndex !== null && imageObj) {
            addImageToCompetitor(activeImagePickerIndex, imageObj);
          }
        }}
      />

      {/* Loader */}
      <LoaderOverlay visible={loading} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  container: { backgroundColor: "#fff", borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: height * 0.85, flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 0.5, borderColor: "#000" },
  headerText: { fontSize: 16, fontWeight: "600", color: "#000" },
  competitorCard: { marginBottom: 12, borderWidth: 1, borderColor: "#D9D2C3", borderRadius: 10, backgroundColor: "#FBF8F1", overflow: "hidden" },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#F1EADB" },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  competitorTitle: { fontSize: 14, fontWeight: "600", color: "#000", marginLeft: 8 },
  deleteBtn: { padding: 8 },
  accordionBody: { padding: 14, backgroundColor: "#fff" },
  label: { color: "#000", fontWeight: "400", marginBottom: 6, marginTop: 12, fontSize: 13 },
  input: { borderWidth: 1, borderColor: "#D9D2C3", padding: 10, borderRadius: 8, backgroundColor: "#fff", color: "#000000", fontWeight: "400", fontSize: 15, height: 40 },
  dropdown: { height: 42, paddingHorizontal: 12, backgroundColor: "#FBF8F1", borderColor: "#ccc", borderWidth: 1, borderRadius: 8, marginBottom: 10, marginTop: 4, color: "#000" },
  searchbox: { borderWidth: 0, backgroundColor: "transparent", fontSize: 14, paddingLeft: 4, borderBottomWidth: 0.2, borderColor: "gray", height: 42 },
  dropdownContainer: { borderRadius: 8, marginTop: -42, paddingVertical: 5 },
  placeholderDropdown: { color: "#7A7266", fontSize: 14 },
  valueDropdown: { color: "#1F1D1A", fontSize: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  imageRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  uploadBox: { width: 56, height: 56, borderWidth: 1, borderStyle: "dashed", borderColor: "#ccc", borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 10 },
  thumbWrap: { width: 56, height: 56, marginRight: 8, borderRadius: 8, overflow: "hidden", position: "relative", backgroundColor: "#F1EADB" },
  thumb: { width: "100%", height: "100%" },
  removeIcon: { position: "absolute", top: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", elevation: 3 },
  addMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, paddingVertical: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#1E3A8A", borderRadius: 8, backgroundColor: "#f0f7ff" },
  addMoreText: { color: "#1E3A8A", fontWeight: "600", fontSize: 14, marginLeft: 8 },
  footerBtn: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 15, backgroundColor: "#fff", borderTopWidth: 0.5, borderColor: "#D9D2C3" },
  submitBtn: { paddingVertical: 12, alignItems: "center", borderRadius: 8 },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});