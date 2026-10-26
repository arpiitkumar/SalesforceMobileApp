import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Geography__c extends Model {
  static table = "Geography__c";
  @field("Sf_Id") sfId;
  @field("Name") name;
  @field("DeveloperName") developerName;
  @field("ParentGeography__c") parentGeography__c;
  @field("ParentGeography_Name") parentGeography_Name;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    developerName: "DeveloperName",
    parentGeography__c: "ParentGeography__c",
    parentGeography_Name: "ParentGeography_Name",

    isLocallyChanged: "is_locally_changed",
    operationType: "operation_type",
    lastModified: "last_modified",
    isSynced: "is_synced",
    syncStatus: "sync_status",
    errorMsg: "ErrorMsg",
  };

  @field("ErrorMsg") errorMsg;
}
