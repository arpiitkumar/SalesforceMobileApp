import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    ScrollView
} from "react-native";
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
import { showToast } from '../redux/slices/toastSlice';
import { PriceBookId_var } from '../../config'
import moment from 'moment';
import { useDispatch } from 'react-redux';
import { setSelectedBeatDay } from '../redux/slices/selectedBeatDaySlice';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import { KeyboardAvoidingView, Platform } from "react-native";
import { getUserAccessibleSubCategories } from '../UtilityMain/producthelpers/userLineService.js';
import { getBeatAccountPricingInfo, getVerticalsFromIncoterm, getValidPricingRecords } from '../UtilityMain/producthelpers/pricingService';
import { getCGCloudUOMData, createUOMDataMap } from '../UtilityMain/producthelpers/productUOMService';
import DistributorModal from "../components/modal/DistributorModal";
import { extractPricingValuesInline } from '../UtilityMain/producthelpers/productNormalizationService';
import { calculateItemPricing, getFinalQuantity, isCaseMode } from '../utils/getPricingService';
import getOrderedCategories from '../UtilityMain/producthelpers/categoryPriorityService';

import Entypo from '@react-native-vector-icons/entypo';
import { UNITS_PER_CASE } from "../utils/helper/caseUnits";

const ASOOrderTwo = ({ route, navigation }) => {
    const { distributorIdFromAccount } = route.params || {};
    // console.log('distributorIdFromAccount in ASOOrderTwo', distributorIdFromAccount);
    const [search, setSearch] = useState("");
    const dispatch = useDispatch()
    const [directDbSubDb, setDirectDbSubDb] = useState(null)
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const { apiFetch, apiComposite } = useApiFetch();
    const [RetailerAllData, setRetailerAllData] = useState([]);
    const [recrodTypeId, setRecordTypeId] = useState('')
    const [categories, setCategories] = useState(["All"]);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [subCategories, setSubCategories] = useState(["All"]);
    const [selectedSubCategory, setSelectedSubCategory] = useState("All");
    const [brands, setBrands] = useState(["All"]);
    const [selectedBrand, setSelectedBrand] = useState("All");

    const [mobileUniqueId, setMobileUniqueId] = useState('');

    const [sortAscending, setSortAscending] = useState(true);
    // const { id: beatId, name: beatName } = useSelector((state) => state.beatSelection);

    const round2 = (num) => {
        return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
    };



    const handlePlus = (sfId) => {
        setProducts(prev =>
            prev.map(p => {
                if (p.Sf_Id !== sfId) return p;

                const currentQty = Number(p.quantity) || 0;
                if (currentQty >= 99999) return p; // max cap

                return { ...p, quantity: currentQty + 1 };
            })
        );
    };

    const handleMinus = (sfId) => {
        setProducts(prev =>
            prev.map(p => {
                if (p.Sf_Id !== sfId) return p;

                const currentQty = Number(p.quantity) || 0;
                if (currentQty <= 0) return p;

                return { ...p, quantity: currentQty - 1 };
            })
        );
    };


    const handleQtyInput = (sfId, value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        const qty =
            numericValue === '' ? '' : Math.min(parseInt(numericValue, 10), 999999);

        setProducts(prev =>
            prev.map(p =>
                p.Sf_Id === sfId ? { ...p, quantity: qty } : p
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




    const generateRandomId = () => {
        const timestamp = Date.now(); // current time in ms
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
        return `ORD-${timestamp}-${randomSuffix}`;
    };

    // format Date -> "YYYY-MM-DD"
    const formatDateYYYYMMDD = (d = new Date()) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    const generateRandomOrderNumber = () => {
        const timestamp = Date.now(); // current time in ms
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // random 4-digit number
        return `ORD-${timestamp}-${randomSuffix}`;
    };

    // useFocusEffect(
    //   useCallback(() => {
    //  const uniqueId = `${directDbSubDb}_${RetailerAllData[0]?.ParentId}_${Date.now()}`;
    //   setMobileUniqueId(uniqueId);
    //   console.log('Generated Mobile Unique Id:', uniqueId);
    //  }, [])
    // );

    const isSubmittingRef = useRef(false);
    const processedOrderItemsRef = useRef(new Set());
    const submitOrderItemsToApi = async (orderId, items) => {
        if (processedOrderItemsRef.current.has(orderId)) {
            console.log("⚠️ OrderItems already submitted for:", orderId);
            return true;
        }
        processedOrderItemsRef.current.add(orderId);
        try {
            console.log('Submitting order items (COMPOSITE) for Order ID:', orderId);
            if (!orderId || !items?.length) return false;

            const filteredItems = items.filter(item => {
                const qtyRaw = Number(item.quantity ?? item.Quantity) || 0;
                const pricing = calculateItemPricing(item, qtyRaw);
                return (pricing.GrossAmount__c || 0) > 0 && (pricing.NetAmount__c || 0) > 0;
            });

            if (filteredItems.length === 0) {
                console.log("No items with GrossAmount__c and NetAmount__c > 0 to submit to API.");
                return true;
            }

            const compositeRequest = filteredItems.map((item, index) => {
                // prefer UI qty over DB qty
                const qtyRaw = Number(item.quantity ?? item.Quantity) || 0;
                // normalized pricing (UNCHANGED)
                const pricing = calculateItemPricing(item, qtyRaw);
                // UOM logic (UNCHANGED)
                const isCaseOrder = isCaseMode(item);
                const UOM = isCaseOrder ? "Box" : "Pc";

                return {
                    method: "POST",
                    url: "/services/data/v61.0/sobjects/OrderItem",
                    referenceId: `orderItem_${index}`,
                    body: {
                        OrderId: orderId,
                        PricebookEntryId: item.PriceBookId,
                        Product2Id: item.Sf_Id || item.Product2Id || item.product2Id,
                        Quantity: pricing.actualQty,
                        UOM__c: UOM,
                        UOM_Selected__c: isCaseOrder ? 10 : 20,
                        Order_Quantity_In_Mt__c: pricing.Order_Quantity_In_Mt__c,
                        OrderQtyInCase__c: pricing.OrderQtyInCase__c,
                        Quantity_In_Box__c: isCaseOrder ? qtyRaw : 0,
                        Quantity_In_Pcs__c: isCaseOrder ? 0 : qtyRaw,
                        UnitPrice: round2(pricing.PTR),
                        SRChangedPrice__c: round2(pricing.PTR),
                        Order_Quantity_In_Kg__c: round2(
                            pricing.weightPerUnit * pricing.actualQty
                        ),
                        GrossAmount__c: round2(pricing.GrossAmount__c),
                        Order_Amount__c: round2(pricing.Order_Amount__c),
                        SGST_Amount__c: round2(pricing.SGST_Amount__c),
                        CGST_Amount__c: round2(pricing.CGST_Amount__c),
                        NetAmount__c: round2(pricing.NetAmount__c),
                    },
                };
            });
            const compositePayload = {
                allOrNone: false, // atomic behavior
                compositeRequest,
            };
            console.log('ORDER ITEM COMPOSITE PAYLOAD ===>', JSON.stringify(compositePayload));
            const response = await apiComposite(
                'POST',
                'composite',
                compositePayload
            );
            if (response.status !== 'success') {
                console.error(' OrderItem Composite Failed:', response);
                processedOrderItemsRef.current.delete(orderId);
                return false;
            }
            // optional safety check
            const failedItems =
                response.data?.compositeResponse?.filter(
                    r => r.httpStatusCode !== 201
                ) || [];
            if (failedItems.length) {
                console.error(' Some OrderItems failed:', failedItems);
                processedOrderItemsRef.current.delete(orderId);
                return false;
            }
            console.log('All OrderItems inserted via composite');
            return true;
        } catch (error) {
            console.error(' submitOrderItemsToApi (composite) error:', error);
            processedOrderItemsRef.current.delete(orderId);
            return false;
        }
    };

    const submitOrderWithVisitUpdate = async (totalOrderQuantity) => {
        const compositePayload = {
            compositeRequest: [
                {
                    method: "POST",
                    url: "/services/data/v61.0/sobjects/Order",
                    referenceId: "newOrder",
                    body: {
                        Type: "Secondary Order",
                        AccountId: directDbSubDb,
                        OrderPlacedBy__c: users[0].Sf_Id,
                        Source__c: "App",
                        OrderSubmissionTime__c: new Date().toISOString(),
                        TotalOrderQtyInPcs__c: totalOrderQuantity,
                        Status: "Draft",
                        EffectiveDate: new Date().toISOString(),
                        Pricebook2Id: PriceBookId_var,
                        Secondary_Order_Supplier__c: RetailerAllData[0]?.ParentId,
                        RecordTypeId: recrodTypeId,
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
                    orderNo,
                };
            }
        } else {
            console.log("COMPOSITE REQUEST FAILED ====", response.message);
            return false;
        }
    };

    const saveLocally = async (orderId, isFromApi = false, orderNo, selectedProducts) => {
        const filteredProducts = (selectedProducts || []).filter(item => {
            const qtyRaw = Number(item.quantity ?? item.Quantity) || 0;
            const pricing = calculateItemPricing(item, qtyRaw);
            return (pricing.GrossAmount__c || 0) > 0 && (pricing.NetAmount__c || 0) > 0;
        });

        // compute per-item values and aggregates using shared service
        let totalOrderQuantity = 0;
        let totalOrderKg = 0;
        let totalBaseAmount = 0;
        let totalGSTAmount = 0;
        let totalCGSTAmount = 0;
        let totalSGSTAmount = 0;
        let totalOrderAmount = 0;
        let totalNetAmount = 0;

        const computedItems = filteredProducts.map((item) => {
            const qtyRaw = Number(item.quantity ?? item.Quantity) || 0;
            const pricing = calculateItemPricing(item, qtyRaw);

            const gstAmount = pricing.Order_Amount__c;
            const cgst = pricing.CGST_Amount__c;
            const sgst = pricing.SGST_Amount__c;
            const gross = pricing.GrossAmount__c;
            const net = pricing.NetAmount__c;
            const totalKg = pricing.weightPerUnit * pricing.actualQty;
            const totalMt = pricing.Order_Quantity_In_Mt__c;

            // accumulate totals
            totalOrderQuantity += pricing.actualQty;
            totalOrderKg += totalKg;
            totalBaseAmount += gross;
            totalGSTAmount += (gstAmount || 0);
            totalCGSTAmount += (cgst || 0);
            totalSGSTAmount += (sgst || 0);
            totalOrderAmount += (gstAmount || 0);
            totalNetAmount += (net || 0);

            return {
                original: item,
                computed: {
                    ...pricing,
                    gstAmount,
                    cgstAmount: cgst,
                    sgstAmount: sgst,
                    totalKg,
                    totalMt,
                    orderQtyInCase: pricing.OrderQtyInCase__c,
                    UOM: item.UnitMode === "Case" ? "Box" : "Pc"
                }
            };
        });

        const payload = {
            Sf_Id: orderId,
            RecordTypeId: recrodTypeId,
            TotalAmount: round2(totalNetAmount),
            Type: 'Secondary Order',
            OrderNumber: orderNo,
            AccountId: directDbSubDb,
            OrderPlacedBy__c: users[0].Sf_Id,
            Source__c: 'App',
            OrderSubmissionTime__c: new Date().toISOString(),
            TotalOrderQtyInPcs__c: totalOrderQuantity,
            Status: "Draft",
            EffectiveDate: new Date().toISOString(),
            Secondary_Order_Supplier__c: RetailerAllData[0]?.ParentId,
            Pricebook2Id: PriceBookId_var,
            Mobile_Unique_Id__c: mobileUniqueId,
            is_locally_changed: !isFromApi,
            operation_type: isFromApi ? null : "insert",
            last_modified: Date.now(),
            is_synced: isFromApi,
        };

        await UniversalUpdateInsert({
            ObjectName: 'Order',
            Type: 'insert',
            data: payload,
        });

        // Insert OrderItem with computed fields
        for (const itemWrap of computedItems) {
            const item = itemWrap.original;
            const c = itemWrap.computed;

            const orderItemPayload = {
                Sf_Id: generateRandomOrderNumber(),
                OrderId: orderId,
                Product2Id: item.Sf_Id || item.Product2Id || item.product2Id,
                // Keep Quantity same pattern as before (raw UI quantity) — change to c.actualQty if you want units always
                Quantity: item.quantity ?? item.Quantity,
                UOM__c: c.UOM,
                UOM_Selected__c: isCaseMode(item) ? 10 : 20,
                UnitPrice: round2(c.PTR),
                SRChangedPrice__c: round2(c.PTR),
                CGST_Amount__c: round2(c.CGST_Amount__c),
                SGST_Amount__c: round2(c.SGST_Amount__c),
                Order_Amount__c: round2(c.Order_Amount__c),
                GrossAmount__c: round2(c.GrossAmount__c),
                NetAmount__c: round2(c.NetAmount__c),
                // weights
                Order_Quantity_In_Kg__c: round2(
                    c.weightPerUnit * c.actualQty
                ),
                Order_Quantity_In_Mt__c: c.Order_Quantity_In_Mt__c,
                OrderQtyInCase__c: c.OrderQtyInCase__c,
                Quantity_In_Box__c: isCaseMode(item) ? Number(item.quantity ?? item.Quantity) || 0 : 0,
                Quantity_In_Pcs__c: isCaseMode(item) ? 0 : Number(item.quantity ?? item.Quantity) || 0,
                PricebookEntryId: item.PriceBookId,

                // metadata
                is_locally_changed: !isFromApi,
                // operation_type: isFromApi ? null : "insert",
                last_modified: Date.now(),
                is_synced: isFromApi,
            };

            console.log('Saving OrderItem locally ->', orderItemPayload);

            await UniversalUpdateInsert({
                ObjectName: 'OrderItem',
                Type: 'insert',
                data: orderItemPayload,
            });
        }

        return {
            ok: true,
            itemsSaved: computedItems.length,
            orderId,
            totalOrderQuantity,
            totalOrderKg,
            totalBaseAmount,
            totalGSTAmount,
            totalOrderAmount
        };
    };

    const handleSave = async () => {
        // filter out products where quantity > 0
        const selectedProducts = products.filter(
            (p) => p.quantity && Number(p.quantity) > 0
        );
        console.log("📦 Selected Products with Qty > 0:", JSON.stringify(selectedProducts, null, 2));
        if (selectedProducts.length === 0) {
            dispatch(showToast({ message: 'You do not have any items with quantity!', type: 'warning' }));
            return;
        }

        const invalidProducts = selectedProducts.filter(
            (item) => Number(item.PTR__c) <= 0
        );
        if (invalidProducts.length > 0) {
            dispatch(
                showToast({
                    message: `PTSS value must be greater than 0 for: ${invalidProducts
                        .map(item => item.Name)
                        .join(', ')}`,
                    type: 'error',
                })
            );
            return;
        }


        if (isSubmittingRef.current || loading) {
            return;
        }
        isSubmittingRef.current = true;

        // const selectedProducts = products.filter(
        //     (p) => Number(p.quantity) > 0
        // );

        const totalOrderQuantity = selectedProducts.reduce((sum, item) => {
            const qtyRaw = Number(item.quantity ?? item.Quantity) || 0;
            const actualQty = getFinalQuantity({ ...item, Quantity: qtyRaw, UnitMode: item.UnitMode }, qtyRaw);
            return sum + actualQty;
        }, 0);


        try {
            setLoading(true);
            const connected = await isInternetAvailable();

            let orderId = generateRandomOrderNumber();
            let orderNo = generateRandomOrderNumber();
            let isFromApi = false;

            if (connected) {
                // const orderDataFromApi = await submitToApi();
                const orderDataFromApi = await submitOrderWithVisitUpdate(totalOrderQuantity);
                console.log('orderDataFromApi', orderDataFromApi)
                // if (!orderDataFromApi) return;
                if (!orderDataFromApi) {
                    dispatch(showToast({ message: 'Spot Sales API failed. Please Login again.', type: 'error' }));
                    return;
                }
                if (orderDataFromApi) {
                    orderId = orderDataFromApi.orderId;
                    orderNo = orderDataFromApi.orderNo;
                    isFromApi = true;

                    await submitOrderItemsToApi(orderId, selectedProducts);
                }
            }
            await saveLocally(orderId, isFromApi, orderNo, selectedProducts);

            dispatch(showToast({
                message: isFromApi
                    ? 'Spot Sales have been placed successfully.'
                    : 'Spot Sales saved locally. Will sync when online.',
                type: 'success'
            }));
            // dispatch(showToast({
            //   message: 'Your spot sales have been placed successfully.',
            //   type: 'success'
            // }));

            await UniversalUpdateInsert({
                ObjectName: 'CartItems',
                Type: 'delete_all',
            });

            navigation.goBack()
        } catch (error) {
            console.error(' Order error:', error);
        } finally {
            setLoading(false);
            isSubmittingRef.current = false;
            navigation.goBack()
        }



    };




    const [showModal, setShowModal] = useState(false);
    const distributorId = distributorIdFromAccount;
    const [modalShownOnce, setModalShownOnce] = useState(false);
    const [firstRender, setFirstRender] = useState(true);
    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            // if (firstRender && !modalShownOnce) {
            //     setShowModal(true);
            //     setModalShownOnce(true);
            //     setFirstRender(false);
            // }

            const initialize = async () => {
                setLoading(true);
                try {
                    const AllPicklistData = await UniversalUpdateInsert({
                        ObjectName: 'AllDataPicklist',
                        Type: 'get',
                    });
                    let optionsData = AllPicklistData[0]?.OptionsData;
                    if (typeof optionsData === 'string') {
                        try {
                            optionsData = JSON.parse(optionsData);
                        } catch (e) {
                            console.error('Failed to parse OptionsData:', e);
                        }
                    }
                    const orderRecordTypeId = optionsData?.orderRecordTypeId;
                    setRecordTypeId(orderRecordTypeId);
                    setDirectDbSubDb(distributorId)

                    const retailerdata = await UniversalUpdateInsert({
                        ObjectName: "Account",
                        Type: "get",
                        filters: [
                            { field: 'Sf_Id', value: distributorId }
                        ]
                    });
                    setRetailerAllData(retailerdata)

                    const uniqueId = `${distributorId}_${retailerdata[0]?.ParentId}_${Date.now()}`;
                    // console.log('setMobileUniqueId uniqueId',uniqueId)
                    setMobileUniqueId(uniqueId);

                    const users = await UniversalUpdateInsert({
                        ObjectName: "User",
                        Type: "get",

                    });
                    setUsers(users)

                    let uniquesSubCatMain = []

                    const loggedInUser = await UniversalUpdateInsert({
                        ObjectName: "User",
                        Type: "get",

                    })
                    const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, distributorId);
                    console.log('accessibleSubCategories accessibleSubCategories', accessibleSubCategories)
                    const Product2Data = await UniversalUpdateInsert({
                        ObjectName: "Product2",
                        Type: "get",
                    });
                    // console.log('Product2Data', Product2Data)
                    let Product2 = Product2Data.filter((prod) => {
                        if (accessibleSubCategories.length === 0) return false;
                        return accessibleSubCategories.includes((prod.SubCategory__c || "").trim());
                    })
                    // console.log('Product2', Product2)
                    const StockCheckData = await UniversalUpdateInsert({
                        ObjectName: "Stock_Check__c",
                        Type: "get",
                    });
                    const uomData = await getCGCloudUOMData();
                    const mappedProducts = await Promise.all(
                        Product2.map(async (product) => {

                            // const matchedPricing = validPricingRecords.find(
                            //     (rec) => rec.Fraction__c === product.Sf_Id
                            // );

                            const enrichedProduct = product;

                            const { PTR, PTD } = await extractPricingValuesInline(
                                distributorId,
                                enrichedProduct,
                                suggestedOrder = true
                            );

                            // Extract PTR/PTD (fallbacks)
                            // const PTRValue = PTR ?? (matchedPricing ? matchedPricing.PTR__c : 0);
                            // const PTDValue = PTD ?? (matchedPricing ? matchedPricing.PTD_PTSS__c : 0);

                            const uom = uomData.find(
                                (u) => u.cgcloud__Product__c === product.Sf_Id
                            );

                            return {
                                ...product,
                                PTR__c: PTR,
                                PTD__c: PTD,
                                UnitperCase__c: UNITS_PER_CASE,

                                Weight_Per_Unit_in_KG__c: uom
                                    ? uom.Weight_Per_Unit_in_KG__c
                                    : product.Weight_Per_Unit_in_KG__c,
                            };
                        })
                    );

                    // console.log('ALL PRODUCT SDATATAT---------', mappedProducts)

                    const productsArr = Array.isArray(Product2) ? mappedProducts : [];
                    const stockArr = Array.isArray(StockCheckData) ? StockCheckData : [];
                    const mapped = productsArr.map((p) => ({
                        ...p,
                    }));
                    // console.log("MAPPED::::-------------------------", JSON.stringify(mapped?.length))

                    if (isActive) {
                        setProducts(mapped);
                    }
                    const subCategories = Product2
                        .map((item) => item.Category__c || "Unknown")
                        .filter((value, index, self) => self.indexOf(value) === index);

                    // console.log('category mainm,,,,,', subCategories)

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

                    setBrands(uniqueBrands);


                    const orderedUniqueCategories = await getOrderedCategories(subCategories);
                    console.log('category main from ordered unique', orderedUniqueCategories)
                    setCategories(["All", ...orderedUniqueCategories]);

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
            numericValue === "" ? "" : Math.min(parseInt(numericValue), 999).toString();

        setProducts((prev) =>
            prev.map((p) =>
                p.Sf_Id === sfId ? { ...p, quantity: clampedValue } : p
            )
        );
    };



    const renderItem = ({ item }) => {
        if (item.PTR__c <= 0 || item.PTR__c == null || item.PTR__c == undefined || item.PTR__c == '') return false;

        return (
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

                        <View style={[styles.infoCol, { width: '25%' }]}>
                            {/* <Text style={styles.infoLabel}>Weight/Unit in KG</Text> */}
                            <Text style={[styles.infoLabel]}>W/U in KG</Text>
                            <Text style={styles.infoValue}>{item.Weight_Per_Unit_in_KG__c}</Text>
                        </View>
                        <View style={[styles.infoCol, { width: '25%' }]}>
                            <Text style={styles.infoLabel}>PTSS</Text>

                            <Text style={styles.infoValue}>₹
                                {Number(item.PTR__c).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>


                        </View>
                        <View style={[styles.infoCol, { width: '48%' }]}>
                            <View style={styles.counterAlignedRow}>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => handleMinus(item.Sf_Id)}
                                >
                                    <Entypo name="minus" size={12} color="#fff" />
                                </TouchableOpacity>

                                <TextInput
                                    value={item.quantity?.toString() || ''}
                                    onChangeText={(val) => handleQtyInput(item.Sf_Id, val)}
                                    keyboardType="numeric"
                                    // editable={false}
                                    style={styles.qtyInput}
                                    placeholder="0"
                                />

                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => handlePlus(item.Sf_Id)}
                                >
                                    <Entypo name="plus" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                    </View>
                    <View style={styles.infoRow}>

                    </View>

                    <View style={styles.infoRow}>

                    </View>
                </View>
            </View>
        )
    }

    return (
        <SafeAreaProvider style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
            <View style={styles.headerContainer}>
                <HeaderMain screenName="Sub Db Spot Sales" />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >

                <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>

                    <View style={styles.mainContent}>
                        <View style={{
                            margin: 12,
                            marginBottom: 0,
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
                            <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 4, color: '#111' }}>
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
                                {/* Filter icon */}
                                <FIcon name="sliders" size={14} color="#444" />

                                {/* Sorting direction indicator */}
                                <FIcon
                                    name={sortAscending ? "chevron-up" : "chevron-down"}
                                    size={12}
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
                                        {/* {category} */}
                                        {category?.toLowerCase() === 'flour' ? 'Staples' : category}
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
                                            {
                                                marginTop: 3,
                                                marginBottom: 5,
                                            }
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



                        {/* <FlatList
                            data={filteredProducts}
                            keyExtractor={(item) => item.Sf_Id}
                            renderItem={renderItem}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                            contentContainerStyle={{ paddingBottom: 160 }}
                        /> */}
                        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
                            {filteredProducts.map((item) => (
                                <View key={item.Sf_Id}>
                                    {renderItem({ item })}
                                    <View style={styles.separator} />
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.footer}
                            disabled={filteredProducts.length === 0}
                            onPress={() => {
                                handleSave()
                                //const qtyData = products.filter((p) => p.quantity && Number(p.quantity) > 0);
                                //console.log("Quantities:", JSON.stringify(products));
                            }}

                        >
                            <LinearGradient
                                colors={filteredProducts.length === 0 ? ['#cccccc', '#aaaaaa'] : ["#C9A24D", "#A67C2E", "#C9A24D"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.footerInner}
                            >
                                <Text style={styles.footerText}>Save</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                </View>
            </KeyboardAvoidingView>
            {showModal && (
                <DistributorModal
                    visible={showModal}
                    onClose={() => {
                        setShowModal(false);
                        navigation.goBack()
                    }}
                    onConfirm={() => {
                        setShowModal(false);
                    }}
                />
            )}
            <LoaderOverlay visible={loading} message="Saving spot sales..." />
        </SafeAreaProvider>
    );
};

export default ASOOrderTwo;
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#A67C2E',
    },
    headerContainer: {
        backgroundColor: '#A67C2E',
    },
    container: {
        flex: 1,
        //backgroundColor: '#fff',
    },


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
        // subtle shadow for elevation on Android/iOS
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
        marginBottom: 5,
        borderRadius: 20,
        backgroundColor: "#fff",
        borderColor: "#1E3A8A",
        borderWidth: 1,
        height: 30
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
    value: { fontSize: 12, fontWeight: "600", color: "#222", marginTop: 5 },

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
        bottom: 30,
        marginHorizontal: 15,
        left: 0,
        right: 0,
        height: 50,
    },
    footerInner: {
        flex: 1,
        borderRadius: 26,

        alignItems: "center",
        justifyContent: "center",
        // borderTopLeftRadius: 10,
        // borderTopRightRadius: 10,
    },
    footerText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    infoCol: { width: "48%" },
    ptrInputLarge: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, textAlign: "center", height: 30, fontSize: 13, paddingVertical: 0 },

    infoLabel: { fontSize: 12, fontWeight: "500", color: "#666" },
    infoValue: { fontSize: 13, fontWeight: "700", color: "#000" },
    counterAlignedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingHorizontal: 10 },
    qtyBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#C9A24D", justifyContent: "center", alignItems: "center" },
    qtyInput: { width: 45, height: 30, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, textAlign: "center", fontSize: 14, fontWeight: "700", color: "#000", backgroundColor: "#fff", marginHorizontal: 10, paddingVertical: 0 },

});
