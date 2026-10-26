// CartScreen.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  StatusBar,
  Modal,
  Pressable,
} from "react-native";
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { Gradients } from "../assets/css/MasterCss.js";
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import HeaderMain from '../components/HeaderMain'
import { isInternetAvailable } from '../utils/networkUtils';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { showToast } from '../redux/slices/toastSlice';
import { RootState } from '../redux/store';
import { useNavigation, useRoute } from "@react-navigation/native";
import { PriceBookId_var, OrderRecordTypeId_var } from '../../config'
import LoaderOverlay from '../utils/helper/LoaderOverlay'
import { getCurrentLocation } from '../utils/getCurrentLocation';
import getDistanceInKm from '../utils/helper/GetDistance';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useASOStockItemUpdate from '../utils/Collection/ASOStockItemUpdate';
import { calculateItemPricing, calculateCartTotals, isCaseMode } from '../utils/getPricingService';
import GamificationTakeOrderRewardModal from './GamificationTakeOrderRewardModal';
import { evaluateSchemeResponse } from '../utils/schemeEngine';
import { useFocusEffect } from '@react-navigation/native';
import { convertSharePointUrl } from "../utils/imageHelper";
import { syncVisitRecord } from '../database/dbService/AllDataSync';
import {
  resolveOrderClassification,
  ORDER_TYPES,
} from '../utils/orderClassification/orderClassificationService';
import {
  buildOrderHeaderPayload,
  buildOrderItemPayload,
} from '../utils/orderClassification/orderPayloadBuilder';
import { UNITS_PER_CASE } from "../utils/helper/caseUnits";


export default function CartScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const routeClassification = route.params?.orderClassification;
  const selectedAccount = useSelector((state: RootState) => state.selectedAccount.selectedAccount);
  if (!selectedAccount) return <Text>Loading account details...</Text>;
  const dispatch = useDispatch();
  const { ASOStockItemUpdate } = useASOStockItemUpdate();
  const { apiFetch, apiComposite } = useApiFetch();
  const selectedVisit = useSelector(state => state.selectedVisit);
  const [recordTypeId, setRecordTypeId] = useState('')
  const distributorId = useSelector((state) => state.distributor.id);
  const [users, setUsers] = useState([])
  const [cartItems, setCartItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false)
  const [apiSchemes, setApiSchemes] = useState(null);
  const [orderClassification, setOrderClassification] = useState(
    routeClassification || {
      orderType: ORDER_TYPES.DMS,
      isNonDmsOrder: false,
      baState: null,
      error: null,
    }
  );

  useEffect(() => {
    if (route.params?.orderClassification) {
      setOrderClassification(route.params.orderClassification);
    }
  }, [route.params?.orderClassification]);

  const isSubmittingRef = useRef(false);
  const processedOrderItemsRef = useRef(new Set());

  const [rewardModal, setRewardModal] = useState({
    visible: false,
    points: 0,
    game: '',
  });
  const [schemeTooltip, setSchemeTooltip] = useState({
    visible: false,
    title: '',
    message: '',
    status: 'pending',
  });

  const generateRandomOrderNumber = () => {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${timestamp}-${randomSuffix}`;
  };

  const round2 = (value) => {
    const num = Number(value);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
  };
  const round3 = (value) => {
    const num = Number(value);
    return isNaN(num) ? 0 : Number(num.toFixed(3));
  };
  const round4 = (value) => {
    const num = Number(value);
    return isNaN(num) ? 0 : Number(num.toFixed(3));
  };

  const fetchSchemesForItems = async (items) => {
    try {
      const payload = { productIds: (items || []).map(item => item.Product2Id), AccountId: selectedVisit?.AccountId };
      const schemedataApi = await apiFetch("POST", "scheme-return", payload, "Custom");
      console.log("Scheme Data from API:", JSON.stringify(schemedataApi));
      if (schemedataApi?.status === 'success' && schemedataApi?.data?.responseBody) {
        const resp = schemedataApi.data.responseBody;
        setApiSchemes(resp);
        return resp;
      }
      setApiSchemes(null);
      return null;
    } catch (e) {
      console.error('Failed to fetch scheme-return:', e);
      setApiSchemes(null);
      return null;
    }
  };

  const computeBaseForItem = (item, overrideQty = null, overrideUnitMode = null) => {
    const UnitMode = overrideUnitMode || item.UnitMode || 'Unit';
    const qtyRaw = overrideQty != null ? Number(overrideQty) : Number(item.Quantity || 0);
    const unitPerCase = UNITS_PER_CASE;
    const finalUnits = UnitMode === 'Case' ? qtyRaw * unitPerCase : qtyRaw;
    const unitPrice = Number(item.PTR__c) || Number(item.PTD__c) || 0;
    const grossAmount = round2(unitPrice * finalUnits);
    const orderQtyKg = (Number(item.Weight_Per_Unit_in_KG__c) || 0) * finalUnits;
    const orderQtyMt = orderQtyKg / 1000;
    return {
      finalUnits,
      unitPrice: round2(unitPrice),
      grossAmount,
      orderQtyKg,
      orderQtyMt
    };
  };

  const isFreeItemRecord = (item) =>
    item && (item.IsFree__c === true || item.IsFree__c === 'true' || item.IsFree__c === 1 || item.IsFree__c === '1');

  const getActualQtyForWrapper = (wrapper, totals) => {
    const normalizeUOM = (u) => String(u || '').toLowerCase().trim();
    const isUnitLike = (u) => ['unit', 'units', 'piece', 'pieces', 'pc', 'pcs', 'nos', 'no', 'each'].includes(normalizeUOM(u));
    const isCaseLike = (u) => ['case', 'box', 'ctn', 'carton'].includes(normalizeUOM(u));
    const isKgLike = (u) => ['kg', 'kgs', 'kilogram', 'kilograms'].includes(normalizeUOM(u));

    const buyUOM = normalizeUOM(wrapper.buyUOM);
    const buyType = String(wrapper.buyType || '').toLowerCase();

    if (buyType === 'value' || buyUOM === 'value') return Number(totals.totalGrossRaw || 0);
    if (isKgLike(buyUOM)) return Number(totals.totalKgRaw || 0);
    if (isCaseLike(buyUOM)) return Number(totals.totalCasesRaw || 0);
    if (isUnitLike(buyUOM)) return Number(totals.totalUnitsRaw || 0);
    if (buyType === 'quantity' || buyType === 'volume') return Number(totals.totalUnitsRaw || 0);
    return Number(totals.totalGrossRaw || 0);
  };

  const getWrapperRewardMultiplier = (wrapper, totals) => {
    const minBuy = Number(wrapper.minBuy || 0);
    const isProRate = wrapper.isProRate === true || wrapper.isProRate === 'true';
    const isRepeatable = wrapper.isRepeatableSlab === true || wrapper.isRepeatableSlab === 'true';
    const actualQty = getActualQtyForWrapper(wrapper, totals);
    // console.log('isProRate',isProRate)
    if (minBuy <= 0 || actualQty < minBuy) return 0;
    if (isProRate) return actualQty / minBuy;
    if (isRepeatable) return Math.floor(actualQty / minBuy);
    return 1;
  };

  const computeFreeQuantityForWrapper = (wrapper, totals) => {
    const baseQty = Number(wrapper.quantity || 1) || 1;
    const multiplier = getWrapperRewardMultiplier(wrapper, totals);

    if (multiplier <= 0) return 0;

    // Free quantities should stay whole numbers in cart/DB, so we floor the scaled reward.
    return Math.max(baseQty, Math.floor(baseQty * multiplier));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: compute actual discount for one wrapper given totals + item gross
  // Handles isProRate, isRepeatableSlab for ALL reward types:
  //   - rewardDiscountValue  (fixed ₹ amount)
  //   - rewardDiscountPercentage  (% on taxable gross)
  //   - isFreeProduct  (no discount amount — free item logic handled separately)
  // ─────────────────────────────────────────────────────────────────────────────
  const computeWrapperDiscount = (wrapper, totals, itemGrossTaxable, totalGrossTaxable) => {
    const rewardVal = wrapper.rewardDiscountValue != null ? Number(wrapper.rewardDiscountValue) : null;
    const rewardPct = wrapper.rewardDiscountPercentage != null ? Number(wrapper.rewardDiscountPercentage) : null;
    const multiplier = getWrapperRewardMultiplier(wrapper, totals);

    if (multiplier <= 0) return 0;

    // ── compute base discount amount ──────────────────────────────────────────
    let baseDiscount = 0;

    if (rewardPct != null && !isNaN(rewardPct)) {
      // Percentage reward → apply % on this item's taxable gross
      // multiplier scales the percentage itself
      const effectivePct = rewardPct * multiplier;
      baseDiscount = round2((effectivePct / 100) * itemGrossTaxable);

    } else if (rewardVal != null && !isNaN(rewardVal)) {
      // Value reward → total pool = rewardVal * multiplier
      // allocate to this item proportionally by its gross share
      const totalPool = round2(rewardVal * multiplier);
      const share = totalGrossTaxable > 0 ? (itemGrossTaxable / totalGrossTaxable) : 0;
      baseDiscount = round2(totalPool * share);

    } else if (wrapper.discountForWrapper != null) {
      const fixedVal = Number(wrapper.discountForWrapper) || 0;
      const totalPool = round2(fixedVal * multiplier);
      const share = totalGrossTaxable > 0 ? (itemGrossTaxable / totalGrossTaxable) : 0;
      baseDiscount = round2(totalPool * share);
    }

    return baseDiscount;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: build nudge text for a scheme group
  // ─────────────────────────────────────────────────────────────────────────────
  const buildNudgeText = (wrapper, totals, isUnlocked) => {
    const normalizeUOM = (u) => String(u || '').toLowerCase().trim();
    const isUnitLike = (u) => ['unit', 'units', 'piece', 'pieces', 'pc', 'pcs', 'nos', 'no', 'each'].includes(normalizeUOM(u));
    const isCaseLike = (u) => ['case', 'box', 'ctn', 'carton'].includes(normalizeUOM(u));
    const isKgLike = (u) => ['kg', 'kgs', 'kilogram', 'kilograms'].includes(normalizeUOM(u));

    const fmtRupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtKg = (n) => `${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
    const fmtUnits = (n) => `${Math.ceil(Number(n || 0))} unit${Number(n || 0) > 1 ? 's' : ''}`;
    const fmtCases = (n) => `${Math.ceil(Number(n || 0))} case${Number(n || 0) > 1 ? 's' : ''}`;

    const schemeLabel = wrapper.schemeName || wrapper.raw?.schemeName || 'Scheme';

    if (isUnlocked) {
      return `Applied: ${schemeLabel}`;
    }

    const buyUOM = normalizeUOM(wrapper.buyUOM || '');
    const buyType = String(wrapper.buyType || '').toLowerCase();
    const minBuy = Number(wrapper.minBuy || 0);

    let remaining = 0;
    let remainingLabel = '';

    if (buyType === 'value' || buyUOM === 'value') {
      remaining = Math.max(0, minBuy - totals.totalGrossRaw);
      remainingLabel = fmtRupee(remaining);
    } else if (isKgLike(buyUOM)) {
      remaining = Math.max(0, minBuy - totals.totalKgRaw);
      remainingLabel = fmtKg(remaining);
    } else if (isCaseLike(buyUOM)) {
      remaining = Math.max(0, minBuy - totals.totalCasesRaw);
      remainingLabel = fmtCases(remaining);
    } else {
      remaining = Math.max(0, minBuy - totals.totalUnitsRaw);
      remainingLabel = fmtUnits(remaining);
    }

    if (remaining <= 0) return `Applied: ${schemeLabel}`;
    return `Add ${remainingLabel} more to apply ${schemeLabel}`;
  };

  const getSchemeSlabKey = (entry, fallback = '') =>
    String(entry?.schemeSlabId || entry?.schemeId || fallback).trim();

  const dedupeBySchemeKey = (entries = [], fallbackPrefix = 'scheme') => {
    const seen = new Set();
    const out = [];

    (entries || []).forEach((entry, index) => {
      const key = getSchemeSlabKey(entry, `${fallbackPrefix}-${index}`);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(entry);
    });

    return out;
  };

  const getTotalsForWrappers = (itemsLocal = [], slabWrappers = [], fallbackItem = null) => {
    const eligibleIds = new Set(
      (slabWrappers || [])
        .map((wrapper) => String(wrapper?.inputProductId || '').trim())
        .filter(Boolean)
    );

    const totals = {
      totalGrossRaw: 0,
      totalKgRaw: 0,
      totalCasesRaw: 0,
      totalUnitsRaw: 0,
    };

    const sourceItems = eligibleIds.size
      ? (itemsLocal || []).filter((candidate) => {
        if (isFreeItemRecord(candidate)) return false;
        const candidateId = String(candidate?.Product2Id || candidate?.Sf_Id || candidate?.id || '').trim();
        return eligibleIds.has(candidateId);
      })
      : (fallbackItem && !isFreeItemRecord(fallbackItem) ? [fallbackItem] : []);

    sourceItems.forEach((candidate) => {
      const base = candidate?._base || computeBaseForItem(candidate, candidate?.Quantity, candidate?.UnitMode);
      const unitPerCase = UNITS_PER_CASE;
      totals.totalGrossRaw += Number(base?.grossAmount || 0);
      totals.totalKgRaw += Number(base?.orderQtyKg || 0);
      totals.totalUnitsRaw += Number(base?.finalUnits || 0);
      totals.totalCasesRaw += Number(base?.finalUnits || 0) / unitPerCase;
    });

    return totals;
  };

  const getRemainingForWrapper = (wrapper, totals) => {
    const minBuy = Number(wrapper?.minBuy || 0);
    const actualQty = getActualQtyForWrapper(wrapper, totals);
    return Math.max(0, minBuy - actualQty);
  };

  const buildSchemeBadgesForItem = (item, itemsLocal, schemesResp, lineResult) => {
    if (!item || isFreeItemRecord(item)) return [];

    const globalSchemeWrappers = schemesResp?.productsWithSchemes?.flatMap((product) => product?.schemeWrappers || []) || [];
    const itemProductId = String(item?.Product2Id || item?.Sf_Id || item?.id || '').trim();
    const appliedDetails = dedupeBySchemeKey(lineResult?.details || [], 'applied');
    const appliedKeys = new Set(appliedDetails.map((detail, index) => getSchemeSlabKey(detail, `applied-${index}`)));

    const pendingWrappers = dedupeBySchemeKey(
      globalSchemeWrappers.filter((wrapper) => String(wrapper?.inputProductId || '').trim() === itemProductId),
      'pending'
    ).filter((wrapper, index) => !appliedKeys.has(getSchemeSlabKey(wrapper, `pending-${index}`)));

    const appliedBadges = appliedDetails.map((detail, index) => ({
      key: `applied-${getSchemeSlabKey(detail, `scheme-${index}`)}`,
      text: buildNudgeText(detail, null, true),
      status: 'applied',
    }));

    const pendingBadges = pendingWrappers
      .map((wrapper, index) => {
        const slabKey = getSchemeSlabKey(wrapper, `pending-${index}`);
        const slabWrappers = globalSchemeWrappers.filter(
          (candidate, candidateIndex) => getSchemeSlabKey(candidate, `slab-${candidateIndex}`) === slabKey
        );
        const totals = getTotalsForWrappers(itemsLocal, slabWrappers, item);
        const remaining = getRemainingForWrapper(wrapper, totals);
        const text = remaining > 0
          ? buildNudgeText(wrapper, totals, false)
          : `Complete scheme conditions to apply ${wrapper?.schemeName || wrapper?.raw?.schemeName || 'Scheme'}`;
        return {
          key: `pending-${slabKey}`,
          text,
          status: 'pending',
        };
      })
      .filter((badge) => badge?.text);

    return [...appliedBadges, ...pendingBadges];
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN: applyApiSchemesToItems
  // ─────────────────────────────────────────────────────────────────────────────
  const applyApiSchemesToItems = (itemsLocal, schemesResp) => {
    let items = (itemsLocal || []).map(it => ({ ...it }));

    items.forEach(item => {
      item._base = computeBaseForItem(item, item.Quantity, item.UnitMode);
      item._schemeDiscountTotal = 0;
      item.Calculate_AppliedDiscount__c = 0;
      item.AppliedDiscount__c = 0;
      item._hasFreeFromApi = [];
      item._schemeBadges = [];
      item.Nudge = null;
    });

    const finalizeItems = () => {
      items.forEach(item => {
        const base = item._base || computeBaseForItem(item, item.Quantity, item.UnitMode);

        if (isFreeItemRecord(item)) {
          item.Calculate_AppliedDiscount__c = 0;
          item.AppliedDiscount__c = 0;
          item.GrossAmount__c = 0;
          item.CGST_Amount__c = 0;
          item.SGST_Amount__c = 0;
          item.Order_Amount__c = 0;
          item.NetAmount__c = 0;
          item.Order_Quantity_In_Mt__c = round4((item._base?.orderQtyMt || 0));
          return;
        }

        const gross = round2((base.grossAmount || 0) / 1.05);
        const aggregatedDiscount = round2(item._schemeDiscountTotal || 0);

        let cgstPerc = Number(item.CGST__c);
        let sgstPerc = Number(item.SGST__c);
        if (isNaN(cgstPerc) || isNaN(sgstPerc)) {
          const gstPerc = Number(item.GSTPercentage__c) || 0;
          cgstPerc = gstPerc / 2;
          sgstPerc = gstPerc / 2;
        }

        const taxable = round2(Math.max(0, gross - aggregatedDiscount));
        const cgstAmt = round2((taxable * (cgstPerc || 0)) / 100);
        const sgstAmt = round2((taxable * (sgstPerc || 0)) / 100);
        const orderAmt = round2(taxable);
        const net = round2(orderAmt + cgstAmt + sgstAmt);

        item.Calculate_AppliedDiscount__c = aggregatedDiscount;
        item.AppliedDiscount__c = aggregatedDiscount;
        item.GrossAmount__c = gross;
        item.CGST_Amount__c = cgstAmt;
        item.SGST_Amount__c = sgstAmt;
        item.Order_Amount__c = orderAmt;
        item.NetAmount__c = net;
        item.Order_Quantity_In_Mt__c = round4(base.orderQtyMt || 0);
      });

      return items;
    };

    if (!schemesResp) {
      return finalizeItems();
    }

    const normalizedSchemeItems = items.map((item, index) => ({
      key: String(item.id || item.Sf_Id || item.Product2Id || index).trim(),
      productId: String(item.Product2Id || item.Sf_Id || item.id || "").trim(),
      units: item._base?.finalUnits || 0,
      unitPerCase: UNITS_PER_CASE,
      weightPerUnitKg: Number(item.Weight_Per_Unit_in_KG__c) || 0,
      unitPrice: item._base?.unitPrice || 0,
      isFree: isFreeItemRecord(item),
    }));

    const { lineResults, freeRewardsByProductId } = evaluateSchemeResponse({
      items: normalizedSchemeItems,
      schemesResp,
    });

    items.forEach((item, index) => {
      const lineKey = String(item.id || item.Sf_Id || item.Product2Id || index).trim();
      const lineResult = lineResults[lineKey] || { discount: 0, details: [] };
      item._schemeDiscountTotal = round2(lineResult.discount || 0);
      item._schemeBadges = buildSchemeBadgesForItem(item, items, schemesResp, lineResult);
      item.Nudge = item._schemeBadges.length ? item._schemeBadges.map((badge) => badge.text).join(' · ') : null;
    });

    const qualifyingFreeIds = new Set(Object.keys(freeRewardsByProductId || {}));

    items = items.filter(it => {
      if (isFreeItemRecord(it)) return qualifyingFreeIds.has(it.Product2Id);
      return true;
    });

    Object.keys(freeRewardsByProductId || {}).forEach(prodId => {
      const wrapper = freeRewardsByProductId[prodId];
      const addQty = Number(wrapper.quantity || 1);
      const unitMode = (wrapper.focUom && String(wrapper.focUom).toLowerCase().includes('case')) ? 'Case' : 'Unit';
      const existingFreeIndex = items.findIndex(it => it.Product2Id === prodId && isFreeItemRecord(it));

      if (existingFreeIndex >= 0) {
        const updatedFreeItem = {
          ...items[existingFreeIndex],
          Name: wrapper.productName || items[existingFreeIndex]?.Name || 'Free Product',
          Quantity: addQty,
          UnitMode: unitMode,
          UnitperCase__c: UNITS_PER_CASE,
          PriceBookId: wrapper.pricebookEntryId || items[existingFreeIndex]?.PriceBookId || '',
          Weight_Per_Unit_in_KG__c: Number(wrapper.productWeightInKgs) || Number(items[existingFreeIndex]?.Weight_Per_Unit_in_KG__c) || 0,
          Nudge: `Free item from ${wrapper.schemeName || 'scheme'}`,
        };
        updatedFreeItem._base = computeBaseForItem(updatedFreeItem, updatedFreeItem.Quantity, updatedFreeItem.UnitMode);
        items[existingFreeIndex] = updatedFreeItem;
      } else {
        const free_priceBook = allProductsRef.current.filter(p => String(p.Sf_Id) === String(wrapper.productId))
        const newFreeItem = {
          id: `free_${prodId}_${Date.now()}`,
          Sf_Id: `FREE_${Date.now()}`,
          Product2Id: prodId,
          Name: wrapper.productName || 'Free Product',
          PTR__c: 0,
          PTD__c: 0,
          UnitperCase__c: UNITS_PER_CASE,
          UnitMode: unitMode,
          Quantity: addQty,
          IsFree__c: true,
          PriceBookId: free_priceBook?.[0]?.PriceBookId || wrapper.pricebookEntryId || '',
          Weight_Per_Unit_in_KG__c: Number(wrapper.productWeightInKgs) || 0,
          Calculate_AppliedDiscount__c: 0,
          AppliedDiscount__c: 0,
          GrossAmount__c: 0,
          CGST_Amount__c: 0,
          SGST_Amount__c: 0,
          Order_Amount__c: 0,
          NetAmount__c: 0,
          Nudge: `Free item from ${wrapper.schemeName || 'scheme'}`,
        };
        items.push(newFreeItem);
      }
    });

    return finalizeItems();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // syncFreeItemsWithDB — unchanged
  // ─────────────────────────────────────────────────────────────────────────────
  const syncFreeItemsWithDB = async (beforeCart = [], afterCart = []) => {
    try {
      const isFreeCheck = (it) =>
        it && (it.IsFree__c === true || it.IsFree__c === 'true' || it.IsFree__c === 1 || it.IsFree__c === '1');

      const beforeFree = (beforeCart || []).filter(isFreeCheck);
      const afterFree = (afterCart || []).filter(isFreeCheck);

      const afterFreeProdSet = new Set(afterFree.map(i => i.Product2Id));
      const beforeFreeProdMap = new Map(beforeFree.map(i => [i.Product2Id, i]));

      for (const bf of beforeFree) {
        if (!afterFreeProdSet.has(bf.Product2Id)) {
          try {
            await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'delete', data: { id: bf.id } });
            console.log('Deleted orphan free item from DB:', bf.Product2Id, bf.id);
          } catch (err) {
            console.error('Failed to delete orphan free item', bf, err);
          }
        }
      }

      const beforeFreeProdSet = new Set(beforeFree.map(i => i.Product2Id));
      for (const af of afterFree) {
        if (!beforeFreeProdSet.has(af.Product2Id)) {
          try {
            const toInsert = { ...af };
            if (!toInsert.id) toInsert.id = `free_${toInsert.Product2Id}_${Date.now()}`;
            await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'insert', data: [toInsert] });
            console.log('Inserted new free item into DB:', toInsert.Product2Id);
          } catch (err) {
            console.error('Failed to insert new free item', af, err);
          }
        } else {
          try {
            const dbItem = beforeFreeProdMap.get(af.Product2Id);
            const toUpsert = { ...af, id: dbItem?.id || af.id };
            await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'insert', data: [toUpsert] });
          } catch (err) {
            console.error('Failed to upsert existing free item', af, err);
          }
        }
      }
    } catch (err) {
      console.error('syncFreeItemsWithDB error', err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // useEffect: initialize cart on mount
  // ─────────────────────────────────────────────────────────────────────────────
  const allProductsRef = useRef([]);
  useEffect(() => {
    const initialize = async () => {
      try {
        const u = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });
        setUsers(u || []);

        const userId = u?.[0]?.Sf_Id || u?.[0]?.Id;
        if (!routeClassification && userId) {
          const classification = await resolveOrderClassification({ userId });
          setOrderClassification(classification);
        }

        const orders = await UniversalUpdateInsert({ ObjectName: 'Order', Type: 'get' });
        const orderItems = await UniversalUpdateInsert({ ObjectName: 'OrderItem', Type: 'get' });

        const items = await UniversalUpdateInsert({
          ObjectName: 'CartItems',
          Type: 'get',
          filters: [{ field: "VisitId", value: selectedVisit.sfId }]
        });

        const allProductsforfree = await UniversalUpdateInsert({ ObjectName: "Product2", Type: "get" });
        allProductsRef.current = allProductsforfree;

        console.log('------------------------------ PRODUCT DATA FROM LOCAL DB ------------------------------');
        console.log(JSON.stringify(allProductsforfree, null, 2));
        console.log('------------------------------ SELECTED CART PRODUCT DATA ------------------------------');
        console.log(JSON.stringify(items || [], null, 2));
        console.log('-------------------------------------------------------------------------------------------');


        const schemesResp = await fetchSchemesForItems(items || []);

        const normalized = (items || []).map(it => ({
          ...it,
          Quantity: Number(it.Quantity) || 0,
          UnitMode: it.UnitMode || 'Case'
        }));

        let finalItems = normalized;
        if (schemesResp) {
          finalItems = applyApiSchemesToItems(normalized, schemesResp);
        } else {
          finalItems = normalized.map(it => {
            const pricing = calculateItemPricing ? calculateItemPricing(it) : {};
            return {
              ...it,
              Order_Quantity_In_Mt__c: pricing.Order_Quantity_In_Mt__c,
              OrderQtyInCase__c: pricing.OrderQtyInCase__c,
              GrossAmount__c: pricing.GrossAmount__c,
              CGST_Amount__c: pricing.CGST_Amount__c,
              SGST_Amount__c: pricing.SGST_Amount__c,
              Order_Amount__c: pricing.Order_Amount__c,
              NetAmount__c: pricing.NetAmount__c,
              Calculate_AppliedDiscount__c: pricing.Calculate_AppliedDiscount__c || 0,
            };
          });
        }

        // console.log('finalItems ', JSON.stringify(finalItems))
        setCartItems(finalItems);

        const AllPicklistData = await UniversalUpdateInsert({ ObjectName: 'AllDataPicklist', Type: 'get' });
        let optionsData = AllPicklistData[0]?.OptionsData;
        if (typeof optionsData === 'string') {
          try { optionsData = JSON.parse(optionsData); } catch (e) { console.error('Failed parse OptionsData', e); }
        }
        setRecordTypeId(optionsData?.orderRecordTypeId || OrderRecordTypeId_var || '');
      } catch (err) {
        console.error(' Failed to load cart items:', err);
        Alert.alert('Error', 'Could not load cart items.');
      }
    };

    initialize();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // updateQuantity
  // ─────────────────────────────────────────────────────────────────────────────
  const updateQuantity = async (id, newQty) => {
    console.log('newQty', newQty)
    const targetItemforvalidation = cartItems.find(it => it.id === id);
    const unitMode = targetItemforvalidation?.UnitMode || 'Unit';
    const currentQty = Number(targetItemforvalidation?.Quantity || 0);
    let numericNewQty = Number(newQty);

    // Limit maximum bounds to 9999999
    if (numericNewQty > 9999999) {
      numericNewQty = 9999999;
    }

    const proceedWithUpdate = async (qtyToSet) => {
      const targetItem = cartItems.find(it => it.id === id);
      const isFree = targetItem && (targetItem.IsFree__c === true || targetItem.IsFree__c === 'true' || targetItem.IsFree__c === 1 || targetItem.IsFree__c === '1');

      if (isFree) {
        dispatch(showToast({ message: 'Quantity cannot be changed for free items.', type: 'warning' }));
        return;
      }

      const beforeCartSnapshot = cartItems.slice();

      const updatedLocal = cartItems.map(item =>
        item.id === id ? { ...item, Quantity: Number(qtyToSet) } : { ...item }
      );

      const afterApply = apiSchemes
        ? applyApiSchemesToItems(updatedLocal, apiSchemes)
        : updatedLocal.map(it => {
          const pricing = calculateItemPricing ? calculateItemPricing(it, it.Quantity) : {};
          return {
            ...it,
            Order_Quantity_In_Mt__c: pricing.Order_Quantity_In_Mt__c,
            GrossAmount__c: pricing.GrossAmount__c,
            Order_Amount__c: pricing.Order_Amount__c,
            NetAmount__c: pricing.NetAmount__c,
            Calculate_AppliedDiscount__c: pricing.Calculate_AppliedDiscount__c || 0
          };
        });

      setCartItems(afterApply);

      const itemToUpdate = afterApply.find(it => it.id === id);
      try {
        if (itemToUpdate) {
          await UniversalUpdateInsert({ ObjectName: "CartItems", Type: "insert", data: [itemToUpdate] });
        }
      } catch (err) {
        console.error(" Failed to update quantity:", err);
      }

      try {
        await syncFreeItemsWithDB(beforeCartSnapshot, afterApply);
      } catch (err) {
        console.error(" Failed to sync free items after quantity change:", err);
      }
    };

    if (numericNewQty > currentQty && numericNewQty > 99) {
      Alert.alert(
        "Confirm Quantity",
        `You have entered a quantity greater than 99 (${numericNewQty} ${unitMode === 'Case' ? 'Cases' : 'Units'}) for this product (${targetItemforvalidation?.Name || 'Product'}). Do you want to submit this quantity?`,
        [
          {
            text: "No",
            onPress: () => {
              // Revert to 99
              proceedWithUpdate(99);
            },
            style: "cancel"
          },
          {
            text: "Yes",
            onPress: () => {
              proceedWithUpdate(numericNewQty);
            }
          }
        ]
      );
    } else {
      await proceedWithUpdate(numericNewQty);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // toggleUnitMode
  // ─────────────────────────────────────────────────────────────────────────────
  const toggleUnitMode = async (id, mode) => {
    const itemToToggle = cartItems.find(it => it.id === id);
    const isFree = itemToToggle && (itemToToggle.IsFree__c === true || itemToToggle.IsFree__c === 'true' || itemToToggle.IsFree__c === 1 || itemToToggle.IsFree__c === '1');

    if (isFree) {
      dispatch(showToast({ message: 'Unit mode cannot be changed for free items.', type: 'warning' }));
      return;
    }

    const beforeCartSnapshot = cartItems.slice();

    const updatedLocal = cartItems.map(item => {
      if (item.id === id) {
        let finalQty = Number(item.Quantity || 0);
        if (mode === 'Case' && finalQty > 99) {
          finalQty = 99;
        } else if (mode === 'Unit' && finalQty > 99999) {
          finalQty = 99999;
        }
        return { ...item, UnitMode: mode, Quantity: finalQty };
      }
      return { ...item };
    });

    const afterApply = apiSchemes ? applyApiSchemesToItems(updatedLocal, apiSchemes) : updatedLocal;
    setCartItems(afterApply);

    const itemToUpdate = afterApply.find(it => it.id === id);
    if (!itemToUpdate?.Sf_Id) {
      console.error(' Sf_Id not found for item:', itemToUpdate);
    }

    try {
      if (itemToUpdate) {
        await UniversalUpdateInsert({
          ObjectName: 'CartItems',
          Type: 'insert',
          data: [{ ...itemToUpdate, Sf_Id: itemToUpdate.Sf_Id }]
        });
      }
    } catch (err) {
      console.error(' Failed to update unit mode:', err);
    }

    try {
      await syncFreeItemsWithDB(beforeCartSnapshot, afterApply);
    } catch (err) {
      console.error(" Failed to sync free items after toggling unit mode:", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // deleteItem
  // ─────────────────────────────────────────────────────────────────────────────
  const deleteItem = async (id) => {
    const item = cartItems.find(ci => ci.id === id);
    const isFree = item && (item.IsFree__c === true || item.IsFree__c === 'true' || item.IsFree__c === 1 || item.IsFree__c === '1');

    if (isFree) {
      dispatch(showToast({ message: 'This is a free item — it cannot be removed.', type: 'warning' }));
      return;
    }

    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            try {
              await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'delete', data: { id } });

              const freshCart = await UniversalUpdateInsert({
                ObjectName: 'CartItems',
                Type: 'get',
                filters: [{ field: "VisitId", value: selectedVisit.sfId }]
              });

              const schemesResp = await fetchSchemesForItems(freshCart || []);
              const recalculated = schemesResp
                ? applyApiSchemesToItems(freshCart || [], schemesResp)
                : freshCart || [];

              const freeItemsToDelete = freshCart.filter(i =>
                i.IsFree__c === true || i.IsFree__c === 'true' || i.IsFree__c === 1 || i.IsFree__c === '1'
              );

              for (const free of freeItemsToDelete) {
                if (!recalculated.find(r => r.Product2Id === free.Product2Id && r.IsFree__c)) {
                  await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'delete', data: { id: free.id } });
                }
              }

              setCartItems(recalculated);
            } catch (err) {
              console.error(' Failed to delete item:', err);
            }
          }
        }
      ]
    );
  };

  const totals = useMemo(() => calculateCartTotals(cartItems), [cartItems]);

  const distanceCounterAccount = async () => {
    const { latitude, longitude } = await getCurrentLocation();
    if (selectedVisit?.BillingLatitude && selectedVisit?.BillingLongitude) {
      const distance = getDistanceInKm(
        latitude, longitude,
        selectedVisit?.BillingLatitude,
        selectedVisit?.BillingLongitude
      );
      console.log("Distance from Account location:", distance.toFixed(2), "km");
      return distance;
    }
    return 0;
  };



  const [mobileUniqueId, setMobileUniqueId] = useState('');
  useFocusEffect(
    useCallback(() => {
      const uniqueId = `${selectedVisit.AccountId__c || selectedVisit.AccountId}_${selectedVisit.sfId || selectedVisit.Sf_Id}_${Date.now()}`;
      setMobileUniqueId(uniqueId);
      console.log('Generated Mobile Unique Id:', uniqueId);
    }, [])
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // submitOrderWithVisitUpdate — unchanged
  // ─────────────────────────────────────────────────────────────────────────────
  const submitOrderWithVisitUpdate = async () => {
    const { latitude, longitude } = await getCurrentLocation();
    const Accountdistance = await distanceCounterAccount();

    /* Original composite order creation code:
    const compositePayload = {
      compositeRequest: [
        {
          method: "POST",
          // Original URL:
          // url: "/services/data/v61.0/sobjects/Order",
          url: "/services/data/v61.0/sobjects/Order__c",
          referenceId: "newOrder",
          body: {
            AccountId: selectedVisit.AccountId__c,
            EffectiveDate__c: new Date().toISOString().split("T")[0],
            // Type: "Secondary Order",
            // AccountId: selectedVisit.AccountId__c,
            // OrderPlacedBy__c: users[0].Sf_Id,
            // Source__c: "App",
            // RecordTypeId: recrodTypeId,
            // OrderSubmissionTime__c: new Date().toISOString(),
            // TotalOrderQtyInPcs__c: totals.totalUnits,
            // Visit__c: selectedVisit.sfId,
            // Beat__c: selectedVisit.Beat__c,
            // Status: "Draft",
            // EffectiveDate: new Date().toISOString(),
            // Secondary_Order_Supplier__c: distributorId,
            // Pricebook2Id: PriceBookId_var,
            // Mobile_Unique_Id__c: mobileUniqueId,
          },
        },
        {
          method: "PATCH",
          url: `/services/data/v61.0/sobjects/Visit/${selectedVisit.sfId}`,
          referenceId: "updateVisit",
          body: {
            ProductiveCall__c: true,
            SRTransactionTime__c: new Date().toISOString().split("T")[1],
            SRTransactionLocation__Longitude__s: longitude,
            SRTransactionLocation__Latitude__s: latitude,
            LocationVarianceOrdertoSCA__c: Accountdistance,
          },
        },
        {
          method: "GET",
          // Original URL:
          // url: "/services/data/v61.0/sobjects/Order/@{newOrder.id}?fields=OrderNumber",
          url: "/services/data/v61.0/sobjects/Order__c/@{newOrder.id}?fields=Name",
          referenceId: "fetchOrderNumber"
        }
      ],
      allOrNone: true,
    };
    // console.log('compositePayload',JSON.stringify(compositePayload))
    const response = await apiComposite("POST", "composite", compositePayload);
    // console.log('Composite Response', JSON.stringify(response))
    if (response.status === "success") {
      const orderResult = response.data.compositeResponse.find(r => r.referenceId === "newOrder");
      const visitResult = response.data.compositeResponse.find(r => r.referenceId === "updateVisit");
      const orderNumberResult = response.data.compositeResponse.find(r => r.referenceId === "fetchOrderNumber");

      if (orderResult.httpStatusCode === 201) {
        const orderId = orderResult.body.id;
        // Original:
        // const orderNo = orderNumberResult?.body?.OrderNumber || null;
        const orderNo = orderNumberResult?.body?.Name || null;
        return { orderId, orderNo, visitUpdated: visitResult.httpStatusCode === 204 };
      }
    } else {
      console.log("COMPOSITE REQUEST FAILED ====", response.message);
      return false;
    }
    */

    // Standard API Call Flow:
    try {
      const accountId = selectedVisit.AccountId__c || selectedVisit.AccountId;
      if (!accountId) {
        const err = "Cannot place spot sales: Missing AccountId on current visit.";
        console.error("❌", err);
        return { success: false, error: err };
      }

      const isNonDms = !!orderClassification.isNonDmsOrder;

      // 1. Create the Order__c record — EXACT required payload
      const orderPayload = buildOrderHeaderPayload({
        AccountId__c: accountId,
        ...(distributorId ? { Secondary_Order_Supplier__c: distributorId } : {}),
        ...(users[0]?.Sf_Id ? { Order_Placed_By__c: users[0].Sf_Id } : {}),
        Order_Source__c: 'SFA',
        Status__c: users[0]?.DeveloperName === 'H_T_ASO' ? 'Completed' : 'Draft',
        EffectiveDate__c: new Date().toISOString().split("T")[0],
        Order_Submission_DateTime__c: new Date().toISOString(),
        RecordTypeId: recordTypeId || OrderRecordTypeId_var || null,
      }, orderClassification);

      console.log("📤 Submitting Order Payload to sobjects/Order__c:", JSON.stringify(orderPayload));
      const orderResponse = await apiFetch("POST", "sobjects/Order__c", orderPayload, "SObjects");
      console.log("📥 Order API Response:", JSON.stringify(orderResponse));

      if (orderResponse.status !== "success" || !orderResponse.data?.id) {
        let errorMsg = orderResponse.message || "Failed to create Spot Sales on Salesforce";
        if (orderResponse?.details) {
          if (Array.isArray(orderResponse.details)) {
            errorMsg = orderResponse.details.map(d => d.message || JSON.stringify(d)).join("; ");
          } else if (typeof orderResponse.details === "object") {
            errorMsg = orderResponse.details.message || JSON.stringify(orderResponse.details);
          }
        }
        console.error("❌ ORDER API CALL FAILED:", errorMsg);
        return { success: false, error: errorMsg, details: orderResponse?.details };
      }
      const orderId = orderResponse.data.id;

      // 2. Fetch the created Order__c Auto-number (Name) via standard apiFetch GET
      const fetchResponse = await apiFetch("GET", `sobjects/Order__c/${orderId}`, {}, "SObjects");
      const orderNo = fetchResponse.status === "success" ? fetchResponse.data.Name : null;

      // 3. Submit Order_Item__c line items to Salesforce API
      const uniqueCartItems = removeDuplicatePaidItems(cartItems);
      const filteredItems = uniqueCartItems.filter(item => {
        const isFree =
          item.IsFree__c === true ||
          item.IsFree__c === 'true' ||
          item.IsFree__c === 1 ||
          item.IsFree__c === '1';
        if (isFree) return true;
        if (isNonDms) return (Number(item.Quantity) || 0) > 0;
        return Number(item.GrossAmount__c) > 0 && Number(item.NetAmount__c) > 0;
      });

      // Use the custom Order_Item__c endpoint and payload for online orders,
      // matching the offline synchronization path.
      const itemsSynced = await submitOrderItemsToApi(orderId, filteredItems);

      // 4. Patch the Visit record productivity via standard apiFetch PATCH
      const visitId = selectedVisit.sfId || selectedVisit.Sf_Id;
      let visitUpdated = false;
      if (visitId && !visitId.startsWith('LOC_') && !visitId.startsWith('VIS_')) {
        const visitPayload = {
          ProductiveCall__c: true,
          SRTransactionTime__c: new Date().toISOString().split("T")[1],
          SRTransactionLocation__Longitude__s: longitude,
          SRTransactionLocation__Latitude__s: latitude,
          LocationVarianceOrdertoSCA__c: Accountdistance,
        };
        const visitResponse = await apiFetch("PATCH", `sobjects/Visit__c/${visitId}`, visitPayload, "SObjects");
        visitUpdated = visitResponse.status === "success";
      }

      return { success: true, orderId, orderNo, visitUpdated, itemsSynced };
    } catch (err) {
      console.error("❌ Standard API order creation failed with exception:", err);
      return { success: false, error: err.message || "Unexpected error during spot sales creation" };
    }
  };

  const ASOOrderComplete = async (orderId) => {
    const compositePayload = {
      compositeRequest: [
        {
          method: "PATCH",
          url: `/services/data/v61.0/sobjects/Order/${orderId}`,
          referenceId: "updateOrder",
          body: { Status: "Completed" },
        },
      ],
      allOrNone: true,
    };
    const response = await apiComposite("POST", "composite", compositePayload);
    if (response.status === "success") {
      const orderResult = response.data.compositeResponse.find(r => r.referenceId === "updateOrder");
      if (orderResult.httpStatusCode === 201) return true;
    } else {
      console.log("COMPOSITE REQUEST FAILED ====", response.message);
      return false;
    }
  };

  const removeDuplicatePaidItems = (items = []) => {
    const seenPaidProducts = new Set();
    return items.filter(item => {
      const isFree =
        item.IsFree__c === true ||
        item.IsFree__c === 'true' ||
        item.IsFree__c === 1 ||
        item.IsFree__c === '1';
      // Free items always allowed
      if (isFree) {
        return true;
      }
      // product id
      const productId = item.Product2Id || item.product2Id;
      // duplicate paid item found
      if (seenPaidProducts.has(productId)) {
        console.log('⚠️ Duplicate paid item removed:', productId);
        return false;
      }
      seenPaidProducts.add(productId);
      return true;
    });
  };
  const submitOrderItemsToApi = async (orderId, items) => {
    try {
      if (processedOrderItemsRef.current.has(orderId)) {
        console.log("⚠️ OrderItems already submitted for:", orderId);
        return true;
      }
      processedOrderItemsRef.current.add(orderId);

      if (!orderId || !items?.length) return false;

      const filteredItems = items.filter(item => {
        const isFree =
          item.IsFree__c === true ||
          item.IsFree__c === 'true' ||
          item.IsFree__c === 1 ||
          item.IsFree__c === '1';
        if (isFree) {
          return true;
        }
        // return Number(item.GrossAmount__c) > 0 && Number(item.NetAmount__c) > 0;
        const grossAmount = Number(item.GrossAmount__c);
        const netAmount = Number(item.NetAmount__c);
        // Reject if null, undefined, empty string, NaN, or <= 0
        if (isNaN(grossAmount) || isNaN(netAmount)) {
          console.warn(`Invalid amount for product ${item.Product2Id}:`, {
            GrossAmount__c: item.GrossAmount__c,
            NetAmount__c: item.NetAmount__c
          });
          return false;
        }
        if (grossAmount <= 0 || netAmount <= 0) {
          console.warn(`Zero/negative amount for product ${item.Product2Id}:`, {
            GrossAmount__c: grossAmount,
            NetAmount__c: netAmount
          });
          return false;
        }
        return true;
      });

      const compositeRequest = filteredItems.map((item, index) => {
        const unitPerCase = UNITS_PER_CASE;
        const isCaseOrder = isCaseMode(item);
        const finalQuantity = isCaseOrder
          ? (Number(item.Quantity) || 0) * unitPerCase
          : (Number(item.Quantity) || 0);
        const itemData = {
          ...item,
          Product2Id: item.Product2Id || item.product2Id || item.Sf_Id,
          Quantity: finalQuantity,
          Entered_Quantity__c: Number(item.Quantity) || 0,
          UOM_Selected__c: isCaseOrder ? 10 : 20,
          Quantity_In_Box__c: isCaseOrder ? Number(item.Quantity) || 0 : 0,
          Quantity_In_Pcs__c: isCaseOrder ? 0 : Number(item.Quantity) || 0,
          Net_Amount__c: round2(item.NetAmount__c || 0),
          Tax_Amount__c: round2(Number(item.SGST_Amount__c || 0) + Number(item.CGST_Amount__c || 0) + Number(item.IGST_Amount__c || 0)),
          UnitPrice__c: round2(item.PTR__c || item.PTD__c || 0),
          TotalPrice__c: round2(item.GrossAmount__c || 0),
          CGST_Amount__c: round2(item.CGST_Amount__c || 0),
          SGST_Amount__c: round2(item.SGST_Amount__c || 0),
          IGST_Amount__c: round2(item.IGST_Amount__c || 0),
        };
        return {
          method: "POST",
          url: "/services/data/v61.0/sobjects/Order_Item__c",
          referenceId: `orderItem_${index}`,
          body: buildOrderItemPayload(itemData, orderClassification, orderId),
        };
      });
      // console.log('compositeRequest', JSON.stringify(compositeRequest))
      const compositePayload = { allOrNone: false, compositeRequest };
      const response = await apiComposite("POST", "composite", compositePayload);
      // console.log('OrderItem Composite Response', JSON.stringify(response))
      if (response.status !== "success") {
        const message = response.message || "Salesforce spot sales item request failed";
        console.error(" OrderItem Composite Failed:", response);
        dispatch(showToast({ message, type: "error" }));
        processedOrderItemsRef.current.delete(orderId);
        return false;
      }

      const failedItems = response.data.compositeResponse.filter(r => r.httpStatusCode !== 201);
      if (failedItems.length) {
        const firstFailure = failedItems[0];
        const firstError = firstFailure?.body?.[0] || firstFailure?.body || {};
        const errorCode = firstError.errorCode || "SALESFORCE_ERROR";
        const errorMessage = firstError.message || "Spot Sales item could not be created";
        const endpoint = firstFailure?.referenceId || "OrderItem";
        const exactMessage = `${errorCode}: ${errorMessage} (HTTP ${firstFailure?.httpStatusCode || "unknown"}, ${endpoint})`;
        console.error(" Some OrderItems failed:", exactMessage, failedItems);
        dispatch(showToast({ message: exactMessage, type: "error" }));
        processedOrderItemsRef.current.delete(orderId);
        return false;
      }

      return true;
    } catch (error) {
      console.error(" submitOrderItemsToApi error:", error);
      processedOrderItemsRef.current.delete(orderId);
      return false;
    }
  };

  const saveLocally = async (orderId: any, isFromApi = false, orderNo: any, APITotalAmount: any, itemsSynced = isFromApi) => {
    const { latitude, longitude } = await getCurrentLocation();
    const Accountdistance = await distanceCounterAccount();
    const isNonDms = !!orderClassification.isNonDmsOrder;

    const payload = {
      Sf_Id: orderId,
      TotalAmount: isNonDms ? 0 : round2(APITotalAmount || totals.totalNetAmount),
      Type: 'Secondary Order',
      OrderNumber: orderNo,
      AccountId: selectedVisit.AccountId__c || selectedVisit.AccountId,
      OrderPlacedBy__c: users[0]?.Sf_Id,
      Source__c: 'App',
      RecordTypeId: recordTypeId || OrderRecordTypeId_var || null,
      Beat__c: selectedVisit.Beat__c,
      OrderSubmissionTime__c: new Date().toISOString(),
      TotalOrderQtyInPcs__c: totals.totalUnits,
      Visit__c: selectedVisit.sfId || selectedVisit.Sf_Id,
      Status: users[0]?.DeveloperName === 'H_T_ASO' ? "Completed" : "Draft",
      EffectiveDate: new Date().toISOString(),
      Secondary_Order_Supplier__c: distributorId,
      CreatedDate: new Date().toISOString(),
      Pricebook2Id: PriceBookId_var,
      Mobile_Unique_Id__c: mobileUniqueId,
      IsNonDmsOrder__c: isNonDms,
      OrderType: orderClassification.orderType,
      BAState: orderClassification.baState || '',
      is_locally_changed: !isFromApi,
      operation_type: isFromApi ? null : "insert",
      last_modified: Date.now(),
      is_synced: isFromApi,
      sync_status: isFromApi ? 'synced' : 'unsynced',
    };

    await UniversalUpdateInsert({ ObjectName: 'Order', Type: 'insert', data: payload });

    const uniqueCartItems = removeDuplicatePaidItems(cartItems);
    const filteredItems = uniqueCartItems.filter(item => {
      const isFree =
        item.IsFree__c === true ||
        item.IsFree__c === 'true' ||
        item.IsFree__c === 1 ||
        item.IsFree__c === '1';

      if (isFree) {
        return true;
      }
      if (isNonDms) {
        return (Number(item.Quantity) || 0) > 0;
      }
      const grossAmount = Number(item.GrossAmount__c);
      const netAmount = Number(item.NetAmount__c);
      if (isNaN(grossAmount) || isNaN(netAmount)) {
        console.warn(`Invalid amount for product ${item.Product2Id}:`, {
          GrossAmount__c: item.GrossAmount__c,
          NetAmount__c: item.NetAmount__c
        });
        return false;
      }
      if (grossAmount <= 0 || netAmount <= 0) {
        console.warn(`Zero/negative amount for product ${item.Product2Id}:`, {
          GrossAmount__c: grossAmount,
          NetAmount__c: netAmount
        });
        return false;
      }
      return true;
    });
    for (const item of filteredItems) {
      const unitPerCase = UNITS_PER_CASE;
      const isCaseOrder = isCaseMode(item);
      const finalQuantity = isCaseOrder
        ? (Number(item.Quantity) || 0) * unitPerCase
        : (Number(item.Quantity) || 0);
      const orderQtyInCase = finalQuantity / unitPerCase;
      const round3orderqty = round3(orderQtyInCase);
      await UniversalUpdateInsert({
        ObjectName: 'OrderItem',
        Type: 'insert',
        data: {
          Sf_Id: generateRandomOrderNumber(),
          OrderId: orderId,
          Product2Id: item.Product2Id || item.product2Id,
          Quantity: finalQuantity,
          UnitPrice: isNonDms ? 0 : item.PTD__c,
          SRChangedPrice__c: isNonDms ? 0 : item.PTR__c,
          UOM__c: isCaseOrder ? "Box" : "Pc",
          UOM_Selected__c: isCaseOrder ? 10 : 20,
          Quantity_In_Box__c: isCaseOrder ? Number(item.Quantity) || 0 : 0,
          Quantity_In_Pcs__c: isCaseOrder ? 0 : Number(item.Quantity) || 0,
          Order_Quantity_In_Kg__c: item.Weight_Per_Unit_in_KG__c * finalQuantity,
          Order_Quantity_In_Mt__c: round4(item.Order_Quantity_In_Mt__c),
          OrderQtyInCase__c: round3orderqty,
          GrossAmount__c: isNonDms ? 0 : round2(item.GrossAmount__c),
          NetAmount__c: isNonDms ? 0 : round2(item.NetAmount__c),
          Order_Amount__c: isNonDms ? 0 : round2(item.Order_Amount__c),
          SGST_Amount__c: isNonDms ? 0 : round2(item.SGST_Amount__c),
          CGST_Amount__c: isNonDms ? 0 : round2(item.CGST_Amount__c),
          PricebookEntryId: isNonDms ? null : (item.PriceBookId || cartItems[0]?.PriceBookId || cartItems[1]?.PriceBookId || null),
          SchemeDiscount__c: isNonDms ? 0 : round2(item.Calculate_AppliedDiscount__c),
          SlabId__c: item.SchemeSlabIds__c,
          isFOC__c: item.IsFree__c === true || item.IsFree__c === 'true' || item.IsFree__c === 1 || item.IsFree__c === '1' ? true : false,
          is_locally_changed: !itemsSynced,
          operation_type: itemsSynced ? null : "insert",
          last_modified: Date.now(),
          is_synced: itemsSynced,
          sync_status: itemsSynced ? 'synced' : 'unsynced',
        },
      });
    }

    const visitPayload = {
      Sf_Id: selectedVisit.sfId || selectedVisit.Sf_Id,
      ProductiveCall__c: true,
      SRTransactionTime__c: new Date().toISOString().split("T")[1],
      SRTransactionLocation__Longitude__s: longitude,
      SRTransactionLocation__Latitude__s: latitude,
      LocationVarianceOrdertoSCA__c: Accountdistance,
      is_locally_changed: true,
      is_synced: isFromApi
    };
    await UniversalUpdateInsert({ ObjectName: 'Visit', Type: 'insert', data: visitPayload });
  };

  const createGamificationTransactions = async (orderId, items = [], isFromApi = false) => {
    try {
      const loggedInUserId = users?.[0]?.Sf_Id;
      if (!items?.length) return { ok: true };

      let totalPointsEarned = 0;
      let gamename = '';

      const mastersAll = await UniversalUpdateInsert({ ObjectName: "Gamification_Master__c", Type: "get" });

      const normalize = s => {
        const v = (s || "").toLowerCase().replace(/\s*sku\s*/g, "").trim();
        if (v === "new launch" || v === "new launch sku") return "npl";
        return v;
      };

      const eligible = new Set(["must sell", "overdue", "top sell", "npl"]);
      const apiRecords = [];
      const localRecords = [];

      for (const it of items) {
        const sectionNorm = normalize(it.SectionHead);
        if (!eligible.has(sectionNorm)) continue;

        const master = mastersAll
          .filter(m => normalize(m.Gamification_Category__c) === sectionNorm)
          .sort((a, b) => (b.RewardPoint__c || 0) - (a.RewardPoint__c || 0))[0];

        if (!master || !master.RewardPoint__c) continue;

        const payload = {
          User__c: loggedInUserId,
          Gamification_Master__c: master.Master_Id,
          Category__c: master.Gamification_Category__c,
          Points_Earned__c: Number(master.RewardPoint__c),
          Transaction_Type__c: "Credit",
          Gamification_Transaction_Master__c: master.Transaction_Master_Id,
        };

        totalPointsEarned += Number(master.RewardPoint__c || 0);
        gamename = master?.Gamification_Label__c;

        if (isFromApi) {
          apiRecords.push(payload);
        } else {
          localRecords.push({
            ...payload,
            Sf_Id: generateRandomOrderNumber(),
            is_locally_changed: true,
            is_synced: false,
            sync_status: 'unsynced',
            operation_type: "insert",
            last_modified: Date.now(),
          });
        }
      }

      if (!isFromApi && localRecords.length) {
        for (const rec of localRecords) {
          await UniversalUpdateInsert({ ObjectName: "Gamification_Transaction__c", Type: "insert", data: rec });
        }
      }

      if (isFromApi && apiRecords.length) {
        const compositePayload = {
          allOrNone: true,
          compositeRequest: apiRecords.map((rec, index) => ({
            method: "POST",
            url: "/services/data/v61.0/sobjects/Gamification_Transaction__c",
            referenceId: `gam_txn_${index}`,
            body: rec,
          })),
        };

        const response = await apiComposite("POST", "composite", compositePayload);
        if (!response?.data?.compositeResponse) throw new Error("Composite API failed");

        response.data.compositeResponse.forEach((r, index) => {
          if (r.httpStatusCode === 201) {
            UniversalUpdateInsert({
              ObjectName: "Gamification_Transaction__c",
              Type: "insert",
              data: {
                ...apiRecords[index],
                Sf_Id: r.body.id,
                is_locally_changed: false,
                is_synced: true,
                last_modified: Date.now(),
              },
            });
          }
        });
      }

      console.log("🎯 TOTAL GAMIFICATION POINTS", totalPointsEarned);

      const totalRecordsCreated = apiRecords.length + localRecords.length;
      if (totalRecordsCreated > 0) {
        setRewardModal({ visible: true, points: totalPointsEarned, game: gamename || 'Take Order' });
        return { ok: true, hasReward: true };
      }

      return { ok: true, hasReward: false };
    } catch (err) {
      console.error("Gamification composite error:", err);
      return { ok: false, error: err };
    }
  };

  const handleOrderSubmit = async () => {
    if (isSubmittingRef.current || loading) {
      return;
    }
    isSubmittingRef.current = true;

    if (cartItems.length === 0) {
      dispatch(showToast({ message: 'You do not have any items in the cart.', type: 'warning' }));
      isSubmittingRef.current = false;
      return;
    }

    if (orderClassification.orderType === ORDER_TYPES.UNRESOLVED) {
      dispatch(showToast({
        message: orderClassification.error || 'Unable to determine the BA state. Please synchronize your data and try again.',
        type: 'error',
      }));
      isSubmittingRef.current = false;
      return;
    }

    try {
      setLoading(true);
      const connected = await isInternetAvailable();
      const isNonDms = !!orderClassification.isNonDmsOrder;

      let orderId = await generateRandomOrderNumber();
      let orderNo = await generateRandomOrderNumber();
      let APITotalAmount = isNonDms ? 0 : totals.totalNetAmount;
      let isFromApi = false;
      let apiItemsSynced = false;
      const uniqueCartItems = removeDuplicatePaidItems(cartItems);

      const validItems = uniqueCartItems.filter(item => {
        const isFree =
          item.IsFree__c === true ||
          item.IsFree__c === 'true' ||
          item.IsFree__c === 1 ||
          item.IsFree__c === '1';

        if (isFree) return true;

        if (isNonDms) {
          return (Number(item.Quantity) || 0) > 0;
        }

        return (
          Number(item.GrossAmount__c) > 0 &&
          Number(item.NetAmount__c) > 0
        );
      });

      if (validItems.length === 0) {
        dispatch(
          showToast({
            message: isNonDms
              ? 'Please add at least one product with a valid quantity to place the spot sales.'
              : 'Please add at least one product with an net amount greater than 0 to place the spot sales.',
            type: 'warning',
          })
        );
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }


      // console.log('submitOrderItemsToApi', JSON.stringify(uniqueCartItems))
      // return;
      if (connected) {
        await syncVisitRecord(apiFetch, apiComposite);
        const orderDataFromApi = await submitOrderWithVisitUpdate();
        if (!orderDataFromApi || !orderDataFromApi.success) {
          const rawError = orderDataFromApi?.error || 'Spot Sales API failed. Please check network or permissions.';
          console.error("🔴 Order Placement Aborted due to API failure:", rawError);
          dispatch(showToast({ message: String(rawError), type: 'error' }));
          isSubmittingRef.current = false;
          setLoading(false);
          return;
        }

        orderId = orderDataFromApi.orderId;
        orderNo = orderDataFromApi.orderNo;
        apiItemsSynced = orderDataFromApi.itemsSynced === true;
        isFromApi = true;
        if (users[0]?.DeveloperName === 'H_T_ASO') {
          await ASOOrderComplete(orderId);
        }
      }

      if (users[0]?.DeveloperName === 'H_T_ASO') {
        await ASOStockItemUpdate(cartItems);
      }

        await saveLocally(orderId, isFromApi, orderNo, APITotalAmount, connected ? apiItemsSynced : false);

      let gamificationResult = { hasReward: false };

      if (users[0]?.DeveloperName === 'H_T_SR') {
        try {
          gamificationResult = await createGamificationTransactions(orderId, cartItems, isFromApi);
        } catch (err) {
          console.error("Gamification creation failed:", err);
        }
      }

      dispatch(showToast({ message: 'Spot Sales placed successfully.', type: 'success' }));

      await UniversalUpdateInsert({ ObjectName: 'CartItems', Type: 'delete_all' });

      if (!gamificationResult?.hasReward) {
        // navigation.navigate('AccountDetailContainer');
        navigation.navigate('AccountDetailContainer', {
          activetabfromnavigate: 'Details'
        });
      }
    } catch (error) {
      console.error(' Order error:', error);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const filtered = cartItems.filter(item =>
    String(item?.Name || '').toLowerCase().includes(searchText.trim().toLowerCase())
  );

  const totalUnits = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const qty = Number(item.Quantity) || 0;
      const unitPerCase = UNITS_PER_CASE;
      if (item.UnitMode === 'Case') return sum + qty * unitPerCase;
      else return sum + qty;
    }, 0);
  }, [cartItems]);

  const quantitySummary = useMemo(() => {
    // Both totals: units (Case-mode lines converted at 12/case) and equivalent cases
    const units = cartItems.reduce((sum, item) => {
      const quantity = Number(item.Quantity ?? item.quantity) || 0;
      const mode = String(item.UnitMode ?? item.unitMode ?? "Unit").trim().toLowerCase();
      return sum + (mode === "case" || mode === "box" ? quantity * UNITS_PER_CASE : quantity);
    }, 0);
    return { cases: Math.round((units / UNITS_PER_CASE) * 100) / 100, units };
  }, [cartItems]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        <HeaderMain screenName='Cart' />
      </View>

      <View style={{ borderRadius: 30, backgroundColor: 'white', flex: 1, paddingBottom: 50 }}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search in cart"
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
          />
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        </View>
        {/* {
          console.log('filtered', JSON.stringify(filtered))
        } */}
        {/* Cart List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 190 }}
          renderItem={({ item }) => {
            const isFree = item && (item.IsFree__c === true || item.IsFree__c === 'true' || item.IsFree__c === 1 || item.IsFree__c === '1' || item.isFree__c === true || item.isFree === true);
            const unitPerCase = UNITS_PER_CASE;
            const unitMode = item.UnitMode || item.unitMode || 'Unit';
            const quantity = Number(item.Quantity || item.quantity) || 0;
            const unitsCount = unitMode === 'Case'
              ? quantity * unitPerCase
              : quantity;
            const casesCount = unitMode === 'Case'
              ? quantity
              : Math.floor(quantity / unitPerCase);

            // ── Nudge badge logic ─────────────────────────────────────────────
            // Show nudge for non-free items only
            // "Unlocked" nudges → green gradient (existing style)
            // "Add X to unlock" nudges → amber/orange gradient (new style)
            const legacyNudgeText = item?.Nudge || item?.nabj || item?.Nabj || null;
            const schemeBadges = !isFree
              ? (
                Array.isArray(item?._schemeBadges) && item._schemeBadges.length
                  ? item._schemeBadges
                  : legacyNudgeText
                    ? [{
                      key: `legacy-${item?.id || item?.Sf_Id || item?.Product2Id || item?.Name || 'nudge'}`,
                      text: legacyNudgeText,
                      status: legacyNudgeText.toLowerCase().startsWith('applied') || legacyNudgeText.toLowerCase().startsWith('unlocked')
                        ? 'applied'
                        : 'pending',
                    }]
                    : []
              )
              : [];

            return (
              <View style={styles.productCard}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ marginRight: 10, position: 'relative' }}>
                    <Image
                      source={
                        item?.ProductImageURL__c || item?.productImageUrl
                          ? { uri: convertSharePointUrl(item.ProductImageURL__c || item.productImageUrl) }
                          : require("../assets/images/food.png")
                      }
                      style={styles.productImage}
                    />
                    {isFree && (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>FREE</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">
                      {item.Name || item.name}
                    </Text>

                    <View style={styles.infoGrid}>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoText}>1 Case:</Text>
                        <Text style={styles.infoValue}>{unitPerCase} Units</Text>
                      </View>

                      <View style={styles.infoItem}>
                        <Text style={styles.infoText}>Wt/Unit:</Text>
                        <Text style={styles.infoValue}>{item.Weight_Per_Unit_in_KG__c || item.weight_Per_Unit_in_KG__c || 0} KG</Text>
                      </View>

                      {/*
                      <View style={styles.infoItem}>
                        <Text style={styles.infoText}>PTR:</Text>
                        <Text style={styles.infoValue}>
                          ₹{Number(item?.PTR__c || item?.ptr || item?.PTD__c || item?.ptd || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>

                      <View style={styles.infoItem}>
                        <Text style={styles.infoText}>Qty × PTR:</Text>
                        <Text style={styles.infoValue}>
                          ₹{(
                            (parseFloat(item?.PTR__c || item?.ptr || item?.PTD__c || item?.ptd || 0) || 0) *
                            unitsCount
                          ).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                      */}

                      {!orderClassification.isNonDmsOrder && (
                        <>
                          <View style={styles.infoItem}>
                            <Text style={styles.infoText}>Discount:</Text>
                            <Text style={styles.infoValue}>
                              ₹{Number(item?.Calculate_AppliedDiscount__c || item?.AppliedDiscount__c || item?.appliedDiscount__c || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>

                          <View style={styles.infoItem}>
                            <Text style={[styles.infoText, { fontWeight: '800', color: '#000' }]}>Net:</Text>
                            <Text style={[styles.infoValue, { fontWeight: '800', color: '#000' }]}>
                              ₹{Number(item?.PTR__c || item?.ptr || item?.PTD__c || item?.ptd || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    {/* ── NUDGE BADGE ─────────────────────────────────────── */}
                    {schemeBadges.length ? (
                      <View style={styles.nudgeContainer}>
                        {schemeBadges.map((badge) => {
                          const isAppliedBadge = badge?.status === 'applied';
                          return (
                            <TouchableOpacity
                              key={badge.key}
                              activeOpacity={0.88}
                              onPress={() => setSchemeTooltip({
                                visible: true,
                                title: isAppliedBadge ? 'Applied Scheme' : 'Scheme Details',
                                message: badge?.text || '',
                                status: badge?.status || 'pending',
                              })}
                            >
                              <LinearGradient
                                colors={
                                  isAppliedBadge
                                    ? ["#25B34A", "#007C00"]
                                    : ["#F59E0B", "#D08C1F"]
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.nudgeGradient}
                              >
                                <View style={styles.nudgeRow}>
                                  <Ionicons
                                    name={isAppliedBadge ? "sparkles" : "gift-outline"}
                                    size={14}
                                    color="#fff"
                                    style={{ marginRight: 6 }}
                                  />
                                  <Text
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                    style={styles.nudgeText}
                                  >
                                    {badge.text}
                                  </Text>
                                </View>
                              </LinearGradient>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                    {/* ── END NUDGE ────────────────────────────────────────── */}

                  </View>

                  <TouchableOpacity onPress={() => !isFree && deleteItem(item.id)} disabled={isFree}>
                    <Ionicons name={isFree ? "ban" : "trash"} size={22} color={isFree ? "#bbb" : "red"} />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomRow}>
                  <View style={{ flexDirection: 'row' }}>
                    {['Case', 'Unit'].map((mode, idx) => {
                      const active = item.UnitMode === mode;
                      const isLeft = idx === 0;
                      if (isFree) {
                        return (
                          <View
                            key={mode}
                            style={[
                              styles.toggleBase,
                              isLeft ? styles.leftActive : styles.rightActive,
                              styles.disabledToggle
                            ]}
                          >
                            <Text style={styles.textDisabled}>{mode}</Text>
                          </View>
                        );
                      }

                      return active ? (
                        <LinearGradient
                          key={mode}
                          colors={['#A67C2E', '#A67C2E', '#A67C2E']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.toggleBase, isLeft ? styles.leftActive : styles.rightActive]}
                        >
                          <TouchableOpacity onPress={() => toggleUnitMode(item.id, mode)}>
                            <Text style={styles.textActive}>{mode}</Text>
                          </TouchableOpacity>
                        </LinearGradient>
                      ) : (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => toggleUnitMode(item.id, mode)}
                          style={[
                            styles.toggleBase,
                            styles.inactive,
                            isLeft ? styles.leftActive : styles.rightActive
                          ]}
                        >
                          <Text style={styles.textInactive}>{mode}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      onPress={() => !isFree && Number(item.Quantity) > 1 && updateQuantity(item.id, Number(item.Quantity) - 1)}
                      disabled={isFree || Number(item.Quantity) <= 1}
                    >
                      <Ionicons name="remove-circle" size={24} color={isFree ? "#bbb" : "#A67C2E"} />
                    </TouchableOpacity>
                    <Text style={[styles.stepperQty, isFree && { opacity: 0.7 }]}>{item.Quantity}</Text>
                    <TouchableOpacity
                      onPress={() => !isFree && updateQuantity(item.id, Number(item.Quantity) + 1)}
                      disabled={isFree}
                    >
                      <Ionicons name="add-circle" size={24} color={isFree ? "#bbb" : "#A67C2E"} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', height: 15, justifyContent: 'flex-end' }}>
                  <Text style={{ fontSize: 12 }}>
                    Cases: <Text style={{ color: 'black', fontWeight: 'bold' }}>{casesCount}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, marginLeft: 8 }}>
                    Units: <Text style={{ color: 'black', fontWeight: 'bold' }}>{unitsCount}</Text>
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Your cart is empty</Text>
            </View>
          )}
        />

        <LinearGradient colors={Gradients.primary} style={styles.bottomSummary}>
          {orderClassification.isNonDmsOrder ? (
            <View style={[styles.summaryRow, { justifyContent: "flex-start", alignItems: "center" }]}> 
              <View style={[styles.summaryBlock, { flex: 1, alignItems: "flex-start", paddingLeft: 8 }]}> 
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{filtered.length}</Text>
              </View>
              <View style={[styles.summaryBlock, { flex: 1, alignItems: "center" }]}> 
                <Text style={styles.summaryLabel}>Cases</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{quantitySummary.cases}</Text>
              </View>
              <View style={[styles.summaryBlock, { flex: 1, alignItems: "center" }]}> 
                <Text style={styles.summaryLabel}>Units</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{quantitySummary.units}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.summaryRow, { marginBottom: 6 }]}>
                <View style={[styles.summaryBlock, { flex: 1, alignItems: "flex-start", paddingLeft: 4 }]}>
                  <Text style={styles.summaryLabel}>Cases</Text>
                  <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{quantitySummary.cases}</Text>
                </View>
                <View style={[styles.summaryBlock, { flex: 1, alignItems: "center" }]}> 
                  <Text style={styles.summaryLabel}>Units</Text>
                  <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{quantitySummary.units}</Text>
                </View>
                <View style={[styles.summaryBlock, { flex: 1.4, alignItems: "center" }]}>
                  <Text style={styles.summaryLabel}>Total PTR</Text>
                  <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>₹{Number(totals.totalPTR).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={[styles.summaryBlock, { flex: 1.2, alignItems: "flex-end", paddingRight: 4 }]}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>₹{Number(totals.totalDiscount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={[styles.summaryBlock, { flex: 1, alignItems: "flex-start", paddingLeft: 4 }]}>
                  <Text style={styles.summaryLabel}>Gross Amount</Text>
                  <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>₹{Number(totals.totalGrossAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={[styles.summaryBlock, { flex: 1, alignItems: "flex-end", paddingRight: 4 }]}>
                  <Text style={styles.summaryLabel}>Net Amount</Text>
                  <Text style={[styles.summaryValue, { fontSize: 13, fontWeight: "800", color: "#FFD700" }]} numberOfLines={1} adjustsFontSizeToFit>₹{Number(totals.totalNetAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </>
          )}
        </LinearGradient>

        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cartSummarybutton}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* <TouchableOpacity style={styles.viewCartBtn} onPress={handleOrderSubmit} disabled={loading}> */}
            <TouchableOpacity style={styles.viewCartBtn} onPress={handleOrderSubmit} disabled={loading || isSubmittingRef.current}>
              <Text style={styles.viewCartText}>{loading ? 'Placing Spot Sales...' : 'Place Spot Sales'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <LoaderOverlay visible={loading} message="Placing spot sales..." />
      <GamificationTakeOrderRewardModal
        visible={rewardModal.visible}
        points={rewardModal.points}
        gameName={rewardModal.game}
        onClose={() => {
          setRewardModal(prev => ({ ...prev, visible: false }));
          navigation.navigate('AccountDetailContainer');
        }}
      />
      <Modal
        visible={schemeTooltip.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setSchemeTooltip(prev => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={styles.tooltipOverlay}
          onPress={() => setSchemeTooltip(prev => ({ ...prev, visible: false }))}
        >
          <Pressable
            style={styles.tooltipCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.tooltipHeader}>
              <View style={styles.tooltipTitleRow}>
                <Ionicons
                  name={schemeTooltip.status === 'applied' ? "sparkles" : "information-circle"}
                  size={18}
                  color={schemeTooltip.status === 'applied' ? "#25B34A" : "#D08C1F"}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.tooltipTitle}>{schemeTooltip.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSchemeTooltip(prev => ({ ...prev, visible: false }))}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipMessage}>{schemeTooltip.message}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#154298' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ccc', borderRadius: 20,
    margin: 12, paddingHorizontal: 10, height: 40
  },
  searchInput: {
    flex: 1, fontSize: 16,
    textAlignVertical: "center",
    paddingVertical: 0
  },
  searchIcon: { marginRight: 8 },
  productCard: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    marginHorizontal: 12, marginVertical: 6, padding: 10
  },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  productImage: { width: 70, height: 70, borderRadius: 6, marginRight: 12, resizeMode: 'contain' },
  productName: { fontWeight: '600', fontSize: 14, color: 'black', marginBottom: 4 },
  value: { fontSize: 13, color: '#1F1D1A', marginBottom: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  toggleContainer: {
    flexDirection: "row", alignSelf: "flex-start", marginVertical: 2,
    overflow: "hidden", width: '100%', justifyContent: 'space-between', height: 30
  },
  toggleBase: { paddingVertical: 5, paddingHorizontal: 30, justifyContent: 'center' },
  inactive: { backgroundColor: "#fff", borderWidth: 1, borderColor: '#D9D2C3' },
  leftActive: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  rightActive: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  textActive: { color: "#fff", fontWeight: "500", fontSize: 12 },
  textInactive: { color: Gradients.primary[0], fontWeight: "500", fontSize: 12 },
  label: { fontSize: 14, width: 70 },
  quantityInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, width: 80, textAlign: 'center'
  },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#888' },
  cartSummary: {
    backgroundColor: 'red',
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 15,
  },
  cartLeft: { gap: 16, flexDirection: 'row', width: '100%', alignSelf: 'center', justifyContent: 'center' },
  cartItemBlock: { alignItems: 'center' },
  cartLabel: { color: '#fff', fontSize: 10 },
  cartValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  newBadge: {
    position: 'absolute', top: -5, left: -5,
    backgroundColor: 'green', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 2, zIndex: 1
  },
  newBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  discountBadge: {
    position: 'absolute', top: 20, left: -5,
    backgroundColor: 'red', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 2, zIndex: 1
  },
  discountBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  productSubText: { fontSize: 11, color: '#555', marginBottom: 4 },
  productPriceText: { fontSize: 12, color: 'gray', fontWeight: '500' },
  productDiscountText: { fontSize: 12, color: 'gray', fontWeight: '500' },
  productSubtotalText: { fontSize: 12, color: 'gray', fontWeight: '500' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, alignItems: 'center' },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperQty: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 8 },
  safeArea: { flex: 1, backgroundColor: '#A67C2E' },
  headerContainer: { backgroundColor: "transparent" },
  freeBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, zIndex: 5
  },
  freeBadgeText: { fontSize: 10, fontWeight: '700', color: '#1F1D1A' },
  disabledToggle: { backgroundColor: '#f2f2f2', borderColor: '#D9D2C3', borderWidth: 1 },
  textDisabled: { color: '#999', fontWeight: '600' },
  bottomSummary: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingVertical: 12, paddingHorizontal: 14,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryBlock: {},
  summaryLabel: { color: "#fff", fontSize: 10, opacity: 0.9 },
  summaryValue: { color: "#fff", fontSize: 12, fontWeight: "600" },
  cartSummarybutton: {
    position: "absolute", right: 10, bottom: 115,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 15, paddingVertical: 10, elevation: 8, borderRadius: 10,
  },
  viewCartBtn: { backgroundColor: "transparent" },
  viewCartText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  infoItem: { width: "50%", flexDirection: "row", marginBottom: 4 },
  infoText: { fontSize: 11, color: "#666", marginRight: 4 },
  infoValue: { fontSize: 11, color: "#000", fontWeight: "500" },
  // nudge
  nudgeContainer: { width: '100%', marginTop: 8 },
  nudgeGradient: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 6 },
  nudgeRow: { flexDirection: 'row', alignItems: 'center' },
  nudgeText: { fontSize: 11, color: '#fff', fontWeight: '600', flexShrink: 1, flexWrap: "wrap" },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  tooltipCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tooltipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flexShrink: 1,
  },
  tooltipMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
});
