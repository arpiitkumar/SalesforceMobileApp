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
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import { isInternetAvailable } from "../../utils/networkUtils";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../redux/store";
import { showToast } from "../../redux/slices/toastSlice";
import LoaderOverlay from "../../utils/helper/LoaderOverlay";
import DatePicker from "react-native-date-picker";

const { width, height: windowHeight } = Dimensions.get("window");

export default function MTStockCheckUpdate({ visible, onClose, data }) {
  const [quantity, setQuantity] = useState("");
  const [uom, setUom] = useState("");
  const [facing, setFacing] = useState("");
  const [images, setImages] = useState([]);
  const [internalVisible, setInternalVisible] = useState(visible);
  const [loading, setLoading] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const [date, setDate] = useState(new Date()); // 🔹 New Date field
  const [openDatePicker, setOpenDatePicker] = useState(false);

  const { apiFetch } = useApiFetch();
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const dispatch = useDispatch();

  const sheetHeight = useMemo(() => Math.round(windowHeight * 0.78), []);
  const translateYRef = useRef(new Animated.Value(sheetHeight));
  const translateY = translateYRef.current;

  // Set modal state from data
  useEffect(() => {
    if (visible && data) {
      setInternalVisible(true);
      setQuantity(String(data.raw.Quantity__c ?? ""));
      setUom(String(data.raw.UOM__c ?? ""));
      setFacing(String(data.raw.Facing__c ?? ""));
      setRecordId(data.raw.Sf_Id ?? null);
      setDate(data.raw.Expiration_Date__c ? new Date(data.raw.Expiration_Date__c) : new Date()); // 🔹 Initialize date field

      // Image handling: URL or base64
      const mappedImages = [];
      if (data.raw.Photo__c) {
        if (data.raw.Photo__c.startsWith("http")) {
          mappedImages.push({ uri: data.raw.Photo__c });
        } else if (data.raw.Photo__c.startsWith("data:")) {
          mappedImages.push({ base64: data.raw.Photo__c, fileName: `img_${Date.now()}.jpg` });
        }
      }
      setImages(mappedImages);
      setImageChanged(false);

      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (!visible) {
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setInternalVisible(false));
    }
  }, [visible, data, translateY, sheetHeight]);

  const compressAndConvertImage = async (image) => {
    try {
      if (!image || (!image.uri && !image.base64)) return null;
      if (image.base64) return image; // already base64

      const resized = await ImageResizer.createResizedImage(image.uri, 1024, 1024, "JPEG", 80);
      let path = resized.uri || resized.path;
      if (path.startsWith("file://")) path = path.replace("file://", "");
      const base64 = await RNFS.readFile(path, "base64");
      return { ...image, base64, resizedUri: resized.uri || resized.path };
    } catch {
      return null;
    }
  };

  const prepareImagesForRequest = async (imagesArr = []) => {
    if (!imagesArr.length) return [];
    const outputs = [];
    for (let i = 0; i < imagesArr.length; i++) {
      const img = imagesArr[i];
      const processed = await compressAndConvertImage(img);
      if (processed && processed.base64) {
        outputs.push({
          fileName: processed.fileName || `img_${Date.now()}_${i + 1}.jpg`,
          base64: processed.base64,
        });
      } else {
        outputs.push({ fileName: processed?.fileName || `img_${Date.now()}_${i + 1}.jpg`, base64: null });
      }
    }
    return outputs;
  };

  const openImagePicker = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: "photo" });
      if (!result?.assets?.length) return;
      const asset = result.assets[0];
      setImages([{ uri: asset.uri, fileName: asset.fileName, type: asset.type || "image/jpeg" }]);
      setImageChanged(true);
    } catch (err) {
      console.log("Image picker error:", err);
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageChanged(true);
  };

  const submitUpdateOnline = async (preparedImages = []) => {
    try {
      const payload = {
        recordId: recordId ?? null,
        Quantity: quantity ?? null,
        UOM: uom ?? null,
        Facing: facing ?? null,
        Photo:
          imageChanged && preparedImages.length && preparedImages[0].base64
            ? preparedImages[0].base64
            : null,
        fileName: imageChanged && preparedImages.length ? preparedImages[0].fileName : null,
      };
      const response = await apiFetch("POST", "createStockCheck", payload, "Custom");
      console.log('response form api ', response)
      const responseBody =
        response?.data?.responseBody ||
        response?.data?.date?.responseBody ||
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
    } catch {
      return { success: false };
    }
  };

  const saveUpdateLocally = async (apiResult = { success: false }, preparedImages = []) => {
    try {
      const Sf_Id = apiResult.success ? apiResult.recordId : recordId ?? recordId;
      const firstBase64 = preparedImages[0]?.base64 || null;
      let photoToSave = null;
      if (apiResult.success && apiResult.publicUrl) {
        photoToSave = apiResult.publicUrl;
      } else if (imageChanged && preparedImages[0]?.base64) {
        photoToSave = preparedImages[0].base64;
      } else if (data.raw.Photo__c) {
        photoToSave = data.raw.Photo__c;
      }
      const localPayload = {
        Sf_Id,
        Quantity__c: Number(quantity) || 0,
        UOM__c: uom,
        Facing__c: facing,
        Expiration_Date__c: String(date), // 🔹 Added
        Photo__c: photoToSave,
        is_locally_changed: true,
        operation_type: "insert",
        last_modified: Date.now(),
        is_synced: !!apiResult.success,
      };
      await UniversalUpdateInsert({ ObjectName: "Stock_Check__c", Type: "insert", data: localPayload });
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  const handleSubmit = async () => {
    if (!quantity || !uom || !facing) {
      dispatch(showToast({ message: "Please fill all required fields", type: "error" }));
      return;
    }

    setLoading(true);
    const preparedImages = await prepareImagesForRequest(images);
    const connected = await isInternetAvailable();

    let apiResult = { success: false };

    if (connected) {
      apiResult = await submitUpdateOnline(preparedImages);
      if (!apiResult.success) {
        console.warn("Update API submit failed (or returned no recordId). Will save locally.");
      }
    } else {
      console.log("No connection — will save update locally.");
    }

    const saveResult = await saveUpdateLocally(apiResult, preparedImages);

    setLoading(false);
    dispatch(showToast({ message: "Stock updated successfully!", type: "success" }));
    onClose?.();
  };

  const handleRequestClose = () => {
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && (setInternalVisible(false), onClose?.()));
  };

  if (!internalVisible) return null;

  return (
    <Modal visible={internalVisible} transparent statusBarTranslucent animationType="none" onRequestClose={handleRequestClose}>
      <TouchableWithoutFeedback onPress={handleRequestClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Stock Check Update</Text>
          <TouchableOpacity onPress={handleRequestClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#444" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#000", paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.title}>SKU: {data.raw.ProductName__c || "-"}</Text>
            <Text style={styles.title}>Category: {data.raw.Category__c || "-"}</Text>
            <Text style={styles.title}>Sub-Category: {data.raw.Oil_Type__c || "-"}</Text>
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={[styles.inlineField, { marginRight: 8 }]}>
              <Text style={styles.label}>Quantity <Text style={{ color: 'red' }}>*</Text></Text>
              <TextInput keyboardType="numeric" placeholder="0" style={styles.input} value={quantity} onChangeText={setQuantity} />
            </View>
            <View style={[styles.inlineField, { marginRight: 8 }]}>
              <Text style={styles.label}>UOM <Text style={{ color: 'red' }}>*</Text></Text>
              <TextInput placeholder="UOM" style={styles.input} value={uom} onChangeText={setUom} />
            </View>
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={[styles.inlineField, { marginRight: 8 }]}>
              <Text style={styles.label}>Facing <Text style={{ color: 'red' }}>*</Text></Text>
              <TextInput placeholder="Facing" style={styles.input} value={facing} onChangeText={setFacing} />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              {/* 🔹 Date Field */}
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setOpenDatePicker(true)}
              >
                <Text style={{ color: "#000" }}>
                  {date ? date.toLocaleDateString() : "Select Date"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>


          <DatePicker
            modal
            open={openDatePicker}
            date={date}
            mode="date"
            onConfirm={(selectedDate) => {
              setOpenDatePicker(false);
              setDate(selectedDate);
            }}
            onCancel={() => setOpenDatePicker(false)}
          />

          <View style={{ marginTop: 14 }}>
            <Text style={styles.label}>Upload Image</Text>
            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.cameraBox} onPress={openImagePicker}>
                <Ionicons name="image" size={24} />
              </TouchableOpacity>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingRight: 12 }}>
                {images.map((asset, idx) => (
                  <View key={(asset.uri || asset.fileName || idx).toString()} style={styles.thumbWrap}>
                    <Image source={{ uri: asset.resizedUri || asset.uri || asset.base64 }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeIcon} onPress={() => removeImage(idx)}>
                      <Ionicons name="close" size={14} color="#ff5b5b" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity activeOpacity={0.9} onPress={handleSubmit}>
          <LinearGradient colors={["#1E3A8A", "#1E3A8A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
            <Text style={styles.submitText}>Submit</Text>
          </LinearGradient>
        </TouchableOpacity>

        <LoaderOverlay visible={loading} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#fff', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 12 },
  header: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#000' },
  headerText: { fontWeight: '500', fontSize: 15, flex: 1, color: '#1F1D1A' },
  closeBtn: { padding: 6 },
  title: { fontWeight: '500', marginTop: 6, marginBottom: 8, fontSize: 12, color: '#1F1D1A' },
  row: { flexDirection: 'row' },
  inlineField: { flex: 1 },
  label: { color: '#000', fontWeight: '400', marginBottom: 6, fontSize: 13 },
  input: { borderWidth: 1, height: 40, borderColor: '#D9D2C3', padding: 10, borderRadius: 8, backgroundColor: '#fff', color: '#000000', fontWeight: '400', fontSize: 15 },
  imageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cameraBox: { width: 56, height: 56, borderWidth: 1, borderStyle: 'dashed', borderColor: '#ccc', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  thumbWrap: { width: 56, height: 56, marginRight: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', backgroundColor: '#F1EADB' },
  thumb: { width: '100%', height: '100%' },
  removeIcon: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2 },
  submitBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 8, margin: 12 },
  submitText: { color: '#fff', fontWeight: '600' },
});
