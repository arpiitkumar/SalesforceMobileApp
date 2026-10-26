// CompetitorStockModal.updated.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { launchImageLibrary } from "react-native-image-picker";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { Dropdown } from "react-native-element-dropdown";

// --- Added imports from AddCompetitorsModal ---
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { useSelector, useDispatch } from "react-redux";
import { RootState } from '../../redux/store';
import { showToast } from '../../redux/slices/toastSlice';
import LoaderOverlay from '../../utils/helper/LoaderOverlay';
import ImagePickerModal from "./ImagePickerModal";
// -------------------------------------------------

const { width, height: windowHeight } = Dimensions.get("window");

export default function CompetitorStockModal({
  visible,
  onClose,
  productTitle = "Balaji Crunchex Tadka Wafers",
  brand = "Balaji Wafers Pvt. Ltd.",
  subCat = "Soya",
  lastUpdated = "22 Mar 25",
  onSubmit = (payload) => console.log("submit", payload),
  // new props to control height:
  heightPercent = 0.78,
  customHeight = undefined,
  useMaxHeight = false,

  // initial values (used to pre-fill fields when opening)
  initialSellingPrice = "",
  initialMrp = "",
  initialGrammage = "",
  initialImages = [], // array like [{ uri: '...' }] or [{ uri, base64, resizedUri, fileName, type }]
  initialActivity = "",
  initialRecordId = null, // <-- recordId for update (important)
}) {
  const [sellingPrice, setSellingPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [grammage, setGrammage] = useState("");
  const [images, setImages] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [activityTypes, setActivityTypes] = useState([]);
  const [internalVisible, setInternalVisible] = useState(visible);
  const [loading, setLoading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const { apiFetch } = useApiFetch();
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const dispatch = useDispatch();
  const [grammageType, setGrammageType] = useState('')

  // track whether user changed the image(s)
  const [imageChanged, setImageChanged] = useState(false);
  const [recordId, setRecordId] = useState(initialRecordId);


  // console.log('initial record IDIDIDIDIDID::::::::', initialRecordId)
  // compute sheetHeight (pixels) based on props
  const sheetHeight = useMemo(() => {
    if (typeof customHeight === "number" && customHeight > 0) return Math.round(customHeight);
    const pct = typeof heightPercent === "number" && heightPercent > 0 && heightPercent <= 1 ? heightPercent : 0.78;
    return Math.round(windowHeight * pct);
  }, [customHeight, heightPercent]);

  // Animated value - initialize with sheetHeight
  const translateYRef = useRef();
  if (!translateYRef.current) translateYRef.current = new Animated.Value(sheetHeight);
  const translateY = translateYRef.current;

  // Reset translateY start position when sheetHeight changes while closed
  useEffect(() => {
    if (!internalVisible) {
      translateY.setValue(sheetHeight);
    }
  }, [sheetHeight, internalVisible, translateY]);

  // sync internalVisible when parent toggles visible
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);

      // pre-fill values when opening
      setSellingPrice(String(initialSellingPrice ?? ""));
      setMrp(String(initialMrp ?? ""));
      setGrammage(String(initialGrammage ?? ""));
      setSelectedActivity(String(initialActivity ?? ""));
      setRecordId(initialRecordId ?? null);

      // normalize initialImages -> keep as objects with uri where possible
      try {
        const mapped = Array.isArray(initialImages)
          ? initialImages.map((it) => {
            // if already contains base64/resizedUri keep as-is, else normalize to { uri }
            if (!it) return null;
            if (typeof it === "string") return { uri: it };
            if (it.uri) return it;
            return it;
          }).filter(Boolean)
          : [];
        setImages(mapped);
        // since these are incoming original images, we set imageChanged = false
        setImageChanged(false);
      } catch (e) {
        setImages([]);
        setImageChanged(false);
      }

      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // animate down then hide
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setInternalVisible(false);
      });
    }
  }, [visible, translateY, sheetHeight, initialSellingPrice, initialMrp, initialGrammage, initialImages, initialActivity, initialRecordId]);

  // load picklists & similar (kept from your original initialize)
  useEffect(() => {
    const initialize = async () => {
      const competitorMaster = await UniversalUpdateInsert({ ObjectName: 'CompetitorMaster__c', Type: 'get' });

      const optionMappingCompetitorMaster = competitorMaster.map((item) => {
        return { label: item.Name, value: item.Sf_Id };
      });

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
        const activityTypesFromServer = Array.isArray(optionsObj.ActivityType)
          ? optionsObj.ActivityType.map((it) => ({ label: it.label || it.value, value: it.value }))
          : [];

        setActivityTypes(Array.isArray(activityTypesFromServer) ? activityTypesFromServer : []);
      }
    };

    initialize();
  }, []);

  // ------------------ IMAGE HELPERS (from AddCompetitorsModal) ------------------
  const compressAndConvertImage = async (image, options = {}) => {
    const opts = {
      maxWidth: options.maxWidth || 1024,
      maxHeight: options.maxHeight || 1024,
      compressFormat: options.compressFormat || "JPEG", // "JPEG" or "PNG" or "WEBP"
      quality: typeof options.quality === "number" ? options.quality : 80, // 0..100
    };

    try {
      if (!image || !image.uri) return null;

      const resized = await ImageResizer.createResizedImage(
        image.uri,
        opts.maxWidth,
        opts.maxHeight,
        opts.compressFormat,
        opts.quality
      );

      let path = resized.uri || resized.path;
      if (!path) return null;
      if (path.startsWith("file://")) path = path.replace("file://", "");

      const base64 = await RNFS.readFile(path, "base64");

      const fileName = resized.name || image.fileName || `img_${Date.now()}.jpg`;
      const mimeType =
        opts.compressFormat === "PNG" ? "image/png" : opts.compressFormat === "WEBP" ? "image/webp" : "image/jpeg";

      return {
        fileName,
        mimeType,
        base64,
        originalUri: image.uri,
        resizedUri: resized.uri || resized.path,
      };
    } catch (err) {
      console.warn("compressAndConvertImage failed:", err);
      return null;
    }
  };

  const prepareImagesForRequest = async (imagesArr = [], fileNamePrefix = `img_${Date.now()}`) => {
    if (!imagesArr || !imagesArr.length) return [];

    const outputs = [];
    for (let i = 0; i < imagesArr.length; i++) {
      const img = imagesArr[i];
      try {
        const processed = await compressAndConvertImage(img, {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 70,
          compressFormat: "JPEG",
        });

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
          // fallback read via RNFS
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
            console.warn("prepareImagesForRequest fallback failed for", img.uri, err);
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
  // ------------------------------------------------------------------------------

  // Replace previous simple openImagePicker with richer version (from add modal)
  const openImagePicker = async () => {
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

      // append (or replace existing) depending on your UI — AddCompetitors replaced. We'll replace to keep single image
      setImages([imageObj]);
      setImageChanged(true);
    } catch (err) {
      console.log("Image pick/resize error:", err);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageChanged(true);
  };

  // Submit update online (uses apiFetch like add modal)
  const submitUpdateOnline = async (preparedImages = [], fileNamePrefix = null) => {
    try {
      // Build update wrapper: only send the 3 fields + recordId. Photo only if imageChanged and preparedImages exist.
      const firstImageBase64 = preparedImages.length ? preparedImages[0].base64 : null;

      const wrapper = {
        recordId: recordId || null,
        Activity: selectedActivity || null,
        SellingPrice: sellingPrice || null,
        Grammage: grammage || null,
        Photo: imageChanged ? firstImageBase64 : null,
        // All other fields explicitly null (as requested)
        Competitor: null,
        subCategory: null,
        category: null,
        fileNamePrefix: fileNamePrefix,
        Customer: null,
        Merchandiser: null,
        Type: null,
        Remarks: null,
        Promotion: null,
        ProductName: null,
        MRP: null,
        GrammageBeforePromotion: null,
      };

      // Call update endpoint - keep parity with createCompetitorLineItem naming
      const response = await apiFetch('POST', 'createCompetitorLineItem', wrapper, 'Custom');


      console.log('response form api ', response)
      const responseBody =
        response?.data?.data?.responseBody ||
        response?.data?.responseBody ||
        response?.responseBody ||
        response?.data ||
        null;

      const recordIdResp = responseBody?.recordId || null;
      const publicUrl = responseBody?.publicUrl || null;

      const successFlag =
        (response?.status === 'success') ||
        (response?.data?.status === 'success') ||
        Boolean(recordIdResp) ||
        Boolean(publicUrl);

      return { success: !!successFlag, recordId: recordIdResp, publicUrl, raw: response, Name: responseBody?.Name };
    } catch (err) {
      console.error("submitUpdateOnline failed:", err);
      return { success: false, error: err };
    }
  };

  // Save/Update locally (UniversalUpdateInsert) - similar to saveExceptionLocally but update op
  const saveUpdateLocally = async (apiResult = { success: false }, preparedImages = [], fileNamePrefix = null) => {
    try {
      const apiSuccess = !!apiResult.success;
      const onlineRecordId = apiSuccess ? apiResult.recordId : null;
      const Sf_Id = onlineRecordId || (recordId ? recordId : `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`);

      const publicUrl = apiResult.publicUrl || null;
      const firstBase64 = (preparedImages && preparedImages.length && preparedImages[0].base64) ? preparedImages[0].base64 : null;
      const firstUri = (images && images.length && images[0].uri) ? images[0].uri : null;

      const localPayload = {
        Sf_Id,
        Activity__c: selectedActivity || null,

        fileNamePrefix: fileNamePrefix,

        Selling_Price__c: Number(sellingPrice) || 0,


        Grammage__c: grammage || null,

        is_locally_changed: true,
        operation_type: "insert",
        last_modified: Date.now(),
        is_synced: apiSuccess ? true : false,
      };



      // decide Photo__c: if online returned publicUrl, prefer that;
      // else if imageChanged and prepared image base64 exists -> use base64
      // else if initial image existed and not changed -> keep null (as requested)
      if (publicUrl) {
        localPayload.Photo__c = publicUrl;
      } else if (imageChanged && firstBase64) {
        localPayload.Photo__c = firstBase64;
      } else if (imageChanged && firstUri) {
        localPayload.Photo__c = firstUri;
      } else {
        // not changed => leave Photo__c null per your requirement
        localPayload.Photo__c = null;
      }

      // include record ID mapping if you have it in DB row key
      if (recordId) localPayload.Sf_Id = recordId;
      console.log('loacl payload???????????????????????????????', localPayload)
      const inserted = await UniversalUpdateInsert({
        ObjectName: "Competitor_LineItem__c",
        Type: "insert",
        data: localPayload,
      });

      return { success: !!inserted, Sf_Id, apiSuccess };
    } catch (err) {
      console.error("saveUpdateLocally failed:", err);
      return { success: false };
    }
  };

  // Main submit for update
  const handleSubmit = async () => {
    try {
      // Basic validation for the three fields (you can adjust messages as needed)
      if (!sellingPrice || sellingPrice.toString().trim() === "") {
        dispatch(showToast({ message: 'Please enter selling price.', type: 'error' }));
        return;
      }
      if (!grammage || grammage.toString().trim() === "") {
        dispatch(showToast({ message: 'Please enter grammage.', type: 'error' }));
        return;
      }
      if (!selectedActivity || selectedActivity.toString().trim() === "") {
        dispatch(showToast({ message: 'Please select activity.', type: 'error' }));
        return;
      }

      setLoading(true);

      // If imageChanged is true, ensure we have base64/resized versions for upload
      // If not changed, preparedImages will be [] and Photo sent as null
      const fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`;

      let preparedImages = [];

      if (imageChanged && images && images.length) {
        // ensure each image has base64: if the image already has base64 (openImagePicker produced it), okay;
        // else convert using compressAndConvertImage
        const processed = await Promise.all(
          images.map(async (img) => {
            if (img.base64) return img;
            const conv = await compressAndConvertImage(img, {
              maxWidth: 800,
              maxHeight: 800,
              quality: 80,
              compressFormat: "JPEG",
            });
            if (conv && conv.base64) return { ...img, base64: conv.base64, resizedUri: conv.resizedUri, fileName: conv.fileName, type: conv.mimeType };
            return img;
          })
        );

        preparedImages = await prepareImagesForRequest(processed, fileNamePrefix);
      }

      const connected = await isInternetAvailable();
      let apiResult = { success: false };

      if (connected) {
        apiResult = await submitUpdateOnline(preparedImages, fileNamePrefix);
        if (!apiResult.success) {
          console.warn("Update API submit failed (or returned no recordId). Will save locally.");
        }
      } else {
        console.log("No connection — will save update locally.");
      }

      const saveResult = await saveUpdateLocally(apiResult, preparedImages, fileNamePrefix);

      if (saveResult.success) {
        dispatch(showToast({ message: 'Competitor updated successfully!', type: 'success' }));
      } else {
        dispatch(showToast({ message: 'Error saving update locally!', type: 'error' }));
        console.warn("Failed to save update locally.");
      }

      setLoading(false);
      // call parent handlers
      onSubmit?.({
        sellingPrice,
        grammage,
        activity: selectedActivity,
        images: imageChanged ? images : null,
        recordId: recordId,
      });
      onClose?.();
    } catch (err) {
      console.error("handleSubmit error:", err);
      setLoading(false);
      dispatch(showToast({ message: 'Unexpected error during update', type: 'error' }));
    }
  };

  // user pressed on backdrop => animate out then call onClose
  const handleRequestClose = () => {
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setInternalVisible(false);
        onClose?.();
      }
    });
  };

  if (!internalVisible) return null;

  return (
    <Modal visible={internalVisible} statusBarTranslucent={false} transparent animationType="none" onRequestClose={handleRequestClose}>
      <TouchableWithoutFeedback onPress={handleRequestClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>Competitors Update</Text>
          <TouchableOpacity onPress={handleRequestClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#444" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.title}>SKU: {productTitle}</Text>

          {/* Prices */}
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={[styles.inlineField, { marginRight: 8 }]}>
              <Text style={styles.label}>Selling Price <Text style={{ color: "red" }}>*</Text></Text>
              <TextInput
                keyboardType="numeric"
                placeholder="₹ 0"
                style={styles.input}
                value={sellingPrice}
                onChangeText={(text) => {
                  // allow numbers with optional decimal
                  if (/^\d*\.?\d*$/.test(text)) {
                    setSellingPrice(text);
                  }
                }}
              />

            </View>
            {/* Grammage */}
            <View style={[styles.inlineField, { marginRight: 8 }]}>
              <Text style={styles.label}>Grammage <Text style={{ color: "red" }}>*</Text></Text>
              <TextInput
                keyboardType="numeric"
                placeholder="Grammage Here"
                style={[styles.input, { width: '100%' }]}
                value={grammage}
                onChangeText={(text) => {
                  if (/^\d*\.?\d*$/.test(text)) {
                    setGrammage(text);
                  }
                }}
              />

            </View>
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={[styles.inlineField, { marginRight: 8 }]}>

              {/* Activity */}
              <Text style={styles.label}>Activity <Text style={{ color: "red" }}>*</Text></Text>
              <Dropdown
                data={activityTypes}
                labelField="label"
                valueField="value"
                value={selectedActivity}
                onChange={(item) => setSelectedActivity(item.value)}
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                inputSearchStyle={styles.searchbox}
                placeholderStyle={styles.placeholderDropdown}
                selectedTextStyle={styles.valueDropdown}
                search
                searchPlaceholder="Search"
                itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
              />
            </View>
            <View style={[styles.inlineField, { marginRight: 8 }]}>
              <Text style={styles.label}>Grammage Type <Text style={{ color: "red" }}>*</Text></Text>
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
              />
            </View>
          </View>

          {/* Image uploader */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.label}>
              Upload Image (JPG, PNG) <Text style={{ color: 'red' }}>*</Text>
            </Text>

            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.cameraBox} onPress={() => setImageModalVisible(true)} activeOpacity={0.7}>
                <Ionicons name="image" size={24} />
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbScroll}>
                {images.map((asset, idx) => (
                  <View key={(asset.uri || asset.fileName || idx).toString()} style={styles.thumbWrap}>
                    <Image source={{ uri: asset.resizedUri || asset.uri }} style={styles.thumb} resizeMode="cover" />
                    {/* <TouchableOpacity style={styles.removeIcon} onPress={() => removeImage(idx)}>
                      <Ionicons name="close" size={14} color="#ff5b5b" />
                    </TouchableOpacity> */}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        <View>
          <TouchableOpacity activeOpacity={0.9} onPress={handleSubmit}>
            <LinearGradient colors={["#1E3A8A", "#1E3A8A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
              <Text style={styles.submitText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ImagePickerModal
          visible={imageModalVisible}
          onClose={() => setImageModalVisible(false)}
          onImageSelected={(imageObj) => {
            if (imageObj) {
              // you used to set single image array: setImages([imageObj])
              setImages([imageObj]);
            }
          }}
        />
        <LoaderOverlay visible={loading} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
  },
  headerText: { fontWeight: '500', fontSize: 15, flex: 1, color: '#1F1D1A' },
  closeBtn: { padding: 6 },
  title: { fontWeight: '500', marginTop: 6, marginBottom: 8, fontSize: 13, color: '#1F1D1A' },
  row: { flexDirection: 'row' },
  fieldColumn: { flex: 1, paddingRight: 8 },
  label: { color: '#000', fontWeight: '400', marginBottom: 6, fontSize: 13 },
  inlineField: { flex: 1 },
  input: { borderWidth: 1, height: 40, borderColor: '#D9D2C3', padding: 10, borderRadius: 8, backgroundColor: '#fff', color: '#000000', fontWeight: '400', fontSize: 15 },

  imageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cameraBox: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  thumbScroll: { alignItems: 'center', paddingRight: 12 },
  thumbWrap: {
    width: 56,
    height: 56,
    marginRight: 8,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1EADB',
  },
  thumb: { width: '100%', height: '100%' },
  removeIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  dropdown: {
    height: 42,
    paddingHorizontal: 12,
    backgroundColor: '#FBF8F1',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 4,
    color: '#000',
  },
  searchbox: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 14,
    paddingLeft: 4,
    borderBottomWidth: 0.2,
    borderColor: 'gray',
    height: 42,
  },
  dropdownContainer: {
    borderRadius: 8,
    marginTop: -42,
    paddingVertical: 5,
  },
  placeholderDropdown: {
    color: '#7A7266',
    fontSize: 14,
  },
  valueDropdown: {
    color: '#1F1D1A',
    fontSize: 14,
  },

  lastUpdated: { marginTop: 10, fontSize: 12, color: '#666', paddingLeft: 16 },
  submitBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 8, margin: 12 },
  submitText: { color: '#fff', fontWeight: '600' },
});
