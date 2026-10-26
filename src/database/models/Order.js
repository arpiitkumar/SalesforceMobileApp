import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Order extends Model {
  static table = "Order";

  @field("Sf_Id") sfId;

  @field("Type") type;
  @field("IsNonDmsOrder__c") isNonDmsOrder;
  @field("Secondary_Order_Supplier__c") secondary_Order_Supplier__c;
  @field("Total_Return_Value__c") total_Return_Value__c;
  @field("AccountId") accountId;
  @field("OrderPlacedBy__c") orderPlacedBy;
  @field("Source__c") source;
  @field("OrderSubmissionTime__c") orderSubmissionTime;
  @field("Status") status;
  @field("EffectiveDate") effectiveDate;
  @field("TotalAmount") totalAmount;
  @field("TotalOrderQtyKg__c") totalOrderQtyKg;
  @field("TotalReturnQuantity__c") totalreturnQty;
  @field("TotalOrderQtyInPcs__c") totalOrderQtyPcs;
  @field("FulfilledQtyKg__c") fulfilledQtyKg;
  @field("TotalFulfilledValue__c") totalFulfilledValue;
  @field("RejectedQtyKg__c") rejectedQtyKg;
  @field("RejectedValue__c") rejectedValue;
  @field("Visit__c") visit;
  @field("Invoices__c") invoices;
  @field("RecordTypeId") recordTypeId;
  @field("Fulfillment_Status__c") fulfillment_Status__c;
  @field("Mobile_Unique_Id__c") mobile_Unique_Id__c;
  @field("Pricebook2Id") pricebook2Id;
  @field("Return_Category__c") return_Category__c;
  @field("ReturnDate__c") returnDate__c;
  @field("TypeOfReturn__c") typeOfReturn__c;
  @field("Beat__c") beat__c;

  @field("OrderNumber") orderNumber;
  @field("CreatedDate") CreatedDate;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    type: "Type",
    isNonDmsOrder: "IsNonDmsOrder__c",
    secondary_Order_Supplier__c: "Secondary_Order_Supplier__c",
    total_Return_Value__c: "Total_Return_Value__c",
    effectiveDate: "EffectiveDate",
    accountId: "AccountId",
    orderPlacedBy: "OrderPlacedBy__c",
    source: "Source__c",
    orderSubmissionTime: "OrderSubmissionTime__c",
    status: "Status",
    totalAmount: "TotalAmount",
    totalOrderQtyKg: "TotalOrderQtyKg__c",
    totalreturnQty: "TotalReturnQuantity__c",
    totalOrderQtyPcs: "TotalOrderQtyInPcs__c",
    fulfilledQtyKg: "FulfilledQtyKg__c",
    totalFulfilledValue: "TotalFulfilledValue__c",
    rejectedQtyKg: "RejectedQtyKg__c",
    rejectedValue: "RejectedValue__c",
    visit: "Visit__c",
    invoices: "Invoices__c",
    recordTypeId: "RecordTypeId",
    orderNumber: "OrderNumber",
    CreatedDate: "CreatedDate",
    fulfillment_Status__c: "Fulfillment_Status__c",
    mobile_Unique_Id__c: "Mobile_Unique_Id__c",
    pricebook2Id: "Pricebook2Id",
    typeOfReturn__c: "TypeOfReturn__c",
    returnDate__c: "ReturnDate__c",
    return_Category__c: "Return_Category__c",
    beat__c: "Beat__c",

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
