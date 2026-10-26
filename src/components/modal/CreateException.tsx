import React, { useState, useEffect, useRef } from "react";
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
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from "react-native";
import Ionicons from "../Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { RootState } from '../../redux/store';
import { launchImageLibrary } from "react-native-image-picker";
import { Dropdown } from "react-native-element-dropdown";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { buildSyncFields, extractApiErrorMessage } from "../../utils/sync/syncStatus";
import ImageResizer from "react-native-image-resizer";
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch'; // if you want to call apiFetch here
import { isInternetAvailable } from '../../utils/networkUtils';
import RNFS from "react-native-fs";
import { resizeAndConvertImage } from '../../utils/helper/resizeAndConvertImage';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/slices/toastSlice';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
const { height } = Dimensions.get("window");
import ImagePickerModal from "./ImagePickerModal";
const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
import CTextInput from "../customUtilityComponents/CTextInput";


export default function CompetitorStockModal({
  visible,
  onClose,
  productTitle = "Balaji Crunchex Tadka Wafers",
  activeTab,
  lastUpdated = "22 Mar 25",
  onSubmit = (payload) => console.log("submit", payload),
  // optional: control sheet height with prop (0..1)
  heightPercent = 0.78,
}) {
  const dispatch = useDispatch()
  const { apiFetch } = useApiFetch()
  const [sellingPrice, setSellingPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [grammage, setGrammage] = useState("");
  const [images, setImages] = useState([]);

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('Open')
  const [product2List, setProduct2List] = useState([])
  const [selectedProduct, setSelectedProduct] = useState([])
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [users, setUsers] = useState([])
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const [imageModalVisible, setImageModalVisible] = useState(false);


  const resetForm = () => {
    setSellingPrice("");
    setMrp("");
    setGrammage("");
    setImages([]);
    setSelectedLocation("");      // string input
    setSelectedCategory(null);
    setSelectedIssue(null);
    setSelectedStatus('Open');
    setSelectedProduct(null);
    setRemarks("");
    setLoading(false);
  };

  // dummy option lists (label / value)
  const [locations, setLocations] = useState([
    { label: "Aisle 1 / Bay A", value: "aisle_1A" },
    { label: "Aisle 3 / Bay B / Top Shelf", value: "aisle_3B_top" },
    { label: "Fruits & Veg section", value: "fruits_veg" },
  ]);

  const [categories, setCategories] = useState([

  ]);

  const [status, setStatus] = useState([

  ]);

  const [issueTypes, setIssueTypes] = useState([

  ]);

  // compute sheet height in px
  const sheetHeight = Math.round(windowHeight * (heightPercent > 0 && heightPercent <= 1 ? heightPercent : 0.78));

  // internal visibility so we can animate out before unmount
  const [internalVisible, setInternalVisible] = useState(visible);

  const translateY = useRef(new Animated.Value(sheetHeight)).current;


  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await UniversalUpdateInsert({ ObjectName: 'Product2', Type: 'get' });
        const userdata = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });

        setUsers(userdata);

        // build product dropdown
        const dropdownData = Array.isArray(result) ? result.map((item) => ({
          label: item.Name,
          value: item.Sf_Id
        })) : [];
        setProduct2List(dropdownData);

        // --- load picklist data from AllDataPicklist row ---
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
          const issueTypesFromServer = Array.isArray(optionsObj.ExceptionIssueType)
            ? optionsObj.ExceptionIssueType.map(it => ({ label: it.label || it.value, value: it.value }))
            : [];

          const statusFromServer = Array.isArray(optionsObj.ExceptionStatus)
            ? optionsObj.ExceptionStatus.map(it => ({ label: it.label || it.value, value: it.value }))
            : [];

          const categoriesFromServer = Array.isArray(optionsObj.ExceptionCategories)
            ? optionsObj.ExceptionCategories.map(it => ({ label: it.label || it.value, value: it.value }))
            : [];

          setIssueTypes(issueTypesFromServer.length ? issueTypesFromServer : issueTypes); // fallback to existing state if empty
          setStatus(statusFromServer.length ? statusFromServer : status);
          setCategories(categoriesFromServer.length ? categoriesFromServer : categories);

          // also pull other useful values like record type ids if present
          // e.g. optionsObj.orderRecordTypeId, optionsObj.accountRecordTypeId
          const orderRecordTypeId = optionsObj.orderRecordTypeId || null;
          const accountRecordTypeId = optionsObj.accountRecordTypeId || null;
          // you can set them to state if you need them elsewhere, e.g.
          // setRecordTypeId(orderRecordTypeId);
          console.log('Picklist loaded: ', {
            orderRecordTypeId,
            accountRecordTypeId,
            issueCount: issueTypesFromServer.length,
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

  useEffect(() => {
    if (!internalVisible) {
      translateY.setValue(sheetHeight);
    }
  }, [sheetHeight, internalVisible, translateY]);


  useEffect(() => {
    if (visible) {
      resetForm();
      setInternalVisible(true);
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
  }, [visible, translateY, sheetHeight]);

  const openImagePicker = async () => {
    try {
      const options = { mediaType: "photo", quality: 0.7 };
      const res = await launchImageLibrary(options);
      if (res?.didCancel) return;
      if (res?.errorCode) return;
      if (res?.assets && res.assets.length) {
        setImages((prev) => {
          const existing = new Set(prev.map((p) => p.uri));
          const add = res.assets.filter((a) => a.uri && !existing.has(a.uri));
          return [...prev, ...add];
        });
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));


  const compressAndConvertImage = async (image, options = {}) => {
    // options: { maxWidth, maxHeight, compressFormat, quality }
    const opts = {
      maxWidth: options.maxWidth || 1024,
      maxHeight: options.maxHeight || 1024,
      compressFormat: options.compressFormat || "JPEG", // "JPEG" or "PNG" or "WEBP"
      quality: typeof options.quality === "number" ? options.quality : 80, // 0..100
    };

    try {
      if (!image || !image.uri) return null;

      // Some URIs returned by image picker are content:// or file://
      // ImageResizer expects a file path or uri; it usually works with file:// or content:// on Android.
      const resized = await ImageResizer.createResizedImage(
        image.uri,
        opts.maxWidth,
        opts.maxHeight,
        opts.compressFormat,
        opts.quality
      );
      // resized has { uri: string, name, size, path } depending on platform

      // get a file path acceptable to RNFS (strip file:// if present)
      let path = resized.uri || resized.path;
      if (!path) return null;
      if (path.startsWith("file://")) path = path.replace("file://", "");

      // read base64
      const base64 = await RNFS.readFile(path, "base64");

      // build result
      const fileName = resized.name || image.fileName || `img_${Date.now()}.jpg`;
      const mimeType =
        opts.compressFormat === "PNG" ? "image/png" : opts.compressFormat === "WEBP" ? "image/webp" : "image/jpeg";

      return {
        fileName,
        mimeType,
        base64, // string
        originalUri: image.uri,
        resizedUri: resized.uri || resized.path,
      };
    } catch (err) {
      console.warn("compressAndConvertImage failed:", err);
      return null;
    }
  };


  // ADD: iterate images[], compress+convert each
  const prepareImagesForPayload = async (imagesArr) => {
    if (!imagesArr || !imagesArr.length) return [];

    const outputs = [];
    // process sequentially to avoid spikes; you could parallelize with Promise.all if desired
    for (const img of imagesArr) {
      const processed = await compressAndConvertImage(img, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 70, // tune to match existing flow
        compressFormat: "JPEG",
      });

      if (processed) {
        outputs.push({
          fileName: processed.fileName,
          mimeType: processed.mimeType,
          base64: processed.base64,
        });
      } else {
        // fallback: still include entry with original uri (no base64)
        outputs.push({
          fileName: img.fileName || `img_${Date.now()}.jpg`,
          mimeType: img.type || "image/jpeg",
          base64: null,
          uri: img.uri,
        });
      }
    }

    return outputs;
  };

  const generateLocalSfId = () => {
    // format: local_<timestamp>_<random>
    return `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  };
  // ADD: collect modal fields and prepared images into a simple payload
  const buildSimplePayload = async () => {
    // convert/compress images
    const preparedImages = await prepareImagesForPayload(images); // uses component images state

    const payload = {
      // meta
      productTitle: productTitle,
      timestamp: new Date().toISOString(),
      lastUpdated: lastUpdated,


      location: selectedLocation,
      status: selectedStatus,
      category: selectedCategory,
      product: selectedProduct,
      issueType: selectedIssue,
      sellingPrice: sellingPrice,
      mrp: mrp,
      grammage: grammage,
      remarks: remarks,

      // images: each item contains base64 string (or null if conversion failed)
      images: preparedImages.map((it) => ({
        fileName: it.fileName,
        mimeType: it.mimeType,
        base64: it.base64, // big string
      })),
    };

    return payload;
  };



  //   
  const prepareImagesForRequest = async (imagesArr = [], fileNamePrefix = `img_${Date.now()}`) => {
    if (!imagesArr || !imagesArr.length) return [];

    const outputs = [];
    for (let i = 0; i < imagesArr.length; i++) {
      const img = imagesArr[i];
      try {
        // Use your resizing helper first (should return { base64, fileName?, mimeType? })
        const processed = await resizeAndConvertImage(img.uri || img);

        // determine extension
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



  const buildRequestWrapper = async (preparedImages = [], fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`) => {
    const firstImageBase64 = preparedImages.length ? preparedImages[0].base64 : null;
    const exceptionDate = new Date().toISOString().split("T")[0];

    const MERCHANDISER_SF_ID = users?.[0]?.Sf_Id || "";
    const RETAILER_SF_ID = selectedVisit?.AccountId || "";

    const requestWrapper = {
      category: activeTab === "Store" ? (selectedCategory || "") : null,
      ExceptionDate: exceptionDate,
      IssueType: selectedIssue || "",
      Location: selectedLocation || "",
      Merchandiser: MERCHANDISER_SF_ID,
      Product: activeTab === "Product" ? (selectedProduct || "") : null,
      Remarks: remarks || "",
      Retailer: RETAILER_SF_ID,
      Status: selectedStatus || "",
      Image: firstImageBase64 || "",       // base64 of first image (or empty)
      fileNamePrefix: fileNamePrefix,
      // optional: include meta array (server may ignore)
      ImagesMeta: preparedImages.map(p => ({ fileName: p.fileName, mimeType: p.mimeType })),
    };

    return requestWrapper;
  };



  const submitRequestOnline = async (preparedImages = [], fileNamePrefix = null) => {
    try {
      // Build wrapper using prepared images and prefix
      const wrapper = await buildRequestWrapper(preparedImages, fileNamePrefix);

      // API expects wrapper under requestWrapper? You used 'payload = wrapper' earlier — keep same if server expects that.
      const payload = wrapper;
      console.log("EXCEPTION PAYLOAD ->", payload);

      const response = await apiFetch('POST', 'createMtExceptions', payload, 'Custom');
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





  // MODIFY: replace saveExceptionLocally with this version
  const saveExceptionLocally = async (apiResult = { success: false }, preparedImages = [], fileNamePrefix = null) => {
    try {
      const apiSuccess = !!apiResult.success;
      const onlineRecordId = apiSuccess ? apiResult.recordId : null;
      const expName = apiSuccess ? apiResult.Name : null;

      // Sf_Id to store locally: real SF Id when online success otherwise local generated id
      const Sf_Id = apiSuccess ? onlineRecordId : generateLocalSfId();


      const publicUrl = apiResult.publicUrl || null;
      const firstBase64 = (preparedImages && preparedImages.length && preparedImages[0].base64) ? preparedImages[0].base64 : null;
      const firstUri = (images && images.length && images[0].uri) ? images[0].uri : null;

      const localPayload = {
        Sf_Id: Sf_Id,
        Name: expName ? expName : Sf_Id,
        Category__c: activeTab === "Store" ? (selectedCategory || "") : null,
        ExceptionDate__c: new Date().toISOString(),
        IssueType__c: selectedIssue || "",
        Location__c: selectedLocation || "",
        Merchandiser__c: users?.[0]?.Sf_Id || "",
        Product__c: activeTab === "Product" ? (selectedProduct || "") : null,
        Remarks__c: remarks || "",
        Retailer__c: selectedVisit?.AccountId || "",
        Status__c: selectedStatus || "",
        FileNamePrefix__c: fileNamePrefix || `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`,
        // sync metadata
        is_locally_changed: true,
        operation_type: "insert",
        last_modified: Date.now(),
        ...buildSyncFields({
          apiSuccess,
          attempted: !!apiResult.attempted,
          errorMsg: apiResult.errorMsg,
        }),
      };


      if (publicUrl) {
        localPayload.Image__c = publicUrl;       // main field (server public URL)
        localPayload.ImageUrl__c = publicUrl;    // keep both if you used ImageUrl__c elsewhere
      } else if (firstBase64) {
        localPayload.Image__c = firstBase64;     // store base64 in main field if no URL
        localPayload.ImageBase64__c = firstBase64;
      } else if (firstUri) {
        localPayload.Image__c = firstUri;        // fallback to local uri
        localPayload.ImageUri__c = firstUri;
      }

      // // Optionally store images meta
      // if (preparedImages && preparedImages.length) {
      //   localPayload.ImagesMeta__c = JSON.stringify(preparedImages.map(p => ({ fileName: p.fileName, mimeType: p.mimeType })));
      // }

      console.log("Saving localPayload:", localPayload);

      const inserted = await UniversalUpdateInsert({
        ObjectName: "MT_Exception__c", // keep your object name
        Type: "insert",
        data: localPayload,
      });

      console.log("Saved exception locally:", inserted, "Sf_Id:", Sf_Id);
      return { success: !!inserted, Sf_Id, apiSuccess };
    } catch (err) {
      console.error("saveExceptionLocally failed:", err);
      return { success: false };
    }
  };


  // MODIFY: replace handleSubmit with this executor
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // if (!selectedIssue) {
      //   console.warn("Please select Issue Type");
      //   setLoading(false);
      //   return;
      // }


      if (!selectedIssue || (typeof selectedIssue === 'string' && !selectedIssue.trim())) {
        dispatch(showToast({ message: 'Please select Issue Type.', type: 'warning' }));
        setLoading(false);
        return;
      }
      if (!selectedLocation || (typeof selectedLocation === 'string' && !selectedLocation.trim())) {
        dispatch(showToast({ message: 'Please enter location.', type: 'warning' }));
        setLoading(false);
        return;
      }
      if (!users || !users[0] || !users[0].Sf_Id) {
        dispatch(showToast({ message: 'Merchandiser not available. Please re-login or try again.', type: 'error' }));
        setLoading(false);
        return;
      }
      if (activeTab === 'Product') {
        if (!selectedProduct || (typeof selectedProduct === 'string' && !selectedProduct.trim())) {
          dispatch(showToast({ message: 'Please select Product.', type: 'warning' }));
          setLoading(false);
          return;
        }
      } else {
        if (!selectedCategory || (typeof selectedCategory === 'string' && !selectedCategory.trim())) {
          dispatch(showToast({ message: 'Please select Category.', type: 'warning' }));
          setLoading(false);
          return;
        }
      }
      if (!remarks || (typeof remarks === 'string' && !remarks.trim())) {
        dispatch(showToast({ message: 'Please enter Remarks.', type: 'warning' }));
        setLoading(false);
        return;
      }
      if (!selectedStatus || (typeof selectedStatus === 'string' && !selectedStatus.trim())) {
        dispatch(showToast({ message: 'Please select Status.', type: 'warning' }));
        setLoading(false);
        return;
      }
      if (!images || images.length === 0) {
        dispatch(showToast({ message: 'Please capture/attach at least one image.', type: 'warning' }));
        setLoading(false);
        return;
      }

      // define fileNamePrefix once for this submission
      const fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`;

      // 1) prepare images (compress, base64, and name them using prefix)
      const preparedImages = await prepareImagesForRequest(images, fileNamePrefix);
      // preparedImages => [{ fileName, mimeType, base64 }, ...]

      // 2) Try online submit if connected
      const connected = await isInternetAvailable();
      let apiResult = { success: false };

      if (connected) {
        apiResult = await submitRequestOnline(preparedImages, fileNamePrefix);
        if (!apiResult.success) {
          console.warn("API submit failed (or returned no recordId). Will save locally.");
        }
      } else {
        console.log("No connection — will save locally.");
      }

      // 3) Always save locally with the apiResult and preparedImages
      const saveResult = await saveExceptionLocally(apiResult, preparedImages, fileNamePrefix);

      if (saveResult.success) {
        // close modal and notify
        Animated.timing(translateY, {
          toValue: sheetHeight,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setInternalVisible(false);
            resetForm();
            onClose?.();
          }
        });

        console.log("Exception saved locally. apiSuccess=", apiResult.success);
        dispatch(showToast({ message: 'Exception saved successfully!', type: 'success' }));

      } else {
        dispatch(showToast({ message: 'Error saving Exception!', type: 'error' }));

        console.warn("Failed to save exception locally.");
      }
    } catch (err) {
      console.error("handleSubmit error:", err);
    } finally {
      setLoading(false);
    }
  };



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
    <Modal statusBarTranslucent={false} visible={internalVisible} transparent animationType="none" onRequestClose={handleRequestClose}>
      <TouchableWithoutFeedback onPress={handleRequestClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * 0.7, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Exception</Text>
          <TouchableOpacity onPress={handleRequestClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#444" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* <Text style={styles.title}>{productTitle}</Text> */}

          <View style={styles.rowSpace}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Location <Text style={{ color: "red" }}>*</Text></Text>
              <CTextInput
                style={[styles.dropdown]}
                value={selectedLocation}
                placeholder="Enter location"
                placeholderTextColor="#999"
                validationType="text"
                minValue={1}
                onChangeText={(text) => setSelectedLocation(text)}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>

              <Text style={styles.label}>Status <Text style={{ color: "red" }}>*</Text></Text>


              <Dropdown
                data={status}
                search
                searchPlaceholder="Search"
                disable={true}
                inputSearchStyle={{ fontSize: 10, borderRadius: 10, height: 40 }}
                labelField="label"
                itemTextStyle={{ fontSize: 12 }}
                valueField="value"
                placeholder="Select Status"
                value={selectedStatus}
                style={styles.dropdown}
                containerStyle={styles.dropdownContainer}
                selectedTextStyle={styles.selectedTextStyle}
                itemContainerStyle={{ marginVertical: -2 }}
                placeholderStyle={styles.placeholderStyle}
                onChange={(item) => setSelectedStatus(item.value)}
              />


            </View>
          </View>



          <View style={{ marginTop: 8 }}>
            {activeTab === 'Product' ? (
              <>
                <Text style={styles.label}>
                  Product <Text style={{ color: "red" }}>*</Text>
                </Text>
                <Dropdown
                  data={product2List}
                  search
                  labelField="label"
                  valueField="value"
                  placeholder="Select Product"
                  value={selectedProduct}
                  style={styles.dropdown}
                  containerStyle={styles.dropdownContainer}
                  selectedTextStyle={styles.selectedTextStyle}
                  placeholderStyle={styles.placeholderStyle}
                  onChange={(item) => setSelectedProduct(item.value)}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>
                  Category <Text style={{ color: "red" }}>*</Text>
                </Text>
                <Dropdown
                  data={categories}
                  search
                  labelField="label"
                  valueField="value"
                  placeholder="Select Category"
                  value={selectedCategory}
                  style={styles.dropdown}
                  containerStyle={styles.dropdownContainer}
                  selectedTextStyle={styles.selectedTextStyle}
                  placeholderStyle={styles.placeholderStyle}
                  onChange={(item) => setSelectedCategory(item.value)}
                />
              </>
            )}
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>
              Issue Type <Text style={{ color: "red" }}>*</Text>
            </Text>
            <Dropdown
              data={issueTypes}
              search
              labelField="label"
              valueField="value"
              placeholder="Select Issue"
              value={selectedIssue}
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              selectedTextStyle={styles.selectedTextStyle}
              placeholderStyle={styles.placeholderStyle}
              onChange={(item) => setSelectedIssue(item.value)}
            />
          </View>



          <Text style={[styles.label, { marginTop: 12 }]}>Remarks <Text style={{ color: "red" }}>*</Text></Text>

          <CTextInput
            style={[styles.textarea]}
            value={remarks}
            placeholder="Type here"
            placeholderTextColor="#999"
            validationType="text"
            // maxLengthAllowed={5}
            minValue={1}
            onChangeText={setRemarks}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Capture Image (JPG, PNG) <Text style={{ color: 'red' }}>*</Text></Text>

          <View style={styles.imageRow}>
            {
              images.length === 0 && (
                <TouchableOpacity style={styles.cameraBox} onPress={() => setImageModalVisible(true)} activeOpacity={0.8}>
                  <Ionicons name="camera" size={22} />
                </TouchableOpacity>
              )

            }
            {/* <TouchableOpacity style={styles.cameraBox} onPress={openImagePicker} activeOpacity={0.8}>
              <Ionicons name="camera" size={22} />
            </TouchableOpacity> */}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {images.length === 0 ? (
                <View style={styles.placeholderThumb}>
                  <Text style={{ fontSize: 12, color: '#888' }}>No image</Text>
                </View>
              ) : (
                images.map((it, idx) => (
                  <View key={(it.uri || it.fileName || idx).toString()} style={styles.thumbWrap}>
                    <Image source={{ uri: it.uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeIcon} onPress={() => removeImage(idx)}>
                      <Ionicons name="close" size={12} color="#ff5b5b" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* <Text style={styles.lastUpdated}>Last updated on {lastUpdated}</Text> */}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSubmit}
            style={{ width: '100%' }}
            disabled={false}
          >
            <LinearGradient
              colors={['#1E3A8A', '#1E3A8A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.submitBtn, loading ? { opacity: 0.6 } : {}]}
            >
              <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: .5,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '90%',
    borderBottomColor: 'gray',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1F1D1A', flex: 1 },
  closeBtn: { padding: 6 },
  content: { padding: 14, paddingBottom: 20 },
  title: { fontWeight: "500", marginTop: 6, marginBottom: 8, fontSize: 13, color: '#1F1D1A' },
  label: { color: '#000', fontSize: 13, marginBottom: 6 },
  dropdown: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: .5,
    borderRadius: 6,
    paddingHorizontal: 10,
    //width: 140,
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
  rowSpace: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  textarea: {
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 8,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#000',
  },
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
    backgroundColor: '#FBF8F1',
  },
  placeholderThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F1EADB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbWrap: {
    width: 56,
    height: 56,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1EADB',
  },
  thumb: { width: '100%', height: '100%' },
  removeIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  lastUpdated: { marginTop: 10, fontSize: 12, color: '#666' },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  submitBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  // add to your StyleSheet
  placeholderStyle: {
    color: "#999",
    fontSize: 14,
  },
  selectedTextStyle: {
    fontSize: 14,
    color: "#111",
  },
  iconStyle: {
    right: 10,
  },
});
