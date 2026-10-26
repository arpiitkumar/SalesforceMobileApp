import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";
import { isLowRamDevice } from "react-native-device-info";

export default class InvoiceItem extends Model {
  static table = "Invoice_Item__c";

  @field("Sf_Id") sfId;

  @field("Name") name;
  @field("ProductCode") productCode;
  @field("Invoice__c") invoice__c;
  @field("InvoiceQuantityPcs__c") invoiceQuantityPcs;
  @field("Invoice_Quantity_In_Mt__c") invoice_Quantity_In_Mt__c;
  @field("RatePerPC__c") ratePerPC;
  @field("Gross_Amount__c") gross_Amount__c;
  @field("NetAmount__c") netAmount__c;
  @field("CGSTAmount__c") cGSTAmount__c;
  @field("SGSTAmount__c") sGSTAmount;
  @field("IGSTAmount__c") iGSTAmount__c;
  @field("Product__c") product__c;
  @field("Return_Quantity_in_Pcs__c") return_Quantity_in_Pcs__c;
  @field("SchemeDiscount__c") schemeDiscount__c;
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    invoice__c: "Invoice__c",
    productCode: "ProductCode",
    invoiceQuantityPcs: "InvoiceQuantityPcs__c",
    invoice_Quantity_In_Mt__c: "Invoice_Quantity_In_Mt__c",
    ratePerPC: "RatePerPC__c",
    gross_Amount__c: "Gross_Amount__c",
    netAmount__c: "NetAmount__c",
    cGSTAmount__c: "CGSTAmount__c",
    sGSTAmount: "SGSTAmount__c",
    iGSTAmount__c: "IGSTAmount__c",
    product__c: "Product__c",
    return_Quantity_in_Pcs__c: "Return_Quantity_in_Pcs__c",
    schemeDiscount__c: "SchemeDiscount__c",
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    softDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
