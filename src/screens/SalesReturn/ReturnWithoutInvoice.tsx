import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  Modal,
} from "react-native";
import Ionicons from "../../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../../assets/css/MasterCss.js";
import Plus from "../../assets/images/Plus.svg";
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert'
import { useDispatch } from "react-redux";
import { isInternetAvailable } from '../../utils/networkUtils';
import { useApiFetch } from '../../utils/apiFetchHooks/useApiFetch';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { showToast } from '../../redux/slices/toastSlice';
import { PriceBookId_var } from '../../../config'
import { Dropdown } from 'react-native-element-dropdown';
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import { getUserAccessibleSubCategories } from '../../UtilityMain/producthelpers/userLineService.js';
import { getBeatAccountPricingInfo, getVerticalsFromIncoterm, getValidPricingRecords } from '../../UtilityMain/producthelpers/pricingService';
import { extractPricingValuesInline } from '../../UtilityMain/producthelpers/productNormalizationService';
import DistributorModal from "../../components/modal/DistributorModal";
import { setDistributorId, clearDistributorId } from '../../redux/slices/distributorSlice';
import getOrderedCategories from '../../UtilityMain/producthelpers/categoryPriorityService';
import { useFocusEffect } from '@react-navigation/native';
import { enrichProductWithUOMInline } from "../../UtilityMain/producthelpers/productNormalizationService";
import { getCGCloudUOMData, createUOMDataMap, } from "../../UtilityMain/producthelpers/productUOMService";
import { UNITS_PER_CASE } from "../../utils/helper/caseUnits";


const categories = ["Must Sell Products", "Product Catalogue", "Offers & Promotions"];
const reasons = ["Expired", "Not Selling", "Damage/Leakage"];

const baseProducts = [
  {
    id: "1",
    name: "Shahi Garam Masala 25 g",
    price: 39.13,
    image: require("../../assets/images/food.png"),
  },
];

export default function ReturnWithoutInvoice({ onClose, searchText, fromset = null }) {
  const { apiFetch, apiComposite } = useApiFetch();

  const dispatch = useDispatch()
  const selectedBeatDay = useSelector((state: RootState) => state.selectedBeatDay.selectedBeatDay);
  const [productData, setProductData] = useState([])
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount.selectedAccount);
  const selectedVisit = useSelector(state => state.selectedVisit);
  const [loading, setLoading] = useState(false)
  const [recordTypeId, setRecordTypeId] = useState('')
  const [users, setUsers] = useState([])
  const DEFAULT_UNIT_MODE = "Unit";
  // console.log("THIS IS SELECTED BEAT DATY++++++++", selectedBeatDay)
  const { id: beatId, name: beatName } = useSelector((state) => state.beatSelection);
  const [currentBeatRecordState, setCurrentBeatRecordState] = useState(null);

  const isSubmittingRef = useRef(false);
  const processedOrderItemsRef = useRef(new Set());

  const getParentId = async (id) => {

    const retailerdata = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
      filters: [
        { field: 'Sf_Id', value: id }
      ]
    });

    return retailerdata[0]?.ParentId || id
  }

  const [productInstances, setProductInstances] = useState(
    baseProducts.map((p) => ({
      ...p,
      instanceId: `${p.id}-0`,
      baseId: p.id,
      quantity: 0,
      reason: null,
      unitMode: DEFAULT_UNIT_MODE, // <- use configured default
      unitPerCase: p.unitPerCase,
    }))
  );

  const computeTotalReturnQty = () => {
    return productInstances.reduce((sum, inst) => {
      const qty = inst.quantity || 0;
      return sum + (inst.unitMode === "Case"
        ? qty * inst.unitPerCase
        : qty);
    }, 0);
  };

  const computeTotalPTR = () => {
    const total = productInstances.reduce((sum, inst) => {
      const qty = inst.quantity || 0;
      const unitQty = inst.unitMode === "Case" ? qty * inst.unitPerCase : qty;
      const price = inst.price || 0;
      return sum + unitQty * price;
    }, 0);

    return roundTo2(total);
  };


  const [mobileUniqueId, setMobileUniqueId] = useState('');
  useFocusEffect(
    useCallback(() => {
      let uniqueId;
      if (fromset === "SubDB") {
        const userIdVal = users[0]?.Sf_Id || users[0]?.Id || '';
        uniqueId = `${userIdVal}-${distributorId}-${Date.now()}`;
      } else {
        uniqueId = `${selectedVisit?.AccountId}_${selectedVisit?.sfId}_${Date.now()}`;
      }
      setMobileUniqueId(uniqueId);
      console.log('Generated Mobile Unique Id:', uniqueId);
    }, [users, distributorId, selectedVisit, fromset])
  );

  const submitToApiComposite = async () => {

    const parentID = await getParentId(distributorId)
    const compositePayload = {
      compositeRequest: [
        {
          method: "POST",
          url: "/services/data/v61.0/sobjects/Order",
          referenceId: "newOrder",
          body: {
            Type: 'Secondary Return',
            //Beat__c: selectedBeatDay.Beat__c,
            //OrderNumber: randomId,
            AccountId: fromset === "SubDB" ? distributorId || selectedVisit.AccountId__c : selectedVisit.AccountId__c,
            ReturnDate__c: new Date().toISOString(),
            EffectiveDate: new Date().toISOString(),
            OrderPlacedBy__c: users[0].Sf_Id,
            // TotalReturnQuantity__c: computeTotalReturnQty(),
            Source__c: 'App',
            OrderSubmissionTime__c: new Date().toISOString(),
            TypeOfReturn__c: "Secondary Return",
            Pricebook2Id: PriceBookId_var,
            Visit__c: fromset === "SubDB" ? null : selectedVisit.sfId,
            Beat__c: fromset === 'SubDB' ? null : selectedVisit.Beat__c,
            Status: "Draft",
            Return_Category__c: 'Without Invoice',
            RecordTypeId: recordTypeId,
            // Total_Return_Value__c: computeTotalPTR(),

            Secondary_Order_Supplier__c: fromset === "SubDB" ? parentID || distributorId : distributorId,
            Mobile_Unique_Id__c: mobileUniqueId,
          },
        },
        {
          "method": "GET",
          "url": "/services/data/v61.0/sobjects/Order/@{newOrder.id}?fields=OrderNumber",
          "referenceId": "fetchOrderNumber"
        }

      ],
      allOrNone: true,
    };

    console.log("COMPOSITE PAYLOAD ========", JSON.stringify(compositePayload));
    const response = await apiComposite("POST", "composite", compositePayload);
    console.log("COMPOSITE RESPONSE ========", JSON.stringify(response));

    if (response.status === "success") {
      const orderResult = response.data.compositeResponse.find(r => r.referenceId === "newOrder");
      const orderNumberResult = response.data.compositeResponse.find(
        (r) => r.referenceId === "fetchOrderNumber"
      );


      if (orderResult.httpStatusCode === 201) {
        const orderId = orderResult.body.id;
        const orderNo = orderNumberResult?.body?.OrderNumber || null;
        return {
          orderId,
          orderNo
        };
      }
    } else {
      console.log("COMPOSITE REQUEST FAILED ====", response.message);
      return false;
    }
  };



  // const submitOrderItemsToApiLoop = async (orderId, items) => {


  //   // 1. Filter only instances the user actually filled out:
  //   const validItems = items.filter(
  //     (i) => i.quantity > 0 && i.reason
  //   );
  //   //console.log("THIS IS THE ITEMS SSS+++", validItems)

  //   for (const inst of validItems) {
  //     // 2. Compute case‑vs‑unit fields
  //     const isCase = inst.unitMode === "Case";
  //     const orderQtyInCase = isCase ? inst.quantity : 0;
  //     const uom = isCase ? "Box" : "Pc";      // or "KG" if you ever support weights

  //     // 3. Build payload for each return‑item
  //     const itemPayload = {
  //       apiName: "OrderItem",
  //       fields: {
  //         OrderId: orderId,

  //         PricebookEntryId: inst.priceBookId,
  //         Product2Id: inst.id,            // your Salesforce product Id
  //         Quantity: inst.quantity,
  //         OrderQtyInCase__c: orderQtyInCase,
  //         UOM__c: uom,
  //         Reason_Of_Return__c: inst.reason,
  //         Sales_Return_Value__c: roundTo2((inst.price || 0) * inst.quantity),
  //         UnitPrice: roundTo2(inst.price),
  //       },
  //     };

  //     //console.log("THIS IS GOOOD PAYLOAD",inst.reason)

  //     const resp = await apiFetch("POST", "records", itemPayload, "standard");

  //     //console.log('response for order item hit =====', resp)
  //     if (resp.status !== "success") {
  //       console.error(" Failed to push OrderItem:", resp);
  //       dispatch(
  //         showToast({
  //           message: `Failed to add return item for ${inst.name}`,
  //           type: "error",
  //         })
  //       );
  //       // you could break or continue based on your desired error policy
  //     }
  //   }
  // };


  const submitOrderItemsToApi = async (orderId, items) => {
    try {
      if (processedOrderItemsRef.current.has(orderId)) {
        console.log("⚠️ OrderItems already submitted for:", orderId);
        return true;
      }
      processedOrderItemsRef.current.add(orderId);
      // 1️⃣ Only valid filled items
      const validItems = items.filter(
        (i) => i.quantity > 0 && i.reason
      );

      if (!validItems.length) return { ok: true };

      // 2️⃣ Build composite request (NO LOOP API HIT)
      const compositePayload = {
        allOrNone: false,
        compositeRequest: validItems.map((inst, index) => {
          const isCase = inst.unitMode === "Case";
          const orderQtyInCase = truncateTo3(Number(inst.quantity / inst.unitPerCase)) ?? 0;
          const orderQuantityInKg = truncateTo2(Number(inst.quantity * inst.QuantityInKg)) ?? 0;
          // console.log('inst.quantity ', inst.quantity, 'inst.unitPerCase', inst.unitPerCase, 'orderQtyInCase', orderQtyInCase)
          // console.log('inst.QuantityInKg ',inst.QuantityInKg ,'orderQuantityInKg',orderQuantityInKg)
          const uom = isCase ? "Box" : "Pc";

          return {
            method: "POST",
            url: "/services/data/v61.0/sobjects/OrderItem",
            referenceId: `orderItem_${index}`,
            body: {
              OrderId: orderId,
              PricebookEntryId: inst.priceBookId,
              Product2Id: inst.id,
              Quantity: inst.quantity,
              OrderQtyInCase__c: orderQtyInCase,
              Order_Quantity_In_Kg__c: orderQuantityInKg,
              UOM__c: uom,
              Reason_Of_Return__c: inst.reason,
              Sales_Return_Value__c: roundTo2(
                (inst.price || 0) * inst.quantity
              ),
              UnitPrice: roundTo2(inst.price),
              SRChangedPrice__c: roundTo2(inst.price),

            },
          };
        }),
      };

      console.log("ORDER ITEM COMPOSITE 👉", JSON.stringify(compositePayload));

      // 3️⃣ Single composite API hit
      const response = await apiComposite(
        "POST",
        "composite",
        compositePayload
      );

      // 4️⃣ Error handling
      if (!response?.data?.compositeResponse) {
        throw new Error("OrderItem composite failed");
        processedOrderItemsRef.current.delete(orderId);
      }

      response.data.compositeResponse.forEach((res, index) => {
        if (res.httpStatusCode !== 201) {
          const inst = validItems[index];
          dispatch(
            showToast({
              message: `Failed to add return item for ${inst.name}`,
              type: "error",
            })
          );
        }
      });

      return { ok: true };
    } catch (err) {
      console.error(" OrderItem composite error:", err);
      processedOrderItemsRef.current.delete(orderId);
      return { ok: false, error: err };
    }
  };


  const saveLocally = async (orderId, isFromApi = false, orderNo) => {

    const parentID = await getParentId(distributorId)
    // 1️⃣ Build & save the Order record locally
    const orderPayload = {
      ObjectName: "Order",
      Type: "insert",
      data: {
        Sf_Id: orderId,
        Total_Return_Value__c: computeTotalPTR(),
        OrderNumber: orderNo,
        // Beat__c: selectedBeatDay.Beat__c,
        Type: "Secondary Return",
        AccountId: fromset === "SubDB" ? distributorId || selectedVisit.AccountId__c : selectedVisit.AccountId__c,
        ReturnDate__c: new Date().toISOString(),
        EffectiveDate: new Date().toISOString(),
        OrderPlacedBy__c: users[0].Sf_Id,
        TotalReturnQuantity__c: computeTotalReturnQty(),
        Source__c: "App",
        OrderSubmissionTime__c: new Date().toISOString(),
        TypeOfReturn__c: "Secondary Return",
        Pricebook2Id: PriceBookId_var,
        Visit__c: fromset === "SubDB" ? null : selectedVisit.sfId,
        Beat__c: fromset === 'SubDB' ? null : selectedVisit.Beat__c,
        Status: "Draft",
        Return_Category__c: "Without Invoice",
        Secondary_Order_Supplier__c: fromset === "SubDB" ? parentID || distributorId : distributorId,
        RecordTypeId: recordTypeId,
        Mobile_Unique_Id__c: mobileUniqueId,
        // these fields control your local sync state:
        is_locally_changed: !isFromApi,
        operation_type: isFromApi ? null : "insert",
        last_modified: Date.now(),
        is_synced: isFromApi,
      },
    };

    await UniversalUpdateInsert(orderPayload);

    // 2️⃣ Loop through each filled‑out instance and save as OrderItem locally
    const validItems = productInstances.filter((i) => i.quantity > 0 && i.reason);

    for (const inst of validItems) {
      const isCase = inst.unitMode === "Case";
      // const orderQtyInCase = isCase ? inst.quantity : 0;
      const orderQtyInCase = truncateTo3(Number(inst.quantity / inst.unitPerCase)) ?? 0;
      const orderQuantityInKg = truncateTo2(Number(inst.quantity * inst.QuantityInKg)) ?? 0;
      const uom = isCase ? "Box" : "Pc";

      const itemPayload = {
        ObjectName: "OrderItem",
        Type: "insert",
        data: {
          Sf_Id: `LI-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          // local‑only id, prefix so it doesn’t conflict with real ones
          OrderId: orderId,
          Product2Id: inst.id,
          PricebookEntryId: inst.priceBookId,
          Quantity: inst.quantity,
          OrderQtyInCase__c: orderQtyInCase,
          Order_Quantity_In_Kg__c: orderQuantityInKg,
          UOM__c: uom,
          Sales_Return_Value__c: roundTo2((inst.price || 0) * inst.quantity),
          UnitPrice: roundTo2(inst.price),
          SRChangedPrice__c: roundTo2(inst.price),
          Reason_Of_Return__c: inst.reason,

          // sync‑tracking fields
          is_locally_changed: !isFromApi,
          // operation_type: isFromApi ? null : "insert",
          last_modified: Date.now(),
          is_synced: isFromApi,
        },
      };

      await UniversalUpdateInsert(itemPayload);
    }

    // 3️⃣ Show a toast so the user knows it’s saved locally
    // dispatch(
    //   showToast({
    //     message: isFromApi
    //       ? "Spot Sales + items synced from server"
    //       : "Spot Sales + items saved locally",
    //     type: "success",
    //   })
    // );
  };




  const handleOrderSubmit = async () => {



    // console.log('product instances....', productInstances)
    // 0️⃣ Check that at least one instance has qty > 0
    //return
    const hasInvalidReason = productInstances.some(inst => {
      return inst.quantity > 0 && (!inst.reason || inst.reason.trim() === '');
    });
    // 111

    //new code 

    // Check: any product has quantity > 0 but missing reason
    const missingReason = productInstances.some(inst =>
      inst.quantity > 0 && (!inst.reason || inst.reason.trim() === '')
    );

    // Check: at least one product must have quantity > 1
    const noQuantityAboveOne = !productInstances.some(inst => inst.quantity > 1);

    // Create error messages
    let errorMessage = "";

    if (missingReason) {
      errorMessage = "A reason is required for every product with a quantity greater than 0.";
    } else if (noQuantityAboveOne) {
      errorMessage = "At least one product must have a quantity greater than 1.";
    }

    // If any error found, handle it
    if (errorMessage) {
      console.error(errorMessage);
      // return or throw based on your flow
      // return { success: false, message: errorMessage };
    }

    //end


    if (hasInvalidReason) {
      dispatch(showToast({
        message: "Please provide a reason for all products with quantity.",
        type: "warning"
      }));
      return;
    }

    const hasAny = productInstances.some(inst => inst.quantity > 0);
    if (!hasAny) {
      dispatch(showToast({
        message: "Please add at least one return line with quantity before submitting.",
        type: "warning"
      }));
      return;
    }

    const hasReasonWithZeroQty = productInstances.some(inst =>
      inst.reason && (!inst.quantity || inst.quantity <= 0)
    );
    if (hasReasonWithZeroQty) {
      dispatch(showToast({
        message: "Enter quantity more than 0 for all products with a reason.",
        type: "warning"
      }));
      return;
    }

    const hasInvalidPrice = productInstances.some(inst =>
      inst.quantity > 0 &&
      inst.reason &&
      inst.reason.trim() !== '' &&
      Number(inst.price) <= 0
    );

    if (hasInvalidPrice) {
      dispatch(showToast({
        // message: "Products with quantity and reason must have a price greater than 0.",
        message: "Must have a price greater than 0.",
        type: "warning"
      }));
      return;
    }


    // if (cartItems.length === 0) {
    //   dispatch(showToast({ message: 'You do not have any items in the cart.', type: 'warning' }));
    //   return;
    // }

    const generateRandomOrderNumber = () => {
      const timestamp = Date.now(); // current time in ms
      const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
      return `ORD-${timestamp}-${randomSuffix}`;
    };

    try {
      setLoading(true);
      const connected = await isInternetAvailable();

      let orderId = generateRandomOrderNumber();
      let orderNo = generateRandomOrderNumber();
      let isFromApi = false;

      if (connected) {
        const orderDataFromApi = await submitToApiComposite();
        // if (!orderDataFromApi) return;
        if (!orderDataFromApi) {
          dispatch(showToast({ message: 'Return Api failed.', type: 'error' }));
          setLoading(false);
          return;
        }

        orderId = orderDataFromApi.orderId;
        orderNo = orderDataFromApi.orderNo;
        isFromApi = true;
        await submitOrderItemsToApi(orderId, productInstances);
      }
      // console.log('hellooooo')
      await saveLocally(orderId, isFromApi, orderNo);

      dispatch(showToast({
        message: 'Return request made successfully.',
        type: 'success'
      }));
      setLoading(false)
      //   navigation.navigate('AccountDetailContainer')
    } catch (error) {
      setLoading(false)
      dispatch(showToast({
        message: 'Return request Failed.',
        type: 'error'
      }));

      console.error(' Return error:', error);
    } finally {
      setLoading(false);
      onClose()
    }
  };

  const [showModal, setShowModal] = useState(false);
  const distributorId = useSelector((state) => state.distributor.id);
  const [modalShownOnce, setModalShownOnce] = useState(false);
  const [firstRender, setFirstRender] = useState(true);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [subCategories, setSubCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubCategory, setSelectedSubCategory] = useState("All");

  const roundTo2 = (num) => {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
  };
  const truncateTo2 = (num) => {
    return Math.floor(Number(num) * 100) / 100;
  };
  const truncateTo3 = (num) => {
    return Math.floor(Number(num) * 1000) / 1000;
  };


  useEffect(() => {
    const getData = async () => {
      try {

        setLoading(true)

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
        // if (fromset === "SubDB") {
        //   dispatch(setDistributorId(SelectedBeatRecord?.DirectDBSubDB__c));
        // } else {
        //   setShowModal(true)
        // }
        // ----------------------------
        if (fromset !== "SubDB") {
          // if (firstRender && !modalShownOnce) {
          //   setShowModal(true);
          //   setModalShownOnce(true);
          //   setFirstRender(false);
          // }
        } else {
          // dispatch(setDistributorId(SelectedBeatRecord?.DirectDBSubDB__c));
          const loggedInUser = await UniversalUpdateInsert({
            ObjectName: "User",
            Type: "get"
          });
          // console.log(' loggedInUser[0]?.Sf_Id', loggedInUser[0]?.Sf_Id)

          const disData = await UniversalUpdateInsert({
            ObjectName: "SR_Beat_Assignment__c",
            Type: "get",
            filters: [
              { field: "Assigned_To__c", value: loggedInUser[0]?.Sf_Id },
              { field: "Beat__c", value: selectedVisit?.Beat__c || beatId },
            ],
          });
          // console.log('------------------------------', disData[0]?.Distributor__c)
          dispatch(setDistributorId(disData[0]?.Distributor__c));
        }


        // console.log('this initialize called ....')

        const loggedInUser = await UniversalUpdateInsert({
          ObjectName: "User",
          Type: "get",

        })
        //  console.log("THIS IS DITRIBUTOR IDDDDD...........................................",distributorId)

        // const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, distributorId);
        // const AllPicklistData = await UniversalUpdateInsert({
        //   ObjectName: 'AllDataPicklist',
        //   Type: 'get',
        // });
        //   const result1 = await UniversalUpdateInsert({
        //   ObjectName: 'Product2',
        //   Type: 'get',
        // });

        const [
          accessibleSubCategories,
          AllPicklistData,
          result1,
        ] = await Promise.all([
          getUserAccessibleSubCategories(loggedInUser, distributorId),

          UniversalUpdateInsert({
            ObjectName: "AllDataPicklist",
            Type: "get",
          }),

          UniversalUpdateInsert({
            ObjectName: "Product2",
            Type: "get",
          }),
        ]);


        let optionsData = AllPicklistData[0]?.OptionsData;

        if (typeof optionsData === 'string') {
          try {
            optionsData = JSON.parse(optionsData);
          } catch (e) {
            console.error("Failed to parse OptionsData:", e);
          }
        }
        const orderRecordTypeId = optionsData?.returnOrderRecordTypeId;
        setRecordTypeId(orderRecordTypeId)




        let result = result1.filter((prod) => {
          if (accessibleSubCategories.length === 0) return false;
          return accessibleSubCategories.includes((prod.SubCategory__c || "").trim());
        })


        const user = await UniversalUpdateInsert({
          ObjectName: 'User',
          Type: 'get',
        });

        setUsers(user)
        const transformedProducts = await Promise.all(
          result.map(async (p, index) => {

            // 🔍 Find matching pricing history record for this product
            // const matchedPricing = validPricingRecords.find(
            //   (rec) => rec.Fraction__c === p.Sf_Id
            // );
            const enrichedProduct = p;
            const { PTR, PTD } = await extractPricingValuesInline(
              distributorId,
              enrichedProduct
            );

            const uomData = await UniversalUpdateInsert({
              ObjectName: 'cgcloud__Unit_of_Measure__c',
              Type: 'get',
              filters: [{ field: "cgcloud__Product__c", value: enrichedProduct?.Sf_Id }],
            });
            const caseperunit = UNITS_PER_CASE;
            const caseperKG = uomData[0]?.Weight_Per_Unit_in_KG__c || 1;

            // const { PTR, PTD } = await extractPricingValuesInline(
            //   matchedPricing,
            //   enrichedProduct
            // );

            const PTRValue = PTR || 0;
            const PTDValue = PTD || 0;

            return {
              id: p.Sf_Id,
              name: p.Name,
              price: PTRValue != null ? PTRValue : 0,
              priceBookId: p.PriceBookId,
              image: p.ProductImageURL__c
                ? { uri: p.ProductImageURL__c }
                : require("../../assets/images/food.png"),
              // unitPerCase: Number(p.UnitperCase__c) || 1,
              unitPerCase: UNITS_PER_CASE,
              QuantityInKg: Number(caseperKG) || 1,

              // ADD THESE
              category: p.Category__c || "Others",
              subCategory: p.SubCategory__c || "Others",
              brand: p.Brand__c || "Others",
            };

          })
        );



        setProductData(transformedProducts);

        // Initialize productInstances
        const initialInstances = transformedProducts.map((p) => ({
          ...p,
          instanceId: `${p.id}-0`,
          baseId: p.id,
          quantity: 0,
          reason: null,
          unitMode: DEFAULT_UNIT_MODE,
        }));

        setProductInstances(initialInstances);

      } catch (error) {
        console.error(" Get User Failed For the Header:", error);
      } finally {
        setLoading(false)
        if (fromset !== "SubDB") {
          if (firstRender && !modalShownOnce) {
            setShowModal(true);
            setModalShownOnce(true);
            setFirstRender(false);
          }
        }
      }
    };
    getData();
  }, [distributorId]);


  useEffect(() => {
    const brandPriority = [
      "H&T Oils",
      "Mantra",
      "Advans",
      "Amritā"
    ];
    const fetchedBrands = [
      ...new Set(productData.map(p => p.brand).filter(Boolean))
    ];
    // priority brands jo available hain
    const orderedPriorityBrands = brandPriority.filter(b =>
      fetchedBrands.includes(b)
    );
    // jo remaining brands hain
    const remainingBrands = fetchedBrands.filter(
      b => !brandPriority.includes(b)
    );
    const uniqueBrands = [
      "All",
      ...orderedPriorityBrands,
      ...remainingBrands
    ];
    setBrands(uniqueBrands);
  }, [productData]);

  useEffect(() => {
    const loadCategories = async () => {

      const filteredByBrand =
        selectedBrand === "All"
          ? productData
          : productData.filter(p => p.brand === selectedBrand);

      const uniqueCategories = [
        ...new Set(filteredByBrand.map(p => p.category))
      ];

      const orderedUniqueCategories =
        await getOrderedCategories(uniqueCategories);

      setCategories(["All", ...orderedUniqueCategories]);

      // ⭐ IMPORTANT
      setSelectedCategory("All");
      setSelectedSubCategory("All");

    };

    loadCategories();
  }, [productData, selectedBrand]);

  useEffect(() => {
    if (selectedCategory === "All") {
      setSubCategories([]);
      setSelectedSubCategory("All");
      return;
    }

    const subs = [
      "All",
      ...new Set(
        productData
          .filter(p =>
            (selectedBrand === "All" || p.brand === selectedBrand) &&
            p.category === selectedCategory
          )
          .map(p => p.subCategory)
      )
    ];

    setSubCategories(subs);
    setSelectedSubCategory("All");

  }, [selectedCategory, selectedBrand]);

  const filteredBaseProducts = productData.filter(p => {

    if (selectedBrand !== "All" && p.brand !== selectedBrand)
      return false;

    if (selectedCategory !== "All" && p.category !== selectedCategory)
      return false;

    if (selectedSubCategory !== "All" && p.subCategory !== selectedSubCategory)
      return false;

    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase()))
      return false;

    return true;
  });

  const updateQuantity = (instanceId, val) =>
    setProductInstances((p) =>
      p.map((x) =>
        x.instanceId === instanceId
          ? { ...x, quantity: Math.max(0, parseInt(val) || 0) }
          : x
      )
    );

  const updateReason = (instanceId, reason) =>
    setProductInstances((p) =>
      p.map((x) => (x.instanceId === instanceId ? { ...x, reason } : x))
    );

  const handleAddCopy = (baseId) => {
    const sameProductCopies = productInstances.filter((p) => p.baseId === baseId);
    if (sameProductCopies.length >= 3) return; // keep max 3 (0,1,2)

    const original = sameProductCopies[0];
    const newCopy = {
      ...original,
      instanceId: `${baseId}-${sameProductCopies.length}`,
      // reset fields that must not be copied:
      quantity: 0,
      reason: null,
      unitMode: DEFAULT_UNIT_MODE,
    };
    setProductInstances((prev) => [...prev, newCopy]);
  };
  const handleRemoveCopy = (instanceId) => {
    setProductInstances((p) => p.filter((x) => x.instanceId !== instanceId));
  };

  const toggleMode = (instanceId, mode) =>
    setProductInstances((list) =>
      list.map((x) =>
        x.instanceId === instanceId ? { ...x, unitMode: mode } : x
      )
    );

  const getAvailableReasons = (currentReason) => {
    return reasons.filter(r =>
      r === currentReason || !usedReasons.includes(r)
    );
  };

  return (
    <>
      <View style={{ flex: 1 }}>

        <View style={{ marginBottom: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {brands.map((brand) => {
              const active = selectedBrand === brand;

              return active ? (
                <LinearGradient
                  key={brand}
                  colors={Gradients.primary}
                  style={styles.categoryBtn}
                >
                  <TouchableOpacity onPress={() => setSelectedBrand(brand)}>
                    <Text style={styles.categoryTextActive}>{brand}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <TouchableOpacity
                  key={brand}
                  style={[styles.categoryBtn, styles.categoryBtnInactive]}
                  onPress={() => setSelectedBrand(brand)}
                >
                  <Text style={styles.categoryText}>{brand}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>


        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map(cat => {
              const active = selectedCategory === cat;
              return active ? (
                <LinearGradient
                  key={cat}
                  colors={Gradients.primary}
                  style={styles.categoryBtn}
                >
                  <TouchableOpacity onPress={() => setSelectedCategory(cat)}>
                    {/* <Text style={styles.categoryTextActive}>{cat}</Text> */}
                    <Text style={styles.categoryTextActive}>{cat?.toLowerCase() === 'flour' ? 'Staples' : cat}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryBtn, styles.categoryBtnInactive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  {/* <Text style={styles.categoryTextActive}>{cat}</Text> */}
                  <Text style={styles.categoryText}>{cat?.toLowerCase() === 'flour' ? 'Staples' : cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {subCategories.length > 0 && (
          <View style={styles.categoryContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
              {subCategories.map(sub => {
                const active = selectedSubCategory === sub;

                return active ? (
                  <LinearGradient
                    key={sub}
                    colors={Gradients.primary}
                    style={[styles.categoryBtn, { marginBottom: 7, marginTop: 7 }]}
                  >
                    <TouchableOpacity onPress={() => setSelectedSubCategory(sub)}>
                      <Text style={styles.categoryTextActive}>{sub}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.categoryBtn, styles.categoryBtnInactive, { marginBottom: 5, marginTop: 7 }]}
                    onPress={() => setSelectedSubCategory(sub)}
                  >
                    <Text style={[styles.categoryText, { height: 24 }]}>{sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}



        {/* <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {filteredBaseProducts.map((baseProduct) => {
            const relatedInstances = productInstances.filter((p) => p.baseId === baseProduct.id);
            const usedReasonsForThisProduct = relatedInstances
              .map(inst => inst.reason)
              .filter(r => !!r);
            const getAvailableReasonsForInstance = (currentReason) =>
              reasons.filter(r => r === currentReason || !usedReasonsForThisProduct.includes(r));
            const canAddMore = relatedInstances.length < 3;

            return (
              <View key={baseProduct.id} style={styles.productCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Image source={baseProduct.image} style={styles.productImage} />
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={styles.productName}>{baseProduct.name}</Text>
                    <Text style={styles.productPrice}>₹{baseProduct.price.toFixed(2)}</Text>
                    <Text style={{ fontSize: 10 }}>Unit per case {baseProduct.unitPerCase}</Text>
                  </View>
                </View>

                {relatedInstances.map((item) => (
                  <View key={item.instanceId}>

                    <View style={styles.reasonRow}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Qty"
                        maxLength={3} 
                        value={(item.quantity || 0).toString()}

                        onChangeText={(v) => {
                          const numericValue = v.replace(/[^0-9]/g, '');
                          updateQuantity(item.instanceId, numericValue ? parseInt(numericValue) : 0);
                        }}
                      />



                      <Dropdown
                        data={getAvailableReasonsForInstance(item.reason).map((r) => ({
                          label: r,
                          value: r,
                        }))}
                        search
                        searchPlaceholder="Search"
                        inputSearchStyle={{ fontSize: 10, borderRadius: 10, height: 40 }}
                        labelField="label"
                        itemTextStyle={{ fontSize: 12 }}
                        valueField="value"
                        placeholder="Select Reason"
                        value={item.reason}
                        style={styles.dropdown}
                        containerStyle={styles.dropdownContainer}
                        selectedTextStyle={styles.selectedTextStyle}
                        itemContainerStyle={{ marginVertical: -2 }}
                        placeholderStyle={styles.placeholderStyle}
                        disabled={getAvailableReasonsForInstance(item.reason).length === 0 && !item.reason}
                        onChange={(selected) => updateReason(item.instanceId, selected.value)}
                      />

                      {item.instanceId.endsWith("-0") ? (
                        canAddMore ? (
                          <TouchableOpacity
                            style={styles.plusBtn}
                            onPress={() => handleAddCopy(item.baseId)}
                          >
                            <Plus width={24} height={24} />
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.plusBtn, { width: 35 }]} />
                        )
                      ) : (
                        <TouchableOpacity
                          style={styles.plusBtn}
                          onPress={() => handleRemoveCopy(item.instanceId)}
                        >
                          <Ionicons name="trash-outline" size={24} color="red" />
                        </TouchableOpacity>
                      )}
                    </View>



                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView> */}


        <FlatList

          data={filteredBaseProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          initialNumToRender={35}
          maxToRenderPerBatch={35}
          windowSize={10}
          removeClippedSubviews={true}
          renderItem={({ item: baseProduct }) => {
            const relatedInstances = productInstances.filter(
              (p) => p.baseId === baseProduct.id
            );

            const usedReasonsForThisProduct = relatedInstances
              .map(inst => inst.reason)
              .filter(Boolean);

            const getAvailableReasonsForInstance = (currentReason) =>
              reasons.filter(
                r => r === currentReason || !usedReasonsForThisProduct.includes(r)
              );

            const canAddMore = relatedInstances.length < 3;

            // if (baseProduct.price < 20) return null;
            if (baseProduct.price <= 0 || baseProduct.price == null || baseProduct.price == undefined || baseProduct.price == '') return false;
            return (
              <View key={baseProduct.id} style={styles.productCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Image source={baseProduct.image} style={styles.productImage} />
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={styles.productName}>{baseProduct.name}</Text>
                    <Text style={styles.productPrice}>₹{baseProduct.price.toFixed(2)}</Text>
                    <Text style={{ fontSize: 10 }}>Unit per case {baseProduct.unitPerCase}</Text>
                  </View>
                </View>

                {/* Product Instances */}
                {relatedInstances.map((item) => (
                  <View key={item.instanceId}>

                    {/* Quantity / Reason / Actions */}
                    <View style={styles.reasonRow}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Qty"
                        maxLength={5} // 👉 max 3 digit
                        value={(item.quantity || 0).toString()}

                        onChangeText={(v) => {

                          const numericValue = v.replace(/[^0-9]/g, '');
                          updateQuantity(item.instanceId, numericValue ? parseInt(numericValue) : 0);
                        }}
                      />




                      {/* inside JSX for each instance */}
                      <Dropdown
                        data={getAvailableReasonsForInstance(item.reason).map((r) => ({
                          label: r,
                          value: r,
                        }))}
                        search
                        searchPlaceholder="Search"
                        inputSearchStyle={{ fontSize: 10, borderRadius: 10, height: 40 }}
                        labelField="label"
                        itemTextStyle={{ fontSize: 12 }}
                        valueField="value"
                        placeholder="Select Reason"
                        value={item.reason}
                        style={styles.dropdown}
                        containerStyle={styles.dropdownContainer}
                        selectedTextStyle={styles.selectedTextStyle}
                        itemContainerStyle={{ marginVertical: -2 }}
                        placeholderStyle={styles.placeholderStyle}
                        // disable dropdown if there are no available reasons and the instance has none
                        disabled={getAvailableReasonsForInstance(item.reason).length === 0 && !item.reason}
                        onChange={(selected) => updateReason(item.instanceId, selected.value)}
                      />

                      {item.instanceId.endsWith("-0") ? (
                        canAddMore ? (
                          <TouchableOpacity
                            style={styles.plusBtn}
                            onPress={() => handleAddCopy(item.baseId)}
                          >
                            <Plus width={24} height={24} />
                          </TouchableOpacity>
                        ) : (
                          // Blank icon placeholder for layout consistency
                          <View style={[styles.plusBtn, { width: 35 }]} />
                        )
                      ) : (
                        <TouchableOpacity
                          style={styles.plusBtn}
                          onPress={() => handleRemoveCopy(item.instanceId)}
                        >
                          <Ionicons name="trash-outline" size={24} color="red" />
                        </TouchableOpacity>
                      )}
                    </View>



                  </View>
                ))}
              </View>
            );
          }}
        />



        <View style={styles.submitContainer}>
          <TouchableOpacity onPress={handleOrderSubmit} style={styles.submitWrapper}>
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>



      </View>

      {showModal && (
        <DistributorModal
          visible={showModal}
          onClose={() => {
            setShowModal(false);
            onClose()
          }}
          onConfirm={() => {
            setShowModal(false);
          }}
        />
      )}

      <LoaderOverlay visible={loading} message="Loading products..." />
    </>
  );
}

const styles = StyleSheet.create({
  submitContainer: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    width: '100%',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 12,
  },

  submitButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitWrapper: {
    width: '100%',
    height: '100%',
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  bgcontainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  categoryContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 6,
    // marginBottom: 10,
  },
  categoryBtn: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    height: 30,
    // marginBottom:5
  },
  categoryBtnInactive: { backgroundColor: "#F1EADB", borderWidth: 1, borderColor: "#C9A24D" },
  categoryBtnActive: {},
  categoryText: { color: "black" },
  categoryTextActive: { color: "#fff" },
  productCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  productImage: { width: 50, height: 70, borderRadius: 6, resizeMode: "contain" },
  productName: { fontWeight: "500", fontSize: 14, marginBottom: 2, color: "#1F1D1A" },
  productPrice: { fontSize: 12, color: "#7A7266", marginBottom: 5 },
  input: {
    // backgroundColor:'red',
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 5,
    height: 35,
    paddingVertical: 0,
    paddingHorizontal: 10,
    textAlign: "center",
    justifyContent: "center",
    width: 50,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    justifyContent: "space-between",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 4,
    borderRadius: 5,
    width: 140,
    justifyContent: "space-between",
  },
  plusBtn: {
    padding: 6,
    marginLeft: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  reasonDropdown: {
    position: "absolute",
    top: "30%",
    left: "10%",
    right: "10%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    maxHeight: 250,
    zIndex: 10,
  },
  reasonItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  noDataText: { padding: 10, textAlign: "center", color: "#999" },

  toggleWrapper: {
    marginTop: 10,
    marginBottom: 6,
  },
  toggleBase: {
    paddingVertical: 5,
    paddingHorizontal: 25,
    justifyContent: "center",
  },
  inactive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D9D2C3",
  },
  leftActive: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  rightActive: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  textActive: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 12,
  },
  textInactive: {
    color: "#A67C2E",
    fontWeight: "500",
    fontSize: 12,
  },

  dropdown: {
    height: 40,
    //backgroundColor:'red',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    width: 140,
  },
  dropdownContainer: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  selectedTextStyle: {
    fontSize: 12,
    color: '#000',
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#888',
  },
});