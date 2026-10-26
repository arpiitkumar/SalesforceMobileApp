import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";
import { isLowRamDevice } from "react-native-device-info";

export default class Invoice extends Model {
  static table = "Invoice__c";

  @field("Sf_Id") sfId;

  @field("Name") name;
  @field("SupplierName__c") supplierName__c;
  @field("InvoiceNo__c") invoiceNumber;
  @field("InvoiceDate__c") invoiceDate;
  @field("Order__c") order;
  @field("Customer__c") customer;
  @field("Return_Submitted__c") returnSubmit;

  @field("Status__c") status;
  @field("AdditionalDiscount__c") additionalDiscount;
  @field("TotalGSTAmt__c") totalGstAmount;
  @field("GSTRATE__c") gstRate;
  @field("Total_Net_Amount__c") netAmmount;
  @field("Return_Adjusted_Against_Outstanding__c")
  return_Adjusted_Against_Outstanding;
  @field("Total_Sales_Return_Value__c") total_Sales_Return_Value;
  @field("Outstanding_Amount__c") outstandingAmount;
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    supplierName__c: "SupplierName__c",
    invoiceNumber: "InvoiceNo__c",
    invoiceDate: "InvoiceDate__c",
    order: "Order__c",
    customer: "Customer__c",
    returnSubmit: "Return_Submitted__c",

    status: "Status__c",
    additionalDiscount: "AdditionalDiscount__c",
    totalGstAmount: "TotalGSTAmt__c",
    gstRate: "GSTRATE__c",
    netAmmount: "Total_Net_Amount__c",
    return_Adjusted_Against_Outstanding:
      "Return_Adjusted_Against_Outstanding__c",
    total_Sales_Return_Value: "Total_Sales_Return_Value__c",
    outstandingAmount: "Outstanding_Amount__c",

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
