import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Template__c extends Model {
  static table = "Survey_Template__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    status__c: "Status__c",
    frequency__c: "Frequency__c",
    effective_From__c: "Effective_From__c",
    effective_To__c: "Effective_To__c",

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
  @field("Status__c") status__c;
  @field("Frequency__c") frequency__c;
  @field("Effective_From__c") effective_From__c;
  @field("Effective_To__c") effective_To__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}
