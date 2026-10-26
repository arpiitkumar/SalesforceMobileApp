import { UNITS_PER_CASE } from "./helper/caseUnits";
// utils/getPricingService.js
/**
 * Reusable pricing service extracted from CartScreen.
 * - calculateItemPricing(item, qtyOverride) -> pricing object (fields match names used in CartScreen)
 * - calculateCartTotals(items) -> { totalUnits, totalPTR, totalGrossAmount, totalDiscount, totalNetAmount, totalOrderAmount }
 */
const round2 = (v) => Number(Number(v).toFixed(2));
const round3 = (v) => Number(Number(v).toFixed(3));
const round = (v) => Number(Number(v).toFixed(3));


const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function getUnitPerCase(item) {
  return UNITS_PER_CASE;
}

export function isCaseMode(item = {}) {
  const mode = item.UnitMode ?? item.UnitMode__c ?? item.UOM__c ?? item.UOM_Selected__c;
  const normalizedMode = String(mode).trim().toLowerCase();
  return normalizedMode === "10" ||
    normalizedMode.includes("case") ||
    normalizedMode.includes("box");
}

export function getWeightPerUnitKg(item) {
  return toNum(item.Weight_Per_Unit_in_KG__c, 1);
}

export function getFinalQuantity(item, qtyOverride) {
  const qty = typeof qtyOverride !== 'undefined' ? toNum(qtyOverride, 0) : toNum(item.Quantity, 0);
  if (isCaseMode(item)) {
    return qty * getUnitPerCase(item);
  }
  // treat everything else as unit
  return qty;
}

export function calculateItemPricing(item, qtyOverride) {
  // normalize inputs
  const PTR = toNum(item.PTR__c || item.PTR || item.PTD__c, 0);
  const GST = toNum(item.GSTPercentage__c || item.GST || 0);
  const unitPerCase = getUnitPerCase(item);
  const weightPerUnit = getWeightPerUnitKg(item);
  const SchemeDiscount = toNum(item.AppliedDiscount__c || item.SchemeDiscount__c || 0);
  const CGST_Percent = toNum(item.CGST__c || 0);
  const SGST_Percent = toNum(item.SGST__c || 0);
  const rewardType = item.RewardType__c;

  const actualQty = getFinalQuantity(item, qtyOverride);

  // per unit values
  const gstAmountPerUnit = round2((PTR * GST) / 100);
  const ptrWithoutGst = round2(PTR - gstAmountPerUnit);

  // gross amount
  const grossAmount = round2((PTR / 1.05) * actualQty);

  // scheme discount + taxable amount (CLIENT LOGIC)
  let schemeDiscountAmount = 0;
  let taxableAmount = grossAmount;

  if (rewardType === "Discount by Percentage" && SchemeDiscount > 0) {
    // reverse percentage (Excel: =C5/1.02)
    taxableAmount = round2(grossAmount / (1 + SchemeDiscount / 100));
    schemeDiscountAmount = round2(grossAmount - taxableAmount);
  }
  else if (rewardType === "Discount by Value") {
    schemeDiscountAmount = round2(SchemeDiscount);
    taxableAmount = round2(grossAmount - schemeDiscountAmount);
  }

  // CGST / SGST
  const CGST_Amount = round2((taxableAmount * CGST_Percent) / 100);
  const SGST_Amount = round2((taxableAmount * SGST_Percent) / 100);

  // order amount (GST total)
  const orderAmount = round2((taxableAmount * GST) / 100);

  // net amount
  const netAmount = round2(taxableAmount + CGST_Amount + SGST_Amount);

  // helper derived fields
  const Order_Quantity_In_Mt__c = round3((weightPerUnit * actualQty) / 1000);

  const OrderQtyInCase__c =
    isCaseMode(item)
      ? (typeof qtyOverride !== 'undefined' ? toNum(qtyOverride, 0) : toNum(item.Quantity, 0))
      : round3(
        (typeof qtyOverride !== 'undefined'
          ? toNum(qtyOverride, 0)
          : toNum(item.Quantity, 0)) / unitPerCase
      );

  // 🔍 clean logs
  console.log('PTR', PTR);
  console.log('GST', GST);
  console.log('actualQty', actualQty);
  console.log('grossAmount', grossAmount);
  console.log('schemeDiscountAmount', schemeDiscountAmount);
  console.log('taxableAmount', taxableAmount);
  console.log('CGST_Amount', CGST_Amount);
  console.log('SGST_Amount', SGST_Amount);
  console.log('netAmount', netAmount);

  return {
    actualQty,
    unitPerCase,
    weightPerUnit,
    PTR,
    GST,
    gstAmountPerUnit,
    ptrWithoutGst,
    GrossAmount__c: grossAmount,
    TaxableAmount: taxableAmount,
    CGST_Amount__c: CGST_Amount,
    SGST_Amount__c: SGST_Amount,
    Order_Amount__c: orderAmount,
    NetAmount__c: netAmount,
    Order_Quantity_In_Mt__c,
    OrderQtyInCase__c,
    Calculate_AppliedDiscount__c: schemeDiscountAmount
  };
}



export function calculateItemPricingPrashantOld(item, qtyOverride) {
  // normalize inputs
  const PTR = toNum(item.PTR__c || item.PTR || item.PTD__c, 0);
  const GST = toNum(item.GSTPercentage__c || item.GST || 0);
  const unitPerCase = getUnitPerCase(item);
  const weightPerUnit = getWeightPerUnitKg(item);
  const SchemeDiscount = toNum(item.AppliedDiscount__c || item.SchemeDiscount__c || 0);
  const CGST_Percent = toNum(item.CGST__c || 0);
  const SGST_Percent = toNum(item.SGST__c || 0);
  const rewardType = item.RewardType__c;

  const actualQty = getFinalQuantity(item, qtyOverride);

  // per unit values
  const gstAmountPerUnit = round2((PTR * GST) / 100);
  const ptrWithoutGst = round2(PTR - gstAmountPerUnit);

  // gross amount
  const grossAmount = round2((PTR / 1.05) * actualQty);

  // scheme discount
  let schemeDiscountAmount = 0;
  if (rewardType === "Discount by Percentage") {
    schemeDiscountAmount = round2((grossAmount * SchemeDiscount) / 100);
  } else if (rewardType === "Discount by Value") {
    schemeDiscountAmount = round2(SchemeDiscount);
  }

  // taxable amount
  const taxableAmount = round2(grossAmount - schemeDiscountAmount);

  // CGST / SGST
  const CGST_Amount = round2((taxableAmount * CGST_Percent) / 100);
  const SGST_Amount = round2((taxableAmount * SGST_Percent) / 100);

  // order amount (GST total)
  const orderAmount = round2((taxableAmount * GST) / 100);

  // net amount
  const netAmount = round2(taxableAmount + CGST_Amount + SGST_Amount);

  // helper derived fields
  const Order_Quantity_In_Mt__c = round2((weightPerUnit * actualQty) / 1000);

  const OrderQtyInCase__c =
    (item.UnitMode === 'Case' || (item.UnitMode || '').toLowerCase() === 'case')
      ? (typeof qtyOverride !== 'undefined' ? toNum(qtyOverride, 0) : toNum(item.Quantity, 0))
      : round2(
        (typeof qtyOverride !== 'undefined'
          ? toNum(qtyOverride, 0)
          : toNum(item.Quantity, 0)) / unitPerCase
      );

  // 🔍 clean logs (now only 2 decimals)
  console.log('PTR', PTR);
  console.log('GST', GST);
  console.log('actualQty', actualQty);
  console.log('grossAmount', grossAmount);
  console.log('schemeDiscountAmount', schemeDiscountAmount);
  console.log('taxableAmount', taxableAmount);
  console.log('CGST_Amount', CGST_Amount);
  console.log('SGST_Amount', SGST_Amount);
  console.log('netAmount', netAmount);

  return {
    actualQty,
    unitPerCase,
    weightPerUnit,
    PTR,
    GST,
    gstAmountPerUnit,
    ptrWithoutGst,
    GrossAmount__c: grossAmount,
    TaxableAmount: taxableAmount,
    CGST_Amount__c: CGST_Amount,
    SGST_Amount__c: SGST_Amount,
    Order_Amount__c: orderAmount,
    NetAmount__c: netAmount,
    Order_Quantity_In_Mt__c,
    OrderQtyInCase__c,
    Calculate_AppliedDiscount__c: schemeDiscountAmount
  };
}


export function calculateCartTotals(items = []) {
  const totals = items.reduce((acc, item) => {
    // If item already has computed pricing fields (NetAmount__c etc) use them; otherwise compute
    const pricing = (item && typeof item.NetAmount__c !== 'undefined')
      ? {
        GrossAmount__c: toNum(item.GrossAmount__c, 0),
        Calculate_AppliedDiscount__c: toNum(item.Calculate_AppliedDiscount__c, 0),
        NetAmount__c: toNum(item.NetAmount__c, 0),
        Order_Amount__c: toNum(item.Order_Amount__c, 0),
      }
      : calculateItemPricing(item);

    // total units: respect UnitMode
    let unitsToAdd = 0;
    if ((item.UnitMode || '').toLowerCase() === 'case' || item.UnitMode === 'Case') {
      unitsToAdd = toNum(item.Quantity, 0) * getUnitPerCase(item);
    } else {
      unitsToAdd = toNum(item.Quantity, 0);
    }

    // total PTR: looks like you want PTR * qty * unitPerCase for case
    const pricePerUnit = toNum(item.PTR__c || item.PTR || item.PTD__c, 0);
    const totalPtrLine = ((item.UnitMode === 'Case' || (item.UnitMode || '').toLowerCase() === 'case')
      ? pricePerUnit * toNum(item.Quantity, 0) * getUnitPerCase(item)
      : pricePerUnit * toNum(item.Quantity, 0)
    );

    acc.totalUnits += unitsToAdd;
    acc.totalPTR += totalPtrLine;
    acc.totalGrossAmount += toNum(pricing.GrossAmount__c, 0);
    acc.totalDiscount += toNum(pricing.Calculate_AppliedDiscount__c, 0);
    acc.totalNetAmount += toNum(pricing.NetAmount__c, 0);
    acc.totalOrderAmount += toNum(pricing.Order_Amount__c, 0);

    return acc;
  }, {
    totalUnits: 0,
    totalPTR: 0,
    totalGrossAmount: 0,
    totalDiscount: 0,
    totalNetAmount: 0,
    totalOrderAmount: 0
  });

  return totals;
}
