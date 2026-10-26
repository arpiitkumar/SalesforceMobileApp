import { Model } from "@nozbe/watermelondb";
import { field } from "@nozbe/watermelondb/decorators";

export default class Survey_Assignment_Target__c extends Model {
  static table = "Survey_Assignment_Target__c";

  static columns = {
    sfId: "Sf_Id",
    name: "Name",
    survey_Assignment__c: "Survey_Assignment__c",
    geography__c: "Geography__c",
    user__c: "User__c",
    distributor__c: "Distributor__c",
    outlet__c: "Outlet__c",

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
  @field("Survey_Assignment__c") survey_Assignment__c;
  @field("Geography__c") geography__c;
  @field("User__c") user__c;
  @field("Distributor__c") distributor__c;
  @field("Outlet__c") outlet__c;

  @field("is_locally_changed") isLocallyChanged;
  @field("operation_type") operationType;
  @field("last_modified") lastModified;
  @field("is_synced") isSynced;
  @field("sync_status") syncStatus;
  @field("SoftDelete") softDelete;
  @field("ErrorMsg") errorMsg;
}
