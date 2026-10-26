// AddCompetitorsModal.js
import React, { useEffect, useState } from "react";
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
    Platform,
    PermissionsAndroid,
    Alert
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Dropdown } from "react-native-element-dropdown";
import CTextInput from "../customUtilityComponents/CTextInput";

import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import ImagePickerModal from "./ImagePickerModal";
import moment from "moment";

import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { buildSyncFields, extractApiErrorMessage } from "../../utils/sync/syncStatus";
import { isInternetAvailable } from "../../utils/networkUtils";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../redux/store";
import { resizeAndConvertImage } from "../../utils/helper/resizeAndConvertImage";
import { showToast } from "../../redux/slices/toastSlice";
import LoaderOverlay from "../../utils/helper/LoaderOverlay";
import DatePicker from "react-native-date-picker";


const { height } = Dimensions.get("window");

export default function AddMTStockCheck({ visible, data, setProductIdHolder, onClose }) {

    const uomOptions = [
        { label: "Cases", value: "Cases" },
        { label: "Pcs", value: "Pcs" },
    ]
    const [imageModalVisible, setImageModalVisible] = useState(false);
    console.log("AddMTStockCheck data ->", data);
    const [category, setCategory] = useState("");
    const [sku, setSku] = useState(data?.id || "");
    const [quantity, setQuantity] = useState(""); // 🔹 Selling Price → Quantity
    const [uom, setUom] = useState('Pcs');
    const [facing, setFacing] = useState(null);
    const [date, setDate] = useState(new Date()); // 🔹 New Date field
    const [openDatePicker, setOpenDatePicker] = useState(false);
    const [images, setImages] = useState([]);
    const [activityTypes, setActivityTypes] = useState([]);
    const [subCategory, setSubCategory] = useState(null);
    const { apiFetch } = useApiFetch();
    let productTitle = "new title";
    const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
    const [users, setUsers] = useState([]);
    const [competitorMasterState, setCompetitorMasterState] = useState([]);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [productName, setProductName] = useState("");


    // const resetForm = () => {
    //     setCategory("");
    //     setSku("");
    //     setQuantity(null);
    //     setUom(null);
    //     setFacing(null);
    //     setSubCategory(null);
    //     setImages([]);
    //     setDate(new Date());
    // };

    const resetForm = () => {
        setCategory("");
        setSku("");
        setProductName("");
        setQuantity(null);
        // setUom(null);
        setFacing(null);
        setSubCategory(null);
        setImages([]);
        setDate(new Date());
    };


    const generateLocalSfId = () => {
        return `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
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

    const buildRequestWrapper = async (preparedImages = [], fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`) => {
        const firstImageBase64 = preparedImages.length ? preparedImages[0].base64 : null;
        const requestWrapper = {
            recordId: null,
            // Category: category,
            // OilType: subCategory,
            fileNamePrefix: fileNamePrefix,
            Account: selectedVisit?.AccountId || "",
            CheckedBy: users?.[0]?.Sf_Id || "",
            Quantity: quantity,
            ExpirationDate: date,
            ProductName: sku,
            Photo: firstImageBase64,
            UOM: uom,
            Facing: facing,

        };
        return requestWrapper;
    };

    const saveExceptionLocally = async (apiResult = { success: false }, preparedImages = [], fileNamePrefix = null) => {
        try {
            const apiSuccess = !!apiResult.success;
            const onlineRecordId = apiSuccess ? apiResult.recordId : null;
            const Sf_Id = apiSuccess ? onlineRecordId : generateLocalSfId();

            const publicUrl = apiResult.publicUrl || null;
            const firstBase64 = preparedImages?.[0]?.base64 || null;
            const firstUri = images?.[0]?.uri || null;

            const localPayload = {
                Sf_Id,
                // Oil_Type__c: subCategory,
                // Category__c: category,
                Account__c: selectedVisit?.AccountId || "",
                Checked_By__c: users?.[0]?.Sf_Id || "",
                Quantity__c: Number(quantity), // 🔹 Changed
                Expiration_Date__c: date.toISOString(), // 🔹 Added
                SKU__c: sku,
                Photo__c: publicUrl || firstBase64 || firstUri,
                UOM__c: uom,
                Facing__c: facing,
                CreatedDate: moment().utc().format("YYYY-MM-DDTHH:mm:ss.SSSZZ"),
                is_locally_changed: apiSuccess ? false : true,
                operation_type: "insert",
                last_modified: Date.now(),
                ...buildSyncFields({
                    apiSuccess,
                    attempted: !!apiResult.attempted,
                    errorMsg: apiResult.errorMsg,
                }),
            };

            const inserted = await UniversalUpdateInsert({
                ObjectName: "Stock_Check__c",
                Type: "insert",
                data: localPayload,
            });

            return { success: !!inserted, Sf_Id, apiSuccess };
        } catch (err) {
            console.error("Stock Check failed:", err);
            return { success: false };
        }
    };


    const submitRequestOnline = async (preparedImages = [], fileNamePrefix = null) => {
        try {
            const wrapper = await buildRequestWrapper(preparedImages, fileNamePrefix);
            const payload = wrapper;
            console.log("EXCEPTION PAYLOAD ->", payload);

            const response = await apiFetch('POST', 'createStockCheck', payload, 'Custom');
            console.log('RAW API RESPONSE ->', JSON.stringify(response));

            // parse possible shapes — handle multiple nesting shapes
            const responseBody =
                response?.data?.data?.responseBody ||
                response?.data?.responseBody ||
                response?.responseBody ||
                response?.data ||
                null;

            const recordId = responseBody?.recordId || null;
            const publicUrl = responseBody?.publicUrl || null;

            console.log("Parsed API result -> recordId:", recordId, "publicUrl:", publicUrl);

            const successFlag =

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

    const handleSubmit = async () => {
        try {
            // if (!category) {
            //     dispatch(showToast({ message: "Please select a category.", type: "error" }));
            //     return;
            // }
            // if (!subCategory) {
            //     dispatch(showToast({ message: "Please select sub category.", type: "error" }));
            //     return;
            // }
            if (!sku || sku.trim() === "") {
                dispatch(showToast({ message: "Please enter SKU.", type: "error" }));
                return;
            }
            if (!quantity) {
                dispatch(showToast({ message: "Please enter quantity.", type: "error" }));
                return;
            }
            console.log('uom .............', uom)
            if (!uom) {
                dispatch(showToast({ message: "Please enter UOM.", type: "error" }));
                return;
            }
            if (!facing) {
                dispatch(showToast({ message: "Please enter Facing.", type: "error" }));
                return;
            }
            if (images.length === 0) {
                dispatch(showToast({ message: "Please upload at least one image.", type: "error" }));
                return;
            }

            setLoading(true);
            const fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`;
            const preparedImages = await prepareImagesForRequest(images, fileNamePrefix);

            const connected = await isInternetAvailable();
            let apiResult = { success: false };

            if (connected) {
                apiResult = await submitRequestOnline(preparedImages, fileNamePrefix);
            }

            const saveResult = await saveExceptionLocally(apiResult, preparedImages, fileNamePrefix);

            if (saveResult.success) {
                setLoading(false);
                dispatch(showToast({ message: "Stock Check added successfully!", type: "success" }));
            } else {
                setLoading(false);
                dispatch(showToast({ message: "Error saving Stock Check!", type: "error" }));
            }


            console.log('SKU SET INTO PRODUCT HOLDER ......')
            setProductIdHolder(sku)

            resetForm();
            onClose?.();
        } catch (err) {
            console.log("submit error:", err);
            setLoading(false);
            onClose?.();
        }
    };



    const removeImage = async (index) => {
        try {
            const img = images[index];
            setImages(images.filter((_, i) => i !== index));
        } catch (err) {
            console.log("removeImage error:", err);
            setImages(images.filter((_, i) => i !== index));
        }
    };
    // const openImagePicker = async () => {
    //     try {
    //         const result = await launchImageLibrary({ mediaType: "photo" });
    //         if (!result || !result.assets || result.assets.length === 0) return;
    //         const asset = result.assets[0];
    //         const originalUri = asset.uri;
    //         const resized = await ImageResizer.createResizedImage(
    //             originalUri,
    //             800,
    //             800,
    //             "JPEG",
    //             80,
    //             0

    //         );
    //         const resizedPath = resized.path || resized.uri;

    //         const pathForRead =
    //             Platform.OS === "ios" && resizedPath.startsWith("file://")
    //                 ? resizedPath.replace("file://", "")
    //                 : resizedPath;

    //         const base64Data = await RNFS.readFile(pathForRead, "base64");
    //         const imageObj = {
    //             uri: originalUri, // original uri (for preview if you want)
    //             resizedUri: resized.uri || resizedPath, // resized file uri/path
    //             base64: base64Data, // base64 string (no data:image/... prefix)
    //             fileName: asset.fileName || `img_${Date.now()}.jpg`,
    //             type: asset.type || "image/jpeg",
    //             // size: resized.size
    //         };
    //         setImages([imageObj]);
    //     } catch (err) {
    //         console.log("Image pick/resize error:", err);
    //     }
    // };


    // --- common processor to avoid duplication ---
    const processAsset = async (asset) => {
        try {
            if (!asset?.uri) return;
            const originalUri = asset.uri;

            // resize same as before
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
                uri: originalUri, // original uri (for preview if you want)
                resizedUri: resized.uri || resizedPath, // resized file uri/path
                base64: base64Data, // base64 string (no data:image/... prefix)
                fileName: asset.fileName || `img_${Date.now()}.jpg`,
                type: asset.type || "image/jpeg",
            };

            // overwrite with single image (same behavior as before)
            setImages([imageObj]);
        } catch (err) {
            console.log("processAsset error:", err);
        }
    };

    // --- open camera (requests android runtime permission when needed) ---
    const openCamera = async () => {
        try {
            if (Platform.OS === "android") {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: "Camera Permission",
                        message: "This app needs access to your camera to take photos.",
                        buttonPositive: "OK",
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    dispatch(showToast({ message: "Camera permission denied", type: "error" }));
                    return;
                }
            }

            const result = await launchCamera({
                mediaType: "photo",
                saveToPhotos: true,
                selectionLimit: 1,
            });

            if (!result || !result.assets || result.assets.length === 0) return;
            await processAsset(result.assets[0]);
        } catch (err) {
            console.log("openCamera error:", err);
        }
    };

    // --- open library (replaces your previous inline launchImageLibrary) ---
    const openLibrary = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: "photo",
                selectionLimit: 1,
            });
            if (!result || !result.assets || result.assets.length === 0) return;
            await processAsset(result.assets[0]);
        } catch (err) {
            console.log("openLibrary error:", err);
        }
    };

    // --- chooser to present camera vs library to user ---
    const openImagePicker = () => {
        Alert.alert("Upload Image", "Choose image source", [
            { text: "Take Photo", onPress: openCamera },
            { text: "Choose from Library", onPress: openLibrary },
            { text: "Cancel", style: "cancel" },
        ]);
    };


    useEffect(() => {
        const initialize = async () => {
            // const competitorMaster = await UniversalUpdateInsert({ ObjectName: "CompetitorMaster__c", Type: "get" });
            // const optionMappingCompetitorMaster = competitorMaster.map((item) => {
            //     return { label: item.Name, value: item.Sf_Id };
            // });
            // setCompetitorMasterState(optionMappingCompetitorMaster);


            const usersData = await UniversalUpdateInsert({ ObjectName: "User", Type: "get" });
            setUsers(usersData);

            const AllPicklistData = await UniversalUpdateInsert({ ObjectName: "AllDataPicklist", Type: "get" });
            let optionsObj = null;

            if (Array.isArray(AllPicklistData) && AllPicklistData.length) {
                const raw = AllPicklistData[0]?.OptionsData;
                if (raw) {
                    try {
                        optionsObj = typeof raw === "string" ? JSON.parse(raw) : raw;
                    } catch {
                        optionsObj = null;
                    }
                }
            }

            if (optionsObj) {
                const StockCheckOilType = Array.isArray(optionsObj.StockCheckOilType)
                    ? optionsObj.StockCheckOilType.map((it) => ({ label: it.label || it.value, value: it.value }))
                    : [];
                setActivityTypes(Array.isArray(StockCheckOilType) ? StockCheckOilType : []);
                const StockCheckCategory = Array.isArray(optionsObj.StockCheckCategory)
                    ? optionsObj.StockCheckCategory.map((it) => ({ label: it.label || it.value, value: it.value }))
                    : [];
                setCompetitorMasterState(Array.isArray(StockCheckCategory) ? StockCheckCategory : []);
            }

        };
        initialize();
    }, []);

    useEffect(() => {
        if (visible && data) {
            // Programmatically set the form values from incoming `data`.
            // Convert to string and do NOT apply the same aggressive onChange filter (preserve characters).
            setSku(String(data.id ?? ""));
            setProductName(data.name ?? "");
            // optionally prefill other fields if product->stock mapping provides them:
            // setCategory(data?.raw?.product?.Category__c ?? data?.category ?? "");
            // setSubCategory(data?.subcategory ?? data?.raw?.product?.SubCategory__c ?? null);
            // setQuantity(data?.quantity ?? null);
            // setUom(data?.UOM ?? null);
            // setFacing(data?.Facing ?? null);
            // if there's an existing image URL on product, keep it as preview (you may choose to load it differently)
            // if (data?.raw?.product?.ProductImageURL__c) {
            //     setImages([{ uri: data.raw.product.ProductImageURL__c, resizedUri: data.raw.product.ProductImageURL__c }]);
            // }
        } else if (!visible) {
            // reset when modal closed (keeps form clean)
            resetForm();
        }
    }, [data, visible]);

    return (
        <Modal visible={visible} statusBarTranslucent={false} transparent animationType="slide">
            <View style={styles.backdrop}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerText}>Add Stock Check</Text>
                        <TouchableOpacity onPress={() => { resetForm(); onClose?.(); }}>
                            <Ionicons name="close" size={22} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16 }}>
                        <View style={styles.row}>
                            {/* <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.label}>
                                    Category <Text style={{ color: 'red' }}>*</Text>
                                </Text>
                                <Dropdown
                                    data={competitorMasterState ?? competitorMasterState}
                                    labelField="label"
                                    valueField="value"
                                    value={category}
                                    onChange={(item) => setCategory(item.value)}
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
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Sub Category <Text style={{ color: 'red' }}>*</Text></Text>
                                <Dropdown
                                    data={activityTypes}
                                    labelField="label"
                                    valueField="value"
                                    value={subCategory}
                                    onChange={(item) => setSubCategory(item.value)}
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    search
                                    searchPlaceholder="Search"
                                    itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                                />
                            </View> */}
                        </View>
                        <Text style={styles.label}>
                            SKU <Text style={{ color: 'red' }}>*</Text>
                        </Text>

                        {productName && sku ? (
                            <>
                                {/* visible, read-only product name */}
                                <View style={{ paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 10, backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#D9D2C3" }}>
                                    <Text style={styles.productNameText}>{productName}</Text>
                                    {/* small hint showing we save by id */}
                                    {/* <Text style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                                        (Saved by product id)
                                    </Text> */}
                                </View>

                                {/* keep sku state (id) but hide the input so user cannot edit id by accident */}
                                <TextInput
                                    value={sku ?? ""}
                                    onChangeText={(t) => setSku(t)}
                                    editable={false}
                                    style={{ height: 0, width: 0, opacity: 0 }}
                                    accessible={false}
                                    importantForAccessibility="no-hide-descendants"
                                />
                            </>
                        ) : (
                            // fallback: allow manual SKU entry
                            <TextInput
                                style={styles.input}
                                value={sku ?? ""}
                                placeholder="SKU"
                                onChangeText={(text) => {
                                    const filtered = text.replace(/[^a-zA-Z0-9]/g, '');
                                    setSku(filtered.slice(0, 24));
                                }}
                            />
                        )}


                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.label}>Quantity <Text style={{ color: 'red' }}>*</Text></Text>

                                <CTextInput
                                    style={styles.input}
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    validationType="numeric"
                                    minValue={1}
                                    maxLengthAllowed={5}
                                    placeholder="0"
                                // maxValue={100000}
                                />



                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>
                                    UOM <Text style={{ color: 'red' }}>*</Text>
                                </Text>

                                {/* <TextInput
                                    style={styles.input}
                                    value={uom}
                                    onChangeText={(text) => {
                                        // Keep only letters (remove numbers, spaces, symbols)
                                        const filtered = text.replace(/[^a-zA-Z]/g, '');

                                        setUom(filtered);
                                    }}
                                    placeholder="UOM"
                                /> */}

                                <Dropdown
                                    data={uomOptions}
                                    labelField="label"
                                    valueField="value"
                                    value={uom}
                                    onChange={(item) => setUom(item.value)}
                                    style={styles.dropdown}
                                    containerStyle={styles.dropdownContainer}
                                    inputSearchStyle={styles.searchbox}
                                    placeholderStyle={styles.placeholderDropdown}
                                    selectedTextStyle={styles.valueDropdown}
                                    search={false}   // ❗ No need for search because only 2 items
                                    placeholder="Select UOM"
                                    itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
                                />
                            </View>

                        </View>
                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.label}>Facing <Text style={{ color: 'red' }}>*</Text></Text>


                                <CTextInput
                                    style={styles.input}
                                    value={facing}
                                    onChangeText={setFacing}
                                    validationType="numeric"
                                    minValue={1}
                                    maxLengthAllowed={5}
                                    placeholder="0"
                                // maxValue={100000}
                                />

                            </View>
                            <View style={{ flex: 1 }}>
                                {/* 🔹 Date Field */}
                                <Text style={styles.label}>Expiration Date</Text>
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
                            date={date || new Date()}
                            mode="date"

                            //  Past dates disabled
                            minimumDate={new Date()}

                            // No upper limit (future ANY date allowed)
                            // remove maximumDate completely

                            onConfirm={(selectedDate) => {
                                setOpenDatePicker(false);

                                // normalize time (optional but recommended)
                                const normalizedDate = new Date(
                                    selectedDate.getFullYear(),
                                    selectedDate.getMonth(),
                                    selectedDate.getDate()
                                );

                                setDate(normalizedDate);
                            }}
                            onCancel={() => setOpenDatePicker(false)}
                        />


                        <Text style={[styles.label, { marginTop: 10 }]}>
                            Upload Image (JPG, PNG) <Text style={{ color: "red" }}>*</Text>
                        </Text>
                        <View style={styles.imageRow}>
                            <TouchableOpacity style={styles.uploadBox} onPress={() => setImageModalVisible(true)}>
                                <Ionicons name="camera" size={24} />
                            </TouchableOpacity>


                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {images.map((img, idx) => (
                                    <View key={idx} style={styles.thumbWrap}>
                                        <Image source={{ uri: img.resizedUri || img.uri }} style={styles.thumb} />
                                        <TouchableOpacity style={styles.removeIcon} onPress={() => removeImage(idx)}>
                                            <Ionicons name="close" size={14} color="red" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    </ScrollView>

                    {/* Submit */}
                    <TouchableOpacity onPress={handleSubmit}>
                        <LinearGradient colors={["#1E3A8A", "#1E3A8A"]} style={styles.submitBtn}>
                            <Text style={styles.submitText}>Add Stock Check</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
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
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    container: { backgroundColor: "#fff", borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: height * 0.9 },
    header: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 0.5, borderColor: "#000" },
    headerText: { fontSize: 16, fontWeight: "600", color: "#000" },
    label: { color: "#000", fontWeight: "400", marginBottom: 6, marginTop: 0, fontSize: 13 },
    input: {
        borderWidth: 1,
        borderColor: "#D9D2C3",
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#fff",
        color: "#000000",
        fontWeight: "400",
        fontSize: 15,
        height: 40,
    },
    dropdown: {
        height: 42,
        paddingHorizontal: 12,
        backgroundColor: "#FBF8F1",
        borderColor: "#ccc",
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 10,
        marginTop: 4,
        color: "#000",
    },
    searchbox: {
        borderWidth: 0,
        backgroundColor: "transparent",
        fontSize: 14,
        paddingLeft: 4,
        borderBottomWidth: 0.2,
        borderColor: "gray",
        height: 42,
    },
    dropdownContainer: { borderRadius: 8, marginTop: -42, paddingVertical: 5 },
    placeholderDropdown: { color: "#7A7266", fontSize: 14 },
    valueDropdown: { color: "#1F1D1A", fontSize: 14 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    imageRow: { flexDirection: "row", alignItems: "center", marginTop: 0 },
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
    submitBtn: { paddingVertical: 12, alignItems: "center", borderRadius: 8, margin: 15 },
    submitText: { color: "#fff", fontWeight: "600", fontSize: 15 },
    productNameText: {
        fontSize: 14,
        color: "#1F1D1A",
        fontWeight: "400",
    },
});
