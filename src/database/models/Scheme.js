// Scheme model (Scheme.js)
import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Scheme extends Model {
  static table = "Scheme__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    schemeType: "Scheme_Type__c",
    status2: "Status2__c",
    vertical: "Vertical__c",
    transactionType: "Transaction_Type__c",
    groupLogic: "Group_Logic__c",
    invoiceType: "Invoice_Type__c",

    // metadata
    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    SoftDelete: "SoftDelete",
    errorMsg: "ErrorMsg",
  };

  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("Scheme_Type__c") schemeType;
  @field("Status2__c") status2;
  @field("Vertical__c") vertical;
  @field("Transaction_Type__c") transactionType;
  @field("Group_Logic__c") groupLogic;
  @field("Invoice_Type__c") invoiceType;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  @field("ErrorMsg") errorMsg;
}
