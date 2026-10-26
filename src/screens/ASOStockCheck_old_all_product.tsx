
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
  StatusBar
} from "react-native";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, Keyboard, Animated } from 'react-native';

import LinearGradient from "react-native-linear-gradient";
import Icon from "../components/AntDesign";
import FIcon from "@react-native-vector-icons/feather";
import HeaderMain from "../components/HeaderMain";
import { useFocusEffect } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { useSelector } from "react-redux";
import { RootState } from '../redux/store';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { isInternetAvailable } from '../utils/networkUtils';
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { useNavigation } from "@react-navigation/native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScrollView } from "react-native-gesture-handler";

import { getUserAccessibleSubCategories } from '../UtilityMain/producthelpers/userLineService.js';
import { getBeatAccountPricingInfo, getVerticalsFromIncoterm, getValidPricingRecords } from '../UtilityMain/producthelpers/pricingService';
import { getCGCloudUOMData, createUOMDataMap } from '../UtilityMain/producthelpers/productUOMService';
import { extractPricingValuesInline } from '../UtilityMain/producthelpers/productNormalizationService';
import DistributorModal from "../components/modal/DistributorModal";
import getOrderedCategories from '../UtilityMain/producthelpers/categoryPriorityService';


const StockCheckDetail = ({ fromset = null }) => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [RetailerAllData, setRetailerAllData] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [subCategories, setSubCategories] = useState(["All"]);
  const [selectedSubCategory, setSelectedSubCategory] = useState("All");

  const [sortAscending, setSortAscending] = useState(true);
  const { id: beatId, name: beatName } = useSelector((state) => state.beatSelection);
  const selectedBeatDay = useSelector((state: RootState) => state.selectedBeatDay.selectedBeatDay);
  const [currentBeatRecordState, setCurrentBeatRecordState] = useState(null);
  const { apiComposite } = useApiFetch();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const footerOpacity = useRef(new Animated.Value(1)).current;


  const [brands, setBrands] = useState(["All"]);
  const [selectedBrand, setSelectedBrand] = useState("All");

  //console.log('THIS IS SELECTED BEAT IN STOCK CHECK', beatId, beatName);
  //console.log('THIS IS SELECTED BEAT DAY IN STOCK CHECK', selectedBeatDay?.Sf_Id);

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
    Animated.timing(footerOpacity, {
      toValue: keyboardVisible ? 0 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [keyboardVisible, footerOpacity]);

  const generateRandomId = () => {
    const timestamp = Date.now(); // current time in ms
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
    return `ORD-${timestamp}-${randomSuffix}`;
  };




  const showToastvisible = (type, message) => {
    dispatch(showToast({
      message: message,
      type: type, // 'success' | 'error' | 'warning'
    }));
  };

  // --- replace old computeOldStock with this ---
  // --- replace existing computeOldStock with this ---
  const computeOldStock = (productSfId, stockCheckArray, selectedBeatDaySfId) => {
    // default return shape
    const empty = {
      Closing_Stock_Qty__c: 0,
      Closing_MT__c: 0,
      Closing_Value__c: 0,

    };

    if (!Array.isArray(stockCheckArray) || !productSfId) return empty;

    // filter records for this product + beat day
    const matches = stockCheckArray.filter(
      (s) => s.SKU__c === productSfId && s.Beat_Day__c === selectedBeatDaySfId
    );
    if (!matches.length) return empty;

    const parseStockDate = (d) => {
      if (!d) return new Date(0);
      const normalized = d.replace(/([+-]\d{2})(\d{2})$/, "$1:$2").replace(/\+0000$/, "Z");
      const parsed = new Date(normalized);
      return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    };

    // pick latest record by Stock_Check_Date__c
    let latest = matches[0];
    let latestDate = parseStockDate(latest.Stock_Check_Date__c);
    for (let i = 1; i < matches.length; i++) {
      const cur = matches[i];
      const curDate = parseStockDate(cur.Stock_Check_Date__c);
      if (curDate > latestDate) {
        latest = cur;
        latestDate = curDate;
      }
    }

    // normalize numeric fields
    const rawQty = latest.Closing_Stock_Qty__c;
    const rawMT = latest.Closing_MT__c;
    const rawVal = latest.Closing_Value__c;

    const qty = typeof rawQty === "number" ? rawQty : parseInt(rawQty || "0", 10);
    const mt = typeof rawMT === "number" ? rawMT : parseFloat(rawMT || "0");
    const val = typeof rawVal === "number" ? rawVal : parseFloat(rawVal || "0");

    return {
      Closing_Stock_Qty__c: isNaN(qty) ? 0 : qty,
      Closing_MT__c: isNaN(mt) ? 0 : mt,
      Closing_Value__c: isNaN(val) ? 0 : val,

    };
  };



  const computePrimaryInvoice = async (product, stockCheckArray, selectedBeatDaySfId, customerSfId) => {
    const empty = {
      InvoiceQuantityPcs__c: 0,
      Invoice_Quantity_In_Mt__c: 0,
      NetAmount__c: 0,
    };

    if (!Array.isArray(stockCheckArray) || !product?.Sf_Id || !selectedBeatDaySfId || !customerSfId) {
      console.log('returned from rhere............')
      return empty;
    }


    // 1. Filter stock check records for this product + beat day
    const stockMatches = stockCheckArray.filter(
      (s) => s.SKU__c === product.Sf_Id && s.Beat_Day__c === selectedBeatDaySfId
    );
    if (!stockMatches.length) return empty;
    // console.log('..................................dd', stockMatches)

    // 2. Find the latest Stock_Check_Date__c
    const parseDate = (d) => {
      if (!d) return new Date(0);
      const normalized = d.replace(/([+-]\d{2})(\d{2})$/, "$1:$2").replace(/\+0000$/, "Z");
      const parsed = new Date(normalized);
      return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    };

    let latest = stockMatches[0];
    let latestDate = parseDate(latest.Stock_Check_Date__c);
    for (let i = 1; i < stockMatches.length; i++) {
      const current = stockMatches[i];
      const curDate = parseDate(current.Stock_Check_Date__c);
      if (curDate > latestDate) {
        latest = current;
        latestDate = curDate;
      }
    }

    // console.log("Latest stock check date for product", product.Sf_Id, ":", latestDate);

    // 3. Fetch all invoices for the customer after latestDate
    let invoices = [];
    try {
      invoices = await UniversalUpdateInsert({
        ObjectName: "Invoice__c",
        Type: "get",
        filters: [
          { field: "Customer__c", value: customerSfId }

        ]
      });


      // invoices = invoices.filter((inv) => {
      //   const invDate = parseDate(inv.InvoiceDate__c);
      //   return invDate > latestDate;
      // });
      invoices = invoices.filter(inv => new Date(inv.InvoiceDate__c) > new Date(latestDate.toDateString()));

      // console.log('INVOICES :::::::', invoices)
    } catch (err) {
      console.warn("Error fetching invoices:", err);
      return empty;
    }

    // 4. Fetch invoice items for these invoices
    let invoiceItems = [];
    for (const invoice of invoices) {
      try {
        const items = await UniversalUpdateInsert({
          ObjectName: "Invoice_Item__c",
          Type: "get",
          filters: [{ field: "Invoice__c", value: invoice.Sf_Id }]
        });
        if (Array.isArray(items)) {
          invoiceItems.push(...items);
        }
        // console.log("Fetched", items.length, "items for invoice", items);
      } catch (err) {
        console.warn("Error fetching invoice items for invoice:", invoice.Sf_Id, err);
      }
    }

    // console.log("Invoice items fetched for product", product.Sf_Id, ":", invoiceItems);
    // 5. Filter items for this product
    const invoiceItemsForProduct = invoiceItems.filter(
      (item) => item.Product__c === product.Sf_Id
    );
    // console.log(invoiceItemsForProduct, "invoice items match product", product.Sf_Id);

    // 6. Sum relevant fields
    let totalInvoiceQtyPcs = 0;
    let totalInvoiceQtyMt = 0;
    let totalNetAmount = 0;

    for (const item of invoiceItemsForProduct) {
      const pcs = typeof item.InvoiceQuantityPcs__c === "number"
        ? item.InvoiceQuantityPcs__c
        : parseInt(item.InvoiceQuantityPcs__c || "0", 10);

      const mt = typeof item.Invoice_Quantity_In_Mt__c === "number"
        ? item.Invoice_Quantity_In_Mt__c
        : parseFloat(item.Invoice_Quantity_In_Mt__c || "0");

      const amt = typeof item.NetAmount__c === "number"
        ? item.NetAmount__c
        : parseFloat(item.NetAmount__c || "0");

      totalInvoiceQtyPcs += isNaN(pcs) ? 0 : pcs;
      totalInvoiceQtyMt += isNaN(mt) ? 0 : mt;
      totalNetAmount += isNaN(amt) ? 0 : amt;
    }

    return {
      InvoiceQuantityPcs__c: totalInvoiceQtyPcs,
      Invoice_Quantity_In_Mt__c: totalInvoiceQtyMt,
      NetAmount__c: totalNetAmount,
    };
  };


  const toInt = (v) => {
    if (typeof v === "number") return Math.trunc(v);
    const s = (v ?? "").toString().replace(/[^0-9.\-]/g, "");
    const n = parseInt(s || "0", 10);
    return isNaN(n) ? 0 : n;
  };

  const toFloat = (v) => {
    if (typeof v === "number") return v;
    const s = (v ?? "").toString().replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s || "0");
    return isNaN(n) ? 0 : n;
  };

  const createPayloadItem = (p, constants) => {
    const { ACCOUNT_SF_ID, CHECKED_BY_SF_ID, PERSONA, VISIT_DATE, STOCK_CHECK_DATETIME } = constants;

    const openingQty = toInt(p.OldClosing_Stock_Qty__c);
    const openingMT = toFloat(p.OldClosing_MT__c);
    const openingValue = toFloat(p.OldClosing_Value__c);

    const primaryQty = toInt(p.InvoiceQuantityPcs__c);
    const primaryMT = toFloat(p.Invoice_Quantity_In_Mt__c);
    const primaryValueFromProd = toFloat(p.NetAmount__c);

    const currentQty = toInt(p.quantity);
    const currentMT = (currentQty * toFloat(p.Weight_Per_Unit_in_KG__c)) / 1000 || 0;
    const currentValue = p.PTR__c ? currentQty * toFloat(p.PTR__c) : 0;

    const ptr = toFloat(p.PTR__c);
    const primaryValue = primaryValueFromProd || primaryQty * ptr || 0;

    const secondaryQty = p.OldClosing_Stock_Qty__c + p.InvoiceQuantityPcs__c - p.quantity;
    const secondaryMT = (secondaryQty * toFloat(p.Weight_Per_Unit_in_KG__c)) / 1000 || 0;
    const secondaryValue = p.PTR__c ? secondaryQty * toFloat(p.PTR__c) : 0;

    const closingQty = currentQty;
    const closingMT = currentMT;
    const closingValue = currentValue;

    const todaySecondaryQty = 0;
    const todaySecondaryMT = 0;
    const todaySecondaryValue = 0;

    return {
      Account__c: ACCOUNT_SF_ID,
      SKU__c: p.Sf_Id,
      Stock_Check_Date__c: STOCK_CHECK_DATETIME,
      Checked_By__c: CHECKED_BY_SF_ID,
      Persona__c: PERSONA,
      Visit_Date__c: VISIT_DATE,
      Beat_Day__c: selectedBeatDay?.Sf_Id || null,

      Opening_Stock_Qty__c: openingQty,
      Opening_MT__c: Number(openingMT.toFixed(6)),
      Opening_Value__c: Number(openingValue.toFixed(2)),

      Primary_Stock_Qty__c: primaryQty,
      Primary_MT__c: Number(primaryMT.toFixed(6)),
      Primary_Value__c: Number(primaryValue.toFixed(2)),

      Secondary_Stock_Qty__c: secondaryQty,
      Secondary_MT__c: Number(secondaryMT.toFixed(6)),
      Secondary_Value__c: Number(secondaryValue.toFixed(2)),

      Current_Stock_Qty__c: currentQty,
      Current_Stock_MT__c: Number(currentMT.toFixed(6)),
      Current_Stock_Value__c: Number(currentValue.toFixed(2)),

      Today_Secondary_Sales_Qty__c: todaySecondaryQty,
      Today_Secondary_Sales_MT__c: Number(todaySecondaryMT.toFixed(6)),
      Today_Secondary_Sales_Value__c: Number(todaySecondaryValue.toFixed(2)),

      Closing_Stock_Qty__c: closingQty,
      Closing_MT__c: Number(closingMT.toFixed(6)),
      Closing_Value__c: Number(closingValue.toFixed(2)),
    };
  };

  const createCompositeRequestItem = (p, index) => ({
    method: "POST",
    url: "/services/data/v61.0/sobjects/Stock_Check__c",
    referenceId: `newStock_Check_${index}`,
    body: { ...p }, // Directly pass entire payload item as body
  });

  const createOfflinePayloadItem = (p) => ({
    Sf_Id: generateRandomId(),
    ...p,
    is_locally_changed: true,
    SoftDelete: false,
    operation_type: "insert",
    last_modified: new Date().toISOString(),
    is_synced: false,
  });

  const chunkArray = (array, size = 25) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };


  const handleSave = () => {
    Alert.alert(
      "Confirm",
      "Do you want to save stock check?",
      [
        {
          text: "No",
          style: "cancel",
          onPress: () => {
            console.log("User cancelled");
            return;
          },
        },
        {
          text: "Yes",
          onPress: () => {
            handleSaveConfirmed(); // 👈 actual function call
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleSaveConfirmed = async () => {
    console.log(distributorId);

    setLoading(true);

    const constants = {
      ACCOUNT_SF_ID: distributorId,
      CHECKED_BY_SF_ID: users[0].Sf_Id,
      PERSONA: "ASO",
      VISIT_DATE: new Date().toISOString(),
      STOCK_CHECK_DATETIME: new Date().toISOString(),
    };

    const payload = products.map((p) => createPayloadItem(p, constants));
    // console.log("Prepared stock-check payload:", JSON.stringify(payload, null, 2));

    const connected = await isInternetAvailable();
    const offlinePayload = payload.map(createOfflinePayloadItem);

    // 🔹 helper: chunk payload into 25
    const chunkArray = (arr, size = 25) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    if (connected) {
      const payloadChunks = chunkArray(payload, 25);

      for (let chunkIndex = 0; chunkIndex < payloadChunks.length; chunkIndex++) {
        const chunk = payloadChunks[chunkIndex];

        const compositePayload = {
          allOrNone: true,
          compositeRequest: chunk.map((p, index) =>
            createCompositeRequestItem(p, chunkIndex * 25 + index)
          ),
        };

        // console.log(
        //   `Composite API Payload (Batch ${chunkIndex + 1}):`,
        //   JSON.stringify(compositePayload)
        // );

        const compositeResponse = await apiComposite(
          "POST",
          "composite",
          compositePayload
        );

        // console.log(
        //   `Composite API Response (Batch ${chunkIndex + 1}):`,
        //   JSON.stringify(compositeResponse)
        // );

        if (
          compositeResponse &&
          compositeResponse.data &&
          Array.isArray(compositeResponse.data.compositeResponse)
        ) {
          compositeResponse.data.compositeResponse.forEach((res, i) => {
            const globalIndex = chunkIndex * 25 + i;

            if (res.httpStatusCode >= 200 && res.httpStatusCode < 300) {
              offlinePayload[globalIndex].Sf_Id = res.body.id;
              offlinePayload[globalIndex].is_synced = true;
              offlinePayload[globalIndex].is_locally_changed = false;
            }
          });
        } else {
          console.error(
            "Invalid composite response in batch",
            chunkIndex + 1,
            compositeResponse
          );
        }
      }
    }

    // console.log("Final Offline Payloads:", JSON.stringify(offlinePayload));

    await UniversalUpdateInsert({
      ObjectName: "Stock_Check__c",
      Type: "insert",
      data: offlinePayload,
    });

    setLoading(false);
    showToastvisible("success", "Stock Check saved successfully");

    setTimeout(() => {
      navigation.goBack();
    }, 2000);
  };




  const distributorId = useSelector((state) => state.distributor.id);


  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const initialize = async () => {
        setLoading(true);
        try {

          const users = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",

          });

          console.log('users in stock check------------------------', users)

          if (Array.isArray(users) && users.length > 0) {
            setUsers(users)
          }



          const StockCheckData = await UniversalUpdateInsert({
            ObjectName: "Stock_Check__c",
            Type: "get",

          });

          const uomData = await getCGCloudUOMData();

          const SelectedBeatRecordArr = await UniversalUpdateInsert({
            ObjectName: "Beat__c",
            Type: "get",
            filters: [
              { field: 'Sf_Id', value: beatId }
            ]

          });

          const SelectedBeatRecord = Array.isArray(SelectedBeatRecordArr) && SelectedBeatRecordArr.length > 0
            ? SelectedBeatRecordArr[0]
            : null;


          setCurrentBeatRecordState(SelectedBeatRecord);
          const retailerdata = await UniversalUpdateInsert({
            ObjectName: "Account",
            Type: "get",
            filters: [
              { field: 'Sf_Id', value: distributorId }
            ]
          });

          // console.log("SelectedBeatRecord------------------Hello", JSON.stringify(retailerdata));
          setRetailerAllData(retailerdata)



          const loggedInUser = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get",

          })
          const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, distributorId);


          // const { beatRecord, incoternRecord } = await getBeatAccountPricingInfo(
          //   beatId,
          //   null,
          //   loggedInUser,
          //   distributorId
          // );
          // const verticalArray = getVerticalsFromIncoterm(incoternRecord);
          // const validPricingRecords = await getValidPricingRecords(incoternRecord, verticalArray);

          const Product2Data1 = await UniversalUpdateInsert({
            ObjectName: "Product2",
            Type: "get",
          });
          console.log('Total Products Fetched------------------------', accessibleSubCategories)

          let Product2Data = Product2Data1.filter((prod) => {
            if (accessibleSubCategories.length === 0) return false;
            return accessibleSubCategories.includes((prod.SubCategory__c || "").trim());
          })




          const Product2 = await Promise.all(
            Product2Data.map(async (product) => {
              // const matchedPricing = validPricingRecords.find(
              //   (rec) => rec.Fraction__c === product.Sf_Id
              // );
              const enrichedProduct = product;
              const { PTR, PTD } = await extractPricingValuesInline(
                distributorId,
                enrichedProduct
              );

              return {
                ...product,
                PTR__c: PTR != null ? String(PTR) : "",
                PTD__c: PTD != null ? String(PTD) : "",
              };
            })
          );

          console.log('Product2 in stock check------------------------', Product2)

          if (isActive && Array.isArray(Product2)) {
            setProducts(Product2.map((p) => ({ ...p, quantity: "" })));
          }

          const brandPriority = [
            "H&T Oils",
            "Mantra",
            "Advans",
            "Amritā"
          ];
          const fetchedBrands = [...new Set(Product2.map(p => p.Brand__c || "Others"))];
          // priority brands jo exist karte hain
          const orderedPriorityBrands = brandPriority.filter(b => fetchedBrands.includes(b));
          // jo remaining brands hain
          const remainingBrands = fetchedBrands.filter(b => !brandPriority.includes(b));
          // final brand order
          const uniqueBrands = [
            "All",
            ...orderedPriorityBrands,
            ...remainingBrands
          ];

          setBrands(uniqueBrands);

          const subCategories = Product2
            .map((item) => item.Category__c || "Unknown")
            .filter((value, index, self) => self.indexOf(value) === index);

          const orderedUniqueCategories = await getOrderedCategories(subCategories);

          setCategories(["All", ...orderedUniqueCategories]);


          const mapped = await Promise.all(
            Product2.map(async (p) => {
              const old = computeOldStock(p.Sf_Id, StockCheckData, selectedBeatDay?.Sf_Id);

              const uom = uomData.find(
                (u) => u.cgcloud__Product__c === p.Sf_Id
              );

              const primaryInvoice = await computePrimaryInvoice(
                p,
                StockCheckData,
                selectedBeatDay?.Sf_Id,
                distributorId
              );

              return {
                ...p,
                quantity: "",
                OldClosing_Stock_Qty__c: old.Closing_Stock_Qty__c ?? 0,
                OldClosing_MT__c: old.Closing_MT__c ?? 0,
                OldClosing_Value__c: old.Closing_Value__c ?? 0,
                Weight_Per_Unit_in_KG__c: uom ? uom.Weight_Per_Unit_in_KG__c : null,
                InvoiceQuantityPcs__c: primaryInvoice.InvoiceQuantityPcs__c ?? 0,
                Invoice_Quantity_In_Mt__c: primaryInvoice.Invoice_Quantity_In_Mt__c ?? 0,
                NetAmount__c: primaryInvoice.NetAmount__c ?? 0,
              };
            })
          );


          //console.log("Mapped Products with Old Stock and Invoice Qty::::::::::::::::::::", mapped);

          setProducts(mapped);
          setProducts(mapped);


        } catch (error) {
          console.error(" Get Account Data Failed:", error);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      initialize();
      return () => {
        isActive = false;
      };
    }, [distributorId])
  );

  useEffect(() => {

    setSelectedCategory("All");
    setSelectedSubCategory("All");

    const filteredByBrand =
      selectedBrand === "All"
        ? products
        : products.filter(p => p.Brand__c === selectedBrand);

    const uniqueCategories = [
      "All",
      ...new Set(filteredByBrand.map(p => p.Category__c || "Others"))
    ];

    setCategories(uniqueCategories);

  }, [selectedBrand]);

  useEffect(() => {

    if (selectedCategory === "All") {
      setSubCategories(["All"]);
      setSelectedSubCategory("All");
      return;
    }

    const subs = [
      "All",
      ...new Set(
        products
          .filter(p =>
            (selectedBrand === "All" || p.Brand__c === selectedBrand) &&
            p.Category__c === selectedCategory
          )
          .map(p => p.SubCategory__c || "Others")
      )
    ];

    setSubCategories(subs);
    setSelectedSubCategory("All");

  }, [selectedCategory, selectedBrand]);



  const handleQuantityChange = (sfId, value) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    const clampedValue =
      numericValue === "" ? "" : Math.min(parseInt(numericValue), 999999).toString();

    setProducts((prev) =>
      prev.map((p) =>
        p.Sf_Id === sfId ? { ...p, quantity: clampedValue } : p
      )
    );
  };

  const filteredProducts = products
    .filter((p) => {

      const matchesSearch =
        p.Name?.toLowerCase().includes(search.toLowerCase());

      const matchesBrand =
        selectedBrand === "All" ||
        p.Brand__c === selectedBrand;

      const matchesCategory =
        selectedCategory === "All" ||
        p.Category__c === selectedCategory;

      const matchesSubCategory =
        selectedSubCategory === "All" ||
        p.SubCategory__c === selectedSubCategory;

      return (
        matchesSearch &&
        matchesBrand &&
        matchesCategory &&
        matchesSubCategory
      );
    })
    .sort((a, b) => {
      const nameA = a.Name?.toLowerCase() || "";
      const nameB = b.Name?.toLowerCase() || "";
      return sortAscending
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });

  console.log('products', products?.length)

  const renderItem = ({ item }) => (
    <View style={styles.rowContainer}>
      <Image
        source={
          item?.ProductImageURL__c
            ? { uri: item.ProductImageURL__c }
            : require("../assets/images/food.png")
        }
        style={styles.image}
      />

      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.Name}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.label}>Opening Stock</Text>
            <Text style={styles.value}>{item.OldClosing_Stock_Qty__c}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.label}>Primary Inv Qty</Text>
            <Text style={styles.value}>{item.InvoiceQuantityPcs__c}</Text>
          </View>
          {/* <View style={styles.infoBlock}>
            <Text style={styles.label}>Current Qty</Text>
            <TextInput
              style={styles.quantityInput}
              value={item.quantity}
              onChangeText={(val) => handleQuantityChange(item.Sf_Id, val)}
              keyboardType="numeric"
              placeholder="0"
            />
          </View> */}
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.label}>Sec. Sales</Text>
            <Text style={styles.value}>{item.OldClosing_Stock_Qty__c + item.InvoiceQuantityPcs__c - item.quantity}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.label}>Current Qty</Text>
            <TextInput
              style={styles.quantityInput}
              value={item.quantity}
              onChangeText={(val) => handleQuantityChange(item.Sf_Id, val)}
              keyboardType="numeric"
              placeholder="0"
            />

          </View>



          {/* <View style={styles.infoBlock}>
            <Text style={styles.label}>Today Sec. Sales</Text>
            <Text style={styles.value}>0</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.label}>Closing Stock</Text>
            <Text style={styles.value}>
              {item.OldClosing_Stock_Qty__c + item.InvoiceQuantityPcs__c - item.quantity}
            </Text>
          </View> */}
        </View>
      </View>
    </View>
  );


  const [isStock, setIsStock] = useState(false);
  const stockCheck = async () => {
    try {
      const stockData = await UniversalUpdateInsert({
        ObjectName: "Stock_Check__c",
        Type: "get",
        filters: [
          { field: "Beat_Day__c", value: selectedBeatDay?.Sf_Id },
        ]
      });

      // console.log("STOCK DATA :::", JSON.stringify(selectedBeatDay?.Sf_Id));
      // console.log("STOCK DATA :::", JSON.stringify(stockData));

      if (stockData && stockData.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const hasTodayDate = stockData.some(item => {
          return item.Stock_Check_Date__c.startsWith(today);
        });

        return hasTodayDate;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Error in stockCheck:", e);
      return false;
    }
  };
  const getStockget = async () => {
    const isStockget = await stockCheck()
    setIsStock(isStockget)
  }
  getStockget();


  // console.log('helloe', {
  //     ACCOUNT_SF_ID: distributorId,
  //     CHECKED_BY_SF_ID: users[0]?.Sf_Id,
  //     PERSONA: "ASO",
  //     VISIT_DATE: new Date().toISOString(),
  //     STOCK_CHECK_DATETIME: new Date().toISOString(),
  //   })
  return (

    <SafeAreaProvider style={styles.safeArea}>
      <ScrollView>
        {
          fromset !== 'tab' && (
            <>
              <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
              <View style={styles.headerContainer}>
                <HeaderMain screenName="Stock Check" />
              </View>
            </>
          )
        }


        <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: fromset !== 'tab' ? 20 : 0, borderTopRightRadius: fromset !== 'tab' ? 20 : 0 }}>


          <View style={styles.mainContent}>
            <View style={{
              margin: 12,
              marginBottom: 0,
              marginTop: fromset !== 'tab' ? 12 : 0,
              borderRadius: 12,
              backgroundColor: '#ffffff',
              padding: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 3,
              alignSelf: 'stretch'
            }}>
              <Text style={{ fontSize: 13, color: '#666' }}>SUB DB :</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 6, color: '#111' }}>
                {RetailerAllData[0]?.Name ?? 'N/A'} <Text style={{ fontSize: 12 }}>{RetailerAllData[0]?.Party_Code__c ? '(#' + RetailerAllData[0]?.Party_Code__c + ')' : ''}</Text>
              </Text>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Icon name="search1" size={18} color="#888" />
                <TextInput
                  placeholder="Search"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                  placeholderTextColor="#888"
                />
              </View>

              <TouchableOpacity
                onPress={() => setSortAscending(!sortAscending)}
                style={styles.filterBtn}
                accessibilityLabel="Toggle sort order"
              >
                {/* filter icon */}
                <FIcon name="sliders" size={16} color="#444" />

                {/* visual sort indicator */}
                <FIcon
                  name={sortAscending ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={sortAscending ? "#1E3A8A" : "#888"}
                  style={styles.sortIcon}
                />
              </TouchableOpacity>
            </View>


            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {brands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  onPress={() => setSelectedBrand(brand)}
                  style={[
                    styles.categoryButton,
                    selectedBrand === brand &&
                    styles.categoryButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedBrand === brand &&
                      styles.categoryTextActive,
                    ]}
                  >
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>


            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category &&
                    styles.categoryButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category &&
                      styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>


            {subCategories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {subCategories.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubCategory(sub)}
                    style={[
                      styles.categoryButton,
                      selectedSubCategory === sub &&
                      styles.categoryButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedSubCategory === sub &&
                        styles.categoryTextActive,
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}


            <FlatList
              //removeClippedSubviews={true}
              keyboardShouldPersistTaps="always"
              extraData={products}
              data={filteredProducts}
              keyExtractor={(item) => item.Sf_Id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={{ paddingBottom: 260 }}
            />




          </View>

        </View>
        <LoaderOverlay visible={loading} />
      </ScrollView>
      <View
        style={[
          styles.footer,
          isStock && { opacity: 1 },
          keyboardVisible ? { opacity: 0 } : null // visually hide, but keep layout intact
        ]}
        pointerEvents={keyboardVisible ? 'none' : 'auto'} // make it non-interactive when hidden
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          disabled={isStock}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isStock ? ['#cccccc', '#aaaaaa'] : ["#C9A24D", "#A67C2E", "#C9A24D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.footerInner}
          >
            <Text style={styles.footerText}>Save</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>




    </SafeAreaProvider>
  );
};

export default StockCheckDetail;
const styles = StyleSheet.create({
  container: { flex: 1 },

  mainContent: { backgroundColor: "white", flex: 1, borderRadius: 26 },

  searchRow: { flexDirection: "row", alignItems: "center", margin: 15 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 6, color: "#000" },

  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginLeft: 10,
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#e6e9ef",
    // subtle elevation
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  sortIcon: {
    marginLeft: 8,
  },

  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 15,
    paddingBottom: 10,
    gap: 8,
  },
  categoryScroll: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingBottom: 10,
    gap: 8,
  },

  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderColor: "#1E3A8A",
    borderWidth: 1,
  },
  categoryButtonActive: {
    backgroundColor: "#1E3A8A",
  },
  categoryText: {
    fontSize: 13,
    color: "#1E3A8A",
    fontWeight: "500",
  },
  categoryTextActive: {
    color: "#fff",
  },

  rowContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    paddingTop: 20,
  },
  image: { width: 70, borderRadius: 10, marginRight: 12, resizeMode: 'contain', marginBottom: 20 },
  title: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#222" },
  headerContainer: { backgroundColor: '#A67C2E' },

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  infoBlock: { flex: 1 },
  label: { fontSize: 12, fontWeight: "500", color: "#888" },
  value: { fontSize: 12, fontWeight: "600", color: "#222", marginTop: 2 },

  quantityInput: {
    width: 60,
    fontSize: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    height: 25,
    marginTop: 2,
  },

  separator: { height: 1, backgroundColor: "#eee", marginTop: -10 },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 50,
    margin: 10,
    paddingHorizontal: 10,
  },
  footerInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  footerText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
});
