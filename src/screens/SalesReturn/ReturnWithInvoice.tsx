import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
} from "react-native";
import Plus from "../../assets/images/Plus.svg";
import Ionicons from "../../components/Ionicons";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert.js";
import { useSelector, useDispatch } from "react-redux";
import { useApiFetch } from "../../utils/apiFetchHooks/useApiFetch";
import Invoice from "../../assets/images/invoice.svg";
import LinearGradient from "react-native-linear-gradient";
import { isInternetAvailable } from "../../utils/networkUtils";
import { Gradients } from "../../assets/css/MasterCss.js";
import { showToast } from "../../redux/slices/toastSlice";
import { RootState } from '../../redux/store';
import { PriceBookId_var } from '../../../config'
import { Dropdown } from "react-native-element-dropdown";
import LoaderOverlay from '../../utils/helper/LoaderOverlay'
import useOrderWithInvoicApi from '../../utils/Collection/OrderWithInvoiceApi';
import { getUserAccessibleSubCategories } from '../../UtilityMain/producthelpers/userLineService.js';
import { setDistributorId } from '../../redux/slices/distributorSlice';
import { useFocusEffect } from '@react-navigation/native';
import { UNITS_PER_CASE, formatUnitsWithCases } from "../../utils/helper/caseUnits";

const ReturnWithInvoice = ({ onClose, searchText, fromset = null }) => {
  const { apiFetch, apiComposite } = useApiFetch();
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [productData, setProductData] = useState([]); // master filtered product list
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [productInstances, setProductInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recordTypeId, setRecordTypeId] = useState('');
  const dispatch = useDispatch();
  const { OrderWithInvoicApi } = useOrderWithInvoicApi();
  const reasons = ["Expired", "Not Selling", "Damage/Leakage"];
  const selectedVisit = useSelector((state) => state.selectedVisit);
  const { id: beatId } = useSelector((state) => state.beatSelection);
  const distributorId = useSelector((state) => state.distributor.id);
  const [currentBeatRecordState, setCurrentBeatRecordState] = useState(null);

  const isSubmittingRef = useRef(false);
  const processedOrderItemsRef = useRef(new Set());

  console.log('selectedVisit in return with invoice', PriceBookId_var)
  const truncateTo2 = (num) => {
    return Math.floor(Number(num) * 100) / 100;
  };

  const truncateTo3 = (num) => {
    return Math.floor(Number(num) * 1000) / 1000;
  };

  const getParentId = async (id) => {

    const retailerdata = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
      filters: [
        { field: 'Sf_Id', value: id }
      ]
    });
    // console.log('retailerdata',retailerdata)
    retailerdata[0]?.ParentId || id
  }

  // ---------- Utilities ----------
  const unitsForInstance = (inst) => {
    const qty = Number(inst.quantity || 0);
    const unitPerCase = Number(inst.unitPerCase || 1);
    return inst.unitMode === "Case" ? qty * unitPerCase : qty;
  };

  const totalUnitsForBase = (baseId, excludingInstanceId = null) => {
    return productInstances
      .filter((it) => it.baseId === baseId && it.instanceId !== excludingInstanceId)
      .reduce((s, it) => s + unitsForInstance(it), 0);
  };

  // ---------- loadProductData: loads Product2 filtered by distributor's accessible subcategories ----------
  const loadProductData = async (showdistributorId) => {
    try {
      const AllPicklistData = await UniversalUpdateInsert({
        ObjectName: 'AllDataPicklist',
        Type: 'get',
      });

      let optionsData = AllPicklistData?.[0]?.OptionsData;
      if (typeof optionsData === 'string') {
        try { optionsData = JSON.parse(optionsData); } catch (e) { optionsData = optionsData; }
      }
      setRecordTypeId(optionsData?.returnOrderRecordTypeId || '');

      const userResult = await UniversalUpdateInsert({ ObjectName: "User", Type: "get" });
      setUsers(userResult || []);

      const loggedInUser = userResult || [];
      const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, showdistributorId || distributorId);
      console.log('-----------------------------------------------', accessibleSubCategories)
      const result1 = await UniversalUpdateInsert({ ObjectName: "Product2", Type: "get" });
      const filtered = Array.isArray(result1) ? result1.filter((prod) => {
        if (!accessibleSubCategories || accessibleSubCategories.length === 0) return false;
        return accessibleSubCategories.includes((prod.SubCategory__c || "").trim());
      }) : [];

      // const transformedProducts = filtered.map((p) => ({
      //   id: p.Sf_Id,
      //   name: p.Name,
      //   price: Number(p.PTR__c) || 0,
      //   priceBookId: p.PriceBookId,
      //   image: p.ProductImageURL__c ? { uri: p.ProductImageURL__c } : require("../../assets/images/food.png"),
      //   unitPerCase: Number(p.UnitperCase__c) || 1,
      // }));
      const transformedProducts = await Promise.all(
        filtered.map(async (p) => {
          const uomData = await UniversalUpdateInsert({
            ObjectName: 'cgcloud__Unit_of_Measure__c',
            Type: 'get',
            filters: [
              {
                field: "cgcloud__Product__c",
                value: p.Sf_Id,
              },
            ],
          });

          const caseperunit =
            UNITS_PER_CASE;

          const caseperKG = uomData?.[0]?.Weight_Per_Unit_in_KG__c || 1;
          // console.log('caseperKG',caseperKG)
          return {
            id: p.Sf_Id,
            name: p.Name,
            price: Number(p.PTR__c) || 0,
            priceBookId: p.PriceBookId,
            image: p.ProductImageURL__c
              ? { uri: p.ProductImageURL__c }
              : require("../../assets/images/food.png"),

            unitPerCase: UNITS_PER_CASE,
            QuantityInKg: Number(caseperKG) || 1,
          };
        })
      );

      setProductData(transformedProducts);
      return transformedProducts;
    } catch (err) {
      console.error(" loadProductData failed:", err);
      return [];
    }
  };

  // ---------- Fetch invoice items and create productInstances from invoice lines ----------
  // === FIXED: if product not found in productData -> SKIP the invoice line (no fallback)
  const fetchInvoiceItems = async (invoiceId) => {
    try {
      const result = await UniversalUpdateInsert({
        ObjectName: "Invoice_Item__c",
        Type: "get",
        filters: [{ field: "Invoice__c", value: invoiceId }],
      });

      setInvoiceItems(result || []);

      const instances = (result || []).reduce((acc, inv) => {
        const prodId = inv.Product__c;
        const product = productData.find((p) => p.id === prodId);

        //  IMPORTANT FIX: if product not in productData (i.e. not allowed by subcategory), SKIP it
        if (!product) {
          console.warn("⏭ SKIPPING: Product__c not present in filtered productData:", prodId);
          return acc; // do not push fallback — the UI must not show this invoice line
        }
        console.log('aaaaaaaáaaaaaaaaaaaaaaaaaa', prodId)
        const priceFromInvoice = inv.RatePerPC__c ? parseFloat(inv.RatePerPC__c) : NaN;
        const price = !Number.isNaN(priceFromInvoice) ? priceFromInvoice : Number(product.price || 0);

        acc.push({
          id: prodId,
          baseId: prodId,
          instanceId: `${prodId}-0`,
          name: product.name || inv.ProductCode || "Unknown",
          image: product.image || require("../../assets/images/food.png"),
          priceBookId: product.priceBookId || null,
          price,
          unitPerCase: Number(product.unitPerCase || 1),
          QuantityInKg: Number(product.QuantityInKg || 1),
          invoiceItemId: inv.Sf_Id,
          invoiceQuantity: inv.InvoiceQuantityPcs__c || 0,
          returnqty: inv.Return_Quantity_in_Pcs__c || 0,
          grossAmount: inv.Gross_Amount__c || 0,
          netAmount: inv.NetAmount__c || 0,
          quantity: 0,
          reason: null,
          unitMode: "Unit",
          rawInvoiceRow: inv,
        });

        return acc;
      }, []);

      setProductInstances(instances);
    } catch (err) {
      console.error(" Invoice items fetch failed:", err);
    }
  };

  // ---------- When user taps Return on an invoice ----------
  const handleReturnPress = async (item) => {
    try {
      dispatch(setDistributorId(item.supplierName__c));
      setSelectedInvoice(item);

      // Ensure productData is loaded for this distributor before creating instances
      if (!productData || productData.length === 0) {
        setLoading(true);
        await loadProductData(item.supplierName__c);
        setLoading(false);
      }

      await fetchInvoiceItems(item.id);
    } catch (err) {
      console.error(" handleReturnPress failed:", err);
    }
  };

  // ---------- update qty/reason/add/remove ----------
  const updateQuantity = (instanceId, inputValue) => {
    const numericStr = String(inputValue || "").replace(/[^0-9]/g, "");
    const newQty = numericStr === "" ? 0 : parseInt(numericStr, 10);

    setProductInstances((prev) => {
      const inst = prev.find((p) => p.instanceId === instanceId);
      if (!inst) return prev;

      const invoiceQty = Number(inst.invoiceQuantity || 0);
      const unitPerCase = Number(inst.unitPerCase || 1);
      const newUnitsForThis = inst.unitMode === "Case" ? newQty * unitPerCase : newQty;
      const otherUnits = totalUnitsForBase(inst.baseId, instanceId);
      const previousReturnQty = Number(inst.rawInvoiceRow?.Return_Quantity_in_Pcs__c || 0);
      const allowedUnits = invoiceQty - previousReturnQty - otherUnits;

      if (allowedUnits <= 0 && newUnitsForThis > 0) {
        dispatch(showToast({ message: "Exceeded return quantity. No more quantity can be returned.", type: "warning" }));
        return prev.map((x) => x.instanceId === instanceId ? { ...x, quantity: 0 } : x);
      }

      if (newUnitsForThis > allowedUnits) {
        if (inst.unitMode === "Case") {
          const maxCases = Math.floor(allowedUnits / (unitPerCase || 1));
          dispatch(showToast({ message: `Exceeded return quantity. Maximum allowed is ${allowedUnits} pcs (${maxCases} case(s)).`, type: "warning" }));
          return prev.map((x) => x.instanceId === instanceId ? { ...x, quantity: Math.max(0, maxCases) } : x);
        } else {
          dispatch(showToast({ message: `Exceeded return quantity. Maximum allowed is ${allowedUnits} pcs.`, type: "warning" }));
          return prev.map((x) => x.instanceId === instanceId ? { ...x, quantity: Math.max(0, allowedUnits) } : x);
        }
      }

      return prev.map((x) => x.instanceId === instanceId ? { ...x, quantity: newQty } : x);
    });
  };

  const updateReason = (instanceId, reason) =>
    setProductInstances((p) => p.map((x) => (x.instanceId === instanceId ? { ...x, reason } : x)));

  const handleAddCopy = (baseId) => {
    const sameProductCopies = productInstances.filter((p) => p.baseId === baseId);
    if (sameProductCopies.length >= 3) return;
    const original = sameProductCopies[0] || {};
    const copyIndex = sameProductCopies.length;
    const newCopy = {
      id: original.id,
      baseId: baseId,
      instanceId: `${baseId}-${copyIndex}-${Date.now()}`,
      name: original.name,
      image: original.image,
      priceBookId: original.priceBookId,
      price: original.price,
      unitPerCase: original.unitPerCase || 1,
      QuantityInKg: original.QuantityInKg || 1,
      invoiceItemId: original.invoiceItemId,
      invoiceQuantity: original.invoiceQuantity || 0,
      grossAmount: original.grossAmount || 0,
      netAmount: original.netAmount || 0,
      rawInvoiceRow: original.rawInvoiceRow,
      quantity: 0,
      reason: null,
      unitMode: "Unit",
    };
    setProductInstances((prev) => [...prev, newCopy]);
  };

  const handleRemoveCopy = (instanceId) => {
    setProductInstances((p) => p.filter((x) => x.instanceId !== instanceId));
  };

  // ---------- compute & submit helpers (kept same behaviour) ----------
  const computeTotalPTR = () => {
    return productInstances.reduce((sum, inst) => {
      const qty = Number(inst.quantity || 0);
      const unitQty = inst.unitMode === "Case" ? qty * (inst.unitPerCase || 1) : qty;
      const price = Number(inst.price || 0);
      return sum + unitQty * price;
    }, 0);
  };

  function sumSalesReturnValues(items = []) {
    if (!Array.isArray(items)) return 0;
    const total = items.reduce((acc, inst) => {
      if (!inst) return acc;
      if (inst.Sales_Return_Value__c != null && inst.Sales_Return_Value__c !== "") {
        const parsed = Number(inst.Sales_Return_Value__c);
        return acc + (Number.isFinite(parsed) ? parsed : 0);
      }
      const quantity = typeof inst.quantity === "number" ? inst.quantity : (inst.quantity !== undefined && inst.quantity !== null) ? Number(inst.quantity) || 0 : 0;
      const netAmount = inst.rawInvoiceRow && (typeof inst.rawInvoiceRow.NetAmount__c === "number") ? inst.rawInvoiceRow.NetAmount__c : Number(inst.rawInvoiceRow?.NetAmount__c) || 0;
      const invoiceQty = inst.rawInvoiceRow && typeof inst.rawInvoiceRow.InvoiceQuantityPcs__c === "number" && inst.rawInvoiceRow.InvoiceQuantityPcs__c !== 0 ? inst.rawInvoiceRow.InvoiceQuantityPcs__c : Number(inst.rawInvoiceRow?.InvoiceQuantityPcs__c) || 1;
      const unitPrice = invoiceQty ? netAmount / invoiceQty : 0;
      const salesReturnValue = unitPrice * quantity;
      return acc + (Number.isFinite(salesReturnValue) ? salesReturnValue : 0);
    }, 0);
    return Math.round(total * 100) / 100;
  }

  const totalPTR = useMemo(() => computeTotalPTR(), [productInstances]);

  const computeTotalReturnQty = () => {
    return productInstances.reduce((sum, inst) => {
      const qty = inst.quantity || 0;
      return sum + (inst.unitMode === "Case" ? qty * inst.unitPerCase : qty);
    }, 0);
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
      console.log('Generated Mobile Unique Id:return', uniqueId);
    }, [users, distributorId, selectedVisit, fromset])
  );

  const submitToApiComposite = async (validItems) => {
    const parentID = await getParentId(distributorId)
    // console.log('parentID',parentID)
    // return;
    const compositePayload = {
      compositeRequest: [
        {
          method: "POST",
          url: "/services/data/v61.0/sobjects/Order",
          referenceId: "newOrder",
          body: {
            Type: "Secondary Return",
            //Beat__c: selectedBeatDay.Beat__c,
            //OrderNumber: randomId,
            Invoices__c: selectedInvoice.id,
            // Total_Return_Value__c: sumSalesReturnValues(validItems),
            AccountId: fromset === "SubDB" ? distributorId || selectedVisit.AccountId__c : selectedVisit.AccountId__c,
            ReturnDate__c: new Date().toISOString(),
            EffectiveDate: new Date().toISOString(),
            OrderPlacedBy__c: users[0].Sf_Id,
            // TotalReturnQuantity__c: computeTotalReturnQty(), //make it dynamic
            Source__c: "App",
            OrderSubmissionTime__c: new Date().toISOString(),
            TypeOfReturn__c: "Secondary Return",
            Pricebook2Id: PriceBookId_var,
            Visit__c: fromset === "SubDB" ? null : selectedVisit.sfId,
            Beat__c: fromset === 'SubDB' ? null : selectedVisit.Beat__c,
            Status: "Draft",
            Return_Category__c: "With Invoice",
            RecordTypeId: recordTypeId,
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

    // console.log("COMPOSITE PAYLOAD ========", JSON.stringify(compositePayload));
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

  const handleOrderSubmit = async () => {

    // const hasInvalidReason = productInstances.some(inst => {
    //   return inst.quantity > 0 && (!inst.reason || inst.reason.trim() === '');
    // });

    console.log('product instances....', productInstances)
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
        const orderDataFromApi = await submitToApiComposite(productInstances);
        // if (!orderDataFromApi) return;
        if (!orderDataFromApi) {
          dispatch(showToast({ message: 'Return Api failed.', type: 'error' }));
          setLoading(false);
          return;
        }

        orderId = orderDataFromApi.orderId;
        orderNo = orderDataFromApi.orderNo;
        isFromApi = true;

        // console.log("JPRODUCT INSTANCESSSSSLLLLL>>>>>>>>>>>>>>>>>>>>>>>>>",productInstances)

        await submitOrderItemsToApi(orderId, productInstances);
      }

      await saveLocally(orderId, isFromApi, orderNo);
      // await OrderWithInvoicApi(selectedInvoice, sumSalesReturnValues(productInstances))

      await OrderWithInvoicApi(selectedInvoice, productInstances)
      setLoading(false)
      dispatch(
        showToast({
          message: "Return request has been made successfully.",
          type: "success",
        })
      );

      //   navigation.navigate('AccountDetailContainer')
    } catch (error) {
      setLoading(false)
      dispatch(
        showToast({
          message: "Return request submission failed",
          type: "error",
        })
      );
      console.error(" Return error:", error);
    } finally {
      setLoading(false);
      onClose()
    }
  };

  // const submitOrderItemsToApiLoop = async (orderId, items) => {
  //   console.log(
  //     "==================order ID =============================",
  //     orderId
  //   );
  //   // 1. Filter only instances the user actually filled out:
  //   const validItems = items.filter((i) => i.quantity > 0 && i.reason);
  //   //console.log("THIS IS THE ITEMS SSS+++", validItems)

  //   for (const inst of validItems) {
  //     // 2. Compute case‑vs‑unit fields
  //     const isCase = inst.unitMode === "Case";
  //     const orderQtyInCase = isCase ? inst.quantity || 0 : 0;
  //     const uom = isCase ? "Box" : "Pc"; // or "KG" if you ever support weights

  //     // Ensure quantity-related values are valid numbers
  //     const quantity = typeof inst.quantity === 'number' ? inst.quantity : 0;
  //     const netAmount = typeof inst.rawInvoiceRow.NetAmount__c === 'number' ? inst.rawInvoiceRow.NetAmount__c : 0;
  //     const invoiceQuantity = typeof inst.rawInvoiceRow.InvoiceQuantityPcs__c === 'number' && inst.rawInvoiceRow.InvoiceQuantityPcs__c !== 0 ? inst.rawInvoiceRow.InvoiceQuantityPcs__c : 1;

  //     // Calculate Unit Price and Sales Return Value safely
  //     const unitPrice = netAmount / invoiceQuantity;
  //     const salesReturnValue = unitPrice * quantity;

  //     // 3. Build payload for each return‑item
  //     const itemPayload = {
  //       apiName: "OrderItem",
  //       fields: {
  //         OrderId: orderId,
  //         PricebookEntryId: inst.priceBookId,
  //         Product2Id: inst.id, // your Salesforce product Id
  //         Quantity: quantity,
  //         OrderQtyInCase__c: orderQtyInCase,
  //         UOM__c: uom,
  //         Reason_Of_Return__c: inst.reason,
  //         UnitPrice: unitPrice,
  //         Sales_Return_Value__c: salesReturnValue,
  //         Invoice_Item__c: inst.invoiceItemId
  //       },
  //     };

  //     console.log('INSTANCE REASON', inst.reason)
  //     const resp = await apiFetch("POST", "records", itemPayload, "standard");

  //     console.log("response for order item hit =====", resp);
  //     if (resp.status !== "success") {
  //       console.error(" Failed to push OrderItem:", resp);
  //       // dispatch(
  //       //   showToast({
  //       //     message: `Failed to add return item for ${inst.name}`,
  //       //     type: "error",
  //       //   })
  //       // );
  //       // you could break or continue based on your desired error policy
  //     }
  //   }
  // };



  const submitOrderItemsToApi = async (orderId, items) => {
    if (processedOrderItemsRef.current.has(orderId)) {
      console.log("⚠️ OrderItems already submitted for:", orderId);
      return true;
    }
    processedOrderItemsRef.current.add(orderId);

    try {
      console.log(
        "==================order ID =============================",
        orderId
      );

      // 1️⃣ Filter valid items
      const validItems = items.filter(
        (i) => i.quantity > 0 && i.reason
      );

      if (!validItems.length) {
        return { ok: true, reason: "no valid items" };
      }

      // console.log(validItems)

      // 2️⃣ Build COMPOSITE payload
      const compositePayload = {
        allOrNone: false,
        compositeRequest: validItems.map((inst, index) => {
          const isCase = inst.unitMode === "Case";
          // const orderQtyInCase = isCase ? inst.quantity || 0 : 0;
          const orderQtyInCase = truncateTo3(Number(inst.quantity / inst.unitPerCase)) ?? 0;
          const orderQuantityInKg = truncateTo2(Number(inst.quantity * inst.QuantityInKg)) ?? 0;
          // console.log('inst',inst)
          console.log('inst.quantity ', inst.quantity, 'inst.unitPerCase', inst.unitPerCase, 'orderQtyInCase', orderQtyInCase)
          console.log('inst.QuantityInKg ', inst.QuantityInKg, 'orderQuantityInKg', orderQuantityInKg)
          const uom = isCase ? "Box" : "Pc";

          const quantity =
            typeof inst.quantity === "number" ? inst.quantity : 0;

          const netAmount =
            typeof inst?.rawInvoiceRow?.NetAmount__c === "number"
              ? inst.rawInvoiceRow.NetAmount__c
              : 0;

          const invoiceQuantity =
            typeof inst?.rawInvoiceRow?.InvoiceQuantityPcs__c === "number" &&
              inst.rawInvoiceRow.InvoiceQuantityPcs__c !== 0
              ? inst.rawInvoiceRow.InvoiceQuantityPcs__c
              : 1;

          const unitPrice = netAmount / invoiceQuantity;
          const salesReturnValue = unitPrice * quantity;

          return {
            method: "POST",
            url: "/services/data/v61.0/sobjects/OrderItem",
            referenceId: `orderItem_${index}`,
            body: {
              OrderId: orderId,
              PricebookEntryId: inst.priceBookId,
              Product2Id: inst.id,
              Quantity: quantity,
              OrderQtyInCase__c: orderQtyInCase,
              Order_Quantity_In_Kg__c: orderQuantityInKg,
              UOM__c: uom,
              Reason_Of_Return__c: inst.reason,
              UnitPrice: unitPrice,
              SRChangedPrice__c: unitPrice,
              Sales_Return_Value__c: salesReturnValue,
              Invoice_Item__c: inst.invoiceItemId,
            },
          };
        }),
      };
      console.log(
        "ORDER ITEM COMPOSITE PAYLOAD 👉",
        JSON.stringify(compositePayload)
      );
      // 3️⃣ SINGLE API HIT (no loop)
      const response = await apiComposite(
        "POST",
        "composite",
        compositePayload
      );
      if (!response?.data?.compositeResponse) {
        throw new Error("OrderItem composite failed");
        processedOrderItemsRef.current.delete(orderId);
      }
      // 4️⃣ Per-item response handling (optional)
      response.data.compositeResponse.forEach((res, index) => {
        if (res.httpStatusCode !== 201) {
          console.error(
            ` OrderItem failed for index ${index}`,
            res
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
    // 1️⃣ Build & save the Order record locally
    // 2️⃣ Loop through each filled‑out instance and save as OrderItem locally
    const validItems = productInstances.filter(
      (i) => i.quantity > 0 && i.reason
    );
    const parentID = await getParentId(distributorId)

    const orderPayload = {
      ObjectName: "Order",
      Type: "insert",
      data: {
        Sf_Id: orderId,
        OrderNumber: orderNo,
        // Beat__c: selectedBeatDay.Beat__c,
        Invoices__c: selectedInvoice.id,
        Type: "Secondary Return",
        Total_Return_Value__c: sumSalesReturnValues(validItems),
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
        Return_Category__c: "With Invoice",
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

    for (const inst of validItems) {
      // 2. Compute case‑vs‑unit fields
      const isCase = inst.unitMode === "Case";
      // const orderQtyInCase = isCase ? inst.quantity || 0 : 0;
      const orderQtyInCase = truncateTo3(Number(inst.quantity / inst.unitPerCase)) ?? 0;
      const orderQuantityInKg = truncateTo2(Number(inst.quantity * inst.QuantityInKg)) ?? 0;
      const uom = isCase ? "Box" : "Pc"; // or "KG" if you ever support weights
      // console.log('inst.quantity ', inst.quantity, 'inst.unitPerCase', inst.unitPerCase, 'orderQtyInCase', orderQtyInCase)

      // Ensure quantity-related values are valid numbers
      const quantity = typeof inst.quantity === 'number' ? inst.quantity : 0;
      const netAmount = typeof inst.rawInvoiceRow.NetAmount__c === 'number' ? inst.rawInvoiceRow.NetAmount__c : 0;
      const invoiceQuantity = typeof inst.rawInvoiceRow.InvoiceQuantityPcs__c === 'number' && inst.rawInvoiceRow.InvoiceQuantityPcs__c !== 0 ? inst.rawInvoiceRow.InvoiceQuantityPcs__c : 1;

      // Calculate Unit Price and Sales Return Value safely
      const unitPrice = netAmount / invoiceQuantity;
      const salesReturnValue = unitPrice * quantity;

      // const unitQty = inst.unitMode === "Case" ? qty * (inst.unitPerCase || 1) : qty;

      const itemPayload = {
        ObjectName: "OrderItem",
        Type: "insert",
        data: {
          Sf_Id: `LI-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          // local‑only id, prefix so it doesn’t conflict with real ones
          OrderId: orderId,
          PricebookEntryId: inst.priceBookId,
          Product2Id: inst.id, // your Salesforce product Id
          Quantity: quantity,
          OrderQtyInCase__c: orderQtyInCase,
          Order_Quantity_In_Kg__c: orderQuantityInKg,
          UOM__c: uom,
          Reason_Of_Return__c: inst.reason,
          UnitPrice: unitPrice,
          SRChangedPrice__c: unitPrice,
          Sales_Return_Value__c: salesReturnValue,
          Invoice_Item__c: inst.invoiceItemId,

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

  const toggleMode = (instanceId, mode) =>
    setProductInstances((list) =>
      list.map((x) => x.instanceId === instanceId ? { ...x, unitMode: mode } : x)
    );

  // ---------- initialize (loads beat + productData + invoices) ----------
  const initialize = async (showdistributorId) => {
    setLoading(true);
    try {
      // load beat record
      const SelectedBeatRecordArr = await UniversalUpdateInsert({
        ObjectName: "Beat__c",
        Type: "get",
        filters: [{ field: 'Sf_Id', value: beatId }]
      });
      const SelectedBeatRecord = Array.isArray(SelectedBeatRecordArr) && SelectedBeatRecordArr.length > 0 ? SelectedBeatRecordArr[0] : null;
      setCurrentBeatRecordState(SelectedBeatRecord || null);

      // load productData for distributor (DOES NOT set productInstances)
      await loadProductData(showdistributorId);

      // load invoices
      const invoiceResult = await UniversalUpdateInsert({
        ObjectName: "Invoice__c",
        Type: "get",
        filters: [
          {
            field: "Customer__c",
            value: fromset === "SubDB" ? distributorId || selectedVisit?.AccountId : selectedVisit?.AccountId,
            // value: fromset === "SubDB" ? SelectedBeatRecord?.DirectDBSubDB__c || selectedVisit?.AccountId : selectedVisit?.AccountId,
          },
        ],
      });

      const matchedInvoices = (invoiceResult || [])
        .filter(item =>
          (item.Status__c === 'Paid' || item.Status__c === 'Pending') &&
          item.Return_Submitted__c === false
        )
        .sort((a, b) => new Date(b.InvoiceDate__c) - new Date(a.InvoiceDate__c));

      const mappedInvoices = matchedInvoices.map((item) => {
        const invoiceDate = item.InvoiceDate__c ? new Date(item.InvoiceDate__c) : null;
        const currentDate = new Date();
        let daysDiff = 0;

        if (invoiceDate) {
          const timeDiff = currentDate - invoiceDate;
          daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        }

        return {
          id: item.Sf_Id,
          invoiceNumber: item.Name || "N/A",
          dueDate: item.InvoiceDate__c || "N/A",
          supplierName__c: item.SupplierName__c || "N/A",
          days: daysDiff,
          balance: `${item.Total_Net_Amount__c || 0}`,
          orderId: item.Order__c || null,
          status: item.Status__c || null,
          returnSubmit: item.Return_Submitted__c || false,
          Outstanding_Amount__c: item?.Outstanding_Amount__c,
          Total_Sales_Return_Value__c: item?.Total_Sales_Return_Value__c,
          Return_Adjusted_Against_Outstanding__c: item?.Return_Adjusted_Against_Outstanding__c,
          Total_Net_Amount__c: item?.Total_Net_Amount__c,
          Customer__c: item?.Customer__c,
        };
      });

      setInvoices(mappedInvoices);
    } catch (error) {
      console.error(" Fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initialize(distributorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- rendering ----------
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateObj = new Date(dateStr);
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const renderInvoiceCard = ({ item }) => {
    if (item.days > 20) return null;
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Invoice width={18} height={18} />
          <Text style={styles.invoiceText}>Invoice {item.invoiceNumber}</Text>
          <TouchableOpacity style={styles.collectButton} onPress={() => handleReturnPress(item)}>
            <Text style={styles.collectText}>Return</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.column}>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>{formatDate(item.dueDate)}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Days</Text>
            <Text style={styles.value}>{item.days}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Balance</Text>
            <Text style={styles.value}>
              ₹{Number(item.balance ? item.balance : 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const filteredBaseProducts = productInstances
    .filter((p, index, self) =>
      index === self.findIndex(t => t.baseId === p.baseId) &&
      p.name?.toLowerCase().includes((searchText || "").toLowerCase())
    );

  const renderOrderItems = () => (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.collectButton1, { alignSelf: "flex-start", marginBottom: 12 }]} onPress={() => { setSelectedInvoice(null); setProductInstances([]); }}>
        <Ionicons name="arrow-back-circle" size={30} color="#C9A24D" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {filteredBaseProducts.length === 0 && <Text style={styles.noDataText}>No items found</Text>}
        {filteredBaseProducts.map((baseProduct) => {
          const relatedInstances = productInstances.filter((p) => p.baseId === baseProduct.id);
          const usedReasonsForThisProduct = relatedInstances.map((inst) => inst.reason).filter((r) => !!r);
          const getAvailableReasons = (currentReason) => reasons.filter((r) => r === currentReason || !usedReasonsForThisProduct.includes(r));
          const canAddMore = relatedInstances.length < 3;

          return (
            <View key={baseProduct.id} style={styles.productCard}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Image source={baseProduct.image} style={styles.productImage} />
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={styles.productName}>{baseProduct.name}</Text>
                  <Text style={styles.productPrice}>Net Amount: ₹{Number(baseProduct?.netAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  <Text style={{ fontSize: 12 }}>Invoice Quantity: {formatUnitsWithCases(baseProduct.invoiceQuantity || 0, "Pcs")}</Text>
                  <Text style={{ fontSize: 12 }}>Returned Quantity: {formatUnitsWithCases(baseProduct.returnqty || 0, "Pcs")}</Text>
                </View>
              </View>

              {relatedInstances.map((item) => (
                <View key={item.instanceId}>
                  <View style={styles.reasonRow}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="Qty"
                      maxLength={6}
                      value={String(item.quantity ?? "")}
                      onChangeText={(v) => updateQuantity(item.instanceId, v)}
                    />

                    <Dropdown
                      data={getAvailableReasons(item.reason).map((r) => ({ label: r, value: r }))}
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
                      onChange={(selected) => updateReason(item.instanceId, selected.value)}
                    />

                    {item.instanceId.endsWith("-0") ? (
                      canAddMore ? (
                        <TouchableOpacity style={styles.plusBtn} onPress={() => handleAddCopy(item.baseId)}>
                          <Plus width={24} height={24} />
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.plusBtn, { width: 35 }]} />
                      )
                    ) : (
                      <TouchableOpacity style={styles.plusBtn} onPress={() => handleRemoveCopy(item.instanceId)}>
                        <Ionicons name="trash-outline" size={24} color="red" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.submitBar}>
        <TouchableOpacity onPress={handleOrderSubmit} style={styles.submitWrapper}>
          <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitButton}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  console.log('searchtext.........................................', searchText)
  const filteredInvoices = useMemo(() => {
    if (!searchText || !searchText.trim()) return invoices;

    const text = searchText.toLowerCase().trim();

    return invoices.filter(inv => {
      const invoiceNum = String(inv.invoiceNumber || "").toLowerCase();
      const supplier = String(inv.supplierName__c || "").toLowerCase();
      const balance = String(inv.balance || "").toLowerCase();

      return (
        invoiceNum.includes(text) ||
        supplier.includes(text) ||
        balance.includes(text)
      );
    });
  }, [invoices, searchText]);
  return (
    <View style={styles.container}>
      {selectedInvoice ? renderOrderItems() : (
        <FlatList
          data={filteredInvoices}
          renderItem={renderInvoiceCard}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.noDataText}>No invoices found or still loading...</Text>}
        />
      )}
      <LoaderOverlay visible={loading} message="Loading invoices..." />
    </View>
  );
};

const styles = StyleSheet.create({
  listContent: { paddingBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2, borderColor: "#eee", borderWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  invoiceText: { flex: 1, marginLeft: 6, fontWeight: "600", fontSize: 15, color: "#222" },
  collectButton1: { borderRadius: 28, backgroundColor: "transparent" },
  collectButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 28, backgroundColor: '#F1EADB' },
  collectText: { color: "#A67C2E", fontWeight: "400" },
  detailsRow: { flexDirection: "row", marginTop: 12, justifyContent: "space-between", width: "70%" },
  column: { alignItems: "flex-start" },
  label: { fontSize: 12, color: "#888" },
  value: { fontSize: 14, fontWeight: "600", color: "#111", marginTop: 2 },
  noDataText: { textAlign: "center", marginTop: 40, color: "#999", fontSize: 16 },
  productCard: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, marginBottom: 10 },
  productImage: { width: 50, height: 70, borderRadius: 6, resizeMode: "contain" },
  productName: { fontWeight: "500", fontSize: 14, marginBottom: 2, color: "#1F1D1A" },
  productPrice: { fontSize: 12, color: "#7A7266", marginBottom: 5 },
  input: { borderWidth: 1, borderColor: "gray", borderRadius: 5, height: 35, paddingVertical: 0, paddingHorizontal: 10, textAlign: "center", justifyContent: "center", width: 80 },
  plusBtn: { padding: 6 },
  searchInput: { flex: 1, fontSize: 16 },
  reasonItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  toggleWrapper: { marginTop: 10, marginBottom: 6 },
  toggleBase: { paddingVertical: 5, paddingHorizontal: 25, justifyContent: "center" },
  inactive: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#D9D2C3" },
  leftActive: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  rightActive: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  textActive: { color: "#fff", fontWeight: "500", fontSize: 12 },
  textInactive: { color: "#A67C2E", fontWeight: "500", fontSize: 12 },
  reasonRow: { flexDirection: "row", alignItems: "center", marginTop: 10, justifyContent: "space-between" },
  dropdownBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ccc", padding: 4, borderRadius: 5, width: 140, justifyContent: "space-between" },
  reasonDropdown: { position: "absolute", top: "40%", left: "10%", right: "10%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#ccc", borderRadius: 6, maxHeight: 250, zIndex: 10 },
  submitWrapper: { width: "100%", height: "100%" },
  container: { flex: 1, backgroundColor: "white" },
  scrollContainer: { paddingBottom: 100 },
  submitBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#eee" },
  submitButton: { width: "100%", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  dropdown: { height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, width: 140 },
  dropdownContainer: { borderRadius: 6, borderWidth: 1, borderColor: '#ccc' },
  selectedTextStyle: { fontSize: 12, color: '#000' },
  placeholderStyle: { fontSize: 14, color: '#888' },
});

export default ReturnWithInvoice;