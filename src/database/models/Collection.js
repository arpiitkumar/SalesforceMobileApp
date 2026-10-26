import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Collection extends Model {
  static table = "Collection__c";

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Customer__c") customer;
  @field("PaidAmount__c") paidAmount;
  @field("PaymentMode__c") paymentMode;
  @field("DateOfPayment__c") dateOfPayment;
  @field("ChequeApproveDate__c") chequeApproveDate;
  @field("ChequeNEFTDate__c") chequeNEFTDate;
  @field("ChequeNumber__c") chequeNumber;
  @field("BankName__c") bankName;
  @field("ChequeImage__c") chequeImage;
  @field("Comment__c") comment;
  @field("CollectionType__c") collectionType;
  @field("Visit__c") visit;

  // Optional sync/local flags
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    customer: "Customer__c",
    paidAmount: "PaidAmount__c",
    paymentMode: "PaymentMode__c",
    dateOfPayment: "DateOfPayment__c",
    chequeApproveDate: "ChequeApproveDate__c",
    chequeNEFTDate: "ChequeNEFTDate__c",
    chequeNumber: "ChequeNumber__c",
    bankName: "BankName__c",
    chequeImage: "ChequeImage__c",
    comment: "Comment__c",
    collectionType: "CollectionType__c",
    visit: "Visit__c",

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
