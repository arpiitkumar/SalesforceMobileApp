import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class IncotermAssignment__c extends Model {
  static table = "IncotermAssignment__c";
  @field("Sf_Id") sfId;
  @field("Vertical__c") vertical__c;
  @field("DistributorChannel__c") distributorChannel__c;
  @field("Customer_Group__c") customer_Group__c;
  @field("Zone__c") zone__c;
  @field("Account__c") account__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  static columns = {
    sfId: "Sf_Id",
    vertical__c: "Vertical__c",
    distributorChannel__c: "DistributorChannel__c",
    customer_Group__c: "Customer_Group__c",
    zone__c: "Zone__c",
    account__c: "Account__c",

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
