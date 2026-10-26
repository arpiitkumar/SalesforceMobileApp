// TakeOrder.js - full updated file (includes scheme counts in events + save fix + single-active-scheme)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  DeviceEventEmitter,
  Modal,
  Pressable,
} from "react-native";
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from "../components/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";
import { Gradients } from "../assets/css/MasterCss.js";
import Entypo from "@react-native-vector-icons/entypo";
import AntDesign from "../components/AntDesign";
import { useSelector, useDispatch } from "react-redux";
import { showToast } from "../redux/slices/toastSlice.js";
import { useApiFetch } from "../utils/apiFetchHooks/useApiFetch";
import { getUserAccessibleSubCategories } from "../UtilityMain/producthelpers/userLineService.js";
import { convertSharePointUrl } from "../utils/imageHelper";
import {
  getCGCloudUOMData,
  createUOMDataMap,
} from "../UtilityMain/producthelpers/productUOMService";
import {
  getSavedCartItems,
  createCartLookupMap,
  buildCartPayload,
  saveCartItemsToDb,
} from "../UtilityMain/producthelpers/cartService";
import {
  normalizeProducts,
  extractCategories,
} from "../UtilityMain/producthelpers/productNormalizationService";
import getOrderedCategories from "../UtilityMain/producthelpers/categoryPriorityService";
import SchemeModal from "../components/modal/SchemeModal";
import { evaluateSchemeResponse } from "../utils/schemeEngine";

// ---------- helpers ----------
function sanitizeNumberForMoney(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number" && isFinite(val)) return val;
  let s = String(val || "");
  s = s.replace(/[^0-9.\-]/g, "");
  s = s.replace(/(?!^)-/g, "");
  const parts = s.split(".");
  s = parts.shift() + (parts.length ? "." + parts.join("") : "");
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : 0;
}

function computeProductMeasures(product) {
  const perCase = parseInt(product.UnitperCase__c || product.UnitPerCase || 1, 10) || 1;
  const units = Number(product.quantityUnits ?? product.quantity ?? 0) || 0;
  const cases = Math.floor(units / perCase);
  const weightPerUnit = Number(product.Weight_Per_Unit_in_KG__c) || 0;
  const weightKg = units * weightPerUnit;
  return { units, cases, weightKg, perCase, weightPerUnit };
}

/**
 * measureValueForWrapper(product, buyUOM)
 * Returns { value, kind, measures }
 * NOTE: This function does NOT count free items (product.isFree === true) towards qualification.
 */
function measureValueForWrapper(product, buyUOMRaw) {
  // Treat free items as zero-contribution to avoid cascading FOC loops
  if (product && product.isFree) {
    const zeroMeasures = {
      units: 0,
      cases: 0,
      weightKg: 0,
      perCase: parseInt(product.UnitperCase__c || product.UnitPerCase || 1, 10) || 1,
      weightPerUnit: Number(product.Weight_Per_Unit_in_KG__c) || 0,
    };
    const buyUOM = String(buyUOMRaw || "").toLowerCase();
    if (buyUOM.includes("kg") || buyUOM.includes("kilogram")) return { value: 0, kind: "kg", measures: zeroMeasures };
    if (buyUOM.includes("case")) return { value: 0, kind: "case", measures: zeroMeasures };
    if (buyUOM.includes("value") || buyUOM.includes("rupee") || buyUOM.includes("₹")) return { value: 0, kind: "value", measures: zeroMeasures };
    return { value: 0, kind: "unit", measures: zeroMeasures };
  }

  const buyUOM = String(buyUOMRaw || "").toLowerCase();
  const m = computeProductMeasures(product);

  if (buyUOM.includes("kg") || buyUOM.includes("kilogram")) {
    return { value: m.weightKg, kind: "kg", measures: m };
  }
  if (buyUOM.includes("case")) {
    return { value: m.cases, kind: "case", measures: m };
  }
  if (buyUOM.includes("value") || buyUOM.includes("rupee") || buyUOM.includes("₹")) {
    const unitPrice = Number(product.PTR__c ?? product.PTD__c ?? product.Price ?? 0) || 0;
    return { value: unitPrice * (m.units || 0), kind: "value", measures: m };
  }
  return { value: m.units, kind: "unit", measures: m };
}

function getProductUnitPrice(product) {
  const raw = product.PTR__c ?? product.PTD__c ?? product.Price ?? 0;
  return Number(sanitizeNumberForMoney(raw)) || 0;
}

function getSchemeSlabKey(entry, fallback = "") {
  return String(entry?.schemeSlabId || entry?.schemeId || fallback).trim();
}

function getAggregateMeasureForWrapper(wrapper, allProducts = [], globalSchemeWrappers = [], fallbackProduct = null) {
  const slabKey = getSchemeSlabKey(wrapper, wrapper?.schemeName || "scheme");
  const slabWrappers = (globalSchemeWrappers || []).filter(
    (candidate, idx) => getSchemeSlabKey(candidate, `global-${idx}`) === slabKey
  );
  const eligibleIds = new Set(
    slabWrappers
      .map((candidate) => String(candidate?.inputProductId || "").trim())
      .filter(Boolean)
  );

  const sourceProducts = eligibleIds.size
    ? (allProducts || []).filter((product) => {
      if (!product || product.isFree) return false;
      const productId = String(product?.Sf_Id || product?.id || product?._id || "").trim();
      return eligibleIds.has(productId);
    })
    : (fallbackProduct ? [fallbackProduct] : []);

  let totalValue = 0;
  let measureKind = null;

  sourceProducts.forEach((product) => {
    const result = measureValueForWrapper(product, wrapper?.buyUOM || wrapper?.buyType || "");
    totalValue += Number(result?.value || 0);
    if (!measureKind) measureKind = result?.kind || null;
  });

  const selectedEligibleIds = new Set(
    sourceProducts
      .filter((product) => (Number(product?.quantityUnits ?? product?.quantity ?? 0) || 0) > 0)
      .map((product) => String(product?.Sf_Id || product?.id || product?._id || "").trim())
      .filter(Boolean)
  );

  return {
    value: totalValue,
    kind: measureKind,
    slabWrappers,
    eligibleIds,
    selectedEligibleIds,
  };
}

function buildRecommendedSets(recommendedRows = []) {
  const must = new Set(),
    overdue = new Set(),
    top = new Set(),
    scheme = new Set(),
    newLaunch = new Set();
  const rows = Array.isArray(recommendedRows) ? recommendedRows : recommendedRows ? [recommendedRows] : [];
  for (const row of rows) {
    const addAll = (set, raw) => {
      if (!raw) return;
      String(raw)
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .forEach((s) => {
          if (s) set.add(s.replace(/[\s,]+/g, ""));
        });
    };
    addAll(must, row?.Must_Sell_Products__c);
    addAll(overdue, row?.OverDue_Products__c);
    addAll(top, row?.Top_Sell_Products__c);
    addAll(scheme, row?.Scheme_Pitch__c);
    addAll(newLaunch, row?.New_Launch_Product__c);

  }
  return { must, overdue, top, scheme, newLaunch };
}

function getRecommendationTagForProduct(product, sets) {
  if (!product || !sets) return null;
  const id = product.Sf_Id || product.id || product._id || "";
  if (!id) return null;
  if (sets.must.has(id)) return "Must Sell";
  if (sets.overdue.has(id)) return "Overdue";
  if (sets.top.has(id)) return "Top Sell";
  if (sets.newLaunch.has(id)) return "New Launch";
  if (sets.scheme.has(id)) return "Scheme Pitch";
  return null;
}

// ---------- ProductItem ----------
const ProductItem = React.memo(function ProductItem({
  item,
  onUpdateQuantityUnits,
  onToggleUnitMode,
  onUpdatePTR,
  schemeApiBody,
  allProducts,
  isNonDmsOrder = false,
}) {
  const perCase = parseInt(item.UnitperCase__c || 1, 10) || 1;
  const maxCaseLimit = item.MaxCaseLimit != null ? parseInt(item.MaxCaseLimit, 10) : 15;
  const step = item.unitMode === "Case" ? perCase : 1;
  const displayedValue = item.unitMode === "Case" ? Math.floor((item.quantityUnits || item.quantity || 0) / perCase) : (item.quantityUnits || item.quantity || 0);

  const [qtyText, setQtyText] = useState(String(displayedValue));
  const [schemeTooltip, setSchemeTooltip] = useState({
    visible: false,
    title: "",
    message: "",
    status: "pending",
  });

  useEffect(() => {
    setQtyText(String(displayedValue));
  }, [item.quantityUnits, item.quantity, item.unitMode]);

  const commitQtyFromText = () => {
    let num = parseInt((qtyText || "").replace(/[^0-9]/g, ""), 10) || 0;
    let units = item.unitMode === "Case" ? num * perCase : num;
    if (item.unitMode === "Case" && num > maxCaseLimit) {
      units = maxCaseLimit * perCase;
    }
    onUpdateQuantityUnits(item._id || item.id, units);
    setQtyText(String(item.unitMode === "Case" ? Math.floor(units / perCase) : units));
  };

  const handlePlus = () => {
    if (item.unitMode === "Case") {
      const nextCases = Math.floor((item.quantityUnits || item.quantity || 0) / perCase) + 1;
      if (nextCases > maxCaseLimit) return;
    }
    // onUpdateQuantityUnits(item._id || item.id, (item.quantityUnits || item.quantity || 0) + step);
    onUpdateQuantityUnits(item._id || item.id, (prev) => {
      const current = prev || 0;
      return current + step;
    });
  };
  const handleMinus = () => {
    const next = Math.max(0, (item.quantityUnits || item.quantity || 0) - step);
    // onUpdateQuantityUnits(item._id || item.id, next);
    onUpdateQuantityUnits(item._id || item.id, (prev) =>
      Math.max(0, prev - step)
    );
  };
  const discountLabel = item.appliedSchemeDiscount ? ` • Discount ₹ ${Number(item.appliedSchemeDiscount).toFixed(2)}` : "";

  const globalSchemeWrappers = schemeApiBody?.productsWithSchemes
    ?.flatMap((p) => p.schemeWrappers || []) || [];

  const allSchemeWrappers = globalSchemeWrappers
    ?.filter((w) => String(w.inputProductId || "").trim() === String(item.Sf_Id || "").trim()) || [];

  // show applied schemes as pills; active: highlighted green, inactive: gray
  const appliedSchemeDetails = [];
  const seenApplied = new Set();
  (item.appliedSchemeDetails || []).forEach((detail, idx) => {
    const key = getSchemeSlabKey(detail, `applied-${idx}`);
    if (!key || seenApplied.has(key)) return;
    seenApplied.add(key);
    appliedSchemeDetails.push(detail);
  });

  const pendingWrappers = [];
  const seenPending = new Set();
  allSchemeWrappers.forEach((wrapper, idx) => {
    const key = getSchemeSlabKey(wrapper, `pending-${idx}`);
    if (!key || seenApplied.has(key) || seenPending.has(key)) return;
    seenPending.add(key);
    pendingWrappers.push(wrapper);
  });

  const getPendingSchemeMessage = ({ pendingScheme, item, isCrossProductScheme, hasSelectedEligibleProducts, isSelectedCard }) => {
    const buyType = String(pendingScheme?.buyType || "").toLowerCase();
    const buyUOM = String(pendingScheme?.buyUOM || "").toLowerCase();
    const perCaseValue = parseInt(item?.UnitperCase__c || 1, 10) || 1;
    const toNum = (v) => {
      const n = Number(v || 0);
      return Number.isFinite(n) ? n : 0;
    };
    const fmtKg = (n) => `${toNum(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
    const fmtInt = (n) => Math.ceil(toNum(n));
    const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const kind = pendingScheme?.measureKind || (buyUOM.includes("kg") ? "kg" : buyUOM.includes("case") ? "case" : buyType.includes("value") ? "value" : "unit");
    const remainingVal = toNum(pendingScheme?.remainingQty);
    const shouldShowLiveRemaining = !hasSelectedEligibleProducts || isSelectedCard;
    const schemeName = pendingScheme?.schemeName || "Scheme";

    if (!shouldShowLiveRemaining) {
      return `Buy eligible items to apply ${schemeName}`;
    }

    if (isCrossProductScheme && remainingVal <= 0) {
      return `Add eligible variants/items to apply ${schemeName}`;
    }

    if (buyType.includes("value") || kind === "value") {
      return `Add ${rupee(remainingVal)} more to apply ${schemeName}`;
    }
    if (kind === "kg" || buyUOM.includes("kg")) {
      return `Add ${fmtKg(remainingVal)} more to apply ${schemeName}`;
    }
    if (kind === "case" || buyUOM.includes("case")) {
      const remainingCases = fmtInt(remainingVal);
      const approxUnits = remainingCases * perCaseValue;
      return `Add ${remainingCases} case${remainingCases > 1 ? "s" : ""} more (~${approxUnits} units) to apply ${schemeName}`;
    }
    const remUnits = fmtInt(remainingVal);
    return `Add ${remUnits} unit${remUnits > 1 ? "s" : ""} more to apply ${schemeName}`;
  };

  return (
    <View style={styles.card}>
      {appliedSchemeDetails && appliedSchemeDetails.length > 0 && (
        <View style={{ flexDirection: "row", marginBottom: 8, flexWrap: 'wrap' }}>
          {appliedSchemeDetails.map((d, idx) => {
            const key = d.schemeSlabId || d.schemeId || idx;
            if (d.active) {
              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.88}
                  onPress={() => setSchemeTooltip({
                    visible: true,
                    title: "Applied Scheme",
                    message: d?.schemeName || "Scheme",
                    status: "applied",
                  })}
                >
                  <LinearGradient colors={["#25B34A", "#007C00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginRight: 6, marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="sparkles" size={12} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 11, color: "#fff", fontWeight: "600" }} numberOfLines={1} ellipsizeMode="tail">{d.schemeName}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            } else {
              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.88}
                  onPress={() => setSchemeTooltip({
                    visible: true,
                    title: "Scheme Details",
                    message: d?.schemeName || "Scheme",
                    status: "pending",
                  })}
                >
                  <View style={{ borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#F1EADB", marginRight: 6, marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="sparkles" size={12} color="#666" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 11, color: "#666", fontWeight: "600" }} numberOfLines={1} ellipsizeMode="tail">{d.schemeName}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
          })}
        </View>
      )}

      {pendingWrappers.map((wrapper, wrapperIndex) => {
        const rawMinBuy = Number(wrapper.minBuy || 0);
        if (!rawMinBuy) return null;
        const aggregateMeasure = getAggregateMeasureForWrapper(wrapper, allProducts, globalSchemeWrappers, item);
        const currentProductId = String(item.Sf_Id || item.id || item._id || "").trim();
        const shouldRenderForThisCard = aggregateMeasure.eligibleIds.has(currentProductId);
        if (!shouldRenderForThisCard) return null;
        const currentCardQty = Number(item.quantityUnits ?? item.quantity ?? 0) || 0;
        const hasSelectedEligibleProducts = aggregateMeasure.selectedEligibleIds.size > 0;
        const isSelectedCard = currentCardQty > 0 && aggregateMeasure.selectedEligibleIds.has(currentProductId);
        const remaining = Math.max(0, rawMinBuy - (aggregateMeasure.value || 0));
        const pendingScheme = {
          schemeName: wrapper.schemeName,
          minBuy: rawMinBuy,
          remainingQty: remaining,
          qty: aggregateMeasure.value || 0,
          buyUOM: wrapper.buyUOM,
          buyType: wrapper.buyType,
          measureKind: aggregateMeasure.kind,
        };

        const slabWrappers = aggregateMeasure.slabWrappers;
        const distinctInputs = new Set(slabWrappers.map((w) => String(w.inputProductId || "").trim()).filter(Boolean));
        const isCrossProductScheme =
          distinctInputs.size > 1 ||
          String(wrapper.variantSelectionMode || "").toLowerCase() === "any_n";
        const tooltipMessage = getPendingSchemeMessage({
          pendingScheme,
          item,
          isCrossProductScheme,
          hasSelectedEligibleProducts,
          isSelectedCard,
        });

        return (
          <TouchableOpacity
            key={wrapperIndex}
            activeOpacity={0.88}
            onPress={() => setSchemeTooltip({
              visible: true,
              title: "Scheme Details",
              message: tooltipMessage,
              status: "pending",
            })}
          >
            <LinearGradient colors={["#ce495aff", "#c70e2cff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6, marginBottom: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="alert-circle" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 9, color: "#fff", fontWeight: "600", flex: 1 }} numberOfLines={2}>
                  {tooltipMessage}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}

      {/*
      Original Product Card UI Layout:
      <View style={styles.topRow}>
        <View style={styles.imageWrap}>
          <Image source={item?.ProductImageURL__c ? { uri: convertSharePointUrl(item.ProductImageURL__c) } : require("../assets/images/food.png")} style={styles.image} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={styles.name}>{item.Name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            {!isNonDmsOrder && item.MRP__c ? (
              <Text style={styles.priceText}>
                ₹{Number(item.MRP__c).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.infoGrid2Col}>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>W/U in KG</Text>
          <Text style={styles.infoValue}>{item.Weight_Per_Unit_in_KG__c} KG</Text>
        </View>
      </View>
      <View style={styles.modeCenterRow}>
        <TouchableOpacity style={[styles.bigModeBtn, item.unitMode === "Case" && styles.bigModeActive]} onPress={() => onToggleUnitMode(item._id || item.id, "Case")}>
          <Text style={[styles.bigModeText, item.unitMode === "Case" && styles.bigModeTextActive]}>Case</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bigModeBtn, item.unitMode === "Unit" && styles.bigModeActive]} onPress={() => onToggleUnitMode(item._id || item.id, "Unit")}>
          <Text style={[styles.bigModeText, item.unitMode === "Unit" && styles.bigModeTextActive]}>Unit</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.counterAlignedRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={handleMinus}><Entypo name="minus" size={12} color="#fff" /></TouchableOpacity>
        <TextInput value={qtyText} style={styles.qtyInput} />
        <TouchableOpacity style={styles.qtyBtn} onPress={handlePlus}><Entypo name="plus" size={12} color="#fff" /></TouchableOpacity>
      </View>
      <View style={styles.caseInfoCompact}>
        <Text style={styles.caseInfoCompactText}>Case: 1 = {item.UnitperCase__c || 1} Units</Text>
        <Text style={styles.caseInfoCompactText}>Qty: {Math.floor((item.quantityUnits || 0) / perCase)}C • {(item.quantityUnits || 0)}U</Text>
      </View>
      */}
      {/* Top Row: Image, Name, Price, Weight */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#F1EADB", justifyContent: "center", alignItems: "center", marginRight: 8, borderWidth: 1, borderColor: "#D9D2C3" }}>
          <Image source={item?.ProductImageURL__c ? { uri: convertSharePointUrl(item.ProductImageURL__c) } : require("../assets/images/food.png")} style={{ width: 36, height: 36, resizeMode: "contain" }} />
        </View>

        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: "700", color: "#1F1D1A", lineHeight: 15 }}>{item.Name}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap", gap: 4 }}>
            {item.MRP__c ? (
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#A67C2E" }}>
                ₹{Number(item.MRP__c).toFixed(2)}
              </Text>
            ) : null}
            {item.Weight_Per_Unit_in_KG__c ? (
              <View style={{ backgroundColor: "#F1EADB", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                <Text style={{ fontSize: 8, color: "#7A7266", fontWeight: "700" }}>{item.Weight_Per_Unit_in_KG__c} KG</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Segmented Mode Selector */}
      <View style={{ flexDirection: "row", backgroundColor: "#F1EADB", borderRadius: 8, padding: 2, marginTop: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 4, alignItems: "center", borderRadius: 6, backgroundColor: item.unitMode === "Case" ? "#A67C2E" : "transparent" }}
          onPress={() => onToggleUnitMode(item._id || item.id, "Case")}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: item.unitMode === "Case" ? "#fff" : "#7A7266" }}>Case</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 4, alignItems: "center", borderRadius: 6, backgroundColor: item.unitMode === "Unit" ? "#A67C2E" : "transparent" }}
          onPress={() => onToggleUnitMode(item._id || item.id, "Unit")}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: item.unitMode === "Unit" ? "#fff" : "#7A7266" }}>Unit</Text>
        </TouchableOpacity>
      </View>

      {/* Qty Counter */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, borderColor: "#D9D2C3", borderRadius: 8, padding: 4, backgroundColor: "#fff", borderWidth: 1 }}>
        <TouchableOpacity style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#F1EADB", justifyContent: "center", alignItems: "center" }} onPress={handleMinus}>
          <Entypo name="minus" size={12} color="#A67C2E" />
        </TouchableOpacity>
        <TextInput
          value={qtyText}
          onChangeText={(text) => {
            let cleaned = text.replace(/[^0-9]/g, "");
            let num = parseInt(cleaned || "0", 10);
            if (num > 999999) num = 999999;
            setQtyText(String(num));
            let units = item.unitMode === "Case" ? num * perCase : num;
            onUpdateQuantityUnits(item._id || item.id, units);
          }}
          keyboardType="numeric"
          style={{ width: 50, textAlign: "center", fontSize: 12, fontWeight: "700", color: "#1F1D1A", padding: 0 }}
          onFocus={() => setQtyText("")}
          onEndEditing={() => { if (!qtyText) { setQtyText("0"); onUpdateQuantityUnits(item._id || item.id, 0); } else commitQtyFromText(); }}
        />
        <TouchableOpacity style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#A67C2E", justifyContent: "center", alignItems: "center" }} onPress={handlePlus}>
          <Entypo name="plus" size={12} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Case Details Summary */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 9, color: "#7A7266", fontWeight: "500" }}>1 Case = {item.UnitperCase__c || 1} U</Text>
        <Text style={{ fontSize: 9, color: "#A67C2E", fontWeight: "600" }}>Total: {Math.floor((item.quantityUnits || 0) / perCase)}C • {(item.quantityUnits || 0)}U</Text>
      </View>
      <Modal
        visible={schemeTooltip.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setSchemeTooltip((prev) => ({ ...prev, visible: false }))}
      >
        <Pressable
          style={styles.tooltipOverlay}
          onPress={() => setSchemeTooltip((prev) => ({ ...prev, visible: false }))}
        >
          <Pressable
            style={styles.tooltipCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.tooltipHeader}>
              <View style={styles.tooltipTitleRow}>
                <Ionicons
                  name={schemeTooltip.status === "applied" ? "sparkles" : "information-circle"}
                  size={18}
                  color={schemeTooltip.status === "applied" ? "#25B34A" : "#D08C1F"}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.tooltipTitle}>{schemeTooltip.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSchemeTooltip((prev) => ({ ...prev, visible: false }))}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipMessage}>{schemeTooltip.message}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

// ---------- Main component ----------
export default function TakeOrder() {
  const [productsFromDb, setProductsFromDb] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Undefined");
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeApiBody, setSchemeApiBody] = useState(null);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const { apiFetch } = useApiFetch();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const selectedVisit = useSelector((state) => state.selectedVisit);
  const beatId = useSelector((state) => state.beatSelection.id);
  const distributorId = useSelector((state) => state.distributor.id);

  const [schemeModalVisible, setSchemeModalVisible] = useState(false);
  const [schemeModalData, setSchemeModalData] = useState([]);
  // const headingList = ["Must Sell", "Overdue", "Top Sell", "New Launch", "Scheme Pitch", "Other Products"];
  const headingList = ["Other Products"];
  const [collapsedSections, setCollapsedSections] = useState(() => {
    const map = {};
    headingList.forEach((h) => (map[h] = false));
    return map;
  });

  function toggleSection(title) {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }
  const [userData, setUserData] = useState(null);

  // const selectedBeatDay = useSelector((state: RootState) => state.selectedBeatDay.selectedBeatDay);
const selectedBeatDay = useSelector(
  (state) => state.selectedBeatDay.selectedBeatDay
);
// console.log('selectedBeatDay in TakeOrderScreen-----------------------------------------------------------------', selectedBeatDay)
  useEffect(() => {
    let mounted = true;
    (async function initializeData() {
      try {
        setLoading(true);
        const loggedInUser = await UniversalUpdateInsert({ ObjectName: "User", Type: "get" });
        setUserData(loggedInUser);
        const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, distributorId);
        if (accessibleSubCategories.length === 0) {
          Alert.alert("Access Denied", "You do not have access to any product categories assigned. Please contact your administrator.");
          navigation.goBack();
          return;
        }
        const allProducts = await UniversalUpdateInsert({ ObjectName: "Product2", Type: "get" });
        const uomData = await getCGCloudUOMData();
        // console.log('uomData', uomData)
        const uomDataMap = createUOMDataMap(uomData);
        const savedCartItems = await getSavedCartItems(selectedVisit?.sfId);
        const cartLookupMap = createCartLookupMap(savedCartItems);
// console.log('distributorId',distributorId)
        // const normalizedProductsRaw = await normalizeProducts(allProducts, uomDataMap, cartLookupMap, accessibleSubCategories, distributorId);
        const normalizedProductsRaw = await normalizeProducts(allProducts, uomDataMap, cartLookupMap, accessibleSubCategories, distributorId, selectedBeatDay);
        const normalizedProducts = (normalizedProductsRaw || []).map((p) => ({ ...p, PTR__c: sanitizeNumberForMoney(p.PTR__c ?? p.PTD__c ?? p.Price ?? 0) }));
        normalizedProducts.forEach((p) => {
          p.quantity = p.quantity || 0;
          p.quantityUnits = p.quantityUnits || p.quantity || 0;
          p.unitMode = p.unitMode || "Unit";
          p.appliedSchemeDiscount = 0;
          p.appliedSchemeDetails = [];
          p.schemeGenerated = false;
          p.isFree = p.isFree || false;
        });

        // const sfIdArray = normalizedProducts.map((item) => item.Sf_Id);
        // const payload = { productIds: sfIdArray, AccountId: selectedVisit?.AccountId };
        // const schemedataApi = await apiFetch("POST", "scheme-return", payload, "Custom");
        // const body = schemedataApi?.data?.responseBody ?? null;
        // setSchemeModalData(body);
        // if (!mounted) return;
        // setSchemeApiBody(body);

        const dynamicCategories = extractCategories(normalizedProducts);
        const ordered = await getOrderedCategories(dynamicCategories);
        const recommendedProductData = await UniversalUpdateInsert({
          ObjectName: "Recommended_Product__c",
          Type: "get",
          filters: [{ field: "Customer__c", value: selectedVisit?.AccountId }],
        });
        const recommendedRows = Array.isArray(recommendedProductData) ? recommendedProductData : recommendedProductData ? [recommendedProductData] : [];
        const recommendedSets = buildRecommendedSets(recommendedRows);
        const annotatedProducts = (normalizedProducts || []).map((p) => ({ ...p, recommendationTag: getRecommendationTagForProduct(p, recommendedSets) }));

        const brandPriority = [
          "H&T Oils",
          "Mantra",
          "Advans",
          "Amritā"
        ];
        const fetchedBrands = [
          ...new Set(
            annotatedProducts
              .map((p) => p.Brand__c)
              .filter(Boolean)
          )
        ];
        // jo priority brands available hain
        const orderedPriorityBrands = brandPriority.filter(b =>
          fetchedBrands.includes(b)
        );
        // jo baaki brands hain
        const remainingBrands = fetchedBrands.filter(
          b => !brandPriority.includes(b)
        );
        const uniqueBrands = [
          "All",
          ...orderedPriorityBrands,
          ...remainingBrands
        ];
        setBrands(uniqueBrands);
        setSelectedBrand("All");

        setProductsFromDb(annotatedProducts);
        setCategories(["All", ...ordered]);
        setSelectedCategory("All");
      } catch (err) {
        console.error("Init failed", err);
        Alert.alert("Error", "Failed to load products");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [beatId, selectedVisit?.sfId]);
  useEffect(() => {
    if (!productsFromDb.length) return;
    let active = true;
    const fetchSchemes = async () => {
      try {
        setSchemeLoading(true);
        const sfIdArray = productsFromDb.map((item) => item.Sf_Id);
        const payload = { productIds: sfIdArray, AccountId: selectedVisit?.AccountId, };
        const schemedataApi = await apiFetch("POST", "scheme-return", payload, "Custom");
        const body = schemedataApi?.data?.responseBody ?? null;
        if (!active) return;
        setSchemeModalData(body);
        setSchemeApiBody(body);
      } catch (err) {
        console.log("Scheme API Error", err);
      } finally {
        if (active) {
          setSchemeLoading(false);
        }
      }
    };
    fetchSchemes();
    return () => {
      active = false;
    };
  }, [productsFromDb.length]);

  // signature to avoid re-running on object ref churn — includes ptr and qty and isFree
  const baseProductsSignature = useMemo(() => {
    const base = productsFromDb.map((p) => ({ Sf_Id: p.Sf_Id, q: Number(p.quantity || p.quantityUnits || 0), ptr: sanitizeNumberForMoney(p.PTR__c ?? p.PTD__c ?? p.Price ?? 0), isFree: !!p.isFree }));
    return JSON.stringify(base);
  }, [productsFromDb]);

  // Subcategories
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  useEffect(() => {
    if (selectedCategory === "All") {
      setSubCategories([]);
      setSelectedSubCategory(null);
      return;
    }
    const subs = ["All", ...new Set(productsFromDb.filter((p) => (p.Category__c || "Undefined") === selectedCategory).map((p) => p.SubCategory__c).filter(Boolean))];
    setSubCategories(subs);
    setSelectedSubCategory((prev) => (prev && subs.includes(prev) ? prev : "All"));
  }, [selectedCategory, productsFromDb]);

  // PTR update
  const updatePTR = useCallback((id, mrp, value) => {
    let cleaned = String(value || "").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    let normalized = parts[0];
    if (parts.length > 1) normalized += "." + parts[1].slice(0, 2);
    if (normalized === "" || normalized === ".") {
      setProductsFromDb((prev) => prev.map((p) => (p._id === id || p.id === id ? { ...p, PTR__c: normalized } : p)));
      return;
    }
    const num = sanitizeNumberForMoney(normalized);
    const mrpNum = sanitizeNumberForMoney(mrp);
    // if (num <= 0) {
    //   dispatch(showToast({ message: "PTR must be greater than ₹0", type: "warning" }));
    //   return;
    // }
    if (mrp != null && mrp !== "" && Number.isFinite(mrpNum) && num >= mrpNum) {
      dispatch(showToast({ message: `PTR must be less than the MRP (MRP: ₹${mrpNum})`, type: "warning" }));
      return;
    }
    setProductsFromDb((prev) => prev.map((p) => (p._id === id || p.id === id ? { ...p, PTR__c: normalized } : p)));
  }, [dispatch]);

  // quantity updates
  // const updateQuantityUnits = useCallback((id, units) => {
  //   const safeUnits = Math.max(0, Math.floor(units || 0));
  //   setProductsFromDb((prev) => prev.map((p) => (p._id === id || p.id === id ? { ...p, quantityUnits: safeUnits, quantity: safeUnits } : p)));
  // }, []);
  const updateQuantityUnits = useCallback((id, updater) => {
    setProductsFromDb((prev) =>
      prev.map((p) => {
        if (p._id === id || p.id === id) {
          const current = p.quantityUnits || p.quantity || 0;
          const newUnits =
            typeof updater === "function"
              ? updater(current)
              : updater;
          const safeUnits = Math.max(0, Math.floor(newUnits || 0));
          return {
            ...p,
            quantityUnits: safeUnits,
            quantity: safeUnits,
          };
        }
        return p;
      })
    );
  }, []);

  const toggleUnitMode = useCallback((id, mode) => {
    setProductsFromDb((prev) => prev.map((p) => (p._id === id || p.id === id ? (p.unitMode === mode ? p : { ...p, unitMode: mode, quantityUnits: 0, quantity: 0 }) : p)));
  }, []);

  // ---------- SCHEME EVALUATION ----------
  useEffect(() => {
    if (!schemeApiBody) return;
    let active = true;
    (async () => {
      try {
        const normalizedSchemeItems = productsFromDb.map((prod, index) => ({
          key: String(prod.Sf_Id || prod.SfId || prod.id || prod._id || index).trim(),
          productId: String(prod.Sf_Id || prod.SfId || prod.id || prod._id || "").trim(),
          units: Number(prod.quantityUnits ?? prod.quantity ?? 0) || 0,
          unitPerCase: Number(prod.UnitperCase__c || prod.UnitPerCase || 1) || 1,
          weightPerUnitKg: Number(prod.Weight_Per_Unit_in_KG__c) || 0,
          unitPrice: getProductUnitPrice(prod),
          isFree: !!prod.isFree,
        }));

        const { lineResults } = evaluateSchemeResponse({
          items: normalizedSchemeItems,
          schemesResp: schemeApiBody,
        });

        const updatedMap = new Map();
        let runningTotalDiscount = 0;

        productsFromDb.forEach((prod, index) => {
          const key = String(prod.Sf_Id || prod.SfId || prod.id || prod._id || index).trim();
          const lineResult = lineResults[key] || { discount: 0, details: [] };
          const productDiscount = Number(lineResult.discount || 0);
          const appliedDetails = Array.isArray(lineResult.details) ? lineResult.details : [];
          const markedSchemeGenerated = appliedDetails.length > 0;

          runningTotalDiscount += productDiscount;

          if (markedSchemeGenerated || Number(prod.appliedSchemeDiscount || 0) > 0 || (prod.appliedSchemeDetails || []).length > 0) {
            updatedMap.set(String(prod.Sf_Id || prod.SfId || prod.id || prod._id || "").trim(), {
              ...prod,
              appliedSchemeDiscount: productDiscount,
              appliedSchemeDetails: appliedDetails,
              schemeGenerated: markedSchemeGenerated,
            });
          }
        });

        // Merge updatedMap into productsFromDb preserving others
        const merged = productsFromDb.map((p) => {
          const key = String(p.Sf_Id || p.SfId || p.id || p._id || "").trim();
          const applied = updatedMap.get(key);
          if (applied) return { ...p, ...applied };
          return {
            ...p,
            appliedSchemeDiscount: 0,
            appliedSchemeDetails: [],
            schemeGenerated: false,
          };
        });

        if (!active) return;

        // Compare signature and apply
        const newSignature = JSON.stringify(merged.map((p) => ({ Sf_Id: p.Sf_Id, q: p.quantity || p.quantityUnits || 0, sg: !!p.schemeGenerated, disc: Number(p.appliedSchemeDiscount || 0) })));
        const prevSignature = JSON.stringify(productsFromDb.map((p) => ({ Sf_Id: p.Sf_Id, q: p.quantity || p.quantityUnits || 0, sg: !!p.schemeGenerated, disc: Number(p.appliedSchemeDiscount || 0) })));
        if (newSignature !== prevSignature || Number(totalDiscount) !== Number(runningTotalDiscount)) {
          setProductsFromDb(merged);
          setTotalDiscount(Number(runningTotalDiscount));

          // broadcast enhanced preview (includes scheme counts)
          const itemsCountLocal = merged.filter((p) => p.quantity > 0).length;
          const totalUnitsLocal = merged.reduce((s, p) => s + (p.quantity || 0), 0);
          const totalPTRLocal = merged.reduce((a, p) => a + getProductUnitPrice(p) * (p.quantity || 0), 0);
          const netPTRLocal = (Number(totalPTRLocal) || 0) - (Number(runningTotalDiscount) || 0);

          const schemeProductsCount = merged.reduce((cnt, p) => cnt + ((p.appliedSchemeDetails && p.appliedSchemeDetails.length) ? 1 : 0), 0);
          const schemeWrappersAppliedCount = merged.reduce((cnt, p) => cnt + (p.appliedSchemeDetails ? p.appliedSchemeDetails.length : 0), 0);

          try {
            if (navigation.setParams) {
              navigation.setParams({
                cartPreview: {
                  items: itemsCountLocal,
                  qty: totalUnitsLocal,
                  ptr: totalPTRLocal,
                  discount: runningTotalDiscount,
                  netPTR: netPTRLocal,
                  schemeProductsCount,
                  schemeWrappersAppliedCount,
                },
              });
            }
          } catch (e) { /* ignore */ }

          DeviceEventEmitter.emit("CartPreviewUpdated", {
            items: itemsCountLocal,
            qty: totalUnitsLocal,
            ptr: totalPTRLocal,
            discount: runningTotalDiscount,
            netPTR: netPTRLocal,
            schemeProductsCount,
            schemeWrappersAppliedCount,
          });
        }
      } catch (err) {
        console.error("Error applying schemes:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [schemeApiBody, baseProductsSignature]); // depend on compact signature (prevents churn loop)

  useEffect(() => {
    const cats = [
      "All",
      ...new Set(
        productsFromDb
          .filter((p) =>
            selectedBrand === "All"
              ? true
              : p.Brand__c === selectedBrand
          )
          .map((p) => p.Category__c)
          .filter(Boolean)
      ),
    ];

    setCategories(cats);
    // setSelectedCategory("All");
    setSelectedCategory((prev) =>
      cats.includes(prev) ? prev : "All"
    );
  }, [selectedBrand, productsFromDb]);

  const filteredProducts = useMemo(() => {
    const t = searchText.trim().toLowerCase();

    return productsFromDb.filter((p) => {
      if (p.isFree) return false;

      // const stock = p.Stock;
      // if (!Number.isFinite(stock) || stock <= 0) return false;

      // COMMENTED OUT: Do not filter out products with zero/null stock
      // const stock = p.Stock;
      // const isASO = userData?.[0]?.DeveloperName === "H_T_ASO";
      // // console.log(stock);
      // // console.log('loggedInUser', userData[0]?.DeveloperName);
      // if (isASO) {
      //   if (stock === "Stock Record Not Get") return false;
      // } else {
      //   if (!Number.isFinite(stock) || stock <= 0) return false;
      // }


      // BRAND FILTER
      if (selectedBrand !== "All") {
        if ((p.Brand__c || "").trim() !== selectedBrand) {
          return false;
        }
      }

      // CATEGORY FILTER
      if (selectedCategory !== "All") {
        const cat = (p.Category__c || "Undefined").trim();
        if (cat !== selectedCategory) return false;

        if (
          selectedSubCategory &&
          selectedSubCategory !== "All" &&
          p.SubCategory__c !== selectedSubCategory
        ) {
          return false;
        }
      }

      if (!t) return true;
      return (p.Name || "").toLowerCase().includes(t);
    });
  }, [
    productsFromDb,
    selectedBrand,
    selectedCategory,
    selectedSubCategory,
    searchText
  ]);

  function sortProductsAlphabetically(products = []) {
    return [...products].sort((a, b) => {
      const nameA = (a.Name || "").toLowerCase();
      const nameB = (b.Name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

function sortProductsGrouped(products = []) {
  return [...products].sort((a, b) => {
    // BRAND
    const brandA = (a.Brand__c || "").toLowerCase();
    const brandB = (b.Brand__c || "").toLowerCase();
    if (brandA !== brandB) {
      return brandA.localeCompare(brandB);
    }
    // CATEGORY
    const categoryA = (a.Category__c || "").toLowerCase();
    const categoryB = (b.Category__c || "").toLowerCase();
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB);
    }
    // SUB CATEGORY
    const subCategoryA = (a.SubCategory__c || "").toLowerCase();
    const subCategoryB = (b.SubCategory__c || "").toLowerCase();
    if (subCategoryA !== subCategoryB) {
      return subCategoryA.localeCompare(subCategoryB);
    }
    // PRODUCT NAME
    const nameA = (a.Name || "").toLowerCase();
    const nameB = (b.Name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

  const sections = useMemo(() => {
    // const headings = ["Must Sell", "Overdue", "Top Sell", "New Launch", "Scheme Pitch"];
    const headings = [];
    const sectionMap = headings.reduce((acc, h) => { acc[h] = []; return acc; }, {});
    const other = [];
    const used = new Set();
    for (const p of filteredProducts) {
      const sf = p.Sf_Id || p.id || p._id;
      if (!sf) {
        if (!used.has(p)) { other.push(p); used.add(p); }
        continue;
      }
      const tag = p.recommendationTag || null;
      if (tag && sectionMap[tag] && !used.has(sf)) { sectionMap[tag].push(p); used.add(sf); }
      else if (!used.has(sf)) { other.push(p); used.add(sf); }
    }
    const result = headings.map((h) => {
      const actualData = sectionMap[h] || [];
      // const sortedData = sortProductsAlphabetically(actualData);
      const sortedData = sortProductsGrouped(actualData);
      return {
        title: h,
        data: sortedData.length === 0
          ? []
          : (collapsedSections[h] ? [] : sortedData),
        isEmpty: sortedData.length === 0,
        count: sortedData.length
      };
      // return { title: h, data: actualData.length === 0 ? [] : (collapsedSections[h] ? [] : actualData), isEmpty: actualData.length === 0, count: actualData.length };
    });
    const actualOther = other || [];
    // const sortedOther = sortProductsAlphabetically(actualOther);
    const sortedOther = sortProductsGrouped(actualOther);

    result.push({
      title: "Other Products",
      data: sortedOther.length === 0
        ? []
        : (collapsedSections["Other Products"] ? [] : sortedOther),
      isEmpty: sortedOther.length === 0,
      count: sortedOther.length
    });
    // result.push({ title: "Other Products", data: actualOther.length === 0 ? [] : (collapsedSections["Other Products"] ? [] : actualOther), isEmpty: actualOther.length === 0, count: actualOther.length });
    return result;
  }, [filteredProducts, collapsedSections]);

  const totalPTR = useMemo(() => productsFromDb.reduce((a, p) => a + getProductUnitPrice(p) * (p.quantity || 0), 0), [productsFromDb]);
  const totalUnits = useMemo(() => productsFromDb.reduce((sum, p) => sum + (p.quantity || 0), 0), [productsFromDb]);
  const quantitySummary = useMemo(
    () => productsFromDb.reduce((summary, product) => {
      const quantity = Number(product.quantity || product.quantityUnits) || 0;
      const mode = String(product.unitMode || "Unit").toLowerCase();
      if (mode === "case" || mode === "box") {
        summary.cases += quantity / (Number(product.UnitperCase__c) || 1);
      } else {
        summary.units += quantity;
      }
      return summary;
    }, { cases: 0, units: 0 }),
    [productsFromDb],
  );
  const itemsCount = useMemo(() => productsFromDb.filter((p) => p.quantity > 0 && !p.isFree).length, [productsFromDb]);
  const netPTR = useMemo(() => (Number(totalPTR) || 0) - (Number(totalDiscount) || 0), [totalPTR, totalDiscount]);

  // ---------- Save cart ----------
  const saveCartToDB = useCallback(async () => {
    Keyboard.dismiss();
    await new Promise(resolve => setTimeout(resolve, 100));
    // require at least one PAID product with qty > 0
    const paidItemsCount = productsFromDb.filter((p) => Number(p.quantity || p.quantityUnits || 0) > 0 && !p.isFree).length;
    if (paidItemsCount === 0) {
      dispatch(showToast({ message: "Add quantity for at least one paid product to continue", type: "warning" }));
      return;
    }

    // Validate only paid items (skip free items)
    const invalids = [];
    /*
    for (const p of productsFromDb) {
      const qty = Number(p.quantity || p.quantityUnits || 0) || 0;
      if (qty <= 0) continue;

      // skip validation for free / FOC products
      if (p.isFree) continue;

      const ptrRaw = p.PTR__c ?? p.PTD__c ?? p.Price ?? 0;
      const ptrNum = sanitizeNumberForMoney(ptrRaw);
      const mrpNum = sanitizeNumberForMoney(p.MRP__c ?? p.MRP ?? 0);

      if (!(ptrNum > 0)) {
        invalids.push({ product: p, reason: "PTR must be greater than 0" });
        continue;
      }
      if (mrpNum > 0 && ptrNum >= mrpNum) {
        invalids.push({ product: p, reason: `PTR must be less than MRP (MRP: ₹${mrpNum})` });
        continue;
      }
    }
    */

    if (invalids.length > 0) {
      const first = invalids[0];
      const name = first.product?.Name || first.product?.Sf_Id || "Product";
      dispatch(showToast({ message: `${name}: ${first.reason}`, type: "warning" }));
      return;
    }

    // All validation passed — proceed with save flow
    try {
      const existingCartItems = await getSavedCartItems(selectedVisit?.sfId);
      const existingCartMap = createCartLookupMap(existingCartItems);
      const cartPayload = buildCartPayload(productsFromDb, selectedVisit?.sfId, existingCartMap);

      // attach totals and scheme info
      cartPayload.totalDiscount = Number(totalDiscount) || 0;
      cartPayload.netPTR = Number(netPTR) || 0;
      cartPayload.schemeGeneratedItems = productsFromDb.filter((p) => p.schemeGenerated).map((p) => ({ Sf_Id: p.Sf_Id, quantity: p.quantity, schemeId: p.schemeId, schemeName: p.schemeName, appliedSchemeDetails: p.appliedSchemeDetails }));

      await saveCartItemsToDb(cartPayload);

      const schemeProductsCount = productsFromDb.reduce((cnt, p) => cnt + ((p.appliedSchemeDetails && p.appliedSchemeDetails.length) ? 1 : 0), 0);
      const schemeWrappersAppliedCount = productsFromDb.reduce((cnt, p) => cnt + (p.appliedSchemeDetails ? p.appliedSchemeDetails.length : 0), 0);

      DeviceEventEmitter.emit("CartSaved", {
        items: cartPayload.products?.length || productsFromDb.filter((p) => p.quantity > 0).length,
        totalDiscount: cartPayload.totalDiscount,
        netPTR: cartPayload.netPTR,
        schemeProductsCount,
        schemeWrappersAppliedCount,
      });

      navigation.navigate("CartScreen", { orderClassification });
    } catch (err) {
      console.error("Save cart failed", err);
      dispatch(showToast({ message: "Failed to save cart", type: "error" }));
    }
  }, [productsFromDb, selectedVisit?.sfId, navigation, dispatch, totalDiscount, netPTR, orderClassification]);


  useEffect(() => {
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setTimeout(() => { }, 50);
    });

    return () => hideSub.remove();
  }, []);
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#C9A24D" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <>
        <View style={styles.container}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 0.85 }}>
              <View style={styles.searchContainer}>
                <TextInput placeholder="Search" value={searchText} onChangeText={setSearchText} style={styles.searchInput} />
                <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
              </View>
            </View>

            <View style={{ flex: 0.15 }}>
              <TouchableOpacity style={styles.schemeButton} onPress={() => setSchemeModalVisible(true)}>
                <View style={styles.schemeContent}>
                  <View style={styles.schemeIconWrap}>
                    <Ionicons name="pricetags" size={25} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {brands.map((brand) => {
                const active = selectedBrand === brand;

                return active ? (
                  <LinearGradient
                    key={brand}
                    colors={Gradients.primary}
                    style={[styles.categoryBtn, styles.categoryBtnActive]}
                  >
                    <TouchableOpacity onPress={() => setSelectedBrand(brand)}>
                      <Text style={[styles.categoryText, styles.categoryTextActive]}>
                        {brand}
                      </Text>
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
            <View style={styles.categoryRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll} style={{ flex: 1 }}>
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return active ? (
                    <LinearGradient key={cat} colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.categoryBtn, styles.categoryBtnActive]}>
                      <TouchableOpacity onPress={() => setSelectedCategory(cat)} activeOpacity={0.8}>
                        <Text style={[styles.categoryText, styles.categoryTextActive]}>{cat?.toLowerCase() === 'flour' ? 'Staples' : cat}</Text>
                        {/* <Text style={[styles.categoryText, styles.categoryTextActive]}>{cat}</Text> */}
                      </TouchableOpacity>
                    </LinearGradient>
                  ) : (
                    <TouchableOpacity key={cat} style={[styles.categoryBtn, styles.categoryBtnInactive]} onPress={() => setSelectedCategory(cat)} activeOpacity={0.8}>
                      <Text style={styles.categoryText}>{cat?.toLowerCase() === 'flour' ? 'Staples' : cat}</Text>
                      {/* <Text style={styles.categoryText}>{cat}</Text> */}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {subCategories.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryScroll, { marginHorizontal: 1 }]}>
                  {subCategories.map((sub) => {
                    const active = selectedSubCategory === sub;
                    return active ? (
                      <LinearGradient key={sub} colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.categoryBtn, styles.categoryBtnActive]}>
                        <TouchableOpacity onPress={() => setSelectedSubCategory(sub)} activeOpacity={0.8}>
                          <Text style={[styles.categoryText, styles.categoryTextActive]}>{sub}</Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    ) : (
                      <TouchableOpacity key={sub} style={[styles.categoryBtn, styles.categoryBtnInactive]} onPress={() => setSelectedSubCategory(sub)} activeOpacity={0.8}>
                        <Text style={styles.categoryText}>{sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {schemeLoading && (
            <Text style={{
              fontSize: 15,
              color: "#A67C2E",
              marginBottom: 5,
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}>
              Loading schemes...
            </Text>
          )}
          <KeyboardAwareFlatList
            data={sections}
            keyExtractor={(section) => section.title}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            enableOnAndroid={true}
            extraScrollHeight={120}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: section }) => {
              const isCollapsed = collapsedSections[section.title];
              return (
                <View style={styles.fullSectionCard}>
                  {section.title !== "Other Products" && (
                    <TouchableOpacity onPress={() => toggleSection(section.title)} style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitleText}>
                        {section.title === "Must Sell" ? `Must Sell SKUs`
                          : section.title === "Overdue" ? `Overdue SKUs`
                            : section.title === "Top Sell" ? `Top Sell SKUs`
                              : section.title === "New Launch" ? `New Launch SKUs`
                                : section.title === "Scheme Pitch" ? `Scheme Pitch SKUs`
                                  : section.title === "Other Products" ? `All Others SKUs`
                                    : section.title
                        }
                      </Text>
                      <AntDesign name={isCollapsed ? "down" : "up"} size={18} />
                    </TouchableOpacity>
                  )}

                  {(section.title === "Other Products" || !isCollapsed) && section.data.length === 0 && <Text style={{ textAlign: "center", padding: 14, color: "#777" }}>No items available in this section</Text>}

                  {(section.title === "Other Products" || !isCollapsed) && section.data.length > 0 && (
                    <FlatList
                      data={section.data}
                      keyExtractor={(item) => item._id || item.id || item.Sf_Id}
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled
                      contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 4 }}
                      numColumns={2}
                      columnWrapperStyle={{ justifyContent: "space-between" }}
                      renderItem={({ item }) => (
                        <ProductItem item={item} onUpdateQuantityUnits={updateQuantityUnits} onToggleUnitMode={toggleUnitMode} onUpdatePTR={updatePTR} schemeApiBody={schemeApiBody} allProducts={productsFromDb} isNonDmsOrder={orderClassification.isNonDmsOrder} />
                      )}
                    />
                  )}
                </View>
              );
            }}
          />



          {(sections.length === 0 || filteredProducts.length === 0) && (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ color: "#000" }}>No products found</Text>
            </View>
          )}
        </View>

        {itemsCount > 0 && (
          <>
            <LinearGradient colors={Gradients.primary} style={styles.bottomSummary}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBlock}><Text style={styles.summaryLabel}>Items</Text><Text style={styles.summaryValue}>{itemsCount}</Text></View>
                <View style={styles.summaryBlock}><Text style={styles.summaryLabel}>Cases</Text><Text style={styles.summaryValue}>{quantitySummary.cases}</Text></View>
                <View style={styles.summaryBlock}><Text style={styles.summaryLabel}>Units</Text><Text style={styles.summaryValue}>{quantitySummary.units}</Text></View>
                {!orderClassification.isNonDmsOrder && <View style={styles.summaryBlock}><Text style={styles.summaryLabel}>PTR</Text><Text style={styles.summaryValue}>₹{Number(totalPTR).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>}
              </View>
            </LinearGradient>

            <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cartSummarybutton}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity style={styles.viewCartBtn} onPress={saveCartToDB}>
                  <Text style={styles.viewCartText}>Add To Cart</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </>
        )}

        <SchemeModal visible={schemeModalVisible} onClose={() => setSchemeModalVisible(false)} schemeResponse={schemeModalData} />
      </>
    </KeyboardAvoidingView>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, paddingHorizontal: 9, borderTopRightRadius: 30, borderTopLeftRadius: 30, backgroundColor: "#fff" },
  searchContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 10, marginBottom: 7, height: 36, backgroundColor: "#fff" },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, textAlignVertical: "center" },
  searchIcon: { marginRight: 8 },

  categoryContainer: { borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 10, marginBottom: 10 },
  categoryScroll: { paddingHorizontal: 4 },
  categoryBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, justifyContent: "center", alignItems: "center" },
  categoryBtnInactive: { backgroundColor: "#F1EADB", borderWidth: 1, borderColor: "#C9A24D" },
  categoryText: { color: "#000" },
  categoryTextActive: { color: "#fff" },

  categoryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  sectionHeaderContainer: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 0.3, borderRadius: 4, marginBottom: 8, borderTopLeftRadius: 20, borderBottomRightRadius: 20 },
  sectionHeaderTitle: { fontWeight: "600", fontSize: 16, color: "#0D0D0D" },
  sectionHeaderCount: { fontWeight: "600", fontSize: 16, color: "#0D0D0D" },
  chevron: { fontSize: 14, marginLeft: 4, color: "#666" },

  bottomSummary: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 12, paddingHorizontal: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: "#fff", fontSize: 11, opacity: 0.9 },
  summaryValue: { color: "#fff", fontSize: 13, fontWeight: "600" },

  cartSummarybutton: { position: "absolute", right: 10, bottom: 100, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  viewCartText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  imageWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#F4F6FB", justifyContent: "center", alignItems: "center", marginRight: 6 },
  image: { width: 30, height: 30, resizeMode: "contain" },

  name: { fontSize: 12, fontWeight: "600", color: "#1F1D1A", lineHeight: 14 },
  priceText: { fontSize: 9, fontWeight: "500", color: "#A67C2E", marginTop: 1 },

  infoGrid2Col: { flexDirection: "row", justifyContent: "space-between", marginTop: 3, marginBottom: 3 },
  infoCol: { width: "48%" },
  infoLabel: { fontSize: 11, fontWeight: "500", color: "#666" },
  infoValue: { fontSize: 12, fontWeight: "700", color: "#000" },

  ptrInputLarge: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, textAlign: "center", height: 22, fontSize: 13, paddingVertical: 0 },

  modeCenterRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 2, marginBottom: 3 },
  bigModeBtn: { paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1, borderColor: "#A67C2E", borderRadius: 10, backgroundColor: "#fff" },
  bigModeActive: { backgroundColor: "#A67C2E" },
  bigModeText: { fontSize: 13, fontWeight: "600", color: "#A67C2E" },
  bigModeTextActive: { color: "#fff" },

  counterAlignedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, backgroundColor: "#F1EADB", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  qtyInput: { width: 36, height: 26, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, textAlign: "center", fontSize: 12, fontWeight: "600", marginHorizontal: 0, paddingVertical: 0 },
  qtyBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#A67C2E", justifyContent: "center", alignItems: "center" },

  caseInfoCompact: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4, marginTop: 4, marginBottom: 0 },
  caseInfoCompactText: { fontSize: 8, fontWeight: "500", color: "#555" },

  sectionCard: { backgroundColor: "#FFF5F6", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: "#888", borderBottomWidth: 0.2, paddingBottom: 10, marginBottom: 10 },
  sectionTitleText: { fontSize: 16, fontWeight: "700", color: "#1F1D1A" },
  sectionSubText: { fontSize: 13, color: "#67728A", marginTop: 4 },
  sectionArrowBox: { width: 34, height: 34, borderRadius: 18, backgroundColor: "#F7EAC9", justifyContent: "center", alignItems: "center", marginLeft: 10 },
  sectionBodyBackground: { backgroundColor: "#FFF5F6", borderRadius: 12, paddingVertical: 10, marginBottom: 14 },
  fullSectionCard: { backgroundColor: "#FFF5F6", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 5, marginBottom: 10 },

  schemeButton: { marginLeft: 0, marginTop: -10 },
  schemeContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, minWidth: 140, maxWidth: 220 },
  schemeIconWrap: { width: 40, height: 40, borderRadius: 28, backgroundColor: Gradients.primary?.[0] || "#A67C2E", justifyContent: "center", alignItems: "center", marginRight: 8 },

  card: {
    width: "48%",
    borderRadius: 12,
    padding: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  tooltipCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  tooltipTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    flexShrink: 1,
  },
  tooltipMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
  },
});
