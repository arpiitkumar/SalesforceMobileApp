// AddCompetitorsModal.js
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
import { Platform } from "react-native"; // add if not already imported
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch'; // if you want to call apiFetch here
import { useSelector } from "react-redux";
import { RootState } from '../../redux/store';
import { resizeAndConvertImage } from '../../utils/helper/resizeAndConvertImage';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/slices/toastSlice';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import ImagePickerModal from "./ImagePickerModal";
import CTextInput from "../customUtilityComponents/CTextInput";
const { height } = Dimensions.get("window");

export default function AddPricingModal({ visible, onClose, productIdFromStockCheck = null, setBrandHolder, setSKUNameHolder }) {
  const [brand, setBrand] = useState("");
  const [grammageType, setGrammageType] = useState(null);
  console.log('producct id from stock check ', productIdFromStockCheck)
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [grammage, setGrammage] = useState("");
  const [activity, setActivity] = useState("Power Wing");
  const [remarks, setRemarks] = useState("");
  const [images, setImages] = useState([]);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const { apiFetch } = useApiFetch()
  //const [productTitle, setProductTitle] = useState('new title')
  let productTitle = 'new title'
  const selectedVisit = useSelector((state: RootState) => state.selectedVisit);
  const [users, setUsers] = useState([])
  const [competitorMasterState, setCompetitorMasterState] = useState([])
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [promotionTypes, setPromotionTypes] = useState([])
  const [categoryTypes, setCategoryTypes] = useState([])
  const [subCategoryTypes, setSubCategoryTypes] = useState([])
  const [selectedPromotion, setSelectedPromotion] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState(null)
  const [mrp, setMrp] = useState("")

  const [skuId, setSkuId] = useState(null);       // holds Product2 Sf_Id
  const [skuName, setSkuName] = useState('');     // holds Product name (display + payload)

  // new states for products & derived lists
  const [products, setProducts] = useState([]);                      // array of Product2 objects
  const [productCategories, setProductCategories] = useState([]);    // [{ label, value }]
  const [filteredSubCategories, setFilteredSubCategories] = useState([]); // subcats for selected category
  const [skusForSubCategory, setSkusForSubCategory] = useState([]);


  const MAX_ALLOWED = 100000;


  const handleNumericChange = (setter, fieldName) => (text) => {
    // allow only digits and dot
    let cleaned = text.replace(/[^0-9.]/g, '');

    // prevent more than one dot
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) return;

    // allow empty (user clearing input)
    if (cleaned === '') {
      setter('');
      return;
    }

    // allow typing ".", "0.", "12."
    if (
      cleaned === '.' ||
      cleaned.endsWith('.')
    ) {
      setter(cleaned);
      return;
    }

    const numericValue = Number(cleaned);

    // reject NaN
    if (Number.isNaN(numericValue)) return;

    // block zero or negative FINAL values
    if (numericValue <= 0) return;

    // max clamp
    if (numericValue > MAX_ALLOWED) {
      setter(String(MAX_ALLOWED));
      dispatch(showToast({
        message: `${fieldName} cannot exceed ${MAX_ALLOWED}`,
        type: 'error'
      }));
      return;
    }

    setter(cleaned);
  };



  const resetForm = () => {
    setBrand("");
    setSku("");
    setPrice("");
    setGrammage("");
    setActivity("Power Wing");

    setRemarks("");
    setImages([]);
  };

  const generateLocalSfId = () => {
    // format: local_<timestamp>_<random>
    return `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  };
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
      recordId: null,
      Activity: null,
      Competitor: brand,
      subCategory: selectedSubCategory,
      category: selectedCategory,
      fileNamePrefix: fileNamePrefix,
      Customer: selectedVisit?.AccountId || "",
      Merchandiser: users?.[0]?.Sf_Id || "",
      Type: 'Competitor Price',
      SellingPrice: price,
      Remarks: remarks,
      Promotion: selectedPromotion,
      ProductName: null,
      Product: skuId,
      Photo: firstImageBase64,
      MRP: mrp,
      GrammageBeforePromotion: grammage,
      Grammage: null,
      GrammageType: grammageType,



    };

    return requestWrapper;
  };


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

      // Read resized file as base64
      const base64Data = await RNFS.readFile(pathForRead, "base64");


      const imageObj = {
        uri: originalUri, // original uri (for preview if you want)
        resizedUri: resized.uri || resizedPath, // resized file uri/path
        base64: base64Data, // base64 string (no data:image/... prefix)
        fileName: asset.fileName || `img_${Date.now()}.jpg`,
        type: asset.type || "image/jpeg",
        // size: resized.size
      };


      setImages([imageObj]);
    } catch (err) {
      console.log("Image pick/resize error:", err);
    }
  };



  // MODIFY: replace saveExceptionLocally with this version
  const saveExceptionLocally = async (apiResult = { success: false }, preparedImages = [], fileNamePrefix = null) => {
    try {

      console.log('locally called......')
      const apiSuccess = !!apiResult.success;
      const onlineRecordId = apiSuccess ? apiResult.recordId : null;
      const expName = apiSuccess ? apiResult.Name : null;

      // Sf_Id to store locally: real SF Id when online success otherwise local generated id
      const Sf_Id = apiSuccess ? onlineRecordId : generateLocalSfId();


      const publicUrl = apiResult.publicUrl || null;
      const firstBase64 = (preparedImages && preparedImages.length && preparedImages[0].base64) ? preparedImages[0].base64 : null;
      const firstUri = (images && images.length && images[0].uri) ? images[0].uri : null;

      const localPayload = {

        Sf_Id,
        Activity__c: null,
        Competitor__c: brand,
        Sub_Category__c: selectedSubCategory,
        Category__c: selectedCategory,
        fileNamePrefix: fileNamePrefix,
        Customer__c: selectedVisit?.AccountId || "",
        Merchandiser__c: users?.[0]?.Sf_Id || "",
        Type__c: 'Competitor Price',
        Selling_Price__c: Number(price),
        Remarks__c: remarks,
        Promotion__c: selectedPromotion,
        Product__c: skuId,
        Photo__c: publicUrl || firstBase64,
        MRP__c: mrp,
        Grammage_Before_Promotion__c: grammage,
        Grammage__c: null,
        Grammage_Type__c: grammageType,



        is_locally_changed: true,
        operation_type: "insert",
        last_modified: Date.now(),
        is_synced: apiSuccess ? true : false,
      };


      if (publicUrl) {
        localPayload.Photo__c = publicUrl;
        localPayload.Photo__c = publicUrl;
      } else if (firstBase64) {
        localPayload.Photo__c = firstBase64;
        localPayload.Photo__c = firstBase64;
      } else if (firstUri) {
        localPayload.Photo__c = firstUri;
        localPayload.Photo__c = firstUri;
      }


      console.log("Saving localPayload:", localPayload);

      const inserted = await UniversalUpdateInsert({
        ObjectName: "Competitor_LineItem__c",
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


  const removeImage = async (index) => {
    try {
      const img = images[index];
      // Optionally delete the resized file from disk to save space:
      // const pathToDelete = img?.resizedUri?.startsWith("file://") ? img.resizedUri.replace("file://", "") : img?.resizedUri;
      // if (pathToDelete) { await RNFS.unlink(pathToDelete).catch(e => console.log('unlink err', e)); }

      setImages(images.filter((_, i) => i !== index));
    } catch (err) {
      console.log("removeImage error:", err);
      setImages(images.filter((_, i) => i !== index));
    }
  };



  const submitRequestOnline = async (preparedImages = [], fileNamePrefix = null) => {
    try {
      // Build wrapper using prepared images and prefix
      const wrapper = await buildRequestWrapper(preparedImages, fileNamePrefix);

      // API expects wrapper under requestWrapper? You used 'payload = wrapper' earlier — keep same if server expects that.
      const payload = wrapper;
      console.log("EXCEPTION PAYLOAD ->", payload);

      const response = await apiFetch('POST', 'createCompetitorLineItem', payload, 'Custom');
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

      return { success: !!successFlag, recordId, publicUrl, raw: response, Name: responseBody?.Name };
    } catch (err) {
      console.error("submitRequestOnline failed:", err);
      return { success: false, error: err };
    }
  };



  const handleSubmit = async () => {
    try {


      // if (!brand) {
      //   dispatch(showToast({ message: 'Please select a brand.', type: 'error' }));
      //   return;
      // }
      if (!selectedCategory) {
        dispatch(showToast({ message: 'Please select category.', type: 'error' }));
        return;
      }
      if (!selectedSubCategory) {
        dispatch(showToast({ message: 'Please select sub category.', type: 'error' }));
        return;
      }
      if (!skuId) {
        dispatch(showToast({ message: 'Please select SKU.', type: 'error' }));
        setLoading(false);
        return;
      }
      // if (!sku || sku.trim() === '') {
      //   dispatch(showToast({ message: 'Please enter SKU.', type: 'error' }));
      //   return;
      // }
      if (!price) {
        dispatch(showToast({ message: 'Please enter selling price.', type: 'error' }));
        return;
      }
      // if (!grammage) {
      //   dispatch(showToast({ message: 'Please enter grammage.', type: 'error' }));
      //   return;
      // }
      // if (!mrp) {
      //   dispatch(showToast({ message: 'Please enter MRP.', type: 'error' }));
      //   return;
      // }
      if (!selectedPromotion) {
        dispatch(showToast({ message: 'Please select promotion.', type: 'error' }));
        return;
      }
      if (!remarks) {
        dispatch(showToast({ message: 'Please enter remarks.', type: 'error' }));
        return;
      }

      if (images.length === 0) {
        dispatch(showToast({ message: 'Please upload at least one image.', type: 'error' }));
        return;
      }

      setLoading(true)
      // If we have images in state but they don't have base64 (edge-case),
      // process them now. Our openImagePicker already does it, so usually this is a no-op.
      const processed = await Promise.all(
        images.map(async (img) => {
          if (img.base64) return img;

          // If only original uri exists, resize + convert now
          const resized = await ImageResizer.createResizedImage(
            img.uri,
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
          return {
            ...img,
            resizedUri: resized.uri || resizedPath,
            base64: base64Data,
          };
        })
      );
      // define fileNamePrefix once for this submission
      const fileNamePrefix = `${productTitle.replace(/\s+/g, "_")}_${Date.now()}`;

      // 1) prepare images (compress, base64, and name them using prefix)
      const preparedImages = await prepareImagesForRequest(images, fileNamePrefix);


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

      console.log('this is new submit on api success.......................', apiResult)


      // 3) Always save locally with the apiResult and preparedImages
      const saveResult = await saveExceptionLocally(apiResult, preparedImages, fileNamePrefix);

      if (saveResult.success) {
        // close modal and notify
        // Animated.timing(translateY, {
        //   toValue: sheetHeight,
        //   duration: 220,
        //   easing: Easing.in(Easing.cubic),
        //   useNativeDriver: true,
        // }).start(({ f+shed }) => {
        //   if (finished) {
        //     setInternalVisible(false);
        //     resetForm();
        //     onClose?.();
        //   }
        // });

        console.log("Exception saved locally. apiSuccess=", apiResult.success);
        setLoading(false)
        dispatch(showToast({ message: 'Pricing added successfully!', type: 'success' }));

      } else {
        setLoading(false)
        dispatch(showToast({ message: 'Error saving competitor!', type: 'error' }));

        console.warn("Failed to save competitor locally.");
      }

      console.log('this is the brand after submission:::::', brand)
      setBrandHolder(brand)
      setSKUNameHolder(skuName)
      resetForm();
      // Pass the processed images (with base64) along with other form fields
      //onSubmit?.({ brand, sku, price, grammage, activity, remarks, images: processed });
      onClose?.();
    } catch (err) {
      console.log("submit error:", err);
      setLoading(false)
      // still attempt to send whatever we have without base64
      onSubmit?.({ brand, sku, price, grammage, activity, remarks, images });
      onClose?.();
    }
  };

  useEffect(() => {

    const initialize = async () => {


      const competitorMaster = await UniversalUpdateInsert({ ObjectName: 'CompetitorMaster__c', Type: 'get' });


      const optionMappingCompetitorMaster = competitorMaster.map((item) => {
        return {
          label: item.Name,
          value: item.Sf_Id
        }
      })

      setCompetitorMasterState(optionMappingCompetitorMaster)
      console.log('competitor master......', optionMappingCompetitorMaster)
      const usersData = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
      setUsers(usersData)

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

      // console.log('thisis picklist datatatat.............', JSON.stringify(optionsObj))



      // Defensive defaults if optionsObj missing
      // optionsObj.ExceptionIssueType  -> array of { value, label }
      // optionsObj.ExceptionStatus     -> array of { value, label }
      // optionsObj.ExceptionCategories -> array of { value, label }

      if (optionsObj) {
        // map arrays into { label, value }
        // const activityTypesFromServer = Array.isArray(optionsObj.ActivityType)
        //   ? optionsObj.ActivityType.map(it => ({ label: it.label || it.value, value: it.value }))
        //   : [];

        // console.log("ACTIVIT TYPES FROM THE SERVERLLLLLLLL............", activityTypesFromServer)

        const categoryTypesFromServer = Array.isArray(optionsObj.StockCheckCategory)
          ? optionsObj.StockCheckCategory.map(it => ({ label: it.label || it.value, value: it.value }))
          : [];

        console.log("category TYPES FROM THE SERVERLLLLLLLL............", categoryTypesFromServer)


        const promotionTypesFromServer = Array.isArray(optionsObj.PromotionType)
          ? optionsObj.PromotionType.map(it => ({ label: it.label || it.value, value: it.value }))
          : [];



        const subCategoryTypesFromServer = Array.isArray(optionsObj.CompetitorSubCategory)
          ? optionsObj.CompetitorSubCategory.map(it => ({ label: it.label || it.value, value: it.value }))
          : [];
        console.log(" SUB SUB category TYPES FROM THE SERVERLLLLLLLL............", subCategoryTypesFromServer)
        // console.log("sub category TYPES FROM THE SERVERLLLLLLLL............", activityTypesFromServer)
        // const activityTypesFromServer = Array.isArray(optionsObj.ActivityType)
        //   ? optionsObj.ActivityType.map(it => ({ label: it.label || it.value, value: it.value }))
        //   : [];

        // console.log("ACTIVIT TYPES FROM THE SERVERLLLLLLLL............", activityTypesFromServer)


        setPromotionTypes(Array.isArray(promotionTypesFromServer) ? promotionTypesFromServer : []);
        setSubCategoryTypes(Array.isArray(subCategoryTypesFromServer) ? subCategoryTypesFromServer : []);
        setCategoryTypes(Array.isArray(categoryTypesFromServer) ? categoryTypesFromServer : []);
        // also pull other useful values like record type ids if present
        // e.g. optionsObj.orderRecordTypeId, optionsObj.accountRecordTypeId
        const orderRecordTypeId = optionsObj.orderRecordTypeId || null;
        const accountRecordTypeId = optionsObj.accountRecordTypeId || null;
        // you can set them to state if you need them elsewhere, e.g.
        // setRecordTypeId(orderRecordTypeId);
        console.log('Picklist loaded: ', {
          orderRecordTypeId,
          accountRecordTypeId,
          //issueCount: issueTypesFromServer.length,
          //statusCount: statusFromServer.length,
        });


        //new code to get cat and subcat 


        // Load products and derive categories/subcategories
        try {
          const allProducts = await UniversalUpdateInsert({ ObjectName: 'Product2', Type: 'get' }) || [];
          // ensure structure: array of product objects
          setProducts(allProducts);

          // build unique categories from product records (use 'category' field name from schema)
          const categoriesSet = new Set();
          allProducts.forEach(p => {
            const cat = p?.Category__c || p?.category || p?.Category || null;
            if (cat) categoriesSet.add(String(cat));
          });

          const categoriesArr = Array.from(categoriesSet).map(cat => ({ label: cat, value: cat }));
          // optionally sort
          categoriesArr.sort((a, b) => a.label.localeCompare(b.label));
          setProductCategories(categoriesArr);

          // optionally pre-populate subcategories for initial selectedCategory (if any)
          if (selectedCategory) {
            const subcats = Array.from(new Set(
              allProducts
                .filter(p => (p?.Category__c || p?.category) === selectedCategory)
                .map(p => p?.SubCategory__c || p?.subCategory || p?.Sub_Category__c || null)
                .filter(Boolean)
            )).map(s => ({ label: s, value: s }));
            setFilteredSubCategories(subcats);
          }
        } catch (err) {
          console.warn('Failed to load products for dynamic category/subcategory/sku', err);
        }




      } else {
        // No server picklist — leave your existing defaults (already in state).
        console.log('AllDataPicklist not found or invalid, using local defaults.');
      }
    }

    initialize()

  }, [])

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);
  useEffect(() => {
    const autoPopulateFromProductId = async () => {
      if (!productIdFromStockCheck || !products.length) return;

      // Find the product by Sf_Id
      const product = products.find(p =>
        p.Sf_Id === productIdFromStockCheck ||
        p.sfId === productIdFromStockCheck ||
        p.Id === productIdFromStockCheck
      );

      if (!product) {
        console.warn('Product not found for id:', productIdFromStockCheck);
        return;
      }

      console.log('Auto-populating from product:', product);

      // Set SKU first (triggers cascading backfill)
      setSkuId(product.Sf_Id || product.sfId || product.Id);
      setSkuName(product.Name || product.name || product.Name__c || 'Unnamed');

      // Set category and sub-category
      const category = product.Category__c || product.category || product.Category;
      const subCategory = product.SubCategory__c || product.subCategory || product.Sub_Category__c;

      if (category) {
        setSelectedCategory(category);

        // Build and set subcategories for this category
        const subSet = new Set();
        products
          .filter(p => (p.Category__c || p.category || p.Category) === category)
          .forEach(p => {
            const sub = p.SubCategory__c || p.subCategory || p.Sub_Category__c;
            if (sub) subSet.add(String(sub));
          });
        const subs = Array.from(subSet).map(s => ({ label: s, value: s }));
        subs.sort((a, b) => a.label.localeCompare(b.label));
        setFilteredSubCategories(subs);
      }

      if (subCategory) {
        setSelectedSubCategory(subCategory);

        // Build SKUs for this category+subcategory (should include our product)
        const skusRaw = products
          .filter(p => {
            const cat = p.Category__c || p.category || p.Category;
            const sub = p.SubCategory__c || p.subCategory || p.Sub_Category__c;
            return cat === category && sub === subCategory;
          })
          .map(p => ({
            label: p.Name || p.name || p.Name__c || 'Unnamed',
            value: p.Sf_Id || p.sfId || p.Id,
          }))
          .filter(sku => !!sku.value);

        const uniqueMap = new Map();
        skusRaw.forEach(sku => {
          if (!uniqueMap.has(sku.value)) uniqueMap.set(sku.value, sku);
        });
        const skusArr = Array.from(uniqueMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );
        setSkusForSubCategory(skusArr);
      }
    };

    autoPopulateFromProductId();
  }, [productIdFromStockCheck, products]); // Re-run when productId changes or products load



  return (
    <Modal visible={visible} statusBarTranslucent={false} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Add Pricing</Text>
            <TouchableOpacity onPress={() => { resetForm(); onClose?.(); }}>
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Brand */}
            {/* <Text style={styles.label}>Brand <Text style={{ color: "red" }}>*</Text></Text>
            
            <Dropdown
              data={competitorMasterState ?? competitorMasterState}
              labelField="label"
              valueField="value"
              value={brand}
              onChange={(item) => setBrand(item.value)}
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              inputSearchStyle={styles.searchbox}
              placeholderStyle={styles.placeholderDropdown}
              selectedTextStyle={styles.valueDropdown}
              search
              searchPlaceholder="Search"
              itemContainerStyle={{ paddingVertical: 0, marginVertical: -5 }}
            /> */}

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Category <Text style={{ color: "red" }}>*</Text></Text>

                <Dropdown
                  data={productCategories}
                  labelField="label"
                  valueField="value"
                  value={selectedCategory}
                  onChange={(item) => {
                    setSelectedCategory(item.value);
                    setSelectedSubCategory(null);
                    // clear SKU because subcategory changed
                    setSkuId(null);
                    setSkuName('');

                    // derive subcategories for this category
                    const subs = Array.from(new Set(
                      products
                        .filter(p => (p?.Category__c || p?.category) === item.value)
                        .map(p => p?.SubCategory__c || p?.subCategory || p?.Sub_Category__c || null)
                        .filter(Boolean)
                    )).map(s => ({ label: s, value: s }));

                    // sort optional:
                    subs.sort((a, b) => a.label.localeCompare(b.label));
                    setFilteredSubCategories(subs);
                  }}
                  style={styles.dropdown}
                  containerStyle={styles.dropdownContainer}
                  inputSearchStyle={styles.searchbox}
                  placeholderStyle={styles.placeholderDropdown}
                  selectedTextStyle={styles.valueDropdown}
                  search
                  searchPlaceholder="Search category"
                />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Sub-Category <Text style={{ color: "red" }}>*</Text></Text>

                <Dropdown
                  data={filteredSubCategories}
                  labelField="label"
                  valueField="value"
                  value={selectedSubCategory}
                  onChange={(item) => {
                    setSelectedSubCategory(item.value);
                    // clear SKU selection when subcategory changes
                    setSkuId(null);
                    setSkuName('');

                    // build SKU list for this subcategory + selectedCategory
                    const skus = products
                      .filter(p => {
                        const cat = p?.Category__c || p?.category;
                        const sub = p?.SubCategory__c || p?.subCategory || p?.Sub_Category__c;
                        return cat === selectedCategory && sub === item.value;
                      })
                      .map(p => ({ label: p?.Name || p?.name || p?.Name__c || 'Unnamed', value: p?.Sf_Id || p?.sfId || p?.SfId || p?.Sf_Id }));

                    // unique & sort by label
                    const uniqueMap = new Map();
                    skus.forEach(s => {
                      if (s.value && !uniqueMap.has(s.value)) uniqueMap.set(s.value, s);
                    });
                    const skusArr = Array.from(uniqueMap.values()).sort((a, b) => a.label.localeCompare(b.label));

                    setSkusForSubCategory(skusArr);
                  }}
                  style={styles.dropdown}
                  containerStyle={styles.dropdownContainer}
                  inputSearchStyle={styles.searchbox}
                  placeholderStyle={styles.placeholderDropdown}
                  selectedTextStyle={styles.valueDropdown}
                  search
                  searchPlaceholder="Search sub-category"
                />
              </View>
            </View>


            {/* SKU */}
            {/* <Text style={styles.label}>SKU</Text> */}
            {/* <Dropdown
              data={[{ label: "Balaji Crunchex Tadka Wafers", value: "sku1" }]}
              labelField="label"
              valueField="value"
              value={sku}
              onChange={(item) => setSku(item.label)}
              style={styles.dropdown}
              placeholder="Select SKU"
            /> */}

            <Text style={styles.label}>SKU <Text style={{ color: "red" }}>*</Text></Text>

            <Dropdown
              data={skusForSubCategory}
              labelField="label"
              valueField="value"
              value={skuId}
              onChange={(item) => {
                // item: { label: productName, value: Sf_Id }
                setSkuId(item.value);
                setSkuName(item.label);
              }}
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              inputSearchStyle={styles.searchbox}
              placeholderStyle={styles.placeholderDropdown}
              selectedTextStyle={styles.valueDropdown}
              search
              searchPlaceholder="Search product"
            />


            {/* Selling Price + Grammage */}
            <View style={styles.row}>
              {/* Selling Price */}
              {/* MRP */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Selling Price <Text style={{ color: "red" }}>*</Text></Text>


                <CTextInput
                  style={styles.input}
                  value={price}
                  onChangeText={handleNumericChange(setPrice, 'Selling price')}
                  validationType="price"
                  minValue={0}
                  placeholder="₹ 0"
                  maxValue={100000}
                />

              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Promotion <Text style={{ color: "red" }}>*</Text></Text>


                <Dropdown
                  data={promotionTypes}
                  labelField="label"
                  valueField="value"
                  value={selectedPromotion}
                  onChange={(item) => setSelectedPromotion(item.value)}
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


            <View style={styles.row}>
              {/* <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>MRP <Text style={{ color: "red" }}>*</Text></Text>

                <CTextInput
                  style={styles.input}
                  value={mrp}
                  onChangeText={handleNumericChange(setMrp, 'MRP')}
                  validationType="price"
                  minValue={0}
                  placeholder="₹ 0"
                  maxValue={100000}
                />
              </View> */}

              {/* <View style={{ flex: 1 }}>
                <Text style={styles.label}>Grammage<Text style={{ fontSize: 10 }}> (Before promotion)</Text> <Text style={{ color: "red" }}>*</Text></Text>


                <CTextInput
                  style={styles.input}
                  value={grammage}
                  onChangeText={handleNumericChange(setGrammage, 'Grammage')}
                  validationType="price"
                  minValue={0}
                  placeholder="₹ 0"
                  maxValue={100000}
                />
              </View> */}


            </View>
            {/* Promotion */}


            {/* <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Grammage Type <Text style={{ color: "red" }}>*</Text></Text>


              <Dropdown
                data={
                  selectedCategory === 'Oils'
                    ? [
                      { label: 'KG', value: 'KG' },
                      { label: 'LTR', value: 'LTR' },
                      { label: 'ML', value: 'ML' },
                    ]
                    : [
                      { label: 'KG', value: 'KG' },
                      { label: 'GM', value: 'GM' },
                    ]
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
                placeholder="Select grammage type"
              />

            </View> */}

            {/* Remarks */}
            <Text style={styles.label}>Remarks <Text style={{ color: "red" }}>*</Text></Text>


            <CTextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={remarks}
              placeholder="Type here"

              validationType="text"
              // maxLengthAllowed={5}
              minValue={1}
              onChangeText={setRemarks}
            />

            {/* Image Upload */}
            <Text style={styles.label}>
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
                    <TouchableOpacity
                      style={styles.removeIcon}
                      onPress={() => removeImage(idx)}
                    >
                      <Ionicons name="close" size={14} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Submit */}
          <TouchableOpacity onPress={handleSubmit}>
            <LinearGradient
              colors={["#1E3A8A", "#1E3A8A"]}
              style={styles.submitBtn}
            >
              <Text style={styles.submitText}>Add Pricing</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: height * 0.7,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 0.5,
    borderColor: "#000",
  },
  headerText: { fontSize: 16, fontWeight: "600", color: "#000" },

  // --- Updated styles from CompetitorStockModal ---
  label: {
    color: "#000",
    fontWeight: "400",
    marginBottom: 2,
    marginTop: 8,
    fontSize: 13,
  },
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
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#FBF8F1',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
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
  // ----------------------------------------------

  row: { flexDirection: "row", justifyContent: "space-between" },
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
  submitBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 8, margin: 15 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

