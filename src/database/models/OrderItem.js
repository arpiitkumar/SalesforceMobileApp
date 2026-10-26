import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class OrderItem extends Model {
  static table = "OrderItem";

  @field("OrderId") orderId;
  @field("Order_Quantity_In_Kg__c") order_Quantity_In_Kg__c;
  @field("Order_Quantity_In_Mt__c") order_Quantity_In_Mt__c;
  @field("Order_Amount__c") order_Amount__c;
  @field("SGST_Amount__c") sGST_Amount__c;
  @field("CGST_Amount__c") cGST_Amount__c;

  @field("Sf_Id") sfId;
  @field("Invoice_Item__c") invoice_Item__c;
  @field("Reason_Of_Return__c") reason_Of_Return__c;
  @field("Sales_Return_Value__c") sales_Return_Value__c;
  @field("Product2Id") product2Id;
  @field("Quantity") quantity;
  @field("Fulfilled_Qty_KG__c") fulfilledQtyKg;
  @field("Fulfilled_Value__c") fulfilledValue;
  @field("Rejected_Qty_KG__c") rejectedQtyKg;
  @field("Rejected_Value__c") rejectedValue;
  @field("OrderQtyInCase__c") orderQtyInCase;
  @field("Quantity_In_Box__c") quantityInBox;
  @field("Quantity_In_Pcs__c") quantityInPcs;
  @field("UnitPrice") unitPrice;
  @field("SRChangedPrice__c") srChangedPrice;
  @field("GrossAmount__c") grossAmount;
  @field("GrossAmountExcelMargin__c") grossAmountExcelMargin;
  @field("SchemeDiscount__c") schemeDiscount;
  @field("NetAmount__c") netAmount;
  @field("SchemeCode__c") schemeCode;
  @field("SKUCode__c") skuCode;
  @field("UOM__c") uom;
  @field("TaxableAmount__c") taxableAmount;
  @field("Sceheme__c") sceheme;
  @field("CreatedDate") createdDate;
  @field("PricebookEntryId") pricebookEntryId;
  @field("SlabId__c") slabId__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("isFOC__c") isFOC__c;

  static columns = {
    sfId: "Sf_Id",
    invoice_Item__c: "Invoice_Item__c",
    reason_Of_Return__c: "Reason_Of_Return__c",
    sales_Return_Value__c: "Sales_Return_Value__c",
    orderId: "OrderId",
    order_Quantity_In_Kg__c: "Order_Quantity_In_Kg__c",
    order_Quantity_In_Mt__c: "Order_Quantity_In_Mt__c",
    order_Amount__c: "Order_Amount__c",
    sGST_Amount__c: "SGST_Amount__c",
    cGST_Amount__c: "CGST_Amount__c",
    product2Id: "Product2Id",
    quantity: "Quantity",
    fulfilledQtyKg: "Fulfilled_Qty_KG__c",
    fulfilledValue: "Fulfilled_Value__c",
    rejectedQtyKg: "Rejected_Qty_KG__c",
    rejectedValue: "Rejected_Value__c",
    orderQtyInCase: "OrderQtyInCase__c",
    quantityInBox: "Quantity_In_Box__c",
    quantityInPcs: "Quantity_In_Pcs__c",
    unitPrice: "UnitPrice",
    srChangedPrice: "SRChangedPrice__c",
    grossAmount: "GrossAmount__c",
    grossAmountExcelMargin: "GrossAmountExcelMargin__c",
    schemeDiscount: "SchemeDiscount__c",
    netAmount: "NetAmount__c",
    schemeCode: "SchemeCode__c",
    skuCode: "SKUCode__c",
    uom: "UOM__c",
    taxableAmount: "TaxableAmount__c",
    sceheme: "Sceheme__c",
    createdDate: "CreatedDate",
    pricebookEntryId: "PricebookEntryId",
    slabId__c: "SlabId__c",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    isFOC__c: "isFOC__c",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
