import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class CompetitorMaster extends Model {
  static table = "CompetitorMaster__c";

  // Fields
  @field("Sf_Id") sfId;
  @field("IsActive__c") isActive;
  @field("Address__c") address;
  @field("Name") name;
  @field("Zone__c") zone;

  // Sync-related fields
  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;

  // Optional: for consistent column access if needed
  static columns = {
    sfId: "Sf_Id",
    isActive: "IsActive__c",
    address: "Address__c",
    name: "Name",
    zone: "Zone__c",
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
