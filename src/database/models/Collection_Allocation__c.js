import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Collection_Allocation__c extends Model {
  static table = "Collection_Allocation__c";

  @field("Sf_Id") sfId;
  @field("Collection__c") collection__c;
  @field("Invoice__c") invoice__c;
  @field("AdjustedAmount__c") adjustedAmount__c;
  @field("AllocationDate__c") allocationDate__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    collection__c: "Collection__c",
    invoice__c: "Invoice__c",
    adjustedAmount__c: "AdjustedAmount__c", // FIXED
    allocationDate__c: "AllocationDate__c",

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
