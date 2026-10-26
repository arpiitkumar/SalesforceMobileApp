import { ORDER_TYPES } from './orderClassifier';

/**
 * Builds the Order__c header payload.
 *
 * @param {Object} headerData - Raw order header inputs
 * @param {{ isNonDmsOrder?: boolean, orderType?: string }} classification
 * @returns {Object} Salesforce Order__c payload
 */
export function buildOrderHeaderPayload(headerData = {}, classification = {}) {
  const isNonDms = !!(
    classification.isNonDmsOrder === true ||
    classification.orderType === ORDER_TYPES.NON_DMS
  );

  return {
    ...headerData,
    IsNonDmsOrder__c: isNonDms,
  };
}

/**
 * Builds the OrderItem payload according to strict DMS vs Non-DMS contracts.
 *
 * @param {Object} item - Cart or line item data
 * @param {{ isNonDmsOrder?: boolean, orderType?: string }} classification
 * @param {string} orderId - Parent Salesforce/local Order ID
 * @returns {Object} Compliant Order item payload
 */
export function buildOrderItemPayload(item = {}, classification = {}, orderId = '') {
  const isNonDms = !!(
    classification.isNonDmsOrder === true ||
    classification.orderType === ORDER_TYPES.NON_DMS
  );

  const productId = item.Product2Id || item.Product2Id__c || item.product2Id || item.Sf_Id || '';
  const enteredQty = Number(item.Entered_Quantity__c ?? item.Quantity ?? item.quantity ?? 0);
  const uom = item.UOM_Selected__c || item.UnitMode || item.unitMode || item.UOM__c || 'Unit';
  const isCaseOrder = uom === 'Case' || uom === 'Box' || Number(uom) === 10;
  const selectedQuantity = Number(item.quantity ?? item.Quantity ?? item.Entered_Quantity__c ?? 0);

  if (isNonDms) {
    // STRICT CONTRACT: ONLY 5 fields permitted for Non-DMS order items
    return {
      OrderId__c: orderId,
      Product2Id__c: productId,
      Entered_Quantity__c: enteredQty,
      UOM_Selected__c: isCaseOrder ? 10 : 20,
      Quantity_In_Box__c: isCaseOrder ? selectedQuantity : 0,
      Quantity_In_Pcs__c: isCaseOrder ? 0 : selectedQuantity,
    };
  }

  // DMS Order Item payload: Includes all financial/pricing fields
  return {
    OrderId__c: orderId,
    Product2Id__c: productId,
    Entered_Quantity__c: enteredQty,
    UOM_Selected__c: isCaseOrder ? 10 : 20,
    Net_Amount__c: Number(item.Net_Amount__c ?? item.NetAmount__c ?? 0),
    Quantity_In_Box__c: isCaseOrder ? selectedQuantity : 0,
    Quantity_In_Pcs__c: isCaseOrder ? 0 : selectedQuantity,
    Tax_Amount__c: Number(item.Tax_Amount__c ?? item.TaxableAmount__c ?? 0),
    UnitPrice__c: Number(item.UnitPrice__c ?? item.UnitPrice ?? item.PTD__c ?? item.PTR__c ?? 0),
    TotalPrice__c: Number(item.TotalPrice__c ?? item.GrossAmount__c ?? 0),
    CGST_Amount__c: Number(item.CGST_Amount__c ?? item.cGST_Amount__c ?? 0),
    SGST_Amount__c: Number(item.SGST_Amount__c ?? item.sGST_Amount__c ?? 0),
    IGST_Amount__c: Number(item.IGST_Amount__c ?? item.iGST_Amount__c ?? 0),
  };
}

const FORBIDDEN_NON_DMS_FIELDS = [
  'Net_Amount__c',
  'Tax_Amount__c',
  'UnitPrice__c',
  'TotalPrice__c',
  'CGST_Amount__c',
  'SGST_Amount__c',
  'IGST_Amount__c',
];

const REQUIRED_DMS_FINANCIAL_FIELDS = [
  'Net_Amount__c',
  'Tax_Amount__c',
  'UnitPrice__c',
  'TotalPrice__c',
  'CGST_Amount__c',
  'SGST_Amount__c',
  'IGST_Amount__c',
];

/**
 * Validates the generated order header and items against classification contracts.
 *
 * @param {Object} header
 * @param {Array<Object>} items
 * @param {{ isNonDmsOrder?: boolean, orderType?: string }} classification
 * @returns {{ isValid: boolean, errors: Array<string> }}
 */
export function validateOrderPayload(header, items = [], classification = {}) {
  const errors = [];
  const isNonDms = !!(
    classification.isNonDmsOrder === true ||
    classification.orderType === ORDER_TYPES.NON_DMS
  );

  if (!header) {
    errors.push('Order header payload is missing');
  } else {
    if (header.IsNonDmsOrder__c !== isNonDms) {
      errors.push(`Header IsNonDmsOrder__c (${header.IsNonDmsOrder__c}) does not match expected classification (${isNonDms})`);
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('Order items payload is empty');
  } else {
    items.forEach((item, idx) => {
      if (isNonDms) {
        // Non-DMS check: MUST NOT have forbidden financial keys
        FORBIDDEN_NON_DMS_FIELDS.forEach((field) => {
          if (Object.prototype.hasOwnProperty.call(item, field)) {
            errors.push(`Non-DMS item at index ${idx} contains forbidden financial field: ${field}`);
          }
        });
      } else {
        // DMS check: MUST have financial fields defined
        REQUIRED_DMS_FINANCIAL_FIELDS.forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(item, field)) {
            errors.push(`DMS item at index ${idx} is missing required financial field: ${field}`);
          }
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
